import json, secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from sqlalchemy.orm import Session
from typing import List
import urllib.request as _urllib_req2
import urllib.error as _urllib_err2
import httpx as _httpx

import models, schemas
from database import get_db

router = APIRouter()

ENTITY_ENDPOINT_MAP = {
    "cards":     ["/cards", "/cards/{id}", "/cards/{id}/move", "/cards/{id}/activities"],
    "leads":     ["/leads", "/leads/{id}", "/leads/{id}/move", "/leads/{id}/convert", "/leads/{id}/activities"],
    "contacts":  ["/contacts", "/contacts/{id}"],
    "companies": ["/companies", "/companies/{id}"],
}

ALL_EVENTS = [
    "card.created", "card.updated", "card.moved", "card.deleted",
    "lead.created", "lead.updated", "lead.moved", "lead.converted", "lead.deleted",
    "contact.created", "contact.updated",
    "company.created", "company.updated",
]


@router.get("/webhooks/meta/entities")
def get_entities_meta():
    return {
        "entities": list(ENTITY_ENDPOINT_MAP.keys()),
        "entity_endpoints": ENTITY_ENDPOINT_MAP,
        "events": ALL_EVENTS,
    }


@router.get("/webhooks", response_model=List[schemas.Webhook])
def get_webhooks(db: Session = Depends(get_db)):
    return db.query(models.Webhook).order_by(models.Webhook.id.desc()).all()


@router.post("/webhooks", response_model=schemas.Webhook)
def create_webhook(wh: schemas.WebhookCreate, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(32)
    db_wh = models.Webhook(**wh.model_dump(), token=token)
    db.add(db_wh)
    db.commit()
    db.refresh(db_wh)
    return db_wh


@router.put("/webhooks/{wh_id}", response_model=schemas.Webhook)
def update_webhook(wh_id: int, wh: schemas.WebhookCreate, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    for k, v in wh.model_dump().items():
        setattr(db_wh, k, v)
    db.commit()
    db.refresh(db_wh)
    return db_wh


@router.delete("/webhooks/{wh_id}", response_model=schemas.OkResponse)
def delete_webhook(wh_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(db_wh)
    db.commit()
    return {"ok": True}


@router.post("/webhooks/{wh_id}/regenerate-token", response_model=schemas.Webhook)
def regenerate_token(wh_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db_wh.token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(db_wh)
    return db_wh


@router.post("/webhooks/{wh_id}/test")
def test_webhook(wh_id: int, db: Session = Depends(get_db)):
    wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook não encontrado")
    if wh.type != 'outbound':
        raise HTTPException(status_code=400, detail="Apenas webhooks de saída podem ser testados")
    if not wh.url:
        raise HTTPException(status_code=400, detail="URL não configurada")

    import time as _time

    payload = {
        "event": "test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "webhook_id": wh.id,
        "data": {"message": "Este é um disparo de teste do Nexus CRM"}
    }
    payload_bytes = json.dumps(payload).encode()
    req = _urllib_req2.Request(
        wh.url,
        data=payload_bytes,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = _time.monotonic()
    status_code = None
    response_body = None
    success = False
    error_message = None
    try:
        with _urllib_req2.urlopen(req, timeout=10) as resp:
            status_code = resp.status
            try:
                response_body = resp.read(500).decode(errors='replace')
            except Exception:
                response_body = ''
            success = 200 <= status_code < 300
    except _urllib_err2.HTTPError as e:
        status_code = e.code
        success = 200 <= e.code < 300
        error_message = str(e)
    except Exception as e:
        err = str(e)
        # Connection reset after sending = n8n received but closed abruptly — treat as success
        if status_code and 200 <= status_code < 300:
            success = True
        else:
            error_message = err[:300]

    latency_ms = int((_time.monotonic() - start) * 1000)
    log = models.WebhookLog(
        webhook_id=wh.id, event="test",
        status_code=status_code, response_body=response_body,
        latency_ms=latency_ms, success=success, error_message=error_message,
    )
    db.add(log)
    db.commit()
    return {"success": success, "status_code": status_code, "latency_ms": latency_ms, "error": error_message}


@router.get("/webhooks/{wh_id}/logs")
def get_webhook_logs(wh_id: int, limit: int = 20, db: Session = Depends(get_db)):
    logs = (
        db.query(models.WebhookLog)
        .filter(models.WebhookLog.webhook_id == wh_id)
        .order_by(models.WebhookLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "event": l.event,
            "status_code": l.status_code,
            "latency_ms": l.latency_ms,
            "success": l.success,
            "error_message": l.error_message,
            "response_body": l.response_body,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


async def _inbound_handler(token: str, entity: str, request: FastAPIRequest, db: Session, path: str = ""):
    """Inbound proxy: validates token permissions and forwards to internal endpoint."""
    db_wh = db.query(models.Webhook).filter(
        models.Webhook.token == token,
        models.Webhook.type == 'inbound',
        models.Webhook.active == True,
    ).first()
    if not db_wh:
        raise HTTPException(status_code=403, detail="Token inválido ou webhook inativo")

    allowed_entities = db_wh.allowed_entities or []
    if allowed_entities and entity not in allowed_entities:
        raise HTTPException(status_code=403, detail=f"Acesso à entidade '{entity}' não permitido para este webhook")

    allowed_methods = db_wh.allowed_methods or ["POST"]
    if request.method not in allowed_methods:
        raise HTTPException(status_code=405, detail=f"Método '{request.method}' não permitido para este webhook")

    try:
        body_bytes = await request.body()
        payload = json.loads(body_bytes) if body_bytes else {}
    except Exception:
        payload = {}

    base = str(request.base_url).rstrip('/')
    sub = f"/{path}" if path else ""
    qs = f"?{request.url.query}" if request.url.query else ""
    target_url = f"{base}/{entity}{sub}{qs}"

    try:
        async with _httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(
                method=request.method,
                url=target_url,
                json=payload if payload else None,
                headers={"Content-Type": "application/json"},
            )
        try:
            result = resp.json()
        except Exception:
            result = resp.text

        if resp.status_code >= 400:
            detail = result.get("detail", result) if isinstance(result, dict) else result
            raise HTTPException(status_code=resp.status_code, detail=detail)

        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao processar requisição interna: {type(e).__name__}: {str(e)}")


@router.api_route("/webhook/in/{token}/{entity}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def inbound_webhook(token: str, entity: str, request: FastAPIRequest, db: Session = Depends(get_db)):
    return await _inbound_handler(token, entity, request, db)


@router.api_route("/webhook/in/{token}/{entity}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def inbound_webhook_sub(token: str, entity: str, path: str, request: FastAPIRequest, db: Session = Depends(get_db)):
    return await _inbound_handler(token, entity, request, db, path)
