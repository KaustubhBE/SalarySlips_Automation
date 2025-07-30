import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

const ReportsDepartment = () => {
  const navigate = useNavigate()

  return (
    <div className="splash-page">
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
    </div>
  )
}

export default ReportsDepartment
