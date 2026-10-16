import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Search, RefreshCw, AlertCircle, CheckCircle2,
  Clock, ShieldCheck, UserCheck, Send, X, ExternalLink, ArrowRight,
  Filter, ChevronLeft, ChevronRight, AlertTriangle
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

export default function SupportTicketsView({ token }) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Data & Telemetry
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState({ open: 0, in_progress: 0, waiting_on_tenant: 0, urgent: 0, resolved: 0, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [operators, setOperators] = useState([]);

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

  // Load eligible operators on mount
  useEffect(() => {
    if (!token) return;
    fetchSuperAdminSupportOperators(token)
      .then(res => setOperators(res.operators || []))
      .catch(err => console.warn('Could not load support operators:', err.message));
  }, [token]);

  // Load tickets list
  const loadTickets = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchSuperAdminSupportTickets(token, {
        search: searchQuery.trim(),
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
        page: targetPage,
        limit
      });
      setTickets(res.tickets || []);
      setMetrics(res.metrics || { open: 0, in_progress: 0, waiting_on_tenant: 0, urgent: 0, resolved: 0, total: 0 });
      setPagination(res.pagination || { page: targetPage, limit, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching support tickets:', err);
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets(page);
  }, [token, page, statusFilter, priorityFilter, categoryFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadTickets(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load active ticket detail
  const loadTicketDetail = async (id) => {
    if (!id || !token) return;
    setLoadingDetail(true);
    setDetailError('');
    setActionSuccess('');
    try {
      const res = await fetchSuperAdminSupportTicketDetails(id, token);
      setActiveTicketData(res);
      if (res?.ticket) {
        setEditStatus(res.ticket.status || 'open');
        setEditPriority(res.ticket.priority || 'medium');
        setEditAssignedId(res.ticket.assigned_to ? String(res.ticket.assigned_to) : '');
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      setDetailError(err.message || 'Failed to load ticket conversation');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    } else {
      setActiveTicketData(null);
    }
  }, [selectedTicketId]);

  // Update status / priority / assignment
  const handleUpdateTicketMeta = async (fields) => {
    if (!selectedTicketId || !token) return;
    setUpdatingTicket(true);
    setDetailError('');
    setActionSuccess('');
    try {
      const res = await updateSuperAdminSupportTicket(selectedTicketId, fields, token);
      if (res?.ticket) {
        setActiveTicketData(prev => ({ ...prev, ticket: res.ticket }));
        setEditStatus(res.ticket.status);
        setEditPriority(res.ticket.priority);
        setEditAssignedId(res.ticket.assigned_to ? String(res.ticket.assigned_to) : '');
        setActionSuccess('✓ Ticket updated successfully');
        setTimeout(() => setActionSuccess(''), 4000);
        // Refresh background tickets list
        loadTickets(page);
      }
    } catch (err) {
      setDetailError(err.message || 'Failed to update ticket');
    } finally {
      setUpdatingTicket(false);
    }
  };

  // Post Super Admin reply
  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicketId || !token) return;
    setReplying(true);
    setDetailError('');
    setActionSuccess('');
    try {
      const res = await addSuperAdminSupportTicketReply(selectedTicketId, replyText.trim(), token);
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
        loadTickets(page);
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
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--sa-text-main)', margin: '0 0 2px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={22} color="var(--sa-primary)" />
            <span>Support Ticket Command Center</span>
          </h2>
          <span style={{ fontSize: '0.76rem', color: 'var(--sa-text-muted)', fontWeight: 600 }}>
            Triaging tenant inquiries, hardware setups, billing escalations, and official operator replies.
          </span>
        </div>

        <button
          onClick={() => loadTickets(page)}
          className="sa-btn sa-btn-secondary sa-btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin-animate' : ''} />
          <span>Refresh Tickets</span>
        </button>
      </div>

      {/* 2. Real-time KPI Telemetry Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ● Open Tickets
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.open || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Awaiting initial triage</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ● In Progress
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.in_progress || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Under active investigation</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7E22CE', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ● Waiting on Tenant
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.waiting_on_tenant || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Pending client feedback</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '16px', border: '1px solid #FECACA', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🚨 Urgent Tickets
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#DC2626', marginTop: '4px' }}>
            {metrics.urgent || 0}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#991B1B' }}>High priority incidents</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--sa-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ✓ Resolved / Total
          </span>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E293B', marginTop: '4px' }}>
            {metrics.resolved || 0} <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>/ {metrics.total || 0}</span>
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748B' }}>Closed inquiries</span>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid var(--sa-border)',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, subject, or business..."
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '10px',
                border: '1px solid var(--sa-border)',
                padding: '0 12px 0 36px',
                fontSize: '0.80rem',
                color: 'var(--sa-text-main)',
                background: '#FAF8F5',
                outline: 'none',
                boxSizing: 'border-box',
                fontWeight: 600
              }}
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--sa-border)',
              padding: '0 10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--sa-text-main)',
              background: '#FAF8F5',
              outline: 'none'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_on_tenant">Waiting on Tenant</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--sa-border)',
              padding: '0 10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--sa-text-main)',
              background: '#FAF8F5',
              outline: 'none'
            }}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">🚨 Urgent</option>
            <option value="high">⚡ High</option>
            <option value="medium">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--sa-border)',
              padding: '0 10px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--sa-text-main)',
              background: '#FAF8F5',
              outline: 'none'
            }}
          >
            <option value="all">All Categories</option>
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
        </div>
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '0.82rem' }}>
                  No support tickets found matching current filters.
                </td>
              </tr>
            ) : (
              tickets.map(t => {
                const st = statusConfig[t.status] || statusConfig.open;
                const pr = priorityConfig[t.priority] || priorityConfig.medium;
                const bizMeta = BUSINESS_TYPE_METADATA[t.business_type] || { icon: '🏢', label: t.business_type || 'Restaurant' };

                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    style={{ cursor: 'pointer', borderTop: '1px solid #F1F5F9', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FAF8F5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                        color: pr.color
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
                      {t.assigned_operator_username ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={13} color="#059669" />
                          <span>{t.assigned_operator_username}</span>
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
        width="680px"
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

            {/* Tenant Identity Strip */}
            <div style={{
              background: '#FAF8F5',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid #EAE5DF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div>
                <strong style={{ fontSize: '0.86rem', color: '#0F172A', display: 'block' }}>
                  {activeTicketData.ticket.restaurant_name}
                </strong>
                <span style={{ fontSize: '0.70rem', color: '#64748B' }}>
                  /{activeTicketData.ticket.restaurant_slug} · Category: <span style={{ textTransform: 'capitalize' }}>{activeTicketData.ticket.category}</span>
                </span>
              </div>
              <div style={{ fontSize: '0.70rem', color: '#64748B' }}>
                Created: {new Date(activeTicketData.ticket.created_at).toLocaleString('en-IN')}
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

            {/* Message Thread History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Conversation History ({activeTicketData.messages?.length || 0} messages)
              </span>

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
                            <span>Restaurant Client ({activeTicketData.ticket.restaurant_name})</span>
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
              padding: '14px'
            }}>
              {activeTicketData.ticket.status === 'closed' ? (
                <div style={{ padding: '12px', background: '#F1F5F9', borderRadius: '10px', color: '#64748B', fontSize: '0.78rem', textAlign: 'center', fontWeight: 700 }}>
                  🔒 This ticket is marked as CLOSED. Reopen the ticket by setting Status to 'Open' or 'In Progress' above to send further replies.
                </div>
              ) : (
                <form onSubmit={handleSendAdminReply} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.70rem', fontWeight: 800, color: '#475569' }}>
                    Post Official Response (Visible to Tenant)
                  </label>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                      Posting an answer automatically sets status to "Waiting on Tenant".
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
