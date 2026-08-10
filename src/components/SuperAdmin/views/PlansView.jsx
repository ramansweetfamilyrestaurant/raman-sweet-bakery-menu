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
    if (editingPlan) {
      onUpdatePlan(editingPlan.key, form);
    } else {
      onCreatePlan(form);
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
            <div
              key={p.key}
              style={{
                background: 'var(--sa-surface)',
                border: '1.5px solid var(--sa-border)',
                borderRadius: 'var(--sa-radius-lg)',
                padding: '24px',
                boxShadow: 'var(--sa-shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="sa-badge sa-badge-purple">{p.badge || '👑 SAAS PLAN'}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--sa-text-muted)' }}>
                    {subscriberCount} Active Clients
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 4px 0' }}>
                  {p.name}
                </h3>
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
                    <span>Direct Online Cart: <strong>{p.direct_ordering_enabled !== false ? 'Enabled' : 'Disabled'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} color="var(--sa-success)" />
                    <span>Google Reviews Widget: <strong>{p.google_reviews_enabled !== false ? 'Enabled' : 'Disabled'}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--sa-border)', paddingTop: '14px' }}>
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
        </form>
      </Drawer>
    </div>
  );
}
