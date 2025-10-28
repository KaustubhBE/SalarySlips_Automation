import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../PlaceOrder.css'
import LoadingSpinner from '../../LoadingSpinner'

// Constants
const UOM_OPTIONS = ['kgs', 'nos', 'meters', 'pieces', 'liters']
const IMPORTANCE_OPTIONS = ['Normal', 'Urgent', 'Very-Urgent']
const LONG_PRESS_DURATION = 500 // 500ms for long press
const TOUCH_MOVE_THRESHOLD = 10 // pixels
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

// Utility Functions
const formatDateTime = (date) => {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

const generateFallbackOrderId = () => {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear() % 100
  const timestamp = now.getTime()
  return `KR_${month.toString().padStart(2, '0')}${year.toString().padStart(2, '0')}-${(timestamp % 10000).toString().padStart(4, '0')}`
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
    return null;
  }

  const materialNames = categoryData.materialNames;
  const materialNameArray = []; // Collect material names first

  // Structure 1: Simple Array (no subcategories, no specifications)
  if (Array.isArray(materialNames)) {
    // For simple arrays, only show materials if NO subcategory is selected
    // If subcategory is selected but data is simple array, return empty (invalid subcategory)
    if (!subCategory) {
      materialNames.forEach(material => {
        const name = typeof material === 'string' ? material : material.name;
        if (name) {
          materialNameArray.push(name);
        }
      });
    }
  }
  // Structure 2 & 3: Object-based (has specifications or subcategories)
  else if (typeof materialNames === 'object') {
    // STRICT FILTERING: If subcategory is selected, show ONLY materials from that subcategory
    if (subCategory && subCategory.trim() !== '' && materialNames[subCategory]) {
      const subCategoryData = materialNames[subCategory];
      
      // If subcategory data is an array (direct materials under subcategory)
      if (Array.isArray(subCategoryData)) {
        subCategoryData.forEach(material => {
          const name = typeof material === 'string' ? material : material.name;
          if (name) {
            materialNameArray.push(name);
          }
        });
      }
      // If subcategory data is an object (has specifications under subcategory)
      else if (typeof subCategoryData === 'object') {
        Object.values(subCategoryData).forEach(specMaterials => {
          if (Array.isArray(specMaterials)) {
            specMaterials.forEach(material => {
              const name = typeof material === 'string' ? material : material.name;
              if (name) {
                materialNameArray.push(name);
              }
            });
          }
        });
      }
    } else {
      // STRICT FILTERING: If no subcategory selected, show ONLY materials NOT under any subcategory
      if (!subCategory || subCategory.trim() === '') {
      // Check for materials directly under category (not under any subcategory)
      // Look for empty string key or 'default' key that might contain top-level materials
      const topLevelKeys = ['', 'default', 'others', 'general'];
      
      for (const key of topLevelKeys) {
        if (materialNames[key]) {
          const topLevelData = materialNames[key];
          
          if (Array.isArray(topLevelData)) {
            topLevelData.forEach(material => {
              const name = typeof material === 'string' ? material : material.name;
              if (name) {
                materialNameArray.push(name);
              }
            });
          } else if (typeof topLevelData === 'object') {
            Object.values(topLevelData).forEach(specMaterials => {
              if (Array.isArray(specMaterials)) {
                specMaterials.forEach(material => {
                  const name = typeof material === 'string' ? material : material.name;
                  if (name) {
                    materialNameArray.push(name);
                  }
                });
              }
            });
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
            const materials = materialNames[key];
            
            // If this key contains an array of materials (direct specification -> materials)
            if (Array.isArray(materials)) {
              materials.forEach(material => {
                const name = typeof material === 'string' ? material : material.name;
                if (name) {
                  materialNameArray.push(name);
                }
              });
            }
            // If this key contains nested objects (specification -> more specifications -> materials)
            else if (typeof materials === 'object') {
              Object.values(materials).forEach(specMaterials => {
                if (Array.isArray(specMaterials)) {
                  specMaterials.forEach(material => {
                    const name = typeof material === 'string' ? material : material.name;
                    if (name) {
                      materialNameArray.push(name);
                    }
                  });
                }
              });
            }
          }
        });
      }
      }
    }
  }

  // Remove duplicates and create unique material names
  const uniqueMaterialNames = [...new Set(materialNameArray)];

  // Convert to JSX options
  const options = uniqueMaterialNames.map(name => (
    <option key={name} value={name}>{name}</option>
  ));
  return options.length > 0 ? options : null;
};

/**
 * Get specifications for a selected material
 * Returns array of specification names where the material exists
 */
const getSpecificationsForMaterial = (categoryData, materialName, subCategory) => {
  if (!categoryData || !materialName || !categoryData.materialNames) return [];

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
      
      // If subcategory has specifications (object)
      if (typeof subCategoryData === 'object') {
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

  return Array.from(specifications);
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
const fetchMaterialUomFromBackend = async (category, subCategory, specifications, materialName) => {
  try {
    const payload = {
      category: category,
      subCategory: subCategory || '',
      specifications: specifications || '',
      materialName: materialName,
      department: 'KR'
    }

    console.log('Fetching UOM from backend with payload:', payload)
    const response = await axios.post(getApiUrl('get_material_details'), payload)
    console.log('UOM fetch response:', response.data)
    
    if (response.data.success) {
      const material = response.data.material
      return material.uom
    } else {
      console.warn('Material not found in database for UOM fetch:', response.data.message)
      // If material not found, try to find it without specifications
      if (specifications) {
        console.log('Retrying UOM fetch without specifications...')
        const retryPayload = {
          category: category,
          subCategory: subCategory || '',
          specifications: '',
          materialName: materialName,
          department: 'KR'
        }
        
        const retryResponse = await axios.post(getApiUrl('get_material_details'), retryPayload)
        if (retryResponse.data.success) {
          const material = retryResponse.data.material
          return material.uom
        }
      }
    }
  } catch (error) {
    console.error('Error fetching UOM from backend:', error)
  }
  return null
}

// Custom Hook for Material Data
const useMaterialData = () => {
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const fetchMaterialData = async () => {
    try {
      setDataLoading(true)
      const response = await axios.get(getApiUrl('get_material_data'), {
        params: { factory: 'KR' }
      })
      
      if (response.data.success) {
        setMaterialData(response.data.data)
        setCategories(Object.keys(response.data.data))
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
  const navigate = useNavigate()
  
  // State Management
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    materialName: '',
    specifications: '',
    uom: '',
    quantity: '',
    givenBy: '',
    description: '',
    importance: 'Normal'
  })

  const [orderItems, setOrderItems] = useState([])
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [orderId, setOrderId] = useState('')
  const [orderIdGenerated, setOrderIdGenerated] = useState(false)
  const [authorityNames, setAuthorityNames] = useState([])
  const [authorityLoading, setAuthorityLoading] = useState(true)
  
  // Recipients functionality
  const [recipients, setRecipients] = useState([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [notificationMethod, setNotificationMethod] = useState('both') // 'email', 'whatsapp', 'both'
  const [sendingNotification, setSendingNotification] = useState(false)
  const [lastSubmittedOrderId, setLastSubmittedOrderId] = useState(null)
  const [lastSubmittedOrderData, setLastSubmittedOrderData] = useState(null)
  const [enableEmailNotification, setEnableEmailNotification] = useState(true)
  const [enableWhatsappNotification, setEnableWhatsappNotification] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit functionality
  const [editingItem, setEditingItem] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  
  // Touch functionality for mobile
  const [touchStartTime, setTouchStartTime] = useState(null)
  const [touchStartPosition, setTouchStartPosition] = useState(null)

  // Custom Hooks
  const { materialData, categories, dataLoading, fetchMaterialData } = useMaterialData()
  const { sessionId, registerSession, cleanupSession, cleanupOldSessions } = useSessionManagement()

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
          sheet_name: 'Authority List',
          sheet_id: sheetId
        }
      })
      
      if (response.data.success) {
        setAuthorityNames(response.data.data)
      } else {
        console.error('Failed to load authority list:', response.data.error)
      }
    } catch (error) {
      console.error('Error fetching authority list:', error)
    } finally {
      setAuthorityLoading(false)
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
          sheet_name: 'Recipents List',
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
      console.log('Generating order ID from backend...')
      const response = await axios.post(getApiUrl('get_next_order_id'), {
        factory: 'KR'
      })
      
      if (response.data.success) {
        console.log('Backend generated order ID:', response.data.orderId)
        setOrderId(response.data.orderId)
        setOrderIdGenerated(true)
        registerSession(response.data.orderId)
      } else {
        console.error('Backend failed to generate order ID:', response.data.message)
        const fallbackId = generateFallbackOrderId()
        console.log('Using fallback order ID:', fallbackId)
        setOrderId(fallbackId)
        setOrderIdGenerated(true)
        registerSession(fallbackId)
      }
    } catch (error) {
      console.error('Error generating order ID from backend:', error)
      const fallbackId = generateFallbackOrderId()
      console.log('Using fallback order ID due to error:', fallbackId)
      setOrderId(fallbackId)
      setOrderIdGenerated(true)
      registerSession(fallbackId)
    }
  }

  // Effects
  useEffect(() => {
    // Fetch material data first
    fetchMaterialData()
    fetchAuthorityList()
    fetchRecipientsList()
    
    // Update current date/time
    const updateDateTime = () => {
      setCurrentDateTime(new Date())
    }
    
    // Clean up old sessions
    cleanupOldSessions()
    
    updateDateTime()
    
    // Update time every second for live clock
    const interval = setInterval(updateDateTime, 1000)
    
    // Cleanup on component unmount
    return () => {
      clearInterval(interval)
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

  const handleInputChange = (field, value) => {
    // For quantity field, only allow numeric input
    if (field === 'quantity' && !validateNumericInput(value)) {
      return // Don't update if input is not numeric
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
        })
      }

      // NEW UOM LOGIC:
      // 1. When material name is selected, check if specifications exist
      //    - If NO specifications: Fetch UOM immediately (without specifications)
      //    - If specifications exist: Wait for user to select specification
      // 2. When specification is manually selected: Fetch UOM with the selected specification
      
      if (field === 'materialName' && value && newFormData.category) {
        const categoryData = materialData[newFormData.category]
        if (categoryData) {
          const availableSpecs = getSpecificationsForMaterial(categoryData, value, newFormData.subCategory)
          
          // If NO specifications available, fetch UOM immediately (without specifications)
          if (availableSpecs.length === 0) {
            setTimeout(() => {
              fetchMaterialUomFromBackend(
                newFormData.category,
                newFormData.subCategory || '',
                '',
                value
              ).then(backendUom => {
                if (backendUom) {
                  setFormData(prev => ({
                    ...prev,
                    uom: backendUom
                  }))
                }
              })
            }, 100)
          }
          // If specifications exist, don't fetch yet - wait for user to select specification
        }
      }
      
      // When specifications are manually selected, fetch UOM from backend
      if (field === 'specifications' && value && newFormData.category && newFormData.materialName) {
        setTimeout(() => {
          fetchMaterialUomFromBackend(
            newFormData.category,
            newFormData.subCategory || '',
            value,
            newFormData.materialName
          ).then(backendUom => {
            if (backendUom) {
              setFormData(prev => ({
                ...prev,
                uom: backendUom
              }))
            }
          })
        }, 100)
      }

      return newFormData
    })
  }

  const handleAddItem = () => {
    // If no fields are filled, don't add anything (optional behavior)
    if (!formData.category && !formData.materialName && !formData.uom && !formData.quantity) {
      return // Silently return if no fields are filled
    }
    
    // If some fields are filled but not all required ones, show validation
    if (formData.category || formData.materialName || formData.uom || formData.quantity) {
      if (!formData.category || !formData.materialName || !formData.uom || !formData.quantity) {
        alert('Please fill in all required fields (Category, Material Name, UOM, and Quantity) before adding an item.')
        return
      }
    }

    const newItem = {
      id: Date.now(), // Simple ID generation
      category: formData.category,
      subCategory: formData.subCategory,
      materialName: formData.materialName,
      specifications: formData.specifications,
      uom: formData.uom,
      quantity: formData.quantity
    }

    setOrderItems(prev => [...prev, newItem])
    
    // Reset only the item-specific fields after adding item, preserve order details
    setFormData(prev => ({
      ...prev,
      category: '',
      subCategory: '',
      materialName: '',
      specifications: '',
      uom: '',
      quantity: ''
      // Keep givenBy, description, and importance unchanged
    }))
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
      quantity: item.quantity
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
      quantity: item.quantity
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
    target.classList.add('touch-active')
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
    target.classList.remove('touch-active')

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
        target.classList.remove('touch-active')
        
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
        })
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
        sheetName: 'Recipents List' // Send sheet name to backend
      }

      const response = await axios.post(getApiUrl('send_order_notification'), notificationData)

      if (response.data.success) {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Check if order ID is generated
    if (!orderIdGenerated || !orderId) {
      alert('Please generate an Order ID first by clicking the "Generate Order ID" button.')
      return
    }
    
    // Debug logging
    console.log('Form submission attempt:', {
      orderId,
      orderItems: orderItems.length,
      givenBy: formData.givenBy,
      description: formData.description,
      formData: formData
    })
    
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order.')
      return
    }
    if (!formData.givenBy || !formData.description) {
      alert(`Please fill in all required fields. Given By: "${formData.givenBy}", Description: "${formData.description}"`)
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Submit order to backend using existing order ID
      const orderData = {
        orderId,
        orderItems,
        givenBy: formData.givenBy,
        description: formData.description,
        importance: formData.importance,
        factory: 'KR'
      }
      
      console.log('Submitting order data:', orderData)
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
              description: formData.description,
              importance: formData.importance
            }
          })
          localStorage.setItem('kr_completed_orders', JSON.stringify(completedOrders))
        } catch (error) {
          console.error('Error saving completed order to localStorage:', error)
        }
        
        console.log('Order submitted successfully:', {
          orderId,
          orderItems,
          givenBy: formData.givenBy,
          description: formData.description,
          importance: formData.importance
        })
        
        // Clean up current session
        cleanupSession()
        
        // Prepare order data for notification
        const notificationOrderData = {
          orderItems,
          givenBy: formData.givenBy,
          description: formData.description,
          importance: formData.importance,
          dateTime: formatDateTime(new Date())
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
          description: '',
          importance: 'Normal'
        })
        setOrderItems([])
        
        // Determine notification method
        const bothEnabled = enableEmailNotification && enableWhatsappNotification
        const emailOnly = enableEmailNotification && !enableWhatsappNotification
        const whatsappOnly = !enableEmailNotification && enableWhatsappNotification
        
        // If both notifications are enabled, auto-send to all recipients
        if (bothEnabled) {
          try {
            console.log('Auto-sending notifications to all recipients from Google Sheets...')
            
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
              method: 'both',
              factory: 'KR',
              autoSend: true, // Flag to indicate auto-send - backend will fetch recipients
              sheetId: sheetId, // Send sheet ID to backend
              sheetName: 'Recipents List' // Send sheet name to backend
            }
            
            const notifResponse = await axios.post(getApiUrl('send_order_notification'), autoNotificationData)
            
            if (notifResponse.data.success) {
              const stats = notifResponse.data.delivery_stats
              alert(`✅ Order ${orderId} Submitted Successfully!\n\n📊 Notification Summary:\n✅ Sent: ${stats.successful_deliveries}/${stats.total_recipients} recipients\n❌ Failed: ${stats.failed_deliveries}\n\nThe order has been placed and all recipients have been notified.`)
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
        } 
        // If only one notification method is enabled, show modal for recipient selection
        else if (emailOnly || whatsappOnly) {
          // Save order data for notification modal
          setLastSubmittedOrderId(orderId)
          setLastSubmittedOrderData(notificationOrderData)
          
          // Set notification method based on toggles
          setNotificationMethod(emailOnly ? 'email' : 'whatsapp')
          
          alert(`Order ${orderId} submitted successfully!`)
          setShowNotificationModal(true)
        } 
        // If notifications disabled, just reset order ID
        else {
          alert(`Order ${orderId} submitted successfully!`)
          
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


  if (dataLoading) {
    return (
      <div className="place_order-container">
        <div className="form-header">
          <div className="header-left">
            <div className="datetime-box">
              {formatDateTime(currentDateTime)}
            </div>
          </div>
          <div className="header-center">
            <h2>Material Order Form</h2>
          </div>
          <div className="header-right">
            <div className="order-id-section">
              <button 
                type="button"
                className="generate-order-id-btn"
                onClick={handleGenerateOrderId}
                title="Click to generate Order ID"
                disabled={dataLoading}
              >
                {dataLoading ? 'Loading...' : 'Generate Order ID'}
              </button>
            </div>
          </div>
        </div>
        <div className="loading-message">
          <p>Loading material data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="place_order-container">
      {/* Loading Spinner */}
      {isSubmitting && <LoadingSpinner />}
      
      {/* Back Button Section - Consistent across all pages */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '10px 0',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <button 
          onClick={() => navigate('/kerur/kr_store')} 
          className="back-button"
          style={{
            background: '#6c757d',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#5a6268'
            e.target.style.transform = 'translateY(-1px)'
          }}
          onMouseOut={(e) => {
            e.target.style.background = '#6c757d'
            e.target.style.transform = 'translateY(0)'
          }}
        >
          ← Back to Store
        </button>
      </div>
      
      <div className="form-header">
        <div className="header-left">
          <div className="datetime-box">
            {formatDateTime(currentDateTime)}
          </div>
        </div>
        <div className="header-center">
          <h2>Material Order Form</h2>
        </div>
        <div className="header-right">
          <div className="order-id-section">
            {orderIdGenerated ? (
              <div className="order-id-display">
                <span className="order-id-label">Order ID:</span>
                <span className="order-id-value">{orderId}</span>
              </div>
            ) : (
              <button 
                type="button"
                className="generate-order-id-btn"
                onClick={handleGenerateOrderId}
                title="Click to generate Order ID"
              >
                Generate Order ID
              </button>
            )}
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="material-form">

        {/* Added Items Table - Moved to top */}
        {orderItems.length > 0 && (
          <div className="added-items-top-section">
            <div className="items-table-container">
              <h3>Added Items</h3>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Category</th>
                    <th>Sub Category</th>
                    <th>Material Name</th>
                    <th>Specifications</th>
                    <th>Quantity</th>
                    <th>UOM</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item, index) => (
                    <tr key={item.id} className={editingItem === item.id ? "editing-row" : ""}>
                      <td data-label="S.No">{index + 1}</td>
                      <td 
                        data-label="Category"
                        className={editingItem === item.id ? "editing-cell" : "editable-cell"}
                        onDoubleClick={() => handleDoubleClickEdit(item, 'category')}
                        onTouchStart={(e) => handleTouchStart(e, item, 'category')}
                        onTouchEnd={(e) => handleTouchEnd(e, item, 'category')}
                        onTouchMove={handleTouchMove}
                        title={editingItem === item.id ? "" : "Double-click or long press to edit"}
                      >
                        {editingItem === item.id ? (
                          <select
                            value={editFormData.category}
                            onChange={(e) => handleEditInputChange('category', e.target.value)}
                            className="edit-select"
                          >
                            <option value="">Select Category</option>
                            {categories.map(category => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                        ) : (
                          item.category
                        )}
                      </td>
                      <td 
                        data-label="Sub Category"
                        className={editingItem === item.id ? "editing-cell" : "editable-cell"}
                        onDoubleClick={() => handleDoubleClickEdit(item, 'subCategory')}
                        onTouchStart={(e) => handleTouchStart(e, item, 'subCategory')}
                        onTouchEnd={(e) => handleTouchEnd(e, item, 'subCategory')}
                        onTouchMove={handleTouchMove}
                        title={editingItem === item.id ? "" : "Double-click or long press to edit"}
                      >
                        {editingItem === item.id ? (
                          <select
                            value={editFormData.subCategory}
                            onChange={(e) => handleEditInputChange('subCategory', e.target.value)}
                            className="edit-select"
                            disabled={!editFormData.category}
                          >
                            <option value="">Select Sub Category</option>
                            {editFormData.category && materialData[editFormData.category]?.subCategories?.map(subCat => (
                              <option key={subCat} value={subCat}>{subCat}</option>
                            ))}
                          </select>
                        ) : (
                          item.subCategory || '-'
                        )}
                      </td>
                      <td 
                        data-label="Specifications"
                        className={editingItem === item.id ? "editing-cell" : "editable-cell"}
                        onDoubleClick={() => handleDoubleClickEdit(item, 'specifications')}
                        onTouchStart={(e) => handleTouchStart(e, item, 'specifications')}
                        onTouchEnd={(e) => handleTouchEnd(e, item, 'specifications')}
                        onTouchMove={handleTouchMove}
                        title={editingItem === item.id ? "" : "Double-click or long press to edit"}
                      >
                        {editingItem === item.id ? (
                          <select
                            value={editFormData.specifications}
                            onChange={(e) => handleEditInputChange('specifications', e.target.value)}
                            className="edit-select"
                            disabled={!editFormData.materialName}
                          >
                            <option value="">Select Specifications</option>
                            {editFormData.materialName && (() => {
                              const categoryData = materialData[editFormData.category];
                              if (!categoryData) return null;
                              
                              // Get specifications based on selected material name
                              const materialSpecs = getSpecificationsForMaterial(
                                categoryData,
                                editFormData.materialName,
                                editFormData.subCategory
                              );
                              
                              return materialSpecs?.map(specification => (
                                <option key={specification} value={specification}>{specification}</option>
                              ));
                            })()}
                          </select>
                        ) : (
                          item.specifications || '-'
                        )}
                      </td>
                      <td 
                        data-label="Material Name"
                        className={editingItem === item.id ? "editing-cell" : "editable-cell"}
                        onDoubleClick={() => handleDoubleClickEdit(item, 'materialName')}
                        onTouchStart={(e) => handleTouchStart(e, item, 'materialName')}
                        onTouchEnd={(e) => handleTouchEnd(e, item, 'materialName')}
                        onTouchMove={handleTouchMove}
                        title={editingItem === item.id ? "" : "Double-click or long press to edit"}
                      >
                        {editingItem === item.id ? (
                          <select
                            value={editFormData.materialName}
                            onChange={(e) => handleEditInputChange('materialName', e.target.value)}
                            className="edit-select"
                            disabled={!editFormData.category}
                          >
                            <option value="">Select Material Name</option>
                            {editFormData.category && getMaterialNameOptions(
                              materialData[editFormData.category],
                              editFormData.subCategory
                            )}
                          </select>
                        ) : (
                          item.materialName
                        )}
                      </td>
                      <td 
                        data-label="Quantity"
                        className={editingItem === item.id ? "editing-cell" : "editable-cell"}
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
                            className="edit-input quantity-input"
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
                        className={editingItem === item.id ? "editing-cell" : ""}
                        title="UOM is auto-selected based on material name"
                        style={{ 
                          backgroundColor: editingItem === item.id ? '#f5f5f5' : 'transparent'
                        }}
                      >
                        {editingItem === item.id ? (
                          <input
                            type="text"
                            value={editFormData.uom}
                            readOnly
                            className="edit-input"
                            style={{ 
                              backgroundColor: '#f5f5f5', 
                              cursor: 'not-allowed',
                              color: '#333'
                            }}
                          />
                        ) : (
                          item.uom
                        )}
                      </td>
                      <td data-label="Action">
                        {editingItem === item.id ? (
                          <div className="edit-actions-vertical">
                            <div className="edit-actions-row">
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="save-edit-btn"
                                title="Save changes"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="cancel-edit-btn"
                                title="Cancel edit"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="remove-actions-row">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="remove-item-btn"
                                title="Remove item"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="remove-item-btn"
                            title="Remove item"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="form-main-content">
          {/* Left Section - Form Inputs */}
          <div className="form-left-section">
            {/* Form inputs for adding new item - Only show when no items exist */}
            {orderItems.length === 0 && (
              <div className="add-item-section">
                <h3 className="add-item-header">
                  Add Item to Order
                </h3>
                <p className="add-item-description">
                  Fill in the required fields below to add your first item to the order.
                </p>
              </div>
            )}
            <div className="form-row">
              {/* Category - Required only if no items exist */}
              <div className="form-group">
            <label htmlFor="category" className={orderItems.length === 0 ? "required" : ""}>
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              required={orderItems.length === 0}
              className={`form-select ${orderItems.length > 0 ? 'optional-field' : ''}`}
              disabled={dataLoading}
            >
              <option value="">{dataLoading ? 'Loading categories...' : 'Select Category'}</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Sub Category - Optional */}
          <div className="form-group">
            <label htmlFor="subCategory">Sub Category</label>
            <select
              id="subCategory"
              value={formData.subCategory}
              onChange={(e) => handleInputChange('subCategory', e.target.value)}
              className={`form-select ${!formData.subCategory && formData.category && materialData[formData.category]?.subCategories && materialData[formData.category].subCategories.length > 0 ? 'optional-field-red' : formData.subCategory ? 'optional-field-green' : ''}`}
              disabled={!formData.category || dataLoading || !materialData[formData.category]?.subCategories || materialData[formData.category].subCategories.length === 0}
            >
              <option value="">
                {!formData.category ? 'Select Category first' : 
                 !materialData[formData.category]?.subCategories || materialData[formData.category].subCategories.length === 0 ? 
                 'No subcategories available' : 'Select Sub Category'}
              </option>
              {formData.category && materialData[formData.category]?.subCategories?.map(subCat => (
                <option key={subCat} value={subCat}>{subCat}</option>
              ))}
            </select>
          </div>


          {/* Material Name - Required only if no items exist */}
          <div className="form-group">
            <label htmlFor="materialName" className={orderItems.length === 0 ? "required" : ""}>
              Material Name
            </label>
            <select
              id="materialName"
              value={formData.materialName}
              onChange={(e) => handleInputChange('materialName', e.target.value)}
              required={orderItems.length === 0}
              className={`form-select ${orderItems.length > 0 ? 'optional-field' : ''}`}
              disabled={!formData.category || dataLoading}
            >
              <option value="">{dataLoading ? 'Loading materials...' : 'Select Material Name'}</option>
              {formData.category && getMaterialNameOptions(
                materialData[formData.category],
                formData.subCategory
              )}
            </select>
          </div>

          {/* Specifications - Optional */}
          <div className="form-group">
            <label htmlFor="specifications">Specifications</label>
            <select
              id="specifications"
              value={formData.specifications}
              onChange={(e) => handleInputChange('specifications', e.target.value)}
              className={`form-select ${!formData.specifications && formData.category && formData.materialName && (() => {
                const categoryData = materialData[formData.category];
                if (!categoryData) return false;
                const materialSpecs = getSpecificationsForMaterial(categoryData, formData.materialName, formData.subCategory);
                return materialSpecs && materialSpecs.length > 0;
              })() ? 'optional-field-red' : formData.specifications ? 'optional-field-green' : ''}`}
              disabled={!formData.category || !formData.materialName || dataLoading || (() => {
                const categoryData = materialData[formData.category];
                if (!categoryData) return true;
                const materialSpecs = getSpecificationsForMaterial(categoryData, formData.materialName, formData.subCategory);
                return !materialSpecs || materialSpecs.length === 0;
              })()}
            >
              <option value="">
                {!formData.category ? 'Select Category first' : 
                 !formData.materialName ? 'Select Material Name first' : 
                 (() => {
                   const categoryData = materialData[formData.category];
                   if (!categoryData) return 'No specifications available';
                   const materialSpecs = getSpecificationsForMaterial(categoryData, formData.materialName, formData.subCategory);
                   return !materialSpecs || materialSpecs.length === 0 ? 'No specifications available' : 'Select Specifications';
                 })()}
              </option>
              {formData.materialName && (() => {
                const categoryData = materialData[formData.category];
                if (!categoryData) return null;
                
                // Get specifications based on selected material name
                const materialSpecs = getSpecificationsForMaterial(
                  categoryData,
                  formData.materialName,
                  formData.subCategory
                );
                
                return materialSpecs?.map(specification => (
                  <option key={specification} value={specification}>{specification}</option>
                ));
              })()}
            </select>
          </div>

          {/* Quantity - Required only if no items exist */}
          <div className="form-group">
            <label htmlFor="quantity" className={orderItems.length === 0 ? "required" : ""}>
              Quantity
            </label>
            <input
              type="text"
              id="quantity"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              required={orderItems.length === 0}
              className={`form-input quantity-input ${orderItems.length > 0 ? 'optional-field' : ''}`}
              placeholder="Enter quantity"
              pattern="[0-9]*"
              inputMode="numeric"
            />
          </div>

          {/* UOM - Auto-selected (Read-only) */}
          <div className="form-group">
            <label htmlFor="uom" className={orderItems.length === 0 ? "required" : ""}>
              UOM
            </label>
            <input
              type="text"
              id="uom"
              value={formData.uom}
              readOnly
              required={orderItems.length === 0}
              className={`form-input ${orderItems.length > 0 ? 'optional-field' : ''}`}
              placeholder="UOM"
              style={{ 
                backgroundColor: '#f5f5f5', 
                cursor: 'not-allowed',
                color: '#333'
              }}
            />
          </div>

          {/* Add Item Button */}
          <div className="form-group add-item-group">
            <label>&nbsp;</label>
            <button
              type="button"
              onClick={handleAddItem}
              className="add-item-btn"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Additional Order Information */}
        <div className="form-row">
          {/* Given By - Required */}
          <div className="form-group">
            <label htmlFor="givenBy" className="required">Given By</label>
            <select
              id="givenBy"
              value={formData.givenBy}
              onChange={(e) => handleInputChange('givenBy', e.target.value)}
              required
              className="form-select"
              disabled={authorityLoading}
            >
              <option value="">
                {authorityLoading ? 'Loading authority names...' : 'Select Authority Name'}
              </option>
              {authorityNames.map((authority, index) => (
                <option key={index} value={authority}>
                  {authority}
                </option>
              ))}
            </select>
          </div>

          {/* Importance - Required */}
          <div className="form-group">
            <label htmlFor="importance" className="required">Importance</label>
            <select
              id="importance"
              value={formData.importance}
              onChange={(e) => handleInputChange('importance', e.target.value)}
              required
              className="form-select"
            >
              {IMPORTANCE_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="notification-section">
          <h2>Notification Methods</h2>
          <div className="toggle-container">
            <div className="toggle-item">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={enableEmailNotification}
                  onChange={(e) => setEnableEmailNotification(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">Send via Email</span>
            </div>

            <div className="toggle-item">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={enableWhatsappNotification}
                  onChange={(e) => setEnableWhatsappNotification(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">Send via WhatsApp</span>
            </div>
          </div>
          {!enableEmailNotification && !enableWhatsappNotification && (
            <div className="notification-warning">
              <span className="warning-icon">⚠️</span>
              No notification method selected. Order will be placed without sending notifications.
            </div>
          )}
        </div>

        {/* Description - Full Width */}
        <div className="form-row">
          <div className="form-group full-width">
            <label htmlFor="description" className="required">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              required
              className="form-textarea"
              placeholder="Enter detailed description of the order requirements"
              rows="4"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button 
            type="submit" 
            className={`submit-btn ${orderItems.length > 0 && formData.givenBy && formData.description ? 'ready-to-submit' : 'disabled'}`}
            disabled={orderItems.length === 0 || !formData.givenBy || !formData.description}
            title={orderItems.length === 0 ? 'Add at least one item to place order' : (!formData.givenBy || !formData.description) ? 'Fill in Given By and Description' : 'Ready to submit'}
          >
            Place Order {orderItems.length > 0 && formData.givenBy && formData.description ? '✓' : ''}
          </button>
          <button type="button" className="reset-btn" onClick={() => {
            // Reset form but keep the same order ID
            setFormData({
              category: '',
              subCategory: '',
              materialName: '',
              specifications: '',
              uom: '',
              quantity: '',
              givenBy: '',
              description: '',
              importance: 'Normal'
            })
            setOrderItems([])
            
            alert(`Form reset! Order ID ${orderId} remains the same.`)
          }}>Reset</button>
        </div>
          </div>
        </div>
      </form>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="notification-modal-overlay">
          <div className="notification-modal">
            <div className="notification-modal-header">
              <h3>Send Order Notification</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCloseNotificationModal}
                title="Close modal"
              >
                ×
              </button>
            </div>

            <div className="notification-modal-body">
              <div className="order-summary">
                <h4>Order Summary</h4>
                <div className="summary-item">
                  <strong>Order ID:</strong> {lastSubmittedOrderId}
                </div>
                <div className="summary-item">
                  <strong>Date & Time:</strong> {lastSubmittedOrderData?.dateTime}
                </div>
                <div className="summary-item">
                  <strong>Given By:</strong> {lastSubmittedOrderData?.givenBy}
                </div>
                <div className="summary-item">
                  <strong>Importance:</strong> {lastSubmittedOrderData?.importance}
                </div>
                <div className="summary-item">
                  <strong>Items Count:</strong> {lastSubmittedOrderData?.orderItems?.length || 0}
                </div>
              </div>

              <div className="notification-method-section">
                <h4>Notification Method</h4>
                <div className="notification-method-display">
                  {notificationMethod === 'both' && (
                    <div className="method-badge both">
                      <span>📧</span> Email & <span>📱</span> WhatsApp
                    </div>
                  )}
                  {notificationMethod === 'email' && (
                    <div className="method-badge email">
                      <span>📧</span> Email Only
                    </div>
                  )}
                  {notificationMethod === 'whatsapp' && (
                    <div className="method-badge whatsapp">
                      <span>📱</span> WhatsApp Only
                    </div>
                  )}
                </div>
              </div>

              <div className="recipients-section">
                <div className="recipients-header">
                  <h4>Select Recipients</h4>
                  <button 
                    className="select-all-btn"
                    onClick={handleSelectAllRecipients}
                    type="button"
                  >
                    {selectedRecipients.length === recipients.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {recipientsLoading ? (
                  <div className="recipients-loading">
                    <p>Loading recipients...</p>
                  </div>
                ) : recipients.length === 0 ? (
                  <div className="recipients-empty">
                    <p>No recipients found</p>
                  </div>
                ) : (
                  <div className="recipients-list">
                    {recipients.map((recipient, index) => (
                      <label key={index} className="recipient-item">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.some(r => r['Email ID - To'] === recipient['Email ID - To'])}
                          onChange={() => handleRecipientToggle(recipient)}
                        />
                        <div className="recipient-info">
                          <div className="recipient-name">{recipient.Name}</div>
                          {recipient['Email ID - To'] && (
                            <div className="recipient-detail">
                              <span className="recipient-icon">📧</span>
                              {recipient['Email ID - To']}
                            </div>
                          )}
                          {recipient['Contact No.'] && (
                            <div className="recipient-detail">
                              <span className="recipient-icon">📱</span>
                              {recipient['Contact No.']}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="selected-count">
                Selected: {selectedRecipients.length} of {recipients.length} recipients
              </div>
            </div>

            <div className="notification-modal-footer">
              <button
                className="send-notification-btn"
                onClick={handleSendNotifications}
                disabled={sendingNotification || selectedRecipients.length === 0}
              >
                {sendingNotification ? 'Sending...' : 'Send Notifications'}
              </button>
              <button
                className="skip-notification-btn"
                onClick={handleCloseNotificationModal}
                disabled={sendingNotification}
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KR_PlaceOrder

