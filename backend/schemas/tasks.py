from typing import Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str


class TaskTimeEntryOut(BaseModel):
    id: int
    task_id: int
    user_name: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int = 0

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    title: str
    description: str = ''
    status: str = 'todo'
    priority: str = 'normal'
    due_date: Optional[str] = None
    assigned_to: str = ''
    participants: List[str] = []

    @field_validator('participants', mode='before')
    @classmethod
    def _coerce_participants(cls, v):
        return coerce_json_str(v, list)

    done: bool = False
    card_id: Optional[int] = None
    lead_id: Optional[int] = None
    project_id: Optional[int] = None
    parent_task_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class Task(TaskBase):
    id: int
    uid: str = ''
    created_at: datetime
    updated_at: Optional[datetime] = None
    card_title: Optional[str] = None
    lead_title: Optional[str] = None
    project_name: Optional[str] = None
    time_entries: List[TaskTimeEntryOut] = []
    total_time_seconds: int = 0

    class Config:
        from_attributes = True


class CommentBase(BaseModel):
    card_id: int
    author: str = 'Usuário'
    content: str


class CommentCreate(CommentBase):
    pass


class Comment(CommentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
