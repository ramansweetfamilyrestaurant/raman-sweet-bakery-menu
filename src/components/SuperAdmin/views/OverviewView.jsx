import React, { useState } from 'react';
import { Store, CheckCircle, Clock, AlertTriangle, DollarSign, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import StatCard from '../components/StatCard';

export default function OverviewView({ restaurants, pendingRegistrations = [], onSelectTenant, onNavigate }) {
  const [showAllRegistrations, setShowAllRegistrations] = useState(false);

  const totalTenants = restaurants.length;
  const activeCount = restaurants.filter(r => r.active !== false && r.active !== 0 && r.active !== '0').length;
  const trialCount = restaurants.filter(r => r.subscription_status === 'trialing' || (r.trial_ends_at && new Date(r.trial_ends_at) > new Date())).length;
  const pastDueCount = restaurants.filter(r => r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due').length;

  const estimatedRevenue = restaurants.reduce((sum, r) => {
    if (r.active !== false && r.subscription_type !== 'ADMIN_GRANTED' && r.mandate_status !== 'admin_granted') {
      return sum + (parseFloat(r.plan_price) || 999);
    }
    return sum;
  }, 0);

  // Grouped Attention Items
  const pendingCancellations = restaurants.filter(r => r.cancel_requested_at);
  const scheduledChanges = restaurants.filter(r => r.scheduled_plan_key);
  const paymentFailures = restaurants.filter(r => r.subscription_status === 'payment_failed');

  const visibleRegistrations = showAllRegistrations ? pendingRegistrations : pendingRegistrations.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Refined Compact Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        borderRadius: 'var(--sa-radius-lg)',
        padding: '18px 20px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: 'var(--sa-shadow-sm)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 2px 0', letterSpacing: '-0.3px' }}>
            Good morning, Super Admin 👑
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#A7F3D0', margin: 0, fontWeight: 500 }}>
            Monitor your SaaS platform and shop activity.
          </p>
        </div>
        <button
          onClick={() => onNavigate('tenants')}
          className="sa-btn sa-btn-accent sa-btn-sm"
        >
          <Store size={14} /> Manage Shops ➔
        </button>
      </div>

      {/* 2-Column Compact Equal KPI Grid */}
      <div className="sa-stats-grid">
        <StatCard label="TOTAL SHOPS" value={totalTenants} subtitle="All clients" icon={Store} color="var(--sa-primary)" />
        <StatCard label="ACTIVE" value={activeCount} subtitle="Paying & active" icon={CheckCircle} color="var(--sa-success)" />
        <StatCard label="TRIAL" value={trialCount} subtitle="In trial phase" icon={Clock} color="var(--sa-warning)" />
        <StatCard label="PAST DUE" value={pastDueCount} subtitle="Requires review" icon={AlertTriangle} color="var(--sa-danger)" />
        <StatCard label="REVENUE" value={`₹${estimatedRevenue.toLocaleString()}`} subtitle="Monthly recurring (MRR)" icon={DollarSign} color="var(--sa-accent)" />
      </div>

      {/* Business Distribution by Category */}
      <div style={{
        background: 'var(--sa-surface)',
        border: '1px solid var(--sa-border)',
        borderRadius: 'var(--sa-radius-lg)',
        padding: '16px 20px',
        boxShadow: 'var(--sa-shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1rem' }}>📊</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 900, color: 'var(--sa-text-main)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Business Distribution
            </span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Active Industry Segments
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          {[
            { id: 'dine_in', emoji: '🍽️', label: 'Dine-In', count: restaurants.filter(r => (r.business_category || 'dine_in') === 'dine_in').length },
            { id: 'hotel', emoji: '🏨', label: 'Hotel', count: restaurants.filter(r => (r.business_category || 'dine_in') === 'hotel').length },
            { id: 'cinema', emoji: '🎬', label: 'Cinema', count: restaurants.filter(r => (r.business_category || 'dine_in') === 'cinema').length }
          ].map(cat => (
            <div
              key={cat.id}
              onClick={() => onNavigate && onNavigate('tenants')}
              style={{
                background: 'var(--sa-surface-subtle)',
                border: '1px solid var(--sa-border)',
                borderRadius: 'var(--sa-radius-md)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.15rem' }}>{cat.emoji}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--sa-text-main)' }}>{cat.label}</span>
              </div>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 900,
                color: cat.count > 0 ? 'var(--sa-text-main)' : 'var(--sa-text-muted)',
                background: cat.count > 0 ? '#FFFFFF' : 'transparent',
                border: cat.count > 0 ? '1px solid var(--sa-border)' : 'none',
                padding: '2px 8px',
                borderRadius: 'var(--sa-radius-full)'
              }}>
                {cat.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Compact Operational Hub: Attention Required */}
      <div className="sa-table-container" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3 className="sa-section-title" style={{ fontSize: '1.05rem' }}>
              <AlertTriangle size={18} color="var(--sa-warning)" /> Attention Required
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Operational summary of pending registration approvals and subscription events.
            </span>
          </div>
        </div>

        {/* Compact Summary Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {/* Pending Registrations Summary Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="sa-badge sa-badge-warning">MEDIUM</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>Pending Registrations ({pendingRegistrations.length})</span>
            </div>
            <button onClick={() => onNavigate('tenants')} className="sa-btn sa-btn-secondary sa-btn-sm">
              View All ➔
            </button>
          </div>

          {/* Cancellations Summary Row */}
          {pendingCancellations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--sa-warning-bg)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-warning-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="sa-badge sa-badge-warning">MEDIUM</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#78350F' }}>Cancellations Requested ({pendingCancellations.length})</span>
              </div>
              <button onClick={() => onNavigate('subscriptions')} className="sa-btn sa-btn-secondary sa-btn-sm">
                View ➔
              </button>
            </div>
          )}

          {/* Scheduled Changes Summary Row */}
          {scheduledChanges.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--sa-info-bg)', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-info-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="sa-badge sa-badge-info">INFO</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1E40AF' }}>Scheduled Plan Changes ({scheduledChanges.length})</span>
              </div>
              <button onClick={() => onNavigate('subscriptions')} className="sa-btn sa-btn-secondary sa-btn-sm">
                View ➔
              </button>
            </div>
          )}
        </div>

        {/* Top 2-3 Recent Pending Registrations */}
        {pendingRegistrations.length > 0 && (
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--sa-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
              RECENT PENDING REGISTRATIONS:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {visibleRegistrations.map(reg => (
                <div key={reg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FFFFFF', border: '1px solid var(--sa-border)', borderRadius: 'var(--sa-radius-sm)', fontSize: '0.82rem' }}>
                  <div>
                    <strong style={{ color: 'var(--sa-text-main)' }}>{reg.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', marginLeft: '8px' }}>Plan: {(reg.plan_key || 'pro').toUpperCase()}</span>
                  </div>
                  <button onClick={() => onNavigate('tenants')} className="sa-btn sa-btn-secondary sa-btn-sm">
                    Review ➔
                  </button>
                </div>
              ))}
            </div>

            {pendingRegistrations.length > 3 && !showAllRegistrations && (
              <button
                onClick={() => setShowAllRegistrations(true)}
                style={{ background: 'none', border: 'none', color: 'var(--sa-primary)', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '8px', padding: 0 }}
              >
                View all {pendingRegistrations.length} registrations ➔
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
