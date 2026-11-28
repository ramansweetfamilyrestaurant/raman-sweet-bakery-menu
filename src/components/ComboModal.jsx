import React, { useEffect } from 'react';
import { X, Plus, Minus, Sparkles, CheckCircle2, Utensils, Tag, ShieldCheck, ShoppingBag } from 'lucide-react';
import { getComboImageUrl, getDishImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';
import { resolveComboMeta, findMatchingDishForComboItem } from '../utils/comboHelper';
import { isFlagEnabled } from '../utils/customerHelpers';
import { getComboTerminology } from '../utils/businessTaxonomy';

export default function ComboModal({ 
  combo, 
  onClose, 
  onAddToCart, 
  onUpdateQuantity,
  onOpenCart,
  cartQuantity = 0,
  cartKey,
  dishes = [],
  canOrder = false, 
  currencySymbol = '₹',
  lang = 'en',
  businessType,
  restoType,
  foodType,
  isPureVeg: isPureVegProp
}) {
  useEffect(() => {
    if (!combo) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [combo, onClose]);

  if (!combo) return null;

  const symbol = getCurrencySymbol(currencySymbol);

  const dishMap = new Map((dishes || []).map(d => [String(d.id), d]));
  const comboMeta = resolveComboMeta(combo, dishMap);
  const comboItems = comboMeta.comboItems;

  // Calculate prices and offers
  const regularPrice = (combo.regular_price !== undefined && combo.regular_price !== null && combo.regular_price !== '')
    ? Number(combo.regular_price)
    : Number(combo.price || 0);
  const effectivePrice = (combo.offer_price !== undefined && combo.offer_price !== null && combo.offer_price !== '' && Number(combo.offer_price) >= 0 && Number(combo.offer_price) < regularPrice)
    ? Number(combo.offer_price)
    : regularPrice;
  const originalTotal = comboMeta.originalTotal;
  const savings = originalTotal > effectivePrice
    ? originalTotal - effectivePrice
    : (regularPrice > effectivePrice ? regularPrice - effectivePrice : 0);

  const imageSrc = getComboImageUrl(combo.image);

  // Dietary check
  const cleanFood = String(foodType || '').trim().toLowerCase();
  const cleanResto = String(restoType || '').trim().toLowerCase();
  const isPureVegResto = (isPureVegProp === true || isPureVegProp === 1 || isPureVegProp === '1' || isPureVegProp === 'true')
    || ['pure_veg', 'veg', 'vegetarian', 'vegan', 'only_veg'].includes(cleanFood)
    || ['pure_veg', 'veg', 'vegetarian'].includes(cleanResto);

  const isVeg = isPureVegResto || comboMeta.dietType === 'veg';
  const isComboOrderable = comboMeta.isOrderable;
  const comboTerms = getComboTerminology({ business_type: businessType, resto_type: restoType });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10020,
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
          maxHeight: '90dvh',
          boxSizing: 'border-box',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1.5px solid var(--theme-modal-border, var(--gold-bright, #DFBA67))',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
          @media (max-width: 600px) {
            .combo-view-modal {
              max-width: 100% !important;
              border-radius: 16px !important;
              max-height: 90dvh !important;
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
            width: '36px',
            height: '36px',
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
          flexShrink: 0,
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
              maxWidth: 'calc(100% - 68px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              zIndex: 2
            }}>
              <Tag size={11} style={{ flexShrink: 0 }} /> {lang === 'hi' ? `बचत ${symbol}${formatPriceNumber(savings)}` : `SAVE ${symbol}${formatPriceNumber(savings)}`}
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
          flex: 1,
          minHeight: 0
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
                {comboTerms.icon} {lang === 'hi' ? comboTerms.tagHi : comboTerms.tagEn}
              </span>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: '1.14rem',
                fontWeight: 900,
                color: 'var(--theme-price-color, var(--primary-emerald, #059669))',
                whiteSpace: 'nowrap',
                lineHeight: 1.15
              }}>
                {symbol}{formatPriceNumber(effectivePrice)}
              </div>
              {(originalTotal > effectivePrice || regularPrice > effectivePrice) && (
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', textDecoration: 'line-through', marginTop: '2px', textAlign: 'right' }}>
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
              {lang === 'hi' ? comboTerms.includedHi(comboItems.length) : comboTerms.includedEn(comboItems.length)}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comboItems.map((item, idx) => {
                const matchedDish = findMatchingDishForComboItem(item, dishMap);
                const itemImg = matchedDish?.image ? getDishImageUrl(matchedDish.image) : null;
                const itemText = `${item.dish_name || ''} ${matchedDish?.name || ''} ${matchedDish?.category || ''}`.toLowerCase();
                const matchedType = String(matchedDish?.type || matchedDish?.food_type || '').toLowerCase();
                const itemIsNonVeg = matchedType === 'nonveg' || matchedType === 'non_veg' || matchedType === 'egg' ||
                  matchedDish?.is_non_veg || matchedDish?.is_veg === 0 || matchedDish?.is_veg === false ||
                  itemText.includes('chicken') || itemText.includes('mutton') || itemText.includes('fish') || itemText.includes('egg');
                const isItemVeg = isPureVegResto || !itemIsNonVeg;
                const normalizedUnavailableSet = new Set(
                  (Array.isArray(comboMeta.unavailableNames) ? comboMeta.unavailableNames : [])
                    .map(n => String(n || '').trim().toLowerCase())
                    .filter(Boolean)
                );
                const itemLabelNorm = String(item.dish_name || matchedDish?.name || '').trim().toLowerCase();
                const isItemUnavailable = Boolean(
                  (itemLabelNorm && normalizedUnavailableSet.has(itemLabelNorm)) ||
                  (typeof combo?.has_unavailable_items !== 'boolean' && matchedDish && !isFlagEnabled(matchedDish.available, true))
                );

                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isItemUnavailable ? '#FEF2F2' : 'var(--theme-card-bg, #FFFFFF)',
                    border: isItemUnavailable ? '1px solid #FECACA' : '1px solid var(--theme-card-border, #E2E8F0)',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    gap: '10px',
                    opacity: isItemUnavailable ? 0.78 : 1
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      {/* Dish Thumbnail or Icon */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: 'var(--bg-secondary, #F1F5F9)',
                        flexShrink: 0,
                        border: '1px solid var(--theme-card-border, #E2E8F0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {itemImg ? (
                          <img 
                            src={itemImg} 
                            alt={item.dish_name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Utensils size={15} color="var(--text-muted, #94A3B8)" />
                        )}
                      </div>

                      {/* Dish Name & Indicators */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span 
                            title={isItemVeg ? 'Veg' : 'Non-Veg'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '12px',
                              height: '12px',
                              border: isItemVeg ? '1.5px solid #16A34A' : '1.5px solid #DC2626',
                              borderRadius: '3px',
                              padding: '1px',
                              flexShrink: 0
                            }}
                          >
                            <span style={{
                              width: '4px',
                              height: '4px',
                              borderRadius: '50%',
                              background: isItemVeg ? '#16A34A' : '#DC2626'
                            }} />
                          </span>

                          <span style={{ 
                            fontSize: '0.82rem', 
                            fontWeight: 700, 
                            color: 'var(--text-dark, #0F172A)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.qty > 1 ? `${item.qty}x ` : ''}{item.dish_name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {item.portion && (
                            <span style={{
                              display: 'inline-block',
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'var(--theme-badge-bg, #EEF2FF)',
                              color: 'var(--theme-text-primary, #4338CA)'
                            }}>
                              {item.portion === 'half' ? (lang === 'hi' ? 'हाफ' : 'Half') : item.portion}
                            </span>
                          )}
                          {isItemUnavailable && (
                            <span style={{
                              display: 'inline-block',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: '#FEE2E2',
                              color: '#DC2626'
                            }}>
                              {lang === 'hi' ? 'उपलब्ध नहीं' : 'Sold Out'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {Number(item.original_price) > 0 && (
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', flexShrink: 0 }}>
                        {symbol}{Number(item.original_price) * (Number(item.qty) || 1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guarantee / Availability Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: !isComboOrderable ? '#FEF2F2' : 'var(--theme-badge-bg, #F0FDF4)',
            border: !isComboOrderable ? '1px solid #FECACA' : '1px solid var(--theme-card-border, #BBF7D0)',
            padding: '8px 10px',
            borderRadius: '8px',
            fontSize: '0.72rem',
            color: !isComboOrderable ? '#DC2626' : 'var(--theme-price-color, #166534)',
            fontWeight: 700
          }}>
            <ShieldCheck size={15} style={{ color: !isComboOrderable ? '#DC2626' : 'var(--theme-price-color, #16A34A)', flexShrink: 0 }} />
            <span>
              {!isComboOrderable
                ? (lang === 'hi' ? comboTerms.unavailableHi : comboTerms.unavailableEn)
                : (lang === 'hi' ? comboTerms.freshHi : comboTerms.freshEn)}
            </span>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--theme-divider, #E2E8F0)',
          background: 'var(--theme-modal-bg, #FFFFFF)'
        }}>
          {!isComboOrderable ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                color: '#DC2626',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {lang === 'hi' ? 'वर्तमान में अनुपलब्ध • बंद करें' : 'Currently Unavailable • Close'}
            </button>
          ) : canOrder ? (
            cartQuantity > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary, #F8FAFC)',
                  border: '1px solid var(--theme-card-border, #E2E8F0)',
                  borderRadius: '10px',
                  padding: '8px 12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--theme-price-color, #16A34A)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} /> {lang === 'hi' ? 'कार्ट में जोड़ा गया' : 'Added in Cart'}
                    </span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 900, color: 'var(--text-dark, #0F172A)' }}>
                      {symbol}{formatPriceNumber(effectivePrice * cartQuantity)}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--theme-card-bg, #FFFFFF)',
                    border: '1.5px solid var(--primary-emerald, #10B981)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '3px 6px',
                    flexShrink: 0
                  }}>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity && onUpdateQuantity(cartKey || `combo_${combo.id}`, -1)}
                      aria-label="Decrease quantity"
                      style={{
                        background: 'var(--bg-secondary, #F1F5F9)',
                        color: 'var(--text-dark, #0F172A)',
                        border: 'none',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        borderRadius: '50%',
                        fontWeight: 900,
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      −
                    </button>
                    <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '0.86rem', fontWeight: 900, color: 'var(--theme-price-color, var(--primary-emerald, #10B981))' }}>
                      {cartQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity && onUpdateQuantity(cartKey || `combo_${combo.id}`, 1)}
                      aria-label="Increase quantity"
                      style={{
                        background: 'var(--theme-btn-gradient, linear-gradient(135deg, #10B981 0%, #059669 100%))',
                        color: 'var(--theme-btn-text, #FFFFFF)',
                        border: 'none',
                        width: '28px',
                        height: '28px',
                        padding: 0,
                        borderRadius: '50%',
                        fontWeight: 900,
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {onOpenCart && (
                  <button
                    type="button"
                    onClick={onOpenCart}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'var(--theme-btn-gradient, linear-gradient(135deg, #0A2315 0%, #143A24 100%))',
                      color: 'var(--theme-btn-text, #FFFFFF)',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: 'var(--theme-shadow, 0 4px 14px rgba(0, 0, 0, 0.25))'
                    }}
                  >
                    <ShoppingBag size={15} /> {lang === 'hi' ? 'कार्ट देखें और ऑर्डर करें' : 'View Cart & Checkout'}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="tq-tap"
                onClick={(e) => {
                  onAddToCart(combo, e.currentTarget);
                }}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--theme-btn-gradient, linear-gradient(135deg, #0A2315 0%, #143A24 100%))',
                  color: 'var(--theme-btn-text, #FFFFFF)',
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
                  ? `${comboTerms.addBtnHi} (${symbol}${formatPriceNumber(effectivePrice)})` 
                  : `${comboTerms.addBtnEn} (${symbol}${formatPriceNumber(effectivePrice)})`}
              </button>
            )
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
