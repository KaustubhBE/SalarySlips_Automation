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
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow
import requests
import smtplib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def verify_token(token, client_id=None):
    
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


def get_gmail_service(process_name, creds):
    if process_name == "salary_slips":
        # Use static SMTP credentials; handled separately in send_email_with_gmail
        return "smtp"
    elif process_name == "reports":
        try:
            service = build('gmail', 'v1', credentials=creds)
            if service:
                logger.info(f"Gmail service built successfully for reports process")
                return service
            else:
                logger.error("Failed to build Gmail service with service account")
                return None
        except Exception as e:
            logger.error(f"Failed to build Gmail service for reports process: {e}")
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
    logger.info(f"Using Gmail service for user: {user_id}")
    if not service:
        logger.error("No valid Gmail service available")
        return False
        
    try:
        user_id_to_use = user_id if user_id else 'me'
        result = service.users().messages().send(
            userId=user_id_to_use,
            body=message
        ).execute()
        logger.info("Message Id: {}".format(result['id']))
        return True
    except Exception as e:
        logger.error("Error sending email: {}".format(e))
        return False

def send_email_with_gmail(recipient_email, subject, body, process_name, attachment_paths=None, user_email=None, cc=None, bcc=None):
    try:
        token = get_user_token_by_email(user_email)
        if not token:
            logger.error("No token found for user: {}".format(user_email))
            return "TOKEN_EXPIRED"
        if isinstance(token, str):
            token = json.loads(token)
        creds = Credentials.from_authorized_user_info(token, SCOPES)
        service = get_gmail_service(process_name, creds)
        sender_email = SENDER_EMAIL if process_name == "salary_slips" else (user_email or SENDER_EMAIL)
        message_obj = create_message(
            sender=sender_email,
            to=recipient_email,
            subject=subject,
            message_text=body,
            attachment_paths=attachment_paths,
            cc=cc,
            bcc=bcc
        )
        if service == "smtp":
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
        elif SCOPES:
            service_account_email = SENDER_EMAIL if process_name == "reports" else user_email
            return send_gmail_message(service, service_account_email, {'raw': message_obj['raw']})
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