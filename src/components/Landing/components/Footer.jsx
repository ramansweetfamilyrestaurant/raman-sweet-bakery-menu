import React from 'react';

export default function Footer({ logoUrl, onOpenLogin, onStartTrial }) {
  const [logoErr, setLogoErr] = React.useState(false);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navigateRoute = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="km-footer">
      <div className="km-container">
        <div className="km-footer-grid">
          {/* Brand Column */}
          <div className="km-footer-brand">
            <div className="km-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              {logoUrl && !logoErr ? (
                <img
                  src={logoUrl}
                  alt="TouchQR Logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoErr(true)}
                  style={{ width: '30px', height: '30px', borderRadius: '8px', objectFit: 'contain', background: '#FFF', padding: '2px', flexShrink: 0 }}
                />
              ) : (
                <div className="km-logo-icon">🍱</div>
              )}
              <span className="km-logo-text" style={{ color: '#FFF' }}>TouchQR</span>
              <span className="km-logo-tag">SaaS</span>
            </div>
            <p>
              India’s Premier Smart Digital Menu, Live Kitchen KOT, and Restaurant Management SaaS Platform.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="km-footer-title">Product</h4>
            <ul className="km-footer-links">
              <li><a onClick={() => scrollToSection('features')}>Digital QR Menu</a></li>
              <li><a onClick={() => scrollToSection('features')}>Live Kitchen KOT</a></li>
              <li><a onClick={() => scrollToSection('features')}>Smart Google Reviews</a></li>
              <li><a onClick={() => scrollToSection('features')}>Thermal Printing</a></li>
              <li><a onClick={() => scrollToSection('features')}>WhatsApp Integration</a></li>
            </ul>
          </div>

          {/* Restaurant Owners */}
          <div>
            <h4 className="km-footer-title">Restaurant Owners</h4>
            <ul className="km-footer-links">
              <li><a onClick={onOpenLogin}>Owner Login</a></li>
              <li><a onClick={onStartTrial}>Start Free Trial</a></li>
              <li><a onClick={() => scrollToSection('pricing')}>View SaaS Plans</a></li>
              <li><a onClick={() => scrollToSection('faq')}>FAQ</a></li>
            </ul>
          </div>

          {/* Legal & Security */}
          <div>
            <h4 className="km-footer-title">Legal & Security</h4>
            <ul className="km-footer-links">
              <li><a onClick={() => navigateRoute('/privacy-policy')}>Privacy Policy</a></li>
              <li><a onClick={() => navigateRoute('/terms')}>Terms of Service</a></li>
              <li><a onClick={() => navigateRoute('/refund-policy')}>Refund & Cancellation</a></li>
              <li><a onClick={() => navigateRoute('/security')}>Security & Data Protection</a></li>
              <li><a onClick={() => navigateRoute('/contact')}>Contact & Support</a></li>
            </ul>
          </div>
        </div>

        <div className="km-footer-bottom">
          <div>
            © {new Date().getFullYear()} TouchQR SaaS. All rights reserved. Built for Indian Restaurant Growth.
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <span onClick={onOpenLogin} style={{ cursor: 'pointer', color: '#D4AF37', fontWeight: 700 }}>
              🔑 Owner Login
            </span>
            <span>•</span>
            <span onClick={onStartTrial} style={{ cursor: 'pointer', color: '#D4AF37', fontWeight: 700 }}>
              🚀 Start Free Trial
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
