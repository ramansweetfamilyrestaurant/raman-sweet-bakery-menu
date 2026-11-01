import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, CheckCircle, X, Calendar, Crown, Clock, ArrowRight } from 'lucide-react';
import { SAAS_PLANS } from '../../../config/plans';

export default function GrantFreeAccessModal({ resto, plansList, isOpen, onClose, onConfirmGrant }) {
  const isAlreadyVip = Boolean(
    resto && (
      resto.is_complimentary || 
      resto.subscription_type === 'COMPLIMENTARY' || 
      resto.subscription_type === 'ADMIN_GRANTED' ||
      resto.subscription?.is_complimentary
    )
  );

  const currentExpiry = resto?.access_until || resto?.plan_expires_at || resto?.subscription?.access_until;
  const isExplicitLifetime = currentExpiry === 'Lifetime' || String(currentExpiry).toLowerCase() === 'lifetime';
  const currentExpiryDate = (!isExplicitLifetime && currentExpiry) ? new Date(currentExpiry) : null;
  const isCurrentLifetime = isAlreadyVip && (isExplicitLifetime || !currentExpiry || (currentExpiryDate && !isNaN(currentExpiryDate.getTime()) && currentExpiryDate.getFullYear() > 2030));
  const isCurrentlyExpired = !isCurrentLifetime && currentExpiryDate && !isNaN(currentExpiryDate.getTime()) && currentExpiryDate.getTime() <= Date.now();

  const [step, setStep] = useState('form'); // 'form', 'confirm', 'success'
  const [form, setForm] = useState({
    plan_key: resto ? (resto.plan_tier || 'pro') : 'pro',
    duration_days: '30',
    valid_until: '',
    extend_mode: isAlreadyVip && !isCurrentlyExpired ? 'extend' : 'reset', // 'extend' adds to remaining; 'reset' sets from today
    notes: isAlreadyVip ? 'VIP duration extension' : 'Complimentary partner restaurant'
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const availablePlans = useMemo(() => {
    const raw = plansList && plansList.length > 0 ? plansList : Object.values(SAAS_PLANS);
    const restoService = (resto?.service_model || '').toLowerCase();
    const restoBiz = (resto?.business_type || '').toLowerCase();
    const isHotel = restoService === 'hotel' || restoBiz === 'hotel_resort';
    const isCinema = restoService === 'cinema' || restoService === 'seat_service' || restoBiz === 'cinema_theatre';
    const targetIndustry = isHotel ? 'hotel' : (isCinema ? 'cinema' : 'restaurant');

    const filtered = raw.filter(p => {
      const pInd = (p.industry || 'restaurant').toLowerCase();
      const pKey = (p.key || p.id || '').toLowerCase();
      return pInd === targetIndustry || pKey.startsWith(targetIndustry);
    });
    const fallbackPlans = Object.values(SAAS_PLANS).filter(p => (p.industry || 'restaurant') === targetIndustry || p.key.startsWith(targetIndustry));
    return filtered.length > 0 ? filtered : (fallbackPlans.length > 0 ? fallbackPlans : raw.filter(p => (p.industry || 'restaurant') === 'restaurant'));
  }, [plansList, resto]);

  useEffect(() => {
    if (resto && isOpen) {
      const defaultTier = resto.plan_tier && availablePlans.some(p => (p.key || p.id) === resto.plan_tier)
        ? resto.plan_tier
        : (availablePlans[0]?.key || availablePlans[0]?.id || 'pro');

      setForm(prev => ({
        ...prev,
        plan_key: defaultTier,
        extend_mode: isAlreadyVip && !isCurrentlyExpired ? 'extend' : 'reset',
        notes: isAlreadyVip ? 'VIP duration extension' : 'Complimentary partner business'
      }));
    }
  }, [resto, isOpen, availablePlans]);

  if (!isOpen || !resto) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await onConfirmGrant(resto.id, {
        plan_key: form.plan_key,
        duration_days: form.duration_days,
        valid_until: form.valid_until || undefined,
        is_lifetime: form.duration_days === 'lifetime',
        extend_mode: form.extend_mode,
        notes: form.notes
      });
      setResult(res);
      setStep('success');
    } catch (err) {
      alert(err.message || 'Failed to update VIP access');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(10, 35, 21, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#FFFFFF', borderRadius: '24px', maxWidth: '540px', width: '100%',
        padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '2px solid #7C3AED', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--sa-purple-bg)', color: 'var(--sa-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
              {isAlreadyVip ? (step === 'confirm' ? 'Confirm VIP Extension' : step === 'success' ? 'VIP Updated!' : 'Extend / Update VIP Access') : (step === 'confirm' ? 'Confirm Free Access' : step === 'success' ? 'Access Activated!' : 'Grant VIP Complimentary Access')}
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Restaurant: <strong>{resto.name}</strong> (/{resto.slug})
            </span>
          </div>
        </div>

        {/* Current VIP Status Banner if Already VIP */}
        {isAlreadyVip && (
          <div style={{
            background: '#FAF5FF',
            border: '1.5px solid #E9D5FF',
            borderRadius: '12px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}>
            <div>
              <div style={{ fontWeight: 800, color: '#6B21A8' }}>
                👑 Currently Active VIP Tenant
              </div>
              <div style={{ color: '#7E22CE', fontSize: '0.74rem', marginTop: '2px' }}>
                Plan Tier: <strong>{(resto.plan_tier || 'pro').toUpperCase()}</strong> • Status: {isCurrentLifetime ? '♾️ Lifetime' : (currentExpiryDate ? (isCurrentlyExpired ? `Expired on ${currentExpiryDate.toLocaleDateString('en-IN')}` : `Valid until ${currentExpiryDate.toLocaleDateString('en-IN')}`) : 'Active')}
              </div>
            </div>
            <span style={{
              background: '#7E22CE',
              color: '#FFFFFF',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '999px'
            }}>
              VIP Active
            </span>
          </div>
        )}

        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                {isAlreadyVip ? 'ASSIGN / UPDATE PLAN TIER:' : 'SELECT SAAS PLAN:'}
              </label>
              <select
                value={form.plan_key}
                onChange={(e) => setForm({ ...form, plan_key: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontWeight: 700 }}
              >
                {availablePlans.map(p => {
                  const planKey = p.key || p.id;
                  const industryLabel = p.industry ? ` [${p.industry.toUpperCase()}]` : '';
                  return (
                    <option key={planKey} value={planKey}>{p.name || String(planKey).toUpperCase()}{industryLabel} (₹{p.price}/mo normally)</option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>
                {isAlreadyVip ? 'ADDITIONAL ACCESS DURATION:' : 'ACCESS DURATION:'}
              </label>
              <select
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)', fontWeight: 700 }}
              >
                <option value="7">+7 Days (1 Week)</option>
                <option value="16">+16 Days (Canonical Trial)</option>
                <option value="30">+30 Days (1 Month)</option>
                <option value="90">+90 Days (3 Months)</option>
                <option value="180">+180 Days (6 Months)</option>
                <option value="365">+365 Days (1 Year)</option>
                <option value="lifetime">♾️ Lifetime VIP Access</option>
                <option value="custom">📅 Custom Expiry Date</option>
              </select>
            </div>

            {form.duration_days === 'custom' && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>SELECT NEW EXPIRY DATE:</label>
                <input
                  type="date"
                  value={form.valid_until}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)' }}
                />
              </div>
            )}

            {isAlreadyVip && form.duration_days !== 'lifetime' && form.duration_days !== 'custom' && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  EXTENSION CALCULATION METHOD:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#0F172A', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="extend_mode"
                      value="extend"
                      checked={form.extend_mode === 'extend'}
                      onChange={(e) => setForm({ ...form, extend_mode: e.target.value })}
                    />
                    <span><strong>Add to remaining days</strong> (Preserves unexpired period)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: '#0F172A', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="extend_mode"
                      value="reset"
                      checked={form.extend_mode === 'reset'}
                      onChange={(e) => setForm({ ...form, extend_mode: e.target.value })}
                    />
                    <span><strong>Reset from today</strong> (New period starts immediately from now)</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>ADMIN NOTE (INTERNAL):</label>
              <input
                type="text"
                placeholder="e.g. Partner venue, Promotional sponsor, VIP extension..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1.5px solid var(--sa-border)' }}
              />
            </div>

            <div style={{ background: 'var(--sa-info-bg)', border: '1px solid var(--sa-info-border)', borderRadius: 'var(--sa-radius-md)', padding: '10px', fontSize: '0.76rem', color: '#1E40AF', fontWeight: 600 }}>
              🛡️ Zero Charge Guarantee: Cashfree payment is NOT required. Recurring amount is ₹0 and auto-renew is disabled.
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
                <span>Customer Charge:</span><strong style={{ color: 'var(--sa-success)' }}>₹0 / month (VIP Complimentary)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--sa-border)' }}>
                <span>Duration / Action:</span><strong>{form.duration_days === 'lifetime' ? '👑 Lifetime Access' : (form.duration_days === 'custom' ? `Until ${form.valid_until || 'Selected Date'}` : `+${form.duration_days} Days (${form.extend_mode === 'extend' ? 'Added to remaining' : 'From today'})`)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Cashfree Mandate:</span><strong>NOT REQUIRED</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep('form')} className="sa-btn sa-btn-secondary">⬅️ Back</button>
              <button onClick={handleConfirm} disabled={submitting} className="sa-btn sa-btn-primary">
                {submitting ? 'Processing...' : (isAlreadyVip ? '👑 Update & Extend VIP Access' : '🎁 Confirm & Grant Access')}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && result && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--sa-success-bg)', color: 'var(--sa-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', border: '2px solid var(--sa-success-border)' }}>
              <CheckCircle size={30} />
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-success)', margin: '0 0 6px 0' }}>
              {isAlreadyVip ? '✓ VIP Access Successfully Updated!' : '✓ Complimentary Access Activated!'}
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)', margin: '0 0 16px 0' }}>{result.message}</p>
            <button onClick={onClose} className="sa-btn sa-btn-primary" style={{ width: '100%' }}>Done / Close Window</button>
          </div>
        )}
      </div>
    </div>
  );
}
