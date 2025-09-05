from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash
from Utils.firebase_utils import db, get_user_by_email, get_user_by_email_with_metadata
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

        # Use the new function that fetches complete permission metadata
        user = get_user_by_email_with_metadata(email)
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

        # Get role and complete RBAC structure
        role = user.get('role')
        permissions = user.get('permissions', {})
        tree_permissions = user.get('tree_permissions', {})
        permission_metadata = user.get('permission_metadata', {})
        
        # For admins, give them all permissions and complete metadata
        if role == 'admin':
            permissions = {
                'inventory': True,
                'reports': True,
                'single_processing': True,
                'batch_processing': True,
                'expense_management': True,
                'marketing_campaigns': True,
                'reactor_reports': True
            }
            # Set admin permission metadata to allow access to all factories and departments
            permission_metadata = {
                'factories': ['gulbarga', 'kerur'],
                'departments': {
                    'gulbarga': ['humanresource', 'store', 'marketing', 'accounts', 'reports_department', 'operations_department'],
                    'kerur': ['humanresource', 'store', 'marketing', 'accounts', 'reports_department', 'operations_department']
                },
                'services': {
                    'gulbarga.humanresource': ['single_processing', 'batch_processing', 'reports'],
                    'gulbarga.store': ['inventory', 'reports'],
                    'gulbarga.marketing': ['marketing_campaigns', 'reports'],
                    'gulbarga.accounts': ['expense_management', 'reports'],
                    'gulbarga.reports_department': ['reports', 'reactor_reports'],
                    'gulbarga.operations_department': ['inventory', 'reports', 'reactor_reports'],
                    'kerur.humanresource': ['single_processing', 'batch_processing', 'reports'],
                    'kerur.store': ['inventory', 'reports'],
                    'kerur.marketing': ['marketing_campaigns', 'reports'],
                    'kerur.accounts': ['expense_management', 'reports'],
                    'kerur.reports_department': ['reports', 'reactor_reports'],
                    'kerur.operations_department': ['inventory', 'reports', 'reactor_reports']
                }
            }
        # For regular users, use the existing permission_metadata or convert tree_permissions
        elif not permission_metadata and tree_permissions:
            # Convert tree_permissions to permission_metadata structure
            permission_metadata = {
                'factories': [],
                'departments': {},
                'services': {}
            }
            
            for tree_key, tree_value in tree_permissions.items():
                if isinstance(tree_value, bool) and tree_value:
                    # Parse tree key (e.g., "gulbarga.humanresource.single_processing")
                    parts = tree_key.split('.')
                    if len(parts) >= 3:
                        factory = parts[0]
                        department = parts[1]
                        service = parts[2]
                        
                        # Add factory if not already present
                        if factory not in permission_metadata['factories']:
                            permission_metadata['factories'].append(factory)
                        
                        # Add department to factory
                        if factory not in permission_metadata['departments']:
                            permission_metadata['departments'][factory] = []
                        if department not in permission_metadata['departments'][factory]:
                            permission_metadata['departments'][factory].append(department)
                        
                        # Add service to department
                        service_key = f"{factory}.{department}"
                        if service_key not in permission_metadata['services']:
                            permission_metadata['services'][service_key] = []
                        if service not in permission_metadata['services'][service_key]:
                            permission_metadata['services'][service_key].append(service)
            
            # Also convert to simple permissions for backward compatibility
            permissions = {}
            for tree_key, tree_value in tree_permissions.items():
                if isinstance(tree_value, bool) and tree_value:
                    parts = tree_key.split('.')
                    if len(parts) >= 3:
                        service_name = parts[2]  # e.g., "single_processing"
                        permissions[service_name] = True
            
            # Update user in Firebase with new permission structure
            try:
                from Utils.firebase_utils import db
                user_ref = db.collection('USERS').document(user.get('id'))
                user_ref.update({
                    'permissions': permissions,
                    'permission_metadata': permission_metadata
                })
                logger.info(f"Updated user {email} with permission_metadata: {permission_metadata}")
            except Exception as e:
                logger.error(f"Failed to update user permissions: {e}")
        
        # If still no permissions, set empty objects
        if not permissions:
            permissions = {}
        if not permission_metadata:
            permission_metadata = {}

        user_data = {
            'id': user.get('id'),
            'email': user['email'],
            'role': role,
            'username': user['username'],
            'permissions': permissions,
            'permission_metadata': permission_metadata,
            'tree_permissions': tree_permissions
        }

        session['user'] = user_data
        session.permanent = True  # Make session permanent
        logger.info(f"Login successful: {email}")
        logger.info(f"User permissions: {permissions}")
        logger.info(f"User permission_metadata: {permission_metadata}")
        logger.info(f"User tree_permissions: {tree_permissions}")
        return jsonify({'success': True, 'user': user_data}), 200

    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500