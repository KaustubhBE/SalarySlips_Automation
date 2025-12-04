# Hierarchical Drive Upload Implementation Summary

## ✅ Completed Changes

### 1. **PLANT_DATA Configuration** (`backend/app.py`)
- ✅ Fixed syntax error (missing comma after `kerur_reports_drive_id`)
- ✅ Added `store_drive_id` for all plants:
  - `kerur_store_drive_id`: "1Mc8-s9hVg4QM6IQCHU30bnzddYO4f4jr" (configured)
  - `gulbarga_store_drive_id`: "[TO_BE_ASSIGNED]"
  - `humnabad_store_drive_id`: "[TO_BE_ASSIGNED]"
  - `omkar_store_drive_id`: "[TO_BE_ASSIGNED]"
  - `padmavati_store_drive_id`: "[TO_BE_ASSIGNED]"
  - `head_office_store_drive_id`: "[TO_BE_ASSIGNED]"

### 2. **New Helper Functions** (`backend/Utils/drive_utils.py`)
- ✅ `get_financial_year_from_date()`: Calculates financial year from date string
- ✅ `get_month_sequence_and_name()`: Gets month sequence (1-12) and formatted name
- ✅ `get_process_folder_name()`: Maps process type to folder name
- ✅ `get_or_create_hierarchical_folders()`: Creates folder hierarchy
- ✅ `upload_store_document_to_drive()`: Main upload function for store processes

### 3. **Updated Process Functions** (`backend/Utils/process_utils.py`)

#### A. `process_order_notification()` (Place Order)
- ✅ Added Drive upload before notifications
- ✅ Uses hierarchical folder structure: `{Base Drive}/{FY}/{Month}/{1. Indents}/{PDF}`
- ✅ Tracks upload status in result dictionary
- ✅ Added conditional deletion after notifications (only if upload succeeds)
- ✅ Deletes both DOCX and PDF files

#### B. `process_material_notification()` (Material Inward/Outward)
- ✅ Added Drive upload before notifications
- ✅ Uses hierarchical folder structure:
  - Inward: `{Base Drive}/{FY}/{Month}/{2. Material Inward}/{PDF}`
  - Outward: `{Base Drive}/{FY}/{Month}/{3. Material Outward}/{PDF}`
- ✅ Tracks upload status in result dictionary
- ✅ Added conditional deletion after notifications (only if upload succeeds)
- ✅ Deletes both DOCX and PDF files

## 📁 Folder Structure Created

```
{Base Drive ID (e.g., "KR Store")}
  └── {Financial Year (e.g., "2024 - 2025")}
      └── {Month Sequence. Month YY (e.g., "4. Jul 24")}
          ├── 1. Indents
          │   └── order_{order_id}_{timestamp}.pdf
          ├── 2. Material Inward
          │   └── material_inward_{factory}_{timestamp}.pdf
          └── 3. Material Outward
              └── material_outward_{factory}_{timestamp}.pdf
```

## 🔧 How It Works

1. **Date Parsing**: Extracts date from `dateTime` field in order/material data
2. **Financial Year Calculation**: Determines FY based on month (April = start of FY)
3. **Month Sequence**: Calculates sequence 1-12 (April=1, May=2, ..., March=12)
4. **Folder Creation**: Automatically creates/gets folders in hierarchy
5. **File Upload**: Uploads PDF to final process folder
6. **Conditional Deletion**: Only deletes files if Drive upload succeeded

## ⚙️ Configuration Required

Please update the following Drive IDs in `backend/app.py` PLANT_DATA:

1. **Gulbarga Store Drive ID**: Replace `"[TO_BE_ASSIGNED]"` with actual Drive ID
2. **Humnabad Store Drive ID**: Replace `"[TO_BE_ASSIGNED]"` with actual Drive ID
3. **Omkar Store Drive ID**: Replace `"[TO_BE_ASSIGNED]"` with actual Drive ID
4. **Padmavati Store Drive ID**: Replace `"[TO_BE_ASSIGNED]"` with actual Drive ID
5. **Head Office Store Drive ID**: Replace `"[TO_BE_ASSIGNED]"` with actual Drive ID

## 📝 Notes

- **Reactor Reports**: Still uses hardcoded Drive ID (as requested, only 3 processes were updated)
- **Salary Slips**: Unchanged (already working with employee-specific Drive IDs)
- **General Reports**: No changes needed (doesn't generate documents)
- All Drive uploads are logged for debugging
- Files are kept if upload fails (for retry on next operation)
- Month folder format: `"{sequence}. {MonthAbbr} {YY}"` (e.g., "4. Jul 24")

## ✅ Testing Checklist

After assigning Drive IDs, test:
- [ ] Place Order: PDF uploads to correct folder structure
- [ ] Place Order: Files deleted only if upload succeeds
- [ ] Material Inward: PDF uploads to correct folder structure
- [ ] Material Inward: Files deleted only if upload succeeds
- [ ] Material Outward: PDF uploads to correct folder structure
- [ ] Material Outward: Files deleted only if upload succeeds
- [ ] Verify month folders are created correctly
- [ ] Verify process folders (1. Indents, 2. Material Inward, 3. Material Outward) are created
- [ ] Verify files are kept if upload fails

