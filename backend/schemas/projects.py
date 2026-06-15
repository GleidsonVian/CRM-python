from typing import Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str


class ProjectMemberOut(BaseModel):
    id: int
    user_id: int
    role: str

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    description: str = ''
    icon: str = '📁'
    theme_color: str = '#6366f1'
    privacy: str = 'public'
    owner_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    member_ids: List[int] = []
    moderator_ids: List[int] = []


class Project(ProjectBase):
    id: int
    created_at: datetime
    members: List[ProjectMemberOut] = []

    class Config:
        from_attributes = True


class TeamMemberOut(BaseModel):
    id: int
    user_id: int
    role: str

    class Config:
        from_attributes = True


class TeamBase(BaseModel):
    name: str
    description: str = ''
    permissions: List[Any] = []

    @field_validator('permissions', mode='before')
    @classmethod
    def _coerce_team_permissions(cls, v):
        return coerce_json_str(v, list)


class TeamCreate(TeamBase):
    member_ids: List[int] = []


class Team(TeamBase):
    id: int
    created_at: datetime
    members: List[TeamMemberOut] = []

    class Config:
        from_attributes = True
