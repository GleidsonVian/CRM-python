"""
Script de migração manual — adiciona colunas novas ao banco existente sem perder dados.
Seguro de rodar múltiplas vezes (ignora colunas já existentes).
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "crm.db")

MIGRATIONS = [
    # (tabela, coluna, tipo_sql)
    ("cards",    "deleted_at",          "DATETIME"),
    ("cards",    "updated_at",          "DATETIME"),
    ("cards",    "stage_changed_by",    "TEXT"),
    ("cards",    "source",              "TEXT"),
    ("cards",    "source_info",         "TEXT"),
    ("cards",    "deal_type",           "TEXT"),
    ("cards",    "start_date",          "TEXT"),
    ("cards",    "available_to_all",    "INTEGER DEFAULT 1"),
    ("cards",    "responsible_user_id", "INTEGER"),
    ("cards",    "observers",           "TEXT"),
    ("cards",    "comment",             "TEXT"),
    ("cards",    "utm_source",          "TEXT"),
    ("cards",    "utm_medium",          "TEXT"),
    ("cards",    "utm_campaign",        "TEXT"),

    ("leads",    "deleted_at",          "DATETIME"),
    ("leads",    "salutation",          "TEXT"),
    ("leads",    "first_name",          "TEXT"),
    ("leads",    "last_name",           "TEXT"),
    ("leads",    "middle_name",         "TEXT"),
    ("leads",    "birth_date",          "TEXT"),
    ("leads",    "position",            "TEXT"),
    ("leads",    "company_name",        "TEXT"),
    ("leads",    "phone",               "TEXT"),
    ("leads",    "email",               "TEXT"),
    ("leads",    "website",             "TEXT"),
    ("leads",    "source_info",         "TEXT"),
    ("leads",    "available_to_all",    "INTEGER DEFAULT 1"),
    ("leads",    "address",             "TEXT"),
    ("leads",    "utm_source",          "TEXT"),
    ("leads",    "utm_medium",          "TEXT"),
    ("leads",    "utm_campaign",        "TEXT"),
    ("leads",    "comment",             "TEXT"),

    ("contacts", "salutation",          "TEXT"),
    ("contacts", "middle_name",         "TEXT"),
    ("contacts", "position",            "TEXT"),
    ("contacts", "website",             "TEXT"),
    ("contacts", "messenger",           "TEXT"),
    ("contacts", "company_name",        "TEXT"),
    ("contacts", "source",              "TEXT"),
    ("contacts", "source_info",         "TEXT"),
    ("contacts", "available_to_all",    "INTEGER DEFAULT 1"),
    ("contacts", "included_in_export",  "INTEGER DEFAULT 1"),
    ("contacts", "contact_type",        "TEXT"),
    ("contacts", "observers",           "TEXT"),
    ("contacts", "comment",             "TEXT"),
    ("contacts", "utm_source",          "TEXT"),
    ("contacts", "utm_medium",          "TEXT"),
    ("contacts", "utm_campaign",        "TEXT"),
    ("contacts", "photo_url",           "TEXT"),
    ("contacts", "responsible_user_id", "INTEGER"),

    ("users",    "password_hash",       "TEXT"),
    ("users",    "is_active",           "INTEGER DEFAULT 1"),
    ("users",    "role_id",             "INTEGER"),

    ("stages",   "color",               "TEXT DEFAULT '#6366f1'"),

    ("webhooks", "type",                "TEXT DEFAULT 'outbound'"),
    ("webhooks", "token",               "TEXT"),
    ("webhooks", "url",                 "TEXT"),
    ("webhooks", "events",              "TEXT DEFAULT '[]'"),
    ("webhooks", "allowed_entities",    "TEXT DEFAULT '[]'"),
    ("webhooks", "allowed_methods",     "TEXT DEFAULT '[\"POST\"]'"),
    ("webhooks", "active",              "INTEGER DEFAULT 1"),
    ("webhooks", "description",         "TEXT"),

    ("custom_fields", "uid",            "TEXT DEFAULT ''"),
    ("custom_fields", "key",            "TEXT DEFAULT ''"),
    ("custom_fields", "required",       "INTEGER DEFAULT 0"),
    ("custom_fields", "show_on_card",   "INTEGER DEFAULT 0"),
    ("custom_fields", "order",          "INTEGER DEFAULT 0"),
]

CREATE_TABLES = [
    """CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT '#6366f1',
        permissions TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        company_number TEXT,
        logo_url TEXT,
        company_type TEXT,
        industry TEXT,
        annual_revenue REAL DEFAULT 0.0,
        phone TEXT,
        email TEXT,
        website TEXT,
        messenger TEXT,
        address TEXT,
        employees TEXT,
        available_to_all INTEGER DEFAULT 1,
        responsible_user_id INTEGER,
        observers TEXT,
        comment TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        last_contact_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS company_contacts (
        company_id INTEGER,
        contact_id INTEGER
    )""",
    """CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT '📁',
        theme_color TEXT DEFAULT '#6366f1',
        privacy TEXT DEFAULT 'public',
        owner_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS project_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        user_id INTEGER,
        role TEXT DEFAULT 'member'
    )""",
    """CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        permissions TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER,
        user_id INTEGER,
        role TEXT DEFAULT 'member'
    )""",
    """CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT DEFAULT '',
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'normal',
        due_date TEXT,
        assigned_to TEXT DEFAULT '',
        participants TEXT DEFAULT '[]',
        done INTEGER DEFAULT 0,
        card_id INTEGER,
        lead_id INTEGER,
        project_id INTEGER,
        parent_task_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS task_time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        user_name TEXT DEFAULT '',
        started_at DATETIME,
        ended_at DATETIME,
        duration_seconds INTEGER DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS stage_required_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stage_id INTEGER,
        field_id INTEGER,
        field_name TEXT DEFAULT '',
        is_custom INTEGER DEFAULT 0
    )""",
    """CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT,
        entity_id INTEGER,
        action TEXT,
        actor_id INTEGER,
        actor_name TEXT DEFAULT '',
        before_data TEXT DEFAULT '{}',
        after_data TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""",
]

def get_existing_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}

def get_existing_tables(cursor):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return {row[0] for row in cursor.fetchall()}

def main():
    print(f"Conectando ao banco: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    existing_tables = get_existing_tables(cur)

    # 1. Criar tabelas novas
    for sql in CREATE_TABLES:
        table_name = sql.split("TABLE IF NOT EXISTS")[1].strip().split()[0]
        cur.execute(sql)
        if table_name not in existing_tables:
            print(f"  ✓ Tabela criada: {table_name}")

    # 2. Adicionar colunas faltantes
    for table, column, col_type in MIGRATIONS:
        if table not in get_existing_tables(cur):
            print(f"  ⚠ Tabela {table} não existe, pulando coluna {column}")
            continue
        existing_cols = get_existing_columns(cur, table)
        if column not in existing_cols:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                print(f"  ✓ {table}.{column} adicionada")
            except Exception as e:
                print(f"  ✗ {table}.{column}: {e}")
        else:
            print(f"  - {table}.{column} já existe")

    conn.commit()
    conn.close()
    print("\nMigração concluída!")

if __name__ == "__main__":
    main()
