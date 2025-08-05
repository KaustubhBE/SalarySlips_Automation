import React, { useState } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { FaBars, FaCog, FaSignOutAlt, FaWhatsapp } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';
import { QRCodeSVG } from 'qrcode.react';

const Navbar = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQRValue] = useState('');
  const [loadingQR, setLoadingQR] = useState(false);
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

  const fetchQR = async () => {
    setLoadingQR(true);
    try {
      const res = await fetch('/api/whatsapp-qr');
      const data = await res.json();
      setQRValue(data.qr || '');
      setShowQR(true);
    } catch (err) {
      setQRValue('');
      setShowQR(true);
    } finally {
      setLoadingQR(false);
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
          onClick={fetchQR} 
          title="Show WhatsApp QR" 
        />
        <FaSignOutAlt className="logout-icon" onClick={handleLogout} title="Logout" />
        <FaCog className="settings-icon" onClick={() => navigate('/settings')} title="Settings" />
      </div>
      {showQR && (
        <div className="qr-modal" onClick={() => setShowQR(false)}>
          <div className="qr-content" onClick={e => e.stopPropagation()}>
            <h2>WhatsApp Web QR</h2>
            {loadingQR ? <div>Loading...</div> : qrValue ? <QRCodeSVG value={qrValue} size={300} /> : <div style={{color:'red'}}>Failed to load QR</div>}
            <button className="qr-close-btn" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;