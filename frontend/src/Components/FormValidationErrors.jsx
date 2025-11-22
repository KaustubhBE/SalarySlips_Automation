import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { DEFAULT_WHATSAPP_URL } from '../config';

/**
 * FormValidationErrors Component
 * 
 * A reusable component for displaying form validation errors in a consistent style.
 * Matches the error display pattern used in Settings.jsx
 * 
 * @param {Object} props
 * @param {string[]} props.errors - Array of error messages to display
 * @param {string} [props.title] - Optional title/header text (default: "Please fix the following errors:")
 * @param {string} [props.icon] - Optional icon to display (default: "⚠️")
 * @param {Object} [props.style] - Optional additional inline styles
 * @param {string} [props.className] - Optional additional CSS class names
 * @param {boolean} [props.checkWhatsApp] - Optional flag to check WhatsApp authentication status (default: false)
 */
const FormValidationErrors = ({ 
  errors = [], 
  title = "Please fix the following errors:",
  icon = "⚠️",
  style = {},
  className = "",
  checkWhatsApp = false
}) => {
  const { user } = useAuth();
  const [whatsappAuthenticated, setWhatsappAuthenticated] = useState(false);
  const [whatsappStatusLoading, setWhatsappStatusLoading] = useState(false);
  const [allErrors, setAllErrors] = useState([]);
  const retryTimeoutRef = useRef(null);

  // Helper function to get user identifier (same as Navbar.jsx)
  const getUserIdentifier = () => {
    if (!user) return null;
    return user.email || user.username || user.userId || null;
  };

  // Listen for WhatsApp authentication status changes from Navbar
  useEffect(() => {
    if (!checkWhatsApp) {
      return;
    }

    const handleWhatsAppStatusChange = (event) => {
      const { isAuthenticated } = event.detail;
      console.log('[FormValidationErrors] Received WhatsApp auth status change event:', isAuthenticated);
      setWhatsappAuthenticated(isAuthenticated);
      setWhatsappStatusLoading(false);
    };

    // Listen for WhatsApp status change events from Navbar
    window.addEventListener('whatsapp-auth-status-changed', handleWhatsAppStatusChange);

    return () => {
      window.removeEventListener('whatsapp-auth-status-changed', handleWhatsAppStatusChange);
    };
  }, [checkWhatsApp]);

  // Check WhatsApp authentication status on mount and when user changes
  useEffect(() => {
    if (!checkWhatsApp) {
      return;
    }

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const checkWhatsAppAuthStatus = async () => {
      const userIdentifier = getUserIdentifier();
      
      if (!userIdentifier) {
        console.warn('[FormValidationErrors] User not available yet, will retry in 1 second...');
        // Retry after a short delay if user is not available
        retryTimeoutRef.current = setTimeout(() => {
          checkWhatsAppAuthStatus();
        }, 1000);
        return;
      }

      try {
        setWhatsappStatusLoading(true);
        console.log(`[FormValidationErrors] Checking WhatsApp auth status for user: ${userIdentifier}`);
        
        const res = await fetch(`${DEFAULT_WHATSAPP_URL}/api/whatsapp-status`, {
          credentials: 'include',
          headers: {
            'X-User-Email': userIdentifier,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          console.log('[FormValidationErrors] WhatsApp auth status response:', data);
          
          // Check both isReady and authenticated flags (same as Navbar.jsx)
          const isAuthenticated = data.isReady || data.authenticated || false;
          console.log(`[FormValidationErrors] WhatsApp authenticated: ${isAuthenticated} (isReady: ${data.isReady}, authenticated: ${data.authenticated})`);
          setWhatsappAuthenticated(isAuthenticated);
        } else {
          console.warn(`[FormValidationErrors] WhatsApp status check failed with status: ${res.status}`);
          setWhatsappAuthenticated(false);
        }
      } catch (error) {
        console.error('[FormValidationErrors] Error checking WhatsApp auth status:', error);
        setWhatsappAuthenticated(false);
      } finally {
        setWhatsappStatusLoading(false);
      }
    };

    // Check immediately when component mounts or when user/checkWhatsApp changes
    checkWhatsAppAuthStatus();

    // Cleanup function
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [checkWhatsApp, user]);

  // Combine errors with WhatsApp error if needed
  useEffect(() => {
    const combinedErrors = [...errors];
    
    if (checkWhatsApp && !whatsappStatusLoading && !whatsappAuthenticated) {
      combinedErrors.push('WhatsApp service not available, please login');
    }
    
    setAllErrors(combinedErrors);
  }, [errors, checkWhatsApp, whatsappStatusLoading, whatsappAuthenticated]);

  // Don't render if there are no errors
  if (!allErrors || allErrors.length === 0) {
    return null;
  }

  const defaultStyle = {
    marginBottom: '20px',
    padding: '12px 16px',
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#c62828',
    ...style
  };

  return (
    <div style={defaultStyle} className={className}>
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
      }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span>{title}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: '24px' }}>
        {allErrors.map((error, index) => (
          <li key={index} style={{ marginBottom: '4px' }}>
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FormValidationErrors;

