import os
import re
import json
import logging
from docx import Document
from flask import session
from Utils.email_utils import *
# from Utils.whatsapp_utils import *
from Utils.drive_utils import upload_to_google_drive
import shutil
import subprocess
import platform
import pythoncom
from comtypes.client import CreateObject
from datetime import datetime
import os
from docx import Document
from datetime import datetime
from docx.shared import Inches
import requests
from PIL import Image
import io
import base64
from docx.shared import Pt
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.shared import OxmlElement, qn

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
        
        for path in file_paths:
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
                    logging.warning(f"Invalid or non-existent file path: {path}")
                
        logging.info(f"Prepared {len(valid_paths)} valid file paths")
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
                    user_id = session.get('user', {}).get('id') or session.get('user', {}).get('email')
                    send_email_smtp(user_id, recipient_email, email_subject, email_body, attachment_paths=output_pdf)
                else:
                    logging.info(f"No email found for {placeholders.get('Name')}.")
            
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
                logging.error("Available keys in official_details: {}".format(list(official_details.keys())))
            
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
                logging.info(f"Sending email to {recipient_email}")
                user_id = session.get('user', {}).get('id') or session.get('user', {}).get('email')
                send_email_smtp(user_id, recipient_email, email_subject, email_body, attachment_paths=output_pdf)
            else:
                logging.info(f"No email found for {placeholders.get('Name')}.")
            
            # Send WhatsApp message if enabled
            if send_whatsapp:
                contact_name = placeholders.get("Name")
                whatsapp_number = get_employee_contact(contact_name, contact_employees)
                message = [
                    "Dear *{}*,".format(contact_name),
                    "",
                    "Please find attached your *salary slip* for the month of *{} {}*.".format(full_month, full_year),
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

def process_reactor_reports(sheet_id_mapping_data, sheet_recipients_data, table_range_data, start_date, end_date, user_id, send_email, template_path, output_dir, gspread_client, logger, send_email_smtp):
    
    # Helper for robust header lookup
    def find_header(headers, name):
        for i, h in enumerate(headers):
            if h.strip().lower() == name.strip().lower():
                return i
        raise ValueError(f"{name} is not in list: {headers}")

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
            
            # Define border properties for level 2 thickness (16 = 2pt) and color e69138
            border_props = {
                'w:val': 'single',
                'w:sz': '16',  # Level 2 thickness (2pt)
                'w:color': 'e69138'
            }
            
            # Add all border types
            border_types = ['w:top', 'w:bottom', 'w:left', 'w:right', 'w:insideH', 'w:insideV']
            
            for border_type in border_types:
                border = OxmlElement(border_type)
                for prop, value in border_props.items():
                    border.set(qn(prop), value)
                borders.append(border)
            
            # Add borders to table properties
            tblPr.append(borders)
            
        except Exception as e:
            logger.warning(f"Could not set table borders: {e}")

    # Helper to format table with professional styling
    def format_table(table, is_header=False):
        # Set table alignment to center
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.allow_autofit = True
        
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

    # Parse date range
    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d')

    # Build date->sheet_id mapping from sheet_id_mapping_data, and sort by date ascending
    date_sheet_pairs = []
    date_formats = ["%d/%m/%y", "%d/%m/%Y", "%m/%d/%Y"]
    for row in sheet_id_mapping_data[1:]:
        date_str = row[0].strip()
        if not date_str or date_str.lower() == 'date':
            continue
        dt = None
        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                break
            except Exception:
                continue
        if not dt:
            logger.warning(f"Error parsing date {date_str}: no matching format")
            continue
        if start_dt <= dt <= end_dt:
            date_sheet_pairs.append((dt, date_str, row[1]))
    date_sheet_pairs.sort()  # ascending order by date

    if not date_sheet_pairs:
        return {"error": "No sheet IDs found for the specified date range"}

    # Parse table_range_data header indices robustly (excluding Sheet Name)
    tr_headers = [h.strip() for h in table_range_data[1]]
    try:
        idx_no = find_header(tr_headers, 'Table No.')
        idx_name = find_header(tr_headers, 'Table Name')
        idx_start = find_header(tr_headers, 'Start Range')
        idx_end = find_header(tr_headers, 'End Range')
    except Exception as e:
        logger.error(f"Error finding headers in table_range_data: {e}")
        return {"error": f"Header error: {e}"}

    try:
        doc = Document(template_path)
        
        # Track if we've added content to avoid extra page breaks
        content_added = False
        first_sheet = True
        
        for dt, date_str, sheet_id in date_sheet_pairs:
            try:                             
                spreadsheet = gspread_client.open_by_key(sheet_id)
                all_worksheets = spreadsheet.worksheets()
                
                # Check if sheet has any content
                sheet_has_content = False
                
                for worksheet in all_worksheets:
                    sheet_name = worksheet.title
                    if sheet_name == 'Table_Range':
                        continue
                    
                    # Check if this worksheet has any data
                    try:
                        # Get a small range to check if sheet has content
                        test_data = worksheet.get('A1:A10')
                        if not test_data or all(not cell.strip() for row in test_data for cell in row):
                            continue  # Skip blank sheets
                    except:
                        continue  # Skip if we can't access the sheet
                    
                    # Include all tables from table_range_data for each worksheet
                    table_defs = []
                    for row in table_range_data[2:]:
                        if row[idx_name].strip() and row[idx_start].strip() and row[idx_end].strip():
                            table_defs.append({
                                'no': int(row[idx_no]),
                                'name': row[idx_name].strip(),
                                'start': row[idx_start].strip(),
                                'end': row[idx_end].strip()
                            })
                    table_defs.sort(key=lambda x: x['no'])
                    
                    # Check if any tables have data
                    has_table_data = False
                    for table_def in table_defs:
                        try:
                            data = worksheet.get(f"{table_def['start']}:{table_def['end']}")
                            if data and len(data) > 1:  # More than just headers
                                has_table_data = True
                                break
                        except:
                            continue
                    
                    if not has_table_data:
                        continue  # Skip sheets with no table data
                    
                    sheet_has_content = True
                    
                    # Add sheet name as body paragraph (not heading) and center it
                    sheet_para = doc.add_paragraph(f"{sheet_name}")
                    sheet_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    for run in sheet_para.runs:
                        run.bold = True
                        run.font.size = Pt(14)
                    
                    # Add 1 line gap between sheet name and first table
                    doc.add_paragraph()
                    
                    # For each table, extract the range and add to doc
                    for i, table_def in enumerate(table_defs):
                        try:
                            data = worksheet.get(f"{table_def['start']}:{table_def['end']}")
                            if not data or len(data) < 2:  # Need at least header + 1 data row
                                continue
                            
                            # Add table name with formatting
                            table_name_para = doc.add_paragraph(table_def['name'])
                            table_name_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
                            for run in table_name_para.runs:
                                run.bold = True
                                run.font.size = Pt(11)
                            
                            # Add 1 line gap between table name and table
                            doc.add_paragraph()
                            
                            # Create table with proper formatting
                            max_cols = max(len(row) for row in data)
                            table = doc.add_table(rows=len(data), cols=max_cols)
                            
                            # Fill table data with proper formatting
                            for i, row in enumerate(data):
                                for j, cell_value in enumerate(row):
                                    if j < max_cols:
                                        cell = table.cell(i, j)
                                        cell.text = str(cell_value)
                            
                            # Apply professional formatting to the table
                            format_table(table, is_header=True)
                            
                            # Add 2 lines gap between tables (but not after the last table)
                            if i < len(table_defs) - 1:
                                doc.add_paragraph()
                                doc.add_paragraph()
                            
                            content_added = True
                            
                        except Exception as e:
                            logger.error(f"Error extracting table {table_def['name']} from {sheet_name}: {e}")
                            error_para = doc.add_paragraph(f"Error extracting table {table_def['name']}: {str(e)}")
                            error_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
                
                # Add 2 lines gap between different sheets (but not after the last sheet)
                if sheet_has_content and date_sheet_pairs.index((dt, date_str, sheet_id)) < len(date_sheet_pairs) - 1:
                    doc.add_paragraph()
                    doc.add_paragraph()
                
                first_sheet = False
                
            except Exception as e:
                logger.error(f"Error processing sheet ID {sheet_id} for date {date_str}: {e}")
                continue
                
        output_filename = f"reactor_report_{start_date}_to_{end_date}.docx"
        output_path = os.path.join(output_dir, output_filename)
        doc.save(output_path)
    except Exception as e:
        logger.error(f"Error creating report document: {e}")
        return {"error": "Failed to create report document"}

    pdf_filename = f"reactor_report_{start_date}_to_{end_date}.pdf"
    pdf_path = os.path.join(output_dir, pdf_filename)
    if convert_docx_to_pdf(output_path, pdf_path):
        logger.info("Successfully converted DOCX to PDF")
    else:
        logger.warning("PDF conversion failed, using DOCX file")
        pdf_path = output_path

    # Send notifications using Recipients sheet
    if send_email:
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
            if not recipients_to:
                logger.warning("No valid recipient emails found in Recipients sheet")
                return {"error": "No valid recipient emails found in Recipients sheet"}
            email_subject = "Reactor Report - Daily Operations Summary"
            email_body = f"""
                <html>
                <body>
                <h2>Reactor Report</h2>
                <p>Please find attached the reactor report for the period from {start_date} to {end_date}.</p>
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
                    success = send_email_smtp(
                        user_email=user_id,
                        recipient_email=recipient,
                        subject=email_subject,
                        body=email_body,
                        attachment_paths=[pdf_path],
                        cc=','.join(recipients_cc) if recipients_cc else None,
                        bcc=','.join(recipients_bcc) if recipients_bcc else None
                    )
                    if success:
                        success_count += 1
                        logger.info(f"Email sent successfully to {recipient}")
                    else:
                        logger.error(f"Failed to send email to {recipient}")
                except Exception as e:
                    logger.error(f"Error sending email to {recipient}: {e}")
            if success_count == 0:
                logger.error("Failed to send email to any recipients")
            else:
                logger.info(f"Successfully sent emails to {success_count} recipients")
        except Exception as e:
            logger.error(f"Error sending email notification: {e}")

    return {
        "message": "Reactor reports generated and sent successfully",
        "generated_files": 1,
        "date_range": f"{start_date} to {end_date}",
        "sheets_processed": len(date_sheet_pairs),
        "notifications_sent": {
            "email": send_email
        },
        "output_file": pdf_path
    } 