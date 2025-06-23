import os
import json
import logging
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import pickle
from functools import wraps
from flask import session, redirect, url_for, request, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

# OAuth2 client configuration
CLIENT_SECRETS_FILE = os.path.join(os.path.dirname(__file__), "client_secrets.json")

def validate_email_domain(email):
    """Validate that the email is from an allowed domain."""
    allowed_domains = ['gmail.com', 'bajajearths.com']
    domain = email.split('@')[-1].lower()
    return domain in allowed_domains

def get_oauth2_client():
    """Create OAuth2 client configuration."""
    try:
        with open(CLIENT_SECRETS_FILE, 'r') as f:
            client_config = json.load(f)
        return client_config
    except Exception as e:
        logger.error("Error loading client secrets: {}".format(e))
        return None

def create_oauth2_flow(redirect_uri):
    """Create OAuth2 flow instance."""
    try:
        client_config = get_oauth2_client()
        if not client_config:
            return None
            
        flow = Flow.from_client_config(
            client_config,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        return flow
    except Exception as e:
        logger.error("Error creating OAuth2 flow: {}".format(e))
        return None

def get_credentials_path(email):
    """Get the path for storing user credentials."""
    credentials_dir = os.path.join(os.path.dirname(__file__), 'credentials')
    os.makedirs(credentials_dir, exist_ok=True)
    return os.path.join(credentials_dir, "{}.json".format(email))

def load_credentials(email):
    """Load user credentials from file."""
    try:
        credentials_path = get_credentials_path(email)
        if os.path.exists(credentials_path):
            with open(credentials_path, 'r') as f:
                creds_data = json.load(f)
            return Credentials.from_authorized_user_info(creds_data)
        return None
    except Exception as e:
        logger.error("Error loading credentials: {}".format(e))
        return None

def save_credentials(email, credentials):
    """Save user credentials to file."""
    try:
        credentials_path = get_credentials_path(email)
        with open(credentials_path, 'w') as f:
            json.dump({
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes
            }, f)
        return True
    except Exception as e:
        logger.error("Error saving credentials: {}".format(e))
        return False

def clear_credentials(email):
    """Clear user credentials."""
    try:
        credentials_path = get_credentials_path(email)
        if os.path.exists(credentials_path):
            os.remove(credentials_path)
        return True
    except Exception as e:
        logger.error("Error clearing credentials: {}".format(e))
        return False

def get_user_info(credentials):
    """Get user information from Google API."""
    try:
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        return user_info
    except Exception as e:
        logger.error("Error getting user info: {}".format(e))
        return None

def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def start_oauth(email, redirect_uri):
    """Start OAuth2 flow."""
    try:
        if not validate_email_domain(email):
            return None, "Invalid email domain. Must be from gmail.com or bajajearths.com"
            
        flow = create_oauth2_flow(redirect_uri)
        if not flow:
            return None, "Failed to create OAuth2 flow"
            
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        return authorization_url, state
    except Exception as e:
        logger.error("Error starting OAuth flow: {}".format(e))
        return None, str(e)

def finish_oauth(email, state, redirect_uri):
    """Complete OAuth2 flow."""
    try:
        flow = create_oauth2_flow(redirect_uri)
        if not flow:
            return False, "Failed to create OAuth2 flow"
            
        # Get authorization code from request
        code = request.args.get('code')
        if not code:
            return False, "No authorization code received"
            
        # Exchange code for credentials
        flow.fetch_token(code=code)
        credentials = flow.credentials
        logger.info("Credentials obtained: {}".format(credentials is not None))
        
        # Get user info to verify email
        user_info = get_user_info(credentials)
        logger.info("User info obtained: {}".format(user_info is not None))
        logger.info("OAuth user info email: {}, Expected email: {}".format(user_info.get('email') if user_info else 'N/A', email))
        if not user_info or user_info.get('email') != email:
            return False, "Email mismatch"
            
        # Save credentials
        if not save_credentials(email, credentials):
            return False, "Failed to save credentials"
            
        return True, None
    except Exception as e:
        logger.error("Error finishing OAuth flow: {}".format(e))
        return False, str(e) 