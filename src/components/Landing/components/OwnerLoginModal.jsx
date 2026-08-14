import React from 'react';
import { X, KeyRound, Lock, ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export default function OwnerLoginModal({
  show,
  onClose,
  mode,
  setMode,
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  newPasswordInput,
  setNewPasswordInput,
  errMessage,
  setErrMessage,
  successMessage,
  setSuccessMessage,
  loading,
  onSubmitLogin,
  onSubmitResetPassword
}) {
  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') {
      onSubmitLogin(e);
    } else {
      onSubmitResetPassword(e);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 10050,
        background: 'rgba(5, 19, 10, 0.88)', backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
      }} 
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        style={{
          background: 'linear-gradient(145deg, #0A2315 0%, #0F321E 100%)',
          border: '1.5px solid rgba(212, 175, 55, 0.5)',
          borderRadius: '24px',
          padding: '32px 24px', maxWidth: '420px', width: '100%', maxHeight: '92vh', overflowY: 'auto',
          color: '#FFFFFF', boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 30px rgba(212, 175, 55, 0.15)',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose} 
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: '34px', height: '34px', color: '#FFF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Brand Icon & Header */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '54px', height: '54px', borderRadius: '16px',
            background: 'rgba(212, 175, 55, 0.15)', border: '1px solid #D4AF37',
            color: '#FFD700', marginBottom: '12px'
          }}>
            {mode === 'forgot' ? <Lock size={26} /> : <KeyRound size={26} />}
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFD700', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
            {mode === 'forgot' ? 'Reset Admin Password' : 'TouchQR Owner Login'}
          </h2>

          <p style={{ fontSize: '0.84rem', color: '#94A3B8', margin: 0, lineHeight: 1.4 }}>
            {mode === 'forgot'
              ? 'Enter your restaurant slug/username and your new desired password.'
              : 'Access your TouchQR digital menu, KOT orders, & billing hub.'}
          </p>
        </div>

        {/* Mode Toggle Switcher */}
        <div style={{
          display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '12px',
          padding: '4px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrMessage(''); setSuccessMessage(''); }}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
              background: mode === 'login' ? '#D4AF37' : 'transparent',
              color: mode === 'login' ? '#0A0A0A' : '#94A3B8',
              transition: 'all 0.2s ease'
            }}
          >
            🔑 Owner Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('forgot'); setErrMessage(''); setSuccessMessage(''); }}
            style={{
              flex: 1, padding: '8px 12px', border: 'none', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
              background: mode === 'forgot' ? '#D4AF37' : 'transparent',
              color: mode === 'forgot' ? '#0A0A0A' : '#94A3B8',
              transition: 'all 0.2s ease'
            }}
          >
            🔒 Reset Password
          </button>
        </div>

        {/* Alert Notifications */}
        {successMessage && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.18)', border: '1px solid #10B981', color: '#34D399',
            padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '18px', fontWeight: 700
          }}>
            {successMessage}
          </div>
        )}

        {errMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.18)', border: '1px solid #EF4444', color: '#F87171',
            padding: '12px 14px', borderRadius: '12px', fontSize: '0.82rem', marginBottom: '18px', fontWeight: 700
          }}>
            {errMessage}
          </div>
        )}

        {/* Login / Reset Password Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, color: '#D4AF37', marginBottom: '6px', letterSpacing: '0.5px' }}>
              {mode === 'forgot' ? 'RESTAURANT SLUG OR USERNAME *' : 'ADMIN USERNAME *'}
            </label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              placeholder={mode === 'forgot' ? 'e.g. royal-spice or admin' : 'e.g. admin'}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '10px',
                border: '1px solid rgba(212, 175, 55, 0.4)', background: 'rgba(0,0,0,0.4)',
                color: '#FFFFFF', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {mode === 'login' ? (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#D4AF37', letterSpacing: '0.5px' }}>
                  PASSWORD *
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setErrMessage(''); setSuccessMessage(''); }}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.74rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  border: '1px solid rgba(212, 175, 55, 0.4)', background: 'rgba(0,0,0,0.4)',
                  color: '#FFFFFF', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, color: '#D4AF37', marginBottom: '6px', letterSpacing: '0.5px' }}>
                NEW DESIRED PASSWORD *
              </label>
              <input
                type="password"
                required
                value={newPasswordInput}
                onChange={e => setNewPasswordInput(e.target.value)}
                placeholder="Enter new password (min 4 chars)"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  border: '1px solid rgba(212, 175, 55, 0.4)', background: 'rgba(0,0,0,0.4)',
                  color: '#FFFFFF', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #FFD700 0%, #D4AF37 100%)',
              color: '#0A0A0A', fontSize: '0.95rem', fontWeight: 900, cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 18px rgba(212, 175, 55, 0.35)', transition: 'all 0.2s ease'
            }}
          >
            {loading ? (
              <span>Processing...</span>
            ) : mode === 'login' ? (
              <>
                <span>Login to Admin Panel</span> <ArrowRight size={18} />
              </>
            ) : (
              <>
                <span>Update Password Now</span> <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Registration Link */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Don't have a TouchQR account yet? </span>
          <a
            onClick={() => {
              onClose();
              window.history.pushState({}, '', '/register');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            style={{ fontSize: '0.82rem', color: '#FFD700', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Start 16-Day Free Trial →
          </a>
        </div>
      </div>
    </div>
  );
}
