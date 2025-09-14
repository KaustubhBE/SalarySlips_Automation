import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import SheetsMaterialList from './HO_Services/Sheets-MaterialList';
import { DEPARTMENTS_CONFIG } from '../config';
import '../App.css';

const HOStore = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for HO Store department (only existing services)
  const hoStoreServices = [
    { key: 'ho_sheets-material', name: 'Sheets Material List', route: '/ho_store/ho_sheets-material' },
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    console.log('HOStore.jsx - getAccessibleServices called:', {
      userRole: user.role,
      userPermissions: user.permissions
    });
    
    // Admin has access to everything
    if (isAdmin) {
      return hoStoreServices;
    }
    
    // For regular users, check which services they can access
    return hoStoreServices.filter(service => 
      canAccessService(service.key, 'headoffice', 'store')
    );
  };

  const accessibleServices = getAccessibleServices();

  // Helper function to check if user has permission for a specific service
  const hasUserPermission = (serviceKey) => {
    if (!user) return false;
    
    if (isAdmin) return true;
    
    return canAccessService(serviceKey, 'headoffice', 'store');
  };

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    console.log('Navigating to service:', service);
    navigate(service.route);
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate('/headoffice');
  };

  // If user has no accessible services, show message
  if (accessibleServices.length === 0) {
    return (
      <div className="splash-page">
        <h2>Store - Head Office</h2>
        <p>You don't have access to any services in this department.</p>
        <button onClick={handleBackToFactory} className="nav-link back-button">
          ← Back to Factory
        </button>
      </div>
    );
  }

  return (
    <Routes>
      {/* HO Sheets Material List Service Route */}
      <Route path="ho_sheets-material" element={<SheetsMaterialList />} />
      
      {/* Default Department View */}
      <Route path="" element={
        <div className="splash-page">
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
              <strong>Debug Info:</strong><br/>
              User Role: {user?.role}<br/>
              Factory: Head Office<br/>
              Department: Store<br/>
              Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
              User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
              Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
            </div>
          )}
          <h2>Store - Head Office</h2>
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

export default HOStore;
