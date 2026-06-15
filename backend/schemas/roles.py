from typing import Any, Dict, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str


class RoleBase(BaseModel):
    name: str
    description: str = ''
    color: str = '#6366f1'
    permissions: Dict[str, Any] = {}

    @field_validator('permissions', mode='before')
    @classmethod
    def _coerce_permissions(cls, v):
        return coerce_json_str(v, dict)


class RoleCreate(RoleBase):
    pass


class Role(RoleBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
