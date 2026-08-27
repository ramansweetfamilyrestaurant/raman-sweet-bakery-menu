import React from 'react';
import { 
  Home, 
  ShoppingBag, 
  Utensils, 
  BarChart2, 
  Settings, 
  MoreHorizontal,
  Headphones,
  LogOut,
  QrCode
} from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  restaurantInfo = {},
  username = '',
  pendingOrdersCount = 0,
  onLogout,
  onOpenHelp,
  onReturnToMenu,
  capabilities = {}
}) {
  const restoName = restaurantInfo?.name || 'Raman Sweet Bakery & Restaurant';
  const truncatedName = restoName.length > 24 ? `${restoName.substring(0, 22)}...` : restoName;
  const logoUrl = restaurantInfo?.logo;
  const resolvedLogo = resolveImageUrl(logoUrl);

  const isHomeActive = activeTab === 'home';
  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';
  const isSetupActive = ['settings'].includes(activeTab);
  const isMoreActive = ['qr-generator', 'review'].includes(activeTab);

  return (
    <aside style={{
      width: '100%',
      height: '100vh',
      background: '#051E13',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '20px 16px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .sidebar-nav-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 4px; }
      `}</style>
      {/* TOP SECTION: BRAND + PROFILE + NAV */}
      <div className="sidebar-nav-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
        
        {/* 1. MASTER BRAND LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: 'transparent',
            border: '1.5px solid #22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22C55E',
            flexShrink: 0
          }}>
            <QrCode size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.1 }}>
              Touch<span style={{ color: '#22C55E' }}>QR</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 500, marginTop: '2px' }}>
              Smart Menu. Simple Orders.
            </div>
          </div>
        </div>

        {/* 2. BUSINESS PROFILE CARD */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 4px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '1.5px solid #D4AF37',
            background: '#8B0000',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={restoName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: '0.92rem' }}>
                {(restoName || 'R').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{
              fontSize: '0.84rem',
              color: '#FFFFFF',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
              fontWeight: 700
            }} title={restoName}>
              {truncatedName}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <span style={{ fontSize: '0.68rem', color: '#22C55E', fontWeight: 700 }}>Live</span>
            </div>
          </div>
        </div>

        {/* 3. PRIMARY NAVIGATION LINKS */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Home */}
          <button
            onClick={() => setActiveTab('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: isHomeActive ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid transparent',
              cursor: 'pointer',
              background: isHomeActive ? '#0D3823' : 'transparent',
              color: isHomeActive ? '#FFFFFF' : '#CBD5E1',
              fontWeight: isHomeActive ? 700 : 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Home size={18} color={isHomeActive ? '#22C55E' : '#94A3B8'} />
              <span>Home</span>
            </div>
          </button>

          {/* Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: isOrdersActive ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid transparent',
              cursor: 'pointer',
              background: isOrdersActive ? '#0D3823' : 'transparent',
              color: isOrdersActive ? '#FFFFFF' : '#CBD5E1',
              fontWeight: isOrdersActive ? 700 : 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShoppingBag size={18} color={isOrdersActive ? '#22C55E' : '#94A3B8'} />
              <span>Orders</span>
            </div>
            {pendingOrdersCount > 0 && (
              <span style={{
                background: '#D97706',
                color: '#FFFFFF',
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* Menu */}
          <button
            onClick={() => setActiveTab('dishes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: isMenuActive ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              background: isMenuActive ? '#2A1B14' : 'transparent',
              color: isMenuActive ? '#FFFFFF' : '#CBD5E1',
              fontWeight: isMenuActive ? 800 : 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Utensils size={18} color={isMenuActive ? '#E07A5F' : '#94A3B8'} />
              <span>Menu</span>
            </div>
          </button>

          {/* KDS */}
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
              color: '#CBD5E1',
              fontWeight: 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>🖥️</span>
              <span>KDS</span>
            </div>
          </button>

          {/* Analytics */}
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: isAnalyticsActive ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid transparent',
              cursor: 'pointer',
              background: isAnalyticsActive ? '#0D3823' : 'transparent',
              color: isAnalyticsActive ? '#FFFFFF' : '#CBD5E1',
              fontWeight: isAnalyticsActive ? 700 : 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart2 size={18} color={isAnalyticsActive ? '#22C55E' : '#94A3B8'} />
              <span>Analytics</span>
            </div>
          </button>

          {/* Customers */}
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
              color: '#CBD5E1',
              fontWeight: 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>👥</span>
              <span>Customers</span>
            </div>
          </button>

          {/* Marketing */}
          <button
            onClick={() => setActiveTab('qr-generator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
              color: '#CBD5E1',
              fontWeight: 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>📢</span>
              <span>Marketing</span>
            </div>
          </button>

          {/* Billing */}
          <button
            onClick={() => window.open('/billing', '_blank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid transparent',
              cursor: 'pointer',
              background: 'transparent',
              color: '#CBD5E1',
              fontWeight: 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>💳</span>
              <span>Billing</span>
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: isSetupActive ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid transparent',
              cursor: 'pointer',
              background: isSetupActive ? '#0D3823' : 'transparent',
              color: isSetupActive ? '#FFFFFF' : '#CBD5E1',
              fontWeight: isSetupActive ? 700 : 500,
              fontSize: '0.86rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Settings size={18} color={isSetupActive ? '#22C55E' : '#94A3B8'} />
              <span>Settings</span>
            </div>
          </button>
        </nav>
      </div>

      {/* BOTTOM SECTION: NEED HELP + LOGOUT + FOOTER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '10px' }}>
        
        {/* Support Pill Card */}
        <div
          onClick={onOpenHelp}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(224, 122, 95, 0.2)',
              color: '#E07A5F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Headphones size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#FFFFFF' }}>
                Need Help?
              </div>
              <div style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
                We're here 24/7
              </div>
            </div>
          </div>
          <span style={{ color: '#E07A5F', fontSize: '0.86rem', fontWeight: 800 }}>→</span>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '6px 8px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#94A3B8',
            fontSize: '0.80rem',
            fontWeight: 600,
            transition: 'color 0.15s ease'
          }}
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>

        {/* Branding Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.64rem', color: '#64748B' }}>TouchQR v1.0.0</div>
          <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: '2px' }}>🇮🇳 Made with ❤️ in India</div>
        </div>
      </div>
    </aside>
  );
}
