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
import PasswordToggle from './Components/Password-Toggle';
import BackButton from './Components/BackButton';
import ConfirmModal from './Components/ConfirmModal';

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
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');

  const [permissions, setPermissions] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [addedUserInfo, setAddedUserInfo] = useState(null);
  const [passwordMismatchError, setPasswordMismatchError] = useState("");
  const [passwordValidationErrors, setPasswordValidationErrors] = useState([]);
  const [emailValidationErrors, setEmailValidationErrors] = useState([]);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);

  // Clear form data when component mounts
  useEffect(() => {
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('user');
    setPermissions({});
    setPasswordMismatchError("");
    setPasswordValidationErrors([]);
    setEmailValidationErrors([]);
    setShowPermissionWarning(false);
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
    setConfirmPassword('');
    setRole('user');
    setPermissions({});
    setError('');
    setSuccess('');
    setShowPassword(false);
    setPasswordMismatchError("");
    setPasswordValidationErrors([]);
    setEmailValidationErrors([]);
    setShowPermissionWarning(false);
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setAddedUserInfo(null);
    resetForm();
  };

  // Validate email requirements
  const validateEmail = (emailValue) => {
    const errors = [];
    
    if (!emailValue || emailValue.trim().length === 0) {
      errors.push('Email is required');
      return errors;
    }
    
    // Check for @ symbol
    if (!emailValue.includes('@')) {
      errors.push('@ symbol is missing');
    }
    
    // If @ exists, check all parts
    if (emailValue.includes('@')) {
      const parts = emailValue.split('@');
      
      // Check for multiple @ symbols
      if (parts.length > 2) {
        errors.push('Multiple @ symbols are not allowed');
      }
      
      // If we have exactly 2 parts, validate both
      if (parts.length === 2) {
        const [localPart, domain] = parts;
        
        // Check local part (before @)
        if (!localPart || localPart.trim().length === 0) {
          errors.push('Email address before @ is missing');
        }
        
        // Check domain (after @) - check all conditions independently
        if (!domain || domain.trim().length === 0) {
          errors.push('Domain after @ is missing');
        } else {
          // Domain exists, check for dot
          if (!domain.includes('.')) {
            errors.push('Domain must contain a dot (.)');
          }
          
          // If domain has dot, also check extension
          if (domain.includes('.')) {
            const domainParts = domain.split('.');
            const extension = domainParts[domainParts.length - 1];
            
            if (!extension || extension.trim().length === 0) {
              errors.push('Domain extension (like .com, .in) is missing');
            } else if (extension.length < 2) {
              errors.push('Domain extension (like .com, .in) must be at least 2 characters');
            }
          }
        }
      }
    }
    
    // Check for valid email format using regex (only if we have @ and basic structure)
    // Show this error if format is invalid, even if we have other specific errors
    if (emailValue.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        // Add "Invalid email format" to show overall format issue
        // This helps users understand the email structure is wrong
        errors.push('Invalid email format');
      }
    }
    
    return errors;
  };

  // Prevent pasting in password fields
  const handlePastePrevention = (e) => {
    e.preventDefault();
    return false;
  };

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

  const handlePasswordChange = (value) => {
    setPassword(value);
    
    // Real-time password validation
    if (value.length === 0) {
      setPasswordValidationErrors([]);
    } else {
      const validationErrors = validatePassword(value);
      setPasswordValidationErrors(validationErrors);
    }
    
    if (value && confirmPassword) {
      if (value !== confirmPassword) {
        setPasswordMismatchError("Passwords do not match");
      } else {
        setPasswordMismatchError("");
      }
    } else {
      setPasswordMismatchError("");
    }
  };

  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    if (value && password) {
      if (value !== password) {
        setPasswordMismatchError("Passwords do not match");
      } else {
        setPasswordMismatchError("");
      }
    } else {
      setPasswordMismatchError("");
    }
  };

  const handleClosePermissionWarning = () => {
    setShowPermissionWarning(false);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Validate email requirements
    const emailValidationErrors = validateEmail(email);
    if (emailValidationErrors.length > 0) {
      setEmailValidationErrors(emailValidationErrors);
      setError('Email does not meet requirements');
      return;
    }
    
    // Check if user has selected any permissions
    if (!Object.values(permissions).some(value => value === true)) {
      setShowPermissionWarning(true);
      setError('');
      return;
    }
    
    // Validate password requirements
    const validationErrors = validatePassword(password);
    if (validationErrors.length > 0) {
      setPasswordValidationErrors(validationErrors);
      setError('Password does not meet requirements');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setPasswordMismatchError("Passwords do not match");
      return;
    }
    
    // Clear validation errors if password is valid
    setPasswordValidationErrors([]);
    
    try {
      // Convert tree permissions to permission_metadata format (same as Dashboard.jsx)
      const permissionMetadata = convertTreePermissionsToMetadata(permissions);
      
      const requestData = { 
        username, 
        email, 
        password, 
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
        setPasswordMismatchError("");
        setPasswordValidationErrors([]);
        setEmailValidationErrors([]);
        
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
        <BackButton label="Back to Dashboard" to="/dashboard" />
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
                onChange={(e) => {
                  const emailValue = e.target.value;
                  setEmail(emailValue);
                  
                  // Real-time email validation
                  if (emailValue.length === 0) {
                    setEmailValidationErrors([]);
                  } else {
                    const validationErrors = validateEmail(emailValue);
                    setEmailValidationErrors(validationErrors);
                  }
                }}
                autoComplete="off"
                autoFill="off"
                data-form-type="other"
                required
              />
              {emailValidationErrors.length > 0 && (
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
                    <span>Email requirements:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {emailValidationErrors.map((error, index) => (
                      <li key={index} style={{ marginBottom: '2px' }}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <PasswordToggle
                id="password"
                name="new-password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                autoComplete="new-password"
                required
                inputProps={{ onPaste: handlePastePrevention }}
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
              <label htmlFor="confirm-password">Confirm Password:</label>
              <PasswordToggle
                id="confirm-password"
                name="confirm-new-password"
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                autoComplete="new-password"
                required
                inputProps={{ onPaste: handlePastePrevention }}
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
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={!email || emailValidationErrors.length > 0 || !password || passwordValidationErrors.length > 0 || password !== confirmPassword}
              >
                Add User
              </button>
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

      <ConfirmModal
        isOpen={showPermissionWarning}
        onClose={handleClosePermissionWarning}
        title="Permissions Required"
        icon="⚠️"
        message="Please select at least one permission before adding a user."
        warningText="Permissions define what the user can access after creation."
        primaryAction={{
          label: 'Okay',
          onClick: handleClosePermissionWarning,
          title: 'Close message',
        }}
      />

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