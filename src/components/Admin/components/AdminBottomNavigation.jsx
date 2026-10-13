import React from 'react';
import { BOTTOM_NAV_ITEMS, isNavItemActive } from '../adminNavigation';

export default function AdminBottomNavigation({ activeTab, setActiveTab, pendingOrdersCount = 0 }) {
  return (
    <>
      <style>{`
        .adm-mobile-only-bottom-bar {
          display: none !important;
        }
        @media (max-width: 900px) {
          .adm-mobile-only-bottom-bar {
            display: flex !important;
          }
        }
      `}</style>
      <nav 
        className="adm-mobile-only-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          background: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04)',
          zIndex: 1000,
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxSizing: 'border-box',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        {BOTTOM_NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = isNavItemActive(item, activeTab, 'bottomNav');
          const activeColor = ['dishes', 'settings'].includes(item.id) ? '#D97706' : '#16A34A';
          const color = isActive ? activeColor : '#64748B';
          const label = item.bottomNavLabel || item.label;
          const showBadge = item.hasBadge && pendingOrdersCount > 0;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                color,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                flex: 1,
                height: '100%',
                position: 'relative',
                padding: 0
              }}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                {item.id === 'settings' ? (
                  <span style={{ fontSize: '1.25rem', lineHeight: 1, color }}>⋯</span>
                ) : (
                  <Icon size={20} color={color} strokeWidth={isActive ? 2.5 : 2} />
                )}
                {showBadge && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-10px',
                    background: '#D97706',
                    color: '#FFFFFF',
                    fontSize: '0.58rem',
                    fontWeight: 900,
                    borderRadius: '10px',
                    padding: '1px 5px',
                    lineHeight: 1.2
                  }}>
                    {pendingOrdersCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: isActive ? 800 : 600 }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
