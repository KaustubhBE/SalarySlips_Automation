import os
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import pickle
import hashlib
import sys
import json
import jwt
from Utils.config import JWT_SECRET
from Utils.config import CLIENT_SECRETS_FILE, SMTP_SERVER, SMTP_PORT, SENDER_EMAIL, SENDER_PASSWORD
from Utils.firebase_utils import update_user_token, get_user_token_by_email
# Add imports for Google token verification
try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:
    id_token = None
    google_requests = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def verify_token(token, client_id=None):
    """
    Verifies a JWT token. Supports Google-issued tokens (RS256) and internal tokens (HS256).
    Returns the decoded payload if valid, else None.
    """
    # Try to decode header to check algorithm/issuer
    try:
        header = jwt.get_unverified_header(token)
        payload = jwt.decode(token, options={"verify_signature": False})
        iss = payload.get('iss', '')
        alg = header.get('alg', '')
    except Exception as e:
        logging.error(f"Failed to decode JWT header/payload: {e}")
        return None

    # Google token: iss contains 'accounts.google.com' and alg is RS256
    if (iss.startswith('https://accounts.google.com') or iss.startswith('accounts.google.com')) and alg == 'RS256':
        if id_token is None or google_requests is None:
            logging.error("google-auth library is not installed. Cannot verify Google tokens.")
            return None
        # You must provide your Google OAuth client_id for audience verification
        GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID') or '579518246340-0673etiich0q7ji2q6imu7ln525554ab.apps.googleusercontent.com'
        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
            return idinfo
        except Exception as e:
            if 'expired' in str(e).lower():
                logging.error(f"Google token expired: {e}")
                return "TOKEN_EXPIRED"
            logging.error(f"Google token verification failed: {e}")
            return None
    else:
        # Internal token, verify with HS256 and your secret
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            return decoded
        except Exception as e:
            if 'expired' in str(e).lower():
                logging.error(f"Internal token expired: {e}")
                return "TOKEN_EXPIRED"
            logging.error(f"Internal token verification failed: {e}")
            return None


def get_gmail_service(process_name, user_email=None, user_token=None):
    if process_name == "salary_slips":
        # Use static SMTP credentials; handled separately in send_email_with_gmail
        return "smtp"
    elif process_name == "reports":
        if not user_email:
            logger.error("user_email is required for 'reports' process")
            return None
        oauth_creds = user_token or get_user_token_by_email(user_email)
        if oauth_creds:
            # If it's a dict, extract the access token
            token = oauth_creds.get('token') if isinstance(oauth_creds, dict) else oauth_creds
            decoded_token = verify_token(token)
            if decoded_token == "TOKEN_EXPIRED":
                return "TOKEN_EXPIRED"
            if decoded_token:
                return decoded_token
            else:
                logger.error(f"Token verification failed for user: {user_email}")
                return None
        else:
            logger.error(f"No token found for user_email: {user_email} (required for 'reports' process)")
            logger.info(f"User {user_email} needs to authenticate to generate a token")
            return None
    else:
        logger.error(f"Unknown process_name: {process_name}")
        return None

def create_message(sender, to, subject, message_text, attachment_paths=None, cc=None, bcc=None):
    """Create a message for an email with optional CC and BCC. Returns both MIME object and base64 string."""
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

    # For Gmail API
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    return {'mime': message, 'raw': raw_message}

def send_gmail_message(service, user_id, message):
    """Send an email message."""
    decoded_token = service
    logger.info(f"Decoded token: {decoded_token}")
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
        return False

def send_email_with_gmail(recipient_email, subject, body, process_name, attachment_paths=None, user_email=None, cc=None, bcc=None):
    try:
        service = get_gmail_service(process_name, user_email)
        if service == "TOKEN_EXPIRED":
            return "TOKEN_EXPIRED"
        message_obj = create_message(
            sender=user_email or SENDER_EMAIL,
            to=recipient_email,
            subject=subject,
            message_text=body,
            attachment_paths=attachment_paths,
            cc=cc,
            bcc=bcc
        )
        if service == "smtp":
            # Use SMTP to send the email
            import smtplib
            mime_msg = message_obj['mime']
            recipients = [recipient_email]
            if cc:
                recipients += [cc] if isinstance(cc, str) else cc
            if bcc:
                recipients += [bcc] if isinstance(bcc, str) else bcc
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
                server.sendmail(
                    SENDER_EMAIL,
                    recipients,
                    mime_msg.as_string()
                )
            logger.info(f"Email sent to {recipient_email} via SMTP")
            return True
        elif service:
            # Use Gmail API
            return send_gmail_message(service, user_email, {'raw': message_obj['raw']})
        else:
            logger.error("Failed to get email service")
            return False
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
def send_email_with_attachment(recipient_email, subject, body, process_name, attachment_paths, user_email=None, cc=None, bcc=None):
    try:
        success = send_email_with_gmail(
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            process_name=process_name,
            attachment_paths=attachment_paths,
            user_email=user_email,
            cc=cc,
            bcc=bcc
        )
        if success == "TOKEN_EXPIRED":
            logger.error("Token expired while sending email to {}".format(recipient_email))
            return "TOKEN_EXPIRED"
        if success:
            logger.info("Email sent to {}".format(recipient_email))
            return True
        else:
            logger.error("Failed to send email to {}".format(recipient_email))
            return False
    except Exception as e:
        logger.error("Error sending email to {}: {}".format(recipient_email, e))
        return False