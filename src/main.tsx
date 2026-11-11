import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { PlaceSharePage } from '@/components/place-share';
import { sharedPlaceIdFromUrl } from '@/share';
import { setTheme, initialTheme } from '@/theme';
import './index.css';

setTheme(initialTheme(), false);

const sharedPlaceId = sharedPlaceIdFromUrl();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {sharedPlaceId ? <PlaceSharePage placeId={sharedPlaceId} /> : <App />}
  </React.StrictMode>,
);
