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
  const [passwordMismatchError, setPasswordMismatchError] = useState("");
  const [passwordValidationErrors, setPasswordValidationErrors] = useState([]);
  const [showPasswordChangeConfirm, setShowPasswordChangeConfirm] = useState(false);
  const [passwordChangeRequest, setPasswordChangeRequest] = useState(null);

  if (!user) {
    return <div className="settings-container"><p>Loading...</p></div>;
  }

  // Validate password requirements
  const validatePassword = (password) => {
    const errors = [];
    
    if (!password || password.length < 6) {
      errors.push('Minimum 6 characters required');
    }
    
    if (password && !/[A-Z]/.test(password)) {
      errors.push('At least one capital letter required');
    }
    
    if (password && !/[0-9]/.test(password)) {
      errors.push('At least one number required');
    }
    
    if (password && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('At least one special character required');
    }
    
    return errors;
  };

  const handleUpdatePassword = () => {
    setShowPasswordInput(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowCurrentPassword(false);
    setPasswordMismatchError("");
    setPasswordValidationErrors([]);
  };

  const handleCurrentPasswordChange = (e) => {
    setCurrentPassword(e.target.value);
  };

  const handleNewPasswordChange = (e) => {
    const newPasswordValue = e.target.value;
    setNewPassword(newPasswordValue);
    
    // Real-time password validation
    if (newPasswordValue.length === 0) {
      setPasswordValidationErrors([]);
    } else {
      const validationErrors = validatePassword(newPasswordValue);
      setPasswordValidationErrors(validationErrors);
    }
    
    // Real-time validation
    if (newPasswordValue && confirmPassword) {
      if (newPasswordValue !== confirmPassword) {
        setPasswordMismatchError("Passwords do not match");
      } else {
        setPasswordMismatchError("");
      }
    } else {
      setPasswordMismatchError("");
    }
  };

  const handleConfirmPasswordInputChange = (e) => {
    setConfirmPassword(e.target.value);
    // Real-time validation
    if (e.target.value && newPassword) {
      if (e.target.value !== newPassword) {
        setPasswordMismatchError("Passwords do not match");
      } else {
        setPasswordMismatchError("");
      }
    } else {
      setPasswordMismatchError("");
    }
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

    // Validate password requirements
    const validationErrors = validatePassword(newPassword);
    if (validationErrors.length > 0) {
      setPasswordValidationErrors(validationErrors);
      alert('⚠️ Password does not meet requirements. Please check the error messages below.');
      return;
    }

    if (!confirmPassword.trim()) {
      alert('⚠️ Please re-enter your new password.');
      return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordMismatchError("Passwords do not match");
      alert('⚠️ New password and confirm password do not match.');
      return;
    }

    // Clear mismatch error and validation errors if passwords match
    if (passwordMismatchError) {
      setPasswordMismatchError("");
    }
    setPasswordValidationErrors([]);

    // Show confirmation modal
    setPasswordChangeRequest({
      userName: user.username,
      userEmail: user.email
    });
    setShowPasswordChangeConfirm(true);
  };

  const handleConfirmPasswordChange = async () => {
    if (!passwordChangeRequest) return;
    
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
        setPasswordMismatchError("");
        setPasswordValidationErrors([]);
      } else {
        alert(response.data?.error || '⚠️ Failed to update password.');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error updating password.');
    } finally {
      setShowPasswordChangeConfirm(false);
      setPasswordChangeRequest(null);
    }
  };

  const handleCancelPasswordChange = () => {
    setShowPasswordChangeConfirm(false);
    setPasswordChangeRequest(null);
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
                  <label htmlFor="current-password">Current Password</label>
                  <PasswordToggle
                    id="current-password"
                    name="current-password"
                    value={currentPassword}
                    onChange={handleCurrentPasswordChange}
                    required
                    className="form-input"
                    placeholder="Enter Current password"
                  />
                </div>
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
                  {passwordValidationErrors.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#ffebee',
                      border: '1px solid #ffcdd2',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#c62828'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>⚠️</span>
                        <span>Password requirements:</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {passwordValidationErrors.map((error, index) => (
                          <li key={index} style={{ marginBottom: '2px' }}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <PasswordToggle
                    id="confirm-password"
                    name="confirm-password"
                    value={confirmPassword}
                    onChange={handleConfirmPasswordInputChange}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder="Re-enter new password"
                  />
                  {passwordMismatchError && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#ffebee',
                      border: '1px solid #ffcdd2',
                      borderRadius: '4px',
                      color: '#c62828',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '14px' }}>⚠️</span>
                      <span>{passwordMismatchError}</span>
                    </div>
                  )}
                </div>
                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!newPassword || passwordValidationErrors.length > 0 || newPassword !== confirmPassword}
                  >
                    Update Password
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowPasswordInput(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setShowCurrentPassword(false);
                    setPasswordMismatchError("");
                    setPasswordValidationErrors([]);
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

      {/* Password Change Confirmation Modal */}
      {showPasswordChangeConfirm && passwordChangeRequest && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCancelPasswordChange()}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-modal-header">
              <h3>⚠️ Confirm Password Change</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCancelPasswordChange}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="delete-modal-body">
              <div className="warning-icon">
                <i className="warning-symbol">⚠️</i>
              </div>
              <div className="delete-message">
                <p className="delete-question">
                  Are you sure you want to change your password?
                </p>
                <div className="user-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{passwordChangeRequest.userEmail}</span>
                  </div>
                </div>
                <div className="warning-text">
                  <strong>This change affects your login access immediately.</strong>
                </div>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="confirm-delete-btn"
                onClick={handleConfirmPasswordChange}
                title="Confirm password change"
              >
                Yes, Change Password
              </button>
              <button
                className="cancel-delete-btn"
                onClick={handleCancelPasswordChange}
                title="Cancel password change"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </ClientOnly>
  );
}

export default Settings;
