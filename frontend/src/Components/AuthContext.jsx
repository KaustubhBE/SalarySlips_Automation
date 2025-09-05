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

  // Enhanced permission checking function using permission_metadata
  const hasPermission = useCallback((permission, factory = null, department = null) => {
    if (!user) return false;
    
    // Admin or wildcard has access to everything
    if (isAdminUser()) return true;
    
    // Use permission_metadata for RBAC
    const permissionMetadata = user.permission_metadata || {};
    const services = permissionMetadata.services || {};
    
    // If factory and department are specified, check specific access
    if (factory && department) {
      const normalizedFactory = normalizeDepartmentKey(factory);
      const normalizedDept = normalizeDepartmentKey(department);
      const serviceKey = `${normalizedFactory}.${normalizedDept}`;
      const allowedServices = services[serviceKey] || [];
      const normalizedPermission = normalizeDepartmentKey(permission);
      
      const hasAccess = allowedServices.some(s => normalizeDepartmentKey(s) === normalizedPermission);
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('hasPermission - Checking specific permission:', {
          permission,
          factory,
          department,
          serviceKey,
          allowedServices,
          hasAccess,
          permissionMetadata
        });
      }
      
      return hasAccess;
    }
    
    // Check if user has access to this permission in any factory/department
    const normalizedPermission = normalizeDepartmentKey(permission);
    for (const serviceKey in services) {
      const allowedServices = services[serviceKey] || [];
      if (allowedServices.some(s => normalizeDepartmentKey(s) === normalizedPermission)) {
        return true;
      }
    }
    
    return false;
  }, [user, isAdminUser, normalizeDepartmentKey]);

  // Check if user can access a department using permission_metadata
  const canAccessDepartment = useCallback((department) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use permission_metadata for RBAC if available
    const permissionMetadata = user.permission_metadata || {};
    const departments = permissionMetadata.departments || {};
    
    // Check if user has access to this department in any factory
    const normalizedDept = normalizeDepartmentKey(department);
    for (const factory in departments) {
      const factoryDepartments = departments[factory] || [];
      if (factoryDepartments.some(dept => normalizeDepartmentKey(dept) === normalizedDept)) {
        return true;
      }
    }
    
    // Fallback to old logic if permission_metadata is not available
    const departmentPermissions = {
      'store': ['inventory', 'reports'],
      'humanresource': ['single_processing', 'batch_processing', 'reports'],
      'accounts': ['expense_management', 'reports'],
      'marketing': ['marketing_campaigns', 'reports'],
      'reports_department': ['reports', 'reactor_reports'],
      'operations_department': ['inventory', 'reports', 'reactor_reports']
    };
    
    const deptPermissions = departmentPermissions[normalizedDept] || [];
    return deptPermissions.some(permission => hasPermission(permission));
  }, [user, hasPermission, isAdminUser, normalizeDepartmentKey]);

  // Check if user can access any services in a specific factory using permission_metadata
  const canAccessFactory = useCallback((factory) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use permission_metadata for RBAC if available
    const permissionMetadata = user.permission_metadata || {};
    const factories = permissionMetadata.factories || [];
    
    // Check if user has access to this factory
    const normalizedFactory = normalizeDepartmentKey(factory);
    const hasFactoryAccess = factories.some(f => normalizeDepartmentKey(f) === normalizedFactory);
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('canAccessFactory - Checking factory access:', {
        factory,
        normalizedFactory,
        userRole: user.role,
        factories,
        hasFactoryAccess,
        permissionMetadata
      });
    }
    
    return hasFactoryAccess;
  }, [user, isAdminUser, normalizeDepartmentKey]);

  // Check if user can access any services in a specific department within a factory using permission_metadata
  const canAccessFactoryDepartment = useCallback((factory, department) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use permission_metadata for RBAC if available
    const permissionMetadata = user.permission_metadata || {};
    const departments = permissionMetadata.departments || {};
    
    const normalizedFactory = normalizeDepartmentKey(factory);
    const normalizedDept = normalizeDepartmentKey(department);
    
    // Check if user has access to this department in this specific factory
    const factoryDepartments = departments[normalizedFactory] || [];
    const hasAccess = factoryDepartments.some(dept => normalizeDepartmentKey(dept) === normalizedDept);
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('canAccessFactoryDepartment - Checking factory department access:', {
        factory,
        department,
        normalizedFactory,
        normalizedDept,
        factoryDepartments,
        hasAccess,
        permissionMetadata
      });
    }
    
    return hasAccess;
  }, [user, isAdminUser, normalizeDepartmentKey]);

  // Check if user can access a service using permission_metadata
  const canAccessService = useCallback((service, factory = null, department = null) => {
    if (!user) return false;
    
    // Admin can access everything
    if (isAdminUser()) return true;
    
    // Use permission_metadata for RBAC if available
    const permissionMetadata = user.permission_metadata || {};
    const services = permissionMetadata.services || {};
    
    // If factory and department are specified, check specific access
    if (factory && department) {
      const normalizedFactory = normalizeDepartmentKey(factory);
      const normalizedDept = normalizeDepartmentKey(department);
      const serviceKey = `${normalizedFactory}.${normalizedDept}`;
      const allowedServices = services[serviceKey] || [];
      const normalizedService = normalizeDepartmentKey(service);
      
      const hasAccess = allowedServices.some(s => normalizeDepartmentKey(s) === normalizedService);
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('canAccessService - Checking specific service access:', {
          service,
          factory,
          department,
          serviceKey,
          allowedServices,
          hasAccess,
          permissionMetadata
        });
      }
      
      return hasAccess;
    }
    
    // Check if user has access to this service in any factory/department
    const normalizedService = normalizeDepartmentKey(service);
    for (const serviceKey in services) {
      const allowedServices = services[serviceKey] || [];
      if (allowedServices.some(s => normalizeDepartmentKey(s) === normalizedService)) {
        return true;
      }
    }
    
    return false;
  }, [user, hasPermission, isAdminUser, normalizeDepartmentKey]);

  // Get all factories user can access
  const getUserFactories = useCallback(() => {
    if (!user) return [];
    
    // Admin can access everything
    if (isAdminUser()) return ['gulbarga', 'kerur'];
    
    const permissionMetadata = user.permission_metadata || {};
    return permissionMetadata.factories || [];
  }, [user, isAdminUser]);

  // Get all departments user can access in a specific factory
  const getUserDepartments = useCallback((factory) => {
    if (!user) return [];
    
    // Admin can access everything
    if (isAdminUser()) {
      return ['humanresource', 'store', 'marketing', 'accounts', 'reports_department', 'operations_department'];
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
      return ['single_processing', 'batch_processing', 'inventory', 'reports', 'expense_management', 'marketing_campaigns', 'reactor_reports'];
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
    canAccessFactoryDepartment,
    getUserFactories,
    getUserDepartments,
    getUserServices
  }), [user, isAuthenticated, login, logout, hasPermission, canAccessDepartment, canAccessService, canAccessFactory, canAccessFactoryDepartment, getUserFactories, getUserDepartments, getUserServices]);

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