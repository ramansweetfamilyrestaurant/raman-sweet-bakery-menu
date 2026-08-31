import React from 'react';
import { X, Plus, Sparkles, CheckCircle2, Utensils, Tag, ShieldCheck } from 'lucide-react';
import { resolveImageUrl, getComboImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';

export default function ComboModal({ combo, onClose, onAddToCart, canOrder = false, currencySymbol = '₹' }) {
  if (!combo) return null;

  const symbol = getCurrencySymbol(currencySymbol);

  let comboItems = [];
  try {
    comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []);
  } catch {
    comboItems = [];
  }

  const originalTotal = comboItems.reduce((s, i) => s + ((Number(i.original_price) || 0) * (i.qty || 1)), 0);
  const savings = originalTotal - Number(combo.price || 0);
  const imageSrc = getComboImageUrl(combo.image);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3500,
      background: 'rgba(10, 25, 16, 0.75)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px'
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className="combo-view-modal"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1.5px solid #DFBA67',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @media (max-width: 600px) {
            .combo-view-modal {
              max-width: 100% !important;
              border-radius: 16px !important;
              max-height: 94vh !important;
            }
            .combo-header-img {
              height: 160px !important;
            }
            .combo-view-body {
              padding: 14px 16px !important;
            }
          }
        `}} />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.65)',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)'
          }}
        >
          <X size={16} />
        </button>

        {/* Combo Header Image */}
        <div className="combo-header-img" style={{
          width: '100%',
          height: '200px',
          background: 'linear-gradient(135deg, #05140B 0%, #0A2315 100%)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img
            src={imageSrc}
            alt={combo.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'relative',
              zIndex: 1
            }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/default-combo.webp';
            }}
          />

          {/* Savings Ribbon */}
          {savings > 0 && (
            <div style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'linear-gradient(135deg, #15803D 0%, #059669 100%)',
              color: '#FFFFFF',
              padding: '3px 10px',
              borderRadius: '100px',
              fontSize: '0.70rem',
              fontWeight: 900,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 2
            }}>
              <Tag size={11} /> SAVE {symbol}{savings}
            </div>
          )}

          {combo.badge && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '12px',
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
              color: '#0A2315',
              padding: '3px 10px',
              borderRadius: '100px',
              fontSize: '0.68rem',
              fontWeight: 900,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 2
            }}>
              <Sparkles size={11} /> {combo.badge}
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="combo-view-body" style={{
          padding: '16px 18px',
          overflowY: 'auto',
          flex: 1
        }}>
          {/* Title & Price Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <div>
              <h2 style={{
                fontSize: '1.1rem',
                fontWeight: 900,
                color: '#0F172A',
                margin: 0,
                lineHeight: 1.25
              }}>
                {combo.name}
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 800 }}>
                🍱 Special Thali / Curated Combo
              </span>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: '8px',
                background: '#F0FDF4',
                color: '#16A34A',
                border: '1px solid #BBF7D0',
                whiteSpace: 'nowrap',
                lineHeight: 1.2
              }}>
                {symbol}{formatPriceNumber(combo.price)}
              </div>
              {originalTotal > Number(combo.price || 0) && (
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', textDecoration: 'line-through', marginTop: '2px', textAlign: 'center' }}>
                  {symbol}{formatPriceNumber(originalTotal)}
                </div>
              )}
            </div>
          </div>

          {combo.description && (
            <p style={{
              fontSize: '0.80rem',
              color: '#475569',
              lineHeight: 1.45,
              margin: '0 0 12px 0',
              background: '#F8FAFC',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0'
            }}>
              {combo.description}
            </p>
          )}

          {/* Included Items Section */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#0A2315',
              margin: '0 0 8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Utensils size={13} color="#D4AF37" /> What's Included ({comboItems.length} Items)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comboItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  padding: '7px 10px',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                      {item.qty > 1 ? `${item.qty}x ` : ''}{item.dish_name}
                    </span>
                    {item.portion && (
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: '#EEF2FF',
                        color: '#4338CA'
                      }}>
                        {item.portion === 'half' ? 'Half' : item.portion}
                      </span>
                    )}
                  </div>

                  {item.original_price && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B' }}>
                      {symbol}{item.original_price * (item.qty || 1)}
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
            gap: '6px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            color: '#166534',
            fontWeight: 700
          }}>
            <ShieldCheck size={15} style={{ color: '#16A34A', flexShrink: 0 }} />
            <span>100% Freshly prepared meal thali.</span>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid #E2E8F0',
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
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #0A2315 0%, #143A24 100%)',
                color: '#FFFFFF',
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(10, 35, 21, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={16} /> ADD THALI TO CART ({symbol}{formatPriceNumber(combo.price)})
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 700,
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
