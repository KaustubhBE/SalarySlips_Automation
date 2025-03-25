import os
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Load config
config_path = os.path.join(script_dir, "config.json")
try:
    with open(config_path, "r") as f:
        config = json.load(f)
except FileNotFoundError:
    print(f"Error: Configuration file '{config_path}' not found.")
    exit(1)

# Define client secrets file path
CLIENT_SECRETS_FILE = os.getenv('GOOGLE_DRIVE_CREDENTIALS_PATH', '/etc/secrets/google_drive_credentials.json')
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_SHEETS_CREDENTIALS_PATH', '/etc/secrets/google_sheets_credentials.json')

# Email settings
SMTP_SERVER = os.getenv('SMTP_SERVER', "smtp.gmail.com")
SMTP_PORT = int(os.getenv('SMTP_PORT', "465"))
SENDER_EMAIL = os.getenv('SENDER_EMAIL', "hrd@bajajearths.com")
SENDER_PASSWORD = os.getenv('SENDER_PASSWORD', "wkcj ajvh exxs qhko")

if not SENDER_EMAIL or not SENDER_PASSWORD:
    print("Error: Sender email and password are missing in the config file.")
    exit(1)

# Load Service Account Credentials
try:
    service_account_file = os.path.join(script_dir, "service_account_credentials.json")
    creds = Credentials.from_service_account_file(
        service_account_file, 
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
    exit(1)

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