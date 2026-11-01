import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Search, RefreshCw, Download, Store, AlertCircle, CheckCircle2,
  Clock, ShieldCheck, UserCheck, Send, X, ExternalLink, ArrowRight,
  Filter, ChevronLeft, ChevronRight, AlertTriangle, Phone, PhoneCall,
  Check, Lock, RotateCcw, Zap, Sparkles
} from 'lucide-react';
import {
  fetchSuperAdminSupportTickets,
  fetchSuperAdminSupportTicketDetails,
  updateSuperAdminSupportTicket,
  addSuperAdminSupportTicketReply,
  fetchSuperAdminSupportOperators
} from '../../../api/client';
import { BUSINESS_TYPE_METADATA } from '../../../utils/businessTaxonomy';
import Drawer from '../components/Drawer';
import SearchBar from '../components/SearchBar';

export default function SupportTicketsView({ token, setSelectedTenant360, onImpersonate, restaurants = [] }) {
  // Token resilience: fallback to localStorage if token prop is temporarily delayed
  const authToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('touchqr_superadmin_token') || localStorage.getItem('token') || localStorage.getItem('saas_super_token') || sessionStorage.getItem('touchqr_superadmin_token')) : null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [businessTypeFilter, setBusinessTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    businessTypeFilter !== 'all'
  );

  const handleResetFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setBusinessTypeFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  // Data & Telemetry
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState({ open: 0, in_progress: 0, waiting_on_tenant: 0, urgent: 0, resolved: 0, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operators, setOperators] = useState([]);
  const [lastSyncedAt, setLastSyncedAt] = useState(new Date());

  // Detail Drawer & Conversation Thread
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeTicketData, setActiveTicketData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Editable controls inside drawer
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignedId, setEditAssignedId] = useState('');
  const [updatingTicket, setUpdatingTicket] = useState(false);

  // Quick Canned Response Templates
    // Export tickets to CSV
  const handleExportTicketsCsv = () => {
    if (!tickets || tickets.length === 0) {
      alert('No tickets available to export.');
      return;
    }

    const headers = ['Ticket Ref', 'Business Name', 'Slug', 'Vertical', 'Category', 'Subject', 'Priority', 'Status', 'Assigned Operator', 'Created At', 'Updated At'];
    const rows = tickets.map(t => [
      t.ticket_ref,
      `"${(t.restaurant_name || '').replace(/"/g, '""')}"`,
      t.restaurant_slug,
      t.business_type || 'restaurant',
      t.category,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      t.priority,
      t.status,
      t.assigned_operator_username || 'Unassigned',
      t.created_at ? new Date(t.created_at).toISOString() : '',
      t.updated_at ? new Date(t.updated_at).toISOString() : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `touchqr_support_tickets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cannedResponses = [
    { label: '🔍 Investigating', text: 'We are currently investigating this issue and will update you with full details shortly.' },
    { label: '📺 KDS Synced', text: 'KDS realtime connection and session tokens have been refreshed. Please reload your kitchen display.' },
    { label: '🖨️ Printer Check', text: 'Thermal printer configuration and ESC/POS baud rates have been synchronized. Please print a test slip.' },
    { label: '💳 Mandate Verified', text: 'Your Cashfree subscription mandate and platform entitlements have been verified and restored.' },
    { label: '✅ Issue Resolved', text: 'This inquiry has been verified and resolved. Please let us know if you need any additional assistance!' }
  ];

  // Load eligible operators on mount
  useEffect(() => {
    if (!authToken) return;
    fetchSuperAdminSupportOperators(authToken)
      .then(res => setOperators(res.operators || []))
      .catch(err => console.warn('Could not load support operators:', err.message));
  }, [authToken]);

  // Load tickets list
  const loadTickets = async (targetPage = page, silent = false) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetchSuperAdminSupportTickets(authToken, {
        search: searchQuery.trim(),
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        business_type: businessTypeFilter === 'all' ? '' : businessTypeFilter,
        page: targetPage,
        limit
      });
      setTickets(res.tickets || []);
      setMetrics(res.metrics || { open: 0, in_progress: 0, waiting_on_tenant: 0, urgent: 0, resolved: 0, total: 0 });
      setPagination(res.pagination || { page: targetPage, limit, total: 0, totalPages: 1 });
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Error fetching support tickets:', err);
      if (!silent) setError(err.message || 'Failed to load support tickets');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets(page);
  }, [authToken, page, statusFilter, priorityFilter, categoryFilter, businessTypeFilter]);

  const isSearchMountedRef = useRef(false);

  // Handle search with debounce (skips redundant initial mount fetch)
  useEffect(() => {
    if (!isSearchMountedRef.current) {
      isSearchMountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      loadTickets(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-sync every 35s when drawer is closed + focus re-fetch
  useEffect(() => {
    if (!authToken) return;
    const interval = setInterval(() => {
      if (!selectedTicketId) {
        loadTickets(page, true);
      }
    }, 35000);

    const onFocus = () => {
      loadTickets(page, true);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [authToken, page, selectedTicketId, statusFilter, priorityFilter, categoryFilter, businessTypeFilter]);

  // Load active ticket detail
  const loadTicketDetail = async (id, silent = false) => {
    if (!id || !authToken) return;
    if (!silent) setLoadingDetail(true);
    setDetailError('');
    setActionSuccess('');
    try {
      const res = await fetchSuperAdminSupportTicketDetails(id, authToken);
      setActiveTicketData(res);
      if (res?.ticket) {
        setEditStatus(res.ticket.status || 'open');
        setEditPriority(res.ticket.priority || 'medium');
        const assignedVal = res.ticket.assigned_to || res.ticket.assigned_to_admin_id;
        setEditAssignedId(assignedVal ? String(assignedVal) : '');
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      if (!silent) setDetailError(err.message || 'Failed to load ticket conversation');
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    } else {
      setActiveTicketData(null);
    }
  }, [selectedTicketId, authToken]);

  // Update status / priority / assignment
  const handleUpdateTicketMeta = async (fields) => {
    if (!selectedTicketId || !authToken) return;
    setUpdatingTicket(true);
    setDetailError('');
    setActionSuccess('');
    try {
      const res = await updateSuperAdminSupportTicket(selectedTicketId, fields, authToken);
      if (res?.ticket) {
        setActiveTicketData(prev => ({ ...prev, ticket: res.ticket }));
        setEditStatus(res.ticket.status);
        setEditPriority(res.ticket.priority);
        const assignedVal = res.ticket.assigned_to || res.ticket.assigned_to_admin_id;
        setEditAssignedId(assignedVal ? String(assignedVal) : '');
        setActionSuccess('✓ Ticket updated successfully');
        setTimeout(() => setActionSuccess(''), 4000);
        // Refresh background tickets list
        loadTickets(page, true);
      }
    } catch (err) {
      setDetailError(err.message || 'Failed to update ticket');
    } finally {
      setUpdatingTicket(false);
    }
  };

  // Post Super Admin reply
  const handleSendAdminReply = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!replyText.trim() || !selectedTicketId || !authToken) return;
    setReplying(true);
    setDetailError('');
    setActionSuccess('');
    try {
      const res = await addSuperAdminSupportTicketReply(selectedTicketId, { message: replyText.trim() }, authToken);
      if (res?.message) {
        setActiveTicketData(prev => ({
          ...prev,
          ticket: { ...prev.ticket, status: res.ticket_status },
          messages: [...(prev.messages || []), res.message]
        }));
        setEditStatus(res.ticket_status);
        setReplyText('');
        setActionSuccess('✓ Reply posted and ticket status moved to Waiting on Tenant');
        setTimeout(() => setActionSuccess(''), 4000);
        loadTickets(page, true);
      }
    } catch (err) {
      setDetailError(err.message || 'Failed to post reply');
    } finally {
      setReplying(false);
    }
  };

  const statusConfig = {
    open: { label: 'Open', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
    in_progress: { label: 'In Progress', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
    waiting_on_tenant: { label: 'Waiting on Tenant', bg: '#F3E8FF', color: '#7E22CE', border: '#DDD6FE' },
    resolved: { label: 'Resolved', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
    closed: { label: 'Closed', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' }
  };

  const priorityConfig = {
    urgent: { label: '🚨 URGENT', bg: '#FEE2E2', color: '#DC2626' },
    high: { label: '⚡ High', bg: '#FFEDD5', color: '#EA580C' },
    medium: { label: 'Normal', bg: '#F1F5F9', color: '#475569' },
    low: { label: 'Low', bg: '#F8FAFC', color: '#94A3B8' }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Scoped CSS for Spin Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animate {
          animation: spin 1s linear infinite;
        }
        .support-kpi-card {
          cursor: pointer;
          transition: all 0.18s ease;
          user-select: none;
        }
        .support-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
      `}</style>

      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 2px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={22} color="var(--sa-primary)" />
            <span>Support Ticket Command Center</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
              Triaging tenant inquiries, hardware setups, billing escalations, and official operator replies.
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
              Auto-Sync Active (35s)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportTicketsCsv}
            className="sa-btn sa-btn-secondary sa-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
            title="Export filtered tickets to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => loadTickets(page)}
            className="sa-btn sa-btn-secondary sa-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
            disabled={loading}
            title="Refresh tickets from server"
          >
            <RefreshCw size={14} className={loading ? 'spin-animate' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive KPI Telemetry Cards (Clickable Filter Shortcuts) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        {/* Open */}
        <div
          onClick={() => {
            setStatusFilter(prev => prev === 'open' ? 'all' : 'open');
            setPriorityFilter('all');
            setPage(1);
          }}
          className="support-kpi-card"
          style={{
            background: '#FFFFFF',
            padding: '14px 16px',
            borderRadius: '16px',
            border: statusFilter === 'open' ? '2px solid #2563EB' : '1px solid var(--sa-border)',
            boxShadow: statusFilter === 'open' ? '0 0 0 3px rgba(37,99,235,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ● Open Tickets
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.open || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Awaiting initial triage</span>
        </div>

        {/* In Progress */}
        <div
          onClick={() => {
            setStatusFilter(prev => prev === 'in_progress' ? 'all' : 'in_progress');
            setPriorityFilter('all');
            setPage(1);
          }}
          className="support-kpi-card"
          style={{
            background: '#FFFFFF',
            padding: '14px 16px',
            borderRadius: '16px',
            border: statusFilter === 'in_progress' ? '2px solid #D97706' : '1px solid var(--sa-border)',
            boxShadow: statusFilter === 'in_progress' ? '0 0 0 3px rgba(217,119,6,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ● In Progress
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.in_progress || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Under active investigation</span>
        </div>

        {/* Waiting on Tenant */}
        <div
          onClick={() => {
            setStatusFilter(prev => prev === 'waiting_on_tenant' ? 'all' : 'waiting_on_tenant');
            setPriorityFilter('all');
            setPage(1);
          }}
          className="support-kpi-card"
          style={{
            background: '#FFFFFF',
            padding: '14px 16px',
            borderRadius: '16px',
            border: statusFilter === 'waiting_on_tenant' ? '2px solid #7E22CE' : '1px solid var(--sa-border)',
            boxShadow: statusFilter === 'waiting_on_tenant' ? '0 0 0 3px rgba(126,34,206,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7E22CE', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ● Waiting on Tenant
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.waiting_on_tenant || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Pending client feedback</span>
        </div>

        {/* Urgent */}
        <div
          onClick={() => {
            setPriorityFilter(prev => prev === 'urgent' ? 'all' : 'urgent');
            setStatusFilter('all');
            setPage(1);
          }}
          className="support-kpi-card"
          style={{
            background: '#FFFFFF',
            padding: '14px 16px',
            borderRadius: '16px',
            border: priorityFilter === 'urgent' ? '2px solid #DC2626' : '1px solid #FECACA',
            boxShadow: priorityFilter === 'urgent' ? '0 0 0 3px rgba(220,38,38,0.2)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🚨 Urgent Tickets
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#DC2626', marginTop: '4px' }}>
            {metrics.urgent || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#991B1B' }}>High priority incidents</span>
        </div>

        {/* Resolved / Total */}
        <div
          onClick={() => {
            setStatusFilter(prev => prev === 'resolved' ? 'all' : 'resolved');
            setPriorityFilter('all');
            setPage(1);
          }}
          className="support-kpi-card"
          style={{
            background: '#FFFFFF',
            padding: '14px 16px',
            borderRadius: '16px',
            border: statusFilter === 'resolved' ? '2px solid #059669' : '1px solid var(--sa-border)',
            boxShadow: statusFilter === 'resolved' ? '0 0 0 3px rgba(5,150,105,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ✓ Resolved / Total
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.resolved || 0} <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>/ {metrics.total || 0}</span>
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Closed inquiries</span>
        </div>
      </div>

      {/* 3. Filter Bar & Search Toolbar */}
      <div className="sa-tickets-toolbar">
        {/* Tier 1: Search Bar & Live Telemetry Count */}
        <div className="sa-tickets-toolbar-top">
          <div className="sa-tickets-search-wrap">
            <SearchBar
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search by ticket #ID, subject, shop name, or slug..."
              width="100%"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--sa-text-muted, #64748B)',
              background: 'var(--sa-surface-subtle, #F1F5F9)',
              padding: '6px 14px',
              borderRadius: 'var(--sa-radius-full, 9999px)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>Showing <strong>{tickets.length}</strong> of <strong>{pagination.total || 0}</strong> tickets</span>
              {loading && <RefreshCw size={12} className="spin-animate" color="var(--sa-accent, #D4AF37)" />}
            </span>

            <button
              type="button"
              onClick={() => loadTickets(page)}
              disabled={loading}
              title="Refresh tickets list"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid var(--sa-border, #E2E8F0)',
                background: 'var(--sa-surface, #FFFFFF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'var(--sa-text-muted, #64748B)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sa-primary, #0A2315)'; e.currentTarget.style.borderColor = 'var(--sa-accent, #D4AF37)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sa-text-muted, #64748B)'; e.currentTarget.style.borderColor = 'var(--sa-border, #E2E8F0)'; }}
            >
              <RefreshCw size={13} className={loading ? 'spin-animate' : ''} />
            </button>
          </div>
        </div>

        {/* Tier 2: Filter Controls Ribbon */}
        <div className="sa-tickets-toolbar-filters">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="sa-tickets-filter-select"
            aria-label="Filter by Status"
          >
            <option value="all">All Statuses</option>
            <option value="open">● Open</option>
            <option value="in_progress">● In Progress</option>
            <option value="waiting_on_tenant">● Waiting on Tenant</option>
            <option value="resolved">● Resolved</option>
            <option value="closed">● Closed</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="sa-tickets-filter-select"
            aria-label="Filter by Priority"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">🚨 Urgent</option>
            <option value="high">⚡ High</option>
            <option value="medium">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Vertical / Industry Filter */}
          <select
            value={businessTypeFilter}
            onChange={(e) => { setBusinessTypeFilter(e.target.value); setPage(1); }}
            className="sa-tickets-filter-select"
            aria-label="Filter by Vertical"
          >
            <option value="all">🏢 All Verticals</option>
            <option value="restaurant">🍽️ Restaurants & Cafes</option>
            <option value="hotel">🏨 Hotels & Stays</option>
            <option value="cinema">🍿 Cinema Theatres</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="sa-tickets-filter-select"
            aria-label="Filter by Category"
          >
            <option value="all">📂 All Categories</option>
            <option value="orders">Orders & POS</option>
            <option value="menu">Menu & Dishes</option>
            <option value="qr">QR Standees & Spaces</option>
            <option value="kds">Kitchen Display (KDS)</option>
            <option value="billing">Billing & Mandate</option>
            <option value="printer">Thermal Printers & Hardware</option>
            <option value="analytics">Sales & Analytics</option>
            <option value="settings">Settings & Branding</option>
            <option value="other">General / Account</option>
          </select>

          {/* Reset Filters Shortcut */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="sa-tickets-reset-btn"
              title="Reset all search queries and active filters"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Tier 3: Active Filter Chips */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--sa-text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active:
            </span>
            {searchQuery.trim() && (
              <span className="sa-ticket-chip" style={{ background: 'rgba(212, 175, 55, 0.12)', borderColor: 'rgba(212, 175, 55, 0.35)', color: '#854D0E' }}>
                <Search size={10} />
                <span>"{searchQuery.trim()}"</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search keyword"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="sa-ticket-chip">
                <span>Status: {statusFilter.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('all'); setPage(1); }}
                  aria-label="Clear status filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {priorityFilter !== 'all' && (
              <span className="sa-ticket-chip" style={{
                background: priorityFilter === 'urgent' ? '#FEE2E2' : 'var(--sa-surface-subtle)',
                borderColor: priorityFilter === 'urgent' ? '#FECACA' : 'var(--sa-border)',
                color: priorityFilter === 'urgent' ? '#DC2626' : 'var(--sa-text-main)'
              }}>
                <span>Priority: {priorityFilter}</span>
                <button
                  type="button"
                  onClick={() => { setPriorityFilter('all'); setPage(1); }}
                  aria-label="Clear priority filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {businessTypeFilter !== 'all' && (
              <span className="sa-ticket-chip">
                <span>Vertical: {businessTypeFilter}</span>
                <button
                  type="button"
                  onClick={() => { setBusinessTypeFilter('all'); setPage(1); }}
                  aria-label="Clear vertical filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="sa-ticket-chip">
                <span>Category: {categoryFilter}</span>
                <button
                  type="button"
                  onClick={() => { setCategoryFilter('all'); setPage(1); }}
                  aria-label="Clear category filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', fontSize: '0.80rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Table of Tickets */}
      <div className="sa-table-container sa-responsive-table" style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--sa-border)', overflow: 'hidden' }}>
        <table className="sa-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>TICKET REF</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>BUSINESS NAME</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>SUBJECT & CATEGORY</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>PRIORITY</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>STATUS</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>ASSIGNED TO</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.70rem', color: '#64748B', fontWeight: 800 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading && tickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '0.82rem' }}>
                  <RefreshCw size={18} className="spin-animate" style={{ marginBottom: '8px' }} />
                  <div>Loading support tickets...</div>
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: '#64748B' }}>
                  <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'var(--sa-surface-subtle, #F1F5F9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '4px'
                    }}>
                      <Search size={22} color="var(--sa-text-muted, #94A3B8)" />
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--sa-text-main, #0F172A)' }}>
                      No support tickets found
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', lineHeight: 1.4 }}>
                      {searchQuery.trim()
                        ? `No tickets match "${searchQuery.trim()}". Try searching with a different ticket #ID, shop name, or clear active filters.`
                        : 'No support tickets match the selected status or category filters.'}
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        style={{
                          marginTop: '8px',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--sa-border, #E2E8F0)',
                          background: 'var(--sa-surface, #FFFFFF)',
                          color: 'var(--sa-primary, #0A2315)',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>Clear Search & Filters</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              tickets.map(t => {
                const st = statusConfig[t.status] || statusConfig.open;
                const pr = priorityConfig[t.priority] || priorityConfig.medium;
                const bizMeta = BUSINESS_TYPE_METADATA[t.business_type] || { icon: '🏢', label: t.business_type || 'Restaurant' };
                const assignedName = t.assigned_operator_username || t.assigned_to_name;
                const isUrgent = t.priority === 'urgent';

                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    style={{
                      cursor: 'pointer',
                      borderTop: '1px solid #F1F5F9',
                      transition: 'background 0.15s ease',
                      background: isUrgent && t.status !== 'resolved' && t.status !== 'closed' ? '#FFF5F5' : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAF8F5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isUrgent && t.status !== 'resolved' && t.status !== 'closed' ? '#FFF5F5' : 'transparent'}
                  >
                    {/* Ticket Ref */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.78rem', color: '#0F172A' }}>
                        #{t.ticket_ref}
                      </span>
                      <div style={{ fontSize: '0.66rem', color: '#94A3B8', marginTop: '2px' }}>
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>

                    {/* Business Name & Slug */}
                    <td style={{ padding: '14px 16px' }}>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--sa-text-main)', display: 'block' }}>
                        {t.restaurant_name || `Tenant #${t.restaurant_id}`}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.68rem', color: '#64748B' }}>/{t.restaurant_slug || 'shop'}</span>
                        <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: '4px', background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>
                          {bizMeta.icon} {bizMeta.label}
                        </span>
                      </div>
                    </td>

                    {/* Subject & Category */}
                    <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.subject}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', textTransform: 'capitalize' }}>
                        📂 {t.category}
                      </span>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: pr.bg,
                        color: pr.color,
                        boxShadow: isUrgent ? '0 1px 3px rgba(220,38,38,0.25)' : 'none'
                      }}>
                        {pr.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: st.bg,
                        color: st.color,
                        border: `1px solid ${st.border}`
                      }}>
                        {st.label}
                      </span>
                    </td>

                    {/* Assigned To */}
                    <td style={{ padding: '14px 16px', fontSize: '0.76rem', color: '#475569', fontWeight: 600 }}>
                      {assignedName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={13} color="#059669" />
                          <span style={{ fontWeight: 800, color: '#065F46' }}>{assignedName}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicketId(t.id);
                        }}
                        className="sa-btn sa-btn-secondary sa-btn-sm"
                        style={{ padding: '6px 12px', fontSize: '0.74rem', fontWeight: 800 }}
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--sa-border)' }}>
          <span style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 700 }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total tickets)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="sa-btn sa-btn-secondary sa-btn-sm"
              style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="sa-btn sa-btn-secondary sa-btn-sm"
              style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 800 }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 6. Ticket Detail & Thread Drawer */}
      <Drawer
        isOpen={Boolean(selectedTicketId)}
        onClose={() => {
          setSelectedTicketId(null);
          setActiveTicketData(null);
        }}
        title={`Ticket #${activeTicketData?.ticket?.ticket_ref || selectedTicketId}`}
        subtitle={activeTicketData?.ticket?.subject || 'Support Ticket Thread'}
        width="700px"
      >
        {loadingDetail && !activeTicketData ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
            <RefreshCw size={20} className="spin-animate" style={{ marginBottom: '8px' }} />
            <div>Loading full ticket conversation & audit records...</div>
          </div>
        ) : activeTicketData?.ticket ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Action Feedback */}
            {actionSuccess && (
              <div style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800 }}>
                {actionSuccess}
              </div>
            )}
            {detailError && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 800 }}>
                ⚠️ {detailError}
              </div>
            )}

            {/* Tenant Identity & Quick WhatsApp Outreach Strip */}
            <div style={{
              background: '#FAF8F5',
              padding: '14px 16px',
              borderRadius: '14px',
              border: '1px solid #EAE5DF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.90rem', color: '#0F172A' }}>
                    {activeTicketData.ticket.restaurant_name}
                  </strong>
                  {activeTicketData.ticket.business_type && (
                    <span style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', background: '#E2E8F0', color: '#334155', fontWeight: 700 }}>
                      {BUSINESS_TYPE_METADATA[activeTicketData.ticket.business_type]?.icon || '🏢'} {BUSINESS_TYPE_METADATA[activeTicketData.ticket.business_type]?.label || activeTicketData.ticket.business_type}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                  /{activeTicketData.ticket.restaurant_slug} · Category: <span style={{ textTransform: 'capitalize', fontWeight: 700, color: '#334155' }}>{activeTicketData.ticket.category}</span>
                </span>
                <span style={{ fontSize: '0.66rem', color: '#94A3B8' }}>
                  Created: {new Date(activeTicketData.ticket.created_at).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Direct Tenant Outreach Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {setSelectedTenant360 && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetResto = (restaurants || []).find(r => r.id === activeTicketData.ticket.restaurant_id) || {
                        id: activeTicketData.ticket.restaurant_id,
                        name: activeTicketData.ticket.restaurant_name,
                        slug: activeTicketData.ticket.restaurant_slug,
                        phone: activeTicketData.ticket.restaurant_phone,
                        business_type: activeTicketData.ticket.business_type
                      };
                      setSelectedTenant360(targetResto);
                    }}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '6px 10px', fontWeight: 800 }}
                    title="Open complete Tenant 360 profile"
                  >
                    <Store size={13} color="#D4AF37" />
                    <span>Tenant 360</span>
                  </button>
                )}
                {onImpersonate && (
                  <button
                    type="button"
                    onClick={() => onImpersonate(activeTicketData.ticket.restaurant_id)}
                    className="sa-btn sa-btn-secondary sa-btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', padding: '6px 10px', fontWeight: 800 }}
                    title="Impersonate & test tenant menu/dashboard"
                  >
                    <UserCheck size={13} color="#6366F1" />
                    <span>Impersonate</span>
                  </button>
                )}
                {activeTicketData.ticket.restaurant_phone ? (
                  <>
                    <a
                      href={`https://wa.me/${activeTicketData.ticket.restaurant_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${activeTicketData.ticket.restaurant_name}, regarding your TouchQR Support Ticket #${activeTicketData.ticket.ticket_ref} ('${activeTicketData.ticket.subject}'):
`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: '#25D366',
                        color: '#FFFFFF',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        boxShadow: '0 1px 3px rgba(37,211,102,0.3)'
                      }}
                    >
                      <span>💬 WhatsApp Tenant</span>
                    </a>
                    <a
                      href={`tel:${activeTicketData.ticket.restaurant_phone.replace(/[^0-9+]/g, '')}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: '#334155',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textDecoration: 'none'
                      }}
                    >
                      <Phone size={12} color="#475569" />
                      <span>{activeTicketData.ticket.restaurant_phone}</span>
                    </a>
                  </>
                ) : (
                  <span style={{ fontSize: '0.70rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    No phone recorded
                  </span>
                )}
              </div>
            </div>

            {/* Support Controls: Status, Priority & Assignment */}
            <div style={{
              background: '#FFFFFF',
              padding: '14px',
              borderRadius: '14px',
              border: '1px solid var(--sa-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px'
            }}>
              {/* Status Selector */}
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  STATUS
                </label>
                <select
                  value={editStatus}
                  disabled={updatingTicket}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setEditStatus(newStatus);
                    handleUpdateTicketMeta({ status: newStatus });
                  }}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 8px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: '#FAF8F5'
                  }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_on_tenant">Waiting on Tenant</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Priority Selector */}
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  PRIORITY
                </label>
                <select
                  value={editPriority}
                  disabled={updatingTicket}
                  onChange={(e) => {
                    const newPriority = e.target.value;
                    setEditPriority(newPriority);
                    handleUpdateTicketMeta({ priority: newPriority });
                  }}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 8px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: '#FAF8F5'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>
              </div>

              {/* Assigned Operator Selector */}
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                  ASSIGNED OPERATOR
                </label>
                <select
                  value={editAssignedId}
                  disabled={updatingTicket}
                  onChange={(e) => {
                    const targetVal = e.target.value ? Number(e.target.value) : null;
                    setEditAssignedId(e.target.value);
                    handleUpdateTicketMeta({ assigned_to: targetVal });
                  }}
                  style={{
                    width: '100%',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 8px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: '#FAF8F5'
                  }}
                >
                  <option value="">Unassigned</option>
                  {operators.map(op => (
                    <option key={op.id} value={op.id}>
                      👑 {op.username} ({op.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick 1-Click Ticket Resolution Shortcuts */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '10px 14px',
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#475569' }}>
                Quick Triage Actions:
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {activeTicketData.ticket.status !== 'resolved' && (
                  <button
                    type="button"
                    disabled={updatingTicket}
                    onClick={() => handleUpdateTicketMeta({ status: 'resolved' })}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      color: '#059669',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Check size={12} /> Mark Resolved
                  </button>
                )}

                {activeTicketData.ticket.status !== 'closed' && (
                  <button
                    type="button"
                    disabled={updatingTicket}
                    onClick={() => handleUpdateTicketMeta({ status: 'closed' })}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Lock size={12} /> Close Ticket
                  </button>
                )}

                {(activeTicketData.ticket.status === 'resolved' || activeTicketData.ticket.status === 'closed') && (
                  <button
                    type="button"
                    disabled={updatingTicket}
                    onClick={() => handleUpdateTicketMeta({ status: 'in_progress' })}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      color: '#D97706',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RotateCcw size={12} /> Reopen Ticket
                  </button>
                )}
              </div>
            </div>

            {/* Message Thread History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Conversation History ({activeTicketData.messages?.length || 0} messages)
                </span>
                <button
                  type="button"
                  onClick={() => loadTicketDetail(selectedTicketId, true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.68rem',
                    color: '#64748B',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={11} className={loadingDetail ? 'spin-animate' : ''} />
                  <span>Sync Thread</span>
                </button>
              </div>

              <div style={{
                maxHeight: '380px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                background: '#FAF8F5',
                borderRadius: '14px',
                border: '1px solid #EAE5DF'
              }}>
                {activeTicketData.messages?.map(msg => {
                  const isTenant = msg.sender_type === 'tenant';
                  const isSuperAdmin = msg.sender_type === 'superadmin';

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isSuperAdmin ? 'flex-end' : 'flex-start',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        maxWidth: '85%',
                        padding: '12px 14px',
                        borderRadius: isSuperAdmin ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isSuperAdmin ? '#0A2315' : '#FFFFFF',
                        color: isSuperAdmin ? '#FFFFFF' : '#0F172A',
                        border: isSuperAdmin ? '1px solid #D4AF37' : '1px solid #E2E8F0',
                        fontSize: '0.80rem',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        <div style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          marginBottom: '4px',
                          color: isSuperAdmin ? '#DFBA67' : '#059669',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {isSuperAdmin ? (
                            <>
                              <ShieldCheck size={12} color="#DFBA67" />
                              <span>TouchQR Support Desk ({msg.sender_id ? `Admin #${msg.sender_id}` : 'Official'})</span>
                            </>
                          ) : (
                            <span>Business Client ({activeTicketData.ticket.restaurant_name})</span>
                          )}
                        </div>
                        {msg.message}
                      </div>
                      <span style={{ fontSize: '0.64rem', color: '#94A3B8', marginTop: '3px', padding: '0 4px' }}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Official Support Reply Composer */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid var(--sa-border)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {activeTicketData.ticket.status === 'closed' ? (
                <div style={{ padding: '12px', background: '#F1F5F9', borderRadius: '10px', color: '#64748B', fontSize: '0.78rem', textAlign: 'center', fontWeight: 700 }}>
                  🔒 This ticket is marked as CLOSED. Reopen the ticket by setting Status to 'Open' or 'In Progress' above to send further replies.
                </div>
              ) : (
                <form onSubmit={handleSendAdminReply} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569' }}>
                      Post Official Response (Visible to Tenant)
                    </label>
                    <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                      {replyText.length} characters
                    </span>
                  </div>

                  {/* 1-Click Canned Response Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {cannedResponses.map((cr, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReplyText(prev => prev ? `${prev}\n${cr.text}` : cr.text)}
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          background: '#F8FAFC',
                          color: '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        {cr.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type official support reply, troubleshooting instructions, or resolution notes..."
                    rows={3}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      padding: '10px 12px',
                      fontSize: '0.80rem',
                      color: '#0F172A',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                      Posting an answer automatically updates status to "Waiting on Tenant".
                    </span>
                    <button
                      type="submit"
                      disabled={replying || !replyText.trim()}
                      className="sa-btn sa-btn-accent sa-btn-sm"
                      style={{ padding: '8px 16px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {replying ? <RefreshCw size={14} className="spin-animate" /> : <Send size={14} />}
                      <span>Send Official Reply</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
