from database import engine
from sqlalchemy import text
import models

# Create any new tables (projects, project_members, teams, team_members, task_time_entries)
models.Base.metadata.create_all(bind=engine)

migrations = [
    "ALTER TABLE tasks ADD COLUMN uid VARCHAR DEFAULT ''",
    "ALTER TABLE tasks ADD COLUMN status VARCHAR DEFAULT 'todo'",
    "ALTER TABLE tasks ADD COLUMN priority VARCHAR DEFAULT 'normal'",
    "ALTER TABLE tasks ADD COLUMN participants VARCHAR DEFAULT '[]'",
    "ALTER TABLE tasks ADD COLUMN lead_id INTEGER REFERENCES leads(id)",
    "ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id)",
    "ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER REFERENCES tasks(id)",
    "ALTER TABLE tasks ADD COLUMN updated_at DATETIME",
]
with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            conn.commit()
            print("OK:", sql[:60])
        except Exception as e:
            print("Skip:", str(e)[:80])
    # Migrate done boolean -> status
    try:
        conn.execute(text("UPDATE tasks SET status='done' WHERE done=1 AND (status IS NULL OR status='')"))
        conn.execute(text("UPDATE tasks SET status='todo' WHERE done=0 AND (status IS NULL OR status='')"))
        conn.commit()
        print("OK: migrated done->status")
    except Exception as e:
        print("Skip:", str(e)[:80])

print("All done.")
