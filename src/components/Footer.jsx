import React from 'react';
import { Phone, Clock, MapPin, ShieldCheck } from 'lucide-react';

export default function Footer({ info, onOpenAdmin }) {
  return (
    <footer style={{
      background: 'var(--primary-emerald)',
      color: '#FFFFFF',
      marginTop: '40px',
      padding: '40px 20px 70px',
      borderTop: '3px solid var(--veg-green-border)'
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
            {info?.name || 'Raman Sweet Bakery & Family Restaurant'}
          </h3>
          <p style={{
            fontSize: '0.84rem',
            color: '#A7F3D0',
            fontWeight: 600
          }}>
            100% Pure Vegetarian • Pure Desi Ghee Sweets • Live Bakery
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justify: 'center',
          gap: '20px',
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} color="#A7F3D0" />
            <span>{info?.openingHours || '8:00 AM - 10:30 PM'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone size={16} color="#A7F3D0" />
            <span>{info?.phone || '+91 98765 43210'}</span>
          </div>
        </div>

        <div style={{
          fontSize: '0.82rem',
          color: 'rgba(255, 255, 255, 0.75)',
          maxWidth: '450px',
          lineHeight: 1.4
        }}>
          <MapPin size={14} color="#A7F3D0" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          {info?.address || 'Main Market Road, Near City Clock Tower, GT Road'}
        </div>

        <div style={{
          width: '60px',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.3)',
          margin: '4px 0'
        }} />

        <div style={{
          width: '100%',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <span>© {new Date().getFullYear()} Raman Sweet Bakery. All rights reserved.</span>
          
          <button
            onClick={onOpenAdmin}
            style={{
              color: '#A7F3D0',
              fontWeight: 700,
              textDecoration: 'underline',
              fontSize: '0.78rem'
            }}
          >
            Manager Login
          </button>
        </div>
      </div>
    </footer>
  );
}
