import React, { useState, useEffect } from 'react'
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

  // Update current date/time and generate order ID on component mount
  useEffect(() => {
    // Update current date/time
    const updateDateTime = () => {
      setCurrentDateTime(new Date())
    }
    
    // Initialize order ID and session
    const initializeOrder = () => {
      // Clean up old sessions first
      cleanupOldSessions()
      
      // Get current counter and increment it
      const newCounter = incrementOrderCounter()
      setOrderCounter(newCounter)
      
      // Generate new order ID
      const newOrderId = generateOrderId(newCounter)
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

  // Sample data based on the image
  const categories = [
    'Compressor', 'Consummables', 'Continental', 'Controller', 'Cpvc', 'Dust Collector', 'Electrical', 'Etp', 
    'Flange Bearing', 'Granulation', 'Hss Drill', 'Investa Pump', 'Maintenance', 'Maxflow Pump', 'Mc Material', 
    'Miscellaneous', 'MS Material', 'Naga Pump', 'Nuts, Bolts & Washer', 'Oil Seal', 'Packing Sheets', 'Paint', 
    'Pedestal Bearing', 'Plumber Block', 'PPH Material', 'PTFE Material', 'Pulley', 'Pump Motor', 'Pumps', 'PVDF Material', 
    'Reactor Tanks', 'Reactor Unloading', 'Rotary', 'Safety', 'Screw', 'Shaft', 'SKF Bearing', 'Sleeve', 'Spanner', 'Sprocket', 
    'SS Material', 'Stationery', 'Vehicles', 'VFD'
  ]

  // Data structure where category and material name are mandatory
  // Sub-category and particulars are optional and can be missing
  const materialData = {
    'Compressor': {
      subCategories: [],
      particulars: [],
      materialNames: ['Air Compressor 5HP', 'Air Compressor 10HP', 'Compressor Oil Filter', 'Compressor Belt']
    },
    'Consummables': {
      subCategories: [],
      particulars: [],
      materialNames: ['Safety Gloves', 'Safety Goggles', 'Cleaning Cloth', 'Disposable Masks']
    },
    'Continental': {
      subCategories: [],
      particulars: ['V Belt'],
      materialNames: {
        'V Belt': ['3 Ply - 700 mm Width', '3 Ply - 1200 mm Width / 10 mm Thick', 'A-45', 'B-192', 'C-62', 
          'C-68', 'C-73', 'C-79', 'C-83', 'C-86', 'C-88', 'C-92', 'C-96', 'C-97', 'C-98', 'C-99', 'C-101', 'C-110', 'C-115', 
          'C-118', 'C-125', 'C-128', 'C-134', 'C-150', 'C-166', 'C-170', 'C-175', 'C-192', 'C-196']
      }
    },
    'Controller': {
      subCategories: [],
      particulars: [],
      materialNames: ['Al - 7981 Temperature Controller', 'PID Controller', 'Pressure Controller', 'Flow Controller']
    },
    'Cpvc': {
      subCategories: [],
      particulars: [],
      materialNames: ['Cpvc Bend 1 inches', 'Cpvc Bend 1.5 inches', 'Cpvc Ball Valve 1 inches', 'Cpvc Ball Valve 1.5 inches', 
        'Cpvc Coller 1 inches', 'Cpvc Coller 1.5 inches', 'Cpvc Fta 1 inches', 'Cpvc Male Adaptor 1 inches', 
        'Cpvc Pipe 1.5 inches 5 mtr', 'Cpvc Solvent 118 ml', 'Cpvc Tank Nipple 1 inches', 'Cpvc Tank Nipple 1.5 inches', 
        'Cpvc Tee 1 inches', 'Cpvc Tee 1.5 inches', 'Cpvc Reduser 1.5 inches * 1 inches']
    },
    'Dust Collector': {
      subCategories: [],
      particulars: [],
      materialNames: ['Dust Collector Bag', 'Dust Collector Filter', 'Dust Collector Motor', 'Dust Collector Duct']
    },
    'Electrical': {
      subCategories: [],
      particulars: [],
      materialNames: ['Electrical Wire 2.5mm', 'Electrical Wire 4mm', 'MCB 16A', 'MCB 32A', 'Switch Socket', 'LED Bulb']
    },
    'Etp': {
      subCategories: [],
      particulars: [],
      materialNames: ['ETP Pump', 'ETP Filter', 'ETP Chemical', 'ETP Pipe']
    },
    'Flange Bearing': {
      subCategories: [],
      particulars: [],
      materialNames: ['Flange Bearing 6205', 'Flange Bearing 6206', 'Flange Bearing 6207', 'Flange Bearing 6208']
    },
    'Granulation': {
      subCategories: [],
      particulars: [],
      materialNames: ['Granulation Die', 'Granulation Knife', 'Granulation Screen', 'Granulation Roller']
    },
    'Hss Drill': {
      subCategories: [],
      particulars: [],
      materialNames: ['HSS Drill 3mm', 'HSS Drill 5mm', 'HSS Drill 8mm', 'HSS Drill 10mm', 'HSS Drill 12mm']
    },
    'Investa Pump': {
      subCategories: [],
      particulars: [],
      materialNames: ['Investa Pump 1HP', 'Investa Pump 2HP', 'Investa Pump 5HP', 'Investa Pump Spare Parts']
    },
    'Maintenance': {
      subCategories: [],
      particulars: [],
      materialNames: ['Maintenance Kit', 'Lubricating Oil', 'Grease Gun', 'Maintenance Tools']
    },
    'Maxflow Pump': {
      subCategories: [],
      particulars: [],
      materialNames: ['Maxflow Pump 1HP', 'Maxflow Pump 2HP', 'Maxflow Pump 5HP', 'Maxflow Pump Spare Parts']
    },
    'Mc Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['MC Sheet 1mm', 'MC Sheet 2mm', 'MC Sheet 3mm', 'MC Angle', 'MC Channel']
    },
    'Miscellaneous': {
      subCategories: [],
      particulars: [],
      materialNames: ['Miscellaneous Items', 'General Purpose Items', 'Various Components']
    },
    'MS Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['MS Sheet 1mm', 'MS Sheet 2mm', 'MS Sheet 3mm', 'MS Angle', 'MS Channel', 'MS Pipe']
    },
    'Naga Pump': {
      subCategories: [],
      particulars: [],
      materialNames: ['Naga Pump 1HP', 'Naga Pump 2HP', 'Naga Pump 5HP', 'Naga Pump Spare Parts']
    },
    'Nuts, Bolts & Washer': {
      subCategories: [],
      particulars: [],
      materialNames: ['M8 Nuts', 'M10 Nuts', 'M12 Nuts', 'M8 Bolts', 'M10 Bolts', 'M12 Bolts', 'Washers', 'Spring Washers']
    },
    'Oil Seal': {
      subCategories: [],
      particulars: [],
      materialNames: ['Oil Seal 20x35x7', 'Oil Seal 25x40x7', 'Oil Seal 30x45x7', 'Oil Seal 35x50x7']
    },
    'Packing Sheets': {
      subCategories: [],
      particulars: [],
      materialNames: ['Packing Sheet 1mm', 'Packing Sheet 2mm', 'Packing Sheet 3mm', 'Packing Sheet 5mm']
    },
    'Paint': {
      subCategories: [],
      particulars: [],
      materialNames: ['Red Paint 1L', 'Blue Paint 1L', 'Green Paint 1L', 'White Paint 1L', 'Black Paint 1L']
    },
    'Pedestal Bearing': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pedestal Bearing 6205', 'Pedestal Bearing 6206', 'Pedestal Bearing 6207', 'Pedestal Bearing 6208']
    },
    'Plumber Block': {
      subCategories: [],
      particulars: [],
      materialNames: ['Plumber Block 1 inch', 'Plumber Block 1.5 inch', 'Plumber Block 2 inch', 'Plumber Block 3 inch']
    },
    'PPH Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['PPH Pipe 1 inch', 'PPH Pipe 1.5 inch', 'PPH Pipe 2 inch', 'PPH Fitting', 'PPH Valve']
    },
    'PTFE Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['PTFE Sheet 1mm', 'PTFE Sheet 2mm', 'PTFE Sheet 3mm', 'PTFE Gasket', 'PTFE Tape']
    },
    'Pulley': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pulley 2 inch', 'Pulley 3 inch', 'Pulley 4 inch', 'Pulley 5 inch', 'Pulley 6 inch']
    },
    'Pump Motor': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pump Motor 1HP', 'Pump Motor 2HP', 'Pump Motor 5HP', 'Pump Motor 10HP']
    },
    'Pumps': {
      subCategories: ['Alfa Pump', 'Apex Pump'],
      particulars: {
        'Alfa Pump': ['5 HP, ALFA 160 CT'],
        'Apex Pump': ['5 HP, ACP - 55']
      },
      materialNames: {
        'Alfa Pump': {
          '5 HP, ALFA 160 CT': ['Back Plate', 'Bearing 3306', 'Casing', 'Impeller', 'Pump Shaft NK-C 100, 112', 
            'Shaft', 'Stationary Seal Ring, Alfa -Kss -R/D']
        },
        'Apex Pump': {
          '5 HP, ACP - 55': ['Adopter', 'Armour Plate MS', 'Bearing Frame', 
            'Ceramic Sleeve', 'Ceramic Stationary', 'Ceramic Stationary 3/8*', 'Fastner (SS Stud 3/8" * 6" with Nut Washer)', 
            'Fastner (SS Stud 3/8" * 3")', 'GFPP Back Cover / Back Plate', 'GFPP Impeller', 'Gland Plate', 'PP Casing', 
            'PP Impeller', 'Shaft', 'Teflon Bellow Silicon Face Rotary', 'Teflon Bellow Silicon Face / Rotary  3/8"']
        }
      }
    },
    'PVDF Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['PVDF Sheet 1mm', 'PVDF Sheet 2mm', 'PVDF Sheet 3mm', 'PVDF Pipe', 'PVDF Fitting']
    },
    'Reactor Tanks': {
      subCategories: [],
      particulars: [],
      materialNames: ['Reactor Tank 100L', 'Reactor Tank 500L', 'Reactor Tank 1000L', 'Reactor Tank 2000L']
    },
    'Reactor Unloading': {
      subCategories: [],
      particulars: [],
      materialNames: ['Unloading Pump', 'Unloading Valve', 'Unloading Pipe', 'Unloading Fitting']
    },
    'Rotary': {
      subCategories: [],
      particulars: [],
      materialNames: ['Rotary Joint', 'Rotary Seal', 'Rotary Bearing', 'Rotary Shaft']
    },
    'Safety': {
      subCategories: [],
      particulars: [],
      materialNames: ['Safety Helmet', 'Safety Shoes', 'Safety Harness', 'Fire Extinguisher', 'First Aid Kit']
    },
    'Screw': {
      subCategories: [],
      particulars: [],
      materialNames: ['Screw M6x20', 'Screw M8x25', 'Screw M10x30', 'Screw M12x35', 'Screw M16x40']
    },
    'Shaft': {
      subCategories: [],
      particulars: [],
      materialNames: ['Shaft 20mm', 'Shaft 25mm', 'Shaft 30mm', 'Shaft 35mm', 'Shaft 40mm']
    },
    'SKF Bearing': {
      subCategories: [],
      particulars: [],
      materialNames: ['SKF Bearing 6205', 'SKF Bearing 6206', 'SKF Bearing 6207', 'SKF Bearing 6208', 'SKF Bearing 6309']
    },
    'Sleeve': {
      subCategories: [],
      particulars: [],
      materialNames: ['Sleeve 20mm', 'Sleeve 25mm', 'Sleeve 30mm', 'Sleeve 35mm', 'Sleeve 40mm']
    },
    'Spanner': {
      subCategories: [],
      particulars: [],
      materialNames: ['Spanner Set 8-32mm', 'Spanner 10mm', 'Spanner 12mm', 'Spanner 14mm', 'Spanner 17mm']
    },
    'Sprocket': {
      subCategories: [],
      particulars: [],
      materialNames: ['Sprocket 20 Teeth', 'Sprocket 30 Teeth', 'Sprocket 40 Teeth', 'Sprocket 50 Teeth']
    },
    'SS Material': {
      subCategories: [],
      particulars: [],
      materialNames: ['SS Sheet 1mm', 'SS Sheet 2mm', 'SS Sheet 3mm', 'SS Angle', 'SS Channel', 'SS Pipe']
    },
    'Stationery': {
      subCategories: [],
      particulars: [],
      materialNames: ['Pen', 'Pencil', 'Notebook', 'File Folder', 'Stapler', 'Paper']
    },
    'Vehicles': {
      subCategories: [],
      particulars: [],
      materialNames: ['Vehicle Spare Parts', 'Engine Oil', 'Brake Fluid', 'Coolant', 'Tire']
    },
    'VFD': {
      subCategories: [],
      particulars: [],
      materialNames: ['VFD 1HP', 'VFD 2HP', 'VFD 5HP', 'VFD 10HP', 'VFD 15HP']
    }
  }


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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order.')
      return
    }
    if (!formData.givenBy || !formData.description) {
      alert('Please fill in all required fields (Given By and Description).')
      return
    }
    
    // Mark order as completed in localStorage
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
      console.error('Error saving completed order:', error)
    }
    
    console.log('Order submitted:', {
      orderId,
      orderItems,
      givenBy: formData.givenBy,
      description: formData.description,
      importance: formData.importance
    })
    
    // Clean up current session
    cleanupSession()
    
    // Generate new order ID for next order
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
    
    // Add your submission logic here
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
            >
              <option value="">Select Category</option>
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
              disabled={!formData.category}
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
              disabled={!formData.category}
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
              disabled={!formData.category}
            >
              <option value="">Select Material Name</option>
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

        {/* Order Summary */}
        {orderItems.length > 0 && (
          <div className="order-items-section">
            <h3>Order Summary - Total Items: {orderItems.length}</h3>
            <div className="order-items-list">
              {orderItems.map((item, index) => (
                <div key={item.id} className="order-item">
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
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="remove-item-btn"
                    title="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="submit-btn">Place Order</button>
          <button type="button" className="reset-btn" onClick={() => {
            // Clean up current session (discard incomplete order)
            cleanupSession()
            
            // Generate new order ID for fresh start
            const newCounter = incrementOrderCounter()
            setOrderCounter(newCounter)
            const newOrderId = generateOrderId(newCounter)
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
