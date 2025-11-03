from flask import Blueprint, request, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash
from Utils.firebase_utils import db, get_user_by_email, get_user_by_email_with_metadata, update_user_oauth_tokens, update_user_password
import logging
import os
import requests
import base64
import json
from datetime import datetime
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

logger = logging.getLogger(__name__)

# Define auth blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    try:
        data = request.get_json()

        email = data.get('email')
        current_password = data.get('currentPassword') or data.get('current_password')
        new_password = data.get('newPassword') or data.get('new_password')

        if not email or not current_password or not new_password:
            return jsonify({'error': 'Email, current password, and new password are required.'}), 400

        # Get user from database
        user = get_user_by_email(email)
        if not user:
            return jsonify({'error': 'User not found.'}), 404

        # Verify current password
        stored_password_hash = user.get('password_hash')
        if not stored_password_hash:
            return jsonify({'error': 'No password set for this user.'}), 400

        if not check_password_hash(stored_password_hash, current_password):
            return jsonify({'error': 'Current password is incorrect.'}), 401

        # Check if new password is different from current password
        if check_password_hash(stored_password_hash, new_password):
            return jsonify({'error': 'New password must be different from current password.'}), 400

        # Update password
        user_id = user.get('id')
        logger.info(f"[change_password] Updating password for user_id: {user_id}, email: {email}")
        
        logger.info(f"[change_password] Step 1: Generating password hash...")
        new_password_hash = generate_password_hash(new_password)
        logger.info(f"[change_password] ✅ Password hash generated (length: {len(new_password_hash)})")

        logger.info(f"[change_password] Step 2: Encrypting password for storage...")
        from Utils.password_encryption import encrypt_password
        encrypted_password = encrypt_password(new_password)
        logger.info(f"[change_password] ✅ Password encrypted (length: {len(encrypted_password)})")

        logger.info(f"[change_password] Step 3: Updating user in Firestore...")
        update_user_password(user_id, new_password_hash, encrypted_password)
        logger.info(f"[change_password] ✅ Password update successful")
        logger.info(f"[change_password] Password updated for user: {email}")
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
        
        # For admins, use centralized RBAC configuration
        if role == 'admin':
            # Import the centralized RBAC configuration
            from app import generate_permission_metadata
            permission_metadata = generate_permission_metadata('admin')
            
            # Generate permissions from the centralized configuration
            permissions = {}
            for factory, factory_data in permission_metadata.get('services', {}).items():
                for service in factory_data:
                    permissions[service] = True
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
                        
                        # Add department to factory with factory short form prefix
                        if factory not in permission_metadata['departments']:
                            permission_metadata['departments'][factory] = []
                        
                        # Get factory short form from FACTORY_RBAC_CONFIG
                        from app import FACTORY_RBAC_CONFIG
                        factory_config = FACTORY_RBAC_CONFIG.get(factory, {})
                        factory_short_form = factory_config.get('document_name', factory).lower()
                        
                        prefixed_department = f"{factory_short_form}_{department}"
                        if prefixed_department not in permission_metadata['departments'][factory]:
                            permission_metadata['departments'][factory].append(prefixed_department)
                        
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

@auth_bp.route('/google', methods=['POST'])
def google_auth():
    try:
        logger.info("=== GOOGLE OAUTH REQUEST STARTED ===")
        logger.info("Google OAuth request received")
        data = request.get_json()
        logger.info(f"Request data: {data}")
        
        credential = data.get('credential')
        if not credential:
            logger.error("No credential received")
            return jsonify({'success': False, 'error': 'Google credential is required'}), 400
        
        logger.info(f"Received credential: {credential[:20]}...")
        
        # Get Google OAuth client ID from environment
        google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            logger.error("GOOGLE_CLIENT_ID environment variable not set")
            return jsonify({'success': False, 'error': 'Google OAuth not configured. Please contact administrator.'}), 500
        
        logger.info(f"Processing Google OAuth with client ID: {google_client_id[:10]}...")
        
        try:
            # Verify the Google ID token
            logger.info("Verifying Google ID token...")
            idinfo = id_token.verify_oauth2_token(
                credential, 
                google_requests.Request(), 
                google_client_id
            )
            logger.info(f"Token verified successfully: {idinfo}")
            
            # Extract user information from the token
            email = idinfo.get('email')
            name = idinfo.get('name', '')
            picture = idinfo.get('picture', '')
            
            logger.info(f"Extracted user info - Email: {email}, Name: {name}")
            
            if not email:
                logger.error("No email found in token")
                return jsonify({'success': False, 'error': 'Email not found in Google token'}), 400
            
            logger.info(f"Google OAuth successful for email: {email}")
            
        except ValueError as e:
            logger.error(f"Invalid Google token: {e}")
            return jsonify({'success': False, 'error': 'Invalid Google token'}), 400
        
        # Check if user exists in database by email
        logger.info(f"Looking up user in database for email: {email}")
        user = get_user_by_email_with_metadata(email)
        
        if not user:
            logger.info(f"User not found in database for email: {email}")
            # User doesn't exist - check if they should be allowed to create account
            logger.info(f"User not found in database: {email}")
            
            # Check if email domain is allowed (you can customize this logic)
            email_domain = email.split('@')[1].lower() if '@' in email else ''
            allowed_domains = ['bajajearths.com', 'gmail.com']  # Add your allowed domains
            
            if email_domain not in allowed_domains:
                logger.warning(f"Login attempt from unauthorized domain: {email_domain}")
                return jsonify({
                    'success': False, 
                    'error': f'Login not allowed from {email_domain} domain. Please contact administrator.'
                }), 403
            
            # Generate a random password for the user (they'll use Google OAuth)
            import secrets
            random_password = secrets.token_urlsafe(32)
            password_hash = generate_password_hash(random_password)
            
            # Create user with default permissions
            user_data = {
                'username': name or email.split('@')[0],
                'email': email,
                'role': 'user',  # Default role - can be changed by admin
                'password_hash': password_hash,
                'google_id': idinfo.get('sub'),
                'google_picture': picture,
                'permissions': {},
                'permission_metadata': {
                    'factories': [],
                    'departments': {},
                    'services': {}
                },
                'tree_permissions': {},
                'created_via_google': True,
                'created_at': datetime.now().isoformat()
            }
            
            # Add user to Firebase
            try:
                user_ref = db.collection('USERS').add(user_data)
                user_id = user_ref[1].id
                user_data['id'] = user_id
                user = user_data  # Set user for permission processing
                logger.info(f"Created new user with ID: {user_id} for email: {email}")
            except Exception as e:
                logger.error(f"Failed to create user: {e}")
                return jsonify({'success': False, 'error': 'Failed to create user account. Please contact administrator.'}), 500
        else:
            # User exists - update with Google OAuth data
            logger.info(f"Found existing user for Google OAuth: {email}")
            try:
                user_ref = db.collection('USERS').document(user.get('id'))
                update_data = {
                    'google_id': idinfo.get('sub'),
                    'google_picture': picture,
                    'last_google_login': datetime.now().isoformat()
                }
                user_ref.update(update_data)
                
                # Update local user object
                user['google_id'] = idinfo.get('sub')
                user['google_picture'] = picture
                user['last_google_login'] = update_data['last_google_login']
                
                logger.info(f"Updated existing user with Google OAuth data: {email}")
            except Exception as e:
                logger.error(f"Failed to update user with Google data: {e}")
                # Continue with login even if update fails
        
        # Get user permissions and metadata
        role = user.get('role', 'user')
        permissions = user.get('permissions', {})
        tree_permissions = user.get('tree_permissions', {})
        permission_metadata = user.get('permission_metadata', {})
        
        # For admins, use centralized RBAC configuration
        if role == 'admin':
            # Import the centralized RBAC configuration
            from app import generate_permission_metadata
            permission_metadata = generate_permission_metadata('admin')
            
            # Generate permissions from the centralized configuration
            permissions = {}
            for factory, factory_data in permission_metadata.get('services', {}).items():
                for service in factory_data:
                    permissions[service] = True
        
        # Prepare user data for response
        user_response = {
            'id': user.get('id'),
            'email': user['email'],
            'role': role,
            'username': user['username'],
            'permissions': permissions,
            'permission_metadata': permission_metadata,
            'tree_permissions': tree_permissions,
            'google_picture': user.get('google_picture', picture),
            'has_gmail_access': True  # Indicate that user has Gmail access via Google Sign-In
        }
        
        # Set session
        session['user'] = user_response
        session.permanent = True
        
        logger.info(f"Google OAuth login successful: {email}")
        logger.info(f"User permissions: {permissions}")
        logger.info(f"User permission_metadata: {permission_metadata}")
        logger.info(f"User response: {user_response}")
        
        return jsonify({'success': True, 'user': user_response}), 200
        
    except Exception as e:
        logger.error(f"Google OAuth error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Google authentication failed'}), 500

@auth_bp.route('/google/callback', methods=['POST'])
def google_oauth_callback():
    """Handle Google OAuth callback with authorization code"""
    try:
        logger.info("=== GOOGLE OAUTH CALLBACK STARTED ===")
        logger.info("Google OAuth callback request received")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request headers: {dict(request.headers)}")
        
        data = request.get_json()
        logger.info(f"Request data: {data}")
        
        code = data.get('code') if data else None
        redirect_uri = data.get('redirect_uri') if data else None
        state = data.get('state') if data else None
        
        logger.info(f"Received code: {code[:10] if code else 'None'}...")
        logger.info(f"Redirect URI: {redirect_uri}")
        logger.info(f"State parameter: {state[:10] if state else 'None'}...")
        
        if not code:
            logger.error("No authorization code received")
            return jsonify({'success': False, 'error': 'Authorization code is required'}), 400
        
        if not state:
            logger.warning("No state parameter received - continuing with OAuth flow")
        
        # Get Google OAuth credentials
        google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
        google_client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
        
        if not google_client_id or not google_client_secret:
            logger.error("Google OAuth credentials not configured")
            return jsonify({'success': False, 'error': 'Google OAuth not configured'}), 500
        
        # First, exchange code just to get user identity (email)
        # We'll get a temporary access token to identify the user
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'code': code,
            'client_id': google_client_id,
            'client_secret': google_client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        logger.info(f"Exchanging authorization code to identify user...")
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            logger.error(f"Token exchange failed: {token_response.text}")
            return jsonify({'success': False, 'error': 'Authentication failed. Please try again.'}), 400
        
        tokens = token_response.json()
        temp_access_token = tokens.get('access_token')
        new_refresh_token = tokens.get('refresh_token')  # May or may not be present
        granted_scopes = tokens.get('scope', '').split()
        
        if not temp_access_token:
            return jsonify({'success': False, 'error': 'Authentication failed. Please try again.'}), 400
        
        logger.info(f"Granted scopes: {granted_scopes}")
        
        # Get user info from Google to identify the user
        user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        headers = {'Authorization': f'Bearer {temp_access_token}'}
        
        logger.info(f"Getting user info from Google...")
        user_info_response = requests.get(user_info_url, headers=headers)
        
        if user_info_response.status_code != 200:
            logger.error(f"Failed to get user info: {user_info_response.text}")
            return jsonify({'success': False, 'error': 'Authentication failed. Please try again.'}), 400
        
        user_info = user_info_response.json()
        logger.info(f"User info received: {user_info}")
        
        email = user_info.get('email')
        name = user_info.get('name', '')
        picture = user_info.get('picture', '')
        
        logger.info(f"Extracted email: {email}, name: {name}")
        
        # NOW CHECK: Does this user already have valid credentials in our database?
        logger.info(f"🔍 Checking if user {email} has existing valid credentials...")
        existing_user = get_user_by_email_with_metadata(email)
        
        # Determine which tokens to use
        access_token = temp_access_token
        refresh_token = new_refresh_token
        
        if existing_user:
            existing_access_token = existing_user.get('google_access_token')
            existing_refresh_token = existing_user.get('google_refresh_token')
            
            # If user has existing refresh token, prefer to keep it (more valuable)
            if existing_refresh_token and not new_refresh_token:
                logger.info(f"✅ User has existing refresh token, will keep using it")
                refresh_token = existing_refresh_token
            
            # Check if we got all required scopes
            expected_scopes = [
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.compose',
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive.file'
            ]
            
            has_all_scopes = all(scope in granted_scopes for scope in expected_scopes)
            
            # Check if existing user has all required scopes stored
            existing_has_refresh = bool(existing_refresh_token)
            existing_has_access = bool(existing_access_token)
            
            # If user has existing tokens AND we didn't get new refresh token (meaning no consent was shown)
            # AND user has valid existing credentials, use the existing credentials
            if existing_has_refresh and not new_refresh_token:
                logger.info(f"✅ User has existing valid credentials, using stored tokens (no consent needed)")
                # Don't update tokens, keep existing ones
                access_token = existing_access_token
                refresh_token = existing_refresh_token
            elif not has_all_scopes:
                logger.warning(f"⚠️ Missing required scopes. Requesting full consent...")
                # Return a special response telling frontend to request full consent
                return jsonify({
                    'success': False, 
                    'needs_consent': True,
                    'email': email,
                    'message': 'Additional permissions required. Please grant access.'
                }), 200
        else:
            logger.info(f"ℹ️ User not found - will check if account exists before proceeding")
        
        if not email:
            logger.error("No email found in user info")
            return jsonify({'success': False, 'error': 'Authentication failed. Please try again.'}), 400
        
        # Use the existing_user we already fetched above
        user = existing_user
        
        if not user:
            logger.warning(f"❌ OAuth login attempted for unregistered email: {email}")
            logger.info(f"User not found in database for email: {email} - rejecting authentication")
            return jsonify({
                'success': False, 
                'error': 'Your email address is not registered. Please contact your administrator to create an account.',
                'email_not_registered': True
            }), 403  # 403 Forbidden - user exists but account doesn't
        
        # User exists - update with Google OAuth data
        logger.info(f"Google OAuth successful for email: {email}")
        logger.info(f"Found existing user for Google OAuth: {email}")
        logger.info(f"User details: {user}")
        try:
            user_ref = db.collection('USERS').document(user.get('id'))
            update_data = {
                'google_id': user_info.get('id'),
                'google_picture': picture,
                'google_access_token': access_token,
                'google_refresh_token': refresh_token,
                'last_google_login': datetime.now().isoformat()
            }
            user_ref.update(update_data)
            
            # Update local user object
            user['google_id'] = user_info.get('id')
            user['google_picture'] = picture
            user['google_access_token'] = access_token
            user['google_refresh_token'] = refresh_token
            user['last_google_login'] = update_data['last_google_login']
            
            logger.info(f"Updated existing user with Google OAuth data: {email}")
        except Exception as e:
            logger.error(f"Failed to update user with Google data: {e}")
        
        # Get user permissions and metadata
        role = user.get('role', 'user')
        permissions = user.get('permissions', {})
        tree_permissions = user.get('tree_permissions', {})
        permission_metadata = user.get('permission_metadata', {})
        
        # For admins, use centralized RBAC configuration
        if role == 'admin':
            # Import the centralized RBAC configuration
            from app import generate_permission_metadata
            permission_metadata = generate_permission_metadata('admin')
            
            # Generate permissions from the centralized configuration
            permissions = {}
            for factory, factory_data in permission_metadata.get('services', {}).items():
                for service in factory_data:
                    permissions[service] = True
        
        # Prepare user data for response
        user_response = {
            'id': user.get('id'),
            'email': user['email'],
            'role': role,
            'username': user['username'],
            'permissions': permissions,
            'permission_metadata': permission_metadata,
            'tree_permissions': tree_permissions,
            'google_picture': user.get('google_picture', picture),
            'has_gmail_access': bool(access_token),  # Indicate if user has Gmail permissions
            'has_sheets_access': 'https://www.googleapis.com/auth/spreadsheets' in granted_scopes,
            'has_drive_access': 'https://www.googleapis.com/auth/drive.file' in granted_scopes,
            'granted_scopes': granted_scopes
        }
        
        # Store OAuth tokens in Firebase
        try:
            update_user_oauth_tokens(
                user.get('id'), 
                access_token, 
                refresh_token, 
                granted_scopes
            )
            logger.info(f"Stored OAuth tokens for user: {email}")
        except Exception as e:
            logger.error(f"Failed to store OAuth tokens for user {email}: {e}")
            # Continue with login even if token storage fails
        
        # Set session
        session['user'] = user_response
        session.permanent = True
        
        logger.info(f"Google OAuth with Gmail permissions successful: {email}")
        logger.info(f"User permissions: {permissions}")
        logger.info(f"Gmail access token available: {bool(access_token)}")
        logger.info(f"Sheets access available: {user_response.get('has_sheets_access', False)}")
        logger.info(f"Drive access available: {user_response.get('has_drive_access', False)}")
        
        return jsonify({'success': True, 'user': user_response}), 200
        
    except Exception as e:
        logger.error(f"Google OAuth callback error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Google OAuth callback failed'}), 500

@auth_bp.route('/google/config', methods=['GET'])
def google_config():
    """Debug endpoint to check Google OAuth configuration"""
    try:
        google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
        return jsonify({
            'success': True,
            'google_configured': bool(google_client_id),
            'client_id_prefix': google_client_id[:10] + '...' if google_client_id else None,
            'message': 'Google OAuth configuration check'
        }), 200
    except Exception as e:
        logger.error(f"Google config check error: {e}")
        return jsonify({'success': False, 'error': 'Configuration check failed'}), 500

@auth_bp.route('/google/check-credentials', methods=['POST'])
def check_google_credentials():
    """Check if user has valid Google OAuth credentials stored in database"""
    try:
        logger.info("=== CHECK GOOGLE CREDENTIALS REQUEST ===")
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            logger.warning("No email provided for credential check")
            return jsonify({'valid': False, 'needsAuth': True, 'error': 'Email is required'}), 400
        
        logger.info(f"Checking credentials for email: {email}")
        
        # Get user from database
        user = get_user_by_email_with_metadata(email)
        
        if not user:
            logger.info(f"User not found in database: {email}")
            return jsonify({'valid': False, 'needsAuth': True, 'error': 'User not found'}), 200
        
        # Check if user has Google OAuth tokens
        access_token = user.get('google_access_token')
        refresh_token = user.get('google_refresh_token')
        
        if not access_token and not refresh_token:
            logger.info(f"No Google OAuth tokens found for user: {email}")
            return jsonify({'valid': False, 'needsAuth': True, 'message': 'No OAuth tokens found'}), 200
        
        # If refresh token exists, credentials are valid (we can always get new access token)
        if refresh_token:
            logger.info(f"Valid refresh token found for user: {email}")
            return jsonify({
                'valid': True, 
                'needsAuth': False,
                'user': {
                    'email': email,
                    'username': user.get('username'),
                    'has_refresh_token': True
                }
            }), 200
        
        # If only access token exists, check if it's expired
        # Note: We'll assume it's valid if it exists, actual validation happens during use
        if access_token:
            logger.info(f"Access token found for user: {email}")
            return jsonify({
                'valid': True, 
                'needsAuth': False,
                'user': {
                    'email': email,
                    'username': user.get('username'),
                    'has_access_token': True
                }
            }), 200
        
        # No valid tokens found
        logger.info(f"No valid credentials for user: {email}")
        return jsonify({'valid': False, 'needsAuth': True, 'message': 'Credentials expired or invalid'}), 200
        
    except Exception as e:
        logger.error(f"Error checking Google credentials: {e}", exc_info=True)
        return jsonify({'valid': False, 'needsAuth': True, 'error': 'Internal server error'}), 500

@auth_bp.route('/google/login-stored', methods=['POST'])
def login_with_stored_credentials():
    """Login user using stored Google OAuth credentials without requiring OAuth consent"""
    try:
        logger.info("=== LOGIN WITH STORED CREDENTIALS REQUEST ===")
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            logger.warning("No email provided for login")
            return jsonify({'success': False, 'error': 'Email is required'}), 400
        
        logger.info(f"Attempting login with stored credentials for: {email}")
        
        # Get user from database with full metadata
        user = get_user_by_email_with_metadata(email)
        
        if not user:
            logger.warning(f"User not found: {email}")
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Verify user has valid Google OAuth tokens
        access_token = user.get('google_access_token')
        refresh_token = user.get('google_refresh_token')
        
        if not access_token and not refresh_token:
            logger.warning(f"No valid OAuth tokens for user: {email}")
            return jsonify({'success': False, 'error': 'No valid OAuth credentials found. Please sign in with Google.'}), 401
        
        # Get user permissions and metadata
        role = user.get('role', 'user')
        permissions = user.get('permissions', {})
        tree_permissions = user.get('tree_permissions', {})
        permission_metadata = user.get('permission_metadata', {})
        
        # For admins, use centralized RBAC configuration
        if role == 'admin':
            try:
                from app import generate_permission_metadata
                permission_metadata = generate_permission_metadata('admin')
                
                # Generate permissions from the centralized configuration
                permissions = {}
                for factory, factory_data in permission_metadata.get('services', {}).items():
                    for service in factory_data:
                        permissions[service] = True
            except Exception as e:
                logger.error(f"Error generating admin permissions: {e}")
        
        # Prepare user data for response
        user_response = {
            'id': user.get('id'),
            'email': user['email'],
            'role': role,
            'username': user['username'],
            'permissions': permissions,
            'permission_metadata': permission_metadata,
            'tree_permissions': tree_permissions,
            'google_picture': user.get('google_picture', ''),
            'has_gmail_access': bool(access_token or refresh_token),
            'has_sheets_access': bool(access_token or refresh_token),
            'has_drive_access': bool(access_token or refresh_token)
        }
        
        # Update last login timestamp
        try:
            user_ref = db.collection('USERS').document(user.get('id'))
            user_ref.update({
                'last_google_login': datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to update last login timestamp: {e}")
        
        # Set session
        session['user'] = user_response
        session.permanent = True
        
        logger.info(f"Login with stored credentials successful: {email}")
        logger.info(f"User has Gmail access: {user_response['has_gmail_access']}")
        
        return jsonify({'success': True, 'user': user_response}), 200
        
    except Exception as e:
        logger.error(f"Login with stored credentials error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': 'Internal server error'}), 500