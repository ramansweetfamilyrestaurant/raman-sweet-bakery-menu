import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Bell, 
  ChevronDown, 
  Menu, 
  HelpCircle, 
  Phone, 
  LogOut, 
  ExternalLink,
  Home,
  ShoppingBag,
  Utensils,
  BarChart2,
  Settings,
  Users,
  Tag,
  QrCode,
  CreditCard,
  Star,
  Megaphone,
  X
} from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function AdminHeader({
  restaurantInfo,
  username = 'admin',
  onLogout,
  onReturnToMenu,
  onOpenHelp,
  supportPhone,
  activeTab,
  setActiveTab,
  pendingOrdersCount = 0,
  analyticsEnabled = true,
  ordersEnabled = true
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUserMenu]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = (username || 'AD').substring(0, 2).toUpperCase();

  return (
    <header style={{
      height: '68px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      width: '100%',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .header-biz-text { display: inline !important; }
        .header-global-search { display: flex !important; }
        @media (max-width: 900px) {
          .header-global-search { display: none !important; }
        }
        @media (max-width: 640px) {
          .header-biz-text { display: none !important; }
          .header-biz-chevron { display: none !important; }
          .header-desktop-subtitle { display: none !important; }
        }
      `}</style>

      {/* LEFT: Menu Toggle + Dynamic Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => setShowMobileDrawer(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#0F172A',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Open Navigation Menu"
        >
          <Menu size={22} />
        </button>

        <div>
          <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, lineHeight: 1.1 }}>
            {greeting},
          </div>
          <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.2, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>Admin!</span>
            <span>👋</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Global Search + Storefront + Bell + User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {/* Global Search Bar (Desktop) */}
        <div className="header-global-search" style={{
          position: 'relative',
          alignItems: 'center',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '6px 12px',
          width: '240px'
        }}>
          <span style={{ color: '#94A3B8', fontSize: '0.80rem', marginRight: '6px' }}>🔍</span>
          <input
            type="text"
            placeholder="Search anything..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.78rem',
              color: '#0F172A',
              width: '100%'
            }}
          />
          <span style={{
            fontSize: '0.62rem',
            color: '#94A3B8',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '4px',
            padding: '1px 5px',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            Ctrl K
          </span>
        </div>

        {/* Business View Storefront Button */}
        <button
          onClick={() => {
            if (onReturnToMenu) onReturnToMenu(restaurantInfo?.slug);
            else if (restaurantInfo?.slug) window.open(`/r/${restaurantInfo.slug}`, '_blank');
          }}
          style={{
            height: '36px',
            padding: '0 10px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#0F172A',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}
          title="Open Public Menu & Storefront"
        >
          <Store size={16} color="#0F172A" />
          <span className="header-biz-text">Storefront</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => {
            if (setActiveTab) setActiveTab('notifications');
          }}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#0F172A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative'
          }}
          title="Notifications & Live Orders"
        >
          <Bell size={17} color="#0F172A" />
          {pendingOrdersCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.58rem',
              fontWeight: 900,
              width: '15px',
              height: '15px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #FFFFFF'
            }}>
              {pendingOrdersCount}
            </span>
          )}
        </button>

        {/* User Avatar Circle */}
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#0F172A',
            color: '#FFFFFF',
            fontSize: '0.80rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
          title={`Admin User: ${username}`}
        >
          {initials}
        </div>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div style={{
            position: 'absolute',
            top: '46px',
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            padding: '8px',
            width: '180px',
            zIndex: 100
          }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid #F1F5F9', marginBottom: '4px' }}>
              <strong style={{ fontSize: '0.80rem', color: '#0F172A', display: 'block' }}>{username}</strong>
              <span style={{ fontSize: '0.70rem', color: '#64748B' }}>Restaurant Admin</span>
            </div>

            <button
              onClick={() => {
                setShowUserMenu(false);
                if (onOpenHelp) onOpenHelp();
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                fontSize: '0.78rem',
                color: '#334155',
                cursor: 'pointer',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <HelpCircle size={14} /> Help & Support
            </button>

            <button
              onClick={() => {
                setShowUserMenu(false);
                setShowLogoutConfirm(true);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                fontSize: '0.78rem',
                color: '#DC2626',
                cursor: 'pointer',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0' }}>
                Confirm Logout
              </h3>
              <p style={{ fontSize: '0.84rem', color: '#64748B', margin: '0 0 20px 0' }}>
                Are you sure you want to log out of the admin panel?
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#334155',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={onLogout}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#DC2626',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Mobile Navigation Drawer */}
        {showMobileDrawer && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex'
          }}>
            {/* Backdrop */}
            <div
              onClick={() => setShowMobileDrawer(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(3px)'
              }}
            />

            {/* Slide-out Panel */}
            <div style={{
              position: 'relative',
              width: '82%',
              maxWidth: '310px',
              height: '100%',
              background: '#0B0F19',
              color: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '20px 16px',
              boxShadow: '4px 0 25px rgba(0,0,0,0.5)',
              zIndex: 10001,
              overflowY: 'auto'
            }}>
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #1E293B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      color: '#FFF',
                      fontSize: '1.1rem'
                    }}>
                      ⚡
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: '#F8FAFC', display: 'block', fontWeight: 900 }}>
                        TouchQR
                      </strong>
                      <span style={{ fontSize: '0.70rem', color: '#94A3B8' }}>
                        {restaurantInfo?.name || 'Restaurant Admin'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowMobileDrawer(false)}
                    style={{
                      background: '#1E293B',
                      border: '1px solid #334155',
                      color: '#94A3B8',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Navigation Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[
                    { id: 'home', label: 'Dashboard', icon: Home },
                    { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? pendingOrdersCount : null },
                    { id: 'dishes', label: 'Menu & Catalog', icon: Utensils },
                    { id: 'customers', label: 'Customers & Guests', icon: Users, highlight: true },
                    { id: 'offers', label: 'Offers & Deals', icon: Tag, highlight: true },
                    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
                    { id: 'qr-generator', label: 'QR Standees', icon: QrCode },
                    { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
                    { id: 'review', label: 'Reviews & Feedback', icon: Star },
                    { id: 'notifications', label: 'Notifications', icon: Bell },
                    { id: 'settings', label: 'Settings & Setup', icon: Settings }
                  ].map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id || (item.id === 'dishes' && ['categories', 'combos'].includes(activeTab)) || (item.id === 'orders' && ['floor-map', 'service-requests'].includes(activeTab));

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setShowMobileDrawer(false);
                          if (setActiveTab) setActiveTab(item.id);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '11px 12px',
                          borderRadius: '10px',
                          border: isActive ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid transparent',
                          background: isActive ? '#1E293B' : 'transparent',
                          color: isActive ? '#FFFFFF' : '#94A3B8',
                          fontSize: '0.84rem',
                          fontWeight: isActive ? 800 : 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Icon size={17} color={isActive ? '#F59E0B' : (item.highlight ? '#34D399' : '#94A3B8')} />
                          <span style={{ color: isActive ? '#FFFFFF' : (item.highlight ? '#F1F5F9' : '#94A3B8') }}>
                            {item.label}
                          </span>
                        </div>

                        {item.badge && (
                          <span style={{
                            background: '#DC2626',
                            color: '#FFFFFF',
                            fontSize: '0.66rem',
                            fontWeight: 900,
                            padding: '1px 6px',
                            borderRadius: '10px'
                          }}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Support & Logout in Drawer */}
              <div style={{ borderTop: '1px solid #1E293B', paddingTop: '14px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => {
                    setShowMobileDrawer(false);
                    if (onOpenHelp) onOpenHelp();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #334155',
                    background: '#1E293B',
                    color: '#F8FAFC',
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <HelpCircle size={16} color="#38BDF8" />
                  <span>Need Help? Support</span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileDrawer(false);
                    setShowLogoutConfirm(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: '#FCA5A5',
                    fontSize: '0.80rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <LogOut size={16} color="#EF4444" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
