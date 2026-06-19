from datetime import datetime as _dt
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional

import models, schemas
from database import get_db
from services.helpers import _task_out
from routers.task_rules import apply_rules

router = APIRouter()


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.get("/cards/{card_id}/tasks")
def get_tasks_by_card(card_id: int, db: Session = Depends(get_db)):
    tasks = db.query(models.Task).filter(models.Task.card_id == card_id).order_by(models.Task.created_at).all()
    return [_task_out(t, db) for t in tasks]


@router.get("/tasks")
def get_all_tasks(
    project_id: Optional[int] = None,
    card_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Task)
    if project_id is not None: q = q.filter(models.Task.project_id == project_id)
    if card_id is not None:    q = q.filter(models.Task.card_id == card_id)
    if lead_id is not None:    q = q.filter(models.Task.lead_id == lead_id)
    if assigned_to:            q = q.filter(models.Task.assigned_to == assigned_to)
    if status:                 q = q.filter(models.Task.status == status)
    tasks = q.order_by(models.Task.created_at.desc()).all()
    return [_task_out(t, db) for t in tasks]


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    return _task_out(obj, db)


@router.post("/tasks", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    data = task.model_dump()
    count = db.query(models.Task).count() + 1
    data['uid'] = f"TSK-{count:04d}"
    if data.get('status') == 'done': data['done'] = True
    obj = models.Task(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)


@router.put("/tasks/{task_id}")
def update_task(task_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    prev_status = obj.status
    prev_priority = obj.priority
    prev_due = obj.due_date
    data = task.model_dump()
    if data.get('status') == 'done': data['done'] = True
    else: data['done'] = False
    data['updated_at'] = _dt.utcnow()
    for k, v in data.items():
        setattr(obj, k, v)
    apply_rules(obj, prev_status, prev_priority, db, prev_due=prev_due)
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)


@router.patch("/tasks/{task_id}/status")
def set_task_status(task_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    s = body.get('status', 'todo')
    obj.status = s
    obj.done = (s == 'done')
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)


@router.delete("/tasks/{task_id}", response_model=schemas.OkResponse)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


@router.patch("/tasks/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    obj.done = not obj.done
    obj.status = 'done' if obj.done else 'todo'
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)


# ── Task time tracking ────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/time/start", response_model=schemas.OkResponse)
def start_timer(task_id: int, body: dict = Body(default={}), db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    open_entries = [e for e in obj.time_entries if e.ended_at is None and e.started_at is not None]
    for e in open_entries:
        e.ended_at = _dt.utcnow()
        e.duration_seconds = int((_dt.utcnow() - e.started_at.replace(tzinfo=None)).total_seconds())
    entry = models.TaskTimeEntry(task_id=task_id, user_name=body.get('user_name', ''), started_at=_dt.utcnow())
    db.add(entry)
    db.commit()
    return {"ok": True, "entry_id": entry.id}


@router.post("/tasks/{task_id}/time/stop", response_model=schemas.OkResponse)
def stop_timer(task_id: int, body: dict = Body(default={}), db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    open_entries = [e for e in obj.time_entries if e.ended_at is None and e.started_at is not None]
    for e in open_entries:
        now = _dt.utcnow()
        e.ended_at = now
        e.duration_seconds = int((now - e.started_at.replace(tzinfo=None)).total_seconds())
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    projs = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    out = []
    for p in projs:
        task_count = db.query(models.Task).filter(models.Task.project_id == p.id).count()
        out.append({
            'id': p.id, 'name': p.name, 'description': p.description,
            'icon': p.icon, 'theme_color': p.theme_color, 'privacy': p.privacy,
            'owner_id': p.owner_id,
            'created_at': p.created_at,
            'task_count': task_count,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in p.members],
        })
    return out


@router.post("/projects")
def create_project(proj: schemas.ProjectCreate, db: Session = Depends(get_db)):
    data = proj.model_dump(exclude={'member_ids', 'moderator_ids'})
    obj = models.Project(**data)
    db.add(obj)
    db.flush()
    if obj.owner_id:
        db.add(models.ProjectMember(project_id=obj.id, user_id=obj.owner_id, role='owner'))
    for uid in proj.moderator_ids:
        if uid != obj.owner_id:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='moderator'))
    for uid in proj.member_ids:
        if uid != obj.owner_id and uid not in proj.moderator_ids:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'icon': obj.icon, 'theme_color': obj.theme_color, 'privacy': obj.privacy,
            'owner_id': obj.owner_id, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}


@router.put("/projects/{project_id}")
def update_project(project_id: int, proj: schemas.ProjectCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Project not found")
    for k, v in proj.model_dump(exclude={'member_ids', 'moderator_ids'}).items():
        setattr(obj, k, v)
    for m in list(obj.members): db.delete(m)
    db.flush()
    if obj.owner_id:
        db.add(models.ProjectMember(project_id=obj.id, user_id=obj.owner_id, role='owner'))
    for uid in proj.moderator_ids:
        if uid != obj.owner_id:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='moderator'))
    for uid in proj.member_ids:
        if uid != obj.owner_id and uid not in proj.moderator_ids:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'icon': obj.icon, 'theme_color': obj.theme_color, 'privacy': obj.privacy,
            'owner_id': obj.owner_id, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}


@router.delete("/projects/{project_id}", response_model=schemas.OkResponse)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Project not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Teams ─────────────────────────────────────────────────────────────────────

@router.get("/teams")
def get_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).order_by(models.Team.created_at).all()
    out = []
    for t in teams:
        out.append({
            'id': t.id, 'name': t.name, 'description': t.description,
            'permissions': t.permissions, 'created_at': t.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in t.members],
        })
    return out


@router.post("/teams")
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db)):
    data = team.model_dump(exclude={'member_ids'})
    obj = models.Team(**data)
    db.add(obj)
    db.flush()
    for uid in team.member_ids:
        db.add(models.TeamMember(team_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'permissions': obj.permissions, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}


@router.put("/teams/{team_id}")
def update_team(team_id: int, team: schemas.TeamCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Team not found")
    for k, v in team.model_dump(exclude={'member_ids'}).items():
        setattr(obj, k, v)
    for m in list(obj.members): db.delete(m)
    db.flush()
    for uid in team.member_ids:
        db.add(models.TeamMember(team_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'permissions': obj.permissions, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}


@router.delete("/teams/{team_id}", response_model=schemas.OkResponse)
def delete_team(team_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Team not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}
