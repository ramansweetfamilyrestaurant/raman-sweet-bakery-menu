import React from 'react';
import { ArrowLeft, UserCheck, ShieldCheck } from 'lucide-react';

export default function LegalHeader({ onOpenLogin }) {
  const navigateRoute = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLanding = () => {
    navigateRoute('/');
  };

  return (
    <header className="km-legal-header">
      <div className="km-legal-header-container">
        <div className="km-legal-brand" onClick={handleBackToLanding}>
          <span className="km-legal-logo-icon">🍱</span>
          <span className="km-legal-logo-text">KhanaMaster</span>
          <span className="km-legal-logo-badge">SaaS</span>
        </div>

        <ul className="km-legal-nav-links">
          <li><a className="km-legal-nav-link" onClick={() => navigateRoute('/')}>Home</a></li>
          <li><a className="km-legal-nav-link" onClick={() => navigateRoute('/security')}>Security</a></li>
          <li><a className="km-legal-nav-link" onClick={() => navigateRoute('/contact')}>Support</a></li>
          <li>
            <button className="km-legal-back-btn" onClick={onOpenLogin || (() => navigateRoute('/admin'))}>
              <UserCheck size={14} /> Owner Login
            </button>
          </li>
        </ul>

        <button className="km-legal-back-btn" onClick={handleBackToLanding}>
          <ArrowLeft size={14} /> <span style={{ fontSize: '0.8rem' }}>Back to Home</span>
        </button>
      </div>
    </header>
  );
}
