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
// Import add material components
import KR_PlaceOrder from './KR_Departments/KR_Services/KR_PlaceOrder';
import KR_MaterialList from './KR_Departments/KR_Services/KR_MaterialList';
import KR_MaterialInward from './KR_Departments/KR_Services/KR_MaterialInward';
import KR_MaterialOutward from './KR_Departments/KR_Services/KR_MaterialOutward';
import SheetsMaterialList from './HO_Departments/HO_Services/Sheets-MaterialList';

// Import specific processing components
import KRProcessing from './KR_Departments/KR_Services/KR_Processing';
import GBProcessing from './GB_Departments/GB_Services/GB_Processing';
import PVProcessing from './PV_Departments/PV_Services/PV_Processing';
import OMProcessing from './OM_Departments/OM_Services/OM_Processing';
import HOProcessing from './HO_Departments/HO_Services/HO_Processing';
import HBDProcessing from './HB_Departments/HB_Services/HB_Processing';
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
import HumnabadFactory from './Factories/humnabad';
import GBStore from './GB_Departments/GBStore';
import GBHumanResource from './GB_Departments/GBHumanResource';
import KRStore from './KR_Departments/KRStore';
import KRHumanResource from './KR_Departments/KRHumanResource';
import KROperations from './KR_Departments/KROperations';
import KR_ReactorReports from './KR_Departments/KR_Services/KR_ReactorReports';
import KR_GeneralReports from './KR_Departments/KR_Services/KR_GeneralReports';
import OMStore from './OM_Departments/OMStore';
import OMHumanResource from './OM_Departments/OMHumanResource';
import HBDStore from './HB_Departments/HBStore';
import HBDHumanResource from './HB_Departments/HBHumanResource';
import PVStore from './PV_Departments/PVStore';
import PVHumanResource from './PV_Departments/PVHumanResource';
import HOAccounts from './HO_Departments/HOAccounts';
import HOMarketing from './HO_Departments/HOMarketing';
import HOOperations from './HO_Departments/HOOperations';
import HOStore from './HO_Departments/HOStore';
import HOHumanResource from './HO_Departments/HOHumanResourec';
import { useAuth } from './Components/AuthContext';
import { FACTORY_NAMES } from './config';

// Function to get the correct department component based on factory and department keys
const getDepartmentComponent = (factoryKey, departmentKey) => {
  const componentMap = {
    'gulbarga': {
      'store': GBStore,
      'humanresource': GBHumanResource
    },
    'kerur': {
      'store': KRStore,
      'humanresource': KRHumanResource,
      'operations': KROperations
    },
    'omkar': {
      'store': OMStore,
      'humanresource': OMHumanResource
    },
    'humnabad': {
      'store': HBDStore,
      'humanresource': HBDHumanResource
    },
    'padmavati': {
      'store': PVStore,
      'humanresource': PVHumanResource
    },
    'headoffice': {
      'accounts': HOAccounts,
      'marketing': HOMarketing,
      'operations': HOOperations,
      'store': HOStore,
      'humanresource': HOHumanResource
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
    'humnabad': HBDProcessing,
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
      departmentKey.startsWith('pm_') || departmentKey.startsWith('om_') || 
      departmentKey.startsWith('hb_') || departmentKey.startsWith('ho_'))) {
    // Extract the base department key (remove factory prefix)
    actualDepartmentKey = departmentKey.replace(/^(gb_|kr_|pm_|om_|hb_|ho_)/, '');
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
  const actualDepartmentKey = departmentType.replace(/^(gb_|kr_|pm_|om_|hb_|ho_)/, '');
  
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
  const departmentKey = pathParts[2]; // e.g., "kr_humanresource" from "/kerur/kr_humanresource"
  
  // Debug logging
  console.log('DepartmentRouteGuard:', {
    factoryKey,
    departmentKey,
    pathname,
    pathParts,
    user: user?.role,
    allParams: useParams()
  });
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user can access this factory/department combination
  const canAccess = canAccessFactoryDepartment(factoryKey, departmentKey);
  
  console.log('DepartmentRouteGuard canAccess result:', canAccess);
  
  if (!canAccess) {
    return <Navigate to="/app" replace />;
  }
  
  return component;
};

function App() {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout, canAccessService, canAccessDepartment, canAccessFactory } = useAuth();

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

  // Get accessible factories for current user - only show factories where user has access to services
  const getAccessibleFactoriesForUser = () => {
    if (!user) return [];
    
    // Admin has access to all factories
    if ((user.role || '').toString().toLowerCase() === 'admin' || (user.permissions && user.permissions['*'] === true)) {
      return ['gulbarga', 'kerur', 'humnabad', 'omkar', 'padmavati', 'headoffice'];
    }
    
    // Use permission_metadata if available
    const permissionMetadata = user.permission_metadata || {};
    const userFactories = permissionMetadata.factories || [];
    
    // If we have permission_metadata, use it
    if (userFactories.length > 0) {
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('App.jsx - Accessible factories from permission_metadata:', userFactories);
      }
      return userFactories;
    }
    
    // Fallback to old logic for regular users
    const allFactories = ['gulbarga', 'kerur', 'humnabad', 'omkar', 'padmavati', 'headoffice'];
    const accessibleFactories = allFactories.filter(factory => canAccessFactory(factory));
    
    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('App.jsx - Accessible factories from fallback logic:', accessibleFactories);
    }
    return accessibleFactories;
  };

  return (
    <div className="app-container">
      {isAuthenticated && <Navbar user={user} onLogout={handleLogout} />}
      
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
                
                {/* Show message if user has no permissions */}
                {!isAdmin && getAccessibleFactoriesForUser().length === 0 && !canAccessService('reports') && (
                  <div style={{ 
                    color: '#ff6b6b', 
                    fontSize: '16px', 
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#fff5f5',
                    borderRadius: '8px',
                    border: '1px solid #ff6b6b'
                  }}>
                    ⚠️ <strong>No Access Granted</strong><br/>
                    You currently don't have any permissions assigned. Please contact your administrator to get access to the system.
                  </div>
                )}
              </div>
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

        <Route path="/humnabad" element={
          isAuthenticated && getAccessibleFactoriesForUser().includes('humnabad') ? 
            <HumnabadFactory /> : 
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
        <Route path="/:factoryKey/hb_store" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="hb_store" />}
            /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/:factoryKey/hb_humanresource" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<FactoryPrefixedDepartmentWrapper departmentType="hb_humanresource" />}
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

        <Route path="/:factoryKey/:departmentKey/pm_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/pm_batch_processing/*" element={
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

        <Route path="/:factoryKey/:departmentKey/hb_single_processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<ProcessingWrapper mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/hb_batch_processing/*" element={
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

        <Route path="/pm_single_processing/*" element={
          isAuthenticated ? 
            <PVHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/pm_batch_processing/*" element={
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

        <Route path="/hb_single_processing/*" element={
          isAuthenticated ? 
            <HBDHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/hb_batch_processing/*" element={
          isAuthenticated ? 
            <HBDHumanResource /> : 
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
        <Route path="/kerur/kr_store/kr_add-material" element={
          isAuthenticated ? 
            <KR_MaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/kerur/kr_store/kr_place_order" element={
          isAuthenticated ? 
            <KR_PlaceOrder /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/gulbarga/gb_store/gb_place_order" element={
          isAuthenticated ? 
            <KR_PlaceOrder /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/humnabad/hb_store/hb_place_order" element={
          isAuthenticated ? 
            <KR_PlaceOrder /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/headoffice/ho_store/ho_material_list" element={
          isAuthenticated ? 
            <SheetsMaterialList /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/omkar/om_store/om_place_order" element={
          isAuthenticated ? 
            <KR_PlaceOrder /> : 
            <Navigate to="/login" replace />
        } />
        <Route path="/padmavati/pv_store/pv_place_order" element={
          isAuthenticated ? 
            <KR_PlaceOrder /> : 
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

        <Route path="/hb_humanresource/*" element={
          isAuthenticated ? 
            <HBDHumanResource /> : 
            <Navigate to="/login" replace />
        } />

        <Route path="/hb_store/*" element={
          isAuthenticated ? 
            <HBDStore /> : 
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