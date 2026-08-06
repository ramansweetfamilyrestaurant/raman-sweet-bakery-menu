import React, { useState } from 'react';

export default function PhysicalMenuItem({ dish, onClick }) {
  const isAvailable = dish.available !== false;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const [selectedPortion, setSelectedPortion] = useState(hasHalfPrice ? 'half' : 'full');

  const currentPrice = (selectedPortion === 'half' && hasHalfPrice) ? dish.price_half : dish.price;
  const ingredientsList = dish.ingredients ? dish.ingredients.split(',').map(i => i.trim()) : [];

  return (
    <div 
      style={{
        padding: '16px 0',
        borderBottom: '1px dashed rgba(212, 175, 55, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        opacity: isAvailable ? 1 : 0.6,
        transition: 'var(--transition-fast)'
      }}
    >
      {/* Top Main Row: Veg Dot + Name + Dot Leader + Price */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%'
      }}>
        {/* Name & Veg Symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, minWidth: 0 }}>
          {/* FSSAI Veg Symbol */}
          <span style={{
            width: '14px',
            height: '14px',
            border: '1.5px solid var(--veg-green)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px',
            flexShrink: 0,
            background: '#FFFFFF'
          }} title="100% Pure Vegetarian">
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--veg-green)'
            }} />
          </span>

          <h3 
            onClick={() => onClick(dish)}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.18rem',
              fontWeight: 700,
              color: 'var(--primary-emerald)',
              lineHeight: 1.25,
              cursor: 'pointer'
            }}
          >
            {dish.name}
          </h3>

          {/* Badge Tag */}
          {dish.badge && (
            <span style={{
              fontSize: '0.66rem',
              fontWeight: 800,
              color: 'var(--primary-emerald)',
              background: 'var(--gold-soft)',
              border: '1px solid var(--gold-border)',
              padding: '1px 7px',
              borderRadius: 'var(--radius-pill)',
              whiteSpace: 'nowrap'
            }}>
              {dish.badge}
            </span>
          )}
        </div>

        {/* Price Box / Switcher */}
        {hasHalfPrice ? (
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--gold-soft)',
            border: '1px solid var(--gold-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px',
            flexShrink: 0
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPortion('half');
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 'var(--radius-pill)',
                background: selectedPortion === 'half' ? 'var(--primary-emerald)' : 'transparent',
                color: selectedPortion === 'half' ? '#FFFFFF' : 'var(--primary-emerald)'
              }}
            >
              Half {dish.price_half}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPortion('full');
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 'var(--radius-pill)',
                background: selectedPortion === 'full' ? 'var(--primary-emerald)' : 'transparent',
                color: selectedPortion === 'full' ? '#FFFFFF' : 'var(--primary-emerald)'
              }}
            >
              Full {dish.price}
            </button>
          </div>
        ) : (
          <span 
            onClick={() => onClick(dish)}
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--primary-emerald)',
              flexShrink: 0,
              cursor: 'pointer'
            }}
          >
            {Number(dish.price).toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* Second Row: Description & Image Thumbnail */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '14px',
        paddingLeft: '22px'
      }}>
        <div style={{ flexGrow: 1 }}>
          {/* Portion specification label */}
          {dish.portion && (
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-gold)',
              display: 'block',
              marginBottom: '2px'
            }}>
              Portion: {dish.portion}
            </span>
          )}

          {/* Description */}
          {dish.description && (
            <p 
              onClick={() => onClick(dish)}
              style={{
                fontSize: '0.84rem',
                color: 'var(--text-muted)',
                lineHeight: 1.45,
                fontStyle: 'italic',
                cursor: 'pointer',
                marginBottom: '4px'
              }}
            >
              {dish.description}
            </p>
          )}

          {/* Ingredients chips */}
          {ingredientsList.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              {ingredientsList.map((ing, idx) => (
                <span key={idx} style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  background: 'var(--gold-soft)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  padding: '1px 6px',
                  borderRadius: '3px'
                }}>
                  • {ing}
                </span>
              ))}
            </div>
          )}

          {!isAvailable && (
            <span style={{
              display: 'inline-block',
              marginTop: '6px',
              fontSize: '0.7rem',
              fontWeight: 800,
              color: '#EF4444',
              background: '#FEE2E2',
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)'
            }}>
              Currently Out of Stock
            </span>
          )}
        </div>

        {/* Thumbnail Photo */}
        {dish.image && (
          <div 
            onClick={() => onClick(dish)}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1px solid var(--gold-border)',
              flexShrink: 0,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <img
              src={dish.image}
              alt={dish.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = '/uploads/logo.jpg'; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
