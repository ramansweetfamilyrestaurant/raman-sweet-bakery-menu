import React, { useState } from 'react';
import { CreditCard, Filter, Calendar, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function SubscriptionsView({ restaurants, onSelectTenant }) {
  const [filter, setFilter] = useState('all');

  const filteredSubs = restaurants.filter(r => {
    if (filter === 'active') return r.active !== false && r.subscription_type !== 'ADMIN_GRANTED';
    if (filter === 'trial') return r.subscription_status === 'trialing';
    if (filter === 'failed') return r.subscription_status === 'payment_failed';
    if (filter === 'cancelled') return r.cancel_requested_at !== null;
    if (filter === 'scheduled') return r.scheduled_plan_key !== null;
    if (filter === 'complimentary') return r.subscription_type === 'ADMIN_GRANTED' || r.mandate_status === 'admin_granted';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <CreditCard size={22} color="var(--sa-primary)" /> Subscription Management & Billing Lifecycle
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Real-time audit of tenant Cashfree AutoPay mandates, renewals, and complimentary access.
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: 'All Subscriptions' },
          { id: 'active', label: '🟢 Active Paid' },
          { id: 'trial', label: '⏳ Free Trial' },
          { id: 'failed', label: '⚠️ Payment Failed' },
          { id: 'cancelled', label: '⏸️ Cancellations' },
          { id: 'scheduled', label: '📋 Plan Changes' },
          { id: 'complimentary', label: '🎁 Complimentary' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`sa-btn sa-btn-sm ${filter === tab.id ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
            style={{ flexShrink: 0 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop Subscription Table */}
      <div className="sa-table-container sa-responsive-table">
        <table className="sa-table">
          <thead>
            <tr>
              <th>RESTAURANT</th>
              <th>CURRENT PLAN</th>
              <th>STATUS</th>
              <th>AUTO-RENEW</th>
              <th>ACCESS UNTIL / EXPIRY</th>
              <th style={{ textAlign: 'right' }}>MANAGE</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>
                  No subscriptions matching selected filter.
                </td>
              </tr>
            ) : (
              filteredSubs.map(r => {
                const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

                return (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--sa-text-main)', display: 'block' }}>{r.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)' }}>/{r.slug}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--sa-success)' }}>{(r.plan_tier || 'pro').toUpperCase()}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)', display: 'block' }}>₹{r.plan_price || 999}/mo</span>
                    </td>
                    <td>
                      <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'expired')} type={r.subscription_type} />
                    </td>
                    <td style={{ fontWeight: 800, color: (r.auto_renew === 0 || r.auto_renew === false) ? 'var(--sa-danger)' : 'var(--sa-success)' }}>
                      {(r.auto_renew === 0 || r.auto_renew === false) ? '❌ OFF' : '✅ ON'}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {isLifetime ? '♾️ Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => onSelectTenant(r)} className="sa-btn sa-btn-secondary sa-btn-sm">
                        Details ➔
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="sa-mobile-card-list">
        {filteredSubs.map(r => {
          const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

          return (
            <div key={r.id} className="sa-mobile-card" onClick={() => onSelectTenant(r)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{r.name}</strong>
                <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'expired')} type={r.subscription_type} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--sa-text-muted)', marginBottom: '8px' }}>
                Plan: <strong style={{ color: 'var(--sa-text-main)' }}>{(r.plan_tier || 'pro').toUpperCase()} (₹{r.plan_price || 999}/mo)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', paddingTop: '8px', borderTop: '1px solid var(--sa-border)' }}>
                <span>Auto-renew: <strong>{(r.auto_renew === 0 || r.auto_renew === false) ? 'OFF' : 'ON'}</strong></span>
                <span>Until: <strong>{isLifetime ? 'Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : 'N/A'}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
