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
  const [role, setRole] = useState('user');

  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Clear form data when component mounts
  useEffect(() => {
    setUsername('');
    setEmail('');
    setPassword('');
    setAppPassword('');
    setRole('user');
    setPermissions({});
    
    // Debug logging for configuration
    console.log('AddUser component mounted');
    console.log('ENDPOINTS:', ENDPOINTS);
    console.log('ENDPOINTS.ADD_USER:', ENDPOINTS.ADD_USER);
    console.log('getApiUrl(ENDPOINTS.ADD_USER):', getApiUrl(ENDPOINTS.ADD_USER));
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

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setAppPassword('');
    setRole('user');
    setPermissions({});
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Debug logging
    console.log('ENDPOINTS:', ENDPOINTS);
    console.log('ENDPOINTS.ADD_USER:', ENDPOINTS.ADD_USER);
    console.log('getApiUrl(ENDPOINTS.ADD_USER):', getApiUrl(ENDPOINTS.ADD_USER));
    
    try {
      // Convert tree permissions to permission_metadata format (same as Dashboard.jsx)
      const permissionMetadata = convertTreePermissionsToMetadata(permissions);
      
      console.log('Original permissions:', permissions);
      console.log('Converted permission_metadata:', permissionMetadata);
      
      const response = await axios.post(getApiUrl(ENDPOINTS.ADD_USER), 
        { 
          username, 
          email, 
          password, 
          appPassword,
          role,
          permission_metadata: permissionMetadata // Use permission_metadata format
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
        // Clear form completely
        resetForm();
      }
    } catch (err) {
      console.error('Error details:', err);
      console.error('Error response:', err.response);
      console.error('Error request:', err.request);
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
    <div className="dashboard-container">
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
              <input
                type="password"
                id="password"
                name="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFill="off"
                data-form-type="other"
                required
              />
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
                {canCreateRole('admin') && <option value="admin">Admin</option>}
              </select>
            </div>



            <div className="form-group permissions-section">
              <label>Permissions:</label>
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
    </div>
  );
}

export default AddUser;