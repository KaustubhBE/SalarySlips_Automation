import React, { useEffect, useCallback } from 'react';
import './App.css';
import { Route, Routes, useNavigate, Navigate, useParams } from 'react-router-dom';
import Settings from './Components/Settings';
import Login from './Login';
import Navbar from './Navbar';
import Dashboard from './Dashboard';
import AddUser from './AddUser';
import Processing from './Processing';
import Reports from './Reports';
import SessionExpiredModal from './Components/SessionExpiredModal';
import { useSessionExpired } from './Components/SessionExpiredContext';
import { setSessionExpiredHandler } from './config';

// Import KR Store Services components
import KR_PurchaseIndent from './KR_Departments/KR_Services/KR_PurchaseIndent';
import KR_Add_MaterialList from './KR_Departments/KR_Services/KR_Add_MaterialList';
import KR_Delete_MaterialList from './KR_Departments/KR_Services/KR_Delete_MaterialList';
import KR_MaterialInward from './KR_Departments/KR_Services/KR_MaterialInward';
import KR_MaterialOutward from './KR_Departments/KR_Services/KR_MaterialOutward';
import KR_OrderStatus from './KR_Departments/KR_Services/KR_OrderStatus';

// Import OM Store Services components
import OM_PurchaseIndent from './OM_Departments/OM_Services/OM_PurchaseIndent';
import OM_Add_MaterialList from './OM_Departments/OM_Services/OM_Add_MaterialList';
import OM_Delete_MaterialList from './OM_Departments/OM_Services/OM_Delete_MaterialList';
import OM_MaterialInward from './OM_Departments/OM_Services/OM_MaterialInward';
import OM_MaterialOutward from './OM_Departments/OM_Services/OM_MaterialOutward';

// Import PV Store Services components
import PV_PurchaseIndent from './PV_Departments/PV_Services/PV_PurchaseIndent';
import PV_Add_MaterialList from './PV_Departments/PV_Services/PV_Add_MaterialList';
import PV_Delete_MaterialList from './PV_Departments/PV_Services/PV_Delete_MaterialList';
import PV_MaterialInward from './PV_Departments/PV_Services/PV_MaterialInward';
import PV_MaterialOutward from './PV_Departments/PV_Services/PV_MaterialOutward';

// Import NP Store Services components
import NP_PurchaseIndent from './NP_Departments/NP_Services/NP_PurchaseIndent';
import NP_Add_MaterialList from './NP_Departments/NP_Services/NP_Add_MaterialList';
import NP_Delete_MaterialList from './NP_Departments/NP_Services/NP_Delete_MaterialList';
import NP_MaterialInward from './NP_Departments/NP_Services/NP_MaterialInward';
import NP_MaterialOutward from './NP_Departments/NP_Services/NP_MaterialOutward';

// Import GB department components
import GB_PurchaseIndent from './GB_Departments/GB_Services/GB_PurchaseIndent';
import GB_Add_MaterialList from './GB_Departments/GB_Services/GB_Add_MaterialList';
import GB_Delete_MaterialList from './GB_Departments/GB_Services/GB_Delete_MaterialList';
import GB_MaterialInward from './GB_Departments/GB_Services/GB_MaterialInward';
import GB_MaterialOutward from './GB_Departments/GB_Services/GB_MaterialOutward';
import SheetsMaterialList from './HO_Departments/HO_Services/HO_Sheets-MaterialList';

// Import FT Store Services components
import FT_PurchaseIndent from './FT_Departments/FT_Services/FT_PurchaseIndent';
import FT_MaterialInward from './FT_Departments/FT_Services/FT_MaterialInward';
import FT_MaterialOutward from './FT_Departments/FT_Services/FT_MaterialOutward';

// Import specific processing components
import KRProcessing from './KR_Departments/KR_Services/KR_Processing';
import GBProcessing from './GB_Departments/GB_Services/GB_Processing';
import PVProcessing from './PV_Departments/PV_Services/PV_Processing';
import OMProcessing from './OM_Departments/OM_Services/OM_Processing';
import HOProcessing from './HO_Departments/HO_Services/HO_Processing';
import NPProcessing from './NP_Departments/NP_Services/NP_Processing';

import PrivacyPolicy from './Components/PrivacyPolicy';
import TermsAndConditions from './Components/TermsAndConditions';
import Inventory from './Inventory';
import ReactorReports from './ReactorReports';
// Department import removed - using specific department components
import GulbargaFactory from './Factories/gulbarga';
import KerurFactory from './Factories/kerur';
import OmkarFactory from './Factories/omkar';
import HeadOfficeFactory from './Factories/headoffice';
import PadmavatiFactory from './Factories/padmavati';
import NewPlantFactory from './Factories/newplant';
import FertilizerFactory from './Factories/fertilizer';
import GBStore from './GB_Departments/GBStore';
import GBHumanResource from './GB_Departments/GBHumanResource';
import GBOperations from './GB_Departments/GBOperations';
import KRStore from './KR_Departments/KRStore';
import KRHumanResource from './KR_Departments/KRHumanResource';
import KROperations from './KR_Departments/KROperations';
import OMOperations from './OM_Departments/OMOperations';
import NPOperations from './NP_Departments/NPOperations';
import PVOperations from './PV_Departments/PVOperations';
import KR_ReactorReports from './KR_Departments/KR_Services/KR_ReactorReports';
import KR_GeneralReports from './KR_Departments/KR_Services/KR_GeneralReports';
import PV_GeneralReports from './PV_Departments/PV_Services/PV_GeneralReports';
import OM_GeneralReports from './OM_Departments/OM_Services/OM_GeneralReports';
import HO_GeneralReports from './HO_Departments/HO_Services/HO_GeneralReports';
import GB_GeneralReports from './GB_Departments/GB_Services/GB_GeneralReports';
import NP_GeneralReports from './NP_Departments/NP_Services/NP_GeneralReports';
import OMStore from './OM_Departments/OMStore';
import OMHumanResource from './OM_Departments/OMHumanResource';
import NPStore from './NP_Departments/NPStore';
import NPHumanResource from './NP_Departments/NPHumanResource';
import PVStore from './PV_Departments/PVStore';
import PVHumanResource from './PV_Departments/PVHumanResource';
import HOAccounts from './HO_Departments/HOAccounts';
import HOMarketing from './HO_Departments/HOMarketing';
import HOOperations from './HO_Departments/HOOperations';
import HOStore from './HO_Departments/HOStore';
import HOHumanResource from './HO_Departments/HOHumanResourec';
import FTStore from './FT_Departments/FTStore';
import { useAuth } from './Components/AuthContext';
import ProtectedRoute from './Components/ProtectedRoute';
import { FACTORY_NAMES, PERMISSIONS } from './config';
import KR_ViewOrderDetails from './KR_Departments/KR_Services/KR_ViewOrderDetails';
import KR_UpdateOrderDetails from './KR_Departments/KR_Services/KR_UpdateOrderDetails';

// Function to get the correct department component based on factory and department keys
const getDepartmentComponent = (factoryKey, departmentKey) => {
  const componentMap = {
    'gulbarga': {
      'store': GBStore,
      'humanresource': GBHumanResource,
      'operations': GBOperations
    },
    'kerur': {
      'store': KRStore,
      'humanresource': KRHumanResource,
      'operations': KROperations
    },
    'omkar': {
      'store': OMStore,
      'humanresource': OMHumanResource,
      'operations': OMOperations
    },
    'newplant': {
      'store': NPStore,
      'humanresource': NPHumanResource,
      'operations': NPOperations
    },
    'padmavati': {
      'store': PVStore,
      'humanresource': PVHumanResource,
      'operations': PVOperations
    },
    'headoffice': {
      'accounts': HOAccounts,
      'marketing': HOMarketing,
      'operations': HOOperations,
      'store': HOStore,
      'humanresource': HOHumanResource
    },
    'fertilizer': {
      'store': FTStore,
      'humanresource': null, // TODO: Create FTHumanResource component
      'operations': null // TODO: Create FTOperations component
    }
  };
  
  return componentMap[factoryKey]?.[departmentKey] || null;
};

// Function to get the correct processing component based on factory
const getProcessingComponent = (factoryKey, mode) => {
  const componentMap = {
    'gulbarga': GBProcessing,
    'kerur': KRProcessing,
    'omkar': OMProcessing,
    'newplant': NPProcessing,
    'padmavati': PVProcessing,
    'headoffice': HOProcessing
  };
  
  const ProcessingComponent = componentMap[factoryKey] || Processing;
  return <ProcessingComponent mode={mode} />;
};

// Department Component Wrapper for generic routes
const DepartmentWrapper = () => {
  const { factoryKey, departmentKey } = useParams();
  
  // Handle factory-prefixed department keys by stripping the prefix
  let actualDepartmentKey = departmentKey;
  if (departmentKey && (departmentKey.startsWith('gb_') || departmentKey.startsWith('kr_') || 
      departmentKey.startsWith('pv_') || departmentKey.startsWith('om_') || 
      departmentKey.startsWith('np_') || departmentKey.startsWith('ho_') || 
      departmentKey.startsWith('ft_'))) {
    // Extract the base department key (remove factory prefix)
    actualDepartmentKey = departmentKey.replace(/^(gb_|kr_|pv_|om_|np_|ho_|ft_)/, '');
  }
  
  const DepartmentComponent = getDepartmentComponent(factoryKey, actualDepartmentKey);
  
  if (!DepartmentComponent) {
    return (
      <div className="splash-page">
        <h1>Department Not Found</h1>
        <p>The requested department "{departmentKey}" in factory "{factoryKey}" does not exist.</p>
        <p>Debug: actualDepartmentKey = "{actualDepartmentKey}"</p>
        <button onClick={() => window.history.back()} className="nav-link" style={{ marginTop: '15px' }}>
          ← Go Back
        </button>
      </div>
    );
  }
  
  return <DepartmentComponent />;
};

// Factory-prefixed Department Component Wrapper
const FactoryPrefixedDepartmentWrapper = ({ departmentType }) => {
  const { factoryKey } = useParams();
  
  // Extract the base department key (remove factory prefix)
  const actualDepartmentKey = departmentType.replace(/^(gb_|kr_|pv_|om_|np_|ho_|ft_)/, '');
  
  const DepartmentComponent = getDepartmentComponent(factoryKey, actualDepartmentKey);
  
  if (!DepartmentComponent) {
    return (
      <div className="splash-page">
        <h1>Department Not Found</h1>
        <p>The requested department "{departmentType}" in factory "{factoryKey}" does not exist.</p>
        <p>Debug: actualDepartmentKey = "{actualDepartmentKey}"</p>
        <button onClick={() => window.history.back()} className="nav-link" style={{ marginTop: '15px' }}>
          ← Go Back
        </button>
      </div>
    );
  }
  
  return <DepartmentComponent />;
};

// Processing Component Wrapper
const ProcessingWrapper = ({ mode }) => {
  const { factoryKey } = useParams();
  return getProcessingComponent(factoryKey, mode);
};

// Department Route Guard Component
const DepartmentRouteGuard = ({ requiredRouteType, component }) => {
  const { user, canAccessDepartment, canAccessFactoryDepartment } = useAuth();
  const { factoryKey } = useParams();
  
  // Extract department name from URL path since routes are hardcoded
  const pathname = window.location.pathname;
  const pathParts = pathname.split('/');
  const departmentKey = pathParts[2]; // e.g., "gb_operations" from "/gulbarga/gb_operations"
  
  // Strip factory prefix from department key to get the base department key
  let actualDepartmentKey = departmentKey;
  if (departmentKey && (departmentKey.startsWith('gb_') || departmentKey.startsWith('kr_') || 
      departmentKey.startsWith('pv_') || departmentKey.startsWith('om_') || 
      departmentKey.startsWith('np_') || departmentKey.startsWith('ho_') || 
      departmentKey.startsWith('ft_'))) {
    // Extract the base department key (remove factory prefix)
    actualDepartmentKey = departmentKey.replace(/^(gb_|kr_|pv_|om_|np_|ho_|ft_)/, '');
  }
  
  // Debug logging
  console.log('DepartmentRouteGuard:', {
    factoryKey,
    departmentKey,
    actualDepartmentKey,
    pathname,
    pathParts,
    user: user?.role,
    allParams: useParams()
  });
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user can access this factory/department combination using the actual department key
  const canAccess = canAccessFactoryDepartment(factoryKey, actualDepartmentKey);
  
  console.log('DepartmentRouteGuard canAccess result:', canAccess);
  
  if (!canAccess) {
    return <Navigate to="/app" replace />;
  }
  
  return component;
};

function App() {
  const navigate = useNavigate();
  const authContext = useAuth();
  const { 
    user, 
    isAuthenticated, 
    login, 
    logout, 
    canAccessService, 
    canAccessDepartment, 
    canAccessFactory 
  } = authContext;
  
  // Session expired modal state
  const { isSessionExpired, showSessionExpired, hideSessionExpired } = useSessionExpired();
  
  // Set up the session expired handler for axios interceptor
  useEffect(() => {
    setSessionExpiredHandler(showSessionExpired);
  }, [showSessionExpired]);
  
  // Provide a safe fallback for canAccessFactory to prevent undefined errors
  const safeCanAccessFactory = canAccessFactory || (() => false);

  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      const storedAuthStatus = localStorage.getItem('isAuthenticated');

      if (storedUser && storedAuthStatus === 'true') {
        const userData = JSON.parse(storedUser);
        console.log('App.jsx - Loading user from localStorage:', userData);
        console.log('App.jsx - User permissions:', userData.permissions);
        console.log('App.jsx - User permission_metadata:', userData.permission_metadata);
        console.log('App.jsx - User tree_permissions:', userData.tree_permissions);
        if (!isAuthenticated) {
          login(userData);
        }
      } else if (isAuthenticated) {
        logout();
      }
    };

    checkAuth();
  }, [isAuthenticated, login, logout]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);

  // Desired factory order: Gulbarga, Kerur, New Plant, Omkar, Padmavati, Fertilizer, Head Office
  const FACTORY_ORDER = ['gulbarga', 'kerur', 'newplant', 'omkar', 'padmavati', 'fertilizer', 'headoffice'];

  // Helper function to sort factories according to desired order
  const sortFactoriesByOrder = (factories) => {
    return factories.sort((a, b) => {
      const indexA = FACTORY_ORDER.indexOf(a);
      const indexB = FACTORY_ORDER.indexOf(b);
      // If factory not in order list, put it at the end
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  // Get accessible factories for current user - only show factories where user has access to services
  const getAccessibleFactoriesForUser = () => {
    if (!user) return [];
    
    // Admin has access to all factories
    if ((user.role || '').toString().toLowerCase() === 'admin' || (user.permissions && user.permissions['*'] === true)) {
      return [...FACTORY_ORDER]; // Return a copy to avoid mutation
    }
    
    // Use permission_metadata if available
    const permissionMetadata = user.permission_metadata || {};
    const userFactories = permissionMetadata.factories || [];
    
    // If we have permission_metadata with factories, use it and sort by desired order
    if (userFactories.length > 0) {
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('App.jsx - Accessible factories from permission_metadata:', userFactories);
      }
      return sortFactoriesByOrder([...userFactories]); // Return sorted copy
    }
    
    // Fallback to old logic for regular users (only if canAccessFactory is available)
    // Use safe fallback to prevent errors
    try {
      const accessibleFactories = FACTORY_ORDER.filter(factory => {
        try {
          return safeCanAccessFactory(factory);
        } catch (err) {
          console.warn(`Error checking access for factory ${factory}:`, err);
          return false;
        }
      });
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('App.jsx - Accessible factories from fallback logic:', accessibleFactories);
      }
      return accessibleFactories; // Already in correct order
    } catch (err) {
      console.error('Error in getAccessibleFactoriesForUser fallback:', err);
      return [];
    }
  };

  return (
    <div className="app-container">
      {isAuthenticated && <Navbar user={user} onLogout={handleLogout} />}
      
      {/* Session Expired Modal */}
      <SessionExpiredModal 
        isOpen={isSessionExpired} 
        onClose={hideSessionExpired} 
      />
      
      <main className="main-content">
        <Routes>
        <Route path="/login" element={
          isAuthenticated ? 
            <Navigate to="/app" replace /> : 
            <Login />
        } />

        <Route path="/" element={
          isAuthenticated ? 
            <Navigate to="/app" replace /> : 
            <Login />
        } />

        <Route path="/app" element={
          isAuthenticated ? (
            <div className="splash-page">
              <h1>Welcome to Bajaj Earths</h1>
              
              {/* Check if user has no permissions at all */}
              {!isAdmin && getAccessibleFactoriesForUser().length === 0 && !canAccessService('reports') ? (
                <div style={{ 
                  textAlign: 'center',
                  marginTop: '40px'
                }}>
                  <div style={{ 
                    color: '#ff6b6b', 
                    fontSize: '18px', 
                    marginBottom: '20px',
                    padding: '30px',
                    backgroundColor: '#fff5f5',
                    borderRadius: '12px',
                    border: '2px solid #ff6b6b',
                    maxWidth: '600px',
                    margin: '40px auto',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
                    <h2 style={{ color: '#ff6b6b', marginBottom: '15px' }}>No Access Granted</h2>
                    <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#333' }}>
                      Your account has been created successfully, but you don't have any permissions assigned yet.
                    </p>
                    <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#333', marginTop: '15px', fontWeight: 'bold' }}>
                      Please contact your administrator to get access to the system.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h3>Please choose an option below:</h3>
                  {/* Debug information - remove in production */}
                  {process.env.NODE_ENV === 'development' && (
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                      <strong>Debug Info:</strong><br/>
                      User Role: {user?.role}<br/>
                      Accessible Factories: {JSON.stringify(getAccessibleFactoriesForUser())}<br/>
                      User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
                      Has Reports Permission: {canAccessService('reports') ? 'Yes' : 'No'}<br/>
                      Can Access Store: {canAccessDepartment('store') ? 'Yes' : 'No'}<br/>
                      Can Access Human Resource: {canAccessDepartment('humanresource') ? 'Yes' : 'No'}
                    </div>
                  )}
                  <div className="navigation-links">
                    {/* Factory Buttons - Show factory navigation buttons */}
                    {getAccessibleFactoriesForUser().map(factory => (
                      <span 
                        key={factory}
                        onClick={() => navigate(`/${factory}`)} 
                        className="nav-link"
                        role="button"
                        tabIndex={0}
                      >
                        {FACTORY_NAMES[factory] || factory.charAt(0).toUpperCase() + factory.slice(1)}
                      </span>
                    ))}
                    
                    
                    {/* User Management - Show for admins only */}
                    {isAdmin && (
                      <span 
                        onClick={() => navigate('/dashboard')} 
                        className="nav-link admin-link"
                        role="button"
                        tabIndex={0}
                        aria-label="User Management (Admin Only)"
                      >
                        User Management
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : <Navigate to="/login" replace />
        } />

        <Route path="/dashboard" element={
          isAuthenticated && isAdmin ? 
            <Dashboard /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/add-user" element={
          isAuthenticated && isAdmin ? 
            <AddUser /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/settings" element={
          isAuthenticated ? <Settings onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />

        {/* Factory Routes - Direct factory access */}
        <Route path="/gulbarga" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('gulbarga') ? 
            <GulbargaFactory /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/kerur" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('kerur') ? 
            <KerurFactory /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/omkar" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('omkar') ? 
            <OmkarFactory /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/headoffice" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('headoffice') ? 
            <HeadOfficeFactory /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/padmavati" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('padmavati') ? 
            <PadmavatiFactory /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/newplant" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('newplant') ? 
            <NewPlantFactory /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/fertilizer" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('fertilizer') ? 
            <FertilizerFactory /> : 
            <Navigate to="/app" replace />
        } />

        {/* Factory-prefixed Department Routes - Must come before generic routes */}
        <Route path="/:factoryKey/gb_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="gb_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/gb_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="gb_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/kr_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="kr_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/kr_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="kr_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/kr_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="kr_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/pv_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="pv_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/pv_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="pv_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/om_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="om_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/om_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="om_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/np_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="np_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/np_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="np_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ho_accounts" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ho_accounts" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ho_marketing" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ho_marketing" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ho_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ho_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ho_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ho_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/gb_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="gb_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/om_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="om_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/np_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="np_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/pv_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="pv_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ft_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ft_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ft_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ft_humanresource" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/ft_operations" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="ft_operations" />}
            /> : 
            <Navigate to="/login" replace />
        } />

        {/* Generic Department Routes - Must come after specific factory-prefixed routes */}
        <Route path="/:factoryKey/:departmentKey" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<DepartmentWrapper />}
            /> : 
            <Navigate to="/login" replace />
        } />


        {/* Kerur Operations Reactor Reports Route */}
        <Route path="/kerur/kr_operations/kr_reactor_reports" element={
          isAuthenticated ? 
            <KR_ReactorReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Kerur Operations General Reports Route */}
        <Route path="/kerur/kr_operations/kr_general_reports" element={
          isAuthenticated ? 
            <KR_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Padmavati Operations General Reports Route */}
        <Route path="/padmavati/pv_operations/pv_general_reports" element={
          isAuthenticated ? 
            <PV_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Omkar Operations General Reports Route */}
        <Route path="/omkar/om_operations/om_general_reports" element={
          isAuthenticated ? 
            <OM_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Head Office Operations General Reports Route */}
        <Route path="/headoffice/ho_operations/ho_general_reports" element={
          isAuthenticated ? 
            <HO_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Gulbarga Operations General Reports Route */}
        <Route path="/gulbarga/gb_operations/gb_general_reports" element={
          isAuthenticated ? 
            <GB_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* New Plant Operations General Reports Route */}
        <Route path="/newplant/np_operations/np_general_reports" element={
          isAuthenticated ? 
            <NP_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Fertilizer Operations General Reports Route */}
        {/* Note: FT_GeneralReports component needs to be created */}
        <Route path="/fertilizer/ft_operations/ft_general_reports" element={
          isAuthenticated ? 
            <div className="splash-page">
              <h1>Fertilizer General Reports</h1>
              <p>This feature is coming soon. The component needs to be created.</p>
              <button onClick={() => window.history.back()} className="nav-link" style={{ marginTop: '15px' }}>
                ← Go Back
              </button>
            </div> : 
            <Navigate to="/login" replace />
        } />

        {/* Additional Operations General Reports Routes */}
        <Route path="/gulbarga/gb_operations/gb_general_reports" element={
          isAuthenticated ? 
            <GB_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/omkar/om_operations/om_general_reports" element={
          isAuthenticated ? 
            <OM_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/padmavati/pv_operations/pv_general_reports" element={
          isAuthenticated ? 
            <PV_GeneralReports /> : 
            <Navigate to="/login" replace />
        } />

        {/* Service Routes - Factory/Department/Service access */}
        <Route path="/:factoryKey/:departmentKey/single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        {/* Factory-specific processing routes */}
        <Route path="/:factoryKey/:departmentKey/gb_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/gb_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/kr_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/kr_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/pv_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/pv_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/om_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/om_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/np_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/np_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/ho_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/ho_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/ft_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/ft_batch_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<ProcessingWrapper mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/inventory/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="inventory"
            component={<Inventory />}
          />
        }/>


        {/* New Processing Routes - Direct access to processing components */}
        <Route path="/gb_single_processing/*" element={
          isAuthenticated ? 
            <GBHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/gb_batch_processing/*" element={
          isAuthenticated ? 
            <GBHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/kr_single_processing/*" element={
          isAuthenticated ? 
            <KRHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/kr_batch_processing/*" element={
          isAuthenticated ? 
            <KRHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/pv_single_processing/*" element={
          isAuthenticated ? 
            <PVHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/pv_batch_processing/*" element={
          isAuthenticated ? 
            <PVHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/om_single_processing/*" element={
          isAuthenticated ? 
            <OMHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/om_batch_processing/*" element={
          isAuthenticated ? 
            <OMHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_single_processing/*" element={
          isAuthenticated ? 
            <HOHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_batch_processing/*" element={
          isAuthenticated ? 
            <HOHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/np_single_processing/*" element={
          isAuthenticated ? 
            <NPHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/np_batch_processing/*" element={
          isAuthenticated ? 
            <NPHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        {/* New Department Routes - Direct access to department components */}
        <Route path="/gb_humanresource/*" element={
          isAuthenticated ? 
            <GBHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/gb_store/*" element={
          isAuthenticated ? 
            <GBStore /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/kr_humanresource/*" element={
          isAuthenticated ? 
            <KRHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/kerur/kr_store/*" element={
          isAuthenticated ? 
            <KRStore /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_add_material_list" element={
          isAuthenticated ? 
            <KR_Add_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_delete_material_list" element={
          isAuthenticated ? 
            <KR_Delete_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_purchase_indent" element={
          isAuthenticated ? 
            <KR_PurchaseIndent /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_order_status" element={
          isAuthenticated ? 
            <KR_OrderStatus /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_order_status/:orderId" element={
          isAuthenticated ? 
            <ProtectedRoute 
              requiredPermission={PERMISSIONS.KR_ORDER_STATUS}
              requiredFactory="kerur"
              requiredDepartment="store"
            >
              <KR_ViewOrderDetails />
            </ProtectedRoute> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_order_status/update/:orderId" element={
          isAuthenticated ? 
            <ProtectedRoute 
              requiredPermission={PERMISSIONS.KR_UPDATE_ORDER_STATUS}
              requiredFactory="kerur"
              requiredDepartment="store"
            >
              <KR_UpdateOrderDetails />
            </ProtectedRoute> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/fertilizer/ft_store/ft_purchase_indent" element={
          isAuthenticated ? 
            <FT_PurchaseIndent /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/fertilizer/ft_store/ft_material_inward" element={
          isAuthenticated ? 
            <FT_MaterialInward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/fertilizer/ft_store/ft_material_outward" element={
          isAuthenticated ? 
            <FT_MaterialOutward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/gulbarga/gb_store/gb_purchase_indent" element={
          isAuthenticated ? 
            <GB_PurchaseIndent /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/newplant/np_store/np_purchase_indent" element={
          isAuthenticated ? 
            <NP_PurchaseIndent /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/headoffice/ho_store/ho_material_list" element={
          isAuthenticated ? 
            <SheetsMaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/omkar/om_store/om_purchase_indent" element={
          isAuthenticated ? 
            <OM_PurchaseIndent /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/padmavati/pv_store/pv_purchase_indent" element={
          isAuthenticated ? 
            <PV_PurchaseIndent /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_material_inward" element={
          isAuthenticated ? 
            <KR_MaterialInward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_material_outward" element={
          isAuthenticated ? 
            <KR_MaterialOutward /> : 
            <Navigate to="/login" replace />
        } />

        {/* GB Store Routes */}
        <Route path="/gulbarga/gb_store/gb_add_material_list" element={
          isAuthenticated ? 
            <GB_Add_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/gulbarga/gb_store/gb_delete_material_list" element={
          isAuthenticated ? 
            <GB_Delete_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/gulbarga/gb_store/gb_material_inward" element={
          isAuthenticated ? 
            <GB_MaterialInward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/gulbarga/gb_store/gb_material_outward" element={
          isAuthenticated ? 
            <GB_MaterialOutward /> : 
            <Navigate to="/login" replace />
        } />

        {/* OM Store Routes */}
        <Route path="/omkar/om_store/om_add_material_list" element={
          isAuthenticated ? 
            <OM_Add_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/omkar/om_store/om_delete_material_list" element={
          isAuthenticated ? 
            <OM_Delete_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/omkar/om_store/om_material_inward" element={
          isAuthenticated ? 
            <OM_MaterialInward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/omkar/om_store/om_material_outward" element={
          isAuthenticated ? 
            <OM_MaterialOutward /> : 
            <Navigate to="/login" replace />
        } />

        {/* PV Store Routes */}
        <Route path="/padmavati/pv_store/pv_add_material_list" element={
          isAuthenticated ? 
            <PV_Add_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/padmavati/pv_store/pv_delete_material_list" element={
          isAuthenticated ? 
            <PV_Delete_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/padmavati/pv_store/pv_material_inward" element={
          isAuthenticated ? 
            <PV_MaterialInward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/padmavati/pv_store/pv_material_outward" element={
          isAuthenticated ? 
            <PV_MaterialOutward /> : 
            <Navigate to="/login" replace />
        } />

        {/* NP Store Routes */}
        <Route path="/newplant/np_store/np_add_material_list" element={
          isAuthenticated ? 
            <NP_Add_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/newplant/np_store/np_delete_material_list" element={
          isAuthenticated ? 
            <NP_Delete_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/newplant/np_store/np_material_inward" element={
          isAuthenticated ? 
            <NP_MaterialInward /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/newplant/np_store/np_material_outward" element={
          isAuthenticated ? 
            <NP_MaterialOutward /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/kr_store/*" element={
          isAuthenticated ? 
            <KRStore /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/pv_humanresource/*" element={
          isAuthenticated ? 
            <PVHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/pv_store/*" element={
          isAuthenticated ? 
            <PVStore /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/om_humanresource/*" element={
          isAuthenticated ? 
            <OMHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/om_store/*" element={
          isAuthenticated ? 
            <OMStore /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_humanresource/*" element={
          isAuthenticated ? 
            <HOHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_accounts/*" element={
          isAuthenticated ? 
            <HOAccounts /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_marketing/*" element={
          isAuthenticated ? 
            <HOMarketing /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_operations/*" element={
          isAuthenticated ? 
            <HOOperations /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/ho_store/*" element={
          isAuthenticated ? 
            <HOStore /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/np_humanresource/*" element={
          isAuthenticated ? 
            <NPHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/np_store/*" element={
          isAuthenticated ? 
            <NPStore /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

        <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;