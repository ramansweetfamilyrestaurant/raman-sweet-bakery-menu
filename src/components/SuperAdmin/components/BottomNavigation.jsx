import React from 'react';
import { LayoutDashboard, Store, CreditCard, Menu } from 'lucide-react';

export default function BottomNavigation({ activeView, setActiveView, onOpenMoreDrawer }) {
  return (
    <nav className="sa-mobile-nav">
      <button
        onClick={() => setActiveView('overview')}
        className={`sa-mobile-nav-item ${activeView === 'overview' ? 'active' : ''}`}
      >
        <LayoutDashboard size={19} />
        <span>Overview</span>
      </button>

      <button
        onClick={() => setActiveView('tenants')}
        className={`sa-mobile-nav-item ${activeView === 'tenants' ? 'active' : ''}`}
      >
        <Store size={19} />
        <span>Shops</span>
      </button>

      <button
        onClick={() => setActiveView('billing')}
        className={`sa-mobile-nav-item ${activeView === 'billing' ? 'active' : ''}`}
      >
        <CreditCard size={19} />
        <span>Billing</span>
      </button>

      <button
        onClick={onOpenMoreDrawer}
        className={`sa-mobile-nav-item ${['plans', 'operations', 'activity', 'settings', 'communication'].includes(activeView) ? 'active' : ''}`}
      >
        <Menu size={19} />
        <span>More</span>
      </button>
    </nav>
  );
}
