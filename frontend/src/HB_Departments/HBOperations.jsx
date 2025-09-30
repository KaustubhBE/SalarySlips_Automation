import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import '../App.css';

const HBOperations = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for HB Operations department (only existing services)
  const krOperationsServices = [
    { key: 'hb_general_reports', name: 'General Reports', route: '/humnabad/hb_operations/hb_general_reports' }
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    // Admin has access to everything
    if (isAdmin) {
      return krOperationsServices;
    }
    
    // For regular users, check which services they can access
    return krOperationsServices.filter(service => 
      canAccessService(service.key, 'humnabad', 'operations')
    );
  };

  const accessibleServices = getAccessibleServices();

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    if (service.route) {
      navigate(service.route);
    }
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate('/humnabad');
  };

  if (!user) {
    return <div>Please log in to access department services.</div>;
  }

  if (accessibleServices.length === 0) {
    return (
      <div className="splash-page">
        <h1>No Service Access</h1>
        <p>You don't have access to any services in this department. Please contact your administrator.</p>
        <div style={{ 
          color: '#ff6b6b', 
          fontSize: '14px', 
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#fff5f5',
          borderRadius: '5px',
          border: '1px solid #ff6b6b'
        }}>
          ⚠️ <strong>No Permissions Assigned</strong><br/>
          You currently don't have any permissions assigned for this department. Please contact your administrator to get access to services.
        </div>
        <button onClick={handleBackToFactory} className="nav-link" style={{ marginTop: '15px' }}>
          Back to Factory
        </button>
      </div>
    );
  }

  return (
    <div className="splash-page">
      {process.env.NODE_ENV === 'development' && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
          <strong>Debug Info:</strong><br/>
          User Role: {user?.role}<br/>
          Factory: Humnabad<br/>
          Department: Operations<br/>
          Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
          User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
          Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
        </div>
      )}
      <h2>Operations - Humnabad</h2>
      <h3>Available Services ({accessibleServices.length}):</h3>
      
      {/* Service Navigation Buttons */}
      <div className="navigation-links">
        {accessibleServices.map(service => (
          <span 
            key={service.key}
            onClick={() => handleServiceNavigation(service)} 
            className="nav-link"
            role="button"
            tabIndex={0}
          >
            {service.name}
          </span>
        ))}
      </div>
      
      {/* Back to Factory Button - Bottom Left */}
      <div className="back-button-container">
        <button onClick={handleBackToFactory} className="nav-link back-button">
          ← Back to Factory
        </button>
      </div>
    </div>
  );
};

export default HBOperations;
