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
from Utils.config import CLIENT_SECRETS_FILE, drive
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from Utils.auth import auth_bp
from Utils.email_utils import *
from Utils.whatsapp_utils import *
from firebase_admin import firestore
from Utils.firebase_utils import (
    add_user as firebase_add_user,
    get_user_by_id,
    get_all_users as firebase_get_all_users,
    update_user_role as firebase_update_role,
    delete_user as firebase_delete_user,
    add_salary_slip,
    get_salary_slips_by_user,
    update_user_permissions,
    update_user_base64_token,
    get_user_base64_token
)
import json
from docx import Document
import re
import base64

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
logger.info("Flask app initialized")

# Frontend URL
FRONTEND_URL = "http://admin.bajajearths.com"
_frontend_opened = False

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

# CORS configuration
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_ORIGINS'] = [
    "http://localhost:3000",
    "https://frontend-ssautomation.onrender.com",
    "https://beadmins.onrender.com", "http://admin.bajajearths.com"
]
app.config['CORS_METHODS'] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
app.config['CORS_ALLOW_HEADERS'] = ["Content-Type", "Authorization", "X-User-Role"]
app.config['CORS_EXPOSE_HEADERS'] = ["Content-Type", "Authorization"]
app.config['CORS_SUPPORTS_CREDENTIALS'] = True
app.config['CORS_MAX_AGE'] = 120

# Initialize CORS
CORS(app, 
     resources={r"/*": {
         "origins": app.config['CORS_ORIGINS'],
         "methods": app.config['CORS_METHODS'],
         "allow_headers": app.config['CORS_ALLOW_HEADERS'],
         "expose_headers": app.config['CORS_EXPOSE_HEADERS'],
         "supports_credentials": app.config['CORS_SUPPORTS_CREDENTIALS'],
         "max_age": app.config['CORS_MAX_AGE']
     }},
     supports_credentials=True)

@app.before_request
def log_request_info():
    """Log request information for debugging"""
    logger.info('Headers: %s', request.headers)
    logger.info('Body: %s', request.get_data())
    logger.info('URL: %s', request.url)
    logger.info('Method: %s', request.method)

@app.after_request
def after_request(response):
    """Add CORS headers to all responses"""
    logger.info('Response status: %s', response.status)
    logger.info('Response headers: %s', response.headers)
    
    origin = request.headers.get('Origin')
    logger.info('Request origin: %s', origin)
    
    if origin in app.config['CORS_ORIGINS']:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', ','.join(app.config['CORS_ALLOW_HEADERS']))
        response.headers.add('Access-Control-Allow-Methods', ','.join(app.config['CORS_METHODS']))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', str(app.config['CORS_MAX_AGE']))
    
    logger.info('Final response headers: %s', response.headers)
    return response

# Handle OPTIONS requests
@app.route("/api/preview-file", methods=["OPTIONS"])
def handle_preflight():
    logger.info('Handling preflight request for /api/preview-file')
    response = app.make_default_options_response()
    origin = request.headers.get('Origin')
    if origin in app.config['CORS_ORIGINS']:
        response.headers.add('Access-Control-Allow-Origin', origin)
        response.headers.add('Access-Control-Allow-Headers', ','.join(app.config['CORS_ALLOW_HEADERS']))
        response.headers.add('Access-Control-Allow-Methods', ','.join(app.config['CORS_METHODS']))
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Max-Age', str(app.config['CORS_MAX_AGE']))
    logger.info('Preflight response headers: %s', response.headers)
    return response

@app.route("/api/preview-file", methods=["POST", "OPTIONS"])
def preview_file():
    logger.info('Handling preview file request')
    if request.method == "OPTIONS":
        return handle_preflight()

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
        
        try:
            # Read the file content
            content = process_reports(temp_path)
            logger.info('File processed successfully')
            return jsonify({"content": content})
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                logger.info('Temporary file removed')
                
    except Exception as e:
        logger.error("Error previewing file: {}".format(e), exc_info=True)
        return jsonify({"error": str(e)}), 500

def delayed_open_frontend():
    """Open frontend URL after a short delay to ensure server is running"""
    global _frontend_opened
    if _frontend_opened:
        return
    
    try:
        # Wait for server to start
        time.sleep(2)
        logger.info("Attempting to open frontend URL...")
        webbrowser.open(FRONTEND_URL)
        logger.info("Successfully opened frontend URL: {}".format(FRONTEND_URL))
        _frontend_opened = True
    except Exception as e:
        logger.error("Failed to open frontend URL: {}".format(str(e)), exc_info=True)

@app.before_request
def before_request():
    """Handle pre-request tasks"""
    try:
        delayed_open_frontend()
    except Exception as e:
        logger.error("Error in before_request: {}".format(str(e)), exc_info=True)

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

def check_user_role(required_role):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user_role = g.get('user_role')
            if user_role != required_role:
                return jsonify({"error": "Access denied"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

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

        if not all([username, email, role, password]):
            return jsonify({"error": "Missing required fields"}), 400

        user_id = firebase_add_user(username, email, role, password)
        return jsonify({"message": "User added successfully", "user_id": user_id}), 201

    except Exception as e:
        logger.error("Error adding user: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/delete_user", methods=["POST"])
def delete_user():
    try:
        data = request.json
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        firebase_delete_user(user_id)
        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        logger.error("Error deleting user: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/update_role", methods=["POST"])
def update_role():
    try:
        data = request.json
        user_id = data.get('user_id')
        new_role = data.get('role')

        if not all([user_id, new_role]):
            return jsonify({"error": "User ID and role are required"}), 400

        # Define default permissions for each role
        role_permissions = {
            'super-admin': {
                'single_processing': True,
                'batch_processing': True,
                'user_management': True,
                'settings_access': True,
                'can_create_admin': True
            },
            'admin': {
                'single_processing': True,
                'batch_processing': True,
                'user_management': True,
                'settings_access': True,
                'can_create_admin': False
            },
            'user': {
                'single_processing': True,
                'batch_processing': False,
                'user_management': False,
                'settings_access': False,
                'can_create_admin': False
            }
        }

        # Update role
        firebase_update_role(user_id, new_role)
        
        # Update permissions based on role
        update_user_permissions(user_id, role_permissions.get(new_role, role_permissions['user']))
        
        return jsonify({"message": "Role and permissions updated successfully"}), 200

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
        if not employee_identifier:
            return jsonify({"error": "employee_code is required"}), 400

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
                    if pdf_path:
                        collected_pdfs.append(pdf_path)
                        results.append({
                            "month": full_month,
                            "year": full_year,
                            "status": "success",
                            "message": "Salary slip generated successfully",
                            "pdf_path": pdf_path
                        })
                    else:
                        results.append({
                            "month": full_month,
                            "year": full_year,
                            "status": "error",
                            "message": "Failed to generate salary slip"
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
                        success = send_email_with_attachment(recipient_email, email_subject, email_body, collected_pdfs, user_id=user_id)
                        if success:
                            logging.info("Email sent to {}".format(recipient_email))
                        else:
                            logging.error("Error sending email: {}".format(str(e)))
                except Exception as e:
                    logging.error("Error sending email: {}".format(str(e)))

            # Send WhatsApp messages if enabled
            if send_whatsapp:
                try:
                    contact_name = employee.get("Name")
                    whatsapp_number = get_employee_contact(contact_name, contact_employees)
                    if whatsapp_number and collected_pdfs:
                        # Send all collected PDFs in one WhatsApp message
                        handle_whatsapp_notification(
                            contact_name=contact_name,
                            full_month=full_month,
                            full_year=full_year,
                            whatsapp_number=whatsapp_number,
                            file_path=collected_pdfs,
                            is_special=len(user_inputs["months_data"]) > 1,
                            months_data=user_inputs["months_data"]
                        )
                except Exception as e:
                    logging.error("Error sending WhatsApp message: {}".format(str(e)))

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
                    app.logger.info("Email sent to {}".format(employee[5]))        
                if send_whatsapp:
                    app.logger.info("Sending WhatsApp message to {}".format(employee[6]))  # Assuming phone number is at index 6
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
        data = request.json
        user_id = data.get('user_id')
        permissions = data.get('permissions')

        if not all([user_id, permissions]):
            return jsonify({"error": "User ID and permissions are required"}), 400

        # Get current user
        user = get_user_by_id(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Only allow permission updates for non-admin roles
        if user.get('role') in ['admin', 'super-admin']:
            return jsonify({"error": "Cannot update permissions for admin or super-admin roles"}), 403

        # Update permissions
        update_user_permissions(user_id, permissions)
        return jsonify({"message": "Permissions updated successfully"}), 200

    except Exception as e:
        logger.error("Error updating permissions: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route("/api/send-reports", methods=["POST"])
def generate_report():
    try:
        # Get user_id from session
        user_id = session.get('user', {}).get('email')
        
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
                open_whatsapp()

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
                    logging.info("Formatted phone number: {}".format(recipient_phone))

                    if send_whatsapp:
                        if not recipient_phone or not country_code or not phone_no:
                            logger.warning("Skipping WhatsApp message for {}: Missing Country Code or Contact No.".format(recipient_name))
                            continue

                        try:
                            # Send WhatsApp message with attachments
                            success = send_whatsapp_message(
                                contact_name=recipient_name,
                                message=message_content,
                                file_paths=attachment_paths,
                                file_sequence = file_sequence,
                                whatsapp_number=recipient_phone,
                                process_name="report"
                            )
                            
                            if success:
                                logger.info("WhatsApp message sent to {} with attachment".format(recipient_phone))
                            else:
                                logger.error("Failed to send WhatsApp message to {}".format(recipient_phone))

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
                            success = send_email_with_attachment(
                                recipient_email,
                                email_subject,
                                email_body,
                                [file for file in attachment_paths],
                                user_id=user_id,
                                cc=cc_email,
                                bcc=bcc_email
                            )
                            if success:
                                logger.info("Email sent to {}".format(recipient_email))
                            else:
                                logger.error("Error sending email: {}".format(str(e)))
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
                    logger.info("Successfully removed temporary file: {}".format(attachment_path))
            except Exception as e:
                logger.error("Error removing temporary attachment file {}: {}".format(attachment_path, e))

        # Remove temporary directory and any remaining files
        try:
            if os.path.exists(temp_dir):
                # List any remaining files in the directory
                remaining_files = os.listdir(temp_dir)
                if remaining_files:
                    logger.warning("Found remaining files in temp directory: {}".format(remaining_files))
                    # Try to remove each remaining file
                    for file in remaining_files:
                        try:
                            file_path = os.path.join(temp_dir, file)
                            if os.path.isfile(file_path):
                                os.remove(file_path)
                                logger.info("Successfully removed remaining file: {}".format(file))
                        except Exception as e:
                            logger.error("Error removing remaining file {}: {}".format(file, e))
                
                # Try to remove the directory again
                try:
                    os.rmdir(temp_dir)
                    logger.info("Successfully removed temporary directory: {}".format(temp_dir))
                except Exception as e:
                    logger.error("Failed to remove temporary directory {}: {}".format(temp_dir, e))
                    # If we still can't remove it, log a warning but continue
                    logger.warning("Temporary directory could not be removed, but operation completed successfully")
        except Exception as e:
            logger.error("Error during final cleanup: {}".format(e))
            # Log warning but don't fail the operation
            logger.warning("Cleanup encountered errors but operation completed successfully")

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
        # Get user email from session
        user_email = session.get('user', {}).get('email')
        
        # Clear Gmail credentials if user was logged in
        if user_email:
            from Utils.email_utils import clear_user_credentials
            clear_user_credentials(user_email)
        
        # Clear session
        session.clear()
        
        return jsonify({"message": "Logged out successfully"}), 200
    except Exception as e:
        logger.error("Error during logout: {}".format(e))
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/gmail-oauth-start', methods=['POST'])
def gmail_oauth_start():
    data = request.json
    user_email = data.get('email')
    if not user_email:
        return jsonify({'error': 'Email required'}), 400
    redirect_uri = url_for('gmail_oauth_callback', _external=True)
    auth_url, state = start_gmail_oauth(user_email, redirect_uri)
    session['oauth_state'] = state
    session['pending_user'] = user_email
    return jsonify({'oauth_url': auth_url})

@app.route('/api/auth/gmail-oauth-callback')
def gmail_oauth_callback():
    state = session.get('oauth_state')
    user_email = session.get('pending_user')
    redirect_uri = url_for('gmail_oauth_callback', _external=True)
    if not user_email or not state:
        return jsonify({'error': 'Missing session state or user'}), 400
    try:
        finish_gmail_oauth(user_email, state, redirect_uri)
        # Mark user as authenticated for Gmail
        session['user'] = {'email': user_email}
        return redirect(FRONTEND_URL)
    except Exception as e:
        logger.error("OAuth callback error: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    # ... your password check logic ...
    # If password is correct:
    session['user'] = {'email': email}
    # Check if Gmail token exists
    token_path = get_token_path(email)
    if not os.path.exists(token_path):
        redirect_uri = url_for('gmail_oauth_callback', _external=True)
        auth_url, state = gmail_oauth_start(email, redirect_uri)
        session['oauth_state'] = state
        session['pending_user'] = email
        return jsonify({'oauth_url': auth_url, 'success': True, 'user': {'email': email}})
    # ... rest of login logic ...
    return jsonify({'success': True, 'user': {'email': email}})

@app.route('/api/token/decrypt', methods=['POST'])
def decrypt_token():
    """Decrypt token.pickle to JSON format."""
    try:
        data = request.json
        user_id = data.get('user_id') if data else None
        
        # If no user_id provided, use the current session user
        if not user_id:
            user_id = session.get('user', {}).get('email')
        
        if not user_id:
            return jsonify({'error': 'No user ID provided'}), 400
        
        json_path = decrypt_token_to_json(user_id)
        if json_path:
            return jsonify({
                'success': True,
                'message': 'Token decrypted successfully',
                'json_path': json_path
            })
        else:
            return jsonify({'error': 'Failed to decrypt token'}), 500
            
    except Exception as e:
        logger.error("Error decrypting token: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/content', methods=['GET'])
def get_token_content():
    """Get the content of the decrypted token JSON file."""
    try:
        user_id = request.args.get('user_id')
        
        # If no user_id provided, use the current session user
        if not user_id:
            user_id = session.get('user', {}).get('email')
        
        if not user_id:
            return jsonify({'error': 'No user ID provided'}), 400
        
        token_content = get_token_json_content(user_id)
        if token_content:
            return jsonify({
                'success': True,
                'token_data': token_content
            })
        else:
            return jsonify({'error': 'No token content found'}), 404
            
    except Exception as e:
        logger.error("Error getting token content: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/list', methods=['GET'])
def list_tokens():
    """List all available token files in the temp_attachments directory."""
    try:
        token_dir = r"C:\Users\Kaustubh\Salary_Slips\temp_attachments"
        
        if not os.path.exists(token_dir):
            return jsonify({'tokens': []})
        
        tokens = []
        for filename in os.listdir(token_dir):
            if filename.endswith('.pickle') or filename.endswith('.json') or filename.endswith('.base64'):
                file_path = os.path.join(token_dir, filename)
                file_size = os.path.getsize(file_path)
                modified_time = os.path.getmtime(file_path)
                
                file_type = 'pickle' if filename.endswith('.pickle') else 'json' if filename.endswith('.json') else 'base64'
                
                tokens.append({
                    'filename': filename,
                    'file_path': file_path,
                    'file_size': file_size,
                    'modified_time': modified_time,
                    'file_type': file_type
                })
        
        return jsonify({
            'success': True,
            'tokens': tokens
        })
        
    except Exception as e:
        logger.error("Error listing tokens: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/base64/content', methods=['GET'])
def get_base64_content():
    """Get the BASE64 content of the encrypted token file."""
    try:
        user_id = request.args.get('user_id')
        
        # If no user_id provided, use the current session user
        if not user_id:
            user_id = session.get('user', {}).get('email')
        
        if not user_id:
            return jsonify({'error': 'No user ID provided'}), 400
        
        base64_content = get_token_base64_content(user_id)
        if base64_content:
            return jsonify({
                'success': True,
                'base64_content': base64_content
            })
        else:
            return jsonify({'error': 'No BASE64 content found'}), 404
            
    except Exception as e:
        logger.error("Error getting BASE64 content: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/base64/decrypt', methods=['POST'])
def decrypt_base64_token():
    """Decrypt BASE64 file back to JSON format."""
    try:
        data = request.json
        user_id = data.get('user_id') if data else None
        
        # If no user_id provided, use the current session user
        if not user_id:
            user_id = session.get('user', {}).get('email')
        
        if not user_id:
            return jsonify({'error': 'No user ID provided'}), 400
        
        token_data = decrypt_base64_to_json(user_id)
        if token_data:
            return jsonify({
                'success': True,
                'message': 'BASE64 file decrypted successfully',
                'token_data': token_data
            })
        else:
            return jsonify({'error': 'Failed to decrypt BASE64 file'}), 500
            
    except Exception as e:
        logger.error("Error decrypting BASE64 token: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/firestore/update', methods=['POST'])
def update_firestore_base64_token():
    """Update BASE64 token in Firestore."""
    try:
        data = request.json
        user_id = data.get('user_id')
        base64_content = data.get('base64_content')
        
        if not user_id or not base64_content:
            return jsonify({'error': 'user_id and base64_content are required'}), 400
        
        success = update_user_base64_token(user_id, base64_content)
        if success:
            return jsonify({
                'success': True,
                'message': 'BASE64 token updated in Firestore successfully'
            })
        else:
            return jsonify({'error': 'Failed to update BASE64 token in Firestore'}), 500
            
    except Exception as e:
        logger.error("Error updating BASE64 token in Firestore: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/firestore/get', methods=['GET'])
def get_firestore_base64_token():
    """Get BASE64 token from Firestore."""
    try:
        user_id = request.args.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        base64_content = get_user_base64_token(user_id)
        if base64_content:
            return jsonify({
                'success': True,
                'base64_content': base64_content
            })
        else:
            return jsonify({'error': 'No BASE64 token found in Firestore'}), 404
            
    except Exception as e:
        logger.error("Error getting BASE64 token from Firestore: {}".format(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/token/firestore/decrypt', methods=['POST'])
def decrypt_firestore_base64_token():
    """Decrypt BASE64 token from Firestore back to JSON."""
    try:
        data = request.json
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        # Get BASE64 content from Firestore
        base64_content = get_user_base64_token(user_id)
        if not base64_content:
            return jsonify({'error': 'No BASE64 token found in Firestore'}), 404
        
        # Decode BASE64 to JSON
        try:
            json_content = base64.b64decode(base64_content).decode('utf-8')
            token_data = json.loads(json_content)
            
            return jsonify({
                'success': True,
                'message': 'BASE64 token from Firestore decrypted successfully',
                'token_data': token_data
            })
        except Exception as decode_error:
            logger.error("Error decoding BASE64 content: {}".format(decode_error))
            return jsonify({'error': 'Failed to decode BASE64 content'}), 500
            
    except Exception as e:
        logger.error("Error decrypting BASE64 token from Firestore: {}".format(e))
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    try:
        logger.info("Starting SS Automation backend server...")
        ensure_directories()
        logger.info("Directories ensured")
        
        # Start frontend opener in a separate thread
        frontend_thread = threading.Thread(target=delayed_open_frontend)
        frontend_thread.daemon = True
        frontend_thread.start()
        
        # Start Flask app
        app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
    except Exception as e:
        logger.error("Failed to start server: {}".format(str(e)), exc_info=True)
        sys.exit(1)