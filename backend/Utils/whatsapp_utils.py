import os
import logging

def get_employee_contact(employee_name, contact_employees):
    """Get employee contact number from contact data."""
    if not isinstance(contact_employees, list):
        logging.error("Error: contact_employees is not a list of dictionaries.")
        return ""
    for record in contact_employees:
        if isinstance(record, dict) and record.get("Name") == employee_name:
            return str(record.get("Contact No.", ""))
    return ""

def send_whatsapp_message(contact_name, message, file_path, whatsapp_number):
    """
    Send WhatsApp message - logs message in production, sends via GUI in development
    """
    # Check if running in Docker/production
    if os.environ.get('RENDER') or not os.environ.get('DISPLAY'):
        logging.info(f"WhatsApp Message would be sent to {contact_name} ({whatsapp_number})")
        logging.info(f"Message content: {message}")
        logging.info(f"File to be sent: {file_path}")
        return True
    
    # If running locally, use the original pyautogui implementation
    try:
        import pyautogui
        import time
        import pyperclip
        import pandas as pd

        # Ensure whatsapp_number is a string
        str_whatsapp_number = pd.Series(whatsapp_number)
        whatsapp_number_str = str_whatsapp_number.to_string(index=False).strip()

        # Open WhatsApp
        pyautogui.press('win')
        time.sleep(2)
        pyautogui.typewrite("whatsapp")
        time.sleep(1)
        pyautogui.press('enter')
        time.sleep(5)

        if not whatsapp_number:
            logging.error(f"Phone number not found for {contact_name}.")
            return False

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

        for line in message:
            pyautogui.typewrite(line)
            time.sleep(1)
            pyautogui.hotkey('shift', 'enter')
            time.sleep(1)
        pyautogui.press('enter')
        time.sleep(1)

        # Attach file
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

        logging.info(f"Sent salary slip to {contact_name} ({whatsapp_number_str}) via WhatsApp.")
        return True

    except ImportError:
        logging.warning("PyAutoGUI not available - WhatsApp message logged only")
        return True
    except Exception as e:
        logging.error(f"Error sending WhatsApp message to {contact_name}: {e}")
        return False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)