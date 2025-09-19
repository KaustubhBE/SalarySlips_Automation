import os
import re
import json
import logging
from docx import Document
from flask import session
from Utils.email_utils import *
from Utils.whatsapp_utils import (
    get_employee_contact,
    send_whatsapp_message,
)
from Utils.drive_utils import upload_to_google_drive
import shutil
import subprocess
import platform
# import pythoncom
# from comtypes.client import CreateObject
import os
from docx import Document
from docx.shared import Inches
import requests
from PIL import Image
import io
import base64
from docx.shared import Pt
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.shared import OxmlElement, qn
import gspread
from Utils.config import creds
from Utils.firebase_utils import db
from datetime import datetime, timedelta
from Utils.whatsapp_utils import handle_reactor_report_notification
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)

def prepare_file_paths(file_paths, temp_dir=None, is_upload=False):
    
    try:
        # Initialize empty list if no file paths provided
        if not file_paths:
            return []
            
        # Convert single path to list if it's not already
        if not isinstance(file_paths, list):
            file_paths = [file_paths]
            
        # Validate each path and collect valid ones
        valid_paths = []
        seen_filenames = set()  # Keep track of filenames we've already processed
        errors = []
        
        for path in file_paths:
            try:
                if is_upload:
                    # Handle uploaded file
                    if hasattr(path, 'filename') and path.filename:
                        temp_path = os.path.join(temp_dir, path.filename)
                        path.save(temp_path)
                        valid_paths.append(temp_path)
                        seen_filenames.add(path.filename)
                        logging.info(f"Saved attachment file to: {temp_path}")
                else:
                    # Handle existing file path
                    if os.path.exists(path) and os.path.isfile(path):
                        filename = os.path.basename(path)
                        if filename not in seen_filenames:
                            valid_paths.append(path)
                            seen_filenames.add(filename)
                            logging.info(f"Added file: {path}")
                        else:
                            logging.warning(f"Duplicate file found: {path}. Skipping.")
                    else:
                        errors.append(f"Invalid or non-existent file path: {path}")
                        logging.warning(f"Invalid or non-existent file path: {path}")
            except Exception as e:
                errors.append(f"Error processing file {path}: {str(e)}")
                logging.error(f"Error processing file {path}: {str(e)}")
                
        logging.info(f"Prepared {len(valid_paths)} valid file paths with {len(errors)} errors")
        return valid_paths
    except Exception as e:
        logging.error(f"Error preparing file paths: {str(e)}")
        return []

# Load message templates
def load_message_templates():
    try:
        with open('backend/Utils/message.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error("Error loading message templates: {}".format(e))
        return None

# Preprocess headers
def preprocess_headers(headers):
    return [header.replace("\n", " ").strip().strip('"') for header in headers]

def convert_docx_to_pdf(input_path, output_path):
    try:
        # Check if input file exists
        if not os.path.exists(input_path):
            logging.error(f"Input file does not exist: {input_path}")
            return False
            
        logging.info(f"Converting DOCX to PDF: {input_path} -> {output_path}")
        
        # Check if LibreOffice is available
        try:
            subprocess.run(['libreoffice', '--version'], check=True, capture_output=True)
            logging.info("LibreOffice is available")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            logging.error(f"LibreOffice is not available: {e}")
            return False
        
        process = subprocess.Popen([
            'libreoffice', '--headless', '--convert-to', 'pdf',
            '--outdir', os.path.dirname(output_path),
            input_path
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        stdout, stderr = process.communicate()
        return_code = process.returncode
        
        logging.info(f"LibreOffice conversion return code: {return_code}")
        if stdout:
            logging.info(f"LibreOffice stdout: {stdout.decode()}")
        if stderr:
            logging.warning(f"LibreOffice stderr: {stderr.decode()}")
        
        # Check if the output file was actually created
        if os.path.exists(output_path):
            logging.info(f"PDF conversion successful: {output_path}")
            return True
        else:
            logging.error(f"PDF conversion failed - output file not created: {output_path}")
            return False
            
    except Exception as e:
        logging.error(f"Error converting DOCX to PDF: {e}")
        return False

# Format file path
def format_file_path(file_path):
    if isinstance(file_path, str):
        return file_path.replace("\\\\", "\\")
    elif isinstance(file_path, list):
        return [f.replace("\\\\", "\\") for f in file_path]
    return file_path

# Clear the Salary_Slips folder
def clear_salary_slips_folder(output_dir):
    try:
        for filename in os.listdir(output_dir):
            file_path = os.path.join(output_dir, filename)
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        logging.info("Cleared the contents of the folder: {}".format(output_dir))
    except Exception as e:
        logging.error("Error clearing the folder {}: {}".format(output_dir, e))

def format_months_list(months_data):
    """Format the list of months for display in messages."""
    if not months_data:
        return ""
    
    if isinstance(months_data, list):
        # Format for WhatsApp message
        return "\n".join(["   -  {} {}".format(month['month'], month['year']) for month in months_data])
    else:
        # Format for email HTML
        return "".join(["<li>{} {}</li>".format(month['month'], month['year']) for month in months_data])

def handle_whatsapp_notification(contact_name, full_month, full_year, whatsapp_number, file_path, is_special=False, months_data=None):
    """Delegate to Node-backed WhatsApp notification handler"""
    try:
        # Call the actual WhatsApp sending function with file paths
        # Message content will be handled by the WhatsApp service using templates
        return send_whatsapp_message(
            contact_name=contact_name,
            message="",  # Empty message - will use template
            file_paths=file_path,
            whatsapp_number=whatsapp_number,
            process_name="salary_slip",
            options={"isMultiple": is_special, "variables": {"full_month": full_month, "full_year": full_year, "months_data": months_data}}
        )
    except Exception as e:
        logging.error(f"Error delegating WhatsApp notification: {e}")
        return False

# Generate and process salary slips for a single employee
def process_salary_slip(template_path, output_dir, employee_identifier, employee_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email, is_special=False, months_data=None, collected_pdfs=None):
    logging.info("Starting process_salary_slip function")
    headers = preprocess_headers(headers)
    errors = []
    warnings = []
    
    try:
        # Find indices of ESIC headers
        esic_indices = [i for i, header in enumerate(headers) if header == "ESIC"]
        
        # Create placeholders dictionary, using the second ESIC value if it exists
        placeholders = {}
        for i, header in enumerate(headers):
            if header == "ESIC" and i == esic_indices[1] and len(esic_indices) > 1:
                # Skip the first ESIC if there's a second one
                continue
            placeholders[header] = employee_data[i]

        # Add month and year placeholders to the dictionary
        placeholders["Month"] = full_month
        placeholders["Year"] = full_year

        # Merge data from "Official Details" sheet
        logging.info("Looking for employee code: {}".format(employee_identifier))
        logging.info("First few items in drive_data: {}".format(drive_data[:2]))
        official_details = next((item for item in drive_data if item.get("Employee\nCode") == employee_identifier), {})
        logging.info("Found official details: {}".format(official_details))
        placeholders.update(official_details)
        logging.info("Updated placeholders: {}".format(placeholders))

        # Calculate components of salary with error handling
        try:
            present_salary_str = placeholders.get("Present Salary", "")
            present_salary = float(re.sub(r'[^\d.]', '', present_salary_str))
            if present_salary <= 0:
                errors.append("Present Salary must be greater than zero")
                # Set default values to continue processing
                placeholders["BS"] = "0"
                placeholders["HRA"] = "0"
                placeholders["SA"] = "0"
            else:
                placeholders["BS"] = str(round(present_salary * 0.40))
                placeholders["HRA"] = str(round(present_salary * 0.20))
                placeholders["SA"] = str(round(present_salary * 0.40))

            # Calculate OT by combining OT (Days) and OT (EH)
            try:
                ot_days = float(re.sub(r'[^\d.]', '', placeholders.get("OT\n(Days)", "0")))
                ot_eh = float(re.sub(r'[^\d.]', '', placeholders.get("OT\n(EH)", "0")))
                total_ot = ot_days + ot_eh
                placeholders["OT"] = str(round(total_ot))
            except ValueError as e:
                warnings.append(f"Invalid OT values, setting to 0: {e}")
                placeholders["OT"] = "0"
                
        except ValueError as e:
            errors.append(f"Invalid Present Salary for {placeholders.get('Name', 'Unknown')}: {e}")
            # Set default values to continue processing
            placeholders["BS"] = "0"
            placeholders["HRA"] = "0"
            placeholders["SA"] = "0"
            placeholders["OT"] = "0"

        # Ensure all placeholders are strings
        placeholders = {k: str(v) for k, v in placeholders.items()}

        # Load template and replace placeholders
        output_pdf = None
        try:
            template = Document(template_path)
            for paragraph in template.paragraphs:
                for run in paragraph.runs:
                    for placeholder, value in placeholders.items():
                        if "{{{}}}".format(placeholder) in run.text:
                            run.text = run.text.replace("{{{}}}".format(placeholder), value)

            for table in template.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            for run in paragraph.runs:
                                for placeholder, value in placeholders.items():
                                    if "{{{}}}".format(placeholder) in run.text:
                                        run.text = run.text.replace("{{{}}}".format(placeholder), value)

            # Save output files
            employee_name = re.sub(r'[^\w\s]', '', placeholders.get("Name", "Employee"))
            output_docx = os.path.join(output_dir, "Salary Slip_{}_{}{}.docx".format(employee_name, month, year))
            template.save(output_docx)
            output_pdf = os.path.join(output_dir, "Salary Slip_{}_{}{}.pdf".format(employee_name, month, year))
            template.save(output_pdf)

            if convert_docx_to_pdf(output_docx, output_pdf):
                # Upload to Google Drive
                try:
                    # Get Google Drive ID
                    folder_id = official_details.get("Google Drive ID")
                    logging.info("Google Drive ID: {}".format(folder_id))
                    if folder_id:
                        logging.info("Found Google Drive ID '{}' for employee {}".format(folder_id, employee_name))
                        upload_success = upload_to_google_drive(output_pdf, folder_id, employee_name, month, year)
                        if not upload_success:
                            warnings.append("Failed to upload to Google Drive")
                    else:
                        warnings.append("No Google Drive ID found for employee")
                        logging.error("No Google Drive ID found for employee: {}".format(employee_name))
                        logging.error("Available keys in drive_data: {}".format(list(drive_data[0].keys()) if drive_data else []))
                except Exception as e:
                    warnings.append(f"Error processing Google Drive upload: {str(e)}")
                    logging.error("Error processing Google Drive ID: {} {}".format(folder_id, str(e)))

                # If this is part of a multi-month process, collect the PDF but continue with notifications
                if collected_pdfs is not None:
                    collected_pdfs.append(output_pdf)

                # Send email if enabled
                if send_email:
                    try:
                        recipient_email = get_employee_email(placeholders.get("Name"), email_employees)
                        if recipient_email:
                            email_subject = "Salary Slips for {} {} - Bajaj Earths Pvt. Ltd.".format(full_month, full_year) if is_special else "Salary Slip for {} {} - Bajaj Earths Pvt. Ltd.".format(full_month, full_year)
                            months_list = "\n".join(["   -  {} {}".format(month['month'], month['year']) for month in months_data]) if months_data else ""
                            email_body = f"""
                            <html>
                            <body>
                            <p>Dear <b>{placeholders.get('Name')}</b>,</p>
                            <p>Please find attached your <b>salary slip{'s' if is_special else ''}</b> for the following months:</p>
                            <ul>{months_list}</ul>
                            <p>These documents include:</p>
                            <ul>
                            <li>Earnings Breakdown</li>
                            <li>Deductions Summary</li>
                            <li>Net Salary Details</li>
                            </ul>
                            <p>Kindly review the salary slip{'s' if is_special else ''}, and if you have any questions or concerns, please feel free to reach out to the HR department.</p>
                            <p>Thanks & Regards,</p>
                            </body>
                            </html>
                            """
                            logging.info(f"Sending email to {recipient_email}")
                            user_id = session.get('user', {}).get('email') or session.get('user', {}).get('id')
                            if not user_id:
                                errors.append("User session expired. Please log in again.")
                                logging.error("No user ID found in session for email")
                            else:
                                email_success = send_email_smtp(user_id, recipient_email, email_subject, email_body, attachment_paths=output_pdf)
                                if email_success == "TOKEN_EXPIRED":
                                    errors.append("Email token expired. Please refresh your credentials.")
                                elif email_success == "USER_NOT_LOGGED_IN":
                                    errors.append("User session expired. Please log in again.")
                                elif email_success == "NO_SMTP_CREDENTIALS":
                                    errors.append("Email credentials not found. Please check your settings.")
                                elif email_success == "INVALID_RECIPIENT":
                                    errors.append(f"Invalid recipient email address: {recipient_email}")
                                elif email_success == "NO_VALID_RECIPIENTS":
                                    errors.append("No valid recipient emails found.")
                                elif email_success == "SMTP_AUTH_FAILED":
                                    errors.append("Email authentication failed. Please check your credentials.")
                                elif email_success == "SMTP_ERROR":
                                    errors.append("Email service error. Please try again later.")
                                elif email_success == "EMAIL_SEND_ERROR":
                                    errors.append(f"Failed to send email to {recipient_email}")
                                elif not email_success:
                                    errors.append(f"Failed to send email to {recipient_email}")
                                else:
                                    logging.info(f"Email sent successfully to {recipient_email}")
                        else:
                            warnings.append(f"No email found for {placeholders.get('Name')}")
                            logging.info(f"No email found for {placeholders.get('Name')}.")
                    except Exception as e:
                        errors.append(f"Error sending email: {str(e)}")
                        logging.error(f"Error sending email: {e}")
                
                # Send WhatsApp message if enabled
                # WhatsApp notifications are now handled by the calling function to prevent duplicates
                # Only send immediate notifications for standalone single month processing
                if send_whatsapp and not is_special and not collected_pdfs:
                    try:
                        contact_name = placeholders.get("Name")
                        whatsapp_number = get_employee_contact(contact_name, contact_employees)
                        if whatsapp_number:
                            try:
                                # Call the imported function directly
                                success = handle_whatsapp_notification(
                                    contact_name=contact_name,
                                    full_month=full_month,
                                    full_year=full_year,
                                    whatsapp_number=whatsapp_number,
                                    file_path=output_pdf,
                                    is_special=False
                                )
                                if success is True:
                                    logging.info(f"WhatsApp notification sent successfully to {contact_name}")
                                elif success == "USER_NOT_LOGGED_IN":
                                    errors.append("User session expired. Please log in again.")
                                elif success == "WHATSAPP_SERVICE_NOT_READY":
                                    errors.append("WhatsApp service is not ready. Please try again later.")
                                elif success == "INVALID_FILE_PATH":
                                    errors.append("Invalid file path for WhatsApp message.")
                                elif success == "INVALID_FILE_PATH_TYPE":
                                    errors.append("Invalid file path type for WhatsApp message.")
                                elif success == "NO_VALID_FILES":
                                    errors.append("No valid files found for WhatsApp message.")
                                elif success == "NO_FILES_FOR_UPLOAD":
                                    errors.append("No files available for WhatsApp upload.")
                                elif success == "WHATSAPP_API_ERROR":
                                    errors.append("WhatsApp API error. Please try again later.")
                                elif success == "WHATSAPP_CONNECTION_ERROR":
                                    errors.append("WhatsApp connection error. Please try again later.")
                                elif success == "WHATSAPP_TIMEOUT_ERROR":
                                    errors.append("WhatsApp timeout error. Please try again later.")
                                elif success == "WHATSAPP_SEND_ERROR":
                                    errors.append(f"Failed to send WhatsApp notification to {contact_name}")
                                else:
                                    errors.append(f"Failed to send WhatsApp notification to {contact_name}")
                                    logging.warning(f"Failed to send WhatsApp notification to {contact_name}")
                            except Exception as e:
                                errors.append(f"Error sending WhatsApp notification to {contact_name}: {e}")
                                logging.error(f"Error sending WhatsApp notification to {contact_name}: {e}")
                        else:
                            warnings.append(f"No WhatsApp number found for {contact_name}")
                    except Exception as e:
                        errors.append(f"Error processing WhatsApp notification: {str(e)}")
                        logging.error(f"Error processing WhatsApp notification: {e}")
                elif send_whatsapp and (is_special or collected_pdfs):
                    # Log that WhatsApp will be handled by calling function
                    logging.info(f"WhatsApp notification for {placeholders.get('Name', 'Unknown')} will be sent by calling function to prevent duplicates")
            else:
                errors.append("Failed to convert DOCX to PDF")
                
        except Exception as e:
            errors.append(f"Error processing salary slip template: {str(e)}")
            logging.error("Error processing salary slip for {}: {}".format(placeholders.get('Name', 'Unknown'), e))
            
    except Exception as e:
        errors.append(f"Critical error in process_salary_slip: {str(e)}")
        logging.error(f"Critical error in process_salary_slip: {e}")
        
    logging.info("Finished process_salary_slip function")
    
    # Return comprehensive result
    return {
        "success": len(errors) == 0,
        "output_file": output_pdf,
        "errors": errors,
        "warnings": warnings,
        "employee_name": placeholders.get("Name", "Unknown") if 'placeholders' in locals() else "Unknown"
    }

# Generate and process salary slips for multiple employees (batch processing)
def process_salary_slips(template_path, output_dir, employees_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email):
    logging.info("Starting batch process_salary_slips function")
    headers = preprocess_headers(headers)
    
    batch_results = {
        "total_processed": 0,
        "successful": 0,
        "failed": 0,
        "results": [],
        "errors": [],
        "warnings": []
    }
    
    # Process each employee
    for i, employee_data in enumerate(employees_data):
        try:
            logging.info(f"Processing employee {i+1} of {len(employees_data)}")
            
            # Get employee identifier for drive data lookup
            employee_identifier = None
            for j, header in enumerate(headers):
                if header == "Employee\nCode" and j < len(employee_data):
                    employee_identifier = employee_data[j]
                    break
            
            # Process single employee
            result = process_salary_slip(
                template_path=template_path,
                output_dir=output_dir,
                employee_identifier=employee_identifier,
                employee_data=employee_data,
                headers=headers,
                drive_data=drive_data,
                email_employees=email_employees,
                contact_employees=contact_employees,
                month=month,
                year=year,
                full_month=full_month,
                full_year=full_year,
                send_whatsapp=send_whatsapp,
                send_email=send_email,
                is_special=False,
                months_data=None,
                collected_pdfs=None
            )
            
            batch_results["total_processed"] += 1
            batch_results["results"].append(result)
            
            if result["success"]:
                batch_results["successful"] += 1
                logging.info(f"Successfully processed employee: {result['employee_name']}")
            else:
                batch_results["failed"] += 1
                logging.error(f"Failed to process employee: {result['employee_name']}")
                batch_results["errors"].extend([f"{result['employee_name']}: {error}" for error in result["errors"]])
            
            # Collect warnings
            if result["warnings"]:
                batch_results["warnings"].extend([f"{result['employee_name']}: {warning}" for warning in result["warnings"]])
                
        except Exception as e:
            batch_results["total_processed"] += 1
            batch_results["failed"] += 1
            error_msg = f"Critical error processing employee {i+1}: {str(e)}"
            batch_results["errors"].append(error_msg)
            logging.error(error_msg)
            # Continue processing next employee instead of stopping
            continue
            
    logging.info(f"Finished batch processing: {batch_results['successful']}/{batch_results['total_processed']} successful")
    return batch_results

def process_reports(file_path_template):
    
    try:
        file_extension = os.path.splitext(file_path_template)[1].lower()
        file_name = os.path.basename(file_path_template)
        
        # For attachments, just return the filename in square brackets
        if file_extension in ['.pdf', '.png', '.jpg', '.jpeg']:
            return f"[{file_name}]"
            
        if file_extension == '.docx':
            # Read DOCX file
            doc = Document(file_path_template)
            content = []
            
            # Read paragraphs with proper spacing
            for para in doc.paragraphs:
                if para.text.strip():  # Only add non-empty paragraphs
                    # Add extra newline for paragraphs with specific formatting
                    if para.style.name.startswith('Heading') or para.style.name == 'Title':
                        content.append('\n' + para.text.strip() + '\n')
                    else:
                        content.append(para.text.strip())
            
            # Read tables with proper formatting
            for table in doc.tables:
                content.append('\n')  # Add spacing before table
                for row in table.rows:
                    row_content = []
                    for cell in row.cells:
                        if cell.text.strip():  # Only add non-empty cells
                            row_content.append(cell.text.strip())
                    if row_content:  # Only add non-empty rows
                        content.append(' | '.join(row_content))
                content.append('\n')  # Add spacing after table
            
            # Join content with proper line breaks
            return '\n'.join(content)
            
        elif file_extension in ['.txt', '.csv']:
            # Read text files with proper line breaks
            with open(file_path_template, 'r', encoding='utf-8') as f:
                content = f.read()
                # Ensure proper line breaks and remove extra spaces
                return '\n'.join(line.strip() for line in content.splitlines() if line.strip())
                
        else:
            return f"Unsupported file type: {file_extension}"
            
    except Exception as e:
        logging.error(f"Error reading file {file_path_template}: {e}")
        return f"Error reading file: {str(e)}"

def process_reactor_reports(sheet_id_mapping_data, sheet_recipients_data, table_range_data, input_date, user_id, send_email, send_whatsapp, template_path, output_dir, gspread_client, logger, send_email_smtp, process_name='reactor-report', google_access_token=None, google_refresh_token=None):
    
    
    
    # Initialize result tracking
    result = {
        "success": False,
        "message": "",
        "generated_files": 0,
        "date_range": "",
        "sheets_processed": 0,
        "notifications_sent": {
            "email": False,
            "whatsapp": False
        },
        "output_file": None,
        "errors": [],
        "warnings": []
    }
    
    try:
        REACTOR_CONFIG = {
            'charging_operations': {
                'patterns': [
                    'charging',
                    'charge',
                    'charging (with circulation)',
                    'charging with circulation',
                    'charging operation',
                    'start charging',
                    'reactor charging',
                    'material charging'
                ],
                'date_column_keywords': [
                    'Start Date & Time',
                    'Start Date',
                    'Start Time',
                    'Start Date\n& Time',
                    'Charging Start Date',
                    'Operation Start Date',
                    'Process Start Date',
                    'Begin Date',
                    'Initiation Date'
                ]
            },
            'drain_valve_operations': {
                'patterns': [
                    'ml & a & b drain valve',
                    'ml and a and b drain valve',
                    'drain valve',
                    'ml drain valve',
                    'a & b drain valve',
                    'drain operation',
                    'valve drain',
                    'ml drain',
                    'a b drain',
                    'drain process'
                ],
                'date_column_keywords': [
                    'End Date & Time',
                    'End Date',
                    'End Time',
                    'End Date\n& Time',
                    'Drain End Date',
                    'Operation End Date',
                    'Process End Date',
                    'Completion Date',
                    'Finish Date',
                    'Termination Date'
                ]
            },
            'required_columns': [
                'Particulars',
                'Description',
                'Operation',
                'Process Step'
            ]
        }
        
        # Helper for robust header lookup
        def find_header(headers, name):
            for i, h in enumerate(headers):
                if h.strip().lower() == name.strip().lower():
                    return i
            raise ValueError(f"{name} is not in list: {headers}")

        # Helper for flexible row finding with multiple patterns
        def find_row_by_patterns(data, particulars_idx, patterns, case_sensitive=False):
            
            for row in data[2:]:  # Skip Row 1 (non-data) and Row 2 (headers), start from Row 3 (index 2)
                if len(row) <= particulars_idx:
                    continue
                particulars_text = row[particulars_idx].strip()
                if not case_sensitive:
                    particulars_text = particulars_text.lower()
                
                for pattern in patterns:
                    if case_sensitive:
                        if pattern in particulars_text:
                            return row
                    else:
                        if pattern.lower() in particulars_text:
                            return row
            return None

        # Helper for flexible date column finding
        def find_date_column(headers, date_keywords):
            for keyword in date_keywords:
                try:
                    return find_header(headers, keyword)
                except ValueError:
                    continue
            return None

        # Helper for robust date parsing and comparison
        def normalize_date_for_comparison(date_str, input_date):
            if not date_str or not input_date:
                return None, None
            
            # Common date separators and formats
            date_formats = [
                "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d",
                "%d/%m/%y", "%m/%d/%y", "%d-%m-%y", "%y-%m-%d"
            ]
            
            # Clean the date string (remove time part if present)
            date_part = date_str.split()[0] if ' ' in date_str else date_str
            
            # Try to parse the date
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_part, fmt)
                    # Normalize to YYYY-MM-DD format
                    normalized_date = parsed_date.strftime("%Y-%m-%d")
                    return normalized_date, parsed_date
                except ValueError:
                    continue
            
            return None, None

        # Helper for debugging sheet structure
        def log_sheet_structure(headers, data, sheet_name, logger):
            
            logger.info(f"Sheet '{sheet_name}' structure:")
            logger.info(f"Headers (Row 2): {headers}")
            logger.info(f"Total data rows: {len(data) - 1}")  # Subtract 1 for headers
            if len(data) > 1:
                logger.info(f"Sample data rows (starting from Row 3):")
                for i, row in enumerate(data[1:4]):  # Show first 3 data rows (Row 3, 4, 5)
                    logger.info(f"  Row {i+3}: {row[:5]}...")  # Show first 5 columns, adjust row number

        # Helper to set cell background color
        def set_cell_background_color(cell, color):
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            shd = OxmlElement('w:shd')
            shd.set(qn('w:fill'), color)
            tcPr.append(shd)

        # Helper to set table borders with custom styling (manual approach)
        def set_table_borders(table):
            try:
                # Get the table element
                tbl = table._tbl
                
                # Create table properties if they don't exist
                tblPr = tbl.xpath('w:tblPr')
                if not tblPr:
                    tblPr = OxmlElement('w:tblPr')
                    tbl.insert(0, tblPr)
                else:
                    tblPr = tblPr[0]
                
                # Remove any existing borders
                for border in tblPr.xpath('w:tblBorders'):
                    tblPr.remove(border)
                
                # Create new borders element
                borders = OxmlElement('w:tblBorders')
                
                # Outer borders: thick orange (level 2 thickness, color e69138)
                outer_border_props = {
                    'w:val': 'single',
                    'w:sz': '16',  # Level 2 thickness (2pt)
                    'w:color': 'e69138'
                }
                
                # Internal borders: thin black
                inner_border_props = {
                    'w:val': 'single',
                    'w:sz': '4',   # Thin internal borders (0.5pt)
                    'w:color': '000000'  # Black color
                }
                
                # Add outer borders (thick orange)
                outer_border_types = ['w:top', 'w:bottom', 'w:left', 'w:right']
                for border_type in outer_border_types:
                    border = OxmlElement(border_type)
                    for prop, value in outer_border_props.items():
                        border.set(qn(prop), value)
                    borders.append(border)
                
                # Add internal borders (thin black)
                inner_border_types = ['w:insideH', 'w:insideV']
                for border_type in inner_border_types:
                    border = OxmlElement(border_type)
                    for prop, value in inner_border_props.items():
                        border.set(qn(prop), value)
                    borders.append(border)
                
                # Add borders to table properties
                tblPr.append(borders)
                
            except Exception as e:
                logger.warning(f"Could not set table borders: {e}")

        # Helper to check if table should start on new page (rough estimation)
        def should_start_table_on_new_page(doc, table_rows, table_name_length=0):
            """
            Rough estimation to determine if table should start on new page.
            This is a simplified approach - in a production environment, you might want
            to use more sophisticated page layout calculations.
            """
            try:
                # Estimate space needed for table
                # Each row approximately 0.3 inches (including padding)
                # Table name approximately 0.2 inches
                # Header spacing approximately 0.1 inches
                estimated_table_height = (table_rows * 0.3) + 0.2 + 0.1
                
                # Standard page height is approximately 11 inches
                # Leave 1 inch margin at bottom
                available_page_height = 10.0
                
                # If table height exceeds available space, suggest new page
                if estimated_table_height > available_page_height:
                    return True
                    
                return False
            except Exception as e:
                logger.warning(f"Error estimating table space: {e}")
                return False  # Default to current page if estimation fails

        # Helper to format table with professional styling
        # This function also sets critical properties to prevent tables from breaking across pages
        def format_table(table, is_header=False):
            # Set table alignment to center
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            table.allow_autofit = True
            
            # Set table to not break across pages - CRITICAL FOR TABLE INTEGRITY
            try:
                tbl = table._tbl
                tblPr = tbl.get_or_add_tblPr()
                
                # Remove any existing table layout
                for layout in tblPr.xpath('w:tblLayout'):
                    tblPr.remove(layout)
                
                # Add table layout to prevent page breaks
                layout = OxmlElement('w:tblLayout')
                layout.set(qn('w:type'), 'fixed')
                tblPr.append(layout)
                
                # Add table properties to prevent page breaks
                tblLook = OxmlElement('w:tblLook')
                tblLook.set(qn('w:firstRow'), '1')
                tblLook.set(qn('w:lastRow'), '0')
                tblLook.set(qn('w:firstCol'), '0')
                tblLook.set(qn('w:lastCol'), '0')
                tblLook.set(qn('w:noHBand'), '0')
                tblLook.set(qn('w:noVBand'), '1')
                tblPr.append(tblLook)
                
                # Set table to not break across pages
                tblCellSpacing = OxmlElement('w:tblCellSpacing')
                tblCellSpacing.set(qn('w:w'), '0')
                tblCellSpacing.set(qn('w:type'), 'dxa')
                tblPr.append(tblCellSpacing)
                
                # Add table properties to prevent page breaks (critical for table integrity)
                tblPr.set(qn('w:tblStyle'), 'TableGrid')
                
                # Set table to not break across pages using tblPr properties
                # This is the most important setting for preventing table breaks
                tblPr.set(qn('w:tblW'), '0')
                tblPr.set(qn('w:tblInd'), '0')
                
                # Remove any existing table break properties that might force page breaks
                for tblBreak in tblPr.xpath('w:tblBreak'):
                    tblPr.remove(tblBreak)
                
                # Add cantSplit property to prevent table from breaking across pages
                cantSplit = OxmlElement('w:cantSplit')
                cantSplit.set(qn('w:val'), '1')  # 1 = true, prevents splitting
                tblPr.append(cantSplit)
                
                logger.info("Successfully set table properties to prevent page breaks")
                
            except Exception as e:
                logger.warning(f"Could not set table page break properties: {e}")
            
            # Apply custom borders
            set_table_borders(table)
            
            # Format each cell
            for i, row in enumerate(table.rows):
                for j, cell in enumerate(row.cells):
                    # Set vertical alignment to center
                    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                    
                    # Set paragraph alignment
                    for paragraph in cell.paragraphs:
                        if i == 0:  # Header row
                            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        else:  # Data rows
                            if j == 0:  # First column
                                paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
                            else:
                                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        
                        # Format text
                        for run in paragraph.runs:
                            if i == 0:  # Header row
                                run.bold = True
                                run.font.size = Pt(11)
                            else:
                                run.font.size = Pt(10)
                    
                    # Set background colors
                    if i == 0:  # Header row
                        set_cell_background_color(cell, "f9cb9c")
                    else:
                        # Alternate row colors
                        if i % 2 == 0:
                            set_cell_background_color(cell, "FFFFFF")
                        else:
                            set_cell_background_color(cell, "e8f0fe")

        # Parse input date
        date_formats = ["%d/%m/%y", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d"]
        dt_input = None
        for fmt in date_formats:
            try:
                dt_input = datetime.strptime(input_date, fmt)
                break
            except Exception:
                continue
        
        if not dt_input:
            result["errors"].append(f"Could not parse input date: {input_date}")
            logger.error(f"Could not parse input date: {input_date}")
            # Continue with partial processing if possible
            result["warnings"].append("Using current date as fallback")
            dt_input = datetime.now()
        
        # Build date->sheet_id mapping
        date_sheet_map = {}
        for row in sheet_id_mapping_data[1:]:
            try:
                date_str = row[0].strip()
                sheet_id = row[1].strip() if len(row) > 1 else None
                if not date_str or not sheet_id:
                    continue
                for fmt in date_formats:
                    try:
                        dt = datetime.strptime(date_str, fmt)
                        date_sheet_map[dt.date()] = sheet_id
                        break
                    except Exception:
                        continue
            except Exception as e:
                result["warnings"].append(f"Error processing sheet mapping row: {e}")
                continue
        
        # Get list of dates: input date and 5 previous dates
        dates_to_check = [dt_input.date() - timedelta(days=i) for i in range(0, 6)]
        sheets_to_process = []
        
        for idx, d in enumerate(dates_to_check):
            sheet_id = date_sheet_map.get(d)
            if not sheet_id:
                if idx == 0:  # Only warn for input date
                    result["warnings"].append(f"No sheet found for input date {d}")
                continue
                
            try:
                spreadsheet = gspread_client.open_by_key(sheet_id)
                worksheet = spreadsheet.sheet1  # Assume first worksheet
                data = worksheet.get_all_values()
                if not data or len(data) < 3:  # Need at least 3 rows: Row 1 (non-data) + Row 2 (headers) + Row 3 (data)
                    logger.warning(f"Sheet for date {d} has insufficient data: {len(data) if data else 0} rows (need at least 3)")
                    result["warnings"].append(f"Sheet for date {d} has insufficient data")
                    continue
                
                # Headers are in Row 2 (index 1), data starts from Row 3 (index 2)
                headers = [h.strip() for h in data[1]]  # Row 2 contains headers
                
                # Log sheet structure for debugging (only for first few sheets to avoid spam)
                if idx < 2:
                    log_sheet_structure(headers, data[1:], f"Date {d}", logger)  # Pass data starting from Row 2
                
                # Find operation description column dynamically (try multiple possible names)
                idx_particulars = None
                for col_name in REACTOR_CONFIG['required_columns']:
                    try:
                        idx_particulars = find_header(headers, col_name)
                        logger.info(f"Found operation column: '{col_name}' at index {idx_particulars}")
                        break
                    except ValueError:
                        continue
                
                if idx_particulars is None:
                    logger.warning(f"No operation description column found in sheet for date {d}. Available columns: {headers}")
                    result["warnings"].append(f"No operation description column found in sheet for date {d}")
                    continue
                
                if idx == 0:
                    # For input date sheet: Always include, no conditions
                    sheets_to_process.append((d, sheet_id, worksheet))
                    logger.info(f"Input date sheet {d} added (no conditions applied)")
                else:
                    # For previous 5 sheets: Only include if drain valve row's end date is blank or matches input_date
                    drain_config = REACTOR_CONFIG['drain_valve_operations']
                    
                    idx_end_date = find_date_column(headers, drain_config['date_column_keywords'])
                    if idx_end_date is None:
                        logger.warning(f"End date column not found in sheet for date {d}. Available columns: {headers}")
                        result["warnings"].append(f"End date column not found in sheet for date {d}")
                        continue
                    
                    drain_valve_row = find_row_by_patterns(data, idx_particulars, drain_config['patterns'])
                    if drain_valve_row:
                        end_date_val = drain_valve_row[idx_end_date].strip()
                        if not end_date_val:
                            sheets_to_process.append((d, sheet_id, worksheet))
                            logger.info(f"Previous date sheet {d} added - drain valve end date is blank")
                        else:
                            # Use robust date comparison
                            end_date_norm, _ = normalize_date_for_comparison(end_date_val, input_date)
                            input_date_norm, _ = normalize_date_for_comparison(input_date, input_date)
                            
                            if end_date_norm and input_date_norm and end_date_norm == input_date_norm:
                                sheets_to_process.append((d, sheet_id, worksheet))
                                logger.info(f"Previous date sheet {d} added - drain valve end date matches: {end_date_norm}")
                            else:
                                logger.info(f"Previous date sheet {d} skipped - drain valve end date '{end_date_val}' doesn't match input date '{input_date}'")
                    else:
                        logger.info(f"No drain valve operation row found in sheet for date {d}")
                        
            except Exception as e:
                logger.error(f"Error processing sheet for date {d}: {e}")
                result["errors"].append(f"Error processing sheet for date {d}: {e}")
                continue
        
        # Log summary of sheets found
        logger.info(f"Processing summary: Found {len(sheets_to_process)} sheets to process out of {len(dates_to_check)} dates checked")
        for d, sheet_id, worksheet in sheets_to_process:
            logger.info(f"  - Date {d}: Sheet ID {sheet_id}")
        
        if not sheets_to_process:
            result["errors"].append("No sheets found to process")
            return result

        # Parse table_range_data header indices robustly (excluding Sheet Name)
        try:
            tr_headers = [h.strip() for h in table_range_data[1]]
            idx_no = next(i for i, h in enumerate(tr_headers) if h.lower() == 'table no.')
            idx_name = next(i for i, h in enumerate(tr_headers) if h.lower() == 'table name')
            idx_start = next(i for i, h in enumerate(tr_headers) if h.lower() == 'start range')
            idx_end = next(i for i, h in enumerate(tr_headers) if h.lower() == 'end range')
        except Exception as e:
            logger.error(f"Error finding headers in table_range_data: {e}")
            result["errors"].append(f"Header error in table_range_data: {e}")
            # Continue with default values if possible
            try:
                idx_no, idx_name, idx_start, idx_end = 0, 1, 2, 3
                result["warnings"].append("Using default column indices for table_range_data")
            except:
                return result

        # Now, for each sheet in sheets_to_process, extract tables and add to doc
        try:
            doc = Document(template_path)
            content_added = False
            first_sheet = True

            for d, sheet_id, worksheet in sheets_to_process:
                try:
                    sheet_name = worksheet.title if hasattr(worksheet, 'title') else str(d)
                    
                    # Write to the first line if it's empty, else add a new paragraph
                    if content_added and not first_sheet:
                        doc.add_page_break()
                    first_sheet = False
                    
                    if not doc.paragraphs or not doc.paragraphs[0].text.strip():
                        para = doc.paragraphs[0] if doc.paragraphs else doc.add_paragraph()
                        para.text = f"Reactor: {sheet_name}"
                    else:
                        para = doc.add_paragraph(f"Reactor: {sheet_name}")
                    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in para.runs:
                        run.bold = True
                        run.font.size = Pt(14)

                    # Extract tables as per table_range_data
                    table_defs = []
                    try:
                        for row in table_range_data[2:]:
                            if len(row) > max(idx_no, idx_name, idx_start, idx_end) and row[idx_name].strip() and row[idx_start].strip() and row[idx_end].strip():
                                table_defs.append({
                                    'no': int(row[idx_no]) if row[idx_no].strip().isdigit() else 0,
                                    'name': row[idx_name].strip(),
                                    'start': row[idx_start].strip(),
                                    'end': row[idx_end].strip()
                                })
                        table_defs.sort(key=lambda x: x['no'])
                    except Exception as e:
                        result["warnings"].append(f"Error parsing table definitions: {e}")
                        continue

                    for i, table_def in enumerate(table_defs):
                        try:
                            # Get data from the specified range
                            data = worksheet.get(f"{table_def['start']}:{table_def['end']}")
                            if not data or len(data) < 2:  # Need at least header + 1 data row
                                logger.warning(f"Table {table_def['name']} has insufficient data: {len(data) if data else 0} rows")
                                result["warnings"].append(f"Table {table_def['name']} has insufficient data")
                                continue
                           
                            if should_start_table_on_new_page(doc, len(data), len(table_def['name'])):
                                # Add page break before table to ensure it starts on new page
                                doc.add_page_break()
                                logger.info(f"Added page break before table '{table_def['name']}' to prevent breaking")
                            
                            # Add table name with formatting
                            doc.add_paragraph()
                            table_name_para = doc.add_paragraph(table_def['name'])
                            table_name_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                            for run in table_name_para.runs:
                                run.bold = True
                                run.font.size = Pt(11)
                            
                            # Create table with proper formatting
                            max_cols = max(len(row) for row in data)
                            table = doc.add_table(rows=len(data), cols=max_cols)
                            
                            # Fill table data with proper formatting
                            for row_idx, row in enumerate(data):
                                for col_idx, cell_value in enumerate(row):
                                    if col_idx < max_cols:
                                        cell = table.cell(row_idx, col_idx)
                                        cell.text = str(cell_value)
                            
                            # Apply professional formatting to the table (includes page break prevention)
                            format_table(table, is_header=True)
                            
                            # Add 2 lines gap between tables (but not after the last table)
                            if i < len(table_defs) - 1:
                                doc.add_paragraph()
                                
                            content_added = True
                            
                        except Exception as e:
                            logger.error(f"Error extracting table {table_def['name']} from {sheet_name}: {e}")
                            result["errors"].append(f"Error extracting table {table_def['name']} from {sheet_name}: {e}")
                            # Continue with next table instead of failing completely
                            continue
                            
                    result["sheets_processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing sheet {sheet_id}: {e}")
                    result["errors"].append(f"Error processing sheet {sheet_id}: {e}")
                    continue
            
            # Clean up completely blank pages only
            def remove_completely_blank_pages(doc):
                # Check if the last paragraph is a page break that creates a blank page
                if doc.paragraphs:
                    last_para = doc.paragraphs[-1]
                    # If the last paragraph has no text and contains only a page break
                    if not last_para.text.strip() and last_para.runs:
                        last_run = last_para.runs[0]
                        # Check if this run contains only a page break (no other content)
                        if (hasattr(last_run, '_element') and 
                            last_run._element.xml.count('<w:br') > 0 and
                            not last_run.text.strip()):
                            # Remove this paragraph to eliminate the blank page
                            last_para._element.getparent().remove(last_para._element)
                            logger.info("Removed completely blank page at the end of document")
            
            # Apply cleanup for completely blank pages only
            remove_completely_blank_pages(doc)
            
            # Save the document
            output_filename = f"reactor_report_{input_date.replace('/', '_')}.docx"
            output_path = os.path.join(output_dir, output_filename)
            doc.save(output_path)
            
            # Convert to PDF
            pdf_filename = f"reactor_report_{input_date.replace('/', '_')}.pdf"
            pdf_path = os.path.join(output_dir, pdf_filename)
            logger.info(f"Generated PDF filename: {pdf_filename}")
            logger.info(f"Generated PDF path: {pdf_path}")
            logger.info(f"PDF file exists: {os.path.exists(pdf_path)}")
            if convert_docx_to_pdf(output_path, pdf_path):
                logger.info("Successfully converted DOCX to PDF")
                logger.info(f"PDF file exists after conversion: {os.path.exists(pdf_path)}")
                result["output_file"] = pdf_path
            else:
                logger.warning("PDF conversion failed, using DOCX file")
                result["warnings"].append("PDF conversion failed, using DOCX file")
                result["output_file"] = output_path

            result["generated_files"] = 1
            result["date_range"] = input_date

        except Exception as e:
            logger.error(f"Error creating document: {e}")
            result["errors"].append(f"Error creating document: {e}")
            return result

        # Send email notifications
        if send_email and result["output_file"]:
            try:
                # Parse recipients from sheet_recipients_data
                headers = [h.strip() for h in sheet_recipients_data[0]]
                to_idx = headers.index('Email ID - To') if 'Email ID - To' in headers else None
                cc_idx = headers.index('Email ID - CC') if 'Email ID - CC' in headers else None
                bcc_idx = headers.index('Email ID - BCC') if 'Email ID - BCC' in headers else None
                
                recipients_to = []
                recipients_cc = []
                recipients_bcc = []
                
                for row in sheet_recipients_data[1:]:
                    try:
                        if to_idx is not None and len(row) > to_idx and row[to_idx].strip():
                            email = row[to_idx].strip()
                            if is_valid_email(email):
                                recipients_to.append(email)
                        if cc_idx is not None and len(row) > cc_idx and row[cc_idx].strip():
                            email = row[cc_idx].strip()
                            if is_valid_email(email):
                                recipients_cc.append(email)
                        if bcc_idx is not None and len(row) > bcc_idx and row[bcc_idx].strip():
                            email = row[bcc_idx].strip()
                            if is_valid_email(email):
                                recipients_bcc.append(email)
                    except Exception as e:
                        result["warnings"].append(f"Error processing recipient row: {e}")
                        continue
                
                if not recipients_to:
                    result["warnings"].append("No valid recipient emails found in Recipients sheet")
                else:
                    email_subject = "Reactor Report - Daily Operations Summary"
                    email_body = f"""
                        <html>
                        <body>
                        <h2>Reactor Report</h2>
                        <p>Please find attached the reactor report for the period from {input_date} to {input_date}.</p>
                        <p>This report contains snapshots of all reactor operations data for the specified period.</p>
                        <br>
                        <p>Best regards,<br>Reactor Automation System</p>
                        </body>
                        </html>
                        """
                    # Send email to each recipient individually to avoid syntax errors
                    success_count = 0
                    for recipient in recipients_to:
                        try:
                            if process_name == "kr_reactor-report":
                                # Import OAuth email function
                                from Utils.email_utils import send_email_oauth, send_email_gmail_api
                                
                                # If Google tokens are provided, try Gmail API directly
                                if google_access_token and google_refresh_token:
                                    logger.info(f"Using provided Google tokens for Gmail API")
                                    logger.info(f"Email attachment path: {result['output_file']}")
                                    logger.info(f"Attachment file exists: {os.path.exists(result['output_file'])}")
                                    success = send_email_gmail_api(
                                        user_email=user_id,
                                        recipient_email=recipient,
                                        subject=email_subject,
                                        body=email_body,
                                        attachment_paths=[result["output_file"]],
                                        cc=','.join(recipients_cc) if recipients_cc else None,
                                        bcc=','.join(recipients_bcc) if recipients_bcc else None,
                                        access_token=google_access_token,
                                        refresh_token=google_refresh_token
                                    )
                                else:
                                    # Use OAuth email function with fallback
                                    logger.info(f"Using OAuth email function with fallback")
                                    logger.info(f"Email attachment path: {result['output_file']}")
                                    logger.info(f"Attachment file exists: {os.path.exists(result['output_file'])}")
                                    success = send_email_oauth(
                                        user_email=user_id,
                                        recipient_email=recipient,
                                        subject=email_subject,
                                        body=email_body,
                                        attachment_paths=[result["output_file"]],
                                        cc=','.join(recipients_cc) if recipients_cc else None,
                                        bcc=','.join(recipients_bcc) if recipients_bcc else None
                                    )
                            else:
                                success = send_email_smtp(
                                    user_email=user_id,
                                    recipient_email=recipient,
                                    subject=email_subject,
                                    body=email_body,
                                    attachment_paths=[result["output_file"]],
                                    cc=','.join(recipients_cc) if recipients_cc else None,
                                    bcc=','.join(recipients_bcc) if recipients_bcc else None
                                )
                            if success is True:
                                success_count += 1
                                logger.info(f"Email sent successfully to {recipient}")
                            elif success == "USER_NOT_LOGGED_IN":
                                result["errors"].append(f"User session expired for {recipient}. Please log in again.")
                                logger.error(f"User session expired for {recipient}")
                            elif success == "NO_SMTP_CREDENTIALS":
                                result["errors"].append(f"Email credentials not found for {recipient}. Please check your settings.")
                                logger.error(f"Email credentials not found for {recipient}")
                            elif success == "INVALID_RECIPIENT":
                                result["errors"].append(f"Invalid recipient email address: {recipient}")
                                logger.error(f"Invalid recipient email address: {recipient}")
                            elif success == "NO_VALID_RECIPIENTS":
                                result["errors"].append(f"No valid recipient emails found for {recipient}")
                                logger.error(f"No valid recipient emails found for {recipient}")
                            elif success == "SMTP_AUTH_FAILED":
                                result["errors"].append(f"Email authentication failed for {recipient}. Please check your credentials.")
                                logger.error(f"Email authentication failed for {recipient}")
                            elif success == "SMTP_ERROR":
                                result["errors"].append(f"Email service error for {recipient}. Please try again later.")
                                logger.error(f"Email service error for {recipient}")
                            elif success == "EMAIL_SEND_ERROR":
                                result["errors"].append(f"Failed to send email to {recipient}")
                                logger.error(f"Failed to send email to {recipient}")
                            else:
                                result["errors"].append(f"Failed to send email to {recipient}")
                                logger.error(f"Failed to send email to {recipient}")
                        except Exception as e:
                            result["errors"].append(f"Error sending email to {recipient}: {e}")
                            logger.error(f"Error sending email to {recipient}: {e}")
                    
                    if success_count > 0:
                        result["notifications_sent"]["email"] = True
                        logger.info(f"Successfully sent emails to {success_count} recipients")
                    else:
                        result["errors"].append("Failed to send email to any recipients")
                        
            except Exception as e:
                logger.error(f"Error processing email notifications: {e}")
                result["errors"].append(f"Error processing email notifications: {e}")

        # Send WhatsApp messages if enabled
        if send_whatsapp and result["output_file"]:
            try:
                
                success = handle_reactor_report_notification(
                    recipients_data=sheet_recipients_data,
                    input_date=input_date,
                    file_path=result["output_file"],
                    sheets_processed=result["sheets_processed"]
                )
                if success is True:
                    result["notifications_sent"]["whatsapp"] = True
                    logger.info("Reactor report WhatsApp notifications sent successfully")
                elif success == "USER_NOT_LOGGED_IN":
                    result["errors"].append("User session expired. Please log in again.")
                    logger.error("User session expired for WhatsApp notifications")
                elif success == "WHATSAPP_SERVICE_NOT_READY":
                    result["warnings"].append("WhatsApp service is not ready. Please try again later.")
                    logger.warning("WhatsApp service is not ready")
                elif success == "NO_RECIPIENTS_DATA":
                    result["warnings"].append("No recipients data provided for WhatsApp notifications.")
                    logger.warning("No recipients data provided for WhatsApp notifications")
                elif success == "MISSING_REQUIRED_COLUMNS":
                    result["warnings"].append("Required columns for WhatsApp notifications not found.")
                    logger.warning("Required columns for WhatsApp notifications not found")
                elif success == "NO_SUCCESSFUL_NOTIFICATIONS":
                    result["warnings"].append("No WhatsApp notifications were sent successfully.")
                    logger.warning("No WhatsApp notifications were sent successfully")
                elif success == "REACTOR_NOTIFICATION_ERROR":
                    result["warnings"].append("Error processing WhatsApp notifications.")
                    logger.warning("Error processing WhatsApp notifications")
                else:
                    result["warnings"].append("Some or all reactor report WhatsApp notifications failed")
                    logger.warning("Some or all reactor report WhatsApp notifications failed")
            except Exception as e:
                logger.error(f"Error processing WhatsApp notifications: {e}")
                result["errors"].append(f"Error processing WhatsApp notifications: {e}")

        # Set final success status
        if result["generated_files"] > 0:
            result["success"] = True
            if not result["errors"]:
                result["message"] = "Reactor reports generated and sent successfully"
            else:
                result["message"] = f"Reactor reports generated with {len(result['errors'])} errors"
        else:
            result["message"] = "Failed to generate reactor reports"
            
    except Exception as e:
        logger.error(f"Critical error in process_reactor_reports: {e}")
        result["errors"].append(f"Critical error: {e}")
        result["message"] = f"Critical error in reactor report processing: {e}"
    
    return result

# Google Sheets Material Data Integration Functions

# Helper functions for plant data (now using data from frontend)
def get_plant_name_by_id(plant_id, plant_data):
    """Get plant name by plant ID from plant data"""
    for plant in plant_data:
        if plant.get('material_sheet_id') == plant_id:
            return plant.get('name', 'Unknown Plant')
    return 'Unknown Plant'

def get_plant_document_name_by_id(plant_id, plant_data):
    """Get plant document name by plant ID from plant data"""
    for plant in plant_data:
        if plant.get('material_sheet_id') == plant_id:
            return plant.get('document_name', 'UNKNOWN')
    return 'UNKNOWN'

def get_sheet_name_by_id(plant_id, plant_data):
    """Get sheet name by plant ID from plant data"""
    for plant in plant_data:
        if plant.get('material_sheet_id') == plant_id:
            return plant.get('sheet_name', 'Material List')
    return 'Material List'

def get_plant_material_data_from_sheets(plant_id, plant_data):
    """Fetch material data from Google Sheets for a specific plant"""
    try:
        if not plant_id or not plant_data:
            logging.error("No plant_id or plant_data provided")
            return {}
        
        logging.info(f"Attempting to fetch material data for plant_id: {plant_id}")
        
        # Initialize gspread client
        try:
            client = gspread.authorize(creds)
            logging.info("Successfully authorized gspread client")
        except Exception as e:
            logging.error(f"Failed to authorize gspread client: {e}")
            raise
        
        # Open the spreadsheet by ID
        try:
            spreadsheet = client.open_by_key(plant_id)
            logging.info(f"Successfully opened spreadsheet: {spreadsheet.title}")
        except Exception as e:
            logging.error(f"Failed to open spreadsheet with ID {plant_id}: {e}")
            raise
        
        # Try to find the correct worksheet using plant data from frontend
        worksheet = None
        sheet_name = get_sheet_name_by_id(plant_id, plant_data)
        try:
            worksheet = spreadsheet.worksheet(sheet_name)
            logging.info(f"Found '{sheet_name}' worksheet")
        except gspread.WorksheetNotFound:
            # If specified sheet not found, use the first worksheet
            worksheet = spreadsheet.sheet1
            logging.warning(f"'{sheet_name}' sheet not found, using first worksheet: {worksheet.title}")
        except Exception as e:
            logging.error(f"Error accessing worksheet: {e}")
            raise
        
        # Get all data from the sheet
        try:
            all_data = worksheet.get_all_values()
            logging.info(f"Retrieved {len(all_data)} rows from worksheet")
        except Exception as e:
            logging.error(f"Error getting data from worksheet: {e}")
            raise
        
        if not all_data or len(all_data) < 3:
            logging.warning(f"Insufficient data in sheet for plant {plant_id}. Found {len(all_data) if all_data else 0} rows, need at least 3")
            return {}
        
        # Headers are on row 2 (index 1), data starts from row 3 (index 2)
        headers = [header.strip() for header in all_data[1]]  # Row 2 contains headers
        logging.info(f"Found headers: {headers}")
        
        # Expected headers: Category, Sub Category, Particulars, Material Name, UOM, Initial/nQuantity
        expected_headers = ['Category', 'Sub Category', 'Particulars', 'Material Name', 'UOM', 'Initial/nQuantity']
        
        # Find column indices for expected headers
        header_indices = {}
        for expected_header in expected_headers:
            for i, header in enumerate(headers):
                if expected_header.lower() in header.lower():
                    header_indices[expected_header] = i
                    logging.info(f"Found header '{expected_header}' at index {i} (actual: '{header}')")
                    break
        
        logging.info(f"Header indices found: {header_indices}")
        
        # Check for required headers (Category, Material Name, UOM are compulsory)
        required_headers = ['Category', 'Material Name', 'UOM']
        missing_required = [h for h in required_headers if h not in header_indices]
        
        if missing_required:
            logging.error(f"Required headers not found in sheet: {missing_required}. Found headers: {headers}")
            return {}
        
        # Process data rows (skip rows 1 and 2, start from row 3 - index 2)
        material_data = {}
        
        for row in all_data[2:]:  # Start from row 3 (index 2)
            if len(row) < max(header_indices.values()) + 1:
                continue  # Skip incomplete rows
            
            try:
                category = row[header_indices.get('Category', 0)].strip()
                sub_category = row[header_indices.get('Sub Category', 1)].strip() if 'Sub Category' in header_indices else ''
                particulars = row[header_indices.get('Particulars', 2)].strip() if 'Particulars' in header_indices else ''
                material_name = row[header_indices.get('Material Name', 3)].strip()
                uom = row[header_indices.get('UOM', 4)].strip()
                initial_quantity = row[header_indices.get('Initial/nQuantity', 5)].strip() if 'Initial/nQuantity' in header_indices else '0'
                
                # Validate compulsory fields
                if not category or not material_name or not uom:
                    logging.warning(f"Skipping row due to missing compulsory fields: Category='{category}', Material Name='{material_name}', UOM='{uom}'")
                    continue  # Skip rows without essential data
                
                # Set default quantity to 0 if not provided
                if not initial_quantity or initial_quantity.strip() == '':
                    initial_quantity = '0'
                
                # Initialize category if not exists
                if category not in material_data:
                    material_data[category] = {
                        'subCategories': set(),
                        'particulars': set(),
                        'materialNames': []
                    }
                
                # Add sub category
                if sub_category:
                    material_data[category]['subCategories'].add(sub_category)
                
                # Add particulars
                if particulars:
                    material_data[category]['particulars'].add(particulars)
                
                # Add material name with details
                material_info = {
                    'name': material_name,
                    'subCategory': sub_category,
                    'particulars': particulars,
                    'uom': uom,
                    'initialQuantity': initial_quantity
                }
                material_data[category]['materialNames'].append(material_info)
                
            except Exception as e:
                logging.warning(f"Error processing row: {e}")
                continue
        
        # Convert sets to lists for JSON serialization
        for category in material_data:
            material_data[category]['subCategories'] = list(material_data[category]['subCategories'])
            material_data[category]['particulars'] = list(material_data[category]['particulars'])
        
        logging.info(f"Successfully fetched material data for plant {plant_id}: {len(material_data)} categories")
        return material_data
        
    except Exception as e:
        logging.error(f"Error fetching material data from Google Sheets: {e}")
        logging.error(f"Error type: {type(e).__name__}")
        logging.error(f"Error details: {str(e)}")
        logging.error(f"Full traceback: {traceback.format_exc()}")
        return {}

def sync_plant_material_to_firebase(plant_id, plant_name, plant_data, sync_description, sync_timestamp, synced_by):
    """Sync material data from Google Sheets to Firebase"""
    try:
        # First, get the data from Google Sheets
        sheet_data = get_plant_material_data_from_sheets(plant_id, plant_data)
        
        if not sheet_data:
            return {
                'success': False,
                'message': 'No data found in Google Sheets'
            }
        
        # Get the correct document name for Firebase storage
        document_name = get_plant_document_name_by_id(plant_id, plant_data)
        logging.info(f"Using document name '{document_name}' for plant '{plant_name}' (ID: {plant_id})")
        
        # Prepare material data for Firebase storage
        materials = []
        
        for category, category_data in sheet_data.items():
            for material_info in category_data.get('materialNames', []):
                material_entry = {
                    'category': category,
                    'subCategory': material_info.get('subCategory', ''),
                    'particulars': material_info.get('particulars', ''),
                    'materialName': material_info.get('name', ''),
                    'uom': material_info.get('uom', ''),
                    'initialQuantity': material_info.get('initialQuantity', '0'),
                    'syncedAt': sync_timestamp,
                    'syncedBy': synced_by,
                    'syncDescription': sync_description
                }
                materials.append(material_entry)
        
        # Store in Firebase under MATERIAL collection using the correct document name
        plant_ref = db.collection('MATERIAL').document(document_name)
        
        # Get existing data
        plant_doc = plant_ref.get()
        existing_data = plant_doc.to_dict() if plant_doc.exists else {}
        
        # Update with new materials
        plant_ref.set({
            'materials': materials,
            'lastSynced': sync_timestamp,
            'lastSyncedBy': synced_by,
            'syncDescription': sync_description,
            'totalMaterials': len(materials)
        }, merge=True)
        
        # Store sync history
        sync_history_ref = plant_ref.collection('sync_history').document()
        sync_history_ref.set({
            'timestamp': sync_timestamp,
            'syncedBy': synced_by,
            'description': sync_description,
            'materialsCount': len(materials),
            'plantId': plant_id
        })
        
        logging.info(f"Successfully synced {len(materials)} materials for {plant_name} to document {document_name}")
        
        return {
            'success': True,
            'message': f'Successfully synced {len(materials)} materials for {plant_name} to {document_name} document',
            'data': {
                'materialsCount': len(materials),
                'categories': len(sheet_data),
                'plantName': plant_name,
                'documentName': document_name
            }
        }
        
    except Exception as e:
        logging.error(f"Error syncing material data to Firebase: {e}")
        return {
            'success': False,
            'message': f'Error syncing material data: {str(e)}'
        }
