import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Shield, Key, Store, CreditCard, Sparkles, Settings, 
  Search, RefreshCw, Download, ExternalLink, ChevronDown, ChevronUp, 
  X, Copy, Check, Clock, User, ArrowUpRight, Activity, Filter
} from 'lucide-react';
import '../styles/SuperAdmin.css';

export default function AuditLogsView({ 
  auditLogs = [], 
  loading = false, 
  onRefresh, 
  restaurants = [], 
  setSelectedTenant360 
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (onRefresh) onRefresh();
  }, []);

  // Categorize log entry
  const getCategory = (log) => {
    const act = (log.action || '').toUpperCase();
    if (act.includes('SECURITY') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('CREDENTIAL') || act.includes('PASSWORD') || act.includes('IMPERSONAT')) {
      return { id: 'security', label: 'Security', icon: Key, color: '#9333EA', bg: '#F3E8FF', border: '#D8B4FE' };
    }
    if (act.includes('TENANT') || act.includes('RESTAURANT') || act.includes('ACTIVAT') || act.includes('SUSPEND') || act.includes('DELETE') || act.includes('REGISTER')) {
      return { id: 'tenant', label: 'Shop', icon: Store, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
    }
    if (act.includes('CASHFREE') || act.includes('PAYMENT') || act.includes('SUB_') || act.includes('SUBSCRIPTION') || act.includes('PLAN') || act.includes('CANCEL') || act.includes('RENEW')) {
      return { id: 'billing', label: 'Billing', icon: CreditCard, color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' };
    }
    if (act.includes('VIP') || act.includes('COMPLIMENTARY') || act.includes('ADMIN_GRANTED')) {
      return { id: 'vip', label: 'VIP', icon: Sparkles, color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' };
    }
    return { id: 'system', label: 'System', icon: Settings, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
  };

  const getActorDetails = (role) => {
    switch (role) {
      case 'superadmin':
        return { label: '👑 Super Admin', bg: '#FEF3C7', color: '#92400E' };
      case 'restaurant_admin':
      case 'admin':
        return { label: '🏢 Resto Owner', bg: '#EFF6FF', color: '#1E40AF' };
      case 'payment_gateway':
        return { label: '💳 Cashfree Gateway', bg: '#DCFCE7', color: '#166534' };
      case 'system':
        return { label: '⚙️ System Worker', bg: '#F1F5F9', color: '#334155' };
      default:
        return { label: role ? `👤 ${role}` : '⚙️ System', bg: '#F1F5F9', color: '#334155' };
    }
  };

  // Metrics counts
  const stats = useMemo(() => {
    let security = 0;
    let billing = 0;
    let tenant = 0;
    let system = 0;

    (auditLogs || []).forEach(log => {
      const cat = getCategory(log).id;
      if (cat === 'security') security++;
      else if (cat === 'billing') billing++;
      else if (cat === 'tenant') tenant++;
      else system++;
    });

    return {
      total: auditLogs.length,
      security,
      billing,
      tenant,
      system
    };
  }, [auditLogs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return (auditLogs || [])
      .filter(log => {
        if (activeFilter === 'all') return true;
        return getCategory(log).id === activeFilter;
      })
      .filter(log => {
        if (actorFilter === 'all') return true;
        return (log.actor_role || '').toLowerCase() === actorFilter.toLowerCase();
      })
      .filter(log => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const targetResto = log.restaurant_id ? restaurants.find(r => r.id === log.restaurant_id) : null;
        return (log.action || '').toLowerCase().includes(q) ||
          (log.details || '').toLowerCase().includes(q) ||
          (log.actor_role || '').toLowerCase().includes(q) ||
          String(log.restaurant_id || '').includes(q) ||
          (targetResto && (targetResto.name.toLowerCase().includes(q) || targetResto.slug.toLowerCase().includes(q)));
      });
  }, [auditLogs, activeFilter, actorFilter, searchQuery, restaurants]);

  // Export audit logs as CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Actor Role', 'Category', 'Action', 'Restaurant ID', 'Details'];
    const rows = filteredLogs.map(log => [
      log.id,
      `"${new Date(log.created_at || Date.now()).toISOString()}"`,
      `"${log.actor_role || 'system'}"`,
      `"${getCategory(log).label}"`,
      `"${(log.action || '').replace(/"/g, '""')}"`,
      log.restaurant_id || 'System',
      `"${(log.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `touchqr_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyJson = (log) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="sa-audit-container">
      
      {/* 🌟 1. LUXURY SIGNATURE AUDIT HERO BANNER */}
      <div className="sa-audit-hero-card">
        {/* Ambient Glow */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 260px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
              color: '#0A2315', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(212, 175, 55, 0.35)', flexShrink: 0
            }}>
              <FileText size={22} color="#0A2315" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                  Platform Security & Audit Log Trail
                </h2>
                <span style={{
                  padding: '2px 7px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 900,
                  background: '#10B981', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  ● LIVE STREAM
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: '#A7F3D0', fontWeight: 600, lineHeight: 1.3 }}>
                Append-only PostgreSQL security trail of all master actions, gateway webhooks, shop grants & tenant events.
              </p>
            </div>
          </div>

          {/* Quick Triggers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            <button
              type="button"
              onClick={handleExportCSV}
              className="sa-btn"
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '0.74rem', fontWeight: 800, padding: '7px 12px', borderRadius: '10px', whiteSpace: 'nowrap'
              }}
            >
              <Download size={13} /> Export CSV
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="sa-btn"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
                color: '#0A2315', border: 'none',
                fontSize: '0.74rem', fontWeight: 900, padding: '7px 12px', borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)', whiteSpace: 'nowrap'
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} color="#0A2315" /> Refresh Trail
            </button>
          </div>
        </div>

        {/* 4 High-Impact Live Metric Cards */}
        <div className="sa-audit-hero-metrics">
          <div className="sa-audit-metric-tile">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>LATEST LOGS</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#34D399', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              📜 {stats.total} Logs
            </div>
          </div>

          <div className="sa-audit-metric-tile">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>SECURITY & ACCESS</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#C084FC', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              🔑 {stats.security} Events
            </div>
          </div>

          <div className="sa-audit-metric-tile">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>BILLING & CASHFREE</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#6EE7B7', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              💳 {stats.billing} Events
            </div>
          </div>

          <div className="sa-audit-metric-tile">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>SHOP LIFECYCLE</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#93C5FD', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              🏪 {stats.tenant} Events
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 2. FILTER PILLS STRIP, SEARCH & ACTOR SELECTOR */}
      <div className="sa-audit-controls-strip">
        
        {/* Category Filter Pills Strip with Touch Overflow */}
        <div className="sa-filter-strip-wrapper">
          <div className="sa-filter-pills-strip">
            {[
              { id: 'all', label: `All (${stats.total})`, icon: FileText },
              { id: 'security', label: `Security (${stats.security})`, icon: Key },
              { id: 'tenant', label: `Shop (${stats.tenant})`, icon: Store },
              { id: 'billing', label: `Billing (${stats.billing})`, icon: CreditCard },
              { id: 'vip', label: 'VIP & Grants', icon: Sparkles },
              { id: 'system', label: `System (${stats.system})`, icon: Settings },
            ].map(pill => {
              const Icon = pill.icon;
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActiveFilter(pill.id)}
                  className="sa-filter-pill-btn"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '7px 12px', fontWeight: 800, fontSize: '0.74rem',
                    borderRadius: '10px', border: isActive ? '1.5px solid #D4AF37' : '1px solid var(--sa-border)',
                    background: isActive ? '#0A2315' : '#FFFFFF',
                    color: isActive ? '#DFBA67' : 'var(--sa-text-muted)',
                    cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0
                  }}
                >
                  <Icon size={12} color={isActive ? '#DFBA67' : 'currentColor'} />
                  <span>{pill.label}</span>
                </button>
              );
            })}
          </div>
          <div className="sa-filter-strip-fade" />
        </div>

        {/* Search & Actor Filters (Responsive Desktop row / Mobile stack) */}
        <div className="sa-audit-filter-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Actor Role Filter */}
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            style={{
              padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--sa-border)',
              fontSize: '0.76rem', fontWeight: 800, color: 'var(--sa-text-main)', background: '#FFFFFF', outline: 'none',
              boxSizing: 'border-box'
            }}
          >
            <option value="all">👥 All Actors</option>
            <option value="superadmin">👑 Super Admin</option>
            <option value="admin">🏢 Restaurant Admin</option>
            <option value="payment_gateway">💳 Cashfree Gateway</option>
            <option value="system">⚙️ System Engine</option>
          </select>

          {/* Full Text Search Input with Safe Padding & Alignment */}
          <div className="sa-search-wrap" style={{ position: 'relative', minWidth: '220px', flex: '1 1 auto' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--sa-text-muted)',
                pointerEvents: 'none'
              }}
            />
            <input
              type="text"
              placeholder="Search action, details, actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 34px 9px 36px',
                borderRadius: '10px',
                border: '1px solid var(--sa-border)',
                fontSize: '0.76rem',
                outline: 'none',
                background: '#FFFFFF',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--sa-text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.80rem',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📋 3A. DESKTOP AUDIT LOG STREAM TABLE (>= 768px) */}
      <div className="sa-audit-desktop-table" style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--sa-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--sa-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', width: '140px' }}>TIMESTAMP</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', width: '150px' }}>ACTOR / ROLE</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', width: '110px' }}>CATEGORY</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>EVENT / ACTION</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>DETAILS</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', textAlign: 'right', width: '90px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>
                    ⏳ Loading live append-only audit log stream...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--sa-text-muted)' }}>
                    📜 No audit log entries matched your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const cat = getCategory(log);
                  const actor = getActorDetails(log.actor_role || log.role);
                  const targetTenant = log.restaurant_id ? restaurants.find(r => r.id === log.restaurant_id) : null;

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}>
                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', fontSize: '0.75rem', color: 'var(--sa-text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontWeight: 800, color: 'var(--sa-text-main)' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                        </div>
                        <div style={{ fontSize: '0.68rem' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                        </div>
                      </td>

                      {/* Actor & Role */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 800,
                          background: actor.bg, color: actor.color, display: 'inline-block'
                        }}>
                          {actor.label}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 800,
                          background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <cat.icon size={11} /> {cat.label}
                        </span>
                      </td>

                      {/* Event / Action */}
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--sa-text-main)', display: 'block' }}>
                          {log.action}
                        </strong>
                        {targetTenant && setSelectedTenant360 && (
                          <span
                            onClick={() => setSelectedTenant360(targetTenant)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#B48F27', fontWeight: 800, cursor: 'pointer', marginTop: '2px' }}
                            title="Open Shop 360° Profile"
                          >
                            🏢 {targetTenant.name} <ArrowUpRight size={10} />
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#475569', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.details || 'Operational event recorded'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(log)}
                          className="sa-btn sa-btn-secondary sa-btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', fontWeight: 800 }}
                          title="Inspect event"
                        >
                          🔍 View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📋 3B. MOBILE AUDIT LOG CARDS (<= 767px) */}
      <div className="sa-audit-mobile-cards">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid var(--sa-border)', color: 'var(--sa-text-muted)', fontSize: '0.80rem' }}>
            ⏳ Loading live append-only audit log stream...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid var(--sa-border)', color: 'var(--sa-text-muted)', fontSize: '0.80rem' }}>
            📜 No audit log entries matched your filter.
          </div>
        ) : (
          filteredLogs.map(log => {
            const cat = getCategory(log);
            const actor = getActorDetails(log.actor_role || log.role);
            const targetTenant = log.restaurant_id ? restaurants.find(r => r.id === log.restaurant_id) : null;

            return (
              <div className="sa-audit-mobile-card" key={log.id}>
                {/* Header: Timestamp & 44px Touch View Button */}
                <div className="sa-audit-mobile-card-top">
                  <div className="sa-audit-mobile-timestamp">
                    <Clock size={12} color="var(--sa-text-muted)" />
                    <span className="sa-audit-mobile-time">
                      {log.created_at ? new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                    </span>
                    <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)' }}>
                      • {log.created_at ? new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedEvent(log)}
                    className="sa-audit-mobile-view-btn"
                    title={`Inspect audit log #${log.id}`}
                  >
                    🔍 View
                  </button>
                </div>

                {/* Badges: Actor & Category */}
                <div className="sa-audit-mobile-badges">
                  <span style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 800,
                    background: actor.bg, color: actor.color, display: 'inline-block'
                  }}>
                    {actor.label}
                  </span>

                  <span style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '0.70rem', fontWeight: 800,
                    background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}>
                    <cat.icon size={11} /> {cat.label}
                  </span>
                </div>

                {/* Action / Event */}
                <div className="sa-audit-mobile-action">
                  <strong>{log.action}</strong>
                  {targetTenant && setSelectedTenant360 && (
                    <span
                      onClick={() => setSelectedTenant360(targetTenant)}
                      className="sa-audit-tenant-link"
                      title="Open Shop 360° Profile"
                    >
                      🏢 {targetTenant.name} <ArrowUpRight size={10} />
                    </span>
                  )}
                </div>

                {/* Context Details */}
                <div className="sa-audit-mobile-details">
                  {log.details || 'Operational event recorded'}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 🔍 4. EVENT DETAIL DEEP INSPECTOR MODAL */}
      {selectedEvent && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(10,35,21,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF', width: '100%', maxWidth: '560px', borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid var(--sa-border)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 22px', background: '#0A2315', color: '#DFBA67'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} color="#DFBA67" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#FFFFFF' }}>
                  Audit Event #{selectedEvent.id}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)} 
                style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800 }}>EVENT ACTION</span>
                  <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 900, color: 'var(--sa-text-main)' }}>
                    {selectedEvent.action}
                  </h4>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: 900,
                  background: getCategory(selectedEvent).bg, color: getCategory(selectedEvent).color, border: `1px solid ${getCategory(selectedEvent).border}`
                }}>
                  {getCategory(selectedEvent).label}
                </span>
              </div>

              {/* Summary Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.80rem' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>ACTOR / ROLE</span>
                  <strong style={{ color: 'var(--sa-text-main)', marginTop: '2px', display: 'block' }}>
                    {getActorDetails(selectedEvent.actor_role || selectedEvent.role).label}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>RESTAURANT / TENANT</span>
                  <strong style={{ color: '#0F766E', marginTop: '2px', display: 'block' }}>
                    {selectedEvent.restaurant_id ? `Shop ID #${selectedEvent.restaurant_id}` : 'Platform Level / System'}
                  </strong>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block' }}>EXACT TIMESTAMP</span>
                  <strong style={{ color: 'var(--sa-text-main)', marginTop: '2px', display: 'block' }}>
                    🕒 {selectedEvent.created_at ? new Date(selectedEvent.created_at).toLocaleString('en-IN') : 'N/A'}
                  </strong>
                </div>
              </div>

              {/* Event Human Details */}
              <div>
                <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800, display: 'block', marginBottom: '4px' }}>EVENT DESCRIPTION / CONTEXT:</span>
                <div style={{ background: '#F0FDF4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #86EFAC', fontSize: '0.82rem', color: '#15803D', fontWeight: 700, lineHeight: 1.4 }}>
                  {selectedEvent.details || 'No additional details provided'}
                </div>
              </div>

              {/* Raw JSON Payload */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.70rem', color: 'var(--sa-text-muted)', fontWeight: 800 }}>RAW IMMUTABLE RECORD:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(selectedEvent)}
                    style={{
                      background: 'none', border: 'none', color: '#2563EB',
                      fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    {copiedId === selectedEvent.id ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                    {copiedId === selectedEvent.id ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <pre style={{
                  margin: 0, fontSize: '0.74rem', color: '#0F172A', fontFamily: 'monospace',
                  background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1',
                  overflowX: 'auto', maxHeight: '140px'
                }}>
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="sa-btn sa-btn-secondary"
                style={{ padding: '8px 18px', fontWeight: 800 }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
