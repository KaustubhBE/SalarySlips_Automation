import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../PlaceOrder.css'

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
  return `OM_${month.toString().padStart(2, '0')}${year.toString().padStart(2, '0')}-${(timestamp % 10000).toString().padStart(4, '0')}`
}

// Material Name Options Helper
const getMaterialNameOptions = (categoryData, particulars, subCategory) => {
  if (!categoryData) return null;
  
  // Handle direct material names (array)
  if (Array.isArray(categoryData.materialNames)) {
    return categoryData.materialNames.map(material => {
      const materialName = typeof material === 'string' ? material : material.name;
      const materialValue = typeof material === 'string' ? material : material.name;
      return (
        <option key={materialName} value={materialValue}>{materialName}</option>
      );
    });
  }
  
  // Handle nested material names (object with particulars)
  if (particulars && categoryData.materialNames[particulars]) {
    return categoryData.materialNames[particulars].map(material => {
      const materialName = typeof material === 'string' ? material : material.name;
      const materialValue = typeof material === 'string' ? material : material.name;
      return (
        <option key={materialName} value={materialValue}>{materialName}</option>
      );
    });
  }
  
  // Handle nested material names (object with sub-categories)
  if (subCategory && categoryData.materialNames[subCategory]) {
    const subCategoryData = categoryData.materialNames[subCategory];
    if (particulars && subCategoryData[particulars]) {
      return subCategoryData[particulars].map(material => {
        const materialName = typeof material === 'string' ? material : material.name;
        const materialValue = typeof material === 'string' ? material : material.name;
        return (
          <option key={materialName} value={materialValue}>{materialName}</option>
        );
      });
    }
  }
  
  return null;
}

// Helper function to get UOM for a material
const getUomForMaterial = (materialData, category, materialName, subCategory = '', particulars = '') => {
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

// Custom Hook for Material Data
const useMaterialData = () => {
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

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
      const activeSessions = JSON.parse(localStorage.getItem('om_active_sessions') || '{}')
      activeSessions[sessionId] = {
        timestamp: Date.now(),
        orderId: orderId
      }
      localStorage.setItem('om_active_sessions', JSON.stringify(activeSessions))
    } catch (error) {
      console.error('Error registering session:', error)
    }
  }

  const cleanupSession = () => {
    try {
      const activeSessions = JSON.parse(localStorage.getItem('om_active_sessions') || '{}')
      delete activeSessions[sessionId]
      localStorage.setItem('om_active_sessions', JSON.stringify(activeSessions))
    } catch (error) {
      console.error('Error cleaning up session:', error)
    }
  }

  const cleanupOldSessions = () => {
    try {
      const activeSessions = JSON.parse(localStorage.getItem('om_active_sessions') || '{}')
      const now = Date.now()
      
      Object.keys(activeSessions).forEach(sessionKey => {
        if (now - activeSessions[sessionKey].timestamp > SESSION_TIMEOUT) {
          delete activeSessions[sessionKey]
        }
      })
      
      localStorage.setItem('om_active_sessions', JSON.stringify(activeSessions))
    } catch (error) {
      console.error('Error cleaning up old sessions:', error)
    }
  }

  return { sessionId, registerSession, cleanupSession, cleanupOldSessions }
}

const OM_PlaceOrder = () => {
  const navigate = useNavigate()
  
  // State Management
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
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
      // Find the Omkar plant data to get the sheet ID
      const omkarPlant = PLANT_DATA.find(plant => plant.document_name === 'OM')
      const sheetId = omkarPlant?.material_sheet_id
      
      if (!sheetId) {
        console.error('No sheet ID found for Omkar plant')
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
      }
    } catch (error) {
      console.error('Error fetching authority list:', error)
    } finally {
      setAuthorityLoading(false)
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
        factory: 'OM'
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
          materialData,
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
      particulars: formData.particulars,
      materialName: formData.materialName,
      uom: formData.uom,
      quantity: formData.quantity
    }

    setOrderItems(prev => [...prev, newItem])
    
    // Reset only the item-specific fields after adding item, preserve order details
    setFormData(prev => ({
      ...prev,
      category: '',
      subCategory: '',
      particulars: '',
      materialName: '',
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
      particulars: item.particulars,
      materialName: item.materialName,
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
          materialData,
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
      // Submit order to backend using existing order ID
      const orderData = {
        orderId,
        orderItems,
        givenBy: formData.givenBy,
        description: formData.description,
        importance: formData.importance,
        factory: 'OM'
      }
      
      console.log('Submitting order data:', orderData)
      const response = await axios.post(getApiUrl('submit_order'), orderData)
      
      if (response.data.success) {
        // Mark order as completed in localStorage for backup
        try {
          const completedOrders = JSON.parse(localStorage.getItem('om_completed_orders') || '[]')
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
          localStorage.setItem('om_completed_orders', JSON.stringify(completedOrders))
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
        
        // Reset form after successful submission (keep same order ID)
        setFormData({
          category: '',
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          quantity: '',
          givenBy: '',
          description: '',
          importance: 'Normal'
        })
        setOrderItems([])
        
        alert(`Order ${orderId} submitted successfully!`)
      } else {
        alert(`Failed to submit order: ${response.data.message}`)
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      alert(`Error submitting order: ${error.response?.data?.message || error.message}`)
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
        {/* Form Status Indicator */}
        <div className="form-status">
          <div className={`status-indicator ${orderItems.length > 0 && formData.givenBy && formData.description ? 'ready' : 'incomplete'}`}>
            <span className="status-icon">
              {orderItems.length > 0 && formData.givenBy && formData.description ? '✓' : '⚠'}
            </span>
            <span className="status-text">
              {orderItems.length === 0 
                ? 'Add at least one item to place order' 
                : (!formData.givenBy || !formData.description) 
                  ? 'Fill in Given By and Description fields' 
                  : `Ready to place order! (${orderItems.length} item${orderItems.length > 1 ? 's' : ''} added)`
              }
            </span>
          </div>
        </div>

        {/* Added Items Table - Moved to top */}
        {orderItems.length > 0 && (
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
                            {editFormData.category && (() => {
                              const categoryData = materialData[editFormData.category];
                              if (!categoryData) return null;
                              
                              // If subCategory is selected, get particulars from subCategory structure
                              if (editFormData.subCategory && categoryData.materialNames && typeof categoryData.materialNames === 'object' && categoryData.materialNames[editFormData.subCategory]) {
                                return Object.keys(categoryData.materialNames[editFormData.subCategory]).map(particular => (
                                  <option key={particular} value={particular}>{particular}</option>
                                ));
                              }
                              
                              // Otherwise, get particulars from category level
                              return categoryData.particulars?.map(particular => (
                                <option key={particular} value={particular}>{particular}</option>
                              ));
                            })()}
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
                                {editFormData.category && getMaterialNameOptions(
                                  materialData[editFormData.category],
                                  editFormData.particulars,
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
              {formData.category && (() => {
                const categoryData = materialData[formData.category];
                if (!categoryData) return null;
                
                // If subCategory is selected, get particulars from subCategory structure
                if (formData.subCategory && categoryData.materialNames && typeof categoryData.materialNames === 'object' && categoryData.materialNames[formData.subCategory]) {
                  return Object.keys(categoryData.materialNames[formData.subCategory]).map(particular => (
                    <option key={particular} value={particular}>{particular}</option>
                  ));
                }
                
                // Otherwise, get particulars from category level
                return categoryData.particulars?.map(particular => (
                  <option key={particular} value={particular}>{particular}</option>
                ));
              })()}
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
                formData.particulars,
                formData.subCategory
              )}
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
              UOM (Auto-selected)
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
            title={orderItems.length === 0 ? 'Add at least one item' : (!formData.givenBy || !formData.description) ? 'Fill in Given By and Description' : 'Ready to submit'}
          >
            Place Order {orderItems.length > 0 && formData.givenBy && formData.description ? '✓' : ''}
          </button>
          <button type="button" className="reset-btn" onClick={() => {
            // Reset form but keep the same order ID
            setFormData({
              category: '',
              subCategory: '',
              particulars: '',
              materialName: '',
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
    </div>
  )
}

export default OM_PlaceOrder

