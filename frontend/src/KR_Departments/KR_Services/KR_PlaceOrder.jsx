import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../PlaceOrder.css'

const KR_PlaceOrder = () => {
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
  const [orderCounter, setOrderCounter] = useState(1)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  
  // Material data from backend
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  // Utility functions for order counter management
  const getOrderCounter = () => {
    try {
      const stored = localStorage.getItem('kr_order_counter')
      return stored ? parseInt(stored, 10) : 0
    } catch (error) {
      console.error('Error reading order counter:', error)
      return 0
    }
  }

  const incrementOrderCounter = () => {
    try {
      const currentCounter = getOrderCounter()
      const newCounter = currentCounter + 1
      localStorage.setItem('kr_order_counter', newCounter.toString())
      return newCounter
    } catch (error) {
      console.error('Error incrementing order counter:', error)
      return 1
    }
  }

  const generateOrderId = (counter) => {
    const now = new Date()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const year = now.getFullYear().toString().slice(-2)
    const count = counter.toString().padStart(4, '0')
    return `KR_${month}${year}-${count}`
  }

  const registerSession = () => {
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
      const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
      
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

  // Fetch material data from backend
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

  // Update current date/time and generate order ID on component mount
  useEffect(() => {
    // Fetch material data first
    fetchMaterialData()
    
    // Update current date/time
    const updateDateTime = () => {
      setCurrentDateTime(new Date())
    }
    
    // Initialize order ID and session
    const initializeOrder = () => {
      // Clean up old sessions first
      cleanupOldSessions()
      
      // Get current counter without incrementing
      const currentCounter = getOrderCounter()
      setOrderCounter(currentCounter)
      
      // Generate new order ID
      const newOrderId = generateOrderId(currentCounter)
      setOrderId(newOrderId)
      
      // Register this session
      registerSession()
    }
    
    updateDateTime()
    initializeOrder()
    
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

  // Material data is now fetched from backend - no hardcoded data needed


  const uomOptions = ['kgs', 'nos', 'meters', 'pieces', 'liters']
  const importanceOptions = ['Normal', 'Urgent', 'Very-Urgent']

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
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
    }))
  }

  const handleAddItem = () => {
    // Validate required fields before adding item
    // Category and Material Name are mandatory, Sub-category and Particulars are optional
    if (!formData.category || !formData.materialName || !formData.uom || !formData.quantity) {
      alert('Please fill in all required fields (Category, Material Name, UOM, and Quantity) before adding an item.')
      return
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
    
    // Reset form after adding item
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
  }

  const handleRemoveItem = (itemId) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order.')
      return
    }
    if (!formData.givenBy || !formData.description) {
      alert('Please fill in all required fields (Given By and Description).')
      return
    }
    
    try {
      // Submit order to backend
      const orderData = {
        orderId,
        orderItems,
        givenBy: formData.givenBy,
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
        
        // Generate new order ID for next order (increment counter only after successful submission)
        const newCounter = incrementOrderCounter()
        setOrderCounter(newCounter)
        const newOrderId = generateOrderId(newCounter)
        setOrderId(newOrderId)
        
        // Register new session
        registerSession()
        
        // Reset form after successful submission
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
        
        alert(`Order ${orderId} submitted successfully! New order ID: ${newOrderId}`)
      } else {
        alert(`Failed to submit order: ${response.data.message}`)
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      alert(`Error submitting order: ${error.response?.data?.message || error.message}`)
    }
  }

  // Format date and time for display
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

  if (dataLoading) {
    return (
      <div className="place-order-container">
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
            <div className="order-id-box">
              {orderId}
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
    <div className="place-order-container">
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
          <div className="order-id-box">
            {orderId}
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="material-form">
        {/* Display added items */}
        {orderItems.map((item, index) => (
          <div key={item.id} className="added-item-display">
            <div className="item-info">
              <span className="item-number">{index + 1}.</span>
              <span className="item-details">
                <strong>{item.materialName}</strong>
                {item.subCategory && ` - ${item.subCategory}`}
                {item.particulars && ` - ${item.particulars}`}
              </span>
              <span className="item-quantity">
                {item.quantity} {item.uom}
              </span>
              <span className="item-category">{item.category}</span>
              <button
                type="button"
                onClick={() => handleRemoveItem(item.id)}
                className="remove-item-btn"
                title="Remove item"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* Form inputs for adding new item */}
        <div className="form-row">
          {/* Category - Required */}
          <div className="form-group">
            <label htmlFor="category" className="required">Category</label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              required
              className="form-select"
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

          {/* Material Name - Required */}
          <div className="form-group">
            <label htmlFor="materialName" className="required">Material Name</label>
            <select
              id="materialName"
              value={formData.materialName}
              onChange={(e) => handleInputChange('materialName', e.target.value)}
              required
              className="form-select"
              disabled={!formData.category || dataLoading}
            >
              <option value="">{dataLoading ? 'Loading materials...' : 'Select Material Name'}</option>
              {formData.category && (() => {
                const categoryData = materialData[formData.category];
                if (!categoryData) return null;
                
                // Handle direct material names (array)
                if (Array.isArray(categoryData.materialNames)) {
                  return categoryData.materialNames.map(material => (
                    <option key={material} value={material}>{material}</option>
                  ));
                }
                
                // Handle nested material names (object with particulars)
                if (formData.particulars && categoryData.materialNames[formData.particulars]) {
                  return categoryData.materialNames[formData.particulars].map(material => (
                    <option key={material} value={material}>{material}</option>
                  ));
                }
                
                // Handle nested material names (object with sub-categories)
                if (formData.subCategory && categoryData.materialNames[formData.subCategory]) {
                  const subCategoryData = categoryData.materialNames[formData.subCategory];
                  if (formData.particulars && subCategoryData[formData.particulars]) {
                    return subCategoryData[formData.particulars].map(material => (
                      <option key={material} value={material}>{material}</option>
                    ));
                  }
                }
                
                return null;
              })()}
            </select>
          </div>

          {/* UOM - Required */}
          <div className="form-group">
            <label htmlFor="uom" className="required">UOM</label>
            <select
              id="uom"
              value={formData.uom}
              onChange={(e) => handleInputChange('uom', e.target.value)}
              required
              className="form-select"
              disabled={dataLoading}
            >
              <option value="">Select UOM</option>
              {uomOptions.map(uom => (
                <option key={uom} value={uom}>{uom}</option>
              ))}
            </select>
          </div>

          {/* Quantity - Required */}
          <div className="form-group">
            <label htmlFor="quantity" className="required">Quantity *</label>
            <input
              type="number"
              id="quantity"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              required
              className="form-input"
              placeholder="Enter quantity"
              min="0"
              step="0.01"
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
            <input
              type="text"
              id="givenBy"
              value={formData.givenBy}
              onChange={(e) => handleInputChange('givenBy', e.target.value)}
              required
              className="form-input"
              placeholder="Enter name of person giving the order"
            />
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
              {importanceOptions.map(option => (
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


        <div className="form-actions">
          <button type="submit" className="submit-btn">Place Order</button>
          <button type="button" className="reset-btn" onClick={() => {
            // Clean up current session (discard incomplete order)
            cleanupSession()
            
            // Generate new order ID for fresh start (don't increment counter on reset)
            const currentCounter = getOrderCounter()
            setOrderCounter(currentCounter)
            const newOrderId = generateOrderId(currentCounter)
            setOrderId(newOrderId)
            
            // Register new session
            registerSession()
            
            // Reset form
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
            
            alert(`Order reset! New order ID: ${newOrderId}`)
          }}>Reset</button>
        </div>
      </form>
    </div>
  )
}

export default KR_PlaceOrder
