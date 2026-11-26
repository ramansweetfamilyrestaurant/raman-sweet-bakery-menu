import React from 'react';
import { BookOpen, Info, Lock } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export default function BottomDock({ categoriesCount, lang, onOpenCategories, onOpenInfo, onOpenAdmin }) {
  const sideBtnStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    background: 'transparent',
    border: 'none',
    padding: '4px 6px',
    cursor: 'pointer',
    fontSize: '0.70rem',
    flex: 1,
    minWidth: 0
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 2000,
      width: 'calc(100% - 28px)',
      maxWidth: '440px'
    }}>
      <div style={{
        background: 'var(--dock-gradient, linear-gradient(135deg, rgba(10, 35, 21, 0.92) 0%, rgba(20, 58, 36, 0.92) 100%))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--border-light, rgba(212, 175, 55, 0.45))',
        boxShadow: 'var(--theme-shadow, 0 10px 28px rgba(10, 35, 21, 0.36))',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: '6px',
        animation: 'tqSlideUpFade 0.34s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Restaurant Info */}
        <button
          type="button"
          className="tq-tap"
          onClick={() => {
            triggerHaptic('light');
            if (onOpenInfo) onOpenInfo();
          }}
          style={{
            ...sideBtnStyle,
            color: '#FFFFFF',
            fontWeight: 700
          }}
        >
          <Info size={17} color="var(--gold-bright, #D4AF37)" />
          <span>{lang === 'hi' ? 'जानकारी' : 'Info'}</span>
        </button>

        {/* Floating Menu Pill Button (Center Highlight — Glossy Sheen + Tap Spring) */}
        <button
          type="button"
          className="tq-tap tq-menu-pill"
          onClick={() => {
            triggerHaptic('medium');
            if (onOpenCategories) onOpenCategories();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--gold-gradient, linear-gradient(135deg, #DFBA67 0%, #C5A059 50%, #9B7733 100%))',
            color: 'var(--dock-btn-text, var(--primary-emerald, #0A2315))',
            fontSize: '0.80rem',
            fontWeight: 900,
            padding: '7px 18px',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          <BookOpen size={15} color="currentColor" />
          <span>{lang === 'hi' ? 'मेनू' : 'MENU'}</span>
        </button>

        {/* Admin Portal */}
        <button
          type="button"
          className="tq-tap"
          onClick={() => {
            triggerHaptic('light');
            if (onOpenAdmin) onOpenAdmin();
          }}
          style={{
            ...sideBtnStyle,
            color: 'rgba(255, 255, 255, 0.72)',
            fontWeight: 600
          }}
        >
          <Lock size={16} color="rgba(255, 255, 255, 0.72)" />
          <span>{lang === 'hi' ? 'एडमिन' : 'Admin'}</span>
        </button>
      </div>
    </div>
  );
}
