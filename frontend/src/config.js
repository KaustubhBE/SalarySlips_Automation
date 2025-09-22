// config.js

import axios from 'axios';

// Detect if running in development
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Default backend URL
const DEFAULT_BACKEND_URL = 'https://uatbackendadmin.bajajearths.com';

const DEFAULT_WHATSAPP_URL = 'https://uatwhatsapp.bajajearths.com';

// Determine the base API URL
const getApiBaseUrl = () => {
    if (typeof window !== 'undefined') {
        const localBackendUrl = localStorage.getItem('localBackendUrl');
        if (localBackendUrl && isDevelopment) {
            return `${localBackendUrl}/api`;
        }
    }
    return `${DEFAULT_BACKEND_URL}/api`;
};

// Set local backend URL if not already set
if (typeof window !== 'undefined' && !localStorage.getItem('localBackendUrl')) {
    localStorage.setItem('localBackendUrl', DEFAULT_BACKEND_URL);
}

// Configure axios globally
axios.defaults.baseURL = getApiBaseUrl();
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.timeout = 2 * 24 * 60 * 60 * 1000; // 2 days timeout

// Feature flags (optional)
export const FEATURES = {
    ENABLE_WHATSAPP: import.meta.env.VITE_ENABLE_WHATSAPP === 'true',
    ENABLE_EMAIL: import.meta.env.VITE_ENABLE_EMAIL === 'true',
    ENABLE_ERROR_REPORTING: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true'
};

// Logging config
export const LOG_CONFIG = {
    LEVEL: import.meta.env.VITE_LOG_LEVEL || 'info'
};

// API config for `fetch`
export const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    credentials: 'include',
    mode: 'cors'
};

// Get full API URL for an endpoint
export const getApiUrl = (endpoint) => {
    return `${getApiBaseUrl()}/${endpoint}`;
};

// Set backend URL dynamically
export const setLocalBackendUrl = (url) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('localBackendUrl', url);
    }
};

// Get current backend URL
export const getCurrentBackendUrl = () => {
    return getApiBaseUrl();
};

// Department and Services Configuration
export const DEPARTMENTS_CONFIG = {
  STORE: {
    key: 'store',
    name: 'Store',
    description: 'Store Department - Inventory Management',
    route: '/store',
    services: {
      INVENTORY: {
        key: 'inventory',
        name: 'Inventory',
        description: 'Manage inventory operations',
        permission: 'inventory'
      },
      REPORTS: {
        key: 'reports',
        name: 'Reports',
        description: 'Generate and manage reports',
        permission: 'reports'
      }
    }
  },
  MARKETING: {
    key: 'marketing',
    name: 'Marketing',
    description: 'Marketing Department - Marketing Campaigns and Analysis',
    route: '/marketing',
    services: {
      MARKETING_CAMPAIGNS: {
        key: 'marketing_campaigns',
        name: 'Marketing Campaigns',
        description: 'Manage marketing campaigns',
        permission: 'marketing_campaigns'
      }
    }
  },
  HUMANRESOURCE: {
    key: 'humanresource',
    name: 'Human Resource',
    description: 'Human Resource Department - Salary Processing and Employee Management',
    route: '/humanresource',
    services: {
      SALARY_PROCESSING: {
        key: 'salary_processing',
        name: 'Salary Processing',
        description: 'Process salary slips',
        subServices: {
          SINGLE_PROCESSING: {
            key: 'single-processing',
            name: 'Single Processing',
            description: 'Process individual salary slips',
            permission: 'single_processing'
          },
          BATCH_PROCESSING: {
            key: 'batch-processing',
            name: 'Batch Processing',
            description: 'Process multiple salary slips at once',
            permission: 'batch_processing'
          }
        }
      },
      REPORTS: {
        key: 'reports',
        name: 'Reports',
        description: 'Generate and manage reports',
        permission: 'reports'
      }
    }
  },
  ACCOUNTS: {
    key: 'accounts',
    name: 'Accounts',
    description: 'Accounts Department - Financial Management',
    route: '/accounts',
    services: {
      REPORTS: {
        key: 'reports',
        name: 'Reports',
        description: 'Generate and manage reports',
        permission: 'reports'
      },
      EXPENSE_MANAGEMENT: {
        key: 'expense-management',
        name: 'Expense Management',
        description: 'Manage expenses',
        permission: 'expense_management'
      }
    }
  },
  REPORTS_DEPARTMENT: {
    key: 'reports-department',
    name: 'Reports Department',
    description: 'Reports Department - Generate and manage reports',
    route: '/reports-department',
    services: {
      REACTOR_REPORTS: {
        key: 'reactor-reports',
        name: 'Reactor Reports',
        description: 'Generate reactor reports',
        permission: 'reactor_reports'
      },
      GENERAL_REPORTS: {
        key: 'reports',
        name: 'General Reports',
        description: 'Generate general reports',
        permission: 'reports'
      }
    }
  },
  OPERATIONS: {
    key: 'operations_department',
    name: 'Operations Department',
    description: 'Operations Department - Manage Operations',
    route: '/operations_department',
    services: {
      INVENTORY: {
        key: 'inventory',
        name: 'Inventory',
        description: 'Manage inventory operations',
        permission: 'inventory'
      },
      REPORTS: {
        key: 'reports',
        name: 'Reports',
        description: 'Generate and manage reports',
        permission: 'reports'
      },
      REACTOR_REPORTS: {
        key: 'reactor-reports',
        name: 'Reactor Reports',
        description: 'Generate reactor reports',
        permission: 'reactor_reports'
      }
    }
  }
};

// ============================================================================
// SIMPLIFIED 2-LAYER RBAC STRUCTURE: admin and user
// ============================================================================

// Department keys
export const DEPARTMENTS = {
    ACCOUNTS: 'accounts',
    HUMANRESOURCE: 'humanresource',
    STORE: 'store',
    MARKETING: 'marketing',
    REPORTS_DEPARTMENT: 'reports_department',
    OPERATIONS: 'operations_department',
    ALL: 'all'
};

// Department display names
export const DEPARTMENT_NAMES = {
    [DEPARTMENTS.ACCOUNTS]: 'Accounts',
    [DEPARTMENTS.HUMANRESOURCE]: 'Human Resource',
    [DEPARTMENTS.STORE]: 'Store',
    [DEPARTMENTS.MARKETING]: 'Marketing',
    [DEPARTMENTS.REPORTS_DEPARTMENT]: 'Reports Department',
    [DEPARTMENTS.OPERATIONS]: 'Operations Department',
    [DEPARTMENTS.ALL]: 'All Departments'
};

// Factory names for navigation
export const FACTORY_NAMES = {
    'gulbarga': 'Gulbarga',
    'kerur': 'Kerur',
    'humnabad': 'Humnabad',
    'omkar': 'Omkar',
    'padmavati': 'Padmavati',
    'headoffice': 'Head Office'
};

// Service keys
export const SERVICES = {
    SALARY_PROCESSING: 'salary_processing',
    INVENTORY: 'inventory',
    REPORTS: 'reports',
    EXPENSE_MANAGEMENT: 'expense_management',
    MARKETING_CAMPAIGNS: 'marketing_campaigns',
    SINGLE_PROCESSING: 'single_processing',
    BATCH_PROCESSING: 'batch_processing',
    REACTOR_REPORTS: 'reactor_reports'
};

// Service display names
export const SERVICE_NAMES = {
    [SERVICES.SALARY_PROCESSING]: 'Salary Processing',
    [SERVICES.INVENTORY]: 'Inventory',
    [SERVICES.REPORTS]: 'Reports',
    [SERVICES.EXPENSE_MANAGEMENT]: 'Expense Management',
    [SERVICES.MARKETING_CAMPAIGNS]: 'Marketing Campaigns',
    [SERVICES.SINGLE_PROCESSING]: 'Single Processing',
    [SERVICES.BATCH_PROCESSING]: 'Batch Processing',
    [SERVICES.REACTOR_REPORTS]: 'Reactor Reports'
};

// ============================================================================
// ALL AVAILABLE PERMISSIONS
// ============================================================================

// Generate all possible permissions for the system
export const ALL_PERMISSIONS = {
    // General permissions
    GENERAL: {
        USER_MANAGEMENT: 'user_management',
        CAN_CREATE_ADMIN: 'can_create_admin',
        SETTINGS_ACCESS: 'settings_access',
        REPORTS: 'reports'
    },
    
    // Admin permission (wildcard)
    ADMIN: {
        ALL_ACCESS: '*'
    },
    
    // Department-specific permissions
    DEPARTMENTS: {
        ACCOUNTS: {
            EXPENSE_MANAGEMENT: 'expense_management',
            REPORTS: 'reports'
        },
        HUMANRESOURCE: {
            SINGLE_PROCESSING: 'single_processing',
            BATCH_PROCESSING: 'batch_processing',
            REPORTS: 'reports'
        },
        STORE: {
            INVENTORY: 'inventory',
            REPORTS: 'reports'
        },
        MARKETING: {
            MARKETING_CAMPAIGNS: 'marketing_campaigns',
            REPORTS: 'reports'
        },
        REPORTS_DEPARTMENT: {
            REPORTS: 'reports',
            REACTOR_REPORTS: 'reactor_reports'
        },
        OPERATIONS: {
            INVENTORY: 'inventory',
            REPORTS: 'reports',
            REACTOR_REPORTS: 'reactor_reports'
        }
    }
};

// ============================================================================
// PERMISSION DESCRIPTIONS
// ============================================================================

export const PERMISSION_DESCRIPTIONS = {
    // General permissions
    [ALL_PERMISSIONS.GENERAL.USER_MANAGEMENT]: 'Manage users and their permissions',
    [ALL_PERMISSIONS.GENERAL.CAN_CREATE_ADMIN]: 'Create new admin users',
    [ALL_PERMISSIONS.GENERAL.SETTINGS_ACCESS]: 'Access system settings and configuration',
    [ALL_PERMISSIONS.GENERAL.REPORTS]: 'Access to general reports',
    
    // Admin permission
    [ALL_PERMISSIONS.ADMIN.ALL_ACCESS]: 'Full access to all system features and data',
    
    // Department-specific permissions
    [ALL_PERMISSIONS.DEPARTMENTS.ACCOUNTS.EXPENSE_MANAGEMENT]: 'Access to expense management in Accounts department',
    [ALL_PERMISSIONS.DEPARTMENTS.ACCOUNTS.REPORTS]: 'Access to reports in Accounts department',
    [ALL_PERMISSIONS.DEPARTMENTS.HUMANRESOURCE.SINGLE_PROCESSING]: 'Access to single salary processing in HR department',
    [ALL_PERMISSIONS.DEPARTMENTS.HUMANRESOURCE.BATCH_PROCESSING]: 'Access to batch salary processing in HR department',
    [ALL_PERMISSIONS.DEPARTMENTS.HUMANRESOURCE.REPORTS]: 'Access to reports in HR department',
    [ALL_PERMISSIONS.DEPARTMENTS.STORE.INVENTORY]: 'Access to inventory management in Store department',
    [ALL_PERMISSIONS.DEPARTMENTS.STORE.REPORTS]: 'Access to reports in Store department',
    [ALL_PERMISSIONS.DEPARTMENTS.MARKETING.MARKETING_CAMPAIGNS]: 'Access to marketing campaigns in Marketing department',
    [ALL_PERMISSIONS.DEPARTMENTS.MARKETING.REPORTS]: 'Access to reports in Marketing department',
    [ALL_PERMISSIONS.DEPARTMENTS.REPORTS_DEPARTMENT.REPORTS]: 'Access to general reports in Reports department',
    [ALL_PERMISSIONS.DEPARTMENTS.REPORTS_DEPARTMENT.REACTOR_REPORTS]: 'Access to reactor reports in Reports department',
    [ALL_PERMISSIONS.DEPARTMENTS.OPERATIONS.INVENTORY]: 'Access to inventory management in Operations department',
    [ALL_PERMISSIONS.DEPARTMENTS.OPERATIONS.REPORTS]: 'Access to reports in Operations department',
    [ALL_PERMISSIONS.DEPARTMENTS.OPERATIONS.REACTOR_REPORTS]: 'Access to reactor reports in Operations department'
};

// ============================================================================
// DEFAULT PERMISSIONS BY ROLE
// ============================================================================

// Admin default permissions (full access)
export const ADMIN_DEFAULT_PERMISSIONS = {
    [ALL_PERMISSIONS.ADMIN.ALL_ACCESS]: true,
    [ALL_PERMISSIONS.GENERAL.USER_MANAGEMENT]: true,
    [ALL_PERMISSIONS.GENERAL.CAN_CREATE_ADMIN]: true,
    [ALL_PERMISSIONS.GENERAL.SETTINGS_ACCESS]: true,
    [ALL_PERMISSIONS.GENERAL.REPORTS]: true
};

// User default permissions (department-specific)
export const getUserDefaultPermissions = (departments) => {
    const permissions = {
        [ALL_PERMISSIONS.GENERAL.USER_MANAGEMENT]: false,
        [ALL_PERMISSIONS.GENERAL.CAN_CREATE_ADMIN]: false,
        [ALL_PERMISSIONS.GENERAL.SETTINGS_ACCESS]: false,
        [ALL_PERMISSIONS.GENERAL.REPORTS]: false
    };
    
    if (!departments || !Array.isArray(departments)) return permissions;
    
    // Add department-specific permissions
    departments.forEach(department => {
        if (department === DEPARTMENTS.ALL) return;

        const deptConfig = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === department);
        if (deptConfig && deptConfig.services) {
            Object.values(deptConfig.services).forEach(service => {
                if (service.permission) {
                    permissions[service.permission] = true;
                }
                
                // Handle subServices
                if (service.subServices) {
                    Object.values(service.subServices).forEach(subService => {
                        if (subService.permission) {
                            permissions[subService.permission] = true;
                        }
                    });
                }
            });
        }
    });
    
    return permissions;
};

// ============================================================================
// RBAC HELPER FUNCTIONS
// ============================================================================

// Basic permission checking
export const hasPermission = (userPermissions, permission) => {
    if (!userPermissions || !permission) return false;
    
    // Check for wildcard access
    if (userPermissions[ALL_PERMISSIONS.ADMIN.ALL_ACCESS]) return true;
    
    return userPermissions[permission] === true;
};

export const hasAnyPermission = (userPermissions, permissions) => {
    if (!userPermissions || !permissions) return false;
    return permissions.some(permission => hasPermission(userPermissions, permission));
};

export const hasAllPermissions = (userPermissions, permissions) => {
    if (!userPermissions || !permissions) return false;
    return permissions.every(permission => hasPermission(userPermissions, permission));
};

// Department access checking
export const canAccessDepartment = (userRole, userPermissions, department) => {
    // Admin can access everything
    if (userRole === 'admin') return true;
    
    // Regular users need specific permissions
    if (userRole === 'user') {
        if (department === DEPARTMENTS.ALL) return false;
        
        // Check if user has any permission for this department
        const deptConfig = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === department);
        if (deptConfig && deptConfig.services) {
            return Object.values(deptConfig.services).some(service => {
                if (service.permission) {
                    return hasPermission(userPermissions, service.permission);
                }
                
                // Check subServices
                if (service.subServices) {
                    return Object.values(service.subServices).some(subService => 
                        subService.permission && hasPermission(userPermissions, subService.permission)
                    );
                }
                
                return false;
            });
        }
    }
    
    return false;
};

// Service access checking
export const canAccessService = (userRole, userPermissions, department, service) => {
    // Admin can access everything
    if (userRole === 'admin') return true;
    
    // Regular users need specific permissions
    if (userRole === 'user') {
        const permission = service;
        return hasPermission(userPermissions, permission);
    }
    
    return false;
};

// User management permissions
export const canEditUser = (currentUserRole, currentUserPermissions, targetUserRole) => {
    // Admin can edit all users
    if (currentUserRole === 'admin') return true;
    
    // Regular users cannot edit other users
    return false;
};

export const canCreateUser = (currentUserRole, currentUserPermissions) => {
    // Admin can create all users
    if (currentUserRole === 'admin') return true;
    
    return false;
};

// Get accessible departments for user
export const getAccessibleDepartments = (userRole, userPermissions, userDepartments = []) => {
    if (userRole === 'admin') {
        return getAllDepartments();
    }
    
    if (userRole === 'user') {
        return userDepartments.filter(dept => 
            dept !== DEPARTMENTS.ALL && canAccessDepartment(userRole, userPermissions, dept)
        );
    }
    
    return [];
};

// Legacy compatibility functions (simplified for 2-layer RBAC)
export const canAccessFactoryDepartment = (userRole, userPermissions, factory, department) => {
    return canAccessDepartment(userRole, userPermissions, department);
};

export const canAccessFactoryService = (userRole, userPermissions, factory, service) => {
    // This is a simplified version for legacy compatibility
    if (userRole === 'admin') return true;
    
    // For users, check if they have the service permission
    if (userRole === 'user') {
        return hasPermission(userPermissions, service);
    }
    
    return false;
};

export const getAccessibleFactoryDepartments = (userRole, userPermissions, userDepartments = []) => {
    const combinations = [];
    const accessibleDepartments = getAccessibleDepartments(userRole, userPermissions, userDepartments);
    
    accessibleDepartments.forEach(department => {
        combinations.push({
            factory: 'all', // Simplified - no factory concept
            department,
            permissions: getUserDefaultPermissions([department])
        });
    });
    
    return combinations;
};

// Additional helper functions for legacy compatibility
export const getFactoryDepartmentPermissions = (factoryKey, departmentKey) => {
    // Simplified - return department permissions
    const department = ALL_PERMISSIONS.DEPARTMENTS[departmentKey.toUpperCase()];
    return department || {};
};

export const getAllFactoryDepartmentCombinations = () => {
    const combinations = [];
    Object.keys(ALL_PERMISSIONS.DEPARTMENTS).forEach(departmentKey => {
        combinations.push({
            factory: 'all', // Simplified - no factory concept
            department: departmentKey.toLowerCase(),
            permissions: ALL_PERMISSIONS.DEPARTMENTS[departmentKey]
        });
    });
    return combinations;
};

export const getDefaultPermissionsForFactoryDepartment = (factoryKey, departmentKey) => {
    const department = ALL_PERMISSIONS.DEPARTMENTS[departmentKey.toUpperCase()];
    return department || {};
};

export const getDefaultPermissionsForFactory = (factoryKey) => {
    // Simplified - return all department permissions
    const allPermissions = {};
    Object.values(ALL_PERMISSIONS.DEPARTMENTS).forEach(departmentPermissions => {
        Object.assign(allPermissions, departmentPermissions);
    });
    
    return allPermissions;
};

// Legacy admin permissions
export const ADMIN_PERMISSIONS = ADMIN_DEFAULT_PERMISSIONS;

// Legacy helper functions for departments
export const getDepartmentByKey = (key) => {
    return DEPARTMENT_NAMES[key] || key;
};

// Factory helper functions
export const getAccessibleFactories = (userRole, userPermissions) => {
    // Admin has access to all factories
    if (userRole === 'admin') {
        return ['gulbarga', 'kerur', 'humnabad', 'omkar', 'padmavati'];
    }
    
    // For regular users, return all factories (simplified for 2-layer RBAC)
    return ['gulbarga', 'kerur', 'humnabad', 'omkar', 'padmavati'];
};

export const getAllDepartments = () => {
    return Object.values(DEPARTMENTS);
};

export const getDepartmentKeys = () => {
    return Object.keys(DEPARTMENTS);
};

export const getDepartmentNames = () => {
    return Object.values(DEPARTMENT_NAMES);
};

// Legacy service helper functions
export const getServiceByKey = (deptKey, serviceKey) => {
  const department = DEPARTMENTS_CONFIG[deptKey.toUpperCase()];
  if (!department || !department.services) return null;
  
  return Object.values(department.services).find(service => service.key === serviceKey);
};

export const getAllServicesForDepartment = (deptKey) => {
  const department = DEPARTMENTS_CONFIG[deptKey.toUpperCase()];
  return department ? Object.values(department.services) : [];
};

export const getAllPermissions = () => {
  const permissions = {};
  
  Object.values(DEPARTMENTS_CONFIG).forEach(dept => {
    if (dept.services) {
      Object.values(dept.services).forEach(service => {
        if (service.permission) {
          permissions[service.permission] = true;
        }
        if (service.subServices) {
          Object.values(service.subServices).forEach(subService => {
            if (subService.permission) {
              permissions[subService.permission] = true;
            }
          });
        }
      });
    }
  });
  
  return permissions;
};

// Legacy factory service permission mapping (simplified)
export const getFactoryServicePermission = (factoryKey, serviceType) => {
    // Simplified - return service permission directly
    const servicePermissionMap = {
        'single_processing': 'single_processing',
        'batch_processing': 'batch_processing',
        'inventory': 'inventory',
        'reports': 'reports',
        'reactor_reports': 'reactor_reports',
        'marketing_campaigns': 'marketing_campaigns',
        'expense_management': 'expense_management'
    };
    
    return servicePermissionMap[serviceType];
};

// Build permission key for a specific department based on route type
export const getFactoryServicePermissionForDepartment = (factoryKey, departmentKey, routeType) => {
    const routeTypeToServicePermission = {
        'single_processing': 'single_processing',
        'batch_processing': 'batch_processing',
        'inventory': 'inventory',
        'reports': 'reports',
        'reactor_reports': 'reactor_reports',
        'marketing_campaigns': 'marketing_campaigns',
        'expense_management': 'expense_management'
    };
    return routeTypeToServicePermission[routeType] || null;
};

export const canAccessFactoryRoute = (userRole, userPermissions, factoryKey, departmentKey, routeType) => {
    // Admin can access everything
    if (userRole === 'admin') return true;
    
    if (!departmentKey || !routeType) return false;
    
    const permissionKey = getFactoryServicePermissionForDepartment(factoryKey, departmentKey, routeType);
    if (!permissionKey) return false;
    
    return hasPermission(userPermissions, permissionKey);
};

// Common API endpoints
export const ENDPOINTS = {
    // Auth
    GOOGLE_AUTH: 'auth/google',
    GOOGLE_CALLBACK: 'auth/google/callback',
    LOGOUT: 'auth/logout',
    AUTH_STATUS: 'auth/status',
    CHANGE_PASSWORD: 'auth/change-password',

    // Salary Slip
    SINGLE_SLIP: 'generate-salary-slip-single',
    BATCH_SLIPS: 'generate-salary-slips-batch',

    // User Management
    GET_USERS: 'get_users',
    ADD_USER: 'add_user',
    DELETE_USER: 'delete_user',
    UPDATE_ROLE: 'update_role',
    UPDATE_USER: 'update_user',
    UPDATE_PERMISSIONS: 'update_permissions',
    UPDATE_APP_PASSWORD: 'update_app_password',

    // WhatsApp Authentication
    WHATSAPP_LOGIN: 'whatsapp-login',
    WHATSAPP_STATUS: 'whatsapp-status',
    WHATSAPP_LOGOUT: 'whatsapp-logout',
    WHATSAPP_SEND_OTP: 'whatsapp-send-otp',
    WHATSAPP_VERIFY_OTP: 'whatsapp-verify-otp',
    WHATSAPP_FORCE_NEW_SESSION: 'whatsapp-force-new-session',

    // Logs
    GET_LOGS: 'get-logs',

    // Misc
    HOME: '',
    HEALTH: 'health',
    PROCESS_SINGLE: 'process_single',
    PROCESS_BATCH: 'process_batch'
};

// API call with fetch
export const makeApiCall = async (endpoint, options = {}) => {
    const defaultOptions = {
        credentials: 'include',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        credentials: 'include',
        mode: 'cors',
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };

    try {
        const response = await fetch(getApiUrl(endpoint), mergedOptions);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return await response.text();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
};

// Export fetch with defaults
export const configuredFetch = (url, options = {}) => {
    const finalOptions = {
        ...API_CONFIG,
        ...options,
        headers: {
            ...API_CONFIG.headers,
            ...options.headers
        }
    };
    return fetch(url, finalOptions);
};

// Export everything as default
export default {
    getApiUrl,
    makeApiCall,
    ENDPOINTS
};

// ============================================================================
// PLANT DATA CONFIGURATION
// ============================================================================

// Centralized plant data configuration
export const PLANT_DATA = [
  { 
    name: 'Head Office', 
    material_sheet_id: '',
    document_name: 'HO',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  },
  { 
    name: 'Gulbarga', 
    material_sheet_id: '',
    document_name: 'GG',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  },
  { 
    name: 'Kerur', 
    material_sheet_id: '1IcgUtCOah9Vi5Z3lI4wxhXoXSTQTWvYkXhSxHt7-5oc',
    document_name: 'KR',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  },
  { 
    name: 'Humnabad', 
    material_sheet_id: '',
    document_name: 'HB',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  },
  { 
    name: 'Omkar', 
    material_sheet_id: '',
    document_name: 'OM',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  },
  {
    name: 'Padmavati',
    material_sheet_id: '', 
    document_name: 'PV',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  }
];

// Plant helper functions
export const getPlantBySheetId = (sheetId) => {
  return PLANT_DATA.find(plant => plant.material_sheet_id === sheetId);
};

export const getPlantByName = (name) => {
  return PLANT_DATA.find(plant => plant.name === name);
};

export const getPlantByDocumentName = (documentName) => {
  return PLANT_DATA.find(plant => plant.document_name === documentName);
};

export const getDocumentNameBySheetId = (sheetId) => {
  const plant = getPlantBySheetId(sheetId);
  return plant ? plant.document_name : 'UNKNOWN';
};

export const getPlantNameBySheetId = (sheetId) => {
  const plant = getPlantBySheetId(sheetId);
  return plant ? plant.name : 'Unknown Plant';
};

export const getSheetNameBySheetId = (sheetId) => {
  const plant = getPlantBySheetId(sheetId);
  if (!plant) return 'Material List';
  
  // Handle both old string format and new object format for backward compatibility
  if (typeof plant.sheet_name === 'string') {
    return plant.sheet_name;
  } else if (typeof plant.sheet_name === 'object') {
    return plant.sheet_name.MaterialList || 'Material List';
  }
  
  return 'Material List';
};

export const getMaterialSheetName = (sheetId) => {
  const plant = getPlantBySheetId(sheetId);
  if (!plant || !plant.sheet_name) return 'Material List';
  
  if (typeof plant.sheet_name === 'string') {
    return plant.sheet_name;
  } else if (typeof plant.sheet_name === 'object') {
    return plant.sheet_name.MaterialList || 'Material List';
  }
  
  return 'Material List';
};

export const getPartySheetName = (sheetId) => {
  const plant = getPlantBySheetId(sheetId);
  if (!plant || !plant.sheet_name) return 'Party List';
  
  if (typeof plant.sheet_name === 'string') {
    return 'Party List'; // Default for old format
  } else if (typeof plant.sheet_name === 'object') {
    return plant.sheet_name.PartyList || 'Party List';
  }
  
  return 'Party List';
};

export const getAuthoritySheetName = (sheetId) => {
  const plant = getPlantBySheetId(sheetId);
  if (!plant || !plant.sheet_name) return 'Authority List';
  
  if (typeof plant.sheet_name === 'string') {
    return 'Authority List'; // Default for old format
  } else if (typeof plant.sheet_name === 'object') {
    return plant.sheet_name.AuthorityList || 'Authority List';
  }
  
  return 'Authority List';
};

// Named exports
export { DEFAULT_WHATSAPP_URL, DEFAULT_BACKEND_URL };
