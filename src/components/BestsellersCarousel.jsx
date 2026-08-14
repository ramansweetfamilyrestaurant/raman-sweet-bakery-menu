import React from 'react';
import { Flame } from 'lucide-react';
import { getDishImageUrl } from '../utils/imageHelper';

export default function BestsellersCarousel({ dishes = [], onSelectDish, currencySymbol = '₹', lang = 'en' }) {
  const bestsellers = dishes.filter(d => d.must_try || d.bestseller || d.is_must_try || d.is_bestseller).slice(0, 10);

  if (!bestsellers || bestsellers.length === 0) return null;

  return (
    <div style={{ marginBottom: '22px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        padding: '0 4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Flame size={20} color="var(--accent-coral)" style={{ animation: 'pulse 1.5s infinite' }} />
          <h3 style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: 'var(--text-dark)',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            {lang === 'hi' ? '🔥 हमारे सबसे प्रसिद्ध व्यंजन (Must Try)' : '🔥 Must Try & Bestsellers'}
          </h3>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--gold-bright)', fontWeight: 700 }}>
          {bestsellers.length} Items
        </span>
      </div>

      {/* Horizontal Carousel */}
      <div style={{
        display: 'flex',
        gap: '14px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {bestsellers.map((dish) => {
          const imageSrc = getDishImageUrl(dish.image);
          return (
            <div
              key={dish.id}
              onClick={() => onSelectDish(dish)}
              style={{
                flexShrink: 0,
                width: '240px',
                background: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1.5px solid var(--gold-border)',
                boxShadow: 'var(--shadow-md)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                position: 'relative'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--gold-bright)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--gold-border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
            >
              {/* Image */}
              <div style={{
                width: '100%',
                height: '140px',
                position: 'relative',
                background: 'var(--gold-soft)',
                overflow: 'hidden'
              }}>
                <img
                  src={imageSrc}
                  alt={dish.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                />

                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                  color: 'var(--gold-bright)',
                  border: '1px solid var(--gold-bright)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.68rem',
                  fontWeight: 800
                }}>
                  {dish.badge || '🔥 Bestseller'}
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '14px' }}>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--primary-emerald)',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {dish.name}
                </h3>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '8px'
                }}>
                  <span style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: 'var(--primary-emerald)'
                  }}>
                    {symbol}{Math.round(dish.price)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
