import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './Components/AuthContext';
import { SessionExpiredProvider } from './Components/SessionExpiredContext';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SessionExpiredProvider>
          <App />
        </SessionExpiredProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>
);