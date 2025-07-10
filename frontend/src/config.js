// Environment variables
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Default backend URL
const DEFAULT_BACKEND_URL = 'http://localhost:5000';

// API URL configuration
const getApiBaseUrl = () => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
        // Check if we have a stored local backend URL
        const localBackendUrl = localStorage.getItem('localBackendUrl');
        if (localBackendUrl && isDevelopment) {
            return `${localBackendUrl}/api`;
        }
    }
    
    // Use the appropriate backend URL based on environment
    return `${DEFAULT_BACKEND_URL}/api`;
};

// Initialize backend URL in localStorage if not set
if (typeof window !== 'undefined' && !localStorage.getItem('localBackendUrl')) {
    localStorage.setItem('localBackendUrl', DEFAULT_BACKEND_URL);
}

// Configure axios defaults
import axios from 'axios';

axios.defaults.baseURL = getApiBaseUrl();
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.timeout = 10000; // 10 seconds timeout

// Feature flags
export const FEATURES = {
    ENABLE_WHATSAPP: import.meta.env.VITE_ENABLE_WHATSAPP === 'true',
    ENABLE_EMAIL: import.meta.env.VITE_ENABLE_EMAIL === 'true',
    ENABLE_ERROR_REPORTING: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true'
};

// Logging configuration
export const LOG_CONFIG = {
    LEVEL: import.meta.env.VITE_LOG_LEVEL || 'info'
};

// API request configuration
export const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    credentials: 'include',
    mode: 'cors'
};

// Function to get the full API URL for a specific endpoint
export const getApiUrl = (endpoint) => {
    return `${getApiBaseUrl()}/${endpoint}`;
};

// Function to set local backend URL
export const setLocalBackendUrl = (url) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('localBackendUrl', url);
    }
};

// Function to get current backend URL
export const getCurrentBackendUrl = () => {
    return getApiBaseUrl();
};

// Common API endpoints
export const ENDPOINTS = {
    // Auth endpoints
    GOOGLE_AUTH: 'auth/google',
    GOOGLE_CALLBACK: 'auth/google/callback',
    LOGOUT: 'auth/logout',
    AUTH_STATUS: 'auth/status',
    
    // Salary slip endpoints
    SINGLE_SLIP: 'generate-salary-slip-single',
    BATCH_SLIPS: 'generate-salary-slips-batch',
    
    // User management endpoints
    GET_USERS: 'get_users',
    ADD_USER: 'add_user',
    DELETE_USER: 'delete_user',
    UPDATE_ROLE: 'update_role',
    
    // Logging endpoints
    GET_LOGS: 'get-logs',
    
    // Misc endpoints
    HOME: '',
    HEALTH: 'health',
    PROCESS_SINGLE: 'process_single',
    PROCESS_BATCH: 'process_batch',
    CHANGE_PASSWORD: 'change-password'
};

// Enhanced API call helper with better error handling
export const makeApiCall = async (endpoint, options = {}) => {
    const defaultOptions = {
        credentials: 'include',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    // Merge options while preserving the credentials and mode settings
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

// Export a configured fetch function for special cases
export const configuredFetch = (url, options = {}) => {
    const finalOptions = {
        ...API_CONFIG,
        ...options,
        credentials: 'include',
        mode: 'cors',
        headers: {
            ...API_CONFIG.headers,
            ...options.headers
        }
    };
    return fetch(url, finalOptions);
};

export default {
    getApiUrl,
    makeApiCall,
    ENDPOINTS
};