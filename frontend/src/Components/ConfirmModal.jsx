import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  closeButton: {
    border: 'none',
    background: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: 1,
    color: '#b42318',
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
  detailsList: {
    border: '1px solid #e4e7ec',
    borderRadius: '8px',
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    color: '#475467',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  detailLabel: {
    fontWeight: 600,
    minWidth: '80px',
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
  },
  secondaryButton: {
    flex: 1,
    border: 'none',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#1d2939',
    backgroundColor: '#e4e7ec',
    cursor: 'pointer',
  },
};

const ConfirmModal = ({
  isOpen,
  onClose,
  title = 'Confirm Action',
  icon = '⚠️',
  message,
  details = [],
  warningText,
  primaryAction,
  secondaryAction,
  closeOnOverlayClick = true,
  children,
}) => {
  const [isClient, setIsClient] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);

  useEffect(() => {
    setIsClient(true);
    return () => setIsClient(false);
  }, []);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && closeOnOverlayClick && onClose) {
      onClose();
    }
  };

  const hasDetails = Array.isArray(details) && details.length > 0;
  const hasCustomContent = Boolean(children);

  const renderButton = ({ label, onClick, variant = 'primary', disabled = false, title: buttonTitle }, key) => {
    if (!label || typeof onClick !== 'function') {
      return null;
    }

    const buttonStyle = variant === 'secondary' ? styles.secondaryButton : styles.primaryButton;

    return (
      <button
        key={key}
        type="button"
        style={{ ...buttonStyle, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        onClick={onClick}
        disabled={disabled}
        title={buttonTitle || label}
      >
        {label}
      </button>
    );
  };

  const modalNode = (
    <div
      style={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>
            <span role="img" aria-hidden="true">{icon}</span>
            {title}
          </h3>
          {onClose && (
            <button
              type="button"
              style={{
                ...styles.closeButton,
                backgroundColor: closeHovered ? '#b42318' : '#d92d20',
                color: '#fff',
                borderRadius: '999px',
                width: '34px',
                height: '34px',
                padding: 0,
                lineHeight: '34px',
                transition: 'background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: closeHovered ? '0 6px 16px rgba(180, 35, 24, 0.35)' : '0 4px 10px rgba(217, 45, 32, 0.25)',
                transform: closeHovered ? 'scale(1.08)' : 'scale(1)',
              }}
              aria-label="Close modal"
              onClick={onClose}
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
            >
              ×
            </button>
          )}
        </div>

        <div style={styles.body}>
          <div style={styles.warningIcon} aria-hidden="true">
            {icon}
          </div>
          {message && <p style={styles.message}>{message}</p>}

          {hasDetails && (
            <div style={styles.detailsList}>
              {details.map((detail, index) => (
                <div key={index} style={styles.detailRow}>
                  <span style={styles.detailLabel}>{detail.label}</span>
                  <span style={{ flex: 1, wordBreak: 'break-word', minWidth: '120px' }}>
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {warningText && <div style={styles.warningText}>{warningText}</div>}
          {hasCustomContent && children}
        </div>

        <div style={styles.footer}>
          <div style={styles.buttonRow}>
            {secondaryAction && renderButton({ variant: 'secondary', ...secondaryAction }, 'secondary')}
            {primaryAction && renderButton({ variant: 'primary', ...primaryAction }, 'primary')}
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

export default ConfirmModal;

