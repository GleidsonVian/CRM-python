from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File, Header, Body
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import json, re, os, shutil, time, secrets, threading
import base64, hashlib, hmac
from urllib import request as urllib_req
from urllib.request import urlopen
from urllib.error import URLError
from database import SessionLocal

import models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

# Safe column migrations (no-op if column already exists)
_MIGRATIONS = [
    "ALTER TABLE activities ADD COLUMN actor VARCHAR DEFAULT 'Usuário'",
    "ALTER TABLE custom_fields ADD COLUMN uid VARCHAR DEFAULT ''",
    "ALTER TABLE custom_fields ADD COLUMN show_on_card BOOLEAN DEFAULT 0",
    "ALTER TABLE activities ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
    "ALTER TABLE leads ADD COLUMN salutation VARCHAR",
    "ALTER TABLE leads ADD COLUMN first_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN last_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN middle_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN birth_date VARCHAR",
    "ALTER TABLE leads ADD COLUMN position VARCHAR",
    "ALTER TABLE leads ADD COLUMN company_name VARCHAR",
    "ALTER TABLE leads ADD COLUMN phone VARCHAR",
    "ALTER TABLE leads ADD COLUMN email VARCHAR",
    "ALTER TABLE leads ADD COLUMN website VARCHAR",
    "ALTER TABLE leads ADD COLUMN source_info VARCHAR",
    "ALTER TABLE leads ADD COLUMN available_to_all BOOLEAN DEFAULT 1",
    "ALTER TABLE leads ADD COLUMN address VARCHAR",
    "ALTER TABLE leads ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE leads ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE leads ADD COLUMN utm_campaign VARCHAR",
    "ALTER TABLE leads ADD COLUMN comment VARCHAR",
    "ALTER TABLE contacts ADD COLUMN salutation VARCHAR",
    "ALTER TABLE contacts ADD COLUMN middle_name VARCHAR",
    "ALTER TABLE contacts ADD COLUMN position VARCHAR",
    "ALTER TABLE contacts ADD COLUMN website VARCHAR",
    "ALTER TABLE contacts ADD COLUMN messenger VARCHAR",
    "ALTER TABLE contacts ADD COLUMN company_name VARCHAR",
    "ALTER TABLE contacts ADD COLUMN source VARCHAR",
    "ALTER TABLE contacts ADD COLUMN source_info VARCHAR",
    "ALTER TABLE contacts ADD COLUMN available_to_all BOOLEAN DEFAULT 1",
    "ALTER TABLE contacts ADD COLUMN included_in_export BOOLEAN DEFAULT 1",
    "ALTER TABLE contacts ADD COLUMN contact_type VARCHAR",
    "ALTER TABLE contacts ADD COLUMN observers VARCHAR",
    "ALTER TABLE contacts ADD COLUMN comment VARCHAR",
    "ALTER TABLE contacts ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE contacts ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE contacts ADD COLUMN utm_campaign VARCHAR",
    "ALTER TABLE contacts ADD COLUMN photo_url VARCHAR",
    "ALTER TABLE contacts ADD COLUMN responsible_user_id INTEGER REFERENCES users(id)",
    "ALTER TABLE cards ADD COLUMN updated_at DATETIME",
    "ALTER TABLE cards ADD COLUMN stage_changed_by VARCHAR",
    "ALTER TABLE cards ADD COLUMN source VARCHAR",
    "ALTER TABLE cards ADD COLUMN source_info VARCHAR",
    "ALTER TABLE cards ADD COLUMN deal_type VARCHAR",
    "ALTER TABLE cards ADD COLUMN start_date VARCHAR",
    "ALTER TABLE cards ADD COLUMN available_to_all BOOLEAN DEFAULT 1",
    "ALTER TABLE cards ADD COLUMN responsible_user_id INTEGER REFERENCES users(id)",
    "ALTER TABLE cards ADD COLUMN observers VARCHAR",
    "ALTER TABLE cards ADD COLUMN comment VARCHAR",
    "ALTER TABLE cards ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE cards ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE cards ADD COLUMN utm_campaign VARCHAR",
    # Companies table is created by SQLAlchemy; junction is also auto-created
    # These are safe no-ops for columns that might not exist yet on older DBs:
    "ALTER TABLE companies ADD COLUMN utm_source VARCHAR",
    "ALTER TABLE companies ADD COLUMN utm_medium VARCHAR",
    "ALTER TABLE companies ADD COLUMN utm_campaign VARCHAR",
    "ALTER TABLE companies ADD COLUMN last_contact_at DATETIME",
    "ALTER TABLE users ADD COLUMN password_hash VARCHAR",
    "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1",
    "ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL",
    """CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR NOT NULL,
        description VARCHAR DEFAULT '',
        color VARCHAR DEFAULT '#6366f1',
        permissions VARCHAR DEFAULT '{}',
        created_at DATETIME DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action VARCHAR NOT NULL,
    entity_type VARCHAR NOT NULL,
    entity_id INTEGER,
    entity_name VARCHAR,
    actor VARCHAR NOT NULL DEFAULT 'Sistema',
    actor_email VARCHAR,
    details VARCHAR,
    ip_address VARCHAR,
    created_at DATETIME DEFAULT (datetime('now'))
)""",
    """CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event VARCHAR,
    status_code INTEGER,
    response_body VARCHAR,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT 0,
    error_message VARCHAR,
    created_at DATETIME DEFAULT (datetime('now'))
)""",
    "CREATE TABLE IF NOT EXISTS stage_required_fields (id INTEGER PRIMARY KEY AUTOINCREMENT, stage_id INTEGER REFERENCES stages(id) ON DELETE CASCADE, field_type VARCHAR, field_key VARCHAR, custom_field_id INTEGER REFERENCES custom_fields(id) ON DELETE CASCADE)",
    "ALTER TABLE automation_rules ADD COLUMN entity_type VARCHAR DEFAULT 'deal'",
    """CREATE TABLE IF NOT EXISTS workflow_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR,
        description VARCHAR DEFAULT '',
        entity_type VARCHAR DEFAULT 'deal',
        pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now'))
    )""",
    """CREATE TABLE IF NOT EXISTS workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER REFERENCES workflow_templates(id) ON DELETE CASCADE,
        step_order INTEGER DEFAULT 0,
        action_type VARCHAR,
        action_config VARCHAR DEFAULT '{}'
    )""",
    """CREATE TABLE IF NOT EXISTS workflow_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER REFERENCES workflow_templates(id) ON DELETE SET NULL,
        template_name VARCHAR DEFAULT '',
        card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
        executed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        executed_by_name VARCHAR DEFAULT '',
        executed_at DATETIME DEFAULT (datetime('now')),
        status VARCHAR DEFAULT 'completed',
        result_log VARCHAR DEFAULT '[]'
    )""",
]
with engine.connect() as _conn:
    for _sql in _MIGRATIONS:
        try:
            _conn.execute(text(_sql))
            _conn.commit()
        except Exception:
            pass

# UID prefix map per entity
_UID_PREFIXES = {'deal': 'NGS', 'lead': 'LDC', 'contact': 'CTT', 'user': 'EQP', 'company': 'EMP'}

def _generate_uid(entity: str, db) -> str:
    prefix = _UID_PREFIXES.get(entity, 'FLD')
    existing = db.query(models.CustomField).filter(models.CustomField.entity == entity).all()
    used = set()
    for f in existing:
        if f.uid and f.uid.startswith(prefix + '-'):
            try: used.add(int(f.uid.split('-')[1]))
            except (IndexError, ValueError): pass
    n = 1
    while n in used:
        n += 1
    return f"{prefix}-{n:03d}"

# ── JWT helpers (stdlib only) ─────────────────────────────────────────────────

_JWT_SECRET = os.environ.get("JWT_SECRET", "nexus-crm-dev-secret-change-in-prod")
_JWT_ALGO   = "HS256"

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def jwt_encode(payload: dict) -> str:
    header  = _b64url(json.dumps({"alg": _JWT_ALGO, "typ": "JWT"}).encode())
    body    = _b64url(json.dumps(payload).encode())
    sig     = _b64url(hmac.new(_JWT_SECRET.encode(), msg=f"{header}.{body}".encode(), digestmod=hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def jwt_decode(token: str) -> dict:
    try:
        header, body, sig = token.split(".")
        expected = _b64url(hmac.new(_JWT_SECRET.encode(), msg=f"{header}.{body}".encode(), digestmod=hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < time.time():
            raise ValueError("expired")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

def hash_password(pw: str) -> str:
    salt = "nexus-salt"
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()

def verify_password(pw: str, hashed: str) -> bool:
    return hash_password(pw) == hashed

def log_audit(db, action: str, entity_type: str, entity_id=None, entity_name=None, actor="Sistema", actor_email=None, details=None):
    try:
        entry = models.AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            actor=actor,
            actor_email=actor_email,
            details=json.dumps(details) if details else None,
        )
        db.add(entry)
        db.commit()
    except Exception:
        pass  # audit log must never break normal flow

# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI()

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_default_negocios_stages(db: Session, pipeline_id: int):
    stages = [
        {"name": "Em Desenvolvimento",   "color": "#3b82f6"},
        {"name": "Criar documentos",     "color": "#8b5cf6"},
        {"name": "Fatura",               "color": "#f59e0b"},
        {"name": "Em andamento",         "color": "#06b6d4"},
        {"name": "Fatura final",         "color": "#f97316"},
        {"name": "Negócios Fechados",    "color": "#22c55e"},
        {"name": "Negócios Perdidos",    "color": "#ef4444"},
        {"name": "Analisar falha",       "color": "#dc2626"},
    ]
    for i, stg in enumerate(stages):
        db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=pipeline_id))
    db.commit()

# ---- Inicialização de Dados Padrão ----
@app.on_event("startup")
def startup_event():
    db = next(get_db())

    DEFAULT_LEADS_STAGES = [
        {"name": "Não atribuído",   "color": "#06b6d4"},
        {"name": "Em andamento",    "color": "#06b6d4"},
        {"name": "Processado",      "color": "#06b6d4"},
        {"name": "Lead descartado", "color": "#ef4444"},
        {"name": "Lead convertido", "color": "#22c55e"},
    ]

    p_leads = db.query(models.Pipeline).filter(models.Pipeline.name == "Leads").first()
    if not p_leads:
        p_leads = models.Pipeline(name="Leads")
        db.add(p_leads)
        db.commit()
    # Garantir etapas mesmo em bancos antigos
    existing_leads_stages = db.query(models.Stage).filter(models.Stage.pipeline_id == p_leads.id).count()
    if existing_leads_stages == 0:
        for i, stg in enumerate(DEFAULT_LEADS_STAGES):
            db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=p_leads.id))
        db.commit()

    p_negocios = db.query(models.Pipeline).filter(models.Pipeline.name == "Negócios").first()
    if not p_negocios:
        p_negocios = models.Pipeline(name="Negócios")
        db.add(p_negocios)
        db.commit()
    # Garantir etapas mesmo em bancos antigos
    existing_neg_stages = db.query(models.Stage).filter(models.Stage.pipeline_id == p_negocios.id).count()
    if existing_neg_stages == 0:
        create_default_negocios_stages(db, p_negocios.id)

    # ── Default admin user ────────────────────────────────────────────────────
    admin = db.query(models.User).filter(models.User.email == "admin@nexus.com").first()
    if not admin:
        admin = models.User(
            name="Admin",
            email="admin@nexus.com",
            role="admin",
            password_hash=hash_password("admin123"),
            is_active=True,
        )
        db.add(admin)
        db.commit()

    def _ep(read="all", add="all", edit="all", delete="all", export="all", imp="all", move="any", price="show", auto="edit"):
        return {"read": read, "add": add, "edit": edit, "delete": delete, "export": export, "import": imp, "move_stage": move, "view_price": price, "automations": auto}

    def _ep_simple(read="all", add="all", edit="all", delete="all", export="all", imp="all"):
        return {"read": read, "add": add, "edit": edit, "delete": delete, "export": export, "import": imp}

    _DEFAULT_ROLES = [
        {
            "name": "Administrador",
            "description": "Acesso total ao sistema",
            "color": "#ef4444",
            "permissions": json.dumps({
                "entities": {
                    "contact": _ep_simple(),
                    "company": _ep_simple(),
                    "lead":    _ep(),
                    "deal":    _ep(),
                },
                "system": {"manage_pipelines": True, "manage_users": True, "view_reports": True, "manage_settings": True},
            }),
        },
        {
            "name": "Gerente",
            "description": "Visualiza todos os cards, não gerencia estrutura",
            "color": "#f59e0b",
            "permissions": json.dumps({
                "entities": {
                    "contact": _ep_simple(),
                    "company": _ep_simple(),
                    "lead":    _ep(delete="deny", export="all", auto="read"),
                    "deal":    _ep(delete="deny", export="all", auto="read"),
                },
                "system": {"manage_pipelines": False, "manage_users": False, "view_reports": True, "manage_settings": False},
            }),
        },
        {
            "name": "Vendedor",
            "description": "Vê e edita apenas os próprios cards",
            "color": "#10b981",
            "permissions": json.dumps({
                "entities": {
                    "contact": _ep_simple(read="own", add="all", edit="own", delete="deny", export="deny", imp="deny"),
                    "company": _ep_simple(read="own", add="deny", edit="own", delete="deny", export="deny", imp="deny"),
                    "lead":    _ep(read="own", add="all", edit="own", delete="deny", export="deny", imp="deny", move="any", price="show", auto="deny"),
                    "deal":    _ep(read="own", add="all", edit="own", delete="deny", export="deny", imp="deny", move="any", price="show", auto="deny"),
                },
                "system": {"manage_pipelines": False, "manage_users": False, "view_reports": False, "manage_settings": False},
            }),
        },
    ]
    for rd in _DEFAULT_ROLES:
        exists = db.query(models.Role).filter(models.Role.name == rd["name"]).first()
        if not exists:
            db.add(models.Role(**rd))
    db.commit()

# ---- Rotas Roles ----
@app.get("/roles", response_model=List[schemas.Role])
def get_roles(db: Session = Depends(get_db)):
    return db.query(models.Role).all()

@app.post("/roles", response_model=schemas.Role)
def create_role(role: schemas.RoleCreate, db: Session = Depends(get_db)):
    db_role = models.Role(**role.dict())
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

@app.get("/roles/{role_id}", response_model=schemas.Role)
def get_role(role_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    return r

@app.put("/roles/{role_id}", response_model=schemas.Role)
def update_role(role_id: int, role: schemas.RoleCreate, db: Session = Depends(get_db)):
    r = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    for k, v in role.dict().items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r

@app.delete("/roles/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Role not found")
    # Unassign users
    db.query(models.User).filter(models.User.role_id == role_id).update({"role_id": None})
    db.delete(r)
    db.commit()
    return {"status": "ok"}

@app.get("/roles/{role_id}/members")
def get_role_members(role_id: int, db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.role_id == role_id).all()

@app.put("/users/{user_id}/role")
def assign_user_role(user_id: int, body: dict = Body(default={}), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role_id = body.get("role_id")  # None to unassign
    db.commit()
    db.refresh(user)
    return user

# ---- Rotas Pipelines ----
@app.get("/pipelines", response_model=List[schemas.Pipeline])
def get_pipelines(db: Session = Depends(get_db)):
    return db.query(models.Pipeline).all()

@app.post("/pipelines", response_model=schemas.Pipeline)
def create_pipeline(pipeline: schemas.PipelineCreate, db: Session = Depends(get_db)):
    if pipeline.name in ("Leads", "Negócios"):
        raise HTTPException(status_code=400, detail="Não é permitido criar funis com o nome 'Leads' ou 'Negócios'.")
    db_pipe = models.Pipeline(name=pipeline.name)
    db.add(db_pipe)
    db.commit()
    db.refresh(db_pipe)
    create_default_negocios_stages(db, db_pipe.id)
    return db_pipe

@app.put("/pipelines/{pipe_id}", response_model=schemas.Pipeline)
def update_pipeline(pipe_id: int, pipeline_data: schemas.PipelineCreate, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    # Não permitir renomear os padrões para evitar quebra de lógica
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido renomear os funis padrão.")
    pipe.name = pipeline_data.name
    db.commit()
    db.refresh(pipe)
    return pipe

@app.delete("/pipelines/{pipe_id}")
def delete_pipeline(pipe_id: int, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido excluir os funis padrão (Leads e Negócios).")
    
    db.delete(pipe)
    db.commit()
    return {"status": "ok"}

# ---- Rotas Stages ----
@app.get("/stages", response_model=List[schemas.Stage])
def get_stages(pipeline_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Stage)
    if pipeline_id:
        query = query.filter(models.Stage.pipeline_id == pipeline_id)
    return query.order_by(models.Stage.order).all()

@app.post("/stages", response_model=schemas.Stage)
def create_stage(stage: schemas.StageCreate, db: Session = Depends(get_db)):
    db_stage = models.Stage(**stage.dict())
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/stages/{stage_id}", response_model=schemas.Stage)
def update_stage(stage_id: int, stage_data: schemas.StageCreate, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    stg.name = stage_data.name
    stg.color = stage_data.color
    stg.order = stage_data.order
    db.commit()
    db.refresh(stg)
    return stg

@app.delete("/stages/{stage_id}")
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    db.delete(stg)
    db.commit()
    return {"ok": True}

@app.get("/stages/{stage_id}/required-fields")
def get_stage_required_fields(stage_id: int, db: Session = Depends(get_db)):
    reqs = db.query(models.StageRequiredField).filter(
        models.StageRequiredField.stage_id == stage_id
    ).all()
    result = []
    for r in reqs:
        item = {"id": r.id, "field_type": r.field_type, "field_key": r.field_key, "custom_field_id": r.custom_field_id}
        if r.field_type == 'custom' and r.custom_field_id:
            cf = db.query(models.CustomField).filter(models.CustomField.id == r.custom_field_id).first()
            item["label"] = cf.name if cf else f"Campo #{r.custom_field_id}"
        else:
            item["label"] = BUILTIN_FIELD_LABELS.get(r.field_key, r.field_key)
        result.append(item)
    return result

@app.put("/stages/{stage_id}/required-fields")
def set_stage_required_fields(stage_id: int, fields: list = Body(...), db: Session = Depends(get_db)):
    """Replace all required fields for a stage. fields = [{field_type, field_key?, custom_field_id?}]"""
    db.query(models.StageRequiredField).filter(
        models.StageRequiredField.stage_id == stage_id
    ).delete()
    for f in fields:
        db.add(models.StageRequiredField(
            stage_id=stage_id,
            field_type=f.get('field_type'),
            field_key=f.get('field_key'),
            custom_field_id=f.get('custom_field_id'),
        ))
    db.commit()
    return {"ok": True}

# ---- Rotas Contacts ----
@app.get("/contacts", response_model=List[schemas.Contact])
def get_contacts(db: Session = Depends(get_db)):
    return db.query(models.Contact).all()

@app.post("/contacts", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    c = db_contact
    log_audit(db, "created", "contact", c.id, f"{c.first_name} {c.last_name or ''}".strip())
    return db_contact

@app.put("/contacts/{contact_id}", response_model=schemas.Contact)
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

# ---- Rotas Companies ----

@app.get("/companies", response_model=List[schemas.Company])
def get_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).all()

@app.post("/companies", response_model=schemas.Company)
def create_company(company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    data = company.dict()
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

@app.get("/companies/{company_id}", response_model=schemas.Company)
def get_company(company_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    return c

@app.put("/companies/{company_id}", response_model=schemas.Company)
def update_company(company_id: int, company_data: schemas.CompanyCreate, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    data = company_data.dict()
    contact_ids = data.pop('contact_ids', [])
    for key, value in data.items():
        setattr(db_company, key, value)
    if contact_ids is not None:
        db_company.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    db.commit()
    db.refresh(db_company)
    return db_company

@app.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    company_name = db_company.name
    db.delete(db_company)
    db.commit()
    log_audit(db, "deleted", "company", company_id, company_name)
    return {"ok": True}

# ---- Webhooks ----
from datetime import datetime, timezone
from fastapi import Request as FastAPIRequest
import urllib.request as _urllib_req2
import urllib.error as _urllib_err2
import urllib.parse as _urllib_parse
import httpx as _httpx

ENTITY_ENDPOINT_MAP = {
    "cards":     ["/cards", "/cards/{id}", "/cards/{id}/move", "/cards/{id}/activities"],
    "leads":     ["/leads", "/leads/{id}", "/leads/{id}/move", "/leads/{id}/convert", "/leads/{id}/activities"],
    "contacts":  ["/contacts", "/contacts/{id}"],
    "companies": ["/companies", "/companies/{id}"],
}

ALL_EVENTS = [
    "card.created", "card.updated", "card.moved", "card.deleted",
    "lead.created", "lead.updated", "lead.moved", "lead.converted", "lead.deleted",
    "contact.created", "contact.updated",
    "company.created", "company.updated",
]

def _fire_outbound_webhooks(event: str, entity: str, payload: dict):
    """Fire outbound webhooks in background thread — non-blocking."""
    def _worker():
        with SessionLocal() as db:
            hooks = db.query(models.Webhook).filter(
                models.Webhook.type == 'outbound',
                models.Webhook.active == True,
                models.Webhook.url != None,
            ).all()
            for h in hooks:
                try:
                    allowed_entities = json.loads(h.allowed_entities or '[]')
                    events = json.loads(h.events or '[]')
                    if allowed_entities and entity not in allowed_entities:
                        continue
                    if events and event not in events:
                        continue
                    body = json.dumps({
                        "event": event,
                        "entity": entity,
                        "data": payload,
                        "webhook_token": h.token,
                    }).encode()
                    req = _urllib_req2.Request(
                        h.url,
                        data=body,
                        headers={"Content-Type": "application/json", "X-Webhook-Token": h.token},
                        method="POST",
                    )
                    _urllib_req2.urlopen(req, timeout=5)
                except Exception:
                    pass
    threading.Thread(target=_worker, daemon=True).start()

@app.get("/webhooks", response_model=List[schemas.Webhook])
def get_webhooks(db: Session = Depends(get_db)):
    return db.query(models.Webhook).order_by(models.Webhook.id.desc()).all()

@app.post("/webhooks", response_model=schemas.Webhook)
def create_webhook(wh: schemas.WebhookCreate, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(32)
    db_wh = models.Webhook(**wh.dict(), token=token)
    db.add(db_wh)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@app.put("/webhooks/{wh_id}", response_model=schemas.Webhook)
def update_webhook(wh_id: int, wh: schemas.WebhookCreate, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    for k, v in wh.dict().items():
        setattr(db_wh, k, v)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@app.delete("/webhooks/{wh_id}")
def delete_webhook(wh_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(db_wh)
    db.commit()
    return {"ok": True}

@app.post("/webhooks/{wh_id}/regenerate-token", response_model=schemas.Webhook)
def regenerate_token(wh_id: int, db: Session = Depends(get_db)):
    db_wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db_wh.token = secrets.token_urlsafe(32)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@app.post("/webhooks/{wh_id}/test")
def test_webhook(wh_id: int, db: Session = Depends(get_db)):
    wh = db.query(models.Webhook).filter(models.Webhook.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook não encontrado")
    if wh.type != 'outbound':
        raise HTTPException(status_code=400, detail="Apenas webhooks de saída podem ser testados")
    if not wh.url:
        raise HTTPException(status_code=400, detail="URL não configurada")

    import urllib.request as _test_urllib
    import urllib.error as _test_urlerr
    import time as _time

    payload = {
        "event": "test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "webhook_id": wh.id,
        "data": {"message": "Este é um disparo de teste do Nexus CRM"}
    }
    payload_bytes = json.dumps(payload).encode()
    req = _test_urllib.Request(
        wh.url,
        data=payload_bytes,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = _time.monotonic()
    status_code = None
    response_body = None
    success = False
    error_message = None
    try:
        with _test_urllib.urlopen(req, timeout=10) as resp:
            status_code = resp.status
            response_body = resp.read(500).decode(errors='replace')
            success = 200 <= status_code < 300
    except _test_urlerr.HTTPError as e:
        status_code = e.code
        error_message = str(e)
    except Exception as e:
        error_message = str(e)[:300]

    latency_ms = int((_time.monotonic() - start) * 1000)
    log = models.WebhookLog(
        webhook_id=wh.id, event="test",
        status_code=status_code, response_body=response_body,
        latency_ms=latency_ms, success=success, error_message=error_message,
    )
    db.add(log)
    db.commit()
    return {"success": success, "status_code": status_code, "latency_ms": latency_ms, "error": error_message}

@app.get("/webhooks/{wh_id}/logs")
def get_webhook_logs(wh_id: int, limit: int = 20, db: Session = Depends(get_db)):
    logs = (
        db.query(models.WebhookLog)
        .filter(models.WebhookLog.webhook_id == wh_id)
        .order_by(models.WebhookLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "event": l.event,
            "status_code": l.status_code,
            "latency_ms": l.latency_ms,
            "success": l.success,
            "error_message": l.error_message,
            "response_body": l.response_body,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

async def _inbound_handler(token: str, entity: str, request: FastAPIRequest, db: Session, path: str = ""):
    """Inbound proxy: validates token permissions and forwards to internal endpoint."""
    db_wh = db.query(models.Webhook).filter(
        models.Webhook.token == token,
        models.Webhook.type == 'inbound',
        models.Webhook.active == True,
    ).first()
    if not db_wh:
        raise HTTPException(status_code=403, detail="Token inválido ou webhook inativo")

    allowed_entities = json.loads(db_wh.allowed_entities or '[]')
    if allowed_entities and entity not in allowed_entities:
        raise HTTPException(status_code=403, detail=f"Acesso à entidade '{entity}' não permitido para este webhook")

    allowed_methods = json.loads(db_wh.allowed_methods or '["POST"]')
    if request.method not in allowed_methods:
        raise HTTPException(status_code=405, detail=f"Método '{request.method}' não permitido para este webhook")

    try:
        body_bytes = await request.body()
        payload = json.loads(body_bytes) if body_bytes else {}
    except Exception:
        payload = {}

    base = str(request.base_url).rstrip('/')
    sub = f"/{path}" if path else ""
    qs = f"?{request.url.query}" if request.url.query else ""
    target_url = f"{base}/{entity}{sub}{qs}"

    try:
        async with _httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(
                method=request.method,
                url=target_url,
                json=payload if payload else None,
                headers={"Content-Type": "application/json"},
            )
        try:
            result = resp.json()
        except Exception:
            result = resp.text

        if resp.status_code >= 400:
            detail = result.get("detail", result) if isinstance(result, dict) else result
            raise HTTPException(status_code=resp.status_code, detail=detail)

        return {"ok": True, "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao processar requisição interna: {type(e).__name__}: {str(e)}")

@app.api_route("/webhook/in/{token}/{entity}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def inbound_webhook(token: str, entity: str, request: FastAPIRequest, db: Session = Depends(get_db)):
    return await _inbound_handler(token, entity, request, db)

@app.api_route("/webhook/in/{token}/{entity}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def inbound_webhook_sub(token: str, entity: str, path: str, request: FastAPIRequest, db: Session = Depends(get_db)):
    return await _inbound_handler(token, entity, request, db, path)

@app.get("/webhooks/meta/entities")
def get_entities_meta():
    return {
        "entities": list(ENTITY_ENDPOINT_MAP.keys()),
        "entity_endpoints": ENTITY_ENDPOINT_MAP,
        "events": ALL_EVENTS,
    }

# ---- Rotas Cards ----

def _sync_relations(card, contact_ids, user_ids, db):
    if contact_ids is not None:
        card.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    if user_ids is not None:
        card.users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()

def _attach_custom_fields(entity_type: str, entity_ids: list, db: Session) -> dict:
    """Returns {entity_id: {field_key: value}} for all given IDs."""
    if not entity_ids:
        return {}
    values = (
        db.query(models.CustomFieldValue, models.CustomField)
        .join(models.CustomField, models.CustomFieldValue.field_id == models.CustomField.id)
        .filter(
            models.CustomFieldValue.entity_id.in_(entity_ids),
            models.CustomField.entity == entity_type,
        )
        .all()
    )
    result = {}
    for cfv, cf in values:
        result.setdefault(cfv.entity_id, {})[cf.key] = cfv.value
    return result

def _with_cf(obj, entity_type: str, db: Session):
    """Attach custom_fields dict to a single ORM object and return it."""
    cf_map = _attach_custom_fields(entity_type, [obj.id], db)
    obj.custom_fields = cf_map.get(obj.id, {})
    return obj

def _list_with_cf(objs, entity_type: str, db: Session):
    """Attach custom_fields dict to a list of ORM objects and return them."""
    ids = [o.id for o in objs]
    cf_map = _attach_custom_fields(entity_type, ids, db)
    for o in objs:
        o.custom_fields = cf_map.get(o.id, {})
    return objs

def _get_user_permissions(authorization: Optional[str], db) -> dict:
    """Returns the permissions dict for the current user, or {} if not authenticated."""
    if not authorization or not authorization.startswith("Bearer "):
        return {}
    try:
        payload = jwt_decode(authorization.replace("Bearer ", ""))
        user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
        if user and user.role_id:
            role = db.query(models.Role).filter(models.Role.id == user.role_id).first()
            if role:
                raw = json.loads(role.permissions or '{}')
                # Support both legacy flat format and new entity-based format
                if "entities" in raw:
                    return {"user_id": user.id, "_format": "v2", **raw}
                else:
                    return {"user_id": user.id, "_format": "v1", **raw}
    except Exception:
        pass
    return {}

def _resolve_read_scope(perms: dict, entity: str) -> str:
    """Returns 'own', 'all', or 'deny' for a given entity's read permission."""
    if not perms:
        return "all"
    fmt = perms.get("_format", "v1")
    if fmt == "v2":
        return perms.get("entities", {}).get(entity, {}).get("read", "all")
    else:
        # Legacy v1: view_scope applies to both deal and lead
        vs = perms.get("view_scope", "all")
        if entity in ("deal", "lead"):
            return vs if vs in ("own", "all", "deny") else "all"
        return "all"

@app.get("/cards", response_model=List[schemas.Card])
def get_cards(
    pipeline_id: int = None, stage_id: int = None,
    contact_id: int = None, user_id: int = None,
    q: Optional[str] = None, limit: int = 50,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db)
):
    perms = _get_user_permissions(authorization, db)
    query = db.query(models.Card)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    if stage_id:
        query = query.filter(models.Card.stage_id == stage_id)
    if contact_id:
        query = query.filter(models.Card.contacts.any(models.Contact.id == contact_id))
    if user_id:
        query = query.filter(models.Card.users.any(models.User.id == user_id))
    # Enforce read scope for deals
    read_scope = _resolve_read_scope(perms, "deal")
    if read_scope == "deny":
        return []
    if read_scope == "own" and perms.get("user_id"):
        uid = perms["user_id"]
        query = query.filter(
            models.Card.users.any(models.User.id == uid) |
            (models.Card.responsible_user_id == uid)
        )
    # Enforce pipeline_ids restriction
    if perms.get("pipeline_ids") and pipeline_id is None:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id.in_(perms["pipeline_ids"]))
    if q:
        q = q.strip()
        if q.startswith('#'):
            try:
                query = query.filter(models.Card.id == int(q[1:]))
            except ValueError:
                pass
        else:
            query = query.filter(models.Card.title.ilike(f'%{q}%'))
    return _list_with_cf(query.order_by(models.Card.id.desc()).limit(limit).all(), 'deal', db)

@app.post("/cards", response_model=schemas.Card)
def create_card(card: schemas.CardCreate, db: Session = Depends(get_db)):
    data = card.dict(exclude_unset=True)
    contact_ids = data.pop("contact_ids", [])
    user_ids = data.pop("user_ids", [])
    custom_fields_input = data.pop("custom_fields", None) or {}
    if not data.get("created_at"):
        data["created_at"] = datetime.now(timezone.utc)
    db_card = models.Card(**data)
    db.add(db_card)
    db.flush()
    _sync_relations(db_card, contact_ids, user_ids, db)

    # Save custom field values — accepts key (e.g. "cnpj") or id (e.g. "3" or 3)
    for field_ref, value in custom_fields_input.items():
        field_ref_str = str(field_ref)
        if field_ref_str.isdigit():
            cf = db.query(models.CustomField).filter(
                models.CustomField.id == int(field_ref_str),
                models.CustomField.entity == 'deal'
            ).first()
        else:
            cf = db.query(models.CustomField).filter(
                models.CustomField.key == field_ref_str,
                models.CustomField.entity == 'deal'
            ).first()
        if cf:
            db.add(models.CustomFieldValue(field_id=cf.id, entity_id=db_card.id, value=str(value)))

    db.add(models.Activity(card_id=db_card.id, type='created', content='Negócio criado', actor='Usuário'))
    db.commit()
    db.refresh(db_card)
    log_audit(db, "created", "card", db_card.id, db_card.title)
    _fire_outbound_webhooks("card.created", "cards", {"id": db_card.id, "title": db_card.title, "stage_id": db_card.stage_id})
    return db_card

@app.get("/cards/{card_id}", response_model=schemas.Card)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return _with_cf(card, 'deal', db)

@app.delete("/cards/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    card_title = card.title
    db.delete(card)
    db.commit()
    log_audit(db, "deleted", "card", card_id, card_title)
    return {"message": "Card deleted successfully"}

# ---- USERS ----
@app.get("/users", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@app.post("/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_data: schemas.UserBase, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = user_data.name
    user.email = user_data.email
    user.role = user_data.role
    db.commit()
    db.refresh(user)
    return user

# ---- AUTOMATIONS ----
def _render_vars(template: str, vars: dict) -> str:
    return re.sub(r'\{\{\s*([^}]+?)\s*\}\}', lambda m: str(vars.get(m.group(1).strip(), '')), template)

def _build_vars(card, db) -> dict:
    contact = card.contacts[0] if card.contacts else None
    stage = db.query(models.Stage).filter(models.Stage.id == card.stage_id).first()
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first() if stage else None
    return {
        'deal.title': card.title or '',
        'deal.price': str(card.price or 0),
        'deal.id': str(card.id),
        'deal.description': card.description or '',
        'contact.name': f"{contact.first_name} {contact.last_name or ''}".strip() if contact else '',
        'contact.email': contact.email or '' if contact else '',
        'contact.phone': contact.phone or '' if contact else '',
        'stage.name': stage.name if stage else '',
        'pipeline.name': pipeline.name if pipeline else '',
    }

def _evaluate_structured_condition(cond: dict, vars: dict, card) -> bool:
    field    = cond.get('field', '')
    operator = cond.get('operator', '==')
    value    = str(cond.get('value', ''))

    # Resolve actual value from card/vars
    if field == 'deal.price':
        actual = str(card.price or 0) if card else vars.get('deal.price', '0')
    elif field == 'deal.title':
        actual = (card.title or '') if card else vars.get('deal.title', '')
    elif field == 'deal.description':
        actual = (card.description or '') if card else vars.get('deal.description', '')
    elif field == 'deal.stage_id':
        actual = str(card.stage_id) if card else ''
        stage_id = cond.get('stage_id')
        if stage_id is not None:
            value = str(stage_id)
    else:
        actual = vars.get(field, '')

    # Evaluate
    if operator in ('>', '<', '>=', '<=', '==', '!='):
        try:
            l, r = float(actual), float(value)
            return eval(f"{l} {operator} {r}")
        except (ValueError, TypeError):
            if operator == '==': return actual.lower() == value.lower()
            if operator == '!=': return actual.lower() != value.lower()
            return False
    elif operator == 'contains':
        return value.lower() in actual.lower()
    elif operator == '!contains':
        return value.lower() not in actual.lower()
    return False

def _evaluate_condition(condition: str, vars: dict, card=None) -> bool:
    if not condition:
        return True
    # Try structured JSON format first
    try:
        cond = json.loads(condition)
        if isinstance(cond, dict) and 'field' in cond:
            return _evaluate_structured_condition(cond, vars, card)
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    # Legacy raw string fallback
    rendered = _render_vars(condition, vars)
    if 'contains' in condition.lower():
        left_rendered = _render_vars(condition[:condition.lower().find('contains')].strip(), vars).lower()
        right_rendered = _render_vars(condition[condition.lower().find('contains') + 8:].strip().strip('"\''), vars).lower()
        return right_rendered in left_rendered
    for op in ['>=', '<=', '!=', '>', '<', '==']:
        if op in rendered:
            parts = rendered.split(op, 1)
            left, right = parts[0].strip(), parts[1].strip()
            try:
                l, r = float(left), float(right)
                return eval(f"{l} {op} {r}")
            except ValueError:
                if op == '==': return left == right
                if op == '!=': return left != right
    return bool(rendered.strip())

def _run_action(step_type: str, cfg: dict, vars: dict, card, db):
    if step_type == 'webhook':
        url = _render_vars(cfg.get('url', ''), vars)
        if url:
            payload = _render_vars(cfg.get('payload', '{}'), vars)
            method = cfg.get('method', 'POST').upper()
            try:
                body = payload.encode('utf-8') if method in ('POST', 'PUT', 'PATCH') else None
                req = urllib_req.Request(url, data=body, headers={'Content-Type': 'application/json'}, method=method)
                urllib_req.urlopen(req, timeout=10)
            except Exception:
                pass
            log_activity(db, card.id, 'webhook', f'Webhook {method} disparado para {url}', actor='Automação')

    elif step_type == 'assign_user':
        uid = cfg.get('user_id')
        if uid:
            user = db.query(models.User).filter(models.User.id == int(uid)).first()
            if user and user not in card.users:
                card.users.append(user)
                db.commit()
                log_activity(db, card.id, 'user_assigned', f'Responsável {user.name} atribuído', actor='Automação')

    elif step_type == 'add_note':
        content = _render_vars(cfg.get('content', ''), vars)
        if content:
            db.add(models.Activity(card_id=card.id, type='auto_note', content=content, actor='Automação'))
            db.commit()

    elif step_type == 'set_price':
        price = cfg.get('price')
        if price not in (None, ''):
            old = card.price or 0
            card.price = float(price)
            db.commit()
            log_activity(db, card.id, 'price_changed',
                f'Valor alterado de R$ {old:.2f} para R$ {float(price):.2f}', actor='Automação')

    elif step_type == 'set_field':
        field = cfg.get('field', '')
        if field == 'deal.title':
            val = _render_vars(str(cfg.get('value', '')), vars)
            if val:
                old = card.title
                card.title = val
                db.commit()
                log_activity(db, card.id, 'title_changed',
                    f'Título alterado para "{val}"', actor='Automação')
        elif field == 'deal.price':
            val = _render_vars(str(cfg.get('value', '')), vars)
            try:
                old = card.price or 0
                card.price = float(val)
                db.commit()
                log_activity(db, card.id, 'price_changed',
                    f'Valor alterado de R$ {old:.2f} para R$ {float(val):.2f}', actor='Automação')
            except (ValueError, TypeError):
                pass
        elif field == 'deal.description':
            val = _render_vars(str(cfg.get('value', '')), vars)
            card.description = val
            db.commit()
            log_activity(db, card.id, 'field_changed', 'Descrição atualizada', actor='Automação')
        elif field == 'deal.stage_id':
            stage_id = cfg.get('stage_id')
            if stage_id:
                stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
                if stage:
                    card.stage_id = stage.id
                    db.commit()
                    log_activity(db, card.id, 'moved',
                        f'Movido para a etapa {stage.name}', actor='Automação')

    elif step_type == 'change_stage':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
            if stage:
                card.stage_id = stage.id
                db.commit()
                log_activity(db, card.id, 'moved', f'Movido para etapa "{stage.name}"', actor='Automação')

    elif step_type == 'move_pipeline':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
            if stage:
                card.stage_id = stage.id
                db.commit()
                pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first()
                log_activity(db, card.id, 'moved', f'Movido para "{pipeline.name if pipeline else "?"}" → "{stage.name}"', actor='Automação')

    elif step_type == 'create_task':
        title_raw = cfg.get('title', 'Tarefa automática')
        title = _render_vars(title_raw, vars)
        desc  = _render_vars(cfg.get('description', ''), vars)
        due_days = int(cfg.get('due_days', 1))
        from datetime import datetime, timedelta
        due = (datetime.now() + timedelta(days=due_days)).strftime('%Y-%m-%d') if due_days > 0 else None
        task = models.Task(
            title=title,
            description=desc,
            priority=cfg.get('priority', 'normal'),
            due_date=due,
            card_id=card.id,
            status='todo',
        )
        db.add(task)
        db.commit()
        log_activity(db, card.id, 'task_created', f'Tarefa criada: "{title}"', actor='Automação')

    elif step_type == 'pause':
        # Async delay not yet implemented — log and continue
        amount = cfg.get('delay_amount', 1)
        unit = cfg.get('delay_unit', 'hours')
        log_activity(db, card.id, 'pause', f'Pausa configurada: {amount} {unit}', actor='Automação')

    elif step_type == 'send_email':
        to    = _render_vars(cfg.get('to', ''), vars)
        subj  = _render_vars(cfg.get('subject', ''), vars)
        body  = _render_vars(cfg.get('body', ''), vars)
        log_activity(db, card.id, 'email_sent', f'E-mail para {to}: {subj}', actor='Automação')

def _execute_flow_steps(steps: list, vars: dict, card, db):
    for step in steps:
        t = step.get('type')
        if t == 'if_else':
            result = _evaluate_condition(step.get('condition', ''), vars, card)
            branch = step.get('true_steps', []) if result else step.get('false_steps', [])
            _execute_flow_steps(branch, vars, card, db)
        else:
            _run_action(t, step.get('config', {}), vars, card, db)

def _execute_rule(rule_id: int, card_id: int):
    db = SessionLocal()
    try:
        rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
        card = db.query(models.Card).filter(models.Card.id == card_id).first()
        if not rule or not card:
            return
        cfg = json.loads(rule.config or '{}')
        vars = _build_vars(card, db)
        # New flow format
        if cfg.get('version') == 1:
            _execute_flow_steps(cfg.get('steps', []), vars, card, db)
        else:
            # Legacy single-action format
            _run_action(rule.action_type, cfg, vars, card, db)
    finally:
        db.close()

@app.get("/automations", response_model=List[schemas.AutomationRule])
def get_automations(stage_id: int = None, pipeline_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.AutomationRule)
    if stage_id: q = q.filter(models.AutomationRule.stage_id == stage_id)
    if pipeline_id: q = q.filter(models.AutomationRule.pipeline_id == pipeline_id)
    return q.order_by(models.AutomationRule.order).all()

@app.post("/automations", response_model=schemas.AutomationRule)
def create_automation(rule: schemas.AutomationRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.AutomationRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.put("/automations/{rule_id}", response_model=schemas.AutomationRule)
def update_automation(rule_id: int, rule: schemas.AutomationRuleBase, db: Session = Depends(get_db)):
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in rule.dict().items():
        setattr(db_rule, k, v)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.delete("/automations/{rule_id}")
def delete_automation(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(db_rule)
    db.commit()
    return {"status": "ok"}

@app.get("/automations/export")
def export_automations(pipeline_id: int, db: Session = Depends(get_db)):
    """Export all automation rules for a pipeline as a portable JSON structure."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.pipeline_id == pipeline_id
    ).order_by(models.AutomationRule.order).all()

    # Build stage name lookup
    stages = db.query(models.Stage).filter(models.Stage.pipeline_id == pipeline_id).all()
    stage_names = {s.id: s.name for s in stages}

    export_data = {
        "nexus_crm_automations": True,
        "version": 1,
        "pipeline_name": pipeline.name,
        "rules": [
            {
                "stage_name": stage_names.get(r.stage_id, f"stage_{r.stage_id}"),
                "name": r.name,
                "action_type": r.action_type,
                "config": r.config,
                "order": r.order,
                "enabled": r.enabled,
            }
            for r in rules
        ],
    }
    return export_data

@app.post("/automations/import")
def import_automations(
    pipeline_id: int,
    data: dict = Body(...),
    mode: str = "append",   # "append" or "replace"
    db: Session = Depends(get_db),
):
    """Import automation rules from an exported JSON. mode=replace clears existing rules first."""
    if not data.get("nexus_crm_automations"):
        raise HTTPException(status_code=400, detail="Arquivo inválido: não é um export de automações Nexus CRM.")

    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    stages = db.query(models.Stage).filter(models.Stage.pipeline_id == pipeline_id).all()
    stage_by_name = {s.name.strip().lower(): s.id for s in stages}

    if mode == "replace":
        db.query(models.AutomationRule).filter(
            models.AutomationRule.pipeline_id == pipeline_id
        ).delete()
        db.flush()

    created = []
    skipped = []
    for rule_data in data.get("rules", []):
        stage_name = rule_data.get("stage_name", "")
        stage_id = stage_by_name.get(stage_name.strip().lower())
        if not stage_id:
            skipped.append(stage_name)
            continue
        new_rule = models.AutomationRule(
            stage_id=stage_id,
            pipeline_id=pipeline_id,
            name=rule_data.get("name", "Regra importada"),
            action_type=rule_data.get("action_type", "add_note"),
            config=rule_data.get("config", "{}"),
            order=rule_data.get("order", 0),
            enabled=rule_data.get("enabled", True),
        )
        db.add(new_rule)
        created.append(rule_data.get("name"))

    db.commit()
    return {
        "ok": True,
        "created": len(created),
        "skipped": len(skipped),
        "skipped_stages": skipped,
    }

# ── WORKFLOW HELPER ──────────────────────────────────────────────────────────

def _execute_workflow_step(action_type: str, cfg: dict, card: models.Card, db) -> str:
    if action_type == 'change_stage':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
            if stage:
                card.stage_id = stage_id
                return f"Etapa alterada para '{stage.name}'"
        return "Etapa não encontrada"

    elif action_type == 'assign_user':
        user_id = cfg.get('user_id')
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user:
                existing = db.query(models.card_users).filter_by(card_id=card.id, user_id=user_id).first()
                if not existing:
                    db.execute(models.card_users.insert().values(card_id=card.id, user_id=user_id))
                return f"Usuário '{user.name}' atribuído"
        return "Usuário não encontrado"

    elif action_type == 'add_note':
        text_val = cfg.get('text', '')
        if text_val:
            db.add(models.Activity(
                card_id=card.id,
                type='note', content=text_val, actor='Workflow',
            ))
            return "Nota adicionada"
        return "Texto vazio"

    elif action_type == 'send_webhook':
        url = cfg.get('url', '')
        if url:
            import httpx
            payload = {'card_id': card.id, 'card_title': card.title, 'stage_id': card.stage_id}
            try:
                r = httpx.post(url, json=payload, timeout=10)
                return f"Webhook enviado ({r.status_code})"
            except Exception as e:
                raise Exception(f"Webhook falhou: {e}")
        return "URL vazia"

    elif action_type == 'move_to_pipeline':
        target_stage_id = cfg.get('target_stage_id')
        if target_stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == target_stage_id).first()
            if stage:
                card.stage_id = target_stage_id
                pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first()
                return f"Card movido para '{pipeline.name if pipeline else '?'}' → '{stage.name}'"
        return "Etapa destino não encontrada"

    elif action_type == 'set_price':
        price = cfg.get('price')
        if price is not None:
            card.price = float(price)
            return f"Valor definido como R$ {price}"
        return "Valor não informado"

    return f"Ação '{action_type}' desconhecida"

# ── WORKFLOW TEMPLATES ────────────────────────────────────────────────────────

def _execute_workflow_step(action_type: str, cfg: dict, card: models.Card, db) -> str:
    if action_type == 'change_stage':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
            if stage:
                card.stage_id = stage_id
                return f"Etapa alterada para '{stage.name}'"
        return "Etapa não encontrada"
    elif action_type == 'assign_user':
        user_id = cfg.get('user_id')
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user:
                existing = db.execute(
                    text("SELECT 1 FROM card_users WHERE card_id=:c AND user_id=:u"),
                    {"c": card.id, "u": user_id}
                ).first()
                if not existing:
                    db.execute(text("INSERT INTO card_users (card_id, user_id) VALUES (:c,:u)"), {"c": card.id, "u": user_id})
                return f"Usuário '{user.name}' atribuído"
        return "Usuário não encontrado"
    elif action_type == 'add_note':
        text_val = cfg.get('text', '')
        if text_val:
            db.add(models.Activity(card_id=card.id, type='note', content=text_val, actor='Workflow'))
            return "Nota adicionada"
        return "Texto vazio"
    elif action_type == 'send_webhook':
        url = cfg.get('url', '')
        if url:
            payload_data = json.dumps({'card_id': card.id, 'card_title': card.title, 'stage_id': card.stage_id})
            try:
                req = urllib_req.Request(url, data=payload_data.encode(), headers={'Content-Type': 'application/json'}, method='POST')
                with urlopen(req, timeout=10) as resp:
                    return f"Webhook enviado ({resp.status})"
            except Exception as e:
                raise Exception(f"Webhook falhou: {e}")
        return "URL vazia"
    elif action_type == 'move_to_pipeline':
        target_stage_id = cfg.get('target_stage_id')
        if target_stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == target_stage_id).first()
            if stage:
                card.stage_id = target_stage_id
                pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first()
                return f"Card movido para '{pipeline.name if pipeline else '?'}' → '{stage.name}'"
        return "Etapa destino não encontrada"
    elif action_type == 'set_price':
        price = cfg.get('price')
        if price is not None:
            card.price = float(price)
            return f"Valor definido como R$ {price}"
        return "Valor não informado"
    return f"Ação '{action_type}' desconhecida"

# ── WORKFLOW TEMPLATES ────────────────────────────────────────────────────────

@app.get("/workflows", response_model=List[schemas.WorkflowTemplate])
def get_workflows(entity_type: str = None, pipeline_id: int = None, db: Session = Depends(get_db)):
    q = db.query(models.WorkflowTemplate)
    if entity_type:
        q = q.filter(models.WorkflowTemplate.entity_type.in_([entity_type, 'any']))
    if pipeline_id:
        q = q.filter(
            (models.WorkflowTemplate.pipeline_id == pipeline_id) |
            (models.WorkflowTemplate.pipeline_id == None)
        )
    return q.order_by(models.WorkflowTemplate.id).all()

@app.post("/workflows", response_model=schemas.WorkflowTemplate)
def create_workflow(data: schemas.WorkflowTemplateCreate, db: Session = Depends(get_db)):
    steps_data = data.steps
    tpl_data = data.dict(exclude={'steps'})
    tpl = models.WorkflowTemplate(**tpl_data)
    db.add(tpl)
    db.flush()
    for i, s in enumerate(steps_data):
        step = models.WorkflowStep(template_id=tpl.id, step_order=i, action_type=s.action_type, action_config=s.action_config)
        db.add(step)
    db.commit()
    db.refresh(tpl)
    return tpl

@app.put("/workflows/{tpl_id}", response_model=schemas.WorkflowTemplate)
def update_workflow(tpl_id: int, data: schemas.WorkflowTemplateCreate, db: Session = Depends(get_db)):
    tpl = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == tpl_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Workflow not found")
    steps_data = data.steps
    for k, v in data.dict(exclude={'steps'}).items():
        setattr(tpl, k, v)
    db.query(models.WorkflowStep).filter(models.WorkflowStep.template_id == tpl_id).delete()
    for i, s in enumerate(steps_data):
        step = models.WorkflowStep(template_id=tpl.id, step_order=i, action_type=s.action_type, action_config=s.action_config)
        db.add(step)
    db.commit()
    db.refresh(tpl)
    return tpl

@app.delete("/workflows/{tpl_id}")
def delete_workflow(tpl_id: int, db: Session = Depends(get_db)):
    tpl = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == tpl_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(tpl)
    db.commit()
    return {"status": "ok"}

@app.post("/workflows/{tpl_id}/execute")
def execute_workflow(tpl_id: int, body: dict = Body(default={}), authorization: str = Header(default=None), db: Session = Depends(get_db)):
    """Execute a workflow template on a card. body: {card_id: int}"""
    card_id = body.get("card_id")
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id required")

    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    tpl = db.query(models.WorkflowTemplate).filter(models.WorkflowTemplate.id == tpl_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Workflow not found")

    steps = db.query(models.WorkflowStep).filter(models.WorkflowStep.template_id == tpl_id).order_by(models.WorkflowStep.step_order).all()
    result_log = []
    status = 'completed'

    for step in steps:
        try:
            cfg = json.loads(step.action_config or '{}')
            # Visual flow builder format (version 1 JSON)
            if step.action_type == 'flow' and cfg.get('version') == 1:
                vars_map = _build_vars(card, db)
                _execute_flow_steps(cfg.get('steps', []), vars_map, card, db)
                result_log.append({"action": "flow", "status": "ok", "msg": f"{len(cfg.get('steps', []))} blocos executados"})
            else:
                msg = _execute_workflow_step(step.action_type, cfg, card, db)
                result_log.append({"action": step.action_type, "status": "ok", "msg": msg})
        except Exception as e:
            result_log.append({"action": step.action_type, "status": "error", "msg": str(e)})
            status = 'failed'

    db.commit()

    # Resolve executor name from JWT if provided
    exec_id = None
    exec_name = 'Sistema'
    if authorization and authorization.startswith("Bearer "):
        try:
            payload = jwt_decode(authorization.replace("Bearer ", ""))
            u = db.query(models.User).filter(models.User.id == payload["sub"]).first()
            if u:
                exec_id = u.id
                exec_name = u.name
        except Exception:
            pass

    exe = models.WorkflowExecution(
        template_id=tpl_id,
        template_name=tpl.name,
        card_id=card_id,
        executed_by_id=exec_id,
        executed_by_name=exec_name,
        status=status,
        result_log=json.dumps(result_log, ensure_ascii=False),
    )
    db.add(exe)

    log_audit(db, "workflow_executed", "card", card_id, card.title, exec_name, details={"workflow": tpl.name, "status": status})

    db.commit()
    return {"status": status, "steps": result_log}

@app.get("/cards/{card_id}/workflow-executions", response_model=List[schemas.WorkflowExecutionOut])
def get_card_workflow_executions(card_id: int, db: Session = Depends(get_db)):
    return db.query(models.WorkflowExecution).filter(
        models.WorkflowExecution.card_id == card_id
    ).order_by(models.WorkflowExecution.executed_at.desc()).limit(50).all()

# ---- ACTIVITIES ----
def log_activity(db, card_id: int, activity_type: str, content: str, actor: str = 'Usuário'):
    db.add(models.Activity(card_id=card_id, type=activity_type, content=content, actor=actor))
    db.commit()

@app.get("/cards/{card_id}/activities", response_model=List[schemas.Activity])
def get_activities(card_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Activity)
              .filter(models.Activity.card_id == card_id)
              .order_by(models.Activity.created_at.asc())
              .all())

@app.post("/cards/{card_id}/activities", response_model=schemas.Activity)
def create_activity(card_id: int, activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db_activity = models.Activity(**activity.dict(), card_id=card_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

# ---- CUSTOM FIELDS ----
@app.get("/custom-fields", response_model=List[schemas.CustomField])
def get_custom_fields(entity: str = None, db: Session = Depends(get_db)):
    q = db.query(models.CustomField)
    if entity:
        q = q.filter(models.CustomField.entity == entity)
    return q.order_by(models.CustomField.order, models.CustomField.id).all()

@app.post("/custom-fields", response_model=schemas.CustomField)
def create_custom_field(field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    data = field.dict()
    # Auto-generate key from name if not provided
    if not data.get('key'):
        slug = re.sub(r'\s+', '_', re.sub(r'[^\w\s]', '', data['name'].lower().strip()))
        base = slug or 'campo'
        slug = base
        i = 1
        while db.query(models.CustomField).filter(
            models.CustomField.entity == data['entity'],
            models.CustomField.key == slug
        ).first():
            slug = f"{base}_{i}"; i += 1
        data['key'] = slug
    # Always generate a UID (NGS-001, CTT-002, EQP-003 …)
    data['uid'] = _generate_uid(data['entity'], db)
    db_field = models.CustomField(**data)
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field

# ---- FILE UPLOAD ----
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    safe_name = re.sub(r'[^\w.\-]', '_', file.filename or 'file')
    filename = f"{int(time.time())}_{safe_name}"
    dest = os.path.join("uploads", filename)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(dest)
    return {
        "name": file.filename,
        "url": f"/uploads/{filename}",
        "size": size,
        "type": file.content_type or "application/octet-stream",
    }

@app.put("/custom-fields/{field_id}", response_model=schemas.CustomField)
def update_custom_field(field_id: int, field: schemas.CustomFieldCreate, db: Session = Depends(get_db)):
    db_field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    for k, v in field.dict().items():
        setattr(db_field, k, v)
    db.commit()
    db.refresh(db_field)
    return db_field

@app.delete("/custom-fields/{field_id}")
def delete_custom_field(field_id: int, db: Session = Depends(get_db)):
    db_field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not db_field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    db.delete(db_field)
    db.commit()
    return {"status": "ok"}

@app.get("/custom-field-values")
def get_custom_field_values(entity: str, entity_id: int, db: Session = Depends(get_db)):
    values = db.query(models.CustomFieldValue).filter(
        models.CustomFieldValue.entity_id == entity_id,
        models.CustomFieldValue.field.has(models.CustomField.entity == entity)
    ).all()
    return [{"id": v.id, "field_id": v.field_id, "entity_id": v.entity_id, "value": v.value} for v in values]

@app.put("/custom-field-values")
def upsert_custom_field_values(entity: str, entity_id: int, values: List[schemas.CustomFieldValueIn], db: Session = Depends(get_db)):
    for item in values:
        existing = db.query(models.CustomFieldValue).filter(
            models.CustomFieldValue.field_id == item.field_id,
            models.CustomFieldValue.entity_id == entity_id
        ).first()
        if existing:
            existing.value = item.value
        else:
            db.add(models.CustomFieldValue(
                field_id=item.field_id,
                entity_id=entity_id,
                value=item.value
            ))
    db.commit()
    return {"status": "ok"}

@app.put("/cards/{card_id}", response_model=schemas.Card)
def update_card(card_id: int, card_data: schemas.CardBase, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Capture old values for change log
    old_price  = card.price
    old_title  = card.title
    old_stage  = card.stage_id
    old_contact_ids = {c.id for c in card.contacts}
    old_user_ids    = {u.id for u in card.users}

    card.title            = card_data.title
    card.description      = card_data.description
    card.price            = card_data.price
    card.source           = card_data.source
    card.source_info      = card_data.source_info
    card.deal_type        = card_data.deal_type
    card.start_date       = card_data.start_date
    card.available_to_all = card_data.available_to_all
    card.responsible_user_id = card_data.responsible_user_id
    card.observers        = card_data.observers
    card.comment          = card_data.comment
    card.utm_source       = card_data.utm_source
    card.utm_medium       = card_data.utm_medium
    card.utm_campaign     = card_data.utm_campaign
    card.updated_at       = datetime.now(timezone.utc)

    _sync_relations(card, card_data.contact_ids, card_data.user_ids, db)

    logs = []

    if old_title != card_data.title:
        logs.append(models.Activity(card_id=card.id, type='title_changed',
            content=f'Título alterado para "{card_data.title}"', actor='Usuário'))

    if round(old_price or 0, 2) != round(card_data.price or 0, 2):
        logs.append(models.Activity(card_id=card.id, type='price_changed',
            content=f'Valor alterado de R$ {old_price or 0:.2f} para R$ {card_data.price or 0:.2f}', actor='Usuário'))

    if old_stage != card_data.stage_id:
        new_stage = db.query(models.Stage).filter(models.Stage.id == card_data.stage_id).first()
        if new_stage:
            logs.append(models.Activity(card_id=card.id, type='moved',
                content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))
        card.stage_id = card_data.stage_id
        card.stage_changed_by = 'Usuário'
    else:
        card.stage_id = card_data.stage_id

    new_contact_ids = set(card_data.contact_ids or [])
    for cid in new_contact_ids - old_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(card_id=card.id, type='contact_added',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' adicionado', actor='Usuário'))
    for cid in old_contact_ids - new_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(card_id=card.id, type='contact_removed',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' removido', actor='Usuário'))

    new_user_ids = set(card_data.user_ids or [])
    for uid in new_user_ids - old_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(card_id=card.id, type='user_assigned',
                content=f'Responsável {u.name} adicionado', actor='Usuário'))
    for uid in old_user_ids - new_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(card_id=card.id, type='user_removed',
                content=f'Responsável {u.name} removido', actor='Usuário'))

    for log in logs:
        db.add(log)

    db.commit()
    db.refresh(card)
    log_audit(db, "updated", "card", card_id, card.title)
    return card

@app.put("/cards/{card_id}/move", response_model=schemas.Card)
def move_card(card_id: int, move_data: schemas.CardMove, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    new_stage = db.query(models.Stage).filter(models.Stage.id == move_data.new_stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    missing = _check_stage_requirements(card, move_data.new_stage_id, db)
    if missing:
        raise HTTPException(status_code=422, detail={"code": "missing_required_fields", "missing": missing, "stage_name": new_stage.name})

    card.stage_id = new_stage.id
    card.order = move_data.new_order
    card.updated_at = datetime.now(timezone.utc)
    card.stage_changed_by = 'Usuário'

    db.add(models.Activity(card_id=card.id, type='moved',
        content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))

    db.commit()
    db.refresh(card)
    log_audit(db, "moved", "card", card_id, card.title, details={"new_stage_id": move_data.new_stage_id})

    # Disparar regras de automação configuradas para a etapa destino
    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.stage_id == new_stage.id,
        models.AutomationRule.enabled == True
    ).order_by(models.AutomationRule.order).all()
    for rule in rules:
        background_tasks.add_task(_execute_rule, rule.id, card.id)

    return card

@app.put("/pipelines/{pipeline_id}/cards/{card_id}/move", response_model=schemas.Card)
def move_card_in_pipeline(
    pipeline_id: int,
    card_id: int,
    stage_id: int,
    order: int = 0,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    """Mover card de pipeline especificado para uma etapa dentro do mesmo pipeline."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")

    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail=f"Card {card_id} não encontrado")

    # Verifica que o card pertence ao pipeline informado
    current_stage = db.query(models.Stage).filter(models.Stage.id == card.stage_id).first()
    if not current_stage or current_stage.pipeline_id != pipeline_id:
        raise HTTPException(
            status_code=400,
            detail=f"Card {card_id} não pertence ao pipeline {pipeline_id} (pipeline atual: {current_stage.pipeline_id if current_stage else 'desconhecido'})"
        )

    new_stage = db.query(models.Stage).filter(
        models.Stage.id == stage_id,
        models.Stage.pipeline_id == pipeline_id,
    ).first()
    if not new_stage:
        raise HTTPException(
            status_code=404,
            detail=f"Etapa {stage_id} não encontrada no pipeline {pipeline_id}"
        )

    missing = _check_stage_requirements(card, stage_id, db)
    if missing:
        raise HTTPException(status_code=422, detail={"code": "missing_required_fields", "missing": missing, "stage_name": new_stage.name})

    card.stage_id = new_stage.id
    card.order = order
    db.add(models.Activity(card_id=card.id, type='moved',
        content=f'Movido para "{new_stage.name}"', actor='API'))
    db.commit()
    db.refresh(card)

    if background_tasks:
        rules = db.query(models.AutomationRule).filter(
            models.AutomationRule.stage_id == new_stage.id,
            models.AutomationRule.enabled == True,
        ).order_by(models.AutomationRule.order).all()
        for rule in rules:
            background_tasks.add_task(_execute_rule, rule.id, card.id)

    _fire_outbound_webhooks("card.moved", "cards", {
        "id": card.id, "title": card.title,
        "pipeline_id": pipeline_id,
        "stage_id": new_stage.id, "stage_name": new_stage.name,
    })
    return card


@app.post("/cards/{card_id}/duplicate", response_model=schemas.Card)
def duplicate_card(card_id: int, db: Session = Depends(get_db)):
    orig = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Card not found")

    # Find the max order in the same stage
    max_order = db.query(models.Card).filter(models.Card.stage_id == orig.stage_id).count()

    new_card = models.Card(
        title=f"Cópia de {orig.title}",
        description=orig.description,
        price=orig.price,
        stage_id=orig.stage_id,
        order=max_order,
        source=orig.source,
        source_info=orig.source_info,
        deal_type=orig.deal_type,
        start_date=orig.start_date,
        available_to_all=orig.available_to_all,
        responsible_user_id=orig.responsible_user_id,
        observers=orig.observers,
        comment=orig.comment,
        utm_source=orig.utm_source,
        utm_medium=orig.utm_medium,
        utm_campaign=orig.utm_campaign,
    )
    db.add(new_card)
    db.flush()

    # Copy contacts and users
    for contact in orig.contacts:
        new_card.contacts.append(contact)
    for user in orig.users:
        new_card.users.append(user)

    # Copy custom field values
    orig_cfvs = db.query(models.CustomFieldValue).filter(models.CustomFieldValue.entity_id == orig.id).all()
    for cfv in orig_cfvs:
        db.add(models.CustomFieldValue(field_id=cfv.field_id, entity_id=new_card.id, value=cfv.value))

    db.commit()
    db.refresh(new_card)

    log_audit(db, "created", "card", new_card.id, new_card.title, details={"duplicated_from": card_id})

    # Return the full card with relationships
    return db.query(models.Card).filter(models.Card.id == new_card.id).first()

@app.put("/pipelines/{pipeline_id}/leads/{lead_id}/move", response_model=schemas.Lead)
def move_lead_in_pipeline(
    pipeline_id: int,
    lead_id: int,
    stage_id: int,
    order: int = 0,
    db: Session = Depends(get_db),
):
    """Mover lead dentro do Funil de Leads para uma etapa específica."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")

    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead {lead_id} não encontrado")

    current_stage = db.query(models.Stage).filter(models.Stage.id == lead.stage_id).first()
    if not current_stage or current_stage.pipeline_id != pipeline_id:
        raise HTTPException(
            status_code=400,
            detail=f"Lead {lead_id} não pertence ao pipeline {pipeline_id}"
        )

    new_stage = db.query(models.Stage).filter(
        models.Stage.id == stage_id,
        models.Stage.pipeline_id == pipeline_id,
    ).first()
    if not new_stage:
        raise HTTPException(
            status_code=404,
            detail=f"Etapa {stage_id} não encontrada no pipeline {pipeline_id}"
        )

    lead.stage_id = new_stage.id
    lead.order = order
    db.add(models.Activity(lead_id=lead.id, type='moved',
        content=f'Movido para "{new_stage.name}"', actor='API'))
    db.commit()
    db.refresh(lead)

    _fire_outbound_webhooks("lead.moved", "leads", {
        "id": lead.id, "title": lead.title,
        "pipeline_id": pipeline_id,
        "stage_id": new_stage.id, "stage_name": new_stage.name,
    })
    return lead

@app.get("/pipelines/{pipeline_id}/stages", response_model=List[schemas.Stage])
def get_pipeline_stages(pipeline_id: int, db: Session = Depends(get_db)):
    """Lista todas as etapas de um pipeline, com seus cards/leads."""
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail=f"Pipeline {pipeline_id} não encontrado")
    return db.query(models.Stage).filter(
        models.Stage.pipeline_id == pipeline_id
    ).order_by(models.Stage.order).all()

# ── Leads ─────────────────────────────────────────────────────────────────────

def _sync_lead_relations(lead, contact_ids, user_ids, db):
    if contact_ids is not None:
        lead.contacts = db.query(models.Contact).filter(models.Contact.id.in_(contact_ids)).all()
    if user_ids is not None:
        lead.users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()

@app.get("/leads", response_model=List[schemas.Lead])
def get_leads(pipeline_id: int = None, stage_id: int = None, q: Optional[str] = None, limit: int = 50, authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    perms = _get_user_permissions(authorization, db)
    query = db.query(models.Lead)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    if stage_id:
        query = query.filter(models.Lead.stage_id == stage_id)
    read_scope = _resolve_read_scope(perms, "lead")
    if read_scope == "deny":
        return []
    if read_scope == "own" and perms.get("user_id"):
        uid = perms["user_id"]
        query = query.filter(models.Lead.users.any(models.User.id == uid))
    if q:
        q = q.strip()
        if q.startswith('#'):
            try:
                query = query.filter(models.Lead.id == int(q[1:]))
            except ValueError:
                pass
        else:
            query = query.filter(
                models.Lead.title.ilike(f'%{q}%') |
                models.Lead.first_name.ilike(f'%{q}%') |
                models.Lead.last_name.ilike(f'%{q}%')
            )
    return _list_with_cf(query.order_by(models.Lead.id.desc()).limit(limit).all(), 'lead', db)

@app.post("/leads", response_model=schemas.Lead)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db)):
    data = lead.dict(exclude_unset=True)
    contact_ids = data.pop("contact_ids", [])
    user_ids = data.pop("user_ids", [])
    if not data.get("created_at"):
        data["created_at"] = datetime.now(timezone.utc)
    db_lead = models.Lead(**data)
    db.add(db_lead)
    db.flush()
    _sync_lead_relations(db_lead, contact_ids, user_ids, db)
    db.add(models.Activity(lead_id=db_lead.id, type='created', content='Lead criado', actor='Usuário'))
    db.commit()
    db.refresh(db_lead)
    log_audit(db, "created", "lead", db_lead.id, db_lead.title)
    _fire_outbound_webhooks("lead.created", "leads", {"id": db_lead.id, "title": db_lead.title, "stage_id": db_lead.stage_id})
    return db_lead

@app.get("/leads/{lead_id}", response_model=schemas.Lead)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _with_cf(lead, 'lead', db)

@app.put("/leads/{lead_id}", response_model=schemas.Lead)
def update_lead(lead_id: int, lead_data: schemas.LeadBase, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_price  = lead.price
    old_title  = lead.title
    old_stage  = lead.stage_id
    old_contact_ids = {c.id for c in lead.contacts}
    old_user_ids    = {u.id for u in lead.users}

    lead.title          = lead_data.title
    lead.description    = lead_data.description
    lead.price          = lead_data.price
    lead.source         = lead_data.source
    lead.salutation     = lead_data.salutation
    lead.first_name     = lead_data.first_name
    lead.last_name      = lead_data.last_name
    lead.middle_name    = lead_data.middle_name
    lead.birth_date     = lead_data.birth_date
    lead.position       = lead_data.position
    lead.company_name   = lead_data.company_name
    lead.phone          = lead_data.phone
    lead.email          = lead_data.email
    lead.website        = lead_data.website
    lead.source_info    = lead_data.source_info
    lead.available_to_all = lead_data.available_to_all
    lead.address        = lead_data.address
    lead.utm_source     = lead_data.utm_source
    lead.utm_medium     = lead_data.utm_medium
    lead.utm_campaign   = lead_data.utm_campaign
    lead.comment        = lead_data.comment

    _sync_lead_relations(lead, lead_data.contact_ids, lead_data.user_ids, db)

    logs = []
    if old_title != lead_data.title:
        logs.append(models.Activity(lead_id=lead.id, type='title_changed',
            content=f'Título alterado para "{lead_data.title}"', actor='Usuário'))
    if round(old_price or 0, 2) != round(lead_data.price or 0, 2):
        logs.append(models.Activity(lead_id=lead.id, type='price_changed',
            content=f'Valor alterado de R$ {old_price or 0:.2f} para R$ {lead_data.price or 0:.2f}', actor='Usuário'))
    if old_stage != lead_data.stage_id:
        new_stage = db.query(models.Stage).filter(models.Stage.id == lead_data.stage_id).first()
        if new_stage:
            logs.append(models.Activity(lead_id=lead.id, type='moved',
                content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))
        lead.stage_id = lead_data.stage_id
    else:
        lead.stage_id = lead_data.stage_id

    new_contact_ids = set(lead_data.contact_ids or [])
    for cid in new_contact_ids - old_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(lead_id=lead.id, type='contact_added',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' adicionado', actor='Usuário'))
    for cid in old_contact_ids - new_contact_ids:
        ct = db.query(models.Contact).filter(models.Contact.id == cid).first()
        if ct:
            logs.append(models.Activity(lead_id=lead.id, type='contact_removed',
                content=f'Contato {ct.first_name} {ct.last_name or ""}'.strip() + ' removido', actor='Usuário'))

    new_user_ids = set(lead_data.user_ids or [])
    for uid in new_user_ids - old_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(lead_id=lead.id, type='user_assigned',
                content=f'Responsável {u.name} adicionado', actor='Usuário'))
    for uid in old_user_ids - new_user_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            logs.append(models.Activity(lead_id=lead.id, type='user_removed',
                content=f'Responsável {u.name} removido', actor='Usuário'))

    for log in logs:
        db.add(log)
    db.commit()
    db.refresh(lead)
    log_audit(db, "updated", "lead", lead_id, lead.title)
    return lead

@app.delete("/leads/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead_title = lead.title
    db.delete(lead)
    db.commit()
    log_audit(db, "deleted", "lead", lead_id, lead_title)
    return {"message": "Lead deleted"}

@app.put("/leads/{lead_id}/move", response_model=schemas.Lead)
def move_lead(lead_id: int, move_data: schemas.CardMove, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    new_stage = db.query(models.Stage).filter(models.Stage.id == move_data.new_stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    lead.stage_id = new_stage.id
    lead.order = move_data.new_order
    db.add(models.Activity(lead_id=lead.id, type='moved',
        content=f'Movido para a etapa {new_stage.name}', actor='Usuário'))
    db.commit()
    db.refresh(lead)
    log_audit(db, "moved", "lead", lead_id, lead.title, details={"new_stage_id": move_data.new_stage_id})
    return lead

@app.post("/leads/{lead_id}/convert", response_model=schemas.LeadConvertResult)
def convert_lead(lead_id: int, opts: schemas.LeadConvertOptions = None, db: Session = Depends(get_db)):
    if opts is None:
        opts = schemas.LeadConvertOptions(create_deal=True, create_contact=False, create_company=False)

    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    result = schemas.LeadConvertResult()

    # --- Criar Empresa ---
    company = None
    if opts.create_company and lead.company_name:
        company = models.Company(
            name=lead.company_name,
            phone=lead.phone,
            email=lead.email,
            website=lead.website,
            address=lead.address,
            available_to_all=lead.available_to_all,
        )
        db.add(company)
        db.flush()
        result.company_id = company.id

    # --- Criar Contato ---
    contact = None
    if opts.create_contact:
        contact = models.Contact(
            first_name=lead.first_name or lead.title,
            last_name=lead.last_name,
            middle_name=lead.middle_name,
            salutation=lead.salutation,
            phone=lead.phone,
            email=lead.email,
            website=lead.website,
            position=lead.position,
            company_name=lead.company_name,
            source=lead.source,
            source_info=lead.source_info,
            address=lead.address,
            available_to_all=lead.available_to_all,
            comment=lead.comment,
        )
        db.add(contact)
        db.flush()
        if company:
            company.contacts.append(contact)
        result.contact_id = contact.id

    # --- Criar Negócio ---
    if opts.create_deal:
        pipeline_negocios = (db.query(models.Pipeline)
                             .filter(models.Pipeline.name != "Leads")
                             .order_by(models.Pipeline.id).first())
        if not pipeline_negocios:
            raise HTTPException(status_code=400, detail="Nenhum funil de negócios encontrado")
        first_stage = (db.query(models.Stage)
                       .filter(models.Stage.pipeline_id == pipeline_negocios.id)
                       .order_by(models.Stage.order).first())
        if not first_stage:
            raise HTTPException(status_code=400, detail="Funil de Negócios sem etapas")

        negocio = models.Card(
            title=lead.title,
            description=lead.description,
            price=lead.price,
            stage_id=first_stage.id,
            order=0,
            created_at=datetime.now(timezone.utc),
        )
        db.add(negocio)
        db.flush()
        negocio.users = list(lead.users)
        if contact:
            negocio.contacts = [contact]
        else:
            negocio.contacts = list(lead.contacts)
        db.add(models.Activity(card_id=negocio.id, type='created',
            content=f'Negócio criado a partir do Lead #{lead.id}', actor='Sistema'))
        result.deal_id = negocio.id
        _fire_outbound_webhooks("card.created", "cards", {"id": negocio.id, "title": negocio.title, "stage_id": negocio.stage_id})

    lead.converted = True
    if result.deal_id:
        lead.converted_card_id = result.deal_id
    db.add(models.Activity(lead_id=lead.id, type='system',
        content='Lead convertido' + (f' em Negócio #{result.deal_id}' if result.deal_id else ''), actor='Sistema'))

    db.commit()
    log_audit(db, "converted", "lead", lead_id, lead.title)
    _fire_outbound_webhooks("lead.converted", "leads", {"lead_id": lead.id, "deal_id": result.deal_id, "title": lead.title})
    return result

@app.post("/leads/{lead_id}/revert-convert")
def revert_lead_convert(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.converted = False
    lead.converted_card_id = None
    db.add(models.Activity(lead_id=lead.id, type='system',
        content='Conversão revertida — lead desvinculado das entidades criadas', actor='Usuário'))
    db.commit()
    return {"ok": True}

@app.get("/leads/{lead_id}/activities", response_model=List[schemas.Activity])
def get_lead_activities(lead_id: int, db: Session = Depends(get_db)):
    return (db.query(models.Activity)
              .filter(models.Activity.lead_id == lead_id)
              .order_by(models.Activity.created_at.asc())
              .all())

@app.post("/leads/{lead_id}/activities", response_model=schemas.Activity)
def create_lead_activity(lead_id: int, activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db_activity = models.Activity(**activity.dict(), lead_id=lead_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


# ── Tasks ─────────────────────────────────────────────────────────────────────

def _task_out(obj, db):
    """Enrich a Task ORM object with computed fields before returning."""
    import json as _json
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    d['time_entries'] = [
        {'id': e.id, 'task_id': e.task_id, 'user_name': e.user_name,
         'started_at': e.started_at, 'ended_at': e.ended_at,
         'duration_seconds': e.duration_seconds or 0}
        for e in obj.time_entries
    ]
    d['total_time_seconds'] = sum(e.duration_seconds or 0 for e in obj.time_entries)
    d['card_title'] = None
    d['lead_title'] = None
    d['project_name'] = None
    if obj.card_id:
        card = db.query(models.Card).filter(models.Card.id == obj.card_id).first()
        if card: d['card_title'] = card.title
    if obj.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == obj.lead_id).first()
        if lead: d['lead_title'] = lead.title
    if obj.project_id:
        proj = db.query(models.Project).filter(models.Project.id == obj.project_id).first()
        if proj: d['project_name'] = proj.name
    # Ensure status derived from done if status empty
    if not d.get('status'):
        d['status'] = 'done' if d.get('done') else 'todo'
    return d

@app.get("/cards/{card_id}/tasks")
def get_tasks_by_card(card_id: int, db: Session = Depends(get_db)):
    tasks = db.query(models.Task).filter(models.Task.card_id == card_id).order_by(models.Task.created_at).all()
    return [_task_out(t, db) for t in tasks]

@app.get("/tasks")
def get_all_tasks(
    project_id: Optional[int] = None,
    card_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Task)
    if project_id is not None: q = q.filter(models.Task.project_id == project_id)
    if card_id is not None:    q = q.filter(models.Task.card_id == card_id)
    if lead_id is not None:    q = q.filter(models.Task.lead_id == lead_id)
    if assigned_to:            q = q.filter(models.Task.assigned_to == assigned_to)
    if status:                 q = q.filter(models.Task.status == status)
    tasks = q.order_by(models.Task.created_at.desc()).all()
    return [_task_out(t, db) for t in tasks]

@app.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    return _task_out(obj, db)

@app.post("/tasks")
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    data = task.dict()
    # Generate UID
    count = db.query(models.Task).count() + 1
    data['uid'] = f"TSK-{count:04d}"
    if data.get('status') == 'done': data['done'] = True
    obj = models.Task(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)

@app.put("/tasks/{task_id}")
def update_task(task_id: int, task: schemas.TaskCreate, db: Session = Depends(get_db)):
    from datetime import datetime as _dt
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    data = task.dict()
    if data.get('status') == 'done': data['done'] = True
    else: data['done'] = False
    data['updated_at'] = _dt.utcnow()
    for k, v in data.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)

@app.patch("/tasks/{task_id}/status")
def set_task_status(task_id: int, body: dict = Body(...), db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    s = body.get('status', 'todo')
    obj.status = s
    obj.done = (s == 'done')
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}

@app.patch("/tasks/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    obj.done = not obj.done
    obj.status = 'done' if obj.done else 'todo'
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)

# ── Task time tracking ────────────────────────────────────────────────────────

@app.post("/tasks/{task_id}/time/start")
def start_timer(task_id: int, body: dict = Body(default={}), db: Session = Depends(get_db)):
    from datetime import datetime as _dt
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    # Stop any open entry for this task
    open_entries = [e for e in obj.time_entries if e.ended_at is None and e.started_at is not None]
    for e in open_entries:
        e.ended_at = _dt.utcnow()
        e.duration_seconds = int((_dt.utcnow() - e.started_at.replace(tzinfo=None)).total_seconds())
    entry = models.TaskTimeEntry(task_id=task_id, user_name=body.get('user_name', ''), started_at=_dt.utcnow())
    db.add(entry)
    db.commit()
    return {"ok": True, "entry_id": entry.id}

@app.post("/tasks/{task_id}/time/stop")
def stop_timer(task_id: int, body: dict = Body(default={}), db: Session = Depends(get_db)):
    from datetime import datetime as _dt
    obj = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Task not found")
    open_entries = [e for e in obj.time_entries if e.ended_at is None and e.started_at is not None]
    for e in open_entries:
        now = _dt.utcnow()
        e.ended_at = now
        e.duration_seconds = int((now - e.started_at.replace(tzinfo=None)).total_seconds())
    db.commit()
    db.refresh(obj)
    return _task_out(obj, db)

# ── Projects ──────────────────────────────────────────────────────────────────

@app.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    projs = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    out = []
    for p in projs:
        task_count = db.query(models.Task).filter(models.Task.project_id == p.id).count()
        out.append({
            'id': p.id, 'name': p.name, 'description': p.description,
            'icon': p.icon, 'theme_color': p.theme_color, 'privacy': p.privacy,
            'owner_id': p.owner_id,
            'created_at': p.created_at,
            'task_count': task_count,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in p.members],
        })
    return out

@app.post("/projects")
def create_project(proj: schemas.ProjectCreate, db: Session = Depends(get_db)):
    data = proj.dict(exclude={'member_ids', 'moderator_ids'})
    obj = models.Project(**data)
    db.add(obj)
    db.flush()
    # Add owner as member
    if obj.owner_id:
        db.add(models.ProjectMember(project_id=obj.id, user_id=obj.owner_id, role='owner'))
    for uid in proj.moderator_ids:
        if uid != obj.owner_id:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='moderator'))
    for uid in proj.member_ids:
        if uid != obj.owner_id and uid not in proj.moderator_ids:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'icon': obj.icon, 'theme_color': obj.theme_color, 'privacy': obj.privacy,
            'owner_id': obj.owner_id, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}

@app.put("/projects/{project_id}")
def update_project(project_id: int, proj: schemas.ProjectCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Project not found")
    for k, v in proj.dict(exclude={'member_ids', 'moderator_ids'}).items():
        setattr(obj, k, v)
    # Rebuild members
    for m in list(obj.members): db.delete(m)
    db.flush()
    if obj.owner_id:
        db.add(models.ProjectMember(project_id=obj.id, user_id=obj.owner_id, role='owner'))
    for uid in proj.moderator_ids:
        if uid != obj.owner_id:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='moderator'))
    for uid in proj.member_ids:
        if uid != obj.owner_id and uid not in proj.moderator_ids:
            db.add(models.ProjectMember(project_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'icon': obj.icon, 'theme_color': obj.theme_color, 'privacy': obj.privacy,
            'owner_id': obj.owner_id, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Project not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}

# ── Teams ─────────────────────────────────────────────────────────────────────

@app.get("/teams")
def get_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).order_by(models.Team.created_at).all()
    out = []
    for t in teams:
        out.append({
            'id': t.id, 'name': t.name, 'description': t.description,
            'permissions': t.permissions, 'created_at': t.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in t.members],
        })
    return out

@app.post("/teams")
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db)):
    data = team.dict(exclude={'member_ids'})
    obj = models.Team(**data)
    db.add(obj)
    db.flush()
    for uid in team.member_ids:
        db.add(models.TeamMember(team_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'permissions': obj.permissions, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}

@app.put("/teams/{team_id}")
def update_team(team_id: int, team: schemas.TeamCreate, db: Session = Depends(get_db)):
    obj = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Team not found")
    for k, v in team.dict(exclude={'member_ids'}).items():
        setattr(obj, k, v)
    for m in list(obj.members): db.delete(m)
    db.flush()
    for uid in team.member_ids:
        db.add(models.TeamMember(team_id=obj.id, user_id=uid, role='member'))
    db.commit()
    db.refresh(obj)
    return {'id': obj.id, 'name': obj.name, 'description': obj.description,
            'permissions': obj.permissions, 'created_at': obj.created_at,
            'members': [{'id': m.id, 'user_id': m.user_id, 'role': m.role} for m in obj.members]}

@app.delete("/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not obj: raise HTTPException(status_code=404, detail="Team not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Comments ──────────────────────────────────────────────────────────────────

@app.get("/cards/{card_id}/comments", response_model=List[schemas.Comment])
def get_comments(card_id: int, db: Session = Depends(get_db)):
    return db.query(models.Comment).filter(models.Comment.card_id == card_id).order_by(models.Comment.created_at).all()

@app.post("/comments", response_model=schemas.Comment)
def create_comment(comment: schemas.CommentCreate, db: Session = Depends(get_db)):
    obj = models.Comment(**comment.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@app.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}

# ── Reports ────────────────────────────────────────────────────────────────

@app.get("/reports/summary")
def reports_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func as sqlfunc
    cards = db.query(models.Card).all()
    leads = db.query(models.Lead).all()
    total_cards  = len(cards)
    total_value  = sum(c.price or 0 for c in cards)
    total_leads  = len(leads)
    converted    = sum(1 for l in leads if l.converted)
    conv_rate    = round(converted / total_leads * 100, 1) if total_leads else 0
    avg_value    = round(total_value / total_cards, 2) if total_cards else 0

    # Cards won (last stage type won or stage name matches win keywords)
    won_stages = db.query(models.Stage).filter(
        models.Stage.name.ilike('%ganho%') | models.Stage.name.ilike('%won%') |
        models.Stage.name.ilike('%conclu%') | models.Stage.name.ilike('%sucesso%')
    ).all()
    won_ids  = {s.id for s in won_stages}
    won_cards = [c for c in cards if c.stage_id in won_ids]
    won_value = sum(c.price or 0 for c in won_cards)
    win_rate  = round(len(won_cards) / total_cards * 100, 1) if total_cards else 0

    return {
        "total_cards": total_cards,
        "total_value": total_value,
        "total_leads": total_leads,
        "leads_converted": converted,
        "lead_conversion_rate": conv_rate,
        "avg_deal_value": avg_value,
        "won_cards": len(won_cards),
        "won_value": won_value,
        "win_rate": win_rate,
    }

@app.get("/reports/funnel")
def reports_funnel(db: Session = Depends(get_db)):
    pipelines = db.query(models.Pipeline).all()
    result = []
    for p in pipelines:
        stages_data = []
        for s in sorted(p.stages, key=lambda x: x.order):
            stage_cards = db.query(models.Card).filter(models.Card.stage_id == s.id).all()
            stages_data.append({
                "stage_id": s.id,
                "stage_name": s.name,
                "color": s.color,
                "count": len(stage_cards),
                "value": sum(c.price or 0 for c in stage_cards),
            })
        result.append({
            "pipeline_id": p.id,
            "pipeline_name": p.name,
            "stages": stages_data,
        })
    return result

@app.get("/reports/by-source")
def reports_by_source(db: Session = Depends(get_db)):
    cards = db.query(models.Card).all()
    leads = db.query(models.Lead).all()
    source_map = {}
    for c in cards:
        src = c.source or "Não informado"
        if src not in source_map:
            source_map[src] = {"source": src, "cards": 0, "cards_value": 0, "leads": 0}
        source_map[src]["cards"] += 1
        source_map[src]["cards_value"] += c.price or 0
    for l in leads:
        src = l.source or "Não informado"
        if src not in source_map:
            source_map[src] = {"source": src, "cards": 0, "cards_value": 0, "leads": 0}
        source_map[src]["leads"] += 1
    return sorted(source_map.values(), key=lambda x: x["cards"] + x["leads"], reverse=True)

@app.get("/reports/timeline")
def reports_timeline(db: Session = Depends(get_db)):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    result = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=1) * (i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            month_end = now
        else:
            next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            month_end = next_month - timedelta(seconds=1)
        cards = db.query(models.Card).filter(
            models.Card.created_at >= month_start,
            models.Card.created_at <= month_end
        ).all()
        leads = db.query(models.Lead).filter(
            models.Lead.created_at >= month_start,
            models.Lead.created_at <= month_end
        ).all() if hasattr(models.Lead, 'created_at') else []
        result.append({
            "month": month_start.strftime("%b/%y"),
            "cards": len(cards),
            "leads": len(leads) if leads else 0,
            "value": sum(c.price or 0 for c in cards),
        })
    return result

@app.get("/reports/by-responsible")
def reports_by_responsible(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    result = []
    for u in users:
        user_cards = [c for c in u.cards] if hasattr(u, 'cards') else []
        # Use junction table
        from sqlalchemy import select
        stmt = select(models.Card).join(models.card_users).where(models.card_users.c.user_id == u.id)
        user_cards = db.execute(stmt).scalars().unique().all()
        total_value = sum(c.price or 0 for c in user_cards)
        result.append({
            "user_id": u.id,
            "user_name": u.name,
            "cards": len(user_cards),
            "value": total_value,
        })
    return sorted(result, key=lambda x: x["value"], reverse=True)


# ── Notifications ──────────────────────────────────────────────────────────────

@app.get("/notifications")
def get_notifications(db: Session = Depends(get_db)):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()
    seven_days_ago = now - timedelta(days=7)

    notifications = []

    # a) Overdue tasks
    overdue_tasks = (
        db.query(models.Task)
        .filter(
            models.Task.done == False,
            models.Task.due_date != None,
            models.Task.due_date < today_str,
        )
        .all()
    )
    for task in overdue_tasks:
        notifications.append({
            "id": f"task-{task.id}",
            "type": "overdue_task",
            "title": "Tarefa vencida",
            "body": task.title,
            "card_id": task.card_id,
            "severity": "danger",
            "created_at": task.due_date,
        })

    # b) Stalled cards
    stalled_cards = (
        db.query(models.Card)
        .filter(
            models.Card.updated_at != None,
            models.Card.updated_at < seven_days_ago,
            models.Card.created_at < seven_days_ago,
        )
        .all()
    )
    for card in stalled_cards:
        notifications.append({
            "id": f"card-{card.id}",
            "type": "stalled_card",
            "title": "Negócio parado",
            "body": f"{card.title} — sem movimentação há mais de 7 dias",
            "card_id": card.id,
            "severity": "warning",
            "created_at": card.updated_at.isoformat(),
        })

    # c) Mentions in notes
    mentions = (
        db.query(models.Activity)
        .filter(
            models.Activity.type == 'note',
            models.Activity.content.contains('@'),
            models.Activity.created_at > seven_days_ago,
        )
        .all()
    )
    for activity in mentions:
        notifications.append({
            "id": f"mention-{activity.id}",
            "type": "mention",
            "title": "Menção em nota",
            "body": activity.content[:80],
            "card_id": activity.card_id,
            "severity": "info",
            "created_at": activity.created_at.isoformat(),
        })

    # Sort by created_at descending and limit to 50
    notifications.sort(key=lambda n: n["created_at"] or "", reverse=True)
    return notifications[:50]


# ── Leads bulk import ──────────────────────────────────────────────────────────

class LeadImportBody(BaseModel):
    leads: List[Dict[str, Any]]

_LEAD_SAFE_KEYS = {
    "title", "first_name", "last_name", "email", "phone", "company_name",
    "source", "position", "address", "website", "comment",
    "utm_source", "utm_medium", "utm_campaign", "stage_id",
    "description", "price", "order",
}

@app.post("/leads/import")
def import_leads(body: LeadImportBody, db: Session = Depends(get_db)):
    # Resolve fallback stage (first stage of "Leads" pipeline)
    fallback_stage_id = None
    p_leads = db.query(models.Pipeline).filter(models.Pipeline.name == "Leads").first()
    if p_leads:
        first_stage = (
            db.query(models.Stage)
            .filter(models.Stage.pipeline_id == p_leads.id)
            .order_by(models.Stage.order)
            .first()
        )
        if first_stage:
            fallback_stage_id = first_stage.id

    created_ids = []
    for lead_dict in body.leads:
        safe_data = {k: v for k, v in lead_dict.items() if k in _LEAD_SAFE_KEYS}
        if not safe_data.get("stage_id"):
            safe_data["stage_id"] = fallback_stage_id
        safe_data.setdefault("created_at", datetime.now(timezone.utc))
        db_lead = models.Lead(**safe_data)
        db.add(db_lead)
        db.flush()
        db.add(models.Activity(
            lead_id=db_lead.id,
            type='created',
            content='Lead importado via CSV',
            actor='Usuário',
        ))
        created_ids.append(db_lead.id)

    db.commit()
    return {"imported": len(created_ids), "ids": created_ids}


# ---------------------------------------------------------------------------
# Global search
# ---------------------------------------------------------------------------

@app.get("/search")
def global_search(q: str = "", db: Session = Depends(get_db)):
    if len(q.strip()) < 2:
        return {"cards": [], "leads": [], "contacts": [], "companies": [], "total": 0}

    # --- Cards ---
    card_rows = (
        db.query(models.Card, models.Stage)
        .join(models.Stage, models.Card.stage_id == models.Stage.id, isouter=True)
        .filter(
            models.Card.title.ilike(f"%{q}%") |
            models.Card.description.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    cards = [
        {
            "id": card.id,
            "type": "card",
            "title": card.title or "",
            "subtitle": stage.name if stage else "",
            "stage_id": card.stage_id,
            "url": f"#card-{card.id}",
        }
        for card, stage in card_rows
    ]

    # --- Leads ---
    lead_rows = (
        db.query(models.Lead)
        .filter(
            models.Lead.title.ilike(f"%{q}%") |
            models.Lead.first_name.ilike(f"%{q}%") |
            models.Lead.last_name.ilike(f"%{q}%") |
            models.Lead.email.ilike(f"%{q}%") |
            models.Lead.phone.ilike(f"%{q}%") |
            models.Lead.company_name.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    leads = []
    for lead in lead_rows:
        name_parts = [p for p in [lead.first_name, lead.last_name] if p]
        title = lead.title or (" ".join(name_parts) if name_parts else f"Lead #{lead.id}")
        subtitle = lead.email or lead.phone or lead.company_name or ""
        leads.append({
            "id": lead.id,
            "type": "lead",
            "title": title,
            "subtitle": subtitle,
            "stage_id": lead.stage_id,
            "url": f"#lead-{lead.id}",
        })

    # --- Contacts ---
    contact_rows = (
        db.query(models.Contact)
        .filter(
            models.Contact.first_name.ilike(f"%{q}%") |
            models.Contact.last_name.ilike(f"%{q}%") |
            models.Contact.email.ilike(f"%{q}%") |
            models.Contact.phone.ilike(f"%{q}%") |
            models.Contact.company_name.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    contacts = []
    for contact in contact_rows:
        name_parts = [p for p in [contact.first_name, contact.last_name] if p]
        title = " ".join(name_parts) if name_parts else f"Contato #{contact.id}"
        subtitle = contact.email or contact.phone or ""
        contacts.append({
            "id": contact.id,
            "type": "contact",
            "title": title,
            "subtitle": subtitle,
            "url": f"#contact-{contact.id}",
        })

    # --- Companies ---
    company_rows = (
        db.query(models.Company)
        .filter(
            models.Company.name.ilike(f"%{q}%") |
            models.Company.company_number.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    companies = [
        {
            "id": company.id,
            "type": "company",
            "title": company.name or "",
            "subtitle": company.company_number or "",
            "url": f"#company-{company.id}",
        }
        for company in company_rows
    ]

    total = len(cards) + len(leads) + len(contacts) + len(companies)
    return {"cards": cards, "leads": leads, "contacts": contacts, "companies": companies, "total": total}


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/login", response_model=schemas.TokenResponse)
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

@app.post("/auth/set-password")
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

@app.get("/auth/me")
def get_me(authorization: str = Header(default=None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    payload = jwt_decode(authorization.replace("Bearer ", ""))
    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return {"user_id": user.id, "user_name": user.name, "user_email": user.email, "role": user.role}


BUILTIN_FIELD_LABELS = {
    'price':       'Valor (> 0)',
    'contact':     'Contato vinculado',
    'responsible': 'Responsável definido',
    'description': 'Descrição preenchida',
    'source':      'Fonte preenchida',
}

def _check_stage_requirements(card, stage_id: int, db):
    """Returns list of missing required fields for moving card to stage_id. Empty = OK."""
    reqs = db.query(models.StageRequiredField).filter(
        models.StageRequiredField.stage_id == stage_id
    ).all()
    missing = []
    for req in reqs:
        if req.field_type == 'builtin':
            k = req.field_key
            if k == 'price' and not (card.price and card.price > 0):
                missing.append({'field': 'price', 'label': BUILTIN_FIELD_LABELS['price']})
            elif k == 'description' and not (card.description and card.description.strip()):
                missing.append({'field': 'description', 'label': BUILTIN_FIELD_LABELS['description']})
            elif k == 'contact' and len(card.contacts) == 0:
                missing.append({'field': 'contact', 'label': BUILTIN_FIELD_LABELS['contact']})
            elif k == 'responsible' and not card.responsible_user_id:
                missing.append({'field': 'responsible', 'label': BUILTIN_FIELD_LABELS['responsible']})
            elif k == 'source' and not card.source:
                missing.append({'field': 'source', 'label': BUILTIN_FIELD_LABELS['source']})
        elif req.field_type == 'custom' and req.custom_field_id:
            cfv = db.query(models.CustomFieldValue).filter(
                models.CustomFieldValue.field_id == req.custom_field_id,
                models.CustomFieldValue.entity_id == card.id
            ).first()
            cf = db.query(models.CustomField).filter(
                models.CustomField.id == req.custom_field_id
            ).first()
            if not cfv or not (cfv.value and cfv.value.strip()):
                missing.append({
                    'field': f'custom_{req.custom_field_id}',
                    'label': cf.name if cf else f'Campo #{req.custom_field_id}',
                })
    return missing


@app.get("/audit-log")
def get_audit_log(
    entity_type: str = "",
    entity_id: int = 0,
    action: str = "",
    actor: str = "",
    date_from: str = "",
    date_to: str = "",
    search: str = "",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    q = db.query(models.AuditLog)
    if entity_type: q = q.filter(models.AuditLog.entity_type == entity_type)
    if entity_id: q = q.filter(models.AuditLog.entity_id == entity_id)
    if action: q = q.filter(models.AuditLog.action == action)
    if actor: q = q.filter(models.AuditLog.actor.ilike(f"%{actor}%"))
    if search: q = q.filter(
        models.AuditLog.entity_name.ilike(f"%{search}%") |
        models.AuditLog.actor.ilike(f"%{search}%") |
        models.AuditLog.details.ilike(f"%{search}%")
    )
    if date_from:
        try:
            from datetime import datetime as _dt
            q = q.filter(models.AuditLog.created_at >= _dt.fromisoformat(date_from))
        except: pass
    if date_to:
        try:
            from datetime import datetime as _dt
            q = q.filter(models.AuditLog.created_at <= _dt.fromisoformat(date_to + "T23:59:59"))
        except: pass
    total = q.count()
    items = q.order_by(models.AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": i.id,
                "action": i.action,
                "entity_type": i.entity_type,
                "entity_id": i.entity_id,
                "entity_name": i.entity_name,
                "actor": i.actor,
                "actor_email": i.actor_email,
                "details": i.details,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ]
    }
