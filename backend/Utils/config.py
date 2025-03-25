import os
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Define credential paths from environment variables
CLIENT_SECRETS_FILE = os.getenv('GOOGLE_DRIVE_CREDENTIALS_PATH', '/etc/secrets/google_drive_credentials.json')
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', '/etc/secrets/google_sheets_credentials.json')
OAUTH2_FILE = os.getenv('GOOGLE_OAUTH2_PATH', '/etc/secrets/google_oauth2.json')

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
    creds = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, 
        scopes=[
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
    )
    # Create Drive API service
    drive_service = build('drive', 'v3', credentials=creds)
    drive = drive_service  # Export the drive service instance
except Exception as e:
    print(f"Error loading service account credentials: {e}")
    raise

# Function to upload file to Google Drive
def upload_to_google_drive(file_path, folder_id, file_title):
    try:
        file_metadata = {
            'name': file_title,
            'parents': [folder_id]
        }
        
        media = MediaFileUpload(
            file_path,
            mimetype='application/pdf',
            resumable=True
        )
        
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        return file.get('id')
    except HttpError as error:
        print(f'An error occurred: {error}')
        return None