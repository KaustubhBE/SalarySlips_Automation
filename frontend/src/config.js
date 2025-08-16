// config.js

import axios from 'axios';

// Detect if running in development
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Default backend URL
const DEFAULT_BACKEND_URL = 'http://localhost:5000';
// WhatsApp service URL
const WHATSAPP_SERVICE_URL = 'http://localhost:3001';

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
axios.defaults.timeout = 10000;

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

// Get WhatsApp service URL
export const getWhatsAppServiceUrl = (endpoint) => {
    return `${WHATSAPP_SERVICE_URL}/${endpoint}`;
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

    // Logs
    GET_LOGS: 'get-logs',

    // Misc
    HOME: '',
    HEALTH: 'health',
    PROCESS_SINGLE: 'process_single',
    PROCESS_BATCH: 'process_batch'
};

// WhatsApp service endpoints
export const WHATSAPP_ENDPOINTS = {
    HEALTH: 'health',
    STATUS: 'status',
    QR: 'qr',
    TRIGGER_LOGIN: 'trigger-login',
    LOGOUT: 'logout',
    AUTH_STATUS: 'auth-status', // Add this missing endpoint
    SEND_MESSAGE: 'send-message',
    SEND_BULK: 'send-bulk',
    SEND_SALARY_NOTIFICATION: 'send-salary-notification',
    SEND_REACTOR_REPORT: 'send-reactor-report'
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
