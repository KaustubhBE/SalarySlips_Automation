import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.header import Header
import email.utils
from Utils.firebase_utils import get_smtp_credentials_by_email, get_user_by_email_with_metadata
import smtplib
import re
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Email settings from environment variables (server/port only)
SMTP_SERVER = os.getenv('SMTP_SERVER', "smtp.gmail.com")
SMTP_PORT = int(os.getenv('SMTP_PORT', "465"))

# Helper function to validate email
def is_valid_email(email):
                
    if not email or not email.strip():
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email.strip()) is not None


def send_email_smtp(user_email, recipient_email, subject, body, attachment_paths=None, cc=None, bcc=None):
    """
    Send an email using SMTP with credentials retrieved for the given user_email.
    """
    try:
        # Validate user_email parameter
        if not user_email or not user_email.strip():
            logger.error("No SMTP credentials found for user: None or empty")
            return "USER_NOT_LOGGED_IN"  # Return specific error code for frontend
        
        sender_email, sender_password = get_smtp_credentials_by_email(user_email)
        if not sender_email or not sender_password:
            logger.error(f"No SMTP credentials found for user: {user_email}")
            return "NO_SMTP_CREDENTIALS"  # Return specific error code for frontend

        # Validate email addresses
        if not recipient_email or not recipient_email.strip():
            logger.error("Recipient email is empty or invalid")
            return "INVALID_RECIPIENT"  # Return specific error code for frontend

        message = MIMEMultipart()
        
        # Clean and validate email addresses
        recipient_email = recipient_email.strip()
        message['to'] = Header(recipient_email, 'utf-8')
        message['from'] = Header(sender_email, 'utf-8')
        message['subject'] = Header(subject, 'utf-8')
        
        if cc and cc.strip():
            message['cc'] = Header(cc.strip(), 'utf-8')
        if bcc and bcc.strip():
            message['bcc'] = Header(bcc.strip(), 'utf-8')

        # Add message body
        msg = MIMEText(body, 'html', 'utf-8')
        msg.replace_header('Content-Type', 'text/html; charset="utf-8"')
        message.attach(msg)

        # Add attachments if any
        if attachment_paths:
            if isinstance(attachment_paths, str):
                attachment_paths = [attachment_paths]
            for attachment_path in attachment_paths:
                try:
                    if os.path.exists(attachment_path):
                        with open(attachment_path, 'rb') as f:
                            part = MIMEBase('application', 'octet-stream')
                            part.set_payload(f.read())
                            encoders.encode_base64(part)
                            part.add_header(
                                'Content-Disposition',
                                f'attachment; filename={os.path.basename(attachment_path)}'
                            )
                            message.attach(part)
                    else:
                        logger.warning(f"Attachment file not found: {attachment_path}")
                except Exception as e:
                    logger.error(f"Error attaching file {attachment_path}: {e}")
                    continue

        recipients = extract_ascii_emails(recipient_email)
        if cc and cc.strip():
            recipients += extract_ascii_emails(cc)
        if bcc and bcc.strip():
            recipients += extract_ascii_emails(bcc)

        # Remove any empty or invalid recipients
        recipients = [r for r in recipients if r and '@' in r]
        
        if not recipients:
            logger.error("No valid recipients found after processing")
            return "NO_VALID_RECIPIENTS"  # Return specific error code for frontend

        logger.info(f"Attempting to send email to: {recipients}")

        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(sender_email, sender_password)
            server.sendmail(
                sender_email,
                recipients,
                message.as_bytes()
            )
        logger.info(f"Email sent to {recipient_email} via SMTP for user {user_email}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed for user {user_email}: {e}")
        return "SMTP_AUTH_FAILED"  # Return specific error code for frontend
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error for user {user_email}: {e}")
        return "SMTP_ERROR"  # Return specific error code for frontend
    except Exception as e:
        logger.error(f"Error sending email via SMTP for user {user_email}: {e}")
        return "EMAIL_SEND_ERROR"  # Return specific error code for frontend

def extract_ascii_emails(addresses):
    if not addresses:
        return []
    if isinstance(addresses, str):
        addresses = [addresses]
    ascii_emails = []
    for addr in addresses:
        # Parse address to get only the email part
        name, email_addr = email.utils.parseaddr(addr)
        ascii_emails.append(email_addr)
    return ascii_emails

def get_employee_email(employee_name, email_employees):
    """Get employee's email from the email_employees list based on their name."""
    for record in email_employees:
        if record.get("Name") == employee_name:
            return record.get("Email ID", "")
    return ""

def send_email_gmail_api(user_email, recipient_email, subject, body, attachment_paths=None, cc=None, bcc=None, access_token=None, refresh_token=None):
    """
    Send an email using Gmail API with OAuth credentials.
    """
    try:
        # Get user's Google OAuth credentials from database
        user = get_user_by_email_with_metadata(user_email)
        if not user:
            logger.error(f"User not found: {user_email}")
            return "USER_NOT_LOGGED_IN"
        
        # Debug logging
        logger.info(f"User {user_email} Gmail access check:")
        logger.info(f"  has_gmail_access: {user.get('has_gmail_access')}")
        logger.info(f"  google_access_token present: {bool(user.get('google_access_token'))}")
        logger.info(f"  google_refresh_token present: {bool(user.get('google_refresh_token'))}")
        
        # Use provided tokens first, then fall back to database/session
        if not access_token or not refresh_token:
            # Get Google OAuth tokens from database first
            access_token = user.get('google_access_token')
            refresh_token = user.get('google_refresh_token')
            
            # If not in database, check session (for GSI flow)
            if not access_token:
                from flask import session
                session_user = session.get('user', {})
                if session_user.get('email') == user_email:
                    access_token = session_user.get('google_access_token')
                    refresh_token = session_user.get('google_refresh_token')
                    logger.info(f"Retrieved Google tokens from session for user: {user_email}")
        else:
            logger.info(f"Using provided Google tokens for user: {user_email}")
        
        # Check if user has Gmail access (either via flag or presence of tokens)
        has_gmail_access = user.get('has_gmail_access', False)
        has_google_tokens = bool(access_token)
        
        if not has_gmail_access and not has_google_tokens:
            logger.error(f"User {user_email} does not have Gmail access or Google tokens")
            return "NO_GMAIL_ACCESS"
        
        if not access_token:
            logger.error(f"No Google access token found for user: {user_email}")
            return "NO_GOOGLE_ACCESS_TOKEN"
        
        # Create credentials object
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.environ.get('GOOGLE_CLIENT_ID'),
            client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
        )
        
        # Refresh token if needed
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
            # Update the refreshed token in database
            try:
                from Utils.firebase_utils import db
                user_ref = db.collection('USERS').document(user.get('id'))
                user_ref.update({
                    'google_access_token': credentials.token,
                    'last_token_refresh': credentials.expiry.isoformat() if credentials.expiry else None
                })
            except Exception as e:
                logger.warning(f"Failed to update refreshed token: {e}")
        
        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)
        
        # Validate recipient email
        if not recipient_email or not recipient_email.strip():
            logger.error("Recipient email is empty or invalid")
            return "INVALID_RECIPIENT"
        
        # Create message
        message = MIMEMultipart()
        message['to'] = recipient_email.strip()
        message['from'] = user_email
        message['subject'] = subject
        
        if cc and cc.strip():
            message['cc'] = cc.strip()
        if bcc and bcc.strip():
            message['bcc'] = bcc.strip()
        
        # Add body
        msg = MIMEText(body, 'html', 'utf-8')
        msg.replace_header('Content-Type', 'text/html; charset="utf-8"')
        message.attach(msg)
        
        # Add attachments if any
        if attachment_paths:
            if isinstance(attachment_paths, str):
                attachment_paths = [attachment_paths]
            for attachment_path in attachment_paths:
                try:
                    if os.path.exists(attachment_path):
                        with open(attachment_path, 'rb') as f:
                            part = MIMEBase('application', 'octet-stream')
                            part.set_payload(f.read())
                            encoders.encode_base64(part)
                            part.add_header(
                                'Content-Disposition',
                                f'attachment; filename={os.path.basename(attachment_path)}'
                            )
                            message.attach(part)
                    else:
                        logger.warning(f"Attachment file not found: {attachment_path}")
                except Exception as e:
                    logger.error(f"Error attaching file {attachment_path}: {e}")
                    continue
        
        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
        
        # Send email
        send_message = service.users().messages().send(
            userId='me',
            body={'raw': raw_message}
        ).execute()
        
        logger.info(f"Email sent via Gmail API to {recipient_email} for user {user_email}")
        return True
        
    except HttpError as e:
        logger.error(f"Gmail API error for user {user_email}: {e}")
        if e.resp.status == 401:
            return "GMAIL_AUTH_FAILED"
        elif e.resp.status == 403:
            return "GMAIL_PERMISSION_DENIED"
        else:
            return "GMAIL_API_ERROR"
    except Exception as e:
        logger.error(f"Error sending email via Gmail API for user {user_email}: {e}")
        return "GMAIL_SEND_ERROR"

def send_email_oauth(user_email, recipient_email, subject, body, attachment_paths=None, cc=None, bcc=None):
    """
    Send email using OAuth (Gmail API) with fallback to SMTP.
    """
    try:
        # Try Gmail API first
        result = send_email_gmail_api(user_email, recipient_email, subject, body, attachment_paths, cc, bcc)
        
        if result is True:
            return True
        elif result in ["NO_GMAIL_ACCESS", "NO_GOOGLE_ACCESS_TOKEN", "GMAIL_AUTH_FAILED", "GMAIL_PERMISSION_DENIED", "GMAIL_API_ERROR", "GMAIL_SEND_ERROR"]:
            # Gmail API failed, fallback to SMTP
            logger.info(f"Gmail API failed ({result}), falling back to SMTP for user {user_email}")
            return send_email_smtp(user_email, recipient_email, subject, body, attachment_paths, cc, bcc)
        else:
            # Other errors (like USER_NOT_LOGGED_IN, INVALID_RECIPIENT, etc.)
            return result
            
    except Exception as e:
        logger.error(f"Error in send_email_oauth for user {user_email}: {e}")
        # Fallback to SMTP
        logger.info(f"OAuth failed, falling back to SMTP for user {user_email}")
        return send_email_smtp(user_email, recipient_email, subject, body, attachment_paths, cc, bcc)