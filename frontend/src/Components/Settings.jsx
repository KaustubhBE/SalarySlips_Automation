import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import ClientOnly from './ClientOnly';
import { getApiUrl, ENDPOINTS } from '../config';
import axios from 'axios';
import './Settings.css';

function Settings({ onLogout }) {
  const { user } = useAuth();
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  if (!user) {
    return <div className="settings-container"><p>Loading...</p></div>;
  }

  const handleUpdatePassword = () => {
    setShowPasswordInput(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowCurrentPassword(false);
  };

  const handleCurrentPasswordChange = (e) => {
    setCurrentPassword(e.target.value);
  };

  const handleNewPasswordChange = (e) => {
    setNewPassword(e.target.value);
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    // Validate that all passwords are provided
    if (!currentPassword.trim()) {
      alert('⚠️ Please enter your current password.');
      return;
    }

    if (!newPassword.trim()) {
      alert('⚠️ Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      alert('⚠️ New password must be at least 6 characters long.');
      return;
    }

    if (!confirmPassword.trim()) {
      alert('⚠️ Please re-enter your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('⚠️ New password and confirm password do not match.');
      return;
    }

    try {
      const response = await axios.post(
        getApiUrl(ENDPOINTS.CHANGE_PASSWORD),
        {
          email: user.email,
          currentPassword: currentPassword,
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
        alert('✅ Password updated successfully.');
        setShowPasswordInput(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setShowCurrentPassword(false);
      } else {
        alert(response.data?.error || '⚠️ Failed to update password.');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error updating password.');
    }
  };

  return (
    <ClientOnly fallback={<div className="settings-container">Loading...</div>}>
      <div className="settings-container">
        <div className="settings-header">
          <h1>Settings</h1>
        </div>

        <div className="settings-content">
          <div className="account-section">
            <h2>Account Information</h2>
            <div className="account-details">
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{user.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Role</span>
                <span className="detail-value">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="password-section">
            <h2>Password Management</h2>
            {showPasswordInput ? (
              <form className="password-form" onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <div className="password-input-container">
                    <input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={handleNewPasswordChange}
                      required
                      minLength={6}
                      className="form-input"
                      placeholder="Enter new password (min 6 characters)"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <div className="password-input-container">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      required
                      minLength={6}
                      className="form-input"
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="current-password">Current Password</label>
                  <div className="password-input-container">
                    <input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={handleCurrentPasswordChange}
                      required
                      className="form-input"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      title={showCurrentPassword ? "Hide password" : "Show password"}
                    >
                      {showCurrentPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Update Password</button>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowPasswordInput(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setShowCurrentPassword(false);
                  }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn btn-outline" onClick={handleUpdatePassword}>
                Change Password
              </button>
            )}
          </div>

          <div className="actions-section">
            <button className="btn btn-danger" onClick={async () => await onLogout()}>
              Sign Out
            </button>
          </div>

        </div>
      </div>
    </ClientOnly>
  );
}

export default Settings;
