import React from 'react';
import { LayoutDashboard, Store, CreditCard, Layers, Database, History, Megaphone, Settings, MessageSquare, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, onLogout, logoUrl, onOpenSupport, onOpenBroadcast, badgeCounts = {} }) {
  const [logoErr, setLogoErr] = React.useState(false);

  let cachedLogo = '';
  try { cachedLogo = localStorage.getItem('touchqr_platform_logo_url') || ''; } catch {}
  const effectiveLogoUrl = logoUrl || cachedLogo || '/api/r2-proxy/superadmin/branding/logo.webp';
  const resolvedUrl = resolveImageUrl(effectiveLogoUrl);

  React.useEffect(() => {
    setLogoErr(false);
  }, [effectiveLogoUrl]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tenants', label: 'Shops', icon: Store },
    { id: 'tickets', label: 'Tickets', icon: MessageSquare },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'plans', label: 'Plans', icon: Layers },
    { id: 'operations', label: 'Operations', icon: Database },
    { id: 'activity', label: 'Activity', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className={`sa-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div>
        {/* Brand Bar */}
        <div className="sa-sidebar-header">
          <div className="sa-brand">
            {resolvedUrl && !logoErr ? (
              <img
                key={resolvedUrl}
                src={resolvedUrl}
                alt="Super Admin Logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoErr(true)}
                style={{
                  maxHeight: '36px', maxWidth: '120px', width: 'auto', height: 'auto', borderRadius: '8px',
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

        {/* Navigation List */}
        <nav className="sa-sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const badgeNum = badgeCounts?.[item.id] || 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`sa-nav-item ${isActive ? 'active' : ''}`}
                title={collapsed ? `${item.label}${badgeNum > 0 ? ` (${badgeNum} new)` : ''}` : undefined}
                style={{ position: 'relative' }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Icon size={18} className="sa-nav-icon" />
                  {collapsed && badgeNum > 0 && (
                    <span style={{
                      position: 'absolute', top: '-3px', right: '-3px',
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: '#EF4444', border: '1.5px solid #0A2315'
                    }} />
                  )}
                </div>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && badgeNum > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: '#EF4444',
                    color: '#FFFFFF',
                    borderRadius: '999px',
                    padding: '1px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    lineHeight: 1.3
                  }}>
                    {badgeNum}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Utility & Logout */}
      <div className="sa-sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {onOpenBroadcast && (
          <button
            onClick={onOpenBroadcast}
            className="sa-nav-item"
            style={{ color: '#DFBA67' }}
            title={collapsed ? 'Broadcast Notice' : undefined}
          >
            <Megaphone size={17} className="sa-nav-icon" />
            {!collapsed && <span>Broadcast</span>}
          </button>
        )}
        {onOpenSupport && (
          <button
            onClick={onOpenSupport}
            className="sa-nav-item"
            style={{ color: '#4ADE80' }}
            title={collapsed ? 'WhatsApp Support' : undefined}
          >
            <MessageSquare size={17} className="sa-nav-icon" />
            {!collapsed && <span>Support</span>}
          </button>
        )}
        <button
          onClick={onLogout}
          className="sa-nav-item"
          style={{ color: '#F87171' }}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={17} className="sa-nav-icon" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

