import React from 'react';
import { BookOpen, Info, Lock } from 'lucide-react';

export default function BottomDock({ categoriesCount, lang, onOpenCategories, onOpenInfo, onOpenAdmin }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 2000,
      width: 'calc(100% - 32px)',
      maxWidth: '440px'
    }}>
      <div style={{
        background: 'var(--dock-gradient, linear-gradient(135deg, rgba(10, 35, 21, 0.92) 0%, rgba(20, 58, 36, 0.92) 100%))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-pill)',
        border: '1.5px solid var(--border-light, rgba(212, 175, 55, 0.5))',
        boxShadow: 'var(--theme-shadow, 0 12px 36px rgba(10, 35, 21, 0.45))',
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around'
      }}>
        {/* Restaurant Info */}
        <button
          onClick={onOpenInfo}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: '#FFFFFF',
            fontSize: '0.72rem',
            fontWeight: 700,
            flex: 1
          }}
        >
          <Info size={18} color="var(--gold-bright, #D4AF37)" />
          Info
        </button>

        {/* Zomato-Style Floating Menu Pill Button (Center Highlight) */}
        <button
          onClick={onOpenCategories}
          className="btn-pulse"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--gold-gradient, linear-gradient(135deg, #DFBA67 0%, #C5A059 50%, #9B7733 100%))',
            color: 'var(--primary-emerald, #0A2315)',
            fontSize: '0.82rem',
            fontWeight: 900,
            padding: '9px 22px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 4px 20px rgba(0,0,0, 0.3)',
            letterSpacing: '0.5px'
          }}
        >
          <BookOpen size={17} color="var(--primary-emerald, #0A2315)" />
          {lang === 'hi' ? '📖 मेनु' : '📖 MENU'}
        </button>

        {/* Admin Portal */}
        <button
          onClick={onOpenAdmin}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.72rem',
            fontWeight: 600,
            flex: 1
          }}
        >
          <Lock size={18} color="rgba(255, 255, 255, 0.7)" />
          Admin
        </button>
      </div>
    </div>
  );
}
