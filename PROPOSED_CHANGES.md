# Proposed Changes for Factory-Specific Purchase Indent Components

## Overview
This document lists all backend and frontend configurations that need to be updated in GB, OM, PV, and NP PurchaseIndent components to match the KR_PurchaseIndent.jsx implementation.

---

## 1. Frontend Changes Required

### 1.1 Variable Naming (All Files)
**Issue**: Using factory-specific variable name `kerurPlant` instead of generic name.

**Changes Needed**:
- Replace all instances of `kerurPlant` with `currentPlant` or `plantConfig`
- **Files affected**: GB_PurchaseIndent.jsx, OM_PurchaseIndent.jsx, PV_PurchaseIndent.jsx, NP_PurchaseIndent.jsx
- **Total instances per file**: ~8-10 occurrences

**Example**:
```javascript
// BEFORE
const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'GB')

// AFTER
const currentPlant = PLANT_DATA.find(plant => plant.document_name === 'GB')
```

---

### 1.2 Factory Identifier Hardcoding (All Files)
**Issue**: Factory code 'KR' is hardcoded in multiple places. Need factory-specific values.

**Changes Needed**:
- Replace `'KR'` with appropriate factory code:
  - GB_PurchaseIndent.jsx → `'GB'`
  - OM_PurchaseIndent.jsx → `'OM'`
  - PV_PurchaseIndent.jsx → `'PV'`
  - NP_PurchaseIndent.jsx → `'NP'`

**Locations**:
1. `fetchMaterialUomFromBackend` function - `department: 'KR'` (line ~499)
2. `useMaterialData` hook - `factory: 'KR'` (line ~541)
3. `fetchAuthorityList` function - `factory: 'KR'` (line ~779)
4. `fetchPartyPlaceData` function - `factory: 'KR'` (line ~845)
5. `fetchRecipientsList` function - `factory: 'KR'` (line ~883)
6. `handleGenerateOrderId` function - `factory: 'KR'` (line ~909)
7. `handleSendNotifications` function - `factory: 'KR'` (line ~1717)
8. `handleSubmit` function - `factory: 'KR'` (line ~1837, ~1920)

**Total instances per file**: ~8-10

---

### 1.3 Fallback Order ID Generation (All Files)
**Issue**: `generateFallbackOrderId` function hardcodes `KR_` prefix.

**Changes Needed**:
- Update function to accept factory parameter or use factory-specific prefix
- GB → `GB_`
- OM → `OM_`
- PV → `PV_`
- NP → `NP_`

**Location**: Line ~129-135

**Example**:
```javascript
// BEFORE
return `KR_${month.toString().padStart(2, '0')}${year.toString().padStart(2, '0')}-${(timestamp % 10000).toString().padStart(4, '0')}`

// AFTER (for GB)
return `GB_${month.toString().padStart(2, '0')}${year.toString().padStart(2, '0')}-${(timestamp % 10000).toString().padStart(4, '0')}`
```

---

### 1.4 localStorage Keys (All Files)
**Issue**: Session management uses factory-specific localStorage keys.

**Changes Needed**:
- Replace `'kr_active_sessions'` with factory-specific keys:
  - GB → `'gb_active_sessions'`
  - OM → `'om_active_sessions'`
  - PV → `'pv_active_sessions'`
  - NP → `'np_active_sessions'`

- Replace `'kr_completed_orders'` with factory-specific keys:
  - GB → `'gb_completed_orders'`
  - OM → `'om_completed_orders'`
  - PV → `'pv_completed_orders'`
  - NP → `'np_completed_orders'`

**Locations**:
- `useSessionManagement` hook:
  - `registerSession` function (line ~569, ~574)
  - `cleanupSession` function (line ~582, ~584)
  - `cleanupOldSessions` function (line ~592, ~601)
- `handleSubmit` function (line ~1845, ~1858)

**Total instances per file**: ~6

---

### 1.5 Back Button Routes (All Files)
**Issue**: All back button routes incorrectly use `/kerur/` prefix.

**Changes Needed**:
- GB_PurchaseIndent.jsx: `/kerur/gb_store` → `/gulbarga/gb_store`
- OM_PurchaseIndent.jsx: `/kerur/om_store` → `/omkar/om_store`
- PV_PurchaseIndent.jsx: `/kerur/pv_store` → `/padmavati/pv_store`
- NP_PurchaseIndent.jsx: `/kerur/np_store` → `/newplant/np_store`

**Location**: Line ~2337-2339

---

### 1.6 RecipentsList Sheet Name Configuration
**Issue**: Some factories may not have `RecipentsList` in their sheet_name config.

**Changes Needed**:
- Check if `RecipentsList` exists in `currentPlant.sheet_name`
- Use fallback to `'Recipents List'` if not found
- **Files affected**: All PurchaseIndent files

**Location**: Lines ~884, ~1720, ~1921

**Example**:
```javascript
// BEFORE
sheetName: 'Recipents List'

// AFTER
sheetName: typeof currentPlant?.sheet_name === 'object'
  ? currentPlant?.sheet_name?.RecipentsList || 'Recipents List'
  : 'Recipents List'
```

---

### 1.7 Document Name Lookup (All Files)
**Issue**: Using hardcoded `'KR'` in `PLANT_DATA.find()` calls.

**Changes Needed**:
- Replace `plant.document_name === 'KR'` with appropriate factory code
- **Total instances per file**: ~8-10

---

## 2. Backend Configuration Status

### 2.1 PLANT_DATA Configuration ✅
**Status**: Already configured correctly in `backend/app.py`

All factories (KR, GB, OM, PV, NP) are already present in `PLANT_DATA` with:
- `material_sheet_id` (with correct Google Drive IDs from user's memory)
- `document_name`
- `sheet_name` configuration

**No changes needed** in backend PLANT_DATA.

---

### 2.2 API Endpoints ✅
**Status**: Already factory-agnostic

All API endpoints already accept `factory` parameter:
- `/api/get_material_data` - accepts `factory` param
- `/api/get_authority_list` - accepts `factory` param
- `/api/get_party_place_data` - accepts `factory` param
- `/api/get_recipients_list` - accepts `factory` param
- `/api/get_material_details` - accepts `department` param (maps to factory)
- `/api/get_next_order_id` - accepts `factory` param
- `/api/submit_order` - accepts `factory` in request body
- `/api/send_order_notification` - accepts `factory` in request body

**No changes needed** in backend API endpoints.

---

### 2.3 Helper Functions ✅
**Status**: Already factory-agnostic

Backend helper functions already handle multiple factories:
- `_get_plant_config(factory_identifier)` - works with any factory
- `_get_material_sheet_id(factory_identifier)` - works with any factory
- `_get_material_sheet_name(sheet_id)` - works with any factory
- `get_factory_initials(factory_name)` - has mapping for all factories

**No changes needed** in backend helper functions.

---

## 3. Summary of Changes

### Files to Modify:
1. `frontend/src/GB_Departments/GB_Services/GB_PurchaseIndent.jsx`
2. `frontend/src/OM_Departments/OM_Services/OM_PurchaseIndent.jsx`
3. `frontend/src/PV_Departments/PV_Services/PV_PurchaseIndent.jsx`
4. `frontend/src/NP_Departments/NP_Services/NP_PurchaseIndent.jsx`

### Total Changes Per File:
- Variable renaming: ~8-10 instances (`kerurPlant` → `currentPlant`)
- Factory identifier: ~8-10 instances (`'KR'` → factory code)
- Fallback Order ID: 1 instance (prefix change)
- localStorage keys: ~6 instances (2 keys × 3 functions)
- Back button route: 1 instance
- RecipentsList handling: ~3 instances
- Document name lookup: ~8-10 instances

**Estimated total changes per file: ~35-40 instances**

---

## 4. Implementation Strategy

### Phase 1: Variable Renaming
1. Replace `kerurPlant` with `currentPlant` throughout each file
2. Update all references to use `currentPlant`

### Phase 2: Factory Identifier Updates
1. Replace all `'KR'` with appropriate factory code
2. Update `PLANT_DATA.find(plant => plant.document_name === 'KR')` calls

### Phase 3: Function-Specific Updates
1. Update `generateFallbackOrderId` function
2. Update `useSessionManagement` hook (localStorage keys)
3. Update all API call payloads (factory parameter)
4. Update back button route

### Phase 4: Configuration Handling
1. Update RecipentsList sheet name handling
2. Ensure proper fallbacks for missing configurations

---

## 5. Testing Checklist

After implementation, verify:
- [ ] Material data loads correctly
- [ ] Authority list loads correctly
- [ ] Party/Place data loads correctly
- [ ] Recipients list loads correctly (if applicable)
- [ ] Order ID generation works
- [ ] Order submission works
- [ ] Notifications work (if RecipentsList exists)
- [ ] Back button navigates correctly
- [ ] Session management works (localStorage)
- [ ] Fallback Order ID format is correct

---

## 6. Notes

1. **RecipentsList**: Not all factories may have this sheet. Ensure proper fallback handling.
2. **Back Button Routes**: Verify correct routes exist in routing configuration.
3. **localStorage Keys**: Factory-specific keys prevent session conflicts between factories.
4. **Google Drive Sheet IDs**: Already provided by user:
   - KR: `1IcgUtCOah9Vi5Z3lI4wxhXoXSTQTWvYkXhSxHt7-5oc` (from memory)
   - GB: `1EkjLEEMeZTJoMVDpmtxBVQ_LY_5u99J76PPMwodvD5Y` (from memory)
   - NP: `1cj6q7YfIfAHPO4GDHTQldF0XthpD1p6lLrnBPDx2jsw` (from memory)
   - OM: `15MSsB7qXCyKWHvdJtUJuivlgy6khA2dCXxNXuY-sowg` (from memory)
   - PV: `1or2svgyGemGxTpb2SG5z7XLYnXgIbZ1gzogKZaAUixE` (from memory)

---

## Approval Required

Please review this proposal and approve if you want me to proceed with the implementation.

