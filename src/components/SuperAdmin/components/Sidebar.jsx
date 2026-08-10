import React from 'react';
import { LayoutDashboard, Store, Settings, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, logoUrl }) {
  const [logoErr, setLogoErr] = React.useState(false);

  React.useEffect(() => {
    setLogoErr(false);
  }, [logoUrl]);

  const navItems = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'tenants', label: 'Restaurants', icon: Store },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <aside className={`sa-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div>
        <div className="sa-sidebar-header">
          <div className="sa-brand">
            {logoUrl && !logoErr ? (
              <img
                src={logoUrl}
                alt="Super Admin Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoErr(true)}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  objectFit: 'contain', background: '#FFF', flexShrink: 0, padding: '2px'
                }}
              />
            ) : (
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
                color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, flexShrink: 0
              }}>
                👑
              </div>
            )}
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '-0.3px', color: '#FFF' }}>
                  TouchQR
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
    </aside>
  );
}
