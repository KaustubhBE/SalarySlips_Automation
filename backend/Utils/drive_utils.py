from Utils.config import drive_service
from googleapiclient.http import MediaFileUpload

def upload_to_google_drive(output_pdf, folder_id, employee_name, month, year):
    try:
        # Define the file title
        file_title = f"Salary Slip_{employee_name}_{month}{year}.pdf"

        # Search for an existing file with the same title in the folder
        query = f"'{folder_id}' in parents and name = '{file_title}' and trashed = false"
        results = drive_service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        existing_files = results.get('files', [])

        # If a match is found, delete the existing file
        if existing_files:
            for file in existing_files:
                print(f"Found existing file {file['name']} in folder. Deleting it.")
                drive_service.files().delete(fileId=file['id']).execute()

        # Create and upload the new file
        file_metadata = {
            'name': file_title,
            'parents': [folder_id]
        }
        
        media = MediaFileUpload(
            output_pdf,
            mimetype='application/pdf',
            resumable=True
        )
        
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        print(f"Uploaded {employee_name}'s salary slip to folder {folder_id}")
        return file.get('id')
    except Exception as e:
        print(f"Error uploading {employee_name}'s file to Google Drive: {e}")
        return None