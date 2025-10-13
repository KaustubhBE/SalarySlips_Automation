import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import LoadingSpinner from '../../LoadingSpinner'
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
const [syncResults, setSyncResults] = useState(null)
const [showAlert, setShowAlert] = useState(false)

  // Handle back to department navigation
  const handleBackToDepartment = () => {
    navigate('/ho_store')
  }

  // Show alert function
  const showAlertMessage = (title, message, type = 'info') => {
    setShowAlert({
      title,
      message,
      type,
      show: true
    })
    
    // Auto-hide alert after 5 seconds
    setTimeout(() => {
      setShowAlert(prev => ({ ...prev, show: false }))
    }, 5000)
  }

  // Close alert function
  const closeAlert = () => {
    setShowAlert(prev => ({ ...prev, show: false }))
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
      showAlertMessage('Validation Error', 'Please select a plant first', 'error')
      return
    }
    
    if (!syncDescription.trim()) {
      setMessage('Please provide a description for this sync operation')
      setMessageType('error')
      showAlertMessage('Validation Error', 'Please provide a description for this sync operation', 'error')
      return
    }
    
    setLoading(true)
    setMessage('')
    setSyncResults(null)
    
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
        const syncData = response.data
        const totalSynced = syncData.total_synced || 0
        const totalProcessed = syncData.total_processed || 0
        const skippedCount = syncData.skipped_count || 0
        
        // Store detailed sync results
        setSyncResults({
          success: true,
          message: syncData.message || 'Material data sync completed!',
          totalProcessed: totalProcessed,
          totalSynced: totalSynced,
          skippedRows: syncData.skipped_rows || [],
          skippedCount: skippedCount,
          skippedReasons: syncData.skipped_reasons || {},
          timestamp: new Date().toISOString()
        })
        
        setMessage(syncData.message || 'Material data sync completed!')
        setMessageType('success')
        
        // Show alert with detailed information - always show regardless of sync count
        let alertMessage = ''
        let alertType = 'success'
        
        if (totalSynced === 0 && totalProcessed === 0) {
          // No data to process
          alertMessage = 'No material data found to sync for this plant.'
          alertType = 'info'
        } else if (totalSynced === 0 && skippedCount > 0) {
          // All items were skipped due to errors
          alertMessage = `Sync completed! No items were synced to Firebase. ${skippedCount} items were skipped due to missing data. Check details below.`
          alertType = 'warning'
        } else if (totalSynced > 0 && skippedCount > 0) {
          // Some items synced, some skipped
          alertMessage = `Sync completed! ${totalSynced} items synced to Firebase, ${skippedCount} items skipped. Check details below.`
          alertType = 'success'
        } else if (totalSynced > 0 && skippedCount === 0) {
          // All items synced successfully
          alertMessage = `Sync completed successfully! ${totalSynced} items synced to Firebase.`
          alertType = 'success'
        } else {
          // Fallback
          alertMessage = `Sync completed! ${totalSynced} items synced, ${skippedCount} items skipped. Check details below.`
          alertType = 'success'
        }
        
        showAlertMessage('Sync Completed', alertMessage, alertType)
        
        // Clear the description after sync completion
        setSyncDescription('')
        // Reset dropdown to default and clear material data to prevent unnecessary loading
        setSelectedPlant('')
        setMaterialData({})
        setMessage('')
      } else {
        const errorMessage = response.data.message || 'Failed to sync material data'
        setMessage(errorMessage)
        setMessageType('error')
        showAlertMessage('Sync Failed', errorMessage, 'error')
      }
    } catch (error) {
        console.error('Error syncing material data:', error)
        const errorMessage = error.response?.data?.message || 'Error syncing material data. Please try again.'
        setMessage(errorMessage)
        setMessageType('error')
        showAlertMessage('Sync Error', errorMessage, 'error')
        
        // Reset dropdown to default and clear material data on error as well
        setSelectedPlant('')
        setMaterialData({})
      } finally {
        setLoading(false)
      }
  }


  return (
    <div className="material_list-container">
      {/* Loading Spinner */}
      {loading && <LoadingSpinner />}
      
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
          onClick={handleBackToDepartment} 
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
        <h2>Sheets Material List</h2>
        
        {/* Alert Modal */}
        {showAlert && showAlert.show && (
          <div className="alert-overlay">
            <div className={`alert-modal alert-${showAlert.type}`}>
              <div className="alert-header">
                <h3>{showAlert.title}</h3>
                <button className="alert-close" onClick={closeAlert}>×</button>
              </div>
              <div className="alert-body">
                <p>{showAlert.message}</p>
              </div>
            </div>
          </div>
        )}
        
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
                  if (typeof category === 'object' && category.materialNames) {
                    // Count materials in nested structure compatible with KR_PlaceOrder.jsx
                    let count = 0
                    const materialNames = category.materialNames
                    
                    if (Array.isArray(materialNames)) {
                      // Simple array structure
                      count = materialNames.length
                    } else if (typeof materialNames === 'object') {
                      // Nested structure - count all materials
                      Object.values(materialNames).forEach(subCatOrSpec => {
                        if (Array.isArray(subCatOrSpec)) {
                          count += subCatOrSpec.length
                        } else if (typeof subCatOrSpec === 'object') {
                          // Further nested (subCategory -> specifications -> materials)
                          Object.values(subCatOrSpec).forEach(materials => {
                            if (Array.isArray(materials)) {
                              count += materials.length
                            }
                          })
                        }
                      })
                    }
                    return total + count
                  }
                  return total
                }, 0)
              }</p>
            </div>
          </div>
        )}

        {/* Sync Results Display */}
        {syncResults && (
          <div className="sync-results-display">
            <h3>Sync Results</h3>
            <div className="sync-summary">
              <div className="sync-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Processed:</span>
                  <span className="stat-value">{syncResults.totalProcessed}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">New Materials Added:</span>
                  <span className={`stat-value ${syncResults.totalSynced > 0 ? 'success' : 'info'}`}>
                    {syncResults.totalSynced}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Skipped (Errors):</span>
                  <span className={`stat-value ${syncResults.skippedCount > 0 ? 'warning' : 'info'}`}>
                    {syncResults.skippedCount}
                  </span>
                </div>
              </div>
              
              {/* Show message when no items were synced */}
              {syncResults.totalSynced === 0 && syncResults.totalProcessed > 0 && (
                <div className="no-sync-message">
                  <div className="no-sync-icon">⚠️</div>
                  <p>No items were synced to Firebase. All items were skipped due to missing required data.</p>
                </div>
              )}
              
              {/* Show message when no data was processed */}
              {syncResults.totalProcessed === 0 && (
                <div className="no-data-message">
                  <div className="no-data-icon">ℹ️</div>
                  <p>No material data was found to process for this plant.</p>
                </div>
              )}
              
              {syncResults.skippedCount > 0 && (
                <div className="skipped-details">
                  <h4>Skipped Items Details:</h4>
                  <div className="skipped-reasons">
                    {Object.entries(syncResults.skippedReasons).map(([reason, count]) => (
                      <div key={reason} className="reason-item">
                        <span className="reason-text">{reason}:</span>
                        <span className="reason-count">{count} items</span>
                      </div>
                    ))}
                  </div>
                  
                  {syncResults.skippedRows && syncResults.skippedRows.length > 0 && (
                    <div className="skipped-rows">
                      <h5>Sample Skipped Rows:</h5>
                      <div className="skipped-rows-list">
                        {syncResults.skippedRows.slice(0, 5).map((row, index) => (
                          <div key={index} className="skipped-row">
                            <span className="row-info">Row {row.rowNumber || index + 1}:</span>
                            <span className="row-reason">{row.reason}</span>
                          </div>
                        ))}
                        {syncResults.skippedRows.length > 5 && (
                          <div className="more-rows">
                            ... and {syncResults.skippedRows.length - 5} more rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="sync-timestamp">
                <small>Sync completed at: {new Date(syncResults.timestamp).toLocaleString()}</small>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default SheetsMaterialList