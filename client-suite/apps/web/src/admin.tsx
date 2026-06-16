import React from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapApp } from './application/bootstrap';
import { AdminApp } from './presentation/layouts/AdminShell';
import './styles.css';

bootstrapApp();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
