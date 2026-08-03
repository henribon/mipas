import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { setTheme, initialTheme } from '@/theme';
import './index.css';

setTheme(initialTheme());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
