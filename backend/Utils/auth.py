from flask import Blueprint, request, jsonify 
from werkzeug.security import check_password_hash
from .firebase_utils import get_user_by_email
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        # Log request headers for CORS debugging
        logger.info("Received login request")
        logger.info("Request headers: {}".format(dict(request.headers)))
        
        data = request.get_json()
        logger.info("Received login data: {}".format(data))
        
        if not data or not data.get('email') or not data.get('password'):
            logger.warning("Missing email or password in request")
            return jsonify({'success': False, 'error': 'Email and password are required'}), 400

        email = data.get('email')
        password = data.get('password')

        # Get user from Firebase
        user = get_user_by_email(email)
        logger.info("Found user for email {}: {}".format(email, user is not None))

        if not user:
            logger.warning("No user found for email: {}".format(email))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        logger.info("Checking password for user: {}".format(email))

        if check_password_hash(user['password_hash'], password):
            user_data = {
                'id': user.get('id'),
                'email': user['email'],
                'role': user['role'],
                'username': user['username'],
                'permissions': user.get('permissions', {})
            }
            logger.info("Login successful for user: {}".format(email))
            return jsonify({'success': True, 'user': user_data}), 200
        
        logger.warning("Invalid password for user: {}".format(email))
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    except Exception as e:
        logger.error("Login error: {}".format(str(e)), exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500