from pydrive.auth import GoogleAuth
import os

# Define the path to the client_secrets.json file
CLIENT_SECRETS_FILE = r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\backend\Utils\client_secrets.json"

gauth = GoogleAuth()
gauth.LoadClientConfigFile(CLIENT_SECRETS_FILE)
gauth.LocalWebserverAuth()  # This should open a browser for authentication
gauth.SaveCredentialsFile("credentials.json")  # Save new credentials