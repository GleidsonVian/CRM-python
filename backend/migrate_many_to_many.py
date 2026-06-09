"""
Migration: create card_contacts and card_users junction tables,
then migrate existing contact_id / user_id FK data into them.
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "crm.db")
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Create junction tables if missing
cur.executescript("""
CREATE TABLE IF NOT EXISTS card_contacts (
    card_id   INTEGER REFERENCES cards(id)    ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS card_users (
    card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id)  ON DELETE CASCADE
);
""")

# Migrate existing FK data
cur.execute("SELECT id, contact_id, user_id FROM cards WHERE contact_id IS NOT NULL OR user_id IS NOT NULL")
rows = cur.fetchall()
for card_id, contact_id, user_id in rows:
    if contact_id:
        cur.execute(
            "INSERT OR IGNORE INTO card_contacts(card_id, contact_id) VALUES (?,?)",
            (card_id, contact_id)
        )
    if user_id:
        cur.execute(
            "INSERT OR IGNORE INTO card_users(card_id, user_id) VALUES (?,?)",
            (card_id, user_id)
        )

conn.commit()
conn.close()
print("Migration complete.")
