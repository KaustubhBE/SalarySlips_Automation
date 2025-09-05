import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { DEPARTMENTS_CONFIG } from './config';

const NavigationTest = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const testNavigationTree = () => {
    console.log('=== NAVIGATION TREE TEST ===');
    console.log('User:', user);
    console.log('User Role:', user?.role);
    console.log('User Permissions:', user?.permissions);
    
    // Test 1: Main App Routes
    console.log('\n1. MAIN APP ROUTES:');
    console.log('  /app - Main menu with department buttons');
    console.log('  /login - Login page');
    console.log('  /dashboard - User management (admin only)');
    console.log('  /add-user - Add user (admin only)');
    console.log('  /settings - Settings page');
    console.log('  /reports-department - Reports department');
    
    // Test 2: Department Routes
    console.log('\n2. DEPARTMENT ROUTES:');
    console.log('  /departments - Department selection');
    Object.values(DEPARTMENTS_CONFIG).forEach(dept => {
      if (dept.key !== 'all' && dept.key !== 'management') {
        console.log(`  /department/${dept.key} - ${dept.name} Department`);
      }
    });
    
    // Test 3: Service Routes
    console.log('\n3. SERVICE ROUTES:');
    Object.values(DEPARTMENTS_CONFIG).forEach(dept => {
      if (dept.key !== 'all' && dept.key !== 'management' && dept.services) {
        Object.values(dept.services).forEach(service => {
          if (service.subServices) {
            Object.values(service.subServices).forEach(subService => {
              console.log(`  /department/${dept.key}/${subService.key} - ${dept.name} - ${subService.name}`);
            });
          } else if (service.permission) {
            console.log(`  /department/${dept.key}/${service.key} - ${dept.name} - ${service.name}`);
          }
        });
      }
    });
    
    // Test 4: Legacy Routes
    console.log('\n4. LEGACY ROUTES:');
    console.log('  /humanresource/* - Human Resource (legacy)');
    console.log('  /marketing - Marketing (legacy)');
    console.log('  /store/* - Store (legacy)');
    console.log('  /accounts/* - Accounts (legacy)');
    console.log('  /single-processing/* - Single Processing (legacy)');
    console.log('  /batch-processing/* - Batch Processing (legacy)');
    console.log('  /inventory/* - Inventory (legacy)');
    console.log('  /reports - Reports (legacy)');
    console.log('  /reactor-reports - Reactor Reports (legacy)');
    
    console.log('\n=== END NAVIGATION TREE TEST ===');
  };

  const testSpecificRoutes = () => {
    console.log('\n=== TESTING SPECIFIC ROUTES ===');
    
    // Test Department Navigation
    console.log('\nTesting Department Navigation:');
    console.log('1. Navigate to /departments');
    navigate('/departments');
    
    setTimeout(() => {
      console.log('2. Navigate to /department/humanresource');
      navigate('/department/humanresource');
      
      setTimeout(() => {
        console.log('3. Navigate to /department/humanresource/single-processing');
        navigate('/department/humanresource/single-processing');
      }, 1000);
    }, 1000);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Navigation Tree Test</h1>
      <p>This component tests the complete navigation tree structure.</p>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testNavigationTree} style={{ marginRight: '10px' }}>
          Test Navigation Tree
        </button>
        <button onClick={testSpecificRoutes}>
          Test Specific Routes
        </button>
      </div>
      
      <div style={{ backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '5px' }}>
        <h3>Current User Info:</h3>
        <p><strong>Role:</strong> {user?.role || 'Not logged in'}</p>
        <p><strong>Email:</strong> {user?.email || 'Not logged in'}</p>
        <p><strong>Permissions:</strong> {user?.permissions ? Object.keys(user.permissions).join(', ') : 'None'}</p>
        <p><strong>Permission Metadata:</strong> {user?.permission_metadata ? JSON.stringify(user.permission_metadata, null, 2) : 'None'}</p>
        <p><strong>Tree Permissions:</strong> {user?.tree_permissions ? JSON.stringify(user.tree_permissions, null, 2) : 'None'}</p>
        <p><strong>Departments:</strong> {user?.departments ? user.departments.join(', ') : 'None'}</p>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Navigation Structure:</h3>
        <ul>
          <li><strong>/app</strong> - Main menu with department selection</li>
          <li><strong>/departments</strong> - Department navigation page</li>
          <li><strong>/department/:departmentKey</strong> - Specific department page</li>
          <li><strong>/department/:departmentKey/:service</strong> - Department service page</li>
          <li><strong>/dashboard</strong> - User management (admin only)</li>
          <li><strong>/add-user</strong> - Add user (admin only)</li>
        </ul>
      </div>
    </div>
  );
};

export default NavigationTest;
