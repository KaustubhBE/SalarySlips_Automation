// Test script to verify all factory-department-service access
import { 
  FACTORIES, 
  DEPARTMENTS_CONFIG, 
  getAccessibleFactories,
  hasPermission,
  generatePermissionKey,
  FACTORY_NAMES
} from './config.js';

// Mock user data for testing
const mockSuperAdmin = {
  role: 'super-admin',
  factory: 'all',
  departments: ['all'],
  permissions: { '*': true, 'reports': true }
};

const mockRegularUser = {
  role: 'user',
  factory: 'all',
  departments: ['all'],
  permissions: { '*': true, 'reports': true }
};

const mockAdmin3 = {
  role: 'admin',
  factory: ['gulbarga', 'kerur', 'humnabad'],
  departments: 'all',
  permissions: {
    'gulbarga.humanresource.single_processing': true,
    'gulbarga.humanresource.batch_processing': true,
    'kerur.store.inventory': true,
    'kerur.store.reports': true,
    'humnabad.operations_department.reports': true
  }
};

// Test function to check service access
function testServiceAccess(user, factoryKey, departmentKey, serviceKey) {
  console.log(`\n=== Testing: ${factoryKey}/${departmentKey}/${serviceKey} ===`);
  console.log(`User Role: ${user.role}`);
  console.log(`User Factory: ${user.factory}`);
  console.log(`User Departments: ${JSON.stringify(user.departments)}`);
  
  // Check if user has access to factory
  const accessibleFactories = getAccessibleFactories(user.role, user.permissions, user.factory);
  console.log(`Accessible Factories: ${JSON.stringify(accessibleFactories)}`);
  
  if (!accessibleFactories.includes(factoryKey)) {
    console.log(`❌ NO ACCESS: User cannot access factory ${factoryKey}`);
    return false;
  }
  
  // Check if department exists in config
  const department = DEPARTMENTS_CONFIG[departmentKey];
  if (!department) {
    console.log(`❌ NO ACCESS: Department ${departmentKey} not found in config`);
    return false;
  }
  
  console.log(`✅ Department found: ${department.name}`);
  
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
    console.log(`❌ NO ACCESS: Service ${serviceKey} not found in department ${departmentKey}`);
    return false;
  }
  
  console.log(`✅ Service found: ${serviceInfo.name}`);
  
  // Check permissions
  if (user.role === 'super-admin' && (user.departments?.includes('all') || !user.departments)) {
    console.log(`✅ ACCESS GRANTED: Super-admin with all departments`);
    return true;
  }
  
  const factoryPermission = generatePermissionKey(factoryKey, departmentKey, serviceInfo.permission);
  const hasAccess = hasPermission(user.permissions, factoryPermission);
  
  if (hasAccess) {
    console.log(`✅ ACCESS GRANTED: Permission ${factoryPermission} found`);
  } else {
    console.log(`❌ NO ACCESS: Permission ${factoryPermission} not found`);
  }
  
  return hasAccess;
}

// Test all combinations
function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive Access Test');
  console.log('=====================================');
  
  const factories = Object.values(FACTORIES).filter(f => f !== 'headoffice');
  const departments = Object.values(DEPARTMENTS_CONFIG);
  
  console.log(`\nTesting ${factories.length} factories and ${departments.length} departments`);
  
  // Test Super Admin Access
  console.log('\n🔍 TESTING SUPER ADMIN ACCESS');
  console.log('==============================');
  
  let superAdminPassed = 0;
  let superAdminTotal = 0;
  
  factories.forEach(factoryKey => {
    departments.forEach(deptConfig => {
      if (deptConfig.key === 'all' || deptConfig.key === 'management') return;
      
      const departmentKey = deptConfig.key;
      console.log(`\n--- Testing Factory: ${FACTORY_NAMES[factoryKey]} (${factoryKey}) ---`);
      console.log(`--- Department: ${deptConfig.name} (${departmentKey}) ---`);
      
      if (deptConfig.services) {
        Object.values(deptConfig.services).forEach(service => {
          if (service.subServices) {
            // Test sub-services
            Object.values(service.subServices).forEach(subService => {
              superAdminTotal++;
              const hasAccess = testServiceAccess(mockSuperAdmin, factoryKey, departmentKey, subService.key);
              if (hasAccess) superAdminPassed++;
            });
          } else {
            // Test direct services
            superAdminTotal++;
            const hasAccess = testServiceAccess(mockSuperAdmin, factoryKey, departmentKey, service.key);
            if (hasAccess) superAdminPassed++;
          }
        });
      }
    });
  });
  
  // Test Regular User Access
  console.log('\n🔍 TESTING REGULAR USER ACCESS');
  console.log('==============================');
  
  let regularUserPassed = 0;
  let regularUserTotal = 0;
  
  // Test Regular User Access (all factories and departments)
  factories.forEach(factoryKey => {
    departments.forEach(deptConfig => {
      if (deptConfig.key === 'all' || deptConfig.key === 'management') return;
      
      const departmentKey = deptConfig.key;
      
      if (deptConfig.services) {
        Object.values(deptConfig.services).forEach(service => {
          if (service.subServices) {
            // Test sub-services
            Object.values(service.subServices).forEach(subService => {
              regularUserTotal++;
              const hasAccess = testServiceAccess(mockRegularUser, factoryKey, departmentKey, subService.key);
              if (hasAccess) regularUserPassed++;
            });
          } else {
            // Test direct services
            regularUserTotal++;
            const hasAccess = testServiceAccess(mockRegularUser, factoryKey, departmentKey, service.key);
            if (hasAccess) regularUserPassed++;
          }
        });
      }
    });
  });
  
  // Test Admin3 Access (limited factories with specific permissions)
  console.log('\n🔍 TESTING ADMIN3 ACCESS');
  console.log('=========================');
  
  let admin3Passed = 0;
  let admin3Total = 0;
  
  const admin3Factories = ['gulbarga', 'kerur', 'humnabad'];
  admin3Factories.forEach(factoryKey => {
    departments.forEach(deptConfig => {
      if (deptConfig.key === 'all' || deptConfig.key === 'management') return;
      
      const departmentKey = deptConfig.key;
      
      if (deptConfig.services) {
        Object.values(deptConfig.services).forEach(service => {
          if (service.subServices) {
            // Test sub-services
            Object.values(service.subServices).forEach(subService => {
              admin3Total++;
              const hasAccess = testServiceAccess(mockAdmin3, factoryKey, departmentKey, subService.key);
              if (hasAccess) admin3Passed++;
            });
          } else {
            // Test direct services
            admin3Total++;
            const hasAccess = testServiceAccess(mockAdmin3, factoryKey, departmentKey, service.key);
            if (hasAccess) admin3Passed++;
          }
        });
      }
    });
  });

  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('========================');
  console.log(`Super Admin: ${superAdminPassed}/${superAdminTotal} tests passed (${((superAdminPassed/superAdminTotal)*100).toFixed(1)}%)`);
  console.log(`Regular User: ${regularUserPassed}/${regularUserTotal} tests passed (${((regularUserPassed/regularUserTotal)*100).toFixed(1)}%)`);
  console.log(`Admin3: ${admin3Passed}/${admin3Total} tests passed (${((admin3Passed/admin3Total)*100).toFixed(1)}%)`);
  
  if (superAdminPassed === superAdminTotal) {
    console.log('✅ Super Admin access is working correctly');
  } else {
    console.log('❌ Super Admin access has issues');
  }
  
  if (regularUserPassed === regularUserTotal) {
    console.log('✅ Regular User access is working correctly');
  } else {
    console.log('❌ Regular User access has issues');
  }
  
  if (admin3Passed === admin3Total) {
    console.log('✅ Admin3 access is working correctly');
  } else {
    console.log('❌ Admin3 access has issues');
  }
  
  return {
    superAdmin: { passed: superAdminPassed, total: superAdminTotal },
    regularUser: { passed: regularUserPassed, total: regularUserTotal },
    admin3: { passed: admin3Passed, total: admin3Total }
  };
}

// Export for use in other files
export { testServiceAccess, runComprehensiveTest };

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  window.runAccessTest = runComprehensiveTest;
  console.log('Access test loaded. Run window.runAccessTest() in console to test.');
} else {
  // Node environment
  runComprehensiveTest();
}
