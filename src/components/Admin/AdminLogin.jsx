import React, { useState } from 'react';
import { Lock, User, KeyRound, ArrowLeft, AlertCircle } from 'lucide-react';
import { adminLogin } from '../../api/client';

export default function AdminLogin({ onLoginSuccess, onCancel, restaurantName, targetSlug }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [supportPhone, setSupportPhone] = useState('919876543210');

  React.useEffect(() => {
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
      const data = await adminLogin(username, password, slugToPass);
      onLoginSuccess(data.token, data.username, data.slug);
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
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Ambient Glow */}
      <div style={{
        position: 'absolute', width: '300px', height: '300px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0) 70%)',
        top: '10%', left: '20%', pointerEvents: 'none'
      }} />

      <div style={{
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        border: '1.5px solid rgba(212, 175, 55, 0.4)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0A2315 0%, #123722 100%)',
          padding: '28px 24px',
          color: '#FFFFFF',
          textAlign: 'center',
          borderBottom: '2px solid #D4AF37'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'rgba(197, 160, 89, 0.15)',
            border: '1.5px solid var(--accent-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px'
          }}>
            <Lock size={26} color="var(--accent-gold)" />
          </div>

          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.3rem',
            fontWeight: 800,
            color: '#FFFFFF'
          }}>
            {mode === 'forgot' ? 'Reset Password' : (restaurantName ? `${restaurantName} Owner Login` : 'Restaurant Owner Login')}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-gold-light)' }}>
            {mode === 'forgot' ? 'Reset your admin password securely' : 'Digital Menu Admin Control Panel'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {successMsg && (
            <div style={{
              background: '#ECFDF5', border: '1px solid #6EE7B7',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '18px',
              color: '#065F46', fontSize: '0.84rem', textAlign: 'center', fontWeight: 700
            }}>
              {successMsg}
            </div>
          )}

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#991B1B',
              fontSize: '0.84rem'
            }}>
              <AlertCircle size={16} color="#991B1B" />
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-dark)',
              marginBottom: '6px'
            }}>
              {mode === 'forgot' ? 'Username or Registered Phone Number' : 'Username'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'forgot' ? 'e.g. admin or 9876543210' : 'Enter admin username'}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(197, 160, 89, 0.4)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {mode === 'forgot' ? (
            <div style={{
              background: '#F0FDF4',
              border: '1.5px solid #A7F3D0',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{ fontWeight: 800, color: '#065F46', fontSize: '0.95rem', marginBottom: '8px' }}>
                🔒 Account Recovery & Password Support
              </div>
              <p style={{ fontSize: '0.82rem', color: '#047857', lineHeight: 1.5, marginBottom: '16px' }}>
                For account security, direct self-service password reset is disabled. Please contact Super Admin support via WhatsApp with your registered restaurant name to safely recover your account login.
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
                  borderRadius: 'var(--radius-pill)',
                  background: '#059669',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)'
                }}
              >
                💬 Request Account Recovery on WhatsApp
              </a>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-dark)'
                }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                  style={{
                    background: 'none', border: 'none', color: '#059669',
                    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  🔑 Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    fontSize: '0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(197, 160, 89, 0.4)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--primary-dark-green)',
                color: '#FFFFFF',
                border: '1px solid var(--accent-gold)',
                fontSize: '0.95rem',
                fontWeight: 700,
                transition: 'var(--transition-fast)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Processing...' : 'Log In to Panel'}
            </button>
          )}

          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
              style={{
                width: '100%', marginTop: '12px', padding: '10px', color: '#059669',
                fontSize: '0.85rem', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer'
              }}
            >
              ← Back to Owner Login
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: 'none',
                background: 'none',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} /> Return to Customer Menu
            </button>
          )}

          {mode === 'forgot' && (
            <div style={{
              marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(0,0,0,0.1)',
              textAlign: 'center', fontSize: '0.78rem', color: '#4B5563'
            }}>
              <span>Username & Phone dono bhool gaye? </span>
              <a
                href={`https://wa.me/${(supportPhone || '919876543210').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello Super Admin, I forgot my restaurant login details. Please help me recover my account.')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#059669', fontWeight: 800, textDecoration: 'none' }}
              >
                💬 Contact Super Admin Support
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
