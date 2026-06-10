from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json, re, os, shutil, time, secrets, threading
from urllib import request as urllib_req
from urllib.request import urlopen
from urllib.error import URLError
from database import SessionLocal

import models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

# Safe column migrations (no-op if column already exists)
_MIGRATIONS = [
    "ALTER TABLE activities ADD COLUMN actor VARCHAR DEFAULT 'Usuário'",
    "ALTER TABLE custom_fields ADD COLUMN uid VARCHAR DEFAULT ''",
    "ALTER TABLE custom_fields ADD COLUMN show_on_card BOOLEAN DEFAULT 0",
    "ALTER TABLE activities ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
    "ALTER TABLE leads ADD COLUMN salutation VARCHAR",
    "ALTER TABLE leads ADD COLUMN first_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN last_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN middle_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN birth_date VARCHAR",
    "ALTER TABLE leads ADD COLUMN position VARCHAR",
    "ALTER TABLE leads ADD COLUMN company_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN phone VARCHAR",
    "ALTER TABLE leads ADD COLUMN email VARCHAR",
    "ALTER TABLE leads ADD COLUMN website VARCHAR",
    "ALTER TABLE leads ADD COLUMN source_info VARCHAR",
    "ALTER TABLE leads ADD COLUMN available_to_all BOOLEAN DEFAULT 1",
    "ALTER TABLE leads ADD COLUMN address VARCHAR",
    "ALTER TABLE leads ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE leads ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE leads ADD COLUMN utm_campaign VARCHAR",
    "ALTER TABLE leads ADD COLUMN comment VARCHAR",
    "ALTER TABLE contacts ADD COLUMN salutation VARCHAR",
    "ALTER TABLE contacts ADD COLUMN middle_name VARCHAR",
    "ALTER TABLE contacts ADD COLUMN position VARCHAR",
    "ALTER TABLE contacts ADD COLUMN website VARCHAR",
    "ALTER TABLE contacts ADD COLUMN messenger VARCHAR",
    "ALTER TABLE contacts ADD COLUMN company_name VARCHAR",
    "ALTER TABLE contacts ADD COLUMN source VARCHAR",
    "ALTER TABLE contacts ADD COLUMN source_info VARCHAR",
    "ALTER TABLE contacts ADD COLUMN available_to_all BOOLEAN DEFAULT 1",
    "ALTER TABLE contacts ADD COLUMN included_in_export BOOLEAN DEFAULT 1",
    "ALTER TABLE contacts ADD COLUMN contact_type VARCHAR",
    "ALTER TABLE contacts ADD COLUMN observers VARCHAR",
    "ALTER TABLE contacts ADD COLUMN comment VARCHAR",
    "ALTER TABLE contacts ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE contacts ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE contacts ADD COLUMN utm_campaign VARCHAR",
    "ALTER TABLE contacts ADD COLUMN photo_url VARCHAR",
    "ALTER TABLE contacts ADD COLUMN responsible_user_id INTEGER REFERENCES users(id)",
    # Companies table is created by SQLAlchemy; junction is also auto-created
    # These are safe no-ops for columns that might not exist yet on older DBs:
    "ALTER TABLE companies ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE companies ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE companies ADD COLUMN utm_campaign VARCHAR",
    "ALTER TABLE companies ADD COLUMN last_contact_at DATETIME",
]
with engine.connect() as _conn:
    for _sql in _MIGRATIONS:
        try:
            _conn.execute(text(_sql))
            _conn.commit()
        except Exception:
            pass

# UID prefix map per entity
_UID_PREFIXES = {'deal': 'NGS', 'contact': 'CTT', 'user': 'EQP'}

def _generate_uid(entity: str, db) -> str:
    prefix = _UID_PREFIXES.get(entity, 'FLD')
    existing = db.query(models.CustomField).filter(models.CustomField.entity == entity).all()
    used = set()
    for f in existing:
        if f.uid and f.uid.startswith(prefix + '-'):
            try: used.add(int(f.uid.split('-')[1]))
            except (IndexError, ValueError): pass
    n = 1
    while n in used:
        n += 1
    return f"{prefix}-{n:03d}"

app = FastAPI()

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_default_negocios_stages(db: Session, pipeline_id: int):
    stages = [
        {"name": "Em Desenvolvimento",   "color": "#3b82f6"},
        {"name": "Criar documentos",     "color": "#8b5cf6"},
        {"name": "Fatura",               "color": "#f59e0b"},
        {"name": "Em andamento",         "color": "#06b6d4"},
        {"name": "Fatura final",         "color": "#f97316"},
        {"name": "Negócios Fechados",    "color": "#22c55e"},
        {"name": "Negócios Perdidos",    "color": "#ef4444"},
        {"name": "Analisar falha",       "color": "#dc2626"},
    ]
    for i, stg in enumerate(stages):
        db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=pipeline_id))
    db.commit()

# ---- Inicialização de Dados Padrão ----
@app.on_event("startup")
def startup_event():
    db = next(get_db())

    DEFAULT_LEADS_STAGES = [
        {"name": "Não atribuído",   "color": "#06b6d4"},
        {"name": "Em andamento",    "color": "#06b6d4"},
        {"name": "Processado",      "color": "#06b6d4"},
        {"name": "Lead descartado", "color": "#ef4444"},
        {"name": "Lead convertido", "color": "#22c55e"},
    ]

    p_leads = db.query(models.Pipeline).filter(models.Pipeline.name == "Leads").first()
    if not p_leads:
        p_leads = models.Pipeline(name="Leads")
        db.add(p_leads)
        db.commit()
    # Garantir etapas mesmo em bancos antigos
    existing_leads_stages = db.query(models.Stage).filter(models.Stage.pipeline_id == p_leads.id).count()
    if existing_leads_stages == 0:
        for i, stg in enumerate(DEFAULT_LEADS_STAGES):
            db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=p_leads.id))
        db.commit()

    p_negocios = db.query(models.Pipeline).filter(models.Pipeline.name == "Negócios").first()
    if not p_negocios:
        p_negocios = models.Pipeline(name="Negócios")
        db.add(p_negocios)
        db.commit()
    # Garantir etapas mesmo em bancos antigos
    existing_neg_stages = db.query(models.Stage).filter(models.Stage.pipeline_id == p_negocios.id).count()
    if existing_neg_stages == 0:
        create_default_negocios_stages(db, p_negocios.id)

# ---- Rotas Pipelines ----
@app.get("/pipelines", response_model=List[schemas.Pipeline])
def get_pipelines(db: Session = Depends(get_db)):
    return db.query(models.Pipeline).all()

@app.post("/pipelines", response_model=schemas.Pipeline)
def create_pipeline(pipeline: schemas.PipelineCreate, db: Session = Depends(get_db)):
    if pipeline.name in ("Leads", "Negócios"):
        raise HTTPException(status_code=400, detail="Não é permitido criar funis com o nome 'Leads' ou 'Negócios'.")
    db_pipe = models.Pipeline(name=pipeline.name)
    db.add(db_pipe)
    db.commit()
    db.refresh(db_pipe)
    create_default_negocios_stages(db, db_pipe.id)
    return db_pipe

@app.put("/pipelines/{pipe_id}", response_model=schemas.Pipeline)
def update_pipeline(pipe_id: int, pipeline_data: schemas.PipelineCreate, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    # Não permitir renomear os padrões para evitar quebra de lógica
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido renomear os funis padrão.")
    pipe.name = pipeline_data.name
    db.commit()
    db.refresh(pipe)
    return pipe

@app.delete("/pipelines/{pipe_id}")
def delete_pipeline(pipe_id: int, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido excluir os funis padrão (Leads e Negócios).")
    
    db.delete(pipe)
    db.commit()
    return {"status": "ok"}

# ---- Rotas Stages ----
@app.get("/stages", response_model=List[schemas.Stage])
def get_stages(pipeline_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Stage)
    if pipeline_id:
        query = query.filter(models.Stage.pipeline_id == pipeline_id)
    return query.order_by(models.Stage.order).all()

@app.post("/stages", response_model=schemas.Stage)
def create_stage(stage: schemas.StageCreate, db: Session = Depends(get_db)):
    db_stage = models.Stage(**stage.dict())
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/stages/{stage_id}", response_model=schemas.Stage)
def update_stage(stage_id: int, stage_data: schemas.StageCreate, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    stg.name = stage_data.name
    stg.color = stage_data.color
    stg.order = stage_data.order
    db.commit()
    db.refresh(stg)
    return stg

@app.delete("/stages/{stage_id}")
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    db.delete(stg)
    db.commit()
    return {"ok": True}

# ---- Rotas Contacts ----
@app.get("/contacts", response_model=List[schemas.Contact])
def get_contacts(db: Session = Depends(get_db)):
    return db.query(models.Contact).all()

@app.post("/contacts", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact

@app.put("/contacts/{contact_id}", response_model=schemas.Contact)
def update_contact(contact_id: int, contact_data: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    for key, value in contact_data.dict().items():
        setattr(db_contact, key, value)
        
    db.commit()
    db.refresh(db_contact)
    return db_contact

# ---- Rotas Companies ----

@app.get("/companies", response_model=List[schemas.Company])
def get_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).all()

@app.post("/companies", response_model=schemas.Company)
def create_company(company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    data = company.dict()
    contact_ids = data.pop('contact_ids', [])
    db_company = models.Company(**data)
    if contact_ids:
        db_company.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

@app.get("/companies/{company_id}", response_model=schemas.Company)
def get_company(company_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c

@app.put("/companies/{company_id}", response_model=schemas.Company)
def update_company(company_id: int, company_data: schemas.CompanyCreate, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    data = company_data.dict()
    contact_ids = data.pop('contact_ids', [])
    for key, value in data.items():
        setattr(db_company, key, value)
    if contact_ids is not None:
        db_company.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    db.commit()
    db.refresh(db_company)
    return db_company

@app.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(db_company)
    db.commit()
    return {"ok": True}

# ---- Webhooks ----
from datetime import datetime, timezone
from fastapi import Request as FastAPIRequest
import urllib.request as _urllib_req2
import urllib.parse as _urllib_parse

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

def _fire_outbound_webhooks(event: str, entity: str, payload: dict):
    """Fire outbound webhooks in background thread — non-blocking."""
    def _worker():
        with SessionLocal() as db:
            hooks = db.query(models.Webhook).filter(
                models.Webhook.type == 'outbound',
                models.Webhook.active == True,
                models.Webhook.url != None,
            ).all()
            for h in hooks:
                try:
                    allowed_entities = json.loads(h.allowed_entities or '[]')
                    events = json.loads(h.events or '[]')
                    if allowed_entities and entity not in allowed_entities:
                        continue
                    if events and event not in events:
                        continue
                    body = json.dumps({
                        "event": event,
                        "entity": entity,
                        "data": payload,
                        "webhook_token": h.token,
                    }).encode()
                    req = _urllib_req2.Request(
                        h.url,
                        data=body,
                        headers={"Content-Type": "application/json", "X-Webhook-Token": h.token},
                        method="POST",
                    )
                    _urllib_req2.urlopen(req, timeout=5)
                except Exception:
                    pass
    threading.Thread(target=_worker, daemon=True).start()

@app.get("/webhooks", response_model=List[schemas.Webhook])
def get_webhooks(db: Session = Depends(get_db)):
    return db.query(models.Webhook).order_by(models.Webhook.id.desc()).all()

@app.post("/webhooks", response_model=schemas.Webhook)
def create_webhook(wh: schemas.WebhookCreate, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(32)
    db_wh = models.Webhook(**wh.dict(), token=token)
    db.add(db_wh)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@app.put("/webhooks/{wh_id}", response_model=schemas.Webhook)
def update_webhook(wh_id: int, wh: schemas.WebhookCreate, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    for k, v in wh.dict().items():
        setattr(db_wh, k, v)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@app.delete("/webhooks/{wh_id}")
def delete_webhook(wh_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(db_wh)
    db.commit()
    return {"ok": True}

@app.post("/webhooks/{wh_id}/regenerate-token", response_model=schemas.Webhook)
def regenerate_token(wh_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db_wh.token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@app.api_route("/webhook/in/{token}/{entity}", methods=["GET", "POST", "PUT", "DELETE"])
async def inbound_webhook(token: str, entity: str, request: FastAPIRequest, db: Session = Depends(get_db)):
    """Inbound proxy: validates token permissions and forwards to internal endpoint."""
    db_wh = db.query(models.Webhook).filter(
        models.Webhook.token == token,
        models.Webhook.type == 'inbound',
        models.Webhook.active == True,
    ).first()
    if not db_wh:
        raise HTTPException(status_code=403, detail="Token inválido ou webhook inativo")

    allowed_entities = json.loads(db_wh.allowed_entities or '[]')
    if allowed_entities and entity not in allowed_entities:
        raise HTTPException(status_code=403, detail=f"Acesso à entidade '{entity}' não permitido para este webhook")

    allowed_methods = json.loads(db_wh.allowed_methods or '["POST"]')
    if request.method not in allowed_methods:
        raise HTTPException(status_code=405, detail=f"Método '{request.method}' não permitido para este webhook")

    # Read body and dispatch to internal API
    try:
        body = await request.body()
        payload = json.loads(body) if body else {}
    except Exception:
        payload = {}

    # Map entity → internal handler
    from fastapi.testclient import TestClient
    # Instead of re-routing internally we return what would be processed
    # and let the caller use the real /entity endpoints with the token as proof
    # Practical: forward body to the real endpoint via internal call
    base = str(request.base_url).rstrip('/')
    target_url = f"{base}/{entity}"
    try:
        inner_req = _urllib_req2.Request(
            target_url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method=request.method,
        )
        with _urllib_req2.urlopen(inner_req, timeout=10) as resp:
            result = json.loads(resp.read())
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao processar requisição interna: {str(e)}")

@app.get("/webhooks/meta/entities")
def get_entities_meta():
    return {
        "entities": list(ENTITY_ENDPOINT_MAP.keys()),
        "entity_endpoints": ENTITY_ENDPOINT_MAP,
        "events": ALL_EVENTS,
    }

# ---- Rotas Cards ----

def _sync_relations(card, contact_ids, user_ids, db):
    if contact_ids is not None:
        card.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    if user_ids is not None:
        card.users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()

@app.get("/cards", response_model=List[schemas.Card])
def get_cards(pipeline_id: int = None, contact_id: int = None, user_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Card)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    if contact_id:
        query = query.filter(models.Card.contacts.any(models.Contact.id == contact_id))
    if user_id:
        query = query.filter(models.Card.users.any(models.User.id == user_id))
    return query.all()

@app.post("/cards", response_model=schemas.Card)
def create_card(card: schemas.CardCreate, db: Session = Depends(get_db)):
    data = card.dict(exclude_unset=True)
    contact_ids = data.pop("contact_ids", [])
    user_ids = data.pop("user_ids", [])
    if not data.get("created_at"):
        data["created_at"] = datetime.now(timezone.utc)
    db_card = models.Card(**data)
    db.add(db_card)
    db.flush()
    _sync_relations(db_card, contact_ids, user_ids, db)
    db.add(models.Activity(card_id=db_card.id, type='created', content='Negócio criado', actor='Usuário'))
    db.commit()
    db.refresh(db_card)
    _fire_outbound_webhooks("card.created", "cards", {"id": db_card.id, "title": db_card.title, "stage_id": db_card.stage_id})
    return db_card

@app.get("/cards/{card_id}", response_model=schemas.Card)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card

@app.delete("/cards/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"message": "Card deleted successfully"}

# ---- USERS ----
@app.get("/users", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_data: schemas.UserBase, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = user_data.name
    user.email = user_data.email
    user.role = user_data.role
    db.commit()
    db.refresh(user)
    return user

# ---- AUTOMATIONS ----
def _render_vars(template: str, vars: dict) -> str:
    return re.sub(r'\{\{\s*([^}]+?)\s*\}\}', lambda m: str(vars.get(m.group(1).strip(), '')), template)

def _build_vars(card, db) -> dict:
    contact = card.contacts[0] if card.contacts else None
    stage = db.query(models.Stage).filter(models.Stage.id == card.stage_id).first()
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first() if stage else None
    return {
        'deal.title': card.title or '',
        'deal.price': str(card.price or 0),
        'deal.id': str(card.id),
        'deal.description': card.description or '',
        'contact.name': f"{contact.first_name} {contact.last_name or ''}".strip() if contact else '',
        'contact.email': contact.email or '' if contact else '',
        'contact.phone': contact.phone or '' if contact else '',
        'stage.name': stage.name if stage else '',
        'pipeline.name': pipeline.name if pipeline else '',
    }

def _evaluate_structured_condition(cond: dict, vars: dict, card) -> bool:
    field    = cond.get('field', '')
    operator = cond.get('operator', '==')
    value    = str(cond.get('value', ''))

    # Resolve actual value from card/vars
    if field == 'deal.price':
        actual = str(card.price or 0) if card else vars.get('deal.price', '0')
    elif field == 'deal.title':
        actual = (card.title or '') if card else vars.get('deal.title', '')
    elif field == 'deal.description':
        actual = (card.description or '') if card else vars.get('deal.description', '')
    elif field == 'deal.stage_id':
        actual = str(card.stage_id) if card else ''
        stage_id = cond.get('stage_id')
        if stage_id is not None:
            value = str(stage_id)
    else:
        actual = vars.get(field, '')

    # Evaluate
    if operator in ('>', '<', '>=', '<=', '==', '!='):
        try:
            l, r = float(actual), float(value)
            return eval(f"{l} {operator} {r}")
        except (ValueError, TypeError):
            if operator == '==': return actual.lower() == value.lower()
            if operator == '!=': return actual.lower() != value.lower()
            return False
    elif operator == 'contains':
        return value.lower() in actual.lower()
    elif operator == '!contains':
        return value.lower() not in actual.lower()
    return False

def _evaluate_condition(condition: str, vars: dict, card=None) -> bool:
    if not condition:
        return True
    # Try structured JSON format first
    try:
        cond = json.loads(condition)
        if isinstance(cond, dict) and 'field' in cond:
            return _evaluate_structured_condition(cond, vars, card)
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    # Legacy raw string fallback
    rendered = _render_vars(condition, vars)
    if 'contains' in condition.lower():
        left_rendered = _render_vars(condition[:condition.lower().find('contains')].strip(), vars).lower()
        right_rendered = _render_vars(condition[condition.lower().find('contains') + 8:].strip().strip('"\''), vars).lower()
        return right_rendered in left_rendered
    for op in ['>=', '<=', '!=', '>', '<', '==']:
        if op in rendered:
            parts = rendered.split(op, 1)
            left, right = parts[0].strip(), parts[1].strip()
            try:
                l, r = float(left), float(right)
                return eval(f"{l} {op} {r}")
            except ValueError:
                if op == '==': return left == right
                if op == '!=': return left != right
    return bool(rendered.strip())

def _run_action(step_type: str, cfg: dict, vars: dict, card, db):
    if step_type == 'webhook':
        url = _render_vars(cfg.get('url', ''), vars)
        if url:
            payload = _render_vars(cfg.get('payload', '{}'), vars)
            method = cfg.get('method', 'POST').upper()
            try:
                body = payload.encode('utf-8') if method in ('POST', 'PUT', 'PATCH') else None
                req = urllib_req.Request(url, data=body, headers={'Content-Type': 'application/json'}, method=method)
                urllib_req.urlopen(req, timeout=10)
            except Exception:
                pass
            log_activity(db, card.id, 'webhook', f'Webhook {method} disparado para {url}', actor='Automação')

    elif step_type == 'assign_user':
        uid = cfg.get('user_id')
        if uid:
            user = db.query(models.User).filter(models.User.id == int(uid)).first()
            if user and user not in card.users:
                card.users.append(user)
                db.commit()
                log_activity(db, card.id, 'user_assigned', f'Responsável {user.name} atribuído', actor='Automação')

    elif step_type == 'add_note':
        content = _render_vars(cfg.get('content', ''), vars)
        if content:
            db.add(models.Activity(card_id=card.id, type='auto_note', content=content, actor='Automação'))
            db.commit()

    elif step_type == 'set_price':
        price = cfg.get('price')
        if price not in (None, ''):
            old = card.price or 0
            card.price = float(price)
            db.commit()
            log_activity(db, card.id, 'price_changed',
                f'Valor alterado de R$ {old:.2f} para R$ {float(price):.2f}', actor='Automação')

    elif step_type == 'set_field':
        field = cfg.get('field', '')
        if field == 'deal.title':
            val = _render_vars(str(cfg.get('value', '')), vars)
            if val:
                old = card.title
                card.title = val
                db.commit()
                log_activity(db, card.id, 'title_changed',
                    f'Título alterado para "{val}"', actor='Automação')
        elif field == 'deal.price':
            val = _render_vars(str(cfg.get('value', '')), vars)
            try:
                old = card.price or 0
                card.price = float(val)
                db.commit()
                log_activity(db, card.id, 'price_changed',
                    f'Valor alterado de R$ {old:.2f} para R$ {float(val):.2f}', actor='Automação')
            except (ValueError, TypeError):
                pass
        elif field == 'deal.description':
            val = _render_vars(str(cfg.get('value', '')), vars)
            card.description = val
            db.commit()
            log_activity(db, card.id, 'field_changed', 'Descrição atualizada', actor='Automação')
        elif field == 'deal.stage_id':
            stage_id = cfg.get('stage_id')
            if stage_id:
                stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
                if stage:
                    card.stage_id = stage.id
                    db.commit()
                    log_activity(db, card.id, 'moved',
                        f'Movido para a etapa {stage.name}', actor='Automação')

def _execute_flow_steps(steps: list, vars: dict, card, db):
    for step in steps:
        t = step.get('type')
        if t == 'if_else':
            result = _evaluate_condition(step.get('condition', ''), vars, card)
            branch = step.get('true_steps', []) if result else step.get('false_steps', [])
            _execute_flow_steps(branch, vars, card, db)
        else:
            _run_action(t, step.get('config', {}), vars, card, db)

def _execute_rule(rule_id: int, card_id: int):
    db = SessionLocal()
    try:
        rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
        card = db.query(models.Card).filter(models.Card.id == card_id).first()
        if not rule or not card:
            return
        cfg = json.loads(rule.config or '{}')
        vars = _build_vars(card, db)
        # New flow format
        if cfg.get('version') == 1:
            _execute_flow_steps(cfg.get('steps', []), vars, card, db)
        else:
            # Legacy single-action format
            _run_action(rule.action_type, cfg, vars, card, db)
    finally:
        db.close()

@app.get("/automations", response_model=List[schemas.AutomationRule])
def get_automations(stage_id: int = None, pipeline_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.AutomationRule)
    if stage_id: q = q.filter(models.AutomationRule.stage_id == stage_id)
    if pipeline_id: q = q.filter(models.AutomationRule.pipeline_id == pipeline_id)
    return q.order_by(models.AutomationRule.order).all()

@app.post("/automations", response_model=schemas.AutomationRule)
def create_automation(rule: schemas.AutomationRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.AutomationRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.put("/automations/{rule_id}", response_model=schemas.AutomationRule)
def update_automation(rule_id: int, rule: schemas.AutomationRuleBase, db: Session = Depends(get_db)):
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in rule.dict().items():
        setattr(db_rule, k, v)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.delete("/automations/{rule_id}")
def delete_automation(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(db_rule)
    db.commit()
    return {"status": "ok"}

# ---- ACTIVITIES ----
def log_activity(db, card_id: int, activity_type: str, content: str, actor: str = 'Usuário'):
    db.add(models.Activity(card_id=card_id, type=activity_type, content=content, actor=actor))
    db.commit()

@app.get("/cards/{card_id}/activities", response_model=List[schemas.Activity])
def get_activities(card_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Activity)
              .filter(models.Activity.card_id == card_id)
              .order_by(models.Activity.created_at.asc())
              .all())

@app.post("/cards/{card_id}/activities", response_model=schemas.Activity)
def create_activity(card_id: int, activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db_activity = models.Activity(**activity.dict(), card_id=card_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

# ---- CUSTOM FIELDS ----
@app.get("/custom-fields", response_model=List[schemas.CustomField])
def get_custom_fields(entity: str = None, db: Session = Depends(get_db)):
    q = db.query(models.CustomField)
    if entity:
        q = q.filter(models.CustomField.entity == entity)
    return q.order_by(models.CustomField.order, models.CustomField.id).all()

@app.post("/custom-fields", response_model=schemas.CustomField)
def create_custom_field(field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    data = field.dict()
    # Auto-generate key from name if not provided
    if not data.get('key'):
        slug = re.sub(r'\s+', '_', re.sub(r'[^\w\s]', '', data['name'].lower().strip()))
        base = slug or 'campo'
        slug = base
        i = 1
        while db.query(models.CustomField).filter(
            models.CustomField.entity == data['entity'],
            models.CustomField.key == slug
        ).first():
            slug = f"{base}_{i}"; i += 1
        data['key'] = slug
    # Always generate a UID (NGS-001, CTT-002, EQP-003 …)
    data['uid'] = _generate_uid(data['entity'], db)
    db_field = models.CustomField(**data)
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field

# ---- FILE UPLOAD ----
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    safe_name = re.sub(r'[^\w.\-]', '_', file.filename or 'file')
    filename = f"{int(time.time())}_{safe_name}"
    dest = os.path.join("uploads", filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(dest)
    return {
        "name": file.filename,
        "url": f"/uploads/{filename}",
        "size": size,
        "type": file.content_type or "application/octet-stream",
    }

@app.put("/custom-fields/{field_id}", response_model=schemas.CustomField)
def update_custom_field(field_id: int, field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    db_field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    for k, v in field.dict().items():
        setattr(db_field, k, v)
    db.commit()
    db.refresh(db_field)
    return db_field

@app.delete("/custom-fields/{field_id}")
def delete_custom_field(field_id: int, db: Session = Depends(get_db)):
    db_field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    db.delete(db_field)
    db.commit()
    return {"status": "ok"}

@app.get("/custom-field-values")
def get_custom_field_values(entity: str, entity_id: int, db: Session = Depends(get_db)):
    values = db.query(models.CustomFieldValue).filter(
        models.CustomFieldValue.entity_id == entity_id,
        models.CustomFieldValue.field.has(models.CustomField.entity == entity)
    ).all()
    return [{"id": v.id, "field_id": v.field_id, "entity_id": v.entity_id, "value": v.value} for v in values]

@app.put("/custom-field-values")
def upsert_custom_field_values(entity: str, entity_id: int, values: List[schemas.CustomFieldValueIn], db: Session = Depends(get_db)):
    for item in values:
        existing = db.query(models.CustomFieldValue).filter(
            models.CustomFieldValue.field_id == item.field_id,
            models.CustomFieldValue.entity_id == entity_id
        ).first()
        if existing:
            existing.value = item.value
        else:
            db.add(models.CustomFieldValue(
                field_id=item.field_id,
                entity_id=entity_id,
                value=item.value
            ))
    db.commit()
    return {"status": "ok"}

@app.put("/cards/{card_id}", response_model=schemas.Card)
def update_card(card_id: int, card_data: schemas.CardBase, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Capture old values for change log
    old_price  = card.price
    old_title  = card.title
    old_stage  = card.stage_id
    old_contact_ids = {c.id for c in card.contacts}
    old_user_ids    = {u.id for u in card.users}

    card.title       = card_data.title
    card.description = card_data.description
    card.price       = card_data.price

    _sync_relations(card, card_data.contact_ids, card_data.user_ids, db)

    logs = []

    if old_title != card_data.title:
        logs.append(models.Activity(card_id=card.id, type='title_changed',
            content=f'Título alterado para "{card_data.title}"', actor='Usuário'))

    if round(old_price or 0, 2) != round(card_data.price or 0, 2):
        logs.append(models.Activity(card_id=card.id, type='price_changed',
            content=f'Valor alterado de R$ {old_price or 0:.2f} para R$ {card_data.price or 0:.2f}', actor='Usuário'))

    if old_stage != card_data.stage_id:
        new_stage = db.query(models.Stage).filter(models.Stage.id == card_data.stage_id).first()
        if new_stage:
            logs.append(models.Activity(card_id=card.id, type='moved',
                content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))
        card.stage_id = card_data.stage_id
    else:
        card.stage_id = card_data.stage_id

    new_contact_ids = set(card_data.contact_ids or [])
    for cid in new_contact_ids - old_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(card_id=card.id, type='contact_added',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' adicionado', actor='Usuário'))
    for cid in old_contact_ids - new_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(card_id=card.id, type='contact_removed',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' removido', actor='Usuário'))

    new_user_ids = set(card_data.user_ids or [])
    for uid in new_user_ids - old_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(card_id=card.id, type='user_assigned',
                content=f'Responsável {u.name} adicionado', actor='Usuário'))
    for uid in old_user_ids - new_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(card_id=card.id, type='user_removed',
                content=f'Responsável {u.name} removido', actor='Usuário'))

    for log in logs:
        db.add(log)

    db.commit()
    db.refresh(card)
    return card

@app.put("/cards/{card_id}/move", response_model=schemas.Card)
def move_card(card_id: int, move_data: schemas.CardMove, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    new_stage = db.query(models.Stage).filter(models.Stage.id == move_data.new_stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Stage not found")
        
    card.stage_id = new_stage.id
    card.order = move_data.new_order

    db.add(models.Activity(card_id=card.id, type='moved',
        content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))

    db.commit()
    db.refresh(card)

    # Disparar regras de automação configuradas para a etapa destino
    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.stage_id == new_stage.id,
        models.AutomationRule.enabled == True
    ).order_by(models.AutomationRule.order).all()
    for rule in rules:
        background_tasks.add_task(_execute_rule, rule.id, card.id)

    return card

@app.put("/pipelines/{pipeline_id}/cards/{card_id}/move", response_model=schemas.Card)
def move_card_in_pipeline(
    pipeline_id: int,
    card_id: int,
    stage_id: int,
    order: int = 0,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """Mover card de pipeline especificado para uma etapa dentro do mesmo pipeline."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")

    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail=f"Card {card_id} não encontrado")

    # Verifica que o card pertence ao pipeline informado
    current_stage = db.query(models.Stage).filter(models.Stage.id == card.stage_id).first()
    if not current_stage or current_stage.pipeline_id != pipeline_id:
        raise HTTPException(
            status_code=400,
            detail=f"Card {card_id} não pertence ao pipeline {pipeline_id} (pipeline atual: {current_stage.pipeline_id if current_stage else 'desconhecido'})"
        )

    new_stage = db.query(models.Stage).filter(
        models.Stage.id == stage_id,
        models.Stage.pipeline_id == pipeline_id,
    ).first()
    if not new_stage:
        raise HTTPException(
            status_code=404,
            detail=f"Etapa {stage_id} não encontrada no pipeline {pipeline_id}"
        )

    card.stage_id = new_stage.id
    card.order = order
    db.add(models.Activity(card_id=card.id, type='moved',
        content=f'Movido para "{new_stage.name}"', actor='API'))
    db.commit()
    db.refresh(card)

    if background_tasks:
        rules = db.query(models.AutomationRule).filter(
            models.AutomationRule.stage_id == new_stage.id,
            models.AutomationRule.enabled == True,
        ).order_by(models.AutomationRule.order).all()
        for rule in rules:
            background_tasks.add_task(_execute_rule, rule.id, card.id)

    _fire_outbound_webhooks("card.moved", "cards", {
        "id": card.id, "title": card.title,
        "pipeline_id": pipeline_id,
        "stage_id": new_stage.id, "stage_name": new_stage.name,
    })
    return card

@app.put("/pipelines/{pipeline_id}/leads/{lead_id}/move", response_model=schemas.Lead)
def move_lead_in_pipeline(
    pipeline_id: int,
    lead_id: int,
    stage_id: int,
    order: int = 0,
    db: Session = Depends(get_db),
):
    """Mover lead dentro do Funil de Leads para uma etapa específica."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")

    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} não encontrado")

    current_stage = db.query(models.Stage).filter(models.Stage.id == lead.stage_id).first()
    if not current_stage or current_stage.pipeline_id != pipeline_id:
        raise HTTPException(
            status_code=400,
            detail=f"Lead {lead_id} não pertence ao pipeline {pipeline_id}"
        )

    new_stage = db.query(models.Stage).filter(
        models.Stage.id == stage_id,
        models.Stage.pipeline_id == pipeline_id,
    ).first()
    if not new_stage:
        raise HTTPException(
            status_code=404,
            detail=f"Etapa {stage_id} não encontrada no pipeline {pipeline_id}"
        )

    lead.stage_id = new_stage.id
    lead.order = order
    db.add(models.Activity(lead_id=lead.id, type='moved',
        content=f'Movido para "{new_stage.name}"', actor='API'))
    db.commit()
    db.refresh(lead)

    _fire_outbound_webhooks("lead.moved", "leads", {
        "id": lead.id, "title": lead.title,
        "pipeline_id": pipeline_id,
        "stage_id": new_stage.id, "stage_name": new_stage.name,
    })
    return lead

@app.get("/pipelines/{pipeline_id}/stages", response_model=List[schemas.Stage])
def get_pipeline_stages(pipeline_id: int, db: Session = Depends(get_db)):
    """Lista todas as etapas de um pipeline, com seus cards/leads."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")
    return db.query(models.Stage).filter(
        models.Stage.pipeline_id == pipeline_id
    ).order_by(models.Stage.order).all()

# ── Leads ─────────────────────────────────────────────────────────────────────

def _sync_lead_relations(lead, contact_ids, user_ids, db):
    if contact_ids is not None:
        lead.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    if user_ids is not None:
        lead.users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()

@app.get("/leads", response_model=List[schemas.Lead])
def get_leads(pipeline_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Lead)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    return query.all()

@app.post("/leads", response_model=schemas.Lead)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db)):
    data = lead.dict(exclude_unset=True)
    contact_ids = data.pop("contact_ids", [])
    user_ids = data.pop("user_ids", [])
    if not data.get("created_at"):
        data["created_at"] = datetime.now(timezone.utc)
    db_lead = models.Lead(**data)
    db.add(db_lead)
    db.flush()
    _sync_lead_relations(db_lead, contact_ids, user_ids, db)
    db.add(models.Activity(lead_id=db_lead.id, type='created', content='Lead criado', actor='Usuário'))
    db.commit()
    db.refresh(db_lead)
    _fire_outbound_webhooks("lead.created", "leads", {"id": db_lead.id, "title": db_lead.title, "stage_id": db_lead.stage_id})
    return db_lead

@app.get("/leads/{lead_id}", response_model=schemas.Lead)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@app.put("/leads/{lead_id}", response_model=schemas.Lead)
def update_lead(lead_id: int, lead_data: schemas.LeadBase, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_price  = lead.price
    old_title  = lead.title
    old_stage  = lead.stage_id
    old_contact_ids = {c.id for c in lead.contacts}
    old_user_ids    = {u.id for u in lead.users}

    lead.title       = lead_data.title
    lead.description = lead_data.description
    lead.price       = lead_data.price
    lead.source      = lead_data.source

    _sync_lead_relations(lead, lead_data.contact_ids, lead_data.user_ids, db)

    logs = []
    if old_title != lead_data.title:
        logs.append(models.Activity(lead_id=lead.id, type='title_changed',
            content=f'Título alterado para "{lead_data.title}"', actor='Usuário'))
    if round(old_price or 0, 2) != round(lead_data.price or 0, 2):
        logs.append(models.Activity(lead_id=lead.id, type='price_changed',
            content=f'Valor alterado de R$ {old_price or 0:.2f} para R$ {lead_data.price or 0:.2f}', actor='Usuário'))
    if old_stage != lead_data.stage_id:
        new_stage = db.query(models.Stage).filter(models.Stage.id == lead_data.stage_id).first()
        if new_stage:
            logs.append(models.Activity(lead_id=lead.id, type='moved',
                content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))
        lead.stage_id = lead_data.stage_id
    else:
        lead.stage_id = lead_data.stage_id

    new_contact_ids = set(lead_data.contact_ids or [])
    for cid in new_contact_ids - old_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(lead_id=lead.id, type='contact_added',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' adicionado', actor='Usuário'))
    for cid in old_contact_ids - new_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(lead_id=lead.id, type='contact_removed',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' removido', actor='Usuário'))

    new_user_ids = set(lead_data.user_ids or [])
    for uid in new_user_ids - old_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(lead_id=lead.id, type='user_assigned',
                content=f'Responsável {u.name} adicionado', actor='Usuário'))
    for uid in old_user_ids - new_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(lead_id=lead.id, type='user_removed',
                content=f'Responsável {u.name} removido', actor='Usuário'))

    for log in logs:
        db.add(log)
    db.commit()
    db.refresh(lead)
    return lead

@app.delete("/leads/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return {"message": "Lead deleted"}

@app.put("/leads/{lead_id}/move", response_model=schemas.Lead)
def move_lead(lead_id: int, move_data: schemas.CardMove, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    new_stage = db.query(models.Stage).filter(models.Stage.id == move_data.new_stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    lead.stage_id = new_stage.id
    lead.order = move_data.new_order
    db.add(models.Activity(lead_id=lead.id, type='moved',
        content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))
    db.commit()
    db.refresh(lead)
    return lead

@app.post("/leads/{lead_id}/convert", response_model=schemas.Card)
def convert_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.converted:
        existing = db.query(models.Card).filter(models.Card.id == lead.converted_card_id).first()
        if existing:
            return existing

    pipeline_negocios = db.query(models.Pipeline).filter(models.Pipeline.name == "Negócios").first()
    if not pipeline_negocios:
        raise HTTPException(status_code=400, detail="Funil de Negócios não encontrado")

    first_stage = (db.query(models.Stage)
                   .filter(models.Stage.pipeline_id == pipeline_negocios.id)
                   .order_by(models.Stage.order).first())
    if not first_stage:
        raise HTTPException(status_code=400, detail="Funil de Negócios sem etapas")

    negocio = models.Card(
        title=lead.title,
        description=lead.description,
        price=lead.price,
        stage_id=first_stage.id,
        order=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(negocio)
    db.flush()
    negocio.contacts = list(lead.contacts)
    negocio.users    = list(lead.users)
    db.add(models.Activity(card_id=negocio.id, type='created',
        content=f'Negócio criado a partir do Lead #{lead.id}', actor='Sistema'))

    lead.converted = True
    lead.converted_card_id = negocio.id
    db.add(models.Activity(lead_id=lead.id, type='system',
        content=f'Lead convertido em Negócio #{negocio.id}', actor='Sistema'))

    db.commit()
    db.refresh(negocio)
    _fire_outbound_webhooks("lead.converted", "leads", {"lead_id": lead.id, "card_id": negocio.id, "title": negocio.title})
    _fire_outbound_webhooks("card.created", "cards", {"id": negocio.id, "title": negocio.title, "stage_id": negocio.stage_id})
    return negocio

@app.get("/leads/{lead_id}/activities", response_model=List[schemas.Activity])
def get_lead_activities(lead_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Activity)
              .filter(models.Activity.lead_id == lead_id)
              .order_by(models.Activity.created_at.asc())
              .all())

@app.post("/leads/{lead_id}/activities", response_model=schemas.Activity)
def create_lead_activity(lead_id: int, activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db_activity = models.Activity(**activity.dict(), lead_id=lead_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


# ── Tasks ─────────────────────────────────────────────────────────────────────

@app.get("/cards/{card_id}/tasks", response_model=List[schemas.Task])
def get_tasks(card_id: int, db: Session = Depends(get_db)):
    return db.query(models.Task).filter(models.Task.card_id == card_id).order_by(models.Task.created_at).all()

@app.post("/tasks", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    obj = models.Task(**task.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@app.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in task.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}

@app.patch("/tasks/{task_id}/toggle", response_model=schemas.Task)
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Task not found")
    obj.done = not obj.done
    db.commit()
    db.refresh(obj)
    return obj


# ── Comments ──────────────────────────────────────────────────────────────────

@app.get("/cards/{card_id}/comments", response_model=List[schemas.Comment])
def get_comments(card_id: int, db: Session = Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.card_id == card_id).order_by(models.Comment.created_at).all()

@app.post("/comments", response_model=schemas.Comment)
def create_comment(comment: schemas.CommentCreate, db: Session = Depends(get_db)):
    obj = models.Comment(**comment.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@app.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}
