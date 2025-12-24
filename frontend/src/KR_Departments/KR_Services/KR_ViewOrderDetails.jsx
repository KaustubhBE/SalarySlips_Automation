import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA } from '../../config'
import '../../OrderStatus.css'
import LoadingSpinner from '../../LoadingSpinner'
import BackButton from '../../Components/BackButton'

const KR_ViewOrderDetails = () => {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [orderItems, setOrderItems] = useState([])
  const [orderInfo, setOrderInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  // Handle back navigation
  const handleBack = () => {
    navigate('/kerur/kr_store/kr_order_status')
  }

  if (loading) {
    return (
      <div className="os-container">
        <BackButton onClick={handleBack} />
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
        <BackButton onClick={handleBack} />
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
      <BackButton onClick={handleBack} />
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
              {orderInfo.tracking_details && (
                <div className="info-item">
                  <strong>Tracking Details:</strong> {orderInfo.tracking_details}
                </div>
              )}
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
                        {item.status || '-'}
                      </td>
                      <td data-label="Tracking Details" className={`os-tracking-details-cell ${!item.tracking_details ? 'os-empty-value' : ''}`}>
                        {item.tracking_details ? (
                          (() => {
                            const trackingText = item.tracking_details.trim()
                            // Check if it's a URL
                            const urlPattern = /^(https?:\/\/|www\.)/i
                            if (urlPattern.test(trackingText)) {
                              const href = trackingText.startsWith('http') ? trackingText : `https://${trackingText}`
                              return (
                                <a 
                                  href={href} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="os-tracking-link"
                                >
                                  {trackingText}
                                </a>
                              )
                            }
                            // Check if it contains URLs
                            const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
                            if (urlRegex.test(trackingText)) {
                              const parts = trackingText.split(urlRegex)
                              return (
                                <span>
                                  {parts.map((part, idx) => {
                                    if (urlRegex.test(part)) {
                                      const href = part.startsWith('http') ? part : `https://${part}`
                                      return (
                                        <a
                                          key={idx}
                                          href={href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="os-tracking-link"
                                        >
                                          {part}
                                        </a>
                                      )
                                    }
                                    return <span key={idx}>{part}</span>
                                  })}
                                </span>
                              )
                            }
                            return <span>{trackingText}</span>
                          })()
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default KR_ViewOrderDetails

