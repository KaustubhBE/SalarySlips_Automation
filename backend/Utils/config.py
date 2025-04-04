import os
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
from pydrive2.drive import GoogleDrive
from pydrive2.auth import GoogleAuth

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))
# Get the project root directory (two levels up from script_dir)
project_root = os.path.dirname(os.path.dirname(script_dir))

# Define credential paths from environment variables with fallback to project directory
CLIENT_SECRETS_FILE = os.getenv('GOOGLE_DRIVE_CREDENTIALS_PATH', os.path.join(project_root, 'backend', 'Utils', 'client_secrets.json'))
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', os.path.join(project_root, 'backend', 'Utils', 'service_account_credentials.json'))
OAUTH2_FILE = os.getenv('GOOGLE_OAUTH2_PATH', os.path.join(project_root, 'backend', 'Utils', 'Oauth2.json'))

# Email settings from environment variables
SMTP_SERVER = os.getenv('SMTP_SERVER', "smtp.gmail.com")
SMTP_PORT = int(os.getenv('SMTP_PORT', "465"))
SENDER_EMAIL = os.getenv('SENDER_EMAIL', "hrd@bajajearths.com")
SENDER_PASSWORD = os.getenv('SENDER_PASSWORD', "wkcj ajvh exxs qhko")

def load_credentials(file_path, service_name="Google Service"):
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Credentials file not found at {file_path}")
            
        with open(file_path, 'r') as f:
            creds_data = json.load(f)
            
        return creds_data
    except Exception as e:
        print(f"Error loading {service_name} credentials: {str(e)}")
        raise

# Load Service Account Credentials
try:
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise FileNotFoundError(f"Service account credentials file not found at {SERVICE_ACCOUNT_FILE}")
        
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
    print(f"Error loading service account credentials: {e}")
    print(f"Please ensure the credentials file exists at: {SERVICE_ACCOUNT_FILE}")
    drive = None
    sheets_service = None
