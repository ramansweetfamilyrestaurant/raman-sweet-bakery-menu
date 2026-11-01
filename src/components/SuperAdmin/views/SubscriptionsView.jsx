import React, { useState, useMemo } from 'react';
import { CreditCard, ArrowDown, Search, X, Download, MessageSquare, ExternalLink } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { BUSINESS_TYPE_METADATA, BUSINESS_TYPE_ALIASES } from '../../../utils/businessTaxonomy';
import { matchesTenantStatusFilter, formatTenantPlanDisplay, isLifetimeVipTenant, isVipTenant } from '../../../utils/subscriptionState';

export default function SubscriptionsView({ restaurants = [], onSelectTenant, onMoreActions }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const matchesSubFilter = (r, f) => matchesTenantStatusFilter(r, f);

  // Search filtering
  const filteredSubs = useMemo(() => {
    return restaurants.filter(r => {
      const matchesFilter = matchesSubFilter(r, filter);
      if (!matchesFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const name = (r.name || '').toLowerCase();
      const slug = (r.slug || '').toLowerCase();
      const phone = (r.phone || r.whatsapp_number || '').toLowerCase();
      const user = (r.owner_username || '').toLowerCase();
      return name.includes(q) || slug.includes(q) || phone.includes(q) || user.includes(q);
    });
  }, [restaurants, filter, searchQuery]);

  const filterTabs = [
    { id: 'all', label: `All (${restaurants.length})` },
    { id: 'active', label: `🟢 Active Paid (${restaurants.filter(r => matchesSubFilter(r, 'active')).length})` },
    { id: 'trial', label: `⏳ Free Trial (${restaurants.filter(r => matchesSubFilter(r, 'trial')).length})` },
    { id: 'failed', label: `⚠️ Payment Failed (${restaurants.filter(r => matchesSubFilter(r, 'failed')).length})` },
    { id: 'cancelled', label: `⏸️ Cancellations (${restaurants.filter(r => matchesSubFilter(r, 'cancelled')).length})` },
    { id: 'scheduled', label: `📋 Plan Changes (${restaurants.filter(r => matchesSubFilter(r, 'scheduled')).length})` },
    { id: 'complimentary', label: `👑 VIP / Complimentary (${restaurants.filter(r => matchesSubFilter(r, 'complimentary')).length})` },
  ];

  // Export CSV
  const handleExportCsv = () => {
    if (!filteredSubs.length) return;
    const headers = ['ID', 'Business Name', 'Slug', 'Plan', 'Price (INR)', 'Status', 'Auto Renew', 'Access Until', 'Scheduled Switch'];
    const rows = filteredSubs.map(r => {
      const planInfo = formatTenantPlanDisplay(r);
      const isLifetime = isLifetimeVipTenant(r);
      const isVip = isVipTenant(r);
      const accessStr = isLifetime ? 'Lifetime' : (r.access_until || r.plan_expires_at || 'Active');
      return [
        r.id,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        r.slug || '',
        `"${planInfo.primaryLabel}"`,
        r.effective_plan_price !== undefined ? r.effective_plan_price : (r.plan_price || 999),
        r.subscription_status || (r.active !== false ? 'active' : 'suspended'),
        isVip ? 'OFF (VIP)' : (r.auto_renew === 0 || r.auto_renew === false ? 'OFF' : 'ON'),
        `"${accessStr}"`,
        r.scheduled_plan_key || 'None'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `touchqr_subscriptions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp Outreach
  const handleWhatsAppOutreach = (resto) => {
    const rawPhone = (resto.phone || resto.whatsapp_number || '').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://touchqr.com';
    const adminUrl = `${origin}/admin/login?slug=${resto.slug}`;

    const msg = `Hello ${resto.owner_username || resto.name},\nThis is TouchQR Billing Support regarding your account for *${resto.name}*.\nPlease check your subscription status or update your payment details at: ${adminUrl}`;
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

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
        <button
          type="button"
          onClick={handleExportCsv}
          className="sa-btn sa-btn-secondary sa-btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px', height: '38px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--sa-text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search subscriptions by name, slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sa-input sa-search-input-field"
            style={{
              paddingLeft: '34px',
              paddingRight: searchQuery ? '32px' : '12px',
              height: '38px',
              fontSize: '0.80rem',
              borderRadius: 'var(--sa-radius-full)',
              background: 'var(--sa-surface-subtle)',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sa-text-muted)', padding: '2px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
          Showing <strong>{filteredSubs.length}</strong> of {restaurants.length} subscriptions
        </span>
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
              <th>BUSINESS / TENANT</th>
              <th>CURRENT PLAN</th>
              <th>STATUS</th>
              <th>AUTO-RENEW</th>
              <th>ACCESS UNTIL / EXPIRY</th>
              <th style={{ textAlign: 'right' }}>ACTION</th>
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
                const isVip = isVipTenant(r);
                const isLifetime = isLifetimeVipTenant(r);

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
                            <span style={{ fontWeight: 800, color: isVip ? '#7E22CE' : 'var(--sa-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {planInfo.primaryLabel}
                              {isVip && <span style={{ color: '#a855f7', fontSize: '0.75rem', fontWeight: 900 }}> ★ VIP</span>}
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
                    <td style={{ fontWeight: 800, color: (isVip || r.auto_renew === 0 || r.auto_renew === false) ? 'var(--sa-danger)' : 'var(--sa-success)' }}>
                      {isVip
                        ? (r.has_underlying_paid_subscription && r.underlying_subscription_status === 'active' ? `OFF (Paid: ${r.underlying_auto_renew ? 'ON' : 'OFF'})` : 'OFF (N/A)')
                        : (r.auto_renew === 0 || r.auto_renew === false) ? '❌ OFF' : '✅ ON'}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {isLifetime
                        ? '♾️ Lifetime'
                        : (r.access_until && r.access_until !== 'Lifetime')
                          ? new Date(r.access_until).toLocaleDateString('en-IN')
                          : (r.plan_expires_at && String(r.plan_expires_at).toLowerCase() !== 'lifetime')
                            ? new Date(r.plan_expires_at).toLocaleDateString('en-IN')
                            : 'N/A'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', alignItems: 'center' }}>
                        {(r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due') && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppOutreach(r)}
                            className="sa-btn sa-btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.70rem', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontWeight: 800 }}
                            title="Send WhatsApp Billing Reminder"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}
                        <button 
                          onClick={() => onSelectTenant && onSelectTenant(r)} 
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 9px', fontSize: '0.72rem', fontWeight: 800 }}
                        >
                          🔍 360°
                        </button>
                        {onMoreActions && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoreActions(r);
                            }}
                            className="sa-btn sa-btn-secondary sa-btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 900 }}
                          >
                            •••
                          </button>
                        )}
                      </div>
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
          const isLifetime = isLifetimeVipTenant(r);
          const planInfo = formatTenantPlanDisplay(r);

          return (
            <div key={r.id} className="sa-mobile-card" onClick={() => onSelectTenant && onSelectTenant(r)} style={{ cursor: 'pointer', padding: '14px' }}>
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
                <span>Auto-renew: <strong>{isVipTenant(r) ? (r.has_underlying_paid_subscription && r.underlying_subscription_status === 'active' ? `OFF (Paid: ${r.underlying_auto_renew ? 'ON' : 'OFF'})` : 'OFF (N/A)') : (r.auto_renew === 0 || r.auto_renew === false) ? 'OFF' : 'ON'}</strong></span>
                <span>Until: <strong>{isLifetime ? '♾️ Lifetime' : (r.access_until && r.access_until !== 'Lifetime') ? new Date(r.access_until).toLocaleDateString('en-IN') : (r.plan_expires_at && String(r.plan_expires_at).toLowerCase() !== 'lifetime') ? new Date(r.plan_expires_at).toLocaleDateString('en-IN') : 'N/A'}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
