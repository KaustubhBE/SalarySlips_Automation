import os
import logging
import pandas as pd

def get_employee_contact(employee_name, contact_employees):
    """Get employee contact number from contact data."""
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

def send_whatsapp_message(contact_name, message, file_path, whatsapp_number):
    """
    Send WhatsApp message - logs message in production, sends via GUI in development
    """
    try:
        # Verify file exists if provided
        if file_path and not os.path.exists(file_path):
            logging.error(f"File not found: {file_path}")
            return False

        # Check if running in Docker/production
        if os.environ.get('RENDER') or not os.environ.get('DISPLAY'):
            logging.info(f"WhatsApp Message would be sent to {contact_name} ({whatsapp_number})")
            logging.info(f"Message content: {message}")
            if file_path:
                logging.info(f"File to be sent: {file_path}")
                logging.info(f"File size: {os.path.getsize(file_path)} bytes")
            return True
        
        # If running locally, use the original pyautogui implementation
        try:
            import pyautogui
            import time
            import pyperclip

            # Ensure whatsapp_number is a string
            str_whatsapp_number = pd.Series(whatsapp_number)
            whatsapp_number_str = str_whatsapp_number.to_string(index=False).strip()
            
            if not whatsapp_number_str:
                logging.error(f"Phone number not found for {contact_name}.")
                return False

            logging.info(f"Starting WhatsApp Web interaction for {contact_name}")
            
            # Open WhatsApp
            pyautogui.press('win')
            time.sleep(2)
            pyautogui.typewrite("whatsapp")
            time.sleep(1)
            pyautogui.press('enter')
            time.sleep(5)

            # Original WhatsApp Web interaction code
            pyautogui.hotkey('ctrl', 'n')
            time.sleep(1)
            pyautogui.hotkey('ctrl', 'a')
            time.sleep(1)
            pyautogui.typewrite(whatsapp_number_str)
            time.sleep(1)
            pyautogui.press('enter')
            time.sleep(1)
            pyautogui.press('tab')
            time.sleep(0.5)
            pyautogui.press('tab')
            time.sleep(0.5)
            pyautogui.press('enter')
            time.sleep(1)

            # Send message
            for line in message:
                pyautogui.typewrite(line)
                time.sleep(1)
                pyautogui.hotkey('shift', 'enter')
                time.sleep(1)
            pyautogui.press('enter')
            time.sleep(1)

            # Attach file if provided
            if file_path:
                logging.info(f"Attaching file: {file_path}")
                pyautogui.hotkey('shift', 'tab')
                time.sleep(1)
                pyautogui.press('enter')
                time.sleep(0.5)
                pyautogui.press('down')
                time.sleep(0.5)
                pyautogui.press('down')
                time.sleep(0.5)
                pyautogui.press('enter')
                time.sleep(2)

                pyperclip.copy(file_path)
                pyautogui.hotkey('ctrl', 'v')
                time.sleep(3)
                pyautogui.press('enter')
                time.sleep(1)
                pyautogui.press('enter')
                time.sleep(1)

            logging.info(f"Successfully sent salary slip to {contact_name} ({whatsapp_number_str}) via WhatsApp.")
            return True

        except ImportError:
            logging.warning("PyAutoGUI not available - WhatsApp message logged only")
            return True
        except Exception as e:
            logging.error(f"Error sending WhatsApp message to {contact_name}: {str(e)}")
            return False
            
    except Exception as e:
        logging.error(f"Unexpected error in send_whatsapp_message: {str(e)}")
        return False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)