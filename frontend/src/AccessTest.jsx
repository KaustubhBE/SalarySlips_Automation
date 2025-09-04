import React, { useState } from 'react';
import { 
  DEPARTMENTS_CONFIG, 
  hasPermission
} from './config';

const AccessTest = () => {
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Mock user data for testing with enhanced flat tree_permissions
  const mockAdmin = {
    role: 'admin',
    tree_permissions: {
      // Gulbarga permissions
      'gulbarga.humanresource.single_processing': true,
      'gulbarga.humanresource.batch_processing': true,
      'gulbarga.humanresource.reports': true,
      'gulbarga.store.inventory': true,
      'gulbarga.store.reports': true,
      'gulbarga.marketing.marketing_campaigns': true,
      'gulbarga.marketing.reports': true,
      'gulbarga.accounts.expense_management': true,
      'gulbarga.accounts.reports': true,
      'gulbarga.reports_department.reports': true,
      'gulbarga.reports_department.reactor_reports': true,
      'gulbarga.operations_department.inventory': true,
      'gulbarga.operations_department.reports': true,
      'gulbarga.operations_department.reactor_reports': true,
      
      // Kerur permissions
      'kerur.humanresource.single_processing': true,
      'kerur.humanresource.batch_processing': true,
      'kerur.humanresource.reports': true,
      'kerur.store.inventory': true,
      'kerur.store.reports': true,
      'kerur.marketing.marketing_campaigns': true,
      'kerur.marketing.reports': true,
      'kerur.accounts.expense_management': true,
      'kerur.accounts.reports': true,
      'kerur.reports_department.reports': true,
      'kerur.reports_department.reactor_reports': true,
      'kerur.operations_department.inventory': true,
      'kerur.operations_department.reports': true,
      'kerur.operations_department.reactor_reports': true
    },
    permission_metadata: {
      factories: ['gulbarga', 'kerur'],
      departments: {
        gulbarga: ['humanresource', 'store', 'marketing', 'accounts', 'reports_department', 'operations_department'],
        kerur: ['humanresource', 'store', 'marketing', 'accounts', 'reports_department', 'operations_department']
      },
      services: {
        'gulbarga.humanresource': ['single_processing', 'batch_processing', 'reports'],
        'gulbarga.store': ['inventory', 'reports'],
        'gulbarga.marketing': ['marketing_campaigns', 'reports'],
        'gulbarga.accounts': ['expense_management', 'reports'],
        'gulbarga.reports_department': ['reports', 'reactor_reports'],
        'gulbarga.operations_department': ['inventory', 'reports', 'reactor_reports'],
        'kerur.humanresource': ['single_processing', 'batch_processing', 'reports'],
        'kerur.store': ['inventory', 'reports'],
        'kerur.marketing': ['marketing_campaigns', 'reports'],
        'kerur.accounts': ['expense_management', 'reports'],
        'kerur.reports_department': ['reports', 'reactor_reports'],
        'kerur.operations_department': ['inventory', 'reports', 'reactor_reports']
      }
    }
  };

  const mockUser1 = {
    role: 'user',
    tree_permissions: {
      'gulbarga.humanresource.single_processing': true,
      'gulbarga.humanresource.batch_processing': true,
      'gulbarga.store.inventory': true,
      'gulbarga.humanresource.reports': true,
      'gulbarga.store.reports': true
    }
  }

  const mockUser2 = {
    role: 'user',
    tree_permissions: {
      'kerur': {
        'marketing': {
          'marketing_campaigns': true,
          'reports': true
        },
        'accounts': {
          'expense_management': true,
          'reports': true
        }
      }
    }
  }

  const mockUser3 = {
    role: 'user',
    tree_permissions: {
      'humnabad.reports_department.reports': true,
      'humnabad.reports_department.reactor_reports': true,
      'humnabad.operations_department.inventory': true,
      'humnabad.operations_department.reports': true,
      'humnabad.operations_department.reactor_reports': true
    }
  }

  // Test function to check service access using tree_permissions
  const testServiceAccess = (user, departmentKey, serviceKey) => {
    // Check if user has access to department
    if (user.role === 'admin') {
      return { success: true, reason: 'Admin has access to all departments' };
    }
    
    // Check if department exists in config
    const department = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === departmentKey);
    if (!department) {
      return { success: false, reason: `Department ${departmentKey} not found in config` };
    }
    
    // Check if service exists in department
    let serviceFound = false;
    let serviceInfo = null;
    
    if (department.services) {
      Object.values(department.services).forEach(service => {
        if (service.subServices) {
          // Check sub-services
          Object.values(service.subServices).forEach(subService => {
            if (subService.key === serviceKey) {
              serviceFound = true;
              serviceInfo = subService;
            }
          });
        } else if (service.key === serviceKey) {
          serviceFound = true;
          serviceInfo = service;
        }
      });
    }
    
    if (!serviceFound) {
      return { success: false, reason: `Service ${serviceKey} not found in department ${departmentKey}` };
    }
    
    // Check tree-based permissions for this specific service in this department
    const treePermissions = user.tree_permissions || {};
    
    // Check enhanced flat tree-based permissions
    const hasTreePermission = Object.keys(treePermissions).some(key => {
      const permissionValue = treePermissions[key];
      
      if (typeof permissionValue === 'boolean' && permissionValue === true) {
        const parts = key.split('.');
        return parts.length >= 3 && parts[1] === departmentKey && parts[2] === serviceKey;
      }
      return false;
    });
    
    if (hasTreePermission) {
      return { success: true, reason: `User has tree permission for ${departmentKey}.${serviceKey}` };
    }
    
    return { success: false, reason: `User lacks tree permission for ${departmentKey}.${serviceKey}` };
  };

  const runComprehensiveTest = () => {
    setIsRunning(true);
    const results = {
      admin: { passed: 0, total: 0, details: [] },
      user1: { passed: 0, total: 0, details: [] },
      user2: { passed: 0, total: 0, details: [] },
      user3: { passed: 0, total: 0, details: [] }
    };

    const departments = Object.values(DEPARTMENTS_CONFIG);

    // Test Admin Access (all departments)
    departments.forEach(deptConfig => {
      if (deptConfig.key === 'all' || deptConfig.key === 'management') return;
      
      const departmentKey = deptConfig.key;
      
      if (deptConfig.services) {
        Object.values(deptConfig.services).forEach(service => {
          if (service.subServices) {
            // Test sub-services
            Object.values(service.subServices).forEach(subService => {
              results.admin.total++;
              const testResult = testServiceAccess(mockAdmin, departmentKey, subService.key);
              if (testResult.success) {
                results.admin.passed++;
              }
              results.admin.details.push({
                department: departmentKey,
                service: subService.key,
                ...testResult
              });
            });
          } else {
            // Test direct services
            results.admin.total++;
            const testResult = testServiceAccess(mockAdmin, departmentKey, service.key);
            if (testResult.success) {
              results.admin.passed++;
            }
            results.admin.details.push({
              department: departmentKey,
              service: service.key,
              ...testResult
            });
          }
        });
      }
    });

    // Test User1 Access (Gulbarga - Human Resource & Store)
    const user1Departments = ['humanresource', 'store'];
    user1Departments.forEach(departmentKey => {
      const deptConfig = departments.find(dept => dept.key === departmentKey);
      if (deptConfig) {
        
        if (deptConfig.services) {
          Object.values(deptConfig.services).forEach(service => {
            if (service.subServices) {
              // Test sub-services
              Object.values(service.subServices).forEach(subService => {
                results.user1.total++;
                const testResult = testServiceAccess(mockUser1, departmentKey, subService.key);
                if (testResult.success) {
                  results.user1.passed++;
                }
                results.user1.details.push({
                  department: departmentKey,
                  service: subService.key,
                  ...testResult
                });
              });
            } else {
              // Test direct services
              results.user1.total++;
              const testResult = testServiceAccess(mockUser1, departmentKey, service.key);
              if (testResult.success) {
                results.user1.passed++;
              }
              results.user1.details.push({
                department: departmentKey,
                service: service.key,
                ...testResult
              });
            }
          });
        }
      }
    });

    // Test User2 Access (Kerur - Marketing & Accounts)
    const user2Departments = ['marketing', 'accounts'];
    user2Departments.forEach(departmentKey => {
      const deptConfig = departments.find(dept => dept.key === departmentKey);
      if (deptConfig) {
        
        if (deptConfig.services) {
          Object.values(deptConfig.services).forEach(service => {
            if (service.subServices) {
              // Test sub-services
              Object.values(service.subServices).forEach(subService => {
                results.user2.total++;
                const testResult = testServiceAccess(mockUser2, departmentKey, subService.key);
                if (testResult.success) {
                  results.user2.passed++;
                }
                results.user2.details.push({
                  department: departmentKey,
                  service: subService.key,
                  ...testResult
                });
              });
            } else {
              // Test direct services
              results.user2.total++;
              const testResult = testServiceAccess(mockUser2, departmentKey, service.key);
              if (testResult.success) {
                results.user2.passed++;
              }
              results.user2.details.push({
                department: departmentKey,
                service: service.key,
                ...testResult
              });
            }
          });
        }
      }
    });

    // Test User3 Access (Humnabad - Reports & Operations)
    const user3Departments = ['reports_department', 'operations_department'];
    user3Departments.forEach(departmentKey => {
      const deptConfig = departments.find(dept => dept.key === departmentKey);
      if (deptConfig) {
        
        if (deptConfig.services) {
          Object.values(deptConfig.services).forEach(service => {
            if (service.subServices) {
              // Test sub-services
              Object.values(service.subServices).forEach(subService => {
                results.user3.total++;
                const testResult = testServiceAccess(mockUser3, departmentKey, subService.key);
                if (testResult.success) {
                  results.user3.passed++;
                }
                results.user3.details.push({
                  department: departmentKey,
                  service: subService.key,
                  ...testResult
                });
              });
            } else {
              // Test direct services
              results.user3.total++;
              const testResult = testServiceAccess(mockUser3, departmentKey, service.key);
              if (testResult.success) {
                results.user3.passed++;
              }
              results.user3.details.push({
                department: departmentKey,
                service: service.key,
                ...testResult
              });
            }
          });
        }
      }
    });

    setTestResults(results);
    setIsRunning(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Department-Service Access Test</h1>
      
      <button 
        onClick={runComprehensiveTest} 
        disabled={isRunning}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: isRunning ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isRunning ? 'not-allowed' : 'pointer'
        }}
      >
        {isRunning ? 'Running Test...' : 'Run Access Test'}
      </button>

      {testResults && (
        <div style={{ marginTop: '20px' }}>
          <h2>Test Results</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <h3>Admin Access (All Departments)</h3>
            <p>
              <strong>Passed:</strong> {testResults.admin.passed}/{testResults.admin.total} 
              ({((testResults.admin.passed/testResults.admin.total)*100).toFixed(1)}%)
            </p>
            <div style={{ 
              backgroundColor: testResults.admin.passed === testResults.admin.total ? '#d4edda' : '#f8d7da',
              padding: '10px',
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              {testResults.admin.passed === testResults.admin.total ? 
                '✅ Admin access is working correctly' : 
                '❌ Admin access has issues'
              }
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>User1 Access (Gulbarga - Human Resource & Store)</h3>
            <p>
              <strong>Passed:</strong> {testResults.user1.passed}/{testResults.user1.total} 
              ({((testResults.user1.passed/testResults.user1.total)*100).toFixed(1)}%)
            </p>
            <div style={{ 
              backgroundColor: testResults.user1.passed === testResults.user1.total ? '#d4edda' : '#f8d7da',
              padding: '10px',
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              {testResults.user1.passed === testResults.user1.total ? 
                '✅ User1 access is working correctly' : 
                '❌ User1 access has issues'
              }
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>User2 Access (Kerur - Marketing & Accounts)</h3>
            <p>
              <strong>Passed:</strong> {testResults.user2.passed}/{testResults.user2.total} 
              ({((testResults.user2.passed/testResults.user2.total)*100).toFixed(1)}%)
            </p>
            <div style={{ 
              backgroundColor: testResults.user2.passed === testResults.user2.total ? '#d4edda' : '#f8d7da',
              padding: '10px',
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              {testResults.user2.passed === testResults.user2.total ? 
                '✅ User2 access is working correctly' : 
                '❌ User2 access has issues'
              }
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>User3 Access (Humnabad - Reports & Operations)</h3>
            <p>
              <strong>Passed:</strong> {testResults.user3.passed}/{testResults.user3.total} 
              ({((testResults.user3.passed/testResults.user3.total)*100).toFixed(1)}%)
            </p>
            <div style={{ 
              backgroundColor: testResults.user3.passed === testResults.user3.total ? '#d4edda' : '#f8d7da',
              padding: '10px',
              borderRadius: '5px',
              marginTop: '10px'
            }}>
              {testResults.user3.passed === testResults.user3.total ? 
                '✅ User3 access is working correctly' : 
                '❌ User3 access has issues'
              }
            </div>
          </div>

          <details style={{ marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Detailed Results</summary>
            <div style={{ marginTop: '10px' }}>
              <h4>Admin Details:</h4>
              {testResults.admin.details.map((detail, index) => (
                <div key={index} style={{ 
                  margin: '5px 0', 
                  padding: '5px',
                  backgroundColor: detail.success ? '#d4edda' : '#f8d7da',
                  borderRadius: '3px'
                }}>
                  <strong>{detail.department}/{detail.service}:</strong> 
                  {detail.success ? ' ✅ ' : ' ❌ '}
                  {detail.reason}
                </div>
              ))}
              
              <h4>User1 Details (Gulbarga - Human Resource & Store):</h4>
              {testResults.user1.details.map((detail, index) => (
                <div key={index} style={{ 
                  margin: '5px 0', 
                  padding: '5px',
                  backgroundColor: detail.success ? '#d4edda' : '#f8d7da',
                  borderRadius: '3px'
                }}>
                  <strong>{detail.department}/{detail.service}:</strong> 
                  {detail.success ? ' ✅ ' : ' ❌ '}
                  {detail.reason}
                </div>
              ))}
              
              <h4>User2 Details (Kerur - Marketing & Accounts):</h4>
              {testResults.user2.details.map((detail, index) => (
                <div key={index} style={{ 
                  margin: '5px 0', 
                  padding: '5px',
                  backgroundColor: detail.success ? '#d4edda' : '#f8d7da',
                  borderRadius: '3px'
                }}>
                  <strong>{detail.department}/{detail.service}:</strong> 
                  {detail.success ? ' ✅ ' : ' ❌ '}
                  {detail.reason}
                </div>
              ))}
              
              <h4>User3 Details (Humnabad - Reports & Operations):</h4>
              {testResults.user3.details.map((detail, index) => (
                <div key={index} style={{ 
                  margin: '5px 0', 
                  padding: '5px',
                  backgroundColor: detail.success ? '#d4edda' : '#f8d7da',
                  borderRadius: '3px'
                }}>
                  <strong>{detail.department}/{detail.service}:</strong> 
                  {detail.success ? ' ✅ ' : ' ❌ '}
                  {detail.reason}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default AccessTest;
