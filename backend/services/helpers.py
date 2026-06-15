import re
import models
from sqlalchemy.orm import Session


# ── UID generator ─────────────────────────────────────────────────────────────

_UID_PREFIXES = {'deal': 'NGS', 'lead': 'LDC', 'contact': 'CTT', 'user': 'EQP', 'company': 'EMP'}


def _generate_uid(entity: str, db) -> str:
    prefix = _UID_PREFIXES.get(entity, 'FLD')
    existing = db.query(models.CustomField).filter(models.CustomField.entity == entity).all()
    used = set()
    for f in existing:
        if f.uid and f.uid.startswith(prefix + '-'):
            try:
                used.add(int(f.uid.split('-')[1]))
            except (IndexError, ValueError):
                pass
    n = 1
    while n in used:
        n += 1
    return f"{prefix}-{n:03d}"


# ── Custom field helpers ──────────────────────────────────────────────────────

def _attach_custom_fields(entity_type: str, entity_ids: list, db: Session) -> dict:
    """Returns {entity_id: {field_key: value}} for all given IDs."""
    if not entity_ids:
        return {}
    values = (
        db.query(models.CustomFieldValue, models.CustomField)
        .join(models.CustomField, models.CustomFieldValue.field_id == models.CustomField.id)
        .filter(
            models.CustomFieldValue.entity_id.in_(entity_ids),
            models.CustomField.entity == entity_type,
        )
        .all()
    )
    result = {}
    for cfv, cf in values:
        result.setdefault(cfv.entity_id, {})[cf.key] = cfv.value
    return result


def _with_cf(obj, entity_type: str, db: Session):
    """Attach custom_fields dict to a single ORM object and return it."""
    cf_map = _attach_custom_fields(entity_type, [obj.id], db)
    obj.custom_fields = cf_map.get(obj.id, {})
    return obj


def _list_with_cf(objs, entity_type: str, db: Session):
    """Attach custom_fields dict to a list of ORM objects and return them."""
    ids = [o.id for o in objs]
    cf_map = _attach_custom_fields(entity_type, ids, db)
    for o in objs:
        o.custom_fields = cf_map.get(o.id, {})
    return objs


# ── Relation sync ─────────────────────────────────────────────────────────────

def _sync_relations(card, contact_ids, user_ids, db):
    if contact_ids is not None:
        card.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    if user_ids is not None:
        card.users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()


def _sync_lead_relations(lead, contact_ids, user_ids, db):
    if contact_ids is not None:
        lead.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    if user_ids is not None:
        lead.users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()


# ── Task output enrichment ────────────────────────────────────────────────────

def _task_out(obj, db):
    """Enrich a Task ORM object with computed fields before returning."""
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    d['time_entries'] = [
        {'id': e.id, 'task_id': e.task_id, 'user_name': e.user_name,
         'started_at': e.started_at, 'ended_at': e.ended_at,
         'duration_seconds': e.duration_seconds or 0}
        for e in obj.time_entries
    ]
    d['total_time_seconds'] = sum(e.duration_seconds or 0 for e in obj.time_entries)
    d['card_title'] = None
    d['lead_title'] = None
    d['project_name'] = None
    if obj.card_id:
        card = db.query(models.Card).filter(models.Card.id == obj.card_id).first()
        if card:
            d['card_title'] = card.title
    if obj.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == obj.lead_id).first()
        if lead:
            d['lead_title'] = lead.title
    if obj.project_id:
        proj = db.query(models.Project).filter(models.Project.id == obj.project_id).first()
        if proj:
            d['project_name'] = proj.name
    if not d.get('status'):
        d['status'] = 'done' if d.get('done') else 'todo'
    return d


# ── Stage requirement check ───────────────────────────────────────────────────

BUILTIN_FIELD_LABELS = {
    'price':       'Valor (> 0)',
    'contact':     'Contato vinculado',
    'responsible': 'Responsável definido',
    'description': 'Descrição preenchida',
    'source':      'Fonte preenchida',
}


def _check_stage_requirements(card, stage_id: int, db):
    """Returns list of missing required fields for moving card to stage_id. Empty = OK."""
    reqs = db.query(models.StageRequiredField).filter(
        models.StageRequiredField.stage_id == stage_id
    ).all()
    missing = []
    for req in reqs:
        if req.field_type == 'builtin':
            k = req.field_key
            if k == 'price' and not (card.price and card.price > 0):
                missing.append({'field': 'price', 'label': BUILTIN_FIELD_LABELS['price']})
            elif k == 'description' and not (card.description and card.description.strip()):
                missing.append({'field': 'description', 'label': BUILTIN_FIELD_LABELS['description']})
            elif k == 'contact' and len(card.contacts) == 0:
                missing.append({'field': 'contact', 'label': BUILTIN_FIELD_LABELS['contact']})
            elif k == 'responsible' and not card.responsible_user_id:
                missing.append({'field': 'responsible', 'label': BUILTIN_FIELD_LABELS['responsible']})
            elif k == 'source' and not card.source:
                missing.append({'field': 'source', 'label': BUILTIN_FIELD_LABELS['source']})
        elif req.field_type == 'custom' and req.custom_field_id:
            cfv = db.query(models.CustomFieldValue).filter(
                models.CustomFieldValue.field_id == req.custom_field_id,
                models.CustomFieldValue.entity_id == card.id
            ).first()
            cf = db.query(models.CustomField).filter(
                models.CustomField.id == req.custom_field_id
            ).first()
            if not cfv or not (cfv.value and cfv.value.strip()):
                missing.append({
                    'field': f'custom_{req.custom_field_id}',
                    'label': cf.name if cf else f'Campo #{req.custom_field_id}',
                })
    return missing
