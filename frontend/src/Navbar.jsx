import React, { useEffect } from 'react';
import './Navbar.css';
import beLogo from './assets/be-logo.png';

const Navbar = () => {
  const [time, setTime] = React.useState(new Date());
  const option = { month: 'short' };
  const dateToday = new Date().getDate().toString().padStart(2, '0');
  const monthToday = new Date().toLocaleDateString('en-US', option).toString().toUpperCase(0);
  const yearToday = new Date().getFullYear();

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString();
  };

  return (
    <div className='navbar'>
      <img src={beLogo} className='be-logo' alt='BE Logo' />
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