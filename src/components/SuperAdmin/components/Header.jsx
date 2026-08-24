import React, { useState, useRef, useEffect } from 'react';
import { Search, ShieldCheck, Menu, Megaphone, LogOut, ArrowLeft } from 'lucide-react';

export default function Header({ 
  username, 
  activeView, 
  searchQuery, 
  setSearchQuery, 
  onToggleMobileMenu,
  onOpenBroadcast,
  onLogout,
  logoUrl
}) {
  const [logoErr, setLogoErr] = useState(false);
  let cachedLogo = '';
  try { cachedLogo = localStorage.getItem('touchqr_platform_logo_url') || ''; } catch {}
  const effectiveLogo = logoUrl || cachedLogo || '/api/r2-proxy/superadmin/branding/logo.webp';
  const resolvedLogoUrl = effectiveLogo ? (effectiveLogo.startsWith('http') || effectiveLogo.startsWith('/') ? effectiveLogo : `/${effectiveLogo}`) : '';
  const [mobileSearchActive, setMobileSearchActive] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (mobileSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [mobileSearchActive]);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const shortTitles = {
    overview: 'Overview',
    tenants: 'Shops',
    billing: 'Billing',
    plans: 'Plans',
    operations: 'Operations',
    activity: 'Activity',
    settings: 'Settings',
    communication: 'Broadcast',
  };

  const placeholders = {
    overview: 'Search shop or slug...',
    tenants: 'Search shop, slug, phone...',
    billing: 'Search subscriptions...',
    plans: 'Search plan tier...',
    operations: 'Filter system operations...',
    activity: 'Search audit logs...',
    settings: 'Search settings...',
    communication: 'Search broadcast notices...',
  };

  const currentTitle = shortTitles[activeView] || 'Dashboard';
  const currentPlaceholder = placeholders[activeView] || 'Search shop...';

  return (
    <header className={`sa-header ${mobileSearchActive ? 'mobile-search-active' : ''}`}>
      {/* MOBILE FULL-WIDTH EXPANDED SEARCH BAR */}
      {mobileSearchActive ? (
        <div className="sa-mobile-search-bar">
          <button 
            type="button" 
            onClick={() => { setMobileSearchActive(false); setSearchQuery(''); }}
            className="sa-mobile-search-back-btn"
            title="Close search"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="sa-mobile-search-input-wrap">
            <Search size={14} className="sa-mobile-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={currentPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sa-mobile-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="sa-mobile-search-clear-btn"
                title="Clear query"
              >
                ✕
              </button>
            )}
          </div>
          <button 
            type="button" 
            onClick={() => setMobileSearchActive(false)}
            className="sa-mobile-search-cancel-btn"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          {/* LEFT: Brand Logo Thumbnail & Page Title */}
          <div className="sa-header-left">
            {/* Mobile / Tablet Logo Thumbnail */}
            {resolvedLogoUrl && !logoErr && (
              <img
                src={resolvedLogoUrl}
                alt="TouchQR"
                onError={() => setLogoErr(true)}
                className="sa-mobile-only"
                style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  objectFit: 'contain', background: '#FFFFFF', padding: '1px',
                  border: '1px solid #D4AF37', flexShrink: 0
                }}
              />
            )}
            <div className="sa-header-title-box">
              <span className="sa-desktop-breadcrumb">Super Admin /</span>
              <h1 className="sa-header-title">
                <span className="sa-mobile-only" style={{ color: 'var(--sa-text-main)', fontWeight: 900, fontSize: '0.96rem' }}>TouchQR</span>
                <span className="sa-desktop-only">{currentTitle}</span>
              </h1>
            </div>
          </div>

          {/* CENTER: Desktop Search Bar (Hidden on Mobile) */}
          <div className="sa-header-search-container sa-desktop-only-search">
            <Search size={13} className="sa-header-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tenants, owners, emails, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sa-header-search-input"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="sa-header-search-clear"
                title="Clear search"
              >
                ✕
              </button>
            ) : (
              <span className="sa-search-shortcut-hint">Ctrl K</span>
            )}
          </div>

          {/* RIGHT: System Status, Broadcast, Notification & Profile */}
          <div className="sa-header-right">
            {/* Mobile Search Trigger Icon Button */}
            <button
              type="button"
              onClick={() => setMobileSearchActive(true)}
              className="sa-mobile-search-trigger-btn"
              title="Search"
            >
              <Search size={16} />
              {searchQuery && <span className="sa-search-dot-indicator" />}
            </button>

            {/* All Systems Operational Badge (Desktop/Tablet) */}
            <div className="sa-ssl-badge sa-desktop-only-ssl" title="Neon DB, Cashfree & APIs Operational">
              <span className="sa-live-dot active" />
              <span className="sa-ssl-text" style={{ color: '#15803D' }}>All Systems Operational</span>
            </div>

            {onOpenBroadcast && (
              <button
                onClick={onOpenBroadcast}
                className="sa-quick-broadcast-btn"
                title="Broadcast announcement"
              >
                <Megaphone size={13} />
                <span className="sa-header-btn-label">Broadcast</span>
              </button>
            )}

            {/* Notification Bell with Badge (Desktop) */}
            <div className="sa-desktop-only-ssl" style={{ position: 'relative', cursor: 'pointer', padding: '4px' }} title="1 Active Notice">
              <span style={{ fontSize: '0.9rem' }}>🔔</span>
              <span style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', background: '#EF4444', borderRadius: '50%' }} />
            </div>

            {/* Profile Avatar & Quick Logout */}
            <div className="sa-header-profile">
              <div className="sa-profile-avatar" title={`Logged in as ${username || 'Super Admin'}`}>
                {username ? username.charAt(0).toUpperCase() : 'S'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span className="sa-profile-name" style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                  {username || 'Super Admin'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                  superadmin
                </span>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="sa-header-logout-btn"
                  title="Logout from Super Admin"
                  style={{ marginLeft: '4px' }}
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
