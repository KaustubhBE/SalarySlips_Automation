import React, { useState, useRef, useEffect } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { FaBars, FaCog, FaSignOutAlt, FaWhatsapp } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl } from './config';

const Navbar = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQRValue] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isPolling, setIsPolling] = useState(false);
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
      const res = await fetch(getApiUrl('whatsapp-login'), { 
        method: 'POST',
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('WhatsApp login response:', data);
      
      if (data.qr && data.qr.trim()) {
        setQRValue(data.qr);
        setStatusMsg('QR Code loaded. Please scan with your phone.');
        setIsPolling(true);
      } else {
        setStatusMsg(data.error || 'No QR code received. Please try again.');
      }
    } catch (err) {
      console.error('WhatsApp login error:', err);
      setStatusMsg('Failed to load QR code. Please check if the WhatsApp service is running.');
    } finally {
      setLoadingQR(false);
    }
  };

  // Poll WhatsApp status while QR modal is open
  useEffect(() => {
    if (showQR && isPolling && qrValue) {
      console.log('Starting status polling...');
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(getApiUrl('whatsapp-status'), {
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
            setStatusMsg('WhatsApp login successful! You can now close this window.');
            setIsPolling(false);
            
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
          title="Show WhatsApp QR" 
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
              <div className="error-message">{statusMsg || 'Failed to load QR'}</div>
            )}
            
            {loginSuccess && (
              <div className="success-message">{statusMsg}</div>
            )}
            
            {!loginSuccess && statusMsg && !qrValue && (
              <div className="error-message">{statusMsg}</div>
            )}
            
            <div className="qr-actions">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;