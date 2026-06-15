import time
from fastapi import APIRouter, Depends, HTTPException, Header, Body
from sqlalchemy.orm import Session
from typing import List

import models, schemas
from database import get_db
from services.auth import jwt_encode, jwt_decode, hash_password, verify_password, log_audit

router = APIRouter()


@router.post("/auth/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="Senha não configurada. Use /auth/set-password.")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Senha incorreta")
    token = jwt_encode({"sub": user.id, "email": user.email, "role": user.role, "exp": time.time() + 86400 * 30})
    log_audit(db, "login", "user", user.id, user.name, actor=user.name, actor_email=user.email)
    return {"access_token": token, "user_id": user.id, "user_name": user.name, "user_email": user.email, "role": user.role}


@router.post("/auth/set-password")
def set_password(data: dict, db: Session = Depends(get_db)):
    """Allow setting a password for a user by email (used for initial setup)."""
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email e password obrigatórios")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.password_hash = hash_password(password)
    db.commit()
    return {"ok": True, "message": f"Senha definida para {user.name}"}


@router.get("/auth/me")
def get_me(authorization: str = Header(default=None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    payload = jwt_decode(authorization.replace("Bearer ", ""))
    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return {"user_id": user.id, "user_name": user.name, "user_email": user.email, "role": user.role}


@router.get("/users", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.User).offset(skip).limit(limit).all()


@router.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_data: schemas.UserBase, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name  = user_data.name
    user.email = user_data.email
    user.role  = user_data.role
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/role")
def assign_user_role(user_id: int, body: dict = Body(default={}), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role_id = body.get("role_id")
    db.commit()
    db.refresh(user)
    return user
