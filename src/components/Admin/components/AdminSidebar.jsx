import React from 'react';
import { 
  Home, 
  ShoppingBag, 
  Utensils, 
  BarChart2, 
  Settings, 
  MoreHorizontal,
  Headphones,
  LogOut,
  QrCode,
  Users,
  Megaphone,
  CreditCard,
  ArrowRight,
  Tag
} from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

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
  const restoName = restaurantInfo?.name || 'Raman Sweet Bakery & Restaurant';
  const truncatedName = restoName.length > 22 ? `${restoName.substring(0, 20)}...` : restoName;
  const logoUrl = restaurantInfo?.logo;
  const resolvedLogo = resolveImageUrl(logoUrl);

  const isHomeActive = activeTab === 'home';
  const isOrdersActive = ['orders', 'floor-map', 'service-requests'].includes(activeTab);
  const isMenuActive = ['dishes', 'categories', 'combos'].includes(activeTab);
  const isAnalyticsActive = activeTab === 'analytics';
  const isSetupActive = ['settings'].includes(activeTab);

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
          
          {/* Dashboard */}
          <button
            onClick={() => setActiveTab('home')}
            className="sidebar-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: isHomeActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              cursor: 'pointer',
              background: isHomeActive ? '#1C1917' : 'transparent',
              color: isHomeActive ? '#FFFFFF' : '#94A3B8',
              fontWeight: isHomeActive ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Home size={17} color={isHomeActive ? '#FFFFFF' : '#94A3B8'} />
              <span>Dashboard</span>
            </div>
          </button>

          {/* Orders */}
          <button
            onClick={() => setActiveTab('orders')}
            className="sidebar-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: isOrdersActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              cursor: 'pointer',
              background: isOrdersActive ? '#1C1917' : 'transparent',
              color: isOrdersActive ? '#FFFFFF' : '#94A3B8',
              fontWeight: isOrdersActive ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShoppingBag size={17} color={isOrdersActive ? '#FFFFFF' : '#94A3B8'} />
              <span>Orders</span>
            </div>
            <span style={{
              background: '#EA580C',
              color: '#FFFFFF',
              fontSize: '0.66rem',
              fontWeight: 900,
              padding: '1px 7px',
              borderRadius: '10px'
            }}>
              {pendingOrdersCount > 0 ? pendingOrdersCount : 12}
            </span>
          </button>

          {/* Menu (Active: Warm Caramel / Brown Pill from Reference) */}
          <button
            onClick={() => setActiveTab('dishes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: isMenuActive ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid transparent',
              cursor: 'pointer',
              background: isMenuActive ? '#3D271D' : 'transparent',
              color: isMenuActive ? '#FFFFFF' : '#94A3B8',
              fontWeight: isMenuActive ? 800 : 500,
              fontSize: '0.84rem',
              boxShadow: isMenuActive ? '0 2px 8px rgba(61, 39, 29, 0.4)' : 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Utensils size={17} color={isMenuActive ? '#FB923C' : '#94A3B8'} />
              <span>Menu</span>
            </div>
          </button>

          {/* Analytics */}
          <button
            onClick={() => setActiveTab('analytics')}
            className="sidebar-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: isAnalyticsActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              cursor: 'pointer',
              background: isAnalyticsActive ? '#1C1917' : 'transparent',
              color: isAnalyticsActive ? '#FFFFFF' : '#94A3B8',
              fontWeight: isAnalyticsActive ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart2 size={17} color={isAnalyticsActive ? '#FFFFFF' : '#94A3B8'} />
              <span>Analytics</span>
            </div>
          </button>

          {/* Customers & Guest Insights */}
          <button
            onClick={() => setActiveTab('customers')}
            className={`sidebar-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: activeTab === 'customers' ? '1px solid #1E293B' : '1px solid transparent',
              cursor: 'pointer',
              background: activeTab === 'customers' ? '#0F172A' : 'transparent',
              color: activeTab === 'customers' ? '#FFFFFF' : '#94A3B8',
              fontWeight: activeTab === 'customers' ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={17} color={activeTab === 'customers' ? '#10B981' : '#94A3B8'} />
              <span>Customers</span>
            </div>
          </button>

          {/* Offers & Promotions */}
          <button
            onClick={() => setActiveTab('offers')}
            className={`sidebar-nav-item ${activeTab === 'offers' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: activeTab === 'offers' ? '1px solid #1E293B' : '1px solid transparent',
              cursor: 'pointer',
              background: activeTab === 'offers' ? '#0F172A' : 'transparent',
              color: activeTab === 'offers' ? '#FFFFFF' : '#94A3B8',
              fontWeight: activeTab === 'offers' ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Tag size={17} color={activeTab === 'offers' ? '#10B981' : '#94A3B8'} />
              <span>Offers & Deals</span>
            </div>
          </button>

          {/* QR Standees / Marketing */}
          <button
            onClick={() => setActiveTab('qr-generator')}
            className={`sidebar-nav-item ${activeTab === 'qr-generator' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: activeTab === 'qr-generator' ? '1px solid #1E293B' : '1px solid transparent',
              cursor: 'pointer',
              background: activeTab === 'qr-generator' ? '#0F172A' : 'transparent',
              color: activeTab === 'qr-generator' ? '#FFFFFF' : '#94A3B8',
              fontWeight: activeTab === 'qr-generator' ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <QrCode size={17} color={activeTab === 'qr-generator' ? '#10B981' : '#94A3B8'} />
              <span>QR Standees</span>
            </div>
          </button>

          {/* Billing & Subscription */}
          <button
            onClick={() => setActiveTab('billing')}
            className={`sidebar-nav-item ${(activeTab === 'billing' || activeTab === 'subscription') ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: (activeTab === 'billing' || activeTab === 'subscription') ? '1px solid #1E293B' : '1px solid transparent',
              cursor: 'pointer',
              background: (activeTab === 'billing' || activeTab === 'subscription') ? '#0F172A' : 'transparent',
              color: (activeTab === 'billing' || activeTab === 'subscription') ? '#FFFFFF' : '#94A3B8',
              fontWeight: (activeTab === 'billing' || activeTab === 'subscription') ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CreditCard size={17} color={(activeTab === 'billing' || activeTab === 'subscription') ? '#10B981' : '#94A3B8'} />
              <span>Billing</span>
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            className="sidebar-nav-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: isSetupActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
              cursor: 'pointer',
              background: isSetupActive ? '#1C1917' : 'transparent',
              color: isSetupActive ? '#FFFFFF' : '#94A3B8',
              fontWeight: isSetupActive ? 700 : 500,
              fontSize: '0.84rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={17} color={isSetupActive ? '#FFFFFF' : '#94A3B8'} />
              <span>Settings</span>
            </div>
          </button>
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
