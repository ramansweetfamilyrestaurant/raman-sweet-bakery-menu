import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Printer, 
  MapPin, 
  Bell, 
  RefreshCw, 
  CheckCircle2, 
  QrCode, 
  XCircle, 
  UtensilsCrossed, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Check, 
  X, 
  AlertTriangle, 
  MessageSquare,
  ShoppingBag,
  ChefHat,
  Receipt,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Filter,
  Eye,
  CreditCard,
  Share2,
  Tv,
  ArrowUpRight
} from 'lucide-react';
import KdsDisplayView from './KdsDisplayView';
import PlanLockedCard from '../components/PlanLockedCard';
import { resolveBusinessProfile } from '../../../utils/businessTaxonomy';
import { fetchCinemaScreens, fetchCinemaSeats } from '../../../api/client';

export default function OrdersView({
  orders = [],
  activeSubTab = 'orders',
  setActiveSubTab,
  kotFilter = 'all',
  setKotFilter,
  onUpdateStatus,
  onOpenAcceptRouting,
  onOpenBillModal,
  serviceRequests = [],
  onResolveServiceRequest,
  onApprovePresenceRequest,
  onRejectPresenceRequest,
  restaurantInfo,
  onPrintQR,
  onDirectPrint,
  onPrintBill,
  onPreviewPrint,
  printingOrderId,
  printingType,
  currencySymbol = '₹',
  ordersEnabled = true,
  settingsForm = {},
  token = null,
  onNavigateToSetup = null
}) {
  const safeParseItems = (rawItems) => {
    if (!rawItems) return [];
    if (Array.isArray(rawItems)) return rawItems;
    if (typeof rawItems === 'string') {
      try {
        const parsed = JSON.parse(rawItems);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const safeParseModifiers = (rawModifiers) => {
    if (!rawModifiers) return [];
    if (Array.isArray(rawModifiers)) return rawModifiers;
    if (typeof rawModifiers === 'string') {
      try {
        const parsed = JSON.parse(rawModifiers);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const profile = resolveBusinessProfile(restaurantInfo || settingsForm || {});
  const effectiveBiz = profile?.business_type || settingsForm?.business_type || restaurantInfo?.business_type;
  const effectiveService = profile?.service_model || settingsForm?.service_model || restaurantInfo?.service_model;
  const isCinema = effectiveBiz === 'cinema_theatre' || effectiveService === 'cinema' || effectiveService === 'seat_service';
  const isHotel = effectiveBiz === 'hotel_resort' || effectiveService === 'hotel' || effectiveService === 'in_room_dining';
  const isDining = !isCinema && !isHotel;

  const [cinemaScreens, setCinemaScreens] = useState([]);
  const [cinemaSeats, setCinemaSeats] = useState([]);
  const [loadingCinema, setLoadingCinema] = useState(false);

  useEffect(() => {
    if (!isCinema || !token) return;
    let isMounted = true;
    const loadCinemaInventory = async () => {
      setLoadingCinema(true);
      try {
        const [screensRes, seatsRes] = await Promise.all([
          fetchCinemaScreens(token),
          fetchCinemaSeats(token)
        ]);
        if (isMounted) {
          if (screensRes && screensRes.screens) setCinemaScreens(screensRes.screens);
          if (seatsRes && seatsRes.seats) setCinemaSeats(seatsRes.seats);
        }
      } catch (err) {
        console.warn('Could not load cinema inventory for orders view:', err);
      } finally {
        if (isMounted) setLoadingCinema(false);
      }
    };
    loadCinemaInventory();
    return () => { isMounted = false; };
  }, [isCinema, token]);

  const validOrders = (Array.isArray(orders) ? orders : []).filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
  const safeServiceRequests = Array.isArray(serviceRequests) ? serviceRequests : [];

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'direct' | 'whatsapp' | 'manual'
  const [spaceCategoryFilter, setSpaceCategoryFilter] = useState('all');
  const [processingReqState, setProcessingReqState] = useState({});
  const [rejectingModalReq, setRejectingModalReq] = useState(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState('Customer not visible at table');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const parseOrderSpaceLocation = (order) => {
    if (!order) return { space_type: 'table', space_number: '' };
    const raw = String(order.table_number || '').trim();
    const expType = order.space_type ? String(order.space_type).toLowerCase() : null;

    if (/^cabin\s*#?\s*(\d+)/i.test(raw)) {
      const m = raw.match(/^cabin\s*#?\s*(\d+)/i);
      return { space_type: 'cabin', space_number: String(m[1]) };
    }
    if (/^vip\s*#?\s*(\d+)/i.test(raw)) {
      const m = raw.match(/^vip\s*#?\s*(\d+)/i);
      return { space_type: 'vip', space_number: String(m[1]) };
    }
    if (/^room\s*#?\s*(\d+)/i.test(raw)) {
      const m = raw.match(/^room\s*#?\s*(\d+)/i);
      return { space_type: 'room', space_number: String(m[1]) };
    }
    if (/^table\s*#?\s*(\d+)/i.test(raw)) {
      const m = raw.match(/^table\s*#?\s*(\d+)/i);
      return { space_type: 'table', space_number: String(m[1]) };
    }

    if (expType === 'cabin' || expType === 'vip' || expType === 'room' || expType === 'table') {
      const numOnly = raw.replace(/\D/g, '') || raw;
      return { space_type: expType, space_number: String(numOnly) };
    }

    const numOnly = raw.replace(/\D/g, '') || raw;
    return { space_type: isHotel ? 'room' : 'table', space_number: String(numOnly) };
  };

  const formatCleanTableLabel = (raw, spaceType) => {
    if (!raw) return isCinema ? 'Screen 1 • Seat 1' : isHotel ? 'Room 101' : 'Table 1';
    const str = String(raw).trim();
    
    if (isCinema) {
      return `🎬 ${str.toLowerCase().startsWith('screen') ? str : `Screen 1 • Seat ${str}`}`;
    }
    if (spaceType === 'room' || isHotel || /^room\s*#?\d+/i.test(str)) {
      return `🏨 ${str.toLowerCase().startsWith('room') ? str : `Room ${str}`}`;
    }
    if (spaceType === 'cabin' || /^cabin\s*#?\d+/i.test(str)) {
      return `🛋️ ${str.toLowerCase().startsWith('cabin') ? str : `Cabin ${str}`}`;
    }
    if (spaceType === 'vip' || /^vip\s*#?\d+/i.test(str)) {
      return `👑 ${str.toUpperCase()}`;
    }
    if (/^(takeaway|parcel|pickup)/i.test(str)) {
      return `🛍️ ${str}`;
    }
    return `🍽️ ${str.toLowerCase().startsWith('table') ? str : `Table ${str}`}`;
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diffMs = currentTime - new Date(timestamp).getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  };

  // Metrics
  const pendingCount = validOrders.filter(o => o.status === 'pending' || o.status === 'ordered').length;
  const kitchenCount = validOrders.filter(o => o.status === 'kitchen' || o.status === 'accepted' || o.status === 'preparing').length;
  const servedCount = validOrders.filter(o => o.status === 'served' || o.status === 'ready').length;
  const completedCount = validOrders.filter(o => o.status === 'completed').length;
  const todayTotalSales = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Filtered Orders
  const filteredOrders = validOrders.filter(o => {
    // Status Filter
    if (kotFilter === 'pending' && !(o.status === 'pending' || o.status === 'ordered')) return false;
    if (kotFilter === 'kitchen' && !(o.status === 'kitchen' || o.status === 'accepted' || o.status === 'preparing')) return false;
    if (kotFilter === 'served' && !(o.status === 'served' || o.status === 'ready')) return false;
    if (kotFilter === 'completed' && o.status !== 'completed') return false;

    // Source Filter
    if (sourceFilter === 'direct' && o.order_source !== 'direct_qr' && o.order_type !== 'direct') return false;
    if (sourceFilter === 'whatsapp' && o.order_source !== 'whatsapp') return false;
    if (sourceFilter === 'manual' && o.order_source !== 'pos' && o.order_source !== 'manual') return false;

    return true;
  });

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'ordered':
        return { label: 'PENDING', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
      case 'kitchen':
      case 'accepted':
      case 'preparing':
        return { label: 'PREPARING', bg: '#E0F2FE', color: '#0284C7', border: '#BAE6FD' };
      case 'served':
      case 'ready':
        return { label: 'READY', bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' };
      case 'completed':
        return { label: 'COMPLETED', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
      default:
        return { label: (status || 'UNKNOWN').toUpperCase(), bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' };
    }
  };

  // If online ordering is locked completely
  if (!ordersEnabled) {
    return (
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <PlanLockedCard
          featureKey="direct_ordering_enabled"
          featureName="Live Orders Operations"
          featureDescription="Real-time guest QR ordering, kitchen display, and digital POS management."
          requiredPlanName="Basic Plan or Higher"
          onUpgradeClick={() => onNavigateToSetup && onNavigateToSetup('subscription')}
        />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <style>{`
        .orders-metric-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .orders-table-wrapper {
          display: block;
        }
        .orders-mobile-cards {
          display: none;
        }
        @media (max-width: 900px) {
          .orders-metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }
          .orders-table-wrapper {
            display: none !important;
          }
          .orders-mobile-cards {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>

      {/* ========================================================
          1. MASTER HEADER & OPERATIONS SUB-NAV
         ======================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        background: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Live Orders Console
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#DCFCE7',
              color: '#16A34A',
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
              Live
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: '#64748B', margin: '3px 0 0 0' }}>
            {isCinema 
              ? 'Manage seat-based snacks and beverage deliveries.' 
              : isHotel 
                ? 'Manage in-room dining orders and room service.' 
                : 'Manage table orders, kitchen preparation, and customer bills.'}
          </p>
        </div>

        {/* Sub-Navigation Pills & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Live Orders Subtab */}
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('orders')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: activeSubTab === 'orders' ? '#0D3823' : '#E2E8F0',
              background: activeSubTab === 'orders' ? '#0D3823' : '#FFFFFF',
              color: activeSubTab === 'orders' ? '#FFFFFF' : '#334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <ShoppingBag size={15} />
            <span>Orders ({validOrders.length})</span>
          </button>

          {/* Service Requests Subtab */}
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('service-requests')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: activeSubTab === 'service-requests' ? '#0D3823' : '#E2E8F0',
              background: activeSubTab === 'service-requests' ? '#0D3823' : '#FFFFFF',
              color: activeSubTab === 'service-requests' ? '#FFFFFF' : '#334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Bell size={15} />
            <span>Service Calls {safeServiceRequests.length > 0 ? `(${safeServiceRequests.length})` : ''}</span>
          </button>

          {/* KDS Subtab */}
          <button
            onClick={() => {
              if (settingsForm?.kds_enabled || restaurantInfo?.kds_enabled) {
                window.open('/kds', '_blank');
              } else {
                setActiveSubTab && setActiveSubTab('kds');
              }
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ChefHat size={15} color="#D97706" />
            <span>Kitchen Display</span>
            <ArrowUpRight size={13} color="#94A3B8" />
          </button>
        </div>
      </div>

      {/* ========================================================
          2. ATTENTION SUMMARY (4 METRICS)
         ======================================================== */}
      <div className="orders-metric-grid">
        {/* Needs Attention (Pending) */}
        <div 
          onClick={() => setKotFilter('pending')}
          style={{
            background: kotFilter === 'pending' ? '#FEF3C7' : '#FFFFFF',
            borderRadius: '16px',
            border: kotFilter === 'pending' ? '2px solid #D97706' : '1px solid #E2E8F0',
            padding: '18px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#FEF3C7',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Needs Attention</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {pendingCount}
            </div>
            <span style={{ fontSize: '0.68rem', color: pendingCount > 0 ? '#D97706' : '#16A34A', fontWeight: 700 }}>
              {pendingCount > 0 ? 'Pending acceptance' : 'All clear'}
            </span>
          </div>
        </div>

        {/* Preparing */}
        <div 
          onClick={() => setKotFilter('kitchen')}
          style={{
            background: kotFilter === 'kitchen' ? '#E0F2FE' : '#FFFFFF',
            borderRadius: '16px',
            border: kotFilter === 'kitchen' ? '2px solid #0284C7' : '1px solid #E2E8F0',
            padding: '18px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#E0F2FE',
            color: '#0284C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Preparing</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {kitchenCount}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#0284C7', fontWeight: 700 }}>
              In kitchen prep
            </span>
          </div>
        </div>

        {/* Ready */}
        <div 
          onClick={() => setKotFilter('served')}
          style={{
            background: kotFilter === 'served' ? '#DCFCE7' : '#FFFFFF',
            borderRadius: '16px',
            border: kotFilter === 'served' ? '2px solid #16A34A' : '1px solid #E2E8F0',
            padding: '18px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#DCFCE7',
            color: '#16A34A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Ready to Bill</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {servedCount}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#16A34A', fontWeight: 700 }}>
              Served / Ready
            </span>
          </div>
        </div>

        {/* Completed Today */}
        <div 
          onClick={() => setKotFilter('completed')}
          style={{
            background: kotFilter === 'completed' ? '#F3E8FF' : '#FFFFFF',
            borderRadius: '16px',
            border: kotFilter === 'completed' ? '2px solid #7E22CE' : '1px solid #E2E8F0',
            padding: '18px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: '#F3E8FF',
            color: '#7E22CE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Completed Today</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
              {completedCount}
            </div>
            <span style={{ fontSize: '0.68rem', color: '#7E22CE', fontWeight: 700 }}>
              {currencySymbol}{Math.round(todayTotalSales).toLocaleString('en-IN')} sales
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. FILTER CONTROL STRIP
         ======================================================== */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${validOrders.length})` },
            { id: 'pending', label: `Pending (${pendingCount})` },
            { id: 'kitchen', label: `Preparing (${kitchenCount})` },
            { id: 'served', label: `Ready (${servedCount})` },
            { id: 'completed', label: `Completed (${completedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setKotFilter(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: kotFilter === tab.id ? '1px solid #0D3823' : '1px solid transparent',
                background: kotFilter === tab.id ? '#0D3823' : '#F8FAFC',
                color: kotFilter === tab.id ? '#FFFFFF' : '#475569',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Source Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>Source:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#0F172A',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <option value="all">All Sources</option>
            <option value="direct">Direct QR</option>
            <option value="whatsapp">WhatsApp Orders</option>
            <option value="manual">Manual POS</option>
          </select>
        </div>
      </div>

      {/* ========================================================
          4. MAIN LIVE ORDER WORKSPACE (DESKTOP HYBRID + MOBILE)
         ======================================================== */}
      {filteredOrders.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #E2E8F0',
          padding: '48px 24px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#F1F5F9',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <ShoppingBag size={24} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
            No orders found
          </h3>
          <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 20px 0', maxWidth: '400px', marginInline: 'auto' }}>
            {kotFilter !== 'all' 
              ? `There are currently no orders in '${kotFilter}' state.` 
              : 'Customer QR orders and manual POS bills will automatically appear here.'}
          </p>
          {kotFilter !== 'all' && (
            <button
              onClick={() => setKotFilter('all')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Show All Orders
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="orders-table-wrapper" style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px' }}>ORDER</th>
                  <th style={{ padding: '14px 18px' }}>LOCATION</th>
                  <th style={{ padding: '14px 18px' }}>TIME</th>
                  <th style={{ padding: '14px 18px' }}>ITEMS</th>
                  <th style={{ padding: '14px 18px' }}>TOTAL</th>
                  <th style={{ padding: '14px 18px' }}>STATUS</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const items = safeParseItems(order.items);
                  const spaceInfo = parseOrderSpaceLocation(order);
                  const cleanLoc = formatCleanTableLabel(order.table_number, spaceInfo.space_type);
                  const statusInfo = getStatusBadge(order.status);
                  const isPending = order.status === 'pending' || order.status === 'ordered';
                  const isKitchen = order.status === 'kitchen' || order.status === 'accepted' || order.status === 'preparing';
                  const isReady = order.status === 'served' || order.status === 'ready';

                  return (
                    <tr 
                      key={order.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Order # & Source */}
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: '#0F172A' }}>
                        <div>#{order.id}</div>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
                          {order.order_source === 'whatsapp' ? '💬 WhatsApp' : order.order_source === 'pos' ? '🖥️ POS' : '📱 QR Order'}
                        </span>
                      </td>

                      {/* Location */}
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0F172A' }}>
                        {cleanLoc}
                      </td>

                      {/* Time */}
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '0.76rem' }}>
                        {getTimeAgo(order.created_at)}
                      </td>

                      {/* Items */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>
                          {items.length} item{items.length > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {items.map(i => `${i.quantity || 1}x ${i.name}`).join(', ')}
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '14px 18px', fontWeight: 900, color: '#0F172A', fontSize: '0.90rem' }}>
                        {currencySymbol}{Math.round(order.total_amount || order.total || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          border: `1px solid ${statusInfo.border}`,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          letterSpacing: '0.02em'
                        }}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {isPending && (
                            <button
                              onClick={() => onUpdateStatus ? onUpdateStatus(order.id, 'kitchen') : null}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: '#16A34A',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              ⚡ Accept
                            </button>
                          )}

                          {isKitchen && (
                            <button
                              onClick={() => onUpdateStatus ? onUpdateStatus(order.id, 'served') : null}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: '#0284C7',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              ✓ Ready
                            </button>
                          )}

                          {isReady && (
                            <button
                              onClick={() => onOpenBillModal ? onOpenBillModal(order) : (onUpdateStatus && onUpdateStatus(order.id, 'completed'))}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: '#7E22CE',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              💳 Bill
                            </button>
                          )}

                          {/* Print KOT */}
                          <button
                            onClick={() => onDirectPrint ? onDirectPrint(order, 'kot') : null}
                            style={{
                              padding: '6px 8px',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              background: '#FFFFFF',
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                            title="Print KOT"
                          >
                            <Printer size={14} />
                          </button>

                          {/* Open Details */}
                          <button
                            onClick={() => setSelectedOrder(order)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              background: '#F8FAFC',
                              color: '#0F172A',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE ORDER CARDS VIEW */}
          <div className="orders-mobile-cards">
            {filteredOrders.map(order => {
              const items = safeParseItems(order.items);
              const spaceInfo = parseOrderSpaceLocation(order);
              const cleanLoc = formatCleanTableLabel(order.table_number, spaceInfo.space_type);
              const statusInfo = getStatusBadge(order.status);
              const isPending = order.status === 'pending' || order.status === 'ordered';
              const isKitchen = order.status === 'kitchen' || order.status === 'accepted' || order.status === 'preparing';
              const isReady = order.status === 'served' || order.status === 'ready';

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Top Bar: Order ID + Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#0F172A' }}>#{order.id}</strong>
                      <span style={{ fontSize: '0.70rem', color: '#64748B', marginLeft: '6px' }}>
                        {getTimeAgo(order.created_at)}
                      </span>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '8px',
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      border: `1px solid ${statusInfo.border}`,
                      fontSize: '0.66rem',
                      fontWeight: 800
                    }}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Location & Source */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{cleanLoc}</span>
                    <span style={{ color: '#64748B', fontSize: '0.72rem' }}>
                      {order.order_source === 'whatsapp' ? '💬 WhatsApp' : order.order_source === 'pos' ? '🖥️ POS' : '📱 Direct QR'}
                    </span>
                  </div>

                  {/* Items List */}
                  <div style={{
                    background: '#F8FAFC',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '0.76rem',
                    color: '#334155',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {items.map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{it.quantity || 1}x {it.name}</span>
                        <strong style={{ color: '#0F172A' }}>{currencySymbol}{Math.round((it.price || 0) * (it.quantity || 1))}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Total & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', display: 'block' }}>Total Amount</span>
                      <strong style={{ fontSize: '1.1rem', color: '#0F172A' }}>
                        {currencySymbol}{Math.round(order.total_amount || order.total || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isPending && (
                        <button
                          onClick={() => onUpdateStatus ? onUpdateStatus(order.id, 'kitchen') : null}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            background: '#16A34A',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ⚡ Accept
                        </button>
                      )}

                      {isKitchen && (
                        <button
                          onClick={() => onUpdateStatus ? onUpdateStatus(order.id, 'served') : null}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            background: '#0284C7',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Ready
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => onOpenBillModal ? onOpenBillModal(order) : (onUpdateStatus && onUpdateStatus(order.id, 'completed'))}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            background: '#7E22CE',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          💳 Bill
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedOrder(order)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          background: '#F8FAFC',
                          color: '#0F172A',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ========================================================
          5. LUXURY ORDER DETAILS SLIDE-OVER DRAWER
         ======================================================== */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 35, 21, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            background: '#FFFFFF',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Order #{selectedOrder.id}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  {new Date(selectedOrder.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • {formatCleanTableLabel(selectedOrder.table_number, selectedOrder.space_type)}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Status Pill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>Order Status:</span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  background: getStatusBadge(selectedOrder.status).bg,
                  color: getStatusBadge(selectedOrder.status).color,
                  fontWeight: 800,
                  fontSize: '0.72rem'
                }}>
                  {getStatusBadge(selectedOrder.status).label}
                </span>
              </div>

              {/* Itemized Dishes */}
              <div>
                <h4 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0' }}>
                  Order Items
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {safeParseItems(selectedOrder.items).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div>
                        <strong style={{ fontSize: '0.82rem', color: '#0F172A' }}>{item.quantity || 1}x {item.name}</strong>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div style={{ fontSize: '0.70rem', color: '#64748B' }}>
                            {item.modifiers.map(m => m.name || m).join(', ')}
                          </div>
                        )}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0F172A' }}>
                        {currencySymbol}{Math.round((item.price || 0) * (item.quantity || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill Breakdown */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748B', marginBottom: '6px' }}>
                  <span>Subtotal</span>
                  <span>{currencySymbol}{Math.round(selectedOrder.subtotal || selectedOrder.total_amount || 0)}</span>
                </div>
                {selectedOrder.gst_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748B', marginBottom: '6px' }}>
                    <span>GST (Tax)</span>
                    <span>{currencySymbol}{Math.round(selectedOrder.gst_amount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Total Amount</span>
                  <span>{currencySymbol}{Math.round(selectedOrder.total_amount || selectedOrder.total || 0)}</span>
                </div>
              </div>

              {/* Print Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => onDirectPrint ? onDirectPrint(selectedOrder, 'kot') : null}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Printer size={15} />
                  <span>Print KOT</span>
                </button>
                <button
                  onClick={() => onPrintBill ? onPrintBill(selectedOrder, 'cash') : null}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Receipt size={15} />
                  <span>Print Bill</span>
                </button>
              </div>
            </div>

            {/* Bottom State Transition CTA */}
            <div style={{ padding: '18px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              {(selectedOrder.status === 'pending' || selectedOrder.status === 'ordered') && (
                <button
                  onClick={() => {
                    if (onUpdateStatus) onUpdateStatus(selectedOrder.id, 'kitchen');
                    setSelectedOrder(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  Accept & Send to Kitchen
                </button>
              )}

              {(selectedOrder.status === 'kitchen' || selectedOrder.status === 'accepted' || selectedOrder.status === 'preparing') && (
                <button
                  onClick={() => {
                    if (onUpdateStatus) onUpdateStatus(selectedOrder.id, 'served');
                    setSelectedOrder(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#0284C7',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  Mark Order as Ready / Served
                </button>
              )}

              {(selectedOrder.status === 'served' || selectedOrder.status === 'ready') && (
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    if (onOpenBillModal) onOpenBillModal(selectedOrder);
                    else if (onUpdateStatus) onUpdateStatus(selectedOrder.id, 'completed');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#7E22CE',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(126, 34, 206, 0.3)'
                  }}
                >
                  Generate Bill & Complete Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
