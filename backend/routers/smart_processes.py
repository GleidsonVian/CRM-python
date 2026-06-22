import json as _json
from datetime import datetime
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models
from database import get_db

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class FieldDef(BaseModel):
    key: str
    label: str
    type: str = "text"           # text | number | select | date | textarea | url | phone
    options: List[str] = []
    required: bool = False

class StageDef(BaseModel):
    name: str
    color: str = "#6366f1"

class ProcessCreate(BaseModel):
    name: str
    icon: str = "📋"
    color: str = "#6366f1"
    description: str = ""
    fields_config: List[Dict[str, Any]] = []
    stages: List[Dict[str, Any]] = []
    automation_rules: List[Dict[str, Any]] = []

class ProcessOut(BaseModel):
    id: int
    name: str
    icon: str
    color: str
    description: str
    fields_config: List[Dict[str, Any]]
    stages: List[Dict[str, Any]]
    automation_rules: List[Dict[str, Any]] = []
    created_at: Optional[datetime]
    record_count: int = 0

    class Config:
        from_attributes = True

class RecordCreate(BaseModel):
    title: str
    stage_index: int = 0
    assignee_id: Optional[int] = None
    data: Dict[str, Any] = {}

class RecordOut(BaseModel):
    id: int
    process_id: int
    title: str
    stage_index: int
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    data: Dict[str, Any]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    links: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True

class LinkCreate(BaseModel):
    entity_type: str   # "card" | "lead" | "contact" | "company"
    entity_id: int

class NoteCreate(BaseModel):
    content: str
    actor: str = "Usuário"

class RecordImportRow(BaseModel):
    title: str
    stage_index: int = 0
    assignee_id: Optional[int] = None
    data: Dict[str, Any] = {}

class RecordImportBody(BaseModel):
    records: List[RecordImportRow]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_record(r: models.SpRecord, db: Session = None) -> dict:
    assignee_name = None
    if r.assignee_id and db:
        u = db.query(models.User).filter(models.User.id == r.assignee_id).first()
        if u:
            assignee_name = u.name
    return {
        "id": r.id,
        "process_id": r.process_id,
        "title": r.title,
        "stage_index": r.stage_index or 0,
        "assignee_id": r.assignee_id,
        "assignee_name": assignee_name,
        "data": r.data or {},
        "created_at": r.created_at,
        "updated_at": r.updated_at,
        "links": [{"id": lk.id, "entity_type": lk.entity_type, "entity_id": lk.entity_id}
                  for lk in r.links],
    }


def _serialize_process(p: models.SmartProcess, db: Session) -> dict:
    count = db.query(models.SpRecord).filter(models.SpRecord.process_id == p.id).count()
    return {
        "id": p.id,
        "name": p.name,
        "icon": p.icon or "📋",
        "color": p.color or "#6366f1",
        "description": p.description or "",
        "fields_config": p.fields_config or [],
        "stages": p.stages or [],
        "automation_rules": p.automation_rules or [],
        "created_at": p.created_at,
        "record_count": count,
    }


# ── Processes CRUD ────────────────────────────────────────────────────────────

@router.get("/smart-processes")
def list_processes(db: Session = Depends(get_db)):
    procs = db.query(models.SmartProcess).order_by(models.SmartProcess.id).all()
    return [_serialize_process(p, db) for p in procs]


@router.post("/smart-processes")
def create_process(body: ProcessCreate, db: Session = Depends(get_db)):
    p = models.SmartProcess(
        name=body.name, icon=body.icon, color=body.color,
        description=body.description,
        fields_config=body.fields_config,
        stages=body.stages,
        automation_rules=body.automation_rules,
        created_at=datetime.utcnow(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize_process(p, db)


@router.get("/smart-processes/{process_id}")
def get_process(process_id: int, db: Session = Depends(get_db)):
    p = db.query(models.SmartProcess).filter(models.SmartProcess.id == process_id).first()
    if not p:
        raise HTTPException(404, "Processo não encontrado")
    return _serialize_process(p, db)


@router.put("/smart-processes/{process_id}")
def update_process(process_id: int, body: ProcessCreate, db: Session = Depends(get_db)):
    p = db.query(models.SmartProcess).filter(models.SmartProcess.id == process_id).first()
    if not p:
        raise HTTPException(404, "Processo não encontrado")
    p.name = body.name
    p.icon = body.icon
    p.color = body.color
    p.description = body.description
    p.fields_config = body.fields_config
    p.stages = body.stages
    p.automation_rules = body.automation_rules
    db.commit()
    db.refresh(p)
    return _serialize_process(p, db)


@router.delete("/smart-processes/{process_id}")
def delete_process(process_id: int, db: Session = Depends(get_db)):
    p = db.query(models.SmartProcess).filter(models.SmartProcess.id == process_id).first()
    if not p:
        raise HTTPException(404, "Processo não encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ── Records CRUD ──────────────────────────────────────────────────────────────

@router.get("/smart-processes/{process_id}/records")
def list_records(process_id: int, db: Session = Depends(get_db)):
    records = (db.query(models.SpRecord)
               .filter(models.SpRecord.process_id == process_id)
               .order_by(models.SpRecord.stage_index, models.SpRecord.id)
               .all())
    return [_serialize_record(r, db) for r in records]


@router.post("/smart-processes/{process_id}/records")
def create_record(process_id: int, body: RecordCreate, db: Session = Depends(get_db)):
    p = db.query(models.SmartProcess).filter(models.SmartProcess.id == process_id).first()
    if not p:
        raise HTTPException(404, "Processo não encontrado")
    r = models.SpRecord(
        process_id=process_id,
        title=body.title,
        stage_index=body.stage_index,
        assignee_id=body.assignee_id,
        data=body.data,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _serialize_record(r, db)


@router.post("/smart-processes/{process_id}/import")
def import_records_bulk(process_id: int, body: RecordImportBody, db: Session = Depends(get_db)):
    p = db.query(models.SmartProcess).filter(models.SmartProcess.id == process_id).first()
    if not p:
        raise HTTPException(404, "Processo não encontrado")
    created = []
    errors = []
    for i, row in enumerate(body.records):
        try:
            r = models.SpRecord(
                process_id=process_id,
                title=row.title,
                stage_index=row.stage_index,
                assignee_id=row.assignee_id,
                data=row.data,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(r)
            db.flush()
            created.append(r.id)
        except Exception as e:
            errors.append({"row": i + 1, "title": row.title, "error": str(e)})
    db.commit()
    return {"created": len(created), "errors": errors, "ids": created}


@router.get("/smart-processes/{process_id}/records/{record_id}")
def get_record(process_id: int, record_id: int, db: Session = Depends(get_db)):
    r = db.query(models.SpRecord).filter(
        models.SpRecord.id == record_id,
        models.SpRecord.process_id == process_id,
    ).first()
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    return _serialize_record(r, db)


@router.put("/smart-processes/{process_id}/records/{record_id}")
def update_record(process_id: int, record_id: int, body: RecordCreate, db: Session = Depends(get_db)):
    r = db.query(models.SpRecord).filter(
        models.SpRecord.id == record_id,
        models.SpRecord.process_id == process_id,
    ).first()
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    r.title = body.title
    r.stage_index = body.stage_index
    r.assignee_id = body.assignee_id
    r.data = body.data
    r.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return _serialize_record(r, db)


@router.delete("/smart-processes/{process_id}/records/{record_id}")
def delete_record(process_id: int, record_id: int, db: Session = Depends(get_db)):
    r = db.query(models.SpRecord).filter(
        models.SpRecord.id == record_id,
        models.SpRecord.process_id == process_id,
    ).first()
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ── Links ─────────────────────────────────────────────────────────────────────

@router.post("/sp-records/{record_id}/link")
def link_record(record_id: int, body: LinkCreate, db: Session = Depends(get_db)):
    r = db.query(models.SpRecord).filter(models.SpRecord.id == record_id).first()
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    existing = db.query(models.SpRecordLink).filter(
        models.SpRecordLink.record_id == record_id,
        models.SpRecordLink.entity_type == body.entity_type,
        models.SpRecordLink.entity_id == body.entity_id,
    ).first()
    if existing:
        return {"id": existing.id, "record_id": record_id,
                "entity_type": existing.entity_type, "entity_id": existing.entity_id}
    lk = models.SpRecordLink(
        record_id=record_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        created_at=datetime.utcnow(),
    )
    db.add(lk)
    db.commit()
    db.refresh(lk)
    return {"id": lk.id, "record_id": record_id,
            "entity_type": lk.entity_type, "entity_id": lk.entity_id}


@router.delete("/sp-records/{record_id}/link/{link_id}")
def unlink_record(record_id: int, link_id: int, db: Session = Depends(get_db)):
    lk = db.query(models.SpRecordLink).filter(
        models.SpRecordLink.id == link_id,
        models.SpRecordLink.record_id == record_id,
    ).first()
    if not lk:
        raise HTTPException(404, "Vínculo não encontrado")
    db.delete(lk)
    db.commit()
    return {"ok": True}


# ── Notes ────────────────────────────────────────────────────────────────────

@router.get("/smart-processes/{process_id}/records/{record_id}/notes")
def list_notes(process_id: int, record_id: int, db: Session = Depends(get_db)):
    r = db.query(models.SpRecord).filter(
        models.SpRecord.id == record_id,
        models.SpRecord.process_id == process_id,
    ).first()
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    notes = db.query(models.SpNote).filter(models.SpNote.record_id == record_id).order_by(models.SpNote.created_at.desc()).all()
    return [{"id": n.id, "content": n.content, "actor": n.actor, "created_at": n.created_at} for n in notes]


@router.post("/smart-processes/{process_id}/records/{record_id}/notes")
def create_note(process_id: int, record_id: int, body: NoteCreate, db: Session = Depends(get_db)):
    r = db.query(models.SpRecord).filter(
        models.SpRecord.id == record_id,
        models.SpRecord.process_id == process_id,
    ).first()
    if not r:
        raise HTTPException(404, "Registro não encontrado")
    note = models.SpNote(record_id=record_id, content=body.content, actor=body.actor)
    db.add(note)
    db.commit()
    db.refresh(note)
    return {"id": note.id, "content": note.content, "actor": note.actor, "created_at": note.created_at}


@router.delete("/smart-processes/{process_id}/records/{record_id}/notes/{note_id}")
def delete_note(process_id: int, record_id: int, note_id: int, db: Session = Depends(get_db)):
    note = db.query(models.SpNote).filter(
        models.SpNote.id == note_id,
        models.SpNote.record_id == record_id,
    ).first()
    if not note:
        raise HTTPException(404, "Nota não encontrada")
    db.delete(note)
    db.commit()
    return {"ok": True}


# ── Backlinks: quem referencia este registro via campo entity ─────────────────

@router.get("/smart-processes/{process_id}/records/{record_id}/backlinks")
def get_record_backlinks(process_id: int, record_id: int, db: Session = Depends(get_db)):
    """Return all SPA records that have an entity-reference field pointing to this record."""
    all_procs = db.query(models.SmartProcess).all()
    results = []

    for proc in all_procs:
        if proc.id == process_id:
            continue
        fields_config = proc.fields_config or []
        entity_fields = [
            f for f in fields_config
            if f.get("type") == "entity"
            and f.get("entity_type") == "spa"
            and f.get("target_id") == process_id
        ]
        if not entity_fields:
            continue

        recs = db.query(models.SpRecord).filter(models.SpRecord.process_id == proc.id).all()
        for rec in recs:
            data = rec.data or {}
            for field in entity_fields:
                raw = data.get(field.get("key", ""))
                if not raw:
                    continue
                try:
                    parsed = _json.loads(raw) if isinstance(raw, str) else raw
                    if parsed.get("id") == record_id:
                        stage_name = ""
                        stages = proc.stages or []
                        if isinstance(rec.stage_index, int) and rec.stage_index < len(stages):
                            stage_name = stages[rec.stage_index].get("name", "")
                            stage_color = stages[rec.stage_index].get("color", "#6366f1")
                        else:
                            stage_color = "#6366f1"
                        results.append({
                            "record_id":    rec.id,
                            "record_title": rec.title,
                            "process_id":   proc.id,
                            "process_name": proc.name,
                            "process_icon": proc.icon or "📋",
                            "process_color": proc.color or "#6366f1",
                            "field_label":  field.get("label", field.get("key", "")),
                            "stage_name":   stage_name,
                            "stage_color":  stage_color,
                        })
                        break
                except Exception:
                    pass

    return results


# ── Cross-entity: get all SP records linked to a card/lead/etc. ───────────────

@router.get("/entities/{entity_type}/{entity_id}/sp-records")
def get_sp_records_for_entity(entity_type: str, entity_id: int, db: Session = Depends(get_db)):
    links = db.query(models.SpRecordLink).filter(
        models.SpRecordLink.entity_type == entity_type,
        models.SpRecordLink.entity_id == entity_id,
    ).all()
    result = []
    for lk in links:
        r = db.query(models.SpRecord).filter(models.SpRecord.id == lk.record_id).first()
        if r:
            p = db.query(models.SmartProcess).filter(models.SmartProcess.id == r.process_id).first()
            rec = _serialize_record(r)
            rec["link_id"] = lk.id
            rec["process_name"] = p.name if p else ""
            rec["process_icon"] = p.icon if p else "📋"
            rec["process_color"] = p.color if p else "#6366f1"
            rec["process_stages"] = p.stages if p else []
            result.append(rec)
    return result
