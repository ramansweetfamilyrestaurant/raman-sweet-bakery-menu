import React from 'react';
import { 
  Home, 
  ShoppingBag, 
  Utensils, 
  BarChart2, 
  Settings, 
  QrCode, 
  Star, 
  Tv, 
  HelpCircle, 
  LogOut, 
  ExternalLink,
  Crown
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
  const restoName = restaurantInfo?.name || 'Your Business';
  const truncatedName = restoName.length > 20 ? `${restoName.substring(0, 18)}...` : restoName;
  const logoUrl = restaurantInfo?.logo;
  const resolvedLogo = resolveImageUrl(logoUrl);

  const isHomeActive = activeTab === 'home';
  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';
  const isSetupActive = ['settings'].includes(activeTab);
  const isQrActive = activeTab === 'qr-generator';
  const isReviewActive = activeTab === 'review';

  return (
    <aside style={{
      width: '240px',
      minWidth: '240px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: 'linear-gradient(180deg, #0A2315 0%, #06170E 100%)',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      borderRight: '1px solid rgba(212, 175, 55, 0.15)',
      padding: '20px 14px',
      boxSizing: 'border-box',
      zIndex: 100
    }}>
      {/* TOP SECTION: BRAND + BUSINESS IDENTITY + NAVIGATION */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 1. TOUCHQR MASTER BADGE */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A2315',
              fontWeight: 900,
              fontSize: '0.85rem',
              boxShadow: '0 2px 6px rgba(212, 175, 55, 0.3)'
            }}>
              <Crown size={16} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Touch<span style={{ color: '#D4AF37' }}>QR</span>
            </span>
          </div>

          <span style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            color: '#D4AF37',
            background: 'rgba(212, 175, 55, 0.15)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            padding: '2px 6px',
            borderRadius: '6px',
            textTransform: 'uppercase'
          }}>
            {capabilities?.plan_name || 'ADMIN'}
          </span>
        </div>

        {/* 2. BUSINESS PROFILE CARD */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '14px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1.5px solid #D4AF37',
            background: '#0A2315',
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
              <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: '0.90rem' }}>
                {(restoName || 'B').charAt(0).toUpperCase()}
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
              lineHeight: 1.2
            }} title={restoName}>
              {truncatedName}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <span style={{ fontSize: '0.66rem', color: '#86EFAC', fontWeight: 700 }}>● Live Sync</span>
            </div>
          </div>
        </div>

        {/* 3. PRIMARY NAVIGATION LINKS */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px 4px 8px' }}>
            OPERATIONS
          </div>

          <button
            onClick={() => setActiveTab('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isHomeActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isHomeActive ? '#D4AF37' : '#E2E8F0',
              fontWeight: isHomeActive ? 800 : 600,
              fontSize: '0.84rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Home size={17} />
              <span>Home</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isOrdersActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isOrdersActive ? '#D4AF37' : '#E2E8F0',
              fontWeight: isOrdersActive ? 800 : 600,
              fontSize: '0.84rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingBag size={17} />
              <span>Orders</span>
            </div>
            {pendingOrdersCount > 0 && (
              <span style={{
                background: '#DC2626',
                color: '#FFFFFF',
                fontSize: '0.66rem',
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dishes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isMenuActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isMenuActive ? '#D4AF37' : '#E2E8F0',
              fontWeight: isMenuActive ? 800 : 600,
              fontSize: '0.84rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Utensils size={17} />
              <span>Menu</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isAnalyticsActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isAnalyticsActive ? '#D4AF37' : '#E2E8F0',
              fontWeight: isAnalyticsActive ? 800 : 600,
              fontSize: '0.84rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart2 size={17} />
              <span>Analytics</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isSetupActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isSetupActive ? '#D4AF37' : '#E2E8F0',
              fontWeight: isSetupActive ? 800 : 600,
              fontSize: '0.84rem',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={17} />
              <span>Setup</span>
            </div>
          </button>
        </nav>

        {/* 4. SECONDARY TOOLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px 4px 8px' }}>
            MORE TOOLS
          </div>

          <button
            onClick={() => setActiveTab('qr-generator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isQrActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isQrActive ? '#D4AF37' : '#CBD5E1',
              fontWeight: isQrActive ? 800 : 500,
              fontSize: '0.80rem'
            }}
          >
            <QrCode size={16} />
            <span>QR Standees</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: isReviewActive ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
              color: isReviewActive ? '#D4AF37' : '#CBD5E1',
              fontWeight: isReviewActive ? 800 : 500,
              fontSize: '0.80rem'
            }}
          >
            <Star size={16} />
            <span>Google Reviews</span>
          </button>

          <button
            onClick={() => {
              if (onReturnToMenu) onReturnToMenu(restaurantInfo?.slug);
              else if (restaurantInfo?.slug) window.open(`/r/${restaurantInfo.slug}`, '_blank');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 12px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#CBD5E1',
              fontWeight: 500,
              fontSize: '0.80rem'
            }}
          >
            <ExternalLink size={16} />
            <span>Public Menu ↗</span>
          </button>
        </div>
      </div>

      {/* BOTTOM SECTION: SUPPORT + LOGOUT */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
        <button
          onClick={onOpenHelp}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#CBD5E1',
            fontSize: '0.80rem',
            fontWeight: 600
          }}
        >
          <HelpCircle size={16} />
          <span>Support & Help</span>
        </button>

        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(220, 38, 38, 0.12)',
            color: '#FCA5A5',
            fontSize: '0.80rem',
            fontWeight: 700
          }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
