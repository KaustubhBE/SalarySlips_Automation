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
import PrivacyPolicy from './Components/PrivacyPolicy';
import TermsAndConditions from './Components/TermsAndConditions';
import Inventory from './Inventory';
import ReactorReports from './ReactorReports';
import Department from './Department';
import GulbargaFactory from './Factories/gulbarga';
import KerurFactory from './Factories/kerur';
import OmkarFactory from './Factories/omkar';
import HeadOfficeFactory from './Factories/headoffice';
import PadmavatiFactory from './Factories/padmavati';
import HumnabadFactory from './Factories/humnabad';

// Import specific department components
import GBStore from './GB_Departments/GBStore';
import GBHumanResource from './GB_Departments/GBHumanResource';
import KRStore from './KR_Departments/KRStore';
import KRHumanResource from './KR_Departments/KRHumanResource';
import OMStore from './OM_Departments/OMStore';
import OMHumanResource from './OM_Departments/OMHumanResource';
import HBDStore from './HBD_Departments/HBDStore';
import HBDHumanResource from './HBD_Departments/HBDHumanResource';
import PMStore from './PM_Departments/PMStore';
import PMHumanResource from './PM_Departments/PMHumanResource';
import HOAccounts from './HO_Departments/HO_Accounts';
import HOMarketing from './HO_Departments/HO_Marketing';
import HOOperations from './HO_Departments/HO_Operations';
import HOHumanResource from './HO_Departments/HO_HumanResourec';
import { useAuth } from './Components/AuthContext';
import { DEPARTMENTS_CONFIG, FACTORY_NAMES } from './config';

// Function to get the correct department component based on factory and department keys
const getDepartmentComponent = (factoryKey, departmentKey) => {
  const componentMap = {
    'gulbarga': {
      'store': GBStore,
      'humanresource': GBHumanResource
    },
    'kerur': {
      'store': KRStore,
      'humanresource': KRHumanResource
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
      'store': PMStore,
      'humanresource': PMHumanResource
    },
    'headoffice': {
      'accounts': HOAccounts,
      'marketing': HOMarketing,
      'operations': HOOperations,
      'humanresource': HOHumanResource
    }
  };
  
  return componentMap[factoryKey]?.[departmentKey] || Department;
};

// Department Component Wrapper
const DepartmentWrapper = () => {
  const { factoryKey, departmentKey } = useParams();
  const DepartmentComponent = getDepartmentComponent(factoryKey, departmentKey);
  return <DepartmentComponent />;
};

// Department Route Guard Component
const DepartmentRouteGuard = ({ requiredRouteType, component }) => {
  const { user, canAccessDepartment, canAccessFactoryDepartment } = useAuth();
  const { factoryKey, departmentKey } = useParams();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user can access this factory/department combination
  const canAccess = canAccessFactoryDepartment(factoryKey, departmentKey);
  
  console.log('DepartmentRouteGuard - Checking access for:', {
    factoryKey,
    departmentKey,
    requiredRouteType,
    userRole: user.role,
    canAccess
  });
  
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
            <Navigate to="/login" replace />
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

        {/* Department Routes - Factory/Department access */}
        <Route path="/:factoryKey/:departmentKey" element={
          isAuthenticated ? 
            <DepartmentRouteGuard 
              requiredRouteType="department_access"
              component={<DepartmentWrapper />}
            /> : 
            <Navigate to="/login" replace />
        } />

        {/* Legacy Department Routes - Keep for backward compatibility */}




        <Route path="/reports" element={
          isAuthenticated && canAccessService('reports') ? 
            <Reports /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/reactor-reports" element={
          isAuthenticated && canAccessService('reports') ? 
            <ReactorReports /> : 
            <Navigate to="/app" replace />
        } />

        {/* Service Routes - Factory/Department/Service access */}
        <Route path="/:factoryKey/:departmentKey/single-processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="single_processing"
            component={<Processing mode="single" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/batch-processing/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="batch_processing"
            component={<Processing mode="batch" />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/inventory/*" element={
          <DepartmentRouteGuard 
            requiredRouteType="inventory"
            component={<Inventory />}
          />
        }/>

        <Route path="/:factoryKey/:departmentKey/reports" element={
          <DepartmentRouteGuard 
            requiredRouteType="reports"
            component={<Reports />}
          />
        } />

        <Route path="/:factoryKey/:departmentKey/reactor-reports" element={
          <DepartmentRouteGuard 
            requiredRouteType="reactor_reports"
            component={<ReactorReports />}
          />
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