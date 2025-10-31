import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import storage from '../utils/storage';
import { getApiUrl, ENDPOINTS, RBAC_HELPERS } from '../config';

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

  // Enhanced permission checking function using centralized RBAC
  const hasPermission = useCallback((permission, factory = null, department = null) => {
    if (!user) return false;
    
    // Admin or wildcard has access to everything
    if (isAdminUser()) return true;
    
    // Use centralized RBAC helper
    return RBAC_HELPERS.canAccessFactoryDepartmentService(user, factory, department, permission);
  }, [user, isAdminUser]);

  // Check if user can access a department using centralized RBAC
  const canAccessDepartment = useCallback((department, factory = null) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use centralized RBAC helper
    return RBAC_HELPERS.canAccessDepartment(user, factory, department);
  }, [user, isAdminUser]);

  // Check if user can access any services in a specific factory using centralized RBAC
  const canAccessFactory = useCallback((factory) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use centralized RBAC helper
    return RBAC_HELPERS.canAccessFactory(user, factory);
  }, [user, isAdminUser]);

  // Check if user can access any services in a specific department within a factory using centralized RBAC
  const canAccessFactoryDepartment = useCallback((factory, department) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use centralized RBAC helper
    return RBAC_HELPERS.canAccessFactoryDepartment(user, factory, department);
  }, [user, isAdminUser]);

  // Check if user can access a service using centralized RBAC
  const canAccessService = useCallback((service, factory = null, department = null) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use centralized RBAC helper
    return RBAC_HELPERS.canAccessFactoryDepartmentService(user, factory, department, service);
  }, [user, isAdminUser]);

  // Get all factories user can access
  const getUserFactories = useCallback(() => {
    if (!user) return [];
    
    // Admin can access everything
    if (isAdminUser()) return RBAC_HELPERS.getAllFactories();
    
    const permissionMetadata = user.permission_metadata || {};
    return permissionMetadata.factories || [];
  }, [user, isAdminUser]);

  // Get all departments user can access in a specific factory
  const getUserDepartments = useCallback((factory) => {
    if (!user) return [];
    
    // Admin can access everything
    if (isAdminUser()) {
      return RBAC_HELPERS.getFactoryDepartments(factory);
    }
    
    const permissionMetadata = user.permission_metadata || {};
    const departments = permissionMetadata.departments || {};
    const normalizedFactory = normalizeDepartmentKey(factory);
    
    return departments[normalizedFactory] || [];
  }, [user, isAdminUser, normalizeDepartmentKey]);

  // Get all services user can access in a specific factory.department
  const getUserServices = useCallback((factory, department) => {
    if (!user) return [];
    
    // Admin can access everything
    if (isAdminUser()) {
      return RBAC_HELPERS.getFactoryDepartmentServices(factory, department);
    }
    
    const permissionMetadata = user.permission_metadata || {};
    const services = permissionMetadata.services || {};
    const normalizedFactory = normalizeDepartmentKey(factory);
    const normalizedDept = normalizeDepartmentKey(department);
    const serviceKey = `${normalizedFactory}.${normalizedDept}`;
    
    return services[serviceKey] || [];
  }, [user, isAdminUser, normalizeDepartmentKey]);

  const login = useCallback(async (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    storage.setJSON('user', userData);
    storage.set('isAuthenticated', 'true');
  }, []);

  // Google OAuth login function
  const loginWithGoogle = useCallback(async (credential) => {
    try {
      const apiUrl = getApiUrl(ENDPOINTS.GOOGLE_AUTH);
      const payload = { credential };
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Google authentication failed');
      }

      const data = await response.json();
      
      if (data?.success && data?.user) {
        const userData = data.user;
        console.log('Google login successful - User data received:', userData);
        await login(userData);
        return { success: true, user: userData };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  }, [login]);

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

  const contextValue = React.useMemo(() => {
    // Ensure all functions are defined, providing safe defaults if they're not
    return {
      user,
      isAuthenticated,
      login: login || (() => {}),
      loginWithGoogle: loginWithGoogle || (() => {}),
      logout: logout || (() => {}),
      hasPermission: hasPermission || (() => false),
      canAccessDepartment: canAccessDepartment || (() => false),
      canAccessService: canAccessService || (() => false),
      canAccessFactory: canAccessFactory || (() => false),
      canAccessFactoryDepartment: canAccessFactoryDepartment || (() => false),
      getUserFactories: getUserFactories || (() => []),
      getUserDepartments: getUserDepartments || (() => []),
      getUserServices: getUserServices || (() => [])
    };
  }, [user, isAuthenticated, login, loginWithGoogle, logout, hasPermission, canAccessDepartment, canAccessService, canAccessFactory, canAccessFactoryDepartment, getUserFactories, getUserDepartments, getUserServices]);

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