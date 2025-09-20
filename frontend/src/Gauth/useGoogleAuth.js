import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext.jsx';
import oauthService from './oauthService.js';

/**
 * Custom hook for Google OAuth authentication
 */
export const useGoogleAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  /**
   * Handle OAuth callback detection and processing
   */
  useEffect(() => {
    const checkOAuthCallback = () => {
      const isCallback = oauthService.isOAuthCallback();
      
      if (isCallback) {
        console.log('✅ OAuth callback detected, processing...');
        setIsProcessing(true);
        handleOAuthCallback();
      }
    };

    // Check immediately and after a small delay to catch race conditions
    checkOAuthCallback();
    const timeoutId = setTimeout(checkOAuthCallback, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  /**
   * Process OAuth callback
   */
  const handleOAuthCallback = async () => {
    try {
      const result = await oauthService.handleOAuthCallback();
      
      if (result.success && result.user) {
        console.log('✅ OAuth successful, logging in user');
        
        // Store user data and log in
        localStorage.setItem('user', JSON.stringify(result.user));
        localStorage.setItem('isAuthenticated', 'true');
        login(result.user);
        
        // Navigate to app
        navigate('/app', { replace: true });
        
        setError('');
      } else {
        setError(result.error || 'Google authentication failed');
      }
    } catch (error) {
      console.error('❌ OAuth callback processing error:', error);
      setError(error.message || 'Google authentication failed');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Initiate Google OAuth flow
   */
  const initiateGoogleAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Check configuration first
      const configCheck = await oauthService.checkConfiguration();
      if (!configCheck.success || !configCheck.google_configured) {
        throw new Error('Google OAuth not properly configured on server. Please contact administrator.');
      }

      // Generate state and auth URL
      const state = oauthService.generateState();
      const authUrl = oauthService.generateAuthUrl(state);
      
      console.log('🚀 Initiating Google OAuth flow...');
      
      // Store state for verification
      localStorage.setItem('oauth_state', state);
      
      // Redirect current window to OAuth URL
      oauthService.redirectToOAuth(authUrl);
      
    } catch (error) {
      console.error('❌ Google OAuth initiation error:', error);
      setError(error.message || 'Google authentication failed. Please try again.');
      setLoading(false);
    }
  }, []);


  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError('');
  }, []);

  /**
   * Check if currently processing OAuth callback
   */
  const isOAuthCallback = oauthService.isOAuthCallback();

  return {
    loading,
    error,
    isProcessing,
    isOAuthCallback,
    initiateGoogleAuth,
    clearError
  };
};
