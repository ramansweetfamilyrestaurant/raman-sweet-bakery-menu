import React from 'react';

export default function LegalFooter({ onOpenLogin, onStartTrial }) {
  const navigateRoute = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartTrial = () => {
    if (onStartTrial) {
      onStartTrial();
    } else {
      navigateRoute('/register');
    }
  };

  return (
    <footer className="km-legal-footer">
      <div className="km-legal-footer-container">
        <div className="km-legal-footer-grid">
          {/* Brand Col */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }} onClick={() => navigateRoute('/')}>
              <span style={{ fontSize: '1.2rem' }}>🍱</span>
              <strong style={{ color: '#FFF', fontSize: '1.1rem', fontWeight: 900 }}>TouchQR SaaS</strong>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.5, margin: 0 }}>
              India’s Premier Smart Digital Menu, Live Kitchen KOT, and Restaurant Management SaaS Platform.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="km-legal-footer-title">Product</h4>
            <ul className="km-legal-footer-links">
              <li><a onClick={() => navigateRoute('/')}>Home Page</a></li>
              <li><a onClick={() => navigateRoute('/#pricing')}>Pricing Plans</a></li>
              <li><a onClick={() => navigateRoute('/#faq')}>FAQ</a></li>
              <li><a onClick={() => navigateRoute('/security')}>Security & Data Protection</a></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="km-legal-footer-title">Legal Policies</h4>
            <ul className="km-legal-footer-links">
              <li><a onClick={() => navigateRoute('/privacy-policy')}>Privacy Policy</a></li>
              <li><a onClick={() => navigateRoute('/terms')}>Terms of Service</a></li>
              <li><a onClick={() => navigateRoute('/refund-policy')}>Refund & Cancellation</a></li>
              <li><a onClick={() => navigateRoute('/contact')}>Contact Support</a></li>
            </ul>
          </div>

          {/* Owner Actions */}
          <div>
            <h4 className="km-legal-footer-title">Restaurant Owners</h4>
            <ul className="km-legal-footer-links">
              <li><a onClick={onOpenLogin || (() => navigateRoute('/admin'))}>🔑 Owner Login</a></li>
              <li><a onClick={handleStartTrial}>🚀 Start 16-Day Free Trial</a></li>
              <li><a onClick={() => navigateRoute('/register')}>Create Account</a></li>
            </ul>
          </div>
        </div>

        <div className="km-legal-footer-bottom">
          <div>
            © {new Date().getFullYear()} TouchQR SaaS. All rights reserved. Built for Indian Restaurant Growth.
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <a onClick={() => navigateRoute('/privacy-policy')} style={{ color: '#94A3B8', textDecoration: 'none' }}>Privacy</a>
            <span>•</span>
            <a onClick={() => navigateRoute('/terms')} style={{ color: '#94A3B8', textDecoration: 'none' }}>Terms</a>
            <span>•</span>
            <a onClick={() => navigateRoute('/security')} style={{ color: '#94A3B8', textDecoration: 'none' }}>Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
