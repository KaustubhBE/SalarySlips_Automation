import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialIn-Out.css'

const KR_MaterialInward = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
    uom: '',
    quantity: '',
    partyName: '',
    place: ''
  })


  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const uomOptions = ['kgs', 'nos', 'meters', 'pieces', 'liters']
  const partyNameOptions = ['Supplier A', 'Supplier B', 'Vendor C', 'Local Dealer', 'Manufacturer']
  const placeOptions = ['Warehouse 1', 'Warehouse 2', 'Storage Unit A', 'Storage Unit B', 'Main Store']

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


  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.category || !formData.materialName || !formData.uom || !formData.quantity || !formData.partyName || !formData.place) {
      setMessage('Please fill in all required fields (Category, Material Name, UOM, Quantity, Party Name, and Place)')
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
        partyName: formData.partyName,
        place: formData.place,
        timestamp: new Date().toISOString(),
        department: 'KR',
        type: 'inward'
      }

      const response = await axios.post(getApiUrl('material_inward'), payload)
      
      if (response.data.success) {
        setMessage('Material inward recorded successfully!')
        setMessageType('success')
        setFormData({
          category: '',
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          quantity: '',
          partyName: '',
          place: ''
        })
      } else {
        setMessage(response.data.message || 'Failed to record material inward')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error recording material inward:', error)
      setMessage(error.response?.data?.message || 'Error recording material inward. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="material-list-container">
        <div className="material-form-wrapper">
          <h2>Material Inward</h2>
          <div className="loading-message">
            <p>Loading material data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="material-list-container">
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
          onClick={() => navigate('/kerur/kr_store')} 
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
        <h2>Material Inward</h2>
        
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
              </div>

              <div className="form-row">
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
                  })()
                )}
              </div>

              <div className="form-row">
                {/* UOM Field */}
                {renderDropdownInput(
                  'uom',
                  'Unit of Measurement (UOM)',
                  true,
                  uomOptions
                )}

                {/* Quantity Field */}
                <div className="form-group">
                  <label htmlFor="quantity" className="required">
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
              </div>

              <div className="form-row">
                {/* Party Name Field */}
                {renderDropdownInput(
                  'partyName',
                  'Party Name',
                  true,
                  partyNameOptions
                )}

                {/* Place Field */}
                {renderDropdownInput(
                  'place',
                  'Place',
                  true,
                  placeOptions
                )}
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Recording...' : 'Record Inward'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({
                    category: '',
                    subCategory: '',
                    particulars: '',
                    materialName: '',
                    uom: '',
                    quantity: '',
                    partyName: '',
                    place: ''
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

export default KR_MaterialInward