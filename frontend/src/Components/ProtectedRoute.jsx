import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredPermission, user }) => {
  if (!user) {
    // Not logged in, redirect to login page
    return <Navigate to="/login" />;
  }

  // Admin or super-admin has access to everything
  if (user.role === 'admin' || user.role === 'super-admin') {
    return children;
  }

  // Check if user has the required permission
  if (!user.permissions?.[requiredPermission]) {
    // No permission, redirect to home page
    return <Navigate to="/unauthorized" />;
  }

  // Has permission, render the component
  return children;
}

export default ProtectedRoute;