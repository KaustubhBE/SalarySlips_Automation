import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { getApiUrl } from './config.js';
import "./Login.css"

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('normal'); // 'normal' or 'gauth'
  const [googleToken, setGoogleToken] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const codeClientRef = useRef(null);

  // Google Login logic
  const GOOGLE_CLIENT_ID = '579518246340-0673etiich0q7ji2q6imu7ln525554ab.apps.googleusercontent.com'; 

  useEffect(() => {
    // Load GIS script if not present
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initCodeClient;
      document.body.appendChild(script);
    } else {
      initCodeClient();
    }

    function initCodeClient() {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/gmail.send email profile openid',
          ux_mode: 'popup',
          callback: (response) => {
            if (response.code) {
              // Try to extract email from id_token if available
              let email = '';
              if (response.id_token) {
                try {
                  const base64Url = response.id_token.split('.')[1];
                  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                  const userData = JSON.parse(window.atob(base64));
                  email = userData.email || '';
                } catch (e) {
                  email = '';
                }
              }
              handleGmailOAuthSuccess(response.code, email);
            } else {
              alert('Google authentication failed.');
            }
          }
        });
      }
    }
    // eslint-disable-next-line
  }, []);

  function handleCredentialResponse(response) {
    const base64Url = response.credential.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const userData = JSON.parse(window.atob(base64));
    setLoginType('gauth');
    setGoogleToken(response.credential); // Save the Google token
    // Immediately send to backend for verification and session
    handleGoogleBackendLogin(userData.email, response.credential);
  }

  async function handleGoogleBackendLogin(email, token) {
    setError('');
    setLoading(true);
    try {
      const apiUrl = getApiUrl('auth/login');
      const loginData = {
        email: email.trim(),
        login_type: 'gauth',
        token: token,
      };
      const response = await axios({
        method: 'post',
        url: apiUrl,
        data: loginData,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: true,
        timeout: 5000
      });
      if (response.data?.success && response.data?.user) {
        const userData = response.data.user;
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        login(userData);
        navigate('/app', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.status === 401) {
        setError('Invalid email or Google account');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Please try again.');
      } else if (!err.response) {
        setError('Unable to connect to the server. Please try again.');
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGmailOAuthSuccess(code, email) {
    setError('');
    setLoading(true);
    try {
      const apiUrl = getApiUrl('auth/login');
      const response = await axios.post(apiUrl, {
        email,
        code,
        login_type: 'gauth'
      }, { withCredentials: true });
      if (response.data?.success && response.data?.user) {
        const userData = response.data.user;
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        login(userData);
        navigate('/app', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError('Google OAuth failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const apiUrl = getApiUrl('auth/login');
      
      // Validate inputs
      if (!email) {
        setError('Email is required');
        setLoading(false);
        return;
      }
      if (loginType === 'normal' && !password) {
        setError('Password is required for normal login');
        setLoading(false);
        return;
      }

      // Create the request payload
      const loginData = {
        email: email.trim(),
        login_type: loginType,
        password: loginType === 'normal' ? password : undefined,
        token: loginType === 'gauth' ? googleToken : undefined,
      };

      // Make the request
      const response = await axios({
        method: 'post',
        url: apiUrl,
        data: loginData,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: true,
        timeout: 5000
      });

      // Check if we have a successful response with user data
      if (response.data?.success && response.data?.user) {
        const userData = response.data.user;
        
        // Store authentication data
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        
        // Update auth context
        login(userData);
        
        // Navigate to app
        navigate('/app', { replace: true });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Please try again.');
      } else if (!err.response) {
        setError('Unable to connect to the server. Please try again.');
      } else {
        setError('An error occurred during login. Please try again.');
      }
    } finally {
      setLoading(false);
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
            disabled={loading || loginType === 'gauth'}
            required
            placeholder="Enter your email"
          />
        </div>
        {loginType === 'normal' && (
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
        )}
        <button type="submit" disabled={loading} className="login-button">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {/* Google Sign-In button for OAuth and Gmail API */}
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          color: '#3c4043',
          border: '1px solid #dadce0',
          borderRadius: '4px',
          fontWeight: 500,
          fontSize: '16px',
          padding: '0 24px 0 12px',
          height: '44px',
          boxShadow: 'none',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s',
          outline: 'none',
          minWidth: '240px',
          margin: '12px 0',
        }}
        onClick={() => {
          if (codeClientRef.current) {
            codeClientRef.current.requestCode();
          } else {
            alert('Google API not loaded yet. Please wait a moment and try again.');
          }
        }}
      >
        <img
          style={{
            width: '24px',
            height: '24px',
            marginRight: '12px',
            background: 'transparent',
          }}
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google logo"
        />
        Sign in with Google (Gmail API)
      </button>
      {/* Privacy Policy and Terms & Conditions links */}
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