import React from 'react';
import { ShieldCheck, Globe, Star, Info, Clock, Phone, MapPin } from 'lucide-react';

export default function CustomerHeader({ info, lang, tableNum, onToggleLang, onOpenInfoModal, onOpenAdmin }) {
  const handleReviewClick = () => {
    if (info?.google_review_url && info.google_review_url.trim() !== '') {
      window.open(info.google_review_url, '_blank', 'noopener,noreferrer');
    } else {
      alert(`Google Review link is not configured for ${info?.name || 'this restaurant'} yet.`);
    }
  };

  return (
    <header style={{
      background: 'linear-gradient(180deg, #0A2315 0%, #123722 100%)',
      color: '#FFFFFF',
      padding: '12px 12px 14px',
      borderBottom: '2px solid #D4AF37',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
    }}>
      {/* Top Mobile Bar: Language Pill + Table Indicator + Google Review Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {/* Language Switcher */}
        <button
          onClick={onToggleLang}
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            color: '#FFFFFF',
            background: 'rgba(255, 255, 255, 0.14)',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Globe size={12} color="#D4AF37" />
          {lang === 'hi' ? 'हिंदी' : 'EN / हिंदी'}
        </button>

        {/* Right Action Group: Table Indicator + ⭐ Google Review Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Table Indicator */}
          {tableNum && (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              color: '#4ADE80',
              background: 'rgba(34, 197, 94, 0.18)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#4ADE80' }} />
              T-#{tableNum}
            </span>
          )}

          {/* ⭐ Top Right Google Review Button */}
          <button
            onClick={handleReviewClick}
            title="Rate Us on Google Maps"
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#0A2315',
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              border: '1px solid #FFFFFF',
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
            }}
          >
            <Star size={12} color="#0A2315" fill="#0A2315" />
            {lang === 'hi' ? 'रेटिंग' : 'Review Us'}
          </button>
        </div>
      </div>

      {/* Main Restaurant Brand Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textAlign: 'left'
      }}>
        {/* Logo Avatar */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '2px solid #D4AF37',
          padding: '1px',
          background: '#0A2315',
          flexShrink: 0
        }}>
          <img 
            src={info?.logo || '/uploads/logo.jpg'} 
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          />
        </div>

        {/* Titles */}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {info?.name || 'Digital Menu'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#4ADE80',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={13} color="#4ADE80" />
              {info?.badge || (lang === 'hi' ? 'डिजिटल मेन्यू' : 'Digital Menu')}
            </span>

            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>•</span>

            <button
              onClick={onOpenInfoModal}
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#FEFCE8',
                textDecoration: 'underline'
              }}
            >
              {lang === 'hi' ? 'जानकारी' : 'Info & Timings'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
