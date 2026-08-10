import React, { useState } from 'react';
import { Utensils, MoreVertical, HelpCircle, Phone, LogOut, ArrowLeft, ExternalLink } from 'lucide-react';

export default function AdminHeader({
  restaurantInfo,
  username,
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

  const restoName = restaurantInfo?.name || 'Restaurant Admin';
  const truncatedName = restoName.length > 20 ? `${restoName.substring(0, 18)}...` : restoName;

  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isSetupActive = ['settings', 'qr-generator', 'review'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';

  return (
    <header className="adm-header">
      {/* LEFT: Restaurant Brand & Identity */}
      <div className="adm-header-left">
        <div className="adm-header-title-box">
          <h1 className="adm-header-title" title={restoName}>
            {truncatedName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="adm-header-subtitle">ADMIN CONTROL</span>
            <span style={{ fontSize: '0.65rem', color: '#86EFAC', fontWeight: 800 }}>● Live</span>
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

      {/* RIGHT: Action Menu ⋮ */}
      <div className="adm-header-right" style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="adm-btn adm-btn-secondary adm-btn-sm"
          style={{ padding: '8px', color: '#FFF', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%' }}
          aria-label="More Options Menu"
        >
          <MoreVertical size={20} />
        </button>

        {/* Dropdown Menu */}
        {showMoreMenu && (
          <div
            style={{
              position: 'absolute', top: '44px', right: 0, width: '220px',
              background: '#FFFFFF', border: '1px solid var(--adm-border)',
              borderRadius: 'var(--adm-radius-md)', boxShadow: 'var(--adm-shadow-modal)',
              zIndex: 1000, padding: '6px', color: 'var(--adm-text)'
            }}
            onClick={() => setShowMoreMenu(false)}
          >
            {restaurantInfo?.slug && (
              <a
                href={`/r/${restaurantInfo.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--adm-text)', textDecoration: 'none', borderRadius: '6px' }}
              >
                <ExternalLink size={16} color="var(--adm-primary)" /> Open Live QR Menu
              </a>
            )}

            <button
              onClick={onOpenHelp}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--adm-text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
            >
              <HelpCircle size={16} color="var(--adm-info)" /> Onboarding Guide
            </button>

            <a
              href={`https://wa.me/${(supportPhone || '919876543210').replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--adm-text)', textDecoration: 'none', borderRadius: '6px' }}
            >
              <Phone size={16} color="var(--adm-success)" /> WhatsApp Support
            </a>

            <div style={{ height: '1px', background: 'var(--adm-border)', margin: '4px 0' }} />

            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--adm-danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
            >
              <LogOut size={16} /> Logout Admin
            </button>
          </div>
        )}
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
