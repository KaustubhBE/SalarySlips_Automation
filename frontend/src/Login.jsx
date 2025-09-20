import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { getApiUrl } from './config.js';
import { useGoogleAuth } from './Gauth/useGoogleAuth.js';
import oauthService from './Gauth/oauthService.js';
import "./Login.css"

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Use the Google Auth hook
  const { 
    loading: googleLoading, 
    error: googleError, 
    isProcessing, 
    isOAuthCallback,
    initiateGoogleAuth,
    clearError: clearGoogleError 
  } = useGoogleAuth();

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


  // Clear Google error when regular login form is used
  const handleFormFocus = () => {
    if (googleError) {
      clearGoogleError();
    }
  };



  // Handle Google Sign-In button click
  const handleGoogleLogin = async () => {
    try {
      await initiateGoogleAuth();
    } catch (error) {
      console.error('Google OAuth error:', error);
      setError('Google authentication failed. Please try again.');
    }
  };

  // Display error from either regular login or Google OAuth
  const displayError = error || googleError;
  
  // Show OAuth processing UI if this is a callback
  if (isOAuthCallback || isProcessing) {
    return (
      <div className="login-container" style={{ textAlign: 'center', padding: '50px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
        </div>
        <h3>Processing Google Authentication...</h3>
        <p>Please wait while we complete your login.</p>
        <p style={{ fontSize: '14px', color: '#666' }}>You will be redirected automatically.</p>
        
        {displayError && (
          <div className="error-message" style={{ marginTop: '20px' }}>
            {displayError}
          </div>
        )}
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => {
              console.log('=== OAUTH DEBUG INFO ===');
              console.log('Current URL:', window.location.href);
              console.log('LocalStorage oauth_result:', localStorage.getItem('oauth_result'));
              console.log('LocalStorage oauth_state:', localStorage.getItem('oauth_state'));
              console.log('Is OAuth callback:', isOAuthCallback);
              console.log('Is processing:', isProcessing);
              console.log('=== END DEBUG INFO ===');
            }}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Debug Info
          </button>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h2>Login</h2>
      {displayError && <div className="error-message">{displayError}</div>}
      <form onSubmit={handleLogin} onFocus={handleFormFocus}>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
            required
            placeholder="Enter your password"
          />
        </div>
        <button type="submit" disabled={loading || googleLoading} className="login-button">
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