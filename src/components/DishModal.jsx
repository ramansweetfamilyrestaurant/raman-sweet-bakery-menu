import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, Clock, Utensils, CheckCircle } from 'lucide-react';
import { resolveImageUrl } from '../utils/imageHelper';

export default function DishModal({ dish, onClose, currencySymbol = '₹' }) {
  if (!dish) return null;

  const symbol = (currencySymbol !== undefined && currencySymbol !== null) ? currencySymbol : '₹';
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const [selectedPortion, setSelectedPortion] = useState(hasHalfPrice ? 'half' : 'full');

  const activePrice = (selectedPortion === 'half' && hasHalfPrice) ? dish.price_half : dish.price;
  const activePortionLabel = selectedPortion === 'half'
    ? (dish.portion_half_label || 'Half Portion')
    : (dish.portion_full_label || dish.portion || 'Full Portion');

  const ingredientsList = dish.ingredients ? dish.ingredients.split(',').map(i => i.trim()) : [];
  const imageSrc = resolveImageUrl(dish.image);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: 'rgba(10, 35, 21, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '88vh',
          boxShadow: 'var(--shadow-lg)',
          border: '2px solid var(--gold-bright)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close Button */}
        <button
          className="price-pill-btn"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            minHeight: 'unset',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)'
          }}
        >
          <X size={18} />
        </button>

        {/* Dish High-Res Photo Header */}
        <div style={{
          width: '100%',
          height: 'min(210px, 30vh)',
          background: 'var(--gold-soft)',
          position: 'relative',
          flexShrink: 0
        }}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={dish.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
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
              fontSize: '3rem'
            }}>
              🍲
            </div>
          )}
          
          {/* FSSAI 100% Pure Veg Badge Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid var(--veg-green-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)'
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
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dark)' }}>
              {dish.type === 'nonveg' ? 'Non-Veg' : dish.type === 'egg' ? 'Contains Egg' : '100% Pure Veg'}
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{
          padding: '16px 18px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '10px',
            marginBottom: '10px'
          }}>
            <div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: 'var(--text-gold)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'block',
                marginBottom: '2px'
              }}>
                {dish.category_name || 'Chef Specialty'}
              </span>

              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--primary-emerald)',
                lineHeight: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {dish.name}
              </h2>
            </div>

            {/* Dynamic Active Price Tag Pill matching Chaat section */}
            <div style={{
              fontSize: '1rem',
              fontWeight: 900,
              padding: '3px 12px',
              borderRadius: 'var(--radius-pill)',
              background: '#FFFFFF',
              color: 'var(--text-dark)',
              border: '1.5px solid var(--border-light)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              flexShrink: 0
            }}>
              {symbol}{Number(activePrice).toLocaleString('en-IN')}
            </div>
          </div>

          {/* Interactive Half / Full Portion Selector */}
          {hasHalfPrice ? (
            <div style={{
              background: 'var(--bg-champagne)',
              border: '1.5px solid var(--gold-border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-emerald)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Select Portion Size:
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="price-pill-btn"
                  onClick={() => setSelectedPortion('half')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    minHeight: 'unset',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    border: selectedPortion === 'half' ? '1.5px solid var(--gold-bright)' : '1px solid var(--gold-border)',
                    background: selectedPortion === 'half' ? 'var(--primary-emerald)' : '#FFFFFF',
                    color: selectedPortion === 'half' ? '#FFFFFF' : 'var(--text-primary)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {dish.portion_half_label || 'Half'} • {symbol}{dish.price_half}
                </button>

                <button
                  className="price-pill-btn"
                  onClick={() => setSelectedPortion('full')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    minHeight: 'unset',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    border: selectedPortion === 'full' ? '1.5px solid var(--gold-bright)' : '1px solid var(--gold-border)',
                    background: selectedPortion === 'full' ? 'var(--primary-emerald)' : '#FFFFFF',
                    color: selectedPortion === 'full' ? '#FFFFFF' : 'var(--text-primary)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {dish.portion_full_label || 'Full'} • {symbol}{dish.price}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {activePortionLabel && (
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--primary-emerald)',
                  background: 'var(--bg-champagne)',
                  border: '1px solid var(--gold-border)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}>
                  📦 {activePortionLabel}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          <p style={{
            fontSize: '0.92rem',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            marginBottom: '20px'
          }}>
            {dish.description || 'Prepared fresh using fine quality ingredients & authentic traditional recipes.'}
          </p>

          {/* Ingredients List */}
          {ingredientsList.length > 0 && (
            <div style={{
              background: 'var(--bg-champagne)',
              border: '1px solid var(--gold-border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px'
            }}>
              <h4 style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: 'var(--primary-emerald)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                marginBottom: '8px'
              }}>
                Key Ingredients & Preparation
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ingredientsList.map((ing, i) => (
                  <span key={i} style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    background: '#FFFFFF',
                    border: '1px solid var(--gold-border)',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)'
                  }}>
                    ✓ {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Availability Footer */}
          <div style={{
            background: 'var(--gold-soft)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            border: '1px solid var(--gold-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--primary-emerald)', fontWeight: 600 }}>
              Availability Status
            </span>
            <span style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: dish.available !== false ? 'var(--veg-green)' : '#EF4444'
            }}>
              {dish.available !== false ? '● Available Fresh Now' : '● Currently Out of Stock'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
