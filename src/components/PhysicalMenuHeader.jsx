import React from 'react';
import { ShieldCheck, Clock, Phone, Info } from 'lucide-react';
import { getRestaurantLogoUrl } from '../utils/imageHelper';

export default function PhysicalMenuHeader({ info, categories, selectedCategory, onSelectCategory, onOpenInfoModal, onOpenAdmin }) {
  return (
    <header style={{
      background: 'var(--primary-emerald)',
      color: '#FFFFFF',
      padding: '24px 16px 28px',
      borderBottom: '3px solid var(--gold-bright)',
      boxShadow: 'var(--shadow-menu)'
    }}>
      {/* Outer Double Gold Line Frame */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        border: '2px double var(--gold-bright)',
        padding: '20px 16px 24px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(180deg, #091F13 0%, #123722 100%)',
        position: 'relative',
        textAlign: 'center'
      }}>
        {/* Top Admin Link */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <span style={{
            fontSize: '0.72rem',
            color: '#4ADE80',
            background: 'rgba(34, 197, 94, 0.16)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 700
          }}>
            🟢 TABLE QR MENU CARD
          </span>

          <button 
            onClick={onOpenAdmin}
            style={{
              fontSize: '0.74rem',
              color: 'var(--gold-bright)',
              background: 'rgba(212, 175, 55, 0.14)',
              border: '1px solid var(--gold-bright)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700
            }}
          >
            Manager Portal
          </button>
        </div>

        {/* Emblem Crest Logo */}
        <div style={{
          width: '74px',
          height: '74px',
          borderRadius: '50%',
          border: '2px solid var(--gold-bright)',
          padding: '2px',
          margin: '0 auto 12px',
          background: '#091F13',
          boxShadow: '0 0 20px rgba(212, 175, 55, 0.4)'
        }}>
          <img 
            src={getRestaurantLogoUrl(info?.logo)} 
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            onError={(e) => { e.currentTarget.src = '/images/default-logo.svg'; }}
          />
        </div>

        {/* Dual English + Hindi Title */}
        {/* Dynamic Title */}
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1.2,
          marginBottom: '4px'
        }}>
          {info?.name || 'Digital Restaurant Menu'}
        </h1>
        {info?.tagline && (
          <p style={{
            fontSize: '0.9rem',
            color: 'var(--gold-bright)',
            marginBottom: '10px'
          }}>
            {info.tagline}
          </p>
        )}

        {/* Ornament Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--gold-bright)',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '1px',
          marginBottom: '12px'
        }}>
          <span>✦ ───</span>
          <span>{info?.badge ? info.badge.toUpperCase() : 'QUALITY FOOD & SERVICE'}</span>
          <span>─── ✦</span>
        </div>

        {/* Timings & Info Trigger */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <button
            onClick={onOpenInfoModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid var(--gold-border)',
              color: 'var(--gold-soft)',
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            {info?.openingHours && <><Clock size={14} color="var(--gold-bright)" /> {info.openingHours}</>}
            {info?.openingHours && info?.phone && <span style={{ opacity: 0.4 }}>|</span>}
            {info?.phone && <><Phone size={14} color="var(--gold-bright)" /> {info.phone}</>}
          </button>
        </div>

        {/* Physical Menu Card Table of Contents (Index Box) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid var(--gold-border-light)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          textAlign: 'left'
        }}>
          <span style={{
            fontSize: '0.74rem',
            fontWeight: 800,
            color: 'var(--gold-bright)',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            ❖ MENU INDEX • सूची ❖
          </span>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '6px'
          }}>
            <button
              onClick={() => onSelectCategory('all')}
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: selectedCategory === 'all' ? 'var(--gold-bright)' : '#FFFFFF',
                background: selectedCategory === 'all' ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                padding: '5px 8px',
                borderRadius: '4px',
                border: selectedCategory === 'all' ? '1px solid var(--gold-bright)' : 'none',
                textAlign: 'left'
              }}
            >
              • All Sections
            </button>

            {categories.map((c, i) => (
              <button
                key={c.id}
                onClick={() => onSelectCategory(c.id)}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: String(selectedCategory) === String(c.id) ? 'var(--gold-bright)' : '#FFFFFF',
                  background: String(selectedCategory) === String(c.id) ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  border: String(selectedCategory) === String(c.id) ? '1px solid var(--gold-bright)' : 'none',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                • {c.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
