import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    zIndex: 1000,
    boxSizing: 'border-box',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '14px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
    width: 'min(520px, calc(100vw - 24px))',
    maxWidth: '520px',
    maxHeight: 'calc(100vh - 24px)',
    overflow: 'hidden',
    animation: 'fadeInScale 0.2s ease-out',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  header: {
    backgroundColor: '#fef3f2',
    padding: '18px 24px',
    borderBottom: '1px solid #f3d4d0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '18px',
    fontWeight: 700,
    color: '#b42318',
    margin: 0,
  },
  body: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  warningIcon: {
    fontSize: '36px',
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
    color: '#1d2939',
  },
  warningText: {
    backgroundColor: '#fef3f2',
    border: '1px solid #fecdca',
    color: '#b42318',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
  },
  footer: {
    padding: '0 24px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    flex: 1,
    border: 'none',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#d92d20',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
  },
};

const SessionExpiredModal = ({ isOpen, onClose }) => {
  const [isClient, setIsClient] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    setIsClient(true);
    return () => setIsClient(false);
  }, []);

  if (!isOpen) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, navigate to login
      navigate('/login', { replace: true });
      if (onClose) {
        onClose();
      }
    }
  };

  const modalNode = (
    <div
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Session Expired"
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>
            <span role="img" aria-hidden="true">⚠️</span>
            Session Expired
          </h3>
        </div>

        <div style={styles.body}>
          <div style={styles.warningIcon} aria-hidden="true">
            ⚠️
          </div>
          <p style={styles.message}>
            Your session has expired due to inactivity. Please log in again to continue.
          </p>
          <div style={styles.warningText}>
            For security reasons, you need to authenticate again to access the system.
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.buttonRow}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={handleLogout}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#b91c1c';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#d92d20';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Logout & Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isClient && typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};

export default SessionExpiredModal;

