import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, Clock, Utensils, CheckCircle } from 'lucide-react';

export default function DishModal({ dish, onClose }) {
  if (!dish) return null;

  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const [selectedPortion, setSelectedPortion] = useState(hasHalfPrice ? 'half' : 'full');

  const activePrice = (selectedPortion === 'half' && hasHalfPrice) ? dish.price_half : dish.price;
  const activePortionLabel = selectedPortion === 'half'
    ? (dish.portion_half_label || 'Half Portion')
    : (dish.portion_full_label || dish.portion || 'Full Portion');

  const ingredientsList = dish.ingredients ? dish.ingredients.split(',').map(i => i.trim()) : [];

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
      padding: '20px'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
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
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
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
          height: '270px',
          background: 'var(--gold-soft)',
          position: 'relative'
        }}>
          <img
            src={dish.image || '/uploads/logo.jpg'}
            alt={dish.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          
          {/* FSSAI 100% Pure Veg Badge Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '14px',
            left: '14px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid var(--veg-green-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)'
          }}>
            <span style={{
              width: '12px',
              height: '12px',
              border: '1.5px solid var(--veg-green)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--veg-green)'
              }} />
            </span>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: 'var(--primary-emerald)',
              letterSpacing: '0.5px'
            }}>
              100% PURE VEGETARIAN
            </span>
          </div>

          {/* Badge Tag Overlay */}
          {dish.badge && (
            <div style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
              color: 'var(--gold-bright)',
              border: '1px solid var(--gold-bright)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              boxShadow: 'var(--shadow-gold)'
            }}>
              {dish.badge}
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '14px',
            marginBottom: '10px'
          }}>
            <div>
              <span style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: 'var(--text-gold)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'block',
                marginBottom: '4px'
              }}>
                {dish.category_name || 'Chef Specialty'}
              </span>

              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--primary-emerald)',
                lineHeight: 1.2
              }}>
                {dish.name}
              </h2>
            </div>

            {/* Dynamic Active Price Tag (No ₹ Symbol) */}
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.4rem',
              fontWeight: 700,
              color: 'var(--primary-emerald)',
              background: 'var(--gold-soft)',
              border: '1.5px solid var(--gold-primary)',
              padding: '4px 14px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {Number(activePrice).toLocaleString('en-IN')}
            </span>
          </div>

          {/* Interactive Half / Full Portion Selector */}
          {hasHalfPrice ? (
            <div style={{
              background: 'var(--bg-champagne)',
              border: '1.5px solid var(--gold-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary-emerald)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Select Portion Size:
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setSelectedPortion('half')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: selectedPortion === 'half' ? '1.5px solid var(--gold-bright)' : '1px solid var(--gold-border)',
                    background: selectedPortion === 'half' ? 'var(--primary-emerald)' : '#FFFFFF',
                    color: selectedPortion === 'half' ? '#FFFFFF' : 'var(--text-primary)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {dish.portion_half_label || 'Half'} • {dish.price_half}
                </button>

                <button
                  onClick={() => setSelectedPortion('full')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: selectedPortion === 'full' ? '1.5px solid var(--gold-bright)' : '1px solid var(--gold-border)',
                    background: selectedPortion === 'full' ? 'var(--primary-emerald)' : '#FFFFFF',
                    color: selectedPortion === 'full' ? '#FFFFFF' : 'var(--text-primary)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {dish.portion_full_label || 'Full'} • {dish.price}
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
