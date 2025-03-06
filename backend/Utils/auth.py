from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from Utils.db_utils import get_db_connection

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password'], password):
        return jsonify({"success": True, "user": dict(user)}), 200
    else:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401