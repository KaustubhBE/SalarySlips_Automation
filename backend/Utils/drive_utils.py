from Utils.config import drive
import logging
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from datetime import datetime
import os

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
            print("Service account lacks necessary permissions on folder {}".format(folder_id))
            print("Please ensure the folder is shared with the service account with Editor access")
            return False
        return True
    except HttpError as e:
        if e.resp.status == 404:
            logging.error("Folder {} not found".format(folder_id))
        elif e.resp.status == 403:
            logging.error("No access to folder {}. Please share the folder with Editor access".format(folder_id))
        else:
            logging.error("Error verifying folder permissions: {}".format(str(e)))
        return False

def upload_file_to_drive(file_path, folder_id, file_name, mime_type='application/pdf', overwrite_existing=True, logger=None):
    
    log = logger if logger else logging
    
    try:
        if drive is None:
            error_msg = "Google Drive service not initialized. Please check your credentials."
            log.error(error_msg)
            return False, None, error_msg

        # Verify folder permissions first
        if not verify_folder_permissions(folder_id):
            error_msg = f"Permission denied or folder not found: {folder_id}"
            log.error(error_msg)
            return False, None, error_msg

        # Check if file exists locally
        if not os.path.exists(file_path):
            error_msg = f"File not found: {file_path}"
            log.error(error_msg)
            return False, None, error_msg

        try:
            # Search for existing files if overwrite is enabled
            if overwrite_existing:
                query = f"name='{file_name}' and '{folder_id}' in parents and trashed=false"
                results = drive.files().list(
                    q=query,
                    spaces='drive',
                    fields='files(id, name, capabilities)'
                ).execute()
                existing_files = results.get('files', [])

                # Delete existing files if found
                if existing_files:
                    for file in existing_files:
                        log.info(f"Found existing file {file['name']}. Attempting to delete...")
                        try:
                            # Verify we have delete permission
                            if not file.get('capabilities', {}).get('canDelete', False):
                                log.warning(f"No permission to delete {file['name']}")
                                continue
                                
                            drive.files().delete(fileId=file['id']).execute()
                            log.info(f"Successfully deleted {file['name']}")
                        except HttpError as delete_error:
                            if delete_error.resp.status == 403:
                                log.error(f"Permission denied to delete {file['name']}")
                            else:
                                log.error(f"Error deleting file: {str(delete_error)}")

            # Create file metadata
            file_metadata = {
                'name': file_name,
                'parents': [folder_id],
                'mimeType': mime_type
            }

            # Create media
            media = MediaFileUpload(
                file_path,
                mimetype=mime_type,
                resumable=True
            )

            # Create and upload the file
            uploaded_file = drive.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()

            file_id = uploaded_file.get('id')
            log.info(f"Successfully uploaded {file_name} to folder {folder_id} (File ID: {file_id})")
            return True, file_id, None

        except HttpError as e:
            if e.resp.status == 403:
                error_msg = "Permission denied. Please ensure the service account has proper access."
                log.error(error_msg)
            else:
                error_msg = f"Drive API Error: {str(e)}"
                log.error(error_msg)
            return False, None, error_msg

    except Exception as e:
        error_msg = f"Error uploading file to Google Drive: {str(e)}"
        log.error(error_msg)
        return False, None, error_msg


def get_or_create_folder(parent_folder_id, folder_name, logger=None):
    """
    Get existing folder or create new one in parent folder.
    
    Args:
        parent_folder_id: Parent folder ID
        folder_name: Name of the folder to get/create
        logger: Optional logger instance (uses logging if not provided)
        
    Returns:
        tuple: (success: bool, folder_id: str or None, error_message: str or None)
    """
    log = logger if logger else logging
    
    try:
        if drive is None:
            error_msg = "Google Drive service not initialized. Please check your credentials."
            log.error(error_msg)
            return False, None, error_msg

        # Verify parent folder permissions
        if not verify_folder_permissions(parent_folder_id):
            error_msg = f"Permission denied or parent folder not found: {parent_folder_id}"
            log.error(error_msg)
            return False, None, error_msg

        # Search for existing folder
        query = f"name='{folder_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = drive.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        existing_folders = results.get('files', [])
        
        if existing_folders:
            # Folder exists, return its ID
            folder_id = existing_folders[0]['id']
            log.info(f"Found existing folder '{folder_name}' with ID: {folder_id}")
            return True, folder_id, None
        
        # Folder doesn't exist, create it
        try:
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            
            folder = drive.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            
            folder_id = folder.get('id')
            log.info(f"Created new folder '{folder_name}' with ID: {folder_id}")
            return True, folder_id, None
            
        except HttpError as e:
            if e.resp.status == 403:
                error_msg = f"Permission denied to create folder '{folder_name}'. Please ensure the service account has proper access."
                log.error(error_msg)
            else:
                error_msg = f"Drive API Error creating folder: {str(e)}"
                log.error(error_msg)
            return False, None, error_msg

    except Exception as e:
        error_msg = f"Error getting/creating folder: {str(e)}"
        log.error(error_msg)
        return False, None, error_msg


def list_folders_in_parent(parent_folder_id, logger=None):
    """
    List all folders in a parent folder.
    
    Args:
        parent_folder_id: Parent folder ID
        logger: Optional logger instance (uses logging if not provided)
        
    Returns:
        list: List of folder dicts with 'id' and 'name', or empty list on error
    """
    log = logger if logger else logging
    
    try:
        if drive is None:
            log.error("Google Drive service not initialized.")
            return []

        query = f"'{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = drive.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        folders = results.get('files', [])
        log.info(f"Found {len(folders)} folders in parent folder {parent_folder_id}")
        return folders

    except Exception as e:
        log.error(f"Error listing folders: {str(e)}")
        return []


def get_month_folder_id(base_folder_id, date_input, logger=None):
    """
    Get or create month-wise folder (e.g., "Aug 25", "Jul 25").
    
    Args:
        base_folder_id: Base folder ID (e.g., "S1 RR Reports")
        date_input: Date string (e.g., "25/08/25", "2025-08-25") or datetime object
        logger: Optional logger instance (uses logging if not provided)
        
    Returns:
        tuple: (success: bool, folder_id: str or None, error_message: str or None)
    """
    log = logger if logger else logging
    
    try:
        # Parse date input
        if isinstance(date_input, str):
            date_formats = ["%d/%m/%y", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"]
            dt = None
            for fmt in date_formats:
                try:
                    dt = datetime.strptime(date_input, fmt)
                    break
                except ValueError:
                    continue
            
            if dt is None:
                error_msg = f"Could not parse date: {date_input}"
                log.error(error_msg)
                return False, None, error_msg
        elif isinstance(date_input, datetime):
            dt = date_input
        else:
            error_msg = f"Invalid date input type: {type(date_input)}"
            log.error(error_msg)
            return False, None, error_msg
        
        # Format month folder name: "MMM YY" (e.g., "Aug 25", "Jul 25")
        month_abbr = dt.strftime("%b")  # 3-letter month abbreviation
        year_short = dt.strftime("%y")  # 2-digit year
        folder_name = f"{month_abbr} {year_short}"
        
        log.info(f"Getting/creating month folder: {folder_name} for date {dt.strftime('%Y-%m-%d')}")
        
        # Get or create the month folder
        return get_or_create_folder(base_folder_id, folder_name, logger)
        
    except Exception as e:
        error_msg = f"Error getting month folder ID: {str(e)}"
        log.error(error_msg)
        return False, None, error_msg


def upload_reactor_report_to_drive(pdf_path, base_folder_id, input_date, logger=None):
    """
    Upload reactor report PDF to month-wise folder in Google Drive.
    
    Args:
        pdf_path: Path to the PDF file
        base_folder_id: Base folder ID (e.g., "1cuL5gdl5GncegK2-FItKux7pg-D2sT--")
        input_date: Date string (e.g., "25/08/25", "2025-08-25")
        logger: Optional logger instance (uses logging if not provided)
        
    Returns:
        tuple: (success: bool, file_id: str or None, folder_id: str or None, error_message: str or None)
    """
    log = logger if logger else logging
    
    try:
        # Get or create month folder
        month_success, month_folder_id, month_error = get_month_folder_id(base_folder_id, input_date, logger)
        
        if not month_success:
            error_msg = f"Failed to get/create month folder: {month_error}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Generate file name from date
        # Parse date to format filename
        if isinstance(input_date, str):
            date_formats = ["%d/%m/%y", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y"]
            dt = None
            for fmt in date_formats:
                try:
                    dt = datetime.strptime(input_date, fmt)
                    break
                except ValueError:
                    continue
            
            if dt is None:
                # Fallback: use sanitized input_date
                sanitized_date = input_date.replace('/', '_').replace('-', '_')
                file_name = f"reactor_report_{sanitized_date}.pdf"
            else:
                file_name = f"reactor_report_{dt.strftime('%d-%m-%y')}.pdf"
        else:
            file_name = f"reactor_report_{datetime.now().strftime('%d-%m-%y')}.pdf"
        
        log.info(f"Uploading reactor report '{file_name}' to month folder (ID: {month_folder_id})")
        
        # Upload file using generic function
        upload_success, file_id, upload_error = upload_file_to_drive(
            file_path=pdf_path,
            folder_id=month_folder_id,
            file_name=file_name,
            mime_type='application/pdf',
            overwrite_existing=True,
            logger=logger
        )
        
        if upload_success:
            log.info(f"Successfully uploaded reactor report to Google Drive. File ID: {file_id}, Folder ID: {month_folder_id}")
            return True, file_id, month_folder_id, None
        else:
            error_msg = f"Failed to upload reactor report: {upload_error}"
            log.error(error_msg)
            return False, None, month_folder_id, error_msg
            
    except Exception as e:
        error_msg = f"Error uploading reactor report to Drive: {str(e)}"
        log.error(error_msg)
        return False, None, None, error_msg


def upload_to_google_drive(output_pdf, folder_id, employee_name, month, year):
    """
    Legacy function for salary slip uploads (maintains backward compatibility).
    Calls the generic upload_file_to_drive function.
    """
    try:
        file_name = f"Salary Slip_{employee_name}_{month}{year}.pdf"
        success, file_id, error = upload_file_to_drive(
            file_path=output_pdf,
            folder_id=folder_id,
            file_name=file_name,
            mime_type='application/pdf',
            overwrite_existing=True
        )
        return success
    except Exception as e:
        logging.error(f"Error in upload_to_google_drive wrapper: {str(e)}")
        return False


# ============================================================================
# HIERARCHICAL DRIVE UPLOAD FUNCTIONS FOR STORE PROCESSES
# ============================================================================

def get_financial_year_from_date(date_string):
    try:
        # Parse date string - handle multiple formats
        date_formats = [
            "%d/%m/%Y, %I:%M:%S %p",  # "15/07/2024, 10:30:45 AM"
            "%d/%m/%Y, %H:%M:%S",      # "15/07/2024, 10:30:45"
            "%d/%m/%Y",                # "15/07/2024"
            "%Y-%m-%d",                # "2024-07-15"
        ]
        
        dt = None
        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_string.split(',')[0].strip(), fmt.split(',')[0].strip())
                break
            except ValueError:
                continue
        
        if dt is None:
            logging.warning(f"Could not parse date: {date_string}")
            return None
        
        # Calculate financial year
        month = dt.month  # 1-12 (Jan=1, Dec=12)
        year = dt.year
        
        # Financial year: April (4) to March (3)
        # If month is Jan-Mar (1-3), FY is previous year to current year
        # If month is Apr-Dec (4-12), FY is current year to next year
        if month < 4:  # Jan, Feb, Mar
            fy_start = year - 1
            fy_end = year
        else:  # Apr, May, ..., Dec
            fy_start = year
            fy_end = year + 1
        
        return f"{fy_start} - {fy_end}"
        
    except Exception as e:
        logging.error(f"Error calculating financial year from date '{date_string}': {e}")
        return None


def get_month_sequence_and_name(date_string):
    """
    Get month sequence (1-12 for financial year) and formatted month name.
    Financial year months: April (1), May (2), ..., March (12)
    
    Args:
        date_string: Date string in format "DD/MM/YYYY, HH:MM:SS AM/PM" or similar
        
    Returns:
        tuple: (sequence: int, month_abbr: str, year_2digit: str) or (None, None, None) if parsing fails
        Example: (4, "Jul", "24") for July 2024
    """
    try:
        # Parse date string
        date_formats = [
            "%d/%m/%Y, %I:%M:%S %p",
            "%d/%m/%Y, %H:%M:%S",
            "%d/%m/%Y",
            "%Y-%m-%d",
        ]
        
        dt = None
        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_string.split(',')[0].strip(), fmt.split(',')[0].strip())
                break
            except ValueError:
                continue
        
        if dt is None:
            logging.warning(f"Could not parse date: {date_string}")
            return None, None, None
        
        month = dt.month  # 1-12
        year = dt.year
        year_2digit = str(year)[-2:]  # Last 2 digits
        
        # Calculate financial year month sequence
        # April (4) = 1, May (5) = 2, ..., March (3) = 12
        if month >= 4:  # Apr-Dec
            sequence = month - 3  # April (4) -> 1, May (5) -> 2, ..., Dec (12) -> 9
        else:  # Jan-Mar
            sequence = month + 9  # Jan (1) -> 10, Feb (2) -> 11, Mar (3) -> 12
        
        # Get month abbreviation (3 letters)
        month_abbr = dt.strftime("%b")  # "Jul", "Aug", etc.
        
        return sequence, month_abbr, year_2digit
        
    except Exception as e:
        logging.error(f"Error calculating month sequence from date '{date_string}': {e}")
        return None, None, None


def get_process_folder_name(process_type):
    """
    Get process-specific folder name.
    
    Args:
        process_type: "place_order", "material_inward", or "material_outward"
        
    Returns:
        str: Folder name (e.g., "1. Indents") or None if invalid
    """
    process_folder_map = {
        "place_order": "1. Indents",
        "material_inward": "2. Material Inward",
        "material_outward": "3. Material Outward"
    }
    
    return process_folder_map.get(process_type)


def get_or_create_hierarchical_folders(base_drive_id, financial_year, month_sequence, month_abbr, year_2digit, process_folder_name, logger=None):
    """
    Get or create hierarchical folder structure:
    Base Drive ID -> Financial Year -> Month Folder -> Process Folder
    
    Args:
        base_drive_id: Base Drive ID (e.g., "KR Store")
        financial_year: Financial year string (e.g., "2024 - 2025")
        month_sequence: Month sequence in FY (1-12)
        month_abbr: Month abbreviation (e.g., "Jul")
        year_2digit: 2-digit year (e.g., "24")
        process_folder_name: Process folder name (e.g., "1. Indents")
        logger: Optional logger instance
        
    Returns:
        tuple: (success: bool, final_folder_id: str or None, error_message: str or None)
    """
    log = logger if logger else logging
    
    try:
        if drive is None:
            error_msg = "Google Drive service not initialized"
            log.error(error_msg)
            return False, None, error_msg
        
        # Step 1: Get or create Financial Year folder
        fy_folder_name = financial_year
        log.info(f"Getting/creating Financial Year folder: {fy_folder_name}")
        fy_success, fy_folder_id, fy_error = get_or_create_folder(base_drive_id, fy_folder_name, logger)
        
        if not fy_success:
            error_msg = f"Failed to get/create Financial Year folder: {fy_error}"
            log.error(error_msg)
            return False, None, error_msg
        
        # Step 2: Get or create Month folder (format: "4. Jul 24")
        month_folder_name = f"{month_sequence}. {month_abbr} {year_2digit}"
        log.info(f"Getting/creating Month folder: {month_folder_name}")
        month_success, month_folder_id, month_error = get_or_create_folder(fy_folder_id, month_folder_name, logger)
        
        if not month_success:
            error_msg = f"Failed to get/create Month folder: {month_error}"
            log.error(error_msg)
            return False, None, error_msg
        
        # Step 3: Get or create Process folder (e.g., "1. Indents")
        log.info(f"Getting/creating Process folder: {process_folder_name}")
        process_success, process_folder_id, process_error = get_or_create_folder(month_folder_id, process_folder_name, logger)
        
        if not process_success:
            error_msg = f"Failed to get/create Process folder: {process_error}"
            log.error(error_msg)
            return False, None, error_msg
        
        log.info(f"Successfully created/accessed hierarchical folders. Final folder ID: {process_folder_id}")
        return True, process_folder_id, None
        
    except Exception as e:
        error_msg = f"Error creating hierarchical folders: {str(e)}"
        log.error(error_msg)
        return False, None, error_msg


def upload_store_document_to_drive(pdf_path, factory, date_string, process_type, file_name=None, logger=None):
    """
    Upload store process document (Place Order, Material Inward, Material Outward) to hierarchical Drive structure.
    
    Folder structure: {Base Drive ID}/{Financial Year}/{Month Sequence. Month YY}/{Process Folder}/{PDF}
    Example: KR Store/2024 - 2025/4. Jul 24/1. Indents/order_KR_12345.pdf
    
    Args:
        pdf_path: Path to the PDF file
        factory: Factory code (KR, GB, HB, OM, PV, HO)
        date_string: Date string (e.g., "15/07/2024, 10:30:45 AM")
        process_type: "place_order", "material_inward", or "material_outward"
        file_name: Custom file name (optional, will use default if not provided)
        logger: Optional logger instance
        
    Returns:
        tuple: (success: bool, file_id: str or None, folder_id: str or None, error_message: str or None)
    """
    log = logger if logger else logging
    
    try:
        # Lazy import to avoid circular dependency
        import sys
        if 'app' in sys.modules:
            PLANT_DATA = sys.modules['app'].PLANT_DATA
        else:
            from app import PLANT_DATA
        
        # Get plant configuration
        plant_config = None
        for plant in PLANT_DATA:
            if plant.get("document_name") == factory:
                plant_config = plant
                break
        
        if not plant_config:
            error_msg = f"Plant configuration not found for factory: {factory}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Get base Drive ID for store operations
        # Format: {plant_name_lowercase}_store_drive_id (e.g., "kerur_store_drive_id")
        plant_name = plant_config.get("name", "")
        if not plant_name:
            error_msg = f"Plant name not found in configuration for factory: {factory}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Convert plant name to lowercase and replace spaces with underscores
        plant_name_key = plant_name.lower().replace(" ", "_")
        store_drive_id_key = f"{plant_name_key}_store_drive_id"
        base_drive_id = plant_config.get(store_drive_id_key)
        
        if not base_drive_id or base_drive_id == "[TO_BE_ASSIGNED]":
            error_msg = f"Store Drive ID not configured for factory: {factory} (plant: {plant_name}). Please configure {store_drive_id_key} in PLANT_DATA"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Calculate financial year
        financial_year = get_financial_year_from_date(date_string)
        if not financial_year:
            error_msg = f"Could not calculate financial year from date: {date_string}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Get month sequence and name
        month_sequence, month_abbr, year_2digit = get_month_sequence_and_name(date_string)
        if month_sequence is None:
            error_msg = f"Could not calculate month sequence from date: {date_string}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Get process folder name
        process_folder_name = get_process_folder_name(process_type)
        if not process_folder_name:
            error_msg = f"Invalid process type: {process_type}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        log.info(f"Uploading {process_type} document for {factory} to Drive hierarchy")
        log.info(f"Path: {base_drive_id} -> {financial_year} -> {month_sequence}. {month_abbr} {year_2digit} -> {process_folder_name}")
        
        # Get or create hierarchical folders
        folder_success, final_folder_id, folder_error = get_or_create_hierarchical_folders(
            base_drive_id=base_drive_id,
            financial_year=financial_year,
            month_sequence=month_sequence,
            month_abbr=month_abbr,
            year_2digit=year_2digit,
            process_folder_name=process_folder_name,
            logger=logger
        )
        
        if not folder_success:
            error_msg = f"Failed to create hierarchical folders: {folder_error}"
            log.error(error_msg)
            return False, None, None, error_msg
        
        # Generate file name if not provided
        if not file_name:
            # Extract filename from pdf_path
            file_name = os.path.basename(pdf_path)
        
        log.info(f"Uploading file '{file_name}' to folder ID: {final_folder_id}")
        
        # Upload file using generic function
        upload_success, file_id, upload_error = upload_file_to_drive(
            file_path=pdf_path,
            folder_id=final_folder_id,
            file_name=file_name,
            mime_type='application/pdf',
            overwrite_existing=True,
            logger=logger
        )
        
        if upload_success:
            log.info(f"Successfully uploaded {process_type} document to Google Drive. File ID: {file_id}, Folder ID: {final_folder_id}")
            return True, file_id, final_folder_id, None
        else:
            error_msg = f"Failed to upload {process_type} document: {upload_error}"
            log.error(error_msg)
            return False, None, final_folder_id, error_msg
            
    except Exception as e:
        error_msg = f"Error uploading {process_type} document to Drive: {str(e)}"
        log.error(error_msg)
        import traceback
        log.error(traceback.format_exc())
        return False, None, None, error_msg