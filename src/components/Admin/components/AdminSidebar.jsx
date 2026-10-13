import React from 'react';
import { 
  Headphones,
  LogOut,
  QrCode,
  ArrowRight
} from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';
import { DESKTOP_SIDEBAR_ITEMS, isNavItemActive } from '../adminNavigation';

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
  const truncatedName = restoName.length > 22 ? `${restoName.substring(0, 20)}...` : restoName;
  const logoUrl = restaurantInfo?.logo;
  const resolvedLogo = resolveImageUrl(logoUrl);

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
        
        {/* 1. MASTER BRAND LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
          }}>
            <QrCode size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '1.12rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.1 }}>
              TouchQR
            </div>
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 500, marginTop: '2px' }}>
              Smart Menu. Simple Orders.
            </div>
          </div>
        </div>

        {/* 2. BUSINESS PROFILE CARD */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '14px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1.5px solid #D4AF37',
            background: '#8B0000',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}>
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={restoName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: '0.90rem' }}>
                {(restoName || 'R').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{
              fontSize: '0.82rem',
              color: '#FFFFFF',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
              fontWeight: 700
            }} title={restoName}>
              {truncatedName}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <span style={{ fontSize: '0.66rem', color: '#22C55E', fontWeight: 700 }}>Online</span>
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
              if (item.id === 'dishes') {
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
                  <span>{item.label}</span>
                </div>
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
            transition: 'color 0.15s ease'
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
