"""consolidate legacy inline migrations from main.py

Revision ID: c3d4e5f6a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-18

Captures every ALTER TABLE / CREATE TABLE that was previously executed
inline on every startup inside main.py's _MIGRATIONS block.
SQLite does not support ADD COLUMN IF NOT EXISTS, so we check
PRAGMA table_info() before each ALTER TABLE.
"""
import sqlalchemy as sa
from alembic import op

revision = 'c3d4e5f6a1b2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def _existing_columns(conn, table: str) -> set:
    rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add_column_if_missing(conn, table: str, col: str, definition: str, existing: set):
    if col not in existing:
        conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))


def upgrade():
    conn = op.get_bind()

    activities = _existing_columns(conn, "activities")
    _add_column_if_missing(conn, "activities", "actor",   "VARCHAR DEFAULT 'Usuário'",          activities)
    _add_column_if_missing(conn, "activities", "lead_id", "INTEGER REFERENCES leads(id)",        activities)

    custom_fields = _existing_columns(conn, "custom_fields")
    _add_column_if_missing(conn, "custom_fields", "uid",          "VARCHAR DEFAULT ''",  custom_fields)
    _add_column_if_missing(conn, "custom_fields", "show_on_card", "BOOLEAN DEFAULT 0",  custom_fields)

    leads = _existing_columns(conn, "leads")
    for col, defn in [
        ("salutation",    "VARCHAR"),
        ("first_name",    "VARCHAR"),
        ("last_name",     "VARCHAR"),
        ("middle_name",   "VARCHAR"),
        ("birth_date",    "VARCHAR"),
        ("position",      "VARCHAR"),
        ("company_name",  "VARCHAR"),
        ("phone",         "VARCHAR"),
        ("email",         "VARCHAR"),
        ("website",       "VARCHAR"),
        ("source_info",   "VARCHAR"),
        ("available_to_all", "BOOLEAN DEFAULT 1"),
        ("address",       "VARCHAR"),
        ("utm_source",    "VARCHAR"),
        ("utm_medium",    "VARCHAR"),
        ("utm_campaign",  "VARCHAR"),
        ("comment",       "VARCHAR"),
    ]:
        _add_column_if_missing(conn, "leads", col, defn, leads)

    contacts = _existing_columns(conn, "contacts")
    for col, defn in [
        ("salutation",          "VARCHAR"),
        ("middle_name",         "VARCHAR"),
        ("position",            "VARCHAR"),
        ("website",             "VARCHAR"),
        ("messenger",           "VARCHAR"),
        ("company_name",        "VARCHAR"),
        ("source",              "VARCHAR"),
        ("source_info",         "VARCHAR"),
        ("available_to_all",    "BOOLEAN DEFAULT 1"),
        ("included_in_export",  "BOOLEAN DEFAULT 1"),
        ("contact_type",        "VARCHAR"),
        ("observers",           "VARCHAR"),
        ("comment",             "VARCHAR"),
        ("utm_source",          "VARCHAR"),
        ("utm_medium",          "VARCHAR"),
        ("utm_campaign",        "VARCHAR"),
        ("photo_url",           "VARCHAR"),
        ("responsible_user_id", "INTEGER REFERENCES users(id)"),
    ]:
        _add_column_if_missing(conn, "contacts", col, defn, contacts)

    cards = _existing_columns(conn, "cards")
    for col, defn in [
        ("updated_at",          "DATETIME"),
        ("stage_changed_by",    "VARCHAR"),
        ("source",              "VARCHAR"),
        ("source_info",         "VARCHAR"),
        ("deal_type",           "VARCHAR"),
        ("start_date",          "VARCHAR"),
        ("available_to_all",    "BOOLEAN DEFAULT 1"),
        ("responsible_user_id", "INTEGER REFERENCES users(id)"),
        ("observers",           "VARCHAR"),
        ("comment",             "VARCHAR"),
        ("utm_source",          "VARCHAR"),
        ("utm_medium",          "VARCHAR"),
        ("utm_campaign",        "VARCHAR"),
    ]:
        _add_column_if_missing(conn, "cards", col, defn, cards)

    companies = _existing_columns(conn, "companies")
    for col, defn in [
        ("utm_source",      "VARCHAR"),
        ("utm_medium",      "VARCHAR"),
        ("utm_campaign",    "VARCHAR"),
        ("last_contact_at", "DATETIME"),
    ]:
        _add_column_if_missing(conn, "companies", col, defn, companies)

    users = _existing_columns(conn, "users")
    for col, defn in [
        ("password_hash", "VARCHAR"),
        ("is_active",     "BOOLEAN DEFAULT 1"),
        ("role_id",       "INTEGER REFERENCES roles(id) ON DELETE SET NULL"),
    ]:
        _add_column_if_missing(conn, "users", col, defn, users)

    automation_rules = _existing_columns(conn, "automation_rules")
    _add_column_if_missing(conn, "automation_rules", "entity_type", "VARCHAR DEFAULT 'deal'", automation_rules)

    stages = _existing_columns(conn, "stages")
    _add_column_if_missing(conn, "stages", "is_terminal", "BOOLEAN DEFAULT 0", stages)

    # New tables (all idempotent via CREATE TABLE IF NOT EXISTS)
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR NOT NULL,
        description VARCHAR DEFAULT '',
        color VARCHAR DEFAULT '#6366f1',
        permissions VARCHAR DEFAULT '{}',
        created_at DATETIME DEFAULT (datetime('now'))
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS audit_logs (
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
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
        event VARCHAR,
        status_code INTEGER,
        response_body VARCHAR,
        latency_ms INTEGER,
        success BOOLEAN DEFAULT 0,
        error_message VARCHAR,
        created_at DATETIME DEFAULT (datetime('now'))
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS stage_required_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stage_id INTEGER REFERENCES stages(id) ON DELETE CASCADE,
        field_type VARCHAR,
        field_key VARCHAR,
        custom_field_id INTEGER REFERENCES custom_fields(id) ON DELETE CASCADE
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS workflow_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR,
        description VARCHAR DEFAULT '',
        entity_type VARCHAR DEFAULT 'deal',
        pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now'))
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS workflow_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER REFERENCES workflow_templates(id) ON DELETE CASCADE,
        step_order INTEGER DEFAULT 0,
        action_type VARCHAR,
        action_config VARCHAR DEFAULT '{}'
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS workflow_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER REFERENCES workflow_templates(id) ON DELETE SET NULL,
        template_name VARCHAR DEFAULT '',
        card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
        executed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        executed_by_name VARCHAR DEFAULT '',
        executed_at DATETIME DEFAULT (datetime('now')),
        status VARCHAR DEFAULT 'completed',
        result_log VARCHAR DEFAULT '[]'
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS crm_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR DEFAULT 'Novo formulário',
        uid VARCHAR UNIQUE,
        entity_type VARCHAR DEFAULT 'lead',
        pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE SET NULL,
        stage_id INTEGER REFERENCES stages(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT 1,
        title VARCHAR DEFAULT '',
        subtitle VARCHAR DEFAULT '',
        button_text VARCHAR DEFAULT 'Enviar',
        success_message VARCHAR DEFAULT 'Obrigado! Sua resposta foi registrada.',
        fields_config VARCHAR DEFAULT '[]',
        created_at DATETIME DEFAULT (datetime('now'))
    )"""))
    conn.execute(sa.text("""CREATE TABLE IF NOT EXISTS crm_form_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER REFERENCES crm_forms(id) ON DELETE SET NULL,
        form_uid VARCHAR,
        form_name VARCHAR DEFAULT '',
        entity_type VARCHAR,
        entity_id INTEGER,
        data VARCHAR DEFAULT '{}',
        submitted_at DATETIME DEFAULT (datetime('now'))
    )"""))

    # Backfill terminal stage flag
    conn.execute(sa.text(
        "UPDATE stages SET is_terminal=1 "
        "WHERE name IN ('Negócios Fechados','Negócios Perdidos','Analisar falha') "
        "AND (is_terminal IS NULL OR is_terminal=0)"
    ))


def downgrade():
    # Legacy structural changes — downgrade is intentionally a no-op.
    pass
