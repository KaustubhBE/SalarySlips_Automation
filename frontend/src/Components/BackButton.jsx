import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({ 
  label = 'Back', 
  to, 
  onClick, 
  className = '',
  containerClassName = '',
  position = 'top-left' // 'top-left' (default) or 'custom'
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      // Default: go back in history
      navigate(-1);
    }
  };

  const buttonStyles = {
    background: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit'
  };

  const handleMouseOver = (e) => {
    e.target.style.background = '#5a6268';
    e.target.style.transform = 'translateY(-1px)';
  };

  const handleMouseOut = (e) => {
    e.target.style.background = '#6c757d';
    e.target.style.transform = 'translateY(0)';
  };

  const button = (
    <button
      onClick={handleClick}
      style={buttonStyles}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      className={className}
    >
      ← {label}
    </button>
  );

  // Default top-left wrapper styling (matches KR_MaterialInward.jsx)
  const topLeftWrapperStyle = {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '10px 0',
    borderBottom: '1px solid #e0e0e0'
  };

  // If custom position is requested or containerClassName is provided, use custom wrapper
  if (position === 'custom' || containerClassName) {
    if (containerClassName) {
      return (
        <div className={containerClassName}>
          {button}
        </div>
      );
    }
    return button;
  }

  // Default: Always wrap in top-left positioned container
  return (
    <div style={topLeftWrapperStyle}>
      {button}
    </div>
  );
};

export default BackButton;
