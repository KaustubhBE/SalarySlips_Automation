import React, { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import Select from 'react-select'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../PlaceOrder.css'
import LoadingSpinner from '../../LoadingSpinner'
import BackButton from '../../Components/BackButton'
import FormValidationErrors from '../../Components/FormValidationErrors'
import NotificationSummaryModal from '../../Components/NotificationSummaryModal'
import DateTimePicker from '../../Components/DateTimePicker'

// Constants
const IMPORTANCE_OPTIONS = ['Normal', 'Urgent']
const TYPE_OPTIONS = ['Regular', 'Project']
const LONG_PRESS_DURATION = 500 // 500ms for long press
const TOUCH_MOVE_THRESHOLD = 10 // pixels
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

// Shared select helpers (react-select) to match existing styling
const createSelectOptions = (values = []) =>
  values
    .filter(Boolean)
    .map((val) => (typeof val === 'string' ? { value: val, label: val } : val))

const poSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 45,
    height: 45,
    borderWidth: 2,
    borderColor: state.isFocused ? '#3498db' : '#ddd',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(52, 152, 219, 0.1)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#3498db' : '#ccc'
    }
  }),
  placeholder: (base) => ({
    ...base,
    color: '#777',
    fontSize: 14
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: 14,
    color: '#333'
  }),
  input: (base) => ({
    ...base,
    fontSize: 14
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 14,
    backgroundColor: state.isSelected ? '#3498db' : state.isFocused ? '#f2f7fd' : 'white',
    color: state.isSelected ? '#fff' : '#333'
  }),
  menu: (base) => ({
    ...base,
    zIndex: 20
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 10010 // Higher than items sheet overlay (10000) to ensure dropdowns work in mobile modal
  }),
  indicatorSeparator: () => ({
    display: 'none'
  })
}

const SearchableSelect = ({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  isDisabled = false,
  isLoading = false,
  isClearable = true,
  className = '',
  required = false
}) => {
  const normalizedOptions = createSelectOptions(options)
  const selectedOption =
    normalizedOptions.find((opt) => opt.value === value) || (value ? { value, label: value } : null)

  // Determine menu position based on screen width
  // Use "absolute" for desktop (>768px) to fix click coordinate issues after scrolling
  // Use "fixed" for mobile (≤768px) to maintain mobile modal z-index functionality
  const menuPosition = useMemo(() => {
    if (typeof window === 'undefined') return 'fixed'
    return window.innerWidth > 768 ? 'absolute' : 'fixed'
  }, [])

  return (
    <Select
      inputId={id}
      value={selectedOption}
      onChange={(selected) => onChange(selected ? selected.value : '')}
      options={normalizedOptions}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isLoading={isLoading}
      isClearable={isClearable}
      className={`po-searchable-select ${className || ''}`}
      classNamePrefix="po-select"
      styles={poSelectStyles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition={menuPosition}
      getOptionValue={(option) => option.value} // Explicitly define how to get option value
      getOptionLabel={(option) => option.label || option.value} // Explicitly define how to get option label
      required={required}
    />
  )
}

// Utility Functions
const formatDateTime = (date) => {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM'
  const hours12 = (date.getHours() % 12 || 12).toString().padStart(2, '0')
  
  return `${day}/${month}/${year}, ${hours12}:${minutes}:${seconds} ${ampm}`
}

const generateFallbackOrderId = () => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear() % 100
  const timestamp = now.getTime()
  return `KR_${month.toString().padStart(2, '0')}${year.toString().padStart(2, '0')}-${(timestamp % 10000).toString().padStart(4, '0')}`
}

// Get today's date in YYYY-MM-DD format for date input max attribute
const getTodayDateString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}


// ================================
// CLEAN CASCADING DROPDOWN HELPERS
// ================================

/**
 * Get material name options based on category data structure
 * Handles all 3 data structures: Simple Array, Spec-Based, Complex Nested
 * Ensures uniqueness of material names (no duplicates)
 * Implements STRICT filtering: subcategory selection shows ONLY materials from that subcategory
 */
const getMaterialNameOptions = (categoryData, subCategory) => {
  if (!categoryData || !categoryData.materialNames) {
    return []
  }

  const materialNames = categoryData.materialNames
  const materialNameArray = [] // Collect material names first

  // Structure 1: Simple Array (no subcategories, no specifications)
  if (Array.isArray(materialNames)) {
    // For simple arrays, only show materials if NO subcategory is selected
    // If subcategory is selected but data is simple array, return empty (invalid subcategory)
    if (!subCategory) {
      materialNames.forEach(material => {
        const name = typeof material === 'string' ? material : material.name
        if (name) {
          materialNameArray.push(name)
        }
      })
    }
  }
  // Structure 2 & 3: Object-based (has specifications or subcategories)
  else if (typeof materialNames === 'object') {
    // STRICT FILTERING: If subcategory is selected, show ONLY materials from that subcategory
    if (subCategory && subCategory.trim() !== '' && materialNames[subCategory]) {
      const subCategoryData = materialNames[subCategory]
      
      // If subcategory data is an array (direct materials under subcategory)
      if (Array.isArray(subCategoryData)) {
        subCategoryData.forEach(material => {
          const name = typeof material === 'string' ? material : material.name
          if (name) {
            materialNameArray.push(name)
          }
        })
      }
      // If subcategory data is an object (has specifications under subcategory)
      else if (typeof subCategoryData === 'object') {
        Object.values(subCategoryData).forEach(specMaterials => {
          if (Array.isArray(specMaterials)) {
            specMaterials.forEach(material => {
              const name = typeof material === 'string' ? material : material.name
              if (name) {
                materialNameArray.push(name)
              }
            })
          }
        })
      }
    } else {
      // STRICT FILTERING: If no subcategory selected, show ONLY materials NOT under any subcategory
      if (!subCategory || subCategory.trim() === '') {
      // Check for materials directly under category (not under any subcategory)
      // Look for empty string key or 'default' key that might contain top-level materials
      const topLevelKeys = ['', 'default', 'others', 'general']
      
      for (const key of topLevelKeys) {
        if (materialNames[key]) {
          const topLevelData = materialNames[key]
          
          if (Array.isArray(topLevelData)) {
            topLevelData.forEach(material => {
              const name = typeof material === 'string' ? material : material.name
              if (name) {
                materialNameArray.push(name)
              }
            })
          } else if (typeof topLevelData === 'object') {
            Object.values(topLevelData).forEach(specMaterials => {
              if (Array.isArray(specMaterials)) {
                specMaterials.forEach(material => {
                  const name = typeof material === 'string' ? material : material.name
                  if (name) {
                    materialNameArray.push(name)
                  }
                })
              }
            })
          }
        }
      }
      
      // FIXED: If no materials found under top-level keys, check if we have direct specification keys
      // This handles the case where materials are organized by specifications but no subcategories exist
      // BUT ONLY if the category has NO subcategories defined
      
      if (materialNameArray.length === 0 && (!categoryData.subCategories || categoryData.subCategories.length === 0)) {
        Object.keys(materialNames).forEach(key => {
          // Skip the top-level keys we already checked
          if (!topLevelKeys.includes(key)) {
            const materials = materialNames[key]
            
            // If this key contains an array of materials (direct specification -> materials)
            if (Array.isArray(materials)) {
              materials.forEach(material => {
                const name = typeof material === 'string' ? material : material.name
                if (name) {
                  materialNameArray.push(name)
                }
              })
            }
            // If this key contains nested objects (specification -> more specifications -> materials)
            else if (typeof materials === 'object') {
              Object.values(materials).forEach(specMaterials => {
                if (Array.isArray(specMaterials)) {
                  specMaterials.forEach(material => {
                    const name = typeof material === 'string' ? material : material.name
                    if (name) {
                      materialNameArray.push(name)
                    }
                  })
                }
              })
            }
          }
        })
      }
      }
    }
  }

  // Remove duplicates and create unique material names
  const uniqueMaterialNames = [...new Set(materialNameArray)].sort()

  return uniqueMaterialNames
};

/**
 * Get specifications for a selected material
 * Returns array of specification names where the material exists
 */
const getSpecificationsForMaterial = (categoryData, materialName, subCategory) => {
  if (!categoryData || !materialName || !categoryData.materialNames) {
    return [];
  }

  const materialNames = categoryData.materialNames;
  const specifications = new Set();
  
  // Structure 1: Simple Array (no specifications)
  if (Array.isArray(materialNames)) {
    return [];
  }

  // Structure 2 & 3: Object-based
  if (typeof materialNames === 'object') {
    // If subcategory is selected, search only in that subcategory
    if (subCategory && materialNames[subCategory]) {
      const subCategoryData = materialNames[subCategory];
      
      // Case 1: subCategoryData is an array of material objects
      // Structure: { "Steam": [{ name: "...", specifications: "...", uom: "..." }] }
      if (Array.isArray(subCategoryData)) {
        subCategoryData.forEach(material => {
          const matName = typeof material === 'string' ? material : material.name;
          if (matName === materialName) {
            // Extract specifications from material object
            if (material && typeof material === 'object' && material.specifications && material.specifications.trim()) {
              specifications.add(material.specifications);
            } else {
            }
          }
        });
      }
      // Case 2: subCategoryData is an object with specification keys
      // Structure: { "Steam": { "Size: 2\"": [{ name: "...", uom: "..." }] } }
      else if (typeof subCategoryData === 'object') {
        Object.keys(subCategoryData).forEach(spec => {
          const materials = subCategoryData[spec];
          if (Array.isArray(materials)) {
            const found = materials.find(mat => 
              (typeof mat === 'string' ? mat : mat.name) === materialName
            );
            if (found) {
              specifications.add(spec);
            }
          }
        });
      }
    }
    // If no subcategory selected, search in all subcategories
    else {
      Object.entries(materialNames).forEach(([key, subCategoryData]) => {
        // Handle direct specification -> materials structure (no subcategories)
        if (Array.isArray(subCategoryData)) {
          const found = subCategoryData.find(mat => 
            (typeof mat === 'string' ? mat : mat.name) === materialName
          );
          if (found) {
            specifications.add(key); // The key is the specification name
          }
        }
        // Handle subcategory -> specifications -> materials structure
        else if (typeof subCategoryData === 'object') {
          Object.keys(subCategoryData).forEach(spec => {
            const materials = subCategoryData[spec];
            if (Array.isArray(materials)) {
              const found = materials.find(mat => 
                (typeof mat === 'string' ? mat : mat.name) === materialName
              );
              if (found) {
                specifications.add(spec);
              }
            }
          });
        }
      });
    }
  }

  const result = Array.from(specifications).sort();
  return result;
};

/**
 * Get UOM for a material - works immediately after material selection
 * No longer requires specifications to be selected first
 */
const getUomForMaterial = (materialData, category, materialName, subCategory = '', specifications = '') => {
  if (!category || !materialName || !materialData[category]) {
    return '';
  }

  const categoryData = materialData[category];
  const materialNames = categoryData.materialNames;

  if (!materialNames) return '';

  // Structure 1: Simple Array
  if (Array.isArray(materialNames)) {
    const material = materialNames.find(mat => 
      (typeof mat === 'string' ? mat : mat.name) === materialName
    );
    return material && typeof material === 'object' ? material.uom : '';
  }

  // Structure 2 & 3: Object-based
  if (typeof materialNames === 'object') {
    // If subcategory is selected, search in that subcategory first
    if (subCategory && materialNames[subCategory]) {
      const subCategoryData = materialNames[subCategory];
      
      // If subcategory has specifications
      if (typeof subCategoryData === 'object') {
        // If specific specification is selected, search there first
        if (specifications && subCategoryData[specifications]) {
          const materials = subCategoryData[specifications];
          const material = materials.find(mat => 
            (typeof mat === 'string' ? mat : mat.name) === materialName
          );
          if (material && typeof material === 'object') {
            return material.uom;
          }
        }
        
        // Search in any specification within the subcategory
        for (const spec of Object.keys(subCategoryData)) {
          const materials = subCategoryData[spec];
          if (Array.isArray(materials)) {
            const material = materials.find(mat => 
              (typeof mat === 'string' ? mat : mat.name) === materialName
            );
            if (material && typeof material === 'object') {
              return material.uom;
            }
          }
        }
      }
      // If subcategory data is direct array
      else if (Array.isArray(subCategoryData)) {
        const material = subCategoryData.find(mat => 
          (typeof mat === 'string' ? mat : mat.name) === materialName
        );
        if (material && typeof material === 'object') {
          return material.uom;
        }
      }
    }
    
    // If no subcategory selected, search in all subcategories
    for (const subCatData of Object.values(materialNames)) {
      if (typeof subCatData === 'object') {
        // If this subcategory has specifications
        if (Object.keys(subCatData).length > 0 && Array.isArray(Object.values(subCatData)[0])) {
          for (const materials of Object.values(subCatData)) {
            if (Array.isArray(materials)) {
              const material = materials.find(mat => 
                (typeof mat === 'string' ? mat : mat.name) === materialName
              );
              if (material && typeof material === 'object') {
                return material.uom;
              }
            }
          }
        }
        // If this subcategory data is direct array
        else if (Array.isArray(subCatData)) {
          const material = subCatData.find(mat => 
            (typeof mat === 'string' ? mat : mat.name) === materialName
          );
          if (material && typeof material === 'object') {
            return material.uom;
          }
        }
      }
    }
  }

  return '';
};

// Function to fetch UOM from backend for exact material match
// Tries multiple combinations systematically: all four → without specs → without subcategory → without both
const fetchMaterialUomFromBackend = async (category, subCategory, specifications, materialName) => {
  try {
    const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
    const sheetId = kerurPlant?.material_sheet_id
    const sheetName =
      typeof kerurPlant?.sheet_name === 'object'
        ? kerurPlant?.sheet_name?.MaterialList || 'Material List'
        : kerurPlant?.sheet_name || 'Material List'

    // Define all combinations to try in order of specificity
    const combinations = [
      // 1. Try with all four values (most specific)
      { category, subCategory: subCategory || '', specifications: specifications || '', materialName },
      // 2. Try without specifications (if specifications were provided)
      ...(specifications ? [{ category, subCategory: subCategory || '', specifications: '', materialName }] : []),
      // 3. Try without subcategory (if subcategory was provided)
      ...(subCategory ? [{ category, subCategory: '', specifications: specifications || '', materialName }] : []),
      // 4. Try without both subcategory and specifications (if both were provided)
      ...(subCategory && specifications ? [{ category, subCategory: '', specifications: '', materialName }] : [])
    ]

    // Try each combination in order
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i]
      const payload = {
        category: combo.category,
        subCategory: combo.subCategory,
        specifications: combo.specifications,
        materialName: combo.materialName,
        department: 'KR',
        sheet_id: sheetId,
        sheet_name: sheetName
      }

      try {
        const response = await axios.post(getApiUrl('get_material_details'), payload)
        
        if (response.data.success) {
          const material = response.data.material
          return material.uom
        }
      } catch (comboError) {
        // Continue to next combination
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching UOM from backend:', error)
    return null
  }
}

// Custom Hook for Material Data
const useMaterialData = () => {
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const fetchMaterialData = async () => {
    try {
      setDataLoading(true)
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      const sheetName =
        typeof kerurPlant?.sheet_name === 'object'
          ? kerurPlant?.sheet_name?.MaterialList || 'Material List'
          : kerurPlant?.sheet_name || 'Material List'

      const response = await axios.get(getApiUrl('get_material_data'), {
        params: {
          factory: 'KR',
          sheet_id: sheetId,
          sheet_name: sheetName
        }
      })
      
      if (response.data.success) {
        setMaterialData(response.data.data)
        setCategories(Object.keys(response.data.data).sort())
      } else {
        console.error('Failed to load material data:', response.data.message)
      }
    } catch (error) {
      console.error('Error fetching material data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  return { materialData, categories, dataLoading, fetchMaterialData }
}

// Custom Hook for Session Management
const useSessionManagement = () => {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  const registerSession = (orderId) => {
    try {
      const activeSessions = JSON.parse(localStorage.getItem('kr_active_sessions') || '{}')
      activeSessions[sessionId] = {
        timestamp: Date.now(),
        orderId: orderId
      }
      localStorage.setItem('kr_active_sessions', JSON.stringify(activeSessions))
    } catch (error) {
      console.error('Error registering session:', error)
    }
  }

  const cleanupSession = () => {
    try {
      const activeSessions = JSON.parse(localStorage.getItem('kr_active_sessions') || '{}')
      delete activeSessions[sessionId]
      localStorage.setItem('kr_active_sessions', JSON.stringify(activeSessions))
    } catch (error) {
      console.error('Error cleaning up session:', error)
    }
  }

  const cleanupOldSessions = () => {
    try {
      const activeSessions = JSON.parse(localStorage.getItem('kr_active_sessions') || '{}')
      const now = Date.now()
      
      Object.keys(activeSessions).forEach(sessionKey => {
        if (now - activeSessions[sessionKey].timestamp > SESSION_TIMEOUT) {
          delete activeSessions[sessionKey]
        }
      })
      
      localStorage.setItem('kr_active_sessions', JSON.stringify(activeSessions))
    } catch (error) {
      console.error('Error cleaning up old sessions:', error)
    }
  }

  return { sessionId, registerSession, cleanupSession, cleanupOldSessions }
}

const KR_PlaceOrder = () => {
  // State Management
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    materialName: '',
    specifications: '',
    uom: '',
    quantity: '',
    givenBy: '',
    type: TYPE_OPTIONS[0] || '',
    partyName: '',
    place: '',
    description: '',
    importance: 'Normal'
  })

  const [orderItems, setOrderItems] = useState([])
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    const day = now.getDate().toString().padStart(2, '0')
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = now.getFullYear()
    return `${day}/${month}/${year}`
  })
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date()
    const hours = (now.getHours() % 12 || 12).toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
    return `${hours}:${minutes} ${ampm}`
  })
  const [orderId, setOrderId] = useState('')
  const [orderIdGenerated, setOrderIdGenerated] = useState(false)
  const [authorityNames, setAuthorityNames] = useState([])
  const [authorityLoading, setAuthorityLoading] = useState(true)
  const [authorityRecords, setAuthorityRecords] = useState([])
  const [partyNames, setPartyNames] = useState([])
  const [places, setPlaces] = useState([])
  const [partyPlaceMapping, setPartyPlaceMapping] = useState({})
  const [partyLoading, setPartyLoading] = useState(true)
  const [placesLoading, setPlacesLoading] = useState(true)
  
  // Helper function to get available places for a party name
  const getPlacesForParty = (partyName) => {
    if (!partyName || !partyPlaceMapping[partyName]) {
      return []
    }
    const placeData = partyPlaceMapping[partyName]
    // Handle both single string and array of places
    if (Array.isArray(placeData)) {
      return [...placeData].sort()
    } else if (typeof placeData === 'string') {
      return [placeData]
    }
    return []
  }
  
  // Recipients functionality
  const [recipients, setRecipients] = useState([])
const [showScreenFlash, setShowScreenFlash] = useState(false)
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [notificationMethod, setNotificationMethod] = useState('both') // 'email', 'whatsapp', 'both'
  const [sendingNotification, setSendingNotification] = useState(false)
  const [lastSubmittedOrderId, setLastSubmittedOrderId] = useState(null)
  const [lastSubmittedOrderData, setLastSubmittedOrderData] = useState(null)
  const [enableEmailNotification, setEnableEmailNotification] = useState(false)
  const [enableWhatsappNotification, setEnableWhatsappNotification] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryModalData, setSummaryModalData] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shouldRefreshOnModalClose, setShouldRefreshOnModalClose] = useState(false)
  const [formValidationErrors, setFormValidationErrors] = useState([])
  const [formHasBlockingErrors, setFormHasBlockingErrors] = useState(false)
const [highlightedFields, setHighlightedFields] = useState([])
const highlightTimeoutRef = useRef(null)
const screenFlashTimeoutRef = useRef(null)
const categoryInputRef = useRef(null)
const materialNameInputRef = useRef(null)
const quantityInputRef = useRef(null)
const uomInputRef = useRef(null)
const addItemFieldRefs = {
  category: categoryInputRef,
  materialName: materialNameInputRef,
  quantity: quantityInputRef,
  uom: uomInputRef
}
  
  // Edit functionality
  const [editingItem, setEditingItem] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  
  // Mobile items sheet modal
  const [showItemsSheet, setShowItemsSheet] = useState(false)
  const itemsSheetHistoryPushed = useRef(false)
  const closeItemsSheet = () => {
    setShowItemsSheet(false)
    setEditingItem(null)
    setEditFormData({})
  }
  
  // Touch functionality for mobile
  const [touchStartTime, setTouchStartTime] = useState(null)
  const [touchStartPosition, setTouchStartPosition] = useState(null)

  // Custom Hooks
  const { materialData, categories, dataLoading, fetchMaterialData } = useMaterialData()
  const { sessionId, registerSession, cleanupSession, cleanupOldSessions } = useSessionManagement()
  const materialInputSectionRef = useRef(null)
  const itemsTableContainerRef = useRef(null)
  const scrollToMaterialInputs = () => {
    if (typeof window === 'undefined') return
    if (materialInputSectionRef.current) {
      const element = materialInputSectionRef.current
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      // Adjust offset based on screen size - smaller offset for mobile
      const offset = window.innerWidth < 768 ? 80 : 100
      
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      })
    }
  }

const triggerScreenFlash = (duration = 600) => {
  setShowScreenFlash(true)
  if (screenFlashTimeoutRef.current) {
    clearTimeout(screenFlashTimeoutRef.current)
  }
  screenFlashTimeoutRef.current = setTimeout(() => {
    setShowScreenFlash(false)
    screenFlashTimeoutRef.current = null
  }, duration)
}

const focusFieldWithError = (primaryField, fieldsToHighlight = [primaryField]) => {
  setHighlightedFields(fieldsToHighlight)

  const targetRef = addItemFieldRefs[primaryField]
  if (targetRef?.current) {
    targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable =
      typeof targetRef.current.querySelector === 'function'
        ? targetRef.current.querySelector('input, select, textarea, button')
        : targetRef.current
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus({ preventScroll: true })
    }
  }
}

  // Fetch authority list data from Google Sheets
  const fetchAuthorityList = async () => {
    try {
      setAuthorityLoading(true)
      // Find the Kerur plant data to get the sheet ID
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      
      if (!sheetId) {
        console.error('No sheet ID found for Kerur plant')
        return
      }
      
      const response = await axios.get(getApiUrl('get_authority_list'), {
        params: { 
          factory: 'KR',
          sheet_name: 'List',
          sheet_id: sheetId
        }
      })
      
      if (response.data.success) {
        const { data: authorityData = [], records = [], types = [] } = response.data

        // Determine authority names (supporting both string arrays and record objects)
        if (Array.isArray(records) && records.length > 0) {
          const namesFromRecords = records
            .map(record => {
              if (!record) return ''
              if (typeof record === 'string') return record
              return (
                record.givenBy ||
                record.GivenBy ||
                record['Given By'] ||
                record.authorityName ||
                record['Authority Name'] ||
                ''
              )
            })
            .filter(name => !!name)
          if (namesFromRecords.length > 0) {
            setAuthorityNames([...namesFromRecords].sort())
          } else {
            setAuthorityNames(Array.isArray(authorityData) ? [...authorityData].sort() : [])
          }
        } else {
          setAuthorityNames(Array.isArray(authorityData) ? [...authorityData].sort() : [])
        }

        if (Array.isArray(records)) {
          setAuthorityRecords(records)
        } else {
          setAuthorityRecords([])
        }

      } else {
        console.error('Failed to load authority list:', response.data.error)
      }
    } catch (error) {
      console.error('Error fetching authority list:', error)
    } finally {
      setAuthorityLoading(false)
    }
  }

  // Fetch party and place data with mapping from Google Sheets
  const fetchPartyPlaceData = async () => {
    try {
      setPartyLoading(true)
      setPlacesLoading(true)

      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id

      if (!sheetId) {
        console.error('No sheet ID found for Kerur plant')
        return
      }

      const response = await axios.get(getApiUrl('get_party_place_data'), {
        params: {
          factory: 'KR',
          sheet_name: 'Party List',
          sheet_id: sheetId
        }
      })

      if (response.data.success) {
        const { party_names = [], places: placesData = [], party_place_mapping = {} } = response.data.data || {}

        setPartyNames(Array.isArray(party_names) ? [...party_names].sort() : [])
        setPlaces(Array.isArray(placesData) ? [...placesData].sort() : [])
        setPartyPlaceMapping(typeof party_place_mapping === 'object' && party_place_mapping !== null ? party_place_mapping : {})
      } else {
        console.error('Failed to load party/place data:', response.data.error)
      }
    } catch (error) {
      console.error('Error fetching party/place data:', error)
    } finally {
      setPartyLoading(false)
      setPlacesLoading(false)
    }
  }

  // Fetch recipients list data from Google Sheets
  const fetchRecipientsList = async () => {
    try {
      setRecipientsLoading(true)
      // Find the Kerur plant data to get the sheet ID
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      
      if (!sheetId) {
        console.error('No sheet ID found for Kerur plant')
        return
      }
      
      const response = await axios.get(getApiUrl('get_recipients_list'), {
        params: { 
          factory: 'KR',
          sheet_name: 'Recipents List UAT',
          sheet_id: sheetId
        }
      })
      
      if (response.data.success) {
        setRecipients(response.data.data)
      } else {
        console.error('Failed to load recipients list:', response.data.error)
      }
    } catch (error) {
      console.error('Error fetching recipients list:', error)
    } finally {
      setRecipientsLoading(false)
    }
  }

  // Order ID Management
  const handleGenerateOrderId = async () => {
    if (orderIdGenerated) {
      return // Already generated, do nothing
    }
    
    try {
      const response = await axios.post(getApiUrl('get_next_order_id'), {
        factory: 'KR'
      })
      
      if (response.data.success) {
        setOrderId(response.data.orderId)
        setOrderIdGenerated(true)
        registerSession(response.data.orderId)
      } else {
        const fallbackId = generateFallbackOrderId()
        setOrderId(fallbackId)
        setOrderIdGenerated(true)
        registerSession(fallbackId)
      }
    } catch (error) {
      const fallbackId = generateFallbackOrderId()
      setOrderId(fallbackId)
      setOrderIdGenerated(true)
      registerSession(fallbackId)
    }
  }

  // Handler for time input click/touch
  // Handle date/time change from DateTimePicker
  const handleDateTimeChange = ({ date, time }) => {
    if (date !== undefined) {
      setCurrentDate(date)
    }
    if (time !== undefined) {
      setCurrentTime(time)
    }
  }

  // Derived availability for warning/highlight states
  const availableSubCategories = useMemo(
    () =>
      formData.category
        ? materialData[formData.category]?.subCategories?.slice().sort() || []
        : [],
    [formData.category, materialData]
  )

  const availableMaterialNames = useMemo(
    () => {
      const categoryData = formData.category ? materialData[formData.category] : null
      return categoryData
        ? getMaterialNameOptions(categoryData, formData.subCategory)
        : []
    },
    [formData.category, formData.subCategory, materialData]
  )

  const availableSpecifications = useMemo(
    () => {
      const categoryData = formData.category ? materialData[formData.category] : null
      return categoryData
        ? getSpecificationsForMaterial(categoryData, formData.materialName, formData.subCategory)
        : []
    },
    [formData.category, formData.materialName, formData.subCategory, materialData]
  )

  // Determine if fields should show error highlight when options are available but not selected
  // NOTE: Category field is excluded - it only shows red border on validation errors
  const shouldHighlightSubCategory = useMemo(
    () => !formData.subCategory && availableSubCategories.length > 0,
    [formData.subCategory, availableSubCategories.length]
  )

  const shouldHighlightMaterialName = useMemo(
    () => !formData.materialName && availableMaterialNames.length > 0,
    [formData.materialName, availableMaterialNames.length]
  )

  const shouldHighlightSpecifications = useMemo(
    () => !formData.specifications && availableSpecifications.length > 0,
    [formData.specifications, availableSpecifications.length]
  )

  // Derived availability for edit mode
  const editAvailableSubCategories = useMemo(
    () =>
      editFormData.category
        ? materialData[editFormData.category]?.subCategories?.slice().sort() || []
        : [],
    [editFormData.category, materialData]
  )

  const editAvailableMaterialNames = useMemo(
    () => {
      const categoryData = editFormData.category ? materialData[editFormData.category] : null
      return categoryData
        ? getMaterialNameOptions(categoryData, editFormData.subCategory)
        : []
    },
    [editFormData.category, editFormData.subCategory, materialData]
  )

  const editAvailableSpecifications = useMemo(
    () => {
      const categoryData = editFormData.category ? materialData[editFormData.category] : null
      return categoryData
        ? getSpecificationsForMaterial(
            categoryData,
            editFormData.materialName,
            editFormData.subCategory
          )
        : []
    },
    [editFormData.category, editFormData.materialName, editFormData.subCategory, materialData]
  )

// Edit-mode option availability flags
const hasEditCategoryOptions = useMemo(() => categories.length > 0, [categories.length])
const hasEditSubCategoryOptions = useMemo(
  () => editAvailableSubCategories.length > 0,
  [editAvailableSubCategories.length]
)
const hasEditMaterialOptions = useMemo(
  () => editAvailableMaterialNames.length > 0,
  [editAvailableMaterialNames.length]
)
const hasEditSpecOptions = useMemo(
  () => editAvailableSpecifications.length > 0,
  [editAvailableSpecifications.length]
)

  // Determine if edit mode fields should show error highlight when options are available but not selected
  // NOTE: Category field is excluded - it only shows red border on validation errors
  const shouldHighlightEditSubCategory = useMemo(
    () => editingItem && !editFormData.subCategory && hasEditSubCategoryOptions,
    [editingItem, editFormData.subCategory, hasEditSubCategoryOptions]
  )

  const shouldHighlightEditMaterialName = useMemo(
    () => editingItem && !editFormData.materialName && hasEditMaterialOptions,
    [editingItem, editFormData.materialName, hasEditMaterialOptions]
  )

  const shouldHighlightEditSpecifications = useMemo(
    () => editingItem && !editFormData.specifications && hasEditSpecOptions,
    [editingItem, editFormData.specifications, hasEditSpecOptions]
  )

  // Check if any add-item fields have values but item not added
  const hasPendingItemDetails = useMemo(() => {
    return !!(
      formData.category ||
      formData.subCategory ||
      formData.materialName ||
      formData.specifications ||
      formData.quantity ||
      formData.uom ||
      formData.partyName ||
      formData.place
    )
  }, [
    formData.category,
    formData.subCategory,
    formData.materialName,
    formData.specifications,
    formData.quantity,
    formData.uom,
    formData.partyName,
    formData.place
  ])

  // Effects
  useEffect(() => {
    // Fetch material data first
    fetchMaterialData()
    fetchAuthorityList()
    fetchRecipientsList()
    fetchPartyPlaceData()
    
    // Clean up old sessions
    cleanupOldSessions()
    
    // Cleanup on component unmount
    return () => {
      cleanupSession()
    }
  }, [])

  // Handle page visibility changes and cleanup
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, cleanup session after a delay
        setTimeout(() => {
          if (document.hidden) {
            cleanupSession()
          }
        }, 5 * 60 * 1000) // 5 minutes delay
      }
    }

    const handleBeforeUnload = () => {
      cleanupSession()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Helper function to validate numeric input
  const validateNumericInput = (value) => {
    // Allow empty string, numbers, and decimal point
    return /^[0-9]*\.?[0-9]*$/.test(value)
  }

  // Form validation function
  const validateForm = () => {
    const errors = []
    
    if (!orderIdGenerated || !orderId) {
      errors.push('Please generate an Order ID before placing order')
    }
    
    if (!currentDate || currentDate.trim() === '') {
      errors.push('Please select a Date')
    }
    
    if (orderItems.length === 0) {
      errors.push('Please add at least one item to the order')
    }
    
    if (!formData.givenBy) {
      errors.push('Please select Given By (Authority Name)')
    }
    
    if (!formData.type) {
      errors.push('Please select Type')
    }
    
    if (!formData.description || formData.description.trim() === '') {
      errors.push('Please enter Description')
    }
    
    return errors
  }

  // Validate form on state changes
  useEffect(() => {
    const errors = validateForm()
    setFormValidationErrors(errors)
  }, [orderIdGenerated, orderId, currentDate, orderItems, formData.givenBy, formData.type, formData.description])

  // Handle browser back button when items sheet modal is open
  useEffect(() => {
    if (showItemsSheet) {
      // Push a history state when modal opens
      if (!itemsSheetHistoryPushed.current) {
        window.history.pushState({ itemsSheetOpen: true }, '')
        itemsSheetHistoryPushed.current = true
      }

      // Handle browser back button
      const handlePopState = (event) => {
        // Only close modal if the state indicates it was our pushed state
        if (showItemsSheet && (!event.state || event.state.itemsSheetOpen === undefined)) {
          setShowItemsSheet(false)
          itemsSheetHistoryPushed.current = false
        }
      }

      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    } else {
      // When modal closes via close button, remove the history state we pushed
      if (itemsSheetHistoryPushed.current) {
        // Use setTimeout to avoid navigation conflicts
        setTimeout(() => {
          // Check if we're still on the pushed state and replace it
          if (window.history.state && window.history.state.itemsSheetOpen) {
            window.history.replaceState(null, '')
          }
        }, 0)
        itemsSheetHistoryPushed.current = false
      }
    }
  }, [showItemsSheet])

  useEffect(() => {
    return () => {
      if (screenFlashTimeoutRef.current) {
        clearTimeout(screenFlashTimeoutRef.current)
      }
    }
  }, [])

  const handleInputChange = (field, value) => {
    // For quantity field, only allow numeric input
    if (field === 'quantity' && !validateNumericInput(value)) {
      return // Don't update if input is not numeric
    }
    
    // Clear highlight for this field if it now has a value
    if (value && highlightedFields.includes(field)) {
      setHighlightedFields(prev => prev.filter(f => f !== field))
    }
    
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [field]: value,
        // Reset dependent fields when category changes
        ...(field === 'category' && {
          subCategory: '',
          materialName: '',
          specifications: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          materialName: '',
          specifications: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when materialName changes
        ...(field === 'materialName' && {
          specifications: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when specifications changes
        ...(field === 'specifications' && {
          uom: '',
          quantity: ''
        }),
        // Auto-select type when Given By changes
        ...(field === 'givenBy' && !value ? { type: TYPE_OPTIONS[0] || '' } : {}),
        // Auto-select place when party name changes
        ...(field === 'partyName' && (() => {
          if (!value) {
            return { place: '' }
          }

          if (!partyPlaceMapping || Object.keys(partyPlaceMapping).length === 0) {
            return {}
          }

          const placeData =
            partyPlaceMapping[value] ||
            partyPlaceMapping[value.trim()] ||
            null

          if (placeData) {
            if (Array.isArray(placeData)) {
              if (placeData.length === 1) {
                return { place: placeData[0] }
              }
              return { place: '' }
            } else if (typeof placeData === 'string') {
              return { place: placeData }
            }
          }

          return { place: '' }
        })())
      }

      // ENHANCED UOM LOGIC:
      // Unified function to determine if UOM should be fetched
      const shouldFetchUom = (formDataToCheck) => {
        // Minimum required: category + material name
        if (!formDataToCheck.category || !formDataToCheck.materialName) {
          return false
        }
        
        // Valid combinations:
        // 1. category + material name (2 fields) ✅
        // 2. category + sub-category + material name (3 fields) ✅
        // 3. category + material name + specifications (3 fields) ✅
        // 4. category + sub-category + material name + specifications (4 fields) ✅
        
        // All combinations are valid as long as category + material name are present
        return true
      }

      // Unified function to trigger UOM fetch
      const triggerUomFetch = (formDataToCheck) => {
        if (!shouldFetchUom(formDataToCheck)) {
          return // Don't fetch if minimum requirements not met
        }
        
        // Only fetch if UOM is not already set (avoid unnecessary fetches)
        if (formDataToCheck.uom) {
          return
        }
        
        // Check if specifications are available for this material
        const categoryData = materialData[formDataToCheck.category]
        if (categoryData) {
          const availableSpecs = getSpecificationsForMaterial(
            categoryData,
            formDataToCheck.materialName,
            formDataToCheck.subCategory
          )
          
          // If specifications are available but not yet selected, WAIT for user to select
          if (availableSpecs.length > 0 && !formDataToCheck.specifications) {
            return // Don't fetch yet - wait for specifications selection
          }
        }
        
        // Determine which fields to use for fetch
        const category = formDataToCheck.category
        const subCategory = formDataToCheck.subCategory || ''
        const specifications = formDataToCheck.specifications || ''
        const materialName = formDataToCheck.materialName
        
        // Fetch UOM with available fields (backend will try multiple combinations)
        setTimeout(() => {
          fetchMaterialUomFromBackend(
            category,
            subCategory,
            specifications,
            materialName
          ).then(backendUom => {
            if (backendUom) {
              setFormData(prev => ({
                ...prev,
                uom: backendUom
              }))
              setHighlightedFields(prev => prev.filter(f => f !== 'uom'))
            }
          })
        }, 100)
      }

      // Trigger UOM fetch when any of the four fields change
      if (['category', 'subCategory', 'materialName', 'specifications'].includes(field)) {
        // Check if minimum requirements are met and UOM is not already set
        if (shouldFetchUom(newFormData) && !newFormData.uom) {
          triggerUomFetch(newFormData)
        }
      }

      return newFormData
    })
  }

  const handleResetAddItemFields = () => {
    // Reset only the add item fields: category, subCategory, materialName, specifications, quantity, uom, partyName, place
    setFormData(prev => ({
      ...prev,
      category: '',
      subCategory: '',
      materialName: '',
      specifications: '',
      uom: '',
      quantity: '',
      partyName: '',
      place: ''
      // Keep givenBy, description, type, and importance unchanged
    }))
    
    // Clear any highlighted fields
    setHighlightedFields([])
  }

  const handleAddItem = () => {
  // Determine which required fields are missing
  const requiredFields = [
    { name: 'category', label: 'Category' },
    { name: 'materialName', label: 'Material Name' },
    { name: 'uom', label: 'UOM' },
    { name: 'quantity', label: 'Quantity' }
  ]

  const missingFields = requiredFields.filter(field => !formData[field.name])
  if (missingFields.length > 0) {
    triggerScreenFlash(450)
    focusFieldWithError(missingFields[0].name, missingFields.map(field => field.name))
    return
  }

    const newItem = {
      id: Date.now(), // Simple ID generation
      category: formData.category,
      subCategory: formData.subCategory,
      materialName: formData.materialName,
      specifications: formData.specifications,
      uom: formData.uom,
      quantity: formData.quantity,
      partyName: formData.partyName || '',
      place: formData.place || ''
    }

    setOrderItems(prev => [...prev, newItem])
    
    // Trigger flash animation on table container
    if (itemsTableContainerRef.current) {
      itemsTableContainerRef.current.classList.add('po-item-added-flash')
      setTimeout(() => {
        if (itemsTableContainerRef.current) {
          itemsTableContainerRef.current.classList.remove('po-item-added-flash')
        }
      }, 800) // Remove class after animation completes
    }
    
    // Trigger screen flash overlay
    triggerScreenFlash()
    
    // Reset only the item-specific fields after adding item, preserve order details
    setFormData(prev => ({
      ...prev,
      category: '',
      subCategory: '',
      materialName: '',
      specifications: '',
      uom: '',
      quantity: '',
      partyName: '',
      place: ''
      // Keep givenBy, description, and importance unchanged
    }))

    // Scroll to material inputs after a short delay to allow DOM update
    setTimeout(() => {
      scrollToMaterialInputs()
    }, 100)
  }

  const handleRemoveItem = (itemId) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleEditItem = (item) => {
    setEditingItem(item.id)
    setEditFormData({
      category: item.category,
      subCategory: item.subCategory,
      materialName: item.materialName,
      specifications: item.specifications,
      uom: item.uom,
      quantity: item.quantity,
      partyName: item.partyName || '',
      place: item.place || ''
    })
  }

  const handleDoubleClickEdit = (item, field) => {
    // If already editing this item, do nothing
    if (editingItem === item.id) {
      return
    }
    
    // If editing another item, cancel that edit first
    if (editingItem && editingItem !== item.id) {
      setEditingItem(null)
      setEditFormData({})
    }
    
    // Start editing this item
    setEditingItem(item.id)
    setEditFormData({
      category: item.category,
      subCategory: item.subCategory,
      materialName: item.materialName,
      specifications: item.specifications,
      uom: item.uom,
      quantity: item.quantity,
      partyName: item.partyName || '',
      place: item.place || ''
    })
  }

  // Touch event handlers for mobile
  const handleTouchStart = (e, item, field) => {
    const touch = e.touches[0]
    setTouchStartTime(Date.now())
    setTouchStartPosition({
      x: touch.clientX,
      y: touch.clientY
    })
    
    // Add visual feedback for touch
    const target = e.currentTarget
    target.classList.add('po-touch-active')
  }

  const handleTouchEnd = (e, item, field) => {
    if (!touchStartTime || !touchStartPosition) return

    const touch = e.changedTouches[0]
    const touchDuration = Date.now() - touchStartTime
    const touchDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPosition.x, 2) +
      Math.pow(touch.clientY - touchStartPosition.y, 2)
    )

    // Remove visual feedback
    const target = e.currentTarget
    target.classList.remove('po-touch-active')

    // Reset touch state
    setTouchStartTime(null)
    setTouchStartPosition(null)

    // Check if it's a long press with minimal movement
    if (touchDuration >= LONG_PRESS_DURATION && touchDistance <= TOUCH_MOVE_THRESHOLD) {
      e.preventDefault() // Prevent zoom
      handleDoubleClickEdit(item, field)
    }
  }

  const handleTouchMove = (e) => {
    // Reset touch state if user moves too much
    if (touchStartTime && touchStartPosition) {
      const touch = e.touches[0]
      const touchDistance = Math.sqrt(
        Math.pow(touch.clientX - touchStartPosition.x, 2) +
        Math.pow(touch.clientY - touchStartPosition.y, 2)
      )
      
      if (touchDistance > TOUCH_MOVE_THRESHOLD) {
        // Remove visual feedback if user moves too much
        const target = e.currentTarget
        target.classList.remove('po-touch-active')
        
        setTouchStartTime(null)
        setTouchStartPosition(null)
      }
    }
  }

  const handleEditInputChange = (field, value) => {
    // For quantity field, only allow numeric input
    if (field === 'quantity' && !validateNumericInput(value)) {
      return // Don't update if input is not numeric
    }
    
    setEditFormData(prev => {
      const newEditFormData = {
        ...prev,
        [field]: value,
        // Reset dependent fields when category changes
        ...(field === 'category' && {
          subCategory: '',
          materialName: '',
          specifications: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          materialName: '',
          specifications: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when materialName changes
        ...(field === 'materialName' && {
          specifications: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when specifications changes
        ...(field === 'specifications' && {
          uom: '',
          quantity: ''
        }),
        // Auto-select place when party name changes in edit mode
        ...(field === 'partyName' && (() => {
          if (!value) {
            return { place: '' }
          }

          if (!partyPlaceMapping || Object.keys(partyPlaceMapping).length === 0) {
            return {}
          }

          const placeData =
            partyPlaceMapping[value] ||
            partyPlaceMapping[value.trim()] ||
            null

          if (placeData) {
            if (Array.isArray(placeData)) {
              if (placeData.length === 1) {
                return { place: placeData[0] }
              }
              return { place: '' }
            } else if (typeof placeData === 'string') {
              return { place: placeData }
            }
          }

          return { place: '' }
        })())
      }

      // Auto-assign UOM immediately when material name changes in edit mode
      if (field === 'materialName' && value) {
        const autoUom = getUomForMaterial(
          materialData,
          newEditFormData.category,
          value,
          newEditFormData.subCategory,
          newEditFormData.specifications
        )
        if (autoUom) {
          newEditFormData.uom = autoUom
        }
      }

      // Auto-assign UOM when specifications changes in edit mode (if different UOM available)
      if (field === 'specifications' && value && newEditFormData.materialName) {
        const autoUom = getUomForMaterial(
          materialData,
          newEditFormData.category,
          newEditFormData.materialName,
          newEditFormData.subCategory,
          value
        )
        if (autoUom) {
          newEditFormData.uom = autoUom
        }
      }

      return newEditFormData
    })
  }

  const handleSaveEdit = () => {
    // Validate required fields
    if (!editFormData.category || !editFormData.materialName || !editFormData.uom || !editFormData.quantity) {
      alert('Please fill in all required fields (Category, Material Name, UOM, and Quantity) before saving.')
      return
    }

    setOrderItems(prev => prev.map(item => 
      item.id === editingItem 
        ? { ...item, ...editFormData }
        : item
    ))
    
    setEditingItem(null)
    setEditFormData({})
  }

  const handleCancelEdit = () => {
    setEditingItem(null)
    setEditFormData({})
  }

  // Handle recipient selection
  const handleRecipientToggle = (recipient) => {
    setSelectedRecipients(prev => {
      const isSelected = prev.some(r => r['Email ID - To'] === recipient['Email ID - To'])
      if (isSelected) {
        return prev.filter(r => r['Email ID - To'] !== recipient['Email ID - To'])
      } else {
        return [...prev, recipient]
      }
    })
  }

  // Select/Deselect all recipients
  const handleSelectAllRecipients = () => {
    if (selectedRecipients.length === recipients.length) {
      setSelectedRecipients([])
    } else {
      setSelectedRecipients([...recipients])
    }
  }

  // Send notifications
  const handleSendNotifications = async () => {
    if (selectedRecipients.length === 0) {
      alert('Please select at least one recipient')
      return
    }

    if (!lastSubmittedOrderId || !lastSubmittedOrderData) {
      alert('No order data found. Please try again.')
      return
    }

    try {
      setSendingNotification(true)
      
      // Get sheet ID from PLANT_DATA
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      
      const notificationData = {
        orderId: lastSubmittedOrderId,
        orderData: lastSubmittedOrderData,
        recipients: selectedRecipients,
        method: notificationMethod,
        factory: 'KR',
        autoSend: false, // Manual send with selected recipients
        sheetId: sheetId, // Send sheet ID to backend
        sheetName: 'Recipents List UAT' // Send sheet name to backend
      }

      const response = await axios.post(getApiUrl('send_order_notification'), notificationData)

      if (response.data.success) {
        const contextDetails = buildOrderSummaryContext(
          lastSubmittedOrderId,
          lastSubmittedOrderData
        )
        showDetailedLogReport(response.data, contextDetails)
        alert('Notifications sent successfully!')
        setShowNotificationModal(false)
        setSelectedRecipients([])
        setLastSubmittedOrderId(null)
        setLastSubmittedOrderData(null)
        
        // Reset order ID for next order
        setOrderIdGenerated(false)
        setOrderId('')
      } else {
        alert(`Failed to send notifications: ${response.data.message}`)
      }
    } catch (error) {
      console.error('Error sending notifications:', error)
      alert(`Error sending notifications: ${error.response?.data?.message || error.message}`)
    } finally {
      setSendingNotification(false)
    }
  }

  // Close notification modal
  const handleCloseNotificationModal = () => {
    setShowNotificationModal(false)
    setSelectedRecipients([])
    
    // Reset order ID for next order
    setOrderIdGenerated(false)
    setOrderId('')
  }

  const buildOrderSummaryContext = (id, data) => {
    if (!data && !id) {
      return []
    }
    const itemCount =
      data?.orderItems?.length ??
      data?.order_items?.length ??
      data?.items?.length ??
      null
    const rows = [
      { label: 'Order ID', value: id },
      { label: 'Given By', value: data?.givenBy },
      { label: 'Type', value: data?.type },
      { label: 'Importance', value: data?.importance },
      { label: 'Total items', value: itemCount },
      { label: 'Description', value: data?.description }
    ]
    return rows.filter(row => row.value)
  }

  const openSummaryModal = (stats, contextDetails = [], shouldRefresh = false) => {
    setSummaryModalData({
      stats,
      contextDetails
    })
    setShouldRefreshOnModalClose(shouldRefresh)
    setShowSummaryModal(true)
  }

  const handleCloseSummaryModal = () => {
    setShowSummaryModal(false)
    setSummaryModalData(null)
    
    // Refresh page if this modal was shown after successful order submission
    if (shouldRefreshOnModalClose) {
      window.location.reload()
    }
    
    setShouldRefreshOnModalClose(false)
  }

  // Show detailed log report similar to KR_ReactorReports
  const showDetailedLogReport = (result, contextDetails = [], shouldRefresh = false) => {
    const stats = result.delivery_stats || {}
    openSummaryModal(stats, contextDetails, shouldRefresh)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check if order ID is generated
    if (!orderIdGenerated || !orderId) {
      alert('Please generate an Order ID first by clicking the "Generate Order ID" button.')
      return
    }
    
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order.')
      return
    }
    if (!formData.givenBy || !formData.type || !formData.description) {
      alert(`Please fill in all required fields. Given By: "${formData.givenBy}", Type: "${formData.type}", Description: "${formData.description}"`)
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Submit order to backend using existing order ID
      const orderData = {
        orderId,
        orderItems,
        givenBy: formData.givenBy,
        type: formData.type,
        description: formData.description,
        importance: formData.importance,
        factory: 'KR'
      }
      
      const response = await axios.post(getApiUrl('submit_order'), orderData)
      
      if (response.data.success) {
        // Mark order as completed in localStorage for backup
        try {
          const completedOrders = JSON.parse(localStorage.getItem('kr_completed_orders') || '[]')
          completedOrders.push({
            orderId,
            timestamp: Date.now(),
            sessionId,
            orderData: {
              orderItems,
              givenBy: formData.givenBy,
              type: formData.type,
              description: formData.description,
              importance: formData.importance
            }
          })
          localStorage.setItem('kr_completed_orders', JSON.stringify(completedOrders))
        } catch (error) {
          console.error('Error saving completed order to localStorage:', error)
        }
        
        // Clean up current session
        cleanupSession()
        
        // Prepare order data for notification
        const notificationOrderData = {
          orderItems,
          givenBy: formData.givenBy,
          type: formData.type,
          description: formData.description,
          importance: formData.importance,
          dateTime: `${currentDate}, ${currentTime}`
        }
        
        // Reset form after successful submission
        setFormData({
          category: '',
          subCategory: '',
          materialName: '',
          specifications: '',
          uom: '',
          quantity: '',
          givenBy: '',
          type: TYPE_OPTIONS[0] || '',
          partyName: '',
          place: '',
          description: '',
          importance: 'Normal'
        })
        setOrderItems([])
        
        // Determine notification method - auto-send to all recipients if any method is enabled
        const notificationMethod = 
          enableEmailNotification && enableWhatsappNotification ? 'both' :
          enableEmailNotification ? 'email' :
          enableWhatsappNotification ? 'whatsapp' : null
        
        // If any notification method is enabled, auto-send to all recipients
        if (notificationMethod) {
          try {
            // Get sheet ID and sheet name from PLANT_DATA
            const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
            const sheetId = kerurPlant?.material_sheet_id
            
            if (!sheetId) {
              alert('❌ Error: No sheet ID found for Kerur plant configuration')
              // Reset order ID for next order
              setOrderIdGenerated(false)
              setOrderId('')
              return
            }
            
            // Send notifications automatically - backend will fetch all recipients from Google Sheets
            const autoNotificationData = {
              orderId,
              orderData: notificationOrderData,
              recipients: [], // Empty array - backend will fetch from Google Sheets
              method: notificationMethod,
              factory: 'KR',
              autoSend: true, // Flag to indicate auto-send - backend will fetch recipients
              sheetId: sheetId, // Send sheet ID to backend
              sheetName: 'Recipents List UAT' // Send sheet name to backend
            }
            
            const notifResponse = await axios.post(getApiUrl('send_order_notification'), autoNotificationData)
            
            if (notifResponse.data.success) {
              const contextDetails = buildOrderSummaryContext(
                orderId,
                notificationOrderData
              )
              showDetailedLogReport(notifResponse.data, contextDetails, true)
            } else {
              alert(`⚠️ Order ${orderId} submitted to database!\n\nHowever, notifications failed:\n${notifResponse.data.message}`)
            }
            
            // Reset order ID for next order
            setOrderIdGenerated(false)
            setOrderId('')
            
          } catch (notifError) {
            console.error('Error sending auto-notifications:', notifError)
            alert(`⚠️ Order ${orderId} submitted to database!\n\nHowever, there was an error sending notifications:\n${notifError.response?.data?.message || notifError.message}`)
            
            // Reset order ID for next order
            setOrderIdGenerated(false)
            setOrderId('')
          }
        } else {
          // If notifications disabled, just reset order ID
          // Reset order ID for next order
          setOrderIdGenerated(false)
          setOrderId('')
        }
      } else {
        alert(`Failed to submit order: ${response.data.message}`)
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      alert(`Error submitting order: ${error.response?.data?.message || error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }


  const renderItemsTable = () => (
    <table className="po-items-table">
      <thead>
        <tr>
          <th>SN</th>
          <th>Category</th>
          <th>Sub Category</th>
          <th>Material Name</th>
          <th>Specifications</th>
          <th>Quantity</th>
          <th>UOM</th>
          <th>Preferred Vendor</th>
          <th>Place</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {orderItems.map((item, index) => (
          <tr key={item.id} className={editingItem === item.id ? "po-editing-row" : ""}>
            <td data-label="S.No">{index + 1}</td>
            <td 
              data-label="Category"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'category')}
              onTouchStart={(e) => handleTouchStart(e, item, 'category')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'category')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                <SearchableSelect
                  value={editFormData.category}
                  onChange={(val) => handleEditInputChange('category', val)}
                  options={categories}
                  placeholder="Select Category"
                  className={
                    highlightedFields.includes('category')
                      ? 'po-edit-select po-error-highlight'
                      : 'po-edit-select'
                  }
                  isLoading={dataLoading}
                />
              ) : (
                item.category
              )}
            </td>
            <td 
              data-label="Sub Category"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'subCategory')}
              onTouchStart={(e) => handleTouchStart(e, item, 'subCategory')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'subCategory')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                <SearchableSelect
                  value={editFormData.subCategory}
                  onChange={(val) => handleEditInputChange('subCategory', val)}
                  options={editAvailableSubCategories}
                  placeholder={
                    !editFormData.category
                      ? 'Select Category first'
                      : editAvailableSubCategories.length === 0
                      ? 'No subcategories available'
                      : 'Select Sub Category'
                  }
                  className={
                    highlightedFields.includes('subCategory') || shouldHighlightEditSubCategory
                      ? 'po-edit-select po-error-highlight'
                      : 'po-edit-select'
                  }
                  isDisabled={
                    !editFormData.category ||
                    dataLoading ||
                    editAvailableSubCategories.length === 0
                  }
                  isLoading={dataLoading}
                />
              ) : (
                item.subCategory || '-'
              )}
            </td>
            <td 
              data-label="Material Name"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'materialName')}
              onTouchStart={(e) => handleTouchStart(e, item, 'materialName')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'materialName')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                <SearchableSelect
                  value={editFormData.materialName}
                  onChange={(val) => handleEditInputChange('materialName', val)}
                  options={editAvailableMaterialNames}
                  placeholder={editFormData.category ? 'Select Material Name' : 'Select Category first'}
                  className={
                    highlightedFields.includes('materialName') || shouldHighlightEditMaterialName
                      ? 'po-edit-select po-error-highlight'
                      : 'po-edit-select'
                  }
                  isDisabled={
                    dataLoading ||
                    editAvailableMaterialNames.length === 0 ||
                    (!editFormData.category && !editFormData.subCategory)
                  }
                  isLoading={dataLoading}
                />
              ) : (
                item.materialName
              )}
            </td>
            <td 
              data-label="Specifications"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'specifications')}
              onTouchStart={(e) => handleTouchStart(e, item, 'specifications')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'specifications')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                <SearchableSelect
                  value={editFormData.specifications}
                  onChange={(val) => handleEditInputChange('specifications', val)}
                  options={editAvailableSpecifications}
                  placeholder={
                    !editFormData.materialName
                      ? 'Select Material Name first'
                      : 'Select Specifications'
                  }
                  className={
                    highlightedFields.includes('specifications') || shouldHighlightEditSpecifications
                      ? 'po-edit-select po-error-highlight'
                      : 'po-edit-select'
                  }
                  isDisabled={
                    dataLoading ||
                    editAvailableSpecifications.length === 0 ||
                    (!editFormData.materialName && !editFormData.subCategory)
                  }
                  isLoading={dataLoading}
                />
              ) : (
                item.specifications || '-'
              )}
            </td>
            <td 
              data-label="Quantity"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'quantity')}
              onTouchStart={(e) => handleTouchStart(e, item, 'quantity')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'quantity')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                <input
                  type="text"
                  value={editFormData.quantity}
                  onChange={(e) => handleEditInputChange('quantity', e.target.value)}
                  className="po-edit-input po-quantity-input"
                  placeholder="Enter quantity"
                  pattern="[0-9]*"
                  inputMode="numeric"
                />
              ) : (
                item.quantity
              )}
            </td>
            <td 
              data-label="UOM"
              className={`po-uom-cell ${editingItem === item.id ? 'po-is-editing' : ''}`}
              title="UOM is auto-selected based on material name"
            >
              {editingItem === item.id ? (
                <input
                  type="text"
                  value={editFormData.uom}
                  readOnly
                  className="po-edit-input po-readonly-input"
                />
              ) : (
                item.uom
              )}
            </td>
            <td 
              data-label="Preferred Vendor"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'partyName')}
              onTouchStart={(e) => handleTouchStart(e, item, 'partyName')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'partyName')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                <SearchableSelect
                  value={editFormData.partyName || ''}
                  onChange={(val) => handleEditInputChange('partyName', val)}
                  options={partyNames}
                  placeholder={partyLoading ? 'Loading...' : 'Select Preferred Vendor'}
                  className="po-edit-select"
                  isDisabled={partyLoading}
                  isLoading={partyLoading}
                />
              ) : (
                item.partyName || '-'
              )}
            </td>
            <td 
              data-label="Place"
              className={editingItem === item.id ? "po-editing-cell" : "po-editable-cell"}
              onDoubleClick={() => handleDoubleClickEdit(item, 'place')}
              onTouchStart={(e) => handleTouchStart(e, item, 'place')}
              onTouchEnd={(e) => handleTouchEnd(e, item, 'place')}
              onTouchMove={handleTouchMove}
              title={editingItem === item.id ? "" : "Double-click or long press to edit"}
            >
              {editingItem === item.id ? (
                (() => {
                  const availablePlaces = getPlacesForParty(editFormData.partyName)
                  const hasMultiplePlaces = availablePlaces.length > 1
                  
                  if (hasMultiplePlaces) {
                    return (
                      <select
                        value={editFormData.place || ''}
                        onChange={(e) => handleEditInputChange('place', e.target.value)}
                        className="po-edit-select"
                        disabled={!editFormData.partyName || placesLoading}
                      >
                        <option value="">
                          {placesLoading ? 'Loading...' : 'Select Place'}
                        </option>
                        {availablePlaces.map((place) => (
                          <option key={place} value={place}>
                            {place}
                          </option>
                        ))}
                      </select>
                    )
                  } else {
                    return (
                      <input
                        type="text"
                        value={editFormData.place || ''}
                        readOnly
                        className="po-edit-input po-readonly-input"
                        placeholder="Place"
                        title={editFormData.partyName ? "Place is auto-selected based on preferred vendor" : "Select preferred vendor first"}
                      />
                    )
                  }
                })()
              ) : (
                item.place || '-'
              )}
            </td>
            <td data-label="Action">
              {editingItem === item.id ? (
                <div className="po-edit-actions-vertical">
                  <div className="po-edit-actions-row">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="po-save-edit-btn"
                      title="Save changes"
                      aria-label="Save"
                    >
                      <span className="po-btn-icon" aria-hidden="true">✔</span>
                      <span className="po-sr-only">Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="po-cancel-edit-btn"
                      title="Cancel edit"
                      aria-label="Cancel"
                    >
                      <span className="po-btn-icon" aria-hidden="true">×</span>
                      <span className="po-sr-only">Cancel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="po-remove-item-btn"
                      title="Remove item"
                      aria-label="Delete"
                    >
                      <span className="po-btn-icon po-icon-trash" aria-hidden="true"></span>
                      <span className="po-sr-only">Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="po-action-buttons-row">
                  <button
                    type="button"
                    onClick={() => handleEditItem(item)}
                    className="po-edit-item-btn"
                    title="Edit item"
                    aria-label="Edit"
                  >
                  <span className="po-btn-icon po-icon-edit" aria-hidden="true"></span>
                    <span className="po-sr-only">Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="po-remove-item-btn"
                    title="Remove item"
                    aria-label="Delete"
                  >
                    <span className="po-btn-icon po-icon-trash" aria-hidden="true"></span>
                    <span className="po-sr-only">Delete</span>
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  if (dataLoading) {
    return (
      <div className="po-place_order-container">
        <div className="po-form-header">
          <div className="po-header-left">
            <DateTimePicker
              value={{ date: currentDate, time: currentTime }}
              onChange={handleDateTimeChange}
              maxDate={getTodayDateString()}
              disabled={dataLoading}
            />
          </div>
          <div className="po-header-center">
            <h2>Material Order Form</h2>
          </div>
          <div className="po-header-right">
            <div className="po-order-id-section">
              <button 
                type="button"
                className="po-generate-order-id-btn"
                onClick={handleGenerateOrderId}
                title="Click to generate Order ID"
                disabled={dataLoading}
              >
                {dataLoading ? 'Loading...' : 'Generate Order ID'}
              </button>
            </div>
          </div>
        </div>
        <div className="po-loading-message">
          <p>Loading material data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="po-place_order-container">
      {/* Screen Flash Overlay */}
      {showScreenFlash && <div className="po-screen-flash-overlay" />}
      {/* Loading Spinner */}
      {isSubmitting && <LoadingSpinner />}
      
      {/* Back Button Section - Always at top-left */}
      <BackButton label="Back to Store" to="/kerur/kr_store" />
      
      <div className="po-form-header">
        <div className="po-header-left">
          <DateTimePicker
            value={{ date: currentDate, time: currentTime }}
            onChange={handleDateTimeChange}
            maxDate={getTodayDateString()}
          />
        </div>
        <div className="po-header-center">
          <h2>Material Order Form</h2>
        </div>
        <div className="po-header-right">
          <div className="po-order-id-section">
            {orderIdGenerated ? (
              <div className="po-order-id-display">
                <span className="po-order-id-label">Order ID:</span>
                <span className="po-order-id-value">{orderId}</span>
              </div>
            ) : (
              <button 
                type="button"
                className="po-generate-order-id-btn"
                onClick={handleGenerateOrderId}
                title="Click to generate Order ID"
              >
                Generate Order ID
              </button>
            )}
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="po-material-form">

        {/* Added Items Table - Desktop view at top */}
        {orderItems.length > 0 && (
          <div className="po-added-items-top-section">
            {/* Desktop View: Show Table */}
            <div className="po-items-table-container po-desktop-table" ref={itemsTableContainerRef}>
              <h3>Added Items</h3>
              {renderItemsTable()}
            </div>
          </div>
        )}

        {/* Mobile Full-Screen Items Sheet */}
        {showItemsSheet && orderItems.length > 0 && (
          <div className="po-items-sheet-overlay" onClick={closeItemsSheet}>
            <div className="po-items-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="po-items-sheet-header">
                <h3>Added Items ({orderItems.length})</h3>
                <button
                  type="button"
                  className="po-items-sheet-close-btn"
                  onClick={closeItemsSheet}
                  title="Close"
                >
                  ×
                </button>
              </div>
              <div className="po-items-sheet-body">
                <div className="po-items-table-container po-mobile-table">
                  {renderItemsTable()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="po-form-main-content">
          {/* Left Section - Form Inputs */}
          <div className="po-form-left-section" ref={materialInputSectionRef}>
            {/* Form inputs for adding new item - Only show when no items exist */}
            {orderItems.length === 0 && (
              <div className="po-add-item-section">
                <h3 className="po-add-item-header">
                  Add Item to Order
                </h3>
                <p className="po-add-item-description">
                  Fill in the required fields below to add your first item to the order.
                </p>
              </div>
            )}
            <div className="po-form-row">
              {/* Category - Required only if no items exist */}
              <div className="po-form-group" ref={categoryInputRef}>
            <label htmlFor="category" className="required">
              Category
            </label>
            <SearchableSelect
              id="category"
              value={formData.category}
              onChange={(val) => handleInputChange('category', val)}
              options={categories}
              placeholder={dataLoading ? 'Loading categories...' : 'Select Category'}
              isDisabled={dataLoading}
              isLoading={dataLoading}
              required={orderItems.length === 0}
              className={highlightedFields.includes('category') ? 'po-error-highlight' : ''}
            />
          </div>

          {/* Sub Category - Optional */}
          <div className="po-form-group">
            <label htmlFor="subCategory">Sub Category</label>
            <SearchableSelect
              id="subCategory"
              value={formData.subCategory}
              onChange={(val) => handleInputChange('subCategory', val)}
              options={availableSubCategories}
              placeholder={
                !formData.category
                  ? 'Select Category first'
                  : availableSubCategories.length === 0
                  ? 'No subcategories available'
                  : 'Select Sub Category'
              }
              isDisabled={
                !formData.category ||
                dataLoading ||
                availableSubCategories.length === 0
              }
              isLoading={dataLoading}
              className={
                highlightedFields.includes('subCategory') || shouldHighlightSubCategory
                  ? 'po-error-highlight'
                  : formData.subCategory
                  ? 'po-optional-field-green'
                  : ''
              }
            />
          </div>


          {/* Material Name - Required only if no items exist */}
          <div className="po-form-group" ref={materialNameInputRef}>
            <label htmlFor="materialName" className="required">
              Material Name
            </label>
            <SearchableSelect
              id="materialName"
              value={formData.materialName}
              onChange={(val) => handleInputChange('materialName', val)}
              options={availableMaterialNames}
              placeholder={dataLoading ? 'Loading materials...' : 'Select Material Name'}
              // Disable if no options available or no driving selection
              isDisabled={
                dataLoading ||
                availableMaterialNames.length === 0 ||
                (!formData.category && !formData.subCategory)
              }
              isLoading={dataLoading}
              required={orderItems.length === 0}
              className={
                highlightedFields.includes('materialName') || shouldHighlightMaterialName
                  ? 'po-error-highlight'
                  : ''
              }
            />
          </div>
        </div>

        {/* Second Row: Specifications, Quantity, UOM, Add Item Button */}
        <div className="po-form-row">
          {/* Specifications - Optional */}
          <div className="po-form-group">
            <label htmlFor="specifications">Specifications</label>
            <SearchableSelect
              id="specifications"
              value={formData.specifications}
              onChange={(val) => handleInputChange('specifications', val)}
              options={availableSpecifications}
              placeholder={
                !formData.category
                  ? 'Select Category first'
                  : !formData.materialName
                  ? 'Select Material Name first'
                  : (() => {
                      return availableSpecifications.length === 0
                        ? 'No specifications available'
                        : 'Select Specifications'
                    })()
              }
              isDisabled={(() => {
                if (dataLoading) return true
                if (!formData.materialName && !formData.subCategory) return true
                return availableSpecifications.length === 0
              })()}
              isLoading={dataLoading}
              className={
                highlightedFields.includes('specifications') || shouldHighlightSpecifications
                  ? 'po-error-highlight'
                  : formData.specifications
                  ? 'po-optional-field-green'
                  : ''
              }
            />
          </div>

          {/* Quantity - Required only if no items exist */}
          <div className="po-form-group">
            <label htmlFor="quantity" className="required">
              Quantity
            </label>
            <input
              type="text"
              id="quantity"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              required={orderItems.length === 0}
              className={`po-form-input po-quantity-input ${highlightedFields.includes('quantity') ? 'po-error-highlight' : ''}`}
              placeholder="Enter quantity"
              pattern="[0-9]*"
              inputMode="numeric"
              ref={quantityInputRef}
            />
          </div>

          {/* UOM - Auto-selected (Read-only) */}
          <div className="po-form-group">
            <label htmlFor="uom" className="required">
              UOM
            </label>
            <input
              type="text"
              id="uom"
              value={formData.uom}
              readOnly
              required={orderItems.length === 0}
              className={`po-form-input po-readonly-input ${highlightedFields.includes('uom') ? 'po-error-highlight' : ''}`}
              placeholder="UOM"
              ref={uomInputRef}
            />
          </div>
        </div>

        {/* Third Row: Preferred Vendor and Place (Optional, Per Item) */}
        <div className="po-form-row">
          {/* Preferred Vendor - Optional */}
          <div className="po-form-group">
            <label htmlFor="partyName">Preferred Vendor</label>
            <SearchableSelect
              id="partyName"
              value={formData.partyName}
              onChange={(val) => handleInputChange('partyName', val)}
              options={partyNames}
              placeholder={
                partyLoading
                  ? 'Loading party names...'
                  : partyNames.length === 0
                  ? 'No party names available'
                  : 'Select Preferred Vendor'
              }
              isDisabled={partyLoading}
              isLoading={partyLoading}
            />
          </div>

          {/* Place - Optional */}
          <div className="po-form-group">
            <label htmlFor="place">Place</label>
            {(() => {
              const availablePlaces = getPlacesForParty(formData.partyName)
              const hasMultiplePlaces = availablePlaces.length > 1
              
              // Show dropdown if multiple places, read-only input if single place
              if (hasMultiplePlaces) {
                return (
                  <select
                    id="place"
                    value={formData.place}
                    onChange={(e) => handleInputChange('place', e.target.value)}
                    className="po-form-select"
                    disabled={!formData.partyName || placesLoading}
                  >
                    <option value="">
                      {placesLoading ? 'Loading places...' : places.length === 0 ? 'No places available' : 'Select Place'}
                    </option>
                    {availablePlaces.map((place) => (
                      <option key={place} value={place}>
                        {place}
                      </option>
                    ))}
                  </select>
                )
              } else {
                return (
                  <input
                    type="text"
                    id="place"
                    value={formData.place}
                    readOnly
                    className="po-form-input po-readonly-input"
                    placeholder={placesLoading ? 'Loading places...' : 'Place'}
                    title={formData.partyName ? "Place is auto-selected based on preferred vendor" : "Select preferred vendor first"}
                  />
                )
              }
            })()}
          </div>
        </div>

        {/* Fourth Row: Add Item Button and Reset Button */}
        <div className="po-form-row">
          {/* Add Item Button */}
          <div className="po-form-group po-add-item-group">
            <label>&nbsp;</label>
            <div className="po-add-item-buttons-container">
              <button
                type="button"
                onClick={handleResetAddItemFields}
                className="po-reset-item-btn"
                title="Reset add item fields"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="po-add-item-btn"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Mobile View: View Added Items Button - Below Add Item Button */}
        {orderItems.length > 0 && (
          <div className="po-form-row">
            <div className="po-form-group po-mobile-items-button-container">
              <label>&nbsp;</label>
              <button
                type="button"
                className="po-view-items-btn"
                onClick={() => setShowItemsSheet(true)}
              >
                <span className="po-items-count-badge">{orderItems.length}</span>
                <span className="po-view-items-text">View Added Items</span>
              </button>
            </div>
          </div>
        )}

        {/* Additional Order Information */}
        <div className="po-form-row">
          {/* Given By - Required */}
          <div className="po-form-group">
            <label htmlFor="givenBy" className="required">Given By</label>
            <SearchableSelect
              id="givenBy"
              value={formData.givenBy}
              onChange={(val) => handleInputChange('givenBy', val)}
              options={authorityNames}
              placeholder={authorityLoading ? 'Loading authority names...' : 'Select Authority Name'}
              isDisabled={authorityLoading}
              isLoading={authorityLoading}
              required
            />
          </div>

          {/* Type - Required */}
          <div className="po-form-group">
            <label htmlFor="type" className="required">Type</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              required
              className="po-form-select"
            >
              {TYPE_OPTIONS.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          </div>

          {/* Importance - Required */}
          <div className="po-form-group">
            <label htmlFor="importance" className="required">Importance</label>
            <select
              id="importance"
              value={formData.importance}
              onChange={(e) => handleInputChange('importance', e.target.value)}
              required
              className="po-form-select"
            >
        {IMPORTANCE_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description - Full Width */}
        <div className="po-form-row">
          <div className="po-form-group po-full-width">
            <label htmlFor="description" className="required">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              required
              className="po-form-textarea"
              placeholder="Enter detailed description of the order requirements"
              rows="4"
            />
          </div>
        </div>

        {/* Notification Settings */}
        <div className="po-notification-section">
          <h2>Notification Methods</h2>
          <div className="po-toggle-container">
            <div className="po-toggle-item">
              <label className="po-toggle">
                <input
                  type="checkbox"
                  checked={enableEmailNotification}
                  onChange={(e) => setEnableEmailNotification(e.target.checked)}
                />
                <span className="po-toggle-slider"></span>
              </label>
              <span className="po-toggle-label">Send via Email</span>
            </div>

            <div className="po-toggle-item">
              <label className="po-toggle">
                <input
                  type="checkbox"
                  checked={enableWhatsappNotification}
                  onChange={(e) => setEnableWhatsappNotification(e.target.checked)}
                />
                <span className="po-toggle-slider"></span>
              </label>
              <span className="po-toggle-label">Send via WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Form Validation Errors - Hide during submission and when summary modal is open */}
        {!isSubmitting && !showSummaryModal && (
          <FormValidationErrors 
            errors={formValidationErrors} 
            checkWhatsApp={enableWhatsappNotification}
            checkEmail={enableEmailNotification}
            notificationSelectionRequired={true}
            notificationSelectionMade={enableEmailNotification || enableWhatsappNotification}
            hasPendingItemDetails={hasPendingItemDetails}
            onErrorsChange={(errors) => setFormHasBlockingErrors(errors.length > 0)}
          />
        )}

        {/* Action Buttons */}
        {(() => {
          const baseRequirementsMet = orderItems.length > 0 && formData.givenBy && formData.type && formData.description
          const isSubmitDisabled = formHasBlockingErrors || !baseRequirementsMet
          const buttonTitle = formHasBlockingErrors
            ? 'Resolve all form errors before submitting'
            : !orderItems.length
              ? 'Add at least one item to place order'
              : (!formData.givenBy || !formData.type || !formData.description)
                ? 'Fill in Given By, Type, and Description'
                : 'Ready to submit'

          return (
            <div className="po-form-actions">
              <button 
                type="submit" 
                className={`po-submit-btn ${!isSubmitDisabled ? 'po-ready-to-submit' : 'disabled'}`}
                disabled={isSubmitDisabled}
                title={buttonTitle}
              >
                Place Order {!isSubmitDisabled ? '✓' : ''}
              </button>
              <button type="button" className="po-reset-btn" onClick={() => {
                // Reset form but keep the same order ID
                setFormData({
                  category: '',
                  subCategory: '',
                  materialName: '',
                  specifications: '',
                  uom: '',
                  quantity: '',
                  partyName: '',
                  place: '',
                  givenBy: '',
                  type: TYPE_OPTIONS[0] || '',
                  description: '',
                  importance: 'Normal'
                })
                setOrderItems([])
                
                alert(`Form reset! Order ID ${orderId} remains the same.`)
              }}>Reset</button>
            </div>
          )
        })()}
          </div>
        </div>
      </form>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="po-notification-modal-overlay">
          <div className="po-notification-modal">
            <div className="po-notification-modal-header">
              <h3>Send Order Notification</h3>
              <button 
                className="po-modal-close-btn"
                onClick={handleCloseNotificationModal}
                title="Close modal"
              >
                ×
              </button>
            </div>

            <div className="po-notification-modal-body">
              <div className="po-order-summary">
                <h4>Order Summary</h4>
                <div className="po-summary-item">
                  <strong>Order ID:</strong> {lastSubmittedOrderId}
                </div>
                <div className="po-summary-item">
                  <strong>Date & Time:</strong> {lastSubmittedOrderData?.dateTime}
                </div>
                <div className="po-summary-item">
                  <strong>Given By:</strong> {lastSubmittedOrderData?.givenBy}
                </div>
                <div className="po-summary-item">
                  <strong>Type:</strong> {lastSubmittedOrderData?.type}
                </div>
                <div className="po-summary-item">
                  <strong>Importance:</strong> {lastSubmittedOrderData?.importance}
                </div>
                <div className="po-summary-item">
                  <strong>Items Count:</strong> {lastSubmittedOrderData?.orderItems?.length || 0}
                </div>
              </div>

              <div className="po-notification-method-section">
                <h4>Notification Method</h4>
                <div className="po-notification-method-display">
                  {notificationMethod === 'both' && (
                    <div className="po-method-badge po-both">
                      <span>📧</span> Email & <span>📱</span> WhatsApp
                    </div>
                  )}
                  {notificationMethod === 'email' && (
                    <div className="po-method-badge po-email">
                      <span>📧</span> Email Only
                    </div>
                  )}
                  {notificationMethod === 'whatsapp' && (
                    <div className="po-method-badge po-whatsapp">
                      <span>📱</span> WhatsApp Only
                    </div>
                  )}
                </div>
              </div>

              <div className="po-recipients-section">
                <div className="po-recipients-header">
                  <h4>Select Recipients</h4>
                  <button 
                    className="po-select-all-btn"
                    onClick={handleSelectAllRecipients}
                    type="button"
                  >
                    {selectedRecipients.length === recipients.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {recipientsLoading ? (
                  <div className="po-recipients-loading">
                    <p>Loading recipients...</p>
                  </div>
                ) : recipients.length === 0 ? (
                  <div className="po-recipients-empty">
                    <p>No recipients found</p>
                  </div>
                ) : (
                  <div className="po-recipients-list">
                    {recipients.map((recipient, index) => (
                      <label key={index} className="po-recipient-item">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.some(r => r['Email ID - To'] === recipient['Email ID - To'])}
                          onChange={() => handleRecipientToggle(recipient)}
                        />
                        <div className="po-recipient-info">
                          <div className="po-recipient-name">{recipient.Name}</div>
                          {recipient['Email ID - To'] && (
                            <div className="po-recipient-detail">
                              <span className="po-recipient-icon">📧</span>
                              <span className="po-recipient-label">To:</span> {recipient['Email ID - To']}
                            </div>
                          )}
                          {recipient['Email ID - CC'] && (
                            <div className="po-recipient-detail po-recipient-cc">
                              <span className="po-recipient-icon">📋</span>
                              <span className="po-recipient-label">CC:</span> {recipient['Email ID - CC']}
                            </div>
                          )}
                          {recipient['Email ID - BCC'] && (
                            <div className="po-recipient-detail po-recipient-bcc">
                              <span className="po-recipient-icon">🔒</span>
                              <span className="po-recipient-label">BCC:</span> {recipient['Email ID - BCC']}
                            </div>
                          )}
                          {recipient['Contact No.'] && (
                            <div className="po-recipient-detail">
                              <span className="po-recipient-icon">📱</span>
                              {recipient['Contact No.']}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="po-selected-count">
                Selected: {selectedRecipients.length} of {recipients.length} recipients
              </div>
            </div>

            <div className="po-notification-modal-footer">
              <button
                className="po-send-notification-btn"
                onClick={handleSendNotifications}
                disabled={sendingNotification || selectedRecipients.length === 0}
              >
                {sendingNotification ? 'Sending...' : 'Send Notifications'}
              </button>
              <button
                className="po-skip-notification-btn"
                onClick={handleCloseNotificationModal}
                disabled={sendingNotification}
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}
      <NotificationSummaryModal
        isOpen={showSummaryModal}
        onClose={handleCloseSummaryModal}
        stats={summaryModalData?.stats}
        contextDetails={summaryModalData?.contextDetails}
        buttonText="OK"
        headerTitle={(() => {
          const orderIdEntry = summaryModalData?.contextDetails?.find(item => item.label === 'Order ID')
          return orderIdEntry?.value ? `Order ${orderIdEntry.value} Submitted Successfully!` : undefined
        })()}
        headerSubtitle={(() => {
          const orderIdEntry = summaryModalData?.contextDetails?.find(item => item.label === 'Order ID')
          return orderIdEntry?.value ? 'The order has been placed and all recipients have been notified.' : undefined
        })()}
      />
    </div>
  )
}

export default KR_PlaceOrder

