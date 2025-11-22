import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA, DEFAULT_WHATSAPP_URL } from '../../config'
import { useAuth } from '../../Components/AuthContext'
import '../../MaterialIn-Out.css'
import BackButton from '../../Components/BackButton'
import FormValidationErrors from '../../Components/FormValidationErrors'

// Constants
const UOM_OPTIONS = ['kgs', 'nos', 'meters', 'pieces', 'liters']
const LONG_PRESS_DURATION = 500 // 500ms for long press
const TOUCH_MOVE_THRESHOLD = 10 // pixels

const KR_MaterialOutward = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  
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

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [authorityNames, setAuthorityNames] = useState([])
  const [authorityLoading, setAuthorityLoading] = useState(true)

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
  const [whatsappAuthenticated, setWhatsappAuthenticated] = useState(false)
  const [whatsappStatusLoading, setWhatsappStatusLoading] = useState(false)
  
  // Ref to track if component is still mounted and form is active
  const isFormActive = useRef(true)
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
    // If no fields are filled, don't add anything
    if (!formData.category && !formData.materialName && !formData.uom && !formData.quantity) {
      return
    }
    
    // If some fields are filled but not all required ones, show validation
    if (formData.category || formData.materialName || formData.uom || formData.quantity) {
      if (!formData.category || !formData.materialName || !formData.uom || !formData.quantity) {
        alert('Please fill in all required fields (Category, Material Name, UOM, and Quantity) before adding an item.')
        return
      }
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
    setShowScreenFlash(true)
    setTimeout(() => {
      setShowScreenFlash(false)
    }, 600) // Remove overlay after animation completes
    
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

  // Check WhatsApp authentication status
  const checkWhatsAppAuthStatus = async () => {
    try {
      setWhatsappStatusLoading(true)
      const userIdentifier = user?.email || user?.username
      if (!userIdentifier) {
        console.error('No user identifier available for WhatsApp authentication')
        setWhatsappAuthenticated(false)
        return false
      }

      const res = await fetch(`${DEFAULT_WHATSAPP_URL}/api/whatsapp-status`, {
        credentials: 'include',
        headers: {
          'X-User-Email': userIdentifier,
          'Content-Type': 'application/json'
        }
      })

      if (res.ok) {
        const data = await res.json()
        const isAuthenticated = data.isReady || data.authenticated || false
        setWhatsappAuthenticated(isAuthenticated)
        return isAuthenticated
      } else {
        setWhatsappAuthenticated(false)
        return false
      }
    } catch (error) {
      console.error('Error checking WhatsApp auth status:', error)
      setWhatsappAuthenticated(false)
      return false
    } finally {
      setWhatsappStatusLoading(false)
    }
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
    
    // Check WhatsApp authentication
    if (!whatsappAuthenticated) {
      errors.push('WhatsApp service not available, please login')
    }
    
    return errors
  }

  // Check WhatsApp status on mount
  useEffect(() => {
    checkWhatsAppAuthStatus()
  }, [])

  // Validate form on state changes
  useEffect(() => {
    const errors = validateForm()
    setFormValidationErrors(errors)
  }, [outwardItems, generalFormData.givenTo, generalFormData.description, whatsappAuthenticated])

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
            timestamp: new Date().toISOString(),
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
                  ×
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
    <div className="place_order-container">
      {/* Screen Flash Overlay */}
      {showScreenFlash && <div className="mio-screen-flash-overlay" />}
      
      {/* Back Button Section - Always at top-left */}
      <BackButton label="Back to Store" to="/kerur/kr_store" />
      
      <div className="form-header">
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
                {/* Category - Required only if no items exist */}
                <div className="mio-form-group">
                  <label htmlFor="category" className={outwardItems.length === 0 ? "required" : ""}>
                    Category
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`mio-form-select ${outwardItems.length > 0 ? 'mio-optional-field' : ''}`}
                    disabled={dataLoading}
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


                {/* Material Name - Required only if no items exist */}
                <div className="mio-form-group">
                  <label htmlFor="materialName" className={outwardItems.length === 0 ? "required" : ""}>
                    Material Name
                  </label>
                  <select
                    id="materialName"
                    value={formData.materialName}
                    onChange={(e) => handleInputChange('materialName', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`mio-form-select ${outwardItems.length > 0 ? 'mio-optional-field' : ''}`}
                    disabled={!formData.category || dataLoading}
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

                {/* Quantity - Required only if no items exist */}
                <div className="mio-form-group">
                  <label htmlFor="quantity" className={outwardItems.length === 0 ? "required" : ""}>
                    Quantity
                  </label>
                  <input
                    type="text"
                    id="quantity"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`mio-form-input mio-quantity-input ${outwardItems.length > 0 ? 'mio-optional-field' : ''}`}
                    placeholder="Enter quantity"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    disabled={dataLoading}
                  />
                </div>

                {/* UOM - Required only if no items exist */}
                <div className="mio-form-group">
                  <label htmlFor="uom" className={outwardItems.length === 0 ? "required" : ""}>
                    UOM
                  </label>
                  <input
                    type="text"
                    id="uom"
                    value={formData.uom}
                    readOnly
                    required={outwardItems.length === 0}
                    className={`mio-form-input ${outwardItems.length > 0 ? 'mio-optional-field' : ''}`}
                    placeholder="UOM"
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: '#333'
                    }}
                    title="UOM is auto-selected based on material name"
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

          {/* Form Validation Errors */}
          <FormValidationErrors errors={formValidationErrors} />

          {/* Action Buttons */}
          <div className="mio-form-actions">
            <button 
              type="submit" 
              className={`mio-submit-btn ${outwardItems.length > 0 ? 'mio-ready-to-submit' : 'disabled'}`}
              disabled={outwardItems.length === 0}
              title={outwardItems.length === 0 ? 'Add at least one item to record outward' : 'Ready to record outward'}
            >
              Record Outward {outwardItems.length > 0 ? '✓' : ''}
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
    </div>
  )
}

export default KR_MaterialOutward