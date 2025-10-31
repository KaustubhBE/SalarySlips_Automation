import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import Processing from './GB_Services/GB_Processing';
import Reports from '../Reports';
import ReactorReports from '../ReactorReports';
import Inventory from '../Inventory';
// DEPARTMENTS_CONFIG removed - using centralized FACTORY_RBAC_CONFIG instead
import '../App.css';
import BackButton from '../Components/BackButton';

const GBHumanResource = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for GB Human Resource department (only existing services)
  const gbHRServices = [
    { key: 'gb_single_processing', name: 'Single Processing', route: '/gulbarga/gb_humanresource/gb_single_processing' },
    { key: 'gb_batch_processing', name: 'Batch Processing', route: '/gulbarga/gb_humanresource/gb_batch_processing' }
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    console.log('GBHumanResource.jsx - getAccessibleServices called:', {
      userRole: user.role,
      userPermissions: user.permissions
    });
    
    // Admin has access to everything
    if (isAdmin) {
      return gbHRServices;
    }
    
    // For regular users, check which services they can access
    return gbHRServices.filter(service => 
      canAccessService(service.key, 'gulbarga', 'humanresource')
    );
  };

  const accessibleServices = getAccessibleServices();

  // Helper function to check if user has permission for a specific service
  const hasUserPermission = (serviceKey) => {
    if (!user) return false;
    
    // Admin has access to everything
    if (isAdmin) return true;
    
    // Check if user has the specific service permission in this factory and department
    return canAccessService(serviceKey, 'gulbarga', 'humanresource');
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    if (service.route) {
      // Use new navigation pattern for GB HR services
      console.log('GBHumanResource.jsx - Navigating to service:', {
        service: service.key,
        serviceRoute: service.route
      });
      navigate(service.route);
    }
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate('/gulbarga');
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
    <Routes>
      <Route path="gb_single_processing/*" element={
        isAuthenticated && hasUserPermission('gb_single_processing') ? 
          <Processing mode="single" /> : 
          <Navigate to="/gulbarga" replace />
      } />

      <Route path="gb_batch_processing/*" element={
        isAuthenticated && hasUserPermission('gb_batch_processing') ? 
          <Processing mode="batch" /> : 
          <Navigate to="/gulbarga" replace />
      } />
      
      {/* Default Department View */}
      <Route path="" element={
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
                Factory: Gulbarga<br/>
                Department: Human Resource<br/>
                Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
                User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
                Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
              </div>
            )}
            <h2>Human Resource - Gulbarga</h2>
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
      } />
    </Routes>
  );
};

export default GBHumanResource;