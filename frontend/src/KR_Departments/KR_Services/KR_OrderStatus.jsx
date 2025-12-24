import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { getApiUrl, PLANT_DATA, PERMISSIONS } from '../../config'
import '../../OrderStatus.css'
import LoadingSpinner from '../../LoadingSpinner'
import BackButton from '../../Components/BackButton'
import DateRangePicker from '../../Components/DateRangePicker'
import { useAuth } from '../../Components/AuthContext'

const KR_OrderStatus = () => {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [indentData, setIndentData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [filterType, setFilterType] = useState('')
  const [filterImportance, setFilterImportance] = useState('')
  const [filterGivenBy, setFilterGivenBy] = useState('')
  const [startDate, setStartDate] = useState('') // Start date for date range filter
  const [endDate, setEndDate] = useState('') // End date for date range filter
  const [loadingPdf, setLoadingPdf] = useState({}) // Track PDF loading per order ID
  const isPdfLoading = useMemo(
    () => Object.values(loadingPdf).some(Boolean),
    [loadingPdf]
  )

  // Parse date from various formats
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    
    // Try different date formats
    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try DD/MM/YYYY format
    const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy
      const date = new Date(`${year}-${month}-${day}`)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try DD-MM-YYYY format
    const ddmmyyyyDash = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/)
    if (ddmmyyyyDash) {
      const [, day, month, year] = ddmmyyyyDash
      const date = new Date(`${year}-${month}-${day}`)
      if (!isNaN(date.getTime())) return date
    }
    
    // Try native Date parsing as fallback
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) return date
    
    return null
  }

  // Check if date is today
  const isToday = (dateStr) => {
    if (!dateStr) return false
    const date = parseDate(dateStr)
    if (!date) return false
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = parseDate(dateStr)
    if (!date) return dateStr // Return as-is if parsing fails
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Fetch indent list data from Google Sheets
  const fetchIndentList = async () => {
    try {
      setLoading(true)
      setError(null)
      
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
        setIndentData(data)
        
        // Debug logging: Log all dates received
        console.log('=== ORDER STATUS DEBUG ===')
        console.log('Total records received:', data.length)
        console.log('Sample dates:', data.slice(0, 5).map(item => ({
          orderId: item.order_id,
          date: item.date,
          dateType: typeof item.date,
          rawDate: item.date
        })))
        
        // Check for today's orders
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD
        const todayFormatted = today.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) // DD/MM/YYYY
        
        const todayOrders = data.filter(item => {
          if (!item.date) return false
          const itemDate = parseDate(item.date)
          if (!itemDate) return false
          return itemDate.toDateString() === today.toDateString()
        })
        
        console.log('Today\'s date (ISO):', todayStr)
        console.log('Today\'s date (formatted):', todayFormatted)
        console.log('Today\'s orders found:', todayOrders.length)
        console.log('Today\'s order IDs:', todayOrders.map(o => o.order_id))
        console.log('========================')
      } else {
        setError(response.data.error || 'Failed to fetch indent list')
      }
    } catch (err) {
      console.error('Error fetching indent list:', err)
      setError(err.response?.data?.error || err.message || 'Failed to fetch indent list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIndentList()
  }, [])

  // Get unique values for filters
  const uniqueTypes = useMemo(() => {
    const types = [...new Set(indentData.map(item => item.type).filter(Boolean))]
    return types.sort()
  }, [indentData])

  const uniqueImportances = useMemo(() => {
    const importances = [...new Set(indentData.map(item => item.importance).filter(Boolean))]
    return importances.sort()
  }, [indentData])

  const uniqueGivenBy = useMemo(() => {
    const givenBy = [...new Set(indentData.map(item => item.given_by).filter(Boolean))]
    return givenBy.sort()
  }, [indentData])

  // Group data by Order ID
  const groupedByOrderId = useMemo(() => {
    const grouped = {}
    indentData.forEach(item => {
      const orderId = item.order_id || 'UNKNOWN'
      if (!grouped[orderId]) {
        grouped[orderId] = []
      }
      grouped[orderId].push(item)
    })
    return grouped
  }, [indentData])

  // Get unique orders (one row per Order ID)
  const uniqueOrders = useMemo(() => {
    const orderMap = new Map()
    indentData.forEach(item => {
      const orderId = item.order_id || 'UNKNOWN'
      if (!orderMap.has(orderId)) {
        // Use the first item of each order as the representative row
        orderMap.set(orderId, item)
      }
    })
    return Array.from(orderMap.values())
  }, [indentData])

  // Filter and sort unique orders
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...uniqueOrders]

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(item => {
        return (
          (item.order_id && item.order_id.toLowerCase().includes(searchLower)) ||
          (item.given_by && item.given_by.toLowerCase().includes(searchLower)) ||
          (item.description && item.description.toLowerCase().includes(searchLower)) ||
          (item.status && item.status.toLowerCase().includes(searchLower)) ||
          (item.tracking_details && item.tracking_details.toLowerCase().includes(searchLower))
        )
      })
    }

    // Apply type filter
    if (filterType) {
      filtered = filtered.filter(item => item.type === filterType)
    }

    // Apply importance filter
    if (filterImportance) {
      filtered = filtered.filter(item => item.importance === filterImportance)
    }

    // Apply given by filter
    if (filterGivenBy) {
      filtered = filtered.filter(item => item.given_by === filterGivenBy)
    }

    // Apply date range filter
    if (startDate || endDate) {
      filtered = filtered.filter(item => {
        const itemDate = parseDate(item.date)
        if (!itemDate) return false
        
        // If start date is provided, item date must be >= start date
        if (startDate) {
          const startDateObj = new Date(startDate)
          startDateObj.setHours(0, 0, 0, 0) // Set to start of day
          if (itemDate < startDateObj) return false
        }
        
        // If end date is provided, item date must be <= end date
        if (endDate) {
          const endDateObj = new Date(endDate)
          endDateObj.setHours(23, 59, 59, 999) // Set to end of day
          if (itemDate > endDateObj) return false
        }
        
        return true
      })
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key] || ''
        const bValue = b[sortConfig.key] || ''
        
        if (sortConfig.key === 'date') {
          // Sort dates using improved parsing
          const dateA = parseDate(aValue)
          const dateB = parseDate(bValue)
          if (!dateA && !dateB) return 0
          if (!dateA) return 1
          if (!dateB) return -1
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA
        } else {
          // Sort strings
          const strA = String(aValue).toLowerCase()
          const strB = String(bValue).toLowerCase()
          if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1
          if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1
          return 0
        }
      })
    }

    return filtered
  }, [uniqueOrders, searchTerm, filterType, filterImportance, filterGivenBy, startDate, endDate, sortConfig])


  // Handle PDF retrieval and opening
  const handleOpenPdf = async (orderId, event) => {
    if (event) {
      event.stopPropagation() // Prevent row click
    }

    if (!orderId || orderId === 'UNKNOWN') {
      alert('Invalid Order ID')
      return
    }

    try {
      setLoadingPdf(prev => ({ ...prev, [orderId]: true }))
      
      const response = await axios.get(getApiUrl('get_order_pdf'), {
        params: {
          order_id: orderId,
          factory: 'KR'
        }
      })

      if (response.data.success) {
        // Open PDF in new tab
        window.open(response.data.view_link, '_blank')
      } else {
        alert(response.data.error || 'PDF not available for this order')
      }
    } catch (err) {
      console.error('Error fetching PDF:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to retrieve PDF'
      alert(`Error: ${errorMessage}`)
    } finally {
      setLoadingPdf(prev => ({ ...prev, [orderId]: false }))
    }
  }


  // Handle column sorting
  const handleSort = (key) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return { key, direction: 'asc' }
    })
  }

  // Get sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return '⇅'
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  // Handle navigation to order details
  const handleViewOrderDetails = (orderId, event) => {
    if (event) {
      event.stopPropagation()
    }
    if (!orderId || orderId === 'UNKNOWN') {
      alert('Invalid Order ID')
      return
    }
    navigate(`/kerur/kr_store/kr_order_status/${orderId}`)
  }

  const handleUpdateOrderDetails = (orderId, event) => {
    if (event) {
      event.stopPropagation()
    }
    if (!orderId || orderId === 'UNKNOWN') {
      alert('Invalid Order ID')
      return
    }
    navigate(`/kerur/kr_store/kr_order_status/update/${orderId}`)
  }

  const canView = hasPermission(PERMISSIONS.KR_ORDER_STATUS, 'kerur', 'store')
  const canUpdate = hasPermission(PERMISSIONS.KR_UPDATE_ORDER_STATUS, 'kerur', 'store')

  if (loading) {
    return (
      <div className="os-container">
        <BackButton />
        <div className="os-loading">
          <LoadingSpinner />
          <p>Loading order status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="os-container">
        <BackButton />
        <div className="os-error">
          <p className="os-error-message">{error}</p>
          <button onClick={fetchIndentList} className="os-retry-btn">
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show list view
  return (
    <div className="os-container">
      {isPdfLoading && (
        <>
          <LoadingSpinner />
          <div className="os-pdf-overlay-text">Opening PDF...</div>
        </>
      )}
      <BackButton />
      <div className="os-header">
        <h1>Order Status - Kerur</h1>
        <div className="os-header-actions">
          {(filterType || filterImportance || filterGivenBy || searchTerm || startDate || endDate) && (
            <button
              onClick={() => {
                setFilterType('')
                setFilterImportance('')
                setFilterGivenBy('')
                setSearchTerm('')
                setStartDate('')
                setEndDate('')
              }}
              className="os-clear-btn"
              title="Clear Filters"
            >
              Clear Filters
            </button>
          )}
          <button onClick={fetchIndentList} className="os-refresh-btn" title="Refresh">
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="os-filters">
        <div className="os-filter-group">
          <label className="os-filter-label">Search</label>
          <input
            type="text"
            placeholder="Search by Order ID, Material, Category, Given By, or Description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="os-search-input"
          />
        </div>
        <div className="os-filter-group os-date-range-group">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>
        <div className="os-filter-group">
          <label className="os-filter-label">Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="os-filter-select"
          >
            <option value="">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="os-filter-group">
          <label className="os-filter-label">Importance</label>
          <select
            value={filterImportance}
            onChange={(e) => setFilterImportance(e.target.value)}
            className="os-filter-select"
          >
            <option value="">All Importance</option>
            {uniqueImportances.map(importance => (
              <option key={importance} value={importance}>{importance}</option>
            ))}
          </select>
        </div>
        <div className="os-filter-group">
          <label className="os-filter-label">Given By</label>
          <select
            value={filterGivenBy}
            onChange={(e) => setFilterGivenBy(e.target.value)}
            className="os-filter-select"
          >
            <option value="">All Given By</option>
            {uniqueGivenBy.map(givenBy => (
              <option key={givenBy} value={givenBy}>{givenBy}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="os-results">
        Showing {filteredAndSortedOrders.length} of {uniqueOrders.length} orders
      </div>

      {/* Table */}
      <div className="os-table-wrap">
        <table className="os-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('order_id')} className="os-sortable">
                Order ID {getSortIcon('order_id')}
              </th>
              <th onClick={() => handleSort('date')} className="os-sortable">
                Date {getSortIcon('date')}
              </th>
              <th onClick={() => handleSort('time')} className="os-sortable">
                Time {getSortIcon('time')}
              </th>
              <th>Order Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedOrders.length === 0 ? (
              <tr>
                <td colSpan="4" className="os-no-data">
                  No orders found
                </td>
              </tr>
            ) : (
              filteredAndSortedOrders.map((order, index) => {
                const orderId = order.order_id || 'UNKNOWN'
                
                return (
                  <tr 
                    key={orderId}
                    className="os-row"
                  >
                    <td className="os-id-cell">
                      <span 
                        className="os-id-link"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenPdf(orderId, e)
                        }}
                        title="Click to view PDF"
                      >
                        {orderId}
                      </span>
                    </td>
                    <td>{formatDate(order.date)}</td>
                    <td>{order.time || '-'}</td>
                    <td className="os-details-cell" onClick={(e) => e.stopPropagation()}>
                      {canView && (
                      <button
                        className="os-details-btn"
                        onClick={(e) => handleViewOrderDetails(orderId, e)}
                        title="View Order Details"
                      >
                        View Details
                      </button>
                      )}
                      {canUpdate && (
                        <button
                          className="os-details-btn"
                          style={{ marginLeft: canView ? '8px' : 0 }}
                          onClick={(e) => handleUpdateOrderDetails(orderId, e)}
                          title="Update Order Details"
                        >
                          Update Details
                        </button>
                      )}
                      {!canView && !canUpdate && <span className="os-no-access">No access</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default KR_OrderStatus
