import os
import re
import comtypes.client
from docx import Document
from Utils.email_utils import send_email_with_attachment, get_employee_email
from Utils.whatsapp_utils import send_whatsapp_message, get_employee_contact
from Utils.drive_utils import upload_to_google_drive

# Preprocess headers
def preprocess_headers(headers):
    return [header.replace("\n", " ").strip().strip('"') for header in headers]

def convert_docx_to_pdf(input_path, output_path):
    try:
        comtypes.CoInitialize()  # Initialize COM library
        word = comtypes.client.CreateObject('Word.Application')
        word.Visible = False
        doc = word.Documents.Open(input_path)
        doc.SaveAs(output_path, FileFormat=17)
        doc.Close()
        word.Quit()
        comtypes.CoUninitialize()  # Uninitialize COM library
        return True
    except Exception as e:
        print(f"Error converting DOCX to PDF: {e}")
        return False

# Format file path
def format_file_path(file_path):
    if isinstance(file_path, str):
        return file_path.replace("\\\\", "\\")
    elif isinstance(file_path, list):
        return [f.replace("\\\\", "\\") for f in file_path]
    return file_path

# Generate and process salary slips
def process_salary_slip(template_path, output_dir, employee_data, headers, drive_data, email_employees, contact_employees, month, year, full_month, full_year, send_whatsapp, send_email):
    print("Starting process_salary_slip function")
    headers = preprocess_headers(headers)
    placeholders = dict(zip(headers, employee_data))

    # Add month and year placeholders to the dictionary
    placeholders["Month"] = full_month
    placeholders["Year"] = full_year

    # Merge data from "Official Details" sheet
    official_details = next((item for item in drive_data if item.get("Name") == placeholders.get("Name")), {})
    placeholders.update(official_details)

    # Calculate components of salary
    try:
        present_salary = float(re.sub(r'[^\d.]', '', placeholders.get("Present Salary", "")))
        placeholders["BS"] = str(round(present_salary * 0.40))
        placeholders["HRA"] = str(round(present_salary * 0.20))
        placeholders["SA"] = str(round(present_salary * 0.40))
    except ValueError:
        print(f"Invalid Present Salary for {placeholders.get('Name', 'Unknown')}. Skipping.")
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

        if convert_docx_to_pdf(output_docx, output_pdf):
            # Upload to Google Drive
            folder_id = official_details.get("Google Drive ID")
            if folder_id:
                upload_to_google_drive(output_pdf, folder_id, employee_name, month, year)

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
                    print(f"Sending email to {recipient_email}")
                    send_email_with_attachment(recipient_email, email_subject, email_body, output_pdf)
                else:
                    print(f"No email found for {placeholders.get('Name')}.")

            # Send WhatsApp message if enabled
            if send_whatsapp:
                contact_name = placeholders.get("Name")
                whatsapp_number = get_employee_contact(contact_name, contact_employees)
                if whatsapp_number:
                    message = [
                        f"Dear *{placeholders.get('Name')}*,",
                        "",
                        f"Please find attached your *salary slip* for the month of *{full_month} {full_year}*.",
                        "",
                        " This document includes:",
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
                    file_path = os.path.join(output_dir, f"Salary Slip_{contact_name}_{month}{year}.pdf")
                    print(f"Sending WhatsApp message to {whatsapp_number}")
                    send_whatsapp_message(contact_name, message, file_path, whatsapp_number)
    except Exception as e:
        print(f"Error processing salary slip for {placeholders.get('Name', 'Unknown')}: {e}")
    print("Finished process_salary_slip function")