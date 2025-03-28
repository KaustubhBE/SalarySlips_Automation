from flask import Blueprint, request, jsonify 
from werkzeug.security import check_password_hash
import sqlite3
import os

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        print("Received login data:", data)  # Debug print
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400

        email = data.get('email')
        password = data.get('password')

        # Get database connection
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(BASE_DIR, 'users.db')
        
        print(f"Attempting to connect to database at: {db_path}")  # Debug print
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get user from database
        cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        
        print("Found user:", dict(user) if user else None)  # Debug print

        if not user:
            conn.close()
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        user_dict = dict(user)
        print("Checking password for user:", email)  # Debug print

        if check_password_hash(user_dict['password'], password):
            user_data = {
                'id': user_dict['id'],
                'email': user_dict['email'],
                'role': user_dict['role'],
                'username': user_dict['username']
            }
            conn.close()
            return jsonify({'success': True, 'user': user_data}), 200
        
        conn.close()
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    except Exception as e:
        print(f"Login error: {str(e)}")  # Debug print
        return jsonify({'success': False, 'error': str(e)}), 500

# Add a route to check database connection
@auth_bp.route('/check-db', methods=['GET'])
def check_db():
    try:
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(BASE_DIR, 'users.db')
        
        if not os.path.exists(db_path):
            return jsonify({'success': False, 'error': 'Database file not found'}), 404

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if users table exists and has data
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        # Get all users (for debugging)
        cursor.execute("SELECT email, role FROM users")
        users = cursor.fetchall()
        
        conn.close()
        
        return jsonify({'success': True, 'user_count': user_count, 'users': [{'email': user[0], 'role': user[1]} for user in users]}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
