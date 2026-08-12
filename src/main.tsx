import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { setTheme, initialTheme } from '@/theme';
import './index.css';

// Sem persistir: aplicar o padrão não é escolha de ninguém.
setTheme(initialTheme(), false);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
