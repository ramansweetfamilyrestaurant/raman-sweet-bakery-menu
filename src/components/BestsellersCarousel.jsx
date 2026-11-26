import React from 'react';
import { Flame } from 'lucide-react';
import { getDishImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';
import { getValidDishModifiers } from '../utils/billingHelper';
import { isFlagEnabled } from '../utils/customerHelpers';
import { triggerHaptic } from '../utils/haptics';

export default function BestsellersCarousel({ dishes = [], onSelectDish, onAddToCart, onUpdateCartQuantity, cartItems = [], modifiersEnabled = true, currencySymbol = '₹', lang = 'en' }) {
  const symbol = getCurrencySymbol(currencySymbol);
  const bestsellers = dishes.filter(d => d.must_try || d.bestseller || d.is_must_try || d.is_bestseller).slice(0, 10);

  if (!bestsellers || bestsellers.length === 0) return null;

  return (
    <div style={{ marginBottom: '22px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '10px',
        padding: '0 4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <Flame size={20} color="var(--accent-coral)" style={{ animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
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
        <span style={{ fontSize: '0.78rem', color: 'var(--gold-bright)', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {bestsellers.length} Items
        </span>
      </div>

      {/* Horizontal Carousel */}
      <div style={{
        display: 'flex',
        gap: '14px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
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
                width: 'clamp(200px, 68vw, 240px)',
                background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1.5px solid var(--theme-card-border, var(--gold-border))',
                boxShadow: 'var(--theme-shadow, var(--shadow-md))',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                position: 'relative'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'var(--theme-card-hover, var(--gold-bright))';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--theme-card-border, var(--gold-border))';
                e.currentTarget.style.boxShadow = 'var(--theme-shadow, var(--shadow-md))';
              }}
            >
              {/* Image */}
              <div style={{
                width: '100%',
                height: '140px',
                position: 'relative',
                background: 'var(--bg-secondary)',
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
                  background: 'var(--dock-gradient, var(--header-gradient))',
                  color: 'var(--gold-bright)',
                  border: '1px solid var(--gold-bright)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  maxWidth: 'calc(100% - 20px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
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
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '8px'
                }}>
                  {dish.offer_price !== undefined && dish.offer_price !== null && dish.offer_price !== '' && Number(dish.offer_price) < Number(dish.price) ? (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                      <span style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.96rem',
                        fontWeight: 900,
                        color: 'var(--theme-price-color, var(--primary-emerald, #059669))'
                      }}>
                        {symbol}{formatPriceNumber(dish.offer_price)}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#94A3B8',
                        textDecoration: 'line-through',
                        fontWeight: 600
                      }}>
                        {symbol}{formatPriceNumber(dish.price)}
                      </span>
                    </div>
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.96rem',
                      fontWeight: 900,
                      color: 'var(--theme-price-color, var(--text-dark, var(--primary-emerald)))'
                    }}>
                      {symbol}{formatPriceNumber(dish.price)}
                    </span>
                  )}
                  {onAddToCart && isFlagEnabled(dish.available, true) ? (() => {
                    const hasHalf = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
                    const hasMods = modifiersEnabled !== false && getValidDishModifiers(dish?.modifiers).length > 0;
                    const simpleMatch = (!hasHalf && !hasMods && Array.isArray(cartItems))
                      ? cartItems.find(i => !i.isCombo && String(i.dish?.id) === String(dish.id) && (!i.modifiers || i.modifiers.length === 0) && String(i.portion_type || 'full') === 'full')
                      : null;
                    const qty = simpleMatch ? simpleMatch.quantity : 0;

                    if (qty > 0 && onUpdateCartQuantity) {
                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'var(--theme-card-bg, #FFFFFF)',
                            border: '1.5px solid var(--primary-emerald, #10B981)',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 3px'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => { triggerHaptic('light'); onUpdateCartQuantity(simpleMatch.key || simpleMatch.dish?.id, -1); }}
                            aria-label="Decrease quantity"
                            style={{ background: 'var(--bg-secondary, #F1F5F9)', color: 'var(--text-dark, #0F172A)', border: 'none', width: '20px', height: '20px', padding: 0, borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          >−</button>
                          <span style={{ minWidth: '14px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 900, color: 'var(--theme-price-color, var(--primary-emerald, #10B981))' }}>{qty}</span>
                          <button
                            type="button"
                            onClick={() => { triggerHaptic('medium'); onUpdateCartQuantity(simpleMatch.key || simpleMatch.dish?.id, 1); }}
                            aria-label="Increase quantity"
                            style={{ background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))', color: 'var(--theme-btn-text, #FFFFFF)', border: 'none', width: '20px', height: '20px', padding: 0, borderRadius: '50%', fontWeight: 900, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          >+</button>
                        </div>
                      );
                    }

                    return (
                      <button
                        type="button"
                        className="tq-tap"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          if ((hasHalf || hasMods) && onSelectDish) {
                            onSelectDish(dish, null, 'addon');
                          } else {
                            onAddToCart(dish, 'full', [], 1, e.currentTarget);
                          }
                        }}
                        style={{
                          background: 'var(--theme-btn-gradient, linear-gradient(135deg, var(--primary-emerald) 0%, var(--gold-primary) 100%))',
                          color: 'var(--theme-btn-text, #FFFFFF)',
                          border: 'none',
                          padding: '4px 10px',
                          whiteSpace: 'nowrap',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          cursor: 'pointer'
                        }}
                      >
                        + Add
                      </button>
                    );
                  })() : (dish.offer_badge || dish.offer?.offer_badge) && (
                    <span style={{
                      fontSize: '0.60rem',
                      fontWeight: 800,
                      color: '#B45309',
                      background: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-pill)',
                      whiteSpace: 'nowrap'
                    }}>
                      🔥 {dish.offer_badge || dish.offer?.offer_badge}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
