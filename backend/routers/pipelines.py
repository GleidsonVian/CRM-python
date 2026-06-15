from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas
from database import get_db
from services.helpers import BUILTIN_FIELD_LABELS

router = APIRouter()


# ── Pipelines ─────────────────────────────────────────────────────────────────

@router.get("/pipelines", response_model=List[schemas.Pipeline])
def get_pipelines(db: Session = Depends(get_db)):
    return db.query(models.Pipeline).all()


@router.post("/pipelines", response_model=schemas.Pipeline)
def create_pipeline(pipeline: schemas.PipelineCreate, db: Session = Depends(get_db)):
    if pipeline.name in ("Leads", "Negócios"):
        raise HTTPException(status_code=400, detail="Não é permitido criar funis com o nome 'Leads' ou 'Negócios'.")
    db_pipe = models.Pipeline(name=pipeline.name)
    db.add(db_pipe)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um funil com esse nome.")
    db.refresh(db_pipe)
    _create_default_negocios_stages(db, db_pipe.id)
    return db_pipe


@router.put("/pipelines/{pipe_id}", response_model=schemas.Pipeline)
def update_pipeline(pipe_id: int, pipeline_data: schemas.PipelineCreate, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido renomear os funis padrão.")
    pipe.name = pipeline_data.name
    db.commit()
    db.refresh(pipe)
    return pipe


@router.delete("/pipelines/{pipe_id}", response_model=schemas.OkResponse)
def delete_pipeline(pipe_id: int, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido excluir os funis padrão (Leads e Negócios).")
    db.delete(pipe)
    db.commit()
    return {"status": "ok"}


@router.get("/pipelines/{pipeline_id}/stages", response_model=List[schemas.Stage])
def get_pipeline_stages(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")
    return db.query(models.Stage).filter(
        models.Stage.pipeline_id == pipeline_id
    ).order_by(models.Stage.order).all()


# ── Stages ────────────────────────────────────────────────────────────────────

@router.get("/stages", response_model=List[schemas.Stage])
def get_stages(pipeline_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Stage)
    if pipeline_id:
        query = query.filter(models.Stage.pipeline_id == pipeline_id)
    return query.order_by(models.Stage.order).all()


@router.post("/stages", response_model=schemas.Stage)
def create_stage(stage: schemas.StageCreate, db: Session = Depends(get_db)):
    db_stage = models.Stage(**stage.model_dump())
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage


@router.get("/stages/{stage_id}", response_model=schemas.Stage)
def get_stage(stage_id: int, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    return stg


@router.put("/stages/{stage_id}", response_model=schemas.Stage)
def update_stage(stage_id: int, stage_data: schemas.StageCreate, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    stg.name  = stage_data.name
    stg.color = stage_data.color
    stg.order = stage_data.order
    db.commit()
    db.refresh(stg)
    return stg


@router.delete("/stages/{stage_id}", response_model=schemas.OkResponse)
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    db.delete(stg)
    db.commit()
    return {"ok": True}


@router.get("/stages/{stage_id}/required-fields")
def get_stage_required_fields(stage_id: int, db: Session = Depends(get_db)):
    reqs = db.query(models.StageRequiredField).filter(
        models.StageRequiredField.stage_id == stage_id
    ).all()
    result = []
    for r in reqs:
        item = {"id": r.id, "field_type": r.field_type, "field_key": r.field_key, "custom_field_id": r.custom_field_id}
        if r.field_type == 'custom' and r.custom_field_id:
            cf = db.query(models.CustomField).filter(models.CustomField.id == r.custom_field_id).first()
            item["label"] = cf.name if cf else f"Campo #{r.custom_field_id}"
        else:
            item["label"] = BUILTIN_FIELD_LABELS.get(r.field_key, r.field_key)
        result.append(item)
    return result


@router.put("/stages/{stage_id}/required-fields")
def set_stage_required_fields(stage_id: int, fields: list = Body(...), db: Session = Depends(get_db)):
    """Replace all required fields for a stage. fields = [{field_type, field_key?, custom_field_id?}]"""
    db.query(models.StageRequiredField).filter(
        models.StageRequiredField.stage_id == stage_id
    ).delete()
    for f in fields:
        db.add(models.StageRequiredField(
            stage_id=stage_id,
            field_type=f.get('field_type'),
            field_key=f.get('field_key'),
            custom_field_id=f.get('custom_field_id'),
        ))
    db.commit()
    return {"ok": True}


# ── Internal helper (also used by main.py startup) ────────────────────────────

def _create_default_negocios_stages(db, pipeline_id: int):
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
