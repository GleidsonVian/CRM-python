from typing import Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str
from .contacts import Contact


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

    @field_validator('contact_ids', mode='before')
    @classmethod
    def _coerce_contact_ids(cls, v):
        return coerce_json_str(v, list)


class CompanyCreate(CompanyBase):
    pass


class Company(CompanyBase):
    id: int
    created_at: Optional[datetime] = None
    contacts: List[Contact] = []

    class Config:
        from_attributes = True
