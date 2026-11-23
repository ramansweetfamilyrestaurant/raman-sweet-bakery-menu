import React, { useState, useEffect } from 'react';
import { 
  X, 
  Star, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  MessageSquarePlus, 
  MessageCircle,
  RotateCcw
} from 'lucide-react';
import { generateSmartReview, getCustomerReviewProfile } from '../utils/aiReviewGenerator';
import { getBusinessTerminology } from '../utils/businessTaxonomy';
import { resolveImageUrl } from '../utils/imageHelper';

export default function CustomerReviewModal({ info, lang = 'en', onClose }) {
  const isHi = lang === 'hi';
  const terms = getBusinessTerminology(info || {});
  const restoName = info?.name || terms.businessNoun || 'Business';
  const profile = getCustomerReviewProfile(info?.business_type, info?.resto_type);
  const availableChips = profile.highlights || [];

  const [rating, setRating] = useState(5);
  const [selectedChips, setSelectedChips] = useState(profile.defaultChips || []);
  const [customNote, setCustomNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [generatedReview, setGeneratedReview] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Lock body scrolling when modal is mounted on mobile
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Re-generate AI review on any input change
  useEffect(() => {
    const reviewText = generateSmartReview({
      restoName,
      restoType: info?.resto_type,
      businessType: info?.business_type,
      rating,
      selectedChips,
      customNote
    });
    setGeneratedReview(reviewText);
  }, [restoName, info?.resto_type, info?.business_type, rating, selectedChips, customNote]);

  const toggleChip = (chipLabel) => {
    if (selectedChips.includes(chipLabel)) {
      setSelectedChips(selectedChips.filter(c => c !== chipLabel));
    } else {
      setSelectedChips([...selectedChips, chipLabel]);
    }
  };

  const handleCopyAndPost = async () => {
    // Robust copy to clipboard with fallback for non-secure / webview contexts
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(generatedReview);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = generatedReview;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.warn('Clipboard copy error, proceeding to open URL:', err);
    }

    setCopiedToast(true);

    setTimeout(() => {
      setCopiedToast(false);
      const hasCustomUrl = info?.google_review_url && typeof info.google_review_url === 'string' && info.google_review_url.trim() !== '';
      const googleUrl = hasCustomUrl
        ? info.google_review_url.trim()
        : `https://www.google.com/search?q=${encodeURIComponent(restoName + ' ' + (info?.address || ''))}`;
      window.open(googleUrl, '_blank');
      if (onClose) onClose();
    }, 850);
  };

  const handleWhatsAppManager = () => {
    const rawNumber = info?.whatsapp_number || info?.phone || '';
    const cleanNumber = String(rawNumber).replace(/[^0-9]/g, '');
    const textMsg = encodeURIComponent(
      `Hello ${restoName}, I would like to share private feedback about my recent visit: "${generatedReview || customNote || 'Regarding food/service'}"`
    );
    const waUrl = cleanNumber 
      ? `https://wa.me/${cleanNumber.length === 10 ? '91' + cleanNumber : cleanNumber}?text=${textMsg}`
      : `https://wa.me/?text=${textMsg}`;
    window.open(waUrl, '_blank');
    if (onClose) onClose();
  };

  const resolvedLogo = resolveImageUrl(info?.logo);

  const getRatingFeedback = (val) => {
    switch (val) {
      case 5:
        return {
          label: isHi ? 'उत्कृष्ट अनुभव!' : 'Excellent experience!',
          color: '#16A34A',
          bg: '#DCFCE7'
        };
      case 4:
        return {
          label: isHi ? 'बहुत अच्छा अनुभव' : 'Great experience',
          color: '#16A34A',
          bg: '#DCFCE7'
        };
      case 3:
        return {
          label: isHi ? 'ठीक-ठाक अनुभव' : 'Good / Decent',
          color: '#D97706',
          bg: '#FEF3C7'
        };
      case 2:
        return {
          label: isHi ? 'उम्मीद से कम' : 'Below expectations',
          color: '#EA580C',
          bg: '#FFEDD5'
        };
      case 1:
        return {
          label: isHi ? 'सुधार की आवश्यकता' : 'Needs improvement',
          color: '#DC2626',
          bg: '#FEE2E2'
        };
      default:
        return {
          label: isHi ? 'अपना अनुभव बताएं' : 'Rate your experience',
          color: '#64748B',
          bg: '#F1F5F9'
        };
    }
  };

  const ratingInfo = getRatingFeedback(rating);
  const isNegativeRating = rating <= 2;
  const hasManagerContact = Boolean(info?.whatsapp_number || info?.phone);

  return (
    <div
      className="customer-review-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <style>{`
        @keyframes reviewSheetEnter {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .customer-review-sheet {
          animation: reviewSheetEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .review-star-btn {
          transition: transform 0.12s ease;
        }
        .review-star-btn:active {
          transform: scale(0.88);
        }
        .review-star-btn:hover {
          transform: scale(1.14);
        }
        .review-chip-btn {
          transition: all 0.15s ease;
        }
        .review-chip-btn:active {
          transform: scale(0.95);
        }
        @media (max-width: 480px) {
          .customer-review-backdrop {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .customer-review-sheet {
            max-width: 100% !important;
            width: 100% !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            border-top-left-radius: 22px !important;
            border-top-right-radius: 22px !important;
            max-height: 90vh !important;
            border-bottom: none !important;
            margin-top: auto !important;
          }
        }
      `}</style>

      <div
        className="customer-review-sheet"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          maxWidth: '410px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}
      >
        {/* Mobile Drag Indicator Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '8px',
          paddingBottom: '2px'
        }}>
          <div style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: '#E2E8F0'
          }} />
        </div>

        {/* Sleek, Clean Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px 14px 18px',
          borderBottom: '1px solid #F1F5F9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {!logoFailed && resolvedLogo ? (
                <img
                  src={resolvedLogo}
                  alt={restoName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span style={{ fontSize: '1.1rem' }}>⭐</span>
              )}
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '0.94rem',
                fontWeight: 800,
                color: '#0F172A',
                lineHeight: 1.25
              }}>
                {restoName}
              </h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginTop: '2px',
                fontSize: '0.70rem',
                color: '#64748B',
                fontWeight: 600
              }}>
                {/* Official Google G Logo SVG */}
                <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isHi ? 'गूगल रिव्यू और रेटिंग' : 'Google Review & Rating'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#F1F5F9',
              border: 'none',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '16px 18px 20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Interactive Star Rating */}
          <div style={{
            textAlign: 'center',
            padding: '12px 14px',
            background: '#F8FAFC',
            borderRadius: '16px',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              fontSize: '0.80rem',
              fontWeight: 700,
              color: '#475569',
              marginBottom: '8px'
            }}>
              {isHi ? 'आपकी आज की सेवा / अनुभव कैसा रहा?' : (profile.question || 'How was your experience today?')}
            </div>

            {/* Stars with large 44px tap zone */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '4px',
              marginBottom: '6px'
            }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    className="review-star-btn"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Star
                      size={32}
                      fill={isActive ? '#F59E0B' : '#E2E8F0'}
                      color={isActive ? '#D97706' : '#CBD5E1'}
                      style={{ filter: isActive ? 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.28))' : 'none' }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Subtle Rating Pill */}
            <span style={{
              display: 'inline-block',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: ratingInfo.color,
              background: ratingInfo.bg,
              padding: '3px 10px',
              borderRadius: '20px'
            }}>
              {ratingInfo.label}
            </span>
          </div>

          {/* Highlight Tags (Optional) */}
          {availableChips.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px'
              }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                  {isHi ? 'क्या खास पसंद आया? (वैकल्पिक)' : 'Tap highlights to include (Optional):'}
                </span>
                {!showNoteInput && (
                  <button
                    type="button"
                    onClick={() => setShowNoteInput(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      color: '#2563EB',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <MessageSquarePlus size={12} />
                    <span>{isHi ? '+ डिश का नाम लिखें' : '+ Add dish note'}</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableChips.map((chip) => {
                  const isSelected = selectedChips.includes(chip.label);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      className="review-chip-btn"
                      onClick={() => toggleChip(chip.label)}
                      style={{
                        background: isSelected ? '#0F172A' : '#F8FAFC',
                        color: isSelected ? '#FFFFFF' : '#334155',
                        border: isSelected ? '1px solid #0F172A' : '1px solid #E2E8F0',
                        padding: '4px 9px',
                        borderRadius: '20px',
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isSelected && <Check size={11} />}
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Optional Dish/Note Input Field */}
          {showNoteInput && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder={isHi ? 'डिश या मिठाई का नाम लिखें (जैसे काजू कतली, पनीर बटर...)' : (profile.placeholder || 'Mention a dish or item...')}
                autoFocus
                style={{
                  flex: 1,
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '0.76rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setCustomNote('');
                  setShowNoteInput(false);
                }}
                style={{
                  height: '36px',
                  padding: '0 8px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#64748B',
                  fontSize: '0.70rem',
                  cursor: 'pointer'
                }}
              >
                {isHi ? 'हटाएं' : 'Cancel'}
              </button>
            </div>
          )}

          {/* AI Review Draft Card */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                background: '#EEF2FF',
                color: '#4338CA',
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={11} /> {isHi ? 'सुझाया गया रिव्यू (AI)' : 'AI Suggested Review'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600 }}>
                {isHi ? 'टैप करके बदलें' : 'Tap text to edit'}
              </span>
            </div>

            <textarea
              value={generatedReview}
              onChange={(e) => setGeneratedReview(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                resize: 'none',
                fontSize: '0.80rem',
                lineHeight: 1.45,
                color: '#1E293B',
                fontWeight: 500,
                outline: 'none',
                padding: 0,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 🌟 Reputation Safeguard: If 1-2 Stars, offer private resolution */}
          {isNegativeRating && hasManagerContact ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={handleWhatsAppManager}
                style={{
                  width: '100%',
                  height: '46px',
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                }}
              >
                <MessageCircle size={18} />
                <span>{isHi ? 'सीधे मैनेजर से बात करें (व्हाट्सएप)' : 'Share Feedback with Management (Private)'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAndPost}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 0',
                  textDecoration: 'underline'
                }}
              >
                {isHi ? 'या गूगल पर रिव्यू जारी रखें' : 'or Continue to Google Reviews'}
              </button>
            </div>
          ) : (
            /* High-Converting Primary Google CTA Button */
            <button
              type="button"
              onClick={handleCopyAndPost}
              style={{
                width: '100%',
                height: '46px',
                background: copiedToast ? '#16A34A' : '#1A73E8',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: copiedToast
                  ? '0 4px 12px rgba(22, 163, 74, 0.3)'
                  : '0 4px 12px rgba(26, 115, 232, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              {copiedToast ? (
                <>
                  <Check size={18} />
                  <span>{isHi ? 'कॉपी हो गया! गूगल खुल रहा है...' : 'Copied! Opening Google Reviews...'}</span>
                </>
              ) : (
                <>
                  {/* Clean White Google G Icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isHi ? 'रिव्यू कॉपी करें और गूगल पर पोस्ट करें' : 'Copy Review & Post on Google'}</span>
                  <ExternalLink size={14} />
                </>
              )}
            </button>
          )}

          {/* Micro Caption */}
          <div style={{
            textAlign: 'center',
            fontSize: '0.68rem',
            color: '#94A3B8',
            marginTop: '-4px'
          }}>
            {isHi 
              ? '10 सेकंड से भी कम समय लगता है • आपका रिव्यू हमें आगे बढ़ने में मदद करता है'
              : 'Takes less than 10 seconds • Reviews help local businesses grow'
            }
          </div>

        </div>
      </div>
    </div>
  );
}
