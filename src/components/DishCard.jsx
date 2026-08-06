import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function DishCard({ dish, onClick, onAddToCart, currencySymbol = '₹' }) {
  const isAvailable = dish.available !== false;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;

  return (
    <article 
      onClick={() => onClick(dish)}
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        opacity: isAvailable ? 1 : 0.6,
        animation: 'fadeIn 0.3s ease-out'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--border-light)';
      }}
    >
      {/* Image Wrap */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '60%',
        backgroundColor: 'var(--bg-secondary)',
        overflow: 'hidden'
      }}>
        <img 
          src={dish.image || '/uploads/logo.jpg'} 
          alt={dish.name}
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          onError={(e) => {
            e.target.src = '/uploads/logo.jpg';
          }}
        />

        {/* Dynamic Dietary Badge */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          border: dish.type === 'nonveg' ? '1px solid #DC2626' : dish.type === 'egg' ? '1px solid #D97706' : '1px solid var(--veg-green)',
          borderRadius: 'var(--radius-pill)',
          padding: '3px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}>
          <span style={{
            width: '10px',
            height: '10px',
            border: dish.type === 'nonveg' ? '1.5px solid #DC2626' : dish.type === 'egg' ? '1.5px solid #D97706' : '1.5px solid var(--veg-green)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px'
          }}>
            <span style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#D97706' : 'var(--veg-green)'
            }} />
          </span>
          <span style={{
            fontSize: '0.66rem',
            fontWeight: 800,
            color: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#B45309' : 'var(--veg-green)',
            letterSpacing: '0.5px'
          }}>
            {dish.type === 'nonveg' ? 'NON-VEG' : dish.type === 'egg' ? 'EGG' : 'PURE VEG'}
          </span>
        </div>

        {dish.badge && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'var(--accent-orange)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 10px',
            fontSize: '0.68rem',
            fontWeight: 800,
            boxShadow: '0 2px 6px rgba(230, 81, 0, 0.3)'
          }}>
            {dish.badge}
          </div>
        )}

        {!isAvailable && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(33, 37, 41, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{
              background: '#DC2626',
              color: '#FFFFFF',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              Currently Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Card Details */}
      <div style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '6px'
          }}>
            <h3 style={{
              fontSize: '1.08rem',
              fontWeight: 700,
              color: 'var(--text-dark)',
              lineHeight: 1.25
            }}>
              {dish.name}
            </h3>

            <span style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--primary-emerald)',
              background: 'var(--primary-emerald-light)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'nowrap'
            }}>
              {currencySymbol}{Number(dish.price).toLocaleString('en-IN')}
            </span>
          </div>

          {dish.description && (
            <p style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {dish.description}
            </p>
          )}
        </div>

        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--primary-emerald)'
          }}>
            {hasHalfPrice ? `Half ${currencySymbol}${dish.price_half} | Full ${currencySymbol}${dish.price}` : (dish.portion || 'Special Portion')}
          </span>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {onAddToCart && isAvailable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(dish);
                }}
                style={{
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37, 211, 102, 0.4)'
                }}
              >
                + Order
              </button>
            )}

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: 'var(--primary-emerald)'
            }}>
              View <ChevronRight size={14} />
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
