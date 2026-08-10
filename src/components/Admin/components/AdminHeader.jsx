import React, { useState } from 'react';
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

        {/* MORE OPTIONS BUTTON [⋮] (44x44px touch target) */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          style={{
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0
          }}
          aria-label="More Options Menu"
        >
          <MoreVertical size={20} />
        </button>

        {/* Dropdown Menu (Guide, WhatsApp Support, Exit / Logout) */}
        {showMoreMenu && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              right: 0,
              width: '200px',
              maxWidth: 'calc(100vw - 24px)',
              background: '#FFFFFF',
              border: '1px solid var(--adm-border)',
              borderRadius: '14px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              zIndex: 2000,
              padding: '6px',
              color: 'var(--adm-text)'
            }}
            onClick={() => setShowMoreMenu(false)}
          >
            <button
              onClick={onOpenHelp}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--adm-text)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}
            >
              <HelpCircle size={16} color="var(--adm-info)" /> Onboarding Guide
            </button>

            <a
              href={`https://wa.me/${(supportPhone || '919876543210').replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--adm-text)', textDecoration: 'none', borderRadius: '8px' }}
            >
              <Phone size={16} color="var(--adm-success)" /> WhatsApp Support
            </a>

            <div style={{ height: '1px', background: 'var(--adm-border)', margin: '4px 0' }} />

            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 800, color: 'var(--adm-danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '8px' }}
            >
              <LogOut size={16} /> Exit / Logout Admin
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

