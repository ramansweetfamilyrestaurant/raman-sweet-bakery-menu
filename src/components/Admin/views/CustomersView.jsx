import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Calendar, 
  Clock, 
  ShoppingBag, 
  TrendingUp, 
  QrCode, 
  MessageSquare, 
  Utensils, 
  ShieldCheck, 
  Info, 
  ArrowRight, 
  ChevronRight, 
  X, 
  RefreshCw, 
  Eye, 
  Phone, 
  CheckCircle2, 
  HelpCircle, 
  Sparkles, 
  Filter, 
  SlidersHorizontal,
  ExternalLink,
  Layers,
  Copy,
  Check,
  Tag,
  Store
} from 'lucide-react';
import { fetchAdminOrders } from '../../../api/client';
import { getCurrencySymbol, formatPriceNumber } from '../../../utils/currencyHelper';
import { getBusinessTerminology } from '../../../utils/businessTaxonomy';
import {
  parseOrderDateSafe,
  getISTDateKey,
  filterOrdersByTimeframe,
  parseOrderItemsSafe,
  formatGuestOrderLocation,
  buildGuestRecordsAndMetrics
} from '../../../utils/customerInsightsHelper';

export default function CustomersView({
  restaurantInfo = {},
  settingsForm = {},
  orders = [],
  token,
  onNavigate,
  currencySymbol = '₹'
}) {
  const terms = getBusinessTerminology(restaurantInfo || settingsForm);
  const sym = getCurrencySymbol(settingsForm?.currency_symbol !== undefined ? settingsForm.currency_symbol : (restaurantInfo?.currency_symbol || currencySymbol));
  
  // SuperAdmin-configured data retention policy (Dynamic)
  const retentionDays = Number(
    restaurantInfo?.order_retention_days || 
    settingsForm?.order_retention_days || 
    90
  );

  // Live Orders State (merges retained fetch history + newer live orders)
  const [rawOrders, setRawOrders] = useState(Array.isArray(orders) && orders.length > 0 ? orders : []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filter & Search State
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'identified' | 'anonymous' | 'qr' | 'whatsapp'
  const [timeframeFilter, setTimeframeFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Guest Detail Drawer / Modal State (tracked by ID so drawer refreshes cleanly)
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Merge live incoming orders from parent dashboard cleanly without dropping historical records
  useEffect(() => {
    if (!Array.isArray(orders) || orders.length === 0) return;
    setRawOrders(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return orders;
      const byId = new Map(prev.map(o => [String(o.id), o]));
      let changed = false;
      orders.forEach(o => {
        const key = String(o.id);
        const existing = byId.get(key);
        if (!existing || existing.status !== o.status || existing.is_settled !== o.is_settled || existing.payment_method !== o.payment_method || existing.total_amount !== o.total_amount || existing.items !== o.items) {
          byId.set(key, o);
          changed = true;
        }
      });
      return changed ? Array.from(byId.values()) : prev;
    });
  }, [orders]);

  // Load all retained orders for tenant
  const loadOrders = useCallback(async (isManualRefresh = false) => {
    if (!token) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    try {
      const data = await fetchAdminOrders(token, 'all');
      if (Array.isArray(data)) {
        setRawOrders(data);
      }
    } catch (err) {
      console.warn('Failed to load retained orders for customer insights:', err);
      setErrorMsg(err.message || 'Failed to load guest activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setSelectedGuestId(null);
    loadOrders();
  }, [loadOrders]);

  // Copy phone handler
  const handleCopyPhone = async (phoneNumber) => {
    if (!phoneNumber) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(phoneNumber);
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      }
    } catch (_) {
      // Clipboard API unavailable in restricted context
    }
  };

  // Filter orders by timeframe (IST-consistent)
  const filteredTimeframeOrders = useMemo(
    () => filterOrdersByTimeframe(rawOrders, timeframeFilter),
    [rawOrders, timeframeFilter]
  );

  // Aggregate orders into factual guest sessions + summary metrics
  const { guestRecords, metrics } = useMemo(
    () => buildGuestRecordsAndMetrics(filteredTimeframeOrders, restaurantInfo),
    [filteredTimeframeOrders, restaurantInfo]
  );

  const selectedGuest = useMemo(
    () => (selectedGuestId ? guestRecords.find(g => g.id === selectedGuestId) || null : null),
    [guestRecords, selectedGuestId]
  );

  // Filtered and Searched Guest Records
  const displayedGuests = useMemo(() => {
    return guestRecords.filter(g => {
      // Source filter
      if (sourceFilter === 'identified' && !g.isIdentified) return false;
      if (sourceFilter === 'anonymous' && g.isIdentified) return false;
      if (sourceFilter === 'qr' && !g.sources.has('QR')) return false;
      if (sourceFilter === 'whatsapp' && !g.sources.has('WhatsApp')) return false;

      // Search query (Searches name, phone, location, order ID, order number, or token)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = g.displayName.toLowerCase().includes(q) || (g.customerName && g.customerName.toLowerCase().includes(q));
        const matchesPhone = g.customerPhone && g.customerPhone.toLowerCase().includes(q);
        const matchesTable = (g.primaryTable && g.primaryTable.toLowerCase().includes(q)) ||
          (g.primaryLocation && g.primaryLocation.toLowerCase().includes(q));
        const matchesOrder = g.orders.some(o =>
          String(o.id).includes(q) ||
          (o.order_number !== undefined && o.order_number !== null && String(o.order_number).includes(q)) ||
          (o.token_display && String(o.token_display).toLowerCase().includes(q))
        );
        if (!matchesName && !matchesPhone && !matchesTable && !matchesOrder) {
          return false;
        }
      }

      return true;
    });
  }, [guestRecords, sourceFilter, searchQuery]);

  // Format date helper in IST (e.g. "Today, 3:45 PM" or "Yesterday, 8:10 PM")
  const formatActivityTime = (dateObj) => {
    if (!dateObj) return 'Recently';
    const d = parseOrderDateSafe(dateObj);
    const nowMs = Date.now();
    const dateKey = getISTDateKey(d, nowMs);
    const todayKey = getISTDateKey(new Date(nowMs), nowMs);
    const yesterdayKey = getISTDateKey(new Date(nowMs - 86400000), nowMs);

    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
    if (dateKey === todayKey) return `Today, ${timeStr}`;
    if (dateKey === yesterdayKey) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}, ${timeStr}`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '0 0 40px 0',
      width: '100%',
      maxWidth: '1440px',
      margin: '0 auto',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .guest-row-item {
          transition: all 0.18s ease;
        }
        .guest-row-item:hover {
          background-color: #F8FAF8 !important;
        }
        .filter-chip-btn {
          transition: all 0.15s ease;
        }
        .filter-chip-btn:hover {
          border-color: #064E3B !important;
          color: #064E3B !important;
        }
        .guest-details-sheet-backdrop {
          animation: fadeInBackdrop 0.2s ease forwards;
        }
        .guest-details-sheet-panel {
          animation: slideInSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInSheet {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 900px) {
          .guest-main-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .desktop-table-container {
            display: none !important;
          }
          .mobile-cards-container {
            display: flex !important;
          }
          .guest-details-sheet-backdrop {
            align-items: flex-end !important;
          }
          .guest-details-sheet-panel {
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            height: 85dvh !important;
            max-height: 85dvh !important;
            animation: slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          }
          .guest-sheet-footer {
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) !important;
          }
          @keyframes slideUpSheet {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        }
        @media (max-width: 768px) {
          .guest-timeframe-select {
            font-size: 0.80rem !important;
            min-height: 36px !important;
            height: 36px !important;
          }
          .guest-search-input {
            font-size: 0.85rem !important;
            min-height: 40px !important;
            height: 40px !important;
          }
        }
        @media (min-width: 901px) {
          .desktop-table-container {
            display: block !important;
          }
          .mobile-cards-container {
            display: none !important;
          }
        }
      `}</style>

      {/* =========================================================================
          1. PAGE HEADER & RETENTION CONFIGURATION
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Left Title & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#ECFDF5',
            color: '#064E3B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.24rem',
              fontWeight: 900,
              color: '#0F172A',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Customers & Guest Insights
            </h1>
            <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '2px 0 0 0' }}>
              Understand recent guest activity and ordering behavior.
            </p>
          </div>
        </div>

        {/* Right Side: Data Retention Indicator + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            background: '#FAF8F5',
            border: '1px solid #EAE5DF',
            borderRadius: '12px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldCheck size={16} color="#064E3B" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Data Retention
                </span>
                <span style={{
                  fontSize: '0.60rem',
                  fontWeight: 800,
                  color: '#064E3B',
                  background: '#ECFDF5',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid #A7F3D0'
                }}>
                  Configured by Platform
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                Activity retained for {retentionDays} days
              </div>
            </div>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={refreshing || loading}
            title="Refresh guest activity"
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Retention Policy Sub-Banner */}
      <div style={{
        background: '#FAF8F5',
        border: '1px solid #EAE5DF',
        borderRadius: '12px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={16} color="#064E3B" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
            <strong>Privacy & Architecture Note:</strong> Guest activity older than the configured {retentionDays}-day retention period is automatically removed. Guests can place orders without creating a TouchQR account.
          </span>
        </div>
        <span style={{ fontSize: '0.70rem', color: '#059669', fontWeight: 800, whiteSpace: 'nowrap' }}>
          🔒 Zero Permanent Tracking
        </span>
      </div>

      {/* Fetch Error / Loading Feedback */}
      {errorMsg && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          color: '#B91C1C',
          fontSize: '0.76rem',
          fontWeight: 700
        }}>
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => loadOrders(true)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #FCA5A5',
              background: '#FFFFFF',
              color: '#B91C1C',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          2. TOP SUMMARY METRICS
         ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {/* Metric 1: Guests */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Guests
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              {metrics.totalGuests}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              {metrics.identifiedGuests} identified • {metrics.anonymousGuests} anonymous
            </span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={18} />
          </div>
        </div>

        {/* Metric 2: Retained Orders */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Retained Orders
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              {metrics.totalOrders}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, marginTop: '2px', display: 'block' }}>
              Orders in {retentionDays}-day window
            </span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={18} />
          </div>
        </div>

        {/* Metric 3: Total Retained Revenue */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Retained Revenue
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#064E3B', marginTop: '2px' }}>
              {sym}{formatPriceNumber(metrics.totalRevenue)}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              From retained customer orders
            </span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#064E3B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Metric 4: Average Spend */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #EAE5DF',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div>
            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              Avg. Spend / Guest
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              {sym}{formatPriceNumber(metrics.avgSpendPerGuest)}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, marginTop: '2px', display: 'block' }}>
              Avg per order: {sym}{formatPriceNumber(metrics.avgSpendPerOrder)}
            </span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Utensils size={18} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. FILTER BAR & SEARCH ROW
         ========================================================================= */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAE5DF',
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Top Filter Chips Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          {/* Filter Categories Chips */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            maxWidth: '100%',
            minWidth: 0,
            paddingBottom: '2px',
            scrollbarWidth: 'none'
          }}>
            {[
              { id: 'all', label: `All (${metrics.totalGuests})` },
              { id: 'identified', label: `Identified (${metrics.identifiedGuests})` },
              { id: 'anonymous', label: `Anonymous (${metrics.anonymousGuests})` },
              { id: 'qr', label: `QR Guests (${metrics.qrGuestsCount})` },
              { id: 'whatsapp', label: `WhatsApp (${metrics.waGuestsCount})` }
            ].map(f => {
              const active = sourceFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSourceFilter(f.id)}
                  className="filter-chip-btn"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    fontWeight: active ? 800 : 600,
                    border: active ? '1.5px solid #064E3B' : '1px solid #E2E8F0',
                    background: active ? '#064E3B' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Date Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#64748B" />
            <select
              className="guest-timeframe-select"
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FAF8F5',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#0F172A',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Retained ({retentionDays} Days)</option>
              <option value="today">Today's Activity</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Search Row */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="guest-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search by customer name, phone, ${terms.locationNoun?.toLowerCase() || 'space'}, or order ID...`}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 34px 0 36px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#F8FAF8',
              fontSize: '0.78rem',
              color: '#0F172A',
              boxSizing: 'border-box',
              outline: 'none'
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
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. MAIN WORKSPACE: RECENT GUEST ACTIVITY TABLE & SIDE INSIGHTS
         ========================================================================= */}
      <div className="guest-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: '16px',
        alignItems: 'start'
      }}>
        
        {/* LEFT PRIMARY PANEL: RECENT GUEST ACTIVITY */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAE5DF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #EAE5DF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Recent Guest Activity
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                {loading && rawOrders.length === 0 ? 'Loading guest activity...' : `Showing ${displayedGuests.length} active guests`}
              </span>
            </div>
            {timeframeFilter !== 'all' && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                color: '#D97706',
                background: '#FEF3C7',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Filter: {timeframeFilter}
              </span>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="desktop-table-container">
            {displayedGuests.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#FAF8F5',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto'
                }}>
                  <Users size={24} />
                </div>
                <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                  No guest activity yet
                </h3>
                <p style={{ fontSize: '0.76rem', color: '#64748B', maxWidth: '340px', margin: '0 auto' }}>
                  Customer activity will appear here when guests browse or place orders.
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSourceFilter('all'); }}
                    style={{
                      marginTop: '12px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#064E3B',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#FAF8F5', borderBottom: '1px solid #EAE5DF' }}>
                    <th style={{ padding: '10px 18px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Guest / Customer
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Source
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Orders
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Spend
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Last Activity
                    </th>
                    <th style={{ padding: '10px 18px', fontSize: '0.70rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' }}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedGuests.map((guest) => {
                    return (
                      <tr
                        key={guest.id}
                        onClick={() => setSelectedGuestId(guest.id)}
                        className="guest-row-item"
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          background: '#FFFFFF'
                        }}
                      >
                        {/* Guest / Customer */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '10px',
                              background: guest.isIdentified ? '#ECFDF5' : '#F1F5F9',
                              color: guest.isIdentified ? '#064E3B' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.78rem',
                              fontWeight: 900,
                              flexShrink: 0
                            }}>
                              {guest.isIdentified ? guest.displayName.charAt(0).toUpperCase() : '#'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <strong style={{ fontSize: '0.82rem', color: '#0F172A' }}>
                                  {guest.displayName}
                                </strong>
                                {guest.isIdentified && (
                                  <span style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 800,
                                    color: '#059669',
                                    background: '#ECFDF5',
                                    padding: '1px 5px',
                                    borderRadius: '4px'
                                  }}>
                                    Identified
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                                {guest.customerPhone ? guest.customerPhone : guest.primaryLocation}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Source */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {guest.sourcesList.map(src => (
                              <span
                                key={src}
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  color: src === 'WhatsApp' ? '#047857' : (src === 'QR' ? '#064E3B' : '#475569'),
                                  background: src === 'WhatsApp' ? '#ECFDF5' : (src === 'QR' ? '#F0FDF4' : '#F1F5F9'),
                                  border: src === 'WhatsApp' ? '1px solid #A7F3D0' : (src === 'QR' ? '1px solid #BBF7D0' : '1px solid #E2E8F0'),
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {src === 'WhatsApp' ? <MessageSquare size={10} /> : <QrCode size={10} />}
                                {src}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Orders */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            color: '#0F172A',
                            background: '#F8FAFC',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0'
                          }}>
                            {guest.ordersCount} {guest.ordersCount === 1 ? 'order' : 'orders'}
                          </span>
                        </td>

                        {/* Spend */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#064E3B' }}>
                            {sym}{formatPriceNumber(guest.totalSpend)}
                          </span>
                        </td>

                        {/* Last Activity */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 600 }}>
                            {formatActivityTime(guest.lastActivity)}
                          </span>
                        </td>

                        {/* Action */}
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedGuestId(guest.id); }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: '1px solid #064E3B',
                              background: '#ECFDF5',
                              color: '#064E3B',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>View</span>
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile Cards Container (< 900px) */}
          <div className="mobile-cards-container" style={{
            flexDirection: 'column',
            gap: '10px',
            padding: '12px'
          }}>
            {displayedGuests.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                <Users size={24} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
                <h3 style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0F172A', margin: '0 0 2px 0' }}>
                  No guest activity yet
                </h3>
                <p style={{ fontSize: '0.72rem', color: '#64748B', margin: 0 }}>
                  Customer activity will appear here when guests browse or place orders.
                </p>
              </div>
            ) : (
              displayedGuests.map((guest) => (
                <div
                  key={guest.id}
                  onClick={() => setSelectedGuestId(guest.id)}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #EAE5DF',
                    padding: '12px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {/* Top: Guest Label + Source Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: guest.isIdentified ? '#ECFDF5' : '#F1F5F9',
                        color: guest.isIdentified ? '#064E3B' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.74rem',
                        fontWeight: 900,
                        flexShrink: 0
                      }}>
                        {guest.isIdentified ? guest.displayName.charAt(0).toUpperCase() : '#'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {guest.displayName}
                        </div>
                        <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
                          {guest.customerPhone || guest.primaryLocation}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {guest.sourcesList.map(src => (
                        <span
                          key={src}
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            color: src === 'WhatsApp' ? '#047857' : (src === 'QR' ? '#064E3B' : '#475569'),
                            background: src === 'WhatsApp' ? '#ECFDF5' : (src === 'QR' ? '#F0FDF4' : '#F1F5F9'),
                            border: src === 'WhatsApp' ? '1px solid #A7F3D0' : (src === 'QR' ? '1px solid #BBF7D0' : '1px solid #E2E8F0'),
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Mid: Orders + Spend + Last Activity */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    background: '#FAF8F5',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    border: '1px solid #EAE5DF'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Orders</span>
                      <strong style={{ fontSize: '0.78rem', color: '#0F172A' }}>{guest.ordersCount}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Total Spend</span>
                      <strong style={{ fontSize: '0.84rem', color: '#064E3B', fontWeight: 900 }}>
                        {sym}{formatPriceNumber(guest.totalSpend)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Last Activity</span>
                      <span style={{ fontSize: '0.70rem', color: '#475569', fontWeight: 700 }}>
                        {formatActivityTime(guest.lastActivity)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: View Details Action */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedGuestId(guest.id); }}
                    style={{
                      width: '100%',
                      minHeight: '44px',
                      borderRadius: '8px',
                      border: '1px solid #064E3B',
                      background: '#ECFDF5',
                      color: '#064E3B',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>View Details</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT SIDE PANEL: INSIGHTS & RETENTION POLICY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Card 1: Data Retention Safety Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShieldCheck size={18} color="#064E3B" />
              <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Data Retention
              </h3>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#475569', margin: '0 0 10px 0', lineHeight: 1.45 }}>
              Guest activity is retained according to the platform retention policy.
            </p>
            <div style={{
              background: '#FAF8F5',
              borderRadius: '10px',
              padding: '10px 12px',
              border: '1px solid #EAE5DF',
              marginBottom: '10px'
            }}>
              <div style={{ fontSize: '0.70rem', fontWeight: 800, color: '#64748B' }}>
                CURRENT POLICY
              </div>
              <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#064E3B', marginTop: '1px' }}>
                {retentionDays} Days Retention
              </div>
              <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                Older activity is automatically removed.
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.70rem', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <CheckCircle2 size={12} color="#059669" />
                <span>Zero customer password / account requirements</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <CheckCircle2 size={12} color="#059669" />
                <span>Isolated to your business profile</span>
              </div>
            </div>
          </div>

          {/* Card 2: Activity Sources Breakdown */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <QrCode size={18} color="#064E3B" />
              <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Activity Sources
              </h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* QR Orders */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>📱 QR {terms.isHotel ? 'Room Service' : terms.isCinema ? 'Seat Orders' : terms.isQsr ? 'Counter Orders' : 'Table Orders'}</span>
                  <span style={{ fontWeight: 800, color: '#064E3B' }}>
                    {metrics.qrCount} ({metrics.totalOrders > 0 ? Math.round((metrics.qrCount / metrics.totalOrders) * 100) : 0}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${metrics.totalOrders > 0 ? (metrics.qrCount / metrics.totalOrders) * 100 : 0}%`,
                    height: '100%',
                    background: '#064E3B',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>

              {/* WhatsApp Orders */}
              {metrics.waCount > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>💬 WhatsApp Direct</span>
                    <span style={{ fontWeight: 800, color: '#047857' }}>
                      {metrics.waCount} ({Math.round((metrics.waCount / metrics.totalOrders) * 100)}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(metrics.waCount / metrics.totalOrders) * 100}%`,
                      height: '100%',
                      background: '#10B981',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              )}

              {/* Direct / Counter */}
              {metrics.directCount > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>🧾 Direct / POS</span>
                    <span style={{ fontWeight: 800, color: '#64748B' }}>
                      {metrics.directCount} ({Math.round((metrics.directCount / metrics.totalOrders) * 100)}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(metrics.directCount / metrics.totalOrders) * 100}%`,
                      height: '100%',
                      background: '#94A3B8',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              )}
            </div>

            <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block', marginTop: '10px' }}>
              Sources reflect how guests placed their orders during this retention period.
            </span>
          </div>

          {/* Card 3: Returning Activity Patterns */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={18} color="#064E3B" />
              <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Repeat Guests
              </h3>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0 0 10px 0' }}>
              Multi-order guests vs single-order visits within retained window.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={{ background: '#FAF8F5', borderRadius: '10px', padding: '8px 10px', border: '1px solid #EAE5DF' }}>
                <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Repeat (2+ Orders)</span>
                <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#064E3B' }}>{metrics.returningCount}</strong>
                <span style={{ fontSize: '0.62rem', color: '#059669', display: 'block' }}>{metrics.returningRate}% rate</span>
              </div>
              <div style={{ background: '#FAF8F5', borderRadius: '10px', padding: '8px 10px', border: '1px solid #EAE5DF' }}>
                <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Single-Order Guests</span>
                <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>{metrics.singleOrderCount}</strong>
                <span style={{ fontSize: '0.62rem', color: '#64748B', display: 'block' }}>{100 - metrics.returningRate}% rate</span>
              </div>
            </div>
          </div>

          {/* Card 4: Top Purchased Items */}
          {metrics.topItems.length > 0 && (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAE5DF',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Utensils size={18} color="#064E3B" />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Top Ordered Items
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {metrics.topItems.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '0.70rem', fontWeight: 900, color: '#94A3B8', width: '14px' }}>#{i + 1}</span>
                      <span style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontWeight: 800, color: '#064E3B' }}>{item.quantity} qty</span>
                      <span style={{ fontSize: '0.66rem', color: '#94A3B8', display: 'block' }}>{sym}{formatPriceNumber(item.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 5: Contextual Marketing Connection */}
          <div style={{
            background: 'linear-gradient(135deg, #FAF8F5 0%, #F4EFE6 100%)',
            borderRadius: '16px',
            border: '1px solid #EAE5DF',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Tag size={18} color="#D97706" />
              <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Marketing & Offers
              </h3>
            </div>
            <p style={{ fontSize: '0.74rem', color: '#475569', margin: '0 0 12px 0', lineHeight: 1.45 }}>
              Increase repeat guest visits with targeted combo deals and special item discounts.
            </p>
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('offers') : null}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#064E3B',
                color: '#FFFFFF',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(6, 78, 59, 0.2)'
              }}
            >
              <span>View Marketing & Offers</span>
              <ArrowRight size={14} />
            </button>
          </div>

        </div>
      </div>

      {/* =========================================================================
          5. GUEST DETAILS SLIDE-OVER SHEET / MODAL
         ========================================================================= */}
      {selectedGuest && (
        <div
          className="guest-details-sheet-backdrop"
          onClick={() => setSelectedGuestId(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(9, 12, 10, 0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="guest-details-sheet-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '460px',
              maxWidth: '92vw',
              height: '100vh',
              background: '#FFFFFF',
              boxShadow: '-4px 0 25px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            {/* Sheet Header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid #EAE5DF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FAF8F5'
            }}>
              <div>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: selectedGuest.isIdentified ? '#059669' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedGuest.isIdentified ? 'Customer Details' : 'Guest Activity'}
                </span>
                <h2 style={{ fontSize: '1.12rem', fontWeight: 900, color: '#0F172A', margin: '2px 0 0 0' }}>
                  {selectedGuest.displayName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGuestId(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Sheet Content Scroll */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Contact Information (Only if actually stored) */}
              {selectedGuest.customerPhone ? (
                <div style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Phone size={18} color="#064E3B" />
                    <div>
                      <span style={{ fontSize: '0.64rem', color: '#064E3B', fontWeight: 800, textTransform: 'uppercase' }}>
                        Customer Contact
                      </span>
                      <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#064E3B' }}>
                        {selectedGuest.customerPhone}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPhone(selectedGuest.customerPhone)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #A7F3D0',
                      background: '#FFFFFF',
                      color: '#064E3B',
                      fontSize: '0.70rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copiedPhone ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedPhone ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ) : (
                <div style={{
                  background: '#FAF8F5',
                  border: '1px solid #EAE5DF',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.74rem',
                  color: '#64748B'
                }}>
                  ℹ️ No customer contact information was provided for this session.
                </div>
              )}

              {/* Activity Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px', border: '1px solid #EAE5DF' }}>
                  <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Total Orders
                  </span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
                    {selectedGuest.ordersCount}
                  </div>
                  <span style={{ fontSize: '0.66rem', color: '#64748B' }}>
                    In {retentionDays}-day retention
                  </span>
                </div>

                <div style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px', border: '1px solid #EAE5DF' }}>
                  <span style={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Total Spend
                  </span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#064E3B', marginTop: '2px' }}>
                    {sym}{formatPriceNumber(selectedGuest.totalSpend)}
                  </div>
                  <span style={{ fontSize: '0.66rem', color: '#059669', fontWeight: 700 }}>
                    Avg: {sym}{formatPriceNumber(Math.round(selectedGuest.totalSpend / selectedGuest.ordersCount))}
                  </span>
                </div>
              </div>

              {/* Associated Orders Timeline */}
              <div>
                <h3 style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0F172A', margin: '0 0 10px 0' }}>
                  Orders Associated ({selectedGuest.orders.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedGuest.orders.map((ord, idx) => {
                    const items = parseOrderItemsSafe(ord.items);
                    const ordTime = parseOrderDateSafe(ord.created_at);
                    const ordTotal = Number(ord.total_amount || ord.grand_total_amount || 0);
                    const ordLocationLabel = formatGuestOrderLocation(ord, restaurantInfo);

                    return (
                      <div
                        key={ord.id || idx}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #EAE5DF',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Order Top: ID + Status + Total */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <strong style={{ fontSize: '0.82rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {ordLocationLabel}
                            </strong>
                            <span style={{
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              color: ord.status === 'completed' ? '#064E3B' : '#D97706',
                              background: ord.status === 'completed' ? '#ECFDF5' : '#FEF3C7',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              {ord.status}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.88rem', fontWeight: 900, color: '#064E3B' }}>
                            {sym}{formatPriceNumber(ordTotal)}
                          </span>
                        </div>

                        {/* Order Meta: Location + Time */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '0.68rem', color: '#64748B', marginBottom: '8px' }}>
                          <span>📍 {ordLocationLabel}</span>
                          <span>•</span>
                          <span>🕒 {formatActivityTime(ordTime)}</span>
                        </div>

                        {/* Items List */}
                        {items.length > 0 && (
                          <div style={{
                            background: '#FAF8F5',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            border: '1px solid #EAE5DF',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            {items.map((it, iIdx) => (
                              <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.72rem', color: '#334155' }}>
                                <span style={{ minWidth: 0 }}>{it.quantity || it.qty || 1}x {it.name || it.dish_name}</span>
                                <span style={{ fontWeight: 700, flexShrink: 0 }}>
                                  {sym}{formatPriceNumber((Number(it.price || 0)) * (Number(it.quantity || it.qty || 1)))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Privacy Footer Notice */}
              <div style={{
                background: '#FAF8F5',
                borderRadius: '10px',
                padding: '10px 12px',
                border: '1px solid #EAE5DF',
                fontSize: '0.68rem',
                color: '#64748B',
                lineHeight: 1.4
              }}>
                🔒 Customer details are only captured when directly provided by the guest during table ordering or WhatsApp checkout. Activity is automatically pruned after {retentionDays} days.
              </div>
            </div>

            {/* Sheet Footer */}
            <div className="guest-sheet-footer" style={{
              padding: '14px 20px',
              borderTop: '1px solid #EAE5DF',
              background: '#FFFFFF',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setSelectedGuestId(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#064E3B',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Close Activity View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
