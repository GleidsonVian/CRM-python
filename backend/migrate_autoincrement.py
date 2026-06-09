import sqlite3

def migrate_cards():
    conn = sqlite3.connect('crm.db')
    cursor = conn.cursor()
    
    # 1. Obter a estrutura atual da tabela e criar cards_new com AUTOINCREMENT
    cursor.execute("""
        CREATE TABLE cards_new (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            title VARCHAR,
            description VARCHAR,
            price FLOAT,
            "order" INTEGER,
            stage_id INTEGER,
            contact_id INTEGER,
            created_at DATETIME,
            FOREIGN KEY(stage_id) REFERENCES stages (id),
            FOREIGN KEY(contact_id) REFERENCES contacts (id)
        )
    """)
    
    # 2. Copiar dados
    cursor.execute("""
        INSERT INTO cards_new (id, title, description, price, "order", stage_id, contact_id, created_at)
        SELECT id, title, description, price, "order", stage_id, contact_id, created_at FROM cards
    """)
    
    # 3. Dropar a tabela antiga
    cursor.execute("DROP TABLE cards")
    
    # 4. Renomear a nova
    cursor.execute("ALTER TABLE cards_new RENAME TO cards")
    
    # 5. Criar os índices novamente
    cursor.execute("CREATE INDEX ix_cards_id ON cards (id)")
    cursor.execute("CREATE INDEX ix_cards_title ON cards (title)")
    
    conn.commit()
    conn.close()
    print("Migração concluída com sucesso!")

if __name__ == '__main__':
    migrate_cards()
