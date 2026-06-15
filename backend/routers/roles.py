from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db

router = APIRouter()


@router.get("/roles", response_model=List[schemas.Role])
def get_roles(db: Session = Depends(get_db)):
    return db.query(models.Role).all()


@router.post("/roles", response_model=schemas.Role)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    db_role = models.Role(**role.dict())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role


@router.get("/roles/{role_id}", response_model=schemas.Role)
def get_role(role_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    return r


@router.put("/roles/{role_id}", response_model=schemas.Role)
def update_role(role_id: int, role: schemas.RoleCreate, db: Session = Depends(get_db)):
    r = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    for k, v in role.dict().items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/roles/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    db.query(models.User).filter(models.User.role_id == role_id).update({"role_id": None})
    db.delete(r)
    db.commit()
    return {"status": "ok"}


@router.get("/roles/{role_id}/members")
def get_role_members(role_id: int, db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.role_id == role_id).all()
