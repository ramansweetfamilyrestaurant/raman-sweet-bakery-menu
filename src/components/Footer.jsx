import React from 'react';
import { Phone, Clock, MapPin, ShieldCheck } from 'lucide-react';

export default function Footer({ info, onOpenAdmin, onOpenReviewModal }) {
  return (
    <footer style={{
      background: 'var(--footer-gradient, linear-gradient(180deg, #05140B 0%, #0A2315 100%))',
      color: '#FFFFFF',
      marginTop: '40px',
      padding: '40px 20px 70px',
      borderTop: '3px solid var(--gold-bright)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px'
      }}>
        <div>
          <h3 style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#FFFFFF',
            marginBottom: '4px'
          }}>
            {info?.name || 'Digital Menu'}
          </h3>
          {info?.tagline && (
            <p style={{
              fontSize: '0.84rem',
              color: '#A7F3D0',
              fontWeight: 600
            }}>
              {info.tagline}
            </p>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '20px',
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.9)'
        }}>
          {info?.openingHours && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="#A7F3D0" />
              <span>{info.openingHours}</span>
            </div>
          )}

          {info?.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Phone size={16} color="#A7F3D0" />
              <span>{info.phone}</span>
            </div>
          )}
        </div>

        {info?.address && (
          <div style={{
            fontSize: '0.82rem',
            color: 'rgba(255, 255, 255, 0.75)',
            maxWidth: '450px',
            lineHeight: 1.4
          }}>
            <MapPin size={14} color="#A7F3D0" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            {info.address}
          </div>
        )}

        {(info?.google_reviews_enabled !== false && info?.google_reviews_enabled !== 0 && onOpenReviewModal) && (
          <button
            type="button"
            onClick={onOpenReviewModal}
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              color: '#0A2315',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
              marginTop: '4px'
            }}
          >
            ⭐ Rate & Review Us on Google
          </button>
        )}

        <div style={{
          width: '60px',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.3)',
          margin: '4px 0'
        }} />

        <div style={{
          width: '100%',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <div>© {new Date().getFullYear()} {info?.name || 'Digital Menu'}. All rights reserved.</div>
          {!info?.watermark_removal_enabled && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>
              <span>Powered by </span>
              <a href="/" target="_blank" rel="noopener noreferrer" style={{ color: '#DFBA67', fontWeight: 800, textDecoration: 'none' }}>
                ⚡ TouchQR — Smart Digital Menu & QR Platform
              </a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
