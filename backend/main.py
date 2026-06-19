import json, os, time
import config
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, get_db
import models
from services.auth import hash_password
from logger import get_logger

log = get_logger("main")

models.Base.metadata.create_all(bind=engine)

os.makedirs("uploads", exist_ok=True)

# ── App ───────────────────────────────────────────────────────────────────────

from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from limiter import limiter

async def _rate_limit_handler(request, exc: RateLimitExceeded):
    log.warning("rate_limit_exceeded", extra={"path": request.url.path, "ip": request.client.host if request.client else None})
    return JSONResponse(
        {"detail": "Muitas tentativas. Aguarde 1 minuto."},
        status_code=429,
    )

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

_req_log = get_logger("http")

@app.middleware("http")
async def _log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - t0) * 1000)
    level = "warning" if response.status_code >= 400 else "info"
    getattr(_req_log, level)(
        f"{request.method} {request.url.path} {response.status_code}",
        extra={"method": request.method, "path": request.url.path,
               "status": response.status_code, "ms": ms},
    )
    return response

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

from routers import auth, pipelines, cards, leads, contacts, companies
from routers import webhooks, automations, tasks, roles, reports, misc, workflows, crm_forms, task_rules, smart_processes

app.include_router(auth.router)
app.include_router(pipelines.router)
app.include_router(cards.router)
app.include_router(leads.router)
app.include_router(contacts.router)
app.include_router(companies.router)
app.include_router(webhooks.router)
app.include_router(automations.router)
app.include_router(tasks.router)
app.include_router(task_rules.router)
app.include_router(roles.router)
app.include_router(reports.router)
app.include_router(misc.router)
app.include_router(workflows.router)
app.include_router(crm_forms.router)
app.include_router(smart_processes.router)

# ── Startup seed ──────────────────────────────────────────────────────────────

_TERMINAL_STAGE_NAMES = {"Negócios Fechados", "Negócios Perdidos", "Analisar falha"}

def _create_default_negocios_stages(db: Session, pipeline_id: int):
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
        db.add(models.Stage(
            name=stg["name"], color=stg["color"], order=i,
            pipeline_id=pipeline_id,
            is_terminal=stg["name"] in _TERMINAL_STAGE_NAMES,
        ))
    db.commit()


@app.on_event("startup")
def startup_event():
    log.info("startup", extra={"cors_origins": config.CORS_ORIGINS, "admin": config.ADMIN_EMAIL})
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
    if db.query(models.Stage).filter(models.Stage.pipeline_id == p_leads.id).count() == 0:
        for i, stg in enumerate(DEFAULT_LEADS_STAGES):
            db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=p_leads.id))
        db.commit()

    p_negocios = db.query(models.Pipeline).filter(models.Pipeline.name == "Negócios").first()
    if not p_negocios:
        p_negocios = models.Pipeline(name="Negócios")
        db.add(p_negocios)
        db.commit()
    if db.query(models.Stage).filter(models.Stage.pipeline_id == p_negocios.id).count() == 0:
        _create_default_negocios_stages(db, p_negocios.id)

    admin = db.query(models.User).filter(models.User.email == config.ADMIN_EMAIL).first()
    if not admin:
        admin = models.User(
            name="Admin",
            email=config.ADMIN_EMAIL,
            role="admin",
            password_hash=hash_password(config.ADMIN_PASSWORD),
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
        if not db.query(models.Role).filter(models.Role.name == rd["name"]).first():
            db.add(models.Role(**rd))
    db.commit()
