import sqlite3
import os
from werkzeug.security import generate_password_hash

def initialize_database():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(BASE_DIR, '..', 'users.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Drop the users table if it exists
    cursor.execute('DROP TABLE IF EXISTS users')

    # Create the users table with the correct schema
    cursor.execute('''
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')

    # Hash the passwords
    admin_password = generate_password_hash('admin_password')
    user_password = generate_password_hash('user_password')
    kaustubh_password = generate_password_hash('K@ustubh2003')

    # Insert initial users into the users table
    cursor.execute('''
    INSERT INTO users (username, email, password, role) VALUES
    (?, ?, ?, ?),
    (?, ?, ?, ?),
    (?, ?, ?, ?)
    ''', ('admin', 'admin@example.com', admin_password, 'admin',
          'user', 'user@example.com', user_password, 'user',
          'kaustubh', 'kaustubh@bajajearths.com', kaustubh_password, 'admin'))

    conn.commit()
    conn.close()

    print('Database initialized successfully.')