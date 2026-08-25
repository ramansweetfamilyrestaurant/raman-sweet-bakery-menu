import React from 'react';
import { ChevronRight } from 'lucide-react';
import { getDishImageUrl } from '../utils/imageHelper';

export default function DishCard({ dish, onClick, onAddToCart, currencySymbol = '₹', lang = 'en', filtersVisibility }) {
  const symbol = (currencySymbol !== undefined && currencySymbol !== null) ? currencySymbol : '₹';
  const isAvailable = dish.available !== false;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const imageSrc = getDishImageUrl(dish.image);
  const displayName = (lang === 'hi' && dish.name_hi) ? dish.name_hi : dish.name;
  const displayDesc = (lang === 'hi' && dish.description_hi) ? dish.description_hi : dish.description;
  const hasModifiers = Boolean(
    dish.modifiers && (
      (Array.isArray(dish.modifiers) && dish.modifiers.length > 0) ||
      (typeof dish.modifiers === 'string' && dish.modifiers.length > 4 && dish.modifiers !== '[]')
    )
  );

  return (
    <article 
      onClick={() => onClick(dish)}
      style={{
        background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--theme-shadow, var(--shadow-sm))',
        border: '1.5px solid var(--theme-card-border, var(--border-light))',
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
        e.currentTarget.style.borderColor = 'var(--theme-card-hover, var(--gold-bright))';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--theme-shadow, var(--shadow-sm))';
        e.currentTarget.style.borderColor = 'var(--theme-card-border, var(--border-light))';
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
          gap: '4px',
          zIndex: 5,
          pointerEvents: 'none'
        }}>
          {/* Dynamic Dietary Badge */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(6px)',
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

          {/* Customizable / Add-ons Badge */}
          {(hasModifiers || hasHalfPrice) && (
            <div style={{
              background: '#0A2315',
              color: '#DFBA67',
              border: '1px solid #DFBA67',
              borderRadius: 'var(--radius-pill)',
              padding: '2px 7px',
              fontSize: '0.62rem',
              fontWeight: 900,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              letterSpacing: '0.2px'
            }}>
              ✨ Customizable
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
              {displayName}
            </h3>

            <span style={{
              fontSize: '0.86rem',
              fontWeight: 900,
              color: 'var(--theme-price-color, var(--text-dark))',
              background: 'var(--theme-badge-bg, var(--bg-card-soft, #FFFFFF))',
              border: '1.5px solid var(--theme-card-border, var(--border-light))',
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--theme-shadow, 0 1px 4px rgba(0,0,0,0.06))'
            }}>
              {symbol}{Number(dish.price).toLocaleString('en-IN')}
            </span>
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
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--primary-emerald)'
          }}>
            {hasHalfPrice ? `Half ${symbol}${dish.price_half} | Full ${symbol}${dish.price}` : (dish.portion || 'Special Portion')}
          </span>

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {onAddToCart && isAvailable && (
              hasHalfPrice ? (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(dish, 'half');
                    }}
                    style={{
                      background: 'var(--theme-btn-secondary-bg, linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%))',
                      color: 'var(--theme-text-primary, #92400E)',
                      border: '1px solid var(--theme-card-border, #F59E0B)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: 'var(--theme-shadow, 0 2px 8px rgba(0, 0, 0, 0.15))',
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    + Half
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(dish, 'full');
                    }}
                    style={{
                      background: 'var(--theme-btn-gradient, linear-gradient(135deg, var(--primary-emerald) 0%, var(--gold-primary) 100%))',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.7rem',
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: 'var(--theme-shadow, 0 3px 10px rgba(0, 0, 0, 0.25))',
                      transition: 'transform 0.15s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    + Full
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(dish, 'full');
                  }}
                  style={{
                    background: 'var(--theme-btn-gradient, linear-gradient(135deg, var(--primary-emerald) 0%, var(--gold-primary) 100%))',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '4px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.74rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: 'var(--theme-shadow, 0 3px 10px rgba(0, 0, 0, 0.25))',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  + Add
                </button>
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
}
