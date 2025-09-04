import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import storage from '../utils/storage';
import { getApiUrl, ENDPOINTS } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper to determine if current user should be treated as admin
  const isAdminUser = useCallback(() => {
    if (!user) return false;
    const normalizedRole = (user.role || '').toString().trim().toLowerCase();
    const hasWildcardPermission = !!(user.permissions && user.permissions['*'] === true);
    return normalizedRole === 'admin' || hasWildcardPermission;
  }, [user]);

  // Normalize department keys to a consistent format
  const normalizeDepartmentKey = useCallback((deptKey) => {
    if (!deptKey) return '';
    return deptKey.toString().trim().toLowerCase().replace(/-/g, '_');
  }, []);

  // Simple permission checking function
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    
    // Admin or wildcard has access to everything
    if (isAdminUser()) return true;
    if (user.permissions && user.permissions['*'] === true) return true;
    
    // Check if user has the specific permission
    const hasPermissionResult = user.permissions && user.permissions[permission] === true;
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('hasPermission - Checking permission:', {
        permission,
        userRole: user.role,
        userPermissions: user.permissions,
        hasPermissionResult
      });
    }
    
    return hasPermissionResult;
  }, [user, isAdminUser]);

  // Check if user can access a department
  const canAccessDepartment = useCallback((department) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Check if user has any permission for this department
    const departmentPermissions = {
      'store': ['inventory', 'reports'],
      'humanresource': ['single_processing', 'batch_processing', 'reports'],
      'accounts': ['expense_management', 'reports'],
      'marketing': ['marketing_campaigns', 'reports'],
      'reports_department': ['reports', 'reactor_reports'],
      'operations_department': ['inventory', 'reports', 'reactor_reports']
    };
    
    const normalizedDept = normalizeDepartmentKey(department);
    const deptPermissions = departmentPermissions[normalizedDept] || [];
    return deptPermissions.some(permission => hasPermission(permission));
  }, [user, hasPermission, isAdminUser, normalizeDepartmentKey]);

  // Check if user can access any services in a specific factory
  const canAccessFactory = useCallback((factory) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Check if user has any permissions at all
    const userPermissions = user.permissions || {};
    const hasAnyPermissions = Object.keys(userPermissions).length > 0;
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('canAccessFactory - Checking factory access:', {
        factory,
        userRole: user.role,
        userPermissions,
        hasAnyPermissions
      });
    }
    
    return hasAnyPermissions;
  }, [user, isAdminUser]);

  // Check if user can access any services in a specific department within a factory
  const canAccessFactoryDepartment = useCallback((factory, department) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Check if user has any permission for this department
    return canAccessDepartment(department);
  }, [user, canAccessDepartment, isAdminUser]);

  // Check if user can access a service
  const canAccessService = useCallback((service) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Check if user has the specific service permission
    return hasPermission(service);
  }, [user, hasPermission, isAdminUser]);

  const login = useCallback(async (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    storage.setJSON('user', userData);
    storage.set('isAuthenticated', 'true');
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call backend logout endpoint
      await fetch(getApiUrl(ENDPOINTS.LOGOUT), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Continue with frontend logout even if backend fails
    } finally {
      // Clear frontend state and storage
      storage.remove('user');
      storage.remove('isAuthenticated');

      setUser(null);
      setIsAuthenticated(false);
      
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const userData = storage.getJSON('user');
        const isAuth = storage.get('isAuthenticated') === 'true';

        
        if (userData && isAuth) {
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [logout]);

  const contextValue = React.useMemo(() => ({
    user,
    isAuthenticated,
    login,
    logout,
    hasPermission,
    canAccessDepartment,
    canAccessService,
    canAccessFactory,
    canAccessFactoryDepartment
  }), [user, isAuthenticated, login, logout, hasPermission, canAccessDepartment, canAccessService, canAccessFactory, canAccessFactoryDepartment]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};