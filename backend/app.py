import os
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from logging.handlers import RotatingFileHandler
from Utils.fetch_data import fetch_google_sheet_data
from Utils.salary_slips_utils import process_salary_slip, process_salary_slips
from google.oauth2 import service_account
from googleapiclient.discovery import build
from Utils.config import CLIENT_SECRETS_FILE, drive
from Utils.setup_db import initialize_database  # Import the database initialization function

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load configurations from environment variables
OUTPUT_DIR = os.getenv("OUTPUT_DIR", r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\backend\Salary_Slips")
TEMPLATE_PATH = os.getenv("TEMPLATE_PATH", r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\backend\ssformat.docx")
LOG_FILE_PATH = os.getenv("LOG_FILE_PATH", os.path.join(os.path.dirname(__file__), "app.log"))

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configure logging
if not app.logger.handlers:
    handler = RotatingFileHandler(LOG_FILE_PATH, maxBytes=10*1024*1024, backupCount=5)  # 10 MB per file, 5 backups
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(levelname)s - %(message)s')  # Exclude date and time
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    handler.propagate = False  # Prevent duplicate logs

def get_drive_service():
    """Authenticate and return the Google Drive service."""
    try:
        credentials = service_account.Credentials.from_service_account_file(CLIENT_SECRETS_FILE)
        service = build('drive', 'v3', credentials=credentials)
        return service
    except Exception as e:
        app.logger.error(f"Error initializing Google Drive service: {e}")
        raise

@app.route("/generate-salary-slip-single", methods=["POST"])
def generate_salary_slip_single():
    try:
        user_inputs = request.json
        app.logger.info("Received request to generate salary slip for a single employee")
        app.logger.info(f"send_whatsapp: {user_inputs.get('send_whatsapp')}, send_email: {user_inputs.get('send_email')}")

        # Validate required parameters
        required_keys = ["sheet_id_salary", "sheet_id_drive", "full_month", "full_year", "employee_identifier"]
        missing_keys = [key for key in required_keys if not user_inputs.get(key)]
        
        if missing_keys:
            app.logger.error(f"Missing required input parameters: {missing_keys}")
            return jsonify({"error": f"Missing parameters: {', '.join(missing_keys)}"}), 400

        # Extract user inputs
        sheet_id_salary = user_inputs["sheet_id_salary"]
        sheet_id_drive = user_inputs["sheet_id_drive"]
        full_month = user_inputs["full_month"]
        full_year = user_inputs["full_year"]
        employee_identifier = user_inputs["employee_identifier"]
        sheet_name = full_month[:3]  # Short form of the month
        send_whatsapp = user_inputs.get("send_whatsapp", False)
        send_email = user_inputs.get("send_email", False)

        # Fetch data from Google Sheets
        try:
            salary_data = fetch_google_sheet_data(sheet_id_salary, sheet_name)
            drive_data = fetch_google_sheet_data(sheet_id_drive, "Official Details")
            email_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
        except Exception as e:
            error_msg = f"Error fetching data from Google Sheets: {e}"
            app.logger.error(error_msg)
            return jsonify({"error": error_msg}), 500

        if not (salary_data and drive_data and email_data):
            app.logger.error("Failed to fetch data from Google Sheets.")
            return jsonify({"error": "Failed to fetch data from Google Sheets."}), 500

        # Extract headers and employee data
        salary_headers = salary_data[1]
        employees = salary_data[2:]
        app.logger.info("Extracted salary headers and employee data")

        drive_headers = drive_data[1]
        drive_employees = [dict((key.strip().replace('\n', ' '), value) for key, value in zip(drive_headers, row)) for row in drive_data[2:]]
        app.logger.info("Extracted drive employees")

        email_headers = email_data[1]
        email_employees = [dict((key.strip().replace('\n', ' '), value) for key, value in zip(email_headers, row)) for row in email_data[2:]]
        app.logger.info("Extracted email employees")

        contact_headers = contact_data[1]
        contact_employees = [dict((key.strip().replace('\n', ' '), value) for key, value in zip(contact_headers, row)) for row in contact_data[2:]]
        app.logger.info("Extracted contact employees")

        # Log the structure of drive_employees
        app.logger.info(f"drive_employees structure: {drive_employees}")

        # Find the employee by name or code in the drive_employees list
        employee = next((emp for emp in drive_employees if emp.get('Name') == employee_identifier or emp.get('Employee Code') == employee_identifier), None)
        if not employee:
            error_msg = f"Employee with identifier {employee_identifier} not found."
            app.logger.error(error_msg)
            return jsonify({"error": error_msg}), 404

        employee_name = employee.get('Name')  # Assuming the employee name is in the 'Name' field
        app.logger.info(f"Processing salary slip for employee: {employee_name}")
        try:
            employee_data = [str(item) if item is not None else '' for item in employee.values()]
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
                app.logger.info(f"Sending email to {employee.get('Email')}")  # Assuming email is in the 'Email' field
                app.logger.info(f"Email sent to {employee.get('Email')}")
            if send_whatsapp:
                app.logger.info(f"Sending WhatsApp message to {employee.get('Phone')}")  # Assuming phone number is in the 'Phone' field
        except Exception as e:
            error_msg = f"Error processing salary slip for employee {employee_name}: {e}"
            app.logger.error(error_msg)
            return jsonify({"error": error_msg}), 500

        app.logger.info("Salary slip generated successfully!")
        return jsonify({"message": "Salary slip generated successfully!"}), 200

    except Exception as e:
        error_msg = f"Error: {e}"
        app.logger.error(error_msg)
        return jsonify({"error": str(e)}), 500

@app.route("/generate-salary-slips-batch", methods=["POST"])
def generate_salary_slips_batch():
    try:
        user_inputs = request.json
        app.logger.info("Received request to generate salary slips for multiple employees")
        app.logger.info(f"send_whatsapp: {user_inputs.get('send_whatsapp')}, send_email: {user_inputs.get('send_email')}")

        # Validate required parameters
        required_keys = ["sheet_id_salary", "sheet_id_drive", "full_month", "full_year"]
        missing_keys = [key for key in required_keys if not user_inputs.get(key)]
        
        if missing_keys:
            app.logger.error(f"Missing required input parameters: {missing_keys}")
            return jsonify({"error": f"Missing parameters: {', '.join(missing_keys)}"}), 400

        # Extract user inputs
        sheet_id_salary = user_inputs["sheet_id_salary"]
        sheet_id_drive = user_inputs["sheet_id_drive"]
        full_month = user_inputs["full_month"]
        full_year = user_inputs["full_year"]
        sheet_name = full_month[:3]  # Short form of the month
        send_whatsapp = user_inputs.get("send_whatsapp", False)
        send_email = user_inputs.get("send_email", False)

        # Fetch data from Google Sheets
        try:
            salary_data = fetch_google_sheet_data(sheet_id_salary, sheet_name)
            drive_data = fetch_google_sheet_data(sheet_id_drive, "Official Details")
            email_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
            contact_data = fetch_google_sheet_data(sheet_id_drive, "Onboarding Details")
        except Exception as e:
            error_msg = f"Error fetching data from Google Sheets: {e}"
            app.logger.error(error_msg)
            return jsonify({"error": error_msg}), 500

        if not (salary_data and drive_data and email_data):
            app.logger.error("Failed to fetch data from Google Sheets.")
            return jsonify({"error": "Failed to fetch data from Google Sheets."}), 500

        # Extract headers and employee data
        salary_headers = salary_data[1]
        employees = salary_data[2:]
        app.logger.info("Extracted salary headers and employee data")

        drive_headers = drive_data[1]
        drive_employees = [dict((key.strip().replace('\n', ' '), value) for key, value in zip(drive_headers, row)) for row in drive_data[2:]]
        app.logger.info("Extracted drive employees")

        email_headers = email_data[1]
        email_employees = [dict((key.strip().replace('\n', ' '), value) for key, value in zip(email_headers, row)) for row in email_data[2:]]
        app.logger.info("Extracted email employees")

        contact_headers = contact_data[1]
        contact_employees = [dict((key.strip().replace('\n', ' '), value) for key, value in zip(contact_headers, row)) for row in contact_data[2:]]
        app.logger.info("Extracted contact employees")

        # Process salary slips for all employees
        process_salary_slips(
            template_path=TEMPLATE_PATH,
            output_dir=OUTPUT_DIR,
            employees_data=employees,
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

        app.logger.info("Batch salary slips generated successfully!")
        return jsonify({"message": "Batch salary slips generated successfully!"}), 200

    except Exception as e:
        error_msg = f"Error: {e}"
        app.logger.error(error_msg)
        return jsonify({"error": str(e)}), 500

@app.route("/get-logs", methods=["GET"])
def get_logs():
    """Streams logs instead of loading entire file into memory."""
    def generate():
        with open(LOG_FILE_PATH, "r") as log_file:
            for line in log_file:
                yield line
    return Response(generate(), mimetype="text/plain")

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Welcome to the Salary Slip Automation API!"}), 200

if __name__ == "__main__":
    initialize_database()  # Initialize the database when the server starts
    app.run(debug=True)