import React, { useState, useEffect } from 'react';
import { Crown, Lock, User, ArrowLeft, ShieldAlert, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { superAdminLogin } from '../../api/client';
import { resolveImageUrl } from '../../utils/imageHelper';

export default function SuperAdminLogin({ onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [platformLogo, setPlatformLogo] = useState(() => {
    try { return localStorage.getItem('touchqr_platform_logo_url') || ''; } catch { return ''; }
  });
  const [logoErr, setLogoErr] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.platform_logo_url === 'string') {
          setPlatformLogo(data.platform_logo_url);
          try {
            if (data.platform_logo_url.trim()) {
              localStorage.setItem('touchqr_platform_logo_url', data.platform_logo_url);
            } else {
              localStorage.removeItem('touchqr_platform_logo_url');
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await superAdminLogin(username.trim(), password);
      onLoginSuccess(data.token, data.username);
    } catch (err) {
      setError(err.message || 'Invalid Super Admin credentials');
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
      {/* Background Radial Glow */}
      <div style={{
        position: 'absolute', width: '380px', height: '380px',
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(223,186,103,0.18) 0%, rgba(0,0,0,0) 70%)',
        top: '15%', left: '30%', pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '430px',
        width: '100%',
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '36px 28px 28px',
        boxShadow: '0 25px 60px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(212, 175, 55, 0.35)',
        border: '1.5px solid #D4AF37',
        textAlign: 'center',
        position: 'relative',
        zIndex: 2,
        boxSizing: 'border-box'
      }}>
        {/* Back Button */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Return to previous screen"
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.78rem',
            fontWeight: 800,
            background: '#F1F5F9',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Crown Badge or Platform Logo */}
        {platformLogo && !logoErr ? (
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: '#FFFFFF',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '12px auto 14px',
            boxShadow: '0 8px 24px rgba(10, 35, 21, 0.25)',
            border: '2px solid #D4AF37',
            overflow: 'hidden'
          }}>
            <img
              src={resolveImageUrl(platformLogo)}
              alt="Platform Logo"
              onError={() => setLogoErr(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#DFBA67',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '12px auto 14px',
            boxShadow: '0 8px 24px rgba(10, 35, 21, 0.3)',
            border: '2px solid #D4AF37'
          }}>
            <Crown size={28} color="#DFBA67" />
          </div>
        )}

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#DFBA67', fontSize: '0.70rem', fontWeight: 900, letterSpacing: '0.08em', border: '1px solid #D4AF37', marginBottom: '8px' }}>
          <Crown size={12} color="#DFBA67" /> SUPER ADMIN
        </div>

        <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0A2315', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
          TouchQR
        </h1>
        <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 600 }}>
          Multi-Business SaaS Control Center
        </p>

        {/* Security Trust Banner */}
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '10px',
          padding: '7px 12px',
          fontSize: '0.76rem',
          color: '#166534',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '20px'
        }}>
          <span>🔒 Secure Admin Portal</span>
        </div>

        {error && (
          <div style={{
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.82rem',
            fontWeight: 700,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ textAlign: 'left' }}>
            <label 
              htmlFor="superadmin-username"
              style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', marginBottom: '6px', display: 'block', letterSpacing: '0.03em' }}
            >
              SUPER ADMIN USERNAME
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={17} color="#94A3B8" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
              <input
                id="superadmin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                autoComplete="username"
                required
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.90rem',
                  fontWeight: 600,
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

          <div style={{ textAlign: 'left' }}>
            <label 
              htmlFor="superadmin-password"
              style={{ fontSize: '0.76rem', fontWeight: 900, color: '#334155', marginBottom: '6px', display: 'block', letterSpacing: '0.03em' }}
            >
              MASTER PASSWORD
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={17} color="#94A3B8" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
              <input
                id="superadmin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '10px 42px 10px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.90rem',
                  fontWeight: 600,
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
                  cursor: 'pointer',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              height: '48px',
              marginTop: '4px',
              background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
              color: '#DFBA67',
              borderRadius: '12px',
              fontSize: '0.94rem',
              fontWeight: 900,
              border: '1.5px solid #D4AF37',
              boxShadow: '0 4px 16px rgba(10, 35, 21, 0.3)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
