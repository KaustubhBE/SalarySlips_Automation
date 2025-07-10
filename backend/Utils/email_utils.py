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
from Utils.firebase_utils import update_user_token, get_user_token

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def get_gmail_service(process_name, user_id=None):
    if process_name == "salary_slips":
        # Use static SMTP credentials; handled separately in send_email_with_gmail
        return "smtp"
    elif process_name == "reports":
        token = get_user_token(user_id)
        if token:
            try:
                decoded_token = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                return decoded_token
            except Exception as e:
                logger.error(f"Failed to decode JWT token: {e}")
                return None
        else:
            logger.error("No token found for user_id: {} (required for 'reports' process)".format(user_id))
            return None
    else:
        logger.error("Unknown process_name: {}".format(process_name))
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

def send_email_with_gmail(recipient_email, subject, body, process_name, attachment_paths=None, user_id=None, cc=None, bcc=None):
    """Send an email using Gmail API or SMTP with optional CC and BCC."""
    try:
        service = get_gmail_service(process_name, user_id)
        message_obj = create_message(
            sender=user_id or SENDER_EMAIL,
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
            return send_gmail_message(service, user_id, {'raw': message_obj['raw']})
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
def send_email_with_attachment(recipient_email, subject, body, process_name, attachment_paths, user_id=None, cc=None, bcc=None):
    try:
        # Use Gmail API to send email
        success = send_email_with_gmail(
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            process_name=process_name,
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