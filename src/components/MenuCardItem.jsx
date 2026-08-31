import React, { useState } from 'react';
import { getDishImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';
import { triggerHaptic } from '../utils/haptics';

export default function MenuCardItem({ dish, lang, onClick, onAddToCart, currencySymbol, filtersVisibility }) {
  const symbol = getCurrencySymbol(currencySymbol);
  const isAvailable = dish.available !== false;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const imageSrc = getDishImageUrl(dish.image);

  const [portionMode, setPortionMode] = useState(hasHalfPrice ? 'half' : 'full');

  const displayName = (lang === 'hi' && dish.name_hi) ? dish.name_hi : dish.name;
  
  const fullPriceNum = Math.round(Number(dish.price));
  const halfPriceNum = hasHalfPrice ? Math.round(Number(dish.price_half)) : null;

  return (
    <div 
      style={{
        background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        marginBottom: '10px',
        border: isAvailable ? '1.5px solid var(--theme-card-border, var(--gold-border))' : '1.5px dashed #FCA5A5',
        boxShadow: 'var(--theme-shadow, var(--shadow-md))',
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
        e.currentTarget.style.borderColor = 'var(--theme-card-hover, var(--gold-bright))';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = isAvailable ? 'var(--theme-card-border, var(--gold-border))' : '#FCA5A5';
        e.currentTarget.style.boxShadow = 'var(--theme-shadow, var(--shadow-md))';
      }}
    >
      {/* Left Details */}
      <div 
        style={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} 
        onClick={() => {
          triggerHaptic('light');
          onClick(dish);
        }}
      >
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
            wordBreak: 'break-word'
          }}>
            {displayName}
          </h4>
        </div>

        {/* Badge Pill & Sold Out Indicator Row */}
        {(dish.badge || (dish.offer_badge || dish.offer?.offer_badge) || !isAvailable) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            {/* Special Offer Badge */}
            {(dish.offer_badge || dish.offer?.offer_badge) && (
              <span style={{
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                color: '#B45309',
                border: '1px solid #F59E0B',
                borderRadius: 'var(--radius-pill)',
                padding: '2px 7px',
                fontSize: '0.62rem',
                fontWeight: 900,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                🔥 {dish.offer_badge || dish.offer?.offer_badge}
              </span>
            )}

            {dish.badge && (() => {
              const lower = dish.badge.toLowerCase();
              let bg = 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)';
              let color = '#92400E';
              let border = '1px solid #D97706';
              let icon = '🏷️';
              
              if (lower.includes('must') || lower.includes('try')) {
                bg = 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)';
                color = '#991B1B';
                border = '1px solid #DC2626';
                icon = '🔥';
              } else if (lower.includes('best') || lower.includes('seller') || lower.includes('star')) {
                bg = 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)';
                color = '#78350F';
                border = '1px solid #D97706';
                icon = '⭐';
              } else if (lower.includes('chef') || lower.includes('special')) {
                bg = 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)';
                color = '#14532D';
                border = '1px solid #16A34A';
                icon = '👨‍🍳';
              } else if (lower.includes('sweet') || lower.includes('sugar') || lower.includes('mithai')) {
                bg = 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)';
                color = '#831843';
                border = '1px solid #DB2777';
                icon = '🍬';
              }

              return (
                <span style={{
                  background: bg,
                  color: color,
                  border: border,
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 7px',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}>
                  {icon} {dish.badge}
                </span>
              );
            })()}
          </div>
        )}

        {/* Short description */}
        {(dish.description || dish.description_hi) && (
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {(lang === 'hi' && dish.description_hi) ? dish.description_hi : dish.description}
          </p>
        )}

        {/* Portion Selector Pill (Half vs Full) */}
        {hasHalfPrice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                setPortionMode('half');
              }}
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: portionMode === 'half' ? 'var(--primary-emerald)' : 'var(--bg-secondary)',
                color: portionMode === 'half' ? '#FFFFFF' : 'var(--text-muted)',
                border: portionMode === 'half' ? '1px solid var(--primary-emerald)' : '1px solid var(--border-light)',
                cursor: 'pointer'
              }}
            >
              {dish.portion_half_label || 'Half'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                setPortionMode('full');
              }}
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: portionMode === 'full' ? 'var(--primary-emerald)' : 'var(--bg-secondary)',
                color: portionMode === 'full' ? '#FFFFFF' : 'var(--text-muted)',
                border: portionMode === 'full' ? '1px solid var(--primary-emerald)' : '1px solid var(--border-light)',
                cursor: 'pointer'
              }}
            >
              {dish.portion_full_label || 'Full'}
            </button>
          </div>
        )}
      </div>

      {/* Right Pricing & Thumbnail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Pricing Pill */}
        {hasHalfPrice ? (
          <div 
            style={{
              fontSize: '0.86rem',
              fontWeight: 900,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--theme-badge-bg, var(--bg-card-soft, #FFFFFF))',
              color: 'var(--theme-price-color, var(--text-dark))',
              border: '1.5px solid var(--theme-card-border, var(--border-light))',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              boxShadow: 'var(--theme-shadow, 0 1px 4px rgba(0,0,0,0.06))',
              cursor: 'pointer'
            }}
            onClick={() => {
              triggerHaptic('light');
              onClick(dish);
            }}
          >
            {symbol}{formatPriceNumber(portionMode === 'half' ? halfPriceNum : fullPriceNum)}
          </div>
        ) : (
          dish.offer_price !== undefined && dish.offer_price !== null ? (
            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                cursor: 'pointer'
              }}
              onClick={() => {
                triggerHaptic('light');
                onClick(dish);
              }}
            >
              <div style={{
                fontSize: '0.88rem',
                fontWeight: 900,
                color: '#059669',
                lineHeight: 1.1
              }}>
                {symbol}{formatPriceNumber(dish.offer_price)}
              </div>
              <span style={{
                fontSize: '0.68rem',
                color: '#94A3B8',
                textDecoration: 'line-through',
                fontWeight: 600,
                marginRight: '2px'
              }}>
                {symbol}{formatPriceNumber(fullPriceNum)}
              </span>
            </div>
          ) : (
            <div 
              style={{
                fontSize: '0.86rem',
                fontWeight: 900,
                padding: '3px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--theme-badge-bg, var(--bg-card-soft, #FFFFFF))',
                color: 'var(--theme-price-color, var(--text-dark))',
                border: '1.5px solid var(--theme-card-border, var(--border-light))',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                boxShadow: 'var(--theme-shadow, 0 1px 4px rgba(0,0,0,0.06))',
                cursor: 'pointer'
              }}
              onClick={() => {
                triggerHaptic('light');
                onClick(dish);
              }}
            >
              {symbol}{formatPriceNumber(fullPriceNum)}
            </div>
          )
        )}

        {/* Dish Thumbnail & + Add WhatsApp Button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div 
            onClick={() => {
              triggerHaptic('light');
              onClick(dish);
            }}
            style={{
              width: '46px',
              height: '46px',
              minWidth: '46px',
              flexShrink: 0,
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              border: '1.5px solid var(--theme-card-border, var(--gold-border))',
              position: 'relative',
              background: 'var(--bg-secondary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <img
              src={imageSrc}
              alt={displayName}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
            />
          </div>

          {onAddToCart && isAvailable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('medium');
                onAddToCart(dish, hasHalfPrice ? portionMode : 'full');
              }}
              style={{
                background: 'var(--theme-btn-gradient, linear-gradient(135deg, var(--primary-emerald) 0%, var(--gold-primary) 100%))',
                color: '#FFFFFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.72rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: 'var(--theme-shadow, 0 3px 10px rgba(0, 0, 0, 0.25))',
                transition: 'transform 0.15s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title="Add to Order Cart"
            >
              + Add
            </button>
          )}

          {!isAvailable && (
            <span style={{
              background: '#FEE2E2',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.66rem',
              fontWeight: 900,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              🚫 {lang === 'hi' ? 'आज अनुपलब्ध' : 'Out of Stock'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
