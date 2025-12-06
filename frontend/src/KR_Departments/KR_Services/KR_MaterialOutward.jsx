import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../MaterialIn-Out.css'
import BackButton from '../../Components/BackButton'
import FormValidationErrors from '../../Components/FormValidationErrors'
import LoadingSpinner from '../../LoadingSpinner'
import NotificationSummaryModal from '../../Components/NotificationSummaryModal'

// Constants
const LONG_PRESS_DURATION = 500 // 500ms for long press
const TOUCH_MOVE_THRESHOLD = 10 // pixels

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

const KR_MaterialOutward = () => {
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    materialName: '',
    specifications: '',
    uom: '',
    quantity: ''
  })

  // General form data for given to and description (applies to all items)
  const [generalFormData, setGeneralFormData] = useState({
    givenTo: '',
    description: ''
  })

  // Date and time state
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

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [authorityNames, setAuthorityNames] = useState([])
  const [authorityLoading, setAuthorityLoading] = useState(true)

  // Recipients functionality
  const [recipients, setRecipients] = useState([])
  const [recipientsLoading, setRecipientsLoading] = useState(true)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [notificationMethod, setNotificationMethod] = useState('both') // 'email', 'whatsapp', 'both'
  const [sendingNotification, setSendingNotification] = useState(false)
  const [lastSubmittedData, setLastSubmittedData] = useState(null)
  const [enableEmailNotification, setEnableEmailNotification] = useState(true)
  const [enableWhatsappNotification, setEnableWhatsappNotification] = useState(true)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [summaryModalData, setSummaryModalData] = useState(null)

  // Multi-item management
  const [outwardItems, setOutwardItems] = useState([])
  
  // Edit functionality
  const [editingItem, setEditingItem] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  
  // Quantity validation
  const [currentQuantity, setCurrentQuantity] = useState(null)
  const [quantityLoading, setQuantityLoading] = useState(false)
  
  // Touch functionality for mobile
  const [touchStartTime, setTouchStartTime] = useState(null)
  const [touchStartPosition, setTouchStartPosition] = useState(null)
  
  // Mobile items sheet modal
  const [showItemsSheet, setShowItemsSheet] = useState(false)
  const [showScreenFlash, setShowScreenFlash] = useState(false)
const [formValidationErrors, setFormValidationErrors] = useState([])
const [formHasBlockingErrors, setFormHasBlockingErrors] = useState(false)
const itemsSheetHistoryPushed = useRef(false)
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
  
  // Ref to track if component is still mounted and form is active
  const isFormActive = useRef(true)
  const materialInputSectionRef = useRef(null)
  const itemsTableContainerRef = useRef(null)
  const dateInputRef = useRef(null)
  const timeInputRef = useRef(null)
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
    if (typeof targetRef.current.focus === 'function') {
      targetRef.current.focus({ preventScroll: true })
    }
  }
}

  // Function to fetch current quantity from database
  const fetchCurrentQuantity = async (category, subCategory, specifications, materialName) => {
    try {
      setQuantityLoading(true)
      const payload = {
        category: category,
        subCategory: subCategory || '',
        specifications: specifications || '',
        materialName: materialName,
        department: 'KR'
      }

      console.log('Fetching current quantity with payload:', payload)
      const response = await axios.post(getApiUrl('get_material_details'), payload)
      console.log('Current quantity response:', response.data)
      
      if (response.data.success) {
        const material = response.data.material
        const currentQty = material.currentQuantity || material.initialQuantity || 0
        setCurrentQuantity(currentQty)
        return currentQty
      } else {
        console.warn('Material not found in database:', response.data.message)
        // If material not found, try to find it without specifications
        if (specifications) {
          console.log('Retrying without specifications...')
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
            const currentQty = material.currentQuantity || material.initialQuantity || 0
            setCurrentQuantity(currentQty)
            return currentQty
          }
        }
        setCurrentQuantity(null)
        return null
      }
    } catch (error) {
      console.error('Error fetching current quantity:', error)
      setCurrentQuantity(null)
      return null
    } finally {
      setQuantityLoading(false)
    }
  }

  // Helper function to get material name options based on category data structure
  const getMaterialNameOptions = (categoryData, subCategory) => {
    if (!categoryData || !categoryData.materialNames) {
      return []
    }

    const materialNames = categoryData.materialNames;
    const materialNameArray = []; // Collect material names first

    // Structure 1: Simple Array (no subcategories, no specifications)
    if (Array.isArray(materialNames)) {
      // For simple arrays, only show materials if NO subcategory is selected
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
      if (subCategory && subCategory.trim() !== '') {
        if (materialNames[subCategory]) {
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
        }
      } else {
        // STRICT FILTERING: If no subcategory selected, show ONLY materials NOT under any subcategory
        // Check for materials directly under category (not under any subcategory)
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
        
        // If no materials found under top-level keys, check if we have direct specification keys
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

    // Remove duplicates and return unique material names
    return [...new Set(materialNameArray)];
  }

  // Helper function to get specifications for a selected material
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

  // Helper function to get UOM for a material
  const getUomForMaterial = (category, materialName, subCategory = '', specifications = '') => {
    if (!category || !materialName || !materialData[category]) {
      return ''
    }

    const categoryData = materialData[category]
    const materialNames = categoryData.materialNames

    if (!materialNames) return ''

    // Structure 1: Simple Array
    if (Array.isArray(materialNames)) {
      const material = materialNames.find(mat => 
        (typeof mat === 'string' ? mat : mat.name) === materialName
      )
      return material && typeof material === 'object' ? material.uom : ''
    }

    // Structure 2 & 3: Object-based
    if (typeof materialNames === 'object') {
      // If subcategory is selected, search in that subcategory first
      if (subCategory && materialNames[subCategory]) {
        const subCategoryData = materialNames[subCategory]
        
        // If subcategory has specifications
        if (typeof subCategoryData === 'object') {
          // If specific specification is selected, search ONLY there (exact match)
          if (specifications && subCategoryData[specifications]) {
            const materials = subCategoryData[specifications]
            const material = materials.find(mat => 
              (typeof mat === 'string' ? mat : mat.name) === materialName
            )
            if (material && typeof material === 'object') {
              return material.uom
            }
          }
          // If no specifications provided, search in any specification within the subcategory
          for (const spec of Object.keys(subCategoryData)) {
            const materials = subCategoryData[spec]
            if (Array.isArray(materials)) {
              const material = materials.find(mat => 
                (typeof mat === 'string' ? mat : mat.name) === materialName
              )
              if (material && typeof material === 'object') {
                return material.uom
              }
            }
          }
        }
        // If subcategory data is direct array
        else if (Array.isArray(subCategoryData)) {
          const material = subCategoryData.find(mat => 
            (typeof mat === 'string' ? mat : mat.name) === materialName
          )
          if (material && typeof material === 'object') {
            return material.uom
          }
        }
      }
      
      // If no subcategory selected, search in all subcategories
      for (const [subCatKey, subCatData] of Object.entries(materialNames)) {
        if (typeof subCatData === 'object') {
          // If this subcategory has specifications
          if (Object.keys(subCatData).length > 0 && Array.isArray(Object.values(subCatData)[0])) {
            // If specific specification is provided, search ONLY in that specification
            if (specifications && subCatData[specifications]) {
              const materials = subCatData[specifications]
              const material = materials.find(mat => 
                (typeof mat === 'string' ? mat : mat.name) === materialName
              )
              if (material && typeof material === 'object') {
                return material.uom
              }
            }
            // If no specifications provided, search in any specification within this subcategory
            for (const spec of Object.keys(subCatData)) {
              const materials = subCatData[spec]
              if (Array.isArray(materials)) {
                const material = materials.find(mat => 
                  (typeof mat === 'string' ? mat : mat.name) === materialName
                )
                if (material && typeof material === 'object') {
                  return material.uom
                }
              }
            }
          }
          // If this subcategory data is direct array
          else if (Array.isArray(subCatData)) {
            const material = subCatData.find(mat => 
              (typeof mat === 'string' ? mat : mat.name) === materialName
            )
            if (material && typeof material === 'object') {
              return material.uom
            }
          }
        }
      }
    }

    return ''
  }

  // Function to fetch UOM from backend for exact material match
  const fetchMaterialUomFromBackend = async (category, subCategory, specifications, materialName) => {
    try {
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      const sheetName =
        typeof kerurPlant?.sheet_name === 'object'
          ? kerurPlant?.sheet_name?.MaterialList || 'Material List'
          : kerurPlant?.sheet_name || 'Material List'

      const payload = {
        category: category,
        subCategory: subCategory || '',
        specifications: specifications || '',
        materialName: materialName,
        department: 'KR',
        sheet_id: sheetId,
        sheet_name: sheetName
      }

      console.log('Fetching UOM from backend with payload:', payload)
      const response = await axios.post(getApiUrl('get_material_details'), payload)
      console.log('UOM fetch response:', response.data)
      
      if (response.data.success) {
        const material = response.data.material
        // Update UOM in form data
        setFormData(prev => ({
          ...prev,
          uom: material.uom
        }))
        // Clear UOM highlight when it's auto-filled
        setHighlightedFields(prev => prev.filter(f => f !== 'uom'))
        console.log('UOM updated to:', material.uom)
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
            department: 'KR',
            sheet_id: sheetId,
            sheet_name: sheetName
          }
          
          const retryResponse = await axios.post(getApiUrl('get_material_details'), retryPayload)
          if (retryResponse.data.success) {
            const material = retryResponse.data.material
            setFormData(prev => ({
              ...prev,
              uom: material.uom
            }))
            // Clear UOM highlight when it's auto-filled
            setHighlightedFields(prev => prev.filter(f => f !== 'uom'))
            console.log('UOM updated to (without specs):', material.uom)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching UOM from backend:', error)
    }
  }

  // Multi-item management functions
  const handleAddItem = async () => {
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

    // Validate quantity against current quantity in database
    const enteredQuantity = parseFloat(formData.quantity)
    if (isNaN(enteredQuantity) || enteredQuantity <= 0) {
      alert('Please enter a valid quantity greater than 0.')
      return
    }

    // Fetch current quantity from database
    const currentQty = await fetchCurrentQuantity(
      formData.category,
      formData.subCategory,
      formData.specifications,
      formData.materialName
    )

    if (currentQty === null) {
      alert('Material not found in database. Cannot validate quantity.')
      return
    }

    // Check if entered quantity exceeds current quantity
    if (enteredQuantity > currentQty) {
      alert(`The required quantity (${enteredQuantity}) exceeds the current quantity (${currentQty}) available for this material. Please enter a quantity less than or equal to ${currentQty}.`)
      return
    }

    const newItem = {
      id: Date.now(),
      category: formData.category,
      subCategory: formData.subCategory,
      specifications: formData.specifications,
      materialName: formData.materialName,
      uom: formData.uom,
      quantity: formData.quantity
    }

    setOutwardItems(prev => [...prev, newItem])
    
    // Trigger flash animation on table container
    if (itemsTableContainerRef.current) {
      itemsTableContainerRef.current.classList.add('mio-item-added-flash')
      setTimeout(() => {
        if (itemsTableContainerRef.current) {
          itemsTableContainerRef.current.classList.remove('mio-item-added-flash')
        }
      }, 800) // Remove class after animation completes
    }
    
    // Trigger screen flash overlay
    triggerScreenFlash()
    
    // Reset only the item-specific fields after adding item
    setFormData(prev => ({
      ...prev,
      category: '',
      subCategory: '',
      materialName: '',
      specifications: '',
      uom: '',
      quantity: ''
    }))
    
    // Reset current quantity
    setCurrentQuantity(null)
    
    // Scroll to material inputs after a short delay to allow DOM update
    setTimeout(() => {
      scrollToMaterialInputs()
    }, 100)
    scrollToMaterialInputs()
  }

  const handleRemoveItem = (itemId) => {
    setOutwardItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleEditItem = (item) => {
    setEditingItem(item.id)
    setEditFormData({
      category: item.category,
      subCategory: item.subCategory,
      specifications: item.specifications,
      materialName: item.materialName,
      uom: item.uom,
      quantity: item.quantity
    })
  }

  const handleDoubleClickEdit = (item, field) => {
    if (editingItem === item.id) {
      return
    }
    
    if (editingItem && editingItem !== item.id) {
      setEditingItem(null)
      setEditFormData({})
    }
    
    setEditingItem(item.id)
    setEditFormData({
      category: item.category,
      subCategory: item.subCategory,
      specifications: item.specifications,
      materialName: item.materialName,
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
    
    const target = e.currentTarget
    target.classList.add('mio-touch-active')
  }

  const handleTouchEnd = (e, item, field) => {
    if (!touchStartTime || !touchStartPosition) return

    const touch = e.changedTouches[0]
    const touchDuration = Date.now() - touchStartTime
    const touchDistance = Math.sqrt(
      Math.pow(touch.clientX - touchStartPosition.x, 2) +
      Math.pow(touch.clientY - touchStartPosition.y, 2)
    )

    const target = e.currentTarget
    target.classList.remove('mio-touch-active')

    setTouchStartTime(null)
    setTouchStartPosition(null)

    if (touchDuration >= LONG_PRESS_DURATION && touchDistance <= TOUCH_MOVE_THRESHOLD) {
      e.preventDefault()
      handleDoubleClickEdit(item, field)
    }
  }

  const handleTouchMove = (e) => {
    if (touchStartTime && touchStartPosition) {
      const touch = e.touches[0]
      const touchDistance = Math.sqrt(
        Math.pow(touch.clientX - touchStartPosition.x, 2) +
        Math.pow(touch.clientY - touchStartPosition.y, 2)
      )
      
      if (touchDistance > TOUCH_MOVE_THRESHOLD) {
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
        })
      }

      // Auto-assign UOM when material name changes in edit mode
      if (field === 'materialName' && value) {
        const autoUom = getUomForMaterial(
          newEditFormData.category,
          value,
          newEditFormData.subCategory,
          newEditFormData.specifications
        )
        if (autoUom) {
          newEditFormData.uom = autoUom
        }
      }

      return newEditFormData
    })
  }

  const handleSaveEdit = async () => {
    if (!editFormData.category || !editFormData.materialName || !editFormData.uom || !editFormData.quantity) {
      alert('Please fill in all required fields (Category, Material Name, UOM, and Quantity) before saving.')
      return
    }

    // Validate quantity against current quantity in database
    const enteredQuantity = parseFloat(editFormData.quantity)
    if (isNaN(enteredQuantity) || enteredQuantity <= 0) {
      alert('Please enter a valid quantity greater than 0.')
      return
    }

    // Fetch current quantity from database
    const currentQty = await fetchCurrentQuantity(
      editFormData.category,
      editFormData.subCategory,
      editFormData.specifications,
      editFormData.materialName
    )

    if (currentQty === null) {
      alert('Material not found in database. Cannot validate quantity.')
      return
    }

    // Check if entered quantity exceeds current quantity
    if (enteredQuantity > currentQty) {
      alert(`The required quantity (${enteredQuantity}) exceeds the current quantity (${currentQty}) available for this material. Please enter a quantity less than or equal to ${currentQty}.`)
      return
    }

    setOutwardItems(prev => prev.map(item => 
      item.id === editingItem 
        ? { ...item, ...editFormData }
        : item
    ))
    
    setEditingItem(null)
    setEditFormData({})
    setCurrentQuantity(null)
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

    if (!lastSubmittedData) {
      alert('No data found. Please try again.')
      return
    }

    try {
      setSendingNotification(true)
      
      // Get sheet ID from PLANT_DATA
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      
      const notificationData = {
        orderData: lastSubmittedData,
        recipients: selectedRecipients,
        method: notificationMethod,
        factory: 'KR',
        autoSend: false, // Manual send with selected recipients
        sheetId: sheetId, // Send sheet ID to backend
        sheetName: 'Recipents List UAT', // Send sheet name to backend
        type: 'material_outward' // Specify the type
      }

      const response = await axios.post(getApiUrl('send_order_notification'), notificationData)

      if (response.data.success) {
        const contextDetails = buildOutwardSummaryContext(lastSubmittedData)
        showDetailedLogReport(response.data, contextDetails)
        alert('Notifications sent successfully!')
        setShowNotificationModal(false)
        setSelectedRecipients([])
        setLastSubmittedData(null)
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
    setLastSubmittedData(null)
  }

  const buildOutwardSummaryContext = (data) => {
    if (!data) {
      return []
    }
    const rows = [
      { label: 'Given To', value: data.givenTo },
      { label: 'Description', value: data.description },
      { label: 'Items Count', value: data.outwardItems?.length },
      { label: 'Recorded At', value: data.dateTime ? formatDateTime(new Date(data.dateTime)) : null }
    ]
    return rows.filter(row => row.value)
  }

  const openSummaryModal = (stats, contextDetails = []) => {
    setSummaryModalData({ stats, contextDetails })
    setShowSummaryModal(true)
  }

  const handleCloseSummaryModal = () => {
    setShowSummaryModal(false)
    setSummaryModalData(null)
  }

  // Show detailed log report
  const showDetailedLogReport = (result, contextDetails = []) => {
    const stats = result.delivery_stats || {}
    openSummaryModal(stats, contextDetails)
  }

  // Helper function to render dropdown input field
  const renderDropdownInput = (field, label, required = false, options = []) => {
    const value = formData[field]
    
    return (
      <div className="mio-form-group">
        <label htmlFor={field}>
          {label} {required && '*'}
        </label>
        <select
          id={field}
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          required={required}
          className="mio-form-select"
          disabled={dataLoading || authorityLoading || 
                   (field === 'subCategory' && !formData.category) || 
                   (field === 'specifications' && !formData.category) ||
                   (field === 'materialName' && !formData.category) ||
                   (field === 'uom' && !formData.category) ||
                   (field === 'givenTo' && authorityLoading)}
        >
          <option value="">
            {field === 'givenTo' && authorityLoading ? 'Loading authority names...' : `Select ${label}`}
          </option>
          {options.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    )
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

  // Fetch authority list data from Google Sheets
  const fetchAuthorityList = async () => {
    try {
      setAuthorityLoading(true)
      // Find the Kerur plant data to get the sheet ID
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      
      if (!sheetId) {
        console.error('No sheet ID found for Kerur plant')
        setMessage('No Google Sheet configuration found for Kerur plant')
        setMessageType('error')
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
        setAuthorityNames(response.data.data)
      } else {
        console.error('Failed to load authority list:', response.data.error)
        setMessage('Failed to load authority list data')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error fetching authority list:', error)
      setMessage('Error loading authority list data. Please try again.')
      setMessageType('error')
    } finally {
      setAuthorityLoading(false)
    }
  }

  // Fetch material data from backend on component mount
  useEffect(() => {
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
          setCategories(Object.keys(response.data.data))
        } else {
          setMessage('Failed to load material data')
          setMessageType('error')
        }
      } catch (error) {
        console.error('Error fetching material data:', error)
        setMessage('Error loading material data. Please try again.')
        setMessageType('error')
      } finally {
        setDataLoading(false)
      }
    }

    fetchMaterialData()
    fetchAuthorityList()
    fetchRecipientsList()
    
    // Reset form active state on mount
    isFormActive.current = true
  }, [])

  // Show alert popup when message is set
  useEffect(() => {
    if (message) {
      if (messageType === 'success') {
        alert(message)
      } else if (messageType === 'error') {
        alert(message)
      }
      // Clear message after showing alert
      setMessage('')
      setMessageType('')
    }
  }, [message, messageType])

  // Helper function to validate numeric input
  const validateNumericInput = (value) => {
    // Allow empty string, numbers, and decimal point
    return /^[0-9]*\.?[0-9]*$/.test(value)
  }

  // Form validation function
  const validateForm = () => {
    const errors = []
    
    if (outwardItems.length === 0) {
      errors.push('Please add at least one item to record material outward')
    }
    
    if (!generalFormData.givenTo) {
      errors.push('Please select Given To (Authority Name)')
    }
    
    if (!generalFormData.description || generalFormData.description.trim() === '') {
      errors.push('Please enter Description')
    }
    
    return errors
  }

  // Validate form on state changes
  useEffect(() => {
    const errors = validateForm()
    setFormValidationErrors(errors)
  }, [outwardItems, generalFormData.givenTo, generalFormData.description])

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
              )
            }, 100)
            // Also fetch current quantity for materials without specifications
            setTimeout(() => {
              if (isFormActive.current) {
                fetchCurrentQuantity(
                  newFormData.category,
                  newFormData.subCategory || '',
                  '',
                  value
                )
              }
            }, 200)
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
          )
        }, 100)
      }

      // Clear current quantity when dependent fields change
      if (field === 'category' || field === 'subCategory') {
        setCurrentQuantity(null)
      }

      // Fetch current quantity when specifications are manually selected
      if (field === 'specifications' && value && newFormData.category && newFormData.materialName) {
        setCurrentQuantity(null) // Clear first
        setTimeout(() => {
          if (isFormActive.current) {
            fetchCurrentQuantity(
              newFormData.category,
              newFormData.subCategory || '',
              value,
              newFormData.materialName
            )
          }
        }, 100)
      }

      return newFormData
    })
  }

  const handleGeneralInputChange = (field, value) => {
    setGeneralFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (outwardItems.length === 0) {
      alert('Please add at least one item to record material outward.')
      return
    }

    if (!generalFormData.givenTo) {
      alert('Please fill in Given To for the outward record.')
      return
    }

    if (!generalFormData.description) {
      alert('Please fill in Description for the outward record.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // Process each item individually using the existing endpoint
      let successCount = 0
      let errorCount = 0
      let quantityUpdates = []
      
      for (const item of outwardItems) {
        try {
          const payload = {
            category: item.category,
            subCategory: item.subCategory || '',
            specifications: item.specifications || '',
            materialName: item.materialName,
            uom: item.uom,
            quantity: item.quantity,
            givenTo: generalFormData.givenTo,
            description: generalFormData.description,
            timestamp: `${currentDate}, ${currentTime}`,
            department: 'KR',
            type: 'outward'
          }

          const response = await axios.post(getApiUrl('material_outward'), payload)
          
          if (response.data.success) {
            successCount++
            // Store quantity update info
            if (response.data.previousQuantity !== undefined && response.data.newQuantity !== undefined) {
              quantityUpdates.push({
                material: item.materialName,
                previous: response.data.previousQuantity,
                new: response.data.newQuantity,
                removed: item.quantity
              })
            }
          } else {
            errorCount++
            console.error('Failed to record item:', item, response.data.message)
          }
        } catch (itemError) {
          errorCount++
          console.error('Error recording item:', item, itemError)
        }
      }
      
      if (successCount > 0) {
        let successMsg = `Material outward recorded successfully! ${successCount} item(s) processed.${errorCount > 0 ? ` ${errorCount} item(s) failed.` : ''}\n\n`
        
        // Add quantity update details
        if (quantityUpdates.length > 0) {
          successMsg += 'Quantity Updates:\n'
          quantityUpdates.forEach(update => {
            successMsg += `• ${update.material}: ${update.previous} → ${update.new} (Removed: ${update.removed})\n`
          })
        }
        
        setMessage(successMsg)
        setMessageType('success')
        
        // Prepare data for notification
        const notificationData = {
          outwardItems,
          givenTo: generalFormData.givenTo,
          description: generalFormData.description,
          dateTime: `${currentDate}, ${currentTime}`,
          quantityUpdates
        }
        
        // Determine notification method - auto-send to all recipients if any method is enabled
        const notificationMethod = 
          enableEmailNotification && enableWhatsappNotification ? 'both' :
          enableEmailNotification ? 'email' :
          enableWhatsappNotification ? 'whatsapp' : null
        
        // If any notification method is enabled, auto-send to all recipients
        if (notificationMethod) {
          try {
            console.log('Auto-sending notifications to all recipients from Google Sheets...')
            
            // Get sheet ID and sheet name from PLANT_DATA
            const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
            const sheetId = kerurPlant?.material_sheet_id
            
            if (!sheetId) {
              console.error('No sheet ID found for Kerur plant configuration')
            } else {
              // Send notifications automatically - backend will fetch all recipients from Google Sheets
              const autoNotificationData = {
                orderData: notificationData,
                recipients: [], // Empty array - backend will fetch from Google Sheets
                method: notificationMethod,
                factory: 'KR',
                autoSend: true, // Flag to indicate auto-send - backend will fetch recipients
                sheetId: sheetId, // Send sheet ID to backend
                sheetName: 'Recipents List UAT', // Send sheet name to backend
                type: 'material_outward' // Specify the type
              }
              
              const notifResponse = await axios.post(getApiUrl('send_order_notification'), autoNotificationData)
              
              if (notifResponse.data.success) {
                const contextDetails = buildOutwardSummaryContext(notificationData)
                showDetailedLogReport(notifResponse.data, contextDetails)
              } else {
                console.error('Notifications failed:', notifResponse.data.message)
              }
            }
          } catch (notifError) {
            console.error('Error sending auto-notifications:', notifError)
          }
        }
        
        setOutwardItems([])
        setFormData({
          category: '',
          subCategory: '',
          materialName: '',
          specifications: '',
          uom: '',
          quantity: ''
        })
        setGeneralFormData({
          givenTo: '',
          description: ''
        })
        // Clear any pending quantity fetching and mark form as inactive
        setCurrentQuantity(null)
        isFormActive.current = false
      } else {
        setMessage('Failed to record any material outward items. Please try again.')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error recording material outward:', error)
      setMessage('Error recording material outward. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const renderItemsTable = () => (
    <table className="mio-items-table">
      <thead>
        <tr>
          <th>S.No</th>
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
        {outwardItems.map((item, index) => (
          <tr key={item.id} className={editingItem === item.id ? "mio-editing-row" : ""}>
            <td data-label="S.No">{index + 1}</td>
            <td 
              data-label="Category"
              className={editingItem === item.id ? "mio-editing-cell" : "mio-editable-cell"}
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
                  className="mio-edit-select"
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
              className={editingItem === item.id ? "mio-editing-cell" : "mio-editable-cell"}
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
                  className="mio-edit-select"
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
              data-label="Material Name"
              className={editingItem === item.id ? "mio-editing-cell" : "mio-editable-cell"}
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
                  className="mio-edit-select"
                  disabled={!editFormData.category}
                >
                  <option value="">Select Material Name</option>
                  {editFormData.category && getMaterialNameOptions(materialData[editFormData.category], editFormData.subCategory).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : (
                item.materialName
              )}
            </td>
            <td 
              data-label="Specifications"
              className={editingItem === item.id ? "mio-editing-cell" : "mio-editable-cell"}
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
                  className="mio-edit-select"
                  disabled={!editFormData.category}
                >
                  <option value="">Select Specifications</option>
                  {editFormData.category && editFormData.materialName && getSpecificationsForMaterial(materialData[editFormData.category], editFormData.materialName, editFormData.subCategory).map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              ) : (
                item.specifications || '-'
              )}
            </td>
            <td 
              data-label="Quantity"
              className={editingItem === item.id ? "mio-editing-cell" : "mio-editable-cell"}
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
                  className="mio-edit-input mio-quantity-input"
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
              className={editingItem === item.id ? "mio-editing-cell" : "mio-editable-cell"}
              title={editingItem === item.id ? "UOM is auto-selected based on material name" : "UOM is auto-selected based on material name"}
            >
              {editingItem === item.id ? (
                <input
                  type="text"
                  value={editFormData.uom}
                  readOnly
                  className="mio-edit-input"
                  style={{
                    backgroundColor: '#f5f5f5',
                    cursor: 'not-allowed',
                    color: '#333'
                  }}
                  title="UOM is auto-selected based on material name"
                />
              ) : (
                item.uom
              )}
            </td>
            <td data-label="Action">
              {editingItem === item.id ? (
                <div className="mio-edit-actions-vertical">
                  <div className="mio-edit-actions-row">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="mio-save-edit-btn"
                      title="Save changes"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="mio-cancel-edit-btn"
                      title="Cancel edit"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="mio-remove-actions-row">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="mio-remove-item-btn"
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
                  className="mio-remove-item-btn"
                  title="Remove item"
                >
                  Delete
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  if (dataLoading) {
    return (
      <div className="place_order-container">
        <div className="form-header">
          <div className="header-left">
            <div className="mio-datetime-box">
              <input
                type="date"
                ref={dateInputRef}
                className="mio-date-picker-hidden"
                value={(() => {
                  const [day, month, year] = currentDate.split('/')
                  return year && month && day ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : ''
                })()}
                onChange={(e) => {
                  if (e.target.value) {
                    const date = new Date(e.target.value)
                    const day = date.getDate().toString().padStart(2, '0')
                    const month = (date.getMonth() + 1).toString().padStart(2, '0')
                    const year = date.getFullYear()
                    setCurrentDate(`${day}/${month}/${year}`)
                  }
                }}
              />
              <input
                type="time"
                ref={timeInputRef}
                className="mio-time-picker-hidden"
                value={(() => {
                  // Convert HH:MM AM/PM to HH:MM for time input
                  const match = currentTime.match(/(\d{2}):(\d{2})\s*(AM|PM)/i)
                  if (match) {
                    let hour24 = parseInt(match[1])
                    const minutes = match[2]
                    const ampm = match[3].toUpperCase()
                    if (ampm === 'PM' && hour24 !== 12) hour24 += 12
                    if (ampm === 'AM' && hour24 === 12) hour24 = 0
                    return `${hour24.toString().padStart(2, '0')}:${minutes}`
                  }
                  return ''
                })()}
                onChange={(e) => {
                  if (e.target.value) {
                    const [hours, minutes] = e.target.value.split(':')
                    const hour24 = parseInt(hours)
                    const hour12 = hour24 % 12 || 12
                    const ampm = hour24 >= 12 ? 'PM' : 'AM'
                    setCurrentTime(`${hour12.toString().padStart(2, '0')}:${minutes || '00'} ${ampm}`)
                  }
                }}
              />
              <div className="mio-date-wrapper">
                <label htmlFor="mio-date-display" className="mio-datetime-label">Date:</label>
                <input
                  type="text"
                  id="mio-date-display"
                  value={currentDate}
                  onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                  className="mio-date-input"
                  placeholder="DD/MM/YYYY"
                  title="Click to select date"
                  readOnly
                />
              </div>
              <div className="mio-time-wrapper">
                <label htmlFor="mio-time-display" className="mio-datetime-label">Time:</label>
                <input
                  type="text"
                  id="mio-time-display"
                  value={currentTime}
                  onClick={() => timeInputRef.current?.showPicker?.() || timeInputRef.current?.click()}
                  className="mio-time-input"
                  placeholder="HH:MM AM/PM"
                  title="Click to select time"
                  readOnly
                />
              </div>
            </div>
          </div>
          <div className="header-center">
            <h2>Material Outward Form</h2>
          </div>
        </div>
        <div className="mio-loading-message">
          <p>Loading material data...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {(loading || sendingNotification) && <LoadingSpinner />}
      <div className="place_order-container">
      {/* Screen Flash Overlay */}
      {showScreenFlash && <div className="mio-screen-flash-overlay" />}
      
      {/* Back Button Section - Always at top-left */}
      <BackButton label="Back to Store" to="/kerur/kr_store" />
      
      <div className="form-header">
        <div className="header-left">
          <div className="mio-datetime-box">
            <input
              type="date"
              ref={dateInputRef}
              className="mio-date-picker-hidden"
              onChange={(e) => {
                if (e.target.value) {
                  const date = new Date(e.target.value)
                  const day = date.getDate().toString().padStart(2, '0')
                  const month = (date.getMonth() + 1).toString().padStart(2, '0')
                  const year = date.getFullYear()
                  setCurrentDate(`${day}/${month}/${year}`)
                }
              }}
            />
            <input
              type="time"
              ref={timeInputRef}
              className="mio-time-picker-hidden"
              value={(() => {
                // Convert HH:MM AM/PM to HH:MM for time input
                const match = currentTime.match(/(\d{2}):(\d{2})\s*(AM|PM)/i)
                if (match) {
                  let hour24 = parseInt(match[1])
                  const minutes = match[2]
                  const ampm = match[3].toUpperCase()
                  if (ampm === 'PM' && hour24 !== 12) hour24 += 12
                  if (ampm === 'AM' && hour24 === 12) hour24 = 0
                  return `${hour24.toString().padStart(2, '0')}:${minutes}`
                }
                return ''
              })()}
              onChange={(e) => {
                if (e.target.value) {
                  const [hours, minutes] = e.target.value.split(':')
                  const hour24 = parseInt(hours)
                  const hour12 = hour24 % 12 || 12
                  const ampm = hour24 >= 12 ? 'PM' : 'AM'
                  setCurrentTime(`${hour12.toString().padStart(2, '0')}:${minutes || '00'} ${ampm}`)
                }
              }}
            />
            <div className="mio-date-wrapper">
              <label htmlFor="mio-date-display" className="mio-datetime-label">Date:</label>
              <input
                type="text"
                id="mio-date-display"
                value={currentDate}
                onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                className="mio-date-input"
                placeholder="DD/MM/YYYY"
                title="Click to select date"
                readOnly
              />
            </div>
            <div className="mio-time-wrapper">
              <label htmlFor="mio-time-display" className="mio-datetime-label">Time:</label>
              <input
                type="text"
                id="mio-time-display"
                value={currentTime}
                onClick={() => timeInputRef.current?.showPicker?.() || timeInputRef.current?.click()}
                className="mio-time-input"
                placeholder="HH:MM AM/PM"
                title="Click to select time"
                readOnly
              />
            </div>
          </div>
        </div>
        <div className="header-center">
          <h2>Material Outward Form</h2>
        </div>
      </div>
      
      <div className="form-section">
        <form onSubmit={handleSubmit} className="mio-material-form">

          {/* Added Items Table - Desktop view at top */}
          {outwardItems.length > 0 && (
            <div className="mio-added-items-top-section">
              {/* Desktop View: Show Table */}
              <div className="mio-items-table-container mio-desktop-table" ref={itemsTableContainerRef}>
                <h3>Added Items</h3>
                {renderItemsTable()}
              </div>
            </div>
          )}

          {/* Mobile Full-Screen Items Sheet */}
          {showItemsSheet && outwardItems.length > 0 && (
            <div className="mio-items-sheet-overlay" onClick={() => setShowItemsSheet(false)}>
              <div className="mio-items-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="mio-items-sheet-header">
                  <h3>Added Items ({outwardItems.length})</h3>
                  <button
                    type="button"
                    className="mio-items-sheet-close-btn"
                    onClick={() => setShowItemsSheet(false)}
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="mio-items-sheet-body">
                  <div className="mio-items-table-container mio-mobile-table">
                    {renderItemsTable()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="mio-form-main-content">
            {/* Left Section - Form Inputs */}
            <div className="mio-form-left-section" ref={materialInputSectionRef}>
              {/* Form inputs for adding new item - Only show when no items exist */}
              {outwardItems.length === 0 && (
                <div className="mio-add-item-section">
                  <h3 className="mio-add-item-header">
                    Add Item to Outward
                  </h3>
                  <p className="mio-add-item-description">
                    Fill in the required fields below to add your first item to the outward record.
                  </p>
                </div>
              )}
              <div className="mio-form-row">
                {/* Category */}
                <div className="mio-form-group">
                  <label htmlFor="category" className="required">
                    Category
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`mio-form-select ${highlightedFields.includes('category') ? 'mio-error-highlight' : ''}`}
                    disabled={dataLoading}
                    ref={categoryInputRef}
                  >
                    <option value="">{dataLoading ? 'Loading categories...' : 'Select Category'}</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Sub Category - Optional */}
                <div className="mio-form-group">
                  <label htmlFor="subCategory">Sub Category</label>
                  <select
                    id="subCategory"
                    value={formData.subCategory}
                    onChange={(e) => handleInputChange('subCategory', e.target.value)}
                    className={`mio-form-select ${!formData.subCategory && formData.category && materialData[formData.category]?.subCategories && materialData[formData.category].subCategories.length > 0 ? 'mio-optional-field-red' : formData.subCategory ? 'mio-optional-field-green' : ''}`}
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


                {/* Material Name */}
                <div className="mio-form-group">
                  <label htmlFor="materialName" className="required">
                    Material Name
                  </label>
                  <select
                    id="materialName"
                    value={formData.materialName}
                    onChange={(e) => handleInputChange('materialName', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`mio-form-select ${highlightedFields.includes('materialName') ? 'mio-error-highlight' : ''}`}
                    disabled={!formData.category || dataLoading}
                    ref={materialNameInputRef}
                  >
                    <option value="">{dataLoading ? 'Loading materials...' : 'Select Material Name'}</option>
                    {formData.category && getMaterialNameOptions(materialData[formData.category], formData.subCategory).map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specifications - Optional */}
                <div className="mio-form-group">
                  <label htmlFor="specifications">Specifications</label>
                  <select
                    id="specifications"
                    value={formData.specifications}
                    onChange={(e) => handleInputChange('specifications', e.target.value)}
                    className={`mio-form-select ${!formData.specifications && formData.category && formData.materialName && getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length > 0 ? 'mio-optional-field-red' : formData.specifications ? 'mio-optional-field-green' : ''}`}
                    disabled={!formData.category || !formData.materialName || dataLoading || getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length === 0}
                  >
                    <option value="">
                      {!formData.category ? 'Select Category first' : 
                       !formData.materialName ? 'Select Material Name first' : 
                       getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length === 0 ? 
                       'No specifications available' : 'Select Specifications'}
                    </option>
                    {formData.category && formData.materialName && getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="mio-form-group">
                  <label htmlFor="quantity" className="required">
                    Quantity
                  </label>
                  <input
                    type="text"
                    id="quantity"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`mio-form-input mio-quantity-input ${highlightedFields.includes('quantity') ? 'mio-error-highlight' : ''}`}
                    placeholder="Enter quantity"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    disabled={dataLoading}
                    ref={quantityInputRef}
                  />
                </div>

                {/* UOM */}
                <div className="mio-form-group">
                  <label htmlFor="uom" className="required">
                    UOM
                  </label>
                  <input
                    type="text"
                    id="uom"
                    value={formData.uom}
                    readOnly
                    required={outwardItems.length === 0}
                    className={`mio-form-input ${highlightedFields.includes('uom') ? 'mio-error-highlight' : ''}`}
                    placeholder="UOM"
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: '#333'
                    }}
                    title="UOM is auto-selected based on material name"
                    ref={uomInputRef}
                  />
                </div>

                {/* Current Quantity - Read-only, shows available quantity */}
                <div className="mio-form-group">
                  <label htmlFor="currentQuantity">
                    Current Quantity Available
                  </label>
                  <input
                    type="text"
                    id="currentQuantity"
                    value={currentQuantity !== null ? currentQuantity : ''}
                    readOnly
                    className="mio-form-input"
                    placeholder={quantityLoading ? 'Loading...' : 'Select material to see quantity'}
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: currentQuantity !== null ? '#333' : '#999',
                      fontWeight: currentQuantity !== null ? 'bold' : 'normal'
                    }}
                    title="Current quantity available in database"
                  />
                </div>



                {/* Add Item Button */}
                <div className="mio-form-group mio-add-item-group">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="mio-add-item-btn"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile View: View Added Items Button - Below Add Item Button */}
          {outwardItems.length > 0 && (
            <div className="mio-form-row">
              <div className="mio-form-group mio-mobile-items-button-container">
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="mio-view-items-btn"
                  onClick={() => setShowItemsSheet(true)}
                >
                  <span className="mio-items-count-badge">{outwardItems.length}</span>
                  <span className="mio-view-items-text">View Added Items</span>
                </button>
              </div>
            </div>
          )}

          {/* General Form Fields - Given To and Description */}
          <div className="mio-form-row">
            {/* Given To - Required */}
            <div className="mio-form-group">
              <label htmlFor="generalGivenTo" className="required">
                Given To
              </label>
              <select
                id="generalGivenTo"
                value={generalFormData.givenTo}
                onChange={(e) => handleGeneralInputChange('givenTo', e.target.value)}
                required
                className="mio-form-select"
                disabled={authorityLoading}
              >
                <option value="">{authorityLoading ? 'Loading authority names...' : 'Select Authority Name'}</option>
                {authorityNames.map((authority, index) => (
                  <option key={index} value={authority}>
                    {authority}
                  </option>
                ))}
              </select>
            </div>

            {/* Description - Required */}
            <div className="mio-form-group">
              <label htmlFor="generalDescription" className="required">
                Description
              </label>
              <textarea
                id="generalDescription"
                value={generalFormData.description}
                onChange={(e) => handleGeneralInputChange('description', e.target.value)}
                required
                className="mio-form-textarea"
                placeholder="Enter detailed description of the material outward"
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

          {/* Form Validation Errors */}
          <FormValidationErrors 
            errors={formValidationErrors} 
            checkWhatsApp={enableWhatsappNotification}
            checkEmail={enableEmailNotification}
            notificationSelectionRequired={true}
            notificationSelectionMade={enableEmailNotification || enableWhatsappNotification}
            onErrorsChange={(errors) => setFormHasBlockingErrors(errors.length > 0)}
          />

          {/* Action Buttons */}
          <div className="mio-form-actions">
            <button 
              type="submit" 
              className={`mio-submit-btn ${!formHasBlockingErrors && outwardItems.length > 0 ? 'mio-ready-to-submit' : 'disabled'}`}
              disabled={formHasBlockingErrors || outwardItems.length === 0}
              title={
                formHasBlockingErrors
                  ? 'Resolve all form errors before submitting'
                  : outwardItems.length === 0
                    ? 'Add at least one item to record outward'
                    : 'Ready to record outward'
              }
            >
              Record Outward {!formHasBlockingErrors && outwardItems.length > 0 ? '✓' : ''}
            </button>
            <button type="button" className="mio-reset-btn" onClick={() => {
              setOutwardItems([])
              setFormData({
                category: '',
                subCategory: '',
                materialName: '',
                specifications: '',
                uom: '',
                quantity: ''
              })
              setGeneralFormData({
                givenTo: '',
                description: ''
              })
              setCurrentQuantity(null)
              isFormActive.current = false
              alert('Form reset!')
            }}>Reset</button>
          </div>
        </form>
      </div>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="po-notification-modal-overlay">
          <div className="po-notification-modal">
            <div className="po-notification-modal-header">
              <h3>Send Material Outward Notification</h3>
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
                <h4>Outward Summary</h4>
                <div className="po-summary-item">
                  <strong>Given To:</strong> {lastSubmittedData?.givenTo}
                </div>
                <div className="po-summary-item">
                  <strong>Description:</strong> {lastSubmittedData?.description}
                </div>
                <div className="po-summary-item">
                  <strong>Date & Time:</strong> {lastSubmittedData?.dateTime ? formatDateTime(new Date(lastSubmittedData.dateTime)) : ''}
                </div>
                <div className="po-summary-item">
                  <strong>Items Count:</strong> {lastSubmittedData?.outwardItems?.length || 0}
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
                              {recipient['Email ID - To']}
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
      </div>
      <NotificationSummaryModal
        isOpen={showSummaryModal}
        onClose={handleCloseSummaryModal}
        stats={summaryModalData?.stats}
        contextDetails={summaryModalData?.contextDetails}
      />
    </>
  )
}

export default KR_MaterialOutward