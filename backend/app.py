import os
import logging
from flask import Flask, request, jsonify, Response, g, send_from_directory
from flask_cors import CORS
from logging.handlers import RotatingFileHandler
from Utils.fetch_data import fetch_google_sheet_data
from Utils.salary_slips_utils import process_salary_slip, process_salary_slips
from google.oauth2 import service_account
from googleapiclient.discovery import build
from Utils.config import CLIENT_SECRETS_FILE, drive
from Utils.setup_db import initialize_database
from Utils.db_utils import get_db_connection
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from Utils.auth import auth_bp

# Initialize Flask app
app = Flask(__name__)

# CORS configuration for Render
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",  # Local development
            "https://salary-slips-automation-frontend.onrender.com"  # Production frontend
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Load configurations from environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.getenv("OUTPUT_DIR", os.path.join(BASE_DIR, "Salary_Slips"))
TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", os.path.join(BASE_DIR, "ssformat.docx"))
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", os.path.join(BASE_DIR, "app.log"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Ensure directories exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configure logging
if not app.logger.handlers:
    handler = RotatingFileHandler(LOG_FILE_PATH, maxBytes=10*1024*1024, backupCount=5)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    handler.propagate = False

# Initialize database
initialize_database()

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')

def get_drive_service():
    try:
        credentials = service_account.Credentials.from_service_account_file(CLIENT_SECRETS_FILE)
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        app.logger.error(f"Error initializing Google Drive service: {e}")
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

# Frontend routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path.startswith('api/'):
        return {"error": "Not found"}, 404
    try:
        return send_from_directory(app.static_folder, path)
    except:
        return send_from_directory(app.static_folder, 'index.html')

# API routes
@app.route("/api/add_user", methods=["POST"])
def add_user():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        role = data.get('role')
        password = generate_password_hash(data.get('password'))

        if not all([username, email, role, password]):
            return jsonify({"error": "All fields are required"}), 400

        conn = get_db_connection()
        conn.execute('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
                     (username, email, password, role))
        conn.commit()
        conn.close()

        return jsonify({"message": "User added successfully"}), 201

    except Exception as e:
        app.logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/delete_user", methods=["POST"])
def delete_user():
    try:
        user_id = request.json.get('user_id')
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400

        conn = get_db_connection()
        conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()

        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        app.logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/update_role", methods=["POST"])
def update_role():
    try:
        data = request.json
        user_id = data.get('user_id')
        role = data.get('role')

        if not all([user_id, role]):
            return jsonify({"error": "User ID and role are required"}), 400

        conn = get_db_connection()
        conn.execute('UPDATE users SET role = ? WHERE id = ?', (role, user_id))
        conn.commit()
        conn.close()

        return jsonify({"message": "Role updated successfully"}), 200

    except Exception as e:
        app.logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/get_users", methods=["GET"])
def get_users():
    try:
        conn = get_db_connection()
        users = conn.execute('SELECT id, username, email, role FROM users').fetchall()
        conn.close()
        
        # Convert users to list of dictionaries
        users_list = [dict(user) for user in users]
        return jsonify(users_list), 200
        
    except Exception as e:
        app.logger.error(f"Error fetching users: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/user/<int:user_id>", methods=["GET"])
def get_user(user_id):
    try:
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()

        if user is None:
            return jsonify({"error": "User not found"}), 404

        return jsonify(dict(user)), 200

    except Exception as e:
        app.logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/generate-salary-slip-single", methods=["POST"])
@check_user_role('user')
def generate_salary_slip_single():
    try:
        user_inputs = request.json
        app.logger.info("Processing single salary slip request")

        required_keys = ["sheet_id_salary", "sheet_id_drive", "full_month", "full_year", "employee_identifier"]
        if missing_keys := [key for key in required_keys if not user_inputs.get(key)]:
            return jsonify({"error": f"Missing parameters: {', '.join(missing_keys)}"}), 400

        sheet_id_salary = user_inputs["sheet_id_salary"]
        sheet_id_drive = user_inputs["sheet_id_drive"]
        full_month = user_inputs["full_month"]
        full_year = user_inputs["full_year"]
        sheet_name = full_month[:3]
        employee_identifier = user_inputs["employee_identifier"]
        send_whatsapp = user_inputs.get("send_whatsapp", False)
        send_email = user_inputs.get("send_email", False)

        # Fetch data
        try:
            salary_data = fetch_google_sheet_data(sheet_id_salary, sheet_name)
            drive_data = fetch_google_sheet_data(sheet_id_drive, "Official Details")
            email_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
        except Exception as e:
            return jsonify({"error": f"Error fetching data: {e}"}), 500

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

        # Find employee
        employee = next((emp for emp in drive_employees 
                        if emp.get('Employee Code') == employee_identifier 
                        or emp.get('Name') == employee_identifier), None)
        if not employee:
            return jsonify({"error": "Employee not found in records"}), 404

        salary_employee = next((emp for emp in employees 
                              if emp[salary_headers.index('Employee Code')] == employee_identifier 
                              or emp[salary_headers.index('Name')] == employee_identifier), None)
        if not salary_employee:
            return jsonify({"error": "Employee salary data not found"}), 404

        # Process salary slip
        try:
            employee_data = [str(item) if item is not None else '' for item in salary_employee]
            process_salary_slip(
                template_path=TEMPLATE_PATH,
                output_dir=OUTPUT_DIR,
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
                send_email=send_email
            )
            return jsonify({"message": "Salary slip generated successfully"}), 200

        except Exception as e:
            return jsonify({"error": f"Error processing salary slip: {e}"}), 500

    except Exception as e:
        app.logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/generate-salary-slips-batch", methods=["POST"])
# Temporarily remove RBAC for batch processing
# @check_user_role('admin')
def generate_salary_slips_batch():
    try:
        user_inputs = request.json
        app.logger.info("Processing batch salary slips request")

        required_keys = ["sheet_id_salary", "sheet_id_drive", "full_month", "full_year"]
        if missing_keys := [key for key in required_keys if not user_inputs.get(key)]:
            return jsonify({"error": f"Missing parameters: {', '.join(missing_keys)}"}), 400

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
            drive_data = fetch_google_sheet_data(sheet_id_drive, "Official Details")
            email_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
        except Exception as e:
            return jsonify({"error": f"Error fetching data: {e}"}), 500

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
            app.logger.info(f"Processing salary slip for employee: {employee_name}")
            try:
                employee_data = [str(item) if item is not None else '' for item in employee]
                process_salary_slip(
                    template_path=TEMPLATE_PATH,
                    output_dir=OUTPUT_DIR,
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
                app.logger.info(f"Uploaded {employee_name}'s salary slip to folder {OUTPUT_DIR}")
                if send_email:
                    app.logger.info(f"Sending email to {employee[5]}")  # Assuming email is at index 5
                    app.logger.info(f"Email sent to {employee[5]}")        
                             
                if send_whatsapp:
                    app.logger.info(f"Sending WhatsApp message to {employee[6]}")  # Assuming phone number is at index 6
            except Exception as e:
                error_msg = f"Error processing salary slip for employee {employee_name}: {e}"
                app.logger.error(error_msg)
                return jsonify({"error": error_msg}), 500

        return jsonify({"message": "Batch salary slips generated successfully"}), 200

    except Exception as e:
        app.logger.error(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/get-logs", methods=["GET"])
def get_logs():
    try:
        with open(LOG_FILE_PATH, "r") as log_file:
            logs = log_file.read()
        return logs, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        app.logger.error(f"Error reading logs: {e}")
        return jsonify({"error": "Failed to read logs"}), 500

@app.route("/api/", methods=["GET"])
def home():
    return jsonify({"message": "Welcome to the Salary Slip Automation API!"}), 200

# Error handlers
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "API endpoint not found"}), 404
    return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error", "details": str(e)}), 500

# Health check endpoint for Render
@app.route('/healthz')
def health_check():
    return jsonify({"status": "healthy"}), 200

def ensure_directories():
    """Ensure all required directories exist"""
    directories = [
        OUTPUT_DIR,
        os.path.dirname(LOG_FILE_PATH),
        app.static_folder
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)