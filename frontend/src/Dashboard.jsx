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
import PasswordToggle from './Components/Password-Toggle';
import BackButton from './Components/BackButton';




function Dashboard() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingWebsitePassword, setEditingWebsitePassword] = useState("");
  const [editingWebsitePasswordConfirm, setEditingWebsitePasswordConfirm] = useState("");
  const [currentPasswordDisplay, setCurrentPasswordDisplay] = useState("");
  const [currentPasswordMessage, setCurrentPasswordMessage] = useState("");
  const [loadingCurrentPassword, setLoadingCurrentPassword] = useState(false);
  const [passwordMismatchError, setPasswordMismatchError] = useState("");
  const [editingPermissions, setEditingPermissions] = useState({});
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserIdForActions, setSelectedUserIdForActions] = useState(null);
  const [editingWebsitePasswordUserId, setEditingWebsitePasswordUserId] = useState(null);
  const [showWebsitePassword, setShowWebsitePassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  const [roleChangeRequest, setRoleChangeRequest] = useState(null); // { userId, userName, userEmail, currentRole, newRole }
  const [userRoles, setUserRoles] = useState({});
  const [showPasswordChangeConfirm, setShowPasswordChangeConfirm] = useState(false);
  const [passwordChangeRequest, setPasswordChangeRequest] = useState(null); // { userId, userName, userEmail }
  const [showPermissionChangeConfirm, setShowPermissionChangeConfirm] = useState(false);
  const [permissionChangeRequest, setPermissionChangeRequest] = useState(null); // { userId, userName, userEmail, permissionCount }
  const [showAdminPasswordRestriction, setShowAdminPasswordRestriction] = useState(false);
  const [adminPasswordRestrictionUser, setAdminPasswordRestrictionUser] = useState(null);
  const [showNoChangesModal, setShowNoChangesModal] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState({});

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

  const handleRoleChange = (userId, newRole) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setRoleChangeRequest({
      userId,
      userName: user.username,
      userEmail: user.email,
      currentRole: user.role,
      newRole
    });
    setShowRoleChangeConfirm(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeRequest) return;
    const { userId, newRole } = roleChangeRequest;
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
        window.location.reload();
      } else {
        setError(response.data.error);
        // revert UI select to original role on failure
        setUserRoles(prev => ({ ...prev, [roleChangeRequest.userId]: roleChangeRequest.currentRole }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating role');
      setUserRoles(prev => ({ ...prev, [roleChangeRequest.userId]: roleChangeRequest.currentRole }));
    } finally {
      setShowRoleChangeConfirm(false);
      setRoleChangeRequest(null);
    }
  };

  const handleCancelRoleChange = () => {
    if (roleChangeRequest) {
      setUserRoles(prev => ({ ...prev, [roleChangeRequest.userId]: roleChangeRequest.currentRole }));
    }
    setShowRoleChangeConfirm(false);
    setRoleChangeRequest(null);
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

  const handleUpdatePermissions = (userId, updatedPermissions) => {
    // Find user to get their details for confirmation
    const user = users.find(user => user.id === userId);
    if (!user) return;
    
    // Compare current permissions with original permissions
    const originalKeys = Object.keys(originalPermissions).sort();
    const updatedKeys = Object.keys(updatedPermissions).sort();
    
    // Check if permissions have changed
    const hasChanges = 
      originalKeys.length !== updatedKeys.length ||
      originalKeys.some(key => originalPermissions[key] !== updatedPermissions[key]) ||
      updatedKeys.some(key => originalPermissions[key] !== updatedPermissions[key]);
    
    if (!hasChanges) {
      // No changes made - show popup
      setShowNoChangesModal(true);
      return;
    }
    
    // Count permissions
    const permissionCount = Object.keys(updatedPermissions).filter(key => updatedPermissions[key] === true).length;
    
    // Close permissions modal first
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    
    // Show confirmation modal
    setPermissionChangeRequest({
      userId,
      userName: user.username,
      userEmail: user.email,
      permissionCount,
      updatedPermissions
    });
    setShowPermissionChangeConfirm(true);
  };

  const handleConfirmPermissionChange = async () => {
    if (!permissionChangeRequest) return;
    const { userId, updatedPermissions } = permissionChangeRequest;
    
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
        // Refresh the page after successful permission update
        window.location.reload();
      } else {
        setError(response.data.error);
        setShowPermissionChangeConfirm(false);
        setPermissionChangeRequest(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating permissions');
      setShowPermissionChangeConfirm(false);
      setPermissionChangeRequest(null);
    }
  };

  const handleCancelPermissionChange = () => {
    setShowPermissionChangeConfirm(false);
    setPermissionChangeRequest(null);
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

  const handleEditWebsitePassword = async (user) => {
    // Close any other open actions first
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    
    setEditingWebsitePasswordUserId(null);
    setEditingWebsitePassword("");
    setEditingWebsitePasswordConfirm("");
    setPasswordMismatchError("");
    setShowWebsitePassword(false);
    setCurrentPasswordMessage("");
    setCurrentPasswordDisplay("");
    setLoadingCurrentPassword(false);
    setSelectedUserIdForActions(null); // Clear mobile selection
    setAdminPasswordRestrictionUser(null);
    setShowAdminPasswordRestriction(false);
    
    const targetIsAdmin = (user.role || '').toString().trim().toLowerCase() === 'admin';
    const editingOwnAccount = isCurrentUser(user);

    if (targetIsAdmin && !editingOwnAccount) {
      setAdminPasswordRestrictionUser(user);
      setShowAdminPasswordRestriction(true);
      return;
    }

    // Open website password editing
    setEditingWebsitePasswordUserId(user.id);

    // Fetch current password
    setLoadingCurrentPassword(true);
    setCurrentPasswordDisplay("");

    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.GET_USER_PASSWORD), 
        { user_id: user.id },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      // Check if password is returned
      if (response.data.password) {
        setCurrentPasswordDisplay(response.data.password);
        setCurrentPasswordMessage("");
        console.log('Current password retrieved and displayed');
      } else if (response.data.error) {
        // Backend returned an error message (e.g., no encrypted password stored)
        setCurrentPasswordDisplay("");
        console.info(`Password retrieval info: ${response.data.message || response.data.error}`);
      } else {
        // No password in response
        setCurrentPasswordDisplay("");
        console.warn('No password data in response');
      }
    } catch (err) {
      console.error('Error fetching current password:', err);
      // Handle different error cases
      if (err.response?.status === 404) {
        const errorMessage = err.response?.data?.error || '';
        
        if (errorMessage.includes('No encrypted password stored')) {
          // User doesn't have encrypted password yet - this is expected for older users
          setCurrentPasswordDisplay("");
          console.info('This user does not have an encrypted password stored yet. The encrypted password will be created when the password is next updated.');
        } else {
          // Endpoint not found - server may need restart
          setCurrentPasswordDisplay("");
          console.warn('Password endpoint not available. This may indicate the backend needs to be restarted.');
        }
      } else if (err.response?.status === 200 && err.response?.data?.error) {
        // Backend returned 200 but with error message (no encrypted password)
        setCurrentPasswordDisplay("");
        console.info(err.response.data.message || err.response.data.error);
      } else {
        // Other errors
        setCurrentPasswordDisplay("");
        console.error('Unexpected error fetching password:', err);
      }
    } finally {
      setLoadingCurrentPassword(false);
    }
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
    
    // Store original permissions for comparison
    setOriginalPermissions(JSON.parse(JSON.stringify(permissions)));
    setEditingPermissions(permissions);
    setShowPermissionsModal(true);
  };

  const handleModalOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancelEdit();
    }
  };

  const handleSaveWebsitePassword = (userId) => {
    // Find user to get their details for confirmation
    const user = users.find(user => user.id === userId);
    if (!user) return;
    
    // Validate passwords match
    if (editingWebsitePassword !== editingWebsitePasswordConfirm) {
      setPasswordMismatchError("Passwords do not match");
      setError('Passwords do not match');
      return;
    }
    
    // Clear mismatch error if passwords match
    if (passwordMismatchError) {
      setPasswordMismatchError("");
    }
    
    if (!editingWebsitePassword || editingWebsitePassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    // Show confirmation modal
    setPasswordChangeRequest({
      userId,
      userName: user.username,
      userEmail: user.email
    });
    setShowPasswordChangeConfirm(true);
  };

  const handleConfirmPasswordChange = async () => {
    if (!passwordChangeRequest) return;
    const { userId } = passwordChangeRequest;
    
    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_WEBSITE_PASSWORD), {
        user_id: userId,
        new_password: editingWebsitePassword
      }, {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data.message) {
        setSuccess(`✅ Website password for user "${passwordChangeRequest.userName}" has been changed successfully!`);
        setError("");
        setEditingWebsitePasswordUserId(null);
        setEditingWebsitePassword("");
        setEditingWebsitePasswordConfirm("");
        setCurrentPasswordDisplay("");
        setCurrentPasswordMessage("");
        setPasswordMismatchError("");
        // Refresh users list immediately after successful password update
        fetchUsers();
      } else {
        setError(response.data.error);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating website password');
    } finally {
      setShowPasswordChangeConfirm(false);
      setPasswordChangeRequest(null);
    }
  };

  const handleCancelPasswordChange = () => {
    setShowPasswordChangeConfirm(false);
    setPasswordChangeRequest(null);
  };

  const handleCancelEdit = () => {
    setEditingWebsitePasswordUserId(null);
    setEditingWebsitePassword("");
    setEditingWebsitePasswordConfirm("");
    setCurrentPasswordDisplay("");
    setLoadingCurrentPassword(false);
    setPasswordMismatchError("");
    setShowWebsitePassword(false);
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    setSelectedUserIdForActions(null); // Clear mobile selection
    setCurrentPasswordMessage("");
    setShowAdminPasswordRestriction(false);
    setAdminPasswordRestrictionUser(null);
    setOriginalPermissions({});
    setShowNoChangesModal(false);
  };

  const handleCloseNoChangesModal = () => {
    setShowNoChangesModal(false);
  };

  const handleCancelNoChangesModal = () => {
    // Close both the "no changes" modal and the permissions modal
    setShowNoChangesModal(false);
    setShowPermissionsModal(false);
    setEditingPermissions({});
    setSelectedUser(null);
    setOriginalPermissions({});
  };

  const handleCloseAdminPasswordRestriction = () => {
    setShowAdminPasswordRestriction(false);
    setAdminPasswordRestrictionUser(null);
  };

  const normalizeValueForComparison = (value) => {
    if (value === undefined || value === null) {
      return null;
    }
    return value.toString().trim().toLowerCase();
  };

  const isCurrentUser = (userToCheck) => {
    if (!userToCheck || !currentUser) return false;

    const targetValues = [
      userToCheck.id,
      userToCheck.uid,
      userToCheck.user_id,
      userToCheck.userId,
      userToCheck.docId,
      userToCheck.email,
      userToCheck.username
    ].map(normalizeValueForComparison).filter(Boolean);

    if (targetValues.length === 0) {
      return false;
    }

    const currentValues = [
      currentUser.id,
      currentUser.uid,
      currentUser.user_id,
      currentUser.userId,
      currentUser.docId,
      currentUser.email,
      currentUser.username
    ].map(normalizeValueForComparison).filter(Boolean);

    if (currentValues.length === 0) {
      return false;
    }

    const targetSet = new Set(targetValues);
    return currentValues.some(value => targetSet.has(value));
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
    return users
      .filter(user => user.role === 'admin')
      .slice()
      .sort((a, b) => (a.username || '').localeCompare(b.username || '', 'en', { sensitivity: 'base' }));
  };

  // Get regular users
  const getRegularUsers = () => {
    return users
      .filter(user => user.role === 'user')
      .slice()
      .sort((a, b) => (a.username || '').localeCompare(b.username || '', 'en', { sensitivity: 'base' }));
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
      {/* Back Button Section - Always at top-left */}
      <BackButton label="Back to Main Menu" to="/app" />
      
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
        <h2>Admins</h2>
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
                  {editingWebsitePasswordUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-website-password-container">
                          <div className="password-form-body">
                            <div className="password-input-group">
                              <label htmlFor={`current-password-${user.id}`} className="password-label">
                                Current Password
                              </label>
                              {loadingCurrentPassword ? (
                                <input
                                  type="text"
                                  value="Loading..."
                                  disabled
                                  className="website-password-input"
                                  style={{ opacity: 0.6 }}
                                />
                              ) : currentPasswordMessage ? (
                                <input
                                  type="text"
                                  value={currentPasswordMessage}
                                  disabled
                                  className="website-password-input"
                                  style={{ opacity: 0.7, fontStyle: 'italic', color: '#666' }}
                                  title={currentPasswordMessage}
                                />
                              ) : currentPasswordDisplay ? (
                                <PasswordToggle
                                  id={`current-password-${user.id}`}
                                  name={`current-password-${user.id}`}
                                  value={currentPasswordDisplay}
                                  onChange={() => {}} // Read-only
                                  placeholder=""
                                  className="website-password-input"
                                  disabled={true}
                                  readOnly={true}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value="Not available - Update password to enable display"
                                  disabled
                                  className="website-password-input"
                                  style={{ opacity: 0.7, fontStyle: 'italic', color: '#666' }}
                                  title="Encrypted password not stored for this user. Update the password once to enable this feature."
                                />
                              )}
                              <label htmlFor={`website-password-${user.id}`} className="password-label" style={{ marginTop: '16px' }}>
                                New Password
                              </label>
                              <PasswordToggle
                                id={`website-password-${user.id}`}
                                name={`website-password-${user.id}`}
                                value={editingWebsitePassword}
                                onChange={e => {
                                  setEditingWebsitePassword(e.target.value);
                                  // Clear mismatch error when new password changes
                                  if (passwordMismatchError) {
                                    // Re-validate immediately
                                    if (e.target.value === editingWebsitePasswordConfirm) {
                                      setPasswordMismatchError("");
                                    } else if (editingWebsitePasswordConfirm) {
                                      setPasswordMismatchError("Passwords do not match");
                                    }
                                  }
                                }}
                                placeholder="Enter new password"
                                className="website-password-input"
                                autoComplete="new-password"
                              />
                              <div style={{ marginTop: '8px' }}>
                                <PasswordToggle
                                  id={`website-password-confirm-${user.id}`}
                                  name={`website-password-confirm-${user.id}`}
                                  value={editingWebsitePasswordConfirm}
                                  onChange={e => {
                                    setEditingWebsitePasswordConfirm(e.target.value);
                                    // Real-time validation
                                    if (e.target.value && editingWebsitePassword) {
                                      if (e.target.value !== editingWebsitePassword) {
                                        setPasswordMismatchError("Passwords do not match");
                                      } else {
                                        setPasswordMismatchError("");
                                      }
                                    } else {
                                      setPasswordMismatchError("");
                                    }
                                  }}
                                  placeholder="Confirm new password"
                                  className="website-password-input"
                                  autoComplete="new-password"
                                />
                                {passwordMismatchError && (
                                  <div style={{
                                    marginTop: '8px',
                                    padding: '8px 12px',
                                    backgroundColor: '#ffebee',
                                    border: '1px solid #ffcdd2',
                                    borderRadius: '4px',
                                    color: '#c62828',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    <span style={{ fontSize: '16px' }}>⚠️</span>
                                    <span>{passwordMismatchError}</span>
                                  </div>
                                )}
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
                                  disabled={!editingWebsitePassword || editingWebsitePassword.length < 6 || editingWebsitePassword !== editingWebsitePasswordConfirm}
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
        <h2>Users</h2>
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
                  {editingWebsitePasswordUserId === user.id && !showPermissionsModal && (
                    <tr>
                      <td colSpan={4} className="user-actions-row">
                        <div className="edit-website-password-container">
                          <div className="password-form-body">
                            <div className="password-input-group">
                              <label htmlFor={`current-password-${user.id}`} className="password-label">
                                Current Password
                              </label>
                              {loadingCurrentPassword ? (
                                <input
                                  type="text"
                                  value="Loading..."
                                  disabled
                                  className="website-password-input"
                                  style={{ opacity: 0.6 }}
                                />
                              ) : currentPasswordMessage ? (
                                <input
                                  type="text"
                                  value={currentPasswordMessage}
                                  disabled
                                  className="website-password-input"
                                  style={{ opacity: 0.7, fontStyle: 'italic', color: '#666' }}
                                  title={currentPasswordMessage}
                                />
                              ) : currentPasswordDisplay ? (
                                <PasswordToggle
                                  id={`current-password-${user.id}`}
                                  name={`current-password-${user.id}`}
                                  value={currentPasswordDisplay}
                                  onChange={() => {}} // Read-only
                                  placeholder=""
                                  className="website-password-input"
                                  disabled={true}
                                  readOnly={true}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value="Not available - Update password to enable display"
                                  disabled
                                  className="website-password-input"
                                  style={{ opacity: 0.7, fontStyle: 'italic', color: '#666' }}
                                  title="Encrypted password not stored for this user. Update the password once to enable this feature."
                                />
                              )}
                              <label htmlFor={`website-password-${user.id}`} className="password-label" style={{ marginTop: '16px' }}>
                                New Password
                              </label>
                              <PasswordToggle
                                id={`website-password-${user.id}`}
                                name={`website-password-${user.id}`}
                                value={editingWebsitePassword}
                                onChange={e => {
                                  setEditingWebsitePassword(e.target.value);
                                  // Clear mismatch error when new password changes
                                  if (passwordMismatchError) {
                                    // Re-validate immediately
                                    if (e.target.value === editingWebsitePasswordConfirm) {
                                      setPasswordMismatchError("");
                                    } else if (editingWebsitePasswordConfirm) {
                                      setPasswordMismatchError("Passwords do not match");
                                    }
                                  }
                                }}
                                placeholder="Enter new password"
                                className="website-password-input"
                                autoComplete="new-password"
                              />
                              <div style={{ marginTop: '8px' }}>
                                <PasswordToggle
                                  id={`website-password-confirm-${user.id}`}
                                  name={`website-password-confirm-${user.id}`}
                                  value={editingWebsitePasswordConfirm}
                                  onChange={e => {
                                    setEditingWebsitePasswordConfirm(e.target.value);
                                    // Real-time validation
                                    if (e.target.value && editingWebsitePassword) {
                                      if (e.target.value !== editingWebsitePassword) {
                                        setPasswordMismatchError("Passwords do not match");
                                      } else {
                                        setPasswordMismatchError("");
                                      }
                                    } else {
                                      setPasswordMismatchError("");
                                    }
                                  }}
                                  placeholder="Confirm new password"
                                  className="website-password-input"
                                  autoComplete="new-password"
                                />
                                {passwordMismatchError && (
                                  <div style={{
                                    marginTop: '8px',
                                    padding: '8px 12px',
                                    backgroundColor: '#ffebee',
                                    border: '1px solid #ffcdd2',
                                    borderRadius: '4px',
                                    color: '#c62828',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                  }}>
                                    <span style={{ fontSize: '16px' }}>⚠️</span>
                                    <span>{passwordMismatchError}</span>
                                  </div>
                                )}
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
                                disabled={!editingWebsitePassword || editingWebsitePassword.length < 6 || editingWebsitePassword !== editingWebsitePasswordConfirm}
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

      {/* Admin Password Restriction Modal */}
      {showAdminPasswordRestriction && adminPasswordRestrictionUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseAdminPasswordRestriction()}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-modal-header">
              <h3>⚠️ Admin Password Protected</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCloseAdminPasswordRestriction}
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
                  You cannot view or change <strong>{adminPasswordRestrictionUser.username}</strong>'s password because they are an admin.
                </p>
                <div className="user-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{adminPasswordRestrictionUser.email}</span>
                  </div>
                </div>
                <div className="warning-text">
                  <strong>Admins can only manage their own passwords.</strong>
                </div>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="cancel-delete-btn"
                onClick={handleCloseAdminPasswordRestriction}
                title="Close message"
              >
                Okay
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

      {/* Role Change Confirmation Modal */}
      {showRoleChangeConfirm && roleChangeRequest && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCancelRoleChange()}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-modal-header">
              <h3>⚠️ Confirm Role Change</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCancelRoleChange}
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
                  Are you sure you want to change <strong>{roleChangeRequest.userName}</strong>'s role?
                </p>
                <div className="user-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{roleChangeRequest.userEmail}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Current Role:</span>
                    <span className="detail-value">{roleChangeRequest.currentRole}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">New Role:</span>
                    <span className="detail-value">{roleChangeRequest.newRole}</span>
                  </div>
                </div>
                <div className="warning-text">
                  <strong>This change affects the user's access immediately.</strong>
                </div>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="confirm-delete-btn"
                onClick={handleConfirmRoleChange}
                title="Confirm role change"
              >
                Yes, Change Role
              </button>
              <button
                className="cancel-delete-btn"
                onClick={handleCancelRoleChange}
                title="Cancel role change"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                  Are you sure you want to change <strong>{passwordChangeRequest.userName}</strong>'s password?
                </p>
                <div className="user-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{passwordChangeRequest.userEmail}</span>
                  </div>
                </div>
                <div className="warning-text">
                  <strong>This change affects the user's login access immediately.</strong>
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

      {/* Permission Change Confirmation Modal */}
      {showPermissionChangeConfirm && permissionChangeRequest && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCancelPermissionChange()}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-modal-header">
              <h3>⚠️ Confirm Permission Change</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCancelPermissionChange}
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
                  Are you sure you want to change <strong>{permissionChangeRequest.userName}</strong>'s permissions?
                </p>
                <div className="user-details">
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{permissionChangeRequest.userEmail}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Permissions Count:</span>
                    <span className="detail-value">{permissionChangeRequest.permissionCount} permission{permissionChangeRequest.permissionCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="warning-text">
                  <strong>This change affects the user's access immediately.</strong>
                </div>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="confirm-delete-btn"
                onClick={handleConfirmPermissionChange}
                title="Confirm permission change"
              >
                Yes, Change Permissions
              </button>
              <button
                className="cancel-delete-btn"
                onClick={handleCancelPermissionChange}
                title="Cancel permission change"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Changes Made Modal */}
      {showNoChangesModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseNoChangesModal()}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-modal-header">
              <h3>ℹ️ No Changes Detected</h3>
              <button 
                className="modal-close-btn"
                onClick={handleCloseNoChangesModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="delete-modal-body">
              <div className="warning-icon">
                <i className="warning-symbol">ℹ️</i>
              </div>
              <div className="delete-message">
                <p className="delete-question">
                  No changes made in permission.
                </p>
                <div className="warning-text">
                  <strong>Please make changes to permissions before saving.</strong>
                </div>
              </div>
            </div>
            <div className="delete-modal-actions">
              <button
                className="confirm-delete-btn"
                onClick={handleCloseNoChangesModal}
                title="Close message and continue editing"
              >
                Okay
              </button>
              <button
                className="cancel-delete-btn"
                onClick={handleCancelNoChangesModal}
                title="Cancel and close permissions window"
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

