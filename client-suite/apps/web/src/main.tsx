import React from 'react';
import { createRoot } from 'react-dom/client';
import { bootstrapApp } from './application/bootstrap';
import App from './App';
import './styles.css';

bootstrapApp();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
