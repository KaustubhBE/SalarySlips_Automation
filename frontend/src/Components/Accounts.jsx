import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

const Accounts = () => {
  const navigate = useNavigate()

  return (
    <div className="splash-page">
      <h1>Accounts Department</h1>
      <h3>Please choose an option:</h3>
      <div className="navigation-links">
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

export default Accounts
