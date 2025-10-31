import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthContext';
import '../App.css';
import BackButton from '../Components/BackButton';

const GulbargaFactory = () => {
  const navigate = useNavigate();
  const { user, canAccessFactoryDepartment } = useAuth();
  
  // Function to check if user is admin (role or wildcard permission)
  const isAdmin = (user?.role || '').toString().toLowerCase() === 'admin' || (user?.permissions && user.permissions['*'] === true);

  // Static departments for Gulbarga factory with hardcoded navigation (only existing departments)
  const gulbargaDepartments = [
    { key: 'gb_store', name: 'Store', route: '/gulbarga/gb_store' },
    { key: 'gb_humanresource', name: 'Human Resource', route: '/gulbarga/gb_humanresource' },
    { key: 'gb_operations', name: 'Operations', route: '/gulbarga/gb_operations' }
  ];

  // Filter departments based on user permissions
  const getAccessibleDepartments = () => {
    if (!user) return [];
    
    if (isAdmin) {
      return gulbargaDepartments;
    }
    
    return gulbargaDepartments.filter(dept => {
      // Use the full prefixed department key (gb_store, gb_humanresource, etc.)
      console.log(`Gulbarga factory checking department:`, {
        dept: dept,
        deptKey: dept.key,
        factory: 'gulbarga',
        user: user
      });
      
      // Check if dept.key is undefined
      if (!dept || !dept.key) {
        console.error('Gulbarga factory: dept or dept.key is undefined:', dept);
        return false;
      }
      
      const hasAccess = canAccessFactoryDepartment('gulbarga', dept.key);
      console.log(`Gulbarga factory department access result:`, hasAccess);
      return hasAccess;
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
      <div>
        <BackButton 
          label="Back to Main Menu" 
          to="/app"
        />
        
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
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackButton 
        label="Back to Main Menu" 
        to="/app"
      />
      
      <div className="splash-page">
        {process.env.NODE_ENV === 'development' && (
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
            <strong>Debug Info:</strong><br/>
            Factory: Gulbarga<br/>
            User Role: {user?.role}<br/>
            User Permission Metadata: {JSON.stringify(user?.permission_metadata || {})}<br/>
            Accessible Departments: {JSON.stringify(accessibleDepartments.map(d => d.key))}
          </div>
        )}
        
        <h2>Available Departments - Gulbarga</h2>
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
      </div>
    </div>
  );
};

export default GulbargaFactory;
