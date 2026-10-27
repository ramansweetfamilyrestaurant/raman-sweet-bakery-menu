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
import { resolveBusinessProfile, getBusinessTerminology } from '../../../utils/businessTaxonomy';
import { fetchCinemaScreens, fetchCinemaSeats } from '../../../api/client';
import { triggerBillAction, safeParseModifiers, safeParseItems, calculateBillDetails } from '../../../utils/billingHelper';

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
  capabilities = {},
  token = null,
  onNavigateToSetup = null
}) {
  // Authoritative KDS entitlement (strictly respects plan capability logic, prevents stale local override from bypassing plan lock)
  const isKdsEntitled = capabilities && capabilities.kds_enabled !== undefined
    ? Boolean(capabilities.kds_enabled)
    : Boolean(restaurantInfo?.kds_enabled);

  const handleTriggerBillAction = (order) => {
    triggerBillAction(order, onOpenBillModal);
  };

  const profile = resolveBusinessProfile(restaurantInfo || settingsForm || {});
  const terminology = useMemo(() => getBusinessTerminology(restaurantInfo || settingsForm || {}), [restaurantInfo, settingsForm]);
  const effectiveBiz = profile?.business_type || settingsForm?.business_type || restaurantInfo?.business_type;
  const effectiveService = profile?.service_model || settingsForm?.service_model || restaurantInfo?.service_model;
  const isCinema = effectiveBiz === 'cinema_theatre' || effectiveService === 'cinema' || effectiveService === 'seat_service';
  const isHotel = effectiveBiz === 'hotel_resort' || effectiveBiz === 'hotel' || effectiveService === 'hotel' || effectiveService === 'in_room_dining';
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

  const isOrderCompleted = (order) => {
    if (!order) return false;
    return Boolean(
      order.status === 'completed' ||
      order.is_settled === 1 ||
      order.is_settled === '1' ||
      order.is_settled === true
    );
  };

  // Authoritative Session Details mapping for all active orders (aggregates multi-round sessions)
  const sessionDetailsMap = useMemo(() => {
    const map = new Map();
    validOrders.forEach(ord => {
      try {
        const details = calculateBillDetails(ord, validOrders, restaurantInfo, settingsForm);
        map.set(ord.id, details);
      } catch (_) {
        map.set(ord.id, {
          sessionOrders: [ord],
          totalRoundsCount: 1,
          isMultiRound: Boolean(Number(ord.round_number) > 1),
          grandTotal: Number(ord.total_amount || 0)
        });
      }
    });
    return map;
  }, [validOrders, restaurantInfo, settingsForm]);

  const handleRejectOrder = (order) => {
    if (!order) return;
    const loc = formatCleanTableLabel(order.table_number, order.space_type) || `Order #${order.id}`;
    const confirmed = window.confirm(`Are you sure you want to REJECT and cancel Order #${order.id} (${loc})?`);
    if (!confirmed) return;
    if (onUpdateStatus) {
      onUpdateStatus(order.id, 'rejected');
    }
  };

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'direct' | 'whatsapp' | 'manual'
  const [spaceCategoryFilter, setSpaceCategoryFilter] = useState('all');
  const [processingReqState, setProcessingReqState] = useState({});
  const [rejectingModalReq, setRejectingModalReq] = useState(null);
  const defaultRejectReason = isHotel 
    ? 'Guest not reachable in room' 
    : isCinema 
      ? 'Customer not present at seat' 
      : ['bakery_confectionery', 'sweet_shop', 'fast_food_qsr', 'cloud_kitchen'].includes(effectiveBiz) 
        ? 'Customer not at pickup counter' 
        : 'Customer not visible at table';
  const [selectedRejectReason, setSelectedRejectReason] = useState(defaultRejectReason);
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

    if (raw.toLowerCase() === 'counter' || expType === 'counter') {
      return { space_type: 'counter', space_number: 'COUNTER' };
    }
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

  const parseServiceReqSpaceLocation = (req) => {
    if (!req) return { space_type: 'table', space_number: '' };
    const raw = String(req.table_number || '').trim();
    const expType = req.space_type ? String(req.space_type).toLowerCase() : null;

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

  // ----------------------------------------------------
  // PHYSICAL SPACE INVENTORY & LIVE OCCUPANCY MAP
  // ----------------------------------------------------
  const spaceInventory = useMemo(() => {
    if (isCinema) return [];
    if (isHotel) {
      const rawRooms = restaurantInfo?.total_rooms ?? settingsForm?.total_rooms;
      const roomCount = (rawRooms !== undefined && rawRooms !== null && !isNaN(Number(rawRooms)))
        ? Math.max(0, Math.floor(Number(rawRooms)))
        : 0;
      return Array.from({ length: roomCount }, (_, i) => {
        const num = String(i + 1);
        return {
          id: `room_${num}`,
          space_type: 'room',
          space_number: num,
          category: 'room',
          label: `ROOM ${num}`,
          displayLabel: `🏨 ROOM ${num}`,
          icon: '🏨',
          prefix: 'Room'
        };
      });
    }

    // Standard Dining: Tables + Cabins + VIP
    const rawT = restaurantInfo?.total_tables ?? settingsForm?.total_tables;
    const cCount = Number(restaurantInfo?.total_cabins ?? settingsForm?.total_cabins) || 0;
    const vCount = Number(restaurantInfo?.total_vip ?? settingsForm?.total_vip) || 0;
    const tCount = (rawT === undefined || rawT === null || isNaN(Number(rawT))) && cCount === 0 && vCount === 0
      ? 10
      : (Number(rawT) || 0);

    const spaces = [];

    // 1. Tables
    for (let i = 1; i <= tCount; i++) {
      const num = String(i);
      spaces.push({
        id: `table_${num}`,
        space_type: 'table',
        space_number: num,
        category: 'table',
        label: `TABLE ${num}`,
        displayLabel: `🍽️ TABLE ${num}`,
        icon: '🍽️',
        prefix: 'Table'
      });
    }

    // 2. Cabins
    for (let i = 1; i <= cCount; i++) {
      const num = String(i);
      spaces.push({
        id: `cabin_${num}`,
        space_type: 'cabin',
        space_number: num,
        category: 'cabin',
        label: `CABIN ${num}`,
        displayLabel: `🛋️ CABIN ${num}`,
        icon: '🛋️',
        prefix: 'Cabin'
      });
    }

    // 3. VIP Lounges
    for (let i = 1; i <= vCount; i++) {
      const num = String(i);
      spaces.push({
        id: `vip_${num}`,
        space_type: 'vip',
        space_number: num,
        category: 'vip',
        label: `VIP ${num}`,
        displayLabel: `👑 VIP ${num}`,
        icon: '👑',
        prefix: 'VIP'
      });
    }

    // 4. Billing Counter (when enabled or for counter-first verticals)
    const isCounterEnabled = Boolean(
      settingsForm?.counter_ordering_enabled === 1 ||
      settingsForm?.counter_ordering_enabled === true ||
      settingsForm?.counter_ordering_enabled === '1' ||
      restaurantInfo?.counter_ordering_enabled === 1 ||
      restaurantInfo?.counter_ordering_enabled === true ||
      restaurantInfo?.counter_ordering_enabled === '1' ||
      ['bakery_confectionery', 'sweet_shop', 'fast_food_qsr', 'cloud_kitchen', 'food_truck'].includes(effectiveBiz)
    );

    if (isCounterEnabled) {
      spaces.push({
        id: 'counter_COUNTER',
        space_type: 'counter',
        space_number: 'COUNTER',
        category: 'counter',
        label: 'COUNTER',
        displayLabel: '🧾 COUNTER',
        icon: '🧾',
        prefix: 'Counter'
      });
    }

    return spaces;
  }, [isCinema, isHotel, effectiveBiz, restaurantInfo?.total_tables, settingsForm?.total_tables, restaurantInfo?.total_cabins, settingsForm?.total_cabins, restaurantInfo?.total_vip, settingsForm?.total_vip, restaurantInfo?.total_rooms, settingsForm?.total_rooms, restaurantInfo?.counter_ordering_enabled, settingsForm?.counter_ordering_enabled]);

  // Operational State mapping per physical space
  const spaceGrid = useMemo(() => {
    return spaceInventory.map(space => {
      const spaceActiveOrders = validOrders.filter(o => {
        if (isOrderCompleted(o) || o.status === 'rejected' || o.status === 'cancelled') return false;
        const loc = parseOrderSpaceLocation(o);
        return loc.space_type === space.space_type && String(loc.space_number) === String(space.space_number);
      });

      const activeOrder = spaceActiveOrders.length > 0 ? spaceActiveOrders[0] : null;

      const serviceReq = safeServiceRequests.find(s => {
        const loc = parseServiceReqSpaceLocation(s);
        return loc.space_type === space.space_type && String(loc.space_number) === String(space.space_number);
      });

      let status = 'free';
      if (serviceReq) {
        status = 'call';
      } else if (spaceActiveOrders.length > 0) {
        const allServed = spaceActiveOrders.every(o => o.status === 'served');
        const anyReady = spaceActiveOrders.some(o => o.status === 'served' || o.kitchen_prepared === 1 || o.kitchen_prepared === '1' || o.kitchen_prepared === true);
        if (allServed) {
          status = 'served';
        } else if (anyReady) {
          status = 'ready';
        } else {
          status = 'order_active';
        }
      }

      const spaceSessionTotal = spaceActiveOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      return {
        ...space,
        status,
        activeOrder,
        activeOrders: spaceActiveOrders,
        sessionTotal: spaceSessionTotal,
        serviceRequest: serviceReq
      };
    });
  }, [spaceInventory, validOrders, safeServiceRequests, isHotel]);

  // Summary operational counters
  const summaryCounters = useMemo(() => {
    let free = 0;
    let activeOrders = 0;
    let calls = 0;
    let ready = 0;
    let served = 0;

    spaceGrid.forEach(s => {
      if (s.status === 'free') free++;
      else if (s.status === 'call') calls++;
      else if (s.status === 'ready') ready++;
      else if (s.status === 'served') served++;
      else if (s.status === 'order_active') activeOrders++;
    });

    return { free, activeOrders, calls, ready, served, total: spaceGrid.length };
  }, [spaceGrid]);

  const filteredSpaceGrid = useMemo(() => {
    if (spaceCategoryFilter === 'all') return spaceGrid;
    return spaceGrid.filter(s => s.category === spaceCategoryFilter);
  }, [spaceGrid, spaceCategoryFilter]);

  const handleApprove = async (req) => {
    if (!req || !onApprovePresenceRequest) return;
    setProcessingReqState(prev => ({ ...prev, [req.id]: 'approving' }));
    try {
      await onApprovePresenceRequest(req.id, req);
    } finally {
      setProcessingReqState(prev => ({ ...prev, [req.id]: null }));
    }
  };

  const handleOpenRejectModal = (req) => {
    setRejectingModalReq(req);
    setSelectedRejectReason(defaultRejectReason);
    setCustomRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingModalReq || !onRejectPresenceRequest) return;
    const finalReason = selectedRejectReason === 'Other' ? (customRejectReason.trim() || 'Presence check rejected by admin') : selectedRejectReason;
    const reqId = rejectingModalReq.id;
    setProcessingReqState(prev => ({ ...prev, [reqId]: 'rejecting' }));
    try {
      await onRejectPresenceRequest(reqId, finalReason, rejectingModalReq);
      setRejectingModalReq(null);
    } finally {
      setProcessingReqState(prev => ({ ...prev, [reqId]: null }));
    }
  };

  const formatCleanTableLabel = (raw, spaceType) => {
    if (!raw) return isCinema ? 'Screen 1 • Seat 1' : isHotel ? 'Room 101' : 'Table 1';
    const str = String(raw).trim();
    
    if (spaceType === 'counter' || str.toLowerCase() === 'counter' || str.toLowerCase() === 'counter:counter') {
      return '⚡ Counter';
    }
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

  // Metrics (Strictly unifies multi-round session settlement)
  const pendingCount = validOrders.filter(o => !isOrderCompleted(o) && (o.status === 'pending' || o.status === 'ordered')).length;
  const kitchenCount = validOrders.filter(o => !isOrderCompleted(o) && (o.status === 'kitchen' || o.status === 'accepted' || o.status === 'preparing')).length;
  const servedCount = validOrders.filter(o => !isOrderCompleted(o) && (o.status === 'served' || o.status === 'ready')).length;
  const completedCount = validOrders.filter(o => isOrderCompleted(o)).length;
  const completedSales = validOrders.filter(o => isOrderCompleted(o)).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const getOrderSourceDisplay = (order) => {
    const src = String(order?.order_source || order?.order_type || '').toLowerCase();
    if (src === 'whatsapp') return '💬 WhatsApp';
    if (src === 'pos' || src === 'manual') return '🖥️ POS';
    return '📱 Direct QR';
  };

  // Filtered Orders
  const filteredOrders = validOrders.filter(o => {
    const isDone = isOrderCompleted(o);
    // Status Filter
    if (kotFilter === 'pending' && (isDone || !(o.status === 'pending' || o.status === 'ordered'))) return false;
    if (kotFilter === 'kitchen' && (isDone || !(o.status === 'kitchen' || o.status === 'accepted' || o.status === 'preparing'))) return false;
    if (kotFilter === 'served' && (isDone || !(o.status === 'served' || o.status === 'ready'))) return false;
    if (kotFilter === 'completed' && !isDone) return false;

    // Source Filter
    const src = String(o.order_source || o.order_type || '').toLowerCase();
    if (sourceFilter === 'direct') {
      const isDirect = !src || src === 'direct_qr' || src === 'direct' || src === 'qr';
      if (!isDirect) return false;
    }
    if (sourceFilter === 'whatsapp') {
      if (src !== 'whatsapp') return false;
    }
    if (sourceFilter === 'manual') {
      const isManual = src === 'pos' || src === 'manual';
      if (!isManual) return false;
    }

    return true;
  });

  const getStatusBadge = (orderOrStatus) => {
    const isObj = orderOrStatus && typeof orderOrStatus === 'object';
    const status = isObj ? orderOrStatus.status : orderOrStatus;
    const isSettled = isObj && Boolean(orderOrStatus.is_settled === 1 || orderOrStatus.is_settled === '1' || orderOrStatus.is_settled === true);
    if (isSettled || status === 'completed') {
      return { label: 'COMPLETED', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
    }
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
                : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz)
                  ? 'Manage counter takeaway, packing, and customer billing.'
                  : 'Manage space orders, kitchen preparation, and customer bills.'}
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
              borderColor: activeSubTab === 'orders' ? '#261B14' : '#E2E8F0',
              background: activeSubTab === 'orders' ? '#261B14' : '#FFFFFF',
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

          {/* Floor / Fleet Tables Map Subtab */}
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('floor-map')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: activeSubTab === 'floor-map' ? '#261B14' : '#E2E8F0',
              background: activeSubTab === 'floor-map' ? '#261B14' : '#FFFFFF',
              color: activeSubTab === 'floor-map' ? '#FFFFFF' : '#334155',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <MapPin size={15} />
            <span>{isCinema ? `Seats Map (${cinemaSeats.length})` : isHotel ? `Room Status (${spaceInventory.length})` : ['bakery_confectionery', 'sweet_shop', 'fast_food_qsr', 'cloud_kitchen'].includes(effectiveBiz) ? `Space & Counters (${spaceInventory.length})` : `Tables Map (${spaceInventory.length})`}</span>
          </button>

          {/* Service Requests Subtab */}
          <button
            onClick={() => setActiveSubTab && setActiveSubTab('service-requests')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: activeSubTab === 'service-requests' ? '#261B14' : '#E2E8F0',
              background: activeSubTab === 'service-requests' ? '#261B14' : '#FFFFFF',
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
              if (isKdsEntitled) {
                const currentSlug = restaurantInfo?.slug || settingsForm?.slug || '';
                window.open(currentSlug ? `/${currentSlug}/kitchen` : '/kitchen', '_blank');
              } else if (onNavigateToSetup) {
                onNavigateToSetup('subscription');
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
            <span>{isCinema ? 'Concession Display' : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz) ? 'Dispatch Display' : 'Kitchen Display'}</span>
            <ArrowUpRight size={13} color="#94A3B8" />
          </button>
        </div>
      </div>

      {/* ========================================================
          2. LIVE ORDERS SUBTAB (ORDERS METRICS + TABLE + CARDS)
         ======================================================== */}
      {(activeSubTab === 'orders' || !['floor-map', 'service-requests', 'kds'].includes(activeSubTab)) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              In prep / kitchen
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
              {currencySymbol}{Math.round(completedSales).toLocaleString('en-IN')} sales
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
                  const isDone = isOrderCompleted(order);
                  const statusInfo = getStatusBadge(order);
                  const isPending = !isDone && (order.status === 'pending' || order.status === 'ordered');
                  const isKitchen = !isDone && (order.status === 'kitchen' || order.status === 'accepted' || order.status === 'preparing');
                  const isReady = !isDone && (order.status === 'served' || order.status === 'ready');
                  const sessionInfo = sessionDetailsMap.get(order.id) || {
                    sessionOrders: [order],
                    totalRoundsCount: 1,
                    isMultiRound: Boolean(Number(order.round_number) > 1),
                    grandTotal: Number(order.total_amount || 0)
                  };
                  const roundNum = Number(order.round_number) || (sessionInfo.isMultiRound ? 1 : 1);
                  const isAddonRound = roundNum > 1;
                  const isMultiRoundSession = sessionInfo.isMultiRound;

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>#{order.id}</span>
                          {isAddonRound ? (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FDE68A',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              whiteSpace: 'nowrap'
                            }}>
                              🔄 Round {roundNum} (Add-on)
                            </span>
                          ) : isMultiRoundSession ? (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: '#E0F2FE',
                              color: '#0369A1',
                              border: '1px solid #BAE6FD',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              whiteSpace: 'nowrap'
                            }}>
                              Round 1
                            </span>
                          ) : null}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>
                          {getOrderSourceDisplay(order)}
                        </span>
                      </td>

                      {/* Location */}
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0F172A' }}>
                        <div>{cleanLoc}</div>
                        {isMultiRoundSession && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '3px',
                            fontSize: '0.66rem',
                            color: '#0369A1',
                            background: '#F0F9FF',
                            border: '1px solid #BAE6FD',
                            padding: '1px 6px',
                            borderRadius: '5px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                          }}>
                            <span>🔗 Session ({sessionInfo.totalRoundsCount} Rds • {currencySymbol}{Math.round(sessionInfo.grandTotal).toLocaleString('en-IN')})</span>
                          </div>
                        )}
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
                          {items.map(i => `${i.quantity || 1}x ${i.name}${i.portion ? ` (${i.portion})` : ''}`).join(', ')}
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
                            <>
                              <button
                                onClick={() => {
                                  const isCounter = (String(order?.table_number || '').trim().toLowerCase() === 'counter') || (String(order?.space_type || '').trim().toLowerCase() === 'counter');
                                  if (isCounter) {
                                    if (onOpenAcceptRouting) {
                                      onOpenAcceptRouting(order);
                                    }
                                    return;
                                  }
                                  if (onUpdateStatus) {
                                    onUpdateStatus(order.id, 'kitchen');
                                  }
                                }}
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
                              <button
                                onClick={() => handleRejectOrder(order)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  background: '#FEE2E2',
                                  color: '#DC2626',
                                  border: '1px solid #FCA5A5',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                                title="Reject & Cancel Order"
                              >
                                ✕ Reject
                              </button>
                            </>
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
                              onClick={() => handleTriggerBillAction(order)}
                              disabled={!onOpenBillModal}
                              title={!onOpenBillModal ? 'Billing modal unavailable' : isMultiRoundSession ? `Combined Bill for all ${sessionInfo.totalRoundsCount} rounds of this session (${currencySymbol}${Math.round(sessionInfo.grandTotal)})` : 'Open Bill & Settle Payment'}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                background: onOpenBillModal ? '#7E22CE' : '#9CA3AF',
                                color: '#FFFFFF',
                                border: 'none',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: onOpenBillModal ? 'pointer' : 'not-allowed',
                                opacity: onOpenBillModal ? 1 : 0.6
                              }}
                            >
                              {isMultiRoundSession ? `💳 Bill (${sessionInfo.totalRoundsCount} Rds)` : '💳 Bill'}
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

                          {/* Print Bill (for completed/settled orders) */}
                          {(order.status === 'completed' || order.is_settled === 1) && (
                            <button
                              onClick={() => onPrintBill ? onPrintBill(order, order.payment_method || 'CASH') : null}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0',
                                background: '#FFFFFF',
                                color: '#7E22CE',
                                cursor: 'pointer'
                              }}
                              title="Print / Re-print Bill Receipt"
                            >
                              <Receipt size={14} />
                            </button>
                          )}

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
              const isDone = isOrderCompleted(order);
              const statusInfo = getStatusBadge(order);
              const isPending = !isDone && (order.status === 'pending' || order.status === 'ordered');
              const isKitchen = !isDone && (order.status === 'kitchen' || order.status === 'accepted' || order.status === 'preparing');
              const isReady = !isDone && (order.status === 'served' || order.status === 'ready');
              const sessionInfo = sessionDetailsMap.get(order.id) || {
                sessionOrders: [order],
                totalRoundsCount: 1,
                isMultiRound: Boolean(Number(order.round_number) > 1),
                grandTotal: Number(order.total_amount || 0)
              };
              const roundNum = Number(order.round_number) || (sessionInfo.isMultiRound ? 1 : 1);
              const isAddonRound = roundNum > 1;
              const isMultiRoundSession = sessionInfo.isMultiRound;

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
                  {/* Top Bar: Order ID + Round Badge + Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#0F172A' }}>#{order.id}</strong>
                      {isAddonRound ? (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: '#FEF3C7',
                          color: '#B45309',
                          border: '1px solid #FDE68A',
                          fontSize: '0.64rem',
                          fontWeight: 800
                        }}>
                          🔄 Round {roundNum} (Add-on)
                        </span>
                      ) : isMultiRoundSession ? (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: '#E0F2FE',
                          color: '#0369A1',
                          border: '1px solid #BAE6FD',
                          fontSize: '0.64rem',
                          fontWeight: 800
                        }}>
                          Round 1
                        </span>
                      ) : null}
                      <span style={{ fontSize: '0.70rem', color: '#64748B', marginLeft: '4px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>{cleanLoc}</span>
                      {isMultiRoundSession && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '3px',
                          fontSize: '0.66rem',
                          color: '#0369A1',
                          background: '#F0F9FF',
                          border: '1px solid #BAE6FD',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          fontWeight: 700
                        }}>
                          <span>🔗 Session ({sessionInfo.totalRoundsCount} Rds • {currencySymbol}{Math.round(sessionInfo.grandTotal).toLocaleString('en-IN')})</span>
                        </div>
                      )}
                    </div>
                    <span style={{ color: '#64748B', fontSize: '0.72rem' }}>
                      {getOrderSourceDisplay(order)}
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
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{it.quantity || 1}x {it.name}</span>
                          {it.portion && (
                            <span style={{ fontSize: '0.66rem', color: '#0F766E', background: '#CCFBF1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              {it.portion}
                            </span>
                          )}
                        </div>
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
                        <>
                          <button
                            onClick={() => {
                              const isCounter = (String(order?.table_number || '').trim().toLowerCase() === 'counter') || (String(order?.space_type || '').trim().toLowerCase() === 'counter');
                              if (isCounter) {
                                if (onOpenAcceptRouting) {
                                  onOpenAcceptRouting(order);
                                }
                                return;
                              }
                              if (onUpdateStatus) {
                                onUpdateStatus(order.id, 'kitchen');
                              }
                            }}
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
                          <button
                            onClick={() => handleRejectOrder(order)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '10px',
                              background: '#FEE2E2',
                              color: '#DC2626',
                              border: '1px solid #FCA5A5',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                            title="Reject Order"
                          >
                            ✕ Reject
                          </button>
                        </>
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
                          onClick={() => handleTriggerBillAction(order)}
                          disabled={!onOpenBillModal}
                          title={!onOpenBillModal ? 'Billing modal unavailable' : isMultiRoundSession ? `Combined Bill for all ${sessionInfo.totalRoundsCount} rounds (${currencySymbol}${Math.round(sessionInfo.grandTotal)})` : 'Open Bill & Settle Payment'}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            background: onOpenBillModal ? '#7E22CE' : '#9CA3AF',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: onOpenBillModal ? 'pointer' : 'not-allowed',
                            opacity: onOpenBillModal ? 1 : 0.6
                          }}
                        >
                          {isMultiRoundSession ? `💳 Bill (${sessionInfo.totalRoundsCount} Rds)` : '💳 Bill'}
                        </button>
                      )}

                      {(order.status === 'completed' || order.is_settled === 1) && (
                        <button
                          onClick={() => onPrintBill ? onPrintBill(order, order.payment_method || 'CASH') : null}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            color: '#7E22CE',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Print / Re-print Bill Receipt"
                        >
                          <Receipt size={14} /> Bill
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
    </div>
  )}

      {/* ========================================================
          3. FLOOR / FLEET SPACE MAP (TABLES, CABINS, VIP, ROOMS)
         ======================================================== */}
      {activeSubTab === 'floor-map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary Operational Counters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px'
          }}>
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🟢</span>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#0F172A', display: 'block', lineHeight: 1 }}>{summaryCounters.free}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Available / Free</span>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔴</span>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#DC2626', display: 'block', lineHeight: 1 }}>{summaryCounters.activeOrders}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Active Orders</span>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🛎️</span>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#D97706', display: 'block', lineHeight: 1 }}>{summaryCounters.calls}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Service Calls</span>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🍽️</span>
              <div>
                <strong style={{ fontSize: '1.1rem', color: '#16A34A', display: 'block', lineHeight: 1 }}>{summaryCounters.served}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>{isHotel ? 'Served / In-Room' : isCinema ? 'Delivered to Seat' : ['bakery_confectionery', 'sweet_shop', 'fast_food_qsr', 'cloud_kitchen'].includes(effectiveBiz) ? 'Served / Dispatched' : 'Served / Dining'}</span>
              </div>
            </div>
          </div>

          {/* Category Filter Pills (Tables, Cabins, VIP, Rooms, Counter) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: `All Spaces (${spaceGrid.length})` },
              { id: 'room', label: `🏨 Rooms (${spaceGrid.filter(s => s.category === 'room').length})` },
              { id: 'table', label: `🍽️ Tables (${spaceGrid.filter(s => s.category === 'table').length})` },
              { id: 'counter', label: `🧾 Counter (${spaceGrid.filter(s => s.category === 'counter').length})` },
              { id: 'cabin', label: `🛋️ Cabins (${spaceGrid.filter(s => s.category === 'cabin').length})` },
              { id: 'vip', label: `👑 VIP (${spaceGrid.filter(s => s.category === 'vip').length})` }
            ].filter(f => f.id === 'all' || spaceGrid.filter(s => s.category === f.id).length > 0).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSpaceCategoryFilter(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: spaceCategoryFilter === tab.id ? '1px solid #261B14' : '1px solid #E2E8F0',
                  background: spaceCategoryFilter === tab.id ? '#261B14' : '#FFFFFF',
                  color: spaceCategoryFilter === tab.id ? '#FFFFFF' : '#475569',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Physical Spaces Grid */}
          {filteredSpaceGrid.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '2.5rem' }}>{isHotel ? '🏨' : isCinema ? '🎬' : '🍽️'}</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {isHotel ? 'No Guest Rooms Configured' : isCinema ? 'No Cinema Screens Configured' : 'No Physical Spaces Configured'}
              </h4>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
                {isHotel
                  ? 'Set your Total Guest Rooms in Business Profile or Physical Space settings to start tracking room service and live occupancy.'
                  : isCinema
                    ? 'Configure cinema screens and seats in Settings to track live in-seat ordering occupancy.'
                    : 'Configure dining tables, cabins, or service spaces in Settings to view live floor occupancy.'}
              </p>
              {onNavigateToSetup && (
                <button
                  onClick={() => onNavigateToSetup(isHotel ? 'profile' : 'general')}
                  style={{
                    marginTop: '8px',
                    padding: '8px 18px',
                    borderRadius: '10px',
                    background: '#261B14',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{isHotel ? 'Configure Hotel Rooms' : 'Go to Setup'}</span>
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '14px'
            }}>
            {filteredSpaceGrid.map(space => {
              const isFree = space.status === 'free';
              const isOrder = Boolean(space.activeOrder);
              const isCall = Boolean(space.serviceRequest);
              const isServed = space.status === 'served';

              let cardBg = '#FFFFFF';
              let borderColor = '#E2E8F0';
              let badgeText = '🟢 FREE';
              let badgeBg = '#DCFCE7';
              let badgeColor = '#15803D';

              if (isCall) {
                cardBg = '#FFFDF5';
                borderColor = '#FCD34D';
                badgeText = '🛎️ CALL';
                badgeBg = '#FEF3C7';
                badgeColor = '#B45309';
              } else if (isServed) {
                cardBg = '#F0FDF4';
                borderColor = '#BBF7D0';
                badgeText = '🍽️ SERVED';
                badgeBg = '#DCFCE7';
                badgeColor = '#15803D';
              } else if (isOrder) {
                cardBg = '#FEF2F2';
                borderColor = '#FECACA';
                badgeText = '🔴 ACTIVE';
                badgeBg = '#FEE2E2';
                badgeColor = '#DC2626';
              }

              return (
                <div
                  key={space.id}
                  style={{
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '16px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    minHeight: '140px'
                  }}
                >
                  {/* Space Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.92rem', color: '#0F172A', fontWeight: 900 }}>
                        {space.displayLabel}
                      </strong>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: badgeBg,
                        color: badgeColor,
                        fontSize: '0.64rem',
                        fontWeight: 800
                      }}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Active Order Details */}
                    {isOrder && space.activeOrder && (
                      <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '10px', border: '1px solid #E2E8F0', marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 800 }}>
                          <span>
                            {space.activeOrders && space.activeOrders.length > 1
                              ? `Session (${space.activeOrders.length} Rounds)`
                              : `Order #${space.activeOrder.id}`}
                          </span>
                          <span style={{ color: '#DC2626' }}>
                            {currencySymbol}{Math.round(space.sessionTotal || space.activeOrder.total_amount || 0)}
                          </span>
                        </div>
                        {space.activeOrders && space.activeOrders.length > 1 && (
                          <div style={{ fontSize: '0.64rem', color: '#0369A1', marginTop: '2px', fontWeight: 700 }}>
                            {space.activeOrders.map((o, idx) => `R${o.round_number || (idx + 1)} (#${o.id})`).join(' + ')}
                          </div>
                        )}
                        <span style={{ fontSize: '0.66rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          ⏱️ {getTimeAgo(space.activeOrder.created_at)} • {space.activeOrder.customer_name || 'Guest'}
                        </span>
                      </div>
                    )}

                    {/* Service Call Details */}
                    {isCall && space.serviceRequest && (
                      <div style={{ background: '#FFFFFF', padding: '8px 10px', borderRadius: '10px', border: '1px solid #FCD34D', marginTop: '6px' }}>
                        <strong style={{ fontSize: '0.74rem', color: '#B45309', display: 'block' }}>
                          {space.serviceRequest.request_type || 'Service Call'}
                        </strong>
                        {space.serviceRequest.note && (
                          <span style={{ fontSize: '0.66rem', color: '#64748B', fontStyle: 'italic', display: 'block', marginTop: '2px' }}>
                            "{space.serviceRequest.note}"
                          </span>
                        )}
                      </div>
                    )}

                    {isFree && (
                      <span style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                        Ready for guests ✨
                      </span>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px' }}>
                    {isOrder && space.activeOrder && (
                      <>
                        <button
                          onClick={() => setSelectedOrder(space.activeOrder)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            color: '#0F172A',
                            fontSize: '0.70rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Details
                        </button>
                        <button
                          onClick={() => {
                            if (space.activeOrder?.is_settled === 1 || space.activeOrder?.status === 'completed') {
                              if (onPrintBill) onPrintBill(space.activeOrder, space.activeOrder?.payment_method || 'CASH');
                            } else {
                              handleTriggerBillAction(space.activeOrder);
                            }
                          }}
                          disabled={!space.activeOrder?.is_settled && !onOpenBillModal}
                          title={space.activeOrder?.is_settled ? 'Print Bill Receipt' : (!onOpenBillModal ? 'Billing modal unavailable' : 'Open Bill & Settle Payment')}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            borderRadius: '8px',
                            background: space.activeOrder?.is_settled ? '#0F766E' : (onOpenBillModal ? '#261B14' : '#9CA3AF'),
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.70rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          {space.activeOrder?.is_settled ? 'Print Bill' : (space.activeOrders && space.activeOrders.length > 1 ? `Bill (${space.activeOrders.length} Rds)` : 'Bill')}
                        </button>
                      </>
                    )}

                    {isCall && space.serviceRequest && (
                      space.serviceRequest.request_type === 'presence_verification' ? (
                        <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => handleApprove(space.serviceRequest)}
                            disabled={processingReqState[space.serviceRequest.id] === 'approving'}
                            style={{
                              flex: 1,
                              padding: '7px 8px',
                              borderRadius: '8px',
                              background: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(space.serviceRequest)}
                            style={{
                              padding: '7px 8px',
                              borderRadius: '8px',
                              background: '#EF4444',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onResolveServiceRequest && onResolveServiceRequest(space.serviceRequest.id)}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            background: '#D97706',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ✓ Attend Call
                        </button>
                      )
                    )}

                    {isFree && onPrintQR && (
                      <button
                        onClick={() => onPrintQR(space.space_number, space.space_type)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          color: '#475569',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <QrCode size={12} />
                        <span>Print Standee QR</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ========================================================
          4. SERVICE CALLS / WAITER REQUESTS SUBTAB
         ======================================================== */}
      {activeSubTab === 'service-requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                {isHotel ? `Live Room Service Calls (${safeServiceRequests.length})` : isCinema ? `Live Seat Assistance & Usher Calls (${safeServiceRequests.length})` : `Live Service & Staff Calls (${safeServiceRequests.length})`}
              </h3>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                {isHotel
                  ? 'Real-time room service calls, water requests, and guest assistance alerts'
                  : isCinema
                    ? 'Real-time seat assistance, usher calls, and guest alerts'
                    : 'Real-time space calls, water requests, and assistance alerts from guests'}
              </span>
            </div>
          </div>

          {safeServiceRequests.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <Bell size={36} color="#94A3B8" style={{ margin: '0 auto 8px auto' }} />
              <h4 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                No Pending Service Calls
              </h4>
              <p style={{ fontSize: '0.76rem', color: '#64748B', margin: 0 }}>
                {isHotel
                  ? 'When guests in rooms ring for assistance or request room service, calls will appear here live.'
                  : isCinema
                    ? 'When guests at cinema seats ring for assistance, calls will appear here live.'
                    : 'When customers at tables or counters ring for assistance or request water, calls will appear here live.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {safeServiceRequests.map(req => {
                const spaceInfo = parseServiceReqSpaceLocation(req);
                const label = formatCleanTableLabel(req.table_number, spaceInfo.space_type);

                return (
                  <div
                    key={req.id}
                    style={{
                      background: '#FFFDF5',
                      border: '1px solid #FCD34D',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.08)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '0.94rem', color: '#0F172A', fontWeight: 900 }}>{label}</strong>
                        <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '6px', fontSize: '0.66rem', fontWeight: 800 }}>
                          🛎️ Active Call
                        </span>
                      </div>

                      <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                        <strong style={{ fontSize: '0.80rem', color: '#B45309', display: 'block' }}>
                          {req.request_type || 'Assistance Needed'}
                        </strong>
                        {req.note && (
                          <span style={{ fontSize: '0.72rem', color: '#64748B', fontStyle: 'italic', display: 'block', marginTop: '2px' }}>
                            "{req.note}"
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.68rem', color: '#94A3B8', display: 'block', marginTop: '8px' }}>
                        ⏱️ Requested {getTimeAgo(req.created_at)}
                      </span>
                    </div>

                    {req.request_type === 'presence_verification' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            disabled={processingReqState[req.id] === 'approving'}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.80rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            ✓ Approve Presence
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(req)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#DC2626',
                              border: '1.5px solid #EF4444',
                              fontSize: '0.80rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onResolveServiceRequest && onResolveServiceRequest(req.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: '#F1F5F9',
                            color: '#64748B',
                            border: '1px solid #CBD5E1',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Dismiss Call
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onResolveServiceRequest && onResolveServiceRequest(req.id)}
                        style={{
                          padding: '9px 14px',
                          borderRadius: '10px',
                          background: '#D97706',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        ✓ Mark Attended & Clear
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          4.5. KDS SUBTAB (ACTIVE LAUNCHER OR PLAN-LOCKED UI)
         ======================================================== */}
      {activeSubTab === 'kds' && !isKdsEntitled && (
        <div style={{ padding: '24px 16px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <PlanLockedCard
            featureKey="kds_enabled"
            featureName={isCinema ? "Concession & Seat Dispatch Display (KDS)" : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz) ? "Dispatch & Order Display (KDS)" : "Kitchen Display System (KDS)"}
            featureDescription={isCinema ? "Dedicated concession terminal with real-time seat dispatch management, ticking timers, PIN security, and loud audio chimes." : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz) ? "Dedicated packing terminal with real-time counter dispatch management, ticking timers, PIN security, and loud audio chimes." : "Dedicated chef terminal with real-time kitchen ticket management, ticking timers, PIN security, and loud audio chimes."}
            requiredPlanName="Pro Plan or Higher"
            onUpgradeClick={() => onNavigateToSetup && onNavigateToSetup('subscription')}
          />
        </div>
      )}

      {activeSubTab === 'kds' && isKdsEntitled && (
        <div style={{ padding: '32px 16px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '32px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ChefHat size={30} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                {isCinema ? "Concession Display (KDS) Active" : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz) ? "Dispatch Display (KDS) Active" : "Kitchen Display System (KDS) Active"}
              </h3>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748B', maxWidth: '520px', lineHeight: 1.5 }}>
                {isCinema
                  ? "Your dedicated concession terminal runs as a standalone, distraction-free screen designed for dispatch tablets with real-time ticket sync, ticking timers, and PIN protection."
                  : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz)
                    ? "Your dedicated packaging terminal runs as a standalone, distraction-free screen designed for dispatch tablets with real-time ticket sync, ticking timers, and PIN protection."
                    : "Your dedicated chef terminal runs as a standalone, distraction-free screen designed for kitchen tablets with real-time ticket sync, ticking timers, and PIN protection."}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  const currentSlug = restaurantInfo?.slug || settingsForm?.slug || '';
                  window.open(currentSlug ? `/${currentSlug}/kitchen` : '/kitchen', '_blank');
                }}
                style={{
                  background: '#261B14',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(38, 27, 20, 0.2)'
                }}
              >
                <ChefHat size={16} color="#F59E0B" />
                <span>Open Kitchen Display</span>
                <ArrowUpRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab && setActiveSubTab('orders')}
                style={{
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Back to Live Orders
              </button>
            </div>
          </div>
        </div>
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
              {/* Status & Customer Info Card */}
              <div style={{ background: '#F8FAFC', padding: '14px 16px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#334155', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                  <span>Source: <strong>{getOrderSourceDisplay(selectedOrder)}</strong></span>
                  {(() => {
                    const selDetails = selectedOrder ? sessionDetailsMap.get(selectedOrder.id) : null;
                    const rNum = Number(selectedOrder.round_number) || (selDetails?.isMultiRound ? 1 : null);
                    if (rNum && rNum > 1) {
                      return (
                        <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.68rem' }}>
                          🔄 Round #{rNum} (Add-on)
                        </span>
                      );
                    }
                    if (selDetails?.isMultiRound) {
                      return (
                        <span style={{ background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.68rem' }}>
                          Round #1 (Initial Order)
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>

                {selectedOrder.customer_name && (
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                    Guest: <strong style={{ color: '#0F172A' }}>{selectedOrder.customer_name}</strong>
                    {selectedOrder.customer_phone ? ` (${selectedOrder.customer_phone})` : ''}
                  </div>
                )}

                {/* Multi-Round Session Breakdown Card if applicable */}
                {(() => {
                  const selDetails = selectedOrder ? sessionDetailsMap.get(selectedOrder.id) : null;
                  if (!selDetails || !selDetails.isMultiRound) return null;

                  return (
                    <div style={{
                      marginTop: '8px',
                      background: '#F0F9FF',
                      borderRadius: '12px',
                      border: '1px solid #BAE6FD',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.9rem' }}>🔗</span>
                          <strong style={{ fontSize: '0.78rem', color: '#0369A1' }}>
                            Multi-Round Dining Session ({selDetails.totalRoundsCount} Rounds)
                          </strong>
                        </div>
                        <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#0369A1' }}>
                          Total: {currencySymbol}{Math.round(selDetails.grandTotal).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {selDetails.sessionOrders.map((sOrd, sIdx) => {
                          const sRound = Number(sOrd.round_number) || (sIdx + 1);
                          const isCurrent = String(sOrd.id) === String(selectedOrder.id);
                          const sStatus = getStatusBadge(sOrd);
                          return (
                            <div 
                              key={sOrd.id} 
                              onClick={() => setSelectedOrder(sOrd)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: isCurrent ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
                                border: isCurrent ? '1.5px solid #0284C7' : '1px solid #E0F2FE',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: sRound > 1 ? '#FEF3C7' : '#E0F2FE',
                                  color: sRound > 1 ? '#B45309' : '#0369A1',
                                  fontWeight: 800,
                                  fontSize: '0.64rem'
                                }}>
                                  Round {sRound}
                                </span>
                                <span style={{ fontWeight: isCurrent ? 800 : 600, color: '#0F172A' }}>
                                  Order #{sOrd.id}
                                </span>
                                {isCurrent && <span style={{ color: '#0284C7', fontSize: '0.64rem', fontWeight: 800 }}>(Viewing)</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '0.64rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: sStatus.bg,
                                  color: sStatus.color,
                                  fontWeight: 700
                                }}>
                                  {sStatus.label}
                                </span>
                                <strong style={{ color: '#0F172A' }}>{currencySymbol}{Math.round(sOrd.total_amount || 0)}</strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: '0.67rem', color: '#0284C7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <span>💡</span>
                        <span>Single-Click Settlement: Billing any round automatically completes all {selDetails.totalRoundsCount} rounds for this table together.</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Itemized Dishes */}
              <div>
                <h4 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0' }}>
                  Order Items
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {safeParseItems(selectedOrder.items).map((item, idx) => {
                    const itemQty = Number(item.quantity || item.qty || 1);
                    const itemPrice = Number(item.price || 0);
                    const itemRegularPrice = Number(item.regular_price || 0);
                    const hasOffer = itemRegularPrice > itemPrice && itemPrice > 0;

                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.82rem', color: '#0F172A' }}>{itemQty}x {item.name}</strong>
                            {item.portion && (
                              <span style={{ fontSize: '0.66rem', color: '#0F766E', background: '#CCFBF1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {item.portion}
                              </span>
                            )}
                            {hasOffer && (
                              <span style={{ fontSize: '0.64rem', color: '#16A34A', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {item.offer_badge || 'OFFER'}
                              </span>
                            )}
                          </div>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div style={{ fontSize: '0.70rem', color: '#64748B', marginTop: '2px' }}>
                              {item.modifiers.map(m => m.name || m).join(', ')}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0F172A' }}>
                            {currencySymbol}{Math.round(itemPrice * itemQty)}
                          </span>
                          {hasOffer && (
                            <div style={{ fontSize: '0.68rem', color: '#94A3B8', textDecoration: 'line-through' }}>
                              {currencySymbol}{Math.round(itemRegularPrice * itemQty)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bill Breakdown */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748B' }}>
                  <span>Subtotal</span>
                  <span>{currencySymbol}{Math.round(Number(selectedOrder.subtotal_amount || selectedOrder.subtotal || selectedOrder.total_amount || 0))}</span>
                </div>

                {Number(selectedOrder.discount_amount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#16A34A', fontWeight: 700 }}>
                    <span>Discount / Promo</span>
                    <span>-{currencySymbol}{Math.round(Number(selectedOrder.discount_amount))}</span>
                  </div>
                )}

                {(Number(selectedOrder.tax_amount || 0) > 0 || Number(selectedOrder.gst_amount || 0) > 0 || Number(selectedOrder.cgst_amount || 0) > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748B' }}>
                    <span>GST (Tax{selectedOrder.gst_rate ? ` ${selectedOrder.gst_rate}%` : ''})</span>
                    <span>{currencySymbol}{Math.round(Number(selectedOrder.tax_amount || selectedOrder.gst_amount || (Number(selectedOrder.cgst_amount || 0) + Number(selectedOrder.sgst_amount || 0))))}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '2px' }}>
                  <span>Payment Mode</span>
                  <span style={{ fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                    {selectedOrder.payment_method || 'Cash at Counter'} {selectedOrder.is_settled === 1 ? '• Paid' : '• Pending'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.94rem', fontWeight: 900, color: '#0F172A', borderTop: '1px solid #E2E8F0', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Grand Total</span>
                  <span>{currencySymbol}{Math.round(Number(selectedOrder.grand_total_amount || selectedOrder.total_amount || selectedOrder.total || 0))}</span>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const isCounter = (String(selectedOrder?.table_number || '').trim().toLowerCase() === 'counter') || (String(selectedOrder?.space_type || '').trim().toLowerCase() === 'counter');
                      if (isCounter) {
                        if (onOpenAcceptRouting) {
                          onOpenAcceptRouting(selectedOrder);
                        }
                        setSelectedOrder(null);
                        return;
                      }
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
                    {isCinema ? 'Accept & Send to Concession' : isHotel ? 'Accept & Send to Room Service Kitchen' : ['bakery_confectionery', 'sweet_shop'].includes(effectiveBiz) ? 'Accept & Send to Prep Counter' : 'Accept & Send to Kitchen'}
                  </button>
                  <button
                    onClick={() => {
                      handleRejectOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '12px',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                    title="Reject and cancel this order"
                  >
                    ✕ Reject
                  </button>
                </div>
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
                  {(() => {
                    const isCounter = (String(selectedOrder?.table_number || '').trim().toLowerCase() === 'counter') || (String(selectedOrder?.space_type || '').trim().toLowerCase() === 'counter');
                    if (isCounter || ['bakery_confectionery', 'sweet_shop', 'fast_food_qsr', 'cloud_kitchen'].includes(effectiveBiz)) {
                      return 'Mark Ready for Pickup at Counter';
                    }
                    if (isCinema) {
                      return 'Mark Ready & Deliver to Seat';
                    }
                    if (isHotel) {
                      return 'Mark Ready & Deliver to Room';
                    }
                    return 'Mark Order as Ready / Served';
                  })()}
                </button>
              )}

              {!isOrderCompleted(selectedOrder) && (selectedOrder.status === 'served' || selectedOrder.status === 'ready') && (
                <button
                  onClick={() => {
                    if (typeof onOpenBillModal === 'function') {
                      setSelectedOrder(null);
                      handleTriggerBillAction(selectedOrder);
                    } else {
                      handleTriggerBillAction(selectedOrder);
                    }
                  }}
                  disabled={!onOpenBillModal}
                  title={!onOpenBillModal ? 'Billing modal unavailable' : 'Generate Bill & Complete Order'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: onOpenBillModal ? '#7E22CE' : '#9CA3AF',
                    color: '#FFFFFF',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    border: 'none',
                    cursor: onOpenBillModal ? 'pointer' : 'not-allowed',
                    boxShadow: onOpenBillModal ? '0 2px 8px rgba(126, 34, 206, 0.3)' : 'none',
                    opacity: onOpenBillModal ? 1 : 0.6
                  }}
                >
                  Generate Bill & Complete Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 🛡️ Presence Verification Rejection Modal */}
      {rejectingModalReq && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10050,
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            boxSizing: 'border-box'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#DC2626' }}>
              Reject Presence Verification
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: '#64748B', lineHeight: 1.5 }}>
              Rejecting verification for <strong>{formatCleanTableLabel(rejectingModalReq.table_number, rejectingModalReq.space_type)}</strong> will notify the customer.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {[defaultRejectReason, 'Customer not present at table', 'Wrong table QR scanned', 'Suspicious / Remote order attempt', 'Other'].filter((v, i, a) => a.indexOf(v) === i).map(reason => (
                <label key={reason} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: selectedRejectReason === reason ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  background: selectedRejectReason === reason ? '#FEF2F2' : '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1E293B'
                }}>
                  <input
                    type="radio"
                    name="reject_reason"
                    checked={selectedRejectReason === reason}
                    onChange={() => setSelectedRejectReason(reason)}
                    style={{ accentColor: '#EF4444' }}
                  />
                  <span>{reason}</span>
                </label>
              ))}
              {selectedRejectReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Enter rejection reason..."
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.82rem',
                    marginTop: '4px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRejectingModalReq(null)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  border: 'none',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingReqState[rejectingModalReq.id] === 'rejecting'}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
