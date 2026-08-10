import React from 'react';
import { Store, CheckCircle, Clock, AlertTriangle, DollarSign, ArrowRight, Sparkles, RefreshCw, UserCheck } from 'lucide-react';
import StatCard from '../components/StatCard';

export default function OverviewView({ restaurants, pendingRegistrations, onSelectTenant, onNavigate }) {
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

  // Filter items requiring operational attention
  const pendingCancellations = restaurants.filter(r => r.cancel_requested_at);
  const scheduledChanges = restaurants.filter(r => r.scheduled_plan_key);
  const paymentFailures = restaurants.filter(r => r.subscription_status === 'payment_failed');
  const pendingApprovals = pendingRegistrations || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Greeting */}
      <div style={{
        background: 'linear-gradient(135deg, #0A2315 0%, #164E2A 100%)',
        borderRadius: 'var(--sa-radius-lg)',
        padding: '24px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--sa-shadow-md)',
        border: '1px solid rgba(212, 175, 55, 0.3)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
            Good morning, Super Admin 👑
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#A7F3D0', margin: 0, fontWeight: 500 }}>
            Monitor your SaaS multi-tenant platform and subscription activity.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onNavigate('tenants')}
            className="sa-btn sa-btn-accent"
          >
            <Store size={16} /> Manage Tenants
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="sa-stats-grid">
        <StatCard label="TOTAL TENANTS" value={totalTenants} subtitle="All registered clients" icon={Store} color="var(--sa-primary)" />
        <StatCard label="ACTIVE TENANTS" value={activeCount} subtitle="Paying & active access" icon={CheckCircle} color="var(--sa-success)" />
        <StatCard label="IN FREE TRIAL" value={trialCount} subtitle="Active trial phase" icon={Clock} color="var(--sa-warning)" />
        <StatCard label="PAST DUE / FAILED" value={pastDueCount} subtitle="Action required" icon={AlertTriangle} color="var(--sa-danger)" />
        <StatCard label="ESTIMATED REVENUE" value={`₹${estimatedRevenue.toLocaleString()}`} subtitle="Monthly recurring (MRR)" icon={DollarSign} color="var(--sa-accent)" />
      </div>

      {/* Operational Hub: Attention Required */}
      <div className="sa-table-container" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 className="sa-section-title">
              <AlertTriangle size={20} color="var(--sa-warning)" /> Attention Required
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              High-priority subscription events and pending actions requiring review.
            </span>
          </div>
        </div>

        {pendingApprovals.length === 0 && pendingCancellations.length === 0 && scheduledChanges.length === 0 && paymentFailures.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: 'var(--sa-surface-subtle)', borderRadius: 'var(--sa-radius-md)' }}>
            <CheckCircle size={36} color="var(--sa-success)" style={{ marginBottom: '8px' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--sa-text-main)' }}>All Systems Operational!</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--sa-text-muted)', margin: 0 }}>No pending cancellations, payment failures, or unverified pre-registrations.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Pending Pre-Registrations */}
            {pendingApprovals.map(reg => (
              <div key={reg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--sa-warning-bg)', border: '1px solid var(--sa-warning-border)', borderRadius: 'var(--sa-radius-md)', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="sa-badge sa-badge-warning">HIGH SEVERITY</span>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#78350F' }}>{reg.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#B45309', display: 'block' }}>Pending Pre-Registration Authorization • Plan: {(reg.plan_key || 'pro').toUpperCase()}</span>
                  </div>
                </div>
                <button onClick={() => onNavigate('tenants')} className="sa-btn sa-btn-secondary sa-btn-sm">
                  Review Registration <ArrowRight size={14} />
                </button>
              </div>
            ))}

            {/* Pending Cancellations */}
            {pendingCancellations.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--sa-warning-bg)', border: '1px solid var(--sa-warning-border)', borderRadius: 'var(--sa-radius-md)', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="sa-badge sa-badge-warning">CANCELLATION</span>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#78350F' }}>{r.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#B45309', display: 'block' }}>Cancellation requested on {new Date(r.cancel_requested_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
                <button onClick={() => onSelectTenant(r)} className="sa-btn sa-btn-secondary sa-btn-sm">
                  View Details <ArrowRight size={14} />
                </button>
              </div>
            ))}

            {/* Scheduled Plan Changes */}
            {scheduledChanges.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--sa-info-bg)', border: '1px solid var(--sa-info-border)', borderRadius: 'var(--sa-radius-md)', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="sa-badge sa-badge-info">PLAN SWITCH</span>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#1E40AF' }}>{r.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#2563EB', display: 'block' }}>Switching to {(r.scheduled_plan_key || '').toUpperCase()} at period end</span>
                  </div>
                </div>
                <button onClick={() => onSelectTenant(r)} className="sa-btn sa-btn-secondary sa-btn-sm">
                  View Details <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
