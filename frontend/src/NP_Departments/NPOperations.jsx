import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import '../App.css';
import BackButton from '../Components/BackButton';

const NPOperations = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for NP Operations department (only existing services)
  const npOperationsServices = [
    { key: 'np_general_reports', name: 'General Reports', route: '/newplant/np_operations/np_general_reports' }
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    // Admin has access to everything
    if (isAdmin) {
      return npOperationsServices;
    }
    
    // For regular users, check which services they can access
    return npOperationsServices.filter(service => 
      canAccessService(service.key, 'newplant', 'operations')
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
    navigate('/newplant');
  };

  if (!user) {
    return <div>Please log in to access department services.</div>;
  }

  if (accessibleServices.length === 0) {
    return (
      <div>
        <BackButton 
          label="Back to Factory" 
          onClick={handleBackToFactory}
        />
        
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
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackButton 
        label="Back to Factory" 
        onClick={handleBackToFactory}
      />
      
      <div className="splash-page">
        {process.env.NODE_ENV === 'development' && (
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
            <strong>Debug Info:</strong><br/>
            User Role: {user?.role}<br/>
            Factory: New Plant<br/>
            Department: Operations<br/>
            Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
            User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
            Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
          </div>
        )}
        <h2>Operations - New Plant</h2>
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
      </div>
    </div>
  );
};

export default NPOperations;
