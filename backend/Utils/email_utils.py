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
from Utils.config import CLIENT_SECRETS_FILE

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
    if not user_id:
        return 'token.pickle'
    # Hash the user_id to create a secure filename
    hashed_id = hashlib.sha256(user_id.encode()).hexdigest()
    return f'token_{hashed_id}.pickle'

def clear_user_credentials(user_id=None):
    """Clear stored credentials for a user."""
    try:
        token_path = get_token_path(user_id)
        if os.path.exists(token_path):
            os.remove(token_path)
            logger.info("Cleared credentials for user: {}".format(user_id))
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