import React, { useEffect, useState } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';
import { FaBars } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';

const Navbar = () => {
  const [time, setTime] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const option = { month: 'short' };
  const dateToday = new Date().getDate().toString().padStart(2, '0');
  const monthToday = new Date().toLocaleDateString('en-US', option).toString().toUpperCase(0);
  const yearToday = new Date().getFullYear();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString();
  };

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
            <span onClick={() => closeMenu('/settings')}>Settings</span>
          </div>
        )}
        <Link to='/app' >
      <img src={beLogo} className='be-logo' alt='BE Logo' />
      </Link>
      </div>
      <div className='clock'>
        <p>
          {formatTime(time)}<br />
          {`${dateToday} ${monthToday}, ${yearToday}`}
        </p>
      </div>
    </div>
  );
};

export default Navbar;