import os
import logging
import pandas as pd
import time
import pyautogui
import pyperclip
from pywinauto.application import Application
from pywinauto.keyboard import send_keys
from pywinauto.findwindows import find_windows
import re
import sys

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temporary folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# Now define image lists after resource_path is available
new_chat_images = [
    # resource_path('Utils/images/new_chat.png'),  # Original image
    # resource_path('Utils/images/new_chat2.jpg'),
    # resource_path('Utils/images/new_chat3.jpg'),
    # resource_path('Utils/images/new_chat4.jpg'),
    # resource_path('Utils/images/fullscreen_newchat.png'),  # Full screen version
    # resource_path('Utils/images/halfscreen_newchat.png')  # Half screen version
    'Utils/images/new_chat.png', 
    'Utils/images/new_chat2.jpg',
    'Utils/images/new_chat3.jpg',
    'Utils/images/new_chat4.jpg',
    'Utils/images/fullscreen_newchat.png',
    'Utils/images/halfscreen_newchat.png'
]

contact_not_found_images = [
    # resource_path('Utils/images/contact_not_found.png'),
    # resource_path('Utils/images/contact_not_found_2.jpg'),
    # resource_path('Utils/images/contact_not_found_3.jpg'),
    # resource_path('Utils/images/contact_not_found_4.png')
    'Utils/images/contact_not_found.png',
    'Utils/images/contact_not_found_2.jpg',
    'Utils/images/contact_not_found_3.jpg'

]

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

def open_whatsapp():
    """Open WhatsApp using PyAutoGUI."""
    try:
        # Press Windows key
        pyautogui.press('win')
        time.sleep(2)
        
        # Type WhatsApp
        pyautogui.typewrite("whatsapp")
        time.sleep(1)
        
        # Press Enter to launch
        pyautogui.press('enter')
        time.sleep(5)  # Wait for WhatsApp to open
        
        logging.info("WhatsApp opened successfully")
        return True
    except Exception as e:
        logging.error(f"Error opening WhatsApp: {str(e)}")
        return False

def send_message_for_salaryslip_or_report(message, process_name):
    try:
        if process_name == "salary_slip":
            for line in message:
                pyautogui.typewrite(line)
                time.sleep(1)
                pyautogui.hotkey('shift', 'enter')
        elif process_name == "report": 
            # Use pyperclip to handle multi-line messages
            pyperclip.copy(message)
            pyautogui.hotkey('ctrl', 'v')
            time.sleep(1)
            pyautogui.press('enter')
            
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}")
        raise

def send_files(file_path):
    logging.info(f"Attaching file: {file_path}")
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
    time.sleep(3)
    pyautogui.press('enter')
    time.sleep(3)  

def prepare_file_paths(file_paths, temp_dir=None, is_upload=False):
    
    try:
        # Initialize empty list if no file paths provided
        if not file_paths:
            return []
            
        # Convert single path to list if it's not already
        if not isinstance(file_paths, list):
            file_paths = [file_paths]
            
        # Validate each path and collect valid ones
        valid_paths = []
        seen_filenames = set()  # Keep track of filenames we've already processed
        
        for path in file_paths:
            if is_upload:
                # Handle uploaded file
                if hasattr(path, 'filename') and path.filename:
                    temp_path = os.path.join(temp_dir, path.filename)
                    path.save(temp_path)
                    valid_paths.append(temp_path)
                    seen_filenames.add(path.filename)
                    logging.info(f"Saved attachment file to: {temp_path}")
            else:
                # Handle existing file path
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
    
def find_ui_element(images, confidence=0.9, region=None, max_attempts=3):
    try:
        # Get screen resolution
        screen_width, screen_height = pyautogui.size()
        aspect_ratio = screen_width / screen_height
        search_regions = [
            None,  # Full screen
            (0, 0, screen_width // 2, screen_height),  # Left half
            (screen_width // 2, 0, screen_width // 2, screen_height),  # Right half
            (0, 0, screen_width, screen_height // 2),  # Top half
            (0, screen_height // 2, screen_width, screen_height // 2)  # Bottom half
        ]
        confidence_levels = [confidence, confidence - 0.1, confidence - 0.2]
        for attempt in range(max_attempts):
            for current_confidence in confidence_levels:
                if current_confidence < 0.5:
                    continue
                for search_region in search_regions:
                    for image_path in images:
                        if not os.path.exists(image_path):
                            logging.error(f"Image not found at: {image_path}")
                            continue
                        try:
                            location = pyautogui.locateOnScreen(
                                image_path,
                                confidence=current_confidence,
                                region=search_region
                            )
                            if location:
                                logging.info(f"Found image at: {image_path}")
                                return (
                                    location.left + location.width // 2,
                                    location.top + location.height // 2
                                )
                        except Exception as e:
                            logging.debug(f"Failed to find {image_path} in region {search_region}: {str(e)}")
                            continue
            time.sleep(1)
        return None
    except Exception as e:
        logging.error(f"Error in find_ui_element: {str(e)}")
        return None

def first_chat_or_regular(message, process_name):
    try:
        # Use the new robust element finding function
        new_chat_location = find_ui_element(new_chat_images)
        if new_chat_location:
            logging.info("New chat detected, performing navigation.")
            if process_name == "salary_slip":
                send_message_for_salaryslip_or_report(message, process_name)
            time.sleep(1)
            pyautogui.hotkey('shift', 'tab')
            time.sleep(1)
            pyautogui.hotkey('shift', 'tab')
            time.sleep(1)
            pyautogui.hotkey('shift', 'tab')
            time.sleep(1)
        else:
            logging.info("Regular chat detected.")
            if process_name == "salary_slip":
                send_message_for_salaryslip_or_report(message, process_name)
            time.sleep(1)
            pyautogui.hotkey('shift', 'tab')
            time.sleep(1)
    except Exception as e:
        logging.error(f"Error in first_chat_or_regular: {str(e)}")
        raise

def send_whatsapp_message(contact_name, message, file_paths, file_sequence, whatsapp_number, process_name):
    try:
        # Check if running in Docker/production
        if os.environ.get('RENDER') or not os.environ.get('DISPLAY'):
            logging.info(f"WhatsApp Message would be sent to {contact_name} ({whatsapp_number})")
            try:
                str_whatsapp_number = pd.Series(whatsapp_number)
                whatsapp_number_str = str_whatsapp_number.to_string(index=False).strip()
                if not whatsapp_number_str:
                    logging.error(f"Phone number not found for {contact_name}.")
                    return False
                if process_name == "report":
                    if not re.match(r'^\d+\s+\d+$', whatsapp_number_str):
                        raise ValueError("Invalid WhatsApp number format. Expected format: 'country_code phone_number'")
                logging.info(f"Starting WhatsApp Web interaction for {contact_name}")
                pyautogui.hotkey('ctrl', 'n')
                time.sleep(1)
                pyautogui.hotkey('ctrl', 'a')
                time.sleep(1)
                pyautogui.typewrite(whatsapp_number_str)
                time.sleep(2)
                pyautogui.press('enter')
                time.sleep(1)
                # Check for contact not found
                try:
                    contact_not_found = find_ui_element(contact_not_found_images)
                    if contact_not_found:
                        logging.warning(f"Contact not found for {contact_name} ({whatsapp_number_str})")
                        pyautogui.press('enter')
                        time.sleep(1)
                        return False
                except pyautogui.ImageNotFoundException:
                    pass
                except Exception as e:
                    logging.error(f"Error checking for contact not found: {str(e)}")
                    return False
                pyautogui.press('tab')
                time.sleep(0.5)
                pyautogui.press('tab')
                time.sleep(0.5)
                pyautogui.press('enter')
                time.sleep(2)
                valid_file_paths = prepare_file_paths(file_paths)

                # Create a mapping for quick lookup of file paths by filename
                filename_to_path_map = {os.path.basename(p): p for p in valid_file_paths}

                if process_name == "salary_slip":
                    if not valid_file_paths:
                        send_message_for_salaryslip_or_report(message, process_name)
                    elif valid_file_paths:
                        send_message_for_salaryslip_or_report(message, process_name)
                        send_files(valid_file_paths)
                elif process_name == "report":
                    # Sort items by sequence number to ensure correct order
                    sorted_items = sorted(file_sequence, key=lambda x: x['sequence_no'])
                    
                    for item in sorted_items:
                        try:
                            if item['file_type'] == "message":
                                # Send message first
                                send_message_for_salaryslip_or_report(message, process_name)
                                # Add delay after sending message
                                time.sleep(2)
                            elif item['file_type'] == "file":
                                # Get the full file path from the mapping using the filename
                                file_path = filename_to_path_map.get(item['file_name'])
                                if file_path:
                                    # Send message before file
                                    first_chat_or_regular(message, process_name)
                                   
                                    # Send the file
                                    send_files(file_path)
                                    pyautogui.press('tab')
                                    time.sleep(1)
                                    
                        except Exception as e:
                            logging.error(f"Error processing item {item['file_name']}: {str(e)}")
                            continue
                    
                logging.info(f"Successfully sent message to {contact_name} ({whatsapp_number_str}) via WhatsApp with {len(valid_file_paths)} attachments.")
                return True
            except ImportError:
                logging.warning("PyAutoGUI not available - WhatsApp message logged only")
                return True
            except Exception as e:
                logging.error(f"Error sending WhatsApp message to {contact_name}: {str(e)}")
                return False
        return True   
    except Exception as e:
        logging.error(f"Unexpected error in send_whatsapp_message: {str(e)}")
        return False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
