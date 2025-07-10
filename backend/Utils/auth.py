from flask import Blueprint, request, jsonify 
from werkzeug.security import check_password_hash
from Utils.firebase_utils import get_user_by_email, update_user_token
import logging

# Add imports for Google ID token verification
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        logger.info("Received login request")
        logger.info("Request headers: {}".format(dict(request.headers)))
        data = request.get_json()
        logger.info("Received login data: {}".format(data))

        login_type = data.get('login_type', 'normal')
        email = data.get('email')
        password = data.get('password')
        token = data.get('token')

        

        if not data or not email:
            logger.warning("Missing email in request")
            return jsonify({'success': False, 'error': 'Email is required'}), 400

        user = get_user_by_email(email)
        logger.info("Found user for email {}: {}".format(email, user is not None))

        if not user:
            logger.warning("No user found for email: {}".format(email))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # Ensure permissions are always set based on role if missing
        role = user.get('role')
        permissions = user.get('permissions')
        if not permissions:
            if role == 'super-admin':
                permissions = {
                    'single_processing': True,
                    'batch_processing': True,
                    'user_management': True,
                    'settings_access': True,
                    'can_create_admin': True
                }
            else:
                # For admin and user, leave as empty dict if missing (dynamic)
                permissions = {}

        if login_type == 'normal':
            if not password:
                logger.warning("Missing password for normal login")
                return jsonify({'success': False, 'error': 'Password is required for normal login'}), 400
            logger.info("Checking password for user: {}".format(email))
            if check_password_hash(user['password_hash'], password):
                user_data = {
                    'id': user.get('id'),
                    'email': user['email'],
                    'role': role,
                    'username': user['username'],
                    'permissions': permissions
                }
                logger.info("Login successful for user: {} (normal)".format(email))
                return jsonify({'success': True, 'user': user_data}), 200
            logger.warning("Invalid password for user: {}".format(email))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401
        elif login_type == 'gauth':
            if not token:
                logger.warning("Missing Google token for gauth login")
                return jsonify({'success': False, 'error': 'Google token is required for gauth login'}), 400
            try:
                # Verify the Google ID token
                CLIENT_ID = '579518246340-0673etiich0q7ji2q6imu7ln525554ab.apps.googleusercontent.com'  # <-- Use your actual client ID
                idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), CLIENT_ID)
                if idinfo['email'] != email:
                    logger.warning("Email in Google token does not match request email")
                    return jsonify({'success': False, 'error': 'Google token email mismatch'}), 401
                # Store the Google token in Firestore as soon as it is received and verified
                update_user_token(user['id'], token)
                user_data = {
                    'id': user.get('id'),
                    'email': user['email'],
                    'role': role,
                    'username': user['username'],
                    'permissions': permissions
                }
                logger.info("Login successful for user: {} (gauth)".format(email))
                return jsonify({'success': True, 'user': user_data}), 200
            except Exception as e:
                logger.error(f"Google token verification failed: {e}")
                return jsonify({'success': False, 'error': 'Invalid Google token'}), 401
        else:
            logger.warning(f"Unknown login_type: {login_type}")
            return jsonify({'success': False, 'error': 'Unknown login type'}), 400
    except Exception as e:
        logger.error("Login error: {}".format(str(e)), exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

