import React, { useState, useEffect } from 'react';
import { Layers, Save, CheckCircle2, Sparkles, AlertCircle, RefreshCw, Plus, X, Edit3, Trash2 } from 'lucide-react';

const toBoolInt = (val) => {
  if (val === undefined || val === null) return 1;
  return (val === 1 || val === true || val === '1' || val === 'true') ? 1 : 0;
};

export default function SaaSPlansView({ token, restaurants = [] }) {
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

  // Edit Single Plan Modal State
  const [editingPlan, setEditingPlan] = useState(null);

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
        const directOrderingVal = toBoolInt(p.direct_ordering_enabled);
        const payload = {
          ...p,
          direct_ordering_enabled: directOrderingVal,
          presence_verification_enabled: directOrderingVal,
          allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK'
        };

        const res = await fetch(`/api/superadmin/plans/${p.key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `Failed to update plan '${p.name}'`);
        }
      }
      setMsg('⚡ All Plan Permissions & Limits Saved Successfully!');
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
      const directOrderingVal = toBoolInt(createForm.direct_ordering_enabled);
      const payload = {
        ...createForm,
        direct_ordering_enabled: directOrderingVal,
        presence_verification_enabled: directOrderingVal,
        allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK'
      };

      const res = await fetch('/api/superadmin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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
        description: 'Custom VIP Plan with full features',
        whatsapp_enabled: 1,
        direct_ordering_enabled: 1,
        google_reviews_enabled: 1
      });
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Error creating plan');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSinglePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSaving(true);
    try {
      const directOrderingVal = toBoolInt(editingPlan.direct_ordering_enabled);
      const payload = {
        ...editingPlan,
        direct_ordering_enabled: directOrderingVal,
        presence_verification_enabled: directOrderingVal,
        allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK'
      };

      const res = await fetch(`/api/superadmin/plans/${editingPlan.key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Failed to update plan '${editingPlan.name}'`);
      }
      setMsg(`⚡ Plan '${editingPlan.name}' updated successfully!`);
      setEditingPlan(null);
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planKey, planName) => {
    if (['basic', 'pro', 'enterprise'].includes(planKey.toLowerCase())) {
      return alert('Standard system plans (Basic, Pro, Enterprise) cannot be deleted.');
    }
    const confirmDelete = window.confirm(`Are you sure you want to delete custom plan "${planName}"? Any restaurants currently on this plan will be safely migrated to the Pro plan.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/superadmin/plans/${planKey}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete plan');
      setMsg(data.message || `Plan "${planName}" deleted successfully!`);
      setTimeout(() => setMsg(''), 4000);
      await fetchPlans();
    } catch (err) {
      alert(err.message || 'Failed to delete plan');
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
    { key: 'order_retention_days', label: 'Order Retention History (Days)', placeholder: '365' },
  ];

  const toggleFields = [
    { key: 'direct_ordering_enabled', label: '📋 Customer QR Direct Ordering & Live Order Receive Page' },
    { key: 'modifiers_enabled', label: 'Advanced Modifiers & Half/Full Variants' },
    { key: 'whatsapp_ordering_enabled', label: 'WhatsApp Customer Ordering' },
    { key: 'kds_enabled', label: '🍳 Dedicated Kitchen Display System (KDS Chef Screen)' },
    { key: 'bluetooth_kot_enabled', label: '🖨️ Thermal Receipt Printer & KOT Ticket Printing' },
    { key: 'dual_printer_enabled', label: '⚡ Dual Separate Printers (Kitchen KOT + Counter Bill Printers)' },
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
      {/* 👑 1. HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '16px', background: '#FFFFFF', padding: '18px 22px',
        borderRadius: 'var(--sa-radius-lg)', border: '1px solid var(--sa-border)',
        boxShadow: 'var(--sa-shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
            color: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Layers style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0 }}>
              👑 SaaS Plans & Feature Matrix
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', margin: '2px 0 0 0', fontWeight: 600 }}>
              Manage pricing, limits and feature access across all tenant subscription tiers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="sa-btn sa-btn-secondary sa-btn-sm"
            style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> + Create New Plan
          </button>

          <button
            type="button"
            onClick={handleSaveAllPlans}
            disabled={saving}
            className="sa-btn sa-btn-accent sa-btn-sm"
            style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={14} />
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

      {/* 📦 2. PLAN SUMMARY CARDS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {plans.map(p => {
          const subscriberCount = (restaurants || []).filter(r => (r.plan_tier || 'pro').toLowerCase() === p.key.toLowerCase()).length;
          const isCustom = !['basic', 'pro', 'enterprise'].includes(p.key.toLowerCase());

          return (
            <div
              key={p.key}
              className="sa-card hover-lift"
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--sa-border)',
                borderRadius: '16px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: 'var(--sa-shadow-sm)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--sa-primary)', background: '#F1F5F9', padding: '2px 7px', borderRadius: '6px' }}>
                      {p.badge || '✨ TIER'}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: '6px 0 2px 0', color: 'var(--sa-text-main)' }}>
                      {p.name}
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontFamily: 'monospace' }}>
                      {p.key}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: 'var(--sa-radius-full)', fontWeight: 800 }}>
                    👥 {subscriberCount} Tenant{subscriberCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--sa-primary)', marginBottom: '4px' }}>
                  ₹{p.price} <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>/ month</span>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', margin: '0 0 8px 0', minHeight: '28px', lineHeight: 1.3 }}>
                  {p.description || 'Standard plan features'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--sa-border)', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPlan(p)}
                  className="sa-btn sa-btn-secondary sa-btn-sm"
                  style={{ flex: 1, fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Edit3 size={13} /> Edit Tier
                </button>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(p.key, p.name)}
                    className="sa-btn sa-btn-danger sa-btn-sm"
                    style={{ padding: '6px 10px' }}
                    title="Delete Custom Plan"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 📊 3. MASTER FEATURES & LIMITS MATRIX */}
      <div className="sa-table-container sa-responsive-table" style={{
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
            {/* NUMERICAL LIMITS SECTION */}
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
                {plans.map(p => {
                  const isUnlimited = p[f.key] === 9999;
                  return (
                    <td key={p.key} style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          value={p[f.key] !== undefined && p[f.key] !== null ? p[f.key] : ''}
                          onChange={(e) => handlePlanValueChange(p.key, f.key, parseInt(e.target.value, 10) || 0)}
                          placeholder={f.placeholder}
                          style={{
                            width: '100%', maxWidth: '120px', padding: '8px 10px',
                            borderRadius: '8px', border: '1.5px solid var(--sa-border)',
                            fontSize: '0.86rem', fontWeight: 800, color: 'var(--sa-text-main)',
                            boxSizing: 'border-box'
                          }}
                        />
                        {isUnlimited && (
                          <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 900 }} title="9999 is treated as Unlimited">
                            ♾️ Unlimited
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* BOOLEAN FEATURE PERMISSIONS SECTION */}
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
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 900,
                          color: isChecked ? '#15803D' : '#94A3B8'
                        }}>
                          {isChecked ? '✅ Included' : '❌ Not Included'}
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

      {/* ✏️ 4. EDIT PLAN MODAL */}
      {editingPlan && (
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
                <Edit3 style={{ width: '20px', height: '20px' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Edit Plan: {editingPlan.name}</h3>
              </div>
              <button onClick={() => setEditingPlan(null)} style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleSaveSinglePlan} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>
                ⚠️ Changes may affect tenants currently using this plan.
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DISPLAY NAME *</label>
                <input
                  type="text"
                  required
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MONTHLY PRICE (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingPlan.price}
                    onChange={e => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>BADGE / EMOJI</label>
                  <input
                    type="text"
                    value={editingPlan.badge || ''}
                    onChange={e => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MARKETING DESCRIPTION</label>
                <input
                  type="text"
                  value={editingPlan.description || ''}
                  onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--sa-border)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="sa-btn sa-btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="sa-btn sa-btn-accent"
                  style={{ padding: '8px 20px', fontWeight: 900 }}
                >
                  {saving ? 'Saving...' : 'Save Plan Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✨ 5. CREATE PLAN MODAL */}
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
