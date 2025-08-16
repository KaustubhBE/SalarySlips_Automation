import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { FaBars, FaCog, FaSignOutAlt, FaWhatsapp } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl, getWhatsAppServiceUrl, WHATSAPP_ENDPOINTS } from './config';

const Navbar = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQRValue] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const pollingRef = useRef(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Check WhatsApp authentication status
  const checkWhatsAppAuthStatus = async () => {
    try {
      const res = await fetch(getWhatsAppServiceUrl(WHATSAPP_ENDPOINTS.AUTH_STATUS), {
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('WhatsApp auth status:', data);
        
        if (data.authenticated) {
          setIsAuthenticated(true);
          setUserInfo(data.userInfo);
          setStatusMsg(`✅ Already authenticated as ${data.userInfo.name} (${data.userInfo.phoneNumber})`);
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
    setLoadingQR(true);
    setLoginSuccess(false);
    setStatusMsg('');
    setShowQR(true);
    setQRValue('');
    setIsPolling(false);
    
    try {
      console.log('Starting WhatsApp login...');
      const res = await fetch(getWhatsAppServiceUrl(WHATSAPP_ENDPOINTS.TRIGGER_LOGIN), { 
        method: 'POST',
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('WhatsApp login response:', data);
      
      if (data.authenticated) {
        // User is already authenticated
        setIsAuthenticated(true);
        setUserInfo(data.userInfo);
        setQRValue('');
        setStatusMsg(`✅ Already authenticated as ${data.userInfo.name} (${data.userInfo.phoneNumber})`);
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
      // Don't show error message, instead check auth status
      await checkWhatsAppAuthStatus();
    } finally {
      setLoadingQR(false);
    }
  };

  // WhatsApp logout function
  const handleWhatsAppLogout = async () => {
    try {
      const res = await fetch(getWhatsAppServiceUrl(WHATSAPP_ENDPOINTS.LOGOUT), {
        method: 'POST',
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsAuthenticated(false);
          setUserInfo(null);
          setStatusMsg('WhatsApp logged out successfully');
          setQRValue('');
          setIsPolling(false);
          
          // Auto-hide after 2 seconds
          setTimeout(() => {
            setShowQR(false);
            setStatusMsg('');
          }, 2000);
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

  // Call this when component mounts to check current status
  useEffect(() => {
    checkWhatsAppAuthStatus();
  }, []);

  // Poll WhatsApp status while QR modal is open
  useEffect(() => {
    if (showQR && isPolling && qrValue) {
      console.log('Starting status polling...');
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(getWhatsAppServiceUrl(WHATSAPP_ENDPOINTS.STATUS), {
            credentials: 'include'
          });
          
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          
          const data = await res.json();
          console.log('Status poll response:', data);
          
          // Check if WhatsApp is ready (authenticated)
          if (data.isReady === true || data.status === 'ready') {
            setLoginSuccess(true);
            setIsAuthenticated(true);
            setStatusMsg('WhatsApp login successful! You can now close this window.');
            setIsPolling(false);
            
            // Get user info
            await checkWhatsAppAuthStatus();
            
            // Auto-close after 3 seconds
            setTimeout(() => {
              setShowQR(false);
              setLoginSuccess(false);
              setStatusMsg('');
              setQRValue('');
              setIsPolling(false);
            }, 3000);
            
            clearInterval(pollingRef.current);
          }
        } catch (e) {
          console.error('Status polling error:', e);
          // Don't show error to user, just continue polling
        }
      }, 3000); // Poll every 3 seconds
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [showQR, isPolling, qrValue]);

  // Clean up polling on unmount or modal close
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Close modal and cleanup
  const closeQRModal = () => {
    setShowQR(false);
    setLoginSuccess(false);
    setStatusMsg('');
    setQRValue('');
    setIsPolling(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
  };

  return (
    <div className='navbar'>
      <div className='burger-menu'>
        <FaBars onClick={toggleMenu} />
        {menuOpen && (
          <div className='menu'>
            <span onClick={() => closeMenu('/app')}>Home</span>
            <span onClick={() => closeMenu ('/humanresource')}>Human Resource</span>
            <span onClick={() => closeMenu ('/marketing')}>Marketing</span>
            <span onClick={() => closeMenu ('/store')}>Store</span>
            <div className="menu-divider"></div>
            <span onClick={() => closeMenu('/privacy-policy')}>Privacy Policy</span>
            <span onClick={() => closeMenu('/terms-and-conditions')}>Terms & Conditions</span>
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
          title={isAuthenticated ? `WhatsApp: ${userInfo?.name}` : "Show WhatsApp QR"} 
        />
        <FaSignOutAlt className="logout-icon" onClick={handleLogout} title="Logout" />
        <FaCog className="settings-icon" onClick={() => navigate('/settings')} title="Settings" />
      </div>
      {showQR && (
        <div className="qr-modal" onClick={closeQRModal}>
          <div className="qr-content" onClick={e => e.stopPropagation()}>
            <h2>WhatsApp Web QR</h2>
            
            {loadingQR ? (
              <div className="loading-message">Loading QR Code...</div>
            ) : isAuthenticated ? (
              <div className="auth-status">
                <div className="success-message">{statusMsg}</div>
                <div className="user-info">
                  <p><strong>Name:</strong> {userInfo?.name}</p>
                  <p><strong>Phone:</strong> {userInfo?.phoneNumber}</p>
                </div>
              </div>
            ) : qrValue ? (
              <div className="qr-container">
                <QRCodeSVG value={qrValue} size={300} />
                <p className="qr-instructions">Scan this QR code with your WhatsApp mobile app</p>
                {isPolling && (
                  <div className="polling-status">
                    <span className="polling-indicator">●</span> Waiting for authentication...
                  </div>
                )}
              </div>
            ) : (
              <div className="loading-message">Checking WhatsApp status...</div>
            )}
            
            {loginSuccess && (
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