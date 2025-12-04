# Drive Upload and File Deletion Audit Report

## Summary
This document lists all document generation processes, their current Drive upload status, deletion status, and required changes.

---

## ✅ Already Configured (No Changes Needed)

### 1. **Reactor Reports** (`process_reactor_reports`)
- **Frontend**: `KR_ReactorReports.jsx`
- **Backend Function**: `process_reactor_reports()` in `process_utils.py`
- **Generates Documents**: ✅ YES (DOCX and PDF)
- **Drive Upload**: ✅ YES (configured with base folder: `1cuL5gdl5GncegK2-FItKux7pg-D2sT--`)
- **File Deletion**: ✅ YES (deletes after successful Drive upload)
- **Status**: ✅ Complete

### 2. **Salary Slips** (`process_salary_slip`)
- **Frontend**: `OM_Processing.jsx`, `KR_Processing.jsx`, `HO_Processing.jsx`, `GB_Processing.jsx`, `HB_Processing.jsx`, `PV_Processing.jsx`
- **Backend Function**: `process_salary_slip()` in `process_utils.py`
- **Generates Documents**: ✅ YES (DOCX and PDF)
- **Drive Upload**: ✅ YES (uses employee-specific Drive IDs from Google Sheets)
- **File Deletion**: ✅ YES (deletes after successful Drive upload)
- **Status**: ✅ Complete

---

## ❌ Needs Configuration

### 3. **Place Order** (`process_order_notification`)
- **Frontend**: `KR_PlaceOrder.jsx`
- **Backend Function**: `process_order_notification()` in `process_utils.py` (lines 3138-3671)
- **Generates Documents**: ✅ YES (DOCX and PDF)
  - DOCX: `order_{order_id}_{timestamp}.docx`
  - PDF: `order_{order_id}_{timestamp}.pdf`
- **Drive Upload**: ❌ NO (not implemented)
- **File Deletion**: ⚠️ PARTIAL (only deletes DOCX if PDF created, but PDF is NOT deleted)
  - Current deletion code (lines 3635-3641): Only removes DOCX if PDF was created
  - PDF file remains in `OUTPUT_DIR`
- **Required Changes**:
  1. Add Drive upload functionality before deletion
  2. Add conditional deletion based on Drive upload success
  3. Delete both DOCX and PDF files after successful upload
- **Drive ID Needed**: 
  - **Base Folder ID for Orders**: `[TO_BE_ASSIGNED]`
  - **Organization**: Month-wise folders (e.g., "Aug 25", "Jul 25")
  - **File naming**: `order_{order_id}_{timestamp}.pdf`

---

### 4. **Material Inward** (`process_material_notification`)
- **Frontend**: `KR_MaterialInward.jsx`
- **Backend Function**: `process_material_notification()` in `process_utils.py` (lines 3673-4200)
- **Generates Documents**: ✅ YES (DOCX and PDF)
  - DOCX: `material_inward_{factory}_{timestamp}.docx`
  - PDF: `material_inward_{factory}_{timestamp}.pdf`
- **Drive Upload**: ❌ NO (not implemented)
- **File Deletion**: ⚠️ PARTIAL (only deletes DOCX if PDF created, but PDF is NOT deleted)
  - Current deletion code (lines 4164-4170): Only removes DOCX if PDF was created
  - PDF file remains in `OUTPUT_DIR`
- **Required Changes**:
  1. Add Drive upload functionality before deletion
  2. Add conditional deletion based on Drive upload success
  3. Delete both DOCX and PDF files after successful upload
- **Drive ID Needed**: 
  - **Base Folder ID for Material Inward**: `[TO_BE_ASSIGNED]`
  - **Organization**: Month-wise folders (e.g., "Aug 25", "Jul 25")
  - **File naming**: `material_inward_{factory}_{timestamp}.pdf`

---

### 5. **Material Outward** (`process_material_notification`)
- **Frontend**: `KR_MaterialOutward.jsx`
- **Backend Function**: `process_material_notification()` in `process_utils.py` (same function as Material Inward, lines 3673-4200)
- **Generates Documents**: ✅ YES (DOCX and PDF)
  - DOCX: `material_outward_{factory}_{timestamp}.docx`
  - PDF: `material_outward_{factory}_{timestamp}.pdf`
- **Drive Upload**: ❌ NO (not implemented)
- **File Deletion**: ⚠️ PARTIAL (only deletes DOCX if PDF created, but PDF is NOT deleted)
  - Current deletion code (lines 4164-4170): Only removes DOCX if PDF was created
  - PDF file remains in `OUTPUT_DIR`
- **Required Changes**:
  1. Add Drive upload functionality before deletion
  2. Add conditional deletion based on Drive upload success
  3. Delete both DOCX and PDF files after successful upload
- **Drive ID Needed**: 
  - **Base Folder ID for Material Outward**: `[TO_BE_ASSIGNED]`
  - **Organization**: Month-wise folders (e.g., "Aug 25", "Jul 25")
  - **File naming**: `material_outward_{factory}_{timestamp}.pdf`

---

### 6. **General Reports** (`process_general_reports`)
- **Frontend**: `KR_GeneralReports.jsx`
- **Backend Function**: `process_general_reports()` in `process_utils.py` (lines 2333-2635)
- **Generates Documents**: ❌ NO (only processes templates and sends attachments)
  - This process does NOT generate new documents
  - It processes existing template files and sends them as attachments
  - Only temporary template files are created and cleaned up
- **Drive Upload**: ❌ N/A (no documents to upload)
- **File Deletion**: ✅ YES (cleans up temporary files)
  - Current deletion code (lines 2601-2611): Cleans up temporary template files and user temp directory
- **Required Changes**: ❌ NONE (no documents generated, no Drive upload needed)
- **Status**: ✅ No changes needed

---

## 📋 Required Drive IDs to Assign

Please provide the following Google Drive folder IDs:

1. **Place Order Base Folder ID**: `[TO_BE_ASSIGNED]`
   - Purpose: Store order PDFs organized by month
   - Format: Month-wise folders (e.g., "Aug 25", "Jul 25")
   - Files: `order_{order_id}_{timestamp}.pdf`

2. **Material Inward Base Folder ID**: `[TO_BE_ASSIGNED]`
   - Purpose: Store material inward PDFs organized by month
   - Format: Month-wise folders (e.g., "Aug 25", "Jul 25")
   - Files: `material_inward_{factory}_{timestamp}.pdf`

3. **Material Outward Base Folder ID**: `[TO_BE_ASSIGNED]`
   - Purpose: Store material outward PDFs organized by month
   - Format: Month-wise folders (e.g., "Aug 25", "Jul 25")
   - Files: `material_outward_{factory}_{timestamp}.pdf`

---

## 🔧 Implementation Plan

### Phase 1: Place Order
1. Add Drive upload in `process_order_notification()` after PDF generation (after line 3425)
2. Use `upload_reactor_report_to_drive()` or create similar function for orders
3. Track upload success in result dictionary
4. Add conditional deletion using `delete_generated_files()` after notifications (after line 3653)
5. Delete both DOCX and PDF if upload succeeds

### Phase 2: Material Inward
1. Add Drive upload in `process_material_notification()` after PDF generation (after line 3932)
2. Use month-wise folder organization similar to reactor reports
3. Track upload success in result dictionary
4. Add conditional deletion using `delete_generated_files()` after notifications (after line 4182)
5. Delete both DOCX and PDF if upload succeeds

### Phase 3: Material Outward
1. Same as Material Inward (uses same function)
2. Differentiate by `notification_type` parameter
3. Use different base folder ID for outward vs inward

---

## 📝 Notes

- All Drive uploads should follow the same pattern as reactor reports:
  - Upload to month-wise folders
  - Only delete files if upload succeeds
  - Keep files if upload fails (for retry on next operation)
- The `delete_generated_files()` function already exists and handles conditional deletion based on `drive_upload_success` parameter
- Month folder naming convention: "Aug 25", "Jul 25" (3-letter month + 2-digit year)
- All functions should return upload status in result dictionary for proper tracking

---

## ✅ Verification Checklist

After implementation, verify:
- [ ] Place Order: PDF uploaded to Drive before deletion
- [ ] Place Order: Files deleted only if upload succeeds
- [ ] Material Inward: PDF uploaded to Drive before deletion
- [ ] Material Inward: Files deleted only if upload succeeds
- [ ] Material Outward: PDF uploaded to Drive before deletion
- [ ] Material Outward: Files deleted only if upload succeeds
- [ ] All processes log upload status correctly
- [ ] All processes handle upload failures gracefully

