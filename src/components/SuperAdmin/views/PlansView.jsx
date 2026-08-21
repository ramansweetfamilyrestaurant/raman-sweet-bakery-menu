import React, { useState } from 'react';
import { Layers, Plus, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import Drawer from '../components/Drawer';

export default function PlansView({ plansList, restaurants, onCreatePlan, onUpdatePlan, onDeletePlan }) {
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState({
    key: '',
    name: '',
    price: 999,
    badge: '👑 POPULAR',
    description: '',
    whatsapp_enabled: true,
    direct_ordering_enabled: true,
    google_reviews_enabled: true
  });

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setForm({
      key: '',
      name: '',
      price: 999,
      badge: '👑 POPULAR',
      description: '',
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true
    });
    setShowCreateDrawer(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setForm({
      key: plan.key,
      name: plan.name,
      price: plan.price,
      badge: plan.badge || '👑 POPULAR',
      description: plan.description || '',
      whatsapp_enabled: plan.whatsapp_enabled !== false,
      direct_ordering_enabled: plan.direct_ordering_enabled !== false,
      google_reviews_enabled: plan.google_reviews_enabled !== false
    });
    setShowCreateDrawer(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      presence_verification_enabled: form.direct_ordering_enabled ? 1 : 0,
      allowed_verification_modes: 'GPS_WITH_STAFF_FALLBACK'
    };
    if (editingPlan) {
      onUpdatePlan(editingPlan.key, payload);
    } else {
      onCreatePlan(payload);
    }
    setShowCreateDrawer(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <Layers size={22} color="var(--sa-primary)" /> SaaS Subscription Plans Catalog
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Dynamically manage pricing tiers, feature packages, and billing terms for your SaaS clients.
          </span>
        </div>

        <button onClick={handleOpenCreate} className="sa-btn sa-btn-accent">
          <Plus size={16} /> Create Custom Plan
        </button>
      </div>

      {/* Plan Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {plansList.map(p => {
          const subscriberCount = restaurants.filter(r => (r.plan_tier || 'pro').toLowerCase() === p.key.toLowerCase()).length;

          return (
            <div key={p.key} className="sa-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--sa-border)', padding: '24px', borderRadius: 'var(--sa-radius-lg)', background: 'var(--sa-surface)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-primary)', background: '#E8F5E9', padding: '3px 8px', borderRadius: '6px' }}>
                      {p.badge || '✨ TIER'}
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--sa-text-main)', marginTop: '8px', marginBottom: '4px' }}>
                      {p.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
                      KEY: <code style={{ color: 'var(--sa-primary)', fontWeight: 800 }}>{p.key}</code>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: '#F1F5F9', padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    {subscriberCount} Restos
                  </span>
                </div>

                <p style={{ fontSize: '0.80rem', color: 'var(--sa-text-muted)', margin: '8px 0 16px 0', minHeight: '36px' }}>
                  {p.description || 'All standard features included.'}
                </p>

                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--sa-primary)', marginBottom: '12px' }}>
                  ₹{p.price} <span style={{ fontSize: '0.8rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>/ month</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--sa-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} color="var(--sa-success)" />
                    <span>WhatsApp Ordering: <strong>{p.whatsapp_enabled !== false ? 'Enabled' : 'Disabled'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} color="var(--sa-success)" />
                    <span>Direct QR Ordering: <strong>{p.direct_ordering_enabled !== false ? 'Enabled (GPS + Staff)' : 'Disabled'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} color="var(--sa-success)" />
                    <span>Google Reviews Widget: <strong>{p.google_reviews_enabled !== false ? 'Enabled' : 'Disabled'}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--sa-border)', paddingTop: '14px', marginTop: '16px' }}>
                <button onClick={() => handleOpenEdit(p)} className="sa-btn sa-btn-secondary" style={{ flex: 1 }}>
                  <Edit3 size={14} /> Edit Tier
                </button>
                {['basic', 'pro', 'enterprise'].includes(p.key.toLowerCase()) ? null : (
                  <button onClick={() => onDeletePlan(p.key)} className="sa-btn sa-btn-danger sa-btn-sm" title="Delete custom plan">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Drawer Form */}
      <Drawer
        isOpen={showCreateDrawer}
        onClose={() => setShowCreateDrawer(false)}
        title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Custom SaaS Plan'}
        subtitle="Configure price terms and feature entitlements"
        footer={(
          <>
            <button onClick={() => setShowCreateDrawer(false)} className="sa-btn sa-btn-secondary">Cancel</button>
            <button onClick={handleSubmit} className="sa-btn sa-btn-primary">
              {editingPlan ? 'Save Plan Updates' : 'Create Plan Tier'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>PLAN IDENTIFIER KEY (LOWERCASE):</label>
            <input
              type="text"
              required
              disabled={!!editingPlan}
              placeholder="e.g. business_plus"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>DISPLAY NAME:</label>
            <input
              type="text"
              required
              placeholder="e.g. Business VIP Plan"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)', display: 'block', marginBottom: '4px' }}>MONTHLY PRICE (₹ INR):</label>
            <input
              type="number"
              required
              min="0"
              placeholder="999"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}
            />
          </div>

          <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--sa-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.direct_ordering_enabled}
                onChange={(e) => setForm({ ...form, direct_ordering_enabled: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--sa-primary)' }}
              />
              <span style={{ fontWeight: 800 }}>📋 Customer QR Direct Ordering & Live Order Receive Page</span>
            </label>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
