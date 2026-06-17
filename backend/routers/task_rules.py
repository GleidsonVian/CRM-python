from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
import models
from database import get_db

router = APIRouter()


def _out(r):
    return {
        "id": r.id, "name": r.name,
        "trigger_type": r.trigger_type, "trigger_value": r.trigger_value,
        "column_id": r.column_id,
        "action_type": r.action_type, "action_config": r.action_config or {},
        "enabled": r.enabled,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/task-rules")
def list_rules(column_id: str = None, db: Session = Depends(get_db)):
    q = db.query(models.TaskRule)
    if column_id == '__global__':
        q = q.filter(models.TaskRule.column_id == None)
    elif column_id:
        q = q.filter(models.TaskRule.column_id == column_id)
    return [_out(r) for r in q.order_by(models.TaskRule.id).all()]


@router.post("/task-rules")
def create_rule(data: dict = Body(...), db: Session = Depends(get_db)):
    r = models.TaskRule(
        name=data.get("name", "Regra"),
        trigger_type=data["trigger_type"],
        trigger_value=data.get("trigger_value"),
        column_id=data.get("column_id"),
        action_type=data["action_type"],
        action_config=data.get("action_config", {}),
        enabled=data.get("enabled", True),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _out(r)


@router.put("/task-rules/{rule_id}")
def update_rule(rule_id: int, data: dict = Body(...), db: Session = Depends(get_db)):
    r = db.query(models.TaskRule).filter(models.TaskRule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k in ("name", "trigger_type", "trigger_value", "column_id", "action_type", "action_config", "enabled"):
        if k in data:
            setattr(r, k, data[k])
    db.commit()
    db.refresh(r)
    return _out(r)


@router.delete("/task-rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    r = db.query(models.TaskRule).filter(models.TaskRule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_column(task: models.Task) -> str:
    """Replicate frontend getColumnId logic."""
    if task.status == 'done' or task.done:
        return 'done'
    due = task.due_date  # YYYY-MM-DD string or None
    if not due:
        return 'no_date'
    today = date.today()
    w1 = today + timedelta(days=7)
    w2 = today + timedelta(days=14)
    due_d = date.fromisoformat(due) if isinstance(due, str) else due
    if due_d < today:
        return 'overdue'
    if due_d == today:
        return 'today'
    if due_d <= w1:
        return 'week'
    if due_d <= w2:
        return 'next_week'
    return 'later'


def apply_rules(task: models.Task, prev_status: str, prev_priority: str, db: Session,
                prev_due: str = None):
    """Called after a task update to apply matching automation rules."""
    rules = db.query(models.TaskRule).filter(models.TaskRule.enabled == True).all()

    prev_col = None
    curr_col = _get_column(task)

    # Compute prev column if needed (for entered_column trigger)
    if any(r.trigger_type == 'entered_column' for r in rules):
        # Temporarily restore prev values to compute prev column
        orig_status, orig_done, orig_due = task.status, task.done, task.due_date
        task.status = prev_status
        task.done = (prev_status == 'done')
        task.due_date = prev_due if prev_due is not None else task.due_date
        prev_col = _get_column(task)
        task.status = orig_status
        task.done = orig_done
        task.due_date = orig_due

    for rule in rules:
        match = False
        if rule.trigger_type == 'status_changed' and task.status != prev_status:
            match = (rule.trigger_value is None or rule.trigger_value == task.status)
        elif rule.trigger_type == 'priority_changed' and task.priority != prev_priority:
            match = (rule.trigger_value is None or rule.trigger_value == task.priority)
        elif rule.trigger_type == 'entered_column' and prev_col != curr_col:
            # Match if rule targets this column (or any column if trigger_value is None)
            col_target = rule.column_id or rule.trigger_value
            match = (col_target is None or col_target == curr_col)

        if not match:
            continue

        cfg = rule.action_config or {}
        if rule.action_type == 'set_status':
            task.status = cfg.get('value', task.status)
            task.done = task.status == 'done'
        elif rule.action_type == 'set_priority':
            task.priority = cfg.get('value', task.priority)
        elif rule.action_type == 'set_assigned_to':
            task.assigned_to = cfg.get('value', task.assigned_to)
