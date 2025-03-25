import os
import re
import logging
from docx import Document
from Utils.email_utils import send_email_with_attachment, get_employee_email
from Utils.whatsapp_utils import send_whatsapp_message, get_employee_contact
from Utils.drive_utils import upload_to_google_drive
import shutil
import subprocess
import platform

# Configure logging
logging.basicConfig(level=logging.INFO)

# Preprocess headers
def preprocess_headers(headers):
    return [header.replace("\n", " ").strip().strip('"') for header in headers]

def convert_docx_to_pdf(input_path, output_path):
    try:
        process = subprocess.Popen([
            'libreoffice', '--headless', '--convert-to', 'pdf',
            '--outdir', os.path.dirname(output_path),
            input_path
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        process.wait()
        
        # Rename the output file if needed
        default_pdf_name = os.path.splitext(os.path.basename(input_path))[0] + '.pdf'
        default_pdf_path = os.path.join(os.path.dirname(output_path), default_pdf_name)
        if default_pdf_path != output_path:
            os.rename(default_pdf_path, output_path)
            
        return True
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
        logging.info(f"Cleared the contents of the folder: {output_dir}")
    except Exception as e:
        logging.error(f"Error clearing the folder {output_dir}: {e}")

def handle_whatsapp_notification(contact_name, full_month, full_year, whatsapp_number, file_path):
    """Handle WhatsApp notification with environment check"""
    if whatsapp_number:
        message = [
            f"Dear *{contact_name}*,",
            "",
            f"Please find attached your *salary slip* for the month of *{full_month} {full_year}*.",
            "",
            "This document includes:",
            "   -  Earnings Breakdown",
            "   -  Deductions Summary",
            "   -  Net Salary Details",
            "",
            "Kindly review the salary slip, and if you have any questions or concerns, please feel free to reach out to the HR department.",
            "",
            "Thanks & Regards,",
            "HR Department",
            "Bajaj Earths Pvt. Ltd.",
            "+91 - 86557 88172"
        ]
        
        # Log attempt
        logging.info(f"Attempting to send WhatsApp message to {contact_name} ({whatsapp_number})")
        
        # Send message
        return send_whatsapp_message(contact_name, message, file_path, whatsapp_number)
    return False

# Generate and process salary slips for a single employee
def process_salary_slip(template_path, output_dir, employee_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email):
    logging.info("Starting process_salary_slip function")
    headers = preprocess_headers(headers)
    placeholders = dict(zip(headers, employee_data))

    # Add month and year placeholders to the dictionary
    placeholders["Month"] = full_month
    placeholders["Year"] = full_year

    # Merge data from "Official Details" sheet
    official_details = next((item for item in drive_data if item.get("Employee Code") == placeholders.get("Employee Code")), {})
    placeholders.update(official_details)

    # Calculate components of salary
    try:
        present_salary_str = placeholders.get("Present Salary", "")
        present_salary = float(re.sub(r'[^\d.]', '', present_salary_str))
        if present_salary <= 0:
            raise ValueError("Present Salary must be greater than zero.")
        placeholders["BS"] = str(round(present_salary * 0.40))
        placeholders["HRA"] = str(round(present_salary * 0.20))
        placeholders["SA"] = str(round(present_salary * 0.40))
    except ValueError as e:
        logging.error(f"Invalid Present Salary for {placeholders.get('Name', 'Unknown')}: {e}. Skipping.")
        return

    # Ensure all placeholders are strings
    placeholders = {k: str(v) for k, v in placeholders.items()}

    # Load template and replace placeholders
    try:
        template = Document(template_path)
        for paragraph in template.paragraphs:
            for run in paragraph.runs:
                for placeholder, value in placeholders.items():
                    if f"{{{placeholder}}}" in run.text:
                        run.text = run.text.replace(f"{{{placeholder}}}", value)

        for table in template.tables:
            for row in table.rows:
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        for run in paragraph.runs:
                            for placeholder, value in placeholders.items():
                                if f"{{{placeholder}}}" in run.text:
                                    run.text = run.text.replace(f"{{{placeholder}}}", value)

        # Save output files
        employee_name = re.sub(r'[^\w\s]', '', placeholders.get("Name", "Employee"))
        output_docx = os.path.join(output_dir, f"Salary Slip_{employee_name}_{month}{year}.docx")
        template.save(output_docx)
        output_pdf = os.path.join(output_dir, f"Salary Slip_{employee_name}_{month}{year}.pdf")
        template.save(output_pdf)

        if convert_docx_to_pdf(output_docx, output_pdf):
            # Upload to Google Drive
            folder_id = official_details.get("Google Drive ID")
            if folder_id:
                logging.info(f"Found Google Drive ID {folder_id} for employee {employee_name}")
                upload_success = upload_to_google_drive(output_pdf, folder_id, employee_name, month, year)
                if upload_success:
                    logging.info(f"Successfully uploaded salary slip for {employee_name} to Google Drive folder {folder_id}")
                else:
                    logging.error(f"Failed to upload salary slip for {employee_name} to Google Drive")
            else:
                logging.error(f"No Google Drive ID found for employee: {employee_name}")
                logging.error(f"Available keys in drive data: {list(drive_data[0].keys()) if drive_data else 'No drive data'}")

            # Send email if enabled
            if send_email:
                recipient_email = get_employee_email(placeholders.get("Name"), email_employees)
                if recipient_email:
                    email_subject = f"Salary Slip for {full_month} {full_year} - Bajaj Earths Pvt. Ltd."
                    email_body = f"""
                    <html>
                    <body>
                    <p>Dear <b>{placeholders.get('Name')}</b>,</p>
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
                    logging.info(f"Sending email to {recipient_email}")
                    send_email_with_attachment(recipient_email, email_subject, email_body, output_pdf)
                else:
                    logging.info(f"No email found for {placeholders.get('Name')}.")
            
            # Send WhatsApp message if enabled
            if send_whatsapp:
                contact_name = placeholders.get("Name")
                whatsapp_number = get_employee_contact(contact_name, contact_employees)
                handle_whatsapp_notification(
                    contact_name,
                    full_month,
                    full_year,
                    whatsapp_number,
                    output_pdf
                )
    except Exception as e:
        logging.error(f"Error processing salary slip for {placeholders.get('Name', 'Unknown')}: {e}")
    logging.info("Finished process_salary_slip function")

# Generate and process salary slips for multiple employees (batch processing)
def process_salary_slips(template_path, output_dir, employees_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email):
    logging.info("Starting process_salary_slips function")
    clear_salary_slips_folder(output_dir)  # Clear the folder at the beginning of the batch processing
    headers = preprocess_headers(headers)
    
    for employee_data in employees_data:
        placeholders = dict(zip(headers, employee_data))

        # Add month and year placeholders to the dictionary
        placeholders["Month"] = full_month
        placeholders["Year"] = full_year

        # Calculate components of salary
        try:
            present_salary_str = placeholders.get("Present Salary", "")
            present_salary = float(re.sub(r'[^\d.]', '', present_salary_str))
            if present_salary <= 0:
                raise ValueError("Present Salary must be greater than zero.")
            placeholders["BS"] = str(round(present_salary * 0.40))
            placeholders["HRA"] = str(round(present_salary * 0.20))
            placeholders["SA"] = str(round(present_salary * 0.40))
        except ValueError as e:
            logging.error(f"Invalid Present Salary for {placeholders.get('Name', 'Unknown')}: {e}. Skipping.")
            continue

        # Ensure all placeholders are strings
        placeholders = {k: str(v) for k, v in placeholders.items()}

        # Load template and replace placeholders
        try:
            template = Document(template_path)
            for paragraph in template.paragraphs:
                for run in paragraph.runs:
                    for placeholder, value in placeholders.items():
                        if f"{{{placeholder}}}" in run.text:
                            run.text = run.text.replace(f"{{{placeholder}}}", value)

            for table in template.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            for run in paragraph.runs:
                                for placeholder, value in placeholders.items():
                                    if f"{{{placeholder}}}" in run.text:
                                        run.text = run.text.replace(f"{{{placeholder}}}", value)

            # Save output files
            employee_name = re.sub(r'[^\w\s]', '', placeholders.get("Name", "Employee"))
            output_docx = os.path.join(output_dir, f"Salary Slip_{employee_name}_{month}{year}.docx")
            template.save(output_docx)
            output_pdf = os.path.join(output_dir, f"Salary Slip_{employee_name}_{month}{year}.pdf")

            if convert_docx_to_pdf(output_docx, output_pdf):
                # Upload to Google Drive
                folder_id = official_details.get("Google Drive ID")
                if folder_id:
                    logging.info(f"Found Google Drive ID {folder_id} for employee {employee_name}")
                    upload_success = upload_to_google_drive(output_pdf, folder_id, employee_name, month, year)
                    if upload_success:
                        logging.info(f"Successfully uploaded salary slip for {employee_name} to Google Drive folder {folder_id}")
                    else:
                        logging.error(f"Failed to upload salary slip for {employee_name} to Google Drive")
                else:
                    logging.error(f"No Google Drive ID found for employee: {employee_name}")
                    logging.error(f"Available keys in drive data: {list(drive_data[0].keys()) if drive_data else 'No drive data'}")

                # Send email if enabled
                if send_email:
                    recipient_email = get_employee_email(placeholders.get("Name"), email_employees)
                    if recipient_email:
                        email_subject = f"Salary Slip for {full_month} {full_year} - Bajaj Earths Pvt. Ltd."
                        email_body = f"""
                        <html>
                        <body>
                        <p>Dear <b>{placeholders.get('Name')}</b>,</p>
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
                        logging.info(f"Sending email to {recipient_email}")
                        send_email_with_attachment(recipient_email, email_subject, email_body, output_pdf)
                    else:
                        logging.info(f"No email found for {placeholders.get('Name')}.")
                
                # Send WhatsApp message if enabled
                if send_whatsapp:
                    contact_name = placeholders.get("Name")
                    whatsapp_number = get_employee_contact(contact_name, contact_employees)
                    handle_whatsapp_notification(
                        contact_name,
                        full_month,
                        full_year,
                        whatsapp_number,
                        output_pdf
                    )
        except Exception as e:
            logging.error(f"Error processing salary slip for {placeholders.get('Name', 'Unknown')}: {e}")
            continue
    
    logging.info("Finished process_salary_slips function") 