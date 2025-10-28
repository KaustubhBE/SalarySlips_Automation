import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialList.css'

const KR_Delete_MaterialList = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    materialName: '',
    specifications: '',
    uom: '',
    currentQuantity: ''
  })

  const [fetchedMaterial, setFetchedMaterial] = useState(null)

  const [deleteLoading, setDeleteLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [categories, setCategories] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState(null)
  
  // Ref to track if component is still mounted and form is active
  const isFormActive = useRef(true)

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
          // If specific specification is selected, search there first
          if (specifications && subCategoryData[specifications]) {
            const materials = subCategoryData[specifications]
            const material = materials.find(mat => 
              (typeof mat === 'string' ? mat : mat.name) === materialName
            )
            if (material && typeof material === 'object') {
              return material.uom
            }
          }
          
          // Search in any specification within the subcategory
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
      for (const subCatData of Object.values(materialNames)) {
        if (typeof subCatData === 'object') {
          // If this subcategory has specifications
          if (Object.keys(subCatData).length > 0 && Array.isArray(Object.values(subCatData)[0])) {
            for (const materials of Object.values(subCatData)) {
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

  // Helper function to render simple dropdown
  const renderDropdown = (field, label, required = false, options = []) => {
    return (
      <div className="form-group">
        <label htmlFor={field} className={required ? "required" : ""}>
          {label}
        </label>
        
        <select
          id={field}
          value={formData[field]}
          onChange={(e) => handleInputChange(field, e.target.value)}
          required={required}
          className="form-select"
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
    
    // Reset form active state on mount
    isFormActive.current = true
  }, [])

  const handleInputChange = (field, value) => {
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
          currentQuantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          materialName: '',
          specifications: '',
          uom: '',
          currentQuantity: ''
        }),
        // Reset dependent fields when materialName changes
        ...(field === 'materialName' && {
          specifications: '',
          uom: '',
          currentQuantity: ''
        })
      }

      // NEW UOM LOGIC:
      // 1. When material name is selected, check if specifications exist
      //    - If NO specifications: Fetch UOM immediately (without specifications)
      //    - If specifications exist: Wait for user to select specification
      // 2. When specification is manually selected: Fetch UOM with the selected specification
      
      if (field === 'materialName' && value && newFormData.category) {
        const categoryData = materialData[newFormData.category]
        if (categoryData) {
          const availableSpecs = getSpecificationsForMaterial(categoryData, value, newFormData.subCategory)
          
          // If NO specifications available, fetch UOM immediately (without specifications)
          if (availableSpecs.length === 0) {
            setTimeout(() => {
              if (isFormActive.current) {
                console.log('No specifications available, fetching material details without specifications:', {
                  category: newFormData.category,
                  subCategory: newFormData.subCategory || '',
                  specifications: '',
                  materialName: value
                })
                fetchMaterialDetails(
                  newFormData.category,
                  newFormData.subCategory || '',
                  '',
                  value
                )
              }
            }, 100)
          }
          // If specifications exist, don't fetch yet - wait for user to select specification
        }
      }
      
      // When specifications are manually selected, fetch UOM from backend
      if (field === 'specifications' && value && newFormData.category && newFormData.materialName) {
        // Fetch material details (which includes UOM) from backend when specification is selected
        setTimeout(() => {
          if (isFormActive.current) {
            console.log('Fetching material details when specification is selected:', {
              category: newFormData.category,
              subCategory: newFormData.subCategory || '',
              specifications: value,
              materialName: newFormData.materialName
            })
            fetchMaterialDetails(
              newFormData.category,
              newFormData.subCategory || '',
              value,
              newFormData.materialName
            )
          }
        }, 100)
      }
      
      // Handle case where material name is changed but specifications field is cleared (UOM goes blank)
      // This is already handled by line 395-398 which resets uom: '' when materialName changes

      return newFormData
    })
  }

  // Function to fetch material details
  const fetchMaterialDetails = async (category, subCategory, specifications, materialName) => {
    try {
      const payload = {
        category: category,
        subCategory: subCategory,
        specifications: specifications,
        materialName: materialName,
        department: 'KR'
      }

      console.log('Fetching material details with payload:', payload)
      const response = await axios.post(getApiUrl('get_material_details'), payload)
      console.log('Material details response:', response.data)
      
      if (response.data.success) {
        const material = response.data.material
        setFetchedMaterial(material)
        
        // Auto-populate the current quantity
        setFormData(prev => ({
          ...prev,
          uom: material.uom,
          currentQuantity: material.currentQuantity || material.initialQuantity || 0
        }))
        
        setMessage(`Material details loaded successfully!\nCurrent Quantity: ${material.currentQuantity || material.initialQuantity || 0}`)
        setMessageType('success')
      } else {
        console.warn('Material not found in database:', response.data.message)
        // If material not found, try to find it without specifications
        if (specifications) {
          console.log('Retrying without specifications...')
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
            setFetchedMaterial(material)
            
            // Auto-populate the current quantity
            setFormData(prev => ({
              ...prev,
              uom: material.uom,
              currentQuantity: material.currentQuantity || material.initialQuantity || 0
            }))
            
            setMessage(`Material details loaded successfully!\nCurrent Quantity: ${material.currentQuantity || material.initialQuantity || 0}`)
            setMessageType('success')
            return
          }
        }
        setMessage(response.data.message || 'Material not found in database')
        setMessageType('error')
        setFetchedMaterial(null)
        setFormData(prev => ({
          ...prev,
          currentQuantity: ''
        }))
      }
    } catch (error) {
      console.error('Error fetching material details:', error)
      console.error('Error response:', error.response?.data)
      setMessage(error.response?.data?.message || 'Error fetching material details. Please try again.')
      setMessageType('error')
      setFetchedMaterial(null)
      setFormData(prev => ({
        ...prev,
        currentQuantity: ''
      }))
    }
  }

  const handleDeleteMaterial = async (e) => {
    e.preventDefault()
    
    // Validation - check if required fields are filled
    if (!formData.category || !formData.materialName) {
      setMessage('Please fill in required fields (Category and Material Name) to delete material')
      setMessageType('error')
      return
    }

    if (!fetchedMaterial) {
      setMessage('Please select a material name to load material details first')
      setMessageType('error')
      return
    }

    // Show custom confirmation modal
    setMaterialToDelete({
      category: formData.category,
      subCategory: formData.subCategory || 'N/A',
      specifications: formData.specifications || 'N/A',
      materialName: formData.materialName,
      uom: formData.uom || 'N/A',
      currentQuantity: formData.currentQuantity
    })
    setShowConfirmModal(true)
  }

  // Function to handle actual deletion after confirmation
  const confirmDelete = async () => {
    setShowConfirmModal(false)
    setDeleteLoading(true)
    setMessage('')

    try {
      const payload = {
        category: materialToDelete.category,
        subCategory: materialToDelete.subCategory === 'N/A' ? '' : materialToDelete.subCategory,
        specifications: materialToDelete.specifications === 'N/A' ? '' : materialToDelete.specifications,
        materialName: materialToDelete.materialName,
        department: 'KR'
      }

      console.log('Deleting material with payload:', payload)
      const response = await axios.post(getApiUrl('delete_material'), payload)
      console.log('Delete material response:', response.data)
      
      if (response.data.success) {
        const deletedMaterial = response.data.deleted_material
        const successMessage = `Material deleted successfully!\n\n` +
          `Deleted Material Details:\n` +
          `Category: ${deletedMaterial.category}\n` +
          `Sub Category: ${deletedMaterial.subCategory || 'N/A'}\n` +
          `Specifications: ${deletedMaterial.specifications || 'N/A'}\n` +
          `Material Name: ${deletedMaterial.materialName}\n` +
          `UOM: ${deletedMaterial.uom}\n` +
          `Current Quantity: ${materialToDelete.currentQuantity}`

        // Show alert box instead of setting message state
        alert(successMessage)
        
        // Clear the form after successful deletion
        setFormData({
          category: '',
          subCategory: '',
          materialName: '',
          specifications: '',
          uom: '',
          currentQuantity: ''
        })
        // Mark form as inactive to prevent pending API calls
        isFormActive.current = false
        setFetchedMaterial(null)
        
        // Refresh the page after successful deletion
        window.location.reload()
      } else {
        setMessage(response.data.message || 'Failed to delete material')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error deleting material:', error)
      setMessage(error.response?.data?.message || 'Error deleting material. Please try again.')
      setMessageType('error')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Function to cancel deletion
  const cancelDelete = () => {
    setShowConfirmModal(false)
    setMaterialToDelete(null)
  }

  if (dataLoading) {
    return (
      <div className="material_list-container">
        <div className="material-form-wrapper">
          <h2>Delete Material</h2>
          <div className="loading-message">
            <p>Loading material data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="material_list-container">
      {/* Back Button Section */}
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
        <h2>Delete Material</h2>
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleDeleteMaterial} className="material-form">
          <div className="form-main-content">
            <div className="form-left-section">
              <div className="form-row">
                {/* Category Field */}
                {renderDropdown(
                  'category',
                  'Category',
                  true,
                  categories
                )}

                {/* Sub Category Field */}
                <div className="form-group">
                  <label htmlFor="subCategory">
                    Sub Category
                  </label>
                  <select
                    id="subCategory"
                    value={formData.subCategory}
                    onChange={(e) => handleInputChange('subCategory', e.target.value)}
                    className={`form-select ${!formData.subCategory && formData.category && materialData[formData.category]?.subCategories && materialData[formData.category].subCategories.length > 0 ? 'optional-field-red' : formData.subCategory ? 'optional-field-green' : ''}`}
                    disabled={dataLoading || !formData.category || !materialData[formData.category]?.subCategories || materialData[formData.category].subCategories.length === 0}
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
              </div>

              <div className="form-row">
                {/* Material Name Field */}
                {renderDropdown(
                  'materialName',
                  'Material Name',
                  true,
                  formData.category ? getMaterialNameOptions(materialData[formData.category], formData.subCategory) : []
                )}

                {/* Specifications Field */}
                <div className="form-group">
                  <label htmlFor="specifications">
                    Specifications
                  </label>
                  <select
                    id="specifications"
                    value={formData.specifications}
                    onChange={(e) => handleInputChange('specifications', e.target.value)}
                    className={`form-select ${!formData.specifications && formData.category && formData.materialName && getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length > 0 ? 'optional-field-red' : formData.specifications ? 'optional-field-green' : ''}`}
                    disabled={dataLoading || !formData.category || !formData.materialName || getSpecificationsForMaterial(materialData[formData.category], formData.materialName, formData.subCategory).length === 0}
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
              </div>

              <div className="form-row">
                {/* UOM Field - Read-only, auto-selected */}
                <div className="form-group">
                  <label htmlFor="uom">
                    Unit of Measurement (UOM)
                  </label>
                  <input
                    type="text"
                    id="uom"
                    value={formData.uom}
                    readOnly
                    className="form-input"
                    placeholder="Auto-selected"
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: '#333'
                    }}
                    title="UOM is auto-selected based on material name"
                  />
                </div>

                {/* Current Quantity Field - Read-only */}
                <div className="form-group">
                  <label htmlFor="currentQuantity">
                    Current Quantity
                  </label>
                  <input
                    type="text"
                    id="currentQuantity"
                    value={formData.currentQuantity || ''}
                    readOnly
                    className="form-input"
                    placeholder={formData.currentQuantity ? '' : 'Select material to see quantity'}
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: formData.currentQuantity ? '#333' : '#999',
                      fontWeight: formData.currentQuantity ? 'bold' : 'normal'
                    }}
                    title="Current quantity is fetched from database"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={deleteLoading || !formData.category || !formData.materialName || !fetchedMaterial}
                  className="btn btn-danger"
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    cursor: deleteLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: (!formData.category || !formData.materialName || !fetchedMaterial) ? 0.6 : 1
                  }}
                  title={(!formData.category || !formData.materialName || !fetchedMaterial) ? 
                    'Select material and load details to enable delete' : 
                    'Delete material from database'}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Material'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      category: '',
                      subCategory: '',
                      materialName: '',
                      specifications: '',
                      uom: '',
                      currentQuantity: ''
                    })
                    setFetchedMaterial(null)
                    setMessage('')
                    // Mark form as inactive to prevent pending API calls
                    isFormActive.current = false
                  }}
                  className="btn btn-secondary"
                >
                  Clear Form
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            maxWidth: '500px',
            width: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{
              marginBottom: '20px',
              color: '#333',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              Are you sure you want to delete this material?
            </h3>
            
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                <strong>Category:</strong> {materialToDelete?.category}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                <strong>Sub Category:</strong> {materialToDelete?.subCategory}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                <strong>Specifications:</strong> {materialToDelete?.specifications}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                <strong>Material Name:</strong> {materialToDelete?.materialName}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                <strong>UOM:</strong> {materialToDelete?.uom}
              </p>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                <strong>Current Quantity:</strong> {materialToDelete?.currentQuantity}
              </p>
            </div>
            
            <p style={{
              marginBottom: '25px',
              color: '#dc3545',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              This action cannot be undone.
            </p>
            
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button
                onClick={confirmDelete}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '100px',
                  boxShadow: '0 2px 4px rgba(220, 53, 69, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#c82333'
                  e.target.style.transform = 'translateY(-1px)'
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#dc3545'
                  e.target.style.transform = 'translateY(0)'
                }}
              >
                DELETE
              </button>
              
              <button
                onClick={cancelDelete}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  minWidth: '100px',
                  boxShadow: '0 2px 4px rgba(108, 117, 125, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#5a6268'
                  e.target.style.transform = 'translateY(-1px)'
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '#6c757d'
                  e.target.style.transform = 'translateY(0)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KR_Delete_MaterialList
