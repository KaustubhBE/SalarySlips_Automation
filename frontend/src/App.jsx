import React, { useState } from 'react';
import './App.css';
import { Route, Routes, useNavigate } from 'react-router-dom';
import SingleProcessing from './Single-Processing';
import BatchProcessing from './Batch-Processing';
import Settings from './Components/Settings';
import Login from './Login';
import Navbar from './Navbar';
import LoadingSpinner from './Components/LoadingSpinner';
import MessageLogger from './Components/MessageLogger';

function App() {
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();

  const handleLogin = (user) => {
    setUser(user);
    setIsAuthenticated(true);
    navigate('/app');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    navigate('/');
  };

  const handleLinkClick = (path) => {
    setShowSplash(false);
    navigate(path);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />
      {loading && <LoadingSpinner />}
      {showSplash ? (
        <div className="splash-page">
          <h1>Welcome to Bajaj Earths</h1>
          <h3>Please choose an option below:</h3>
          <div className="navigation-links">
            <span onClick={() => handleLinkClick('/single-processing')} className="nav-link">Single Processing</span>
            <span onClick={() => handleLinkClick('/batch-processing')} className="nav-link">Batch Processing</span>
            <span onClick={() => handleLinkClick('/settings')} className="nav-link">Settings</span>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/app" element={<App />} />
          <Route path="/settings" element={<Settings user={user} onLogout={handleLogout} />} />
          <Route path="/single-processing" element={<SingleProcessing />} />
          <Route path="/batch-processing" element={<BatchProcessing />} />
        </Routes>
      )}
      <MessageLogger refreshTrigger={refreshTrigger} />
    </>
  );
}

export default App;