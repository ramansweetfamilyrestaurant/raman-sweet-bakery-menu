import React from 'react';
import { ShoppingBag, BarChart2, Utensils, Settings } from 'lucide-react';

export default function AdminBottomNavigation({ activeTab, setActiveTab, pendingOrdersCount = 0 }) {
  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isSetupActive = ['settings', 'qr-generator', 'review'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';

  return (
    <nav className="adm-mobile-nav">
      <button
        onClick={() => setActiveTab('orders')}
        className={`adm-mobile-nav-item ${isOrdersActive ? 'active' : ''}`}
        style={{ position: 'relative' }}
      >
        <ShoppingBag size={20} />
        <span>Orders</span>
        {pendingOrdersCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: 'calc(50% - 18px)',
            background: 'var(--adm-danger)', color: '#FFF', fontSize: '0.62rem',
            fontWeight: 900, borderRadius: '9999px', padding: '1px 5px', minWidth: '16px', textAlign: 'center'
          }}>
            {pendingOrdersCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab('analytics')}
        className={`adm-mobile-nav-item ${isAnalyticsActive ? 'active' : ''}`}
      >
        <BarChart2 size={20} />
        <span>Analytics</span>
      </button>

      <button
        onClick={() => setActiveTab('dishes')}
        className={`adm-mobile-nav-item ${isMenuActive ? 'active' : ''}`}
      >
        <Utensils size={20} />
        <span>Menu</span>
      </button>

      <button
        onClick={() => setActiveTab('settings')}
        className={`adm-mobile-nav-item ${isSetupActive ? 'active' : ''}`}
      >
        <Settings size={20} />
        <span>Setup</span>
      </button>
    </nav>
  );
}
