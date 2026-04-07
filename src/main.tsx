import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { migrateLocalStorageKeys } from '@/services/MigrationService';

// Run key migration before anything else so existing users keep their data.
migrateLocalStorageKeys();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
