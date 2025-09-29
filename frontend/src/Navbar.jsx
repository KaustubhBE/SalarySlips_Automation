import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { 
  FaBars, 
  FaCog, 
  FaSignOutAlt, 
  FaWhatsapp
} from 'react-icons/fa';
import ReportsDepartment from './Components/ReportsDepartment';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { 
  getApiUrl, 
  FACTORY_NAMES, 
  ENDPOINTS,
  DEFAULT_WHATSAPP_URL
} from './config';

const Navbar = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQRValue] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [authStartTime, setAuthStartTime] = useState(null);
  const [authElapsedTime, setAuthElapsedTime] = useState(0);
  
  const pollingRef = useRef(null);
  const menuRef = useRef(null);
  const burgerRef = useRef(null);
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // Format time in a readable format
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  // Calculate estimated completion time based on elapsed time
  const getEstimatedCompletion = (elapsedSeconds) => {
    if (elapsedSeconds < 30) {
      return "Initializing... (30-60s estimated)";
    } else if (elapsedSeconds < 60) {
      return "Loading WhatsApp Web... (1-2m estimated)";
    } else if (elapsedSeconds < 120) {
      return "Syncing data... (2-5m estimated)";
    } else if (elapsedSeconds < 300) {
      return "Finalizing sync... (3-10m estimated)";
    } else {
      return "Completing authentication... (5-15m estimated)";
    }
  };

  // Get the correct user identifier (email is preferred, fallback to username)
  const getUserIdentifier = () => {
    if (!user) return null;
    
    // Prefer email over username for WhatsApp authentication
    if (user.email && user.email.trim()) {
      return user.email.trim();
    }
    
    // Fallback to username if no email
    if (user.username && user.username.trim()) {
      return user.username.trim();
    }
    
    // Last resort fallback
    if (user.id && user.id.trim()) {
      return user.id.trim();
    }
    
    return null;
  };

  // Get accessible factories for current user using new RBAC system
  const getAccessibleFactoriesForUser = () => {
    return getUserFactories();
  };

  // Get accessible departments for a specific factory using new RBAC system
  const getAccessibleDepartmentsForFactory = (factoryKey) => {
    if (!factoryKey) return [];
    
    // Get departments for this factory from the new RBAC system
    const userDepartments = getUserDepartments(factoryKey);
    
    // Convert to the format expected by the navbar
    return userDepartments.map(deptKey => {
      // Remove factory prefix to get base department key
      const baseDeptKey = deptKey.replace(/^(gb|kr|hb|om|pv|ho)_/, '');
      
      return {
        key: baseDeptKey,
        name: baseDeptKey.charAt(0).toUpperCase() + baseDeptKey.slice(1).replace(/([A-Z])/g, ' $1'),
        description: `${baseDeptKey.charAt(0).toUpperCase() + baseDeptKey.slice(1)} Department`,
        services: {}
      };
    });
  };

  // Get accessible services for a specific department using new RBAC system
  const getAccessibleServicesForDepartment = (factoryKey, departmentKey) => {
    if (!factoryKey || !departmentKey) return [];
    
    // Get services for this factory-department combination from the new RBAC system
    const userServices = getUserServices(factoryKey, departmentKey);
    
    // Convert to the format expected by the navbar
    return userServices.map(serviceKey => {
      return {
        key: serviceKey,
        name: serviceKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: `${serviceKey.replace(/_/g, ' ')} service`,
        route: `/${factoryKey}/${departmentKey}/${serviceKey}`
      };
    });
  };

  // Check if user has specific permission using new RBAC system
  const hasUserPermission = (permission) => {
    return hasPermission(permission);
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    if (!menuOpen) {
      setOpenDropdowns({}); // Close all dropdowns when opening menu
    }
  };

  const closeMenu = (path) => {
    setMenuOpen(false);
    setOpenDropdowns({});
    navigate(path);
  };

  const toggleDropdown = (dropdownKey) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [dropdownKey]: !prev[dropdownKey]
    }));
  };

  const handleLogout = async () => {
    // Perform general logout
    await logout();
    navigate('/login', { replace: true });
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && 
          menuRef.current && 
          !menuRef.current.contains(event.target) &&
          burgerRef.current &&
          !burgerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Check WhatsApp authentication status
  const checkWhatsAppAuthStatus = async () => {
    try {
      const userIdentifier = getUserIdentifier();
      if (!userIdentifier) {
        console.error('No user identifier available for WhatsApp authentication');
        setIsAuthenticated(false);
        setUserInfo(null);
        setStatusMsg('User identification error. Please log in again.');
        return;
      }

      console.log(`Checking WhatsApp auth status for user: ${userIdentifier}`);
      
      const res = await fetch(`${DEFAULT_WHATSAPP_URL}/api/whatsapp-status`, {
        credentials: 'include',
        headers: {
          'X-User-Email': userIdentifier,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('WhatsApp auth status:', data);
        
        if (data.isReady || data.authenticated) {
          setIsAuthenticated(true);
          const hasUsableUserInfo = !!(data.userInfo && (data.userInfo.name || data.userInfo.pushName || data.userInfo.phoneNumber));
          if (hasUsableUserInfo) {
            const displayName = (data.userInfo.name && data.userInfo.name !== 'Unknown') ? data.userInfo.name : (data.userInfo.pushName || 'WhatsApp User');
            setUserInfo({
              name: displayName,
              phoneNumber: data.userInfo.phoneNumber || 'Connected'
            });
            setStatusMsg(`WhatsApp is ready and connected as ${displayName}`);
          } else {
            setUserInfo({ name: 'Loading...', phoneNumber: 'Checking...' });
            setStatusMsg(`WhatsApp is ready and connected`);
          }
        } else {
          setIsAuthenticated(false);
          setUserInfo(null);
          setStatusMsg('');
        }
      }
    } catch (error) {
      console.error('Error checking WhatsApp auth status:', error);
      setIsAuthenticated(false);
      setUserInfo(null);
    }
  };

  // Start WhatsApp login and show QR
  const startWhatsappLogin = async () => {
    const userIdentifier = getUserIdentifier();
    if (!userIdentifier) {
      setStatusMsg('User identification error. Please log in again.');
      return;
    }

    setLoadingQR(true);
    setLoginSuccess(false);
    setStatusMsg('Initializing WhatsApp connection...');
    setShowQR(true);
    setQRValue('');
    setIsPolling(false);
    setAuthStartTime(Date.now());
    setAuthElapsedTime(0);
    
    try {
      console.log(`Starting WhatsApp login for user: ${userIdentifier}`);
      
      const res = await fetch(`${DEFAULT_WHATSAPP_URL}/api/whatsapp-login`, { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userIdentifier
        },
        body: JSON.stringify({
          email: userIdentifier
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.error === 'USER_NOT_LOGGED_IN') {
          setStatusMsg('Your session has expired. Please log in again.');
          setShowQR(false);
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('WhatsApp login response:', data);
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        if (data.userInfo && data.userInfo.name && data.userInfo.name !== 'Unknown') {
          setUserInfo({
            name: data.userInfo.name || data.userInfo.pushName || 'WhatsApp User',
            phoneNumber: data.userInfo.phoneNumber || 'Connected'
          });
          setStatusMsg(`Already authenticated as ${data.userInfo.name || data.userInfo.pushName || 'WhatsApp User'}`);
        } else {
          setUserInfo({ name: 'Loading...', phoneNumber: 'Checking...' });
          setStatusMsg(`Already authenticated`);
        }
        setQRValue('');
        setIsPolling(false);
        return;
      }
      
      if (data.qr && data.qr.trim()) {
        setQRValue(data.qr);
        setStatusMsg('QR Code loaded. Please scan with your phone.');
        setIsPolling(true);
      } else {
        setStatusMsg(data.message || 'No QR code received. Please try again.');
      }
    } catch (err) {
      console.error('WhatsApp login error:', err);
      setStatusMsg(`Failed to start WhatsApp login: ${err.message}. Please try again.`);
    } finally {
      setLoadingQR(false);
    }
  };

  // WhatsApp logout function
  const handleWhatsAppLogout = async () => {
    try {
      const userIdentifier = getUserIdentifier();
      if (!userIdentifier) {
        setStatusMsg('User identification error. Please log in again.');
        return;
      }

      const res = await fetch(`${DEFAULT_WHATSAPP_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-User-Email': userIdentifier
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsAuthenticated(false);
          setUserInfo(null);
          setStatusMsg('WhatsApp logged out successfully');
          setQRValue('');
          setIsPolling(false);
          
          // Start fresh login
          setTimeout(() => {
            startWhatsappLogin();
          }, 1000);
        } else {
          setStatusMsg('Logout failed: ' + data.message);
        }
      } else {
        setStatusMsg('Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('WhatsApp logout error:', error);
      setStatusMsg('Logout error. Please try again.');
    }
  };

  // Removed automatic status check on component mount
  // Status check now only happens when WhatsApp icon is clicked

  // Removed automatic status check when modal is shown
  // Status check now only happens when WhatsApp icon is clicked

  // Poll for status updates when QR is shown
  useEffect(() => {
    if (showQR && isPolling && !loadingQR) {
      console.log('Starting status monitoring...');
      
      const initialCheck = setTimeout(async () => {
        await checkStatusOnce();
      }, 2000);
      
      pollingRef.current = setInterval(async () => {
        await checkStatusOnce();
      }, 8000);
      
      return () => {
        clearTimeout(initialCheck);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [showQR, isPolling, loadingQR]);

  // Single status check function
  const checkStatusOnce = async () => {
    try {
      const userIdentifier = getUserIdentifier();
      if (!userIdentifier) {
        console.error('No user identifier available for status check');
        return;
      }

      // First check for existing QR code
      const qrRes = await fetch(`${DEFAULT_WHATSAPP_URL}/api/qr`, {
        credentials: 'include',
        headers: {
          'X-User-Email': userIdentifier
        }
      });
      
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        console.log('QR check response:', qrData);
        
        if (qrData.success && qrData.qr && qrData.qr.trim()) {
          console.log('QR code received in polling:', qrData.qr.substring(0, 50) + '...');
          setQRValue(qrData.qr);
          setStatusMsg('QR Code loaded. Please scan with your phone.');
          return; // QR found, no need to check status
        }
      }

      // If no QR code, check status
      const res = await fetch(`${DEFAULT_WHATSAPP_URL}/api/whatsapp-status`, {
        credentials: 'include',
        headers: {
          'X-User-Email': userIdentifier
        }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Status check response:', data);
      console.log('Connection status:', data.connectionStatus);
      
      if (data.isReady === true || data.status === 'ready') {
        setLoginSuccess(true);
        setIsAuthenticated(true);
        // Populate user info if available
        if (data.userInfo && (data.userInfo.name || data.userInfo.pushName || data.userInfo.phoneNumber)) {
          const displayName = (data.userInfo.name && data.userInfo.name !== 'Unknown') ? data.userInfo.name : (data.userInfo.pushName || 'WhatsApp User');
          setUserInfo({
            name: displayName,
            phoneNumber: data.userInfo.phoneNumber || 'Connected'
          });
          setStatusMsg(`WhatsApp login successful! Connected as ${displayName}. You can now close this window.`);
        } else {
          setStatusMsg('WhatsApp login successful! You can now close this window.');
        }
        setIsPolling(false);
        
        checkWhatsAppAuthStatus();
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          setShowQR(false);
          setLoginSuccess(false);
          setStatusMsg('');
          setQRValue('');
          setIsPolling(false);
        }, 3000);
        
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      } else if (data.userInfo && (data.userInfo.name || data.userInfo.pushName || data.userInfo.phoneNumber)) {
        const displayName = (data.userInfo.name && data.userInfo.name !== 'Unknown') ? data.userInfo.name : (data.userInfo.pushName || 'WhatsApp User');
        setUserInfo({
          name: displayName,
          phoneNumber: data.userInfo.phoneNumber || 'Connected'
        });
      } else if (data.connectionStatus) {
        // Show connection status for debugging
        console.log('Connection status:', data.connectionStatus);
        if (data.connectionStatus.reason === 'QR available') {
          setStatusMsg('QR code is available. Please scan with your phone.');
        } else if (data.connectionStatus.reason === 'Not initialized') {
          setStatusMsg('WhatsApp client is not initialized. Please try again.');
        } else if (data.connectionStatus.reason === 'Unknown state') {
          setStatusMsg('WhatsApp client is in unknown state. Please try again.');
        }
      }
    } catch (e) {
      console.error('Status check error:', e);
    }
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);


  // Update elapsed time every second during authentication
  useEffect(() => {
    let interval = null;
    
    if (authStartTime && (showQR || isPolling) && !isAuthenticated) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - authStartTime) / 1000);
        setAuthElapsedTime(elapsed);
      }, 1000);
    } else {
      setAuthElapsedTime(0);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [authStartTime, showQR, isPolling, isAuthenticated]);

  // Close modal and cleanup
  const closeQRModal = () => {
    setShowQR(false);
    setLoginSuccess(false);
    setStatusMsg('');
    setQRValue('');
    setIsPolling(false);
    setAuthStartTime(null);
    setAuthElapsedTime(0);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  // Don't show WhatsApp icon if no user identifier
  if (!getUserIdentifier()) {
    return (
      <div className='navbar'>
        <div className='burger-menu' ref={burgerRef}>
          <FaBars onClick={toggleMenu} />
          {menuOpen && (
            <div className='menu' ref={menuRef}>
              <div className="menu-item" onClick={() => closeMenu('/app')}>
                <span className="menu-item-text">Home</span>
              </div>
              <div className="menu-divider"></div>
              <div className="menu-item" onClick={() => closeMenu('/privacy-policy')}>
                <span className="menu-item-text">Privacy Policy</span>
              </div>
              <div className="menu-item" onClick={() => closeMenu('/terms-and-conditions')}>
                <span className="menu-item-text">Terms & Conditions</span>
              </div>
            </div>
          )}
          <Link to='/app'>
            <img src={beLogo} className='be-logo' alt='BE Logo' />
          </Link>
        </div>
        
        <div className="navbar-right">
          <FaSignOutAlt className="logout-icon" onClick={handleLogout} title="Logout" />
          <FaCog className="settings-icon" onClick={() => navigate('/settings')} title="Settings" />
        </div>
      </div>
    );
  }

  return (
    <div className='navbar'>
      <div className='burger-menu' ref={burgerRef}>
        <FaBars onClick={toggleMenu} />
        {menuOpen && (
          <div className='menu' ref={menuRef}>
            <div className="menu-item" onClick={() => closeMenu('/app')}>
              <span className="menu-item-text">Home</span>
            </div>
            
            {/* Factory Navigation with 2-layer dropdown */}
            {getAccessibleFactoriesForUser().map(factory => {
              const accessibleDepartments = getAccessibleDepartmentsForFactory(factory);
              
              // Only show factory if it has accessible departments
              if (accessibleDepartments.length === 0) return null;
              
              return (
                <div key={factory} className="dropdown-container">
                  <div 
                    className="dropdown-header" 
                    onClick={() => toggleDropdown(`factory-${factory}`)}
                  >
                    <span className="dropdown-text">
                      {FACTORY_NAMES[factory] || factory.charAt(0).toUpperCase() + factory.slice(1)}
                    </span>
                    <span className={`dropdown-arrow ${openDropdowns[`factory-${factory}`] ? 'open' : ''}`}>
                      ▼
                    </span>
                  </div>
                  
                  {openDropdowns[`factory-${factory}`] && (
                    <div className="dropdown-content">
                      {/* Department Navigation */}
                      {accessibleDepartments.map(dept => {
                        const accessibleServices = getAccessibleServicesForDepartment(factory, dept.key);
                        
                        // Only show department if it has accessible services
                        if (accessibleServices.length === 0) return null;
                        
                        return (
                          <div key={dept.key} className="sub-dropdown-container">
                            <div 
                              className="sub-dropdown-header"
                              onClick={() => toggleDropdown(`dept-${factory}-${dept.key}`)}
                            >
                              <span className="sub-dropdown-text">{dept.name}</span>
                              <span className={`sub-dropdown-arrow ${openDropdowns[`dept-${factory}-${dept.key}`] ? 'open' : ''}`}>
                                ▼
                              </span>
                            </div>
                            
                            {openDropdowns[`dept-${factory}-${dept.key}`] && (
                              <div className="sub-dropdown-content">
                                {/* Service Navigation */}
                                {accessibleServices.map(service => (
                                  <div 
                                    key={service.key} 
                                    className="service-menu-item"
                                    onClick={() => closeMenu(service.route)}
                                    title={service.description}
                                  >
                                    <span className="service-item-text">{service.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Reports Department */}
            {hasUserPermission('reports') && (
              <div className="menu-item" onClick={() => closeMenu('/reports-department')}>
                <span className="menu-item-text">Reports Department</span>
              </div>
            )}
            
            {/* User Management */}
            {user?.role === 'admin' && (
              <div className="menu-item" onClick={() => closeMenu('/dashboard')}>
                <span className="menu-item-text">User Management</span>
              </div>
            )}
            
            <div className="menu-divider"></div>
            <div className="menu-item" onClick={() => closeMenu('/privacy-policy')}>
              <span className="menu-item-text">Privacy Policy</span>
            </div>
            <div className="menu-item" onClick={() => closeMenu('/terms-and-conditions')}>
              <span className="menu-item-text">Terms & Conditions</span>
            </div>
          </div>
        )}
        <Link to='/app'>
          <img src={beLogo} className='be-logo' alt='BE Logo' />
        </Link>
      </div>
      
      <div className="navbar-right">
        <FaWhatsapp 
          className="whatsapp-icon" 
          onClick={startWhatsappLogin} 
          title={isAuthenticated ? 
            (userInfo && userInfo.name && userInfo.name !== 'Loading...' && userInfo.name !== 'WhatsApp User' ? 
              `WhatsApp: ${userInfo.name} (${userInfo.phoneNumber})` : 
              "WhatsApp: Connected (Loading user info...)") : 
            `Check WhatsApp Status for ${getUserIdentifier()}`} 
        />
        <FaSignOutAlt className="logout-icon" onClick={handleLogout} title="Logout" />
        <FaCog className="settings-icon" onClick={() => navigate('/settings')} title="Settings" />
      </div>
      
      {/* WhatsApp QR Modal */}
      {showQR && (
        <div className="qr-modal" onClick={closeQRModal}>
          <div className="qr-content" onClick={e => e.stopPropagation()}>
            <h2>WhatsApp Authentication</h2>
            <p className="user-identifier">User: {getUserIdentifier()}</p>
            
            {loadingQR ? (
              <div className="loading-message">
                <div>Loading QR Code...</div>
                {authElapsedTime > 0 && (
                  <div className="auth-timing">
                    <div>Elapsed: {formatTime(authElapsedTime)}</div>
                    <div className="estimated-time">{getEstimatedCompletion(authElapsedTime)}</div>
                  </div>
                )}
              </div>
            ) : isAuthenticated ? (
              <div className="auth-status">
                <div className="success-message">{statusMsg}</div>
                <div className="user-info">
                  <p><strong>Name:</strong> {userInfo?.name || 'Loading...'}</p>
                  <p><strong>Phone:</strong> {userInfo?.phoneNumber || 'Checking...'}</p>
                </div>
              </div>
            ) : qrValue ? (
              <div className="qr-container">
                <QRCodeSVG value={qrValue} size={300} />
                <p className="qr-instructions">Scan this QR code with your WhatsApp mobile app</p>
                {isPolling && (
                  <div className="polling-status">
                    <span className="polling-indicator">●</span> Waiting for authentication...
                    {authElapsedTime > 0 && (
                      <div className="auth-timing">
                        <div>Elapsed: {formatTime(authElapsedTime)}</div>
                        <div className="estimated-time">{getEstimatedCompletion(authElapsedTime)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="loading-message">
                <div>Checking WhatsApp status...</div>
                {authElapsedTime > 0 && (
                  <div className="auth-timing">
                    <div>Elapsed: {formatTime(authElapsedTime)}</div>
                    <div className="estimated-time">{getEstimatedCompletion(authElapsedTime)}</div>
                  </div>
                )}
              </div>
            )}
            
            {loginSuccess && !isAuthenticated && (
              <div className="success-message">{statusMsg}</div>
            )}
            
            <div className="qr-actions">
              {isAuthenticated ? (
                <>
                  <button 
                    className="qr-logout-btn" 
                    onClick={handleWhatsAppLogout}
                  >
                    Logout WhatsApp
                  </button>
                  <button className="qr-close-btn" onClick={closeQRModal}>
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="qr-retry-btn" 
                    onClick={startWhatsappLogin}
                    disabled={loadingQR}
                  >
                    Retry
                  </button>
                  <button className="qr-close-btn" onClick={closeQRModal}>
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;