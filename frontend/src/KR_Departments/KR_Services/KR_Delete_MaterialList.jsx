import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl } from '../../config'
import '../../MaterialList.css'

const KR_Delete_MaterialList = () => {
  const navigate = useNavigate()
  
  const [formData, setFormData] = useState({
    category: '',
    subCategory: '',
    particulars: '',
    materialName: '',
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

  // Helper function to get UOM for a material
  const getUomForMaterial = (category, materialName, subCategory = '', particulars = '') => {
    if (!category || !materialName || !materialData[category]) {
      return ''
    }
    
    const categoryData = materialData[category]
    let materialNames = categoryData.materialNames || []
    
    // If materialNames is an array (simple structure)
    if (Array.isArray(materialNames)) {
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
          currentQuantity: ''
        }),
        // Reset dependent fields when subCategory changes
        ...(field === 'subCategory' && {
          particulars: '',
          materialName: '',
          uom: '',
          currentQuantity: ''
        }),
        // Reset dependent fields when particulars changes
        ...(field === 'particulars' && {
          materialName: '',
          uom: '',
          currentQuantity: ''
        })
      }

      // Auto-assign UOM and fetch material details when material name changes
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

        // Auto-fetch material details when material name is selected
        if (newFormData.category && value) {
          console.log('Auto-fetching material details for:', {
            category: newFormData.category,
            subCategory: newFormData.subCategory || '',
            particulars: newFormData.particulars || '',
            materialName: value
          })
          fetchMaterialDetails(
            newFormData.category,
            newFormData.subCategory || '',
            newFormData.particulars || '',
            value
          )
        }
      }

      return newFormData
    })
  }

  // Function to fetch material details
  const fetchMaterialDetails = async (category, subCategory, particulars, materialName) => {
    try {
      const payload = {
        category: category,
        subCategory: subCategory,
        particulars: particulars,
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
      particulars: formData.particulars || 'N/A',
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
        particulars: materialToDelete.particulars === 'N/A' ? '' : materialToDelete.particulars,
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
          `Particulars: ${deletedMaterial.particulars || 'N/A'}\n` +
          `Material Name: ${deletedMaterial.materialName}\n` +
          `UOM: ${deletedMaterial.uom}\n` +
          `Current Quantity: ${materialToDelete.currentQuantity}`

        // Show alert box instead of setting message state
        alert(successMessage)
        
        // Clear the form after successful deletion
        setFormData({
          category: '',
          subCategory: '',
          particulars: '',
          materialName: '',
          uom: '',
          currentQuantity: ''
        })
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
                {renderDropdown(
                  'subCategory',
                  'Sub Category',
                  false,
                  formData.category ? materialData[formData.category]?.subCategories || [] : []
                )}
              </div>

              <div className="form-row">
                {/* Particulars Field */}
                {renderDropdown(
                  'particulars',
                  'Particulars',
                  false,
                  formData.category ? materialData[formData.category]?.particulars || [] : []
                )}

                {/* Material Name Field */}
                {renderDropdown(
                  'materialName',
                  'Material Name',
                  true,
                  (() => {
                    if (!formData.category) return [];
                    const categoryData = materialData[formData.category];
                    if (!categoryData) return [];
                    
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
                    value={formData.currentQuantity}
                    readOnly
                    className="form-input"
                    placeholder="Fetched from database"
                    style={{
                      backgroundColor: '#f5f5f5',
                      cursor: 'not-allowed',
                      color: '#333'
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
                      particulars: '',
                      materialName: '',
                      uom: '',
                      currentQuantity: ''
                    })
                    setFetchedMaterial(null)
                    setMessage('')
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
                <strong>Particulars:</strong> {materialToDelete?.particulars}
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
