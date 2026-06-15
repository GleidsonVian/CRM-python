from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db
from services.auth import log_audit

router = APIRouter()


@router.get("/companies", response_model=List[schemas.Company])
def get_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).all()


@router.post("/companies", response_model=schemas.Company)
def create_company(company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    data = company.model_dump()
    contact_ids = data.pop('contact_ids', [])
    db_company = models.Company(**data)
    if contact_ids:
        db_company.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    c = db_company
    log_audit(db, "created", "company", c.id, c.name)
    return db_company


@router.get("/companies/{company_id}", response_model=schemas.Company)
def get_company(company_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c


@router.put("/companies/{company_id}", response_model=schemas.Company)
def update_company(company_id: int, company_data: schemas.CompanyCreate, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    data = company_data.model_dump()
    contact_ids = data.pop('contact_ids', [])
    for key, value in data.items():
        setattr(db_company, key, value)
    if contact_ids is not None:
        db_company.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    db.commit()
    db.refresh(db_company)
    return db_company


@router.delete("/companies/{company_id}", response_model=schemas.OkResponse)
def delete_company(company_id: int, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    company_name = db_company.name
    db.delete(db_company)
    db.commit()
    log_audit(db, "deleted", "company", company_id, company_name)
    return {"ok": True}
