import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const KROperations = () => {
  const navigate = useNavigate();

  const handleReactorReports = () => {
    navigate('/kerur/kr_operations/kr_reactor-reports');
  };

  return (
    <div className="splash-page">
      <h1>Kerur Operations Department</h1>
      <h3>Select a service:</h3>
      
      <div className="navigation-links">
        <span 
          onClick={handleReactorReports}
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Reactor Reports
        </span>
      </div>
      
      {/* Back to Factory Button */}
      <div className="back-button-container">
        <button onClick={() => navigate('/kerur')} className="nav-link back-button">
          ← Back to Kerur Factory
        </button>
      </div>
    </div>
  );
};

export default KROperations;
