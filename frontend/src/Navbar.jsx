import React, { useEffect, useState } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { FaBars } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import ClientOnly from './Components/ClientOnly';

const Clock = () => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString();
  };

  const option = { month: 'short' };
  const dateToday = time.getDate().toString().padStart(2, '0');
  const monthToday = time.toLocaleDateString('en-US', option).toString().toUpperCase();
  const yearToday = time.getFullYear();

  return (
    <div className='clock'>
      <p>
        {formatTime(time)}<br />
        {`${dateToday} ${monthToday}, ${yearToday}`}
      </p>
    </div>
  );
};

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className='navbar'>
      <div className='burger-menu'>
        <FaBars onClick={toggleMenu} />
        {menuOpen && (
          <div className='menu'>
            <span onClick={() => closeMenu('/app')}>Home</span>
            <span onClick={() => closeMenu('/single-processing')}>Single Processing</span>
            <span onClick={() => closeMenu('/batch-processing')}>Batch Processing</span>
            <span onClick={() => closeMenu('/reports')}>Reports</span>
            <span onClick={() => closeMenu('/settings')}>Settings</span>
            <div className="menu-divider"></div>
            <span onClick={() => closeMenu('/privacy-policy')}>Privacy Policy</span>
            <span onClick={() => closeMenu('/terms-and-conditions')}>Terms & Conditions</span>
          </div>
        )}
        <Link to='/app'>
          <img src={beLogo} className='be-logo' alt='BE Logo' />
        </Link>
      </div>
      <ClientOnly>
        <Clock />
      </ClientOnly>
    </div>
  );
};

export default Navbar;