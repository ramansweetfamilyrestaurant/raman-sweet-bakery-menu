import React from 'react';
import { Menu, Search, Bell, ShieldCheck, LogOut } from 'lucide-react';

export default function Header({ username, activeView, searchQuery, setSearchQuery, onOpenMobileMenu, pendingCount, onLogout }) {
  const titles = {
    overview: 'Platform Overview',
    tenants: 'Tenant Restaurants',
    subscriptions: 'Subscription Management',
    plans: 'SaaS Plans',
    audit: 'Audit Activity Logs',
    communication: 'Broadcast Communication',
    settings: 'System Settings',
  };

  return (
    <header className="sa-header">
      <div className="sa-header-left">
        <button
          onClick={onOpenMobileMenu}
          className="sa-btn sa-btn-secondary sa-btn-sm"
          style={{ display: 'none', padding: '6px' }}
          id="mobile-menu-trigger"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
            {titles[activeView] || 'Super Admin Dashboard'}
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            KhanaMaster SaaS Control Center
          </span>
        </div>
      </div>

      <div className="sa-header-right">
        {/* Quick Search */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-text-muted)' }} />
          <input
            type="text"
            placeholder="Search tenant or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 30px',
              borderRadius: 'var(--sa-radius-full)',
              border: '1px solid var(--sa-border)',
              fontSize: '0.8rem',
              outline: 'none',
              background: 'var(--sa-surface-subtle)'
            }}
          />
        </div>

        {/* Security Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', padding: '4px 10px', borderRadius: 'var(--sa-radius-full)', fontSize: '0.72rem', fontWeight: 800 }}>
          <ShieldCheck size={14} />
          <span>SSL SECURE</span>
        </div>

        {/* Profile Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--sa-border)' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sa-primary)', color: 'var(--sa-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.82rem' }}>
            {username ? username.charAt(0).toUpperCase() : 'S'}
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
            {username || 'Super Admin'}
          </span>
        </div>
      </div>
    </header>
  );
}
