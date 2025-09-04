import React from 'react';
import { useAuth } from './Components/AuthContext';

const PermissionTest = () => {
  const { user } = useAuth();

  // Test permission checking logic
  const testPermissionLogic = () => {
    if (!user) return null;

    const treePermissions = user.tree_permissions || {};
    const permissionMetadata = user.permission_metadata || {};

    console.log('=== PERMISSION TEST RESULTS ===');
    console.log('User:', user.username, user.role);
    console.log('Tree Permissions:', treePermissions);
    console.log('Permission Metadata:', permissionMetadata);

    // Test department access
    const testDepartments = ['humanresource', 'store', 'operations_department', 'reports_department', 'accounts', 'marketing'];
    
    testDepartments.forEach(dept => {
      // Check metadata
      let hasMetadataAccess = false;
      if (permissionMetadata.departments) {
        hasMetadataAccess = Object.values(permissionMetadata.departments).some(deptList => 
          Array.isArray(deptList) && deptList.includes(dept)
        );
      }

      // Check tree permissions
      let hasTreeAccess = false;
      Object.keys(treePermissions).forEach(key => {
        const permissionValue = treePermissions[key];
        if (typeof permissionValue === 'boolean' && permissionValue === true) {
          const parts = key.split('.');
          if (parts.length >= 2 && parts[1] === dept) {
            hasTreeAccess = true;
          }
        }
      });

      console.log(`Department ${dept}:`, {
        hasMetadataAccess,
        hasTreeAccess,
        shouldHaveAccess: hasMetadataAccess || hasTreeAccess
      });
    });

    // Test service access
    const testServices = ['single_processing', 'inventory', 'reports', 'reactor_reports', 'expense_management', 'marketing_campaigns'];
    
    testServices.forEach(service => {
      let hasServiceAccess = false;
      Object.keys(treePermissions).forEach(key => {
        const permissionValue = treePermissions[key];
        if (typeof permissionValue === 'boolean' && permissionValue === true) {
          const parts = key.split('.');
          if (parts.length >= 3 && parts[2] === service) {
            hasServiceAccess = true;
          }
        }
      });

      console.log(`Service ${service}:`, {
        hasServiceAccess
      });
    });

    console.log('=== END PERMISSION TEST ===');
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', margin: '20px', borderRadius: '8px' }}>
      <h2>Permission Test Component</h2>
      <button onClick={testPermissionLogic} style={{ padding: '10px', margin: '10px' }}>
        Run Permission Test
      </button>
      <div style={{ marginTop: '20px' }}>
        <h3>Current User Data:</h3>
        <pre style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default PermissionTest;
