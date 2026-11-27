import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getDishImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';
import { getValidDishModifiers } from '../utils/billingHelper';
import { triggerHaptic } from '../utils/haptics';
import { isFlagEnabled } from '../utils/customerHelpers';

const DishCard = React.memo(function DishCard({ dish, onClick, onAddToCart, onUpdateCartQuantity, cartItems = [], dishCartItems = null, currencySymbol = '₹', lang = 'en', filtersVisibility, modifiersEnabled = true }) {
  const symbol = getCurrencySymbol(currencySymbol);
  const isAvailable = isFlagEnabled(dish.available, true);
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const imageSrc = getDishImageUrl(dish.image);
  const displayName = (lang === 'hi' && dish.name_hi) ? dish.name_hi : dish.name;
  const displayDesc = (lang === 'hi' && dish.description_hi) ? dish.description_hi : dish.description;
  const hasModifiers = modifiersEnabled !== false && getValidDishModifiers(dish?.modifiers).length > 0;
  const effectiveCartItems = dishCartItems ?? cartItems;

  const handleAddAction = (e, portion) => {
    e.stopPropagation();
    triggerHaptic('medium');
    if (hasModifiers && onClick) {
      onClick(dish, portion, 'addon');
    } else {
      onAddToCart(dish, portion, [], 1, e.currentTarget);
    }
  };

  const renderCartAction = (portion, label, isSecondary = false) => {
    const matchedItem = (!hasModifiers && Array.isArray(effectiveCartItems))
      ? effectiveCartItems.find(i => !i.isCombo && String(i.dish?.id) === String(dish.id) && (!i.modifiers || i.modifiers.length === 0) && String(i.portion_type || 'full') === portion)
      : null;
    const qty = matchedItem ? matchedItem.quantity : 0;

    if (qty > 0 && onUpdateCartQuantity) {
      return (
        <div
          key={`stepper-${portion}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'var(--theme-card-bg, #FFFFFF)',
            border: isSecondary ? '1.5px solid #F59E0B' : '1.5px solid var(--primary-emerald, #10B981)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px 3px',
            boxShadow: 'var(--theme-shadow, 0 2px 6px rgba(0, 0, 0, 0.12))',
            animation: 'tqPopIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <button
            type="button"
            className="tq-tap"
            onClick={() => {
              triggerHaptic('light');
              onUpdateCartQuantity(matchedItem.key || matchedItem.dish?.id, -1);
            }}
            aria-label="Decrease quantity"
            style={{
              background: 'var(--bg-secondary, #F1F5F9)',
              color: 'var(--text-dark, #0F172A)',
              border: 'none',
              width: '20px',
              height: '20px',
              padding: 0,
              borderRadius: '50%',
              fontWeight: 900,
              cursor: 'pointer',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            −
          </button>
          <span
            className="tq-qty-pop"
            style={{
              minWidth: '14px',
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: 900,
              color: isSecondary ? '#B45309' : 'var(--theme-price-color, var(--primary-emerald, #10B981))'
            }}
          >
            {qty}
          </span>
          <button
            type="button"
            className="tq-tap"
            onClick={() => {
              triggerHaptic('medium');
              onUpdateCartQuantity(matchedItem.key || matchedItem.dish?.id, 1);
            }}
            aria-label="Increase quantity"
            style={{
              background: isSecondary
                ? 'var(--theme-btn-secondary-bg, linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%))'
                : 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
              color: isSecondary ? '#92400E' : 'var(--theme-btn-text, #FFFFFF)',
              border: 'none',
              width: '20px',
              height: '20px',
              padding: 0,
              borderRadius: '50%',
              fontWeight: 900,
              cursor: 'pointer',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
          >
            +
          </button>
        </div>
      );
    }

    return (
      <button
        key={`add-${portion}`}
        className="tq-tap"
        onClick={(e) => handleAddAction(e, portion)}
        style={{
          background: isSecondary
            ? 'var(--theme-btn-secondary-bg, linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%))'
            : 'var(--theme-btn-gradient, linear-gradient(135deg, var(--primary-emerald) 0%, var(--gold-primary) 100%))',
          color: isSecondary ? 'var(--theme-text-primary, #92400E)' : 'var(--theme-btn-text, #FFFFFF)',
          border: isSecondary ? '1px solid var(--theme-card-border, #F59E0B)' : 'none',
          padding: hasHalfPrice ? '4px 11px' : '4px 14px',
          whiteSpace: 'nowrap',
          borderRadius: 'var(--radius-pill)',
          fontSize: hasHalfPrice ? '0.7rem' : '0.74rem',
          fontWeight: 900,
          cursor: 'pointer',
          boxShadow: isSecondary ? 'var(--theme-shadow, 0 2px 8px rgba(0, 0, 0, 0.15))' : 'var(--theme-shadow, 0 3px 10px rgba(0, 0, 0, 0.25))',
          transition: 'transform 0.08s ease',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <article
      onClick={() => {
        triggerHaptic('light');
        onClick(dish);
      }}
      style={{
        background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
        border: '1.5px solid var(--theme-card-border, var(--border-light))',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.1s ease',
        cursor: 'pointer',
        opacity: isAvailable ? 1 : 0.6,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent'
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
          src={imageSrc} 
          alt={dish.name}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = '/images/default-dish.webp';
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />

        {/* Ultra-Clean Non-Overlapping Badges Overlay */}
        <div style={{
          position: 'absolute',
          top: '6px',
          left: '6px',
          right: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          zIndex: 5,
          pointerEvents: 'none'
        }}>
          {/* Dynamic Dietary Badge */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.96)',
            border: dish.type === 'nonveg' ? '1px solid #DC2626' : dish.type === 'egg' ? '1px solid #D97706' : '1px solid var(--veg-green)',
            borderRadius: 'var(--radius-pill)',
            padding: '1.5px 5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
            maxWidth: '50%'
          }}>
            <span style={{
              width: '7px',
              height: '7px',
              border: dish.type === 'nonveg' ? '1.5px solid #DC2626' : dish.type === 'egg' ? '1.5px solid #D97706' : '1.5px solid var(--veg-green)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px',
              padding: '1px'
            }}>
              <span style={{
                width: '3.5px',
                height: '3.5px',
                borderRadius: '50%',
                background: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#D97706' : 'var(--veg-green)'
              }} />
            </span>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              color: dish.type === 'nonveg' ? '#991B1B' : dish.type === 'egg' ? '#92400E' : 'var(--primary-dark-green)',
              textTransform: 'uppercase',
              letterSpacing: '0.2px'
            }}>
              {dish.type === 'nonveg' ? 'Non-Veg' : dish.type === 'egg' ? 'Egg' : 'Veg'}
            </span>
          </div>

          {/* Special Offer Badge */}
          {(dish.offer_badge || dish.offer?.offer_badge) && (
            <div style={{
              background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
              color: '#B45309',
              border: '1px solid #F59E0B',
              borderRadius: 'var(--radius-pill)',
              padding: '2px 7px',
              fontSize: '0.62rem',
              fontWeight: 900,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              display: 'inline-block',
              maxWidth: '48%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              🔥 {dish.offer_badge || dish.offer?.offer_badge}
            </div>
          )}

          {/* Customizable / Add-ons Badge */}
          {(hasModifiers || hasHalfPrice) && !(dish.offer_badge || dish.offer?.offer_badge) && filtersVisibility?.customizable !== false && (
            <div style={{
              background: 'var(--theme-badge-bg, rgba(255, 255, 255, 0.95))',
              color: 'var(--theme-badge-text, var(--primary-emerald, #0A2315))',
              border: '1px solid var(--theme-card-border, var(--border-light, rgba(0, 0, 0, 0.15)))',
              borderRadius: 'var(--radius-pill)',
              padding: '2px 7px',
              fontSize: '0.62rem',
              fontWeight: 800,
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              letterSpacing: '0.2px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              maxWidth: '48%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              ✨ {lang === 'hi' ? 'कस्टमाइज़ेबल' : 'Customizable'}
            </div>
          )}

          {/* Dynamic Custom Special Badge (Must Try, Bestseller, etc.) */}
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
              if (filtersVisibility?.must_try === false) return null;
              bg = 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)';
              color = '#B91C1C';
              border = '1px solid #EF4444';
              icon = '⭐';
            } else if (lower.includes('special')) {
              if (filtersVisibility?.special === false) return null;
              bg = 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)';
              color = '#4338CA';
              border = '1px solid #6366F1';
              icon = '✨';
            } else if (lower.includes('combo')) {
              if (filtersVisibility?.combo === false) return null;
              bg = 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)';
              color = '#6B21A8';
              border = '1px solid #A855F7';
              icon = '🍕';
            } else if (lower.includes('100') || lower.includes('under')) {
              if (filtersVisibility?.under100 === false) return null;
              bg = 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)';
              color = '#15803D';
              border = '1px solid #22C55E';
              icon = '⚡';
            }

            return (
              <div style={{
                background: bg,
                color: color,
                border: border,
                borderRadius: 'var(--radius-pill)',
                padding: '1.5px 6px',
                fontSize: '0.56rem',
                fontWeight: 900,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                whiteSpace: 'nowrap',
                maxWidth: '50%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginLeft: 'auto'
              }}>
                <span style={{ fontSize: '0.62rem' }}>{icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.badge}</span>
              </div>
            );
          })()}
        </div>

        {!isAvailable && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(33, 37, 41, 0.72)',
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
              lineHeight: 1.25,
              minWidth: 0,
              flex: 1,
              overflowWrap: 'break-word',
              margin: 0
            }}>
              {displayName}
            </h3>

            {dish.offer_price !== undefined && dish.offer_price !== null && dish.offer_price !== '' && Number(dish.offer_price) < Number(dish.price) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.96rem',
                  fontWeight: 900,
                  color: 'var(--theme-price-color, var(--primary-emerald, #059669))',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.15
                }}>
                  {symbol}{formatPriceNumber(dish.offer_price)}
                </span>
                <span style={{
                  fontSize: '0.70rem',
                  color: '#94A3B8',
                  textDecoration: 'line-through',
                  fontWeight: 600,
                  lineHeight: 1.1
                }}>
                  {symbol}{formatPriceNumber(dish.price)}
                </span>
              </div>
            ) : (
              <span style={{
                fontSize: '0.96rem',
                fontWeight: 900,
                color: 'var(--theme-price-color, var(--text-dark))',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                flexShrink: 0
              }}>
                {symbol}{formatPriceNumber(dish.price)}
              </span>
            )}
          </div>

          {displayDesc && (
            <p style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {displayDesc}
            </p>
          )}
        </div>

        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--theme-divider, var(--border-light))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--primary-emerald)'
          }}>
            {hasHalfPrice ? `${lang === 'hi' ? 'हाफ' : 'Half'} ${symbol}${formatPriceNumber(dish.price_half)} | ${lang === 'hi' ? 'फुल' : 'Full'} ${symbol}${formatPriceNumber(dish.offer_price !== undefined && dish.offer_price !== null && dish.offer_price !== '' && Number(dish.offer_price) < Number(dish.price) ? dish.offer_price : dish.price)}` : (dish.portion && !dish.portion.toLowerCase().includes('portion') ? dish.portion : '')}
          </span>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px'
          }}>
            {onAddToCart && isAvailable && (
              hasHalfPrice ? (
                <>
                  {renderCartAction('half', '+ Half', true)}
                  {renderCartAction('full', '+ Full', false)}
                </>
              ) : (
                renderCartAction('full', '+ Add', false)
              )
            )}

            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--primary-emerald)'
            }}>
              View <ChevronRight size={14} />
            </span>
          </span>
        </div>
      </div>
    </article>
  );
});

export default DishCard;
