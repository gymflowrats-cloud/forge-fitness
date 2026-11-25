import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { restoreLook, setTheme } from './lib/theme';
import { handleAuthRedirect } from './services/googleHealth';
import { captureInstallPrompt } from './lib/install';

// Returning from Google sign-in? Store the token and clean the URL before the router reads it.
handleAuthRedirect();

setTheme('system');
restoreLook();
captureInstallPrompt();

// Ask iOS/Chrome to keep our IndexedDB around (best effort).
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((p) => (p ? null : navigator.storage.persist())).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
