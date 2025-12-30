import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../OrderStatus.css'
import LoadingSpinner from '../../LoadingSpinner'
import BackButton from '../../Components/BackButton'

const STATUS_OPTIONS = [
  'Indent Raised',
  'Indent Under Review',
  'Enquiry / RFQ Sent',
  'Quotation Received',
  'Negotiation in Progress',
  'Purchase Order (PO) Released',
  'Dispatched',
  'In Transit',
  'Material Received',
  'Payment Released',
  'Order Closed'
]
const DEFAULT_STATUS = STATUS_OPTIONS[0]

const KR_UpdateOrderDetails = () => {
  const { orderId } = useParams()
  const [orderItems, setOrderItems] = useState([])
  const [orderInfo, setOrderInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Modal state for editing tracking details
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [editingTrackingIndex, setEditingTrackingIndex] = useState(null)
  const [trackingDetailsText, setTrackingDetailsText] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [fileMaterialAssociations, setFileMaterialAssociations] = useState({}) // { fileIndex: [materialKeys] }
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // Parse date from various formats
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    
    // Try different date formats
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) return date
    }
    
    const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy
      const date = new Date(`${year}-${month}-${day}`)
      if (!isNaN(date.getTime())) return date
    }
    
    const ddmmyyyyDash = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/)
    if (ddmmyyyyDash) {
      const [, day, month, year] = ddmmyyyyDash
      const date = new Date(`${year}-${month}-${day}`)
      if (!isNaN(date.getTime())) return date
    }
    
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) return date
    
    return null
  }

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = parseDate(dateStr)
    if (!date) return dateStr
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Fetch order details
  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (!orderId || orderId === 'UNKNOWN') {
        setError('Invalid Order ID')
        setLoading(false)
        return
      }

      // Find the Kerur plant data to get the sheet ID
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      const sheetName = kerurPlant?.sheet_name?.IndentList || 'Indent List'
      
      if (!sheetId) {
        setError('No sheet ID found for Kerur plant')
        setLoading(false)
        return
      }
      
      const response = await axios.get(getApiUrl('get_indent_list'), {
        params: { 
          factory: 'KR',
          sheet_name: sheetName,
          sheet_id: sheetId
        }
      })
      
      if (response.data.success) {
        const data = response.data.data || []
        
        // Filter items for this order ID
        const itemsForOrder = data.filter(item => item.order_id === orderId)
        
        if (itemsForOrder.length === 0) {
          setError(`No items found for Order ID: ${orderId}`)
          setLoading(false)
          return
        }
        
        // Set order items
        setOrderItems(itemsForOrder)
        
        // Extract order info from first item (common fields)
        if (itemsForOrder.length > 0) {
          const firstItem = itemsForOrder[0]
          setOrderInfo({
            order_id: firstItem.order_id,
            date: firstItem.date,
            time: firstItem.time,
            given_by: firstItem.given_by,
            type: firstItem.type,
            importance: firstItem.importance,
            description: firstItem.description,
            status: firstItem.status,
            tracking_details: firstItem.tracking_details
          })
        }
      } else {
        setError(response.data.error || 'Failed to fetch order details')
      }
    } catch (err) {
      console.error('Error fetching order details:', err)
      setError(err.response?.data?.error || err.message || 'Failed to fetch order details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrderDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleStatusChange = async (index, newStatus) => {
    const item = orderItems[index]
    const oldStatus = item.status || DEFAULT_STATUS
    
    // Optimistically update UI
    setOrderItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, status: newStatus } : item
      )
    )
    
    // Update status in Google Sheets
    try {
      const response = await axios.post(getApiUrl('update_indent_item_status'), {
        factory: 'KR',
        orderId: orderId,
        materialName: item.material_name || '',
        status: newStatus
      })
      
      if (response.data.success) {
        // Status updated successfully
        console.log(`Status updated to ${newStatus} for ${item.material_name}`)
      } else {
        // Revert on error
        setOrderItems(prev =>
          prev.map((item, i) =>
            i === index ? { ...item, status: oldStatus } : item
          )
        )
        alert(`Failed to update status: ${response.data.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      // Revert on error
      setOrderItems(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, status: oldStatus } : item
        )
      )
      alert(`Failed to update status: ${error.response?.data?.message || error.message || 'Unknown error'}`)
    }
  }

  // Handle opening edit tracking details modal
  const handleEditTracking = (index) => {
    const item = orderItems[index]
    setEditingTrackingIndex(index)
    setTrackingDetailsText(item.tracking_details || '')
    setSelectedFiles([])
    setFileMaterialAssociations({}) // Reset associations
    setShowTrackingModal(true)
  }

  // Generate material key for an item
  const generateMaterialKey = (item) => {
    const parts = []
    if (item.category) parts.push(item.category)
    if (item.sub_category) parts.push(item.sub_category)
    if (item.material_name) parts.push(item.material_name)
    if (item.specifications) parts.push(item.specifications)
    return parts.join('_').toLowerCase()
  }

  // Get material options for checklist
  const getMaterialOptions = () => {
    return orderItems.map((item, index) => {
      const key = generateMaterialKey(item)
      const displayName = `${item.material_name || 'Unknown'} (${item.category || ''})`
      return {
        key,
        index,
        displayName,
        fullItem: item
      }
    })
  }

  // Handle material association toggle
  const handleMaterialToggle = (fileIndex, materialKey) => {
    setFileMaterialAssociations(prev => {
      const current = prev[fileIndex] || []
      const isSelected = current.includes(materialKey)
      return {
        ...prev,
        [fileIndex]: isSelected
          ? current.filter(k => k !== materialKey)
          : [...current, materialKey]
      }
    })
  }

  // Handle closing modal
  const handleCloseTrackingModal = () => {
    setShowTrackingModal(false)
    setEditingTrackingIndex(null)
    setTrackingDetailsText('')
    setSelectedFiles([])
    setIsDragging(false)
    setFileMaterialAssociations({})
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    const currentCount = selectedFiles.length
    setSelectedFiles(prev => [...prev, ...files])
    
    // Auto-assign if only one material exists
    setFileMaterialAssociations(prev => {
      const updated = { ...prev }
      files.forEach((_, idx) => {
        const fileIndex = currentCount + idx
        if (orderItems.length === 1) {
          // Auto-assign to the single material
          const singleMaterialKey = generateMaterialKey(orderItems[0])
          updated[fileIndex] = [singleMaterialKey]
        } else {
          // Initialize empty array for manual selection
          if (!updated[fileIndex]) {
            updated[fileIndex] = []
          }
        }
      })
      return updated
    })
  }

  // Handle file removal
  const handleFileRemove = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove))
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    const currentCount = selectedFiles.length
    setSelectedFiles(prev => [...prev, ...files])
    
    // Auto-assign if only one material exists
    setFileMaterialAssociations(prev => {
      const updated = { ...prev }
      files.forEach((_, idx) => {
        const fileIndex = currentCount + idx
        if (orderItems.length === 1) {
          // Auto-assign to the single material
          const singleMaterialKey = generateMaterialKey(orderItems[0])
          updated[fileIndex] = [singleMaterialKey]
        } else {
          // Initialize empty array for manual selection
          if (!updated[fileIndex]) {
            updated[fileIndex] = []
          }
        }
      })
      return updated
    })
  }

  // Handle save tracking details
  const handleSaveTracking = async () => {
    if (editingTrackingIndex === null) return

    try {
      setUploadingFiles(true)

      const item = orderItems[editingTrackingIndex]
      const kerurPlant = PLANT_DATA.find(plant => plant.document_name === 'KR')
      const sheetId = kerurPlant?.material_sheet_id
      const sheetName = kerurPlant?.sheet_name?.IndentList || 'Indent List'

      if (!sheetId) {
        throw new Error('No sheet ID found for Kerur plant')
      }

      let fileUrls = []

      // Upload files if any are selected
      if (selectedFiles.length > 0) {
        // Validate that each file has at least one material association (only if more than one material exists)
        if (orderItems.length > 1) {
          const filesWithoutAssociations = []
          selectedFiles.forEach((file, index) => {
            const associations = fileMaterialAssociations[index] || []
            if (associations.length === 0) {
              filesWithoutAssociations.push(file.name)
            }
          })

          if (filesWithoutAssociations.length > 0) {
            alert(`Please select at least one material for each file:\n${filesWithoutAssociations.join('\n')}`)
            setUploadingFiles(false)
            return
          }
        }

        // Prepare form data for file upload
        const formData = new FormData()
        selectedFiles.forEach((file) => {
          formData.append('files[]', file)
        })

        // Prepare material associations
        const associations = selectedFiles.map((file, index) => ({
          file_index: index,
          material_keys: fileMaterialAssociations[index] || []
        }))

        formData.append('orderId', orderId)
        formData.append('factory', 'KR')
        formData.append('material_associations', JSON.stringify(associations))

        // Upload files
        const uploadResponse = await axios.post(
          getApiUrl('upload_tracking_files'),
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          }
        )

        if (!uploadResponse.data.success) {
          throw new Error(uploadResponse.data.message || 'Failed to upload files')
        }

        // Extract file URLs (deduplicate since same file may be in multiple folders)
        const uniqueFileUrls = [...new Set(uploadResponse.data.uploaded_files.map(f => f.file_url))]
        fileUrls = uniqueFileUrls
        
        // Collect all unique material keys from all uploaded files
        const allMaterialKeys = new Set()
        uploadResponse.data.uploaded_files.forEach(file => {
          if (file.material_keys && Array.isArray(file.material_keys)) {
            file.material_keys.forEach(key => allMaterialKeys.add(key))
          }
        })

        // Get material names for these keys
        const materialsToUpdate = Array.from(allMaterialKeys)
          .map(key => {
            const material = orderItems.find(item => generateMaterialKey(item) === key)
            return material ? material.material_name : null
          })
          .filter(Boolean)

        // Build updated tracking details text
        let updatedTrackingText = trackingDetailsText.trim()

        // Append file URLs if provided
        if (fileUrls.length > 0) {
          // Extract existing URLs from tracking details to avoid duplicates
          const urlRegex = /(https?:\/\/[^\s,\n]+|www\.[^\s,\n]+)/gi
          const existingUrls = updatedTrackingText.match(urlRegex) || []
          
          // Filter out URLs that already exist
          const newUrls = fileUrls.filter(url => {
            const normalizedUrl = url.trim()
            return !existingUrls.some(existing => {
              const normalizedExisting = existing.trim()
              return normalizedExisting === normalizedUrl || 
                     normalizedExisting.replace(/\/$/, '') === normalizedUrl.replace(/\/$/, '')
            })
          })
          
          // Only append if there are new URLs
          if (newUrls.length > 0) {
            // Remove "Files:" label if it exists at the end
            updatedTrackingText = updatedTrackingText.replace(/\n*Files:\s*\n*$/i, '').trim()
            
            if (updatedTrackingText) {
              updatedTrackingText += '\n\nFiles:\n'
            } else {
              updatedTrackingText = 'Files:\n'
            }
            updatedTrackingText += newUrls.join('\n')
          }
        }

        // Update tracking details for all associated materials
        if (materialsToUpdate.length > 0) {
          const updateResponse = await axios.post(getApiUrl('update_multiple_tracking_details'), {
            factory: 'KR',
            orderId: orderId,
            material_names: materialsToUpdate,
            tracking_details: updatedTrackingText,
            file_urls: fileUrls,
            sheet_id: sheetId,
            sheet_name: sheetName
          })

          if (!updateResponse.data.success) {
            throw new Error(updateResponse.data.message || 'Failed to update tracking details')
          }

          // Update local state for all affected materials
          setOrderItems(prev =>
            prev.map(item => {
              const materialKey = generateMaterialKey(item)
              if (allMaterialKeys.has(materialKey)) {
                return { ...item, tracking_details: updatedTrackingText }
              }
              return item
            })
          )
        } else {
          // Fallback: Update only current material if no associations found
          const updateResponse = await axios.post(getApiUrl('update_tracking_details'), {
            factory: 'KR',
            orderId: orderId,
            materialName: item.material_name,
            rowIndex: item.row_index || null,
            tracking_details: updatedTrackingText,
            file_urls: fileUrls,
            sheet_id: sheetId,
            sheet_name: sheetName
          })

          if (!updateResponse.data.success) {
            throw new Error(updateResponse.data.message || 'Failed to update tracking details')
          }

          // Update local state
          setOrderItems(prev =>
            prev.map((item, i) =>
              i === editingTrackingIndex
                ? { ...item, tracking_details: updatedTrackingText }
                : item
            )
          )
        }
      } else {
        // No files uploaded, just update tracking details text for current material
        let updatedTrackingText = trackingDetailsText.trim()

        const updateResponse = await axios.post(getApiUrl('update_tracking_details'), {
          factory: 'KR',
          orderId: orderId,
          materialName: item.material_name,
          rowIndex: item.row_index || null,
          tracking_details: updatedTrackingText,
          file_urls: [],
          sheet_id: sheetId,
          sheet_name: sheetName
        })

        if (!updateResponse.data.success) {
          throw new Error(updateResponse.data.message || 'Failed to update tracking details')
        }

        // Update local state
        setOrderItems(prev =>
          prev.map((item, i) =>
            i === editingTrackingIndex
              ? { ...item, tracking_details: updatedTrackingText }
              : item
          )
        )
      }

      // Close modal
      handleCloseTrackingModal()

      // Show success message
      alert('Tracking details and files updated successfully!')
    } catch (error) {
      console.error('Error saving tracking details:', error)
      alert(`Failed to save tracking details: ${error.response?.data?.message || error.message || 'Unknown error'}`)
    } finally {
      setUploadingFiles(false)
    }
  }

  if (loading) {
    return (
      <div className="os-container">
        <BackButton label="Back to Order Status" to="/kerur/kr_store/kr_order_status" />
        <div className="os-loading">
          <LoadingSpinner />
          <p>Loading order details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="os-container">
        <BackButton label="Back to Order Status" to="/kerur/kr_store/kr_order_status" />
        <div className="os-error">
          <p className="os-error-message">{error}</p>
          <button onClick={fetchOrderDetails} className="os-retry-btn">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="os-container">
      <BackButton label="Back to Order Status" to="/kerur/kr_store/kr_order_status" />
      <div className="order-detail-page">
        <div className="order-detail-header">
          <h1>Order Details - {orderId}</h1>
        </div>

        {/* Order Information Card */}
        {orderInfo && (
          <div className="order-info-card">
            <h2 className="section-title">Order Information</h2>
            <div className="order-info-grid">
              <div className="info-item">
                <strong>Order ID:</strong> {orderInfo.order_id}
              </div>
              <div className="info-item">
                <strong>Date:</strong> {formatDate(orderInfo.date)}
              </div>
              <div className="info-item">
                <strong>Time:</strong> {orderInfo.time || '-'}
              </div>
              <div className="info-item">
                <strong>Given By:</strong> {orderInfo.given_by || '-'}
              </div>
              <div className="info-item">
                <strong>Type:</strong> {orderInfo.type || '-'}
              </div>
              <div className="info-item">
                <strong>Importance:</strong> {orderInfo.importance || '-'}
              </div>
              {orderInfo.description && (
                <div className="info-item full-width">
                  <strong>Description:</strong> {orderInfo.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Items Table */}
        <div className="order-items-section">
          <h2 className="section-title">Order Items ({orderItems.length})</h2>
          <div className="os-items-table-container">
            <table className="os-items-table">
              <thead>
                <tr>
                  <th>SN</th>
                  <th>Category</th>
                  <th>Sub Category</th>
                  <th>Material Name</th>
                  <th>Specifications</th>
                  <th>Quantity</th>
                  <th>UOM</th>
                  <th>Preferred Vendor</th>
                  <th>Place</th>
                  <th>Status</th>
                  <th>Tracking Details</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="os-no-items">
                      No items found for this order
                    </td>
                  </tr>
                ) : (
                  orderItems.map((item, index) => (
                    <tr key={index}>
                      <td data-label="S.No">{index + 1}</td>
                      <td data-label="Category">{item.category || '-'}</td>
                      <td data-label="Sub Category" className={!item.sub_category ? 'os-empty-value' : ''}>{item.sub_category || '-'}</td>
                      <td data-label="Material Name">{item.material_name || '-'}</td>
                      <td data-label="Specifications" className={!item.specifications ? 'os-empty-value' : ''}>{item.specifications || '-'}</td>
                      <td data-label="Quantity">{item.quantity || '-'}</td>
                      <td data-label="UOM">{item.uom || '-'}</td>
                      <td data-label="Preferred Vendor" className={!item.preferred_vendor ? 'os-empty-value' : ''}>{item.preferred_vendor || '-'}</td>
                      <td data-label="Place" className={!item.place ? 'os-empty-value' : ''}>{item.place || '-'}</td>
                      <td data-label="Status" className="os-status-cell">
                        <select
                          className="os-status-select"
                          value={item.status || DEFAULT_STATUS}
                          onChange={(e) => handleStatusChange(index, e.target.value)}
                          style={{
                            width: '100%',
                            maxWidth: '100%',
                            minWidth: 0,
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #d0d7de',
                            backgroundColor: '#f8fafd',
                            textAlign: 'center',
                            textAlignLast: 'center',
                            fontWeight: 500,
                            color: '#1f2937',
                            boxSizing: 'border-box'
                          }}
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Tracking Details" className={`os-tracking-details-cell ${!item.tracking_details ? 'os-empty-value' : ''}`}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '60px' }}>
                          {/* Upper half - Tracking Details */}
                          <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            {item.tracking_details ? (
                              (() => {
                                const trackingText = item.tracking_details.trim()
                                // Extract URLs using regex - matches http://, https://, or www.
                                const urlRegex = /(https?:\/\/[^\s,\n]+|www\.[^\s,\n]+)/gi
                                const urls = trackingText.match(urlRegex) || []
                                
                                // Remove duplicates
                                const uniqueUrls = [...new Set(urls)]
                                
                                if (uniqueUrls.length === 0) {
                                  return <span>{trackingText}</span>
                                }
                                
                                return (
                                  <span>
                                    {uniqueUrls.map((url, idx) => {
                                      // Ensure URL has protocol to open as external link
                                      const href = url.startsWith('http://') || url.startsWith('https://') 
                                        ? url 
                                        : `https://${url}`
                                      
                                      return (
                                        <React.Fragment key={idx}>
                                          <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="os-tracking-link"
                                          >
                                            {url}
                                          </a>
                                          {idx < uniqueUrls.length - 1 && <span>, </span>}
                                        </React.Fragment>
                                      )
                                    })}
                                  </span>
                                )
                              })()
                            ) : (
                              '-'
                            )}
                          </div>
                          {/* Lower half - Edit Button */}
                          <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            <button
                              type="button"
                              className="po-edit-item-btn"
                              title="Edit tracking details"
                              aria-label="Edit tracking details"
                              onClick={() => handleEditTracking(index)}
                              style={{ minWidth: '36px', height: '32px' }}
                            >
                              <span className="po-btn-icon po-icon-edit" aria-hidden="true"></span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Tracking Details Modal */}
      {showTrackingModal && (
        <div className="os-tracking-modal-overlay" onClick={handleCloseTrackingModal}>
          <div className="os-tracking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="os-tracking-modal-header">
              <h2>Edit Tracking Details</h2>
              <button
                className="os-tracking-modal-close"
                onClick={handleCloseTrackingModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="os-tracking-modal-content">
              {/* Textarea for tracking details */}
              <div className="os-tracking-textarea-section">
                <label htmlFor="tracking-details-textarea" className="os-tracking-label">
                  Tracking Details
                </label>
                <textarea
                  id="tracking-details-textarea"
                  className="os-tracking-textarea"
                  value={trackingDetailsText}
                  onChange={(e) => setTrackingDetailsText(e.target.value)}
                  placeholder="Enter tracking details..."
                  rows={6}
                />
              </div>

              {/* File Upload Section */}
              <div className="os-tracking-upload-section">
                <label className="os-tracking-label">Upload Files</label>
                <div
                  className={`os-tracking-dropzone ${isDragging ? 'os-drag-active' : ''}`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="os-tracking-dropzone-content">
                    <div className="os-tracking-dropzone-icon">📁</div>
                    <p className="os-tracking-dropzone-text">
                      Choose a file or drag & drop it here
                    </p>
                    <p className="os-tracking-dropzone-hint">
                      All file types accepted
                    </p>
                    <input
                      type="file"
                      id="tracking-file-input"
                      className="os-tracking-file-input"
                      multiple
                      onChange={handleFileSelect}
                      accept="*/*"
                    />
                    <label htmlFor="tracking-file-input" className="os-tracking-browse-btn">
                      Browse File
                    </label>
                  </div>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="os-tracking-files-list">
                    <h4 className="os-tracking-files-title">Selected Files ({selectedFiles.length})</h4>
                    <div className="os-tracking-files-container">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="os-tracking-file-item">
                          <div className="os-tracking-file-info">
                            <span className="os-tracking-file-icon">📄</span>
                            <div className="os-tracking-file-details">
                              <span className="os-tracking-file-name">{file.name}</span>
                              <span className="os-tracking-file-size">{formatFileSize(file.size)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="os-tracking-file-remove"
                            onClick={() => {
                              handleFileRemove(index)
                              // Remove material associations for this file
                              setFileMaterialAssociations(prev => {
                                const updated = { ...prev }
                                delete updated[index]
                                // Reindex remaining associations
                                const reindexed = {}
                                Object.keys(updated).forEach(key => {
                                  const keyNum = parseInt(key)
                                  if (keyNum > index) {
                                    reindexed[keyNum - 1] = updated[key]
                                  } else if (keyNum < index) {
                                    reindexed[keyNum] = updated[key]
                                  }
                                })
                                return reindexed
                              })
                            }}
                            aria-label={`Remove ${file.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Material Associations Section - Only show if more than one material */}
              {selectedFiles.length > 0 && orderItems.length > 1 && (
                <div className="os-tracking-material-associations">
                  <h4 className="os-tracking-material-associations-title">
                    Material Associations
                  </h4>
                  <p className="os-tracking-material-associations-hint">
                    Select which materials each file is associated with:
                  </p>
                  {selectedFiles.map((file, fileIndex) => {
                    const materialOptions = getMaterialOptions()
                    const selectedMaterials = fileMaterialAssociations[fileIndex] || []
                    
                    return (
                      <div key={fileIndex} className="os-tracking-file-association">
                        <div className="os-tracking-file-association-header">
                          {file.name}
                        </div>
                        <div className="os-tracking-material-checklist">
                          {materialOptions.map((option) => {
                            const isChecked = selectedMaterials.includes(option.key)
                            return (
                              <label
                                key={option.key}
                                className="os-tracking-material-checkbox-item"
                              >
                                <input
                                  type="checkbox"
                                  className="os-tracking-material-checkbox"
                                  checked={isChecked}
                                  onChange={() => handleMaterialToggle(fileIndex, option.key)}
                                />
                                <span className="os-tracking-material-label">
                                  {option.displayName}
                                </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
                </div>
              )}
            </div>

            <div className="os-tracking-modal-footer">
              <button
                type="button"
                className="os-tracking-btn os-tracking-btn-cancel"
                onClick={handleCloseTrackingModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="os-tracking-btn os-tracking-btn-save"
                onClick={handleSaveTracking}
                disabled={uploadingFiles}
              >
                {uploadingFiles ? 'Uploading...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Spinner for file uploads and tracking details updates */}
      {uploadingFiles && <LoadingSpinner />}
    </div>
  )
}

export default KR_UpdateOrderDetails

