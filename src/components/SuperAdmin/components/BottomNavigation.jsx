import React from 'react';
import { LayoutDashboard, Store, CreditCard, Menu } from 'lucide-react';

export default function BottomNavigation({ activeView, setActiveView, onOpenMoreDrawer, openTicketsCount = 0 }) {
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
        className={`sa-mobile-nav-item ${['tickets', 'plans', 'operations', 'activity', 'settings', 'communication'].includes(activeView) ? 'active' : ''}`}
        style={{ position: 'relative' }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Menu size={19} />
          {openTicketsCount > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: '-4px',
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#EF4444', border: '1.5px solid #0A2315'
            }} />
          )}
        </div>
        <span>More</span>
      </button>
    </nav>
  );
}
