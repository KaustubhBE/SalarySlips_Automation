import React, { useState } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { FaBars, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './Components/AuthContext';

const Navbar = ({ onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
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
        <FaSignOutAlt className="logout-icon" onClick={handleLogout} title="Logout" />
        <FaCog className="settings-icon" onClick={() => navigate('/settings')} title="Settings" />
      </div>
    </div>
  );
};

export default Navbar;