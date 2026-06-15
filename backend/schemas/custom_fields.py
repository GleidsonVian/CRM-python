from typing import Any, List
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str


class CustomFieldBase(BaseModel):
    entity: str
    name: str
    key: str = ''
    uid: str = ''
    field_type: str = 'text'
    options: List[Any] = []
    required: bool = False
    show_on_card: bool = False
    order: int = 0

    @field_validator('options', mode='before')
    @classmethod
    def _coerce_options(cls, v):
        return coerce_json_str(v, list)


class CustomFieldCreate(CustomFieldBase):
    pass


class CustomField(CustomFieldBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CustomFieldValueIn(BaseModel):
    field_id: int
    value: str = ''


class CustomFieldValueOut(BaseModel):
    id: int
    field_id: int
    entity_id: int
    value: str = ''

    class Config:
        from_attributes = True
