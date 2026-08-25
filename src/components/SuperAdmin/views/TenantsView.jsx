import React, { useState } from 'react';
import { Store, Plus, RefreshCw, Eye, Sparkles } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function TenantsView({ restaurants, searchQuery, onSelectTenant, onAddTenant, onRefresh, loading }) {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = restaurants.filter(r => {
    const isSuspended = (r.active === false || r.active === 0 || r.active === '0');
    if (statusFilter === 'active' && isSuspended) return false;
    if (statusFilter === 'suspended' && !isSuspended) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.slug && r.slug.toLowerCase().includes(q)) ||
      (r.owner_username && r.owner_username.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Action Bar */}
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <Store size={20} color="var(--sa-primary)" /> Tenant Restaurants ({filtered.length})
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Manage client accounts, menu hosting, and access terms.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--sa-surface-subtle)', padding: '2px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
            <button
              onClick={() => setStatusFilter('all')}
              className={`sa-btn sa-btn-sm ${statusFilter === 'all' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ border: 'none' }}
            >
              All ({restaurants.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`sa-btn sa-btn-sm ${statusFilter === 'active' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ border: 'none' }}
            >
              🟢 Active
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`sa-btn sa-btn-sm ${statusFilter === 'suspended' ? 'sa-btn-primary' : 'sa-btn-secondary'}`}
              style={{ border: 'none' }}
            >
              🔴 Suspended
            </button>
          </div>

          <button onClick={onRefresh} className="sa-btn sa-btn-secondary sa-btn-sm">
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>

          <button onClick={onAddTenant} className="sa-btn sa-btn-accent sa-btn-sm">
            <Plus size={15} /> Add Restaurant
          </button>
        </div>
      </div>

      {/* Desktop Responsive Table */}
      <div className="sa-table-container sa-responsive-table">
        <table className="sa-table">
          <thead>
            <tr>
              <th style={{ minWidth: '240px' }}>RESTAURANT</th>
              <th style={{ minWidth: '160px' }}>OWNER</th>
              <th style={{ minWidth: '130px' }}>PLAN</th>
              <th style={{ minWidth: '110px' }}>STATUS</th>
              <th style={{ minWidth: '140px' }}>ACCESS UNTIL</th>
              <th style={{ minWidth: '90px' }}>DISHES</th>
              <th style={{ minWidth: '90px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--sa-text-muted)' }}>
                  No tenant restaurants matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map(r => {
                const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

                return (
                  <tr key={r.id}>
                    <td style={{ minWidth: '240px', maxWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title={r.name}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'var(--sa-primary)', color: 'var(--sa-accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: '0.85rem', flexShrink: 0
                        }}>
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>/{r.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ minWidth: '160px', maxWidth: '190px' }}>
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', display: 'block', color: 'var(--sa-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.owner_username || r.owner_name || 'admin'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.owner_email || 'No email'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--sa-success)' }}>{(r.plan_tier || 'pro').toUpperCase()}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', display: 'block' }}>
                        {r.subscription_type === 'ADMIN_GRANTED' ? '₹0/mo (Free)' : `₹${r.plan_price || 999}/mo`}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'expired')} type={r.subscription_type} />
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      {isLifetime ? '♾️ Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : 'N/A'}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--sa-primary)' }}>{r.dish_count || 0} Items</td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => onSelectTenant(r)} className="sa-btn sa-btn-secondary sa-btn-sm">
                        <Eye size={13} /> Manage ➔
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Ultra-Compact Mobile Cards View (<= 767px) */}
      <div className="sa-mobile-card-list">
        {filtered.map(r => {
          const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

          return (
            <div key={r.id} className="sa-mobile-card" onClick={() => onSelectTenant(r)} style={{ cursor: 'pointer', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 900, margin: '0 0 1px 0', color: 'var(--sa-text-main)' }}>{r.name}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--sa-accent)', fontWeight: 800 }}>/{r.slug}</span>
                </div>
                <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'expired')} type={r.subscription_type} />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--sa-text-muted)', margin: '6px 0' }}>
                <strong style={{ color: 'var(--sa-text-main)' }}>{(r.plan_tier || 'pro').toUpperCase()}</strong> · {r.subscription_type === 'ADMIN_GRANTED' ? '₹0/mo' : `₹${r.plan_price || 999}/mo`}
                <span style={{ marginLeft: '10px' }}>· {r.dish_count || 0} dishes</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--sa-border)' }}>
                <span style={{ fontSize: '0.73rem', color: 'var(--sa-text-muted)' }}>
                  Access until <strong>{isLifetime ? '♾️ Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : 'N/A'}</strong>
                </span>
                <button className="sa-btn sa-btn-secondary sa-btn-sm" style={{ padding: '4px 10px' }}>
                  Manage ➔
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
