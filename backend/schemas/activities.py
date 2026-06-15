from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ActivityBase(BaseModel):
    type: str
    content: str
    actor: str = 'Usuário'


class ActivityCreate(ActivityBase):
    pass


class Activity(ActivityBase):
    id: int
    card_id: Optional[int] = None
    lead_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
