# whatsapp_utils_node.py - Python client for Node.js WhatsApp service
import requests
import logging
import os
import json
from typing import List, Dict, Optional, Union
from datetime import datetime  # Add this import

# Configure logging
logging.basicConfig(level=logging.INFO)

class WhatsAppNodeClient:
    """Client to interact with Node.js WhatsApp service"""
    
    def __init__(self, node_service_url: str = "http://localhost:3001"):
        self.base_url = node_service_url.rstrip('/')
        self.timeout = 30
        
    def check_service_health(self) -> bool:
        """Check if WhatsApp service is running and ready"""
        try:
            logging.info(f"Checking WhatsApp service health at: {self.base_url}/health")
            response = requests.get(f"{self.base_url}/health", timeout=self.timeout)
            logging.info(f"Health check response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                logging.info(f"Health check response data: {data}")
                whatsapp_ready = data.get('whatsappReady', False)
                whatsapp_initialized = data.get('whatsappInitialized', False)
                has_qr = data.get('hasQR', False)
                
                logging.info(f"Service status - Ready: {whatsapp_ready}, Initialized: {whatsapp_initialized}, Has QR: {has_qr}")
                return whatsapp_ready
            else:
                logging.error(f"Health check failed with status {response.status_code}: {response.text}")
                return False
        except requests.exceptions.ConnectionError as e:
            logging.error(f"Connection error to WhatsApp service: {e}")
            logging.error("This usually means the service is not running on port 3001")
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
            response = requests.get(f"{self.base_url}/status", timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
            return {"isReady": False, "status": "unavailable"}
        except Exception as e:
            logging.error(f"Error getting WhatsApp status: {e}")
            return {"isReady": False, "status": "error"}

    def get_qr(self) -> Dict:
        """Get current QR code (if any) from Node service"""
        try:
            response = requests.get(f"{self.base_url}/qr", timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
            return {"qr": ""}
        except Exception as e:
            logging.error(f"Error getting WhatsApp QR: {e}")
            return {"qr": ""}

    def trigger_login(self) -> Dict:
        """Trigger login flow on Node service (refresh QR)"""
        try:
            response = requests.post(f"{self.base_url}/trigger-login", timeout=self.timeout)
            if response.status_code == 200:
                return response.json()
            logging.error(f"Trigger login failed: {response.status_code} - {response.text}")
            return {"qr": ""}
        except Exception as e:
            logging.error(f"Error triggering WhatsApp login: {e}")
            return {"qr": ""}

    def logout(self) -> bool:
        """Logout current WhatsApp session on Node service"""
        try:
            response = requests.post(f"{self.base_url}/logout", timeout=self.timeout)
            return response.status_code == 200
        except Exception as e:
            logging.error(f"Error logging out WhatsApp: {e}")
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

def send_whatsapp_message(contact_name: str, message: Union[str, List[str]], 
                         file_paths: Union[str, List[str]] = None, 
                         file_sequence: List[Dict] = None,
                         whatsapp_number: str = "", 
                         process_name: str = "salary_slip",
                         options: Optional[Dict] = None) -> bool:
    """
    Send WhatsApp message via Node.js service - matches original Python function signature
    """
    client = WhatsAppNodeClient()
    
    # Check if service is ready
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return False
    
    try:
        # Prepare message - convert list to string if needed
        if isinstance(message, list):
            message_text = '\n'.join(message)
        else:
            message_text = message
        
        # Prepare file paths
        if file_paths is None:
            file_paths = []
        elif isinstance(file_paths, str):
            file_paths = [file_paths]
        
        # Prepare file sequence
        if file_sequence is None:
            file_sequence = []
        
        # Choose the correct endpoint based on process_name
        endpoint = '/send-message'  # default
        if process_name == 'reactor_report':
            endpoint = '/send-reactor-report'
        elif process_name == 'salary_slip':
            endpoint = '/send-salary-notification'
        elif process_name == 'report':
            endpoint = '/send-general-report'  # Use general report endpoint
        
        logging.info(f"Using endpoint: {endpoint} for process: {process_name}")
        
        # Prepare request data based on endpoint
        if endpoint == '/send-reactor-report':
            # For reactor reports, we need to send recipients data
            data = {
                'recipients': json.dumps([{
                    'name': contact_name,
                    'phone': whatsapp_number
                }]),
                'input_date': datetime.now().strftime('%Y-%m-%d'),
                'sheets_processed': 1,
                'options': json.dumps(options or {})
            }
        else:
            # For other processes, use standard format
            data = {
                'contact_name': contact_name,
                'message': message_text,
                'whatsapp_number': whatsapp_number,
                'process_name': process_name,
                'file_sequence': json.dumps(file_sequence) if file_sequence else '[]',
                'options': json.dumps(options or {})
            }
        
        # Prepare files for upload
        files = []
        if file_paths:
            for file_path in file_paths:
                if os.path.exists(file_path):
                    files.append(('files', open(file_path, 'rb')))
                    logging.info(f"Added file for upload: {file_path}")
                else:
                    logging.warning(f"File not found: {file_path}")
        
        logging.info(f"Sending request to {endpoint} with {len(files)} files")
        
        # Send request
        response = requests.post(
            f"{client.base_url}{endpoint}",
            data=data,
            files=files,
            timeout=client.timeout
        )
        
        # Close file handles
        for _, file_handle in files:
            file_handle.close()
        
        if response.status_code == 200:
            result = response.json()
            # Support both legacy and new response shapes
            if isinstance(result, dict) and 'data' in result and isinstance(result['data'], dict):
                # Prefer explicit sent flag when available
                sent = result['data'].get('sent')
                if sent is not None:
                    logging.info(f"WhatsApp message {'sent successfully' if sent else 'failed'} to {contact_name}")
                    return bool(sent)
            success = bool(result.get('success', False))
            logging.info(f"WhatsApp message {'sent successfully' if success else 'failed'} to {contact_name}")
            return success
        else:
            logging.error(f"Error sending WhatsApp message: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending WhatsApp message to {contact_name}: {str(e)}")
        return False

def handle_whatsapp_notification(contact_name: str, full_month: str, full_year: str, 
                                whatsapp_number: str, file_path: Union[str, List[str], Dict], 
                                is_special: bool = False, months_data: List[Dict] = None) -> bool:
    """
    Handle WhatsApp notification for salary slips - matches original Python function
    """
    client = WhatsAppNodeClient()
    
    # Check if service is ready
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return False
    
    try:
        # Handle different input types for file_path
        file_paths = []
        
        if isinstance(file_path, dict):
            # If it's a dictionary (result object), extract the file path
            if 'output_file' in file_path:
                file_paths = [file_path['output_file']]
                logging.info(f"Extracted file path from dict: {file_path['output_file']}")
            else:
                logging.error(f"Dictionary provided but no 'output_file' key found: {file_path}")
                return False
        elif isinstance(file_path, str):
            file_paths = [file_path]
        elif isinstance(file_path, list):
            # Handle list that might contain dicts or strings
            for item in file_path:
                if isinstance(item, dict):
                    if 'output_file' in item:
                        file_paths.append(item['output_file'])
                    else:
                        logging.warning(f"Dict in list missing 'output_file' key: {item}")
                elif isinstance(item, (str, bytes, os.PathLike)):
                    file_paths.append(item)
                else:
                    logging.warning(f"Invalid item type in file_path list: {type(item)}")
        else:
            logging.error(f"Invalid file_path type: {type(file_path)}. Expected str, list, or dict, got: {file_path}")
            return False
        
        # Validate that we have at least one file path
        if not file_paths:
            logging.error("No valid file paths found after processing input")
            return False
        
        # Prepare months data
        if months_data is None:
            months_data = [{"month": full_month, "year": full_year}]
        
        # Prepare request data
        data = {
            'contact_name': contact_name,
            'full_month': full_month,
            'full_year': full_year,
            'whatsapp_number': whatsapp_number,
            'is_special': is_special,
            'months_data': json.dumps(months_data)
        }
        
        # Prepare files for upload
        files = []
        for file_path_item in file_paths:
            # Convert to string and normalize path separators
            file_path_str = str(file_path_item)
            
            # Normalize path separators (convert \\ to / or use os.path.normpath)
            normalized_path = os.path.normpath(file_path_str)
            
            logging.info(f"Processing file path: {normalized_path}")
            
            # Validate that the normalized path is a string
            if not isinstance(normalized_path, (str, bytes, os.PathLike)):
                logging.error(f"Invalid file path after normalization: {type(normalized_path)}")
                continue
            
            if os.path.exists(normalized_path):
                files.append(('files', open(normalized_path, 'rb')))
                logging.info(f"Added file for upload: {normalized_path}")
            else:
                logging.warning(f"File not found: {normalized_path}")
        
        if not files:
            logging.error("No valid files found for upload")
            return False
        
        # Send request
        response = requests.post(
            f"{client.base_url}/send-salary-notification",
            data=data,
            files=files,
            timeout=client.timeout
        )
        
        # Close file handles
        for _, file_handle in files:
            file_handle.close()
        
        if response.status_code == 200:
            result = response.json()
            success = result.get('success', False)
            logging.info(f"Salary slip notification {'sent successfully' if success else 'failed'} to {contact_name}")
            return success
        else:
            logging.error(f"Error sending salary slip notification: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending salary slip notification to {contact_name}: {str(e)}")
        return False

def handle_reactor_report_notification(recipients_data, input_date, file_path, sheets_processed):
    """
    Handle WhatsApp notification for reactor reports - new function for reactor reports
    """
    client = WhatsAppNodeClient()
    
    # Add detailed debugging
    logging.info(f"Attempting to check WhatsApp service health...")
    logging.info(f"Service URL: {client.base_url}")
    
    # Check if service is ready with detailed error handling
    try:
        health_status = client.check_service_health()
        logging.info(f"WhatsApp service health check result: {health_status}")
        
        if not health_status:
            logging.error("WhatsApp service health check failed")
            logging.error("This could mean:")
            logging.error("1. WhatsApp service is not running on port 3001")
            logging.error("2. Network connectivity issues")
            logging.error("3. Service is not responding")
            
            # Try to get more details
            try:
                status_response = client.get_status()
                logging.info(f"Service status response: {status_response}")
            except Exception as status_error:
                logging.error(f"Could not get service status: {status_error}")
            
            return False
    except Exception as health_error:
        logging.error(f"Error during service health check: {health_error}")
        logging.error(f"Health check exception type: {type(health_error)}")
        return False
    
    try:
        # Parse recipients from recipients_data
        if not recipients_data or len(recipients_data) < 2:
            logging.error("No recipients data provided for reactor report")
            return False
        
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
            return False
        
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
                        total_recipients += 1
                        
                        # Create reactor report message
                        message = [
                            "Reactor Report - Daily Operations Summary",
                            "",
                            f"Please find attached the reactor report for the period from {input_date} to {input_date}.",
                            "",
                            "This report contains snapshots of all reactor operations data for the specified period.",
                            "",
                            f"Sheets processed: {sheets_processed}",
                            "",
                            "Best regards,",
                            "Reactor Automation System"
                        ]
                        
                        # Send WhatsApp message with the generated PDF
                        success = send_whatsapp_message(
                            contact_name=recipient_name,
                            message=message,
                            file_paths=[file_path],
                            file_sequence=[],
                            whatsapp_number=contact_number,
                            process_name="reactor_report"
                        )
                        
                        if success:
                            success_count += 1
                            logging.info(f"Reactor report WhatsApp message sent successfully to {recipient_name}")
                        else:
                            logging.error(f"Failed to send reactor report WhatsApp message to {recipient_name}")
                    else:
                        logging.warning(f"Skipping WhatsApp notification for {recipient_name}: Missing contact number")
            except Exception as e:
                logging.error(f"Error sending reactor report WhatsApp notification to {recipient_name if 'recipient_name' in locals() else 'unknown'}: {e}")
                continue
        
        logging.info(f"Reactor report WhatsApp notifications: {success_count}/{total_recipients} successful")
        return success_count > 0
        
    except Exception as e:
        logging.error(f"Error processing reactor report WhatsApp notifications: {e}")
        return False

def send_bulk_whatsapp_messages(contacts: List[Dict], message: Union[str, List[str]], 
                               file_paths: List[str] = None, 
                               process_name: str = "salary_slip") -> List[Dict]:
    client = WhatsAppNodeClient()
    
    # Check if service is ready
    if not client.check_service_health():
        logging.error("WhatsApp service is not ready")
        return []
    
    try:
        # Prepare message
        if isinstance(message, list):
            message_text = '\n'.join(message)
        else:
            message_text = message
        
        # Prepare file paths
        if file_paths is None:
            file_paths = []
        
        # Prepare request data
        data = {
            'contacts': json.dumps(contacts),
            'message': message_text,
            'process_name': process_name,
            'file_sequence': '[]'
        }
        
        # Prepare files for upload
        files = []
        for file_path in file_paths:
            if os.path.exists(file_path):
                files.append(('files', open(file_path, 'rb')))
            else:
                logging.warning(f"File not found: {file_path}")
        
        # Send request
        response = requests.post(
            f"{client.base_url}/send-bulk",
            data=data,
            files=files,
            timeout=client.timeout * len(contacts)  # Longer timeout for bulk
        )
        
        # Close file handles
        for _, file_handle in files:
            file_handle.close()
        
        if response.status_code == 200:
            result = response.json()
            logging.info(f"Bulk WhatsApp messages processed: {result.get('successful', 0)}/{result.get('total_processed', 0)} successful")
            return result.get('results', [])
        else:
            logging.error(f"Error sending bulk WhatsApp messages: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        logging.error(f"Error sending bulk WhatsApp messages: {str(e)}")
        return []

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
WHATSAPP_NODE_SERVICE_URL = os.getenv('WHATSAPP_NODE_SERVICE_URL', 'http://localhost:3001')

# Initialize client
whatsapp_client = WhatsAppNodeClient(WHATSAPP_NODE_SERVICE_URL)