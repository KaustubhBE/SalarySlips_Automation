import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import ClientOnly from './ClientOnly';
import { getApiUrl, ENDPOINTS, DEFAULT_WHATSAPP_URL } from '../config';
import axios from 'axios';
import './Settings.css';

function Settings({ onLogout }) {
  const { user } = useAuth();
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // Get the correct user identifier (email is preferred, fallback to username)
  const getUserIdentifier = () => {
    if (!user) return null;
    
    // Prefer email over username for WhatsApp authentication
    if (user.email && user.email.trim()) {
      return user.email.trim();
    }
    
    // Fallback to username if no email
    if (user.username && user.username.trim()) {
      return user.username.trim();
    }
    
    // Last resort fallback
    if (user.id && user.id.trim()) {
      return user.id.trim();
    }
    
    return null;
  };

  // Enhanced logout function that also cleans up WhatsApp session
  const handleEnhancedLogout = async () => {
    try {
      // Always attempt to clean up WhatsApp session if we have a user identifier
      const userIdentifier = getUserIdentifier();
      if (userIdentifier) {
        try {
          console.log('Cleaning up WhatsApp session during settings logout...');
          const response = await fetch(`${DEFAULT_WHATSAPP_URL}/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'X-User-Email': userIdentifier
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('WhatsApp session cleanup result:', result);
            if (result.success) {
              console.log('WhatsApp session cleaned up successfully');
            } else {
              console.warn('WhatsApp session cleanup failed:', result.message);
            }
          } else {
            console.warn('WhatsApp session cleanup failed with status:', response.status);
          }
        } catch (whatsappError) {
          console.warn('Failed to clean up WhatsApp session:', whatsappError);
          // Continue with general logout even if WhatsApp cleanup fails
        }
      } else {
        console.log('No user identifier available for WhatsApp session cleanup');
      }
    } catch (error) {
      console.warn('Error during WhatsApp session cleanup:', error);
      // Continue with general logout even if cleanup fails
    }
    
    // Perform general logout
    await onLogout();
  };

  if (!user) {
    return <div className="settings-container"><p>Loading...</p></div>;
  }

  const handleUpdatePassword = () => {
    setShowPasswordInput(true);
    setPasswordMessage('');
  };

  const handlePasswordChange = (e) => {
    setNewPassword(e.target.value);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage('');

    try {
      const response = await axios.post(
        getApiUrl(ENDPOINTS.CHANGE_PASSWORD),
        {
          email: user.email,
          newPassword: newPassword
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (response.data?.message) {
        setPasswordMessage('Password updated successfully.');
        setShowPasswordInput(false);
        setNewPassword('');
      } else {
        setPasswordMessage(response.data?.error || '⚠️ Failed to update password.');
      }
    } catch (err) {
      setPasswordMessage(
        err.response?.data?.error || 'Error updating password.'
      );
    }
  };

  return (
    <ClientOnly fallback={<div className="settings-container">Loading...</div>}>
      <div className="settings-container">
        <h2>Settings</h2>
        <div className="user-info">
          <h3>Account Information</h3>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role}</p>
        </div>

        {showPasswordInput ? (
          <form className="update-password" onSubmit={handlePasswordSubmit}>
            <label htmlFor="new-password">New Password:</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={handlePasswordChange}
              required
              minLength={6}
              className="password-input"
            />
            <div className="password-buttons">
              <button type="submit" className="save-password-button">Save Password</button>
              <button type="button" className="cancel-password-button" onClick={() => setShowPasswordInput(false)}>
                Cancel
              </button>
            </div>
            {passwordMessage && <div className="password-message">{passwordMessage}</div>}
          </form>
        ) : (
          <button
            className="update-password-button"
            onClick={handleUpdatePassword}
          >
            Update Password
          </button>
        )}

        <button className="button logout-button" onClick={handleEnhancedLogout}>
          Logout
        </button>

        {passwordMessage && !showPasswordInput && (
          <div className="password-message">{passwordMessage}</div>
        )}
      </div>
    </ClientOnly>
  );
}

export default Settings;
