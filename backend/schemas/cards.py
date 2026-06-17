from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel
from .activities import Activity
from .contacts import Contact
from .users import User


class CardBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float = 0.0
    stage_id: int
    contact_ids: List[int] = []
    user_ids: List[int] = []
    created_at: Optional[datetime] = None
    source: Optional[str] = None
    source_info: Optional[str] = None
    deal_type: Optional[str] = None
    start_date: Optional[str] = None
    available_to_all: bool = True
    responsible_user_id: Optional[int] = None
    observers: Optional[str] = None
    comment: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


class CardCreate(CardBase):
    order: int = 0
    custom_fields: Optional[Dict[str, Any]] = None


class Card(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    price: float = 0.0
    order: int
    stage_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    stage_changed_by: Optional[str] = None
    source: Optional[str] = None
    source_info: Optional[str] = None
    deal_type: Optional[str] = None
    start_date: Optional[str] = None
    available_to_all: bool = True
    responsible_user_id: Optional[int] = None
    observers: Optional[str] = None
    comment: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    deleted_at: Optional[datetime] = None
    activities: List[Activity] = []
    contacts: List[Contact] = []
    users: List[User] = []
    custom_fields: Optional[Dict[str, Any]] = {}

    class Config:
        from_attributes = True


class CardMove(BaseModel):
    new_stage_id: int
    new_order: int


class StageBase(BaseModel):
    name: str
    order: int
    pipeline_id: int
    color: str = "#0f6e9f"


class StageCreate(StageBase):
    pass


class Stage(StageBase):
    id: int
    is_terminal: bool = False
    cards: List[Card] = []

    class Config:
        from_attributes = True


class PipelineBase(BaseModel):
    name: str


class PipelineCreate(PipelineBase):
    pass


class Pipeline(PipelineBase):
    id: int
    stages: List[Stage] = []

    class Config:
        from_attributes = True
