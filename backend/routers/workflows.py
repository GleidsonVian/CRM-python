import json as _json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import Optional

import models
from database import get_db
from services.automation import _run_action, _build_vars
from services.auth import log_audit

router = APIRouter()


def _wf_out(wf):
    return {
        "id":          wf.id,
        "name":        wf.name,
        "description": wf.description or "",
        "entity_type": wf.entity_type or "deal",
        "pipeline_id": wf.pipeline_id,
        "is_active":   wf.is_active,
        "created_at":  wf.created_at.isoformat() if wf.created_at else None,
        "steps": [
            {
                "id":            s.id,
                "step_order":    s.step_order,
                "action_type":   s.action_type,
                "action_config": s.action_config if isinstance(s.action_config, dict) else {},
            }
            for s in sorted(wf.steps, key=lambda x: x.step_order)
        ],
    }


@router.get("/workflows")
def list_workflows(
    entity_type: Optional[str] = None,
    pipeline_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.WorkflowTemplate)
    if entity_type:
        q = q.filter(
            (models.WorkflowTemplate.entity_type == entity_type) |
            (models.WorkflowTemplate.entity_type == "any")
        )
    if pipeline_id:
        q = q.filter(
            (models.WorkflowTemplate.pipeline_id == pipeline_id) |
            (models.WorkflowTemplate.pipeline_id == None)
        )
    return [_wf_out(wf) for wf in q.order_by(models.WorkflowTemplate.id).all()]


@router.get("/workflows/{wf_id}")
def get_workflow(wf_id: int, db: Session = Depends(get_db)):
    wf = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == wf_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _wf_out(wf)


@router.post("/workflows")
def create_workflow(data: dict, db: Session = Depends(get_db)):
    steps_data = data.pop("steps", [])
    wf = models.WorkflowTemplate(
        name        = data.get("name", "Novo fluxo"),
        description = data.get("description", ""),
        entity_type = data.get("entity_type", "deal"),
        pipeline_id = data.get("pipeline_id"),
        is_active   = data.get("is_active", True),
    )
    db.add(wf)
    db.flush()
    _sync_steps(wf, steps_data, db)
    db.commit()
    db.refresh(wf)
    return _wf_out(wf)


@router.put("/workflows/{wf_id}")
def update_workflow(wf_id: int, data: dict, db: Session = Depends(get_db)):
    wf = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == wf_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    steps_data = data.pop("steps", None)
    wf.name        = data.get("name", wf.name)
    wf.description = data.get("description", wf.description)
    wf.entity_type = data.get("entity_type", wf.entity_type)
    wf.pipeline_id = data.get("pipeline_id", wf.pipeline_id)
    wf.is_active   = data.get("is_active", wf.is_active)
    if steps_data is not None:
        # Remove old steps and replace
        for s in list(wf.steps):
            db.delete(s)
        db.flush()
        _sync_steps(wf, steps_data, db)
    db.commit()
    db.refresh(wf)
    return _wf_out(wf)


@router.delete("/workflows/{wf_id}")
def delete_workflow(wf_id: int, db: Session = Depends(get_db)):
    wf = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == wf_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(wf)
    db.commit()
    return {"ok": True}


@router.post("/workflows/{wf_id}/execute")
def execute_workflow(wf_id: int, body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    wf = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == wf_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    card_id  = body.get("card_id")
    lead_id  = body.get("lead_id")

    if not card_id and not lead_id:
        raise HTTPException(status_code=400, detail="card_id or lead_id required")

    entity = None
    log_card_id = None

    if lead_id:
        entity = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
        if not entity:
            raise HTTPException(status_code=404, detail="Lead not found")
    else:
        entity = db.query(models.Card).filter(models.Card.id == card_id).first()
        if not entity:
            raise HTTPException(status_code=404, detail="Card not found")
        log_card_id = card_id

    step_results = []
    vars_map = _build_vars(entity, db)

    for step in sorted(wf.steps, key=lambda s: s.step_order):
        cfg = step.action_config if isinstance(step.action_config, dict) else {}
        if step.action_type == "flow" and cfg.get("version") == 1:
            from services.automation import _execute_flow_steps
            _execute_flow_steps(cfg.get("steps", []), vars_map, entity, db)
            step_results.append({"step": step.step_order, "status": "ok", "action": "flow"})
        else:
            try:
                _run_action(step.action_type, cfg, vars_map, entity, db)
                step_results.append({"step": step.step_order, "status": "ok", "action": step.action_type})
            except Exception as e:
                step_results.append({"step": step.step_order, "status": "error", "action": step.action_type, "msg": str(e)})

    status = "completed" if all(r["status"] == "ok" for r in step_results) else "failed"
    db.add(models.WorkflowExecution(
        template_id=wf.id,
        template_name=wf.name,
        card_id=log_card_id,
        status=status,
        result_log=step_results,
    ))

    # Audit log
    entity_name = getattr(entity, 'title', None) or getattr(entity, 'name', f'#{entity.id}')
    entity_type = "lead" if lead_id else "card"
    log_audit(db, "workflow_executed", entity_type, entity.id, entity_name,
              actor="Automação", details={"workflow_name": wf.name, "status": status})
    db.commit()

    return {"status": status, "steps": step_results}


def _sync_steps(wf, steps_data: list, db: Session):
    for i, s in enumerate(steps_data):
        cfg = s.get("action_config", {})
        # action_config may arrive as a JSON string from the builder
        if isinstance(cfg, str):
            import json as _json
            try:
                cfg = _json.loads(cfg)
            except Exception:
                cfg = {}
        db.add(models.WorkflowStep(
            template_id  = wf.id,
            step_order   = s.get("step_order", i),
            action_type  = s.get("action_type", ""),
            action_config= cfg,
        ))
