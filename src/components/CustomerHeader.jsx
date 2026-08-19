import React from 'react';
import { ShieldCheck, Globe, Star, Info, Clock, Phone, MapPin } from 'lucide-react';
import { getRestaurantLogoUrl } from '../utils/imageHelper';

export default function CustomerHeader({ info, lang, tableNum, spaceLabel, onToggleLang, onOpenInfoModal, onOpenAdmin, onCallStaff, onOpenReviewModal }) {
  const getDisplayBadge = () => {
    if (!tableNum) return '';
    if (spaceLabel) return spaceLabel;
    const prefix = String(info?.table_prefix || 'table').toLowerCase();
    if (prefix === 'cabin') return `🛋️ Cabin ${tableNum}`;
    if (prefix === 'room') return `🏨 Room ${tableNum}`;
    if (prefix === 'vip') return `👑 VIP ${tableNum}`;
    return `🍽️ Table ${tableNum}`;
  };
  return (
    <header style={{
      background: 'var(--header-gradient, linear-gradient(180deg, rgba(10, 35, 21, 0.94) 0%, rgba(18, 55, 34, 0.94) 100%))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: '#FFFFFF',
      padding: '12px 14px 14px',
      borderBottom: '1.5px solid rgba(212, 175, 55, 0.4)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
    }}>
      {/* Top Mobile Bar: Language Pill + Table Indicator + Call Staff + Google Review Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {/* Language Switcher (Gated by Plan matrix: multi_language_enabled) */}
        {(info?.multi_language_enabled !== false && info?.multi_language_enabled !== 0) ? (
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
        ) : <div />}

        {/* Right Action Group: Rate Us + Table Indicator + Call Staff */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onOpenReviewModal && Boolean(info?.google_reviews_enabled) && (
            <button
              onClick={onOpenReviewModal}
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: '#0A2315',
                background: 'linear-gradient(135deg, #FFD700 0%, #DFBA67 100%)',
                border: '1px solid #FFF',
                padding: '3px 8px',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: '0 2px 6px rgba(223, 186, 103, 0.4)',
                cursor: 'pointer'
              }}
              title="Rate & Review on Google"
            >
              <Star size={11} fill="#0A2315" color="#0A2315" /> Rate Us
            </button>
          )}

          {/* Table Indicator / View-Only Badge */}
          {tableNum ? (
            <>
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
                {getDisplayBadge()}
              </span>

              {onCallStaff && (
                <button
                  onClick={onCallStaff}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                    border: '1px solid #C4B5FD',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
                  }}
                >
                  🛎️ Call Staff
                </button>
              )}
            </>
          ) : (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#E2E8F0',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              📖 View Only Menu
            </span>
          )}
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
            src={getRestaurantLogoUrl(info?.logo)} 
            alt={info?.name || 'Restaurant Logo'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
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
