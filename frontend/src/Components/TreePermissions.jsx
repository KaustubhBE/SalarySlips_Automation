import React, { useState } from 'react';
import { FACTORY_RBAC_CONFIG } from '../config';

// Tree-based Permissions Component for dynamic factory.department.service combinations
const TreePermissions = ({ 
  permissions, 
  onPermissionChange, 
  onBatchPermissionChange,
  isEditing = false, 
  targetUserRole = 'user',
  currentUserRole = 'admin'
}) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());

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

  // Handle individual service permission change
  const handleServiceChange = (factory, department, service, value) => {
    const key = generatePermissionKey(factory, department, service);
    onPermissionChange(key, value);
  };

  // Handle department checkbox change
  const handleDepartmentChange = (factory, department, value) => {
    const departmentServices = permissionTree[factory].departments[department].services;
    
    // Collect all permission updates for this department
    const permissionUpdates = Object.keys(departmentServices).map(service => ({
      key: generatePermissionKey(factory, department, service),
      value: value
    }));
    
    // Use batch update if available, otherwise fall back to individual updates
    if (onBatchPermissionChange) {
      onBatchPermissionChange(permissionUpdates);
    } else {
      permissionUpdates.forEach(({ key, value }) => {
        onPermissionChange(key, value);
      });
    }
  };

  // Handle factory checkbox change
  const handleFactoryChange = (factory, value) => {
    const factoryDepartments = permissionTree[factory].departments;
    
    // Collect all permission updates for this factory
    const permissionUpdates = [];
    Object.keys(factoryDepartments).forEach(department => {
      const departmentServices = factoryDepartments[department].services;
      Object.keys(departmentServices).forEach(service => {
        permissionUpdates.push({
          key: generatePermissionKey(factory, department, service),
          value: value
        });
      });
    });
    
    // Use batch update if available, otherwise fall back to individual updates
    if (onBatchPermissionChange) {
      onBatchPermissionChange(permissionUpdates);
    } else {
      permissionUpdates.forEach(({ key, value }) => {
        onPermissionChange(key, value);
      });
    }
  };

  // Check if all services in a department are selected
  const isDepartmentFullySelected = (factory, department) => {
    const departmentServices = permissionTree[factory].departments[department].services;
    const serviceKeys = Object.keys(departmentServices);
    
    if (serviceKeys.length === 0) return false;
    
    return serviceKeys.every(service => isPermissionGranted(factory, department, service));
  };

  // Check if all services in a factory are selected
  const isFactoryFullySelected = (factory) => {
    const factoryDepartments = permissionTree[factory].departments;
    
    return Object.keys(factoryDepartments).every(department => 
      isDepartmentFullySelected(factory, department)
    );
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

  // Check if user can edit permissions
  const canEdit = isEditing && currentUserRole === 'admin';

  return (
    <div className="tree-permissions-container">
      <div className="permissions-header">
        <h4>Factory-Department-Service Permissions</h4>
        <p className="permissions-description">
          Select specific combinations to grant access.
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
                              onChange={(e) => handleServiceChange(factoryKey, deptKey, serviceKey, e.target.checked)}
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

export default TreePermissions;