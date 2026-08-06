import React from 'react';
import { Sparkles, Flame, ChevronRight } from 'lucide-react';

export default function BestsellersCarousel({ dishes, onSelectDish }) {
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
            background: 'linear-gradient(135deg, #FF6B00 0%, #FF9E00 100%)',
            padding: '6px',
            borderRadius: '50%',
            color: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(255, 107, 0, 0.3)'
          }}>
            <Flame size={16} />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--primary-emerald)'
          }}>
            Chef's Recommended Bestsellers
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
        {bestsellers.map((dish) => (
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
              {dish.image && dish.image !== '/uploads/logo.jpg' ? (
                <img
                  src={dish.image}
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
                  {Number(dish.price_half || dish.price).toLocaleString('en-IN')}
                </span>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--gold-bright)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  View <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
