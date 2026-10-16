import React, { useState } from 'react';
import { CreditCard, ArrowDown } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { BUSINESS_TYPE_METADATA, BUSINESS_TYPE_ALIASES } from '../../../utils/businessTaxonomy';
import { matchesTenantStatusFilter, formatTenantPlanDisplay } from '../../../utils/subscriptionState';

export default function SubscriptionsView({ restaurants, onSelectTenant }) {
  const [filter, setFilter] = useState('all');

  const isVipTenant = (r) => matchesTenantStatusFilter(r, 'vip');
  const matchesSubFilter = (r, f) => matchesTenantStatusFilter(r, f);

  const filteredSubs = restaurants.filter(r => matchesSubFilter(r, filter));

  const filterTabs = [
    { id: 'all', label: `All Subscriptions (${restaurants.length})` },
    { id: 'active', label: `🟢 Active Paid (${restaurants.filter(r => matchesSubFilter(r, 'active')).length})` },
    { id: 'trial', label: `⏳ Free Trial (${restaurants.filter(r => matchesSubFilter(r, 'trial')).length})` },
    { id: 'failed', label: `⚠️ Payment Failed (${restaurants.filter(r => matchesSubFilter(r, 'failed')).length})` },
    { id: 'cancelled', label: `⏸️ Cancellations (${restaurants.filter(r => matchesSubFilter(r, 'cancelled')).length})` },
    { id: 'scheduled', label: `📋 Plan Changes (${restaurants.filter(r => matchesSubFilter(r, 'scheduled')).length})` },
    { id: 'complimentary', label: `🎁 Complimentary (${restaurants.filter(r => matchesSubFilter(r, 'complimentary')).length})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <CreditCard size={20} color="var(--sa-primary)" /> Subscription Management & Billing Lifecycle
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Audit shop Cashfree AutoPay mandates, renewals, and complimentary access.
          </span>
        </div>
      </div>

      {/* Horizontally Scrollable Filter Strip */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', whiteSpace: 'nowrap', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {filterTabs.map(tab => (
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)' }}>/{r.slug}</span>
                        {(() => {
                          const canonicalType = BUSINESS_TYPE_ALIASES[r.business_type] || r.business_type;
                          const bizMeta = BUSINESS_TYPE_METADATA[canonicalType] || { icon: '🏢', label: canonicalType || 'Restaurant' };
                          return (
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 800,
                              color: 'var(--sa-text-muted)',
                              background: 'var(--sa-surface-subtle)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              border: '1px solid var(--sa-border)'
                            }}>
                              {bizMeta.icon} {(bizMeta.label || 'Restaurant').replace(/\s*\(.*\)/, '')}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const planInfo = formatTenantPlanDisplay(r);
                        return (
                          <>
                            <span style={{ fontWeight: 800, color: isVipTenant(r) ? '#7E22CE' : 'var(--sa-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {planInfo.primaryLabel}
                              {isVipTenant(r) && <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 900 }}> ★ VIP</span>}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                              {planInfo.secondaryLabel}
                            </span>
                          </>
                        );
                      })()}
                    </td>
                    <td>
                      <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'suspended')} type={r.subscription_type} active={r.active} />
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
          const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030) || r.is_vip || r.is_complimentary;
          const planInfo = formatTenantPlanDisplay(r);

          return (
            <div key={r.id} className="sa-mobile-card" onClick={() => onSelectTenant(r)} style={{ cursor: 'pointer', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{r.name}</strong>
                <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'suspended')} type={r.subscription_type} active={r.active} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--sa-text-muted)', marginBottom: '8px' }}>
                Plan: <strong style={{ color: isVipTenant(r) ? '#7E22CE' : 'var(--sa-text-main)' }}>
                  {planInfo.primaryLabel}
                  {isVipTenant(r) && <span style={{ marginLeft: 4, color: '#a855f7' }}> ★ VIP</span>}
                  {' '}({planInfo.secondaryLabel.replace(' (', ' • ').replace(')', '')})
                </strong>
              </div>

              {/* Scheduled Plan Change Block */}
              {r.scheduled_plan_key && (
                <div style={{ background: 'var(--sa-info-bg)', border: '1px solid var(--sa-info-border)', borderRadius: 'var(--sa-radius-sm)', padding: '8px', fontSize: '0.75rem', margin: '8px 0' }}>
                  <div style={{ color: '#1E40AF', fontWeight: 800 }}>CURRENT: {planInfo.primaryLabel} ({isVipTenant(r) ? '₹0/mo' : `₹${r.effective_plan_price || r.plan_price || 999}/mo`})</div>
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
