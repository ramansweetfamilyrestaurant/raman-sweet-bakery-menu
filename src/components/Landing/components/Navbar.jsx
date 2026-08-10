import React, { useState } from 'react';
import { Menu, X, ArrowRight, UserCheck } from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function Navbar({ onOpenLogin, onStartTrial, logoUrl }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  React.useEffect(() => {
    setLogoErr(false);
  }, [logoUrl]);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="km-navbar">
      <div className="km-container km-navbar-container">
        <div className="km-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          {logoUrl && !logoErr ? (
            <img src={resolveImageUrl(logoUrl)} alt="TouchQR Logo" referrerPolicy="no-referrer" onError={() => setLogoErr(true)} style={{ width: '30px', height: '30px', borderRadius: '8px', objectFit: 'contain', background: '#FFF', padding: '2px', flexShrink: 0 }} />
          ) : (
            <div className="km-logo-icon">🍱</div>
          )}
          <span className="km-logo-text">TouchQR</span>
          <span className="km-logo-tag">SaaS</span>
        </div>

        {/* Desktop Links */}
        <ul className="km-nav-links">
          <li><span className="km-nav-link" onClick={() => scrollToSection('features')}>Features</span></li>
          <li><span className="km-nav-link" onClick={() => scrollToSection('how-it-works')}>How It Works</span></li>
          <li><span className="km-nav-link" onClick={() => scrollToSection('pricing')}>Pricing</span></li>
          <li><span className="km-nav-link" onClick={() => scrollToSection('faq')}>FAQ</span></li>
        </ul>

        {/* Desktop Actions */}
        <div className="km-nav-actions">
          <button 
            className="km-btn-secondary"
            onClick={onOpenLogin}
            style={{ padding: '8px 18px', fontSize: '0.86rem', minHeight: '40px' }}
          >
            <UserCheck size={16} /> Owner Login
          </button>

          <button 
            className="km-btn-primary km-nav-btn-trial"
            onClick={onStartTrial}
          >
            Start Free Trial <ArrowRight size={14} />
          </button>

          <button 
            className="km-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`km-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <span className="km-nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Home</span>
        <span className="km-nav-link" onClick={() => scrollToSection('features')}>Features</span>
        <span className="km-nav-link" onClick={() => scrollToSection('how-it-works')}>How It Works</span>
        <span className="km-nav-link" onClick={() => scrollToSection('pricing')}>Pricing</span>
        <span className="km-nav-link" onClick={() => scrollToSection('faq')}>FAQ</span>
        <hr style={{ border: 'none', borderTop: '1px solid var(--km-border)', margin: '8px 0' }} />
        <button className="km-btn-secondary" onClick={() => { setMobileMenuOpen(false); onOpenLogin(); }}>
          <UserCheck size={16} /> Owner Login
        </button>
        <button className="km-btn-primary" onClick={() => { setMobileMenuOpen(false); onStartTrial(); }}>
          Start Free Trial <ArrowRight size={16} />
        </button>
      </div>
    </nav>
  );
}
