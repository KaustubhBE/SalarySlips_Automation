import os
import logging
import webbrowser
import sys
import threading
import time
from flask import Flask, request, jsonify, Response, g, session, redirect, url_for
from flask_cors import CORS
from logging.handlers import RotatingFileHandler
from Utils.fetch_data import fetch_google_sheet_data
from Utils.process_utils import *
from google.oauth2 import service_account
from googleapiclient.discovery import build
from Utils.config import CLIENT_SECRETS_FILE, drive, creds
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from Utils.auth import auth_bp
from Utils.email_utils import send_email_smtp
from Utils.whatsapp_utils import (
    send_whatsapp_message,
    get_employee_contact,
    WhatsAppNodeClient,
    WHATSAPP_NODE_SERVICE_URL
)
from firebase_admin import firestore
from Utils.firebase_utils import (
    add_user as firebase_add_user,
    get_user_by_id,
    get_user_by_email,
    get_all_users as firebase_get_all_users,
    update_user_role as firebase_update_role,
    delete_user as firebase_delete_user,
    add_salary_slip,
    get_salary_slips_by_user,

    update_user_app_password,
    update_user,
    db
)
import json
from docx import Document
import re
import base64
import requests
from datetime import datetime, timedelta
import gspread
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Removed complex thread pool executor - using direct client calls instead

# Initialize gspread client
try:
    
    client = gspread.authorize(creds)
except Exception as e:
    logger.error(f"Error initializing gspread client: {e}")
    client = None

# Define departments and permissions (aligned with Dashboard.jsx)
DEPARTMENTS = {
    'STORE': 'store',
    'MARKETING': 'marketing',
    'HUMANRESOURCE': 'humanresource',
    'ACCOUNTS': 'accounts',
    'REPORTS_DEPARTMENT': 'reports_department',
    'OPERATIONS_DEPARTMENT': 'operations_department'
}

# Note: Admin role doesn't need specific permissions - they have access to everything by design
# Regular users get permissions assigned through the Dashboard interface

# Define departments (aligned with frontend config)
DEPARTMENTS_CONFIG = {
    'STORE': 'store',
    'MARKETING': 'marketing', 
    'HUMANRESOURCE': 'humanresource',
    'ACCOUNTS': 'accounts',
    'OPERATIONS_DEPARTMENT': 'operations_department',
    'REPORTS_DEPARTMENT': 'reports_department'
}





# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "your_default_secret_key")  # Set secret key for sessions

# Configure session settings
app.config.update(
    SESSION_COOKIE_SECURE=True,  # Only send cookie over HTTPS
    SESSION_COOKIE_HTTPONLY=True,  # Prevent JavaScript access
    SESSION_COOKIE_SAMESITE='Lax',  # Allow cross-site requests
    SESSION_COOKIE_DOMAIN='.bajajearths.com',  # Set domain to allow subdomain access
    PERMANENT_SESSION_LIFETIME=timedelta(hours=24),  # Session expires in 24 hours
    SESSION_COOKIE_PATH='/',  # Set cookie path
    SESSION_REFRESH_EACH_REQUEST=True  # Refresh session on each request
)

logger.info("Flask app initialized")

# Frontend URL
# FRONTEND_URL = "http://admin.bajajearths.com"
# _frontend_opened = False

# Load configurations from environment variables
def get_base_dir():
    if getattr(sys, 'frozen', False):
        # If running as compiled executable
        return sys._MEIPASS
    # If running in development
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
OUTPUT_DIR = os.getenv("OUTPUT_DIR", os.path.join(os.path.expanduser("~"), "Salary_Slips"))
TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", os.path.join(BASE_DIR, "ssformat.docx"))
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", os.path.join(os.path.expanduser("~"), "app.log"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Print the actual template path for debugging
print("Template path: {}".format(TEMPLATE_PATH))
print("Base directory: {}".format(BASE_DIR))

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configure logging
if not app.logger.handlers:
    handler = RotatingFileHandler(LOG_FILE_PATH, maxBytes=10*1024*1024, backupCount=5)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    handler.propagate = False

from flask_cors import CORS

# CORS Configuration
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_ORIGINS'] = [
    "https://admin.bajajearths.com",
    "https://whatsapp.bajajearths.com",
]
app.config['CORS_METHODS'] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
app.config['CORS_ALLOW_HEADERS'] = ["Content-Type", "Authorization", "X-User-Role", "X-User-Email"]
app.config['CORS_EXPOSE_HEADERS'] = ["Content-Type", "Authorization", "X-User-Email"]
app.config['CORS_SUPPORTS_CREDENTIALS'] = True
app.config['CORS_MAX_AGE'] = 120

# Initialize CORS with proper configuration
CORS(app, 
     origins=app.config['CORS_ORIGINS'],
     methods=app.config['CORS_METHODS'],
     allow_headers=app.config['CORS_ALLOW_HEADERS'],
     expose_headers=app.config['CORS_EXPOSE_HEADERS'],
     supports_credentials=True,
     max_age=app.config['CORS_MAX_AGE'])

@app.before_request
def log_request_info():
    """Log only essential request information for debugging"""
    # Comment out or remove verbose logs
    # logger.info('Headers: %s', request.headers)
    # logger.info('Body: %s', request.get_data())
    # logger.info('URL: %s', request.url)
    # Only log method and URL if needed
    # logger.info('Method: %s URL: %s', request.method, request.url)
    pass

@app.after_request
def after_request(response):
    """Add CORS headers to all responses, but do not log response status or headers."""
    # Flask-CORS is already handling CORS headers, so we don't need to add them manually
    # logger.info('Response status: %s', response.status)
    # logger.info('Response headers: %s', response.headers)
    # origin = request.headers.get('Origin')
    # logger.info('Request origin: %s', origin)
    return response

# Flask-CORS automatically handles OPTIONS preflight requests, so we don't need manual handlers

@app.route("/api/preview-file", methods=["POST"])
def preview_file():
    logger.info('Handling preview file request')

    temp_path = None
    try:
        if 'file' not in request.files:
            logger.error('No file in request')
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if file.filename == '':
            logger.error('Empty filename')
            return jsonify({"error": "No file selected"}), 400

        logger.info('Processing file: %s', file.filename)
        
        # Create a temporary file to store the uploaded file
        temp_dir = os.path.join(BASE_DIR, 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, file.filename)
        
        # Save the uploaded file
        file.save(temp_path)
        logger.info('File saved to: %s', temp_path)
        
        # Read the file content
        content = process_reports(temp_path)
        logger.info('File processed successfully')
        return jsonify({"content": content})
    except Exception as e:
        logger.error("Error previewing file: {}".format(e), exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        # Clean up the temporary file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
            logger.info('Temporary file removed')

# def delayed_open_frontend():
#     """Open frontend URL after a short delay to ensure server is running"""
#     global _frontend_opened
#     if _frontend_opened:
#         return
#     try:
#         # Wait for server to start
#         time.sleep(2)
#         logger.info("Attempting to open frontend URL...")
#         webbrowser.open(FRONTEND_URL)
#         logger.info("Successfully opened frontend URL: {}".format(FRONTEND_URL))
#         _frontend_opened = True
#     except Exception as e:
#         logger.error("Failed to open frontend URL: {}".format(str(e)), exc_info=True)

# @app.before_request
# def before_request():
#     """Handle pre-request tasks"""
#     try:
#         delayed_open_frontend()
#     except Exception as e:
#         logger.error("Error in before_request: {}".format(str(e)), exc_info=True)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')

def get_drive_service():
    try:
        credentials = service_account.Credentials.from_service_account_file(CLIENT_SECRETS_FILE)
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        app.logger.error("Error initializing Google Drive service: {}".format(e))
        raise

@app.before_request
def load_user():
    g.user_role = request.headers.get('X-User-Role', 'user')

@app.route("/api/add_user", methods=["POST"])
def add_user():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        role = data.get('role')
        password = generate_password_hash(data.get('password'))
        app_password = data.get('appPassword') or data.get('app_password')
        permissions = data.get('permissions', {})

        if not all([username, email, role, password]):
            return jsonify({"error": "Missing required fields"}), 400

        # Admin role gets all permissions automatically
        if role == 'admin':
            permissions = {
                'inventory': True,
                'reports': True,
                'single_processing': True,
                'batch_processing': True,
                'expense_management': True,
                'marketing_campaigns': True,
                'reactor_reports': True
            }

        user_id = firebase_add_user(
            username=username, 
            email=email, 
            role=role, 
            password_hash=password, 
            app_password=app_password,
            permissions=permissions
        )
        return jsonify({"message": "User added successfully", "user_id": user_id}), 201

    except Exception as e:
        logger.error("Error adding user: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/delete_user", methods=["POST"])
def delete_user():
    try:
        # Check if user is logged in
        current_user = session.get('user')
        if not current_user:
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        # Get target user
        target_user = get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        current_user_role = current_user.get('role')
        target_user_role = target_user.get('role')

        # Admin can delete any user
        if current_user_role == 'admin':
            firebase_delete_user(user_id)
            return jsonify({"message": "User deleted successfully"}), 200
        
        # Regular users cannot delete other users
        else:
            return jsonify({"error": "Insufficient permissions to delete users"}), 403

    except Exception as e:
        logger.error("Error deleting user: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/update_role", methods=["POST"])
def update_role():
    try:
        # Check if user is logged in
        current_user = session.get('user')
        if not current_user:
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        user_id = data.get('user_id')
        new_role = data.get('role')

        if not all([user_id, new_role]):
            return jsonify({"error": "User ID and role are required"}), 400

        # Get target user
        target_user = get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        current_user_role = current_user.get('role')
        target_user_role = target_user.get('role')

        # Admin can update any user's role
        if current_user_role == 'admin':
            # Update role
            firebase_update_role(user_id, new_role)
            
            # Only update permissions if changing TO admin (admin gets all permissions)
            # or if changing FROM admin (preserve existing permissions for regular users)
            if new_role == 'admin':
                # Admin role gets all permissions automatically
                update_user_comprehensive_permissions(user_id, {
                    'permissions': {
                        'inventory': True,
                        'reports': True,
                        'single_processing': True,
                        'batch_processing': True,
                        'expense_management': True,
                        'marketing_campaigns': True,
                        'reactor_reports': True
                    }
                })
            # For other role changes, preserve existing permissions (don't overwrite)
            
            return jsonify({"message": "Role updated successfully"}), 200
        
        # Regular users cannot update roles
        else:
            return jsonify({"error": "Insufficient permissions to update user roles"}), 403

    except Exception as e:
        logger.error("Error updating role: {}".format(e))
        return jsonify({"error": str(e)}), 500
    


@app.route("/api/get_users", methods=["GET"])
def get_users():
    try:
        users = firebase_get_all_users()
        return jsonify(users), 200
        
    except Exception as e:
        logger.error("Error getting users: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/user/<string:user_id>", methods=["GET"])
def get_user(user_id):
    try:
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify(user), 200

    except Exception as e:
        logger.error("Error getting user: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/generate-salary-slip-single", methods=["POST"])
def generate_salary_slip_single():
    try:
        # Get user_id from session
        user_id = session.get('user', {}).get('email')
        
        user_inputs = request.json
        app.logger.info("Processing single salary slip request")

        # Check for required data structure
        if not user_inputs.get("months_data"):
            return jsonify({"error": "months_data is required"}), 400

        employee_identifier = user_inputs.get("employee_code")
        if not employee_identifier or employee_identifier.strip() == "":
            return jsonify({"error": "employee_code is required and cannot be empty"}), 400

        send_whatsapp = user_inputs.get("send_whatsapp", False)
        send_email = user_inputs.get("send_email", False)

        # Initialize list to collect PDFs
        collected_pdfs = []
        results = []
        employee = None
        drive_employees = None
        email_employees = None
        contact_employees = None
        
        # First pass: Generate all PDFs
        for month_data in user_inputs["months_data"]:
            try:
                sheet_id_salary = month_data.get("sheet_id_salary")
                sheet_id_drive = month_data.get("sheet_id_drive")
                full_month = month_data.get("month")
                full_year = month_data.get("year")

                if not all([sheet_id_salary, sheet_id_drive, full_month, full_year]):
                    results.append({
                        "month": full_month,
                        "year": full_year,
                        "status": "error",
                        "message": "Missing required data for this month"
                    })
                    continue

                sheet_name = full_month[:3]

                # Fetch data
                try:
                    salary_data = fetch_google_sheet_data(sheet_id_salary, sheet_name)
                    drive_data = fetch_google_sheet_data(sheet_id_salary, "Salary Details")
                    email_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
                    contact_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
                except Exception as e:
                    results.append({
                        "month": full_month,
                        "year": full_year,
                        "status": "error",
                        "message": "Error fetching data: {}".format(str(e))
                    })
                    continue

                if not all([salary_data, drive_data, email_data, contact_data]):
                    results.append({
                        "month": full_month,
                        "year": full_year,
                        "status": "error",
                        "message": "Failed to fetch required data"
                    })
                    continue

                # Process data
                salary_headers = salary_data[1]
                employees = salary_data[2:]
                
                # Convert salary data to dictionaries
                salary_employees = [dict(zip(salary_headers, row)) for row in employees]

                drive_headers = drive_data[1]
                drive_employees = [dict(zip(drive_headers, row)) for row in drive_data[2:]]

                email_headers = email_data[1]
                email_employees = [dict(zip(email_headers, row)) for row in email_data[2:]]

                contact_headers = contact_data[1]
                contact_employees = [dict(zip(contact_headers, row)) for row in contact_data[2:]]

                # Find employee
                employee = next((emp for emp in drive_employees 
                               if emp.get('Employee\nCode') == employee_identifier), None)
                if not employee:
                    results.append({
                        "month": full_month,
                        "year": full_year,
                        "status": "error",
                        "message": "Employee not found in drive data"
                    })
                    continue

                # Find employee in salary data
                salary_employee = next((emp for emp in salary_employees 
                                      if emp.get('Employee\nCode') == employee_identifier), None)
                if not salary_employee:
                    results.append({
                        "month": full_month,
                        "year": full_year,
                        "status": "error",
                        "message": "Employee salary data not found"
                    })
                    continue

                # Process salary slip
                try:
                    # Convert dictionary values back to list in the correct order
                    employee_data = [str(salary_employee.get(header, '')) for header in salary_headers]
                    pdf_path = process_salary_slip(
                        template_path=TEMPLATE_PATH,
                        output_dir=OUTPUT_DIR,
                        employee_identifier=employee_identifier,
                        employee_data=employee_data,
                        headers=salary_headers,
                        drive_data=drive_employees,
                        email_employees=email_employees,
                        contact_employees=contact_employees,
                        month=sheet_name,
                        year=str(full_year)[-2:],
                        full_month=full_month,
                        full_year=full_year,
                        send_whatsapp=send_whatsapp,
                        send_email=send_email,
                        is_special=len(user_inputs["months_data"]) > 1,
                        months_data=user_inputs["months_data"],
                        collected_pdfs=collected_pdfs
                    )
                    if pdf_path and pdf_path.get("success") and pdf_path.get("output_file"):
                        collected_pdfs.append(pdf_path["output_file"])
                        results.append({
                            "month": full_month,
                            "year": full_year,
                            "status": "success",
                            "message": "Salary slip generated successfully",
                            "pdf_path": pdf_path["output_file"]
                        })
                    else:
                        results.append({
                            "month": full_month,
                            "year": full_year,
                            "status": "error",
                            "message": "Failed to generate salary slip" + (f": {pdf_path.get('errors', [])}" if pdf_path and isinstance(pdf_path, dict) else "")
                        })
                except Exception as e:
                    results.append({
                        "month": full_month,
                        "year": full_year,
                        "status": "error",
                        "message": "Error processing salary slip: {}".format(str(e))
                    })

            except Exception as e:
                results.append({
                    "month": full_month if 'full_month' in locals() else "Unknown",
                    "year": full_year if 'full_year' in locals() else "Unknown",
                    "status": "error",
                    "message": "Error processing month: {}".format(str(e))
                })

        # Only proceed with notifications if we have successfully generated PDFs
        # Note: WhatsApp notifications are sent here to prevent duplicates from process_salary_slip function
        if collected_pdfs and employee and drive_employees and email_employees and contact_employees:
            # Send email if enabled
            if send_email:
                try:
                    recipient_email = get_employee_email(employee.get("Name"), email_employees)
                    if recipient_email:
                        is_special = len(user_inputs["months_data"]) > 1
                        if is_special:
                            email_subject = "Salary Slips - Bajaj Earths Pvt. Ltd."
                        else:
                            email_subject = "Salary Slip - Bajaj Earths Pvt. Ltd."
                        email_body = """
                                    <html>
                                    <body>
                                    <p>Dear <b>{}</b>,</p>
                                    <p>Please find attached your <b>salary slip</b> for the month of <b>{} {}</b>.</p>
                                    <p>This document includes:</p>
                                    <ul>
                                    <li>Earnings Breakdown</li>
                                    <li>Deductions Summary</li>
                                    <li>Net Salary Details</li>
                                    </ul>
                                    <p>Kindly review the salary slip, and if you have any questions or concerns, please feel free to reach out to the HR department.</p>
                                    <p>Thanks & Regards,</p>
                                    </body>
                                    </html>
                        """.format(employee.get("Name"), full_month, full_year)
                        logging.info("Sending email to {}".format(recipient_email))
                        user_email = session.get('user', {}).get('email')
                        success = send_email_smtp(
                            recipient_email=recipient_email,
                            subject=email_subject,
                            body=email_body,
                            attachment_paths=collected_pdfs,
                            user_email=user_email
                        )
                        if success == "TOKEN_EXPIRED":
                            return jsonify({"error": "TOKEN_EXPIRED"}), 401
                        elif success == "USER_NOT_LOGGED_IN":
                            return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                        elif success == "NO_SMTP_CREDENTIALS":
                            return jsonify({"error": "NO_SMTP_CREDENTIALS", "message": "Email credentials not found. Please check your settings."}), 400
                        elif success == "INVALID_RECIPIENT":
                            return jsonify({"error": "INVALID_RECIPIENT", "message": "Invalid recipient email address."}), 400
                        elif success == "NO_VALID_RECIPIENTS":
                            return jsonify({"error": "NO_VALID_RECIPIENTS", "message": "No valid recipient emails found."}), 400
                        elif success == "SMTP_AUTH_FAILED":
                            return jsonify({"error": "SMTP_AUTH_FAILED", "message": "Email authentication failed. Please check your credentials."}), 400
                        elif success == "SMTP_ERROR":
                            return jsonify({"error": "SMTP_ERROR", "message": "Email service error. Please try again later."}), 500
                        elif success == "EMAIL_SEND_ERROR":
                            return jsonify({"error": "EMAIL_SEND_ERROR", "message": "Failed to send email. Please try again."}), 500
                        elif not success:
                            logging.error("Failed to send email to {}".format(recipient_email))
                            return jsonify({"error": "EMAIL_SEND_FAILED", "message": "Failed to send email. Please try again."}), 500
                        else:
                            logging.info("Email sent to {}".format(recipient_email))
                    else:
                        logging.warning("No email found for {}".format(employee.get("Name")))
                except Exception as e:
                    logging.error("Error sending email: {}".format(str(e)))
                    return jsonify({"error": "EMAIL_ERROR", "message": f"Error sending email: {str(e)}"}), 500

            # Send WhatsApp messages if enabled
            if send_whatsapp:
                try:
                    contact_name = employee.get("Name")
                    whatsapp_number = get_employee_contact(contact_name, contact_employees)
                    if whatsapp_number and collected_pdfs:
                        logging.info(f"Sending WhatsApp notification to {contact_name} for {len(collected_pdfs)} PDF(s)")
                        logging.info(f"PDF files to send: {collected_pdfs}")
                        # Send all collected PDFs in one WhatsApp message
                        success = handle_whatsapp_notification(
                            contact_name=contact_name,
                            full_month=full_month,
                            full_year=full_year,
                            whatsapp_number=whatsapp_number,
                            file_path=collected_pdfs,
                            is_special=len(user_inputs["months_data"]) > 1,
                            months_data=user_inputs["months_data"]
                        )
                        
                        if success == "USER_NOT_LOGGED_IN":
                            return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                        elif success == "WHATSAPP_SERVICE_NOT_READY":
                            # Instead of returning 503, log a warning and continue
                            logging.warning("WhatsApp service is not ready. Salary slips generated but WhatsApp messages could not be sent.")
                            app.logger.warning("WhatsApp service is not ready. Please authenticate WhatsApp first.")
                            # Continue processing - don't return error
                            # return jsonify({"error": "WHATSAPP_SERVICE_NOT_READY", "message": "WhatsApp service is not ready. Please try again later."}), 503
                        elif success == "INVALID_FILE_PATH":
                            return jsonify({"error": "INVALID_FILE_PATH", "message": "Invalid file path for WhatsApp message."}), 400
                        elif success == "INVALID_FILE_PATH_TYPE":
                            return jsonify({"error": "INVALID_FILE_PATH_TYPE", "message": "Invalid file path type for WhatsApp message."}), 400
                        elif success == "NO_VALID_FILES":
                            return jsonify({"error": "NO_VALID_FILES", "message": "No valid files found for WhatsApp message."}), 400
                        elif success == "NO_FILES_FOR_UPLOAD":
                            return jsonify({"error": "NO_FILES_FOR_UPLOAD", "message": "No files available for WhatsApp upload."}), 400
                        elif success == "WHATSAPP_API_ERROR":
                            return jsonify({"error": "WHATSAPP_API_ERROR", "message": "WhatsApp API error. Please try again later."}), 500
                        elif success == "WHATSAPP_CONNECTION_ERROR":
                            return jsonify({"error": "WHATSAPP_CONNECTION_ERROR", "message": "WhatsApp connection error. Please try again later."}), 500
                        elif success == "WHATSAPP_TIMEOUT_ERROR":
                            return jsonify({"error": "WHATSAPP_TIMEOUT_ERROR", "message": "WhatsApp timeout error. Please try again later."}), 500
                        elif success == "WHATSAPP_SEND_ERROR":
                            return jsonify({"error": "WHATSAPP_SEND_ERROR", "message": "Failed to send WhatsApp message. Please try again."}), 500
                        elif not success:
                            logging.error("Failed to send WhatsApp message to {}".format(contact_name))
                            return jsonify({"error": "WHATSAPP_SEND_FAILED", "message": "Failed to send WhatsApp message. Please try again."}), 500
                        else:
                            logging.info("WhatsApp message sent successfully to {}".format(contact_name))
                    else:
                        logging.warning("No WhatsApp number found for {}".format(contact_name))
                except Exception as e:
                    logging.error("Error sending WhatsApp message: {}".format(str(e)))
                    return jsonify({"error": "WHATSAPP_ERROR", "message": f"Error sending WhatsApp message: {str(e)}"}), 500

        # Return results for all processed months
        return jsonify({
            "message": "Processing completed",
            "results": results
        }), 200 if all(r["status"] == "success" for r in results) else 207

    except Exception as e:
        app.logger.error("Error: {}".format(e))
        return jsonify({"error": str(e)}), 500
    finally:
        # Optional cleanup or logging here if needed
        pass

@app.route("/api/generate-salary-slips-batch", methods=["POST"])
def generate_salary_slips_batch():
    try:
        user_inputs = request.json
        app.logger.info("Processing batch salary slips request")

        required_keys = ["sheet_id_salary", "sheet_id_drive", "full_month", "full_year"]
        missing_keys = [key for key in required_keys if not user_inputs.get(key)]
        if missing_keys:
            return jsonify({"error": "Missing parameters: {}".format(', '.join(missing_keys))}), 400

        sheet_id_salary = user_inputs["sheet_id_salary"]
        sheet_id_drive = user_inputs["sheet_id_drive"]
        full_month = user_inputs["full_month"]
        full_year = user_inputs["full_year"]
        sheet_name = full_month[:3]
        send_whatsapp = user_inputs.get("send_whatsapp", False)
        send_email = user_inputs.get("send_email", False)

        # Fetch data
        try:
            salary_data = fetch_google_sheet_data(sheet_id_salary, sheet_name)
            drive_data = fetch_google_sheet_data(sheet_id_salary, "Salary Details")
            email_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
        except Exception as e:
            return jsonify({"error": "Error fetching data: {}".format(e)}), 500

        if not all([salary_data, drive_data, email_data, contact_data]):
            return jsonify({"error": "Failed to fetch required data"}), 500

        # Process data
        salary_headers = (salary_data[1])
        employees = salary_data[2:]

        drive_headers = (drive_data[1])
        drive_employees = [dict(zip(drive_headers, row)) for row in drive_data[2:]]

        email_headers = (email_data[1])
        email_employees = [dict(zip(email_headers, row)) for row in email_data[2:]]

        contact_headers = (contact_data[1])
        contact_employees = [dict(zip(contact_headers, row)) for row in contact_data[2:]]

        
       # Generate salary slips for each employee sequentially
        for employee in employees:
            employee_name = employee[4]  # Assuming the employee name is at index 4
            app.logger.info("Processing salary slip for employee: {}".format(employee_name))
            try:
                employee_data = [str(item) if item is not None else '' for item in employee]
                # Get employee code from the employee data
                employee_code_index = next((i for i, header in enumerate(salary_headers) if 'Employee' in header and 'Code' in header), 0)
                employee_identifier = employee[employee_code_index] if employee_code_index < len(employee) else ''
                
                process_salary_slips(
                    template_path=TEMPLATE_PATH,
                    output_dir=OUTPUT_DIR,
                    employee_identifier=employee_identifier,
                    employee_data=employee_data,
                    headers=salary_headers,
                    drive_data=drive_employees,
                    email_employees=email_employees,
                    contact_employees=contact_employees,
                    month=sheet_name,
                    year=str(full_year)[-2:],  # Last two digits of the year
                    full_month=full_month,
                    full_year=full_year,
                    send_whatsapp=send_whatsapp,
                    send_email=send_email
                )
                if send_email:
                    app.logger.info("Sending email to {}".format(employee[5]))  # Assuming email is at index 5
                    user_email = session.get('user', {}).get('email')
                    if not user_email:
                        return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                    
                    # Get recipient email
                    recipient_email = get_employee_email(employee[4], email_employees)  # Assuming name is at index 4
                    if recipient_email:
                        email_subject = "Salary Slip - Bajaj Earths Pvt. Ltd."
                        email_body = f"""
                        <html>
                        <body>
                        <p>Dear <b>{employee[4]}</b>,</p>
                        <p>Please find attached your <b>salary slip</b> for the month of <b>{full_month} {full_year}</b>.</p>
                        <p>This document includes:</p>
                        <ul>
                        <li>Earnings Breakdown</li>
                        <li>Deductions Summary</li>
                        <li>Net Salary Details</li>
                        </ul>
                        <p>Kindly review the salary slip, and if you have any questions or concerns, please feel free to reach out to the HR department.</p>
                        <p>Thanks & Regards,</p>
                        </body>
                        </html>
                        """
                        
                        success = send_email_smtp(
                            recipient_email=recipient_email,
                            subject=email_subject,
                            body=email_body,
                            attachment_paths=[output_pdf] if 'output_pdf' in locals() else [],
                            user_email=user_email
                        )
                        
                        if success == "TOKEN_EXPIRED":
                            return jsonify({"error": "TOKEN_EXPIRED"}), 401
                        elif success == "USER_NOT_LOGGED_IN":
                            return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                        elif success == "NO_SMTP_CREDENTIALS":
                            return jsonify({"error": "NO_SMTP_CREDENTIALS", "message": "Email credentials not found. Please check your settings."}), 400
                        elif success == "INVALID_RECIPIENT":
                            return jsonify({"error": "INVALID_RECIPIENT", "message": "Invalid recipient email address."}), 400
                        elif success == "NO_VALID_RECIPIENTS":
                            return jsonify({"error": "NO_VALID_RECIPIENTS", "message": "No valid recipient emails found."}), 400
                        elif success == "SMTP_AUTH_FAILED":
                            return jsonify({"error": "SMTP_AUTH_FAILED", "message": "Email authentication failed. Please check your credentials."}), 400
                        elif success == "SMTP_ERROR":
                            return jsonify({"error": "SMTP_ERROR", "message": "Email service error. Please try again later."}), 500
                        elif success == "EMAIL_SEND_ERROR":
                            return jsonify({"error": "EMAIL_SEND_ERROR", "message": "Failed to send email. Please try again."}), 500
                        elif not success:
                            app.logger.error("Failed to send email to {}".format(recipient_email))
                            return jsonify({"error": "EMAIL_SEND_FAILED", "message": "Failed to send email. Please try again."}), 500
                    else:
                        app.logger.warning("No email found for {}".format(employee[4]))
                        
                if send_whatsapp:
                    app.logger.info("Sending WhatsApp message to {}".format(employee[6]))  # Assuming phone number is at index 6
                    user_email = session.get('user', {}).get('email')
                    if not user_email:
                        return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                    
                    contact_name = employee[4]  # Assuming name is at index 4
                    whatsapp_number = get_employee_contact(contact_name, contact_employees)
                    if whatsapp_number:
                        success = handle_whatsapp_notification(
                            contact_name=contact_name,
                            full_month=full_month,
                            full_year=full_year,
                            whatsapp_number=whatsapp_number,
                            file_path=[output_pdf] if 'output_pdf' in locals() else [],
                            is_special=False
                        )
                        
                        if success == "USER_NOT_LOGGED_IN":
                            return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                        elif success == "WHATSAPP_SERVICE_NOT_READY":
                            # Instead of returning 503, log a warning and continue
                            logging.warning("WhatsApp service is not ready. Salary slips generated but WhatsApp messages could not be sent.")
                            app.logger.warning("WhatsApp service is not ready. Please authenticate WhatsApp first.")
                            # Continue processing - don't return error
                            # return jsonify({"error": "WHATSAPP_SERVICE_NOT_READY", "message": "WhatsApp service is not ready. Please try again later."}), 503
                        elif success == "INVALID_FILE_PATH":
                            return jsonify({"error": "INVALID_FILE_PATH", "message": "Invalid file path for WhatsApp message."}), 400
                        elif success == "INVALID_FILE_PATH_TYPE":
                            return jsonify({"error": "INVALID_FILE_PATH_TYPE", "message": "Invalid file path type for WhatsApp message."}), 400
                        elif success == "NO_VALID_FILES":
                            return jsonify({"error": "NO_VALID_FILES", "message": "No valid files found for WhatsApp message."}), 400
                        elif success == "NO_FILES_FOR_UPLOAD":
                            return jsonify({"error": "NO_FILES_FOR_UPLOAD", "message": "No files available for WhatsApp upload."}), 400
                        elif success == "WHATSAPP_API_ERROR":
                            return jsonify({"error": "WHATSAPP_API_ERROR", "message": "WhatsApp API error. Please try again later."}), 500
                        elif success == "WHATSAPP_CONNECTION_ERROR":
                            return jsonify({"error": "WHATSAPP_CONNECTION_ERROR", "message": "WhatsApp connection error. Please try again later."}), 500
                        elif success == "WHATSAPP_TIMEOUT_ERROR":
                            return jsonify({"error": "WHATSAPP_TIMEOUT_ERROR", "message": "WhatsApp timeout error. Please try again later."}), 500
                        elif success == "WHATSAPP_SEND_ERROR":
                            return jsonify({"error": "WHATSAPP_SEND_ERROR", "message": "Failed to send WhatsApp message. Please try again."}), 500
                        elif not success:
                            app.logger.error("Failed to send WhatsApp message to {}".format(contact_name))
                            return jsonify({"error": "WHATSAPP_SEND_FAILED", "message": "Failed to send WhatsApp message. Please try again."}), 500
                        else:
                            app.logger.info("WhatsApp message sent successfully to {}".format(contact_name))
            except Exception as e:
                error_msg = "Error processing salary slip for employee {}: {}".format(employee_name, e)
                app.logger.error(error_msg)
                return jsonify({"error": error_msg}), 500

        return jsonify({"message": "Batch salary slips generated successfully"}), 200

    except Exception as e:
        app.logger.error("Error: {}".format(e))
        return jsonify({"error": str(e)}), 500
    finally:
        # Optional cleanup or logging here if needed
        pass

@app.route("/api/get-logs", methods=["GET"])
def get_logs():
    try:
        with open(LOG_FILE_PATH, "r") as log_file:
            logs = log_file.read()
        return logs, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        app.logger.error("Error reading logs: {}".format(e))
        return jsonify({"error": "Failed to read logs"}), 500

@app.route("/api/", methods=["GET"])
def home():
    return jsonify({"message": "Welcome to the Salary Slip Automation API!"}), 200

@app.route("/api/update_permissions", methods=["POST"])
def update_permissions():
    try:
        # Check if user is logged in
        current_user = session.get('user')
        if not current_user:
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        user_id = data.get('user_id')
        permissions = data.get('permissions')

        if not all([user_id, permissions]):
            return jsonify({"error": "User ID and permissions are required"}), 400

        # Get target user
        target_user = get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        current_user_role = current_user.get('role')
        target_user_role = target_user.get('role')

        # Admin can update permissions for any user
        if current_user_role == 'admin':
            # Update user with tree-based permissions only
            from Utils.firebase_utils import update_user_comprehensive_permissions
            update_user_comprehensive_permissions(user_id, {
                'permissions': permissions
            })
            
            return jsonify({"message": "Permissions updated successfully"}), 200
        
        # Regular users cannot update permissions
        else:
            return jsonify({"error": "Insufficient permissions to update user permissions"}), 403

    except Exception as e:
        logger.error("Error updating permissions: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/send-reports", methods=["POST"])
def generate_report():
    try:
        user_id = session.get('user', {}).get('email')
        if not user_id:
            logger.error("No user_id found in session. User must be logged in to send reports.")
            return jsonify({"error": "User not authenticated"}), 401
        
        # Get form data
        template_files = request.files.getlist('template_files')
        attachment_files = request.files.getlist('attachment_files')
        file_sequence = json.loads(request.form.get('file_sequence', '{}'))
        sheet_id = request.form.get('sheet_id')
        sheet_name = request.form.get('sheet_name')
        send_whatsapp = request.form.get('send_whatsapp') == 'true'
        send_email = request.form.get('send_email') == 'true'
        mail_subject = request.form.get('mail_subject')

        if not template_files:
            return jsonify({"error": "No template files provided"}), 400

        if not sheet_id:
            return jsonify({"error": "Google Sheet ID is required"}), 400

        if not sheet_name:
            return jsonify({"error": "Sheet name is required"}), 400

        # Validate sheet ID format
        if not validate_sheet_id(sheet_id):
            return jsonify({"error": "Invalid Google Sheet ID format"}), 400

        # Create temporary directory for attachments
        temp_dir = os.path.join(OUTPUT_DIR, "temp_attachments")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Save attachment files temporarily and store their paths
        attachment_paths = prepare_file_paths(attachment_files, temp_dir=temp_dir, is_upload=True)

        try:
            # Fetch data from Google Sheet
            sheet_data = fetch_google_sheet_data(sheet_id, sheet_name)
            if not sheet_data or len(sheet_data) < 2:  # Check if we have headers and at least one row
                return jsonify({"error": "No data found in the Google Sheet"}), 400
        except Exception as e:
            logger.error("Error fetching Google Sheet data: {}".format(e))
            return jsonify({"error": "Failed to fetch data from Google Sheet"}), 500

        # Process headers and data
        headers = sheet_data[0]
        data_rows = sheet_data[1:]

        # Create output directory if it doesn't exist
        output_dir = os.path.join(OUTPUT_DIR, "reports")
        os.makedirs(output_dir, exist_ok=True)

        # Process each template file
        generated_files = []
        for template_file in template_files:
            if not template_file.filename.endswith('.docx'):
                continue

            # Save template temporarily
            temp_template_path = os.path.join(output_dir, "temp_{}".format(template_file.filename))
            template_file.save(temp_template_path)

            # Read template content for messages
            try:
                doc = Document(temp_template_path)
                template_content = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                logger.error("Error reading template content: {}".format(e))
                return jsonify({"error": "Failed to read template content"}), 500
            
            if send_whatsapp:
                pass

            # Process each row of data
            for row in data_rows:
                try:
                    # Create data dictionary from headers and row
                    data_dict = dict(zip(headers, row))

                    recipient_name = data_dict.get('Name', 'unknown')
                    
                    # Generate report for this row
                    output_filename = "report_{}.docx".format(recipient_name)
                    output_path = os.path.join(output_dir, output_filename)
                    
                    # Process the template with data
                    process_template(temp_template_path, output_path, data_dict)
                    generated_files.append(output_path)

                    # Process template content for messages
                    message_content = template_content
                    email_content = template_content

                    # Replace placeholders in message content
                    for key, value in data_dict.items():
                        placeholder = "{{{}}}".format(key)
                        message_content = message_content.replace(placeholder, str(value))
                        email_content = email_content.replace(placeholder, str(value))
                        mail_subject = mail_subject.replace(placeholder, str(value))

                    # Get contact details from Google Sheet data
                    recipient_email = data_dict.get('Email ID - To')
                    cc_email = data_dict.get('Email ID - CC', '')
                    bcc_email = data_dict.get('Email ID - BCC', '')
                    
                    # Helper to split emails by comma or newline and join as comma-separated string
                    def clean_emails(email_str):
                        if not email_str:
                            return None
                        emails = [e.strip() for e in re.split(r'[\n,]+', email_str) if e.strip()]
                        return ','.join(emails) if emails else None
                    
                    recipient_email = clean_emails(recipient_email)
                    cc_email = clean_emails(cc_email)
                    bcc_email = clean_emails(bcc_email)
                    
                    country_code = data_dict.get('Country Code', '').strip()
                    phone_no = data_dict.get('Contact No.', '').strip()
                    recipient_phone = "{} {}".format(country_code, phone_no)

                    if send_whatsapp:
                        if not recipient_phone or not country_code or not phone_no:
                            logger.warning("Skipping WhatsApp message for {}: Missing Country Code or Contact No.".format(recipient_name))
                            continue

                        try:
                            # Send WhatsApp message with attachments
                            success = send_whatsapp_message(
                                contact_name=recipient_name,
                                message="",  # Empty message - will use template
                                file_paths=attachment_paths,
                                file_sequence = file_sequence,
                                whatsapp_number=recipient_phone,
                                process_name="report"
                            )
                            
                            if success == "USER_NOT_LOGGED_IN":
                                return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                            elif success == "WHATSAPP_SERVICE_NOT_READY":
                                return jsonify({"error": "WHATSAPP_SERVICE_NOT_READY", "message": "WhatsApp service is not ready. Please try again later."}), 503
                            elif success == "INVALID_FILE_PATH":
                                return jsonify({"error": "INVALID_FILE_PATH", "message": "Invalid file path for WhatsApp message."}), 400
                            elif success == "INVALID_FILE_PATH_TYPE":
                                return jsonify({"error": "INVALID_FILE_PATH_TYPE", "message": "Invalid file path type for WhatsApp message."}), 400
                            elif success == "NO_VALID_FILES":
                                return jsonify({"error": "NO_VALID_FILES", "message": "No valid files found for WhatsApp message."}), 400
                            elif success == "NO_FILES_FOR_UPLOAD":
                                return jsonify({"error": "NO_FILES_FOR_UPLOAD", "message": "No files available for WhatsApp upload."}), 400
                            elif success == "WHATSAPP_API_ERROR":
                                return jsonify({"error": "WHATSAPP_API_ERROR", "message": "WhatsApp API error. Please try again later."}), 500
                            elif success == "WHATSAPP_CONNECTION_ERROR":
                                return jsonify({"error": "WHATSAPP_CONNECTION_ERROR", "message": "WhatsApp connection error. Please try again later."}), 500
                            elif success == "WHATSAPP_TIMEOUT_ERROR":
                                return jsonify({"error": "WHATSAPP_TIMEOUT_ERROR", "message": "WhatsApp timeout error. Please try again later."}), 500
                            elif success == "WHATSAPP_SEND_ERROR":
                                return jsonify({"error": "WHATSAPP_SEND_ERROR", "message": "Failed to send WhatsApp message. Please try again."}), 500
                            elif not success:
                                logger.error("Failed to send WhatsApp message to {}".format(recipient_phone))
                                return jsonify({"error": "WHATSAPP_SEND_FAILED", "message": "Failed to send WhatsApp message. Please try again."}), 500

                        except Exception as e:
                            logger.error("Error sending WhatsApp message to {}: {}".format(recipient_phone, e))

                    # Handle notifications if enabled
                    if send_email:
                        if not recipient_email:
                            logger.warning("No email found for recipient: {}".format(recipient_name))
                            continue
                        try:
                            email_subject = mail_subject
                            email_body = """
                            <html>
                            <body>
                            {} 
                            </body>
                            </html>
                            """.format(email_content.replace('\n', '<br>'))
                            user_email = session.get('user', {}).get('email')
                            success = send_email_smtp(
                                recipient_email=recipient_email,
                                subject=email_subject,
                                body=email_body,
                                attachment_paths=attachment_paths,
                                user_email=user_email,
                                cc=cc_email,
                                bcc=bcc_email
                            )
                            if success == "TOKEN_EXPIRED":
                                # Store the request data for retry
                                request_data = {
                                    'template_files_data': [],
                                    'attachment_files_data': [],
                                    'file_sequence': file_sequence,
                                    'sheet_id': sheet_id,
                                    'sheet_name': sheet_name,
                                    'send_whatsapp': send_whatsapp,
                                    'send_email': send_email,
                                    'mail_subject': mail_subject
                                }
                                
                                # Convert template files to base64 for storage
                                for template_file in template_files:
                                    if template_file.filename.endswith('.docx'):
                                        template_file.seek(0)  # Reset file pointer
                                        file_content = template_file.read()
                                        request_data['template_files_data'].append({
                                            'name': template_file.filename,
                                            'content': base64.b64encode(file_content).decode('utf-8')
                                        })
                                
                                # Convert attachment files to base64 for storage
                                for attachment_path in attachment_paths:
                                    if os.path.exists(attachment_path):
                                        with open(attachment_path, 'rb') as f:
                                            file_content = f.read()
                                            request_data['attachment_files_data'].append({
                                                'name': os.path.basename(attachment_path),
                                                'content': base64.b64encode(file_content).decode('utf-8')
                                            })
                                
                                return jsonify({
                                    "error": "TOKEN_EXPIRED",
                                    "request_data": request_data
                                }), 401
                            elif success == "USER_NOT_LOGGED_IN":
                                return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                            elif success == "NO_SMTP_CREDENTIALS":
                                return jsonify({"error": "NO_SMTP_CREDENTIALS", "message": "Email credentials not found. Please check your settings."}), 400
                            elif success == "INVALID_RECIPIENT":
                                return jsonify({"error": "INVALID_RECIPIENT", "message": "Invalid recipient email address."}), 400
                            elif success == "NO_VALID_RECIPIENTS":
                                return jsonify({"error": "NO_VALID_RECIPIENTS", "message": "No valid recipient emails found."}), 400
                            elif success == "SMTP_AUTH_FAILED":
                                return jsonify({"error": "SMTP_AUTH_FAILED", "message": "Email authentication failed. Please check your credentials."}), 400
                            elif success == "SMTP_ERROR":
                                return jsonify({"error": "SMTP_ERROR", "message": "Email service error. Please try again later."}), 500
                            elif success == "EMAIL_SEND_ERROR":
                                return jsonify({"error": "EMAIL_SEND_ERROR", "message": "Failed to send email. Please try again."}), 500
                            elif not success:
                                logger.error("Failed to send email to {}".format(recipient_email))
                                return jsonify({"error": "EMAIL_SEND_FAILED", "message": "Failed to send email. Please try again."}), 500
                        except Exception as e:
                            logger.error("Error sending email: {}".format(str(e)))

                except Exception as e:
                    logger.error("Error processing row: {}".format(e))
                    continue

            # Clean up temporary template
            os.remove(temp_template_path)

        # Clean up temporary attachment files
        for attachment_path in attachment_paths:
            try:
                if os.path.exists(attachment_path):
                    os.remove(attachment_path)
            except Exception as e:
                logger.error("Error removing temporary attachment file {}: {}".format(attachment_path, e))

        # Remove temporary directory and any remaining files
        try:
            if os.path.exists(temp_dir):
                # List any remaining files in the directory
                remaining_files = os.listdir(temp_dir)
                if remaining_files:
                    # Try to remove each remaining file
                    for file in remaining_files:
                        try:
                            file_path = os.path.join(temp_dir, file)
                            if os.path.isfile(file_path):
                                os.remove(file_path)
                        except Exception as e:
                            logger.error("Error removing remaining file {}: {}".format(file, e))
                
                # Try to remove the directory again
                try:
                    os.rmdir(temp_dir)
                except Exception as e:
                    logger.error("Failed to remove temporary directory {}: {}".format(temp_dir, e))
        except Exception as e:
            logger.error("Error during final cleanup: {}".format(e))

        return jsonify({
            "message": "Reports generated successfully",
            "generated_files": len(generated_files),
            "notifications_sent": {
                "email": send_email,
                "whatsapp": send_whatsapp
            }
        }), 200

    except Exception as e:
        logger.error("Error generating reports: {}".format(e))
        return jsonify({"error": str(e)}), 500
    finally:
        # Optional cleanup or logging here if needed
        pass

@app.route("/api/retry-reports", methods=["POST"])
def retry_reports():
    """Retry sending reports after token refresh"""
    try:
        user_id = session.get('user', {}).get('email')
        if not user_id:
            logger.error("No user_id found in session. User must be logged in to send reports.")
            return jsonify({"error": "User not authenticated"}), 401
        
        # Get the original request data from the request
        data = request.json
        original_request_data = data.get('original_request_data')
        
        if not original_request_data:
            return jsonify({"error": "Original request data is required"}), 400
        
        # Extract the data needed for report generation
        template_files_data = original_request_data.get('template_files_data', [])
        attachment_files_data = original_request_data.get('attachment_files_data', [])
        file_sequence = original_request_data.get('file_sequence', {})
        sheet_id = original_request_data.get('sheet_id')
        sheet_name = original_request_data.get('sheet_name')
        send_whatsapp = original_request_data.get('send_whatsapp', False)
        send_email = original_request_data.get('send_email', True)
        mail_subject = original_request_data.get('mail_subject', '')
        
        if not sheet_id or not sheet_name:
            return jsonify({"error": "Sheet ID and name are required"}), 400
        
        # Validate sheet ID format
        if not validate_sheet_id(sheet_id):
            return jsonify({"error": "Invalid Google Sheet ID format"}), 400
        
        # Create temporary directory for attachments
        temp_dir = os.path.join(OUTPUT_DIR, "temp_attachments")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Reconstruct attachment files from base64 data
        attachment_paths = []
        for attachment_data in attachment_files_data:
            try:
                file_name = attachment_data.get('name')
                file_content = base64.b64decode(attachment_data.get('content'))
                file_path = os.path.join(temp_dir, file_name)
                
                with open(file_path, 'wb') as f:
                    f.write(file_content)
                attachment_paths.append(file_path)
            except Exception as e:
                logger.error(f"Error reconstructing attachment {file_name}: {e}")
                continue
        
        try:
            # Fetch data from Google Sheet
            sheet_data = fetch_google_sheet_data(sheet_id, sheet_name)
            if not sheet_data or len(sheet_data) < 2:
                return jsonify({"error": "No data found in the Google Sheet"}), 400
        except Exception as e:
            logger.error("Error fetching Google Sheet data: {}".format(e))
            return jsonify({"error": "Failed to fetch data from Google Sheet"}), 500
        
        # Process headers and data
        headers = sheet_data[0]
        data_rows = sheet_data[1:]
        
        # Create output directory if it doesn't exist
        output_dir = os.path.join(OUTPUT_DIR, "reports")
        os.makedirs(output_dir, exist_ok=True)
        
        # Process each template file
        generated_files = []
        for template_data in template_files_data:
            try:
                file_name = template_data.get('name')
                file_content = base64.b64decode(template_data.get('content'))
                temp_template_path = os.path.join(output_dir, f"temp_{file_name}")
                
                with open(temp_template_path, 'wb') as f:
                    f.write(file_content)
                
                # Read template content for messages
                try:
                    doc = Document(temp_template_path)
                    template_content = "\n".join([paragraph.text for paragraph in doc.paragraphs])
                except Exception as e:
                    logger.error("Error reading template content: {}".format(e))
                    continue
                
                if send_whatsapp:
                    pass
                
                # Process each row of data
                for row in data_rows:
                    try:
                        # Create data dictionary from headers and row
                        data_dict = dict(zip(headers, row))
                        
                        recipient_name = data_dict.get('Name', 'unknown')
                        
                        # Generate report for this row
                        output_filename = "report_{}.docx".format(recipient_name)
                        output_path = os.path.join(output_dir, output_filename)
                        
                        # Process the template with data
                        process_template(temp_template_path, output_path, data_dict)
                        generated_files.append(output_path)
                        
                        # Process template content for messages
                        message_content = template_content
                        email_content = template_content
                        
                        # Replace placeholders in message content
                        for key, value in data_dict.items():
                            placeholder = "{{{}}}".format(key)
                            message_content = message_content.replace(placeholder, str(value))
                            email_content = email_content.replace(placeholder, str(value))
                            mail_subject = mail_subject.replace(placeholder, str(value))
                        
                        # Get contact details from Google Sheet data
                        recipient_email = data_dict.get('Email ID - To')
                        cc_email = data_dict.get('Email ID - CC', '')
                        bcc_email = data_dict.get('Email ID - BCC', '')
                        
                        # Helper to split emails by comma or newline and join as comma-separated string
                        def clean_emails(email_str):
                            if not email_str:
                                return None
                            emails = [e.strip() for e in re.split(r'[\n,]+', email_str) if e.strip()]
                            return ','.join(emails) if emails else None
                        
                        recipient_email = clean_emails(recipient_email)
                        cc_email = clean_emails(cc_email)
                        bcc_email = clean_emails(bcc_email)
                        
                        country_code = data_dict.get('Country Code', '').strip()
                        phone_no = data_dict.get('Contact No.', '').strip()
                        recipient_phone = "{} {}".format(country_code, phone_no)
                        
                        if send_whatsapp:
                            if not recipient_phone or not country_code or not phone_no:
                                logger.warning("Skipping WhatsApp message for {}: Missing Country Code or Contact No.".format(recipient_name))
                                continue
                            
                            try:
                                # Send WhatsApp message with attachments
                                success = send_whatsapp_message(
                                    contact_name=recipient_name,
                                    message="",  # Empty message - will use template
                                    file_paths=attachment_paths,
                                    file_sequence=file_sequence,
                                    whatsapp_number=recipient_phone,
                                    process_name="report"
                                )
                                
                                if success == "USER_NOT_LOGGED_IN":
                                    return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                                elif success == "WHATSAPP_SERVICE_NOT_READY":
                                    return jsonify({"error": "WHATSAPP_SERVICE_NOT_READY", "message": "WhatsApp service is not ready. Please try again later."}), 503
                                elif success == "INVALID_FILE_PATH":
                                    return jsonify({"error": "INVALID_FILE_PATH", "message": "Invalid file path for WhatsApp message."}), 400
                                elif success == "INVALID_FILE_PATH_TYPE":
                                    return jsonify({"error": "INVALID_FILE_PATH_TYPE", "message": "Invalid file path type for WhatsApp message."}), 400
                                elif success == "NO_VALID_FILES":
                                    return jsonify({"error": "NO_VALID_FILES", "message": "No valid files found for WhatsApp message."}), 400
                                elif success == "NO_FILES_FOR_UPLOAD":
                                    return jsonify({"error": "NO_FILES_FOR_UPLOAD", "message": "No files available for WhatsApp upload."}), 400
                                elif success == "WHATSAPP_API_ERROR":
                                    return jsonify({"error": "WHATSAPP_API_ERROR", "message": "WhatsApp API error. Please try again later."}), 500
                                elif success == "WHATSAPP_CONNECTION_ERROR":
                                    return jsonify({"error": "WHATSAPP_CONNECTION_ERROR", "message": "WhatsApp connection error. Please try again later."}), 500
                                elif success == "WHATSAPP_TIMEOUT_ERROR":
                                    return jsonify({"error": "WHATSAPP_TIMEOUT_ERROR", "message": "WhatsApp timeout error. Please try again later."}), 500
                                elif success == "WHATSAPP_SEND_ERROR":
                                    return jsonify({"error": "WHATSAPP_SEND_ERROR", "message": "Failed to send WhatsApp message. Please try again."}), 500
                                elif not success:
                                    logger.error("Failed to send WhatsApp message to {}".format(recipient_phone))
                                    return jsonify({"error": "WHATSAPP_SEND_FAILED", "message": "Failed to send WhatsApp message. Please try again."}), 500

                            except Exception as e:
                                logger.error("Error sending WhatsApp message to {}: {}".format(recipient_phone, e))
                        
                        # Handle email notifications
                        if send_email:
                            if not recipient_email:
                                logger.warning("No email found for recipient: {}".format(recipient_name))
                                continue
                            try:
                                email_subject = mail_subject
                                email_body = """
                                <html>
                                <body>
                                {} 
                                </body>
                                </html>
                                """.format(email_content.replace('\n', '<br>'))
                                user_email = session.get('user', {}).get('email')
                                success = send_email_smtp(
                                    recipient_email=recipient_email,
                                    subject=email_subject,
                                    body=email_body,
                                    attachment_paths=attachment_paths,
                                    user_email=user_email,
                                    cc=cc_email,
                                    bcc=bcc_email
                                )
                                if success == "TOKEN_EXPIRED":
                                    return jsonify({"error": "TOKEN_EXPIRED"}), 401
                                elif success == "USER_NOT_LOGGED_IN":
                                    return jsonify({"error": "USER_NOT_LOGGED_IN", "message": "User session expired. Please log in again."}), 401
                                elif success == "NO_SMTP_CREDENTIALS":
                                    return jsonify({"error": "NO_SMTP_CREDENTIALS", "message": "Email credentials not found. Please check your settings."}), 400
                                elif success == "INVALID_RECIPIENT":
                                    return jsonify({"error": "INVALID_RECIPIENT", "message": "Invalid recipient email address."}), 400
                                elif success == "NO_VALID_RECIPIENTS":
                                    return jsonify({"error": "NO_VALID_RECIPIENTS", "message": "No valid recipient emails found."}), 400
                                elif success == "SMTP_AUTH_FAILED":
                                    return jsonify({"error": "SMTP_AUTH_FAILED", "message": "Email authentication failed. Please check your credentials."}), 400
                                elif success == "SMTP_ERROR":
                                    return jsonify({"error": "SMTP_ERROR", "message": "Email service error. Please try again later."}), 500
                                elif success == "EMAIL_SEND_ERROR":
                                    return jsonify({"error": "EMAIL_SEND_ERROR", "message": "Failed to send email. Please try again."}), 500
                                elif not success:
                                    logger.error("Failed to send email to {}".format(recipient_email))
                                    return jsonify({"error": "EMAIL_SEND_FAILED", "message": "Failed to send email. Please try again."}), 500
                            except Exception as e:
                                logger.error("Error sending email: {}".format(str(e)))
                                
                    except Exception as e:
                        logger.error("Error processing row: {}".format(e))
                        continue
                
                # Clean up temporary template
                os.remove(temp_template_path)
                
            except Exception as e:
                logger.error(f"Error processing template {file_name}: {e}")
                continue
        
        # Clean up temporary attachment files
        for attachment_path in attachment_paths:
            try:
                if os.path.exists(attachment_path):
                    os.remove(attachment_path)
            except Exception as e:
                logger.error("Error removing temporary attachment file {}: {}".format(attachment_path, e))
        
        # Remove temporary directory and any remaining files
        try:
            if os.path.exists(temp_dir):
                remaining_files = os.listdir(temp_dir)
                if remaining_files:
                    logger.warning("Remaining files in temp directory: {}".format(remaining_files))
                os.rmdir(temp_dir)
        except Exception as e:
            logger.error("Error cleaning up temp directory: {}".format(e))
        
        return jsonify({
            "success": True,
            "message": "Reports generated and sent successfully!",
            "generated_files": len(generated_files)
        }), 200
        
    except Exception as e:
        logger.error("Error retrying reports: {}".format(e))
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/reactor-reports", methods=["POST"])
def reactor_report():
    try:
        user_id = session.get('user', {}).get('email')
        if not user_id:
            logger.error("No user_id found in session. User must be logged in to send reports.")
            return jsonify({"error": "User not authenticated"}), 401
        # Get form data
        send_email = request.form.get('send_email') == 'true'
        send_whatsapp = request.form.get('send_whatsapp') == 'true'
        date = request.form.get('date')
        if not date:
            return jsonify({"error": "Date is required"}), 400
        # Fetch sheet IDs from Google Sheet (mapping sheet)
        try:
            reactor_reports_sheet_id = "1XOLQvy6j7syAlOKpQ3J2o6DcgiSZsSO1xxWlWih_QOY"
            sheet_id_mapping_data = fetch_google_sheet_data(reactor_reports_sheet_id, 'Sheet_ID_Reactor')
            sheet_recipients_data = fetch_google_sheet_data(reactor_reports_sheet_id, 'Recipients')
            table_range_data = fetch_google_sheet_data(reactor_reports_sheet_id, 'Table Ranges')
        except Exception as e:
            logger.error(f"Error fetching sheet IDs from Google Sheet: {e}")
            return jsonify({"error": "Failed to fetch sheet IDs from Google Sheet"}), 500
        # Create temporary directory for processing
        temp_dir = os.path.join(OUTPUT_DIR, "temp_reactor_reports")
        os.makedirs(temp_dir, exist_ok=True)
        template_path = os.path.join(os.path.dirname(__file__), "reactorreportformat.docx")
        if not os.path.exists(template_path):
            return jsonify({"error": "Reactor report template not found"}), 500
        gspread_client = gspread.authorize(creds)
        # Call the new utility function
        result = process_reactor_reports(
            sheet_id_mapping_data=sheet_id_mapping_data,
            sheet_recipients_data=sheet_recipients_data,
            table_range_data=table_range_data,
            input_date=date,
            user_id=user_id,
            send_email=send_email,
            send_whatsapp=send_whatsapp,
            template_path=template_path,
            output_dir=temp_dir,
            gspread_client=gspread_client,
            logger=logger,
            send_email_smtp=send_email_smtp
        )
        # Clean up temporary files
        try:
            if os.path.exists(temp_dir):
                for file in os.listdir(temp_dir):
                    file_path = os.path.join(temp_dir, file)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                    except Exception as e:
                        logger.error(f"Error removing temporary file {file}: {e}")
                try:
                    os.rmdir(temp_dir)
                except Exception as e:
                    logger.error(f"Failed to remove temporary directory {temp_dir}: {e}")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        if 'error' in result:
            return jsonify({"error": result['error']}), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generating reactor reports: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        pass

@app.route("/api/update_app_password", methods=["POST"])
def update_app_password():
    try:
        # Check if user is logged in
        current_user = session.get('user')
        if not current_user:
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        user_id = data.get('user_id')
        app_password = data.get('appPassword') or data.get('app_password')
        
        if not user_id or not app_password:
            return jsonify({"error": "User ID and app password are required"}), 400

        # Get target user
        target_user = get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        current_user_role = current_user.get('role')
        target_user_role = target_user.get('role')

        # Admin can update any user's app password
        if current_user_role == 'admin':
            update_user_app_password(user_id, app_password)
            return jsonify({"message": "App password updated successfully"}), 200
        
        # Regular users cannot update other users' app passwords
        else:
            return jsonify({"error": "Insufficient permissions to update app passwords"}), 403

    except Exception as e:
        logger.error("Error updating app password: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/update_user", methods=["POST"])
def update_user_endpoint():
    try:
        # Check if user is logged in
        current_user = session.get('user')
        if not current_user:
            return jsonify({"error": "User not authenticated"}), 401

        data = request.json
        user_id = data.get('user_id')
        permissions = data.get('permissions')
        
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        # Get target user
        target_user = get_user_by_id(user_id)
        if not target_user:
            return jsonify({"error": "User not found"}), 404

        current_user_role = current_user.get('role')
        target_user_role = target_user.get('role')

        # Admin can update any user
        if current_user_role == 'admin':
                # Prepare update data
                update_data = {}
                if permissions is not None:
                    update_data['permissions'] = permissions
                    
                if not update_data:
                    return jsonify({"error": "No valid update data provided"}), 400
                
                # Update user permissions
                from Utils.firebase_utils import update_user_comprehensive_permissions
                
                if 'permissions' in update_data:
                    update_user_comprehensive_permissions(user_id, {
                        'permissions': update_data['permissions']
                    })
                
                return jsonify({"message": "User updated successfully"}), 200
        
        # Regular users cannot update other users
        else:
            return jsonify({"error": "Insufficient permissions to update users"}), 403
        
    except Exception as e:
        logger.error("Error updating user: {}".format(e))
        return jsonify({"error": str(e)}), 500

def validate_sheet_id(sheet_id):
    """Validate Google Sheet ID format"""
    return bool(sheet_id and len(sheet_id) == 44)

def process_template(template_path, output_path, data_dict):
    """Process the template file with the provided data"""
    try:
        # Load the template
        doc = Document(template_path)
        
        # Replace placeholders in the document
        for paragraph in doc.paragraphs:
            for key, value in data_dict.items():
                placeholder = "{{{}}}".format(key)
                if placeholder in paragraph.text:
                    paragraph.text = paragraph.text.replace(placeholder, str(value))
        
        # Save the processed document
        doc.save(output_path)
        return True
    except Exception as e:
        logger.error("Error processing template: {}".format(e))
        return False

def get_user_emails(user_id):
    """Get recipient emails for reactor reports from user settings"""
    try:
        # Get user document from Firebase
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            # Check if user has configured reactor report recipients
            reactor_recipients = user_data.get('reactor_report_recipients', [])
            if reactor_recipients:
                return reactor_recipients
        # Fallback to user's own email
        return [user_id]
    except Exception as e:
        logger.error(f"Error getting user emails: {e}")
        return [user_id]

def get_user_phones(user_id):
    """Get recipient phone numbers for reactor reports from user settings"""
    try:
        # Get user document from Firebase
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            # Check if user has configured reactor report phone recipients
            reactor_phones = user_data.get('reactor_report_phones', [])
            if reactor_phones:
                return reactor_phones
        # Return empty list if no phones configured
        return []
    except Exception as e:
        logger.error(f"Error getting user phones: {e}")
        return []

# Error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "API endpoint not found"}), 404

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error("Unhandled exception: {}".format(str(e)), exc_info=True)
    return jsonify({"error": "Internal server error", "details": str(e)}), 500

# Health check endpoint for Render
@app.route('/healthz')
def health_check():
    try:
        # Check Firebase connection by getting users
        users = firebase_get_all_users()
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        logger.error("Health check failed: {}".format(e))
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

def ensure_directories():
    """Ensure all required directories exist"""
    directories = [
        OUTPUT_DIR,
        os.path.dirname(LOG_FILE_PATH)
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    try:
        # Clear session
        session.clear()
        
        return jsonify({"message": "Logged out successfully"}), 200
    except Exception as e:
        logger.error("Error during logout: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/whatsapp-login", methods=["POST"])
def whatsapp_login():
    """Simple WhatsApp login endpoint - no complex threading"""
    try:
        if 'user' not in session:
            return jsonify({"error": "Not logged in"}), 401
        
        user_email = session.get('user', {}).get('email')
        if not user_email:
            return jsonify({"error": "No user email found"}), 400
        
        logging.info(f"Starting WhatsApp login for user: {user_email}")
        
        # Create WhatsApp client directly
        client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL, user_email)
        
        # Trigger login and get QR code
        result = client.trigger_login()
        logging.info(f"WhatsApp login result: {result}")
        
        # Return clean response
        return jsonify({
            "qr": result.get("qr", ""),
            "authenticated": result.get("authenticated", False),
            "message": result.get("message", ""),
            "userInfo": result.get("userInfo")
        })
        
    except Exception as e:
        logging.error(f"Error in WhatsApp login: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/whatsapp-phone-login", methods=["POST"])
def whatsapp_phone_login():
    try:
        if 'user' not in session:
            return jsonify({"error": "Not logged in"}), 401
        
        user_email = session.get('user', {}).get('email')
        data = request.get_json()
        phone_number = data.get('phoneNumber')
        code = data.get('code')
        
        if not phone_number:
            return jsonify({"error": "Phone number is required"}), 400
        
        # Use thread pool for WhatsApp phone authentication
        future = whatsapp_executor.submit(whatsapp_phone_login_worker, user_email, phone_number, code)
        
        try:
            result = future.result(timeout=60)  # 60 second timeout for phone login
            return jsonify(result)
        except concurrent.futures.TimeoutError:
            return jsonify({"error": "WhatsApp phone authentication timeout"}), 408
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logging.error(f"Error in WhatsApp phone login: {e}")
        return jsonify({"error": str(e)}), 500

# Removed complex worker functions - using direct client calls instead

@app.route("/api/whatsapp-status", methods=["GET"])
def whatsapp_status():
    """Simple WhatsApp status endpoint - no complex threading"""
    try:
        if 'user' not in session:
            return jsonify({"error": "Not logged in"}), 401
        
        user_email = session.get('user', {}).get('email')
        if not user_email:
            return jsonify({"error": "No user email found"}), 400
        
        logging.info(f"Checking WhatsApp status for user: {user_email}")
        
        # Create WhatsApp client directly
        client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL, user_email)
        
        # Get status
        result = client.get_status()
        logging.info(f"WhatsApp status result: {result}")
        
        # Return clean response
        return jsonify({
            "isReady": result.get("isReady", False),
            "status": result.get("status", "unavailable"),
            "authenticated": result.get("authenticated", False),
            "userInfo": result.get("userInfo")
        })
        
    except Exception as e:
        logging.error(f"Error in WhatsApp status: {e}")
        return jsonify({"error": str(e)}), 500

# Removed complex worker functions - using direct client calls instead

@app.route("/api/whatsapp-force-new-session", methods=["POST"])
def whatsapp_force_new_session():
    """Simple WhatsApp force new session endpoint - no complex threading"""
    try:
        if 'user' not in session:
            return jsonify({"error": "Not logged in"}), 401
        
        user_email = session.get('user', {}).get('email')
        if not user_email:
            return jsonify({"error": "No user email found"}), 400
        
        logging.info(f"Forcing new WhatsApp session for user: {user_email}")
        
        # Create WhatsApp client directly
        client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL, user_email)
        
        # Force new session
        success = client.force_new_session()
        logging.info(f"WhatsApp force new session result: {success}")
        
        if success:
            return jsonify({"success": True, "message": "Session cleared successfully"})
        else:
            return jsonify({"success": False, "message": "Failed to clear session"})
        
    except Exception as e:
        logging.error(f"Error in WhatsApp force new session: {e}")
        return jsonify({"error": str(e)}), 500

# Removed complex worker functions - using direct client calls instead

@app.route("/api/whatsapp-logout", methods=["POST"])
def whatsapp_logout():
    """Simple WhatsApp logout endpoint - no complex threading"""
    try:
        if 'user' not in session:
            return jsonify({"error": "Not logged in"}), 401
        
        user_email = session.get('user', {}).get('email')
        if not user_email:
            return jsonify({"error": "No user email found"}), 400
        
        logging.info(f"Logging out WhatsApp for user: {user_email}")
        
        # Create WhatsApp client directly
        client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL, user_email)
        
        # Logout
        success = client.logout()
        logging.info(f"WhatsApp logout result: {success}")
        
        return jsonify({"success": bool(success)}), 200 if success else 500
        
    except Exception as e:
        logging.error(f"Error logging out WhatsApp: {str(e)}")
        return jsonify({"success": False}), 500

@app.route("/api/test-session", methods=["GET"])
def test_session():
    """Test endpoint to check if session is working properly"""
    try:
        logger.info(f"Test session endpoint called")
        logger.info(f"Request cookies: {request.cookies}")
        logger.info(f"Request headers: {dict(request.headers)}")
        logger.info(f"Session contents: {session}")
        logger.info(f"User in session: {session.get('user')}")
        
        if 'user' in session:
            return jsonify({
                "success": True,
                "session_working": True,
                "user": session['user'],
                "message": "Session is working properly"
            }), 200
        else:
            return jsonify({
                "success": False,
                "session_working": False,
                "message": "No user found in session"
            }), 401
    except Exception as e:
        logger.error(f"Error in test session endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    try:
        logger.info("Starting SS Automation backend server...")
        ensure_directories()
        logger.info("Directories ensured")
        
        # Start Flask app
        app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
    except Exception as e:
        logger.error("Failed to start server: {}".format(str(e)), exc_info=True)
        sys.exit(1)