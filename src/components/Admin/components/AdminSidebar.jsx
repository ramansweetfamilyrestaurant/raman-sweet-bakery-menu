import React from 'react';
import { 
  Headphones,
  LogOut,
  ArrowRight
} from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';
import { getBusinessTerminology } from '../../../utils/businessTaxonomy';
import { DESKTOP_SIDEBAR_ITEMS, isNavItemActive, getLocalizedNavLabel } from '../adminNavigation';

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  restaurantInfo = {},
  username = '',
  pendingOrdersCount = 0,
  onLogout,
  onOpenHelp,
  onReturnToMenu,
  capabilities = {}
}) {
  const restoName = restaurantInfo?.name || 'Restaurant Admin';
  const logoUrl = restaurantInfo?.logo;
  const resolvedLogo = resolveImageUrl(logoUrl);
  const terms = getBusinessTerminology(restaurantInfo || {});
  const categoryLabel = terms?.venueName || 'Restaurant';

  const [logoFailed, setLogoFailed] = React.useState(false);

  React.useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  return (
    <aside style={{
      width: '100%',
      height: '100vh',
      background: '#090C0A',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '20px 16px 14px 16px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .sidebar-nav-scroll::-webkit-scrollbar { width: 4px; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .sidebar-nav-item {
          transition: all 0.15s ease;
        }
        .sidebar-nav-item:hover {
          background-color: rgba(255, 255, 255, 0.05) !important;
          color: #FFFFFF !important;
        }
        .sidebar-support-card:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.16) !important;
        }
        .sidebar-logout-btn:hover {
          color: #EF4444 !important;
          background: rgba(239, 68, 68, 0.1) !important;
        }
      `}</style>

      {/* TOP SECTION: BRAND + PROFILE + NAV */}
      <div className="sidebar-nav-scroll" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
        flex: 1,
        paddingRight: '2px',
        zIndex: 2
      }}>
        
        {/* 👑 BUSINESS HERO HEADER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 4px 14px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {/* Logo / Brand Initial */}
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '11px',
            border: '1.5px solid rgba(212, 175, 55, 0.45)',
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(0,0,0,0.45)'
          }}>
            {!logoFailed && resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={restoName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.02em' }}>
                {(restoName || 'R').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Business Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{
              fontSize: '0.94rem',
              color: '#FFFFFF',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
              fontWeight: 800,
              letterSpacing: '-0.01em'
            }} title={restoName}>
              {restoName}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#22C55E',
                boxShadow: '0 0 6px #22C55E'
              }} />
              <span style={{ fontSize: '0.68rem', color: '#22C55E', fontWeight: 700 }}>Online</span>
              <span style={{ fontSize: '0.65rem', color: '#475569' }}>•</span>
              <span style={{
                fontSize: '0.68rem',
                color: '#94A3B8',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {categoryLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 3. PRIMARY NAVIGATION LINKS */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {DESKTOP_SIDEBAR_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = isNavItemActive(item, activeTab, 'desktop');

            // Style variations matching existing design
            let border = '1px solid transparent';
            let background = 'transparent';
            let color = '#94A3B8';
            let iconColor = '#94A3B8';
            let fontWeight = 500;
            let boxShadow = 'none';

            if (isActive) {
              if (item.id === 'pos') {
                border = '1px solid rgba(16, 185, 129, 0.4)';
                background = '#064E3B';
                color = '#FFFFFF';
                iconColor = '#34D399';
                fontWeight = 800;
                boxShadow = '0 2px 8px rgba(6, 78, 59, 0.4)';
              } else if (item.id === 'dishes') {
                border = '1px solid rgba(217, 119, 6, 0.35)';
                background = '#3D271D';
                color = '#FFFFFF';
                iconColor = '#FB923C';
                fontWeight = 800;
                boxShadow = '0 2px 8px rgba(61, 39, 29, 0.4)';
              } else if (['customers', 'offers', 'qr-generator', 'billing'].includes(item.id)) {
                border = '1px solid #1E293B';
                background = '#0F172A';
                color = '#FFFFFF';
                iconColor = '#10B981';
                fontWeight = 700;
              } else {
                border = '1px solid rgba(255,255,255,0.1)';
                background = '#1C1917';
                color = '#FFFFFF';
                iconColor = '#FFFFFF';
                fontWeight = 700;
              }
            }

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border,
                  cursor: 'pointer',
                  background,
                  color,
                  fontWeight,
                  fontSize: '0.84rem',
                  boxShadow
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={17} color={iconColor} />
                  <span>{getLocalizedNavLabel(item, restaurantInfo, 'desktop')}</span>
                </div>
                {item.id === 'pos' && (
                  capabilities?.counter_ordering_enabled === false ? (
                    <span style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#F87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      🔒 PRO
                    </span>
                  ) : (
                    <span style={{
                      background: '#059669',
                      color: '#FFFFFF',
                      fontSize: '0.62rem',
                      fontWeight: 900,
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      ⚡ FAST
                    </span>
                  )
                )}
                {item.hasBadge && pendingOrdersCount > 0 && (
                  <span style={{
                    background: '#EA580C',
                    color: '#FFFFFF',
                    fontSize: '0.66rem',
                    fontWeight: 900,
                    padding: '1px 7px',
                    borderRadius: '10px'
                  }}>
                    {pendingOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* BOTTOM SECTION: NEED HELP CARD + LOGOUT + FOOTER */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingTop: '10px',
        zIndex: 2
      }}>
        
        {/* Support Card (Warm Terracotta Tone) */}
        <div
          onClick={onOpenHelp}
          className="sidebar-support-card"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(249, 115, 22, 0.15)',
              color: '#FB923C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Headphones size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#FFFFFF' }}>
                Need Help?
              </div>
              <div style={{ fontSize: '0.64rem', color: '#94A3B8' }}>
                We're here 24/7
              </div>
            </div>
          </div>
          
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: '#C2410C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <ArrowRight size={12} strokeWidth={2.5} />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="sidebar-logout-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '6px 8px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: '#94A3B8',
            fontSize: '0.78rem',
            fontWeight: 600,
            transition: 'all 0.15s ease'
          }}
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>

        {/* Branding Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.64rem', color: '#64748B' }}>TouchQR v1.0.0</div>
          <div style={{ fontSize: '0.62rem', color: '#94A3B8', marginTop: '2px' }}>🇮🇳 Made with ❤️ in India</div>
        </div>
      </div>
    </aside>
  );
}
