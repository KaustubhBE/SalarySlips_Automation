import React from 'react';

const LoadingSpinner = () => {
  const spinnerStyles = {
    loadingSpinner: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 999,
    },
    spinner: {
      border: '8px solid #e6cfb8',
      borderTop: '8px solid #987349',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      animation: 'spin 1s linear infinite',
    },
  };

  const keyframes = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <div style={spinnerStyles.loadingSpinner}>
      <style>{keyframes}</style>
      <div style={spinnerStyles.spinner}></div>
    </div>
  );
};

export default LoadingSpinner;