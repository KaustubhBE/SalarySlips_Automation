import React from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    maxWidth: '600px',
    margin: '100px auto',
    padding: '30px',
    textAlign: 'center',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
  },
  heading: {
    color: '#dc2626',
    marginBottom: '20px'
  },
  text: {
    color: '#4b5563',
    marginBottom: '30px'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s'
  },
  buttonHover: {
    '&:hover': {
      backgroundColor: '#2563eb'
    }
  }
};

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Access Denied</h1>
      <p style={styles.text}>You don't have permission to access this page.</p>
      <button 
        style={{ ...styles.button, ...styles.buttonHover }}
        onClick={() => navigate('/')}
        onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
      >
        Return to Home
      </button>
    </div>
  );
};

export default Unauthorized; 