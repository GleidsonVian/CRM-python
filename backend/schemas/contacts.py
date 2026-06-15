from typing import Optional
from pydantic import BaseModel


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
