import React from 'react';
import { useAuth } from './AuthContext';
import ClientOnly from './ClientOnly';
import './Settings.css';

function Settings({ onLogout }) {
  const { user } = useAuth();

  if (!user) {
    return <div className="settings-container"><p>Loading...</p></div>;
  }

  return (
    <ClientOnly fallback={<div className="settings-container">Loading...</div>}>
      <div className="settings-container">
        <h2>Settings</h2>
        <div className="user-info">
          <h3>Account Information</h3>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Role:</strong> {user.role}</p>
          <p><strong>Authentication:</strong> Google Account</p>
        </div>

        <button className="button logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </ClientOnly>
  );
}

export default Settings;