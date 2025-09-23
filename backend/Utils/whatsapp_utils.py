# whatsapp_utils_node.py - Python client for Node.js WhatsApp service
import requests
import logging
import os
import json
from typing import List, Dict, Optional, Union
from datetime import datetime
from flask import session

# Configure logging
logging.basicConfig(level=logging.INFO)

class WhatsAppNodeClient:
    """Client to interact with Node.js WhatsApp service"""
    
    def __init__(self, node_service_url: str = "http://uatwhatsapp.bajajearths.com", user_email: str = None):
        self.base_url = node_service_url.rstrip('/')
        self.timeout = 3600  # 1 hour timeout for WhatsApp operations (QR scanning, login, etc.)
        # Use provided user_email or fall back to session
        self.user_email = get_user_email_from_session(user_email)
        
        # Log the initialization with more detail
        if self.user_email:
            logging.info(f"WhatsApp client initialized for user: {self.user_email}")
            # Log session details for debugging
            try:
                from flask import session
                session_user = session.get('user', {})
                logging.debug(f"Session user data: id={session_user.get('id')}, email={session_user.get('email')}")
            except:
                pass
        else:
            logging.warning("WhatsApp client initialized without user email - some features may not work properly")
    
    def check_service_health(self) -> bool:
        """Check if WhatsApp service is running and ready"""
        try:
            logging.info(f"Checking WhatsApp service health at: {self.base_url}/health")
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.get(f"{self.base_url}/health", headers=headers, timeout=self.timeout)
            logging.info(f"Health check response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logging.info(f"Health check response data: {data}")
                whatsapp_ready = data.get('whatsappReady', False)
                whatsapp_initialized = data.get('whatsappInitialized', False)
                has_qr = data.get('hasQR', False)
                
                logging.info(f"Service status - Ready: {whatsapp_ready}, Initialized: {whatsapp_initialized}, Has QR: {has_qr}")
                
                if not whatsapp_ready:
                    if not whatsapp_initialized:
                        logging.error("WhatsApp service is not initialized. User needs to scan QR code first.")
                    elif has_qr:
                        logging.error("QR code is available but not yet scanned. User needs to scan the QR code.")
                    else:
                        logging.error("WhatsApp service is not ready. Make sure to authenticate first through the UI.")
                    
                    # Additional debug info
                    if self.user_email:
                        logging.info(f"Checking status for user: {self.user_email}")
                    else:
                        logging.error("No user email provided. Make sure to pass the user's email when creating the client.")
                        
                return whatsapp_ready
            else:
                logging.error(f"Health check failed with status {response.status_code}: {response.text}")
                return False
        except requests.exceptions.ConnectionError as e:
            logging.error(f"Connection error to WhatsApp service: {e}")
            logging.error("This usually means the service is not running on port 7083")
            return False
        except requests.exceptions.Timeout as e:
            logging.error(f"Timeout error connecting to WhatsApp service: {e}")
            return False
        except requests.exceptions.RequestException as e:
            logging.error(f"Request error to WhatsApp service: {e}")
            return False
        except Exception as e:
            logging.error(f"Unexpected error checking WhatsApp service health: {e}")
            logging.error(f"Error type: {type(e)}")
            return False

    def get_status(self) -> Dict:
        """Get WhatsApp status from Node service"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            # Use /auth-status endpoint to get full authentication status including user info
            response = requests.get(f"{self.base_url}/auth-status", headers=headers, timeout=self.timeout)
            if response.status_code == 200:
                data = response.json()
                # Convert the response to match the expected format
                return {
                    "isReady": data.get("authenticated", False),
                    "status": "ready" if data.get("authenticated", False) else "initializing",
                    "authenticated": data.get("authenticated", False),
                    "userInfo": data.get("userInfo")
                }
            return {"isReady": False, "status": "unavailable", "authenticated": False, "userInfo": None}
        except Exception as e:
            logging.error(f"Error getting WhatsApp status: {e}")
            return {"isReady": False, "status": "error", "authenticated": False, "userInfo": None}

    def get_qr(self) -> Dict:
        """Get current QR code (if any) from Node service"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.get(f"{self.base_url}/qr", headers=headers, timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
            return {"qr": ""}
        except Exception as e:
            logging.error(f"Error getting WhatsApp QR: {e}")
            return {"qr": ""}

    def trigger_login(self) -> Dict:
        """Trigger login flow on Node service (refresh QR)"""
        try:
            headers = {'X-User-Email': self.user_email, 'Content-Type': 'application/json'} if self.user_email else {'Content-Type': 'application/json'}
            data = {'email': self.user_email} if self.user_email else {}
            response = requests.post(f"{self.base_url}/trigger-login", headers=headers, json=data, timeout=self.timeout)
            
            if response.status_code == 200:
                result = response.json()
                if not result.get('authenticated'):
                    # Add special flag for frontend to show QR modal
                    result['requiresQRScan'] = True
                    result['userEmail'] = self.user_email
                    # Log that QR scan needed
                    logging.info(f"WhatsApp authentication required for {self.user_email}. QR scan needed.")
                return result
                
            logging.error(f"Trigger login failed: {response.status_code} - {response.text}")
            return {"qr": "", "requiresQRScan": True, "userEmail": self.user_email}
        except Exception as e:
            logging.error(f"Error triggering WhatsApp login: {e}")
            return {"qr": "", "requiresQRScan": True, "userEmail": self.user_email}

    def logout(self) -> bool:
        """Logout current WhatsApp session on Node service"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(f"{self.base_url}/logout", headers=headers, timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            logging.error(f"Error logging out WhatsApp: {e}")
            return False

    def force_new_session(self) -> bool:
        """Force a new WhatsApp session by clearing existing session"""
        try:
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(f"{self.base_url}/force-new-session", headers=headers, timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            logging.error(f"Error forcing new WhatsApp session: {e}")
            return False
    
    def wait_for_service(self, max_attempts: int = 30, interval: int = 5) -> bool:
        """Wait for WhatsApp service to be ready"""
        import time
        
        for attempt in range(max_attempts):
            if self.check_service_health():
                logging.info("WhatsApp service is ready")
                return True
            logging.info(f"Waiting for WhatsApp service... Attempt {attempt + 1}/{max_attempts}")
            time.sleep(interval)
        
        logging.error("WhatsApp service failed to become ready")
        return False
    
    def has_user_email(self) -> bool:
        """Check if this client has a valid user email"""
        return has_user_email(self.user_email)

    def send_message(self, 
                    contact_name: str, 
                    whatsapp_number: str,
                    process_name: str = "salary_slip",
                    message: str = "",
                    file_paths: List[str] = None,
                    file_sequence: List[Dict] = None,
                    variables: Dict = None,
                    options: Dict = None) -> Union[bool, str]:
        try:
            # Validate that we have a user email
            if not self.has_user_email():
                logging.error("No user email available for WhatsApp message. Please ensure user is logged in.")
                return "USER_NOT_LOGGED_IN"
            
            # Check if service is ready
            if not self.check_service_health():
                logging.error("WhatsApp service is not ready")
                return "WHATSAPP_SERVICE_NOT_READY"
            
            # Prepare file paths
            if file_paths is None:
                file_paths = []
            elif isinstance(file_paths, str):
                file_paths = [file_paths]
            
            # Prepare file sequence
            if file_sequence is None:
                file_sequence = []
            
            # Prepare variables
            if variables is None:
                variables = {}
            
            # Prepare options
            if options is None:
                options = {}
            
            # Prepare request data
            data = {
                'contact_name': contact_name,
                'whatsapp_number': whatsapp_number,
                'process_name': process_name,
                'message': message,
                'file_sequence': json.dumps(file_sequence),
                'variables': json.dumps(variables),
                'options': json.dumps(options)
            }
            
            # Prepare files for upload - deduplicate file paths
            files = []
            seen_files = set()  # Track unique file paths to prevent duplicates
            if file_paths:
                for file_path in file_paths:
                    # Normalize the file path to handle different representations of the same file
                    normalized_path = os.path.abspath(file_path)
                    if normalized_path not in seen_files:
                        seen_files.add(normalized_path)
                        if os.path.exists(file_path):
                            files.append(('files', open(file_path, 'rb')))
                            logging.info(f"Added file for upload: {file_path}")
                        else:
                            logging.warning(f"File not found: {file_path}")
                    else:
                        logging.info(f"Skipping duplicate file: {file_path}")
            
            logging.info(f"Sending WhatsApp message to {contact_name} ({whatsapp_number}) with process: {process_name}")
            
            # Send request with email header
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(
                f"{self.base_url}/send-message",
                headers=headers,
                data=data,
                files=files,
                timeout=self.timeout
            )
            
            # Close file handles
            for _, file_handle in files:
                file_handle.close()
            
            if response.status_code == 200:
                result = response.json()
                success = bool(result.get('success', False))
                
                # Check for detailed error information in the response
                if not success:
                    error_message = result.get('error', 'Unknown error')
                    error_details = result.get('details', '')
                    logging.error(f"WhatsApp message failed to {contact_name} on {whatsapp_number}: {error_message}")
                    if error_details:
                        logging.error(f"Error details: {error_details}")
                    return "WHATSAPP_SEND_ERROR"
                else:
                    logging.info(f"WhatsApp message sent successfully to {contact_name} on {whatsapp_number}")
                    return success
            else:
                logging.error(f"Error sending WhatsApp message: {response.status_code} - {response.text}")
                return "WHATSAPP_API_ERROR"
                
        except requests.exceptions.ConnectionError as e:
            logging.error(f"Connection error to WhatsApp service: {e}")
            return "WHATSAPP_CONNECTION_ERROR"
        except requests.exceptions.Timeout as e:
            logging.error(f"Timeout error connecting to WhatsApp service: {e}")
            return "WHATSAPP_TIMEOUT_ERROR"
        except Exception as e:
            logging.error(f"Error sending WhatsApp message to {contact_name}: {str(e)}")
            return "WHATSAPP_SEND_ERROR"

    def send_bulk_messages(self, 
                          contacts: List[Dict], 
                          process_name: str = "salary_slip",
                          message: str = "",
                          file_paths: List[str] = None,
                          variables: Dict = None,
                          options: Dict = None) -> List[Dict]:

        try:
            # Validate that we have a user email
            if not self.has_user_email():
                logging.error("No user email available for bulk WhatsApp messages. Please ensure user is logged in.")
                return []
            
            # Check if service is ready
            if not self.check_service_health():
                logging.error("WhatsApp service is not ready")
                return []
            
            # Prepare file paths
            if file_paths is None:
                file_paths = []
            
            # Prepare variables
            if variables is None:
                variables = {}
            
            # Prepare options
            if options is None:
                options = {}
            
            # Prepare request data
            data = {
                'contacts': json.dumps(contacts),
                'process_name': process_name,
                'message': message,
                'variables': json.dumps(variables),
                'options': json.dumps(options)
            }
            
            # Prepare files for upload - deduplicate file paths
            files = []
            seen_files = set()  # Track unique file paths to prevent duplicates
            for file_path in file_paths:
                # Normalize the file path to handle different representations of the same file
                normalized_path = os.path.abspath(file_path)
                if normalized_path not in seen_files:
                    seen_files.add(normalized_path)
                    if os.path.exists(file_path):
                        files.append(('files', open(file_path, 'rb')))
                        logging.info(f"Added file for bulk upload: {file_path}")
                    else:
                        logging.warning(f"File not found: {file_path}")
                else:
                    logging.info(f"Skipping duplicate file in bulk upload: {file_path}")
            
            logging.info(f"Sending bulk WhatsApp messages to {len(contacts)} contacts with process: {process_name}")
            
            # Send request with email header
            headers = {'X-User-Email': self.user_email} if self.user_email else {}
            response = requests.post(
                f"{self.base_url}/send-bulk",
                headers=headers,
                data=data,
                files=files,
                timeout=self.timeout * max(len(contacts), 1)  # Longer timeout for bulk, minimum 60s
            )
            
            # Close file handles
            for _, file_handle in files:
                file_handle.close()
            
            if response.status_code == 200:
                result = response.json()
                successful = result.get('successful', 0)
                total_processed = result.get('total_processed', 0)
                logging.info(f"Bulk WhatsApp messages processed: {successful}/{total_processed} successful")
                
                # Check if there were any failures
                if successful < total_processed:
                    failed_count = total_processed - successful
                    logging.warning(f"Bulk WhatsApp messages: {failed_count} messages failed out of {total_processed}")
                
                return result.get('results', [])
            else:
                logging.error(f"Error sending bulk WhatsApp messages: {response.status_code} - {response.text}")
                return []
                
        except Exception as e:
            logging.error(f"Error sending bulk WhatsApp messages: {str(e)}")
            return []


# Legacy function wrappers for backward compatibility
def send_whatsapp_message(contact_name: str, message: Union[str, List[str]], 
                         file_paths: Union[str, List[str]] = None, 
                         file_sequence: List[Dict] = None,
                         whatsapp_number: str = "", 
                         process_name: str = "salary_slip",
                         options: Optional[Dict] = None,
                         user_email: str = None) -> Union[bool, str]:
    """
    Legacy wrapper for the unified send_message function
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Convert message to string if it's a list
    if isinstance(message, list):
        message_text = '\n'.join(message)
    else:
        message_text = message or ""
    
    # Convert file_paths to list if it's a string
    if isinstance(file_paths, str):
        file_paths = [file_paths]
    elif file_paths is None:
        file_paths = []
    
    # Extract variables from options
    variables = options.get('variables', {}) if options else {}
    
    return client.send_message(
        contact_name=contact_name,
        whatsapp_number=whatsapp_number,
        process_name=process_name,
        message=message_text,
        file_paths=file_paths,
        file_sequence=file_sequence,
        variables=variables,
        options=options
    )


def send_bulk_whatsapp_messages(contacts: List[Dict], message: Union[str, List[str]], 
                               file_paths: List[str] = None, 
                               process_name: str = "salary_slip",
                               user_email: str = None) -> List[Dict]:
    """
    Legacy wrapper for the unified send_bulk_messages function
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Convert message to string if it's a list
    if isinstance(message, list):
        message_text = '\n'.join(message)
    else:
        message_text = message or ""
    
    return client.send_bulk_messages(
        contacts=contacts,
        process_name=process_name,
        message=message_text,
        file_paths=file_paths,
        variables={},
        options={}
    )


def handle_reactor_report_notification(recipients_data, input_date, file_path, sheets_processed, user_email: str = None):
    """
    Legacy function for reactor report notifications - now uses unified approach
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Validate that we have a user email
    if not client.has_user_email():
        logging.error("No user email available for reactor report notification. Please ensure user is logged in.")
        return "USER_NOT_LOGGED_IN"
    
    # Check if service is ready
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return "WHATSAPP_SERVICE_NOT_READY"
    
    try:
        # Parse recipients from recipients_data
        if not recipients_data or len(recipients_data) < 2:
            logging.error("No recipients data provided for reactor report")
            return "NO_RECIPIENTS_DATA"
        
        headers = [h.strip() for h in recipients_data[0]]
        logging.info(f"Available headers: {headers}")
        
        # Look for various possible column names
        name_idx = None
        phone_idx = None
        whatsapp_idx = None
        
        # Try different possible column names
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if 'name' in header_lower:
                name_idx = i
            elif 'phone' in header_lower or 'contact' in header_lower or 'mobile' in header_lower:
                phone_idx = i
            elif 'whatsapp' in header_lower:
                whatsapp_idx = i
        
        logging.info(f"Recipients headers found: Name={name_idx}, Phone={phone_idx}, WhatsApp={whatsapp_idx}")
        
        if name_idx is None or (phone_idx is None and whatsapp_idx is None):
            logging.error("Required columns for WhatsApp notifications not found in recipients data")
            logging.error(f"Available headers: {headers}")
            return "MISSING_REQUIRED_COLUMNS"
        
        success_count = 0
        total_recipients = 0
        
        for row in recipients_data[1:]:
            try:
                if len(row) > max(name_idx, phone_idx or 0, whatsapp_idx or 0):
                    recipient_name = row[name_idx].strip()
                    phone_number = row[phone_idx].strip() if phone_idx is not None else ''
                    whatsapp_number = row[whatsapp_idx].strip() if whatsapp_idx is not None else ''
                    
                    # Use WhatsApp number if available, otherwise use phone number
                    contact_number = whatsapp_number if whatsapp_number else phone_number
                    
                    logging.info(f"Processing recipient: {recipient_name}, Contact: {contact_number}")
                    
                    if recipient_name and contact_number:
                        # Validate phone number format for reactor reports
                        # Extract country code and phone number from the contact
                        contact_cleaned = contact_number.replace(' ', '').replace('-', '').replace('+', '')
                        
                        # Check if the contact number has proper format (minimum 4 digits as per ITU standard)
                        if len(contact_cleaned) < 4:
                            logging.warning(f"Skipping WhatsApp message for {recipient_name}: Invalid phone number format - too short ({len(contact_cleaned)} digits)")
                            continue
                        
                        if len(contact_cleaned) > 15:
                            logging.warning(f"Skipping WhatsApp message for {recipient_name}: Invalid phone number format - too long ({len(contact_cleaned)} digits)")
                            continue
                        
                        logging.info(f"Valid phone number for {recipient_name}: {contact_number} -> Cleaned: {contact_cleaned}")
                        total_recipients += 1
                        
                        # Send WhatsApp message using unified function
                        success = client.send_message(
                            contact_name=recipient_name,
                            whatsapp_number=contact_number,
                            process_name="reactor_report",
                            file_paths=[file_path],
                            variables={
                                "input_date": input_date,
                                "sheets_processed": sheets_processed
                            },
                            options={}
                        )
                        
                        if success is True:
                            success_count += 1
                            logging.info(f"Reactor report WhatsApp message sent successfully to {recipient_name}")
                        else:
                            logging.error(f"Failed to send reactor report WhatsApp message to {recipient_name}: {success}")
                    else:
                        logging.warning(f"Skipping WhatsApp notification for {recipient_name}: Missing contact number")
            except Exception as e:
                logging.error(f"Error sending reactor report WhatsApp notification to {recipient_name if 'recipient_name' in locals() else 'unknown'}: {e}")
                continue
        
        logging.info(f"Reactor report WhatsApp notifications: {success_count}/{total_recipients} successful")
        if success_count > 0:
            return True
        else:
            return "NO_SUCCESSFUL_NOTIFICATIONS"
        
    except Exception as e:
        logging.error(f"Error processing reactor report WhatsApp notifications: {e}")
        return "REACTOR_NOTIFICATION_ERROR"


def get_employee_contact(employee_name: str, contact_employees: List[Dict]) -> str:
    """Get employee contact number from contact data - matches original Python function"""
    try:
        if not isinstance(contact_employees, list):
            logging.error("Error: contact_employees is not a list of dictionaries.")
            return ""
            
        for record in contact_employees:
            if isinstance(record, dict) and record.get("Name") == employee_name:
                contact = str(record.get("Contact No.", ""))
                if contact:
                    logging.info(f"Found contact for {employee_name}: {contact}")
                else:
                    logging.warning(f"No contact found for {employee_name}")
                return contact
                
        logging.warning(f"No contact record found for {employee_name}")
        return ""
    except Exception as e:
        logging.error(f"Error getting contact for {employee_name}: {str(e)}")
        return ""


def prepare_file_paths(file_paths, temp_dir=None, is_upload=False):
    """Maintain original prepare_file_paths function for backward compatibility"""
    try:
        if not file_paths:
            return []
            
        if not isinstance(file_paths, list):
            file_paths = [file_paths]
            
        valid_paths = []
        seen_filenames = set()

        def _remove_numeric_prefix(filename: str) -> str:
            """Remove a leading long numeric prefix followed by '-' from filename.
            Example: '1755776006074-reactor_report_2025-08-02.pdf' -> 'reactor_report_2025-08-02.pdf'
            Keeps the original name otherwise.
            """
            try:
                base_name = os.path.basename(filename)
                parts = base_name.split('-', 1)
                if len(parts) == 2 and parts[0].isdigit() and len(parts[0]) >= 10:
                    return parts[1]
                return base_name
            except Exception:
                return os.path.basename(filename)
        
        for path in file_paths:
            if is_upload:
                if hasattr(path, 'filename') and path.filename:
                    # Normalize and clean the filename to avoid unwanted numeric prefixes
                    original_filename = os.path.basename(path.filename)
                    cleaned_filename = _remove_numeric_prefix(original_filename)
                    if temp_dir and not os.path.exists(temp_dir):
                        os.makedirs(temp_dir, exist_ok=True)
                    temp_path = os.path.join(temp_dir, cleaned_filename) if temp_dir else cleaned_filename
                    path.save(temp_path)
                    valid_paths.append(temp_path)
                    seen_filenames.add(cleaned_filename)
                    logging.info(f"Saved attachment file as '{cleaned_filename}' (original: '{original_filename}') to: {temp_path}")
            else:
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


# Configuration
WHATSAPP_NODE_SERVICE_URL = os.getenv('WHATSAPP_NODE_SERVICE_URL', 'https://uatwhatsapp.bajajearths.com')

def get_user_email_from_session(user_email: str = None) -> str:
    """
    Get user email from parameter or fall back to session.
    This function can be used by other modules to get the current user's email.
    """
    if user_email:
        return user_email
    try:
        session_email = session.get('user', {}).get('email') or session.get('user', {}).get('id')
        if session_email:
            logging.info(f"Retrieved user identifier from session: {session_email}")
            logging.debug(f"Session contains: email={session.get('user', {}).get('email')}, id={session.get('user', {}).get('id')}")
        else:
            logging.warning("No user email found in session")
        return session_email
    except Exception as e:
        logging.warning(f"Could not get user email from session: {e}")
        return None

def has_user_email(user_email: str = None) -> bool:
    """
    Check if a user email is available (either provided or in session).
    """
    email = get_user_email_from_session(user_email)
    return email is not None and email.strip() != ""

def initialize_whatsapp_client(user_email: str = None) -> bool:
    """
    Initialize WhatsApp client for a specific user and ensure they're authenticated.
    Returns True if the client is ready to use.
    """
    client = WhatsAppNodeClient(user_email=user_email)
    
    # Validate that we have a user email
    if not client.has_user_email():
        logging.error("No user email available for WhatsApp client initialization. Please ensure user is logged in.")
        return False
    
    # First check if already authenticated
    try:
        if client.check_service_health():
            logging.info(f"WhatsApp client already initialized and ready for user: {client.user_email}")
            return True
            
        # If not ready, try to trigger login to get QR code
        login_result = client.trigger_login()
        
        if login_result.get('authenticated'):
            logging.info(f"WhatsApp client authenticated for user: {client.user_email}")
            return True
        elif login_result.get('qr'):
            logging.info(f"QR code generated for user: {client.user_email}. User needs to scan QR code.")
            return False
        else:
            logging.error(f"Failed to initialize WhatsApp client for user: {client.user_email}")
            return False
    except Exception as e:
        logging.error(f"Error initializing WhatsApp client for user {client.user_email}: {str(e)}")
        return False

# Initialize client
whatsapp_client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL)