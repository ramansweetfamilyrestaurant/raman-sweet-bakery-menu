import React, { useState } from 'react';
import { Sparkles, CheckCircle, X } from 'lucide-react';
import { SAAS_PLANS } from '../../../config/plans';

export default function GrantFreeAccessModal({ resto, plansList, isOpen, onClose, onConfirmGrant }) {
  const [step, setStep] = useState('form'); // 'form', 'confirm', 'success'
  const [form, setForm] = useState({
    plan_key: resto ? (resto.plan_tier || 'pro') : 'pro',
    duration_days: '30',
    valid_until: '',
    notes: 'Partner restaurant'
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen || !resto) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await onConfirmGrant(resto.id, {
        plan_key: form.plan_key,
        duration_days: form.duration_days,
        valid_until: form.valid_until || undefined,
        is_lifetime: form.duration_days === 'lifetime',
        notes: form.notes
      });
      setResult(res);
      setStep('success');
    } catch (err) {
      alert(err.message || 'Failed to grant complimentary access');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)' }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--sa-purple-bg)', color: 'var(--sa-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
              {step === 'confirm' ? 'Confirm Free Access' : step === 'success' ? 'Access Activated!' : 'Grant Complimentary Access'}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Restaurant: <strong>{resto.name}</strong> (/{resto.slug})
            </span>
          </div>
        </div>

        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>SELECT SAAS PLAN:</label>
              <select
                value={form.plan_key}
                onChange={(e) => setForm({ ...form, plan_key: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontWeight: 700 }}
              >
                {(plansList && plansList.length > 0 ? plansList : Object.values(SAAS_PLANS)).map(p => (
                  <option key={p.key} value={p.key}>{p.name || p.key.toUpperCase()} (₹{p.price}/mo normally)</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>ACCESS DURATION:</label>
              <select
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontWeight: 700 }}
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days (1 Month)</option>
                <option value="90">90 Days (3 Months)</option>
                <option value="180">6 Months</option>
                <option value="365">1 Year (365 Days)</option>
                <option value="lifetime">Lifetime Access</option>
                <option value="custom">Custom Expiry Date</option>
              </select>
            </div>

            {form.duration_days === 'custom' && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>SELECT EXPIRY DATE:</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)' }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>ADMIN NOTE (INTERNAL):</label>
              <input
                type="text"
                placeholder="e.g. Partner restaurant, Promotional sponsor..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)' }}
              />
            </div>

            <div style={{ background: 'var(--sa-info-bg)', border: '1px solid var(--sa-info-border)', borderRadius: 'var(--sa-radius-md)', padding: '10px', fontSize: '0.76rem', color: '#1E40AF', fontWeight: 600 }}>
              🛡️ Zero Charge Guarantee: Cashfree payment is NOT required. Recurring amount will be set to ₹0 and auto-renew disabled.
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={onClose} className="sa-btn sa-btn-secondary">Cancel</button>
              <button onClick={() => setStep('confirm')} className="sa-btn sa-btn-primary">Next: Review Terms ➔</button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <div style={{ background: 'var(--sa-surface-subtle)', border: '1px solid var(--sa-border)', borderRadius: 'var(--sa-radius-md)', padding: '14px', marginBottom: '16px', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sa-border)' }}>
                <span>Selected Plan:</span><strong style={{ color: 'var(--sa-primary)' }}>{form.plan_key.toUpperCase()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sa-border)' }}>
                <span>Customer Charge:</span><strong style={{ color: 'var(--sa-success)' }}>₹0 / month (Free Access)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sa-border)' }}>
                <span>Duration:</span><strong>{form.duration_days === 'lifetime' ? 'Lifetime Access' : `${form.duration_days} Days`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Cashfree Mandate:</span><strong>NOT REQUIRED</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('form')} className="sa-btn sa-btn-secondary">⬅️ Back</button>
              <button onClick={handleConfirm} disabled={submitting} className="sa-btn sa-btn-primary">
                {submitting ? 'Processing...' : '🎁 Confirm & Grant Access'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && result && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', border: '2px solid var(--sa-success-border)' }}>
              <CheckCircle size={30} />
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-success)', margin: '0 0 6px 0' }}>✓ Complimentary Access Activated!</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)', margin: '0 0 16px 0' }}>{result.message}</p>
            <button onClick={onClose} className="sa-btn sa-btn-primary" style={{ width: '100%' }}>Done / Close Window</button>
          </div>
        )}
      </div>
    </div>
  );
}
