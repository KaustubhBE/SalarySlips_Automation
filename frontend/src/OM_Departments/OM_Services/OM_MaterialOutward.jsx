import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../MaterialIn-Out.css'

// Constants
const UOM_OPTIONS = ['kgs', 'nos', 'meters', 'pieces', 'liters']
const LONG_PRESS_DURATION = 500 // 500ms for long press
const TOUCH_MOVE_THRESHOLD = 10 // pixels

const OM_MaterialOutward = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
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
  
  // Touch functionality for mobile
  const [touchStartTime, setTouchStartTime] = useState(null)
  const [touchStartPosition, setTouchStartPosition] = useState(null)

  // Helper function to get UOM for a material
  const getUomForMaterial = (category, materialName, subCategory = '', particulars = '') => {
    if (!category || !materialName || !materialData[category]) {
      return ''
    }
    
    const categoryData = materialData[category]
    let materialNames = categoryData.materialNames || []
    
    // If materialNames is an array (simple structure)
    if (Array.isArray(materialNames)) {
      // Find the material in the simple array structure
      const material = materialNames.find(mat => 
        (typeof mat === 'string' ? mat : mat.name) === materialName
      )
      return material && typeof material === 'object' ? material.uom : ''
    }
    
    // If materialNames is an object (nested structure)
    if (typeof materialNames === 'object') {
      // Handle nested structure: particulars -> materials
      if (particulars && materialNames[particulars]) {
        const materials = materialNames[particulars]
        const material = materials.find(mat => 
          (typeof mat === 'string' ? mat : mat.name) === materialName
        )
        return material && typeof material === 'object' ? material.uom : ''
      }
      
      // Handle nested structure: subCategory -> particulars -> materials
      if (subCategory && materialNames[subCategory]) {
        const subCategoryData = materialNames[subCategory]
        if (particulars && subCategoryData[particulars]) {
          const materials = subCategoryData[particulars]
          const material = materials.find(mat => 
            (typeof mat === 'string' ? mat : mat.name) === materialName
          )
          return material && typeof material === 'object' ? material.uom : ''
        }
      }
    }
    
    return ''
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
      particulars: formData.particulars,
      materialName: formData.materialName,
      uom: formData.uom,
      quantity: formData.quantity
    }

    setOutwardItems(prev => [...prev, newItem])
    
    // Reset only the item-specific fields after adding item
    setFormData(prev => ({
      ...prev,
      category: '',
      subCategory: '',
      particulars: '',
      materialName: '',
      uom: '',
      quantity: ''
    }))
  }

  const handleRemoveItem = (itemId) => {
    setOutwardItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleEditItem = (item) => {
    setEditingItem(item.id)
    setEditFormData({
      category: item.category,
      subCategory: item.subCategory,
      particulars: item.particulars,
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
      particulars: item.particulars,
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
    setEditFormData(prev => {
      const newEditFormData = {
        ...prev,
        [field]: value,
        // Reset dependent fields when category changes
        ...(field === 'category' && {
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          particulars: '',
          materialName: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when particulars changes
        ...(field === 'particulars' && {
          materialName: '',
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
          newEditFormData.particulars
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

    setOutwardItems(prev => prev.map(item => 
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
          disabled={dataLoading || authorityLoading || 
                   (field === 'subCategory' && !formData.category) || 
                   (field === 'particulars' && !formData.category) ||
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
      // Find the Omkar plant data to get the sheet ID
      const omkarPlant = PLANT_DATA.find(plant => plant.document_name === 'OM')
      const sheetId = omkarPlant?.material_sheet_id
      
      if (!sheetId) {
        console.error('No sheet ID found for Omkar plant')
        setMessage('No Google Sheet configuration found for Kerur plant')
        setMessageType('error')
        return
      }
      
      const response = await axios.get(getApiUrl('get_authority_list'), {
        params: { 
          factory: 'OM',
          sheet_name: 'Authority List',
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
    fetchAuthorityList()
  }, [])

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newFormData = {
        ...prev,
        [field]: value,
        // Reset dependent fields when category changes
        ...(field === 'category' && {
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          particulars: '',
          materialName: '',
          uom: '',
          quantity: ''
        }),
        // Reset dependent fields when particulars changes
        ...(field === 'particulars' && {
          materialName: '',
          uom: '',
          quantity: ''
        })
      }

      // Auto-assign UOM when material name changes
      if (field === 'materialName' && value) {
        const autoUom = getUomForMaterial(
          newFormData.category,
          value,
          newFormData.subCategory,
          newFormData.particulars
        )
        if (autoUom) {
          newFormData.uom = autoUom
        }
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
      
      for (const item of outwardItems) {
        try {
          const payload = {
            category: item.category,
            subCategory: item.subCategory || '',
            particulars: item.particulars || '',
            materialName: item.materialName,
            uom: item.uom,
            quantity: item.quantity,
            givenTo: generalFormData.givenTo,
            description: generalFormData.description,
            timestamp: new Date().toISOString(),
            department: 'OM',
            type: 'outward'
          }

          const response = await axios.post(getApiUrl('material_outward'), payload)
          
          if (response.data.success) {
            successCount++
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
        setMessage(`Material outward recorded successfully! ${successCount} item(s) processed.${errorCount > 0 ? ` ${errorCount} item(s) failed.` : ''}`)
        setMessageType('success')
        setOutwardItems([])
        setFormData({
          category: '',
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          quantity: ''
        })
        setGeneralFormData({
          givenTo: '',
          description: ''
        })
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

  if (dataLoading) {
    return (
      <div className="place_order-container">
        <div className="form-header">
          <div className="header-center">
            <h2>Material Outward Form</h2>
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
          <h2>Material Outward Form</h2>
        </div>
      </div>
      
      <div className="form-section">
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="material-form">
          {/* Form Status Indicator */}
          <div className="form-status">
            <div className={`status-indicator ${outwardItems.length > 0 ? 'ready' : 'incomplete'}`}>
              <span className="status-icon">
                {outwardItems.length > 0 ? '✓' : '⚠'}
              </span>
              <span className="status-text">
                {outwardItems.length === 0 
                  ? 'Add at least one item to record material outward' 
                  : `Ready to record outward! (${outwardItems.length} item${outwardItems.length > 1 ? 's' : ''} added)`
                }
              </span>
            </div>
          </div>

          {/* Added Items Table - Moved to top */}
          {outwardItems.length > 0 && (
            <div className="added-items-top-section">
              <div className="items-table-container">
                <h3>Added Items</h3>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Category</th>
                      <th>Sub Category</th>
                      <th>Particulars</th>
                      <th>Material Name</th>
                      <th>Quantity</th>
                      <th>UOM</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outwardItems.map((item, index) => (
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
                          data-label="Particulars"
                          className={editingItem === item.id ? "editing-cell" : "editable-cell"}
                          onDoubleClick={() => handleDoubleClickEdit(item, 'particulars')}
                          onTouchStart={(e) => handleTouchStart(e, item, 'particulars')}
                          onTouchEnd={(e) => handleTouchEnd(e, item, 'particulars')}
                          onTouchMove={handleTouchMove}
                          title={editingItem === item.id ? "" : "Double-click or long press to edit"}
                        >
                          {editingItem === item.id ? (
                            <select
                              value={editFormData.particulars}
                              onChange={(e) => handleEditInputChange('particulars', e.target.value)}
                              className="edit-select"
                              disabled={!editFormData.category}
                            >
                              <option value="">Select Particulars</option>
                              {editFormData.category && materialData[editFormData.category]?.particulars?.map(particular => (
                                <option key={particular} value={particular}>{particular}</option>
                              ))}
                            </select>
                          ) : (
                            item.particulars || '-'
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
                              {editFormData.category && (() => {
                                const categoryData = materialData[editFormData.category];
                                if (!categoryData) return null;
                                
                                let materialNames = categoryData.materialNames || [];
                                
                                if (Array.isArray(materialNames)) {
                                  return materialNames.map(mat => (
                                    <option key={typeof mat === 'string' ? mat : mat.name} value={typeof mat === 'string' ? mat : mat.name}>
                                      {typeof mat === 'string' ? mat : mat.name}
                                    </option>
                                  ));
                                }
                                
                                if (typeof materialNames === 'object') {
                                  if (editFormData.particulars && materialNames[editFormData.particulars]) {
                                    return materialNames[editFormData.particulars].map(mat => (
                                      <option key={typeof mat === 'string' ? mat : mat.name} value={typeof mat === 'string' ? mat : mat.name}>
                                        {typeof mat === 'string' ? mat : mat.name}
                                      </option>
                                    ));
                                  }
                                  
                                  if (editFormData.subCategory && materialNames[editFormData.subCategory]) {
                                    const subCategoryData = materialNames[editFormData.subCategory];
                                    if (editFormData.particulars && subCategoryData[editFormData.particulars]) {
                                      return subCategoryData[editFormData.particulars].map(mat => (
                                        <option key={typeof mat === 'string' ? mat : mat.name} value={typeof mat === 'string' ? mat : mat.name}>
                                          {typeof mat === 'string' ? mat : mat.name}
                                        </option>
                                      ));
                                    }
                                  }
                                }
                                
                                return null;
                              })()}
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
              {outwardItems.length === 0 && (
                <div className="add-item-section">
                  <h3 className="add-item-header">
                    Add Item to Outward
                  </h3>
                  <p className="add-item-description">
                    Fill in the required fields below to add your first item to the outward record.
                  </p>
                </div>
              )}
              <div className="form-row">
                {/* Category - Required only if no items exist */}
                <div className="form-group">
                  <label htmlFor="category" className={outwardItems.length === 0 ? "required" : ""}>
                    Category
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`form-select ${outwardItems.length > 0 ? 'optional-field' : ''}`}
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
                    className="form-select"
                    disabled={!formData.category || dataLoading}
                  >
                    <option value="">Select Sub Category</option>
                    {formData.category && materialData[formData.category]?.subCategories?.map(subCat => (
                      <option key={subCat} value={subCat}>{subCat}</option>
                    ))}
                  </select>
                </div>

                {/* Particulars - Optional */}
                <div className="form-group">
                  <label htmlFor="particulars">Particulars</label>
                  <select
                    id="particulars"
                    value={formData.particulars}
                    onChange={(e) => handleInputChange('particulars', e.target.value)}
                    className="form-select"
                    disabled={!formData.category || dataLoading}
                  >
                    <option value="">Select Particulars</option>
                    {formData.category && materialData[formData.category]?.particulars?.map(particular => (
                      <option key={particular} value={particular}>{particular}</option>
                    ))}
                  </select>
                </div>

                {/* Material Name - Required only if no items exist */}
                <div className="form-group">
                  <label htmlFor="materialName" className={outwardItems.length === 0 ? "required" : ""}>
                    Material Name
                  </label>
                  <select
                    id="materialName"
                    value={formData.materialName}
                    onChange={(e) => handleInputChange('materialName', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`form-select ${outwardItems.length > 0 ? 'optional-field' : ''}`}
                    disabled={!formData.category || dataLoading}
                  >
                    <option value="">{dataLoading ? 'Loading materials...' : 'Select Material Name'}</option>
                    {formData.category && (() => {
                      const categoryData = materialData[formData.category];
                      if (!categoryData) return null;
                      
                      let materialNames = categoryData.materialNames || [];
                      
                      if (Array.isArray(materialNames)) {
                        return materialNames.map(mat => (
                          <option key={typeof mat === 'string' ? mat : mat.name} value={typeof mat === 'string' ? mat : mat.name}>
                            {typeof mat === 'string' ? mat : mat.name}
                          </option>
                        ));
                      }
                      
                      if (typeof materialNames === 'object') {
                        if (formData.particulars && materialNames[formData.particulars]) {
                          return materialNames[formData.particulars].map(mat => (
                            <option key={typeof mat === 'string' ? mat : mat.name} value={typeof mat === 'string' ? mat : mat.name}>
                              {typeof mat === 'string' ? mat : mat.name}
                            </option>
                          ));
                        }
                        
                        if (formData.subCategory && materialNames[formData.subCategory]) {
                          const subCategoryData = materialNames[formData.subCategory];
                          if (formData.particulars && subCategoryData[formData.particulars]) {
                            return subCategoryData[formData.particulars].map(mat => (
                              <option key={typeof mat === 'string' ? mat : mat.name} value={typeof mat === 'string' ? mat : mat.name}>
                                {typeof mat === 'string' ? mat : mat.name}
                              </option>
                            ));
                          }
                        }
                      }
                      
                      return null;
                    })()}
                  </select>
                </div>

                {/* Quantity - Required only if no items exist */}
                <div className="form-group">
                  <label htmlFor="quantity" className={outwardItems.length === 0 ? "required" : ""}>
                    Quantity
                  </label>
                  <input
                    type="text"
                    id="quantity"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    required={outwardItems.length === 0}
                    className={`form-input quantity-input ${outwardItems.length > 0 ? 'optional-field' : ''}`}
                    placeholder="Enter quantity"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    disabled={dataLoading}
                  />
                </div>

                {/* UOM - Required only if no items exist */}
                <div className="form-group">
                  <label htmlFor="uom" className={outwardItems.length === 0 ? "required" : ""}>
                    UOM
                  </label>
                  <input
                    type="text"
                    id="uom"
                    value={formData.uom}
                    readOnly
                    required={outwardItems.length === 0}
                    className={`form-input ${outwardItems.length > 0 ? 'optional-field' : ''}`}
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

          {/* General Form Fields - Given To and Description */}
          <div className="form-row">
            {/* Given To - Required */}
            <div className="form-group">
              <label htmlFor="generalGivenTo" className="required">
                Given To *
              </label>
              <select
                id="generalGivenTo"
                value={generalFormData.givenTo}
                onChange={(e) => handleGeneralInputChange('givenTo', e.target.value)}
                required
                className="form-select"
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
            <div className="form-group">
              <label htmlFor="generalDescription" className="required">
                Description *
              </label>
              <textarea
                id="generalDescription"
                value={generalFormData.description}
                onChange={(e) => handleGeneralInputChange('description', e.target.value)}
                required
                className="form-textarea"
                placeholder="Enter detailed description of the material outward"
                rows="4"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              type="submit" 
              className={`submit-btn ${outwardItems.length > 0 ? 'ready-to-submit' : 'disabled'}`}
              disabled={outwardItems.length === 0}
              title={outwardItems.length === 0 ? 'Add at least one item' : 'Ready to record outward'}
            >
              Record Outward {outwardItems.length > 0 ? '✓' : ''}
            </button>
            <button type="button" className="reset-btn" onClick={() => {
              setOutwardItems([])
              setFormData({
                category: '',
                subCategory: '',
                particulars: '',
                materialName: '',
                uom: '',
                quantity: ''
              })
              setGeneralFormData({
                givenTo: '',
                description: ''
              })
              alert('Form reset!')
            }}>Reset</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default OM_MaterialOutward