import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Correct the import path

const ProtectedRoute = ({ element: Component, ...rest }) => {
  const { user } = useAuth();

  if (!user) {
    // If the user is not authenticated, redirect to the login page
    return <Navigate to="/" />;
  }

  if (user.role !== 'admin') {
    // If the user is not an admin, redirect to a "not authorized" page or home page
    return <Navigate to="/" />;
  }

  // If the user is authenticated and an admin, render the component
  return <Component {...rest} />;
};

export default ProtectedRoute;