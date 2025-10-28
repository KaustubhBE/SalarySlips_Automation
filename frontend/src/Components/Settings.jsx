import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import ClientOnly from './ClientOnly';
import { getApiUrl, ENDPOINTS } from '../config';
import axios from 'axios';
import './Settings.css';
import PasswordToggle from './Password-Toggle';

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
                  <PasswordToggle
                    id="new-password"
                    name="new-password"
                    value={newPassword}
                    onChange={handleNewPasswordChange}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <PasswordToggle
                    id="confirm-password"
                    name="confirm-password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder="Re-enter new password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="current-password">Old Password</label>
                  <PasswordToggle
                    id="current-password"
                    name="current-password"
                    value={currentPassword}
                    onChange={handleCurrentPasswordChange}
                    required
                    className="form-input"
                    placeholder="Enter Old password"
                  />
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
