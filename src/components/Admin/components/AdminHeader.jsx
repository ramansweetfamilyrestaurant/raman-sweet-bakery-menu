import React, { useState, useEffect } from 'react';
import { Utensils, MoreVertical, HelpCircle, Phone, LogOut, ExternalLink } from 'lucide-react';

export default function AdminHeader({
  restaurantInfo,
  username = 'admin',
  onLogout,
  onReturnToMenu,
  onOpenHelp,
  supportPhone,
  activeTab,
  setActiveTab,
  pendingOrdersCount = 0
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowMoreMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMoreMenu]);

  const restoName = restaurantInfo?.name || 'Raman Sweet Bakery & Family Restaurant';
  const truncatedName = restoName.length > 22 ? `${restoName.substring(0, 20)}...` : restoName;
  const logoUrl = restaurantInfo?.logo;

  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isSetupActive = ['settings', 'qr-generator', 'review'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';

  return (
    <header className="adm-header">
      {/* LEFT: [LOGO] Restaurant Name + Owner: admin • ● Live */}
      <div className="adm-header-left">
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: '1.5px solid #D4AF37',
          padding: '1px',
          background: '#0A2315',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {logoUrl && logoUrl !== '/uploads/logo.jpg' ? (
            <img
              src={logoUrl}
              alt={restoName}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#D4AF37', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.95rem' }}>
              {(restoName || 'R').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="adm-header-title-box">
          <h1 className="adm-header-title" title={restoName}>
            {truncatedName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#CBD5E1', fontWeight: 600, marginTop: '1px' }}>
            <span>Owner: {username || 'admin'}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
            <span style={{ color: '#22C55E', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              Live
            </span>
          </div>
        </div>
      </div>

      {/* CENTER: Desktop Integrated Nav Tabs (hidden on mobile) */}
      {setActiveTab && (
        <div className="adm-header-desktop-tabs">
          <button
            onClick={() => setActiveTab('orders')}
            className={`adm-header-tab ${isOrdersActive ? 'active' : ''}`}
          >
            Orders {pendingOrdersCount > 0 ? `(${pendingOrdersCount})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`adm-header-tab ${isAnalyticsActive ? 'active' : ''}`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('dishes')}
            className={`adm-header-tab ${isMenuActive ? 'active' : ''}`}
          >
            Menu
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`adm-header-tab ${isSetupActive ? 'active' : ''}`}
          >
            Setup
          </button>
        </div>
      )}

      {/* RIGHT: [ 🍽 Menu ] Button & [⋮] More Options */}
      <div className="adm-header-right" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* COMPACT MENU BUTTON (Pill shape, 70-80px wide, 40-44px high) */}
        <button
          onClick={() => {
            if (onReturnToMenu) {
              onReturnToMenu(restaurantInfo?.slug);
            } else if (restaurantInfo?.slug) {
              window.open(`/r/${restaurantInfo.slug}`, '_blank');
            }
          }}
          style={{
            height: '42px',
            padding: '0 12px',
            borderRadius: '21px',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            color: '#FFFFFF',
            fontSize: '0.82rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}
          title="Open Public Menu"
        >
          <Utensils size={14} color="#D4AF37" />
          <span>Menu</span>
        </button>

        {/* DIRECT EXIT / LOGOUT BUTTON */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            height: '42px',
            padding: '0 12px',
            borderRadius: '21px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#F87171',
            fontSize: '0.82rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          title="Exit / Logout Admin"
        >
          <LogOut size={14} />
          <span>Exit</span>
        </button>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="adm-drawer-overlay" style={{ justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div className="adm-card" style={{ maxWidth: '360px', width: '100%', padding: '20px', textTransform: 'none' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--adm-text)', margin: '0 0 8px 0' }}>
              Confirm Admin Logout
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--adm-muted)', margin: '0 0 16px 0' }}>
              Are you sure you want to end your active restaurant management session?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLogoutConfirm(false)} className="adm-btn adm-btn-secondary adm-btn-sm">
                Cancel
              </button>
              <button onClick={onLogout} className="adm-btn adm-btn-danger adm-btn-sm">
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

