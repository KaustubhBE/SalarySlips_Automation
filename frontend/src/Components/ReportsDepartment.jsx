import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import '../App.css'

const ReportsDepartment = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Function to check if user is admin
  const isAdmin = user?.role === 'admin'

  // Check if user has specific permission
  const hasUserPermission = (permission) => {
    // Admin has access to everything
    if (isAdmin) {
      return true
    }
    
    // Check if user has the specific permission
    return user?.permissions && user.permissions[permission] === true
  }

  // Check if user is authenticated
  const isAuthenticated = !!user

  // Handle back to main menu navigation
  const handleBackToMain = () => {
    navigate('/app')
  }

  if (!user) {
    return <div>Please log in to access reports department.</div>
  }

  if (!hasUserPermission('reports')) {
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
          User Permissions: {JSON.stringify(user?.permissions || {})}<br/>
          Has Reports Permission: {hasUserPermission('reports') ? 'Yes' : 'No'}
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
