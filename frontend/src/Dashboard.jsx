import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  getApiUrl, 
  ENDPOINTS, 
  FACTORY_NAMES,
  FACTORY_RBAC_CONFIG
} from './config';
import { useAuth } from './Components/AuthContext';
import TreePermissions from './Components/TreePermissions';
import './Dashboard.css';




function Dashboard() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingAppPassword, setEditingAppPassword] = useState("");
  const [editingPermissions, setEditingPermissions] = useState({});
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    console.log('Dashboard component mounted, fetching users...');
    fetchUsers();
  }, []);



  // Auto-clear success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handle Escape key to close permissions modal
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && showPermissionsModal) {
        handleCancelEdit();
      }
    };

    if (showPermissionsModal) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
      
      const firstFocusableElement = document.querySelector('.permissions-modal button, .permissions-modal input, .permissions-modal select');
      if (firstFocusableElement) {
        firstFocusableElement.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [showPermissionsModal]);

  const fetchUsers = async (retryCount = 0) => {
    const maxRetries = 3;
    try {
      console.log(`Fetching users... (attempt ${retryCount + 1}/${maxRetries + 1})`);
      
      const response = await axios.get(getApiUrl(ENDPOINTS.GET_USERS), {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Raw API response:', response);
      console.log('Response data:', response.data);
      console.log('Response data type:', typeof response.data);
      console.log('Is array:', Array.isArray(response.data));
      
      if (Array.isArray(response.data)) {
        const usersWithIds = response.data.map((user, index) => {
          const processedUser = {
            ...user,
            id: user.docId || user.id || `user_${index}` // Fallback ID if none exists
          };
          
          // Ensure permissions exists
          if (!processedUser.permissions) {
            processedUser.permissions = {};
          }
          
          return processedUser;
        });
        
        console.log(`Successfully fetched ${usersWithIds.length} users:`, usersWithIds);
        
        // Debug: Log detailed info for each user
        usersWithIds.forEach((user, index) => {
          console.log(`User ${index + 1}:`, {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            permission_metadata: user.permission_metadata,
            hasPermissionMetadata: user.permission_metadata && Object.keys(user.permission_metadata).length > 0
          });
        });
        
        setUsers(usersWithIds);
        setError('');
        
        // Verify all users were loaded
        if (usersWithIds.length === 0) {
          console.warn('No users found in response');
          setError('No users found');
        } else {
          console.log(`✅ Successfully loaded ${usersWithIds.length} users`);
        }
        
      } else {
        console.error('Unexpected response format:', response.data);
        setError(`Unexpected response format: ${typeof response.data}`);
        setUsers([]);
      }
    } catch (err) {
      console.error(`Error fetching users (attempt ${retryCount + 1}):`, err);
      
      if (retryCount < maxRetries) {
        console.log(`Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          fetchUsers(retryCount + 1);
        }, 2000);
      } else {
        const errorMessage = err.response?.data?.error || err.message || 'Error fetching users';
        console.error('Final error after all retries:', errorMessage);
        setError(`Failed to fetch users after ${maxRetries + 1} attempts: ${errorMessage}`);
        setUsers([]);
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.DELETE_USER), 
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
        // Refresh users list after successful deletion
        setTimeout(() => {
          fetchUsers();
        }, 500);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error deleting user');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_ROLE), 
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
        // Refresh users list after successful role update
        setTimeout(() => {
          fetchUsers();
        }, 500);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating role');
    }
  };

  // Convert tree permissions to permission_metadata format
  const convertTreePermissionsToMetadata = (treePermissions) => {
    const permissionMetadata = {
      factories: [],
      departments: {},
      services: {}
    };

    // Process each tree permission key (e.g., "gulbarga.humanresource.single_processing")
    Object.keys(treePermissions).forEach(key => {
      if (treePermissions[key] === true) {
        const parts = key.split('.');
        if (parts.length >= 3) {
          const factory = parts[0];
          const department = parts[1];
          const service = parts[2];

          // Add factory to factories array
          if (!permissionMetadata.factories.includes(factory)) {
            permissionMetadata.factories.push(factory);
          }

          // Add department to factory with factory short form prefix
          if (!permissionMetadata.departments[factory]) {
            permissionMetadata.departments[factory] = [];
          }
          
          // Get factory short form from FACTORY_RBAC_CONFIG
          const factoryConfig = FACTORY_RBAC_CONFIG[factory];
          const factoryShortForm = factoryConfig?.document_name?.toLowerCase() || factory;
          
          const prefixedDepartment = `${factoryShortForm}_${department}`;
          if (!permissionMetadata.departments[factory].includes(prefixedDepartment)) {
            permissionMetadata.departments[factory].push(prefixedDepartment);
          }

          // Add service to department
          const serviceKey = `${factory}.${department}`;
          if (!permissionMetadata.services[serviceKey]) {
            permissionMetadata.services[serviceKey] = [];
          }
          if (!permissionMetadata.services[serviceKey].includes(service)) {
            permissionMetadata.services[serviceKey].push(service);
          }
        }
      }
    });

    return permissionMetadata;
  };

  const handleUpdatePermissions = async (userId, updatedPermissions) => {
    try {
      // Convert tree permissions to permission_metadata format
      const permissionMetadata = convertTreePermissionsToMetadata(updatedPermissions);
      
      // Prepare permissions data with permission_metadata only
      const permissionsData = {
          user_id: userId, 
          permission_metadata: permissionMetadata
      };
      
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_PERMISSIONS), 
        permissionsData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        setShowPermissionsModal(false);
        setEditingPermissions({});
        setSelectedUser(null);
        // Refresh users list after successful permission update
        setTimeout(() => {
          fetchUsers();
        }, 500);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating permissions');
    }
  };

  const handleEditPermissionChange = (permissionKey, value) => {
    setEditingPermissions(prevPermissions => {
      const updatedPermissions = { ...prevPermissions };
      if (value) {
        updatedPermissions[permissionKey] = true;
      } else {
        delete updatedPermissions[permissionKey];
      }
      return updatedPermissions;
    });
  };

  // Batch permission update function
  const handleBatchPermissionChange = (permissionUpdates) => {
    setEditingPermissions(prevPermissions => {
      const updatedPermissions = { ...prevPermissions };
      
      permissionUpdates.forEach(({ key, value }) => {
        if (value) {
          updatedPermissions[key] = true;
        } else {
          delete updatedPermissions[key];
        }
      });
      
      return updatedPermissions;
    });
  };

  const handleEditAppPassword = (user) => {
    setEditingUserId(user.id);
    setEditingAppPassword("");
  };

  // Convert permission_metadata back to tree permissions format for editing
  const convertMetadataToTreePermissions = (permissionMetadata) => {
    const treePermissions = {};
    
    if (!permissionMetadata || !permissionMetadata.services) {
      return treePermissions;
    }
    
    // Convert services structure back to tree permissions
    Object.keys(permissionMetadata.services).forEach(serviceKey => {
      const services = permissionMetadata.services[serviceKey];
      services.forEach(service => {
        const treeKey = `${serviceKey}.${service}`;
        treePermissions[treeKey] = true;
      });
    });
    
    return treePermissions;
  };

  const handleEditPermissions = (user) => {
    setEditingUserId(user.id);
    setSelectedUser(user);
    
    // Load from permission_metadata only
    let permissions = {};
    
    if (user.permission_metadata && Object.keys(user.permission_metadata).length > 0) {
      // Convert permission_metadata to tree permissions format
      permissions = convertMetadataToTreePermissions(user.permission_metadata);
      console.log(`Loading permissions from permission_metadata for user ${user.username}:`, {
        permission_metadata: user.permission_metadata,
        converted_permissions: permissions
      });
    } else {
      console.log(`User ${user.username} has no permission_metadata set`);
    }
    
    // If user has no permissions at all, show a message
    const hasAnyPermissions = Object.keys(permissions).length > 0;
    if (!hasAnyPermissions) {
      console.log(`User ${user.username} has no permissions set`);
    }
    
    setEditingPermissions(permissions);
    setShowPermissionsModal(true);
  };

  const handleModalOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancelEdit();
    }
  };

  const handleSaveAppPassword = async (userId) => {
    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_APP_PASSWORD), {
        user_id: userId,
        appPassword: editingAppPassword
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data.message) {
        setSuccess(response.data.message);
        setError("");
        setEditingUserId(null);
        setEditingAppPassword("");
        // Refresh users list after successful password update
        setTimeout(() => {
          fetchUsers();
        }, 500);
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating app password');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingAppPassword("");
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
  };

  // Get current user info from auth context
  const getCurrentUserRole = () => {
    return currentUser?.role || 'user';
  };

  const getCurrentUserPermissions = () => {
    return currentUser?.permissions || {};
  };

  const hasUserPermission = (permission) => {
    return getCurrentUserPermissions()[permission] || false;
  };

  // Filter users based on current user's role
  const getFilteredUsers = () => {
    // Only admins can access this page, so return all users
      return users;
  };

  const canEditPermissions = (targetUserRole) => {
    // Use the new RBAC system - only admin can edit permissions
    return getCurrentUserRole() === 'admin';
  };

  const canEditRole = (targetUserRole) => {
    // Use the new RBAC system - only admin can edit roles
    return getCurrentUserRole() === 'admin';
  };

  const canEditPassword = (targetUserRole) => {
    // Use the new RBAC system - only admin can edit passwords
    return getCurrentUserRole() === 'admin';
  };

  const canDeleteUser = (targetUserRole) => {
    // Use the new RBAC system - only admin can delete users
    return getCurrentUserRole() === 'admin';
  };

  const canCreateRole = (targetRole) => {
    // Use the new RBAC system - only admin can create users
    return getCurrentUserRole() === 'admin';
  };

  return (
    <div className="dashboard-container centered">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>User Management Dashboard</h1>
          <div className="user-count">
            {getFilteredUsers().length} user{getFilteredUsers().length !== 1 ? 's' : ''} loaded
          </div>
        </div>
        <div className="dashboard-actions">
            <button 
              className="add-user-btn"
              onClick={() => window.location.href = '/add-user'}
            >
              Add New User
            </button>
        </div>
      </div>
      
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      
      <div className="users-list">
        <h2>Current Users</h2>
        <div className="users-table-container">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredUsers().map(user => (
                <React.Fragment key={user.id}>
                  <tr>
                    <td title={user.username}>{user.username}</td>
                    <td title={user.email}>{user.email}</td>
                    <td>
                      <select
                        className="role-select"
                        value={user.role}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          console.log('Role change for user:', user.email, 'from', user.role, 'to', newRole);
                          handleRoleChange(user.id, newRole);
                        }}
                        disabled={!canEditRole(user.role)}
                      >
                        <option value="user">User</option>
                        {getCurrentUserRole() === 'admin' && <option value="admin">Admin</option>}
                      </select>
                    </td>
                    <td>
                      <div className="user-actions-buttons">
                        {canEditPassword(user.role) && (
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditAppPassword(user)}
                            title="Edit Password"
                          >
                            Password
                          </button>
                        )}
                        {canEditPermissions(user.role) && (
                          <button
                            className="action-button permissions-button"
                            onClick={() => handleEditPermissions(user)}
                            title="Edit Permissions"
                          >
                            Permissions
                          </button>
                        )}
                        {canDeleteUser(user.role) && (
                          <button 
                            className="action-button delete-button"
                            onClick={() => handleDeleteUser(user.id)}
                            title="Delete User"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-app-password-inline">
                          <input
                            type="password"
                            placeholder="New App Password"
                            value={editingAppPassword}
                            onChange={e => setEditingAppPassword(e.target.value)}
                          />
                          <button
                            className="action-button edit-button"
                            onClick={() => handleSaveAppPassword(user.id)}
                            disabled={!editingAppPassword}
                          >
                            Save
                          </button>
                          <button
                            className="action-button delete-button"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simplified Permissions Modal */}
      {showPermissionsModal && selectedUser && (
        <div className="modal-overlay" onClick={handleModalOverlayClick}>
          <div className="modal-content permissions-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Permissions - {selectedUser.username}</h3>
              <div className="user-info">
                <span className="user-role">Role: {selectedUser.role === 'admin' ? 'Admin' : 'User'}</span>
                {Object.keys(editingPermissions).length === 0 && (
                  <div className="no-permissions-warning" style={{ 
                    color: '#ff6b6b', 
                    fontSize: '14px', 
                    marginTop: '5px',
                    fontStyle: 'italic'
                  }}>
                    ⚠️ This user currently has no permissions assigned
                  </div>
                )}
              </div>
              <button 
                className="modal-close-btn"
                onClick={handleCancelEdit}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <TreePermissions
              permissions={editingPermissions}
              onPermissionChange={handleEditPermissionChange}
              onBatchPermissionChange={handleBatchPermissionChange}
              isEditing={true}
              targetUserRole={selectedUser.role}
              currentUserRole={getCurrentUserRole()}
            />
            <div className="modal-actions">
              <button
                className="action-button edit-button"
                onClick={() => handleUpdatePermissions(editingUserId, editingPermissions)}
              >
                Save Permissions
              </button>
              <button
                className="action-button delete-button"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;