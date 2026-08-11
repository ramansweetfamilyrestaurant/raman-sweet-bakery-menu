import React, { useState, useEffect } from 'react';
import { Settings, CreditCard, Clock, Phone, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { resolveImageUrl } from '../../../utils/imageHelper';

export default function SettingsView({ paymentKeys, onSavePaymentKeys, securityForm, setSecurityForm, onSaveSecurity, savingKeys, savingSecurity, keysMsg, securityMsg, securityError, onUploadLogo, onResetLogo }) {
  const [activeTab, setActiveTab] = useState('payments');
  const [keysForm, setKeysForm] = useState(paymentKeys);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (keysForm.platform_logo_url) {
      setLogoErr(false);
    }
  }, [keysForm.platform_logo_url]);

  const handleSaveKeysSubmit = (e) => {
    e.preventDefault();
    onSavePaymentKeys(keysForm);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <Settings size={22} color="var(--sa-primary)" /> System Configuration & Security Controls
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Configure Cashfree payment API credentials, default trial terms, support channels, and master security.
          </span>
        </div>
      </div>

      {/* Tab Selector Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--sa-border)', gap: '4px' }}>
        <button
          onClick={() => setActiveTab('payments')}
          style={{
            padding: '10px 18px', fontWeight: 800, fontSize: '0.86rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'payments' ? '2.5px solid var(--sa-primary)' : '2.5px solid transparent',
            color: activeTab === 'payments' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <CreditCard size={16} /> Payment Gateway
        </button>
        <button
          onClick={() => setActiveTab('trial')}
          style={{
            padding: '10px 18px', fontWeight: 800, fontSize: '0.86rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'trial' ? '2.5px solid var(--sa-primary)' : '2.5px solid transparent',
            color: activeTab === 'trial' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Clock size={16} /> Subscription & Trial Terms
        </button>
        <button
          onClick={() => setActiveTab('support')}
          style={{
            padding: '10px 18px', fontWeight: 800, fontSize: '0.86rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'support' ? '2.5px solid var(--sa-primary)' : '2.5px solid transparent',
            color: activeTab === 'support' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Phone size={16} /> Support Channels
        </button>
        <button
          onClick={() => setActiveTab('security')}
          style={{
            padding: '10px 18px', fontWeight: 800, fontSize: '0.86rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'security' ? '2.5px solid var(--sa-primary)' : '2.5px solid transparent',
            color: activeTab === 'security' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Lock size={16} /> Master Credentials
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          style={{
            padding: '10px 18px', fontWeight: 800, fontSize: '0.86rem', border: 'none', background: 'transparent',
            borderBottom: activeTab === 'branding' ? '2.5px solid var(--sa-primary)' : '2.5px solid transparent',
            color: activeTab === 'branding' ? 'var(--sa-primary)' : 'var(--sa-text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          🖼️ Branding & Logo
        </button>
      </div>

      {/* Tab 1: Payment Gateway */}
      {activeTab === 'payments' && (
        <div className="sa-table-container" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0' }}>
            💳 Cashfree Payment Gateway Credentials
          </h3>

          <form onSubmit={handleSaveKeysSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>
                CASHFREE APP ID (CLIENT ID):
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1047648f574d75432..."
                value={keysForm.cashfree_app_id}
                onChange={(e) => setKeysForm({ ...keysForm, cashfree_app_id: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>
                CASHFREE SECRET KEY:
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••••••••••••••"
                value={keysForm.cashfree_secret_key}
                onChange={(e) => setKeysForm({ ...keysForm, cashfree_secret_key: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-success)', fontWeight: 800, marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={13} /> Configured ✓ API Secrets are masked for security.
              </span>
            </div>

            {keysMsg && (
              <div style={{ padding: '10px', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem', fontWeight: 800 }}>
                {keysMsg}
              </div>
            )}

            <button type="submit" className="sa-btn sa-btn-accent" disabled={savingKeys}>
              {savingKeys ? 'Saving...' : 'Save Gateway Credentials'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Subscription & Trial */}
      {activeTab === 'trial' && (
        <div className="sa-table-container" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0' }}>
            ⏳ Dynamic Free Trial & Grace Period Terms
          </h3>

          <form onSubmit={handleSaveKeysSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>
                DEFAULT FREE TRIAL DURATION (DAYS):
              </label>
              <input
                type="number"
                required
                min="1"
                max="90"
                value={keysForm.default_trial_days}
                onChange={(e) => setKeysForm({ ...keysForm, default_trial_days: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.88rem', fontWeight: 800 }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', marginTop: '4px', display: 'block' }}>
                * Database-driven. New restaurant registrations automatically receive this trial duration.
              </span>
            </div>

            {keysMsg && (
              <div style={{ padding: '10px', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem', fontWeight: 800 }}>
                {keysMsg}
              </div>
            )}

            <button type="submit" className="sa-btn sa-btn-accent" disabled={savingKeys}>
              {savingKeys ? 'Saving...' : 'Save Trial Terms'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Support Channels */}
      {activeTab === 'support' && (
        <div className="sa-table-container" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0' }}>
            💬 Super Admin Support Channels
          </h3>

          <form onSubmit={handleSaveKeysSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>
                SUPER ADMIN WHATSAPP NUMBER (WITH COUNTRY CODE):
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 919876543210"
                value={keysForm.support_whatsapp}
                onChange={(e) => setKeysForm({ ...keysForm, support_whatsapp: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ background: 'var(--sa-surface-subtle)', padding: '12px', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>LIVE WHATSAPP ACTION PREVIEW:</span>
              <a
                href={`https://wa.me/${(keysForm.support_whatsapp || '').replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--sa-success)', fontWeight: 800, textDecoration: 'none' }}
              >
                https://wa.me/{(keysForm.support_whatsapp || '').replace(/[^0-9]/g, '')}
              </a>
            </div>

            {keysMsg && (
              <div style={{ padding: '10px', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem', fontWeight: 800 }}>
                {keysMsg}
              </div>
            )}

            <button type="submit" className="sa-btn sa-btn-accent" disabled={savingKeys}>
              {savingKeys ? 'Saving...' : 'Save Support Channel'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Master Security */}
      {activeTab === 'security' && (
        <div className="sa-table-container" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0' }}>
            🔒 Master Credentials & Security Controls
          </h3>

          <form onSubmit={onSaveSecurity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>SUPER ADMIN USERNAME:</label>
              <input
                type="text"
                required
                value={securityForm.newUsername}
                onChange={(e) => setSecurityForm({ ...securityForm, newUsername: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>CURRENT PASSWORD (REQUIRED):</label>
              <input
                type="password"
                required
                value={securityForm.currentPassword}
                onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>NEW PASSWORD (OPTIONAL):</label>
              <input
                type="password"
                value={securityForm.newPassword}
                onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
            </div>

            {securityError && (
              <div style={{ padding: '10px', background: 'var(--sa-danger-bg)', color: 'var(--sa-danger)', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem', fontWeight: 800 }}>
                {securityError}
              </div>
            )}

            {securityMsg && (
              <div style={{ padding: '10px', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem', fontWeight: 800 }}>
                {securityMsg}
              </div>
            )}

            <button type="submit" className="sa-btn sa-btn-danger" disabled={savingSecurity}>
              {savingSecurity ? 'Saving...' : 'Update Master Credentials'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 5: Branding & Platform Logo */}
      {activeTab === 'branding' && (
        <div className="sa-table-container" style={{ padding: '24px', maxWidth: '640px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 16px 0' }}>
            🖼️ Platform Logo & Branding Configuration
          </h3>

          <form onSubmit={handleSaveKeysSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Logo Preview & File Select */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
              background: 'var(--sa-surface-subtle)', borderRadius: '12px', border: '1px solid var(--sa-border)'
            }}>
              {logoPreview || (keysForm.platform_logo_url && !logoErr) ? (
                <img
                  src={logoPreview || resolveImageUrl(keysForm.platform_logo_url)}
                  alt="Platform Logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoErr(true)}
                  style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'contain', background: '#FFF', padding: '4px' }}
                />
              ) : (
                <div style={{
                  width: '64px', height: '64px', borderRadius: '12px', background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
                  color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 900
                }}>
                  👑
                </div>
              )}

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
                  UPLOAD NEW LOGO FILE:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !onUploadLogo) return;
                    const localObjUrl = URL.createObjectURL(file);
                    setLogoPreview(localObjUrl);
                    setLogoErr(false);
                    setUploadingLogo(true);
                    try {
                      const newUrl = await onUploadLogo(file);
                      const timestampedUrl = newUrl.includes('?') ? `${newUrl}&t=${Date.now()}` : `${newUrl}?t=${Date.now()}`;
                      setKeysForm(prev => ({ ...prev, platform_logo_url: timestampedUrl }));
                      setLogoErr(false);
                    } catch (err) {
                      alert('Logo upload failed: ' + err.message);
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                  disabled={uploadingLogo}
                  style={{ fontSize: '0.8rem' }}
                />
                {uploadingLogo && <span style={{ fontSize: '0.75rem', color: '#DFBA67', fontWeight: 700 }}>⏳ Uploading image to R2 storage & Database...</span>}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>
                PLATFORM LOGO URL (IMAGE PROXY / R2 URL):
              </label>
              <input
                type="text"
                placeholder="e.g. /api/r2-proxy/superadmin/branding/logo.webp or external image URL"
                value={keysForm.platform_logo_url || ''}
                onChange={(e) => {
                  setKeysForm({ ...keysForm, platform_logo_url: e.target.value });
                  setLogoErr(false);
                }}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontSize: '0.85rem' }}
              />
            </div>

            {keysMsg && (
              <div style={{ padding: '10px', background: keysMsg.includes('✓') ? 'var(--sa-success-bg)' : 'var(--sa-danger-bg)', color: keysMsg.includes('✓') ? 'var(--sa-success)' : 'var(--sa-danger)', borderRadius: 'var(--sa-radius-md)', fontSize: '0.8rem', fontWeight: 800 }}>
                {keysMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="sa-btn sa-btn-primary" disabled={savingKeys} style={{ flex: 1 }}>
                {savingKeys ? 'Saving...' : 'Save Branding Settings'}
              </button>

              {keysForm.platform_logo_url && onResetLogo && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to reset logo to default?')) {
                      await onResetLogo();
                      setKeysForm(prev => ({ ...prev, platform_logo_url: '' }));
                      setLogoErr(false);
                    }
                  }}
                  style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#EF4444', padding: '10px 16px', borderRadius: 'var(--sa-radius-md)',
                    fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  🗑️ Reset Logo
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
