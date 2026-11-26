import React, { useEffect } from 'react';
import { X, Clock, Phone, MapPin, ShieldCheck, ExternalLink, Star, Store } from 'lucide-react';
import { getRestaurantLogoUrl } from '../utils/imageHelper';
import { triggerHaptic } from '../utils/haptics';

export default function RestaurantInfoModal({ info, lang = 'en', onClose, onOpenReviewModal }) {
  useEffect(() => {
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
  }, [onClose]);

  const fssaiText = info?.fssai_lic_no ? String(info.fssai_lic_no).trim() : '';
  const openingHoursText = String(info?.openingHours || info?.opening_hours || '').trim();
  const phoneText = String(info?.phone || '').trim();
  const addressText = String(info?.address || '').trim();
  const mapsUrl = String(info?.google_maps_url || '').trim();
  const hasReviewsBtn = Boolean(info?.google_reviews_enabled);
  const hasAnyInfo = Boolean(fssaiText || openingHoursText || phoneText || addressText || mapsUrl || hasReviewsBtn);

  const infoRowStyle = {
    background: 'var(--bg-secondary, #F8FAFC)',
    border: '1px solid var(--border-light, #E2E8F0)',
    borderRadius: '14px',
    padding: '11px 13px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px'
  };

  const iconWrapStyle = {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    background: 'var(--theme-card-bg, #FFFFFF)',
    border: '1px solid var(--border-light, #E2E8F0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--primary-emerald)'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10020,
      background: 'rgba(15, 23, 42, 0.72)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14px',
      animation: 'sheetBackdropFade 0.2s ease-out'
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--theme-modal-bg, #FFFFFF)',
          color: 'var(--text-dark)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '460px',
          maxHeight: '88dvh',
          boxSizing: 'border-box',
          boxShadow: '0 20px 44px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--theme-modal-border, rgba(226, 232, 240, 0.9))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--header-gradient, linear-gradient(135deg, #0A2315 0%, #123722 100%))',
          color: '#FFFFFF',
          padding: '16px 18px',
          flexShrink: 0,
          position: 'relative'
        }}>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); if (onClose) onClose(); }}
            aria-label={lang === 'hi' ? 'बंद करें' : 'Close modal'}
            style={{
              position: 'absolute',
              top: '13px',
              right: '13px',
              background: 'rgba(255, 255, 255, 0.16)',
              color: '#FFFFFF',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '40px', minWidth: 0 }}>
            <img
              src={getRestaurantLogoUrl(info?.logo)}
              alt={info?.name || 'Logo'}
              onError={(e) => { e.currentTarget.src = '/images/default-logo.webp'; }}
              style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(255, 255, 255, 0.4)', objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25, margin: 0, overflowWrap: 'break-word' }}>
                {info?.name || (lang === 'hi' ? 'डिजिटल मेन्यू' : 'Digital Menu')}
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#4ADE80', fontWeight: 700, display: 'block', marginTop: '2px', overflowWrap: 'break-word' }}>
                {info?.badge || info?.tagline || (lang === 'hi' ? 'डिजिटल मेन्यू और ऑर्डरिंग' : 'Digital Menu & Ordering')}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* FSSAI Certified Banner - Only when FSSAI license number is configured */}
          {fssaiText && (
            <div style={{
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '14px',
              padding: '10px 13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <ShieldCheck size={22} color="#16A34A" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <h4 style={{ fontSize: '0.80rem', fontWeight: 800, color: '#16A34A', margin: '0 0 1px 0' }}>
                  {info?.badge ? `FSSAI Certified ${info.badge}` : (lang === 'hi' ? 'FSSAI प्रमाणित आउटलेट' : 'FSSAI Certified')}
                </h4>
                <p style={{ fontSize: '0.73rem', color: '#15803D', margin: 0, fontWeight: 600 }}>
                  {lang === 'hi' ? 'लाइसेंस नंबर:' : 'Lic No:'} {fssaiText}
                </p>
              </div>
            </div>
          )}

          {/* Opening Hours Row */}
          {openingHoursText && (
            <div style={infoRowStyle}>
              <div style={iconWrapStyle}>
                <Clock size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '2px' }}>
                  {lang === 'hi' ? 'खुलने का समय' : 'Opening Hours'}
                </span>
                <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-dark)', margin: 0, lineHeight: 1.4 }}>
                  {openingHoursText}
                </p>
              </div>
            </div>
          )}

          {/* Contact Phone Row */}
          {phoneText && (
            <div style={infoRowStyle}>
              <div style={iconWrapStyle}>
                <Phone size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '2px' }}>
                  {lang === 'hi' ? 'संपर्क नंबर' : 'Contact & Inquiries'}
                </span>
                <a
                  href={`tel:${phoneText}`}
                  style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--primary-emerald)', textDecoration: 'none' }}
                >
                  {phoneText}
                </a>
              </div>
            </div>
          )}

          {/* Address Row */}
          {addressText && (
            <div style={infoRowStyle}>
              <div style={iconWrapStyle}>
                <MapPin size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '2px' }}>
                  {lang === 'hi' ? 'आउटलेट का पता' : 'Outlet Address'}
                </span>
                <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-dark)', margin: 0, lineHeight: 1.45, overflowWrap: 'break-word' }}>
                  {addressText}
                </p>
              </div>
            </div>
          )}

          {/* Empty Info Fallback */}
          {!hasAnyInfo && (
            <div style={{
              textAlign: 'center',
              padding: '24px 14px',
              color: 'var(--text-muted, #64748B)'
            }}>
              <Store size={28} style={{ opacity: 0.45, marginBottom: '8px' }} />
              <p style={{ fontSize: '0.84rem', fontWeight: 600, margin: 0 }}>
                {lang === 'hi' ? 'आउटलेट की जानकारी जल्द ही अपडेट होगी।' : 'Business details will be updated soon.'}
              </p>
            </div>
          )}
        </div>

        {/* Independent Quick Action Footer (Always accessible even if address is blank) */}
        {(phoneText || mapsUrl || hasReviewsBtn) && (
          <div style={{
            padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--border-light, #E2E8F0)',
            background: 'var(--theme-modal-bg, #FFFFFF)',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            flexShrink: 0
          }}>
            {phoneText && (
              <a
                href={`tel:${phoneText}`}
                onClick={() => triggerHaptic('light')}
                style={{
                  flex: '1 1 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'var(--theme-btn-gradient, var(--primary-emerald))',
                  color: 'var(--theme-btn-text, #FFFFFF)',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <Phone size={14} />
                <span>{lang === 'hi' ? 'कॉल करें' : 'Call Outlet'}</span>
              </a>
            )}

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic('light')}
                style={{
                  flex: '1 1 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'var(--bg-secondary, #F1F5F9)',
                  color: 'var(--text-dark, #0F172A)',
                  border: '1px solid var(--border-light, #CBD5E1)',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <MapPin size={14} />
                <span>{lang === 'hi' ? 'दिशा देखें' : 'Directions'}</span>
                <ExternalLink size={12} />
              </a>
            )}

            {hasReviewsBtn && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  if (onClose) onClose();
                  if (onOpenReviewModal) onOpenReviewModal();
                  else if (info?.google_review_url) window.open(info.google_review_url, '_blank');
                }}
                style={{
                  flex: '1 1 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  background: 'var(--gold-gradient, linear-gradient(135deg, #FBBF24 0%, #D97706 100%))',
                  color: 'var(--dock-btn-text, #0A2315)',
                  border: 'none',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.80rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Star size={14} fill="currentColor" />
                <span>{lang === 'hi' ? 'रेटिंग दें' : 'Rate Us'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
