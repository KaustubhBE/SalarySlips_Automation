import os
import re
import json
import logging
from docx import Document
from Utils.email_utils import send_email_with_gmail, get_employee_email
from Utils.whatsapp_utils import *
from Utils.drive_utils import upload_to_google_drive
import shutil
import subprocess
import platform
import pythoncom
from comtypes.client import CreateObject

# Configure logging
logging.basicConfig(level=logging.INFO)

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
        # process = subprocess.Popen([
        #     'libreoffice', '--headless', '--convert-to', 'pdf',
        #     '--outdir', os.path.dirname(output_path),
        #     input_path
        # ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # process.wait()

        pythoncom.CoInitialize()
        word = CreateObject('Word.Application')
        word.Visible = False  # Keep Word hidden
        doc = word.Documents.Open(input_path)
        doc.SaveAs(output_path, FileFormat=17)  # 17 is PDF format
        doc.Close()
        word.Quit()
        print(f'Converted {input_path} to {output_path}')
        return True

        return True
    except Exception as e:
        logging.error("Error converting DOCX to PDF: {}".format(e))
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
    if whatsapp_number:
        # months_list = "\n".join([f"   -  {month['month']} {month['year']}" for month in months_data]) if months_data else ""
        message = [
            "Dear *{}*,".format(contact_name),
            "",
            "Please find attached your *salary slips* for the following months:",
            "",
            "These documents include:",
            "   -  Earnings Breakdown",
            "   -  Deductions Summary",
            "   -  Net Salary Details",
            "",
            "Kindly review the salary slips, and if you have any questions or concerns, please feel free to reach out to the HR department.",
            "",
            "Thanks & Regards,",
            "HR Department",
            "Bajaj Earths Pvt. Ltd.",
            "+91 - 86557 88172"
        ]
        
        # Log attempt
        logging.info("Attempting to send WhatsApp message to {} ({})".format(contact_name, whatsapp_number))
        
        # Prepare file paths - ensure we have an array
        valid_file_paths = prepare_file_paths(file_path)
        
        if not valid_file_paths:
            logging.error("No valid file paths found for {}".format(contact_name))
            return False
        
        # Send message
        open_whatsapp()
        return send_whatsapp_message(contact_name, message, file_path, whatsapp_number, process_name="salary_slip")
    return False

# Generate and process salary slips for a single employee
def process_salary_slip(template_path, output_dir, employee_identifier, employee_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email, is_special=False, months_data=None, collected_pdfs=None):
    logging.info("Starting process_salary_slip function")
    headers = preprocess_headers(headers)
     
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
    logging.info("Looking for employee code: {}".format(placeholders.get('Employee\nCode')))
    logging.info("First few items in drive_data: {}".format(drive_data[:2]))
    official_details = next((item for item in drive_data if item.get("Employee\nCode") == employee_identifier), {})
    logging.info("Found official details: {}".format(official_details))
    placeholders.update(official_details)
    logging.info("Updated placeholders: {}".format(placeholders))

    # Calculate components of salary
    try:
        present_salary_str = placeholders.get("Present Salary", "")
        present_salary = float(re.sub(r'[^\d.]', '', present_salary_str))
        if present_salary <= 0:
            raise ValueError("Present Salary must be greater than zero.")
        placeholders["BS"] = str(round(present_salary * 0.40))
        placeholders["HRA"] = str(round(present_salary * 0.20))
        placeholders["SA"] = str(round(present_salary * 0.40))

        # Calculate OT by combining OT (Days) and OT (EH)
        ot_days = float(re.sub(r'[^\d.]', '', placeholders.get("OT\n(Days)", "0")))
        ot_eh = float(re.sub(r'[^\d.]', '', placeholders.get("OT\n(EH)", "0")))
        total_ot = ot_days + ot_eh
        placeholders["OT"] = str(round(total_ot))
    except ValueError as e:
        logging.error("Invalid Present Salary for {}: {}. Skipping.".format(placeholders.get('Name', 'Unknown'), e))
        return None

    # Ensure all placeholders are strings
    placeholders = {k: str(v) for k, v in placeholders.items()}

    # Load template and replace placeholders
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
                else:
                    logging.error("No Google Drive ID found for employee: {}".format(employee_name))
                    logging.error("Available keys in drive_data: {}".format(list(drive_data.keys())))
            except Exception as e:
                logging.error("Error processing Google Drive ID: {} {}".format(folder_id, str(e)))

            # If this is part of a multi-month process, collect the PDF
            if collected_pdfs is not None:
                collected_pdfs.append(output_pdf)
                return output_pdf

            # Send email if enabled
            if send_email:
                recipient_email = get_employee_email(placeholders.get("Name"), email_employees)
                if recipient_email:
                    email_subject = "Salary Slips for {} {} - Bajaj Earths Pvt. Ltd.".format(full_month, full_year) if is_special else "Salary Slip for {} {} - Bajaj Earths Pvt. Ltd.".format(full_month, full_year)
                    months_list = "\n".join(["   -  {} {}".format(month['month'], month['year']) for month in months_data]) if months_data else ""
                    email_body = f"""
                    <html>
                    <body>
                    <p>Dear <b>{placeholders.get("Name")}</b>,</p>
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
                    logging.info("Sending email to {}".format(recipient_email))
                    send_email_with_gmail(recipient_email, email_subject, email_body, process_name="salary_slips", attachment_paths=output_pdf)
                else:
                    logging.info("No email found for {}.".format(placeholders.get('Name')))
            
            # Send WhatsApp message if enabled
            if send_whatsapp:
                contact_name = placeholders.get("Name")
                whatsapp_number = get_employee_contact(contact_name, contact_employees)
                if whatsapp_number:
                    # If this is a single month, send immediately
                    if not is_special:
                        handle_whatsapp_notification(
                            contact_name=contact_name,
                            full_month=full_month,
                            full_year=full_year,
                            whatsapp_number=whatsapp_number,
                            file_path=output_pdf,
                            is_special=False
                        )
                    # For multiple months, the calling function will handle sending all files together
                    return output_pdf
                    
            # Return the PDF path if we haven't returned yet
            return output_pdf
            
    except Exception as e:
        logging.error("Error processing salary slip for {}: {}".format(placeholders.get('Name', 'Unknown'), e))
        return None
        
    logging.info("Finished process_salary_slip function")
    return None

# Generate and process salary slips for multiple employees (batch processing)
def process_salary_slips(template_path, output_dir, employee_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email):
    logging.info("Starting process_salary_slip function")
    headers = preprocess_headers(headers)
    placeholders = dict(zip(headers, employee_data))

    # If ESIC appears more than once, use the value from the second occurrence
    esic_indices = [i for i, header in enumerate(headers) if header == "ESIC"]
    if len(esic_indices) > 1:
        placeholders["ESIC"] = employee_data[esic_indices[1]]

    # Add month and year placeholders to the dictionary
    placeholders["Month"] = full_month
    placeholders["Year"] = full_year

    # Merge data from "Official Details" sheet
    official_details = next((item for item in drive_data if item.get("Employee\nCode") == placeholders.get("Employee\nCode")), {})                     
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
        logging.error("Invalid Present Salary for {}: {}. Skipping.".format(placeholders.get('Name', 'Unknown'), e))
        return

    # Ensure all placeholders are strings
    placeholders = {k: str(v) for k, v in placeholders.items()}

    # Load template and replace placeholders
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
            folder_id = official_details.get("Google Drive ID")
            if folder_id:
                logging.info("Found Google Drive ID {} for employee {}".format(folder_id, employee_name))
                upload_success = upload_to_google_drive(output_pdf, folder_id, employee_name, month, year)
            else:
                logging.error("No Google Drive ID found for employee: {}".format(employee_name))
                logging.error("Available keys in official_details: {}".format(list(official_details.keys()) if isinstance(official_details, dict) else 'Not a dictionary'))
            
        # Send email if enabled
        if send_email:
            recipient_email = get_employee_email(placeholders.get("Name"), email_employees)
            if recipient_email:
                email_subject = "Salary Slip for {} {} - Bajaj Earths Pvt. Ltd.".format(full_month, full_year)
                email_body = f"""
                    <html>
                    <body>
                    <p>Dear <b>{employee_name}</b>,</p>
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
                    </html>"""
                logging.info("Sending email to {}".format(recipient_email))
                send_email_with_gmail(recipient_email, email_subject, email_body, process_name="salary_slips", attachment_paths=output_pdf)
            else:
                logging.info("No email found for {}.".format(placeholders.get('Name')))
            
            # Send WhatsApp message if enabled
            if send_whatsapp:
                contact_name = placeholders.get("Name")
                whatsapp_number = get_employee_contact(contact_name, contact_employees)
                message = [
                    "Dear *{}*,".format(contact_name),
                    "",
                    "Please find attached your *salary slip* for the month of *{} {}*.",
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
                file_path = os.path.join(output_dir, "Salary_Slip_{}_{}{}.pdf".format(contact_name, month, year))
                open_whatsapp()
                send_whatsapp_message(contact_name, message, file_path, whatsapp_number, process_name="salary_slip")
    except Exception as e:
        logging.error("Error processing salary slip for {}: {}".format(placeholders.get('Name', 'Unknown'), e))
    logging.info("Finished process_salary_slip function")

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