import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl, ENDPOINTS } from './config';
import './Dashboard.css'; // Import the CSS file

// Define available departments and permissions
const DEPARTMENTS = {
  STORE: 'store',
  MARKETING: 'marketing',
  HUMANRESOURCE: 'humanresource'
};

// Department descriptions
const DEPARTMENT_DESCRIPTIONS = {
  [DEPARTMENTS.STORE]: 'Store Department - Inventory Management',
  [DEPARTMENTS.MARKETING]: 'Marketing Department - Marketing Campaigns and Analysis',
  [DEPARTMENTS.HUMANRESOURCE]: 'Human Resource Department - Salary Processing and Employee Management'
};

// All available permissions organized by category
const ALL_PERMISSIONS = {
  GENERAL: {
    REPORTS: 'reports', // Single general reports permission
    SETTINGS_ACCESS: 'settings_access',
    USER_MANAGEMENT: 'user_management',
    CAN_CREATE_ADMIN: 'can_create_admin'
  },
  STORE: {
    INVENTORY: 'inventory'
  },
  HR_DEPARTMENT: {
    SALARY_PROCESSING: {
      SINGLE_PROCESSING: 'single_processing',
      BATCH_PROCESSING: 'batch_processing',
    }
  },
  MARKETING: {
    MARKETING_CAMPAIGNS: 'marketing_campaigns'
  },
  ACCOUNTS: {
    EXPENSE_MANAGEMENT: 'expense_management'
  }
};

// Permission descriptions for tooltips
const PERMISSION_DESCRIPTIONS = {
  [ALL_PERMISSIONS.GENERAL.REPORTS]: 'Access to all reports across departments',
  [ALL_PERMISSIONS.GENERAL.SETTINGS_ACCESS]: 'Access system settings',
  [ALL_PERMISSIONS.GENERAL.USER_MANAGEMENT]: 'Manage users and roles',
  [ALL_PERMISSIONS.GENERAL.CAN_CREATE_ADMIN]: 'Create admin users',
  [ALL_PERMISSIONS.STORE.INVENTORY]: 'Manage inventory operations',
  [ALL_PERMISSIONS.HR_DEPARTMENT.SALARY_PROCESSING.SINGLE_PROCESSING]: 'Process individual salary slips',
  [ALL_PERMISSIONS.HR_DEPARTMENT.SALARY_PROCESSING.BATCH_PROCESSING]: 'Process multiple salary slips at once',
  [ALL_PERMISSIONS.MARKETING.MARKETING_CAMPAIGNS]: 'Manage marketing campaigns',
  [ALL_PERMISSIONS.ACCOUNTS.EXPENSE_MANAGEMENT]: 'Manage expenses'
};

// Default permissions for each department (reports can be false)
const DEPARTMENT_DEFAULT_PERMISSIONS = {
  [DEPARTMENTS.STORE]: {
    [ALL_PERMISSIONS.GENERAL.REPORTS]: false, // Can be toggled by admin
    [ALL_PERMISSIONS.STORE.INVENTORY]: true
  },
  [DEPARTMENTS.MARKETING]: {
    [ALL_PERMISSIONS.GENERAL.REPORTS]: false, // Can be toggled by admin
    [ALL_PERMISSIONS.MARKETING.MARKETING_CAMPAIGNS]: true
  },
  [DEPARTMENTS.HUMANRESOURCE]: {
    [ALL_PERMISSIONS.HR_DEPARTMENT.SALARY_PROCESSING.SINGLE_PROCESSING]: true,
    [ALL_PERMISSIONS.HR_DEPARTMENT.SALARY_PROCESSING.BATCH_PROCESSING]: true,
    [ALL_PERMISSIONS.GENERAL.REPORTS]: false // Can be toggled by admin
  }
};

// Super admin gets all permissions
const SUPER_ADMIN_PERMISSIONS = Object.values(ALL_PERMISSIONS).reduce((acc, category) => {
  Object.values(category).forEach(permission => {
    if (typeof permission === 'object') {
      // Handle nested permissions like SALARY_PROCESSING
      Object.values(permission).forEach(nestedPerm => {
        acc[nestedPerm] = true;
      });
    } else {
      acc[permission] = true;
    }
  });
  return acc;
}, {});

// Separate PermissionsGrid component
const PermissionsGrid = ({ 
  permissions, 
  onPermissionChange, 
  isEditing = false, 
  targetUserRole = 'user',
  currentUserRole = 'super-admin' 
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const renderNestedPermissions = (nestedPerms, permissionsToShow, categoryName) => {
    const canEditThisNestedPermission = isEditing && (
      currentUserRole === 'super-admin' || 
      (currentUserRole === 'admin' && targetUserRole === 'user')
    );
    
    return Object.entries(nestedPerms).map(([permKey, permValue]) => {
      return (
        <div key={permValue} className="permission-item nested-permission">
          <label title={PERMISSION_DESCRIPTIONS[permValue]}>
            <input
              type="checkbox"
              checked={permissionsToShow[permValue] || false}
              onChange={() => onPermissionChange(permValue)}
              disabled={!canEditThisNestedPermission}
            />
            {permKey.replace('_', ' ')}
          </label>
        </div>
      );
    });
  };

  // Determine which permissions to show based on current user role and target user role
  let availablePermissions = {};
  
  if (currentUserRole === 'super-admin') {
    // Super admin can edit all permissions for any user role
    availablePermissions = ALL_PERMISSIONS;
  } else if (currentUserRole === 'admin') {
    // Admin can edit user permissions (but not admin permissions)
    if (targetUserRole === 'user') {
      availablePermissions = {
        GENERAL: ALL_PERMISSIONS.GENERAL,
        STORE: ALL_PERMISSIONS.STORE,
        HR_DEPARTMENT: ALL_PERMISSIONS.HR_DEPARTMENT,
        MARKETING: ALL_PERMISSIONS.MARKETING,
        ACCOUNTS: ALL_PERMISSIONS.ACCOUNTS
      };
    }
    // If admin tries to create admin/super-admin, no permissions shown (handled by role restrictions)
  }

  return (
    <div className="permissions-categories">
      {Object.entries(availablePermissions).map(([categoryName, categoryPerms]) => (
        <div key={categoryName} className="permission-category">
          <h4 className="category-title">{categoryName.replace('_', ' ')}</h4>
          <div className="permissions-grid">
            {Object.entries(categoryPerms).map(([permKey, permValue]) => {
              // Handle nested permissions (like SALARY_PROCESSING)
              if (typeof permValue === 'object') {
                return (
                  <div key={permKey} className="permission-group">
                    <div className="permission-item">
                      <label 
                        className="expandable-label"
                        onClick={() => toggleCategory(`${categoryName}-${permKey}`)}
                      >
                        <span className="expand-icon">
                          {expandedCategories[`${categoryName}-${permKey}`] ? '▼' : '▶'}
                        </span>
                        {permKey.replace('_', ' ')}
                      </label>
                    </div>
                    {expandedCategories[`${categoryName}-${permKey}`] && (
                      <div className="nested-permissions">
                        {renderNestedPermissions(permValue, permissions, categoryName)}
                      </div>
                    )}
                  </div>
                );
              } else {
                // Super admin can edit all permissions, admin can edit user permissions
                const canEditThisPermission = isEditing && (
                  currentUserRole === 'super-admin' || 
                  (currentUserRole === 'admin' && targetUserRole === 'user')
                );
                
                return (
                  <div key={permValue} className="permission-item">
                    <label title={PERMISSION_DESCRIPTIONS[permValue]}>
                      <input
                        type="checkbox"
                        checked={permissions[permValue] || false}
                        onChange={() => onPermissionChange(permValue)}
                        disabled={!canEditThisPermission}
                      />
                      {permKey.replace('_', ' ')}
                    </label>
                  </div>
                );
              }
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appPassword, setAppPassword] = useState("");
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [role, setRole] = useState('user');
  const [department, setDepartment] = useState('');
  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingAppPassword, setEditingAppPassword] = useState("");
  const [editingPermissions, setEditingPermissions] = useState({});
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Set default permissions when role or department changes
  useEffect(() => {
    if (role === 'super-admin') {
      setPermissions(SUPER_ADMIN_PERMISSIONS);
      setDepartment(''); // Clear department for super-admin
    } else if (role === 'admin') {
      setPermissions({
        [ALL_PERMISSIONS.GENERAL.REPORTS]: true,
        [ALL_PERMISSIONS.GENERAL.USER_MANAGEMENT]: true,
        [ALL_PERMISSIONS.GENERAL.SETTINGS_ACCESS]: true,
        [ALL_PERMISSIONS.GENERAL.CAN_CREATE_ADMIN]: false
      });
      } else {
        // For regular users, set department-specific permissions
        if (department && DEPARTMENT_DEFAULT_PERMISSIONS[department]) {
          setPermissions(DEPARTMENT_DEFAULT_PERMISSIONS[department]);
        } else {
          setPermissions({
            [ALL_PERMISSIONS.GENERAL.REPORTS]: false // Default to false, can be enabled by admin
          });
        }
      }
  }, [role, department]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(getApiUrl(ENDPOINTS.GET_USERS), {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (Array.isArray(response.data)) {
        const usersWithIds = response.data.map(user => ({
          ...user,
          id: user.docId || user.id
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

  const handleDepartmentChange = async (userId, newDepartment) => {
    try {
      // Get default permissions for the new department
      const defaultPerms = DEPARTMENT_DEFAULT_PERMISSIONS[newDepartment] || {};
      
      const response = await axios.post(getApiUrl(ENDPOINTS.UPDATE_USER),
        { 
          user_id: userId, 
          department: newDepartment,
          permissions: defaultPerms // Set default permissions for the department
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.message) {
        setSuccess('Department updated successfully with default permissions');
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error updating department');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(getApiUrl(ENDPOINTS.ADD_USER), 
        { 
          username, 
          email, 
          password, 
          appPassword,
          role,
          department: role === 'super-admin' ? null : department,
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
        setAppPassword('');
        setRole('user');
        setDepartment('');
        setPermissions({});
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error adding user');
      setSuccess('');
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
      const response = await axios.post(getApiUrl('update_permissions'), 
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
        setShowPermissionsModal(false);
        setEditingPermissions({});
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

  const handleEditPermissionChange = (permission) => {
    setEditingPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  const handleEditAppPassword = (user) => {
    setEditingUserId(user.id);
    setEditingAppPassword("");
  };

  const handleEditPermissions = (user) => {
    setEditingUserId(user.id);
    setEditingPermissions(user.permissions || {});
    setShowPermissionsModal(true);
  };

  const handleSaveAppPassword = async (userId) => {
    try {
      const response = await axios.post(getApiUrl("update_app_password"), {
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
        fetchUsers();
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
  };

  const getCurrentUserRole = () => {
    // This should come from your authentication context
    // For now, assuming super-admin for demonstration
    return 'super-admin';
  };

  const getCurrentUserPermissions = () => {
    // This should come from your authentication context
    // For demonstration, returning super-admin permissions
    return {
      'reports': true,
      'settings_access': true,
      'user_management': true,
      'can_create_admin': true,
      'inventory': true,
      'single_processing': true,
      'batch_processing': true,
      'marketing_campaigns': true,
      'expense_management': true
    };
  };

  const hasPermission = (permission) => {
    const userPermissions = getCurrentUserPermissions();
    return userPermissions[permission] || false;
  };

  const canAccessDepartment = (department) => {
    const currentRole = getCurrentUserRole();
    if (currentRole === 'super-admin') return true;
    if (currentRole === 'admin') return true;
    
    // For regular users, check department-specific permissions
    const userPermissions = getCurrentUserPermissions();
    switch (department) {
      case 'store':
        return userPermissions['inventory'] || false;
      case 'marketing':
        return userPermissions['marketing_campaigns'] || false;
      case 'humanresource':
        return userPermissions['single_processing'] || userPermissions['batch_processing'] || false;
      default:
        return false;
    }
  };

  const canEditPermissions = (targetUserRole) => {
    const currentRole = getCurrentUserRole();
    if (currentRole === 'super-admin') return true;
    if (currentRole === 'admin' && targetUserRole === 'user') return true;
    return false;
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
              <th>Department</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <React.Fragment key={user.id}>
                <tr>
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
                  <td>
                    <select
                      className="department-select"
                      value={user.department || ''}
                      onChange={(e) => handleDepartmentChange(user.id, e.target.value)}
                      disabled={user.role === 'super-admin'}
                    >
                      <option value="">Select Department</option>
                      {Object.entries(DEPARTMENTS).map(([key, value]) => (
                        <option key={value} value={value} title={DEPARTMENT_DESCRIPTIONS[value]}>
                          {key === 'STORE' ? 'Store' : key === 'MARKETING' ? 'Marketing' : 'Human Resource'}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="user-actions-buttons">
                      <button
                        className="action-button edit-button"
                        onClick={() => handleEditAppPassword(user)}
                      >
                        Edit Password
                      </button>
                      {canEditPermissions(user.role) && (
                        <button
                          className="action-button permissions-button"
                          onClick={() => handleEditPermissions(user)}
                        >
                          Edit Permissions
                        </button>
                      )}
                      <button 
                        className="action-button delete-button"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {editingUserId === user.id && !showPermissionsModal && (
                  <tr>
                    <td colSpan={5} className="user-actions-row">
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

      {/* Permissions Modal */}
      {showPermissionsModal && (
        <div className="modal-overlay">
          <div className="modal-content permissions-modal">
            <h3>Edit Permissions</h3>
            <PermissionsGrid
              permissions={editingPermissions}
              onPermissionChange={handleEditPermissionChange}
              isEditing={true}
              targetUserRole={users.find(u => u.id === editingUserId)?.role}
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

      {/* Only show Add User form if user has user_management permission */}
      {hasPermission('user_management') && (
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
              <label htmlFor="appPassword">App Password:</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type={showAppPassword ? "text" : "password"}
                  id="appPassword"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowAppPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showAppPassword ? "Hide" : "Show"}
                </button>
              </div>
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
                {hasPermission('can_create_admin') && <option value="admin">Admin</option>}
                {hasPermission('can_create_admin') && <option value="super-admin">Super Admin</option>}
              </select>
            </div>

            {role !== 'super-admin' && (
              <div className="form-group">
                <label htmlFor="department">Department:</label>
                <select 
                  id="department" 
                  value={department} 
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                >
                  <option value="">Select Department</option>
                  {Object.entries(DEPARTMENTS)
                    .filter(([key, value]) => canAccessDepartment(value))
                    .map(([key, value]) => (
                    <option key={value} value={value} title={DEPARTMENT_DESCRIPTIONS[value]}>
                      {key === 'STORE' ? 'Store' : key === 'MARKETING' ? 'Marketing' : key=== 'Human Resource' ? 'Human Resource' : 'ACCOUNTS'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group permissions-section">
              <label>Permissions:</label>
              <PermissionsGrid
                permissions={permissions}
                onPermissionChange={handlePermissionChange}
                isEditing={true}
                targetUserRole={role}
                currentUserRole={getCurrentUserRole()}
              />
            </div>
            
            <button type="submit">Add User</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Dashboard; 