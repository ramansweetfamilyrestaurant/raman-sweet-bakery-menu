import React from 'react';
import { LayoutDashboard, Store, CreditCard, Menu } from 'lucide-react';

export default function BottomNavigation({ activeView, setActiveView, onOpenMoreDrawer }) {
  return (
    <nav className="sa-mobile-nav">
      <button
        onClick={() => setActiveView('overview')}
        className={`sa-mobile-nav-item ${activeView === 'overview' ? 'active' : ''}`}
      >
        <LayoutDashboard size={20} />
        <span>Overview</span>
      </button>

      <button
        onClick={() => setActiveView('tenants')}
        className={`sa-mobile-nav-item ${activeView === 'tenants' ? 'active' : ''}`}
      >
        <Store size={20} />
        <span>Tenants</span>
      </button>

      <button
        onClick={() => setActiveView('subscriptions')}
        className={`sa-mobile-nav-item ${activeView === 'subscriptions' ? 'active' : ''}`}
      >
        <CreditCard size={20} />
        <span>Subscriptions</span>
      </button>

      <button
        onClick={onOpenMoreDrawer}
        className={`sa-mobile-nav-item ${['plans', 'audit', 'communication', 'settings'].includes(activeView) ? 'active' : ''}`}
      >
        <Menu size={20} />
        <span>More</span>
      </button>
    </nav>
  );
}
