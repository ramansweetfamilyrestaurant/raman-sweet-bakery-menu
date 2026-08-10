import React from 'react';
import { Sparkles } from 'lucide-react';
import { resolveImageUrl } from '../utils/imageHelper';

export default function BestsellersCarousel({ dishes, onSelectDish, currencySymbol }) {
  const symbol = currencySymbol !== undefined && currencySymbol !== null ? currencySymbol : '₹';
  const bestsellers = dishes.filter(d => d.badge && (d.badge.includes('Bestseller') || d.badge.includes('Must Try') || d.badge.includes('Royal'))).slice(0, 5);

  if (bestsellers.length === 0) return null;

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '24px 20px 8px',
    }}>
      {/* Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-bright) 0%, #D4AF37 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)'
          }}>
            <Sparkles size={16} color="#0A2315" />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.15rem',
            fontWeight: 800,
            color: 'var(--primary-emerald)',
            margin: 0
          }}>
            Bestsellers
          </h2>
        </div>

        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-bright)', letterSpacing: '0.5px' }}>
          MOST POPULAR
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
          const imageSrc = resolveImageUrl(dish.image);
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
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={dish.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--header-gradient)',
                    color: 'var(--gold-bright)',
                    fontSize: '2rem'
                  }}>
                    🌟
                  </div>
                )}

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
