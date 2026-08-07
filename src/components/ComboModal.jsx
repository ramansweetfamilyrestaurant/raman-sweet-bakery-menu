import React from 'react';
import { X, Plus, Sparkles, CheckCircle2, Utensils, Tag, ShieldCheck } from 'lucide-react';

export default function ComboModal({ combo, onClose, onAddToCart, canOrder = false, currencySymbol = '₹' }) {
  if (!combo) return null;

  let comboItems = [];
  try {
    comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []);
  } catch {
    comboItems = [];
  }

  const originalTotal = comboItems.reduce((s, i) => s + ((i.original_price || 0) * (i.qty || 1)), 0);
  const savings = originalTotal - combo.price;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: 'rgba(10, 35, 21, 0.82)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          border: '2px solid #D4AF37',
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
            background: 'rgba(0, 0, 0, 0.65)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.4)',
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

        {/* Combo Header Image */}
        <div style={{
          width: '100%',
          height: '240px',
          background: 'linear-gradient(135deg, #05140B 0%, #0A2315 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '5rem', color: '#DFBA67', position: 'absolute', pointerEvents: 'none' }}>🍱</span>
          {combo.image && combo.image !== '/uploads/logo.jpg' && (
            <img
              src={combo.image}
              alt={combo.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 1
              }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}

          {/* Savings Ribbon */}
          {savings > 0 && (
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'linear-gradient(135deg, #15803D 0%, #059669 100%)',
              color: '#FFFFFF',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.75rem',
              fontWeight: 900,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Tag size={12} /> SAVE {currencySymbol}{savings} OFF
            </div>
          )}

          {combo.badge && (
            <div style={{
              position: 'absolute',
              bottom: '14px',
              left: '16px',
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
              color: '#0A2315',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.72rem',
              fontWeight: 900,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Sparkles size={12} /> {combo.badge}
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1
        }}>
          {/* Title & Price Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 900,
                color: 'var(--text-dark)',
                margin: 0,
                lineHeight: 1.2
              }}>
                {combo.name}
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 800 }}>
                🍱 Special Thali / Combo Deal
              </span>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary-emerald)', lineHeight: 1 }}>
                {currencySymbol}{combo.price}
              </div>
              {originalTotal > combo.price && (
                <div style={{ fontSize: '0.8rem', color: '#9CA3AF', textDecoration: 'line-through', marginTop: '2px' }}>
                  {currencySymbol}{originalTotal}
                </div>
              )}
            </div>
          </div>

          {combo.description && (
            <p style={{
              fontSize: '0.84rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              margin: '0 0 16px 0',
              background: 'var(--bg-secondary)',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border-light)'
            }}>
              {combo.description}
            </p>
          )}

          {/* Included Items Section */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{
              fontSize: '0.88rem',
              fontWeight: 900,
              color: 'var(--primary-emerald)',
              margin: '0 0 10px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Utensils size={15} /> What's Included in This Thali ({comboItems.length} Items)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {comboItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FFFFFF',
                  border: '1.5px solid var(--border-light)',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} style={{ color: '#15803D', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                      {item.qty > 1 ? `${item.qty}x ` : ''}{item.dish_name}
                    </span>
                    {item.portion && (
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: '#EEF2FF',
                        color: '#4338CA'
                      }}>
                        {item.portion === 'half' ? 'Half' : item.portion}
                      </span>
                    )}
                  </div>

                  {item.original_price && (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {currencySymbol}{item.original_price * (item.qty || 1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Guarantee Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.78rem',
            color: '#166534',
            fontWeight: 700
          }}>
            <ShieldCheck size={18} style={{ color: '#15803D', flexShrink: 0 }} />
            <span>100% Freshly prepared items included in this curated meal thali.</span>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-light)',
          background: '#FFFFFF'
        }}>
          {canOrder ? (
            <button
              onClick={() => {
                onAddToCart(combo);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary-emerald) 0%, #059669 100%)',
                color: '#FFFFFF',
                fontSize: '0.92rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(16,185,129,0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={18} /> ADD THIS THALI TO CART ({currencySymbol}{combo.price})
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-pill)',
                border: '1.5px solid var(--border-light)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-dark)',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Close Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
