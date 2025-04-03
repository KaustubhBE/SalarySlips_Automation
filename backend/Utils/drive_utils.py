from Utils.config import drive
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

def verify_folder_permissions(folder_id):
    """Verify if service account has proper permissions on the folder."""
    try:
        # Try to get folder metadata
        folder = drive.files().get(
            fileId=folder_id,
            fields='capabilities'
        ).execute()
        
        # Check if we have necessary permissions
        caps = folder.get('capabilities', {})
        if not (caps.get('canAddChildren') and caps.get('canEdit')):
            print(f"Service account lacks necessary permissions on folder {folder_id}")
            print("Please ensure the folder is shared with the service account with Editor access")
            return False
        return True
    except HttpError as e:
        if e.resp.status == 404:
            print(f"Folder {folder_id} not found")
        elif e.resp.status == 403:
            print(f"No access to folder {folder_id}. Please share the folder with Editor access")
        else:
            print(f"Error verifying folder permissions: {str(e)}")
        return False

def upload_to_google_drive(output_pdf, folder_id, employee_name, month, year):
    try:
        if drive is None:
            print("Google Drive service not initialized. Please check your credentials.")
            return False

        # Verify folder permissions first
        if not verify_folder_permissions(folder_id):
            return False

        # Define the file title
        file_title = f"Salary Slip_{employee_name}_{month}{year}.pdf"

        try:
            # Search for existing files
            query = f"name='{file_title}' and '{folder_id}' in parents and trashed=false"
            results = drive.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, capabilities)'
            ).execute()
            existing_files = results.get('files', [])

            # Delete existing files if found
            if existing_files:
                for file in existing_files:
                    print(f"Found existing file {file['name']}. Attempting to delete...")
                    try:
                        # Verify we have delete permission
                        if not file.get('capabilities', {}).get('canDelete', False):
                            print(f"Warning: No permission to delete {file['name']}")
                            continue
                            
                        drive.files().delete(fileId=file['id']).execute()
                        print(f"Successfully deleted {file['name']}")
                    except HttpError as delete_error:
                        if delete_error.resp.status == 403:
                            print(f"Permission denied to delete {file['name']}")
                        else:
                            print(f"Error deleting file: {str(delete_error)}")

            # Create file metadata
            file_metadata = {
                'name': file_title,
                'parents': [folder_id],
                'mimeType': 'application/pdf'
            }

            # Create media
            media = MediaFileUpload(
                output_pdf,
                mimetype='application/pdf',
                resumable=True
            )

            # Create and upload the file
            file = drive.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()

            print(f"Successfully uploaded {employee_name}'s salary slip to folder {folder_id}")
            return True

        except HttpError as e:
            if e.resp.status == 403:
                print(f"Permission denied. Please ensure the service account has proper access.")
            else:
                print(f"Drive API Error: {str(e)}")
            return False

    except Exception as e:
        print(f"Error uploading {employee_name}'s file to Google Drive: {str(e)}")
        return False