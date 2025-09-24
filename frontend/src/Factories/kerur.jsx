import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import '../App.css';

const KerurFactory = () => {
  const navigate = useNavigate();
  const { user, canAccessFactoryDepartment } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);

  // Static departments for Kerur factory with hardcoded navigation (only existing departments)
  const kerurDepartments = [
    { key: 'kr_store', name: 'Store', route: '/kerur/kr_store' },
    { key: 'kr_humanresource', name: 'Human Resource', route: '/kerur/kr_humanresource' },
    { key: 'kr_operations', name: 'Operations', route: '/kerur/kr_operations' }
  ];

  // Filter departments based on user permissions
  const getAccessibleDepartments = () => {
    if (!user) return [];
    
    if (isAdmin) {
      return kerurDepartments;
    }
    
    return kerurDepartments.filter(dept => {
      // Use the full prefixed department key (kr_store, kr_humanresource, etc.)
      return canAccessFactoryDepartment('kerur', dept.key);
    });
  };

  const accessibleDepartments = getAccessibleDepartments();

  // Handle department navigation
  const handleDepartmentNavigation = (department) => {
    navigate(department.route);
  };

  if (!user) {
    return <div>Please log in to access department services.</div>;
  }

  if (accessibleDepartments.length === 0) {
    return (
      <div className="splash-page">
        <h1>No Department Access</h1>
        <p>You don't have access to any departments. Please contact your administrator.</p>
        <div style={{ 
          color: '#ff6b6b', 
          fontSize: '14px', 
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#fff5f5',
          borderRadius: '5px',
          border: '1px solid #ff6b6b'
        }}>
          ⚠️ <strong>No Permissions Assigned</strong><br/>
          You currently don't have any permissions assigned. Please contact your administrator to get access to departments and services.
        </div>
        <button onClick={() => navigate('/app')} className="nav-link" style={{ marginTop: '15px' }}>
          Back to Main Menu
        </button>
      </div>
    );
  }

  return (
    <div className="splash-page">
      {process.env.NODE_ENV === 'development' && (
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
          <strong>Debug Info:</strong><br/>
          Factory: Kerur<br/>
          User Role: {user?.role}<br/>
          User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
          Accessible Departments: {JSON.stringify(accessibleDepartments.map(d => d.key))}
        </div>
      )}
      
      <h2>Available Departments - Kerur</h2>
      <h3>Select a department to access its services:</h3>
      
      {/* Department Navigation Buttons */}
      <div className="navigation-links">
        {accessibleDepartments.map(dept => (
          <span 
            key={dept.key}
            onClick={() => handleDepartmentNavigation(dept)} 
            className="nav-link"
            role="button"
            tabIndex={0}
          >
            {dept.name}
          </span>
        ))}
      </div>
      
      {/* Back to Main Menu Button - Bottom Left */}
      <div className="back-button-container">
        <button onClick={() => navigate('/app')} className="nav-link back-button">
          ← Back to Main Menu
        </button>
      </div>
    </div>
  );
};

export default KerurFactory;
