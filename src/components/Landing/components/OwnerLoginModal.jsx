import React from 'react';
import { X, KeyRound, Lock, ArrowLeft, ArrowRight } from 'lucide-react';

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
        background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
      }} 
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        style={{
          background: '#0F172A', border: '1.5px solid #D4AF37', borderRadius: '24px',
          padding: '32px 24px', maxWidth: '420px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
          color: '#FFFFFF', boxShadow: '0 25px 60px rgba(0,0,0,0.85)', position: 'relative'
        }}
      >
        <button 
          onClick={onClose} 
          style={{
            position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.1)',
            border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#FFF',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>

        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '10px' }}>
          {mode === 'forgot' ? '🔒' : '🔑'}
        </div>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#D4AF37', margin: '0 0 6px 0', textAlign: 'center' }}>
          {mode === 'forgot' ? 'Reset Admin Password' : 'Restaurant Owner Login'}
        </h2>

        <p style={{ fontSize: '0.84rem', color: '#94A3B8', textAlign: 'center', margin: '0 0 20px 0' }}>
          {mode === 'forgot'
            ? 'Enter your restaurant slug/username and your new desired password.'
            : 'Enter your restaurant owner credentials to access your dashboard.'}
        </p>

        {successMessage && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#34D399',
            padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', marginBottom: '16px', fontWeight: 700
          }}>
            {successMessage}
          </div>
        )}

        {errMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#F87171',
            padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem', marginBottom: '16px', fontWeight: 700
          }}>
            {errMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#D4AF37', marginBottom: '6px' }}>
              {mode === 'forgot' ? 'RESTAURANT SLUG OR USERNAME *' : 'ADMIN USERNAME *'}
            </label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              placeholder={mode === 'forgot' ? 'e.g. raman-sweet-bakery' : 'Enter username'}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                color: '#FFF', fontSize: '0.9rem', outline: 'none'
              }}
            />
          </div>

          {mode === 'login' ? (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D4AF37' }}>
                  PASSWORD *
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setErrMessage(''); setSuccessMessage(''); }}
                  style={{ background: 'none', border: 'none', color: '#38BDF8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                  color: '#FFF', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#D4AF37', marginBottom: '6px' }}>
                NEW PASSWORD *
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={newPasswordInput}
                onChange={e => setNewPasswordInput(e.target.value)}
                placeholder="Enter new password (min 4 chars)"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                  color: '#FFF', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="km-btn-primary km-btn-gold"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {loading ? 'Processing...' : (mode === 'forgot' ? 'Update Password' : 'Log In & Open Dashboard →')}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setErrMessage(''); setSuccessMessage(''); }}
              style={{
                width: '100%', marginTop: '14px', padding: '8px', color: '#38BDF8',
                fontSize: '0.82rem', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer'
              }}
            >
              ← Back to Owner Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
