import React from 'react';
import { X, Plus, Sparkles, CheckCircle2, Utensils, Tag, ShieldCheck } from 'lucide-react';
import { getComboImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';

export default function ComboModal({ 
  combo, 
  onClose, 
  onAddToCart, 
  canOrder = false, 
  currencySymbol = '₹',
  lang = 'en',
  restoType,
  foodType,
  isPureVeg: isPureVegProp
}) {
  if (!combo) return null;

  const symbol = getCurrencySymbol(currencySymbol);

  let comboItems = [];
  try {
    comboItems = typeof combo.items === 'string' ? JSON.parse(combo.items) : (combo.items || []);
  } catch {
    comboItems = [];
  }

  // Calculate prices and offers
  const regularPrice = (combo.regular_price !== undefined && combo.regular_price !== null) 
    ? Number(combo.regular_price) 
    : Number(combo.price || 0);
  const effectivePrice = (combo.offer_price !== undefined && combo.offer_price !== null) 
    ? Number(combo.offer_price) 
    : regularPrice;
  const originalTotal = comboItems.reduce((s, i) => s + ((Number(i.original_price) || 0) * (i.qty || 1)), 0);
  const savings = originalTotal > effectivePrice 
    ? originalTotal - effectivePrice 
    : (regularPrice > effectivePrice ? regularPrice - effectivePrice : 0);

  const imageSrc = getComboImageUrl(combo.image);

  // Dietary check
  const isPureVegResto = typeof isPureVegProp === 'boolean'
    ? isPureVegProp
    : (foodType ? (foodType === 'pure_veg' || foodType === 'vegan') : (restoType === 'pure_veg'));

  const textToCheck = `${combo.name || ''} ${combo.description || ''} ${comboItems.map(i => i.dish_name || '').join(' ')}`.toLowerCase();
  const isNonVeg = textToCheck.includes('chicken') || textToCheck.includes('mutton') || textToCheck.includes('fish') || textToCheck.includes('egg');
  const isVeg = isPureVegResto || !isNonVeg;

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
          background: 'var(--theme-modal-bg, #FFFFFF)',
          borderRadius: '20px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1.5px solid var(--theme-modal-border, var(--gold-bright, #DFBA67))',
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
          aria-label="Close modal"
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
          background: 'var(--theme-modal-header, linear-gradient(135deg, #05140B 0%, #0A2315 100%))',
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
              e.currentTarget.src = '/images/default-combo.webp?v=3';
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
              <Tag size={11} /> {lang === 'hi' ? `बचत ${symbol}${formatPriceNumber(savings)}` : `SAVE ${symbol}${formatPriceNumber(savings)}`}
            </div>
          )}

          {/* Active Offer / Special Badge */}
          {(combo.offer_badge || combo.badge) && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '12px',
              background: 'var(--gold-gradient, linear-gradient(135deg, #FFD700 0%, #D4AF37 100%))',
              color: 'var(--dock-btn-text, #0A2315)',
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
              <Sparkles size={11} /> {combo.offer_badge || combo.badge}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Veg / Non-Veg Indicator Icon */}
                <span 
                  title={isVeg ? 'Pure Veg' : 'Non-Veg'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '16px',
                    height: '16px',
                    border: isVeg ? '1.5px solid #16A34A' : '1.5px solid #DC2626',
                    borderRadius: '4px',
                    padding: '2px',
                    flexShrink: 0
                  }}
                >
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: isVeg ? '#16A34A' : '#DC2626'
                  }} />
                </span>

                <h2 style={{
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  color: 'var(--text-dark, #0F172A)',
                  margin: 0,
                  lineHeight: 1.25
                }}>
                  {combo.name}
                </h2>
              </div>

              <span style={{ fontSize: '0.72rem', color: 'var(--theme-price-color, var(--primary-emerald, #16A34A))', fontWeight: 800, display: 'block', marginTop: '3px' }}>
                🍱 {lang === 'hi' ? 'विशेष थाली / क्यूरेटेड कॉम्बो' : 'Special Thali / Curated Combo'}
              </span>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                padding: '3px 10px',
                borderRadius: '8px',
                background: 'var(--theme-badge-bg, #F0FDF4)',
                color: 'var(--theme-price-color, #16A34A)',
                border: '1px solid var(--theme-card-border, #BBF7D0)',
                whiteSpace: 'nowrap',
                lineHeight: 1.2
              }}>
                {symbol}{formatPriceNumber(effectivePrice)}
              </div>
              {(originalTotal > effectivePrice || regularPrice > effectivePrice) && (
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', textDecoration: 'line-through', marginTop: '2px', textAlign: 'center' }}>
                  {symbol}{formatPriceNumber(originalTotal > effectivePrice ? originalTotal : regularPrice)}
                </div>
              )}
            </div>
          </div>

          {combo.description && (
            <p style={{
              fontSize: '0.80rem',
              color: 'var(--text-muted, #475569)',
              lineHeight: 1.45,
              margin: '0 0 12px 0',
              background: 'var(--bg-secondary, #F8FAFC)',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--theme-card-border, #E2E8F0)'
            }}>
              {combo.description}
            </p>
          )}

          {/* Included Items Section */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{
              fontSize: '0.82rem',
              fontWeight: 800,
              color: 'var(--text-dark, #0A2315)',
              margin: '0 0 8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Utensils size={13} color="var(--gold-bright, #D4AF37)" /> 
              {lang === 'hi' ? `थाली में क्या-क्या शामिल है (${comboItems.length} व्यंजन)` : `What's Included (${comboItems.length} Items)`}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comboItems.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--theme-card-bg, #FFFFFF)',
                  border: '1px solid var(--theme-card-border, #E2E8F0)',
                  padding: '7px 10px',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--theme-price-color, #16A34A)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark, #0F172A)' }}>
                      {item.qty > 1 ? `${item.qty}x ` : ''}{item.dish_name}
                    </span>
                    {item.portion && (
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: 'var(--theme-badge-bg, #EEF2FF)',
                        color: 'var(--theme-text-primary, #4338CA)'
                      }}>
                        {item.portion === 'half' ? (lang === 'hi' ? 'हाफ' : 'Half') : item.portion}
                      </span>
                    )}
                  </div>

                  {item.original_price && (
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted, #64748B)' }}>
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
            background: 'var(--theme-badge-bg, #F0FDF4)',
            border: '1px solid var(--theme-card-border, #BBF7D0)',
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            color: 'var(--theme-price-color, #166534)',
            fontWeight: 700
          }}>
            <ShieldCheck size={15} style={{ color: 'var(--theme-price-color, #16A34A)', flexShrink: 0 }} />
            <span>{lang === 'hi' ? '100% ताज़ा और शुद्ध भोजन थाली।' : '100% Freshly prepared meal thali.'}</span>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--theme-divider, #E2E8F0)',
          background: 'var(--theme-modal-bg, #FFFFFF)'
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
                background: 'var(--theme-btn-gradient, linear-gradient(135deg, #0A2315 0%, #143A24 100%))',
                color: '#FFFFFF',
                fontSize: '0.86rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: 'var(--theme-shadow, 0 4px 14px rgba(0, 0, 0, 0.25))',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={16} /> {lang === 'hi' 
                ? `थाली कार्ट में जोड़ें (${symbol}${formatPriceNumber(effectivePrice)})` 
                : `ADD THALI TO CART (${symbol}${formatPriceNumber(effectivePrice)})`}
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--theme-card-border, #CBD5E1)',
                background: 'var(--theme-modal-bg, #FFFFFF)',
                color: 'var(--text-muted, #475569)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {lang === 'hi' ? 'विवरण बंद करें' : 'Close Details'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
