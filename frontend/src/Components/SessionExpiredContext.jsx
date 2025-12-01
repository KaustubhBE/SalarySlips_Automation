import React, { createContext, useContext, useState, useCallback } from 'react';
import { resetSessionExpiredFlag } from '../config';

const SessionExpiredContext = createContext(null);

export const SessionExpiredProvider = ({ children }) => {
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const showSessionExpired = useCallback(() => {
    setIsSessionExpired(true);
  }, []);

  const hideSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
    resetSessionExpiredFlag();
  }, []);

  const contextValue = React.useMemo(() => ({
    isSessionExpired,
    showSessionExpired,
    hideSessionExpired,
  }), [isSessionExpired, showSessionExpired, hideSessionExpired]);

  return (
    <SessionExpiredContext.Provider value={contextValue}>
      {children}
    </SessionExpiredContext.Provider>
  );
};

export const useSessionExpired = () => {
  const context = useContext(SessionExpiredContext);
  if (!context) {
    throw new Error('useSessionExpired must be used within a SessionExpiredProvider');
  }
  return context;
};

