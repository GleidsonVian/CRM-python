import json
from fastapi import APIRouter, Depends, HTTPException, Header, Body, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from urllib import request as urllib_req
from urllib.request import urlopen

import models, schemas
from database import get_db
from services.auth import log_audit
from services.automation import (
    _build_vars, _execute_flow_steps, _execute_workflow_step, _execute_rule
)
from services.auth import jwt_decode

router = APIRouter()


# ── Automation Rules ──────────────────────────────────────────────────────────

@router.get("/automations", response_model=List[schemas.AutomationRule])
def get_automations(stage_id: int = None, pipeline_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.AutomationRule)
    if stage_id: q = q.filter(models.AutomationRule.stage_id == stage_id)
    if pipeline_id: q = q.filter(models.AutomationRule.pipeline_id == pipeline_id)
    return q.order_by(models.AutomationRule.order).all()


@router.post("/automations", response_model=schemas.AutomationRule)
def create_automation(rule: schemas.AutomationRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.AutomationRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.put("/automations/{rule_id}", response_model=schemas.AutomationRule)
def update_automation(rule_id: int, rule: schemas.AutomationRuleBase, db: Session = Depends(get_db)):
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in rule.model_dump().items():
        setattr(db_rule, k, v)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/automations/{rule_id}")
def delete_automation(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(db_rule)
    db.commit()
    return {"status": "ok"}


@router.get("/automations/export")
def export_automations(pipeline_id: int, db: Session = Depends(get_db)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.pipeline_id == pipeline_id
    ).order_by(models.AutomationRule.order).all()

    stages = db.query(models.Stage).filter(models.Stage.pipeline_id == pipeline_id).all()
    stage_names = {s.id: s.name for s in stages}

    export_data = {
        "nexus_crm_automations": True,
        "version": 1,
        "pipeline_name": pipeline.name,
        "rules": [
            {
                "stage_name": stage_names.get(r.stage_id, f"stage_{r.stage_id}"),
                "name": r.name,
                "action_type": r.action_type,
                "config": r.config,
                "order": r.order,
                "enabled": r.enabled,
            }
            for r in rules
        ],
    }
    return export_data


@router.post("/automations/import")
def import_automations(
    pipeline_id: int,
    data: dict = Body(...),
    mode: str = "append",
    db: Session = Depends(get_db),
):
    if not data.get("nexus_crm_automations"):
        raise HTTPException(status_code=400, detail="Arquivo inválido: não é um export de automações Nexus CRM.")

    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    stages = db.query(models.Stage).filter(models.Stage.pipeline_id == pipeline_id).all()
    stage_by_name = {s.name.strip().lower(): s.id for s in stages}

    if mode == "replace":
        db.query(models.AutomationRule).filter(
            models.AutomationRule.pipeline_id == pipeline_id
        ).delete()
        db.flush()

    created = []
    skipped = []
    for rule_data in data.get("rules", []):
        stage_name = rule_data.get("stage_name", "")
        stage_id = stage_by_name.get(stage_name.strip().lower())
        if not stage_id:
            skipped.append(stage_name)
            continue
        new_rule = models.AutomationRule(
            stage_id=stage_id,
            pipeline_id=pipeline_id,
            name=rule_data.get("name", "Regra importada"),
            action_type=rule_data.get("action_type", "add_note"),
            config=rule_data.get("config", "{}"),
            order=rule_data.get("order", 0),
            enabled=rule_data.get("enabled", True),
        )
        db.add(new_rule)
        created.append(rule_data.get("name"))

    db.commit()
    return {
        "ok": True,
        "created": len(created),
        "skipped": len(skipped),
        "skipped_stages": skipped,
    }


# ── Workflow Templates ────────────────────────────────────────────────────────

@router.get("/workflows", response_model=List[schemas.WorkflowTemplate])
def get_workflows(entity_type: str = None, pipeline_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.WorkflowTemplate)
    if entity_type:
        q = q.filter(models.WorkflowTemplate.entity_type.in_([entity_type, 'any']))
    if pipeline_id:
        q = q.filter(
            (models.WorkflowTemplate.pipeline_id == pipeline_id) |
            (models.WorkflowTemplate.pipeline_id == None)
        )
    return q.order_by(models.WorkflowTemplate.id).all()


@router.post("/workflows", response_model=schemas.WorkflowTemplate)
def create_workflow(data: schemas.WorkflowTemplateCreate, db: Session = Depends(get_db)):
    steps_data = data.steps
    tpl_data = data.model_dump(exclude={'steps'})
    tpl = models.WorkflowTemplate(**tpl_data)
    db.add(tpl)
    db.flush()
    for i, s in enumerate(steps_data):
        step = models.WorkflowStep(template_id=tpl.id, step_order=i, action_type=s.action_type, action_config=s.action_config)
        db.add(step)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.put("/workflows/{tpl_id}", response_model=schemas.WorkflowTemplate)
def update_workflow(tpl_id: int, data: schemas.WorkflowTemplateCreate, db: Session = Depends(get_db)):
    tpl = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == tpl_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Workflow not found")
    steps_data = data.steps
    for k, v in data.model_dump(exclude={'steps'}).items():
        setattr(tpl, k, v)
    db.query(models.WorkflowStep).filter(models.WorkflowStep.template_id == tpl_id).delete()
    for i, s in enumerate(steps_data):
        step = models.WorkflowStep(template_id=tpl.id, step_order=i, action_type=s.action_type, action_config=s.action_config)
        db.add(step)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/workflows/{tpl_id}")
def delete_workflow(tpl_id: int, db: Session = Depends(get_db)):
    tpl = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == tpl_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(tpl)
    db.commit()
    return {"status": "ok"}


@router.post("/workflows/{tpl_id}/execute")
def execute_workflow(
    tpl_id: int,
    body: dict = Body(default={}),
    authorization: str = Header(default=None),
    db: Session = Depends(get_db)
):
    card_id = body.get("card_id")
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id required")

    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    tpl = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == tpl_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Workflow not found")

    steps = db.query(models.WorkflowStep).filter(
        models.WorkflowStep.template_id == tpl_id
    ).order_by(models.WorkflowStep.step_order).all()

    result_log = []
    status = 'completed'

    for step in steps:
        try:
            cfg = step.action_config or {}
            if step.action_type == 'flow' and cfg.get('version') == 1:
                vars_map = _build_vars(card, db)
                _execute_flow_steps(cfg.get('steps', []), vars_map, card, db)
                result_log.append({"action": "flow", "status": "ok", "msg": f"{len(cfg.get('steps', []))} blocos executados"})
            else:
                msg = _execute_workflow_step(step.action_type, cfg, card, db)
                result_log.append({"action": step.action_type, "status": "ok", "msg": msg})
        except Exception as e:
            result_log.append({"action": step.action_type, "status": "error", "msg": str(e)})
            status = 'failed'

    db.commit()

    exec_id = None
    exec_name = 'Sistema'
    if authorization and authorization.startswith("Bearer "):
        try:
            payload = jwt_decode(authorization.replace("Bearer ", ""))
            u = db.query(models.User).filter(models.User.id == payload["sub"]).first()
            if u:
                exec_id = u.id
                exec_name = u.name
        except Exception:
            pass

    exe = models.WorkflowExecution(
        template_id=tpl_id,
        template_name=tpl.name,
        card_id=card_id,
        executed_by_id=exec_id,
        executed_by_name=exec_name,
        status=status,
        result_log=result_log,
    )
    db.add(exe)
    log_audit(db, "workflow_executed", "card", card_id, card.title, exec_name, details={"workflow_name": tpl.name, "status": status})
    db.commit()
    return {"status": status, "steps": result_log}
