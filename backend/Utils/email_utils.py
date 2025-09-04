import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from email.header import Header
import email.utils
from Utils.firebase_utils import get_smtp_credentials_by_email
import smtplib
import re

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