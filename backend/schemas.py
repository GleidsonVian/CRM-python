from pydantic import BaseModel
from typing import List, Optional

class ContactBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class Contact(ContactBase):
    id: int

    class Config:
        from_attributes = True

class CardBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float = 0.0
    stage_id: int
    contact_id: Optional[int] = None

class CardCreate(CardBase):
    order: int = 0

class Card(CardBase):
    id: int
    order: int

    class Config:
        from_attributes = True

class StageBase(BaseModel):
    name: str
    order: int
    pipeline_id: int
    color: str = "#0f6e9f"

class StageCreate(StageBase):
    pass

class Stage(StageBase):
    id: int
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

class CardMove(BaseModel):
    new_stage_id: int
    new_order: int

class WebhookLead(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
