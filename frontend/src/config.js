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

// Old DEPARTMENTS_CONFIG removed - using centralized FACTORY_RBAC_CONFIG instead

// Old RBAC structure removed - using centralized FACTORY_RBAC_CONFIG instead

// Factory names for navigation
export const FACTORY_NAMES = {
    'gulbarga': 'Gulbarga',
    'kerur': 'Kerur',
    'humnabad': 'Humnabad',
    'omkar': 'Omkar',
    'padmavati': 'Padmavati',
    'headoffice': 'Head Office'
};

// Old service keys removed - using centralized FACTORY_RBAC_CONFIG instead

// Old permissions structure removed - using centralized FACTORY_RBAC_CONFIG instead

// Old permission descriptions and default permissions removed - using centralized FACTORY_RBAC_CONFIG instead

// Old RBAC helper functions removed - using centralized RBAC_HELPERS instead

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
// CENTRALIZED FACTORY RBAC CONFIGURATION
// ============================================================================

// Centralized factory RBAC configuration following the URL structure:
// /factory/department/service
// This configuration matches the actual file structure in the codebase
export const FACTORY_RBAC_CONFIG = {
  gulbarga: {
    name: 'Gulbarga',
    document_name: 'GB',
    departments: {
      store: {
        name: 'Store',
        services: {
          gb_place_order: { name: 'Place Order', permission: 'gb_place_order' }
        }
      },
      humanresource: {
        name: 'Human Resource',
        services: {
          gb_single_processing: { name: 'Single Processing', permission: 'gb_single_processing' },
          gb_batch_processing: { name: 'Batch Processing', permission: 'gb_batch_processing' }
        }
      },
      operations: {
        name: 'Operations',
        services: {
          gb_general_reports: { name: 'General Reports', permission: 'gb_general_reports' }
        }
      }
    }
  },
  kerur: {
    name: 'Kerur',
    document_name: 'KR',
    departments: {
      store: {
        name: 'Store',
        services: {
          kr_place_order: { name: 'Place Order', permission: 'kr_place_order' },
          kr_material_list: { name: 'Material List', permission: 'kr_material_list' },
          kr_material_inward: { name: 'Material Inward', permission: 'kr_material_inward' },
          kr_material_outward: { name: 'Material Outward', permission: 'kr_material_outward' },
          kr_order_status: { name: 'Order Status', permission: 'kr_order_status' },
          kr_general_reports: { name: 'General Reports', permission: 'kr_general_reports' }
        }
      },
      humanresource: {
        name: 'Human Resource',
        services: {
          kr_single_processing: { name: 'Single Processing', permission: 'kr_single_processing' },
          kr_batch_processing: { name: 'Batch Processing', permission: 'kr_batch_processing' }
        }
      },
      operations: {
        name: 'Operations',
        services: {
          kr_general_reports: { name: 'General Reports', permission: 'kr_general_reports' },
          kr_reactor_reports: { name: 'Reactor Reports', permission: 'kr_reactor_reports' }
        }
      }
    }
  },
  humnabad: {
    name: 'Humnabad',
    document_name: 'HB',
    departments: {
      store: {
        name: 'Store',
        services: {
          hb_place_order: { name: 'Place Order', permission: 'hb_place_order' }
        }
      },
      humanresource: {
        name: 'Human Resource',
        services: {
          hb_single_processing: { name: 'Single Processing', permission: 'hb_single_processing' },
          hb_batch_processing: { name: 'Batch Processing', permission: 'hb_batch_processing' }
        }
      },
      operations: {
        name: 'Operations',
        services: {
          hb_general_reports: { name: 'General Reports', permission: 'hb_general_reports' }
        }
      }
    }
  },
  omkar: {
    name: 'Omkar',
    document_name: 'OM',
    departments: {
      store: {
        name: 'Store',
        services: {
          om_placeorder: { name: 'Place Order', permission: 'om_place_order' }
        }
      },
      humanresource: {
        name: 'Human Resource',
        services: {
          om_single_processing: { name: 'Single Processing', permission: 'om_single_processing' },
          om_batch_processing: { name: 'Batch Processing', permission: 'om_batch_processing' }
        }
      },
      operations: {
        name: 'Operations',
        services: {
          om_general_reports: { name: 'General Reports', permission: 'om_general_reports' }
        }
      }
    }
  },
  padmavati: {
    name: 'Padmavati',
    document_name: 'PV',
    departments: {
      store: {
        name: 'Store',
        services: {
          pv_place_order: { name: 'Place Order', permission: 'pv_place_order' }
        }
      },
      humanresource: {
        name: 'Human Resource',
        services: {
          pv_single_processing: { name: 'Single Processing', permission: 'pv_single_processing' },
          pv_batch_processing: { name: 'Batch Processing', permission: 'pv_batch_processing' }
        }
      },
      operations: {
        name: 'Operations',
        services: {
          pv_general_reports: { name: 'General Reports', permission: 'pv_general_reports' }
        }
      }
    }
  },
  headoffice: {
    name: 'Head Office',
    document_name: 'HO',
    departments: {
      store: {
        name: 'Store',
        services: {
          ho_material_list: { name: 'Material List', permission: 'ho_material_list' }
        }
      },
      humanresource: {
        name: 'Human Resource',
        services: {
          ho_single_processing: { name: 'Single Processing', permission: 'ho_single_processing' },
          ho_batch_processing: { name: 'Batch Processing', permission: 'ho_batch_processing' }
        }
      },
      accounts: {
        name: 'Accounts',
        services: {
          // No specific services found in HO_Services folder
        }
      },
      marketing: {
        name: 'Marketing',
        services: {
          // No specific services found in HO_Services folder
        }
      },
      operations: {
        name: 'Operations',
        services: {
          ho_general_reports: { name: 'General Reports', permission: 'ho_general_reports' }
        }
      }
    }
  }
};

// RBAC Helper Functions
export const RBAC_HELPERS = {
  // Get all factories
  getAllFactories: () => Object.keys(FACTORY_RBAC_CONFIG),
  
  // Get departments for a factory
  getFactoryDepartments: (factory) => {
    const factoryConfig = FACTORY_RBAC_CONFIG[factory];
    return factoryConfig ? Object.keys(factoryConfig.departments) : [];
  },
  
  // Get services for a factory-department combination
  getFactoryDepartmentServices: (factory, department) => {
    const factoryConfig = FACTORY_RBAC_CONFIG[factory];
    if (!factoryConfig || !factoryConfig.departments[department]) return [];
    return Object.keys(factoryConfig.departments[department].services);
  },
  
  // Get service permission for a factory-department-service combination
  getServicePermission: (factory, department, service) => {
    const factoryConfig = FACTORY_RBAC_CONFIG[factory];
    if (!factoryConfig || !factoryConfig.departments[department] || !factoryConfig.departments[department].services[service]) {
      return null;
    }
    return factoryConfig.departments[department].services[service].permission;
  },
  
  // Check if user can access a factory-department combination
  canAccessFactoryDepartment: (user, factory, department) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const permissionMetadata = user.permission_metadata || {};
    const departments = permissionMetadata.departments || {};
    const userDepartments = departments[factory] || [];

    // Get factory short form
    const factoryConfig = FACTORY_RBAC_CONFIG[factory];
    const factoryShortForm = factoryConfig?.document_name?.toLowerCase() || factory;

    // Debug logging
    console.log(`RBAC_HELPERS.canAccessFactoryDepartment:`, {
      factory,
      department,
      factoryShortForm,
      userDepartments,
      permissionMetadata
    });

    // Check for both formats: prefixed with short form (gb_store) and non-prefixed (store)
    const prefixedDepartment = `${factoryShortForm}_${department}`;
    const nonPrefixedDepartment = department ? department.replace(`${factoryShortForm}_`, '') : '';
    const result = userDepartments.includes(department) || userDepartments.includes(prefixedDepartment) || userDepartments.includes(nonPrefixedDepartment);

    console.log(`RBAC_HELPERS.canAccessFactoryDepartment result:`, {
      includesDepartment: userDepartments.includes(department),
      includesPrefixed: userDepartments.includes(prefixedDepartment),
      includesNonPrefixed: userDepartments.includes(nonPrefixedDepartment),
      result
    });

    return result;
  },
  
  // Check if user can access factory-department-service
  canAccessFactoryDepartmentService: (user, factory, department, service) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    const permissionMetadata = user.permission_metadata || {};
    const services = permissionMetadata.services || {};
    const serviceKey = `${factory}.${department}`;
    const allowedServices = services[serviceKey] || [];
    
    // Get factory short form for permission checking
    const factoryConfig = FACTORY_RBAC_CONFIG[factory];
    const factoryShortForm = factoryConfig?.document_name?.toLowerCase() || factory;
    
    // Check for both formats: prefixed (kr_place_order) and non-prefixed (place_order)
    const prefixedService = `${factoryShortForm}_${service}`;
    const nonPrefixedService = service ? service.replace(`${factoryShortForm}_`, '') : '';
    const result = allowedServices.includes(service) || allowedServices.includes(prefixedService) || allowedServices.includes(nonPrefixedService);
    
    // Debug logging
    console.log(`RBAC_HELPERS.canAccessFactoryDepartmentService:`, {
      factory,
      department,
      service,
      factoryShortForm,
      prefixedService,
      nonPrefixedService,
      serviceKey,
      allowedServices,
      result
    });
    
    return result;
  },
  
  // Generate permission metadata for a user
  generatePermissionMetadata: (factories, departments, services) => {
    const permissionMetadata = {
      factories: factories || [],
      departments: {},
      services: {}
    };

    factories.forEach(factory => {
      const factoryConfig = FACTORY_RBAC_CONFIG[factory];
      if (!factoryConfig) return;
      
      const factoryShortForm = factoryConfig.document_name; // e.g., 'GB', 'KR', 'HB'
      
      departments.forEach(dept => {
        if (factoryConfig.departments[dept]) {
          if (!permissionMetadata.departments[factory]) {
            permissionMetadata.departments[factory] = [];
          }
          // Store departments with factory short form prefix (e.g., gb_store, kr_humanresource)
          const prefixedDept = `${factoryShortForm.toLowerCase()}_${dept}`;
          permissionMetadata.departments[factory].push(prefixedDept);

          const serviceKey = `${factory}.${dept}`;
          permissionMetadata.services[serviceKey] = services || [];
        }
      });
    });

    return permissionMetadata;
  },
  
  // Get all available permissions across all factories
  getAllPermissions: () => {
    const permissions = new Set();
    
    Object.values(FACTORY_RBAC_CONFIG).forEach(factory => {
      Object.values(factory.departments).forEach(department => {
        Object.values(department.services).forEach(service => {
          permissions.add(service.permission);
        });
      });
    });
    
    return Array.from(permissions);
  }
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
    material_sheet_id: '1EkjLEEMeZTJoMVDpmtxBVQ_LY_5u99J76PPMwodvD5Y',
    document_name: 'GB',
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
    material_sheet_id: '1cj6q7YfIfAHPO4GDHTQldF0XthpD1p6lLrnBPDx2jsw',
    document_name: 'HB',
    sheet_name: {
      MaterialList: 'Material List',
      PartyList: 'Party List',
      AuthorityList: 'Authority List'
    }
  },
  { 
    name: 'Omkar', 
    material_sheet_id: '15MSsB7qXCyKWHvdJtUJuivlgy6khA2dCXxNXuY-sowg',
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
