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
        logger.info("Received login request")
        logger.info("Request headers: {}".format(dict(request.headers)))
        data = request.get_json()
        logger.info("Received login data: {}".format(data))

        # Decrypt payload if it is hashed/encrypted (assume base64 for example)
        if data.get('is_hashed'):
            try:
                # Assume the payload is base64 encoded JSON string in 'payload' key
                import json
                decoded = base64.b64decode(data['payload']).decode('utf-8')
                data = json.loads(decoded)
                logger.info("Decrypted payload: {}".format(data))
            except Exception as e:
                logger.error(f"Failed to decrypt payload: {e}")
                return jsonify({'success': False, 'error': 'Failed to decrypt payload'}), 400

        login_type = data.get('login_type', 'normal')
        email = data.get('email')
        password = data.get('password')
        code = data.get('code')  # For OAuth2 code flow
        client_id = data.get('client_id')
        client_secret = data.get('client_secret')

        if login_type == 'gauth':
            if not code:
                logger.warning("Missing OAuth2 code for gauth login")
                return jsonify({'success': False, 'error': 'OAuth2 code is required for gauth login'}), 400
            try:
                # Exchange code for tokens
                token_url = 'https://oauth2.googleapis.com/token'
                payload = {
                    'code': code,
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'redirect_uri': 'postmessage',
                    'grant_type': 'authorization_code'
                }
                r = requests.post(token_url, data=payload)
                if r.status_code != 200:
                    logger.error(f"Failed to exchange code: {r.text}")
                    return jsonify({'success': False, 'error': 'Failed to exchange code', 'details': r.text}), 401
                tokens = r.json()
                tokens['client_id'] = payload['client_id']
                tokens['client_secret'] = payload['client_secret']
                tokens['token_uri'] = token_url
                id_token_jwt = tokens.get('id_token')
                if not id_token_jwt:
                    logger.error("No id_token in token response")
                    return jsonify({'success': False, 'error': 'No id_token in token response'}), 401
                # Decode the id_token to get the email
                idinfo = jwt.decode(id_token_jwt, options={"verify_signature": False})
                email = idinfo.get('email')
                if not email:
                    logger.error("No email in id_token")
                    return jsonify({'success': False, 'error': 'No email in id_token'}), 401
                # Match client_id and client_secret with those in Firestore
                stored_client_id, stored_client_secret = get_user_client_credentials(email)
                if stored_client_id != client_id or stored_client_secret != client_secret:
                    logger.warning(f"Client credentials do not match for user: {email}")
                    return jsonify({'success': False, 'error': 'Invalid client credentials'}), 401
                user = get_user_by_email(email)
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
                        permissions = {}
                update_user_token(user['id'], tokens)
                user_data = {
                    'id': user.get('id'),
                    'email': user['email'],
                    'role': role,
                    'username': user['username'],
                    'permissions': permissions
                }
                session['user'] = user_data
                logger.info("Login successful for user: {} (gauth-oauth2)".format(email))
                return jsonify({'success': True, 'user': user_data}), 200
            except Exception as e:
                logger.error(f"OAuth2 code exchange failed: {e}")
                return jsonify({'success': False, 'error': 'OAuth2 code exchange failed'}), 401

        # Normal login flow (unchanged)
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
                session['user'] = user_data
                logger.info("Login successful for user: {} (normal)".format(email))
                return jsonify({'success': True, 'user': user_data}), 200
            logger.warning("Invalid password for user: {}".format(email))
            return jsonify({'success': False, 'error': 'Invalid email or password'}), 401
        else:
            logger.warning(f"Unknown login_type: {login_type}")
            return jsonify({'success': False, 'error': 'Unknown login type'}), 400
    except Exception as e:
        logger.error("Login error: {}".format(str(e)), exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

