import React, { useState } from 'react';
import { Settings, CreditCard, Clock, Phone, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function SettingsView({ paymentKeys, onSavePaymentKeys, securityForm, setSecurityForm, onSaveSecurity, savingKeys, savingSecurity, keysMsg, securityMsg, securityError }) {
  const [activeTab, setActiveTab] = useState('payments');
  const [keysForm, setKeysForm] = useState(paymentKeys);

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
    </div>
  );
}
