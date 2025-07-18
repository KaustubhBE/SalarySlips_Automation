import React, { useState, useEffect, useRef } from 'react';
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
  const navigate = useNavigate();
  const { login } = useAuth();
  const codeClientRef = useRef(null);
  const [pendingLogin, setPendingLogin] = useState(false);
  const pendingCredsRef = useRef({ email: '', password: '' });

  // Google OAuth client ID
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
              handleCombinedLogin(response.code);
            } else {
              setError('Google authentication failed.');
              setLoading(false);
              setPendingLogin(false);
            }
          }
        });
      }
    }
    // eslint-disable-next-line
  }, []);

  // This function is called after Google OAuth is successful
  async function handleCombinedLogin(gauthCode) {
    setError('');
    setLoading(true);
    try {
      const apiUrl = getApiUrl('auth/login');
      // Use the email/password at the time of login button click
      const { email: pendingEmail, password: pendingPassword } = pendingCredsRef.current;
      const payload = {
        email: pendingEmail.trim(),
        password: pendingPassword,
        login_type: 'gauth',
        code: gauthCode
      };
      if (!payload.email || !payload.password) {
        setError('Email and password are required.');
        setLoading(false);
        setPendingLogin(false);
        return;
      }
      const response = await axios.post(apiUrl, payload, { withCredentials: true });
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
      setError('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
      setPendingLogin(false);
    }
  }

  // Handler for the Login button
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
    setPendingLogin(true);
    // Store the current email and password for use after OAuth
    pendingCredsRef.current = { email, password };
    // Start Google OAuth code flow
    if (codeClientRef.current) {
      codeClientRef.current.requestCode();
    } else {
      setError('Google API not loaded yet. Please wait a moment and try again.');
      setLoading(false);
      setPendingLogin(false);
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
        <button type="submit" disabled={loading || pendingLogin} className="login-button">
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
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