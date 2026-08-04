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
        background: 'rgba(10, 35, 21, 0.94)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-pill)',
        border: '1.5px solid #D4AF37',
        boxShadow: '0 8px 30px rgba(10, 35, 21, 0.4)',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-around'
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
          <Info size={18} color="#D4AF37" />
          Info
        </button>

        {/* Zomato-Style Floating Menu Pill Button (Center Highlight) */}
        <button
          onClick={onOpenCategories}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 50%, #9B7733 100%)',
            color: '#0A2315',
            fontSize: '0.82rem',
            fontWeight: 900,
            padding: '8px 20px',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '0 4px 16px rgba(212, 175, 55, 0.5)',
            letterSpacing: '0.5px'
          }}
        >
          <BookOpen size={17} color="#0A2315" />
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
