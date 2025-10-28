import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../MaterialIn-Out.css'

// Constants
const UOM_OPTIONS = ['kgs', 'nos', 'meters', 'pieces', 'liters']
const LONG_PRESS_DURATION = 500 // 500ms for long press
const TOUCH_MOVE_THRESHOLD = 10 // pixels

// Utility Functions

const OM_MaterialInward = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    materialName: '',
    specifications: '',
    uom: '',
    quantity: ''
  })

  // General form data for party name and place (applies to all items)
  const [generalFormData, setGeneralFormData] = useState({
    partyName: '',
    place: ''
  })


  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [partyNames, setPartyNames] = useState([])
  const [places, setPlaces] = useState([])
  const [partyPlaceMapping, setPartyPlaceMapping] = useState({}) // Store party name to place mapping
  const [partyLoading, setPartyLoading] = useState(true)
  const [placesLoading, setPlacesLoading] = useState(true)

  // Multi-item management
  const [inwardItems, setInwardItems] = useState([])
  
  // Edit functionality
  const [editingItem, setEditingItem] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  
  // Touch functionality for mobile
  const [touchStartTime, setTouchStartTime] = useState(null)
  const [touchStartPosition, setTouchStartPosition] = useState(null)

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
      const payload = {
        category: category,
        subCategory: subCategory || '',
        specifications: specifications || '',
        materialName: materialName,
        department: 'OM'
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
            department: 'OM'
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
  const handleAddItem = () => {
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

    const newItem = {
      id: Date.now(),
      category: formData.category,
      subCategory: formData.subCategory,
      specifications: formData.specifications,
      materialName: formData.materialName,
      uom: formData.uom,
      quantity: formData.quantity
    }

    setInwardItems(prev => [...prev, newItem])
    
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
  }

  const handleRemoveItem = (itemId) => {
    setInwardItems(prev => prev.filter(item => item.id !== itemId))
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

    const target = e.currentTarget
    target.classList.remove('touch-active')

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

  const handleSaveEdit = () => {
    if (!editFormData.category || !editFormData.materialName || !editFormData.uom || !editFormData.quantity) {
      alert('Please fill in all required fields (Category, Material Name, UOM, and Quantity) before saving.')
      return
    }

    setInwardItems(prev => prev.map(item => 
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

  // Helper function to render dropdown input field
  const renderDropdownInput = (field, label, required = false, options = []) => {
    const value = formData[field]
    
    return (
      <div className="form-group">
        <label htmlFor={field}>
          {label} {required && '*'}
        </label>
        <select
          id={field}
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          required={required}
          className="form-select"
          disabled={dataLoading || partyLoading || placesLoading || 
                   (field === 'subCategory' && !formData.category) || 
                   (field === 'particulars' && !formData.category) ||
                   (field === 'materialName' && !formData.category) ||
                   (field === 'uom' && !formData.category) ||
                   (field === 'partyName' && partyLoading) ||
                   (field === 'place' && placesLoading)}
        >
          <option value="">
            {field === 'partyName' && partyLoading ? 'Loading party names...' :
             field === 'place' && placesLoading ? 'Loading places...' :
             `Select ${label}`}
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

  // Fetch party and place data with mapping from Google Sheets
  const fetchPartyPlaceData = async () => {
    try {
      setPartyLoading(true)
      setPlacesLoading(true)
      
      // Find the Omkar plant data to get the sheet ID
      const omkarPlant = PLANT_DATA.find(plant => plant.document_name === 'OM')
      const sheetId = omkarPlant?.material_sheet_id
      
      if (!sheetId) {
        console.error('No sheet ID found for Omkar plant')
        setMessage('No Google Sheet configuration found for Omkar plant')
        setMessageType('error')
        return
      }
      
      const response = await axios.get(getApiUrl('get_party_place_data'), {
        params: { 
          factory: 'OM',
          sheet_name: 'Party List',
          sheet_id: sheetId
        }
      })
      
      if (response.data.success) {
        const { party_names, places, party_place_mapping } = response.data.data
        
        // Sort arrays alphabetically for better UX
        setPartyNames(party_names.sort())
        setPlaces(places.sort())
        setPartyPlaceMapping(party_place_mapping)
      } else {
        console.error('Failed to load party place data:', response.data.error)
        setMessage('Failed to load party and place data')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error fetching party place data:', error)
      setMessage('Error loading party and place data. Please try again.')
      setMessageType('error')
    } finally {
      setPartyLoading(false)
      setPlacesLoading(false)
    }
  }

  // Fetch material data from backend on component mount
  useEffect(() => {
    const fetchMaterialData = async () => {
      try {
        setDataLoading(true)
        const response = await axios.get(getApiUrl('get_material_data'), {
          params: { factory: 'OM' }
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
    fetchPartyPlaceData()
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
        })
      }

      // Auto-assign UOM when material name changes
      if (field === 'materialName' && value) {
        // First try to get UOM from local data (works even without specifications)
        if (newFormData.category && value) {
          const localUom = getUomForMaterial(
            newFormData.category,
            value,
            newFormData.subCategory,
            newFormData.specifications
          )
          if (localUom) {
            newFormData.uom = localUom
          }
          
          // If we have specifications, also fetch from backend for exact match
          if (newFormData.specifications) {
            setTimeout(() => {
              fetchMaterialUomFromBackend(
                newFormData.category,
                newFormData.subCategory || '',
                newFormData.specifications,
                value
              )
            }, 100)
          }
        }
      }

      // Auto-assign UOM when specifications change (if we have complete material details)
      if (field === 'specifications' && value && newFormData.category && newFormData.materialName) {
        // Fetch UOM from backend for exact match
        setTimeout(() => {
          fetchMaterialUomFromBackend(
            newFormData.category,
            newFormData.subCategory || '',
            value,
            newFormData.materialName
          )
        }, 100)
      }

      return newFormData
    })
  }

  const handleGeneralInputChange = (field, value) => {
    setGeneralFormData(prev => {
      const newGeneralFormData = {
        ...prev,
        [field]: value
      }

      // Auto-select place when party name is selected
      if (field === 'partyName' && value && partyPlaceMapping[value]) {
        newGeneralFormData.place = partyPlaceMapping[value]
      }

      return newGeneralFormData
    })
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (inwardItems.length === 0) {
      alert('Please add at least one item to record material inward.')
      return
    }

    if (!generalFormData.partyName || !generalFormData.place) {
      alert('Please fill in Party Name and Place for the inward record.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // Process each item individually using the existing endpoint
      let successCount = 0
      let errorCount = 0
      let quantityUpdates = []
      
      for (const item of inwardItems) {
        try {
          const payload = {
            category: item.category,
            subCategory: item.subCategory || '',
            specifications: item.specifications || '',
            materialName: item.materialName,
            uom: item.uom,
            quantity: item.quantity,
            partyName: generalFormData.partyName,
            place: generalFormData.place,
            timestamp: new Date().toISOString(),
            department: 'OM',
            type: 'inward'
          }

          const response = await axios.post(getApiUrl('material_inward'), payload)
          
          if (response.data.success) {
            successCount++
            // Store quantity update info
            if (response.data.previousQuantity !== undefined && response.data.newQuantity !== undefined) {
              quantityUpdates.push({
                material: item.materialName,
                previous: response.data.previousQuantity,
                new: response.data.newQuantity,
                added: item.quantity
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
        let successMsg = `Material inward recorded successfully! ${successCount} item(s) processed.${errorCount > 0 ? ` ${errorCount} item(s) failed.` : ''}\n\n`
        
        // Add quantity update details
        if (quantityUpdates.length > 0) {
          successMsg += 'Quantity Updates:\n'
          quantityUpdates.forEach(update => {
            successMsg += `• ${update.material}: ${update.previous} → ${update.new} (Added: ${update.added})\n`
          })
        }
        
        setMessage(successMsg)
        setMessageType('success')
        setInwardItems([])
        setFormData({
          category: '',
          subCategory: '',
          materialName: '',
          specifications: '',
          uom: '',
          quantity: ''
        })
        setGeneralFormData({
          partyName: '',
          place: ''
        })
      } else {
        setMessage('Failed to record any material inward items. Please try again.')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error recording material inward:', error)
      setMessage('Error recording material inward. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="place_order-container">
        <div className="form-header">
          <div className="header-center">
            <h2>Material Inward Form</h2>
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
          onClick={() => navigate('/omkar/om_store')} 
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
        <div className="header-center">
          <h2>Material Inward Form</h2>
        </div>
      </div>
      
      <div className="form-section">
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="material-form">

          {/* Added Items Table - Moved to top */}
          {inwardItems.length > 0 && (
            <div className="added-items-top-section">
              <div className="items-table-container">
                <h3>Added Items</h3>
                <table className="items-table">
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
                    {inwardItems.map((item, index) => (
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
                              {editFormData.category && getMaterialNameOptions(materialData[editFormData.category], editFormData.subCategory).map(name => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.materialName
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
                          className={editingItem === item.id ? "editing-cell" : "editable-cell"}
                          title={editingItem === item.id ? "UOM is auto-selected based on material name" : "UOM is auto-selected based on material name"}
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
                              title="UOM is auto-selected based on material name"
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
              {inwardItems.length === 0 && (
                <div className="add-item-section">
                  <h3 className="add-item-header">
                    Add Item to Inward
                  </h3>
                  <p className="add-item-description">
                    Fill in the required fields below to add your first item to the inward record.
                  </p>
                </div>
              )}
              <div className="form-row">
                {/* Category - Required only if no items exist */}
                <div className="form-group">
                  <label htmlFor="category" className={inwardItems.length === 0 ? "required" : ""}>
                    Category
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    required={inwardItems.length === 0}
                    className={`form-select ${inwardItems.length > 0 ? 'optional-field' : ''}`}
                    disabled={dataLoading || partyLoading || placesLoading}
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
                  <label htmlFor="materialName" className={inwardItems.length === 0 ? "required" : ""}>
                    Material Name
                  </label>
                  <select
                    id="materialName"
                    value={formData.materialName}
                    onChange={(e) => handleInputChange('materialName', e.target.value)}
                    required={inwardItems.length === 0}
                    className={`form-select ${inwardItems.length > 0 ? 'optional-field' : ''}`}
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
                <div className="form-group">
                  <label htmlFor="specifications">Specifications</label>
                  <select
                    id="specifications"
                    value={formData.specifications}
                    onChange={(e) => handleInputChange('specifications', e.target.value)}
                    className={`form-select ${!formData.specifications && formData.category && formData.materialName && getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length > 0 ? 'optional-field-red' : formData.specifications ? 'optional-field-green' : ''}`}
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
                <div className="form-group">
                  <label htmlFor="quantity" className={inwardItems.length === 0 ? "required" : ""}>
                    Quantity
                  </label>
                  <input
                    type="text"
                    id="quantity"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    required={inwardItems.length === 0}
                    className={`form-input quantity-input ${inwardItems.length > 0 ? 'optional-field' : ''}`}
                    placeholder="Enter quantity"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    disabled={dataLoading}
                  />
                </div>

                {/* UOM - Required only if no items exist */}
                <div className="form-group">
                  <label htmlFor="uom" className={inwardItems.length === 0 ? "required" : ""}>
                    UOM
                  </label>
                  <input
                    type="text"
                    id="uom"
                    value={formData.uom}
                    readOnly
                    required={inwardItems.length === 0}
                    className={`form-input ${inwardItems.length > 0 ? 'optional-field' : ''}`}
                    placeholder="UOM"
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: '#333'
                    }}
                    title="UOM is auto-selected based on material name"
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
            </div>
          </div>

          {/* General Form Fields - Party Name and Place */}
          <div className="form-row">
            {/* Party Name - Required */}
            <div className="form-group">
              <label htmlFor="generalPartyName" className="required">
                Party Name
              </label>
              <select
                id="generalPartyName"
                value={generalFormData.partyName}
                onChange={(e) => handleGeneralInputChange('partyName', e.target.value)}
                required
                className="form-select"
                disabled={partyLoading}
              >
                <option value="">{partyLoading ? 'Loading party names...' : 'Select Party Name'}</option>
                {partyNames.map(party => (
                  <option key={party} value={party}>{party}</option>
                ))}
              </select>
            </div>

            {/* Place - Required */}
            <div className="form-group">
              <label htmlFor="generalPlace" className="required">
                Place
              </label>
              <select
                id="generalPlace"
                value={generalFormData.place}
                onChange={(e) => handleGeneralInputChange('place', e.target.value)}
                required
                className="form-select"
                disabled={placesLoading}
              >
                <option value="">{placesLoading ? 'Loading places...' : 'Select Place'}</option>
                {places.map(place => (
                  <option key={place} value={place}>{place}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              type="submit" 
              className={`submit-btn ${inwardItems.length > 0 ? 'ready-to-submit' : 'disabled'}`}
              disabled={inwardItems.length === 0}
              title={inwardItems.length === 0 ? 'Add at least one item to record inward' : 'Ready to record inward'}
            >
              Record Inward {inwardItems.length > 0 ? '✓' : ''}
            </button>
            <button type="button" className="reset-btn" onClick={() => {
              setInwardItems([])
              setFormData({
                category: '',
                subCategory: '',
                materialName: '',
                specifications: '',
                uom: '',
                quantity: ''
              })
              setGeneralFormData({
                partyName: '',
                place: ''
              })
              alert('Form reset!')
            }}>Reset</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default OM_MaterialInward