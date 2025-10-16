import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  getApiUrl, 
  ENDPOINTS, 
  FACTORY_NAMES,
  FACTORY_RBAC_CONFIG,
  RBAC_HELPERS
} from './config';
import { useAuth } from './Components/AuthContext';
import './Dashboard.css'; // Import the CSS file

// Tree-based Permissions Component for dynamic factory.department.service combinations
const TreeBasedPermissions = ({ 
  permissions, 
  onPermissionChange, 
  isEditing = false, 
  targetUserRole = 'user',
  currentUserRole = 'admin'
}) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectAllFactories, setSelectAllFactories] = useState(false);
  const [selectAllDepartments, setSelectAllDepartments] = useState(false);
  const [selectAllServices, setSelectAllServices] = useState(false);

  // Use centralized RBAC configuration
  const permissionTree = FACTORY_RBAC_CONFIG;

  // Generate permission key for factory.department.service combination
  const generatePermissionKey = (factory, department, service) => {
    return `${factory}.${department}.${service}`;
  };

  // Check if a permission is granted
  const isPermissionGranted = (factory, department, service) => {
    const key = generatePermissionKey(factory, department, service);
    return permissions[key] === true;
  };

  // Handle permission change
  const handlePermissionChange = (factory, department, service, value) => {
    const key = generatePermissionKey(factory, department, service);
    onPermissionChange(key, value);
  };

  // Handle factory selection (selects all departments and services under it)
  const handleFactoryChange = (factory, value) => {
    Object.keys(permissionTree[factory].departments).forEach(dept => {
      Object.keys(permissionTree[factory].departments[dept].services).forEach(service => {
        const key = generatePermissionKey(factory, dept, service);
        onPermissionChange(key, value);
      });
    });
  };

  // Handle department selection (selects all services under it)
  const handleDepartmentChange = (factory, department, value) => {
    Object.keys(permissionTree[factory].departments[department].services).forEach(service => {
      const key = generatePermissionKey(factory, department, service);
      onPermissionChange(key, value);
    });
  };

  // Toggle node expansion
  const toggleNode = (nodeKey) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeKey)) {
      newExpanded.delete(nodeKey);
    } else {
      newExpanded.add(nodeKey);
    }
    setExpandedNodes(newExpanded);
  };

  // Check if all permissions under a factory are selected
  const isFactoryFullySelected = (factory) => {
    let totalPermissions = 0;
    let selectedPermissions = 0;
    
    Object.keys(permissionTree[factory].departments).forEach(dept => {
      Object.keys(permissionTree[factory].departments[dept].services).forEach(service => {
        totalPermissions++;
        if (isPermissionGranted(factory, dept, service)) {
          selectedPermissions++;
        }
      });
    });
    
    return totalPermissions > 0 && totalPermissions === selectedPermissions;
  };

  // Check if all permissions under a department are selected
  const isDepartmentFullySelected = (factory, department) => {
    let totalPermissions = 0;
    let selectedPermissions = 0;
    
    Object.keys(permissionTree[factory].departments[department].services).forEach(service => {
      totalPermissions++;
      if (isPermissionGranted(factory, department, service)) {
        selectedPermissions++;
      }
    });
    
    return totalPermissions > 0 && totalPermissions === selectedPermissions;
  };

  // Check if user can edit permissions
  const canEdit = isEditing && currentUserRole === 'admin';

  return (
    <div className="tree-permissions-container">
      <div className="permissions-header">
        <h4>Factory-Department-Service Permissions</h4>
        <p className="permissions-description">
          Select specific combinations to grant access. Selecting a factory grants access to all its departments and services.
        </p>
      </div>
      
      <div className="permissions-tree">
        {Object.entries(permissionTree).map(([factoryKey, factoryData]) => (
          <div key={factoryKey} className="factory-node">
            <div className="factory-header">
              <label className="factory-checkbox">
                <input
                  type="checkbox"
                  checked={isFactoryFullySelected(factoryKey)}
                  onChange={(e) => handleFactoryChange(factoryKey, e.target.checked)}
                  disabled={!canEdit}
                />
                <span className="factory-name">{factoryData.name}</span>
              </label>
              <button
                type="button"
                className="expand-button"
                onClick={() => toggleNode(factoryKey)}
                disabled={!canEdit}
              >
                {expandedNodes.has(factoryKey) ? '▼' : '▶'}
              </button>
            </div>
            
            {expandedNodes.has(factoryKey) && (
              <div className="departments-container">
                {Object.entries(factoryData.departments).map(([deptKey, deptData]) => (
                  <div key={deptKey} className="department-node">
                    <div className="department-header">
                      <label className="department-checkbox">
                        <input
                          type="checkbox"
                          checked={isDepartmentFullySelected(factoryKey, deptKey)}
                          onChange={(e) => handleDepartmentChange(factoryKey, deptKey, e.target.checked)}
                          disabled={!canEdit}
                        />
                        <span className="department-name">{deptData.name}</span>
                      </label>
                    </div>
                    
                    <div className="services-container">
                      {Object.entries(deptData.services).map(([serviceKey, serviceData]) => (
                        <div key={serviceKey} className="service-node">
                          <label className="service-checkbox">
                      <input
                        type="checkbox"
                              checked={isPermissionGranted(factoryKey, deptKey, serviceKey)}
                              onChange={(e) => handlePermissionChange(factoryKey, deptKey, serviceKey, e.target.checked)}
                              disabled={!canEdit}
                            />
                            <span className="service-name">{serviceData.name}</span>
                    </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>
    </div>
  );
};

function AddUser() {
  const { user: currentUser } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appPassword, setAppPassword] = useState("");
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('user');

  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedUserInfo, setAddedUserInfo] = useState(null);

  // Clear form data when component mounts
  useEffect(() => {
    setUsername('');
    setEmail('');
    setPassword('');
    setAppPassword('');
    setRole('user');
    setPermissions({});
  }, []);

  // Set default permissions when role or departments change
  useEffect(() => {
    if (role === 'admin') {
      // For admin users, grant access to all factories, departments, and services using centralized RBAC
      const adminPermissions = {};
      
      // Grant access to all factories and their departments/services
      RBAC_HELPERS.getAllFactories().forEach(factory => {
        const departments = RBAC_HELPERS.getFactoryDepartments(factory);
        departments.forEach(dept => {
          const services = RBAC_HELPERS.getFactoryDepartmentServices(factory, dept);
          services.forEach(service => {
            const key = `${factory}.${dept}.${service}`;
            adminPermissions[key] = true;
          });
        });
      });
      
      setPermissions(adminPermissions);
      } else {
      // For regular users, start with no permissions (admin will assign specific ones)
      setPermissions({});
    }
  }, [role]);

  // Helper function to get services for a department
  const getServicesForDepartment = (department) => {
    const serviceMap = {
      humanresource: ['single_processing', 'batch_processing', 'reports'],
      store: ['inventory', 'reports'],
      marketing: ['marketing_campaigns', 'reports'],
      accounts: ['expense_management', 'reports'],
      reports_department: ['reports', 'reactor_reports'],
      operations_department: ['inventory', 'reports', 'reactor_reports']
    };
    return serviceMap[department] || [];
  };

  // Convert tree permissions to permission_metadata format (same as Dashboard.jsx)
  const convertTreePermissionsToMetadata = (treePermissions) => {
    const permissionMetadata = {
      factories: [],
      departments: {},
      services: {}
    };

    // Process each tree permission key (e.g., "kerur.store.kr_place_order")
    Object.keys(treePermissions).forEach(key => {
      if (treePermissions[key] === true) {
        const parts = key.split('.');
        if (parts.length >= 3) {
          const factory = parts[0];
          const department = parts[1];
          const serviceKey = parts[2]; // This is the full service key like "kr_place_order"

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

          // Add service to department - use the full service key
          const serviceKeyForMetadata = `${factory}.${department}`;
          if (!permissionMetadata.services[serviceKeyForMetadata]) {
            permissionMetadata.services[serviceKeyForMetadata] = [];
          }
          if (!permissionMetadata.services[serviceKeyForMetadata].includes(serviceKey)) {
            permissionMetadata.services[serviceKeyForMetadata].push(serviceKey);
          }
        }
      }
    });

    return permissionMetadata;
  };

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setAppPassword('');
    setRole('user');
    setPermissions({});
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowAppPassword(false);
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setAddedUserInfo(null);
    resetForm();
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Check if user has selected any permissions
    if (Object.keys(permissions).length === 0) {
      setError('Please select at least one permission for the user.');
      return;
    }
    
    try {
      // Convert tree permissions to permission_metadata format (same as Dashboard.jsx)
      const permissionMetadata = convertTreePermissionsToMetadata(permissions);
      
      const requestData = { 
        username, 
        email, 
        password, 
        appPassword,
        role,
        permission_metadata: permissionMetadata // Use permission_metadata format
      };
      
      const response = await axios.post(getApiUrl(ENDPOINTS.ADD_USER), 
        requestData,
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
        
        // Store user info for success modal
        setAddedUserInfo({
          username,
          email,
          role,
          permissionsCount: Object.keys(permissions).length
        });
        
        // Show success modal
        setShowSuccessModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error adding user');
      setSuccess('');
    }
  };

  const handlePermissionChange = (permissionKey, value) => {
    setPermissions(prev => ({
      ...prev,
      [permissionKey]: value
    }));
  };



  // Get current user info from auth context
  const getCurrentUserRole = () => {
    return currentUser?.role || 'user';
  };

  const getCurrentUserPermissions = () => {
    return currentUser?.permissions || {};
  };

  const hasUserPermission = (permission) => {
    // Use the new RBAC system - admin has all permissions
    return getCurrentUserRole() === 'admin';
  };



  const canCreateRole = (targetRole) => {
    // Use the new RBAC system - only admin can create admin users
    return getCurrentUserRole() === 'admin';
  };

  return (
    <div className="add-user-page-container">
      <div className="page-header">
        <button 
          className="back-btn"
          onClick={() => window.location.href = '/dashboard'}
        >
          ← Back to Dashboard
        </button>
        <h1>Add New User</h1>
      </div>
      
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      
      {/* Show Add User form if user is admin or has user_management permission */}
      {(getCurrentUserRole() === 'admin' || hasUserPermission('user_management')) ? (
        <div className="add-user-form">
          <form 
            id="add-user-form"
            onSubmit={handleAddUser}
            autoComplete="off"
            data-form-type="other"
          >
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                name="new-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                autoFill="off"
                data-form-type="other"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                name="new-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                autoFill="off"
                data-form-type="other"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFill="off"
                  data-form-type="other"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
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
              <label htmlFor="appPassword">App Password:</label>
              <div className="password-input-container">
                <input
                  type={showAppPassword ? "text" : "password"}
                  id="appPassword"
                  name="new-app-password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFill="off"
                  data-form-type="other"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowAppPassword(!showAppPassword)}
                  title={showAppPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showAppPassword ? (
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
              <label htmlFor="role">Base Role:</label>
              <select 
                id="role" 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="user">User</option>
                {canCreateRole('admin') && <option value="admin">Admin</option>}
              </select>
            </div>



            <div className="form-group permissions-section">
              <label>Permissions:</label>
              <div className="permissions-count">
                Selected: {Object.keys(permissions).length} permission(s)
              </div>
              <TreeBasedPermissions
                permissions={permissions}
                onPermissionChange={handlePermissionChange}
                isEditing={true}
                targetUserRole={role}
                currentUserRole={getCurrentUserRole()}
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="submit-btn">Add User</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="no-permission">
          <p>You don't have permission to add users.</p>
          <button onClick={() => window.history.back()} className="back-btn">
            Go Back
          </button>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="success-modal-header">
              <div className="success-icon">✓</div>
              <h3>User Added Successfully!</h3>
            </div>
            
            <div className="success-modal-body">
              <p className="success-message">
                The user has been successfully added to the system.
              </p>
              
              {addedUserInfo && (
                <div className="user-details-summary">
                  <div className="detail-row">
                    <span className="detail-label">Username:</span>
                    <span className="detail-value">{addedUserInfo.username}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{addedUserInfo.email}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Role:</span>
                    <span className="detail-value role-badge">{addedUserInfo.role.charAt(0).toUpperCase() + addedUserInfo.role.slice(1)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Permissions:</span>
                    <span className="detail-value">{addedUserInfo.permissionsCount} permission(s) assigned</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="success-modal-actions">
              <button 
                onClick={closeSuccessModal} 
                className="success-ok-btn"
              >
                Continue
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard'} 
                className="success-dashboard-btn"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddUser;