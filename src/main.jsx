import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/theme.css';

// Automatically handle chunk updates when a new version is deployed
// Do NOT call event.preventDefault() here: doing so makes Vite's __vitePreload resolve to undefined,
// which triggers TypeError: Cannot read properties of undefined (reading 'default') inside React.lazy.
window.addEventListener('vite:preloadError', () => {
  try {
    const lastReload = parseInt(window.sessionStorage?.getItem('last-chunk-reload') || '0', 10);
    const now = Date.now();
    if (now - lastReload > 8000) {
      window.sessionStorage?.setItem('last-chunk-reload', String(now));
      window.location.reload();
    }
  } catch { }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
