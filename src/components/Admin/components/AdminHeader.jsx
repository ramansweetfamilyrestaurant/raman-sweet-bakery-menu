import React, { useState, useEffect } from 'react';
import { Store, Bell, ChevronDown, Menu, HelpCircle, Phone, LogOut, ExternalLink } from 'lucide-react';
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

  useEffect(() => {
    if (!showUserMenu) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUserMenu]);

  const restoName = restaurantInfo?.name || 'Your Business';
  const truncatedName = restoName.length > 22 ? `${restoName.substring(0, 20)}...` : restoName;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = (username || 'AD').substring(0, 2).toUpperCase();

  return (
    <header style={{
      height: '70px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      padding: '0 24px',
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
      {/* LEFT: Hamburger + Dynamic Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => {
            // Optional mobile drawer or menu toggle
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#0F172A',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
          aria-label="Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            {greeting}, Admin! 👋
          </h2>
          <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
            Here's what's happening with your business today.
          </span>
        </div>
      </div>

      {/* RIGHT: [ 🏪 Business View ⌄ ] + Bell + User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
        {/* Business View Dropdown Pill */}
        <button
          onClick={() => {
            if (onReturnToMenu) onReturnToMenu(restaurantInfo?.slug);
            else if (restaurantInfo?.slug) window.open(`/r/${restaurantInfo.slug}`, '_blank');
          }}
          style={{
            height: '38px',
            padding: '0 14px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#0F172A',
            fontSize: '0.80rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            transition: 'all 0.15s ease'
          }}
          title="Open Public Menu & Storefront"
        >
          <Store size={16} color="#475569" />
          <span>Business View</span>
          <ChevronDown size={14} color="#94A3B8" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => {
            if (setActiveTab) setActiveTab('orders');
          }}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative'
          }}
          title="Notifications & Live Orders"
        >
          <Bell size={18} />
          {pendingOrdersCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.62rem',
              fontWeight: 900,
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #FFFFFF'
            }}>
              {pendingOrdersCount}
            </span>
          )}
        </button>

        {/* User Avatar Circle */}
        <div
          onClick={() => setShowUserMenu(!showUserMenu)}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: '#0F172A',
            color: '#FFFFFF',
            fontSize: '0.82rem',
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
            top: '48px',
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
      </div>
    </header>
  );
}
