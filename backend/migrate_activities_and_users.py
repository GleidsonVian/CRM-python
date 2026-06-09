import sqlite3

def migrate():
    conn = sqlite3.connect('crm.db')
    cursor = conn.cursor()
    
    # 1. Create Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            name VARCHAR,
            email VARCHAR UNIQUE,
            role VARCHAR
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_name ON users (name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    
    # 2. Create Activities Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER,
            type VARCHAR,
            content VARCHAR,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(card_id) REFERENCES cards (id)
        )
    """)
    
    # 3. Add user_id to cards if not exists
    try:
        cursor.execute("ALTER TABLE cards ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError as e:
        # Ignore if column already exists
        if "duplicate column name" not in str(e).lower():
            raise e
            
    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == '__main__':
    migrate()
