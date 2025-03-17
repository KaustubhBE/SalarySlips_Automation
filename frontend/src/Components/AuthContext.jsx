import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import storage from '../utils/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = useCallback((userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    storage.setJSON('user', userData);
    storage.set('isAuthenticated', 'true');
  }, []);

  const logout = useCallback(() => {
    storage.remove('user');
    storage.remove('isAuthenticated');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const userData = storage.getJSON('user');
        const isAuth = storage.get('isAuthenticated') === 'true';
        
        if (userData && isAuth) {
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [logout]);

  const contextValue = React.useMemo(() => ({
    user,
    isAuthenticated,
    login,
    logout
  }), [user, isAuthenticated, login, logout]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};