from Utils.config import drive

def upload_to_google_drive(output_pdf, folder_id, employee_name, month, year):
    try:
        # Define the file title
        file_title = f"Salary Slip_{employee_name}_{month}{year}.pdf"

        # Search for an existing file with the same title in the folder
        query = f"'{folder_id}' in parents and title = '{file_title}' and trashed = false"
        existing_files = drive.ListFile({'q': query}).GetList()

        # If a match is found, delete the existing file
        if existing_files:
            for file in existing_files:
                print(f"Found existing file {file['title']} in folder. Deleting it.")
                file.Delete()

        # Create and upload the new file
        file = drive.CreateFile({
            "title": file_title,
            "parents": [{"id": folder_id}]
        })
        file.SetContentFile(output_pdf)
        file.Upload()
        print(f"Uploaded {employee_name}'s salary slip to folder {folder_id}")
    except Exception as e:
        print(f"Error uploading {employee_name}'s file to Google Drive: {e}")