import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialList.css'

const GB_MaterialList = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
    uom: '',
    initialQuantity: ''
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

  // Helper function to render hybrid input field
  const renderHybridInput = (field, label, required = false, options = [], placeholder = '') => {
    // Special handling for UOM field - it should always be read-only and auto-selected
    if (field === 'uom') {
      return (
        <div className="form-group">
          <label htmlFor={field} className={required ? "required" : ""}>
            {label}
          </label>
          <input
            type="text"
            id={field}
            value={formData[field]}
            readOnly
            required={required}
            className="form-input"
            placeholder="UOM"
            style={{
              backgroundColor: '#f5f5f5',
              cursor: 'not-allowed',
              color: '#333'
            }}
            title="UOM is auto-selected based on material name"
          />
        </div>
      )
    }

    const isDropdown = inputModes[field] === 'dropdown'
    const value = formData[field]
    
    return (
      <div className="form-group">
        <div className="form-group-header">
          <label htmlFor={field} className={required ? "required" : ""}>
            {label}
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
                     (field === 'materialName' && !formData.category)}
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
          params: { factory: 'GB' }
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
          initialQuantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          particulars: '',
          materialName: '',
          uom: '',
          initialQuantity: ''
        }),
        // Reset dependent fields when particulars changes
        ...(field === 'particulars' && {
          materialName: '',
          uom: '',
          initialQuantity: ''
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
    if (!formData.category || !formData.materialName || !formData.uom || !formData.initialQuantity) {
      setMessage('Please fill in all required fields (Category, Material Name, UOM, and Initial Quantity)')
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
        initialQuantity: formData.initialQuantity,
        timestamp: new Date().toISOString(),
        department: 'GB'
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
          uom: '',
          initialQuantity: ''
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
      <div className="material_list-container">
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
    <div className="material_list-container">
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
          onClick={() => navigate('/gulbarga/gb_store')} 
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
      
      <div className="material-form-wrapper">
        <h2>Add New Material</h2>
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="material-form">
          <div className="form-main-content">
            <div className="form-left-section">
              <div className="form-row">
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
              </div>

              <div className="form-row">
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
                      return materialNames.map(mat => typeof mat === 'string' ? mat : mat.name);
                    }
                    
                    // If materialNames is an object (nested structure)
                    if (typeof materialNames === 'object') {
                      // Handle nested structure: particulars -> materials
                      if (formData.particulars && materialNames[formData.particulars]) {
                        return materialNames[formData.particulars].map(mat => typeof mat === 'string' ? mat : mat.name);
                      }
                      
                      // Handle nested structure: subCategory -> particulars -> materials
                      if (formData.subCategory && materialNames[formData.subCategory]) {
                        const subCategoryData = materialNames[formData.subCategory];
                        if (formData.particulars && subCategoryData[formData.particulars]) {
                          return subCategoryData[formData.particulars].map(mat => typeof mat === 'string' ? mat : mat.name);
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
                      return allMaterials.map(mat => typeof mat === 'string' ? mat : mat.name);
                    }
                    
                    return [];
                  })(),
                  'Enter new material name'
                )}
              </div>

              <div className="form-row">
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

                {/* Initial Quantity Field */}
                <div className="form-group">
                  <label htmlFor="initialQuantity" className="required">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    id="initialQuantity"
                    value={formData.initialQuantity}
                    onChange={(e) => handleInputChange('initialQuantity', e.target.value)}
                    required
                    className="form-input no-spinner"
                    placeholder="Enter initial quantity"
                    min="0"
                    step="0.01"
                    disabled={dataLoading}
                  />
                </div>
              </div>

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
                    uom: '',
                    initialQuantity: ''
                  })}
                  className="btn btn-secondary"
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GB_MaterialList
