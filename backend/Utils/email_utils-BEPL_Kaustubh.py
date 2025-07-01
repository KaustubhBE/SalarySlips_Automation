import os
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import pickle
import hashlib
import sys
import json
from Utils.config import CLIENT_SECRETS_FILE
from Utils.firebase_utils import update_user_base64_token

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temporary folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

def get_token_path(user_id):
    """Generate a secure token path for the user."""
    # Define the target directory for storing tokens
    token_dir = r"C:\Users\Kaustubh\Salary_Slips\temp_attachments"
    
    # Create the directory if it doesn't exist
    os.makedirs(token_dir, exist_ok=True)
    
    if not user_id:
        return os.path.join(token_dir, 'token.pickle')
    # Hash the user_id to create a secure filename
    hashed_id = hashlib.sha256(user_id.encode()).hexdigest()
    return os.path.join(token_dir, f'token_{hashed_id}.pickle')

def decrypt_token_to_json(user_id=None):
    """Decrypt token.pickle file and convert to JSON format."""
    try:
        token_path = get_token_path(user_id)
        
        # Check if token.pickle exists
        if not os.path.exists(token_path):
            logger.error("Token file not found at: {}".format(token_path))
            return None
        
        # Load the pickle file
        with open(token_path, 'rb') as token_file:
            credentials = pickle.load(token_file)
        
        # Extract credential information
        token_data = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes,
            'expiry': credentials.expiry.isoformat() if credentials.expiry else None,
            'expired': credentials.expired,
            'valid': credentials.valid
        }
        
        # Create JSON file path
        json_path = token_path.replace('.pickle', '.json')
        
        # Save as JSON
        with open(json_path, 'w') as json_file:
            json.dump(token_data, json_file, indent=2)
        
        # Create BASE64 encrypted version
        json_content = json.dumps(token_data, indent=2)
        base64_content = base64.b64encode(json_content.encode('utf-8')).decode('utf-8')
        
        # Save BASE64 encrypted file
        base64_path = token_path.replace('.pickle', '.json.base64')
        with open(base64_path, 'w') as base64_file:
            base64_file.write(base64_content)
        
        # Update Firestore with BASE64 content
        if user_id:
            firestore_success = update_user_base64_token(user_id, base64_content)
            if firestore_success:
                logger.info("BASE64 token updated in Firestore for user: {}".format(user_id))
            else:
                logger.error("Failed to update BASE64 token in Firestore for user: {}".format(user_id))
        
        logger.info("Token decrypted and saved to JSON: {}".format(json_path))
        logger.info("Token encrypted and saved to BASE64: {}".format(base64_path))
        return json_path
        
    except Exception as e:
        logger.error("Error decrypting token to JSON: {}".format(e))
        return None

def get_token_json_content(user_id=None):
    """Get the content of the decrypted token JSON file."""
    try:
        json_path = decrypt_token_to_json(user_id)
        if json_path and os.path.exists(json_path):
            with open(json_path, 'r') as json_file:
                return json.load(json_file)
        return None
    except Exception as e:
        logger.error("Error reading token JSON content: {}".format(e))
        return None

def decrypt_base64_to_json(user_id=None):
    """Decrypt BASE64 file back to JSON format."""
    try:
        token_path = get_token_path(user_id)
        base64_path = token_path.replace('.pickle', '.json.base64')
        
        # Check if BASE64 file exists
        if not os.path.exists(base64_path):
            logger.error("BASE64 file not found at: {}".format(base64_path))
            return None
        
        # Read BASE64 content
        with open(base64_path, 'r') as base64_file:
            base64_content = base64_file.read()
        
        # Decode BASE64 to JSON
        json_content = base64.b64decode(base64_content).decode('utf-8')
        token_data = json.loads(json_content)
        
        logger.info("BASE64 file decrypted successfully: {}".format(base64_path))
        return token_data
        
    except Exception as e:
        logger.error("Error decrypting BASE64 to JSON: {}".format(e))
        return None

def get_token_base64_content(user_id=None):
    """Get the BASE64 content of the encrypted token file."""
    try:
        token_path = get_token_path(user_id)
        base64_path = token_path.replace('.pickle', '.json.base64')
        
        if os.path.exists(base64_path):
            with open(base64_path, 'r') as base64_file:
                return base64_file.read()
        return None
    except Exception as e:
        logger.error("Error reading BASE64 content: {}".format(e))
        return None

def clear_user_credentials(user_id=None):
    """Clear stored credentials for a user."""
    try:
        token_path = get_token_path(user_id)
        json_path = token_path.replace('.pickle', '.json')
        base64_path = token_path.replace('.pickle', '.json.base64')
        
        # Remove pickle file
        if os.path.exists(token_path):
            os.remove(token_path)
            logger.info("Cleared pickle credentials for user: {}".format(user_id))
        
        # Remove JSON file
        if os.path.exists(json_path):
            os.remove(json_path)
            logger.info("Cleared JSON credentials for user: {}".format(user_id))
        
        # Remove BASE64 file
        if os.path.exists(base64_path):
            os.remove(base64_path)
            logger.info("Cleared BASE64 credentials for user: {}".format(user_id))
            
        return True
    except Exception as e:
        logger.error("Error clearing credentials: {}".format(e))
    return False

def get_gmail_service(user_id=None):
    """Get Gmail API service instance."""
    creds = None
    token_path = get_token_path(user_id)
    
    # Load existing credentials if available
    if os.path.exists(token_path):
        try:
            with open(token_path, 'rb') as token:
                creds = pickle.load(token)
        except Exception as e:
            logger.error("Error loading credentials: {}".format(e))
            # If there's an error loading credentials, clear them
            clear_user_credentials(user_id)
    
    # If credentials are not valid or don't exist, get new ones
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                # Decrypt refreshed credentials to JSON
                decrypt_token_to_json(user_id)
            except Exception as e:
                logger.error("Error refreshing credentials: {}".format(e))
                # If refresh fails, clear credentials and get new ones
                clear_user_credentials(user_id)
                creds = None
        
        if not creds:
            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    CLIENT_SECRETS_FILE, SCOPES)
                creds = flow.run_local_server(port=0)
                
                # Save credentials for future use
                with open(token_path, 'wb') as token:
                    pickle.dump(creds, token)
                
                # Decrypt newly created credentials to JSON
                decrypt_token_to_json(user_id)
            except Exception as e:
                logger.error("Error getting new credentials: {}".format(e))
                return None
    
    if not creds:
        logger.error("Failed to obtain valid credentials")
        return None
        
    return build('gmail', 'v1', credentials=creds)

def create_message(sender, to, subject, message_text, attachment_paths=None, cc=None, bcc=None):
    """Create a message for an email with optional CC and BCC."""
    message = MIMEMultipart()
    message['to'] = to
    message['from'] = sender
    message['subject'] = subject
    if cc:
        message['cc'] = cc
    if bcc:
        message['bcc'] = bcc

    # Add message body
    msg = MIMEText(message_text, 'html')
    message.attach(msg)

    # Add attachments if any
    if attachment_paths:
        if isinstance(attachment_paths, str):
            attachment_paths = [attachment_paths]
        for attachment_path in attachment_paths:
            try:
                with open(attachment_path, 'rb') as f:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename={os.path.basename(attachment_path)}'
                    )
                    message.attach(part)
            except Exception as e:
                logger.error("Error attaching file {}: {}".format(attachment_path, e))
                continue

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    return {'raw': raw_message}

def send_gmail_message(service, user_id, message):
    """Send an email message."""
    if not service:
        logger.error("No valid Gmail service available")
        return False
        
    try:
        message = service.users().messages().send(
            userId=user_id or 'me',
            body=message
        ).execute()
        logger.info("Message Id: {}".format(message['id']))
        return True
    except Exception as e:
        logger.error("Error sending email: {}".format(e))
        # If there's an error, clear the credentials to force re-authentication
        clear_user_credentials(user_id)
        return False

def send_email_with_gmail(recipient_email, subject, body, attachment_paths=None, user_id=None, cc=None, bcc=None):
    """Send an email using Gmail API with optional CC and BCC."""
    try:
        service = get_gmail_service(user_id)
        if not service:
            logger.error("Failed to get Gmail service")
            return False
        message = create_message(
            sender=user_id or 'me',
            to=recipient_email,
            subject=subject,
            message_text=body,
            attachment_paths=attachment_paths,
            cc=cc,
            bcc=bcc
        )
        return send_gmail_message(service, user_id, message)
    except Exception as e:
        logger.error("Error in send_email_with_gmail: {}".format(e))
        return False

# Fetch employee email
def get_employee_email(employee_name, email_employees):
    for record in email_employees:
        if record.get("Name") == employee_name:
            return record.get("Email ID", "")
    return ""

# Send email with PDF attachment
def send_email_with_attachment(recipient_email, subject, body, attachment_paths, user_id=None, cc=None, bcc=None):
    try:
        # Use Gmail API to send email
        success = send_email_with_gmail(
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            attachment_paths=attachment_paths,
            user_id=user_id,
            cc=cc,
            bcc=bcc
        )
        if success:
            logger.info("Email sent to {}".format(recipient_email))
            return True
        else:
            logger.error("Failed to send email to {}".format(recipient_email))
            return False
    except Exception as e:
        logger.error("Error sending email to {}: {}".format(recipient_email, e))
        return False