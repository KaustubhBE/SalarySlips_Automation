from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash
from Utils.firebase_utils import db, get_user_by_email
import logging
import os
import requests
import base64

logger = logging.getLogger(__name__)

# Define auth blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    try:
        data = request.get_json()

        email = data.get('email')
        new_password = data.get('newPassword') or data.get('new_password')

        if not email or not new_password:
            return jsonify({'error': 'Email and new password are required.'}), 400

        user = get_user_by_email(email)
        if not user:
            return jsonify({'error': 'User not found.'}), 404

        user_id = user.get('id')
        password_hash = generate_password_hash(new_password)

        db.collection('USERS').document(user_id).update({'password_hash': password_hash})
        logger.info(f"Password updated for user: {email}")
        return jsonify({'message': 'Password updated successfully.'}), 200

    except Exception as e:
        logger.error(f'Error updating password: {e}', exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        logger.info("Login request received")
        data = request.get_json()

        # Handle optional encrypted payload (e.g. from Google auth)
        if data.get('is_hashed'):
            try:
                import json
                decoded = base64.b64decode(data['payload']).decode('utf-8')
                data = json.loads(decoded)
                logger.info("Decrypted login payload successfully")
            except Exception as e:
                logger.error(f"Failed to decrypt payload: {e}")
                return jsonify({'success': False, 'error': 'Failed to decrypt payload'}), 400

        email = data.get('email')
        password = data.get('password')
        code = data.get('code')  # Google OAuth code
        client_id = data.get('client_id')
        client_secret = data.get('client_secret')

        if not email:
            return jsonify({'success': False, 'error': 'Email is required'}), 400

        user = get_user_by_email(email)
        if not user:
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        if not password or not check_password_hash(user['password_hash'], password):
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # Optional: Handle Google token exchange if `code` is present
        if code:
            try:
                client_id = os.environ.get('GOOGLE_CLIENT_ID')
                client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
                if not client_id or not client_secret:
                    logger.error("Missing Google OAuth client credentials")
                else:
                    token_url = 'https://oauth2.googleapis.com/token'
                    payload = {
                        'code': code,
                        'client_id': client_id,
                        'client_secret': client_secret,
                        'redirect_uri': 'postmessage',
                        'grant_type': 'authorization_code'
                    }
                    r = requests.post(token_url, data=payload)
                    if r.status_code == 200:
                        tokens = r.json()
                        tokens['client_id'] = client_id
                        tokens['client_secret'] = client_secret
                        tokens['token_uri'] = token_url
                        logger.info(f"OAuth tokens received for user: {email}")
                        # You can store tokens in Firestore here if needed
                    else:
                        logger.error(f"Token exchange failed for user {email}: {r.text}")
            except Exception as e:
                logger.error(f"OAuth token error for user {email}: {e}", exc_info=True)

        # Assign default permissions based on role
        role = user.get('role')
        permissions = user.get('permissions') or {}

        if not permissions and role == 'super-admin':
            permissions = {
                'single_processing': True,
                'batch_processing': True,
                'user_management': True,
                'settings_access': True,
                'can_create_admin': True
            }

        user_data = {
            'id': user.get('id'),
            'email': user['email'],
            'role': role,
            'username': user['username'],
            'permissions': permissions
        }

        session['user'] = user_data
        logger.info(f"Login successful: {email}")
        return jsonify({'success': True, 'user': user_data}), 200

    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500