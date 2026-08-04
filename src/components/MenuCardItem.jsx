import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function MenuCardItem({ dish, lang, onClick }) {
  const isAvailable = dish.available !== false;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;

  const [portionMode, setPortionMode] = useState(hasHalfPrice ? 'half' : 'full');

  const displayName = (lang === 'hi' && dish.name_hi) ? dish.name_hi : dish.name;

  return (
    <div 
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        marginBottom: '10px',
        border: '1.5px solid var(--gold-border)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        gap: '12px',
        opacity: isAvailable ? 1 : 0.65,
        position: 'relative',
        transition: 'var(--transition-smooth)'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--gold-bright)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--gold-border)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
    >
      {/* Left Details */}
      <div style={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onClick(dish)}>
        {/* Dish Title with Veg Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          {/* FSSAI Veg Symbol */}
          <span style={{
            width: '13px',
            height: '13px',
            border: '1.5px solid var(--veg-green)',
            display: 'inline-flex',
            alignItems: 'center',
            justify: 'center',
            borderRadius: '2px',
            flexShrink: 0,
            background: '#FFFFFF'
          }} title="100% Pure Vegetarian">
            <span style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: 'var(--veg-green)'
            }} />
          </span>

          <h3 style={{
            fontSize: '1.08rem',
            fontWeight: 800,
            color: 'var(--primary-emerald)',
            lineHeight: 1.25
          }}>
            {displayName}
          </h3>
        </div>

        {/* Portion specification label */}
        {dish.portion && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--text-gold)',
            display: 'block'
          }}>
            {dish.portion}
          </span>
        )}

        {!isAvailable && (
          <span style={{
            display: 'inline-block',
            marginTop: '4px',
            fontSize: '0.68rem',
            fontWeight: 800,
            color: '#DC2626',
            background: '#FEE2E2',
            padding: '1px 8px',
            borderRadius: 'var(--radius-pill)'
          }}>
            {lang === 'hi' ? 'अनुपलब्ध' : 'Out of Stock'}
          </span>
        )}
      </div>

      {/* Right Column: Pricing Switcher & Image Thumbnail */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0
      }}>
        {/* Price Badges / Half & Full Interactive Switcher */}
        {hasHalfPrice ? (
          <div style={{
            display: 'flex',
            gap: '2px',
            background: 'var(--gold-soft)',
            border: '1.5px solid var(--gold-primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px'
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPortionMode('half');
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '4px 9px',
                borderRadius: 'var(--radius-pill)',
                background: portionMode === 'half' ? 'var(--primary-emerald)' : 'transparent',
                color: portionMode === 'half' ? '#FFFFFF' : 'var(--primary-emerald)',
                boxShadow: portionMode === 'half' ? '0 2px 6px rgba(10, 35, 21, 0.2)' : 'none',
                transition: 'var(--transition-fast)'
              }}
            >
              Half {dish.price_half}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setPortionMode('full');
              }}
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '4px 9px',
                borderRadius: 'var(--radius-pill)',
                background: portionMode === 'full' ? 'var(--primary-emerald)' : 'transparent',
                color: portionMode === 'full' ? '#FFFFFF' : 'var(--primary-emerald)',
                boxShadow: portionMode === 'full' ? '0 2px 6px rgba(10, 35, 21, 0.2)' : 'none',
                transition: 'var(--transition-fast)'
              }}
            >
              Full {dish.price}
            </button>
          </div>
        ) : (
          <span 
            onClick={() => onClick(dish)}
            style={{
              fontSize: '1.12rem',
              fontWeight: 800,
              color: 'var(--primary-emerald)',
              background: 'var(--gold-soft)',
              border: '1.5px solid var(--gold-primary)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer'
            }}
          >
            {Number(dish.price).toLocaleString('en-IN')}
          </span>
        )}

        {dish.image && (
          <div 
            onClick={() => onClick(dish)}
            style={{
              width: '62px',
              height: '62px',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1.5px solid var(--gold-border)',
              position: 'relative',
              background: 'var(--gold-soft)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <img
              src={dish.image}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.src = '/uploads/logo.jpg'; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
