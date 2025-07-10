import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { getApiUrl } from './config.js';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('normal'); // 'normal' or 'gauth'
  const [googleToken, setGoogleToken] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  // Google Login logic
  const GOOGLE_CLIENT_ID = '579518246340-0673etiich0q7ji2q6imu7ln525554ab.apps.googleusercontent.com'; 

  useEffect(() => {
    // Dynamically load the Google Identity Services script if not present
    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          scope: 'https://www.googleapis.com/auth/gmail.send',
          ux_mode: 'popup', // Required for additional scopes
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large' }
        );
      };
      document.body.appendChild(script);
    } else {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        ux_mode: 'popup', // Required for additional scopes
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large' }
      );
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
      {/* Google Sign-In button rendered here */}
      <div id="google-signin-btn"></div>
    </div>
  );
}

export default Login;