import React, { useEffect, useCallback } from 'react';
import './App.css';
import { Route, Routes, useNavigate, Navigate } from 'react-router-dom';
import Processing from './Processing';
import Settings from './Components/Settings';
import Login from './Login';
import Navbar from './Navbar';
import Dashboard from './Dashboard';
import Reports from './Reports'
import PrivacyPolicy from './Components/PrivacyPolicy';
import TermsAndConditions from './Components/TermsAndConditions';
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
                  onClick={() => navigate('/single-processing')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Single Processing
                </span>
                <span 
                  onClick={() => navigate('/batch-processing')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Batch Processing
                </span>
                <span 
                  onClick={() => navigate('/reports')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Reports
                </span>
                <span 
                  onClick={() => navigate('/settings')} 
                  className="nav-link"
                  role="button"
                  tabIndex={0}
                >
                  Settings
                </span>
                {isAdmin && (
                  <span 
                    onClick={() => navigate('/dashboard')} 
                    className="nav-link"
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

        <Route path="/single-processing/*" element={
          isAuthenticated ? <Processing mode="single" /> : <Navigate to="/login" replace />
        } />

        <Route path="/batch-processing/*" element={
          isAuthenticated ? <Processing mode="batch" /> : <Navigate to="/login" replace />
        } />

        <Route path="/reports" element={
          isAuthenticated ? <Reports /> : <Navigate to="/login" replace />
        } />

        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}

export default App;