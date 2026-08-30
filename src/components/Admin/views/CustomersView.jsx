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
import { resolveTenantCapabilities } from '../../../utils/planCapabilities';
import PlanLockedCard from '../components/PlanLockedCard';

export default function CustomersView({
  restaurantInfo = {},
  settingsForm = {},
  orders = [],
  token,
  capabilities,
  onUpgrade,
  onNavigate,
  currencySymbol = '₹'
}) {
  const resolvedCaps = capabilities || resolveTenantCapabilities(restaurantInfo, settingsForm);
  const sym = getCurrencySymbol(settingsForm?.currency_symbol !== undefined ? settingsForm.currency_symbol : (restaurantInfo?.currency_symbol || currencySymbol));
  
  // SuperAdmin-configured data retention policy (Dynamic)
  const retentionDays = Number(
    restaurantInfo?.order_retention_days || 
    settingsForm?.order_retention_days || 
    90
  );

  // Live Orders State
  const [rawOrders, setRawOrders] = useState(Array.isArray(orders) && orders.length > 0 ? orders : []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filter & Search State
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'identified' | 'anonymous' | 'qr' | 'whatsapp'
  const [timeframeFilter, setTimeframeFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Guest Detail Drawer / Modal State
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

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
    loadOrders();
  }, [loadOrders]);

  // Copy phone handler
  const handleCopyPhone = (phoneNumber) => {
    if (!phoneNumber) return;
    navigator.clipboard.writeText(phoneNumber);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Safe item parser helper
  const parseItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try { return JSON.parse(items); } catch { return []; }
    }
    return [];
  };

  // Date parsing helper
  const parseSafeDate = (d) => {
    if (!d) return new Date();
    if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
    const str = String(d).trim().replace(' ', 'T');
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Filter orders by timeframe
  const filteredTimeframeOrders = useMemo(() => {
    if (!Array.isArray(rawOrders)) return [];
    
    // Ignore cancelled or rejected orders
    const validOrders = rawOrders.filter(o => o.status !== 'cancelled' && o.status !== 'rejected');
    if (timeframeFilter === 'all') return validOrders;

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    return validOrders.filter(o => {
      const orderTime = parseSafeDate(o.created_at).getTime();
      if (timeframeFilter === 'today') return orderTime >= todayMidnight;
      if (timeframeFilter === '7d') return orderTime >= sevenDaysAgo;
      if (timeframeFilter === '30d') return orderTime >= thirtyDaysAgo;
      return true;
    });
  }, [rawOrders, timeframeFilter]);

  // Aggregate orders into factual guest sessions (No fake DB, purely derived from real orders)
  const guestRecords = useMemo(() => {
    const map = new Map();

    filteredTimeframeOrders.forEach(o => {
      const name = (o.customer_name || '').trim();
      const phone = (o.customer_phone || '').trim();
      const sessionId = (o.session_id || '').trim();
      const tableNum = (o.table_number || 'Dine-In').trim();
      const amount = Number(o.total_amount || o.grand_total_amount || 0);
      const createdAt = parseSafeDate(o.created_at);

      // Determine order source
      const isWhatsApp = String(o.payment_method || '').toLowerCase().includes('whatsapp') || 
                         String(o.order_type || '').toLowerCase().includes('whatsapp');
      const isQR = Boolean(sessionId) || String(o.order_type || '').toLowerCase().includes('qr') || tableNum !== 'Counter';
      const source = isWhatsApp ? 'WhatsApp' : (isQR ? 'QR' : 'Direct / POS');

      // Identification logic:
      // If customer provided a phone number, group by phone (reliable unique guest in retention window).
      // Else if customer provided a non-empty name, group by name.
      // Else if session_id is available, group by session_id.
      // Otherwise group by order ID.
      let groupKey = '';
      let isIdentified = false;
      let displayName = '';

      if (phone && phone.length >= 6) {
        groupKey = `phone_${phone.replace(/\D/g, '')}`;
        isIdentified = true;
        displayName = name || `Guest (${phone.slice(-4)})`;
      } else if (name && name.length >= 2 && !name.toLowerCase().includes('guest') && !name.toLowerCase().includes('table')) {
        groupKey = `name_${name.toLowerCase()}`;
        isIdentified = true;
        displayName = name;
      } else if (sessionId) {
        groupKey = `sess_${sessionId}`;
        isIdentified = false;
        // Clean short hash for anonymous guest
        const shortHash = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
        displayName = `Guest #${shortHash || o.id}`;
      } else {
        groupKey = `order_${o.id}`;
        isIdentified = false;
        displayName = `Guest #${String(o.id).slice(-4)}`;
      }

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          id: groupKey,
          isIdentified,
          displayName,
          customerName: name || null,
          customerPhone: phone || null,
          primaryTable: tableNum,
          sources: new Set([source]),
          ordersCount: 0,
          totalSpend: 0,
          firstActivity: createdAt,
          lastActivity: createdAt,
          orders: [],
          itemsMap: {}
        });
      }

      const rec = map.get(groupKey);
      rec.ordersCount += 1;
      rec.totalSpend += amount;
      rec.sources.add(source);
      if (createdAt > rec.lastActivity) rec.lastActivity = createdAt;
      if (createdAt < rec.firstActivity) rec.firstActivity = createdAt;
      rec.orders.push(o);

      // Track items ordered
      const items = parseItems(o.items);
      items.forEach(it => {
        const iName = it.name || it.dish_name || 'Item';
        const qty = Number(it.quantity || it.qty || 1);
        rec.itemsMap[iName] = (rec.itemsMap[iName] || 0) + qty;
      });
    });

    // Convert map to sorted array (most recent activity first)
    const list = Array.from(map.values()).map(r => {
      // Sort guest's orders newest to oldest
      r.orders.sort((a, b) => parseSafeDate(b.created_at) - parseSafeDate(a.created_at));
      r.sourcesList = Array.from(r.sources);
      r.primarySource = r.sourcesList[0] || 'QR';
      return r;
    });

    return list.sort((a, b) => b.lastActivity - a.lastActivity);
  }, [filteredTimeframeOrders]);

  // Summary Metrics calculations (Reliable Factual Data Only)
  const metrics = useMemo(() => {
    const totalSessions = guestRecords.length;
    const identifiedSessions = guestRecords.filter(g => g.isIdentified).length;
    const anonymousSessions = totalSessions - identifiedSessions;
    
    const totalOrders = filteredTimeframeOrders.length;
    const totalRevenue = filteredTimeframeOrders.reduce((sum, o) => sum + Number(o.total_amount || o.grand_total_amount || 0), 0);
    const avgSpendPerSession = totalSessions > 0 ? Math.round(totalRevenue / totalSessions) : 0;
    const avgSpendPerOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Sources breakdown
    let qrCount = 0;
    let waCount = 0;
    let directCount = 0;

    filteredTimeframeOrders.forEach(o => {
      const isWhatsApp = String(o.payment_method || '').toLowerCase().includes('whatsapp') || 
                         String(o.order_type || '').toLowerCase().includes('whatsapp');
      const isQR = Boolean(o.session_id) || String(o.order_type || '').toLowerCase().includes('qr') || (o.table_number && o.table_number !== 'Counter');
      if (isWhatsApp) waCount++;
      else if (isQR) qrCount++;
      else directCount++;
    });

    // Returning sessions (Sessions with > 1 order in retained data)
    const returningCount = guestRecords.filter(g => g.ordersCount > 1).length;
    const singleOrderCount = totalSessions - returningCount;
    const returningRate = totalSessions > 0 ? Math.round((returningCount / totalSessions) * 100) : 0;

    // Top purchased items across all retained sessions
    const overallItemsMap = {};
    filteredTimeframeOrders.forEach(o => {
      const items = parseItems(o.items);
      items.forEach(it => {
        const name = it.name || it.dish_name || 'Dish';
        const qty = Number(it.quantity || it.qty || 1);
        const price = Number(it.price || 0);
        if (!overallItemsMap[name]) {
          overallItemsMap[name] = { name, quantity: 0, revenue: 0 };
        }
        overallItemsMap[name].quantity += qty;
        overallItemsMap[name].revenue += price * qty;
      });
    });

    const topItems = Object.values(overallItemsMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalSessions,
      identifiedSessions,
      anonymousSessions,
      totalOrders,
      totalRevenue,
      avgSpendPerSession,
      avgSpendPerOrder,
      qrCount,
      waCount,
      directCount,
      returningCount,
      singleOrderCount,
      returningRate,
      topItems
    };
  }, [guestRecords, filteredTimeframeOrders]);

  // Filtered and Searched Guest Records
  const displayedGuests = useMemo(() => {
    return guestRecords.filter(g => {
      // Source filter
      if (sourceFilter === 'identified' && !g.isIdentified) return false;
      if (sourceFilter === 'anonymous' && g.isIdentified) return false;
      if (sourceFilter === 'qr' && !g.sources.has('QR')) return false;
      if (sourceFilter === 'whatsapp' && !g.sources.has('WhatsApp')) return false;

      // Search query (Searches name, phone, table, or order numbers)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = g.displayName.toLowerCase().includes(q) || (g.customerName && g.customerName.toLowerCase().includes(q));
        const matchesPhone = g.customerPhone && g.customerPhone.includes(q);
        const matchesTable = g.primaryTable && g.primaryTable.toLowerCase().includes(q);
        const matchesOrder = g.orders.some(o => String(o.id).includes(q));
        if (!matchesName && !matchesPhone && !matchesTable && !matchesOrder) {
          return false;
        }
      }

      return true;
    });
  }, [guestRecords, sourceFilter, searchQuery]);

  // Format date helper (e.g. "Today, 3:45 PM" or "28 Aug 2026")
  const formatActivityTime = (dateObj) => {
    if (!dateObj) return 'Recently';
    const now = new Date();
    const d = parseSafeDate(dateObj);
    const isToday = d.toDateString() === now.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeStr}`;
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
            grid-template-columns: 1fr !important;
          }
          .desktop-table-container {
            display: none !important;
          }
          .mobile-cards-container {
            display: flex !important;
          }
          .guest-details-sheet-panel {
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            bottom: 0 !important;
            top: auto !important;
            height: 85vh !important;
            animation: slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
          }
          @keyframes slideUpSheet {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

      {/* =========================================================================
          2. TOP SUMMARY METRICS
         ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {/* Metric 1: Guest Sessions */}
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
              Guest Sessions
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              {metrics.totalSessions}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              {metrics.identifiedSessions} identified • {metrics.anonymousSessions} anonymous
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

        {/* Metric 3: Total Retained Spend */}
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
              From table & digital orders
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
              Average Spend / Session
            </span>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginTop: '2px' }}>
              {sym}{formatPriceNumber(metrics.avgSpendPerSession)}
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
            paddingBottom: '2px',
            scrollbarWidth: 'none'
          }}>
            {[
              { id: 'all', label: `All (${metrics.totalSessions})` },
              { id: 'identified', label: `Identified (${metrics.identifiedSessions})` },
              { id: 'anonymous', label: `Anonymous (${metrics.anonymousSessions})` },
              { id: 'qr', label: `QR Orders (${metrics.qrCount})` },
              { id: 'whatsapp', label: `WhatsApp (${metrics.waCount})` }
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
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, table number, or order ID..."
            style={{
              width: '100%',
              height: '38px',
              padding: '0 12px 0 36px',
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
                Showing {displayedGuests.length} active guest sessions
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
                        onClick={() => setSelectedGuest(guest)}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                {guest.customerPhone ? guest.customerPhone : `Table ${guest.primaryTable}`}
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
                            onClick={(e) => { e.stopPropagation(); setSelectedGuest(guest); }}
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
                  onClick={() => setSelectedGuest(guest)}
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
                          {guest.customerPhone || `Table ${guest.primaryTable}`}
                        </span>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      color: guest.primarySource === 'WhatsApp' ? '#047857' : '#064E3B',
                      background: guest.primarySource === 'WhatsApp' ? '#ECFDF5' : '#F0FDF4',
                      border: '1px solid #A7F3D0',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {guest.primarySource}
                    </span>
                  </div>

                  {/* Mid: Orders + Spend + Last Activity */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
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
                    onClick={(e) => { e.stopPropagation(); setSelectedGuest(guest); }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={12} color="#059669" />
                <span>Zero customer password / account requirements</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={12} color="#059669" />
                <span>Isolated to your restaurant business</span>
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
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>📱 QR Table Orders</span>
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
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>🧾 Direct / Counter</span>
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
                Repeat Guest Sessions
              </h3>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#64748B', margin: '0 0 10px 0' }}>
              Multi-order sessions vs single-order visits within retained window.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div style={{ background: '#FAF8F5', borderRadius: '10px', padding: '8px 10px', border: '1px solid #EAE5DF' }}>
                <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Repeat (2+ Orders)</span>
                <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#064E3B' }}>{metrics.returningCount}</strong>
                <span style={{ fontSize: '0.62rem', color: '#059669', display: 'block' }}>{metrics.returningRate}% rate</span>
              </div>
              <div style={{ background: '#FAF8F5', borderRadius: '10px', padding: '8px 10px', border: '1px solid #EAE5DF' }}>
                <span style={{ fontSize: '0.64rem', color: '#64748B', display: 'block' }}>Single Visits</span>
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
          onClick={() => setSelectedGuest(null)}
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
                onClick={() => setSelectedGuest(null)}
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
                  justifyContent: 'space-between'
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
                    const items = parseItems(ord.items);
                    const ordTime = parseSafeDate(ord.created_at);
                    const ordTotal = Number(ord.total_amount || ord.grand_total_amount || 0);

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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '0.82rem', color: '#0F172A' }}>
                              Order #{ord.id}
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

                        {/* Order Meta: Table + Time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem', color: '#64748B', marginBottom: '8px' }}>
                          <span>📍 Table: {ord.table_number || 'Dine-In'}</span>
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
                              <div key={iIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#334155' }}>
                                <span>{it.quantity || it.qty || 1}x {it.name || it.dish_name}</span>
                                <span style={{ fontWeight: 700 }}>
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
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #EAE5DF',
              background: '#FFFFFF',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setSelectedGuest(null)}
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
