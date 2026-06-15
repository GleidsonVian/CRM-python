from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import models, schemas
from database import get_db
from services.auth import log_audit

router = APIRouter()


@router.get("/contacts", response_model=List[schemas.Contact])
def get_contacts(
    q: Optional[str] = None, page: int = 1, limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(models.Contact)
    if q:
        q = q.strip()
        query = query.filter(
            models.Contact.first_name.ilike(f'%{q}%') |
            models.Contact.last_name.ilike(f'%{q}%') |
            models.Contact.email.ilike(f'%{q}%')
        )
    offset = (page - 1) * limit
    return query.order_by(models.Contact.id.desc()).offset(offset).limit(limit).all()


@router.post("/contacts", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.model_dump())
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
    for key, value in contact_data.model_dump().items():
        setattr(db_contact, key, value)
    db.commit()
    db.refresh(db_contact)
    contact = db_contact
    log_audit(db, "updated", "contact", contact_id, f"{contact.first_name} {contact.last_name or ''}".strip())
    return db_contact
