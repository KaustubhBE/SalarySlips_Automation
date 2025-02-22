import sqlite3

def initialize_database():
    # Connect to the SQLite database (or create it if it doesn't exist)
    conn = sqlite3.connect('users.db')

    # Create a cursor object
    cursor = conn.cursor()

    # Create the users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')

    # Insert sample user data (passwords should be hashed in a real application)
    cursor.execute('''
    INSERT INTO users (username, password, role) VALUES
    ('admin', 'admin_password', 'admin'),
    ('user', 'user_password', 'user')
    ''')

    # Commit the changes and close the connection
    conn.commit()
    conn.close()

if __name__ == "__main__":
    initialize_database()