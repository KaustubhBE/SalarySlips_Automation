import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import FT_PurchaseIndent from './FT_Services/FT_PurchaseIndent';
import FT_MaterialInward from './FT_Services/FT_MaterialInward';
import FT_MaterialOutward from './FT_Services/FT_MaterialOutward';
// DEPARTMENTS_CONFIG removed - using centralized FACTORY_RBAC_CONFIG instead
import '../App.css';
import BackButton from '../Components/BackButton';

const FTStore = () => {
  const navigate = useNavigate();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Static services for FT Store department (only existing services)
  const ftStoreServices = [
    { key: 'ft_purchase_indent', name: 'Purchase Indent', route: '/fertilizer/ft_store/ft_purchase_indent' },
    // { key: 'ft_material_inward', name: 'Material Inward', route: '/fertilizer/ft_store/ft_material_inward' },
    // { key: 'ft_material_outward', name: 'Material Outward', route: '/fertilizer/ft_store/ft_material_outward' },
  ];

  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user) return [];
    
    console.log('FTStore.jsx - getAccessibleServices called:', {
      userRole: user.role,
      userPermissions: user.permissions
    });
    
    // Admin has access to everything
    if (isAdmin) {
      return ftStoreServices;
    }
    
    // For regular users, check which services they can access
    return ftStoreServices.filter(service => 
      canAccessService(service.key, 'fertilizer', 'store')
    );
  };

  const accessibleServices = getAccessibleServices();

  // Helper function to check if user has permission for a specific service
  const hasUserPermission = (serviceKey) => {
    if (!user) return false;
    
    // Admin has access to everything
    if (isAdmin) return true;
    
    // Check if user has the specific service permission in this factory and department
    return canAccessService(serviceKey, 'fertilizer', 'store');
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    if (service.route) {
      // Use new navigation pattern for FT Store services
      console.log('FTStore.jsx - Navigating to service:', {
        service: service.key,
        serviceRoute: service.route
      });
      navigate(service.route);
    }
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate('/fertilizer');
  };

  if (!user) {
    return <div>Please log in to access department services.</div>;
  }

  if (accessibleServices.length === 0) {
    return (
      <div>
        {/* Back to Factory Button - Top Left (on brown box) */}
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
      {/* FT Purchase Indent Service Route */}
      <Route path="ft_purchase_indent" element={<FT_PurchaseIndent />} />
      
      {/* FT Material Inward Service Route */}
      <Route path="ft_material_inward" element={<FT_MaterialInward />} />
      
      {/* FT Material Outward Service Route */}
      <Route path="ft_material_outward" element={<FT_MaterialOutward />} />
      
      {/* Default Department View */}
      <Route path="" element={
        <div>
          {/* Back to Factory Button - Top Left (on brown box) */}
          <BackButton 
            label="Back to Factory" 
            onClick={handleBackToFactory}
          />
          
          <div className="splash-page">
            {process.env.NODE_ENV === 'development' && (
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                <strong>Debug Info:</strong><br/>
                User Role: {user?.role}<br/>
                Factory: Fertilizer<br/>
                Department: Store<br/>
                Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
                User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
                Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
              </div>
            )}
            <h2>Store - Fertilizer</h2>
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

export default FTStore;

