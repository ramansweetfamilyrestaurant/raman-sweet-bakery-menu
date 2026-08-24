import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught React Error caught by ErrorBoundary:', error, errorInfo);
    const errStr = String(error || '');
    if (
      errStr.includes('dynamically imported module') ||
      errStr.includes('Failed to fetch') ||
      errStr.includes('chunk') ||
      errStr.includes('Importing a module script failed')
    ) {
      const alreadyReloaded = sessionStorage.getItem('auto_chunk_reload');
      if (!alreadyReloaded) {
        sessionStorage.setItem('auto_chunk_reload', 'true');
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          background: '#0A2315',
          color: '#FFFFFF',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '10px', color: '#D4AF37' }}>
            TouchQR Platform
          </h2>
          <p style={{ fontSize: '0.88rem', marginBottom: '10px', color: '#E2E8F0' }}>
            New version updated. Please tap below to load the latest dashboard.
          </p>
          {this.state.error && (
            <pre style={{ fontSize: '0.72rem', color: '#FCA5A5', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '8px', marginBottom: '20px', maxWidth: '90%', overflowX: 'auto' }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={async () => {
              try {
                sessionStorage.removeItem('auto_chunk_reload');
                sessionStorage.removeItem('retry-chunk-refresh');
                if ('caches' in window) {
                  const names = await caches.keys();
                  await Promise.all(names.map((name) => caches.delete(name)));
                }
              } catch {}
              window.location.href = window.location.pathname + (window.location.search ? window.location.search + '&' : '?') + 't=' + Date.now();
            }}
            style={{
              background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)',
              color: '#0A2315',
              padding: '12px 24px',
              borderRadius: '9999px',
              border: 'none',
              fontWeight: 900,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(223,186,103,0.4)'
            }}
          >
            🔄 Refresh & Load Updated Version
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
