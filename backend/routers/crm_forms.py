import json
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class FieldConfig(BaseModel):
    key: str
    label: str = ""
    required: bool = False
    placeholder: str = ""
    field_type: str = "text"


class CRMFormCreate(BaseModel):
    name: str = "Novo formulário"
    entity_type: str = "lead"
    pipeline_id: Optional[int] = None
    stage_id: Optional[int] = None
    is_active: bool = True
    title: str = ""
    subtitle: str = ""
    button_text: str = "Enviar"
    success_message: str = "Obrigado! Sua resposta foi registrada."
    fields_config: List[Dict[str, Any]] = []


class CRMFormUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    pipeline_id: Optional[int] = None
    stage_id: Optional[int] = None
    is_active: Optional[bool] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    button_text: Optional[str] = None
    success_message: Optional[str] = None
    fields_config: Optional[List[Dict[str, Any]]] = None


def _form_to_dict(form: models.CRMForm) -> dict:
    fc = form.fields_config
    if isinstance(fc, str):
        try:
            fc = json.loads(fc)
        except Exception:
            fc = []
    return {
        "id": form.id,
        "name": form.name,
        "uid": form.uid,
        "entity_type": form.entity_type,
        "pipeline_id": form.pipeline_id,
        "stage_id": form.stage_id,
        "is_active": form.is_active,
        "title": form.title,
        "subtitle": form.subtitle,
        "button_text": form.button_text,
        "success_message": form.success_message,
        "fields_config": fc,
        "created_at": form.created_at.isoformat() if form.created_at else None,
    }


def _generate_uid(db: Session) -> str:
    while True:
        uid = secrets.token_urlsafe(8)
        existing = db.query(models.CRMForm).filter(models.CRMForm.uid == uid).first()
        if not existing:
            return uid


# ── Admin endpoints (require auth — relies on calling code passing JWT) ───────

@router.get("/crm-forms")
def list_forms(db: Session = Depends(get_db)):
    forms = db.query(models.CRMForm).order_by(models.CRMForm.id.desc()).all()
    result = []
    for f in forms:
        d = _form_to_dict(f)
        # count submissions
        d["submission_count"] = db.query(models.CRMFormSubmission).filter(
            models.CRMFormSubmission.form_id == f.id
        ).count()
        result.append(d)
    return result


@router.post("/crm-forms")
def create_form(payload: CRMFormCreate, db: Session = Depends(get_db)):
    uid = _generate_uid(db)
    form = models.CRMForm(
        uid=uid,
        name=payload.name,
        entity_type=payload.entity_type,
        pipeline_id=payload.pipeline_id,
        stage_id=payload.stage_id,
        is_active=payload.is_active,
        title=payload.title,
        subtitle=payload.subtitle,
        button_text=payload.button_text,
        success_message=payload.success_message,
        fields_config=payload.fields_config,
        created_at=datetime.utcnow(),
    )
    db.add(form)
    db.commit()
    db.refresh(form)
    return _form_to_dict(form)


@router.get("/crm-forms/{form_id}")
def get_form(form_id: int, db: Session = Depends(get_db)):
    form = db.query(models.CRMForm).filter(models.CRMForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return _form_to_dict(form)


@router.put("/crm-forms/{form_id}")
def update_form(form_id: int, payload: CRMFormUpdate, db: Session = Depends(get_db)):
    form = db.query(models.CRMForm).filter(models.CRMForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(form, k, v)
    db.commit()
    db.refresh(form)
    return _form_to_dict(form)


@router.delete("/crm-forms/{form_id}")
def delete_form(form_id: int, db: Session = Depends(get_db)):
    form = db.query(models.CRMForm).filter(models.CRMForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    db.delete(form)
    db.commit()
    return {"ok": True}


@router.get("/crm-forms/{form_id}/submissions")
def list_submissions(form_id: int, db: Session = Depends(get_db)):
    subs = (
        db.query(models.CRMFormSubmission)
        .filter(models.CRMFormSubmission.form_id == form_id)
        .order_by(models.CRMFormSubmission.submitted_at.desc())
        .all()
    )
    result = []
    for s in subs:
        d = s.data
        if isinstance(d, str):
            try:
                d = json.loads(d)
            except Exception:
                d = {}
        result.append({
            "id": s.id,
            "form_id": s.form_id,
            "form_uid": s.form_uid,
            "form_name": s.form_name,
            "entity_type": s.entity_type,
            "entity_id": s.entity_id,
            "data": d,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        })
    return result


# ── Public endpoints (no auth) ────────────────────────────────────────────────

@router.get("/public/forms/{uid}")
def public_get_form(uid: str, db: Session = Depends(get_db)):
    form = db.query(models.CRMForm).filter(models.CRMForm.uid == uid).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if not form.is_active:
        raise HTTPException(status_code=403, detail="Form is inactive")
    return _form_to_dict(form)


@router.post("/public/forms/{uid}/submit")
def public_submit_form(uid: str, body: Dict[str, Any], db: Session = Depends(get_db)):
    form = db.query(models.CRMForm).filter(models.CRMForm.uid == uid).first()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if not form.is_active:
        raise HTTPException(status_code=403, detail="Form is inactive")

    fc = form.fields_config
    if isinstance(fc, str):
        try:
            fc = json.loads(fc)
        except Exception:
            fc = []

    # Determine stage_id
    target_stage_id = form.stage_id
    if not target_stage_id and form.pipeline_id:
        first_stage = (
            db.query(models.Stage)
            .filter(models.Stage.pipeline_id == form.pipeline_id)
            .order_by(models.Stage.order)
            .first()
        )
        if first_stage:
            target_stage_id = first_stage.id

    # Map native field keys
    LEAD_NATIVE = {"first_name", "last_name", "email", "phone", "company_name",
                   "comment", "source_info", "title", "description"}
    CARD_NATIVE = {"title", "price", "description", "comment", "source_info"}

    native_data: Dict[str, Any] = {}
    custom_fields: Dict[int, str] = {}

    for field_cfg in fc:
        key = field_cfg.get("key", "")
        value = body.get(key)
        if value is None:
            continue
        if key.startswith("cf:"):
            try:
                cf_id = int(key[3:])
                custom_fields[cf_id] = str(value)
            except ValueError:
                pass
        else:
            if form.entity_type == "lead" and key in LEAD_NATIVE:
                native_data[key] = value
            elif form.entity_type == "card" and key in CARD_NATIVE:
                native_data[key] = value

    new_entity_id = None

    if form.entity_type == "lead":
        if not native_data.get("title"):
            parts = [native_data.get("first_name", ""), native_data.get("last_name", "")]
            native_data["title"] = " ".join(p for p in parts if p).strip() or "Lead via formulário"
        lead = models.Lead(
            stage_id=target_stage_id,
            created_at=datetime.utcnow(),
            **native_data,
        )
        db.add(lead)
        db.flush()
        new_entity_id = lead.id
        for cf_id, cf_val in custom_fields.items():
            db.add(models.CustomFieldValue(field_id=cf_id, entity_id=lead.id, value=cf_val))

    elif form.entity_type == "card":
        if not native_data.get("title"):
            native_data["title"] = "Negócio via formulário"
        card = models.Card(
            stage_id=target_stage_id,
            created_at=datetime.utcnow(),
            **native_data,
        )
        db.add(card)
        db.flush()
        new_entity_id = card.id
        for cf_id, cf_val in custom_fields.items():
            db.add(models.CustomFieldValue(field_id=cf_id, entity_id=card.id, value=cf_val))

    # Record submission
    submission = models.CRMFormSubmission(
        form_id=form.id,
        form_uid=form.uid,
        form_name=form.name,
        entity_type=form.entity_type,
        entity_id=new_entity_id,
        data=body,
        submitted_at=datetime.utcnow(),
    )
    db.add(submission)
    db.commit()

    return {"ok": True, "entity_id": new_entity_id}
