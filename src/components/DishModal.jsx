import React, { useState } from 'react';
import { X, ShieldCheck, Sparkles, Clock, Utensils, CheckCircle } from 'lucide-react';
import { getDishImageUrl } from '../utils/imageHelper';
import { getCurrencySymbol, formatPriceNumber } from '../utils/currencyHelper';
import { getValidDishModifiers } from '../utils/billingHelper';
import { isFlagEnabled } from '../utils/customerHelpers';

export default function DishModal({ dish, onClose, onAddToCart, currencySymbol = '₹', lang = 'en', initialPortion = null, modifiersEnabled = true, addonOnly = false }) {
  if (!dish) return null;

  const symbol = getCurrencySymbol(currencySymbol);
  const isAvailable = isFlagEnabled(dish?.available, true);
  const displayName = (lang === 'hi' && dish.name_hi) ? dish.name_hi : dish.name;
  const displayDesc = (lang === 'hi' && dish.description_hi) ? dish.description_hi : dish.description;
  const hasHalfPrice = dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0;
  const resolvedInitialPortion = (hasHalfPrice && (initialPortion === 'half' || initialPortion === 'full'))
    ? initialPortion
    : (hasHalfPrice ? 'half' : 'full');
  const [selectedPortion, setSelectedPortion] = useState(resolvedInitialPortion);

  const availableModifiers = modifiersEnabled === false ? [] : getValidDishModifiers(dish?.modifiers);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [quantity, setQuantity] = useState(1);

  const toggleModifier = (mod) => {
    if (selectedModifiers.some(m => m.name === mod.name)) {
      setSelectedModifiers(selectedModifiers.filter(m => m.name !== mod.name));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const regularBasePrice = (selectedPortion === 'half' && hasHalfPrice) ? Number(dish.price_half) : Number(dish.price);
  let basePrice = regularBasePrice;
  if ((dish.offer_price !== undefined && dish.offer_price !== null) && Number(dish.offer_price) < Number(dish.price) && selectedPortion !== 'half') {
    basePrice = Number(dish.offer_price);
  }
  const extraModifiersPrice = selectedModifiers.reduce((acc, m) => acc + (Number(m.price) || 0), 0);
  const activePrice = basePrice + extraModifiersPrice;
  const regularActivePrice = regularBasePrice + extraModifiersPrice;
  const totalPrice = activePrice * quantity;

  const formatHalfLabel = (lbl) => {
    if (!lbl || lbl === 'Half Portion' || lbl === 'Half') {
      return lang === 'hi' ? 'हाफ' : 'Half';
    }
    return lbl.replace(/\s*portion$/i, '').trim() || (lang === 'hi' ? 'हाफ' : 'Half');
  };

  const formatFullLabel = (lbl) => {
    if (!lbl || lbl === 'Full Portion' || lbl === 'Full') {
      return lang === 'hi' ? 'फुल' : 'Full';
    }
    return lbl.replace(/\s*portion$/i, '').trim() || (lang === 'hi' ? 'फुल' : 'Full');
  };

  const activePortionLabel = selectedPortion === 'half'
    ? formatHalfLabel(dish.portion_half_label)
    : (hasHalfPrice ? formatFullLabel(dish.portion_full_label) : (dish.portion || ''));

  const ingredientsList = dish.ingredients ? dish.ingredients.split(',').map(i => i.trim()) : [];
  const imageSrc = getDishImageUrl(dish.image);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10020,
      background: addonOnly ? 'rgba(10, 25, 16, 0.65)' : 'rgba(10, 35, 21, 0.8)',
      backdropFilter: addonOnly ? 'blur(4px)' : 'blur(10px)',
      display: 'flex',
      alignItems: addonOnly ? 'flex-end' : 'center',
      justifyContent: 'center',
      padding: addonOnly ? 0 : '12px',
      animation: addonOnly ? 'sheetBackdropFade 0.2s ease-out' : undefined
    }} onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--theme-modal-bg, #FFFFFF)',
          borderRadius: addonOnly ? '22px 22px 0 0' : 'var(--radius-lg)',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '520px',
          maxHeight: addonOnly ? '82vh' : '88vh',
          boxShadow: addonOnly ? '0 -12px 36px rgba(0, 0, 0, 0.28)' : 'var(--shadow-lg)',
          border: addonOnly ? '1.5px solid var(--theme-modal-border, var(--gold-border))' : '2px solid var(--theme-modal-border, var(--gold-bright))',
          borderBottom: addonOnly ? 'none' : undefined,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: addonOnly ? 'sheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          color: 'var(--text-dark)'
        }}
      >
        {addonOnly ? (
          /* Compact Bottom-Sheet Header for Quick Add-on Customization */
          <div style={{
            padding: '10px 16px 12px',
            borderBottom: '1px solid var(--border-light, #E2E8F0)',
            background: 'var(--theme-modal-bg, #FFFFFF)',
            flexShrink: 0
          }}>
            <div style={{
              width: '38px',
              height: '4px',
              borderRadius: '9999px',
              background: '#CBD5E1',
              margin: '0 auto 10px'
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <img
                  src={imageSrc}
                  alt={displayName}
                  onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '1px solid var(--border-light, #E2E8F0)',
                    flexShrink: 0
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '10px',
                      height: '10px',
                      border: dish.type === 'nonveg' ? '1.5px solid #DC2626' : dish.type === 'egg' ? '1.5px solid #D97706' : '1.5px solid var(--veg-green)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '2px',
                      flexShrink: 0
                    }}>
                      <span style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: dish.type === 'nonveg' ? '#DC2626' : dish.type === 'egg' ? '#D97706' : 'var(--veg-green)'
                      }} />
                    </span>
                    <h3 style={{
                      margin: 0,
                      fontSize: '0.96rem',
                      fontWeight: 800,
                      color: 'var(--text-dark)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {displayName}
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary-emerald)' }}>
                    {lang === 'hi' ? 'अपनी पसंद चुनें' : 'Customize your order'} • {symbol}{formatPriceNumber(basePrice)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                aria-label={lang === 'hi' ? 'बंद करें' : 'Close'}
                onClick={onClose}
                style={{
                  background: 'var(--bg-secondary, #F1F5F9)',
                  color: 'var(--text-dark, #334155)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <>
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
              <img
                src={imageSrc}
                alt={dish.name}
                onError={(e) => { e.currentTarget.src = '/images/default-dish.webp'; }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              
              {/* FSSAI 100% Pure Veg Badge Overlay */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'var(--theme-modal-bg, rgba(255, 255, 255, 0.95))',
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
          </>
        )}

        {/* Scrollable Content Body */}
        <div style={{
          padding: addonOnly ? '14px 16px' : '16px 18px',
          overflowY: 'auto',
          flex: 1
        }}>
          {!addonOnly && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '10px',
            marginBottom: '10px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: 'var(--text-gold)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {dish.category_name || 'Chef Specialty'}
                </span>
                {(dish.offer_badge || dish.offer?.offer_badge) && (
                  <span style={{
                    background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                    color: '#B45309',
                    border: '1px solid #F59E0B',
                    borderRadius: 'var(--radius-pill)',
                    padding: '1.5px 7px',
                    fontSize: '0.64rem',
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    🔥 {dish.offer_badge || dish.offer?.offer_badge}
                  </span>
                )}
              </div>

              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--primary-emerald)',
                lineHeight: 1.25,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                margin: '2px 0 0 0'
              }}>
                {displayName}
              </h2>

              {(dish.offer?.ends_at || dish.offer_ends_at) && (
                <span style={{ fontSize: '0.65rem', color: 'var(--theme-price-color, var(--primary-emerald, #059669))', fontWeight: 700, marginTop: '2px', display: 'block' }}>
                  ⏳ {lang === 'hi' ? 'ऑफर समाप्ति:' : 'Offer valid till:'} {new Date(dish.offer?.ends_at || dish.offer_ends_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Dynamic Active Price Tag Pill matching Chaat section */}
            {activePrice < regularActivePrice ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                <div style={{
                  fontSize: '1.02rem',
                  fontWeight: 900,
                  padding: '2px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--theme-badge-bg, var(--bg-card-soft, #ECFDF5))',
                  color: 'var(--theme-price-color, var(--primary-emerald, #064E3B))',
                  border: '1.5px solid var(--theme-card-border, #A7F3D0)',
                  boxShadow: 'var(--theme-shadow, 0 1px 4px rgba(0, 0, 0, 0.08))',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2
                }}>
                  {symbol}{formatPriceNumber(activePrice)}
                </div>
                <div style={{
                  fontSize: '0.72rem',
                  color: '#94A3B8',
                  textDecoration: 'line-through',
                  fontWeight: 600,
                  marginRight: '4px'
                }}>
                  {symbol}{formatPriceNumber(regularActivePrice)}
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: '1rem',
                fontWeight: 900,
                padding: '3px 12px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--theme-card-bg, var(--bg-card, #FFFFFF))',
                color: 'var(--text-dark)',
                border: '1.5px solid var(--theme-card-border, var(--border-light))',
                boxShadow: 'var(--theme-shadow, 0 1px 4px rgba(0,0,0,0.06))',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                flexShrink: 0
              }}>
                {symbol}{formatPriceNumber(activePrice)}
              </div>
            )}
          </div>
          )}

          {/* Interactive Half / Full Portion Selector */}
          {hasHalfPrice ? (
            <div style={{
              background: 'var(--bg-champagne, var(--bg-card-soft))',
              border: '1.5px solid var(--gold-border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-emerald)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                {lang === 'hi' ? 'पोर्शन साइज चुनें:' : 'Select Portion Size:'}
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
                    border: selectedPortion === 'half' ? '1.5px solid var(--gold-bright)' : '1px solid var(--border-light, var(--gold-border))',
                    background: selectedPortion === 'half' ? 'var(--primary-emerald)' : 'var(--theme-card-bg, #FFFFFF)',
                    color: selectedPortion === 'half' ? 'var(--theme-btn-text, #FFFFFF)' : 'var(--text-dark)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {formatHalfLabel(dish.portion_half_label)} • {symbol}{formatPriceNumber(dish.price_half)}
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
                    border: selectedPortion === 'full' ? '1.5px solid var(--gold-bright)' : '1px solid var(--border-light, var(--gold-border))',
                    background: selectedPortion === 'full' ? 'var(--primary-emerald)' : 'var(--theme-card-bg, #FFFFFF)',
                    color: selectedPortion === 'full' ? 'var(--theme-btn-text, #FFFFFF)' : 'var(--text-dark)',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  {formatFullLabel(dish.portion_full_label)} • {symbol}{formatPriceNumber(dish.offer_price !== undefined && dish.offer_price !== null && Number(dish.offer_price) < Number(dish.price) ? dish.offer_price : dish.price)}
                </button>
              </div>
            </div>
          ) : null}

          {!addonOnly && (( !hasHalfPrice && dish.portion && dish.portion.trim() && !dish.portion.toLowerCase().includes('portion')) || (dish.taste_profile && String(dish.taste_profile).trim())) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {!hasHalfPrice && dish.portion && dish.portion.trim() && !dish.portion.toLowerCase().includes('portion') && (
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--primary-emerald)',
                  background: 'var(--bg-champagne)',
                  border: '1px solid var(--gold-border)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}>
                  📦 {dish.portion}
                </span>
              )}
              {dish.taste_profile && String(dish.taste_profile).trim() && (
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#C2410C',
                  background: '#FFF7ED',
                  border: '1px solid #FDBA74',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}>
                  🌶️ {dish.taste_profile}
                </span>
              )}
            </div>
          )}

          {/* Interactive Custom Add-on Modifiers & Toppings */}
          {availableModifiers.length > 0 && (
            <div style={{
              background: addonOnly ? 'var(--bg-secondary, #F8FAFC)' : 'var(--bg-champagne)',
              border: addonOnly ? '1.5px solid var(--border-light, #E2E8F0)' : '1.5px solid var(--gold-border)',
              borderRadius: 'var(--radius-md)',
              padding: addonOnly ? '12px' : '10px 14px',
              marginBottom: addonOnly ? '4px' : '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-emerald)', textTransform: 'uppercase' }}>
                  {lang === 'hi' ? '➕ अतिरिक्त टॉपिंग्स / ऐड-ऑन्स चुनें:' : '➕ Choose Add-ons & Extra Toppings'}
                </span>
                <span style={{
                  fontSize: '0.66rem',
                  fontWeight: 750,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: selectedModifiers.length > 0 ? '#DCFCE7' : 'var(--theme-badge-bg, #E2E8F0)',
                  color: selectedModifiers.length > 0 ? '#15803D' : 'var(--theme-badge-text, #475569)'
                }}>
                  {selectedModifiers.length > 0
                    ? `${selectedModifiers.length} ${lang === 'hi' ? 'चुना' : 'selected'}`
                    : (lang === 'hi' ? 'वैकल्पिक' : 'Optional')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableModifiers.map((mod, idx) => {
                  const isSelected = selectedModifiers.some(m => m.name === mod.name);
                  return (
                    <label
                      key={idx}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        background: isSelected ? 'var(--theme-card-bg, #FFFFFF)' : 'var(--bg-secondary, #F8FAFC)',
                        border: isSelected ? '1.5px solid var(--primary-emerald, #059669)' : (addonOnly ? '1px solid var(--border-light, #CBD5E1)' : '1px solid var(--gold-border)'),
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleModifier(mod)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary-emerald)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                          {mod.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary-emerald)' }}>
                        +{symbol}{formatPriceNumber(mod.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {!addonOnly && (
            <>
              {/* Description */}
              <p style={{
                fontSize: '0.92rem',
                color: 'var(--text-dark)',
                lineHeight: 1.6,
                marginBottom: '20px'
              }}>
                {displayDesc || (lang === 'hi' ? 'ताजा और शुद्ध सामग्री से निर्मित प्रामाणिक व्यंजन।' : 'Prepared fresh using fine quality ingredients & authentic traditional recipes.')}
              </p>

              {/* Ingredients List */}
              {ingredientsList.length > 0 && (
                <div style={{
                  background: 'var(--bg-champagne, var(--bg-card-soft))',
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
                        color: 'var(--text-dark)',
                        background: 'var(--theme-card-bg, #FFFFFF)',
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
                padding: '10px 14px',
                border: '1px solid var(--gold-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-emerald)', fontWeight: 600 }}>
                  Availability Status
                </span>
                <span style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: isAvailable ? 'var(--veg-green)' : '#EF4444'
                }}>
                  {isAvailable ? '● Available Fresh Now' : '● Currently Out of Stock'}
                </span>
              </div>
            </>
          )}

          {/* Close Scrollable Content Body */}
        </div>

          {/* Sticky Bottom Action Bar (Stepper in Add-on Sheet OR Detail Total + Add Button) */}
          <div style={{
            padding: addonOnly ? '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))' : '12px 18px 16px',
            borderTop: addonOnly ? '1px solid var(--border-light, #E2E8F0)' : '1.5px solid var(--gold-border)',
            background: 'var(--theme-modal-bg, #FFFFFF)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {addonOnly && isAvailable && onAddToCart ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                border: '1.5px solid var(--border-light, #CBD5E1)',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-secondary, #F8FAFC)',
                height: '42px',
                padding: '0 4px',
                flexShrink: 0
              }}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  style={{
                    width: '30px',
                    height: '32px',
                    border: 'none',
                    background: 'transparent',
                    color: quantity <= 1 ? '#94A3B8' : 'var(--text-dark)',
                    fontSize: '1rem',
                    fontWeight: 900,
                    cursor: quantity <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  −
                </button>
                <span style={{ minWidth: '22px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity(q => Math.min(20, q + 1))}
                  style={{
                    width: '30px',
                    height: '32px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--primary-emerald)',
                    fontSize: '1rem',
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
              </div>
            ) : !addonOnly && (
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6B7280)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  Total (incl. add-ons)
                </span>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary-emerald)' }}>
                  {symbol}{formatPriceNumber(activePrice)}
                </span>
              </div>
            )}

            {isAvailable && onAddToCart ? (
              <button
                type="button"
                onClick={() => {
                  onAddToCart(dish, selectedPortion, selectedModifiers, quantity);
                  if (onClose) onClose();
                }}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--theme-btn-gradient, linear-gradient(135deg, var(--primary-emerald) 0%, var(--gold-primary) 100%))',
                  color: 'var(--theme-btn-text, #FFFFFF)',
                  fontWeight: 900,
                  fontSize: '0.92rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'var(--theme-shadow, 0 4px 14px rgba(0, 0, 0, 0.25))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <span>➕</span>
                <span>
                  {addonOnly
                    ? `${lang === 'hi' ? 'कार्ट में जोड़ें' : 'Add Item'} • ${symbol}${formatPriceNumber(totalPrice)}`
                    : `${lang === 'hi' ? 'ऑर्डर में जोड़ें' : 'Add to Order'} • ${symbol}${formatPriceNumber(activePrice)}`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1.5px solid var(--border-light)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-dark)',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>📖</span>
                <span>{lang === 'hi' ? 'विवरण बंद करें (View Only)' : 'Close Details (View Only)'}</span>
              </button>
            )}
          </div>
      </div>
    </div>
  );
}
