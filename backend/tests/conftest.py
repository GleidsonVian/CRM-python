"""Shared fixtures for all tests."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
import models  # noqa: F401 — registers all models


@pytest.fixture(scope="function")
def db():
    """In-memory SQLite session, rolled back after each test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


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
