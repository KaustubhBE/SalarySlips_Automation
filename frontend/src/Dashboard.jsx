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
  const [editingWebsitePassword, setEditingWebsitePassword] = useState("");
  const [editingPermissions, setEditingPermissions] = useState({});
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserIdForActions, setSelectedUserIdForActions] = useState(null);
  const [editingWebsitePasswordUserId, setEditingWebsitePasswordUserId] = useState(null);
  const [showWebsitePassword, setShowWebsitePassword] = useState(false);
  const [showMailKey, setShowMailKey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userRoles, setUserRoles] = useState({});

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
        
        // Update user roles state for immediate UI updates
        const rolesState = {};
        usersWithIds.forEach(user => {
          rolesState[user.id] = user.role;
        });
        setUserRoles(rolesState);
        
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

  const handleDeleteUser = (userId) => {
    // Find the user to get their details for the confirmation message
    const user = users.find(user => user.id === userId);
    
    // Close any open actions first
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    setEditingUserId(null);
    setEditingAppPassword("");
    setShowMailKey(false);
    setEditingWebsitePasswordUserId(null);
    setEditingWebsitePassword("");
    setShowWebsitePassword(false);
    setSelectedUserIdForActions(null);
    
    // Show custom confirmation modal
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.DELETE_USER), 
        { user_id: userToDelete.id },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.data.message) {
        setSuccess(response.data.message);
        setShowDeleteConfirm(false);
        setUserToDelete(null);
        // Refresh users list immediately after successful deletion
        fetchUsers();
      } else {
        setError(response.data.error);
        setShowDeleteConfirm(false);
        setUserToDelete(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error deleting user');
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
  };

  const handleRoleChange = async (userId, newRole) => {
    // Find the user to get their details for the confirmation message
    const user = users.find(user => user.id === userId);
    const userName = user ? user.username : 'this user';
    const userEmail = user ? user.email : '';
    const currentRole = user ? user.role : '';
    
    // Show confirmation dialog
    const confirmMessage = `Are you sure you want to change ${userName}'s role?\n\nCurrent Role: ${currentRole}\nNew Role: ${newRole}\n\nEmail: ${userEmail}`;
    const confirmed = window.confirm(confirmMessage);
    
    if (!confirmed) {
      // If user cancels, reset the dropdown to current role
      setUserRoles(prev => ({
        ...prev,
        [userId]: currentRole
      }));
      return;
    }
    
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
        // Refresh the entire page instantly after successful role change
        window.location.reload();
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
        // Refresh users list immediately after successful permission update
        fetchUsers();
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
    // Close any other open actions first
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    setEditingWebsitePasswordUserId(null);
    setEditingWebsitePassword("");
    setShowWebsitePassword(false);
    
    // Open mail key editing
    setEditingUserId(user.id);
    setEditingAppPassword("");
    setShowMailKey(false);
    setSelectedUserIdForActions(null); // Clear mobile selection
  };

  const handleEditWebsitePassword = (user) => {
    // Close any other open actions first
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    setEditingUserId(null);
    setEditingAppPassword("");
    setShowMailKey(false);
    
    // Open website password editing
    setEditingWebsitePasswordUserId(user.id);
    setEditingWebsitePassword("");
    setShowWebsitePassword(false);
    setSelectedUserIdForActions(null); // Clear mobile selection
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
    // Close any other open actions first
    setEditingUserId(null);
    setEditingAppPassword("");
    setShowMailKey(false);
    setEditingWebsitePasswordUserId(null);
    setEditingWebsitePassword("");
    setShowWebsitePassword(false);
    
    // Open permissions modal
    setSelectedUser(user);
    setSelectedUserIdForActions(null); // Clear mobile selection
    
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
      // Find user to get their name for success message
      const user = users.find(user => user.id === userId);
      const userName = user ? user.username : 'user';
      
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_APP_PASSWORD), {
        user_id: userId,
        appPassword: editingAppPassword
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data.message) {
        alert(`✅ Mail key for user "${userName}" has been changed successfully!`);
        setError("");
        setEditingUserId(null);
        setEditingAppPassword("");
        // Refresh users list immediately after successful password update
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating app password');
    }
  };

  const handleSaveWebsitePassword = async (userId) => {
    try {
      // Find user to get their name for success message
      const user = users.find(user => user.id === userId);
      const userName = user ? user.username : 'user';
      
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_WEBSITE_PASSWORD), {
        user_id: userId,
        new_password: editingWebsitePassword
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data.message) {
        alert(`✅ Website password for user "${userName}" has been changed successfully!`);
        setError("");
        setEditingWebsitePasswordUserId(null);
        setEditingWebsitePassword("");
        // Refresh users list immediately after successful password update
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating website password');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingAppPassword("");
    setShowMailKey(false);
    setEditingWebsitePasswordUserId(null);
    setEditingWebsitePassword("");
    setShowWebsitePassword(false);
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    setSelectedUserIdForActions(null); // Clear mobile selection
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

  // Get admin users
  const getAdminUsers = () => {
    return users.filter(user => user.role === 'admin');
  };

  // Get regular users
  const getRegularUsers = () => {
    return users.filter(user => user.role === 'user');
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

  const handleUserRowClick = (userId) => {
    // Toggle selection: if the same user is clicked, deselect; otherwise select the new user
    setSelectedUserIdForActions(prevId => prevId === userId ? null : userId);
  };

  return (
    <div className="dashboard-container centered">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>User Management Dashboard</h1>
          <div className="user-count">
            {getAdminUsers().length} admin{getAdminUsers().length !== 1 ? 's' : ''} • {getRegularUsers().length} user{getRegularUsers().length !== 1 ? 's' : ''} loaded
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
      
      {/* Admin Users Table */}
      <div className="users-list admin-users-list">
        <h2>Admin</h2>
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
              {getAdminUsers().map(user => (
                <React.Fragment key={user.id}>
                  <tr 
                    className={`user-row ${selectedUserIdForActions === user.id ? 'user-row-selected' : ''}`}
                    onClick={() => handleUserRowClick(user.id)}
                  >
                    <td title={user.username}>{user.username}</td>
                    <td title={user.email}>{user.email}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="role-select"
                        value={userRoles[user.id] || user.role}
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
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className={`user-actions-buttons ${selectedUserIdForActions === user.id ? 'show-actions' : ''}`}>
                        {canEditPassword(user.role) && (
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditWebsitePassword(user)}
                            title="Edit Website Password"
                          >
                            Password
                          </button>
                        )}
                        {canEditPassword(user.role) && (
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditAppPassword(user)}
                            title="Edit Mail Key"
                          >
                            Mail Key
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
                  {/* Mobile actions row - shown when user is selected on mobile */}
                  {selectedUserIdForActions === user.id && (
                    <tr className="mobile-actions-row">
                      <td colSpan={4}>
                        <div className="mobile-user-actions-buttons">
                          {canEditPassword(user.role) && (
                            <button
                              className="action-button edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditWebsitePassword(user);
                              }}
                              title="Edit Website Password"
                            >
                              Password
                            </button>
                          )}
                          {canEditPassword(user.role) && (
                            <button
                              className="action-button edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAppPassword(user);
                              }}
                              title="Edit Mail Key"
                            >
                              Mail Key
                            </button>
                          )}
                          {canEditPermissions(user.role) && (
                            <button
                              className="action-button permissions-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPermissions(user);
                              }}
                              title="Edit Permissions"
                            >
                              Permissions
                            </button>
                          )}
                          {canDeleteUser(user.role) && (
                            <button 
                              className="action-button delete-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(user.id);
                              }}
                              title="Delete User"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-mail-key-container">
                          <div className="password-form-body">
                            <div className="password-input-group">
                              <label htmlFor={`mail-key-${user.id}`} className="password-label">
                                New Mail Key
                              </label>
                              <div className="password-input-container">
                                <input
                                  id={`mail-key-${user.id}`}
                                  type={showMailKey ? "text" : "password"}
                                  placeholder="Enter new mail key"
                                  value={editingAppPassword}
                                  onChange={e => setEditingAppPassword(e.target.value)}
                                  className="mail-key-input"
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="password-toggle-btn"
                                  onClick={() => setShowMailKey(!showMailKey)}
                                  title={showMailKey ? "Hide mail key" : "Show mail key"}
                                >
                                  {showMailKey ? (
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
                            <div className="password-form-actions">
                              <button
                                className="mail-key-save-btn"
                                onClick={() => handleSaveAppPassword(user.id)}
                                disabled={!editingAppPassword}
                                title="Save new mail key"
                              >
                                Save Mail Key
                              </button>
                              <button
                                className="mail-key-cancel-btn"
                                onClick={handleCancelEdit}
                                title="Cancel mail key change"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingWebsitePasswordUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-website-password-container">
                          <div className="password-form-body">
                            <div className="password-input-group">
                              <label htmlFor={`website-password-${user.id}`} className="password-label">
                                New Website Password
                              </label>
                              <div className="password-input-container">
                                <input
                                  id={`website-password-${user.id}`}
                                  type={showWebsitePassword ? "text" : "password"}
                                  placeholder="Enter new password"
                                  value={editingWebsitePassword}
                                  onChange={e => setEditingWebsitePassword(e.target.value)}
                                  className="website-password-input"
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="password-toggle-btn"
                                  onClick={() => setShowWebsitePassword(!showWebsitePassword)}
                                  title={showWebsitePassword ? "Hide password" : "Show password"}
                                >
                                  {showWebsitePassword ? (
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
                              <div className="password-strength-indicator">
                                {editingWebsitePassword && (
                                  <div className={`strength-meter ${editingWebsitePassword.length >= 8 ? 'strong' : editingWebsitePassword.length >= 6 ? 'medium' : 'weak'}`}>
                                    <div className="strength-bar"></div>
                                    <span className="strength-text">
                                      {editingWebsitePassword.length >= 8 ? 'Strong' : editingWebsitePassword.length >= 6 ? 'Medium' : 'Weak'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="password-form-actions">
                              <button
                                className="password-save-btn"
                                onClick={() => handleSaveWebsitePassword(user.id)}
                                disabled={!editingWebsitePassword || editingWebsitePassword.length < 6}
                                title="Save new website password"
                              >
                                Save Password
                              </button>
                              <button
                                className="password-cancel-btn"
                                onClick={handleCancelEdit}
                                title="Cancel password change"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
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

      {/* Regular Users Table */}
      <div className="users-list regular-users-list">
        <h2>User</h2>
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
              {getRegularUsers().map(user => (
                <React.Fragment key={user.id}>
                  <tr 
                    className={`user-row ${selectedUserIdForActions === user.id ? 'user-row-selected' : ''}`}
                    onClick={() => handleUserRowClick(user.id)}
                  >
                    <td title={user.username}>{user.username}</td>
                    <td title={user.email}>{user.email}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="role-select"
                        value={userRoles[user.id] || user.role}
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
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className={`user-actions-buttons ${selectedUserIdForActions === user.id ? 'show-actions' : ''}`}>
                        {canEditPassword(user.role) && (
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditWebsitePassword(user)}
                            title="Edit Website Password"
                          >
                            Password
                          </button>
                        )}
                        {canEditPassword(user.role) && (
                          <button
                            className="action-button edit-button"
                            onClick={() => handleEditAppPassword(user)}
                            title="Edit Mail Key"
                          >
                            Mail Key
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
                  {/* Mobile actions row - shown when user is selected on mobile */}
                  {selectedUserIdForActions === user.id && (
                    <tr className="mobile-actions-row">
                      <td colSpan={4}>
                        <div className="mobile-user-actions-buttons">
                          {canEditPassword(user.role) && (
                            <button
                              className="action-button edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditWebsitePassword(user);
                              }}
                              title="Edit Website Password"
                            >
                              Password
                            </button>
                          )}
                          {canEditPassword(user.role) && (
                            <button
                              className="action-button edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAppPassword(user);
                              }}
                              title="Edit Mail Key"
                            >
                              Mail Key
                            </button>
                          )}
                          {canEditPermissions(user.role) && (
                            <button
                              className="action-button permissions-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPermissions(user);
                              }}
                              title="Edit Permissions"
                            >
                              Permissions
                            </button>
                          )}
                          {canDeleteUser(user.role) && (
                            <button 
                              className="action-button delete-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteUser(user.id);
                              }}
                              title="Delete User"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-mail-key-container">
                          <div className="password-form-body">
                            <div className="password-input-group">
                              <label htmlFor={`mail-key-${user.id}`} className="password-label">
                                New Mail Key
                              </label>
                              <div className="password-input-container">
                                <input
                                  id={`mail-key-${user.id}`}
                                  type={showMailKey ? "text" : "password"}
                                  placeholder="Enter new mail key"
                                  value={editingAppPassword}
                                  onChange={e => setEditingAppPassword(e.target.value)}
                                  className="mail-key-input"
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="password-toggle-btn"
                                  onClick={() => setShowMailKey(!showMailKey)}
                                  title={showMailKey ? "Hide mail key" : "Show mail key"}
                                >
                                  {showMailKey ? (
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
                            <div className="password-form-actions">
                              <button
                                className="mail-key-save-btn"
                                onClick={() => handleSaveAppPassword(user.id)}
                                disabled={!editingAppPassword}
                                title="Save new mail key"
                              >
                                Save Mail Key
                              </button>
                              <button
                                className="mail-key-cancel-btn"
                                onClick={handleCancelEdit}
                                title="Cancel mail key change"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {editingWebsitePasswordUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-website-password-container">
                          <div className="password-form-body">
                            <div className="password-input-group">
                              <label htmlFor={`website-password-${user.id}`} className="password-label">
                                New Website Password
                              </label>
                              <div className="password-input-container">
                                <input
                                  id={`website-password-${user.id}`}
                                  type={showWebsitePassword ? "text" : "password"}
                                  placeholder="Enter new password"
                                  value={editingWebsitePassword}
                                  onChange={e => setEditingWebsitePassword(e.target.value)}
                                  className="website-password-input"
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  className="password-toggle-btn"
                                  onClick={() => setShowWebsitePassword(!showWebsitePassword)}
                                  title={showWebsitePassword ? "Hide password" : "Show password"}
                                >
                                  {showWebsitePassword ? (
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
                              <div className="password-strength-indicator">
                                {editingWebsitePassword && (
                                  <div className={`strength-meter ${editingWebsitePassword.length >= 8 ? 'strong' : editingWebsitePassword.length >= 6 ? 'medium' : 'weak'}`}>
                                    <div className="strength-bar"></div>
                                    <span className="strength-text">
                                      {editingWebsitePassword.length >= 8 ? 'Strong' : editingWebsitePassword.length >= 6 ? 'Medium' : 'Weak'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="password-form-actions">
                              <button
                                className="password-save-btn"
                                onClick={() => handleSaveWebsitePassword(user.id)}
                                disabled={!editingWebsitePassword || editingWebsitePassword.length < 6}
                                title="Save new website password"
                              >
                                Save Password
                              </button>
                              <button
                                className="password-cancel-btn"
                                onClick={handleCancelEdit}
                                title="Cancel password change"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
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
                onClick={() => handleUpdatePermissions(selectedUser.id, editingPermissions)}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCancelDelete()}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-modal-header">
              <h3>⚠️ Confirm User Deletion</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCancelDelete}
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
                  Are you sure you want to delete <strong>{userToDelete.username}</strong>'s account?
                </p>
                <div className="user-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{userToDelete.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Role:</span>
                    <span className="detail-value">{userToDelete.role}</span>
                  </div>
                </div>
                <div className="warning-text">
                  <strong>This action cannot be undone!</strong>
                </div>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="confirm-delete-btn"
                onClick={handleConfirmDelete}
                title="Permanently delete this user account"
              >
                Yes, I Confirm
              </button>
              <button
                className="cancel-delete-btn"
                onClick={handleCancelDelete}
                title="Cancel deletion"
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