import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { getApiUrl } from './config.js';
import "./Login.css"

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    setLoading(true);

    try {
      const apiUrl = getApiUrl('auth/login');
      const payload = {
        email: email.trim(),
        password: password
      };
      
      const response = await axios.post(apiUrl, payload, { withCredentials: true });
      
      if (response.data?.success && response.data?.user) {
        const userData = response.data.user;
        console.log('Login successful - User data received:', userData);
        console.log('User permissions:', userData.permissions);
        console.log('User permission_metadata:', userData.permission_metadata);
        console.log('User tree_permissions:', userData.tree_permissions);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        login(userData);
        navigate('/app', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth callback with authorization code
  const handleOAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    // Check for OAuth errors first
    if (error) {
      console.error('OAuth error received:', error);
      setError(`Google authentication failed: ${error}`);
      setGoogleLoading(false);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (code) {
      console.log('OAuth callback received with code:', code);
      console.log('Redirect URI used:', window.location.origin);
      setGoogleLoading(true);
      setError('');
      
      try {
        // Exchange authorization code for tokens
        const response = await fetch(getApiUrl('auth/google/callback'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            code: code,
            redirect_uri: window.location.origin
          })
        });
        
        console.log('OAuth callback response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('OAuth callback error response:', errorText);
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('OAuth callback response data:', data);
        
        if (data.success && data.user) {
          console.log('Google OAuth with Gmail permissions successful:', data.user);
          login(data.user);
          navigate('/app', { replace: true });
        } else {
          throw new Error(data.error || 'OAuth callback failed');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setError(`Google authentication failed: ${error.message}`);
      } finally {
        setGoogleLoading(false);
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  };

  // Initialize Google OAuth
  useEffect(() => {
    // Check for OAuth callback first
    console.log('=== OAuth Callback Check ===');
    console.log('Current URL:', window.location.href);
    console.log('URL search params:', window.location.search);
    console.log('URL hash:', window.location.hash);
    
    // Check if we're on the callback page
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (code || error) {
      console.log('OAuth callback detected!');
      console.log('Code present:', !!code);
      console.log('Error present:', !!error);
      handleOAuthCallback();
    } else {
      console.log('No OAuth callback detected, normal login page');
    }
    
    // Set up global handler for Google OAuth response (fallback)
    window.handleGoogleResponse = handleGoogleResponse;

    // Initialize Google OAuth with proper client ID
    const initializeGoogleAuth = () => {
      if (window.google && window.google.accounts) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
        
        if (clientId === 'your-google-client-id') {
          console.warn('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID environment variable.');
          return;
        }
        
        // Update the global config with the actual client ID
        if (window.googleOAuthConfig) {
          window.googleOAuthConfig.client_id = clientId;
        }

        // Initialize Google OAuth with minimal scope for email
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true  // Enable FedCM as recommended by Google
        });
        
        console.log('Google OAuth initialized with client ID:', clientId);
      }
    };

    // Wait for Google API to load
    if (window.google && window.google.accounts) {
      initializeGoogleAuth();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.accounts) {
          initializeGoogleAuth();
          clearInterval(checkGoogle);
        }
      }, 100);
      
      // Cleanup interval after 10 seconds
      setTimeout(() => clearInterval(checkGoogle), 10000);
    }

    // Cleanup function
    return () => {
      if (window.handleGoogleResponse === handleGoogleResponse) {
        delete window.handleGoogleResponse;
      }
    };
  }, []);

  // Handle Google OAuth response
  const handleGoogleResponse = async (response) => {
    setGoogleLoading(true);
    setError('');

    try {
      console.log('Google OAuth response received:', response);
      
      if (!response.credential) {
        throw new Error('No credential received from Google');
      }
      
      const result = await loginWithGoogle(response.credential);
      if (result.success) {
        console.log('Google login successful, navigating to app');
        navigate('/app', { replace: true });
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('Google login error:', err);
      const errorMessage = err.message || 'Google login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Check Google OAuth configuration
  const checkGoogleConfig = async () => {
    try {
      const response = await fetch(getApiUrl('auth/google/config'));
      const data = await response.json();
      console.log('Google OAuth config check:', data);
      return data;
    } catch (error) {
      console.error('Failed to check Google OAuth config:', error);
      return { success: false, error: 'Config check failed' };
    }
  };

  // Handle Google Sign-In button click
  const handleGoogleLogin = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
    
    if (clientId === 'your-google-client-id') {
      setError('Google OAuth not configured. Please contact administrator.');
      return;
    }

    // Check backend configuration first
    const configCheck = await checkGoogleConfig();
    if (!configCheck.success || !configCheck.google_configured) {
      setError('Google OAuth not properly configured on server. Please contact administrator.');
      return;
    }

    try {
      console.log('Initiating Google Sign-In for client ID:', clientId);
      setGoogleLoading(true);
      setError('');

      // Use Google Sign-In JavaScript library to show popup
      if (window.google && window.google.accounts) {
        // Initialize with Gmail scopes
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose'
        });

        // Show the Google Sign-In popup
        window.google.accounts.id.prompt((notification) => {
          console.log('Google prompt notification:', notification);
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('Google prompt was not displayed or skipped');
            setGoogleLoading(false);
            setError('Google Sign-In popup was blocked or not available. Please try again.');
          }
        });
      } else {
        throw new Error('Google Sign-In library not loaded');
      }
      
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setError('Google authentication failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            placeholder="Enter your email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            placeholder="Enter your password"
          />
        </div>
        <button type="submit" disabled={loading} className="login-button">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <div className="divider">
        <span>OR</span>
      </div>
      
      <button 
        type="button" 
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        className="google-login-button"
      >
        {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
      </button>
      <div className="login-links-container">
        <button
          type="button"
          onClick={() => navigate('/privacy-policy')}
        >
          Privacy Policy
        </button>
        <button
          type="button"
          onClick={() => navigate('/terms-and-conditions')}
        >
          Terms & Conditions
        </button>
      </div>
    </div>
  );
}

export default Login;