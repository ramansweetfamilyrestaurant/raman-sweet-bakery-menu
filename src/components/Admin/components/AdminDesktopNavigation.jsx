import React from 'react';
import { ShoppingBag, BarChart2, Utensils, Settings } from 'lucide-react';

export default function AdminDesktopNavigation({ activeTab, setActiveTab, pendingOrdersCount = 0, analyticsEnabled = true, ordersEnabled = true }) {
  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isSetupActive = ['settings', 'qr-generator', 'review'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';

  return (
    <nav className="adm-desktop-nav">
      <button
        onClick={() => setActiveTab('orders')}
        className={`adm-desktop-nav-item ${isOrdersActive ? 'active' : ''}`}
      >
        <ShoppingBag size={16} />
        <span>Orders {pendingOrdersCount > 0 ? `(${pendingOrdersCount})` : ''}</span>
      </button>

      <button
        onClick={() => setActiveTab('analytics')}
        className={`adm-desktop-nav-item ${isAnalyticsActive ? 'active' : ''}`}
      >
        <BarChart2 size={16} />
        <span>Analytics</span>
      </button>

      <button
        onClick={() => setActiveTab('dishes')}
        className={`adm-desktop-nav-item ${isMenuActive ? 'active' : ''}`}
      >
        <Utensils size={16} />
        <span>Menu</span>
      </button>

      <button
        onClick={() => setActiveTab('settings')}
        className={`adm-desktop-nav-item ${isSetupActive ? 'active' : ''}`}
      >
        <Settings size={16} />
        <span>Setup</span>
      </button>
    </nav>
  );
}
