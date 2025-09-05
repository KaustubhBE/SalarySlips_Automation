import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import Processing from './Processing';
import Reports from './Reports';
import ReactorReports from './ReactorReports';
import Inventory from './Inventory';
import { DEPARTMENTS_CONFIG } from './config';
import './App.css';

const Department = () => {
  const navigate = useNavigate();
  const { factoryKey, departmentKey } = useParams();
  const { user, canAccessService } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);
  
  // Get accessible services based on user permissions
  const getAccessibleServices = () => {
    if (!user || !departmentKey) return [];
    
    console.log('Department.jsx - getAccessibleServices called:', {
      departmentKey,
      userRole: user.role,
      userPermissions: user.permissions
    });
    
    // Admin has access to everything
    if (isAdmin) {
      const department = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === departmentKey);
      if (!department) return [];
      
      const services = [];
      if (department.services) {
        Object.values(department.services).forEach(service => {
          if (service.subServices) {
            // Handle sub-services (like single_processing, batch_processing)
            Object.values(service.subServices).forEach(subService => {
              services.push({
                key: subService.key,
                name: subService.name,
                description: subService.description,
                route: `/${subService.key}`
              });
            });
          } else if (service.permission) {
            // Handle direct services
            services.push({
              key: service.key,
              name: service.name,
              description: service.description,
              route: `/${service.key}`
            });
          }
        });
      }
      return services;
    }
    
    // For regular users, check which services they can access
    const department = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === departmentKey);
    if (!department) return [];
    
    const services = [];
    if (department.services) {
      Object.values(department.services).forEach(service => {
        if (service.subServices) {
          // Handle sub-services (like single_processing, batch_processing)
          Object.values(service.subServices).forEach(subService => {
            if (canAccessService(subService.permission, factoryKey, departmentKey)) {
              services.push({
                key: subService.key,
                name: subService.name,
                description: subService.description,
                route: `/${subService.key}`
              });
            }
          });
        } else if (service.permission && canAccessService(service.permission, factoryKey, departmentKey)) {
          // Handle direct services
          services.push({
            key: service.key,
            name: service.name,
            description: service.description,
            route: `/${service.key}`
          });
        }
      });
    }
    
    console.log('Department.jsx - Final accessible services:', services.map(s => ({
      key: s.key,
      name: s.name,
      route: s.route,
      fullRoute: `/department/${departmentKey}${s.route}`
    })));
    return services;
  };

  const accessibleServices = getAccessibleServices();
  const selectedDepartment = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === departmentKey);

  // Helper function to check if user has permission for a specific service
  const hasUserPermission = (serviceKey) => {
    if (!user || !departmentKey || !factoryKey) return false;
    
    // Admin has access to everything
    if (isAdmin) return true;
    
    // Check if user has the specific service permission in this factory and department
    return canAccessService(serviceKey, factoryKey, departmentKey);
  };

  // Check if user is authenticated
  const isAuthenticated = !!user;

  // Handle service navigation
  const handleServiceNavigation = (service) => {
    if (service.route) {
      // Use the correct route format that matches App.jsx routing
      const fullRoute = `/${factoryKey}/${departmentKey}${service.route}`;
      console.log(fullRoute);
      console.log('Department.jsx - Navigating to service:', {
        service: service.key,
        serviceRoute: service.route,
        fullRoute: fullRoute,
        factoryKey: factoryKey,
        departmentKey: departmentKey
      });
      navigate(fullRoute);
    }
  };

  // Handle back to factory navigation
  const handleBackToFactory = () => {
    navigate(`/${factoryKey}`);
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
              <Route path="single-processing/*" element={
          isAuthenticated && hasUserPermission('single_processing') ? 
            <Processing mode="single" /> : 
            <Navigate to={`/${factoryKey}`} replace />
        } />

        <Route path="batch-processing/*" element={
          isAuthenticated && hasUserPermission('batch_processing') ? 
            <Processing mode="batch" /> : 
            <Navigate to={`/${factoryKey}`} replace />
        } />

        <Route path="inventory/*" element={
          isAuthenticated && hasUserPermission('inventory') ? 
            <Inventory /> : 
            <Navigate to={`/${factoryKey}`} replace />
        }/>

        <Route path="reports" element={
          isAuthenticated && hasUserPermission('reports') ? 
            <Reports /> : 
            <Navigate to={`/${factoryKey}`} replace />
        } />

        <Route path="reactor-reports" element={
          isAuthenticated && hasUserPermission('reactor_reports') ? 
            <ReactorReports /> : 
            <Navigate to={`/${factoryKey}`} replace />
        } />
      
      {/* Default Department View */}
      <Route path="" element={
        <div className="splash-page">
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
              <strong>Debug Info:</strong><br/>
              User Role: {user?.role}<br/>
              Factory: {factoryKey}<br/>
              Department: {departmentKey}<br/>
              Accessible Services: {JSON.stringify(accessibleServices.map(s => s.key))}<br/>
              User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
              Has Permission Metadata: {user?.permission_metadata && Object.keys(user.permission_metadata).length > 0 ? 'Yes' : 'No'}
            </div>
          )}
          <h2>{selectedDepartment?.name || departmentKey}</h2>
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

export default Department;
