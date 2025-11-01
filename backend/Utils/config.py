import os
import json
import sys
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
from pydrive2.drive import GoogleDrive
from pydrive2.auth import GoogleAuth

def get_base_path():
    # Check if running as PyInstaller executable
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS)
    # If running in development
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# while running in exe
# # Get the base directory
# base_dir = get_base_path()

# # Define credential paths from environment variables with fallback to project directory
# CLIENT_SECRETS_FILE = os.getenv('GOOGLE_DRIVE_CREDENTIALS_PATH', os.path.join(base_dir, 'Utils', 'client_secrets.json'))
# SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', os.path.join(base_dir, 'Utils', 'service_account_credentials.json'))
# OAUTH2_FILE = os.getenv('GOOGLE_OAUTH2_PATH', os.path.join(base_dir, 'Utils', 'Oauth2.json'))

#while running on localhost
# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))
# Get the project root directory (two levels up from script_dir)
project_root = os.path.dirname(os.path.dirname(script_dir))

# Define credential paths from environment variables with fallback to project directory
CLIENT_SECRETS_FILE = os.getenv('GOOGLE_CLIENT_SECRETS_PATH', os.path.join(project_root, 'backend', 'Utils', 'client_secrets.json'))
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', os.path.join(project_root, 'backend', 'Utils', 'service_account_credentials.json'))

# JWT secret for encoding/decoding tokens
JWT_SECRET = os.getenv('JWT_SECRET', 'your_jwt_secret_here')  # TODO: Set a secure secret in production

def load_credentials(file_path, service_name="Google Service"):
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError("Credentials file not found at {}".format(file_path))
            
        with open(file_path, 'r') as f:
            creds_data = json.load(f)
            
        return creds_data
    except Exception as e:
        print("Error loading {} credentials: {}".format(service_name, str(e)))
        raise

# Load Service Account Credentials
try:
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError("Service account credentials file not found at {}".format(SERVICE_ACCOUNT_FILE))
        
    creds = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, 
        scopes=[
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',  # Full drive access
            'https://www.googleapis.com/auth/drive.metadata'
        ]
    )
    
    # Create Drive API service
    drive = build('drive', 'v3', credentials=creds)
    
    # Create Sheets API service
    sheets_service = build('sheets', 'v4', credentials=creds)
    
except Exception as e:
    print("Error loading service account credentials: {}".format(e))
    print("Please ensure the credentials file exists at: {}".format(SERVICE_ACCOUNT_FILE))
    drive = None
    sheets_service = None

def get_resource_path(relative_path):
    """Get the absolute path to a resource file"""
    try:
        base_dir = get_base_path()
        return os.path.join(base_dir, relative_path)
    except Exception as e:
        print("Error getting resource path: {}".format(str(e)))
        raise