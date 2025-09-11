import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import Processing from './OM_Services/OM_Processing';
import Reports from '../Reports';
import ReactorReports from '../ReactorReports';
import Inventory from '../Inventory';
import { DEPARTMENTS_CONFIG } from '../config';
import '../App.css';

const OMHumanResource = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for OM Human Resource department (only existing services)
  const omHRServices = [
    { key: 'om_single-processing', name: 'Single Processing', route: '/omkar/humanresource/om_single-processing' },
    { key: 'om_batch-processing', name: 'Batch Processing', route: '/omkar/humanresource/om_batch-processing' }
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    console.log('OMHumanResource.jsx - getAccessibleServices called:', {
      userRole: user.role,
      userPermissions: user.permissions
    });
    
    // Admin has access to everything
    if (isAdmin) {
      return omHRServices;
    }
    
    // For regular users, check which services they can access
    return omHRServices.filter(service => {
      // Extract the base service key (remove factory prefix)
      const baseServiceKey = service.key.replace('om_', '');
      return canAccessService(baseServiceKey, 'omkar', 'humanresource');
    });
  };

  const accessibleServices = getAccessibleServices();

  // Helper function to check if user has permission for a specific service
  const hasUserPermission = (serviceKey) => {
    if (!user) return false;
    
    // Admin has access to everything
    if (isAdmin) return true;
    
    // Extract the base service key (remove factory prefix)
    const baseServiceKey = serviceKey.replace('om_', '');
    
    // Check if user has the specific service permission in this factory and department
    return canAccessService(baseServiceKey, 'omkar', 'humanresource');
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    if (service.route) {
      // Use new navigation pattern for OM HR services
      console.log('OMHumanResource.jsx - Navigating to service:', {
        service: service.key,
        serviceRoute: service.route
      });
      navigate(service.route);
    }
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate('/omkar');
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
    <Routes>
      <Route path="om_single-processing/*" element={
        isAuthenticated && hasUserPermission('om_single-processing') ? 
          <Processing mode="single" /> : 
          <Navigate to="/omkar" replace />
      } />

      <Route path="om_batch-processing/*" element={
        isAuthenticated && hasUserPermission('om_batch-processing') ? 
          <Processing mode="batch" /> : 
          <Navigate to="/omkar" replace />
      } />
      
      {/* Default Department View */}
      <Route path="" element={
        <div className="splash-page">
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
              <strong>Debug Info:</strong><br/>
              User Role: {user?.role}<br/>
              Factory: Omkar<br/>
              Department: Human Resource<br/>
              Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
              User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
              Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
            </div>
          )}
          <h2>Human Resource - Omkar</h2>
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
      } />
    </Routes>
  );
};

export default OMHumanResource;