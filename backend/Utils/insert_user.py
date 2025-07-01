import sqlite3
from werkzeug.security import generate_password_hash
import os

# Define the user details
username = 'kaustubh'
email = 'kaustubh@bajajearths.com'
password = 'K@ustubh2003'
role = 'admin'

# Hash the password
hashed_password = generate_password_hash(password)

# Define the path to the database file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, 'users.db')

# Connect to the SQLite database
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

# Check if the user already exists
cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
existing_user = cursor.fetchone()

if existing_user:
    print('User with this email already exists.')
else:
    # Insert the user into the users table
    cursor.execute('''
    INSERT INTO users (username, email, password, role)
    VALUES (?, ?, ?, ?)
    ''', (username, email, hashed_password, role))
    conn.commit()
    print('User inserted successfully.')

# Close the connection
conn.close()