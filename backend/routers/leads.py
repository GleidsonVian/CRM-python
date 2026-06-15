from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas
from database import get_db
from services.auth import log_audit
from services.webhooks_svc import _fire_outbound_webhooks
from services.permissions import _get_user_permissions, _resolve_read_scope
from services.helpers import _sync_lead_relations, _with_cf, _list_with_cf

router = APIRouter()


@router.get("/leads", response_model=List[schemas.Lead])
def get_leads(
    pipeline_id: int = None, stage_id: int = None,
    q: Optional[str] = None, limit: int = 50,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
):
    perms = _get_user_permissions(authorization, db)
    query = db.query(models.Lead)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    if stage_id:
        query = query.filter(models.Lead.stage_id == stage_id)
    read_scope = _resolve_read_scope(perms, "lead")
    if read_scope == "deny":
        return []
    if read_scope == "own" and perms.get("user_id"):
        uid = perms["user_id"]
        query = query.filter(models.Lead.users.any(models.User.id == uid))
    if q:
        q = q.strip()
        if q.startswith('#'):
            try:
                query = query.filter(models.Lead.id == int(q[1:]))
            except ValueError:
                pass
        else:
            query = query.filter(
                models.Lead.title.ilike(f'%{q}%') |
                models.Lead.first_name.ilike(f'%{q}%') |
                models.Lead.last_name.ilike(f'%{q}%')
            )
    return _list_with_cf(query.order_by(models.Lead.id.desc()).limit(limit).all(), 'lead', db)


@router.post("/leads", response_model=schemas.Lead)
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
    log_audit(db, "created", "lead", db_lead.id, db_lead.title)
    _fire_outbound_webhooks("lead.created", "leads", {"id": db_lead.id, "title": db_lead.title, "stage_id": db_lead.stage_id})
    return db_lead


@router.get("/leads/{lead_id}", response_model=schemas.Lead)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _with_cf(lead, 'lead', db)


@router.put("/leads/{lead_id}", response_model=schemas.Lead)
def update_lead(lead_id: int, lead_data: schemas.LeadBase, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_price  = lead.price
    old_title  = lead.title
    old_stage  = lead.stage_id
    old_contact_ids = {c.id for c in lead.contacts}
    old_user_ids    = {u.id for u in lead.users}

    lead.title          = lead_data.title
    lead.description    = lead_data.description
    lead.price          = lead_data.price
    lead.source         = lead_data.source
    lead.salutation     = lead_data.salutation
    lead.first_name     = lead_data.first_name
    lead.last_name      = lead_data.last_name
    lead.middle_name    = lead_data.middle_name
    lead.birth_date     = lead_data.birth_date
    lead.position       = lead_data.position
    lead.company_name   = lead_data.company_name
    lead.phone          = lead_data.phone
    lead.email          = lead_data.email
    lead.website        = lead_data.website
    lead.source_info    = lead_data.source_info
    lead.available_to_all = lead_data.available_to_all
    lead.address        = lead_data.address
    lead.utm_source     = lead_data.utm_source
    lead.utm_medium     = lead_data.utm_medium
    lead.utm_campaign   = lead_data.utm_campaign
    lead.comment        = lead_data.comment

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
    log_audit(db, "updated", "lead", lead_id, lead.title)
    return lead


@router.delete("/leads/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead_title = lead.title
    db.delete(lead)
    db.commit()
    log_audit(db, "deleted", "lead", lead_id, lead_title)
    return {"message": "Lead deleted"}


@router.put("/leads/{lead_id}/move", response_model=schemas.Lead)
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
    log_audit(db, "moved", "lead", lead_id, lead.title, details={"new_stage_id": move_data.new_stage_id})
    return lead


@router.put("/pipelines/{pipeline_id}/leads/{lead_id}/move", response_model=schemas.Lead)
def move_lead_in_pipeline(
    pipeline_id: int,
    lead_id: int,
    stage_id: int,
    order: int = 0,
    db: Session = Depends(get_db),
):
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


@router.post("/leads/{lead_id}/convert", response_model=schemas.LeadConvertResult)
def convert_lead(lead_id: int, opts: schemas.LeadConvertOptions = None, db: Session = Depends(get_db)):
    if opts is None:
        opts = schemas.LeadConvertOptions(create_deal=True, create_contact=False, create_company=False)

    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    result = schemas.LeadConvertResult()

    company = None
    if opts.create_company and lead.company_name:
        company = models.Company(
            name=lead.company_name,
            phone=lead.phone,
            email=lead.email,
            website=lead.website,
            address=lead.address,
            available_to_all=lead.available_to_all,
        )
        db.add(company)
        db.flush()
        result.company_id = company.id

    contact = None
    if opts.create_contact:
        contact = models.Contact(
            first_name=lead.first_name or lead.title,
            last_name=lead.last_name,
            middle_name=lead.middle_name,
            salutation=lead.salutation,
            phone=lead.phone,
            email=lead.email,
            website=lead.website,
            position=lead.position,
            company_name=lead.company_name,
            source=lead.source,
            source_info=lead.source_info,
            address=lead.address,
            available_to_all=lead.available_to_all,
            comment=lead.comment,
        )
        db.add(contact)
        db.flush()
        if company:
            company.contacts.append(contact)
        result.contact_id = contact.id

    if opts.create_deal:
        pipeline_negocios = (db.query(models.Pipeline)
                             .filter(models.Pipeline.name != "Leads")
                             .order_by(models.Pipeline.id).first())
        if not pipeline_negocios:
            raise HTTPException(status_code=400, detail="Nenhum funil de negócios encontrado")
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
        negocio.users = list(lead.users)
        if contact:
            negocio.contacts = [contact]
        else:
            negocio.contacts = list(lead.contacts)
        db.add(models.Activity(card_id=negocio.id, type='created',
            content=f'Negócio criado a partir do Lead #{lead.id}', actor='Sistema'))
        result.deal_id = negocio.id
        _fire_outbound_webhooks("card.created", "cards", {"id": negocio.id, "title": negocio.title, "stage_id": negocio.stage_id})

    lead.converted = True
    if result.deal_id:
        lead.converted_card_id = result.deal_id
    db.add(models.Activity(lead_id=lead.id, type='system',
        content='Lead convertido' + (f' em Negócio #{result.deal_id}' if result.deal_id else ''), actor='Sistema'))

    db.commit()
    log_audit(db, "converted", "lead", lead_id, lead.title)
    _fire_outbound_webhooks("lead.converted", "leads", {"lead_id": lead.id, "deal_id": result.deal_id, "title": lead.title})
    return result


@router.post("/leads/{lead_id}/revert-convert")
def revert_lead_convert(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.converted = False
    lead.converted_card_id = None
    db.add(models.Activity(lead_id=lead.id, type='system',
        content='Conversão revertida — lead desvinculado das entidades criadas', actor='Usuário'))
    db.commit()
    return {"ok": True}


@router.get("/leads/{lead_id}/activities", response_model=List[schemas.Activity])
def get_lead_activities(lead_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Activity)
              .filter(models.Activity.lead_id == lead_id)
              .order_by(models.Activity.created_at.asc())
              .all())


@router.post("/leads/{lead_id}/activities", response_model=schemas.Activity)
def create_lead_activity(lead_id: int, activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db_activity = models.Activity(**activity.dict(), lead_id=lead_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity
