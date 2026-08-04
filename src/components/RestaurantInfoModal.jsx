import React from 'react';
import { X, Clock, Phone, MapPin, ShieldCheck, Award, CheckCircle, ExternalLink } from 'lucide-react';

export default function RestaurantInfoModal({ info, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 3000,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justify: 'center',
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
              justify: 'center'
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={info?.logo || '/uploads/logo.jpg'}
              alt="Logo"
              style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #D4AF37', objectFit: 'cover' }}
            />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
                {info?.name || 'Raman Sweet Bakery'}
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#4ADE80', fontWeight: 700 }}>
                100% Pure Vegetarian Certified
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
                FSSAI Certified 100% Pure Veg Restaurant
              </h4>
              <p style={{ fontSize: '0.74rem', color: '#15803D' }}>
                FSSAI Lic No: 20824001000123 • Pure Veg.Pure Taste.Pure Happiness
              </p>
            </div>
          </div>

          {/* Opening Hours */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Clock size={16} color="var(--primary-emerald)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                Dining & Sweets Counter Timings
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: '24px' }}>
              Monday – Sunday: {info?.openingHours || '8:00 AM – 9:30 PM (Open 7 Days)'}
            </p>
          </div>

          {/* Phone Contact & Direct Call Action Button */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Phone size={16} color="var(--primary-emerald)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                Contact & Table Inquiries
              </span>
            </div>
            <a
              href={`tel:${info?.phone || '+919708366583'}`}
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
              📞 Call {info?.phone || '+91 9708366583'}
            </a>
          </div>

          {/* Address & Directions Button */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <MapPin size={16} color="var(--primary-emerald)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                Restaurant Address
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', paddingLeft: '24px', marginBottom: '8px' }}>
              {info?.address || 'HawaiAdda Chowk,Near katchari Gumti,Motihari,Bihar'}
            </p>
            <a
              href={info?.google_review_url || 'https://share.google/2M5mFMPlmS6pAXRf7'}
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
                marginLeft: '24px',
                textDecoration: 'none'
              }}
            >
              📍 Get Google Maps Directions <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
