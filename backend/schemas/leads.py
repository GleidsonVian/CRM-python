from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel
from .activities import Activity
from .contacts import Contact
from .users import User


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
    deleted_at: Optional[datetime] = None
    activities: List[Activity] = []
    contacts: List[Contact] = []
    users: List[User] = []
    custom_fields: Optional[Dict[str, Any]] = {}

    class Config:
        from_attributes = True


class WebhookLead(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None


class LeadConvertOptions(BaseModel):
    create_deal: bool = True
    create_contact: bool = False
    create_company: bool = False


class LeadConvertResult(BaseModel):
    deal_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
