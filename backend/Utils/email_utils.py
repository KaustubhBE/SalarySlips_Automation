import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from Utils.firebase_utils import get_smtp_credentials_by_email
import smtplib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Email settings from environment variables (server/port only)
SMTP_SERVER = os.getenv('SMTP_SERVER', "smtp.gmail.com")
SMTP_PORT = int(os.getenv('SMTP_PORT', "465"))

def send_email_smtp(user_email, recipient_email, subject, body, attachment_paths=None, cc=None, bcc=None):
    """
    Send an email using SMTP with credentials retrieved for the given user_email.
    """
    sender_email, sender_password = get_smtp_credentials_by_email(user_email)
    if not sender_email or not sender_password:
        logger.error(f"No SMTP credentials found for user: {user_email}")
        return False

    message = MIMEMultipart()
    message['to'] = recipient_email
    message['from'] = sender_email
    message['subject'] = subject
    if cc:
        message['cc'] = cc
    if bcc:
        message['bcc'] = bcc

    # Add message body
    msg = MIMEText(body, 'html')
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
                logger.error(f"Error attaching file {attachment_path}: {e}")
                continue

    recipients = [recipient_email]
    if cc:
        recipients += [cc] if isinstance(cc, str) else cc
    if bcc:
        recipients += [bcc] if isinstance(bcc, str) else bcc

    try:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(sender_email, sender_password)
            server.sendmail(
                sender_email,
                recipients,
                message.as_string()
            )
        logger.info(f"Email sent to {recipient_email} via SMTP for user {user_email}")
        return True
    except Exception as e:
        logger.error(f"Error sending email via SMTP for user {user_email}: {e}")
        return False

def get_employee_email(employee_name, email_employees):
    """Get employee's email from the email_employees list based on their name."""
    for record in email_employees:
        if record.get("Name") == employee_name:
            return record.get("Email ID", "")
    return ""