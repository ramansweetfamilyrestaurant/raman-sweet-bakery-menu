import React, { useState, useEffect } from 'react';
import { 
  Layers, Save, CheckCircle2, Sparkles, AlertCircle, RefreshCw, 
  Plus, X, Edit3, Trash2, Crown, Users, Check, Palette, Eye, 
  ShieldCheck, Lock, Unlock
} from 'lucide-react';
import { SectionHeader, StatusBadge } from '../components';

const toBoolInt = (val) => {
  if (val === undefined || val === null) return 1;
  return (val === 1 || val === true || val === '1' || val === 'true') ? 1 : 0;
};

export const LUXURY_THEMES = [
  { key: 'gold', name: 'Gold & Forest Green', primary: '#0A2315', accent: '#D4AF37', desc: 'Taj / Oberoi Heritage Luxury' },
  { key: 'emerald', name: 'Emerald Mint & Teal', primary: '#064E3B', accent: '#34D399', desc: 'Fresh Eco Bistro & Vegan' },
  { key: 'crimson', name: 'Crimson Ruby & Rose', primary: '#881337', accent: '#FB7185', desc: 'Royal Fine-Dine & Grill' },
  { key: 'navy', name: 'Midnight Navy & Blue', primary: '#0F172A', accent: '#60A5FA', desc: 'Sleek Modern Lounge & Cafe' },
  { key: 'amber', name: 'Royal Amber & Espresso', primary: '#451A03', accent: '#FBBF24', desc: 'Artisan Bakery & Cafe' },
  { key: 'purple', name: 'Imperial Velvet & Violet', primary: '#3B0764', accent: '#C084FC', desc: 'VIP Lounge & Nightclub' },
  { key: 'rose', name: 'Champagne & Rose Gold', primary: '#4C0519', accent: '#F472B6', desc: 'Chic Patisserie & Dessert' },
  { key: 'dark', name: 'Obsidian Cyber & Neon', primary: '#020617', accent: '#22D3EE', desc: 'High-Tech GastroPub & Brew' },
];

export default function SaaSPlansView({ token, restaurants = [] }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activePreviewTheme, setActivePreviewTheme] = useState('gold');

  // Create Plan Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    key: '',
    name: '',
    price: 1499,
    original_price: 2999,
    badge: '🚀 VIP',
    description: 'Custom VIP Plan with full features & themes',
    theme_color: 'gold',
    allowed_themes: 'ALL',
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

  // Toggle theme permission for a specific plan
  const handleTogglePlanTheme = (planKey, themeKey) => {
    setPlans(prev => prev.map(p => {
      if (p.key !== planKey) return p;
      let current = (p.allowed_themes || 'ALL').trim();
      if (current === 'ALL') {
        current = LUXURY_THEMES.map(t => t.key).join(',');
      }
      let themesArr = current ? current.split(',').map(s => s.trim().toLowerCase()) : [];
      if (themesArr.includes(themeKey.toLowerCase())) {
        themesArr = themesArr.filter(t => t !== themeKey.toLowerCase());
      } else {
        themesArr.push(themeKey.toLowerCase());
      }
      const newAllowed = themesArr.length === LUXURY_THEMES.length ? 'ALL' : themesArr.join(',');
      return { ...p, allowed_themes: newAllowed };
    }));
  };

  const isThemeAllowedForPlan = (plan, themeKey) => {
    const raw = (plan.allowed_themes || 'ALL').trim();
    if (raw === 'ALL') return true;
    const list = raw.split(',').map(s => s.trim().toLowerCase());
    return list.includes(themeKey.toLowerCase());
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
          allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK',
          theme_color: p.theme_color || 'gold',
          allowed_themes: p.allowed_themes || 'ALL'
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
      setMsg('⚡ All Plan Permissions, Themes & Limits Saved Successfully!');
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
        allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK',
        theme_color: createForm.theme_color || 'gold',
        allowed_themes: createForm.allowed_themes || 'ALL'
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
      setMsg(`✨ Custom SaaS Plan '${createForm.name}' created with theme support!`);
      setShowCreateModal(false);
      setCreateForm({
        key: '',
        name: '',
        price: 1499,
        original_price: 2999,
        badge: '🚀 VIP',
        description: 'Custom VIP Plan with full features & themes',
        theme_color: 'gold',
        allowed_themes: 'ALL',
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
        allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK',
        theme_color: editingPlan.theme_color || 'gold',
        allowed_themes: editingPlan.allowed_themes || 'ALL'
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
      setMsg(`⚡ Plan '${editingPlan.name}' & Theme Matrix updated successfully!`);
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

  const handlePreviewTheme = (themeKey) => {
    setActivePreviewTheme(themeKey);
    document.documentElement.setAttribute('data-theme', themeKey);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--sa-text-muted)' }}>
        <RefreshCw className="animate-spin" style={{ width: '32px', height: '32px', margin: '0 auto 14px auto', color: 'var(--sa-primary)' }} />
        <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--sa-text-main)' }}>Loading SaaS Plans & Luxury Theme Matrix...</p>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 👑 1. HEADER */}
      <SectionHeader
        title="👑 SaaS Plans & Luxury Theme Matrix"
        subtitle="Manage pricing, allowed luxury brand themes, limits and feature access across all subscription tiers."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="sa-btn sa-btn-secondary sa-btn-sm"
              style={{ fontWeight: 800 }}
            >
              <Plus size={14} /> Create Plan
            </button>

            <button
              type="button"
              onClick={handleSaveAllPlans}
              disabled={saving}
              className="sa-btn sa-btn-accent sa-btn-sm"
              style={{ fontWeight: 900 }}
            >
              <Save size={14} />
              {saving ? 'Saving Matrix...' : 'Save All Plan & Theme Matrix'}
            </button>
          </div>
        }
      />

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

      {/* 🎨 2. LUXURY THEME ENGINE SHOWCASE & LIVE TESTER */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #153B25 100%)',
        color: '#FFFFFF',
        borderRadius: '20px',
        padding: '20px 22px',
        border: '1.5px solid rgba(212, 175, 55, 0.45)',
        boxShadow: '0 8px 24px rgba(10, 35, 21, 0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Palette size={24} color="#0A2315" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF' }}>
                  Luxury Multi-Tenant Theme Engine
                </h3>
                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 900, background: '#10B981', color: '#FFFFFF' }}>
                  8 ACTIVE PRESETS
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#A7F3D0', fontWeight: 600 }}>
                Selectively assign theme permissions to plans. Basic, Pro, & Enterprise plans can gate or unlock custom themes.
              </p>
            </div>
          </div>
        </div>

        {/* 8 Theme Swatches Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
          {LUXURY_THEMES.map(t => {
            const isSelected = activePreviewTheme === t.key;
            return (
              <div
                key={t.key}
                onClick={() => handlePreviewTheme(t.key)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255,255,255,0.08)',
                  border: isSelected ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: t.primary, border: `2.5px solid ${t.accent}`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)', flexShrink: 0
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isSelected ? '#DFBA67' : '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.name.split('&')[0]}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>
                    {t.key}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 📦 3. PLAN SUMMARY CARDS ROW (WITH THEME ACCENTS & ALLOWED THEMES) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={18} color="var(--sa-primary)" /> Available Subscription Tiers ({plans.length})
          </h3>
          <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>Active Tier Overview & Theme Allotment</span>
        </div>

        <div className="sa-plan-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {plans.map(p => {
            const subscriberCount = (restaurants || []).filter(r => (r.plan_tier || 'pro').toLowerCase() === p.key.toLowerCase()).length;
            const isCustom = !['basic', 'pro', 'enterprise'].includes(p.key.toLowerCase());
            const isPopular = p.key.toLowerCase() === 'pro';

            // Calculate unlocked themes count
            const allowedCount = (p.allowed_themes === 'ALL' || !p.allowed_themes) 
              ? LUXURY_THEMES.length 
              : p.allowed_themes.split(',').filter(Boolean).length;

            return (
              <div
                key={p.key}
                className="sa-stat-card hover-lift"
                style={{
                  padding: '20px',
                  border: isPopular ? '2px solid var(--sa-accent)' : '1px solid var(--sa-border)',
                  borderRadius: 'var(--sa-radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  position: 'relative',
                  background: 'var(--sa-surface)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <span style={{
                        fontSize: '0.70rem',
                        fontWeight: 900,
                        color: isPopular ? '#0A2315' : 'var(--sa-text-main)',
                        background: isPopular ? 'var(--sa-accent-light)' : 'var(--sa-surface-subtle)',
                        border: isPopular ? '1px solid var(--sa-accent)' : '1px solid var(--sa-border)',
                        padding: '2px 8px',
                        borderRadius: 'var(--sa-radius-full)',
                        textTransform: 'uppercase'
                      }}>
                        {p.badge || '✨ TIER'}
                      </span>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: '8px 0 2px 0', color: 'var(--sa-text-main)' }}>
                        {p.name}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontFamily: 'monospace' }}>
                        ID: {p.key}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.72rem',
                      background: subscriberCount > 0 ? '#DCFCE7' : '#F1F5F9',
                      color: subscriberCount > 0 ? '#15803D' : '#64748B',
                      border: subscriberCount > 0 ? '1px solid #86EFAC' : '1px solid #E2E8F0',
                      padding: '3px 9px',
                      borderRadius: 'var(--sa-radius-full)',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Users size={12} /> {subscriberCount} {subscriberCount === 1 ? 'Resto' : 'Shops'}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--sa-primary)', marginBottom: '6px' }}>
                    ₹{p.price.toLocaleString()} <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>/ month</span>
                  </div>

                  <p style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', margin: '0 0 10px 0', minHeight: '32px', lineHeight: 1.4 }}>
                    {p.description || 'Standard subscription plan features & entitlements'}
                  </p>

                  {/* 🎨 Allowed Themes Summary Pill */}
                  <div style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Palette size={12} color="#D97706" /> ALLOWED THEMES ({allowedCount}/8)
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 900, color: allowedCount === 8 ? '#16A34A' : '#2563EB' }}>
                        {allowedCount === 8 ? '🌟 ALL UNLOCKED' : `${allowedCount} Allowed`}
                      </span>
                    </div>

                    {/* Miniature Theme Swatches */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {LUXURY_THEMES.map(t => {
                        const isAllowed = isThemeAllowedForPlan(p, t.key);
                        return (
                          <div
                            key={t.key}
                            title={`${t.name} (${isAllowed ? 'Allowed' : 'Locked'})`}
                            style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              background: t.primary, border: `2px solid ${t.accent}`,
                              opacity: isAllowed ? 1 : 0.25,
                              filter: isAllowed ? 'none' : 'grayscale(1)',
                              display: 'inline-block'
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--sa-border)', paddingTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingPlan(p)}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ flex: 1, fontSize: '0.76rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Edit3 size={13} /> Edit Tier & Themes
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
      </div>

      {/* 📊 4. MASTER FEATURES & LUXURY THEME MATRIX TABLE */}
      <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: 'var(--sa-radius-lg)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sa-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
              ⚡ Plan Permissions, Limits & Theme Matrix
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Toggle luxury brand themes and feature access per tier with 1-click controls
            </span>
          </div>
        </div>

        <table className="sa-table" style={{ minWidth: '850px' }}>
          <thead>
            <tr>
              <th style={{ width: '36%' }}>FEATURE / THEME PERMISSION</th>
              {plans.map(p => (
                <th key={p.key} style={{ color: 'var(--sa-primary)', fontWeight: 900 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{p.badge || '👑'}</span>
                    <span>{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            
            {/* 🎨 1. LUXURY THEMES PERMISSIONS SECTION */}
            <tr style={{ background: 'var(--sa-surface-subtle)' }}>
              <td colSpan={plans.length + 1} style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sa-primary)', letterSpacing: '0.03em' }}>
                🎨 LUXURY BRAND THEMES ACCESS CONTROLS (8 PRESETS)
              </td>
            </tr>
            {LUXURY_THEMES.map(theme => (
              <tr key={theme.key}>
                <td style={{ fontWeight: 800 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: theme.primary, border: `2px solid ${theme.accent}`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--sa-text-main)' }}>{theme.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>{theme.desc}</div>
                    </div>
                  </div>
                </td>
                {plans.map(p => {
                  const isAllowed = isThemeAllowedForPlan(p, theme.key);
                  return (
                    <td key={p.key}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => handleTogglePlanTheme(p.key, theme.key)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--sa-primary)' }}
                        />
                        <span style={{
                          fontSize: '0.76rem', fontWeight: 900,
                          color: isAllowed ? '#15803D' : '#94A3B8'
                        }}>
                          {isAllowed ? '✅ Unlocked' : '🔒 Locked'}
                        </span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* NUMERICAL LIMITS SECTION */}
            <tr style={{ background: 'var(--sa-surface-subtle)' }}>
              <td colSpan={plans.length + 1} style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sa-primary)', letterSpacing: '0.03em' }}>
                📊 PRICING & NUMERICAL LIMIT CONTROLS
              </td>
            </tr>
            {numericFields.map(f => (
              <tr key={f.key}>
                <td style={{ fontWeight: 800 }}>
                  {f.label}
                </td>
                {plans.map(p => {
                  const isUnlimited = p[f.key] === 9999;
                  return (
                    <td key={p.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          value={p[f.key] !== undefined && p[f.key] !== null ? p[f.key] : ''}
                          onChange={(e) => handlePlanValueChange(p.key, f.key, parseInt(e.target.value, 10) || 0)}
                          placeholder={f.placeholder}
                          className="sa-input"
                          style={{
                            maxWidth: '110px',
                            height: '34px',
                            padding: '4px 8px',
                            fontSize: '0.82rem',
                            fontWeight: 800
                          }}
                        />
                        {isUnlimited && (
                          <span style={{ fontSize: '0.70rem', color: '#16A34A', fontWeight: 900 }} title="9999 is treated as Unlimited">
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
            <tr style={{ background: 'var(--sa-surface-subtle)' }}>
              <td colSpan={plans.length + 1} style={{ padding: '10px 16px', fontSize: '0.78rem', fontWeight: 900, color: 'var(--sa-primary)', letterSpacing: '0.03em' }}>
                ⚡ FEATURE TOGGLE PERMISSIONS (ON / OFF)
              </td>
            </tr>
            {toggleFields.map(f => (
              <tr key={f.key}>
                <td style={{ fontWeight: 800 }}>
                  {f.label}
                </td>
                {plans.map(p => {
                  const isChecked = Boolean(p[f.key] !== 0 && p[f.key] !== false && p[f.key] !== '0');
                  return (
                    <td key={p.key}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handlePlanValueChange(p.key, f.key, e.target.checked ? 1 : 0)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--sa-primary)' }}
                        />
                        <span style={{
                          fontSize: '0.76rem', fontWeight: 900,
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

      {/* ✏️ 5. EDIT PLAN & THEME MODAL */}
      {editingPlan && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-box" style={{ maxWidth: '540px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--sa-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} color="var(--sa-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>Edit Plan: {editingPlan.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                style={{ background: 'none', border: 'none', color: 'var(--sa-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSinglePlan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '0.78rem', color: '#92400E', fontWeight: 700 }}>
                ⚠️ Changes will update feature matrix and luxury theme access for this plan tier.
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DISPLAY NAME *</label>
                <input
                  type="text"
                  required
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="sa-input"
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
                    className="sa-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>BADGE / EMOJI</label>
                  <input
                    type="text"
                    value={editingPlan.badge || ''}
                    onChange={e => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                    className="sa-input"
                  />
                </div>
              </div>

              {/* Theme Access Multi-Select */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', margin: 0 }}>
                    ALLOWED LUXURY BRAND THEMES
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allStr = editingPlan.allowed_themes === 'ALL' ? 'gold' : 'ALL';
                      setEditingPlan({ ...editingPlan, allowed_themes: allStr });
                    }}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {editingPlan.allowed_themes === 'ALL' ? 'Restrict Themes' : 'Unlock All 8 Themes'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  {LUXURY_THEMES.map(t => {
                    const isChecked = isThemeAllowedForPlan(editingPlan, t.key);
                    return (
                      <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let raw = (editingPlan.allowed_themes || 'ALL').trim();
                            if (raw === 'ALL') raw = LUXURY_THEMES.map(x => x.key).join(',');
                            let list = raw.split(',').map(s => s.trim().toLowerCase());
                            if (list.includes(t.key.toLowerCase())) {
                              list = list.filter(k => k !== t.key.toLowerCase());
                            } else {
                              list.push(t.key.toLowerCase());
                            }
                            const updated = list.length === LUXURY_THEMES.length ? 'ALL' : list.join(',');
                            setEditingPlan({ ...editingPlan, allowed_themes: updated });
                          }}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--sa-primary)' }}
                        />
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: t.primary, border: `1.5px solid ${t.accent}`, flexShrink: 0 }} />
                        <span style={{ color: isChecked ? 'var(--sa-text-main)' : 'var(--sa-text-muted)' }}>{t.name.split('&')[0]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MARKETING DESCRIPTION</label>
                <input
                  type="text"
                  value={editingPlan.description || ''}
                  onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="sa-input"
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

      {/* ✨ 6. CREATE PLAN & THEME MODAL */}
      {showCreateModal && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-box" style={{ maxWidth: '540px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--sa-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--sa-accent)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>Create New Custom SaaS Plan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--sa-text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>PLAN NAME *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Ultra Plan"
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value, key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') })}
                  className="sa-input"
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
                    className="sa-input"
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
                    className="sa-input"
                  />
                </div>
              </div>

              {/* Theme Access Selection in Create Modal */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '6px' }}>
                  ALLOWED LUXURY BRAND THEMES
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', background: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  {LUXURY_THEMES.map(t => {
                    const isChecked = isThemeAllowedForPlan(createForm, t.key);
                    return (
                      <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let raw = (createForm.allowed_themes || 'ALL').trim();
                            if (raw === 'ALL') raw = LUXURY_THEMES.map(x => x.key).join(',');
                            let list = raw.split(',').map(s => s.trim().toLowerCase());
                            if (list.includes(t.key.toLowerCase())) {
                              list = list.filter(k => k !== t.key.toLowerCase());
                            } else {
                              list.push(t.key.toLowerCase());
                            }
                            const updated = list.length === LUXURY_THEMES.length ? 'ALL' : list.join(',');
                            setCreateForm({ ...createForm, allowed_themes: updated });
                          }}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--sa-primary)' }}
                        />
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: t.primary, border: `1.5px solid ${t.accent}`, flexShrink: 0 }} />
                        <span style={{ color: isChecked ? 'var(--sa-text-main)' : 'var(--sa-text-muted)' }}>{t.name.split('&')[0]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DESCRIPTION</label>
                <input
                  type="text"
                  placeholder="Short marketing headline for this plan tier"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  className="sa-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="sa-btn sa-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="sa-btn sa-btn-accent"
                  style={{ fontWeight: 900 }}
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

