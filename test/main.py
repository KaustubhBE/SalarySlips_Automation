import os
import re
from backend.Utils.fetch_data import *
from backend.Utils.salary_slips_utils import *
from backend.Utils.email_utils import *
from backend.Utils.whatsapp_utils import *

# Main Script
if __name__ == "__main__":
    sheet_id_salary = "1HUUF8g3GJ3ZaPyUsRhRgCURu5m0prtZRy7kEIZoc10M"
    sheet_id_employees = "17fBmcHVpWbGGZvTrH0aFG-AgnjgHXZwictw_LlruoHU"
    template_path = r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\ssformat.docx"
    output_dir = r"C:\Users\Kaustubh\OneDrive\Desktop\BE_SS_Automation\Salary_Slips"

    if not all([sheet_id_salary, sheet_id_employees, template_path, output_dir]):
        print("Error: Missing required configuration values.")
        exit(1)

    os.makedirs(output_dir, exist_ok=True)
    full_month = input("Enter sheet name for the salary slip (e.g., January): ").strip()
    full_year = input("Enter the year (e.g., 2024): ").strip()

    try:
        month = full_month[:3].capitalize()  # Ensure the abbreviation is capitalized (e.g., "Jan")
        year = full_year[-2:]               # Extract the last two digits of the year (e.g., "24")
        
        if not month.isalpha() or len(full_month) < 3:
            raise ValueError("Invalid month input. Please enter a valid full month name.")
        if not full_year.isdigit() or len(full_year) != 4:
            raise ValueError("Invalid year input. Please enter a valid 4-digit year.")
    except Exception as e:
        print(f"Error: {e}")

    salary_data = fetch_google_sheet_data(sheet_id_salary, month)
    drive_data = fetch_google_sheet_data(sheet_id_employees, "Sheet1")
    email_data = fetch_google_sheet_data(sheet_id_employees, "Sheet1")
    contact_data = fetch_google_sheet_data(sheet_id_employees, "Sheet1")

    if salary_data and drive_data and email_data:
        salary_headers = salary_data[1]  # Assuming headers are in the second row (index 1)
        employees = salary_data[2:]      # Employee data starts from the third row (index 2)

        drive_headers = drive_data[1]
        drive_employees = [dict(zip(drive_headers, row)) for row in drive_data[2:]]

        email_headers = email_data[1]
        email_employees = [dict(zip(email_headers, row)) for row in email_data[2:]]

        contact_headers = contact_data[1]
        contact_employees = [dict(zip(contact_headers, row)) for row in contact_data[2:]]  # Ensure correct format

        for employee in employees:
            process_salary_slip(template_path, output_dir, employee, salary_headers, drive_employees, email_employees, contact_employees, month, year, full_month, full_year)
    else:
        print("Error: Failed to fetch data from Google Sheets.")