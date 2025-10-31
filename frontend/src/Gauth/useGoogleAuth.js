import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const processingRef = useRef(false);

  /**
   * Process OAuth callback
   */
  const handleOAuthCallback = useCallback(async () => {
    // Prevent duplicate processing
    if (processingRef.current) {
      console.log('⚠️ OAuth callback already processing, skipping...');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      const result = await oauthService.handleOAuthCallback();
      
      if (result.success && result.user) {
        // Ensure user object has required structure
        const userData = {
          ...result.user,
          permissions: result.user.permissions || {},
          permission_metadata: result.user.permission_metadata || {
            factories: [],
            departments: {},
            services: {}
          },
          tree_permissions: result.user.tree_permissions || {},
          role: result.user.role || 'user'
        };

        // Store user data and log in
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        login(userData);
        
        // Clean up URL parameters to prevent re-processing
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('scope');
        window.history.replaceState({}, '', url.pathname + url.search);
        
        // Navigate to app
        navigate('/app', { replace: true });
        
        setError('');
      } else {
        setError(result.error || 'Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('OAuth callback processing error:', error);
      setError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [login, navigate]);

  /**
   * Handle OAuth callback detection and processing
   */
  useEffect(() => {
    const checkOAuthCallback = () => {
      const isCallback = oauthService.isOAuthCallback();
      
      if (isCallback && !processingRef.current) {
        console.log('✅ OAuth callback detected, processing...');
        handleOAuthCallback();
      }
    };

    // Check once after component mounts
    checkOAuthCallback();
    
    // No cleanup needed as processingRef prevents duplicates
  }, [handleOAuthCallback]);

  /**
   * Initiate Google OAuth flow with smart credential check
   * This flow will:
   * 1. Show Google account picker to identify user
   * 2. Check if that user has valid credentials in DB
   * 3. If valid credentials exist, login directly (skip consent)
   * 4. If no valid credentials, complete full OAuth consent flow
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

      // Always start OAuth flow to identify the Google account
      // The backend will handle the credential check after getting the user's email
      console.log('🚀 Initiating Google OAuth flow (will check credentials on callback)...');
      
      // Generate state and auth URL
      const state = oauthService.generateState();
      const authUrl = oauthService.generateAuthUrl(state);
      
      // Store state for verification
      localStorage.setItem('oauth_state', state);
      
      // Redirect current window to OAuth URL
      // Google will show account picker or use the logged-in account
      oauthService.redirectToOAuth(authUrl);
      
    } catch (error) {
      console.error('Google OAuth initiation error:', error);
      setError(error.message || 'Authentication failed. Please try again.');
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
