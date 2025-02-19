import gspread
from Utils.config import creds

def fetch_google_sheet_data(sheet_id, sheet_name):
    try:
        client = gspread.authorize(creds)
        sheet = client.open_by_key(sheet_id).worksheet(sheet_name)
        data = sheet.get_all_values()
        return data
    except Exception as e:
        print(f"Error fetching data from Google Sheets (ID: {sheet_id}, Sheet: {sheet_name}): {e}")
        return None