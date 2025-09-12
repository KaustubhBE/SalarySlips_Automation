import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialList.css'

const KR_MaterialList = () => {
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
    uom: ''
  })

  const [inputModes, setInputModes] = useState({
    category: 'dropdown', // 'dropdown' or 'text'
    subCategory: 'dropdown',
    particulars: 'dropdown',
    materialName: 'dropdown',
    uom: 'dropdown'
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const uomOptions = ['kgs', 'nos', 'meters', 'pieces', 'liters']

  // Helper function to render hybrid input field
  const renderHybridInput = (field, label, required = false, options = [], placeholder = '') => {
    const isDropdown = inputModes[field] === 'dropdown'
    const value = formData[field]
    
    return (
      <div className="form-group">
        <div className="form-group-header">
          <label htmlFor={field}>
            {label} {required && '*'}
          </label>
          <button
            type="button"
            className="toggle-mode-btn"
            onClick={() => toggleInputMode(field)}
            title={isDropdown ? 'Switch to text input' : 'Switch to dropdown'}
          >
            {isDropdown ? '✏️ Add New' : '📋 Select'}
          </button>
        </div>
        
        {isDropdown ? (
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
        ) : (
          <input
            type="text"
            id={field}
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            required={required}
            className="form-input"
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            disabled={dataLoading}
          />
        )}
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
        uom: ''
      }),
      // Reset dependent fields when subCategory changes
      ...(field === 'subCategory' && {
        particulars: '',
        materialName: '',
        uom: ''
      }),
      // Reset dependent fields when particulars changes
      ...(field === 'particulars' && {
        materialName: '',
        uom: ''
      })
    }))
  }

  const toggleInputMode = (field) => {
    setInputModes(prev => ({
      ...prev,
      [field]: prev[field] === 'dropdown' ? 'text' : 'dropdown'
    }))
    
    // Clear the field value when switching modes
    setFormData(prev => ({
      ...prev,
      [field]: ''
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.category || !formData.materialName || !formData.uom) {
      setMessage('Please fill in all required fields (Category, Material Name, and UOM)')
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
        timestamp: new Date().toISOString(),
        department: 'KR'
      }

      const response = await axios.post(getApiUrl('add_material'), payload)
      
      if (response.data.success) {
        setMessage('Material added successfully!')
        setMessageType('success')
        setFormData({
          category: '',
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: ''
        })
      } else {
        setMessage(response.data.message || 'Failed to add material')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error adding material:', error)
      setMessage(error.response?.data?.message || 'Error adding material. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="material-list-container">
        <div className="material-form-wrapper">
          <h2>Add New Material</h2>
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
        <h2>Add New Material</h2>
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="material-form">
          {/* Category Field */}
          {renderHybridInput(
            'category',
            'Category',
            true,
            categories,
            'Enter new category'
          )}

          {/* Sub Category Field */}
          {renderHybridInput(
            'subCategory',
            'Sub Category',
            false,
            formData.category ? materialData[formData.category]?.subCategories || [] : [],
            'Enter new sub category'
          )}

          {/* Particulars Field */}
          {renderHybridInput(
            'particulars',
            'Particulars',
            false,
            formData.category ? materialData[formData.category]?.particulars || [] : [],
            'Enter new particulars'
          )}

          {/* Material Name Field */}
          {renderHybridInput(
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
            })(),
            'Enter new material name'
          )}

          {/* UOM Field */}
          {renderHybridInput(
            'uom',
            'Unit of Measurement (UOM)',
            true,
            (() => {
              if (!formData.category) return uomOptions;
              
              // For UOM, we'll use the general UOM options since the new data structure
              // doesn't store individual material UOMs in the hierarchical format
              // The UOM will be selected independently
              return uomOptions;
            })(),
            'Enter new UOM'
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Adding...' : 'Add Material'}
            </button>
            <button
              type="button"
              onClick={() => setFormData({
                category: '',
                subCategory: '',
                particulars: '',
                materialName: '',
                uom: ''
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

export default KR_MaterialList
