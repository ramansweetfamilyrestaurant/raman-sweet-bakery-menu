import React from 'react';
import { LayoutDashboard, Store, CreditCard, Layers, History, Megaphone, Settings, LogOut, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, onLogout }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Store },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'plans', label: 'SaaS Plans', icon: Layers },
    { id: 'audit', label: 'Audit Logs', icon: History },
    { id: 'communication', label: 'Communication', icon: Megaphone },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`sa-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div>
        {/* Brand Bar */}
        <div className="sa-sidebar-header">
          <div className="sa-brand">
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
              color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, flexShrink: 0
            }}>
              👑
            </div>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '-0.3px', color: '#FFF' }}>
                  KhanaMaster
                </span>
                <span style={{ fontSize: '0.65rem', color: '#D4AF37', fontWeight: 800 }}>SUPER ADMIN</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94A3B8',
              borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex'
            }}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="sa-sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`sa-nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className="sa-nav-icon" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Logout */}
      <div className="sa-sidebar-footer">
        <button
          onClick={onLogout}
          className="sa-nav-item"
          style={{ color: '#F87171' }}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} className="sa-nav-icon" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
