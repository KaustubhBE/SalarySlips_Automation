import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialList.css'

const GB_Add_MaterialList = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    materialName: '',
    specifications: '',
    uom: '',
    initialQuantity: ''
  })

  const [inputModes, setInputModes] = useState({
    category: 'dropdown', // 'dropdown' or 'text'
    subCategory: 'dropdown',
    materialName: 'dropdown',
    specifications: 'dropdown',
    uom: 'dropdown'
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const uomOptions = ['kgs', 'nos', 'meters', 'pieces', 'liters']

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
      if (subCategory && subCategory.trim() !== '' && materialNames[subCategory]) {
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
      } else {
        // STRICT FILTERING: If no subcategory selected, show ONLY materials NOT under any subcategory
        if (!subCategory || subCategory.trim() === '') {
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
          // If no specifications provided, return empty (don't fallback)
          return ''
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
            // If no specifications provided, return empty (don't fallback)
            return ''
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
        department: 'KR'
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
            department: 'KR'
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

  // Helper function to render hybrid input field
  const renderHybridInput = (field, label, required = false, options = [], placeholder = '') => {
    const isDropdown = inputModes[field] === 'dropdown'
    const value = formData[field]
    
    // Determine border color for optional fields
    const getBorderClass = () => {
      if (required) return '' // Required fields use default styling
      
      // For optional fields (subCategory, specifications)
      if (field === 'subCategory') {
        if (!value && formData.category && materialData[formData.category]?.subCategories && materialData[formData.category].subCategories.length > 0) {
          return 'optional-field-red'
        } else if (value) {
          return 'optional-field-green'
        }
      } else if (field === 'specifications') {
        if (!value && formData.category && formData.materialName && getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length > 0) {
          return 'optional-field-red'
        } else if (value) {
          return 'optional-field-green'
        }
      }
      return ''
    }
    
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
            className={`form-select ${getBorderClass()}`}
            disabled={dataLoading || (field === 'subCategory' && !formData.category) || 
                     (field === 'specifications' && !formData.category) ||
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
            className={`form-input ${getBorderClass()}`}
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
          initialQuantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          materialName: '',
          specifications: '',
          uom: '',
          initialQuantity: ''
        }),
        // Reset dependent fields when materialName changes
        ...(field === 'materialName' && {
          specifications: '',
          uom: '',
          initialQuantity: ''
        })
      }

      // Auto-assign UOM when material name changes (only if we have complete material details and UOM is empty)
      if (field === 'materialName' && value) {
        // Only auto-assign UOM if we have all required details and UOM is empty (to allow user override)
        if (newFormData.category && value && newFormData.specifications && !newFormData.uom) {
          // Fetch UOM from backend for exact match
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
        specifications: formData.specifications || '',
        materialName: formData.materialName,
        uom: formData.uom,
        initialQuantity: formData.initialQuantity,
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
          materialName: '',
          specifications: '',
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
                {/* Material Name Field */}
                {renderHybridInput(
                  'materialName',
                  'Material Name',
                  true,
                  formData.category ? getMaterialNameOptions(materialData[formData.category], formData.subCategory) : [],
                  'Enter new material name'
                )}

                {/* Specifications Field */}
                {renderHybridInput(
                  'specifications',
                  'Specifications',
                  false,
                  formData.category && formData.materialName ? getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory) : [],
                  'Enter new specifications'
                )}
              </div>

              <div className="form-row">
                {/* UOM Field */}
                {renderHybridInput(
                  'uom',
                  'Unit of Measurement (UOM)',
                  true,
                  uomOptions,
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
                    materialName: '',
                    specifications: '',
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

export default GB_Add_MaterialList
