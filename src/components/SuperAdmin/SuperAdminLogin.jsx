import React, { useState } from 'react';
import { Crown, Lock, User, ArrowLeft, ShieldAlert } from 'lucide-react';
import { superAdminLogin } from '../../api/client';

export default function SuperAdminLogin({ onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('superadmin');
  const [password, setPassword] = useState('superadmin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await superAdminLogin(username, password);
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
      background: 'linear-gradient(135deg, #05140B 0%, #0A2315 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '32px 24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        border: '2px solid #D4AF37',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Back Button */}
        <button
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
            fontWeight: 700
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Crown Badge */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #DFBA67 0%, #C5A059 100%)',
          color: '#0A2315',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(212, 175, 55, 0.4)'
        }}>
          <Crown size={32} color="#0A2315" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary-emerald)', marginBottom: '4px' }}>
          SaaS Master Portal
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Super Admin Access for Managing Client Restaurants & Subscriptions
        </p>

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
            gap: '8px'
          }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>
              SUPER ADMIN USERNAME
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#C5A059" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>
              MASTER PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#C5A059" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-light)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
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
              fontSize: '0.95rem',
              fontWeight: 900,
              border: '1.5px solid #C5A059',
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
