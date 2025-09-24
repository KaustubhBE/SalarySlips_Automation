import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, requiredPermission, requiredFactory, requiredDepartment }) => {
  const { user, hasPermission, canAccessDepartment, canAccessFactory } = useAuth();
  
  if (!user) {
    // Not logged in, redirect to login page
    return <Navigate to="/login" />;
  }

  // Admin has access to everything
  if (user.role === 'admin') {
    return children;
  }

  // Check factory access if required
  if (requiredFactory && !canAccessFactory(requiredFactory)) {
    return <Navigate to="/unauthorized" />;
  }

  // Check department access if required
  if (requiredDepartment && !canAccessDepartment(requiredDepartment, requiredFactory)) {
    return <Navigate to="/unauthorized" />;
  }

  // Check specific permission if required
  if (requiredPermission && !hasPermission(requiredPermission, requiredFactory, requiredDepartment)) {
    return <Navigate to="/unauthorized" />;
  }

  // Has permission, render the component
  return children;
}

export default ProtectedRoute;