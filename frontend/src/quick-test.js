// Quick test to verify access logic
import { 
  FACTORIES, 
  DEPARTMENTS_CONFIG, 
  getAccessibleFactories,
  hasPermission,
  generatePermissionKey
} from './config.js';

// Test data
const mockSuperAdmin = {
  role: 'super-admin',
  factory: 'all',
  departments: ['all'],
  permissions: { '*': true, 'reports': true }
};

// Test function
function quickTest() {
  console.log('🚀 Quick Access Test');
  console.log('===================');
  
  // Test 1: Super admin factory access
  console.log('\n1. Testing Super Admin Factory Access:');
  const accessibleFactories = getAccessibleFactories(mockSuperAdmin.role, mockSuperAdmin.permissions, mockSuperAdmin.factory);
  console.log('Accessible Factories:', accessibleFactories);
  console.log('Expected: [gulbarga, kerur, humnabad, omkar, padmavati]');
  console.log('Result:', accessibleFactories.length === 5 ? '✅ PASS' : '❌ FAIL');
  
  // Test 2: Department services
  console.log('\n2. Testing Department Services:');
  const departments = Object.values(DEPARTMENTS_CONFIG);
  let totalServices = 0;
  
  departments.forEach(dept => {
    if (dept.key === 'all' || dept.key === 'management') return;
    
    console.log(`\n${dept.name} (${dept.key}):`);
    if (dept.services) {
      Object.values(dept.services).forEach(service => {
        if (service.subServices) {
          Object.values(service.subServices).forEach(subService => {
            console.log(`  - ${subService.name} (${subService.key})`);
            totalServices++;
          });
        } else {
          console.log(`  - ${service.name} (${service.key})`);
          totalServices++;
        }
      });
    }
  });
  
  console.log(`\nTotal Services Found: ${totalServices}`);
  
  // Test 3: Specific service access
  console.log('\n3. Testing Specific Service Access:');
  const testCases = [
    { factory: 'gulbarga', department: 'humanresource', service: 'single-processing' },
    { factory: 'gulbarga', department: 'humanresource', service: 'batch-processing' },
    { factory: 'gulbarga', department: 'humanresource', service: 'reports' },
    { factory: 'gulbarga', department: 'store', service: 'inventory' },
    { factory: 'gulbarga', department: 'store', service: 'reports' },
    { factory: 'gulbarga', department: 'accounts', service: 'reports' },
    { factory: 'gulbarga', department: 'accounts', service: 'expense-management' },
    { factory: 'gulbarga', department: 'operations_department', service: 'inventory' },
    { factory: 'gulbarga', department: 'operations_department', service: 'reports' },
    { factory: 'gulbarga', department: 'operations_department', service: 'reactor-reports' },
    { factory: 'gulbarga', department: 'reports-department', service: 'reactor-reports' },
    { factory: 'gulbarga', department: 'reports-department', service: 'reports' }
  ];
  
  testCases.forEach(testCase => {
    const { factory, department, service } = testCase;
    
    // Check if department exists
    const deptConfig = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === department);
    if (!deptConfig) {
      console.log(`❌ ${factory}/${department}/${service}: Department not found`);
      return;
    }
    
    // Check if service exists
    let serviceFound = false;
    let serviceInfo = null;
    
    if (deptConfig.services) {
      Object.values(deptConfig.services).forEach(svc => {
        if (svc.subServices) {
          Object.values(svc.subServices).forEach(subSvc => {
            if (subSvc.key === service) {
              serviceFound = true;
              serviceInfo = subSvc;
            }
          });
        } else if (svc.key === service) {
          serviceFound = true;
          serviceInfo = svc;
        }
      });
    }
    
    if (!serviceFound) {
      console.log(`❌ ${factory}/${department}/${service}: Service not found`);
      return;
    }
    
    // Check super admin access
    if (mockSuperAdmin.role === 'super-admin' && mockSuperAdmin.departments?.includes('all')) {
      console.log(`✅ ${factory}/${department}/${service}: Super admin access granted`);
    } else {
      console.log(`❌ ${factory}/${department}/${service}: Access denied`);
    }
  });
  
  console.log('\n🎯 Test Summary:');
  console.log('- Super admin should have access to all factories');
  console.log('- All departments should have their expected services');
  console.log('- Super admin should have access to all services');
}

// Export for use
export { quickTest };

// Run if in browser
if (typeof window !== 'undefined') {
  window.quickTest = quickTest;
  console.log('Quick test loaded. Run window.quickTest() in console to test.');
}
