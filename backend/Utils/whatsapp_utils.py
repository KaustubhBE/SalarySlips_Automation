import time
import pyautogui
import pandas as pd
import pyperclip

def get_employee_contact(employee_name, contact_employees):
    if not isinstance(contact_employees, list):
        print("Error: contact_employees is not a list of dictionaries.")
        return ""
    for record in contact_employees:
        if isinstance(record, dict) and record.get("Name") == employee_name:
            return str(record.get("Contact No.", ""))
    return ""

def open_whatsapp():
    pyautogui.press('win')  # Open a new browser window
    time.sleep(2)
    pyautogui.typewrite("whatsapp")
    time.sleep(1)
    pyautogui.press('enter')
    time.sleep(5)  # Wait for WhatsApp Web to load

def send_whatsapp_message(contact_name, message, file_path, whatsapp_number):
    try:
        # Ensure whatsapp_number is a string
        str_whatsapp_number = pd.Series(whatsapp_number)
        whatsapp_number_str = str_whatsapp_number.to_string(index=False).strip()

        open_whatsapp()

        if not whatsapp_number:
            print(f"Phone number not found for {contact_name}.")
            return

        # Interact with WhatsApp Web using pyautogui
        pyautogui.hotkey('ctrl', 'n')  # Shortcut for new chat
        time.sleep(1)
        pyautogui.hotkey('ctrl', 'a')  
        time.sleep(1)
        pyautogui.typewrite(whatsapp_number_str)  # Type the contact number
        time.sleep(1)
        pyautogui.press('enter')
        time.sleep(1)
        pyautogui.press('tab')
        time.sleep(0.5)
        pyautogui.press('tab')
        time.sleep(0.5)
        pyautogui.press('enter')  # Open the chat
        time.sleep(1)

        for line in message:
            pyautogui.typewrite(line)
            time.sleep(1)
            pyautogui.hotkey('shift', 'enter')
            time.sleep(1)
        pyautogui.press('enter')
        time.sleep(1)

        # Attach the file
        pyautogui.hotkey('shift', 'tab')  # Shortcut for attachments
        time.sleep(1)
        pyautogui.press('enter')
        time.sleep(0.5)
        pyautogui.press('down')
        time.sleep(0.5)
        pyautogui.press('down')  # Navigate to "Document"
        time.sleep(0.5)
        pyautogui.press('enter')
        time.sleep(2)

        # Copy the file path to the clipboard and paste it
        pyperclip.copy(file_path)
        pyautogui.hotkey('ctrl', 'v')
        time.sleep(3)
        pyautogui.press('enter')
        time.sleep(1)
        pyautogui.press('enter')
        time.sleep(1)

        print(f"Sent salary slip to {contact_name} ({whatsapp_number_str}) via WhatsApp.")
    except Exception as e:
        print(f"Error sending WhatsApp message to {contact_name}: {e}")