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
            Digital Restaurant Menu
          </h2>
          <p style={{ fontSize: '0.88rem', marginBottom: '10px', color: '#E2E8F0' }}>
            Temporary display glitch resolved. Please tap below to refresh menu.
          </p>
          {this.state.error && (
            <pre style={{ fontSize: '0.72rem', color: '#FCA5A5', background: 'rgba(0,0,0,0.5)', padding: '8px 12px', borderRadius: '8px', marginBottom: '20px', maxWidth: '90%', overflowX: 'auto' }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={() => {
              localStorage.removeItem('raman_admin_token');
              localStorage.removeItem('raman_admin_user');
              window.location.href = '/';
            }}
            style={{
              background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)',
              color: '#0A2315',
              padding: '12px 28px',
              borderRadius: '9999px',
              fontWeight: 800,
              fontSize: '0.9rem',
              border: '1.5px solid #FFFFFF',
              boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh Digital Menu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
