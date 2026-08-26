import React, { useState, useEffect } from 'react';
import { Lock, User, KeyRound, ArrowLeft, ArrowRight, AlertCircle, Eye, EyeOff, Crown, RefreshCw, ShieldCheck } from 'lucide-react';
import { adminLogin } from '../../api/client';

export default function AdminLogin({ onLoginSuccess, onCancel, restaurantName, targetSlug }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [supportPhone, setSupportPhone] = useState('919876543210');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.support_whatsapp) setSupportPhone(data.support_whatsapp);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'forgot') {
      if (!username.trim() || !newPassword) {
        setError('Please fill in all fields');
        return;
      }
      if (newPassword.length < 4) {
        setError('New password must be at least 4 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/admin/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_or_username: username,
            new_password: newPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password');

        setSuccessMsg(data.message || 'Password reset successfully!');
        setMode('login');
        setPassword('');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const rawCandidate = targetSlug || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '');
      const slugToPass = ['touchqr-demo', 'menu', 'admin', 'default', 'null', 'undefined'].includes((rawCandidate || '').toLowerCase()) ? '' : rawCandidate;
      const data = await adminLogin(username.trim(), password, slugToPass);
      onLoginSuccess(data.token, data.username, data.slug, data.restaurant);
    } catch (err) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #05140B 0%, #0A2315 50%, #164E2A 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute', width: '380px', height: '380px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0) 70%)',
        top: '10%', left: '20%', pointerEvents: 'none'
      }} />

      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '430px',
        boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(212, 175, 55, 0.35)',
        border: '1.5px solid rgba(212, 175, 55, 0.4)',
        padding: '36px 28px 28px',
        position: 'relative',
        zIndex: 2,
        boxSizing: 'border-box'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)',
            border: '1.5px solid #D4AF37',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 6px 18px rgba(10, 35, 21, 0.25)'
          }}>
            {mode === 'forgot' ? <Lock size={26} color="#DFBA67" /> : <Crown size={28} color="#DFBA67" />}
          </div>

          <h1 style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            color: '#0A2315',
            margin: '0 0 4px 0',
            letterSpacing: '-0.02em'
          }}>
            {mode === 'forgot' ? 'Reset Password' : 'Sign in to TouchQR'}
          </h1>
          <p style={{ fontSize: '0.80rem', color: '#64748B', margin: 0, fontWeight: 600, lineHeight: 1.4 }}>
            {mode === 'forgot'
              ? 'Account Recovery & Password Assistance'
              : (restaurantName ? `${restaurantName} • Admin Control Panel` : 'Restaurant Operations, Ordering & Growth Platform')}
          </p>
        </div>

        {/* Security Badge */}
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '10px',
          padding: '7px 12px',
          fontSize: '0.74rem',
          color: '#166534',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '20px'
        }}>
          <ShieldCheck size={15} color="#15803D" /> Secure Encrypted Admin Gateway
        </div>

        {/* Form Alerts */}
        {successMsg && (
          <div style={{
            background: '#ECFDF5', border: '1px solid #6EE7B7',
            borderRadius: '12px', padding: '10px 14px', marginBottom: '16px',
            color: '#065F46', fontSize: '0.82rem', textAlign: 'center', fontWeight: 700
          }}>
            {successMsg}
          </div>
        )}

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#991B1B',
            fontSize: '0.82rem',
            fontWeight: 700
          }}>
            <AlertCircle size={16} color="#991B1B" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label 
              htmlFor="admin-username-input"
              style={{
                display: 'block',
                fontSize: '0.76rem',
                fontWeight: 800,
                color: '#334155',
                marginBottom: '6px',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}
            >
              {mode === 'forgot' ? 'Username or Registered Phone' : 'Username / Email'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={17} color="#94A3B8" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
              <input
                id="admin-username-input"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'forgot' ? 'e.g. admin or 9876543210' : 'Enter admin username or email'}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '10px 14px 10px 38px',
                  fontSize: '0.90rem',
                  fontWeight: 600,
                  borderRadius: '12px',
                  border: '1.5px solid #CBD5E1',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#D4AF37';
                  e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#CBD5E1';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {mode === 'forgot' ? (
            <div style={{
              background: '#F0FDF4',
              border: '1.5px solid #A7F3D0',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 800, color: '#065F46', fontSize: '0.92rem', marginBottom: '6px' }}>
                🔒 Account Recovery Support
              </div>
              <p style={{ fontSize: '0.80rem', color: '#047857', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                For account protection, please contact Super Admin support via WhatsApp with your registered restaurant details to verify and reset your credentials.
              </p>
              <a
                href={`https://wa.me/${(supportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello Super Admin, I am requesting password recovery assistance for my restaurant: ' + (restaurantName || targetSlug || ''))}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                }}
              >
                💬 Contact Support on WhatsApp
              </a>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label 
                  htmlFor="admin-password-input"
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: '#334155',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase'
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                  style={{
                    background: 'none', border: 'none', color: '#059669',
                    fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={17} color="#94A3B8" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '10px 42px 10px 38px',
                    fontSize: '0.90rem',
                    fontWeight: 600,
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#D4AF37';
                    e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#CBD5E1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                marginTop: '4px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)',
                color: '#DFBA67',
                border: '1.5px solid #D4AF37',
                fontSize: '0.94rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(10, 35, 21, 0.25)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} color="#DFBA67" />
                </>
              )}
            </button>
          )}

          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              style={{
                width: '100%', padding: '10px', color: '#059669',
                fontSize: '0.84rem', fontWeight: 800, border: 'none', background: 'none', cursor: 'pointer'
              }}
            >
              ← Back to Owner Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              style={{
                width: '100%',
                padding: '10px',
                color: '#64748B',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: 'none',
                background: 'none',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={15} /> Return to Customer Menu
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

