import json
import webbrowser
from google.oauth2.service_account import Credentials
from pydrive.auth import GoogleAuth
from pydrive.drive import GoogleDrive

# Load config
try:
    with open("config.json", "r") as f:
        config = json.load(f)
except FileNotFoundError:
    print("Error: Configuration file 'config.json' not found.")
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
    service_account_file = r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\backend\Utils\service_account_credentials.json"
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
CLIENT_SECRETS_FILE = r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\backend\Utils\client_secrets.json"

# Authenticate PyDrive with OAuth2 using saved credentials
try:
    oauth2_file = r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\backend\Utils\Oauth2.json"
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