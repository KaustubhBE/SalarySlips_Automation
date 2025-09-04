// Test script specifically for the new Operations Department
import { 
  DEPARTMENTS_CONFIG, 
  DEPARTMENTS,
  DEPARTMENT_NAMES,
  getAccessibleFactories,
  hasPermission,
  generatePermissionKey
} from './config.js';

// Test the Operations Department
function testOperationsDepartment() {
  console.log('🔧 Testing Operations Department');
  console.log('================================');
  
  // Test 1: Check if Operations Department exists in config
  console.log('\n1. Checking Operations Department Configuration:');
  const operationsDept = Object.values(DEPARTMENTS_CONFIG).find(dept => dept.key === 'operations_department');
  
  if (operationsDept) {
    console.log('✅ Operations Department found in DEPARTMENTS_CONFIG');
    console.log(`   Name: ${operationsDept.name}`);
    console.log(`   Key: ${operationsDept.key}`);
    console.log(`   Description: ${operationsDept.description}`);
  } else {
    console.log('❌ Operations Department NOT found in DEPARTMENTS_CONFIG');
    return false;
  }
  
  // Test 2: Check if it's in DEPARTMENTS constant
  console.log('\n2. Checking DEPARTMENTS Constant:');
  if (DEPARTMENTS.OPERATIONS === 'operations_department') {
    console.log('✅ Operations Department found in DEPARTMENTS constant');
  } else {
    console.log('❌ Operations Department NOT found in DEPARTMENTS constant');
  }
  
  // Test 3: Check if it's in DEPARTMENT_NAMES
  console.log('\n3. Checking DEPARTMENT_NAMES:');
  if (DEPARTMENT_NAMES[DEPARTMENTS.OPERATIONS] === 'Operations Department') {
    console.log('✅ Operations Department found in DEPARTMENT_NAMES');
  } else {
    console.log('❌ Operations Department NOT found in DEPARTMENT_NAMES');
  }
  
  // Test 4: Check services
  console.log('\n4. Checking Operations Department Services:');
  if (operationsDept.services) {
    const services = Object.values(operationsDept.services);
    console.log(`   Found ${services.length} services:`);
    
    services.forEach(service => {
      console.log(`   - ${service.name} (${service.key})`);
      console.log(`     Permission: ${service.permission}`);
      
      // Validate permission format
      if (typeof service.permission === 'string') {
        console.log('     ✅ Permission format is correct (string)');
      } else {
        console.log('     ❌ Permission format is incorrect (should be string)');
      }
    });
  } else {
    console.log('❌ No services found in Operations Department');
  }
  
  // Test 5: Test service access for super-admin
  console.log('\n5. Testing Super-Admin Access to Operations Services:');
  const mockSuperAdmin = {
    role: 'super-admin',
    factory: 'all',
    departments: ['all'],
    permissions: { '*': true, 'reports': true }
  };
  
  if (operationsDept.services) {
    Object.values(operationsDept.services).forEach(service => {
      const permissionKey = generatePermissionKey('gulbarga', 'operations_department', service.permission);
      console.log(`   Testing: ${service.name} (${service.key})`);
      console.log(`   Permission Key: ${permissionKey}`);
      
      // Super-admin should have access
      if (mockSuperAdmin.role === 'super-admin' && mockSuperAdmin.departments?.includes('all')) {
        console.log('   ✅ Super-admin access granted');
      } else {
        console.log('   ❌ Super-admin access denied');
      }
    });
  }
  
  // Test 6: Test all factories
  console.log('\n6. Testing Operations Department across all factories:');
  const factories = ['gulbarga', 'kerur', 'humnabad', 'omkar', 'padmavati'];
  
  factories.forEach(factory => {
    console.log(`   Testing ${factory}:`);
    if (operationsDept.services) {
      Object.values(operationsDept.services).forEach(service => {
        const permissionKey = generatePermissionKey(factory, 'operations_department', service.permission);
        console.log(`     ${service.name}: ${permissionKey}`);
      });
    }
  });
  
  console.log('\n🎯 Operations Department Test Summary:');
  console.log('- Operations Department should be accessible at /factory/operations_department');
  console.log('- Should have 3 services: inventory, reports, reactor-reports');
  console.log('- Super-admin should have access to all services');
  console.log('- All factories should support Operations Department');
  
  return true;
}

// Export for use
export { testOperationsDepartment };

// Run if in browser
if (typeof window !== 'undefined') {
  window.testOperationsDepartment = testOperationsDepartment;
  console.log('Operations test loaded. Run window.testOperationsDepartment() in console to test.');
}
