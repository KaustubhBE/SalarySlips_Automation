from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash
from Utils.firebase_utils import get_user_by_email, update_user_token, get_user_client_credentials
import logging
import os
import requests
import jwt
import base64

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        # Only log the start of the login process
        logger.info("Login process started")
        data = request.get_json()

        # Decrypt payload if it is hashed/encrypted (assume base64 for example)
        if data.get('is_hashed'):
            try:
                import json
                decoded = base64.b64decode(data['payload']).decode('utf-8')
                data = json.loads(decoded)
                logger.info("Payload decrypted successfully")
            except Exception as e:
                logger.error(f"Failed to decrypt payload: {e}")
                return jsonify({'success': False, 'error': 'Failed to decrypt payload'}), 400

        email = data.get('email')
        password = data.get('password')
        code = data.get('code')  # For OAuth2 code flow
        client_id = data.get('client_id')
        client_secret = data.get('client_secret')

        # Remove the special gauth block; handle all logins the same way
        # (Authenticate with email/password, store Google tokens if present)

        if not data or not email:
            logger.warning("Missing email in request")
            return jsonify({'success': False, 'error': 'Email is required'}), 400

        user = get_user_by_email(email)
        if not user:
            logger.warning("No user found for email: {}".format(email))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # Check password
        if not password or not check_password_hash(user['password_hash'], password):
            logger.warning("Invalid password for user: {}".format(email))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

        # If Google OAuth tokens are present in the payload, store them in Firebase (after successful login)
        google_tokens = {}
        for key in ['id_token', 'access_token', 'refresh_token', 'scope', 'token_type', 'token_uri']:
            if key in data:
                google_tokens[key] = data[key]
        if google_tokens:
            try:
                update_user_token(user['id'], google_tokens)
                logger.info(f"Uploaded Google tokens for user: {email}")
            except Exception as e:
                logger.error(f"Error uploading Google tokens for user {email}: {e}")

        # Continue with login success as before
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
                permissions = {}
        user_data = {
            'id': user.get('id'),
            'email': user['email'],
            'role': role,
            'username': user['username'],
            'permissions': permissions
        }
        session['user'] = user_data
        logger.info(f"Login successful for user: {email} (email/password only)")
        return jsonify({'success': True, 'user': user_data}), 200
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

