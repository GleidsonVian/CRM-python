from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

import models, schemas
from database import get_db
from services.auth import log_audit
from services.webhooks_svc import _fire_outbound_webhooks
from services.permissions import _get_user_permissions, _resolve_read_scope
from services.helpers import (
    _sync_relations, _with_cf, _list_with_cf, _check_stage_requirements
)
from services.automation import _execute_rule
from urllib import request as urllib_req
from urllib.request import urlopen

router = APIRouter()


@router.get("/cards", response_model=List[schemas.Card])
def get_cards(
    pipeline_id: int = None, stage_id: int = None,
    contact_id: int = None, user_id: int = None,
    q: Optional[str] = None, limit: int = 50,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
):
    perms = _get_user_permissions(authorization, db)
    query = db.query(models.Card)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    if stage_id:
        query = query.filter(models.Card.stage_id == stage_id)
    if contact_id:
        query = query.filter(models.Card.contacts.any(models.Contact.id == contact_id))
    if user_id:
        query = query.filter(models.Card.users.any(models.User.id == user_id))
    read_scope = _resolve_read_scope(perms, "deal")
    if read_scope == "deny":
        return []
    if read_scope == "own" and perms.get("user_id"):
        uid = perms["user_id"]
        query = query.filter(
            models.Card.users.any(models.User.id == uid) |
            (models.Card.responsible_user_id == uid)
        )
    if perms.get("pipeline_ids") and pipeline_id is None:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id.in_(perms["pipeline_ids"]))
    if q:
        q = q.strip()
        if q.startswith('#'):
            try:
                query = query.filter(models.Card.id == int(q[1:]))
            except ValueError:
                pass
        else:
            query = query.filter(models.Card.title.ilike(f'%{q}%'))
    return _list_with_cf(query.order_by(models.Card.id.desc()).limit(limit).all(), 'deal', db)


@router.post("/cards", response_model=schemas.Card)
def create_card(card: schemas.CardCreate, db: Session = Depends(get_db)):
    data = card.dict(exclude_unset=True)
    contact_ids = data.pop("contact_ids", [])
    user_ids = data.pop("user_ids", [])
    custom_fields_input = data.pop("custom_fields", None) or {}
    if not data.get("created_at"):
        data["created_at"] = datetime.now(timezone.utc)
    db_card = models.Card(**data)
    db.add(db_card)
    db.flush()
    _sync_relations(db_card, contact_ids, user_ids, db)

    for field_ref, value in custom_fields_input.items():
        field_ref_str = str(field_ref)
        if field_ref_str.isdigit():
            cf = db.query(models.CustomField).filter(
                models.CustomField.id == int(field_ref_str),
                models.CustomField.entity == 'deal'
            ).first()
        else:
            cf = db.query(models.CustomField).filter(
                models.CustomField.key == field_ref_str,
                models.CustomField.entity == 'deal'
            ).first()
        if cf:
            db.add(models.CustomFieldValue(field_id=cf.id, entity_id=db_card.id, value=str(value)))

    db.add(models.Activity(card_id=db_card.id, type='created', content='Negócio criado', actor='Usuário'))
    db.commit()
    db.refresh(db_card)
    log_audit(db, "created", "card", db_card.id, db_card.title)
    _fire_outbound_webhooks("card.created", "cards", {"id": db_card.id, "title": db_card.title, "stage_id": db_card.stage_id})
    return db_card


@router.get("/cards/{card_id}", response_model=schemas.Card)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return _with_cf(card, 'deal', db)


@router.put("/cards/{card_id}", response_model=schemas.Card)
def update_card(card_id: int, card_data: schemas.CardBase, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    old_price  = card.price
    old_title  = card.title
    old_stage  = card.stage_id
    old_contact_ids = {c.id for c in card.contacts}
    old_user_ids    = {u.id for u in card.users}

    card.title            = card_data.title
    card.description      = card_data.description
    card.price            = card_data.price
    card.source           = card_data.source
    card.source_info      = card_data.source_info
    card.deal_type        = card_data.deal_type
    card.start_date       = card_data.start_date
    card.available_to_all = card_data.available_to_all
    card.responsible_user_id = card_data.responsible_user_id
    card.observers        = card_data.observers
    card.comment          = card_data.comment
    card.utm_source       = card_data.utm_source
    card.utm_medium       = card_data.utm_medium
    card.utm_campaign     = card_data.utm_campaign
    card.updated_at       = datetime.now(timezone.utc)

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
        card.stage_changed_by = 'Usuário'
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
    log_audit(db, "updated", "card", card_id, card.title)
    return card


@router.delete("/cards/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card_title = card.title
    db.delete(card)
    db.commit()
    log_audit(db, "deleted", "card", card_id, card_title)
    return {"message": "Card deleted successfully"}


@router.put("/cards/{card_id}/move", response_model=schemas.Card)
def move_card(card_id: int, move_data: schemas.CardMove, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    new_stage = db.query(models.Stage).filter(models.Stage.id == move_data.new_stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    missing = _check_stage_requirements(card, move_data.new_stage_id, db)
    if missing:
        raise HTTPException(status_code=422, detail={"code": "missing_required_fields", "missing": missing, "stage_name": new_stage.name})

    card.stage_id = new_stage.id
    card.order = move_data.new_order
    card.updated_at = datetime.now(timezone.utc)
    card.stage_changed_by = 'Usuário'

    db.add(models.Activity(card_id=card.id, type='moved',
        content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))

    db.commit()
    db.refresh(card)
    log_audit(db, "moved", "card", card_id, card.title, details={"new_stage_id": move_data.new_stage_id})

    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.stage_id == new_stage.id,
        models.AutomationRule.enabled == True
    ).order_by(models.AutomationRule.order).all()
    for rule in rules:
        background_tasks.add_task(_execute_rule, rule.id, card.id)

    return card


@router.put("/pipelines/{pipeline_id}/cards/{card_id}/move", response_model=schemas.Card)
def move_card_in_pipeline(
    pipeline_id: int,
    card_id: int,
    stage_id: int,
    order: int = 0,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")

    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail=f"Card {card_id} não encontrado")

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

    missing = _check_stage_requirements(card, stage_id, db)
    if missing:
        raise HTTPException(status_code=422, detail={"code": "missing_required_fields", "missing": missing, "stage_name": new_stage.name})

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


@router.post("/cards/{card_id}/duplicate", response_model=schemas.Card)
def duplicate_card(card_id: int, db: Session = Depends(get_db)):
    orig = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Card not found")

    max_order = db.query(models.Card).filter(models.Card.stage_id == orig.stage_id).count()

    new_card = models.Card(
        title=f"Cópia de {orig.title}",
        description=orig.description,
        price=orig.price,
        stage_id=orig.stage_id,
        order=max_order,
        source=orig.source,
        source_info=orig.source_info,
        deal_type=orig.deal_type,
        start_date=orig.start_date,
        available_to_all=orig.available_to_all,
        responsible_user_id=orig.responsible_user_id,
        observers=orig.observers,
        comment=orig.comment,
        utm_source=orig.utm_source,
        utm_medium=orig.utm_medium,
        utm_campaign=orig.utm_campaign,
    )
    db.add(new_card)
    db.flush()

    for contact in orig.contacts:
        new_card.contacts.append(contact)
    for user in orig.users:
        new_card.users.append(user)

    orig_cfvs = db.query(models.CustomFieldValue).filter(models.CustomFieldValue.entity_id == orig.id).all()
    for cfv in orig_cfvs:
        db.add(models.CustomFieldValue(field_id=cfv.field_id, entity_id=new_card.id, value=cfv.value))

    db.commit()
    db.refresh(new_card)
    log_audit(db, "created", "card", new_card.id, new_card.title, details={"duplicated_from": card_id})
    return db.query(models.Card).filter(models.Card.id == new_card.id).first()


@router.get("/cards/{card_id}/activities", response_model=List[schemas.Activity])
def get_activities(card_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Activity)
              .filter(models.Activity.card_id == card_id)
              .order_by(models.Activity.created_at.asc())
              .all())


@router.post("/cards/{card_id}/activities", response_model=schemas.Activity)
def create_activity(card_id: int, activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db_activity = models.Activity(**activity.dict(), card_id=card_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


@router.get("/cards/{card_id}/workflow-executions", response_model=List[schemas.WorkflowExecutionOut])
def get_card_workflow_executions(card_id: int, db: Session = Depends(get_db)):
    return db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.card_id == card_id
    ).order_by(models.WorkflowExecution.executed_at.desc()).limit(50).all()
