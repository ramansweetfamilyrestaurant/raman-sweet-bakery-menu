import React from 'react';
import { Home, ShoppingBag, Utensils, BarChart2, Settings } from 'lucide-react';

export default function AdminBottomNavigation({ activeTab, setActiveTab, pendingOrdersCount = 0 }) {
  const isHomeActive = activeTab === 'home';
  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';
  const isSetupActive = ['settings', 'qr-generator', 'review'].includes(activeTab);

  return (
    <>
      <style>{`
        .adm-mobile-only-bottom-bar {
          display: none !important;
        }
        @media (max-width: 900px) {
          .adm-mobile-only-bottom-bar {
            display: flex !important;
          }
        }
      `}</style>
      <nav 
        className="adm-mobile-only-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          background: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04)',
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxSizing: 'border-box',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: isHomeActive ? '#16A34A' : '#64748B',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            height: '100%',
            padding: 0
          }}
        >
          <Home size={20} color={isHomeActive ? '#16A34A' : '#64748B'} strokeWidth={isHomeActive ? 2.5 : 2} />
          <span style={{ fontSize: '0.68rem', fontWeight: isHomeActive ? 800 : 600 }}>Home</span>
        </button>

        {/* Orders */}
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: isOrdersActive ? '#16A34A' : '#64748B',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            height: '100%',
            position: 'relative',
            padding: 0
          }}
        >
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <ShoppingBag size={20} color={isOrdersActive ? '#16A34A' : '#64748B'} strokeWidth={isOrdersActive ? 2.5 : 2} />
            {pendingOrdersCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-10px',
                background: '#D97706',
                color: '#FFFFFF',
                fontSize: '0.58rem',
                fontWeight: 900,
                borderRadius: '10px',
                padding: '1px 5px',
                lineHeight: 1.2
              }}>
                {pendingOrdersCount}
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: isOrdersActive ? 800 : 600 }}>Orders</span>
        </button>

        {/* Menu */}
        <button
          onClick={() => setActiveTab('dishes')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: isMenuActive ? '#D97706' : '#64748B',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            height: '100%',
            padding: 0
          }}
        >
          <Utensils size={20} color={isMenuActive ? '#D97706' : '#64748B'} strokeWidth={isMenuActive ? 2.5 : 2} />
          <span style={{ fontSize: '0.68rem', fontWeight: isMenuActive ? 800 : 600 }}>Menu</span>
        </button>

        {/* Analytics */}
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: isAnalyticsActive ? '#16A34A' : '#64748B',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            height: '100%',
            padding: 0
          }}
        >
          <BarChart2 size={20} color={isAnalyticsActive ? '#16A34A' : '#64748B'} strokeWidth={isAnalyticsActive ? 2.5 : 2} />
          <span style={{ fontSize: '0.68rem', fontWeight: isAnalyticsActive ? 800 : 600 }}>Analytics</span>
        </button>

        {/* More */}
        <button
          onClick={() => setActiveTab('settings')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: isSetupActive ? '#D97706' : '#64748B',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flex: 1,
            height: '100%',
            padding: 0
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1, color: isSetupActive ? '#D97706' : '#64748B' }}>⋯</span>
          <span style={{ fontSize: '0.68rem', fontWeight: isSetupActive ? 800 : 600 }}>More</span>
        </button>
      </nav>
    </>
  );
}
