/**
 * OAuth Utility Functions
 */

/**
 * Generate a secure random state parameter for CSRF protection
 */
export const generateSecureState = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate OAuth state parameter
 */
export const validateState = (receivedState, storedState) => {
  if (!receivedState || !storedState) {
    return false;
  }
  return receivedState === storedState;
};

/**
 * Extract parameters from URL with support for both search params and hash
 */
export const extractUrlParams = (url = window.location.href) => {
  const urlObj = new URL(url);
  
  // Check search parameters
  const searchParams = new URLSearchParams(urlObj.search);
  const searchCode = searchParams.get('code');
  const searchError = searchParams.get('error');
  const searchState = searchParams.get('state');
  
  // Check hash parameters
  const hashParams = new URLSearchParams(urlObj.hash.substring(1));
  const hashCode = hashParams.get('code');
  const hashError = hashParams.get('error');
  const hashState = hashParams.get('state');
  
  return {
    code: searchCode || hashCode,
    error: searchError || hashError,
    state: searchState || hashState,
    hasParams: !!(searchCode || hashCode || searchError || hashError || searchState || hashState)
  };
};

/**
 * Check if current window is a popup
 */
export const isPopupWindow = () => {
  try {
    return !!(window.opener && !window.opener.closed);
  } catch (error) {
    // COOP policy might block access to window.opener
    console.log('Could not access window.opener due to COOP policy');
    return false;
  }
};

/**
 * Check if current URL contains OAuth callback parameters
 */
export const isOAuthCallbackUrl = (url = window.location.href) => {
  const params = extractUrlParams(url);
  return params.hasParams;
};

/**
 * Safely close popup window
 */
export const closePopupSafely = () => {
  try {
    window.close();
  } catch (error) {
    console.log('Could not close popup:', error);
  }
};

/**
 * Get OAuth result from localStorage and clear it
 */
export const getAndClearOAuthResult = () => {
  try {
    const result = localStorage.getItem('oauth_result');
    if (result) {
      localStorage.removeItem('oauth_result');
      return JSON.parse(result);
    }
    return null;
  } catch (error) {
    console.error('Error getting OAuth result from localStorage:', error);
    localStorage.removeItem('oauth_result');
    return null;
  }
};

/**
 * Store OAuth result in localStorage
 */
export const storeOAuthResult = (success, data) => {
  try {
    const result = { success, ...data };
    localStorage.setItem('oauth_result', JSON.stringify(result));
    return true;
  } catch (error) {
    console.error('Error storing OAuth result in localStorage:', error);
    return false;
  }
};

/**
 * Generate OAuth authorization URL
 */
export const generateOAuthUrl = (clientId, redirectUri, scopes, state, additionalParams = {}) => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', Array.isArray(scopes) ? scopes.join(' ') : scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  
  // Add any additional parameters
  Object.entries(additionalParams).forEach(([key, value]) => {
    authUrl.searchParams.set(key, value);
  });
  
  return authUrl.toString();
};

/**
 * Open popup window with proper settings
 */
export const openOAuthPopup = (url, windowName = 'google-oauth') => {
  const popup = window.open(
    url,
    windowName,
    'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
  );
  
  if (!popup) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }
  
  return popup;
};

/**
 * Create a timeout promise
 */
export const createTimeout = (ms, message = 'Operation timed out') => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
};

/**
 * Wait for popup to close or return a result
 */
export const waitForPopupResult = (popup, timeout = 300000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Authentication timeout. Please try again.'));
    }, timeout);
    
    const checkClosed = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeoutId);
          reject(new Error('Popup was closed before authentication completed.'));
        }
      } catch (error) {
        // COOP policy might block access to popup.closed
        console.log('Could not check popup.closed due to COOP policy');
      }
    }, 1000);
    
    // Clean up intervals if popup result is resolved elsewhere
    const cleanup = () => {
      clearInterval(checkClosed);
      clearTimeout(timeoutId);
    };
    
    // Return cleanup function
    resolve.cleanup = cleanup;
    reject.cleanup = cleanup;
  });
};

/**
 * Debounce function to prevent multiple rapid calls
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Format error message for display
 */
export const formatOAuthError = (error) => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error) {
    return error.error;
  }
  
  return 'Google authentication failed. Please try again.';
};

/**
 * Log OAuth debug information
 */
export const logOAuthDebug = (context, data) => {
  console.log(`=== OAUTH DEBUG: ${context} ===`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Data:', data);
  console.log('URL:', window.location.href);
  console.log('User Agent:', navigator.userAgent);
  console.log('=== END DEBUG ===');
};

/**
 * Check if a token is expired based on expiry timestamp
 * @param {string|number} expiryTime - Token expiry time (ISO string or Unix timestamp)
 * @returns {boolean} - True if token is expired or invalid, false otherwise
 */
export const isTokenExpired = (expiryTime) => {
  if (!expiryTime) {
    return true; // No expiry time means no valid token
  }
  
  try {
    let expiryDate;
    
    // Handle ISO string format
    if (typeof expiryTime === 'string') {
      expiryDate = new Date(expiryTime);
    } 
    // Handle Unix timestamp (seconds or milliseconds)
    else if (typeof expiryTime === 'number') {
      // If timestamp is in seconds (< 10000000000), convert to milliseconds
      expiryDate = new Date(expiryTime < 10000000000 ? expiryTime * 1000 : expiryTime);
    } else {
      return true; // Invalid format
    }
    
    // Add a 5-minute buffer to refresh tokens before they expire
    const bufferMs = 5 * 60 * 1000;
    const now = new Date().getTime();
    const expiryWithBuffer = expiryDate.getTime() - bufferMs;
    
    return now >= expiryWithBuffer;
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return true; // If error, assume expired
  }
};

/**
 * Validate if user has valid Google credentials
 * @param {object} credentialData - Object containing token and expiry information
 * @returns {object} - { valid: boolean, reason: string }
 */
export const validateGoogleCredentials = (credentialData) => {
  if (!credentialData) {
    return { valid: false, reason: 'No credential data provided' };
  }
  
  const { access_token, refresh_token, token_expiry, email } = credentialData;
  
  if (!email) {
    return { valid: false, reason: 'No email found in credentials' };
  }
  
  if (!access_token && !refresh_token) {
    return { valid: false, reason: 'No tokens found' };
  }
  
  // If we have a refresh token, we can always get a new access token
  if (refresh_token) {
    return { valid: true, reason: 'Valid refresh token available' };
  }
  
  // Check if access token is expired
  if (access_token && token_expiry) {
    const expired = isTokenExpired(token_expiry);
    if (expired) {
      return { valid: false, reason: 'Access token expired and no refresh token' };
    }
    return { valid: true, reason: 'Valid access token available' };
  }
  
  // If we have access token but no expiry, assume it might be valid
  if (access_token) {
    return { valid: true, reason: 'Access token available (no expiry data)' };
  }
  
  return { valid: false, reason: 'Insufficient credential data' };
};
