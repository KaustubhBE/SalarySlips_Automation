import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

const HR = () => {
  const navigate = useNavigate()

  return (
    <div className="splash-page">
      <h1>HR Department</h1>
      <h3>Please choose a processing option:</h3>
      <div className="navigation-links">
        <span 
          onClick={() => navigate('/single-processing')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Single Processing
        </span>
        <span 
          onClick={() => navigate('/batch-processing')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Batch Processing
        </span>
        <span 
          onClick={() => navigate('/reports')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Reports
        </span>
      </div>
    </div>
  )
}

export default HR
