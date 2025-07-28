import React, { useEffect, useCallback } from 'react';
import './App.css';
import { Route, Routes, useNavigate, Navigate } from 'react-router-dom';
import Settings from './Components/Settings';
import Login from './Login';
import Navbar from './Navbar';
import Dashboard from './Dashboard';
import Processing from './Processing';
import Reports from './Reports';
import HumanResource from './Components/HumanResource';
import Marketing from './Components/Marketing';
import Store from './Components/Store';
import Accounts from './Components/Accounts';
import ReportsDepartment from './Components/ReportsDepartment';
import PrivacyPolicy from './Components/PrivacyPolicy';
import TermsAndConditions from './Components/TermsAndConditions';
import Inventory from './Inventory';
import DailyReports from './DailyReports';
import { useAuth } from './Components/AuthContext';

function App() {
  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout } = useAuth();

  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user');
      const storedAuthStatus = localStorage.getItem('isAuthenticated');

      if (storedUser && storedAuthStatus === 'true') {
        const userData = JSON.parse(storedUser);
        if (!isAuthenticated) {
          login(userData);
        }
      } else if (isAuthenticated) {
        logout();
      }
    };

    checkAuth();
  }, [isAuthenticated, login, logout]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Function to check if user is admin or super-admin
  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';

  return (
    <>
      {isAuthenticated && <Navbar user={user} onLogout={handleLogout} />}
      
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
              <div className="navigation-links">
                <span 
                  onClick={() => navigate('/humanresource')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Human Resource
                </span>
                <span 
                  onClick={() => navigate('/marketing')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Marketing
                </span>
                <span 
                  onClick={() => navigate('/store')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Store
                </span>
                <span 
                  onClick={() => navigate('/accounts')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Accounts
                </span>
                <span 
                  onClick={() => navigate('/reports-department')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Reports Department
                </span>
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
            </div>
          ) : <Navigate to="/login" replace />
        } />

        <Route path="/dashboard" element={
          isAuthenticated && isAdmin ? 
            <Dashboard /> : 
            <Navigate to="/app" replace />
        } />

        <Route path="/settings" element={
          isAuthenticated ? <Settings onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />

        <Route path="/humanresource/*" element={
          isAuthenticated ? <HumanResource /> : <Navigate to="/login" replace />
        } />

        <Route path="/marketing" element={
          isAuthenticated ? <Marketing /> : <Navigate to="/login" replace />
        } />

        <Route path="/store/*" element={
          isAuthenticated ? <Store /> : <Navigate to="/login" replace />
        } />

        <Route path="/accounts/*" element={
          isAuthenticated ? <Accounts /> : <Navigate to="/login" replace />
        } />

        <Route path="/reports-department" element={
          isAuthenticated ? <ReportsDepartment /> : <Navigate to="/login" replace />
        } />

        <Route path="/single-processing/*" element={
          isAuthenticated ? <Processing mode="single" /> : <Navigate to="/login" replace />
        } />

        <Route path="/batch-processing/*" element={
          isAuthenticated ? <Processing mode="batch" /> : <Navigate to="/login" replace />
        } />

        <Route path="/inventory/*" element={
          isAuthenticated ? <Inventory /> : <Navigate to="/login" replace />
        }/>

        <Route path="/reports" element={
          isAuthenticated ? <Reports /> : <Navigate to="/login" replace />
        } />

        <Route path="/daily-reports" element={
          isAuthenticated ? <DailyReports /> : <Navigate to="/login" replace />
        } />

        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}

export default App;