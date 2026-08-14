import React from 'react';
import { UserCircle, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function ProfileView({ username, securityForm, setSecurityForm, onSaveSecurity, savingSecurity, securityMsg, securityError, onLogout, logoUrl }) {
  const [logoErr, setLogoErr] = React.useState(false);

  let cachedLogo = '';
  try { cachedLogo = localStorage.getItem('touchqr_platform_logo_url') || ''; } catch {}
  const effectiveLogoUrl = logoUrl || cachedLogo;
  const resolvedUrl = effectiveLogoUrl ? resolveImageUrl(effectiveLogoUrl) : '';

  React.useEffect(() => {
    setLogoErr(false);
  }, [effectiveLogoUrl]);

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.88rem', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '500px' }}>
      {/* Profile Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        borderRadius: 'var(--sa-radius-lg)',
        padding: '24px',
        color: '#FFFFFF',
        textAlign: 'center',
        border: '1px solid rgba(212, 175, 55, 0.3)'
      }}>
        {resolvedUrl && !logoErr ? (
          <img
            key={resolvedUrl}
            src={resolvedUrl}
            alt="Super Admin Logo"
            referrerPolicy="no-referrer"
            onError={() => setLogoErr(true)}
            style={{
              width: '60px', height: '60px', borderRadius: '50%',
              objectFit: 'contain', background: '#FFF', padding: '4px',
              border: '2px solid #D4AF37', margin: '0 auto 12px auto', display: 'block'
            }}
          />
        ) : (
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #B48F27)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px auto', fontSize: '1.5rem'
          }}>
            👑
          </div>
        )}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 4px 0' }}>Super Admin</h2>
        <p style={{ fontSize: '0.85rem', color: '#A7F3D0', margin: 0 }}>@{username}</p>
      </div>

      {/* Change Credentials */}
      <div className="sa-table-container" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sa-text-main)' }}>
          <Lock size={18} /> Change Master Credentials
        </h3>

        <form onSubmit={onSaveSecurity} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>CURRENT PASSWORD:</label>
            <input
              type="password"
              required
              placeholder="Enter current password"
              value={securityForm.currentPassword}
              onChange={e => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>NEW USERNAME (OPTIONAL):</label>
            <input
              type="text"
              placeholder="Leave unchanged if not changing"
              value={securityForm.newUsername}
              onChange={e => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>NEW PASSWORD (OPTIONAL):</label>
            <input
              type="password"
              placeholder="Leave blank to keep current"
              value={securityForm.newPassword}
              onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
              style={inputStyle}
            />
          </div>

          {securityMsg && <div style={{ color: 'var(--sa-success)', fontWeight: 700, fontSize: '0.85rem' }}>{securityMsg}</div>}
          {securityError && <div style={{ color: 'var(--sa-danger)', fontWeight: 700, fontSize: '0.85rem' }}>{securityError}</div>}

          <button type="submit" className="sa-btn sa-btn-primary" disabled={savingSecurity}>
            {savingSecurity ? 'Updating...' : '🔒 Update Credentials'}
          </button>
        </form>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="sa-btn sa-btn-danger"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px' }}
      >
        <LogOut size={18} /> Logout from Super Admin
      </button>
    </div>
  );
}

