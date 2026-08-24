import React, { useState, useRef, useEffect } from 'react';
import { Search, ShieldCheck, Menu, Megaphone, LogOut, ArrowLeft } from 'lucide-react';

export default function Header({ 
  username, 
  activeView, 
  searchQuery, 
  setSearchQuery, 
  onToggleMobileMenu,
  onOpenBroadcast,
  onLogout 
}) {
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
    tenants: 'Shops Directory',
    billing: 'Billing & Subscriptions',
    plans: 'SaaS Plans & Tiers',
    operations: 'System Operations & DB Health',
    activity: 'Platform Audit Logs',
    settings: 'System Configuration',
    communication: 'Broadcast Notices',
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
          {/* LEFT: Mobile Toggle & Page Title */}
          <div className="sa-header-left">
            {onToggleMobileMenu && (
              <button
                onClick={onToggleMobileMenu}
                className="sa-mobile-menu-btn"
                title="Open Navigation Menu"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="sa-header-title-box">
              <span className="sa-desktop-breadcrumb">TouchQR /</span>
              <h1 className="sa-header-title">
                {currentTitle}
              </h1>
            </div>
          </div>

          {/* CENTER: Desktop Search Bar (Hidden on Mobile) */}
          <div className="sa-header-search-container sa-desktop-only-search">
            <Search size={13} className="sa-header-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={currentPlaceholder}
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

          {/* RIGHT: Quick Broadcast, SSL Pill, Mobile Search Trigger & Profile */}
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

            {onOpenBroadcast && (
              <button
                onClick={onOpenBroadcast}
                className="sa-quick-broadcast-btn"
                title="Broadcast global announcement notice to all shop panels"
              >
                <Megaphone size={13} />
                <span className="sa-header-btn-label">Notice</span>
              </button>
            )}

            {/* Sleek Minimalist SSL Status Badge (Desktop/Tablet Only) */}
            <div className="sa-ssl-badge sa-desktop-only-ssl" title="256-Bit SSL Encrypted & Verified Connection">
              <span className="sa-live-dot active" />
              <ShieldCheck size={13} color="#16A34A" />
              <span className="sa-ssl-text">SSL SECURE</span>
            </div>

            {/* Profile Avatar & Quick Logout */}
            <div className="sa-header-profile">
              <div className="sa-profile-avatar" title={`Logged in as ${username || 'Super Admin'}`}>
                {username ? username.charAt(0).toUpperCase() : 'S'}
              </div>
              <span className="sa-profile-name">
                {username || 'Super Admin'}
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="sa-header-logout-btn"
                  title="Logout from Super Admin"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
