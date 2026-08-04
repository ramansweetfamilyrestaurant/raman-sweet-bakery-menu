import React, { useState } from 'react';
import { Lock, User, KeyRound, ArrowLeft, AlertCircle } from 'lucide-react';
import { adminLogin } from '../../api/client';

export default function AdminLogin({ onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await adminLogin(username, password);
      onLoginSuccess(data.token, data.username);
    } catch (err) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F2C1D 0%, #163826 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '420px',
        boxShadow: 'var(--shadow-lg)',
        border: '1.5px solid var(--accent-gold)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--primary-dark-green)',
          padding: '24px',
          color: '#FFFFFF',
          textAlign: 'center',
          borderBottom: '1px solid var(--accent-gold)'
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
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#FFFFFF'
          }}>
            Manager Login
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-gold-light)' }}>
            Raman Sweet Bakery Admin Panel
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
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
              Username
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
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

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-dark)',
              marginBottom: '6px'
            }}>
              Password
            </label>
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
            {loading ? 'Authenticating...' : 'Log In to Panel'}
          </button>

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
              gap: '6px'
            }}
          >
            <ArrowLeft size={16} /> Return to Customer Menu
          </button>
        </form>
      </div>
    </div>
  );
}
