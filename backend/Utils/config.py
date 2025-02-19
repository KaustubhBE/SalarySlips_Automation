import os
import json
import webbrowser
from google.oauth2.service_account import Credentials
from pydrive.auth import GoogleAuth
from pydrive.drive import GoogleDrive

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

# Email settings
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465
SENDER_EMAIL = "hrd@bajajearths.com"
SENDER_PASSWORD = "wkcj ajvh exxs qhko"

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
except Exception as e:
    print(f"Error loading service account credentials: {e}")
    exit(1)

# Client secrets file for Google Drive API
CLIENT_SECRETS_FILE = os.path.join(script_dir, "client_secrets.json")

# Authenticate PyDrive with OAuth2 using saved credentials
try:
    oauth2_file = os.path.join(script_dir, "Oauth2.json")
    gauth = GoogleAuth()
    gauth.LoadClientConfigFile(CLIENT_SECRETS_FILE)
    gauth.LoadCredentialsFile(oauth2_file)
    if gauth.credentials is None or gauth.access_token_expired:
        auth_url = gauth.GetAuthUrl()
        webbrowser.open(auth_url)
        gauth.LocalWebserverAuth()
        gauth.SaveCredentialsFile(oauth2_file)
    elif gauth.access_token_expired:
        gauth.Refresh()
    drive = GoogleDrive(gauth)
except Exception as e:
    print(f"Error authenticating Google Drive: {e}")
    exit(1)