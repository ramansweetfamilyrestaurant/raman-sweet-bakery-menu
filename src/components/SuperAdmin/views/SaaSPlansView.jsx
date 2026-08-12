import React, { useState, useEffect } from 'react';
import { Layers, Save, CheckCircle2, ShieldCheck, Sparkles, AlertCircle, RefreshCw, Plus, X } from 'lucide-react';

export default function SaaSPlansView({ token }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Create Plan Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    key: '',
    name: '',
    price: 1499,
    original_price: 2999,
    badge: '🚀 VIP',
    description: 'Custom VIP Plan with full features',
    whatsapp_enabled: 1,
    direct_ordering_enabled: 1,
    google_reviews_enabled: 1
  });
  const [creating, setCreating] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/superadmin/plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data);
      } else {
        setErrorMsg('Failed to load SaaS plans data.');
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setErrorMsg('Network error loading SaaS plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPlans();
  }, [token]);

  const handlePlanValueChange = (planKey, field, val) => {
    setPlans(prev => prev.map(p => p.key === planKey ? { ...p, [field]: val } : p));
  };

  const handleSaveAllPlans = async () => {
    setSaving(true);
    setMsg('');
    setErrorMsg('');
    try {
      for (const p of plans) {
        const res = await fetch(`/api/superadmin/plans/${p.key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(p)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Failed to update plan '${p.name}'`);
        }
      }
      setMsg('⚡ All 24 Plan Permissions & Limits Saved Successfully!');
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      console.error('Error saving plans:', err);
      setErrorMsg(err.message || 'Failed to save plan permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlanSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return alert('Plan Name is required!');
    setCreating(true);
    try {
      const res = await fetch('/api/superadmin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create plan');
      setMsg(`✨ Custom SaaS Plan '${createForm.name}' created successfully!`);
      setShowCreateModal(false);
      setCreateForm({
        key: '',
        name: '',
        price: 1499,
        original_price: 2999,
        badge: '🚀 VIP',
        description: '',
        whatsapp_enabled: 1,
        direct_ordering_enabled: 1,
        google_reviews_enabled: 1
      });
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sa-text-muted)' }}>
        <RefreshCw className="animate-spin" style={{ width: '28px', height: '28px', margin: '0 auto 12px auto' }} />
        <p style={{ fontWeight: 700 }}>Loading Master SaaS Plan Permission Matrix...</p>
      </div>
    );
  }

  const numericFields = [
    { key: 'price', label: 'Monthly Price (₹)', placeholder: '999' },
    { key: 'max_dishes', label: 'Max Dishes Limit', placeholder: '9999' },
    { key: 'max_categories', label: 'Max Categories Limit', placeholder: '9999' },
    { key: 'max_combos', label: 'Max Combos Limit', placeholder: '9999' },
    { key: 'max_tables', label: 'Max Tables / QR Standees Limit', placeholder: '9999' },
    { key: 'max_staff_accounts', label: 'Max Staff Accounts / Logins Limit', placeholder: '9999' },
    { key: 'order_retention_days', label: 'Order Retention History (Days)', placeholder: '365' },
  ];

  const toggleFields = [
    { key: 'modifiers_enabled', label: 'Advanced Modifiers & Half/Full Variants' },
    { key: 'staff_roles_enabled', label: 'Staff Roles (Waiter / Kitchen / Cashier)' },
    { key: 'whatsapp_ordering_enabled', label: 'WhatsApp Customer Ordering' },
    { key: 'direct_ordering_enabled', label: 'Direct Web Cart Ordering' },
    { key: 'audio_alarm_enabled', label: '📢 New Order Audio / Voice Alarm' },
    { key: 'order_status_whatsapp_enabled', label: '📲 WhatsApp Order Status Alerts' },
    { key: 'kds_enabled', label: '🍳 Kitchen Display System (KDS Screen)' },
    { key: 'bluetooth_kot_enabled', label: '🖨️ Flexible Single & Dual Thermal Printer Routing (Kitchen KOT + Counter Bill)' },
    { key: 'google_reviews_enabled', label: 'Google Review Collector' },
    { key: 'ai_review_enabled', label: '🤖 Google Review AI Auto-Reply Assistant' },
    { key: 'gst_invoice_enabled', label: 'GST Invoice & Custom Tax Receipt' },
    { key: 'analytics_export_enabled', label: 'Advanced Sales Analytics & CSV Export' },
    { key: 'multi_language_enabled', label: 'Multi-Language Auto Translation' },
    { key: 'watermark_removal_enabled', label: '🏷️ "Powered by TouchQR" Watermark Removal' },
    { key: 'custom_domain_enabled', label: '🌐 Custom Domain Mapping (menu.resto.com)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '16px', background: '#FFFFFF', padding: '20px 24px',
        borderRadius: 'var(--sa-radius-lg)', border: '1px solid var(--sa-border)',
        boxShadow: 'var(--sa-shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
              Master 24-Point SaaS Plan Permission & Limit Matrix
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--sa-text-muted)', margin: '2px 0 0 0' }}>
              Full GUI Control over prices, feature toggles, and numerical limits across all SaaS tiers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 20px', borderRadius: '12px',
              background: '#0A2315', color: '#D4AF37', fontWeight: 900,
              border: '1px solid #D4AF37', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(10, 35, 21, 0.2)', transition: 'all 0.2s ease'
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            + Create New SaaS Plan
          </button>

          <button
            onClick={handleSaveAllPlans}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #D4AF37 0%, #B48F27 100%)',
              color: '#0A2315', fontWeight: 900, border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)', transition: 'all 0.2s ease',
              opacity: saving ? 0.7 : 1
            }}
          >
            <Save style={{ width: '18px', height: '18px' }} />
            {saving ? 'Saving Matrix...' : 'Save All Plan Permissions'}
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#DCFCE7', color: '#15803D', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 style={{ width: '18px', height: '18px' }} /> {msg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEE2E2', color: '#B91C1C', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle style={{ width: '18px', height: '18px' }} /> {errorMsg}
        </div>
      )}

      {/* Permission Matrix Table */}
      <div style={{
        background: '#FFFFFF', borderRadius: 'var(--sa-radius-lg)',
        border: '1px solid var(--sa-border)', overflowX: 'auto',
        boxShadow: 'var(--sa-shadow-sm)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--sa-border)' }}>
              <th style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: 900, color: 'var(--sa-text-main)', width: '35%' }}>
                FEATURE / PERMISSION CONTROL
              </th>
              {plans.map(p => (
                <th key={p.key} style={{ padding: '16px 20px', fontSize: '0.88rem', fontWeight: 900, color: '#0A2315', textTransform: 'uppercase' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{p.badge || '👑'}</span>
                    <span>{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Numerical Limit Controls */}
            <tr style={{ background: '#F1F5F9' }}>
              <td colSpan={plans.length + 1} style={{ padding: '10px 20px', fontSize: '0.75rem', fontWeight: 900, color: '#0A2315', letterSpacing: '0.5px' }}>
                📊 PRICING & NUMERICAL LIMIT CONTROLS
              </td>
            </tr>
            {numericFields.map(f => (
              <tr key={f.key} style={{ borderBottom: '1px solid var(--sa-border)' }}>
                <td style={{ padding: '14px 20px', fontSize: '0.86rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
                  {f.label}
                </td>
                {plans.map(p => (
                  <td key={p.key} style={{ padding: '12px 20px' }}>
                    <input
                      type="number"
                      value={p[f.key] !== undefined && p[f.key] !== null ? p[f.key] : ''}
                      onChange={(e) => handlePlanValueChange(p.key, f.key, parseInt(e.target.value, 10) || 0)}
                      placeholder={f.placeholder}
                      style={{
                        width: '100%', maxWidth: '140px', padding: '8px 12px',
                        borderRadius: '8px', border: '1.5px solid var(--sa-border)',
                        fontSize: '0.86rem', fontWeight: 800, color: 'var(--sa-text-main)',
                        boxSizing: 'border-box'
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}

            {/* Feature Toggle Controls */}
            <tr style={{ background: '#F1F5F9' }}>
              <td colSpan={plans.length + 1} style={{ padding: '10px 20px', fontSize: '0.75rem', fontWeight: 900, color: '#0A2315', letterSpacing: '0.5px' }}>
                ⚡ FEATURE TOGGLE PERMISSIONS (ON / OFF)
              </td>
            </tr>
            {toggleFields.map(f => (
              <tr key={f.key} style={{ borderBottom: '1px solid var(--sa-border)' }}>
                <td style={{ padding: '12px 20px', fontSize: '0.86rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>
                  {f.label}
                </td>
                {plans.map(p => {
                  const isChecked = Boolean(p[f.key] !== 0 && p[f.key] !== false && p[f.key] !== '0');
                  return (
                    <td key={p.key} style={{ padding: '12px 20px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handlePlanValueChange(p.key, f.key, e.target.checked ? 1 : 0)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#0A2315' }}
                        />
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: isChecked ? '#15803D' : '#94A3B8' }}>
                          {isChecked ? 'ALLOWED (ON)' : 'DISABLED (OFF)'}
                        </span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE NEW SAAS PLAN MODAL OVERLAY */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(10,35,21,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF', width: '100%', maxWidth: '520px', borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid var(--sa-border)'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', background: '#0A2315', color: '#DFBA67'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles style={{ width: '22px', height: '22px' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Create New Custom SaaS Plan</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>PLAN NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Ultra Plan"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>PLAN KEY (UNIQUE)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. vip_ultra"
                    value={createForm.key}
                    onChange={e => setCreateForm({ ...createForm, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MONTHLY PRICE (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="1499"
                    value={createForm.price}
                    onChange={e => setCreateForm({ ...createForm, price: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>BADGE / EMOJI</label>
                  <input
                    type="text"
                    placeholder="e.g. 🚀 VIP"
                    value={createForm.badge}
                    onChange={e => setCreateForm({ ...createForm, badge: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>ORIGINAL STRIKETHROUGH (₹)</label>
                  <input
                    type="number"
                    placeholder="2999"
                    value={createForm.original_price}
                    onChange={e => setCreateForm({ ...createForm, original_price: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DESCRIPTION</label>
                <input
                  type="text"
                  placeholder="Short marketing headline for this plan tier"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--sa-border)', background: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)', color: '#DFBA67', fontWeight: 900, cursor: 'pointer' }}
                >
                  {creating ? 'Creating Plan...' : '✨ Create SaaS Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
