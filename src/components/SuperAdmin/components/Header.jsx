import React from 'react';
import { Search, ShieldCheck, Menu, Megaphone, LogOut } from 'lucide-react';

export default function Header({ 
  username, 
  activeView, 
  searchQuery, 
  setSearchQuery, 
  onToggleMobileMenu,
  onOpenBroadcast,
  onLogout 
}) {
  const shortTitles = {
    overview: 'Overview',
    tenants: 'Tenants Directory',
    billing: 'Billing & Subscriptions',
    plans: 'SaaS Plans & Tiers',
    operations: 'System Operations & DB Health',
    activity: 'Platform Audit Logs',
    settings: 'System Configuration',
    communication: 'Broadcast Notices',
  };

  const placeholders = {
    overview: 'Search tenant or slug...',
    tenants: 'Search restaurant, slug, phone...',
    billing: 'Search subscriptions...',
    plans: 'Search plan tier...',
    operations: 'Filter system operations...',
    activity: 'Search audit logs...',
    settings: 'Search settings...',
    communication: 'Search broadcast notices...',
  };

  const currentTitle = shortTitles[activeView] || 'Dashboard';
  const currentPlaceholder = placeholders[activeView] || 'Search tenant...';

  return (
    <header className="sa-header">
      {/* LEFT: Mobile Toggle & Page Title */}
      <div className="sa-header-left">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="sa-mobile-menu-btn"
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              marginRight: '6px',
              cursor: 'pointer',
              color: 'var(--sa-text-main)',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="sa-header-title-box">
          <span className="sa-desktop-breadcrumb" style={{ color: 'var(--sa-text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>TouchQR /</span>
          <h1 className="sa-header-title" style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* CENTER: Flex Search Field */}
      <div className="sa-header-search-container">
        <Search size={14} className="sa-header-search-icon" />
        <input
          type="text"
          placeholder={currentPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sa-header-search-input"
        />
      </div>

      {/* RIGHT: Quick Broadcast, SSL Pill & Profile Avatar */}
      <div className="sa-header-right">
        {onOpenBroadcast && (
          <button
            onClick={onOpenBroadcast}
            style={{
              background: 'rgba(212, 175, 55, 0.12)',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              color: 'var(--sa-accent-hover, #B48F27)',
              padding: '5px 9px',
              borderRadius: 'var(--sa-radius-full)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 800
            }}
            title="Broadcast global announcement notice to all tenant panels"
          >
            <Megaphone size={13} />
            <span className="sa-header-btn-label">Notice</span>
          </button>
        )}

        {/* Compact SSL Status Badge */}
        <div className="sa-ssl-pill" title="256-Bit SSL Encrypted Connection">
          <ShieldCheck size={14} className="sa-ssl-icon" />
          <div className="sa-ssl-text-box">
            <span className="sa-ssl-text-top">SSL</span>
            <span className="sa-ssl-text-bottom">SECURE</span>
          </div>
        </div>

        {/* Profile Avatar & Quick Logout */}
        <div className="sa-header-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="sa-profile-avatar" title={`Logged in as ${username || 'Super Admin'}`}>
            {username ? username.charAt(0).toUpperCase() : 'S'}
          </div>
          <span className="sa-profile-name" style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
            {username || 'Super Admin'}
          </span>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#EF4444',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Logout from Super Admin"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
