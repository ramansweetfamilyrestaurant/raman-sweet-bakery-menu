import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { tryReserveChunkReload } from './utils/chunkRecovery';
import './styles/theme.css';

// Automatically handle chunk updates when a new version is deployed.
// Do NOT call event.preventDefault() here: doing so makes Vite's __vitePreload resolve to undefined,
// which triggers TypeError: Cannot read properties of undefined (reading 'default') inside React.lazy.
window.addEventListener('vite:preloadError', () => {
  if (tryReserveChunkReload() && typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
    try {
      window.location.reload();
    } catch { }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
