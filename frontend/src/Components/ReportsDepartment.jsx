import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import '../App.css'

const ReportsDepartment = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, canAccessService, canAccessDepartment, canAccessFactory } = useAuth()

  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true)

  // Handle back to main menu navigation
  const handleBackToMain = () => {
    navigate('/app')
  }

  if (!isAuthenticated) {
    return <div>Please log in to access reports department.</div>
  }

  if (!canAccessService('reports')) {
    return (
      <div className="splash-page">
        <h1>Access Denied</h1>
        <p>You don't have permission to access the Reports Department. Please contact your administrator.</p>
        <button onClick={handleBackToMain} className="nav-link">
          Back to Main Menu
        </button>
      </div>
    )
  }

  return (
    <div className="splash-page">
      {process.env.NODE_ENV === 'development' && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
          <strong>Debug Info:</strong><br/>
          User Role: {user?.role}<br/>
          User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
          Has Reports Permission: {canAccessService('reports') ? 'Yes' : 'No'}<br/>
          Can Access Store: {canAccessDepartment('store') ? 'Yes' : 'No'}<br/>
          Can Access Human Resource: {canAccessDepartment('humanresource') ? 'Yes' : 'No'}
        </div>
      )}
      
      <h1>Reports Department</h1>
      <h3>Please choose an option:</h3>
      
      <div className="navigation-links">
        <span 
          onClick={() => navigate('/reactor-reports')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Section 1 Daily Reactor Reports
        </span>
        <span 
          onClick={() => navigate('/reports')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          General Reports
        </span>
      </div>
      
      {/* Back to Main Menu Button - Bottom Left */}
      <div className="back-button-container">
        <button onClick={handleBackToMain} className="nav-link back-button">
          ← Back to Main Menu
        </button>
      </div>
    </div>
  )
}

export default ReportsDepartment
