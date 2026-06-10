from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ContactBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    salutation: Optional[str] = None
    middle_name: Optional[str] = None
    position: Optional[str] = None
    website: Optional[str] = None
    messenger: Optional[str] = None
    company_name: Optional[str] = None
    source: Optional[str] = None
    source_info: Optional[str] = None
    available_to_all: bool = True
    included_in_export: bool = True
    contact_type: Optional[str] = None
    observers: Optional[str] = None
    comment: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    photo_url: Optional[str] = None
    responsible_user_id: Optional[int] = None

class ContactCreate(ContactBase):
    pass

class Contact(ContactBase):
    id: int
    class Config:
        from_attributes = True

class WebhookBase(BaseModel):
    name: str
    type: str = 'outbound'
    url: Optional[str] = None
    events: str = '[]'
    allowed_entities: str = '[]'
    allowed_methods: str = '["POST"]'
    active: bool = True
    description: Optional[str] = None

class WebhookCreate(WebhookBase):
    pass

class Webhook(WebhookBase):
    id: int
    token: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class CompanyBase(BaseModel):
    name: str
    company_number: Optional[str] = None
    logo_url: Optional[str] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    annual_revenue: float = 0.0
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    messenger: Optional[str] = None
    address: Optional[str] = None
    employees: Optional[str] = None
    available_to_all: bool = True
    responsible_user_id: Optional[int] = None
    observers: Optional[str] = None
    comment: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    contact_ids: List[int] = []

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: int
    created_at: Optional[datetime] = None
    contacts: List['Contact'] = []
    class Config:
        from_attributes = True

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

class UserBase(BaseModel):
    name: str
    email: str
    role: str = "vendedor"

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

class CustomFieldBase(BaseModel):
    entity: str
    name: str
    key: str = ''
    uid: str = ''
    field_type: str = 'text'
    options: str = '[]'
    required: bool = False
    show_on_card: bool = False
    order: int = 0

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

class TaskBase(BaseModel):
    card_id: int
    title: str
    description: str = ''
    due_date: Optional[str] = None
    assigned_to: str = ''
    done: bool = False

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    created_at: datetime
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

class CardBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float = 0.0
    stage_id: int
    contact_ids: List[int] = []
    user_ids: List[int] = []
    created_at: Optional[datetime] = None

class CardCreate(CardBase):
    order: int = 0

class Card(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    price: float = 0.0
    order: int
    stage_id: int
    created_at: Optional[datetime] = None
    activities: List[Activity] = []
    contacts: List[Contact] = []
    users: List[User] = []
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

class AutomationRuleBase(BaseModel):
    stage_id: int
    pipeline_id: int
    name: str = "Regra"
    action_type: str
    config: str = "{}"
    order: int = 0
    enabled: bool = True

class AutomationRuleCreate(AutomationRuleBase):
    pass

class AutomationRule(AutomationRuleBase):
    id: int
    class Config:
        from_attributes = True

class CardMove(BaseModel):
    new_stage_id: int
    new_order: int

class LeadBase(BaseModel):
    title: str
    description: Optional[str] = None
    price: float = 0.0
    stage_id: int
    order: int = 0
    source: Optional[str] = None
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    birth_date: Optional[str] = None
    position: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    source_info: Optional[str] = None
    available_to_all: bool = True
    address: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    comment: Optional[str] = None
    contact_ids: List[int] = []
    user_ids: List[int] = []

class LeadCreate(LeadBase):
    pass

class Lead(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    price: float = 0.0
    order: int = 0
    stage_id: int
    source: Optional[str] = None
    salutation: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    birth_date: Optional[str] = None
    position: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    source_info: Optional[str] = None
    available_to_all: bool = True
    address: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    comment: Optional[str] = None
    converted: bool = False
    converted_card_id: Optional[int] = None
    created_at: Optional[datetime] = None
    activities: List[Activity] = []
    contacts: List[Contact] = []
    users: List[User] = []
    class Config:
        from_attributes = True


class WebhookLead(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
