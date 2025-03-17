import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Check localStorage for existing user data
        const storedUser = localStorage.getItem('user');
        const storedAuthStatus = localStorage.getItem('isAuthenticated');

        if (storedUser && storedAuthStatus === 'true' && !user) {
          // If there's stored user data but no user in context, restore it
          login(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        // Clear potentially corrupted data
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthentication();
  }, [login, user]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Render the protected content
  return children;
};

export default ProtectedRoute;