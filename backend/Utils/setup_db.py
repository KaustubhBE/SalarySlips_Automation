import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

def initialize_database():
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(BASE_DIR, 'users.db')
        
        print(f"Creating database at: {db_path}")
        
        # Create database directory if it doesn't exist
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Create the users table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user'
        )
        ''')

        # Check if admin user exists
        cursor.execute('SELECT * FROM users WHERE email = ?', ('kaustubh@bajajearths.com',))
        admin_exists = cursor.fetchone()

        # If admin doesn't exist, create default admin user
        if not admin_exists:
            password = 'K@ustubh2003'
            hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
            
            cursor.execute('''
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, ?)
            ''', ('Kaustubh', 'kaustubh@bajajearths.com', hashed_password, 'admin'))

            print('Default admin user created successfully.')
            print(f'Email: kaustubh@bajajearths.com')
            print(f'Password: {password}')

        # Verify the user was created and password hash is working
        cursor.execute('SELECT * FROM users WHERE email = ?', ('kaustubh@bajajearths.com',))
        user = cursor.fetchone()
        if user:
            print("Verified admin user exists in database")
            # Test password verification
            test_password = 'K@ustubh2003'
            if check_password_hash(user['password'], test_password):
                print("Password hash verification successful")
            else:
                print("WARNING: Password hash verification failed")
        
        # Print all users for debugging (remove in production)
        print("\nCurrent users in database:")
        cursor.execute('SELECT id, username, email, role FROM users')
        for user in cursor.fetchall():
            print(f"ID: {user['id']}, Username: {user['username']}, Email: {user['email']}, Role: {user['role']}")
        
        conn.commit()
        conn.close()
        print('Database initialized successfully.')
        
    except Exception as e:
        print(f'Error initializing database: {str(e)}')
        raise

if __name__ == "__main__":
    initialize_database()