import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialIn-Out.css'

const KR_MaterialOutward = () => {
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
    uom: '',
    quantity: ''
  })


  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const uomOptions = ['kgs', 'nos', 'meters', 'pieces', 'liters']

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
          disabled={dataLoading || (field === 'subCategory' && !formData.category) || 
                   (field === 'particulars' && !formData.category) ||
                   (field === 'materialName' && !formData.category) ||
                   (field === 'uom' && !formData.category)}
        >
          <option value="">Select {label}</option>
          {options.map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Fetch material data from backend on component mount
  useEffect(() => {
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
  }, [])

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


  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.category || !formData.materialName || !formData.uom || !formData.quantity) {
      setMessage('Please fill in all required fields (Category, Material Name, UOM, and Quantity)')
      setMessageType('error')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const payload = {
        category: formData.category,
        subCategory: formData.subCategory || '',
        particulars: formData.particulars || '',
        materialName: formData.materialName,
        uom: formData.uom,
        quantity: formData.quantity,
        timestamp: new Date().toISOString(),
        department: 'KR',
        type: 'outward'
      }

      const response = await axios.post(getApiUrl('material_outward'), payload)
      
      if (response.data.success) {
        setMessage('Material outward recorded successfully!')
        setMessageType('success')
        setFormData({
          category: '',
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          quantity: ''
        })
      } else {
        setMessage(response.data.message || 'Failed to record material outward')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error recording material outward:', error)
      setMessage(error.response?.data?.message || 'Error recording material outward. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="material-list-container">
        <div className="material-form-wrapper">
          <h2>Material Outward</h2>
          <div className="loading-message">
            <p>Loading material data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="material-list-container">
      <div className="material-form-wrapper">
        <h2>Material Outward</h2>
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="material-form">
          {/* Category Field */}
          {renderDropdownInput(
            'category',
            'Category',
            true,
            categories
          )}

          {/* Sub Category Field */}
          {renderDropdownInput(
            'subCategory',
            'Sub Category',
            false,
            formData.category ? materialData[formData.category]?.subCategories || [] : []
          )}

          {/* Particulars Field */}
          {renderDropdownInput(
            'particulars',
            'Particulars',
            false,
            formData.category ? materialData[formData.category]?.particulars || [] : []
          )}

          {/* Material Name Field */}
          {renderDropdownInput(
            'materialName',
            'Material Name',
            true,
            (() => {
              if (!formData.category) return [];
              const categoryData = materialData[formData.category];
              if (!categoryData) return [];
              
              // Handle the same data structure as KR_PlaceOrder.jsx
              let materialNames = categoryData.materialNames || [];
              
              // If materialNames is an array (simple structure)
              if (Array.isArray(materialNames)) {
                return materialNames;
              }
              
              // If materialNames is an object (nested structure)
              if (typeof materialNames === 'object') {
                // Handle nested structure: particulars -> materials
                if (formData.particulars && materialNames[formData.particulars]) {
                  return materialNames[formData.particulars];
                }
                
                // Handle nested structure: subCategory -> particulars -> materials
                if (formData.subCategory && materialNames[formData.subCategory]) {
                  const subCategoryData = materialNames[formData.subCategory];
                  if (formData.particulars && subCategoryData[formData.particulars]) {
                    return subCategoryData[formData.particulars];
                  }
                }
                
                // If no specific filtering, return all materials from the object
                const allMaterials = [];
                Object.values(materialNames).forEach(value => {
                  if (Array.isArray(value)) {
                    allMaterials.push(...value);
                  } else if (typeof value === 'object') {
                    Object.values(value).forEach(arr => {
                      if (Array.isArray(arr)) {
                        allMaterials.push(...arr);
                      }
                    });
                  }
                });
                return allMaterials;
              }
              
              return [];
            })()
          )}

          {/* UOM Field */}
          {renderDropdownInput(
            'uom',
            'Unit of Measurement (UOM)',
            true,
            uomOptions
          )}

          {/* Quantity Field */}
          <div className="form-group">
            <label htmlFor="quantity">
              Quantity *
            </label>
            <input
              type="number"
              id="quantity"
              value={formData.quantity}
              onChange={(e) => handleInputChange('quantity', e.target.value)}
              required
              className="form-input no-spinner"
              placeholder="Enter quantity"
              min="0"
              step="0.01"
              disabled={dataLoading}
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Recording...' : 'Record Outward'}
            </button>
            <button
              type="button"
              onClick={() => setFormData({
                category: '',
                subCategory: '',
                particulars: '',
                materialName: '',
                uom: '',
                quantity: ''
              })}
              className="btn btn-secondary"
            >
              Clear Form
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default KR_MaterialOutward