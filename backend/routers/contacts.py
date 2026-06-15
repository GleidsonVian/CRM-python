from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db
from services.auth import log_audit

router = APIRouter()


@router.get("/contacts", response_model=List[schemas.Contact])
def get_contacts(db: Session = Depends(get_db)):
    return db.query(models.Contact).all()


@router.post("/contacts", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    c = db_contact
    log_audit(db, "created", "contact", c.id, f"{c.first_name} {c.last_name or ''}".strip())
    return db_contact


@router.put("/contacts/{contact_id}", response_model=schemas.Contact)
def update_contact(contact_id: int, contact_data: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, value in contact_data.dict().items():
        setattr(db_contact, key, value)
    db.commit()
    db.refresh(db_contact)
    contact = db_contact
    log_audit(db, "updated", "contact", contact_id, f"{contact.first_name} {contact.last_name or ''}".strip())
    return db_contact
