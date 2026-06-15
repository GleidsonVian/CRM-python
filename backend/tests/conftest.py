"""Shared fixtures for all tests."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from database import Base, get_db
import models  # noqa: F401 — registers all models


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Reset in-memory rate limit counters before each test to avoid 429 on repeated logins."""
    from limiter import limiter
    limiter._storage.reset()
    yield


@pytest.fixture(scope="function")
def engine():
    """
    In-memory SQLite engine with StaticPool.

    StaticPool forces all sessions to reuse the same underlying connection,
    so every session (fixture setup + request handlers) sees the same data.
    Without it, each new connection gets a fresh empty database.
    """
    _engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(_engine)
    yield _engine
    Base.metadata.drop_all(_engine)


@pytest.fixture(scope="function")
def db(engine):
    """Session bound to the in-memory engine."""
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(engine, db):
    """
    FastAPI TestClient with get_db overridden to use the same in-memory engine.
    Each request gets its own session (required for thread safety), but all
    sessions share the same engine so fixtures and requests see the same data.
    """
    from main import app

    SessionLocal = sessionmaker(bind=engine)

    def _override_get_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_role(db):
    """A role with full access (v2 format)."""
    role = models.Role(
        name="Administrador",
        permissions={
            "entities": {
                "deal":    {"read": "all", "add": "all", "edit": "all", "delete": "all"},
                "lead":    {"read": "all", "add": "all", "edit": "all", "delete": "all"},
                "contact": {"read": "all", "add": "all", "edit": "all", "delete": "all"},
                "company": {"read": "all", "add": "all", "edit": "all", "delete": "all"},
            },
            "system": {"manage_pipelines": True, "manage_users": True, "view_reports": True},
        },
    )
    db.add(role)
    db.commit()
    return role


@pytest.fixture
def vendedor_role(db):
    """A role restricted to own records only."""
    role = models.Role(
        name="Vendedor",
        permissions={
            "entities": {
                "deal": {"read": "own", "add": "all", "edit": "own", "delete": "deny"},
                "lead": {"read": "own", "add": "all", "edit": "own", "delete": "deny"},
            },
            "system": {"manage_pipelines": False, "manage_users": False, "view_reports": False},
        },
    )
    db.add(role)
    db.commit()
    return role


@pytest.fixture
def pipeline(db):
    p = models.Pipeline(name="Test Pipeline")
    db.add(p)
    db.commit()
    return p


@pytest.fixture
def stage(db, pipeline):
    s = models.Stage(name="Em andamento", color="#3b82f6", order=0, pipeline_id=pipeline.id)
    db.add(s)
    db.commit()
    return s


@pytest.fixture
def card(db, stage):
    c = models.Card(title="Negócio teste", price=1000.0, stage_id=stage.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c
