import json, threading, logging
import urllib.request as _urllib_req2
import models
from database import SessionLocal

_log = logging.getLogger("nexus.webhooks")


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
