import sqlite3
import os

def initialize_database():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(BASE_DIR, 'users.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create the users table if it doesn't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')

    conn.commit()
    conn.close()

    print('Database initialized successfully.')