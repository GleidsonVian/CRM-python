import json, threading, logging
import urllib.request as _urllib_req2
import models
from database import SessionLocal

_log = logging.getLogger("nexus.webhooks")


def build_card_payload(card, db) -> dict:
    """Build a complete card payload for outbound webhooks."""
    stage = card.stage
    pipeline = stage.pipeline if stage else None
    custom_fields = {}
    cf_values = db.query(models.CustomFieldValue).filter(
        models.CustomFieldValue.entity_id == card.id,
        models.CustomFieldValue.field.has(models.CustomField.entity == 'deal')
    ).all()
    for cfv in cf_values:
        if cfv.field:
            custom_fields[cfv.field.key] = cfv.value

    return {
        "id":           card.id,
        "title":        card.title,
        "description":  card.description,
        "price":        card.price,
        "source":       card.source,
        "source_info":  card.source_info,
        "deal_type":    card.deal_type,
        "start_date":   card.start_date,
        "comment":      card.comment,
        "utm_source":   card.utm_source,
        "utm_medium":   card.utm_medium,
        "utm_campaign": card.utm_campaign,
        "available_to_all": card.available_to_all,
        "stage_id":     card.stage_id,
        "stage_name":   stage.name if stage else None,
        "stage_color":  stage.color if stage else None,
        "pipeline_id":  pipeline.id if pipeline else None,
        "pipeline_name": pipeline.name if pipeline else None,
        "responsible_user_id": card.responsible_user_id,
        "contacts": [{"id": c.id, "name": c.name, "email": c.email, "phone": c.phone} for c in (card.contacts or [])],
        "users":    [{"id": u.id, "name": u.name} for u in (card.users or [])],
        "custom_fields": custom_fields,
        "created_at":   card.created_at.isoformat() if card.created_at else None,
        "updated_at":   card.updated_at.isoformat() if card.updated_at else None,
    }


def _fire_outbound_webhooks(event: str, entity: str, payload: dict):
    """Fire outbound webhooks in background thread — non-blocking."""
    def _worker():
        db = SessionLocal()
        try:
            hooks = db.query(models.Webhook).filter(
                models.Webhook.type == 'outbound',
                models.Webhook.active == True,
                models.Webhook.url != None,
            ).all()
            _log.info(f"fire_webhook event={event} entity={entity} hooks={len(hooks)}")
            for h in hooks:
                try:
                    allowed_entities = h.allowed_entities if isinstance(h.allowed_entities, list) else []
                    events = h.events if isinstance(h.events, list) else []
                    if allowed_entities and entity not in allowed_entities:
                        _log.info(f"skip webhook id={h.id}: entity '{entity}' not in {allowed_entities}")
                        continue
                    if events and event not in events:
                        _log.info(f"skip webhook id={h.id}: event '{event}' not in {events}")
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
                        headers={"Content-Type": "application/json", "X-Webhook-Token": h.token or ""},
                        method="POST",
                    )
                    try:
                        with _urllib_req2.urlopen(req, timeout=5) as resp:
                            resp.read(100)
                        _log.info(f"webhook id={h.id} fired ok → {h.url}")
                    except Exception as e:
                        _log.warning(f"webhook id={h.id} send error (ignored): {e}")
                except Exception as e:
                    _log.error(f"webhook id={h.id} error: {e}")
        finally:
            db.close()
    threading.Thread(target=_worker, daemon=True).start()
