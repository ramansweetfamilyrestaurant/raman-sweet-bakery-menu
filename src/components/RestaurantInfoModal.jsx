import React from 'react';
import { X, Clock, Phone, MapPin, ShieldCheck, ExternalLink } from 'lucide-react';
import { getRestaurantLogoUrl } from '../utils/imageHelper';

export default function RestaurantInfoModal({ info, onClose, onOpenReviewModal }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
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
          width: '100%',
          maxWidth: '460px',
          maxHeight: '90vh',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-light)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'fadeIn 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0A2315 0%, #123722 100%)',
          color: '#FFFFFF',
          padding: '20px',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={getRestaurantLogoUrl(info?.logo)}
              alt="Logo"
              onError={(e) => { e.currentTarget.src = '/uploads/logo.jpg'; }}
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }}
            />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                {info?.name || 'Digital Menu'}
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#4ADE80', fontWeight: 700 }}>
                {info?.badge || info?.tagline || 'Digital Restaurant Menu'}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          {/* FSSAI & Quality Seals */}
          <div style={{
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldCheck size={24} color="#16A34A" />
            <div>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#16A34A' }}>
                {info?.badge ? `FSSAI Certified ${info.badge}` : 'FSSAI Certified Restaurant'}
              </h4>
              <p style={{ fontSize: '0.74rem', color: '#15803D', margin: 0 }}>
                {info?.fssai_lic_no ? `FSSAI Lic No: ${info.fssai_lic_no} • ` : ''}{info?.tagline || 'Quality Food & Service'}
              </p>
            </div>
          </div>

          {/* Opening Hours */}
          {info?.openingHours && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Clock size={16} color="var(--primary-emerald)" />
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Opening Hours
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: '24px', margin: 0 }}>
                {info.openingHours}
              </p>
            </div>
          )}

          {/* Phone Contact & Direct Call Action Button */}
          {info?.phone && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Phone size={16} color="var(--primary-emerald)" />
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Contact & Inquiries
                </span>
              </div>
              <a
                href={`tel:${info.phone}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--primary-emerald)',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  marginLeft: '24px',
                  textDecoration: 'none'
                }}
              >
                📞 Call {info.phone}
              </a>
            </div>
          )}

          {/* Address & Directions Button */}
          {info?.address && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <MapPin size={16} color="var(--primary-emerald)" />
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Restaurant Address
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: '24px', marginBottom: '8px' }}>
                {info.address}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginLeft: '24px' }}>
                {info?.google_maps_url && (
                  <a
                    href={info.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--primary-emerald)',
                      border: '1px solid var(--border-light)',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    📍 Get Google Maps Directions <ExternalLink size={12} />
                  </a>
                )}

                {Boolean(info?.google_reviews_enabled) && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenReviewModal) onOpenReviewModal();
                      else if (info?.google_review_url) window.open(info.google_review_url, '_blank');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                      color: '#0A2315',
                      border: '1px solid #FFFFFF',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(255, 215, 0, 0.3)'
                    }}
                  >
                    ⭐ Rate Us on Google Reviews <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
