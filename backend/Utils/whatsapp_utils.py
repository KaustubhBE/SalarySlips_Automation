# whatsapp_utils_node.py - Python client for Node.js WhatsApp service
import requests
import logging
import os
import json
from typing import List, Dict, Optional, Union

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
            response = requests.get(f"{self.base_url}/health", timeout=self.timeout)
            if response.status_code == 200:
                data = response.json()
                return data.get('whatsappReady', False)
            return False
        except Exception as e:
            logging.error(f"Error checking WhatsApp service health: {e}")
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
                         process_name: str = "salary_slip") -> bool:
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
        
        # Prepare request data
        data = {
            'contact_name': contact_name,
            'message': message_text,
            'whatsapp_number': whatsapp_number,
            'process_name': process_name,
            'file_sequence': json.dumps(file_sequence) if file_sequence else '[]'
        }
        
        # Prepare files for upload
        files = []
        if file_paths:
            for file_path in file_paths:
                if os.path.exists(file_path):
                    files.append(('files', open(file_path, 'rb')))
                else:
                    logging.warning(f"File not found: {file_path}")
        
        # Send request
        response = requests.post(
            f"{client.base_url}/send-message",
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
            logging.info(f"WhatsApp message {'sent successfully' if success else 'failed'} to {contact_name}")
            return success
        else:
            logging.error(f"Error sending WhatsApp message: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending WhatsApp message to {contact_name}: {str(e)}")
        return False

def get_whatsapp_status() -> Dict:
    """Public helper to get WhatsApp status for Flask route"""
    client = whatsapp_client
    return client.get_status()

def get_whatsapp_qr() -> Dict:
    """Public helper to get QR for Flask route"""
    client = whatsapp_client
    return client.get_qr()

def trigger_whatsapp_login() -> Dict:
    """Public helper to trigger login and get QR for Flask route"""
    client = whatsapp_client
    return client.trigger_login()

def logout_whatsapp() -> bool:
    """Public helper to logout WhatsApp session for Flask route"""
    client = whatsapp_client
    return client.logout()

def handle_whatsapp_notification(contact_name: str, full_month: str, full_year: str, 
                                whatsapp_number: str, file_path: Union[str, List[str]], 
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
        # Prepare file paths
        if isinstance(file_path, str):
            file_paths = [file_path]
        else:
            file_paths = file_path or []
        
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
            if os.path.exists(file_path_item):
                files.append(('files', open(file_path_item, 'rb')))
            else:
                logging.warning(f"File not found: {file_path_item}")
        
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

def send_bulk_whatsapp_messages(contacts: List[Dict], message: Union[str, List[str]], 
                               file_paths: List[str] = None, 
                               process_name: str = "salary_slip") -> List[Dict]:
    """
    Send bulk WhatsApp messages - new function for batch processing
    """
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
        
        for path in file_paths:
            if is_upload:
                if hasattr(path, 'filename') and path.filename:
                    temp_path = os.path.join(temp_dir, path.filename)
                    path.save(temp_path)
                    valid_paths.append(temp_path)
                    seen_filenames.add(path.filename)
                    logging.info(f"Saved attachment file to: {temp_path}")
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

# Example usage and testing
if __name__ == "__main__":
    # Test the service
    print("Testing WhatsApp Node.js service...")
    
    if whatsapp_client.check_service_health():
        print("✓ WhatsApp service is ready")
        
        # Test sending a message
        success = send_whatsapp_message(
            contact_name="Test User",
            message="This is a test message from Python!",
            whatsapp_number="1234567890",
            process_name="salary_slip"
        )
        print(f"Test message sent: {success}")
    else:
        print("✗ WhatsApp service is not ready. Please start the Node.js service first.")
        print("Run: node whatsapp-service.js")