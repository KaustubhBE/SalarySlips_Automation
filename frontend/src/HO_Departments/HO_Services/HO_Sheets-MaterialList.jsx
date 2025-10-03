import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../MaterialList.css'

const SheetsMaterialList = () => {
  const navigate = useNavigate()
  
  // State management
  const [selectedPlant, setSelectedPlant] = useState('')
  const [materialData, setMaterialData] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [syncDescription, setSyncDescription] = useState('')

  // Handle back to department navigation
  const handleBackToDepartment = () => {
    navigate('/ho_store')
  }

  // Handle plant selection change
  const handlePlantChange = async (plantId) => {
    setSelectedPlant(plantId)
    setMaterialData({})
    setMessage('')
    
    if (!plantId) {
      return
    }
    
    setLoading(true)
    try {
      const response = await axios.post(getApiUrl('get_plant_material_data'), {
        plant_id: plantId,
        plant_data: PLANT_DATA
      })
      
      if (response.data.success) {
        setMaterialData(response.data.data)
        setMessage(`Material data loaded for ${response.data.plant_name}`)
        setMessageType('success')
      } else {
        setMessage('No material data found for this plant')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error loading material data:', error)
      setMessage('Error loading material data. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  // Handle sync button click
  const handleSync = async () => {
    if (!selectedPlant) {
      setMessage('Please select a plant first')
      setMessageType('error')
      return
    }
    
    if (!syncDescription.trim()) {
      setMessage('Please provide a description for this sync operation')
      setMessageType('error')
      return
    }
    
    setLoading(true)
    setMessage('')
    
    try {
      // Get current user info from session
      let userEmail = 'Unknown User'
      try {
        const userResponse = await axios.get(getApiUrl('auth/status'))
        const currentUser = userResponse.data.user || {}
        userEmail = currentUser.email || 'Unknown User'
      } catch (userError) {
        console.warn('Could not fetch user info, using fallback:', userError)
        // Continue with sync even if user info is not available
      }
      
      const selectedPlantData = PLANT_DATA.find(p => p.material_sheet_id === selectedPlant)
      const response = await axios.post(getApiUrl('sync_plant_material_data'), {
        plant_id: selectedPlant,
        plant_name: selectedPlantData?.name,
        plant_data: PLANT_DATA,
        sync_description: syncDescription.trim(),
        sync_timestamp: new Date().toISOString(),
        synced_by: userEmail
      })
      
      if (response.data.success) {
        setMessage(response.data.message || 'Material data synced successfully!')
        setMessageType('success')
        // Clear the description after successful sync
        setSyncDescription('')
        // Refresh the material data after sync
        handlePlantChange(selectedPlant)
      } else {
        setMessage(response.data.message || 'Failed to sync material data')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error syncing material data:', error)
      setMessage(error.response?.data?.message || 'Error syncing material data. Please try again.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="material_list-container">
      <div className="material-form-wrapper">
        <h2>Sheets Material List</h2>
        
        {/* Message Display */}
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <div className="dropdown-container">
          <label htmlFor="plant-select">Select Plant:</label>
          <select 
            id="plant-select" 
            className="plant-dropdown"
            value={selectedPlant}
            onChange={(e) => handlePlantChange(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Select a Plant --</option>
                    {PLANT_DATA.map((plant, index) => (
              <option key={index} value={plant.material_sheet_id}>
                {plant.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sync Description - Always visible */}
        <div className="sync-description-container">
          <label htmlFor="sync-description">
            Sync Description <span className="required">*</span>
          </label>
          <textarea
            id="sync-description"
            className="sync-description-textarea"
            value={syncDescription}
            onChange={(e) => setSyncDescription(e.target.value)}
            placeholder="Describe why this sync is being performed (e.g., 'Updated material prices', 'Added new materials', 'Corrected inventory data')"
            rows={3}
            disabled={loading}
            required
          />
          <small className="description-help">
            This description will be stored with a timestamp for audit purposes.
          </small>
        </div>

        {/* Sync Button - Centered */}
        <div className="sync-button-container">
          <button 
            className="btn btn-sync"
            onClick={handleSync}
            disabled={loading || !selectedPlant || !syncDescription.trim()}
          >
            {loading ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {/* Material Data Display */}
        {Object.keys(materialData).length > 0 && (
          <div className="material-data-display">
            <h3>Material Data Preview</h3>
            <div className="data-summary">
              <p><strong>Categories:</strong> {Object.keys(materialData).length}</p>
              <p><strong>Total Materials:</strong> {
                Object.values(materialData).reduce((total, category) => {
                  if (Array.isArray(category.materialNames)) {
                    return total + category.materialNames.length
                  } else if (typeof category.materialNames === 'object') {
                    return total + Object.values(category.materialNames).flat().length
                  }
                  return total
                }, 0)
              }</p>
            </div>
          </div>
        )}

        {/* Back Button - Left Aligned */}
        <div className="back-button-container">
          <button onClick={handleBackToDepartment} className="nav-link back-button">
            ← Back to Store
          </button>
        </div>
      </div>
    </div>
  )
}

export default SheetsMaterialList