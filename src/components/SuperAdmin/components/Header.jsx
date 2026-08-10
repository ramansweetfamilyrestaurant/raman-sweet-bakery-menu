import React from 'react';
import { Search, ShieldCheck } from 'lucide-react';

export default function Header({ username, activeView, searchQuery, setSearchQuery, logoUrl }) {
  const shortTitles = {
    overview: 'Overview',
    tenants: 'Tenants',
    subscriptions: 'Subscriptions',
    plans: 'Plans',
    audit: 'Audit Logs',
    communication: 'Broadcast',
    settings: 'Settings',
    profile: 'Profile'
  };

  const placeholders = {
    overview: 'Search tenant...',
    tenants: 'Search restaurant or slug...',
    subscriptions: 'Search tenant or sub...',
    plans: 'Search plan...',
    audit: 'Search logs...',
    communication: 'Search notices...',
    settings: 'Search settings...',
    profile: 'Search...'
  };

  const currentTitle = shortTitles[activeView] || 'Dashboard';
  const currentPlaceholder = placeholders[activeView] || 'Search tenant...';

  return (
    <header className="sa-header">
      {/* LEFT: Page Title & Context */}
      <div className="sa-header-left">
        <div className="sa-header-title-box">
          <span className="sa-desktop-breadcrumb">TouchQR /</span>
          <h1 className="sa-header-title">{currentTitle}</h1>
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

      {/* RIGHT: SSL Pill & Profile Avatar */}
      <div className="sa-header-right">
        {/* Compact SSL Status Badge */}
        <div className="sa-ssl-pill" title="256-Bit SSL Encrypted Connection">
          <ShieldCheck size={14} className="sa-ssl-icon" />
          <div className="sa-ssl-text-box">
            <span className="sa-ssl-text-top">SSL</span>
            <span className="sa-ssl-text-bottom">SECURE</span>
          </div>
        </div>

        {/* Profile Avatar */}
        <div className="sa-header-profile">
          <div className="sa-profile-avatar" style={{ overflow: 'hidden' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Super Admin Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#FFF' }} />
            ) : (
              username ? username.charAt(0).toUpperCase() : 'S'
            )}
          </div>
          <span className="sa-profile-name">
            {username || 'Super Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}
