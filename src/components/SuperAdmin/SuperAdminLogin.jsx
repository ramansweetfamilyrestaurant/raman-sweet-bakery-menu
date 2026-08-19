import React, { useState, useEffect } from 'react';
import { Crown, Lock, User, ArrowLeft, ShieldAlert, Eye, EyeOff, ShieldCheck } from 'lucide-react';
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
      padding: '20px',
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
        maxWidth: '420px',
        width: '100%',
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '36px 26px 28px',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.45)',
        border: '2px solid #D4AF37',
        textAlign: 'center',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Back Button */}
        <button
          type="button"
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            fontWeight: 800,
            background: '#F1F5F9',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Crown Badge or Platform Logo */}
        {platformLogo && !logoErr ? (
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#FFFFFF',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '12px auto 16px',
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
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#DFBA67',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '12px auto 16px',
            boxShadow: '0 8px 24px rgba(10, 35, 21, 0.3)',
            border: '2px solid #D4AF37'
          }}>
            <Crown size={30} color="#DFBA67" />
          </div>
        )}

        <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary-emerald)', marginBottom: '4px', letterSpacing: '-0.02em' }}>
          SaaS Master Control
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '18px', fontWeight: 600 }}>
          Super Admin Authorization Gateway
        </p>

        {/* Security Trust Banner */}
        <div style={{
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '12px',
          padding: '8px 12px',
          fontSize: '0.74rem',
          color: '#166534',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginBottom: '20px'
        }}>
          <ShieldCheck size={16} color="#15803D" /> 256-Bit SSL Encrypted Admin Portal
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.76rem', fontWeight: 900, color: 'var(--text-dark)', marginBottom: '6px', display: 'block', letterSpacing: '0.03em' }}>
              SUPER ADMIN USERNAME
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#C5A059" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                autoComplete="off"
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.76rem', fontWeight: 900, color: 'var(--text-dark)', marginBottom: '6px', display: 'block', letterSpacing: '0.03em' }}>
              MASTER PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#C5A059" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
              color: '#DFBA67',
              padding: '14px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.92rem',
              fontWeight: 900,
              border: '1.5px solid #D4AF37',
              boxShadow: '0 6px 20px rgba(10, 35, 21, 0.4)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Authenticating...' : '👑 Login to Super Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
