"""
Utility functions for writing data to Google Sheets
"""
import gspread
import logging
from datetime import datetime
from Utils.config import creds

def write_order_to_indent_sheet(factory, order_data, logger=None):
    """
    Write order data to the "Indent List" Google Sheet.
    
    Args:
        factory: Factory identifier (e.g., 'KR', 'GB', 'NP', etc.)
        order_data: Dictionary containing order information with the following structure:
            - orderId: str
            - orderItems: list of dicts, each containing:
                - category: str
                - subCategory: str (optional)
                - materialName: str
                - specifications: str (optional)
                - quantity: str/float
                - uom: str
                - partyName: str (optional, Preferred Vendor)
                - place: str (optional)
            - givenBy: str
            - type: str (Regular/Project)
            - importance: str (Normal/Urgent)
            - date: str (optional, format: DD/MM/YYYY)
            - time: str (optional, format: HH:MM AM/PM)
        logger: Optional logger instance
    
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'rows_written': int
        }
    """
    log = logger if logger else logging
    
    try:
        # Lazy import to avoid circular dependency
        import sys
        if 'app' in sys.modules:
            PLANT_DATA = sys.modules['app'].PLANT_DATA
        else:
            from app import PLANT_DATA
        
        # Find plant configuration
        plant_config = None
        for plant in PLANT_DATA:
            if plant.get("document_name") == factory:
                plant_config = plant
                break
        
        if not plant_config:
            error_msg = f"Plant configuration not found for factory: {factory}"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
        
        # Get sheet ID and sheet name for Indent List
        sheet_id = plant_config.get("material_sheet_id")
        if not sheet_id:
            error_msg = f"No material_sheet_id found for factory: {factory}"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
        
        # Get indent sheet name (default to "Indent List")
        sheet_names = plant_config.get("sheet_name", {})
        indent_sheet_name = sheet_names.get("IndentList", "Indent List")
        
        # Initialize gspread client
        try:
            client = gspread.authorize(creds)
            log.info(f"Successfully authorized gspread client for factory {factory}")
        except Exception as e:
            error_msg = f"Failed to authorize gspread client: {e}"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
        
        # Open the spreadsheet by ID
        try:
            spreadsheet = client.open_by_key(sheet_id)
            log.info(f"Successfully opened spreadsheet: {spreadsheet.title}")
        except Exception as e:
            error_msg = f"Failed to open spreadsheet with ID {sheet_id}: {e}"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
        
        # Get or create the Indent List worksheet
        try:
            worksheet = spreadsheet.worksheet(indent_sheet_name)
            log.info(f"Found '{indent_sheet_name}' worksheet")
        except gspread.WorksheetNotFound:
            # Create the worksheet if it doesn't exist
            try:
                worksheet = spreadsheet.add_worksheet(
                    title=indent_sheet_name,
                    rows=1000,
                    cols=15
                )
                log.info(f"Created new worksheet: '{indent_sheet_name}'")
                
                # Add headers if this is a new sheet
                headers = [
                    'Date', 'Time', 'Order ID', 'Category', 'Sub Category',
                    'Material Name', 'Specifications', 'Quantity', 'UOM',
                    'Preferred Vendor', 'Place', 'Given By', 'Type', 'Importance', 'Description'
                ]
                worksheet.append_row(headers)
                log.info(f"Added headers to new worksheet: '{indent_sheet_name}'")
            except Exception as e:
                error_msg = f"Failed to create worksheet '{indent_sheet_name}': {e}"
                log.error(error_msg)
                return {
                    'success': False,
                    'message': error_msg,
                    'rows_written': 0
                }
        except Exception as e:
            error_msg = f"Error accessing worksheet '{indent_sheet_name}': {e}"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
        
        # Get current date and time if not provided
        if order_data.get('date'):
            # Parse the provided date string and convert to YYYY-MM-DD format
            date_str = order_data.get('date')
            try:
                # Try to parse common date formats
                date_formats = ['%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y', '%d/%m/%y', '%Y/%m/%d']
                parsed_date = None
                for fmt in date_formats:
                    try:
                        parsed_date = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                if parsed_date:
                    order_date = parsed_date.strftime('%Y-%m-%d')  # Use YYYY-MM-DD format
                else:
                    # If parsing fails, use as-is (fallback)
                    order_date = date_str
            except Exception as e:
                log.warning(f"Could not parse date '{date_str}', using as-is: {e}")
                order_date = date_str
        else:
            # Generate date in YYYY-MM-DD format (more universally recognized)
            now = datetime.now()
            order_date = now.strftime('%Y-%m-%d')
        
        if order_data.get('time'):
            order_time = order_data.get('time')
        else:
            # Generate time in HH:MM AM/PM format
            now = datetime.now()
            order_time = now.strftime('%I:%M %p')
        
        # Prepare rows to append (one row per order item)
        rows_to_append = []
        order_id = order_data.get('orderId', '')
        given_by = order_data.get('givenBy', '')
        order_type = order_data.get('type', '')
        importance = order_data.get('importance', 'Normal')
        description = order_data.get('description', '')
        
        order_items = order_data.get('orderItems', [])
        if not order_items:
            error_msg = "No order items found in order data"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
        
        # Create one row per order item
        for item in order_items:
            row = [
                order_date,  # Date
                order_time,  # Time
                order_id,  # Order ID
                item.get('category', ''),  # Category
                item.get('subCategory', ''),  # Sub Category
                item.get('materialName', ''),  # Material Name
                item.get('specifications', ''),  # Specifications
                str(item.get('quantity', '')),  # Quantity
                item.get('uom', ''),  # UOM
                item.get('partyName', ''),  # Preferred Vendor
                item.get('place', ''),  # Place
                given_by,  # Given By
                order_type,  # Type
                importance,  # Importance
                description  # Description
            ]
            rows_to_append.append(row)
        
        # Find the next available row and write data
        try:
            # Get all values to find the last row with data
            all_values = worksheet.get_all_values()
            
            # Find the last row with data in the Date column (column index 0)
            # Note: Headers are always on row 2
            last_row_with_data = 0
            for row_idx, row in enumerate(all_values, start=1):
                # Check if Date column (first column) has data
                # Skip row 2 (headers) when looking for data rows
                if len(row) > 0 and row[0].strip() and row_idx != 2:
                    last_row_with_data = row_idx
            
            # Check if headers exist (row 2)
            has_headers = len(all_values) >= 2 and len(all_values[1]) > 0
            
            # Calculate the next available row
            if last_row_with_data == 0:
                # No data rows found (only headers on row 2 exist)
                # Start from row 3 (right after headers on row 2, no blank row)
                if has_headers:
                    next_row = 3
                else:
                    # No headers, start from row 1
                    next_row = 1
            else:
                # There is existing data beyond row 2 (actual data rows exist)
                # Skip one row to leave a blank separator between different orders
                next_row = last_row_with_data + 2
            
            log.info(f"Next available row for '{indent_sheet_name}': {next_row} (last row with data: {last_row_with_data})")
            
            # Write rows using update() with specific range
            if len(rows_to_append) == 1:
                # Single row - use A{next_row}:O{next_row} range
                range_name = f'A{next_row}:O{next_row}'
                worksheet.update(range_name, [rows_to_append[0]], value_input_option='USER_ENTERED')
            else:
                # Multiple rows - use A{next_row}:O{next_row + len - 1} range
                end_row = next_row + len(rows_to_append) - 1
                range_name = f'A{next_row}:O{end_row}'
                worksheet.update(range_name, rows_to_append, value_input_option='USER_ENTERED')
            
            log.info(f"Successfully wrote {len(rows_to_append)} row(s) to '{indent_sheet_name}' starting at row {next_row} for order {order_id}")
            
            return {
                'success': True,
                'message': f"Successfully wrote {len(rows_to_append)} row(s) to Indent List starting at row {next_row}",
                'rows_written': len(rows_to_append)
            }
            
        except Exception as e:
            error_msg = f"Error writing rows to worksheet: {e}"
            log.error(error_msg)
            return {
                'success': False,
                'message': error_msg,
                'rows_written': 0
            }
    
    except Exception as e:
        error_msg = f"Unexpected error writing order to Indent List: {e}"
        log.error(error_msg, exc_info=True)
        return {
            'success': False,
            'message': error_msg,
            'rows_written': 0
        }

