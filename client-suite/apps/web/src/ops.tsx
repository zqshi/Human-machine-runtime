import React from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapApp } from './application/bootstrap';
import { OpsApp } from './presentation/layouts/OpsShell';
import './styles.css';

bootstrapApp();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OpsApp />
  </React.StrictMode>
);
