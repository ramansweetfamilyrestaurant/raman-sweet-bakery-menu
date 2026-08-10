import React, { useState } from 'react';
import { CreditCard, ArrowDown } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <CreditCard size={20} color="var(--sa-primary)" /> Subscription Management & Billing Lifecycle
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Audit tenant Cashfree AutoPay mandates, renewals, and complimentary access.
          </span>
        </div>
      </div>

      {/* Horizontally Scrollable Filter Strip */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
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
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--sa-text-muted)' }}>
                  No subscriptions matching selected filter.
                </td>
              </tr>
            ) : (
              filteredSubs.map(r => {
                const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

                return (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--sa-text-main)', display: 'block' }}>{r.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)' }}>/{r.slug}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--sa-success)' }}>{(r.plan_tier || 'pro').toUpperCase()}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                        {r.subscription_type === 'ADMIN_GRANTED' ? '₹0/mo (Free)' : `₹${r.plan_price || 999}/mo`}
                      </span>
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
            <div key={r.id} className="sa-mobile-card" onClick={() => onSelectTenant(r)} style={{ cursor: 'pointer', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{r.name}</strong>
                <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'expired')} type={r.subscription_type} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--sa-text-muted)', marginBottom: '8px' }}>
                Plan: <strong style={{ color: 'var(--sa-text-main)' }}>{(r.plan_tier || 'pro').toUpperCase()} ({r.subscription_type === 'ADMIN_GRANTED' ? '₹0/mo' : `₹${r.plan_price || 999}/mo`})</strong>
              </div>

              {/* Scheduled Plan Change Block */}
              {r.scheduled_plan_key && (
                <div style={{ background: 'var(--sa-info-bg)', border: '1px solid var(--sa-info-border)', borderRadius: 'var(--sa-radius-sm)', padding: '8px', fontSize: '0.75rem', margin: '8px 0' }}>
                  <div style={{ color: '#1E40AF', fontWeight: 800 }}>CURRENT: {(r.plan_tier || 'pro').toUpperCase()} (₹{r.plan_price || 999}/mo)</div>
                  <div style={{ textAlign: 'center', color: '#2563EB', margin: '2px 0' }}><ArrowDown size={12} /></div>
                  <div style={{ color: '#1E40AF', fontWeight: 800 }}>SCHEDULED: {r.scheduled_plan_key.toUpperCase()}</div>
                  <div style={{ fontSize: '0.7rem', color: '#3B82F6', marginTop: '2px' }}>
                    Effective: {r.plan_change_effective_at ? new Date(r.plan_change_effective_at).toLocaleDateString('en-IN') : 'Next Billing Boundary'}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', paddingTop: '8px', borderTop: '1px solid var(--sa-border)' }}>
                <span>Auto-renew: <strong>{(r.auto_renew === 0 || r.auto_renew === false) ? 'OFF' : 'ON'}</strong></span>
                <span>Until: <strong>{isLifetime ? '♾️ Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : 'N/A'}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
