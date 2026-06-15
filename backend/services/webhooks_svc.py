import json, threading
import urllib.request as _urllib_req2
import models
from database import SessionLocal


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
