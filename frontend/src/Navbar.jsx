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
    try {
      const res = await fetch(getApiUrl('whatsapp-login'), { method: 'POST' });
      const data = await res.json();
      setQRValue(data.qr || '');
      if (!data.qr) setStatusMsg(data.error || 'Failed to load QR');
    } catch (err) {
      setQRValue('');
      // setStatusMsg('Failed to load QR');
    } finally {
      setLoadingQR(false);
    }
  };

  // Poll WhatsApp status while QR modal is open
  useEffect(() => {
    if (showQR && qrValue) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(getApiUrl('whatsapp-status'));
          const data = await res.json();
          if (data.status === 'authenticated' || data.status === 'ready' || data.status === true) {
            setLoginSuccess(true);
            setStatusMsg('WhatsApp login successful!');
            setTimeout(() => {
              setShowQR(false);
              setLoginSuccess(false);
              setStatusMsg('');
            }, 1500);
            clearInterval(pollingRef.current);
          }
        } catch (e) {
          // ignore
        }
      }, 2000);
      return () => clearInterval(pollingRef.current);
    } else {
      clearInterval(pollingRef.current);
    }
  }, [showQR, qrValue]);

  // Clean up polling on unmount
  useEffect(() => () => clearInterval(pollingRef.current), []);

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
        <div className="qr-modal" onClick={() => setShowQR(false)}>
          <div className="qr-content" onClick={e => e.stopPropagation()}>
            <h2>WhatsApp Web QR</h2>
            {loadingQR ? <div>Loading...</div> : qrValue ? <QRCodeSVG value={qrValue} size={300} /> : <div style={{color:'red'}}>{statusMsg || 'Failed to load QR'}</div>}
            {loginSuccess && <div style={{color:'green', marginTop:10}}>{statusMsg}</div>}
            {!loginSuccess && statusMsg && !qrValue && <div style={{color:'red', marginTop:10}}>{statusMsg}</div>}
            <button className="qr-close-btn" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;