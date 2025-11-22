import React from 'react';

/**
 * FormValidationErrors Component
 * 
 * A reusable component for displaying form validation errors in a consistent style.
 * Matches the error display pattern used in Settings.jsx
 * 
 * @param {Object} props
 * @param {string[]} props.errors - Array of error messages to display
 * @param {string} [props.title] - Optional title/header text (default: "Please fix the following errors:")
 * @param {string} [props.icon] - Optional icon to display (default: "⚠️")
 * @param {Object} [props.style] - Optional additional inline styles
 * @param {string} [props.className] - Optional additional CSS class names
 */
const FormValidationErrors = ({ 
  errors = [], 
  title = "Please fix the following errors:",
  icon = "⚠️",
  style = {},
  className = ""
}) => {
  // Don't render if there are no errors
  if (!errors || errors.length === 0) {
    return null;
  }

  const defaultStyle = {
    marginBottom: '20px',
    padding: '12px 16px',
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#c62828',
    ...style
  };

  return (
    <div style={defaultStyle} className={className}>
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
      }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span>{title}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: '24px' }}>
        {errors.map((error, index) => (
          <li key={index} style={{ marginBottom: '4px' }}>
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FormValidationErrors;

