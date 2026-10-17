import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  FileText, Shield, Key, Store, CreditCard, Sparkles, Settings, 
  Search, RefreshCw, Download, ExternalLink, ChevronDown, ChevronUp, 
  X, Copy, Check, Clock, User, ArrowUpRight, Activity, Filter, AlertTriangle,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar, Archive
} from 'lucide-react';
import '../styles/SuperAdmin.css';
import AuditArchivesView from './AuditArchivesView.jsx';
import {
  getCategory,
  getActorDetails,
  normalizeActorRole,
  computeAuditStats,
  resolveTenantDisplay
} from '../../../utils/auditLogHelpers';

export default function AuditLogsView({ 
  auditLogs = [], 
  loading = false, 
  error = null,
  pagination = null,
  stats: serverStats = null,
  onFetchLogs = null,
  onRefresh, 
  restaurants = [], 
  setSelectedTenant360 
}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'archives'

  // Metrics counts: uses platform-wide serverStats if provided, or computes on current stream
  const stats = useMemo(() => {
    if (serverStats && typeof serverStats === 'object' && serverStats.total !== undefined) {
      return serverStats;
    }
    return computeAuditStats(auditLogs);
  }, [serverStats, auditLogs]);

  // Unified pagination state
  const effectivePagination = useMemo(() => {
    if (pagination && typeof pagination === 'object') {
      const tot = pagination.total !== undefined ? pagination.total : (auditLogs ? auditLogs.length : 0);
      const lim = pagination.limit || pageSize;
      const curPage = pagination.page || page;
      const totPages = pagination.totalPages || Math.max(1, Math.ceil(tot / lim));
      return {
        page: curPage,
        limit: lim,
        total: tot,
        totalPages: totPages,
        hasNextPage: pagination.hasNextPage !== undefined ? Boolean(pagination.hasNextPage) : curPage < totPages,
        hasPrevPage: pagination.hasPrevPage !== undefined ? Boolean(pagination.hasPrevPage) : curPage > 1,
        currentPageCount: pagination.currentPageCount !== undefined ? pagination.currentPageCount : (auditLogs ? auditLogs.length : 0)
      };
    }
    const total = auditLogs ? auditLogs.length : 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      page,
      limit: pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      currentPageCount: total
    };
  }, [pagination, page, pageSize, auditLogs]);

  // Filtered Logs
  // When server-side onFetchLogs is available, server delivers pre-filtered records.
  // When running locally without onFetchLogs (fallback), performs full in-memory filter.
  const filteredLogs = useMemo(() => {
    if (onFetchLogs) {
      return auditLogs || [];
    }
    return (auditLogs || [])
      .filter(log => {
        if (activeFilter === 'all') return true;
        return getCategory(log).id === activeFilter;
      })
      .filter(log => {
        if (actorFilter === 'all') return true;
        const logRole = normalizeActorRole(log.actor_role || log.role);
        const filterRole = normalizeActorRole(actorFilter);
        return logRole === filterRole;
      })
      .filter(log => {
        if (restaurantFilter === 'all') return true;
        if (restaurantFilter === 'platform') return !log.restaurant_id;
        return String(log.restaurant_id) === String(restaurantFilter);
      })
      .filter(log => {
        if (!startDate) return true;
        const logTime = new Date(log.created_at || Date.now()).getTime();
        const start = new Date(startDate).getTime();
        return logTime >= start;
      })
      .filter(log => {
        if (!endDate) return true;
        const logTime = new Date(log.created_at || Date.now()).getTime();
        const end = new Date(`${endDate}T23:59:59.999Z`).getTime();
        return logTime <= end;
      })
      .filter(log => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const tenantInfo = resolveTenantDisplay(log, restaurants);
        const tenantName = (tenantInfo.name || '').toLowerCase();
        const tenantSlug = (tenantInfo.loadedTenant?.slug || '').toLowerCase();
        return (log.action || '').toLowerCase().includes(q) ||
          (log.details || '').toLowerCase().includes(q) ||
          (log.actor_role || '').toLowerCase().includes(q) ||
          String(log.restaurant_id || '').includes(q) ||
          tenantName.includes(q) ||
          tenantSlug.includes(q);
      });
  }, [auditLogs, onFetchLogs, activeFilter, actorFilter, restaurantFilter, startDate, endDate, searchQuery, restaurants]);

  // Debounced search query trigger (waits 300ms before server dispatch, skips initial mount)
  const isSearchMountedRef = useRef(false);
  useEffect(() => {
    if (!isSearchMountedRef.current) {
      isSearchMountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      if (onFetchLogs) {
        setPage(1);
        onFetchLogs({
          page: 1,
          limit: pageSize,
          category: activeFilter,
          actor: actorFilter,
          restaurant_id: restaurantFilter,
          start_date: startDate || null,
          end_date: endDate || null,
          search: searchQuery
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter Change Handlers (Server-side & Pagination-reset coordinated)
  const handleCategoryChange = (newCat) => {
    setActiveFilter(newCat);
    setPage(1);
    if (onFetchLogs) {
      onFetchLogs({
        page: 1,
        limit: pageSize,
        category: newCat,
        actor: actorFilter,
        restaurant_id: restaurantFilter,
        start_date: startDate || null,
        end_date: endDate || null,
        search: searchQuery
      });
    }
  };

  const handleActorChange = (e) => {
    const newActor = e.target.value;
    setActorFilter(newActor);
    setPage(1);
    if (onFetchLogs) {
      onFetchLogs({
        page: 1,
        limit: pageSize,
        category: activeFilter,
        actor: newActor,
        restaurant_id: restaurantFilter,
        start_date: startDate || null,
        end_date: endDate || null,
        search: searchQuery
      });
    }
  };

  const handleRestaurantChange = (e) => {
    const newResto = e.target.value;
    setRestaurantFilter(newResto);
    setPage(1);
    if (onFetchLogs) {
      onFetchLogs({
        page: 1,
        limit: pageSize,
        category: activeFilter,
        actor: actorFilter,
        restaurant_id: newResto,
        start_date: startDate || null,
        end_date: endDate || null,
        search: searchQuery
      });
    }
  };

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setPage(1);
    if (onFetchLogs) {
      onFetchLogs({
        page: 1,
        limit: pageSize,
        category: activeFilter,
        actor: actorFilter,
        restaurant_id: restaurantFilter,
        start_date: start || null,
        end_date: end || null,
        search: searchQuery
      });
    }
  };

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value) || 50;
    setPageSize(newSize);
    setPage(1);
    if (onFetchLogs) {
      onFetchLogs({
        page: 1,
        limit: newSize,
        category: activeFilter,
        actor: actorFilter,
        restaurant_id: restaurantFilter,
        start_date: startDate || null,
        end_date: endDate || null,
        search: searchQuery
      });
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > effectivePagination.totalPages || newPage === effectivePagination.page) return;
    setPage(newPage);
    if (onFetchLogs) {
      onFetchLogs({
        page: newPage,
        limit: pageSize,
        category: activeFilter,
        actor: actorFilter,
        restaurant_id: restaurantFilter,
        start_date: startDate || null,
        end_date: endDate || null,
        search: searchQuery
      });
    }
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh({
        page: effectivePagination.page,
        limit: pageSize,
        category: activeFilter,
        actor: actorFilter,
        restaurant_id: restaurantFilter,
        start_date: startDate || null,
        end_date: endDate || null,
        search: searchQuery
      });
    }
  };

  const handleClearFilters = () => {
    setActiveFilter('all');
    setActorFilter('all');
    setRestaurantFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setPage(1);
    if (onFetchLogs) {
      onFetchLogs({
        page: 1,
        limit: pageSize,
        category: 'all',
        actor: 'all',
        restaurant_id: 'all',
        start_date: null,
        end_date: null,
        search: ''
      });
    }
  };

  const hasActiveFilters = activeFilter !== 'all' ||
    actorFilter !== 'all' ||
    restaurantFilter !== 'all' ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(searchQuery.trim());

  // Current page boundary indices
  const startIdx = effectivePagination.total === 0 ? 0 : (effectivePagination.page - 1) * effectivePagination.limit + 1;
  const endIdx = effectivePagination.total === 0 ? 0 : Math.min(startIdx + (effectivePagination.currentPageCount || filteredLogs.length) - 1, effectivePagination.total);

  // Export audit logs as CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Actor Role', 'Category', 'Action', 'Restaurant ID', 'Restaurant Name', 'Details'];
    const rows = filteredLogs.map(log => {
      const tenantInfo = resolveTenantDisplay(log, restaurants);
      return [
        log.id,
        `"${new Date(log.created_at || Date.now()).toISOString()}"`,
        `"${log.actor_role || 'system'}"`,
        `"${getCategory(log).label}"`,
        `"${(log.action || '').replace(/"/g, '""')}"`,
        log.restaurant_id || 'System',
        `"${(tenantInfo.name || '').replace(/"/g, '""')}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`
      ];
    });

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

  // Reusable Pagination Bar
  const renderPaginationBar = () => {
    return (
      <div className="sa-audit-pagination-bar">
        <div className="sa-audit-pagination-info">
          <span>
            Showing <strong>{startIdx} – {endIdx}</strong> of <strong>{effectivePagination.total}</strong> records
          </span>
          <span className="sa-audit-pagination-badge">
            Page {effectivePagination.page} of {effectivePagination.totalPages}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            • {effectivePagination.currentPageCount || filteredLogs.length} on this page
          </span>
        </div>

        <div className="sa-audit-pagination-controls">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--sa-text-muted)', fontWeight: 700 }}>
            Rows:
            <select
              value={effectivePagination.limit}
              onChange={handlePageSizeChange}
              className="sa-audit-page-select"
              disabled={loading}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={loading || effectivePagination.page <= 1}
            className="sa-audit-page-btn"
            title="First Page"
          >
            <ChevronsLeft size={14} />
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(effectivePagination.page - 1)}
            disabled={loading || !effectivePagination.hasPrevPage}
            className="sa-audit-page-btn"
            title="Previous Page"
          >
            <ChevronLeft size={14} /> Prev
          </button>

          <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '0 4px', color: 'var(--sa-text-main)', fontVariantNumeric: 'tabular-nums' }}>
            {effectivePagination.page} / {effectivePagination.totalPages}
          </span>

          <button
            type="button"
            onClick={() => handlePageChange(effectivePagination.page + 1)}
            disabled={loading || !effectivePagination.hasNextPage}
            className="sa-audit-page-btn"
            title="Next Page"
          >
            Next <ChevronRight size={14} />
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(effectivePagination.totalPages)}
            disabled={loading || effectivePagination.page >= effectivePagination.totalPages}
            className="sa-audit-page-btn"
            title="Last Page"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  if (viewMode === 'archives') {
    return (
      <div className="sa-audit-container">
        <AuditArchivesView onBackToLive={() => setViewMode('live')} />
      </div>
    );
  }

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
                  background: error ? '#EF4444' : '#10B981', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  {error ? '● SYNC FAILED' : '● LIVE STREAM'}
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
              onClick={() => setViewMode('archives')}
              className="sa-btn"
              style={{
                background: 'rgba(212, 175, 55, 0.15)', color: '#DFBA67', border: '1px solid #D4AF37',
                fontSize: '0.74rem', fontWeight: 900, padding: '7px 12px', borderRadius: '10px', whiteSpace: 'nowrap',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
              }}
              title="Inspect Cloudflare R2 Cold Storage Archive Vault"
            >
              <Archive size={13} color="#DFBA67" /> Cold Vault
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="sa-btn"
              disabled={filteredLogs.length === 0}
              style={{
                background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)',
                fontSize: '0.74rem', fontWeight: 800, padding: '7px 12px', borderRadius: '10px', whiteSpace: 'nowrap',
                opacity: filteredLogs.length === 0 ? 0.5 : 1, cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Download size={13} /> Export CSV
            </button>

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={loading}
              className="sa-btn"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)',
                color: '#0A2315', border: 'none',
                fontSize: '0.74rem', fontWeight: 900, padding: '7px 12px', borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)', whiteSpace: 'nowrap',
                opacity: loading ? 0.8 : 1, cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} color="#0A2315" />
              {loading ? 'Refreshing...' : 'Refresh Trail'}
            </button>
          </div>
        </div>

        {/* 5 High-Impact Live Metric Cards (Platform Totals) */}
        <div className="sa-audit-hero-metrics">
          <div className="sa-audit-metric-tile" title="Total platform events recorded">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>PLATFORM TOTAL</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#34D399', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              📜 {stats.total} Events
            </div>
          </div>

          <div className="sa-audit-metric-tile" title="Total security and authentication events">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>SECURITY & ACCESS</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#C084FC', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              🔑 {stats.security} Events
            </div>
          </div>

          <div className="sa-audit-metric-tile" title="Total VIP, lifetime access, and administrative grants">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>VIP & GRANTS</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#FCD34D', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              ✨ {stats.vip} Events
            </div>
          </div>

          <div className="sa-audit-metric-tile" title="Total Cashfree webhooks, payments, and plan changes">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>BILLING & CASHFREE</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#6EE7B7', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              💳 {stats.billing} Events
            </div>
          </div>

          <div className="sa-audit-metric-tile" title="Total shop registrations, updates, and lifecycle operations">
            <div style={{ fontSize: '0.64rem', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>SHOP LIFECYCLE</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#93C5FD', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              🏪 {stats.tenant} Events
            </div>
          </div>
        </div>
      </div>

      {/* ⚠️ TOP ERROR ALERT BANNER */}
      {error && (
        <div
          className="sa-audit-error-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '14px',
            background: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            color: '#991B1B',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 260px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} color="#DC2626" />
            </div>
            <div>
              <strong style={{ fontSize: '0.86rem', display: 'block', color: '#991B1B', fontWeight: 900 }}>
                Audit Log Trail Sync Failed
              </strong>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#B91C1C', lineHeight: 1.35 }}>
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={loading}
            className="sa-btn"
            style={{
              background: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.76rem',
              padding: '8px 16px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} color="#FFFFFF" />
            {loading ? 'Retrying...' : 'Retry Connection'}
          </button>
        </div>
      )}

      {/* 🧭 2. FILTER PILLS STRIP, SEARCH, TENANT, DATE & ACTOR CONTROLS */}
      <div className="sa-audit-controls-strip">
        
        {/* Category Filter Pills Strip with Touch Overflow */}
        <div className="sa-filter-strip-wrapper">
          <div className="sa-filter-pills-strip">
            {[
              { id: 'all', label: `All (${stats.total})`, icon: FileText },
              { id: 'security', label: `Security (${stats.security})`, icon: Key },
              { id: 'tenant', label: `Shop (${stats.tenant})`, icon: Store },
              { id: 'billing', label: `Billing (${stats.billing})`, icon: CreditCard },
              { id: 'vip', label: `VIP & Grants (${stats.vip})`, icon: Sparkles },
              { id: 'system', label: `System (${stats.system})`, icon: Settings },
            ].map(pill => {
              const Icon = pill.icon;
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => handleCategoryChange(pill.id)}
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

        {/* Server-Side Filter Controls (Responsive Desktop row / Mobile stack) */}
        <div className="sa-audit-filter-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Tenant / Shop Selector */}
          <select
            value={restaurantFilter}
            onChange={handleRestaurantChange}
            className="sa-audit-actor-select"
            style={{ maxWidth: '170px' }}
            title="Filter by Shop / Tenant"
          >
            <option value="all">🏢 All Shops & System</option>
            <option value="platform">🌐 Platform Level (No Shop)</option>
            {restaurants && restaurants.map(r => (
              <option key={r.id} value={r.id}>
                🏢 {r.name} (#{r.id})
              </option>
            ))}
          </select>

          {/* Date Range Inputs */}
          <div className="sa-audit-date-inputs" title="Filter by Created Date Range">
            <Calendar size={13} color="#64748B" style={{ flexShrink: 0 }} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange(e.target.value, endDate)}
              placeholder="From Date"
              title="Start Date"
            />
            <span>–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange(startDate, e.target.value)}
              placeholder="To Date"
              title="End Date"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => handleDateChange('', '')}
                className="sa-audit-date-clear-btn"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Actor Role Filter */}
          <select
            value={actorFilter}
            onChange={handleActorChange}
            className="sa-audit-actor-select"
            title="Filter by Actor Role"
          >
            <option value="all">👥 All Actors</option>
            <option value="superadmin">👑 Super Admin</option>
            <option value="admin">🏢 Restaurant Admin</option>
            <option value="payment_gateway">💳 Cashfree Gateway</option>
            <option value="system">⚙️ System Engine</option>
          </select>

          {/* Full Text Search Input with Safe Padding & Alignment */}
          <div className="sa-audit-search-wrap" style={{ position: 'relative', width: '100%', minWidth: '220px', boxSizing: 'border-box', display: 'flex', alignItems: 'center' }}>
            <Search
              className="sa-audit-search-icon"
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: '#64748B',
                pointerEvents: 'none',
                zIndex: 2
              }}
            />
            <input
              type="text"
              className="sa-audit-search-input"
              placeholder="Search action, details, actor, tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                boxSizing: 'border-box',
                paddingLeft: '44px',
                paddingRight: '38px',
                paddingTop: 0,
                paddingBottom: 0,
                borderRadius: '12px',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.80rem',
                fontWeight: 600,
                color: '#0F172A',
                background: '#FFFFFF',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="sa-audit-search-clear-btn"
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
        {/* Stream Table Top Summary Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid var(--sa-border)',
          fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 700
        }}>
          <div>
            Showing <strong>{startIdx} – {endIdx}</strong> of <strong>{effectivePagination.total}</strong> records
            {hasActiveFilters && (
              <span style={{ marginLeft: '8px', color: '#D97706', fontWeight: 800 }}>
                • (Filtered View)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', background: '#E2E8F0', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, color: '#334155' }}>
              {effectivePagination.currentPageCount || filteredLogs.length} on current page
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--sa-border)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', width: '140px' }}>TIMESTAMP</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', width: '150px' }}>ACTOR / ROLE</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', width: '130px' }}>CATEGORY</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>EVENT / ACTION</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)' }}>DETAILS</th>
                <th style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--sa-text-muted)', textAlign: 'right', width: '90px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--sa-text-muted)' }}>
                    ⏳ Loading live append-only audit log stream...
                  </td>
                </tr>
              ) : error && filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px', background: '#FFF5F5' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <AlertTriangle size={36} color="#DC2626" />
                      <strong style={{ color: '#991B1B', fontSize: '0.94rem' }}>
                        Unable to Load Audit Log Stream
                      </strong>
                      <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.80rem', maxWidth: '440px', lineHeight: 1.4 }}>
                        {error}
                      </p>
                      <button
                        type="button"
                        onClick={handleRefreshClick}
                        className="sa-btn"
                        style={{
                          background: '#DC2626', color: '#FFFFFF', border: 'none',
                          fontWeight: 800, fontSize: '0.78rem', padding: '8px 18px', borderRadius: '10px',
                          display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginTop: '6px'
                        }}
                      >
                        <RefreshCw size={13} /> Retry Connection
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--sa-text-muted)' }}>
                    {!hasActiveFilters && effectivePagination.total === 0 ? (
                      <div>
                        <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '6px' }}>📜</span>
                        <strong>No platform audit log records found.</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '0.74rem' }}>All master operations and system transactions will appear here.</p>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '6px' }}>🔍</span>
                        <strong>No audit log entries matched your filter.</strong>
                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={handleClearFilters}
                            className="sa-btn sa-btn-secondary sa-btn-sm"
                            style={{ fontSize: '0.72rem', padding: '4px 10px', fontWeight: 800 }}
                          >
                            Reset All Filters
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const cat = getCategory(log);
                  const actor = getActorDetails(log.actor_role || log.role);
                  const tenantInfo = resolveTenantDisplay(log, restaurants);

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

                      {/* Event / Action & Restaurant Tenant */}
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--sa-text-main)', display: 'block' }}>
                          {log.action}
                        </strong>
                        {tenantInfo.name && (
                          tenantInfo.hasLink ? (
                            <span
                              onClick={() => setSelectedTenant360 && setSelectedTenant360(tenantInfo.loadedTenant)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#B48F27', fontWeight: 800, cursor: 'pointer', marginTop: '2px' }}
                              title="Open Shop 360° Profile"
                            >
                              🏢 {tenantInfo.name} <ArrowUpRight size={10} />
                            </span>
                          ) : (
                            <span
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#64748B', fontWeight: 700, marginTop: '2px' }}
                              title={log.restaurant_id ? `Shop #${log.restaurant_id}` : ''}
                            >
                              🏢 {tenantInfo.name}
                            </span>
                          )
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

        {/* Desktop Pagination Footer */}
        {renderPaginationBar()}
      </div>

      {/* 📋 3B. MOBILE AUDIT LOG CARDS (<= 767px) */}
      <div className="sa-audit-mobile-cards">
        {/* Stream Mobile Top Summary Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--sa-border)',
          fontSize: '0.74rem', color: 'var(--sa-text-muted)', fontWeight: 700
        }}>
          <div>
            Showing <strong>{startIdx} – {endIdx}</strong> of <strong>{effectivePagination.total}</strong>
          </div>
          <span style={{ fontSize: '0.70rem', background: '#E2E8F0', padding: '2px 7px', borderRadius: '6px', fontWeight: 800, color: '#334155' }}>
            Page {effectivePagination.page} / {effectivePagination.totalPages}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid var(--sa-border)', color: 'var(--sa-text-muted)', fontSize: '0.80rem' }}>
            ⏳ Loading live append-only audit log stream...
          </div>
        ) : error && filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: '#FFF5F5', borderRadius: '14px', border: '1.5px solid #FCA5A5' }}>
            <AlertTriangle size={32} color="#DC2626" style={{ margin: '0 auto 8px', display: 'block' }} />
            <strong style={{ display: 'block', color: '#991B1B', fontSize: '0.90rem' }}>
              Unable to Load Audit Logs
            </strong>
            <p style={{ margin: '6px 0 14px', color: '#B91C1C', fontSize: '0.78rem', lineHeight: 1.4 }}>
              {error}
            </p>
            <button
              type="button"
              onClick={handleRefreshClick}
              className="sa-btn"
              style={{
                background: '#DC2626', color: '#FFFFFF', border: 'none',
                fontWeight: 800, fontSize: '0.80rem', padding: '9px 20px', borderRadius: '10px',
                display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> Retry Connection
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid var(--sa-border)', color: 'var(--sa-text-muted)', fontSize: '0.80rem' }}>
            {!hasActiveFilters && effectivePagination.total === 0 ? (
              <div>
                <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '6px' }}>📜</span>
                <strong>No platform audit log records found.</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.74rem' }}>All master operations will appear here.</p>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '1.2rem', display: 'block', marginBottom: '6px' }}>🔍</span>
                <strong>No audit log entries matched your filter.</strong>
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', fontWeight: 800 }}
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          filteredLogs.map(log => {
            const cat = getCategory(log);
            const actor = getActorDetails(log.actor_role || log.role);
            const tenantInfo = resolveTenantDisplay(log, restaurants);

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
                  {tenantInfo.name && (
                    tenantInfo.hasLink ? (
                      <span
                        onClick={() => setSelectedTenant360 && setSelectedTenant360(tenantInfo.loadedTenant)}
                        className="sa-audit-tenant-link"
                        title="Open Shop 360° Profile"
                      >
                        🏢 {tenantInfo.name} <ArrowUpRight size={10} />
                      </span>
                    ) : (
                      <span
                        className="sa-audit-tenant-link"
                        style={{ cursor: 'default', color: '#64748B' }}
                      >
                        🏢 {tenantInfo.name}
                      </span>
                    )
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

        {/* Mobile Pagination Footer */}
        {renderPaginationBar()}
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
                    {(() => {
                      const modalTenant = resolveTenantDisplay(selectedEvent, restaurants);
                      if (modalTenant.name) {
                        return selectedEvent.restaurant_id
                          ? `${modalTenant.name} (Shop #${selectedEvent.restaurant_id})`
                          : modalTenant.name;
                      }
                      return selectedEvent.restaurant_id ? `Shop ID #${selectedEvent.restaurant_id}` : 'Platform Level / System';
                    })()}
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
