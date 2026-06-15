"""Miscellaneous endpoints: custom fields, field values, file upload, comments, leads/import."""
import re, os, shutil, time
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict, Any

import models, schemas
from database import get_db
from services.helpers import _generate_uid

router = APIRouter()


# ── Custom Fields ─────────────────────────────────────────────────────────────

@router.get("/custom-fields", response_model=List[schemas.CustomField])
def get_custom_fields(entity: str = None, db: Session = Depends(get_db)):
    q = db.query(models.CustomField)
    if entity:
        q = q.filter(models.CustomField.entity == entity)
    return q.order_by(models.CustomField.order, models.CustomField.id).all()


@router.post("/custom-fields", response_model=schemas.CustomField)
def create_custom_field(field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    data = field.dict()
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
    data['uid'] = _generate_uid(data['entity'], db)
    db_field = models.CustomField(**data)
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field


@router.put("/custom-fields/{field_id}", response_model=schemas.CustomField)
def update_custom_field(field_id: int, field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    db_field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    for k, v in field.dict().items():
        setattr(db_field, k, v)
    db.commit()
    db.refresh(db_field)
    return db_field


@router.delete("/custom-fields/{field_id}")
def delete_custom_field(field_id: int, db: Session = Depends(get_db)):
    db_field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    db.delete(db_field)
    db.commit()
    return {"status": "ok"}


@router.get("/custom-field-values")
def get_custom_field_values(entity: str, entity_id: int, db: Session = Depends(get_db)):
    values = db.query(models.CustomFieldValue).filter(
        models.CustomFieldValue.entity_id == entity_id,
        models.CustomFieldValue.field.has(models.CustomField.entity == entity)
    ).all()
    return [{"id": v.id, "field_id": v.field_id, "entity_id": v.entity_id, "value": v.value} for v in values]


@router.put("/custom-field-values")
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


# ── File Upload ───────────────────────────────────────────────────────────────

@router.post("/upload")
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


# ── Comments ──────────────────────────────────────────────────────────────────

@router.get("/cards/{card_id}/comments", response_model=List[schemas.Comment])
def get_comments(card_id: int, db: Session = Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.card_id == card_id).order_by(models.Comment.created_at).all()


@router.post("/comments", response_model=schemas.Comment)
def create_comment(comment: schemas.CommentCreate, db: Session = Depends(get_db)):
    obj = models.Comment(**comment.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Leads bulk import ─────────────────────────────────────────────────────────

class LeadImportBody(BaseModel):
    leads: List[Dict[str, Any]]


_LEAD_SAFE_KEYS = {
    "title", "first_name", "last_name", "email", "phone", "company_name",
    "source", "position", "address", "website", "comment",
    "utm_source", "utm_medium", "utm_campaign", "stage_id",
    "description", "price", "order",
}


@router.post("/leads/import")
def import_leads(body: LeadImportBody, db: Session = Depends(get_db)):
    fallback_stage_id = None
    p_leads = db.query(models.Pipeline).filter(models.Pipeline.name == "Leads").first()
    if p_leads:
        first_stage = (
            db.query(models.Stage)
            .filter(models.Stage.pipeline_id == p_leads.id)
            .order_by(models.Stage.order)
            .first()
        )
        if first_stage:
            fallback_stage_id = first_stage.id

    created_ids = []
    for lead_dict in body.leads:
        safe_data = {k: v for k, v in lead_dict.items() if k in _LEAD_SAFE_KEYS}
        if not safe_data.get("stage_id"):
            safe_data["stage_id"] = fallback_stage_id
        safe_data.setdefault("created_at", datetime.now(timezone.utc))
        db_lead = models.Lead(**safe_data)
        db.add(db_lead)
        db.flush()
        db.add(models.Activity(
            lead_id=db_lead.id,
            type='created',
            content='Lead importado via CSV',
            actor='Usuário',
        ))
        created_ids.append(db_lead.id)

    db.commit()
    return {"imported": len(created_ids), "ids": created_ids}
