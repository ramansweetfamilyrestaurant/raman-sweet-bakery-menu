import React, { useState } from 'react';
import { ShieldCheck, Globe, Star, Info, Clock, Phone, MapPin, MoreVertical, HelpCircle, LogOut } from 'lucide-react';

export default function CustomerHeader({
  info,
  lang,
  tableNum,
  onToggleLang,
  onOpenInfoModal,
  onOpenAdmin,
  onCallStaff,
  onOpenReviewModal,
  onLogout,
  onOpenHelp,
  supportPhone
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <header style={{
      background: 'var(--header-gradient, linear-gradient(180deg, rgba(10, 35, 21, 0.94) 0%, rgba(18, 55, 34, 0.94) 100%))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: '#FFFFFF',
      padding: '12px 14px 14px',
      borderBottom: '1.5px solid rgba(212, 175, 55, 0.4)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
    }}>
      {/* Top Mobile Bar: Language Pill + Table Indicator + Call Staff + Rate Us + Three Dots ⋮ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {/* Language Switcher */}
        <button
          onClick={onToggleLang}
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            color: '#FFFFFF',
            background: 'rgba(255, 255, 255, 0.14)',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <Globe size={12} color="#D4AF37" />
          {lang === 'hi' ? 'हिंदी' : 'EN / हिंदी'}
        </button>

        {/* Right Action Group: Rate Us + Table Indicator + Call Staff + Three Dots ⋮ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          {onOpenReviewModal && (info?.google_reviews_enabled !== false && info?.google_reviews_enabled !== 0) && (
            <button
              onClick={onOpenReviewModal}
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: '#0A2315',
                background: 'linear-gradient(135deg, #FFD700 0%, #DFBA67 100%)',
                border: '1px solid #FFF',
                padding: '3px 8px',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: '0 2px 6px rgba(223, 186, 103, 0.4)',
                cursor: 'pointer'
              }}
              title="Rate & Review on Google"
            >
              <Star size={11} fill="#0A2315" color="#0A2315" /> Rate Us
            </button>
          )}

          {/* Table Indicator / View-Only Badge */}
          {tableNum ? (
            <>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: '#4ADE80',
                background: 'rgba(34, 197, 94, 0.18)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#4ADE80' }} />
                T-{tableNum}
              </span>

              {onCallStaff && (
                <button
                  onClick={onCallStaff}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                    border: '1px solid #C4B5FD',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  🛎️ Call Staff
                </button>
              )}
            </>
          ) : (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#E2E8F0',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              📖 View Only Menu
            </span>
          )}

          {/* Three-Dot ⋮ Options Menu Button */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            style={{
              padding: '4px 6px',
              color: '#FFF',
              background: 'rgba(255, 255, 255, 0.16)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="More Options Menu"
          >
            <MoreVertical size={16} />
          </button>

          {/* Dropdown Menu (Onboarding Guide, WhatsApp Support, Logout Admin) */}
          {showMoreMenu && (
            <div
              style={{
                position: 'absolute', top: '34px', right: 0, width: '210px',
                background: '#FFFFFF', border: '1px solid #E2E8F0',
                borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                zIndex: 1000, padding: '6px', color: '#0F172A'
              }}
              onClick={() => setShowMoreMenu(false)}
            >
              {onOpenHelp && (
                <button
                  onClick={onOpenHelp}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: '#0F172A', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                >
                  <HelpCircle size={16} color="#2563EB" /> Onboarding Guide
                </button>
              )}

              <a
                href={`https://wa.me/${(supportPhone || info?.phone || '919876543210').replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 700, color: '#0F172A', textDecoration: 'none', borderRadius: '6px' }}
              >
                <Phone size={16} color="#16A34A" /> WhatsApp Support
              </a>

              {onLogout && (
                <>
                  <div style={{ height: '1px', background: '#E2E8F0', margin: '4px 0' }} />
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', fontSize: '0.84rem', fontWeight: 800, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                  >
                    <LogOut size={16} /> Logout Admin
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Restaurant Brand Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textAlign: 'left'
      }}>
        {/* Logo Avatar */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '2px solid #D4AF37',
          padding: '1px',
          background: '#0A2315',
          flexShrink: 0
        }}>
          {info?.logo && info.logo !== '/uploads/logo.jpg' ? (
            <img 
              src={info.logo} 
              alt={info.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--gold-bright)', color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem' }}>
              {(info?.name || 'R').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Titles */}
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {info?.name || 'Digital Menu'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#4ADE80',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={13} color="#4ADE80" />
              {info?.badge || (lang === 'hi' ? 'डिजिटल मेन्यू' : 'Digital Menu')}
            </span>

            {onOpenInfoModal && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>•</span>
                <button
                  onClick={onOpenInfoModal}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#FEFCE8',
                    textDecoration: 'underline',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {lang === 'hi' ? 'जानकारी' : 'Info & Timings'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ maxWidth: '360px', width: '100%', background: '#FFFFFF', borderRadius: '16px', padding: '20px', color: '#0F172A' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: '0 0 8px 0' }}>
              Confirm Admin Logout
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 16px 0' }}>
              Are you sure you want to end your active restaurant management session?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) onLogout();
                }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                Logout Now
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
