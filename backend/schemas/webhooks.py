from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str


class WebhookBase(BaseModel):
    name: str
    type: str = 'outbound'
    url: Optional[str] = None
    events: List[str] = []
    allowed_entities: List[str] = []
    allowed_methods: List[str] = ["POST"]
    active: bool = True
    description: Optional[str] = None

    @field_validator('events', 'allowed_entities', 'allowed_methods', mode='before')
    @classmethod
    def _coerce_list(cls, v):
        return coerce_json_str(v, list)


class WebhookCreate(WebhookBase):
    pass


class Webhook(WebhookBase):
    id: int
    token: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
