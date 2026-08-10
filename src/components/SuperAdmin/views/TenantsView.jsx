import React, { useState } from 'react';
import { Store, Plus, RefreshCw, Eye, Sparkles, ExternalLink, Calendar, CheckCircle, XCircle } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function TenantsView({ restaurants, searchQuery, onSelectTenant, onAddTenant, onRefresh, loading }) {
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'suspended'

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar */}
      <div className="sa-section-header">
        <div>
          <h2 className="sa-section-title">
            <Store size={22} color="var(--sa-primary)" /> Tenant Restaurants ({filtered.length})
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Manage active client accounts, menu hosting, and subscription terms.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', background: 'var(--sa-surface-subtle)', padding: '3px', borderRadius: 'var(--sa-radius-md)', border: '1px solid var(--sa-border)' }}>
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

          <button onClick={onRefresh} className="sa-btn sa-btn-secondary">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>

          <button onClick={onAddTenant} className="sa-btn sa-btn-accent">
            <Plus size={16} /> Add Restaurant
          </button>
        </div>
      </div>

      {/* Desktop Responsive Table */}
      <div className="sa-table-container sa-responsive-table">
        <table className="sa-table">
          <thead>
            <tr>
              <th>RESTAURANT</th>
              <th>OWNER</th>
              <th>PLAN</th>
              <th>STATUS</th>
              <th>ACCESS UNTIL</th>
              <th>DISHES</th>
              <th style={{ textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>
                  No tenant restaurants matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map(r => {
                const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: 'var(--sa-primary)', color: 'var(--sa-accent)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: '0.9rem', flexShrink: 0
                        }}>
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9rem', display: 'block', color: 'var(--sa-text-main)' }}>{r.name}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--sa-text-muted)' }}>/{r.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--sa-text-muted)' }}>{r.owner_username || 'N/A'}</td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--sa-success)' }}>{(r.plan_tier || 'pro').toUpperCase()}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--sa-text-muted)', display: 'block' }}>₹{r.plan_price || 999}/mo</span>
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

      {/* Mobile Card List (Visible on <= 767px) */}
      <div className="sa-mobile-card-list">
        {filtered.map(r => {
          const isLifetime = r.subscription_type === 'ADMIN_GRANTED' || (r.access_until && new Date(r.access_until).getFullYear() > 2030);

          return (
            <div key={r.id} className="sa-mobile-card" onClick={() => onSelectTenant(r)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 2px 0', color: 'var(--sa-text-main)' }}>{r.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--sa-accent)', fontWeight: 800 }}>/{r.slug}</span>
                </div>
                <StatusBadge status={r.subscription_status || (r.active !== false ? 'active' : 'expired')} type={r.subscription_type} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--sa-text-muted)', borderTop: '1px solid var(--sa-border)', paddingTop: '10px', marginTop: '10px' }}>
                <div>Plan: <strong style={{ color: 'var(--sa-text-main)' }}>{(r.plan_tier || 'pro').toUpperCase()} (₹{r.plan_price || 999}/mo)</strong></div>
                <div>Dishes: <strong style={{ color: 'var(--sa-success)' }}>{r.dish_count || 0}</strong></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--sa-text-muted)' }}>
                  Access: <strong>{isLifetime ? '♾️ Lifetime' : r.access_until ? new Date(r.access_until).toLocaleDateString('en-IN') : 'N/A'}</strong>
                </span>
                <button className="sa-btn sa-btn-secondary sa-btn-sm">
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
