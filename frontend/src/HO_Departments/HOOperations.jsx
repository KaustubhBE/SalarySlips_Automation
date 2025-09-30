import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
// DEPARTMENTS_CONFIG removed - using centralized FACTORY_RBAC_CONFIG instead
import '../App.css';

const HOOperations = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for HO Operations department (only existing services)
  const hoOperationsServices = [
    { key: 'ho_general_reports', name: 'General Reports', route: '/headoffice/ho_operations/ho_general_reports' },
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    console.log('HO_Operations.jsx - getAccessibleServices called:', {
      userRole: user.role,
      userPermissions: user.permissions
    });
    
    // Admin has access to everything
    if (isAdmin) {
      return hoOperationsServices;
    }
    
    // For regular users, check which services they can access
    return hoOperationsServices.filter(service => 
      canAccessService(service.key, 'headoffice', 'operations')
    );
  };

  const accessibleServices = getAccessibleServices();

  // Helper function to check if user has permission for a specific service
  const hasUserPermission = (serviceKey) => {
    if (!user) return false;
    
    // Admin has access to everything
    if (isAdmin) return true;
    
    // Check if user has the specific service permission in this factory and department
    return canAccessService(serviceKey, 'headoffice', 'operations');
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    if (service.route) {
      // Use new navigation pattern for HO Operations services
      console.log('HO_Operations.jsx - Navigating to service:', {
        service: service.key,
        serviceRoute: service.route
      });
      navigate(service.route);
    }
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate('/headoffice');
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
      {/* Default Department View */}
      <Route path="" element={
        <div className="splash-page">
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
              <strong>Debug Info:</strong><br/>
              User Role: {user?.role}<br/>
              Factory: Head Office<br/>
              Department: Operations<br/>
              Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
              User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
              Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
            </div>
          )}
          <h2>Operations - Head Office</h2>
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

export default HOOperations;
