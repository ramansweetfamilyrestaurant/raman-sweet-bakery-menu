import React, { useState } from 'react';

export default function MenuCardItem({ dish, lang, onClick, onAddToCart, currencySymbol }) {
  const symbol = currencySymbol !== undefined ? currencySymbol : '₹';
  const isAvailable = dish.available !== false;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;

  const [portionMode, setPortionMode] = useState(hasHalfPrice ? 'half' : 'full');

  const displayName = (lang === 'hi' && dish.name_hi) ? dish.name_hi : dish.name;
  
  const fullPriceNum = Math.round(Number(dish.price));
  const halfPriceNum = hasHalfPrice ? Math.round(Number(dish.price_half)) : null;

  return (
    <div 
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        marginBottom: '10px',
        border: isAvailable ? '1.5px solid var(--gold-border)' : '1.5px dashed #FCA5A5',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        opacity: isAvailable ? 1 : 0.65,
        position: 'relative',
        transition: 'var(--transition-smooth)',
        overflow: 'hidden'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--gold-bright)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = isAvailable ? 'var(--gold-border)' : '#FCA5A5';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
    >
      {/* Left Details */}
      <div style={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onClick(dish)}>
        {/* Dish Title with Veg Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          {/* Dynamic FSSAI Dietary Symbol (Veg 🟢 / Non-Veg 🔴 / Egg 🟡) */}
          {dish.type === 'nonveg' ? (
            <span style={{
              width: '12px',
              height: '12px',
              border: '1.5px solid #DC2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px',
              flexShrink: 0,
              background: '#FFFFFF'
            }} title="Non-Vegetarian">
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#DC2626'
              }} />
            </span>
          ) : dish.type === 'egg' ? (
            <span style={{
              width: '12px',
              height: '12px',
              border: '1.5px solid #D97706',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px',
              flexShrink: 0,
              background: '#FFFFFF'
            }} title="Contains Egg">
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: '#D97706'
              }} />
            </span>
          ) : (
            <span style={{
              width: '12px',
              height: '12px',
              border: '1.5px solid var(--veg-green)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px',
              flexShrink: 0,
              background: '#FFFFFF'
            }} title="100% Pure Vegetarian">
              <span style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: 'var(--veg-green)'
              }} />
            </span>
          )}

          <h4 style={{
            fontSize: '0.9rem',
            fontWeight: 800,
            color: 'var(--text-dark)',
            margin: 0,
            lineHeight: 1.25,
            whiteSpace: 'normal',
            wordBreak: 'keep-all'
          }}>
            {displayName}
          </h4>
        </div>

        {/* Badge Pill & Sold Out Indicator Row */}
        {(dish.badge || !isAvailable) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            {dish.badge && (() => {
              const lower = dish.badge.toLowerCase();
              let bg = 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)';
              let color = '#92400E';
              let border = '1px solid #D97706';
              let icon = '🏷️';
              
              if (lower.includes('bestseller')) {
                bg = 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)';
                color = '#B45309';
                border = '1px solid #F59E0B';
                icon = '🔥';
              } else if (lower.includes('must try') || lower.includes('musttry')) {
                bg = 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)';
                color = '#B91C1C';
                border = '1px solid #EF4444';
                icon = '⭐';
              } else if (lower.includes('special')) {
                bg = 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)';
                color = '#4338CA';
                border = '1px solid #6366F1';
                icon = '✨';
              } else if (lower.includes('combo')) {
                bg = 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)';
                color = '#6B21A8';
                border = '1px solid #A855F7';
                icon = '🍕';
              } else if (lower.includes('100') || lower.includes('under')) {
                bg = 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)';
                color = '#15803D';
                border = '1px solid #22C55E';
                icon = '⚡';
              }

              return (
                <span style={{
                  fontSize: '0.64rem',
                  fontWeight: 900,
                  color: color,
                  background: bg,
                  border: border,
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  flexShrink: 0
                }}>
                  <span>{icon}</span>
                  <span>{dish.badge}</span>
                </span>
              );
            })()}

            {!isAvailable && (
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: '4px' }}>
                Sold Out
              </span>
            )}
          </div>
        )}

        {/* Description snippet */}
        {dish.description && (
          <p style={{
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            margin: '2px 0 0 0',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {dish.description}
          </p>
        )}
      </div>

      {/* Right Side: Price Pills + Image */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

        {/* Price Area */}
        {hasHalfPrice ? (
          /* Half/Full Price Pills — Both prices visible, selected one highlighted */
          <div 
            style={{ display: 'flex', gap: '4px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPortionMode('half')}
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: 'var(--radius-pill)',
                background: portionMode === 'half' ? 'var(--primary-emerald)' : 'var(--bg-secondary)',
                color: portionMode === 'half' ? '#FFFFFF' : 'var(--text-muted)',
                border: portionMode === 'half' ? '1.5px solid var(--primary-emerald)' : '1.5px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                lineHeight: 1.2
              }}
            >
              Half {symbol}{halfPriceNum}
            </button>
            <button
              onClick={() => setPortionMode('full')}
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: 'var(--radius-pill)',
                background: portionMode === 'full' ? 'var(--primary-emerald)' : 'var(--bg-secondary)',
                color: portionMode === 'full' ? '#FFFFFF' : 'var(--text-muted)',
                border: portionMode === 'full' ? '1.5px solid var(--primary-emerald)' : '1.5px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                lineHeight: 1.2
              }}
            >
              Full {symbol}{fullPriceNum}
            </button>
          </div>
        ) : (
          /* Single Price — no half option */
          <span 
            style={{
              fontSize: '1.02rem',
              fontWeight: 900,
              color: 'var(--primary-emerald)',
              cursor: 'pointer'
            }}
            onClick={() => onClick(dish)}
          >
            {symbol}{fullPriceNum.toLocaleString('en-IN')}
          </span>
        )}

        {/* Dish Thumbnail & + Add WhatsApp Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          {dish.image && dish.image !== '/uploads/logo.jpg' && (
            <div 
              onClick={() => onClick(dish)}
              style={{
                width: '46px',
                height: '46px',
                minWidth: '46px',
                flexShrink: 0,
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
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

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
                fontSize: '0.68rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.4)'
              }}
              title="Add to WhatsApp Order Cart"
            >
              + Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
