import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css'; // Import the CSS file

// Base URL for API calls
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Define available permissions for the two main activities
const PERMISSIONS = {
  SINGLE_PROCESSING: 'single_processing',
  BATCH_PROCESSING: 'batch_processing',
  REPORT_ACCESS: 'report_access'
};

// Permission descriptions
const PERMISSION_DESCRIPTIONS = {
  [PERMISSIONS.SINGLE_PROCESSING]: 'Process individual salary slips one at a time',
  [PERMISSIONS.BATCH_PROCESSING]: 'Process multiple salary slips in batch',
  [PERMISSIONS.REPORT_ACCESS]: 'Access and generate reports'
};

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [permissions, setPermissions] = useState(Object.values(PERMISSIONS).reduce((acc, perm) => ({ ...acc, [perm]: false }), {}));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  // Set default permissions when role changes
  useEffect(() => {
    if (role === 'super-admin') {
      setPermissions(Object.values(PERMISSIONS).reduce((acc, perm) => ({ ...acc, [perm]: true }), {}));
    } else if (role === 'admin') {
      setPermissions({
        [PERMISSIONS.SINGLE_PROCESSING]: true,
        [PERMISSIONS.BATCH_PROCESSING]: true,
        [PERMISSIONS.REPORT_ACCESS]: false  // Admin needs explicit permission for reports
      });
    } else {
      setPermissions({
        [PERMISSIONS.SINGLE_PROCESSING]: true,
        [PERMISSIONS.BATCH_PROCESSING]: false,
        [PERMISSIONS.REPORT_ACCESS]: false
      });
    }
  }, [role]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/get_users`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (Array.isArray(response.data)) {
        // Use the Firestore document ID directly
        const usersWithIds = response.data.map(user => ({
          ...user,
          // Ensure we use the Firestore document ID
          id: user.docId || user.id  // Use docId from backend, fallback to id if present
        }));
        setUsers(usersWithIds);
        setError('');
      } else {
        setError('Unexpected response format');
        setUsers([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching users');
      setUsers([]);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/add_user`, 
        { 
          username, 
          email, 
          password, 
          role,
          permissions 
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.message) {
        setSuccess(response.data.message);
        setError('');
        fetchUsers();
        // Clear form
        setUsername('');
        setEmail('');
        setPassword('');
        setRole('user');
        setPermissions({
          [PERMISSIONS.SINGLE_PROCESSING]: true,
          [PERMISSIONS.BATCH_PROCESSING]: false,
          [PERMISSIONS.REPORT_ACCESS]: false
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error adding user');
      setSuccess('');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/delete_user`, 
        { user_id: userId },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error deleting user');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/update_role`, 
        { 
          user_id: userId, 
          role: newRole
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating role');
    }
  };

  const handleUpdatePermissions = async (userId, updatedPermissions) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/update_permissions`, 
        { 
          user_id: userId, 
          permissions: updatedPermissions
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating permissions');
    }
  };

  const handlePermissionChange = (permission) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  return (
    <div className="dashboard-container">
      <h1>User Management</h1>
      
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      
      <div className="users-list">
        <h2>Current Users</h2>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Processing Access</th>
              <th>Report Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <select
                    className="role-select"
                    value={user.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      handleRoleChange(user.id, newRole);
                    }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super-admin">Super Admin</option>
                  </select>
                </td>
                <td className="permissions-cell">
                  <div className="permissions-grid">
                    {Object.entries(PERMISSIONS)
                      .filter(([key]) => key !== 'REPORT_ACCESS')
                      .map(([key, value]) => (
                        <div key={`${user.id}-${value}`} className="permission-item">
                          <label title={PERMISSION_DESCRIPTIONS[value]}>
                            <input
                              type="checkbox"
                              checked={user.permissions?.[value] || false}
                              onChange={() => {
                                const updatedPermissions = {
                                  ...(user.permissions || {}),
                                  [value]: !(user.permissions?.[value] || false)
                                };
                                handleUpdatePermissions(user.id, updatedPermissions);
                              }}
                              disabled={user.role === 'super-admin' && user.id !== 'super-admin'}
                            />
                            {key === 'SINGLE_PROCESSING' ? 'Single Processing' : 'Batch Processing'}
                          </label>
                        </div>
                    ))}
                  </div>
                </td>
                <td className="permissions-cell">
                  <div className="permissions-grid">
                    <div className="permission-item">
                      <label title={PERMISSION_DESCRIPTIONS[PERMISSIONS.REPORT_ACCESS]}>
                        <input
                          type="checkbox"
                          checked={user.permissions?.[PERMISSIONS.REPORT_ACCESS] || false}
                          onChange={() => {
                            const updatedPermissions = {
                              ...(user.permissions || {}),
                              [PERMISSIONS.REPORT_ACCESS]: !(user.permissions?.[PERMISSIONS.REPORT_ACCESS] || false)
                            };
                            handleUpdatePermissions(user.id, updatedPermissions);
                          }}
                          disabled={role === 'super-admin' && user.id !== 'super-admin'}
                        />
                        Report Access
                      </label>
                    </div>
                  </div>
                </td>
                <td>
                  <button 
                    className="action-button delete-button"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="add-user-form">
        <h2>Add New User</h2>
        <form onSubmit={handleAddUser}>
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="role">Base Role:</label>
            <select 
              id="role" 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super-admin">Super Admin</option>
            </select>
          </div>

          <div className="form-group permissions-section">
            <label>Processing Access:</label>
            <div className="permissions-grid">
              {Object.entries(PERMISSIONS)
                .filter(([key]) => key !== 'REPORT_ACCESS')
                .map(([key, value]) => (
                  <div key={value} className="permission-item">
                    <label title={PERMISSION_DESCRIPTIONS[value]}>
                      <input
                        type="checkbox"
                        checked={permissions[value]}
                        onChange={() => handlePermissionChange(value)}
                        disabled={role === 'super-admin' && user.id !== 'super-admin'}
                      />
                      {key === 'SINGLE_PROCESSING' ? 'Single Processing' : 'Batch Processing'}
                    </label>
                  </div>
              ))}
            </div>
          </div>

          <div className="form-group permissions-section">
            <label>Report Access:</label>
            <div className="permissions-grid">
              <div className="permission-item">
                <label title={PERMISSION_DESCRIPTIONS[PERMISSIONS.REPORT_ACCESS]}>
                  <input
                    type="checkbox"
                    checked={permissions[PERMISSIONS.REPORT_ACCESS]}
                    onChange={() => handlePermissionChange(PERMISSIONS.REPORT_ACCESS)}
                    disabled={role === 'super-admin' && user.id !== 'super-admin'}
                  />
                  Report Access
                </label>
              </div>
            </div>
          </div>
          
          <button type="submit">Add User</button>
        </form>
      </div>
    </div>
  );
}

export default Dashboard;