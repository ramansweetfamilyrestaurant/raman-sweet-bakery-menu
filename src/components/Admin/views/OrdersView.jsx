import React, { useState, useEffect } from 'react';
import { Clock, Printer, MapPin, Bell, RefreshCw, CheckCircle2, QrCode, XCircle, UtensilsCrossed, Shield, ShieldCheck, ShieldAlert, Check, X, AlertTriangle } from 'lucide-react';
import KdsDisplayView from './KdsDisplayView';
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
      } catch (e) {
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
  const isCinema = (profile?.business_type || settingsForm?.business_type || restaurantInfo?.business_type) === 'cinema_theatre' && 
                   (profile?.service_model || settingsForm?.service_model || restaurantInfo?.service_model) === 'seat_service';
  const isHotel = (profile?.business_type || settingsForm?.business_type || restaurantInfo?.business_type) === 'hotel_resort' && 
                  (profile?.service_model || settingsForm?.service_model || restaurantInfo?.service_model) === 'in_room_dining';
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

  const [processingReqState, setProcessingReqState] = useState({}); // { [id]: 'approving' | 'rejecting' }
  const [rejectingModalReq, setRejectingModalReq] = useState(null);
  const [selectedRejectReason, setSelectedRejectReason] = useState('Customer not visible at table');
  const [customRejectReason, setCustomRejectReason] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleApprove = async (sr) => {
    if (processingReqState[sr.id]) return;
    setProcessingReqState(prev => ({ ...prev, [sr.id]: 'approving' }));
    try {
      if (onApprovePresenceRequest) {
        await onApprovePresenceRequest(sr.id);
      } else {
        await onResolveServiceRequest(sr.id);
      }
    } catch (err) {
      console.error('Approve presence error:', err);
    } finally {
      setProcessingReqState(prev => {
        const next = { ...prev };
        delete next[sr.id];
        return next;
      });
    }
  };

  const handleOpenRejectModal = (sr) => {
    setRejectingModalReq(sr);
    setSelectedRejectReason('Customer not visible at table');
    setCustomRejectReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingModalReq) return;
    const reqId = rejectingModalReq.id;
    const finalReason = selectedRejectReason === 'Other' ? (customRejectReason.trim() || 'Rejected by staff') : selectedRejectReason;
    
    setProcessingReqState(prev => ({ ...prev, [reqId]: 'rejecting' }));
    setRejectingModalReq(null);
    try {
      if (onRejectPresenceRequest) {
        await onRejectPresenceRequest(reqId, finalReason);
      } else {
        await onResolveServiceRequest(reqId);
      }
    } catch (err) {
      console.error('Reject presence error:', err);
    } finally {
      setProcessingReqState(prev => {
        const next = { ...prev };
        delete next[reqId];
        return next;
      });
    }
  };

  const formatCleanTableLabel = (raw, spaceType) => {
    if (!raw) return isCinema ? 'Screen 1 • Seat 1' : (spaceType === 'room' || (isHotel && prefix === 'room')) ? 'Room 101' : 'Table 1';
    const str = String(raw).trim();
    
    // Cinema matching
    const cMatch = str.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                   str.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
    if (cMatch) {
      return `🎬 Screen ${cMatch[1]} • Row ${cMatch[2].toUpperCase()} • Seat ${cMatch[3]}`;
    }
    if (str.toLowerCase().startsWith('screen')) {
      return `🎬 ${str}`;
    }
    if ((spaceType === 'cinema_seat' || isCinema) && !str.toLowerCase().includes('table')) {
      return `🎬 Seat ${str}`;
    }

    // Explicit spaceType matching
    if (spaceType === 'table') {
      return `🍽️ Table ${str.replace(/^table\s*#?/i, '')}`;
    }
    if (spaceType === 'room' || /^room\s*#?\d+/i.test(str)) {
      return `🏨 ${str.toLowerCase().startsWith('room') ? (str.charAt(0).toUpperCase() + str.slice(1)) : `Room ${str}`}`;
    }
    if (spaceType === 'cabin' || /^cabin\s*#?\d+/i.test(str)) {
      return `🛋️ ${str.toLowerCase().startsWith('cabin') ? (str.charAt(0).toUpperCase() + str.slice(1)) : `Cabin ${str}`}`;
    }
    if (spaceType === 'vip' || /^vip\s*#?\d+/i.test(str)) {
      return `👑 ${str.toUpperCase()}`;
    }

    // Safe fallback based on active prefix
    if (prefix === 'room' && /^\d+$/.test(str)) {
      return `🏨 Room ${str}`;
    }

    if (/^(table|room|cabin|vip|takeaway|parcel)/i.test(str) || /^[\p{Extended_Pictographic}\u2000-\u3300]/u.test(str)) {
      return str;
    }
    return `Table ${str}`;
  };

  const pendingCount = validOrders.filter(o => o.status === 'pending').length;
  const kitchenCount = validOrders.filter(o => o.status === 'kitchen' || o.status === 'accepted').length;
  const servedCount = validOrders.filter(o => o.status === 'served').length;
  const completedCount = validOrders.filter(o => o.status === 'completed').length;
  const todayTotalSales = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const filteredOrders = validOrders.filter(o => {
    if (kotFilter === 'pending') return o.status === 'pending';
    if (kotFilter === 'kitchen') return o.status === 'kitchen' || o.status === 'accepted';
    if (kotFilter === 'served') return o.status === 'served';
    if (kotFilter === 'completed') return o.status === 'completed';
    return true;
  });

  const prefix = isCinema
    ? 'cinema_seat'
    : isHotel
      ? 'room'
      : String(restaurantInfo?.table_prefix || settingsForm?.table_prefix || 'table').toLowerCase();
  const spaceLabel = prefix === 'cabin' ? 'Cabin' : prefix === 'room' ? 'Room' : prefix === 'vip' ? 'VIP Lounge' : 'Table';
  const spacePlural = prefix === 'cabin' ? 'Cabins' : prefix === 'room' ? 'Rooms' : prefix === 'vip' ? 'VIP Lounges' : 'Tables';
  const spaceField = prefix === 'cabin' ? 'total_cabins' : prefix === 'room' ? 'total_rooms' : prefix === 'vip' ? 'total_vip' : 'total_tables';

  const currentSpaceCount = (() => {
    if (isHotel || prefix === 'room') {
      return Number(restaurantInfo?.total_rooms ?? settingsForm?.total_rooms) || 0;
    }
    if (prefix === 'cabin') {
      return Number(restaurantInfo?.total_cabins ?? settingsForm?.total_cabins) || 0;
    }
    if (prefix === 'vip') {
      return Number(restaurantInfo?.total_vip ?? settingsForm?.total_vip) || 0;
    }
    const tableVal = restaurantInfo?.total_tables ?? settingsForm?.total_tables;
    if (tableVal !== undefined && tableVal !== null) {
      return Number(tableVal) || 0;
    }
    return (!isHotel && !isCinema) ? 10 : 0;
  })();

  const tableGrid = Array.from({ length: currentSpaceCount }, (_, i) => {
    const tableNum = String(i + 1);
    const activeOrder = validOrders.find(o => (String(o.table_number) === tableNum || String(o.table_number).toLowerCase().includes(tableNum)) && o.status !== 'completed' && o.status !== 'rejected' && o.status !== 'cancelled');
    const serviceReq = safeServiceRequests.find(s => String(s.table_number) === tableNum || String(s.table_number).toLowerCase().includes(tableNum));

    let status = 'available';
    if (serviceReq) status = 'service_needed';
    else if (activeOrder) status = 'occupied';

    return { tableNumber: tableNum, status, activeOrder, serviceRequest: serviceReq };
  });

  const kdsPlanEnabled = restaurantInfo?.kds_enabled !== undefined ? (restaurantInfo.kds_enabled === 1 || restaurantInfo.kds_enabled === true || restaurantInfo.kds_enabled === '1') : true;
  const kdsScreenEnabled = restaurantInfo?.kds_screen_enabled !== undefined ? (restaurantInfo.kds_screen_enabled === 1 || restaurantInfo.kds_screen_enabled === true || restaurantInfo.kds_screen_enabled === '1') : true;
  const kdsEnabled = kdsPlanEnabled && kdsScreenEnabled;
  const dualPrinterEnabled = restaurantInfo?.dual_printer_enabled === 1 || restaurantInfo?.dual_printer_enabled === true || restaurantInfo?.dual_printer_enabled === '1';

  if (ordersEnabled === false) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFF', borderRadius: 'var(--adm-radius-lg)', border: '1px solid var(--adm-border)' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid #F59E0B' }}>
          <XCircle size={32} color="#B45309" />
        </div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 6px 0' }}>
          🔒 Live Customer QR Order Receiving Page Locked
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--adm-muted)', maxWidth: '480px', margin: '0 auto 16px auto' }}>
          Live order receiving is disabled for your restaurant on the current plan tier. Upgrade to Pro or Enterprise plan in SuperAdmin to unlock live QR table order receiving!
        </p>
      </div>
    );
  }

  const isPrep = (val) => val === 1 || val === '1' || val === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              {isCinema
                ? (kdsEnabled ? 'Cinema Orders & Kitchen Operations' : 'Live Cinema Seat Orders & Operations')
                : isHotel
                  ? (kdsEnabled ? 'Room Orders & Kitchen Operations' : 'Live Room Orders & Operations')
                  : (kdsEnabled ? 'Orders & Kitchen Operations' : 'Live Table Orders & Operations')}
            </h2>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ● LIVE
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
            {isCinema
              ? (kdsEnabled ? 'Live auditorium seat orders & kitchen display screen' : 'Live auditorium seat orders & operations')
              : isHotel
                ? (kdsEnabled ? 'Live in-room guest dining orders & kitchen screen' : 'Live in-room guest dining orders & operations')
                : (kdsEnabled ? 'Live table orders, floor map & kitchen display screen' : 'Live table orders, floor map & waiter calls')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 14px', borderRadius: '10px', border: '1px solid #86EFAC', fontSize: '0.8rem', fontWeight: 800 }}>
            {currencySymbol}{todayTotalSales.toLocaleString()} Today
          </span>
          {pendingCount > 0 ? (
            <span style={{ background: '#FEF3C7', color: '#B45309', padding: '6px 14px', borderRadius: '10px', border: '1px solid #FCD34D', fontSize: '0.8rem', fontWeight: 800 }}>
              🔔 {pendingCount} Pending
            </span>
          ) : (
            <span style={{ background: '#F1F5F9', color: '#475569', padding: '6px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '0.8rem', fontWeight: 700 }}>
              0 Pending
            </span>
          )}
        </div>
      </div>

      {/* Sub-Navigation Segmented Control */}
      <div style={{ display: 'flex', gap: '6px', background: '#FFFFFF', padding: '5px', borderRadius: '12px', width: 'fit-content', maxWidth: '100%', border: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('orders')}
          style={{
            padding: '7px 16px',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'orders' ? '#0F172A' : 'transparent',
            color: activeSubTab === 'orders' ? '#FFFFFF' : '#64748B',
            transition: 'all 0.15s ease'
          }}
        >
          {isCinema ? `🎬 Seat Orders (${validOrders.length})` : isHotel ? `🏨 Room Orders (${validOrders.length})` : `📋 Live Orders (${validOrders.length})`}
        </button>
        <button
          onClick={() => setActiveSubTab('floor-map')}
          style={{
            padding: '7px 16px',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            background: activeSubTab === 'floor-map' ? '#0F172A' : 'transparent',
            color: activeSubTab === 'floor-map' ? '#FFFFFF' : '#64748B',
            transition: 'all 0.15s ease'
          }}
        >
          {isCinema
            ? `💺 Cinema Seats (${cinemaSeats.length})`
            : isHotel
              ? `🏨 Room Status (${currentSpaceCount} Rooms)`
              : (prefix === 'cabin'
                  ? `🛋️ Private Cabins (${currentSpaceCount} Cabins)`
                  : prefix === 'room'
                    ? `🏨 Rooms (${currentSpaceCount} Rooms)`
                    : prefix === 'vip'
                      ? `👑 VIP Lounges (${currentSpaceCount} VIP Lounges)`
                      : `🗺️ Floor Map (${currentSpaceCount} Tables)`)}
        </button>
        {!isCinema && (
          <button
            onClick={() => setActiveSubTab('service-requests')}
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              fontSize: '0.82rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'service-requests' ? '#0F172A' : 'transparent',
              color: activeSubTab === 'service-requests' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.15s ease'
            }}
          >
            {isHotel ? `🛎️ Guest Requests (${safeServiceRequests.length})` : `🛎️ Waiter Calls (${safeServiceRequests.length})`}
          </button>
        )}
        {kdsEnabled && (
          <a
            href={`/${localStorage.getItem('touchqr_admin_slug') || restaurantInfo?.slug || ''}/kitchen`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '7px 16px',
              borderRadius: '9px',
              fontSize: '0.82rem',
              fontWeight: 800,
              background: '#0F172A',
              color: '#38BDF8',
              border: '1px solid #38BDF8',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🍳 /kitchen Screen ↗
          </a>
        )}
      </div>

      {/* LIVE ORDERS SUBTAB */}
      {activeSubTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Status Filter Horizontal Strip */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {[
              { id: 'all', label: `All (${validOrders.length})` },
              { id: 'pending', label: `🟡 Pending (${pendingCount})` },
              { id: 'kitchen', label: kdsEnabled ? `👨‍🍳 Kitchen (${kitchenCount})` : `🟢 In Progress (${kitchenCount})` },
              { id: 'served', label: `🍽 Served (${servedCount})` },
              { id: 'completed', label: `✅ Complete (${completedCount})` }
            ].map(filter => {
              const isActive = kotFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setKotFilter(filter.id)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isActive ? '#0F172A' : '#E2E8F0',
                    cursor: 'pointer',
                    background: isActive ? '#0F172A' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#475569',
                    boxShadow: isActive ? '0 2px 6px rgba(15, 23, 42, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Orders Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <Clock size={36} color="#94A3B8" style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                  {isCinema ? '🎬 No Active Seat Orders' : 'No active orders in this view'}
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0 }}>
                  {isCinema
                    ? 'When guests scan their cinema seat QR codes, active orders will appear here live.'
                    : 'New orders placed via QR will ring and appear here live.'}
                </p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const isCompleted = order.status === 'completed';
                const isPending = order.status === 'pending';
                const isKitchen = order.status === 'kitchen' || order.status === 'accepted';

                return (
                  <div
                    key={order.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      position: 'relative'
                    }}
                  >
                    {/* Top Row: Table Name + ID + Customer + Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: '#0F172A',
                            color: '#FFFFFF',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            fontWeight: 900,
                            fontSize: '0.85rem'
                          }}>
                            {formatCleanTableLabel(order.table_number, order.space_type)}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#64748B' }}>
                            Order {order.id}
                          </span>
                          {Number(order.round_number) > 1 && (
                            <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                              🔄 Round {order.round_number} (Add-on{isCinema ? ' Seat Order' : (order.space_type === 'room' || (isHotel && prefix === 'room')) ? ' Room Order' : ''})
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '5px', fontWeight: 600 }}>
                          {order.customer_name || 'Dine-in Guest'}
                          {order.customer_phone ? <span style={{ color: '#0F172A', marginLeft: '6px' }}>📞 {order.customer_phone}</span> : ''}
                          <span style={{ margin: '0 6px', color: '#CBD5E1' }}>•</span>
                          {new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          background: isCompleted ? '#DCFCE7' : isPending ? '#FEF3C7' : '#E0F2FE',
                          color: isCompleted ? '#15803D' : isPending ? '#B45309' : '#0369A1',
                          border: isCompleted ? '1px solid #86EFAC' : isPending ? '1px solid #FCD34D' : '1px solid #BAE6FD'
                        }}>
                          {(order.status || 'PENDING').toUpperCase()}
                        </span>

                        {onPreviewPrint && (
                          <button
                            onClick={() => onPreviewPrint(order, 'bill')}
                            title="Preview Customer Bill Receipt"
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              color: '#475569',
                              cursor: 'pointer',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            👁️ Preview Bill
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Order Items Container */}
                    <div style={{ fontSize: '0.84rem', background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {safeParseItems(order.items).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: idx < safeParseItems(order.items).length - 1 ? '1px dashed #E2E8F0' : 'none', paddingBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>
                              {item.name}{item.portion ? ` (${item.portion})` : ''} <span style={{ color: '#059669', marginLeft: '4px' }}>×{item.quantity || item.qty || 1}</span>
                            </span>
                            <strong style={{ color: '#0F172A', fontWeight: 800 }}>
                              {currencySymbol}{(Number(item.price) || 0) * (item.quantity || item.qty || 1)}
                            </strong>
                          </div>
                          {(() => {
                            const mods = safeParseModifiers(item.modifiers);
                            if (mods.length === 0) return null;
                            return (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingLeft: '8px', marginTop: '2px' }}>
                                {mods.map((m, mIdx) => (
                                  <span key={mIdx} style={{ fontSize: '0.70rem', color: '#065F46', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                    ➕ {m.name} (+{currencySymbol}{m.price})
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', flexWrap: 'wrap', gap: '10px' }}>
                      <strong style={{ fontSize: '1.15rem', color: '#059669', fontWeight: 900 }}>
                        {currencySymbol}{Number(order.total_amount).toFixed(2)}
                      </strong>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'accepted')}
                              style={{
                                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '40px',
                                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                              }}
                            >
                              ✓ Accept Order
                            </button>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'rejected')}
                              style={{
                                background: '#FEE2E2',
                                color: '#DC2626',
                                border: '1px solid #FECACA',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '40px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                        {order.status === 'accepted' && (
                          <>
                            {order.kitchen_prepared !== 1 && order.kitchen_prepared !== true && order.kitchen_prepared !== '1' && (
                              <>
                                <button
                                  onClick={() => onUpdateStatus(order.id, 'accepted', { sent_to_kds: 0, kitchen_prepared: 1 })}
                                  style={{
                                    background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    minHeight: '40px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                                  }}
                                >
                                  ⚡ Mark Ready
                                </button>
                                {kdsEnabled && (
                                  <button
                                    onClick={() => onUpdateStatus(order.id, 'kitchen', { sent_to_kds: 1 })}
                                    style={{
                                      background: '#0F172A',
                                      color: '#38BDF8',
                                      border: '1px solid #38BDF8',
                                      padding: '8px 14px',
                                      borderRadius: '10px',
                                      fontSize: '0.8rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      minHeight: '40px'
                                    }}
                                  >
                                    🍳 Send to Kitchen
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={() => onUpdateStatus(order.id, 'served', { sent_to_kds: 0, kitchen_prepared: 1, silent: true })}
                              style={{
                                background: '#0F172A',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '40px'
                              }}
                            >
                              🍽️ Mark Served
                            </button>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'completed')}
                              style={{
                                background: '#F1F5F9',
                                color: '#334155',
                                border: '1px solid #E2E8F0',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '40px'
                              }}
                            >
                              💳 Settle Bill
                            </button>
                          </>
                        )}
                        {order.status === 'kitchen' && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'served', { sent_to_kds: 0, kitchen_prepared: 1, silent: true })}
                              style={{
                                background: '#0F172A',
                                color: '#FFFFFF',
                                border: 'none',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '40px'
                              }}
                            >
                              🍽️ Mark Served
                            </button>
                            <button
                              onClick={() => onUpdateStatus(order.id, 'completed')}
                              style={{
                                background: '#F1F5F9',
                                color: '#334155',
                                border: '1px solid #E2E8F0',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                minHeight: '40px'
                              }}
                            >
                              💳 Settle Bill
                            </button>
                          </>
                        )}
                        {order.status === 'served' && (
                          <button
                            onClick={() => onUpdateStatus(order.id, 'completed')}
                            style={{
                              background: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              minHeight: '40px'
                            }}
                          >
                            💳 Settle Bill
                          </button>
                        )}
                        {onDirectPrint && (
                          <button
                            onClick={() => onDirectPrint(order, 'kot')}
                            disabled={printingOrderId === order.id}
                            style={{
                              background: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #E2E8F0',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              minHeight: '40px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: printingOrderId === order.id ? 0.7 : 1
                            }}
                          >
                            {printingOrderId === order.id && printingType === 'kot' ? '⏳ Printing...' : '🖨️ KOT'}
                          </button>
                        )}
                        <button
                          onClick={() => onOpenBillModal ? onOpenBillModal(order) : (onPrintBill && onPrintBill(order))}
                          disabled={printingOrderId === order.id}
                          style={{
                            background: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #E2E8F0',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            minHeight: '40px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: printingOrderId === order.id ? 0.7 : 1
                          }}
                        >
                          <Printer size={14} />
                          <span>{printingOrderId === order.id && printingType === 'bill' ? '⏳ Printing...' : 'Bill'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* FLOOR MAP / CINEMA SEATS SUBTAB */}
      {activeSubTab === 'floor-map' && (
        isCinema ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loadingCinema ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', color: 'var(--adm-muted)' }}>
                ⏳ Loading auditorium screens and seat inventory...
              </div>
            ) : cinemaScreens.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎬</div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
                  No Cinema Seats Configured
                </h4>
                <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: '440px', margin: '0 auto 16px auto' }}>
                  Please configure auditorium screens, rows, and seats in Cinema Management to view live seat order status.
                </p>
                {onNavigateToSetup && (
                  <button
                    onClick={() => onNavigateToSetup('cinema')}
                    className="adm-btn adm-btn-primary"
                    style={{ fontWeight: 800 }}
                  >
                    Go to Cinema Management ➔
                  </button>
                )}
              </div>
            ) : (
              cinemaScreens.map(scr => {
                const scrSeats = cinemaSeats.filter(st => Number(st.screen_id) === Number(scr.id));
                const rows = {};
                scrSeats.forEach(st => {
                  const r = (st.row_label || 'A').toUpperCase();
                  if (!rows[r]) rows[r] = [];
                  rows[r].push(st);
                });
                const rowLabels = Object.keys(rows).sort();

                return (
                  <div
                    key={scr.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      padding: '18px 20px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: 900 }}>
                          🎬 Screen {scr.screen_number}: {scr.name}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: '8px', fontWeight: 600 }}>
                          ({scrSeats.length} configured seats)
                        </span>
                      </div>
                    </div>

                    {rowLabels.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#94A3B8', fontStyle: 'italic', padding: '10px 0' }}>
                        No rows or seats configured for this screen yet.
                      </div>
                    ) : (
                      rowLabels.map(rLabel => (
                        <div key={rLabel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                              ROW {rLabel}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                            {rows[rLabel]
                              .sort((a, b) => Number(a.seat_number) - Number(b.seat_number))
                              .map(seat => {
                                const seatKey1 = `Screen ${scr.screen_number} - Row ${rLabel} - Seat ${seat.seat_number}`.toLowerCase();
                                const seatKey2 = `S${scr.screen_number}-${rLabel}-${seat.seat_number}`.toLowerCase();
                                const seatKey3 = `${seat.seat_code || ''}`.toLowerCase();

                                const activeOrder = validOrders.find(o => {
                                  if (o.status === 'completed' || o.status === 'rejected' || o.status === 'cancelled') return false;
                                  const tStr = String(o.table_number || '').toLowerCase();
                                  return tStr === seatKey1 || tStr === seatKey2 || (seatKey3 && tStr === seatKey3);
                                });

                                const isOccupied = Boolean(activeOrder);

                                return (
                                  <div
                                    key={seat.id}
                                    style={{
                                      background: isOccupied ? '#FEF2F2' : '#F8FAFC',
                                      border: '1px solid',
                                      borderColor: isOccupied ? '#FECACA' : '#E2E8F0',
                                      borderRadius: '12px',
                                      padding: '10px 12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '6px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <strong style={{ fontSize: '0.86rem', color: isOccupied ? '#991B1B' : '#0F172A', fontWeight: 800 }}>
                                        💺 {rLabel}{seat.seat_number}
                                      </strong>
                                      <span style={{
                                        fontSize: '0.66rem',
                                        fontWeight: 800,
                                        padding: '2px 6px',
                                        borderRadius: '6px',
                                        background: isOccupied ? '#FEE2E2' : '#DCFCE7',
                                        color: isOccupied ? '#DC2626' : '#15803D',
                                        border: isOccupied ? '1px solid #FCA5A5' : '1px solid #86EFAC'
                                      }}>
                                        {isOccupied ? '🔴 ORDER' : '🟢 FREE'}
                                      </span>
                                    </div>

                                    {isOccupied && activeOrder && (
                                      <div style={{ fontSize: '0.74rem', background: '#FFFFFF', padding: '6px 8px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                                          <span>Order {activeOrder.id}</span>
                                          <span style={{ color: '#DC2626' }}>{currencySymbol}{activeOrder.total_amount}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                          <button
                                            onClick={() => onOpenBillModal ? onOpenBillModal(activeOrder) : (onPrintBill && onPrintBill(activeOrder))}
                                            style={{ flex: 1, padding: '4px', fontSize: '0.70rem', fontWeight: 800, borderRadius: '6px', background: '#F1F5F9', border: '1px solid #E2E8F0', cursor: 'pointer' }}
                                          >
                                            Bill
                                          </button>
                                          <button
                                            onClick={() => onUpdateStatus(activeOrder.id, 'completed')}
                                            style={{ flex: 1, padding: '4px', fontSize: '0.70rem', fontWeight: 800, borderRadius: '6px', background: '#0F172A', color: '#FFF', border: 'none', cursor: 'pointer' }}
                                          >
                                            Settle
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {tableGrid.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '48px 24px',
                textAlign: 'center',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px dashed #CBD5E1'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>
                  {isHotel ? '🏨' : '🍽️'}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', margin: '0 0 6px 0' }}>
                  {isHotel && prefix === 'room'
                    ? 'No Hotel Rooms Configured Yet'
                    : `No ${spacePlural} Configured Yet`}
                </h3>
                <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: '420px', margin: '0 auto' }}>
                  {isHotel && prefix === 'room'
                    ? 'Add guest rooms in the QR Standee & Space QR Generator to view live room statuses and orders.'
                    : `Add ${spacePlural.toLowerCase()} in the QR Generator to monitor live status.`}
                </p>
              </div>
            ) : (
              tableGrid.map(t => {
                const isOccupied = t.status === 'occupied';
                const isService = t.status === 'service_needed';
                const isFree = t.status === 'available';

                return (
                  <div
                    key={t.tableNumber}
                    style={{
                      background: isOccupied ? '#FEF2F2' : isService ? '#FFFBEB' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: isOccupied ? '#FECACA' : isService ? '#FDE68A' : '#E2E8F0',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '1.05rem', color: '#0F172A', fontWeight: 900 }}>
                          {prefix === 'room' ? '🏨 ROOM' : prefix === 'cabin' ? '🛋️ CABIN' : prefix === 'vip' ? '👑 VIP' : 'TABLE'} {t.tableNumber}
                        </strong>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '8px',
                        fontSize: '0.70rem',
                        fontWeight: 800,
                        background: isOccupied ? '#FEE2E2' : isService ? '#FEF3C7' : '#DCFCE7',
                        color: isOccupied ? '#DC2626' : isService ? '#B45309' : '#15803D',
                        border: isOccupied ? '1px solid #FCA5A5' : isService ? '1px solid #FCD34D' : '1px solid #86EFAC'
                      }}>
                        {isOccupied ? '🔴 SEATED' : isService ? '🟡 CALL' : '🟢 FREE'}
                      </span>
                    </div>

                    {isOccupied && t.activeOrder && (
                      <div style={{ fontSize: '0.80rem', background: '#FFFFFF', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                          <span>Order {t.activeOrder.id}</span>
                          <span style={{ color: '#DC2626' }}>{currencySymbol}{t.activeOrder.total_amount}</span>
                        </div>
                        <div style={{ color: '#64748B', marginTop: '3px' }}>
                          {t.activeOrder.customer_name || 'Guest'} • {safeParseItems(t.activeOrder.items).length} items
                        </div>
                      </div>
                    )}

                    {isService && t.serviceRequest && (
                      t.serviceRequest.request_type === 'presence_verification' ? (
                        <div style={{ fontSize: '0.80rem', background: '#F0FDF4', padding: '10px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                          <strong style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🛡️ Presence Verification
                          </strong>
                          <span style={{ fontSize: '0.74rem', color: '#15803D', display: 'block', marginTop: '2px' }}>
                            Customer awaiting table authorization
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.80rem', background: '#FFFFFF', padding: '10px', borderRadius: '10px', border: '1px solid #FDE68A' }}>
                          <strong style={{ color: '#B45309', display: 'block' }}>{t.serviceRequest.request_type}</strong>
                          {t.serviceRequest.note && <span style={{ fontStyle: 'italic', color: '#64748B' }}>"{t.serviceRequest.note}"</span>}
                        </div>
                      )
                    )}

                    {isFree && (
                      <span style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 600, display: 'block', margin: '6px 0' }}>
                        Ready for guests ✨
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {isOccupied && t.activeOrder && (
                      <>
                        <button
                          onClick={() => onOpenBillModal(t.activeOrder)}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            background: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #E2E8F0',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Printer size={12} /> Bill
                        </button>
                        <button
                          onClick={() => onUpdateStatus(t.activeOrder.id, 'completed')}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            background: '#0F172A',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      </>
                    )}

                    {isService && t.serviceRequest && (
                      t.serviceRequest.request_type === 'presence_verification' ? (
                        <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                          <button
                            onClick={() => handleApprove(t.serviceRequest)}
                            disabled={Boolean(processingReqState[t.serviceRequest.id])}
                            style={{
                              flex: 2,
                              padding: '8px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: processingReqState[t.serviceRequest.id] ? 'not-allowed' : 'pointer',
                              opacity: processingReqState[t.serviceRequest.id] ? 0.7 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            {processingReqState[t.serviceRequest.id] === 'approving' ? 'Approving...' : '✓ Approve'}
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(t.serviceRequest)}
                            disabled={Boolean(processingReqState[t.serviceRequest.id])}
                            style={{
                              flex: 1,
                              padding: '8px',
                              borderRadius: '8px',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: processingReqState[t.serviceRequest.id] ? 'not-allowed' : 'pointer',
                              opacity: processingReqState[t.serviceRequest.id] ? 0.7 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onResolveServiceRequest(t.serviceRequest.id)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '8px',
                            background: '#FEF3C7',
                            color: '#B45309',
                            border: '1px solid #FCD34D',
                            fontSize: '0.78rem',
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
                        onClick={() => onPrintQR(t.tableNumber, prefix)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '8px',
                          background: '#F8FAFC',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <QrCode size={12} /> Print {spaceLabel} Standee
                      </button>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        )
      )}

      {/* WAITER CALLS SUBTAB */}
      {activeSubTab === 'service-requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Subtab Status Summary Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: safeServiceRequests.length > 0 ? '#FFFBEB' : '#F0FDF4',
            border: safeServiceRequests.length > 0 ? '1px solid #FDE68A' : '1px solid #BBF7D0',
            padding: '12px 18px',
            borderRadius: '16px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: safeServiceRequests.length > 0 ? '#FEF3C7' : '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem'
              }}>
                {safeServiceRequests.length > 0 ? '🛎️' : '✨'}
              </div>
              <div>
                <strong style={{ fontSize: '0.96rem', color: safeServiceRequests.length > 0 ? '#92400E' : '#166534', display: 'block' }}>
                  {safeServiceRequests.length > 0 ? `Active Waiter Calls (${safeServiceRequests.length} Pending)` : 'All Tables Attended'}
                </strong>
                <span style={{ fontSize: '0.78rem', color: safeServiceRequests.length > 0 ? '#B45309' : '#15803D' }}>
                  {safeServiceRequests.length > 0 ? 'Staff attention required at the tables listed below.' : 'No pending bell rings or customer assistance requests.'}
                </span>
              </div>
            </div>

            {safeServiceRequests.length > 0 && (
              <span style={{
                background: '#F59E0B',
                color: '#FFFFFF',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 900,
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
              }}>
                ⚡ Needs Attention
              </span>
            )}
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {safeServiceRequests.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '48px 20px',
                textAlign: 'center',
                background: '#FFFFFF',
                borderRadius: '20px',
                border: '1.5px dashed #CBD5E1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem',
                  marginBottom: '4px'
                }}>
                  🎉
                </div>
                <strong style={{ fontSize: '1.1rem', color: '#0F172A' }}>No Pending Waiter Calls</strong>
                <p style={{ fontSize: '0.84rem', color: '#64748B', margin: 0, maxWidth: '420px' }}>
                  Customer requests made via the digital QR menu (e.g. "Call Waiter", "Clean Table", "Water") will ring and pop up here live.
                </p>
              </div>
            ) : (
              safeServiceRequests.map(sr => {
                const isPresence = sr.request_type === 'presence_verification';

                if (isPresence) {
                  const isExpired = (sr.expires_at && new Date(sr.expires_at).getTime() <= currentTime) || sr.is_expired;
                  const remainingMs = sr.expires_at ? Math.max(0, new Date(sr.expires_at).getTime() - currentTime) : 0;
                  const remainingSecs = Math.floor(remainingMs / 1000);
                  const mins = Math.floor(remainingSecs / 60);
                  const secs = remainingSecs % 60;
                  const countdownStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  const isApproving = processingReqState[sr.id] === 'approving';
                  const isRejecting = processingReqState[sr.id] === 'rejecting';
                  const isProcessing = isApproving || isRejecting;

                  return (
                    <div
                      key={sr.id}
                      style={{
                        background: isExpired ? '#F8FAFC' : '#FFFFFF',
                        border: isExpired ? '1.5px solid #CBD5E1' : '1.5px solid #10B981',
                        borderLeft: isExpired ? '6px solid #94A3B8' : '6px solid #10B981',
                        borderRadius: '18px',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        boxShadow: isExpired ? '0 4px 12px rgba(0,0,0,0.03)' : '0 8px 24px rgba(16, 185, 129, 0.12)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Header: Table badge & Presence status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{
                            background: '#0F172A',
                            color: '#FFFFFF',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '0.88rem',
                            fontWeight: 900,
                            letterSpacing: '0.2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            🛡️ {formatCleanTableLabel(sr.table_number, sr.space_type)}
                          </span>
                          <span style={{
                            background: isExpired ? '#F1F5F9' : '#DCFCE7',
                            color: isExpired ? '#64748B' : '#166534',
                            border: isExpired ? '1px solid #CBD5E1' : '1px solid #86EFAC',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: isExpired ? '#94A3B8' : '#10B981',
                              display: 'inline-block'
                            }} />
                            {isExpired ? 'EXPIRED' : 'PRESENCE VERIFICATION'}
                          </span>
                        </div>

                        {/* Request Information */}
                        <div>
                          <strong style={{ fontSize: '1.05rem', color: isExpired ? '#64748B' : '#0F172A', display: 'block', fontWeight: 900, marginBottom: '4px' }}>
                            🛡️ Table Presence Verification
                          </strong>
                          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                            Customer is at the table requesting staff authorization to place a table order.
                          </p>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '8px',
                            fontSize: '0.74rem',
                            color: '#475569',
                            background: '#F8FAFC',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            flexWrap: 'wrap'
                          }}>
                            <span style={{ fontWeight: 800, color: '#0F172A' }}>Request P-{sr.id}</span>
                            <span>•</span>
                            <span>⏱️ {new Date(sr.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            {sr.expires_at && (
                              <>
                                <span>•</span>
                                <span style={{ fontWeight: 800, color: isExpired ? '#DC2626' : '#059669' }}>
                                  {isExpired ? '⌛ Expired' : `⌛ Expires in ${countdownStr}`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {isExpired ? (
                        <button
                          onClick={() => onResolveServiceRequest(sr.id)}
                          style={{
                            width: '100%',
                            background: '#F1F5F9',
                            color: '#64748B',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            border: '1px solid #CBD5E1',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          ✕ Dismiss Expired Request
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <button
                            onClick={() => handleApprove(sr)}
                            disabled={isProcessing}
                            style={{
                              flex: 2,
                              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                              color: '#FFFFFF',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              fontWeight: 900,
                              fontSize: '0.86rem',
                              border: 'none',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              opacity: isProcessing ? 0.7 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {isApproving ? 'Approving...' : '✓ Approve Presence'}
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(sr)}
                            disabled={isProcessing}
                            style={{
                              flex: 1,
                              background: '#FFFFFF',
                              color: '#DC2626',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '0.84rem',
                              border: '1.5px solid #FECACA',
                              cursor: isProcessing ? 'not-allowed' : 'pointer',
                              opacity: isProcessing ? 0.7 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                // Normal Waiter Request
                return (
                  <div
                    key={sr.id}
                    style={{
                      background: '#FFFFFF',
                      border: '1.5px solid #FCD34D',
                      borderLeft: '6px solid #F59E0B',
                      borderRadius: '18px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                      boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Header: Table badge & Urgent status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          background: '#0F172A',
                          color: '#FFFFFF',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.88rem',
                          fontWeight: 900,
                          letterSpacing: '0.2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🍽️ {formatCleanTableLabel(sr.table_number, sr.space_type)}
                        </span>
                        <span style={{
                          background: '#FEF3C7',
                          color: '#B45309',
                          border: '1px solid #FCD34D',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
                          PENDING
                        </span>
                      </div>

                      {/* Request Type */}
                      <div>
                        <strong style={{ fontSize: '1.05rem', color: '#1E293B', display: 'block', fontWeight: 900 }}>
                          {sr.request_type}
                        </strong>
                        {sr.note && (
                          <div style={{
                            background: '#F8FAFC',
                            border: '1px dashed #CBD5E1',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            color: '#475569',
                            fontStyle: 'italic',
                            marginTop: '6px'
                          }}>
                            💬 "{sr.note}"
                          </div>
                        )}
                      </div>

                      {/* Time Requested */}
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⏱️ Requested at {new Date(sr.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => onResolveServiceRequest(sr.id)}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                        color: '#FFFFFF',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontWeight: 900,
                        fontSize: '0.86rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      ✓ Mark Attended & Clear
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingModalReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '24px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 900
                }}>
                  ✕
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0F172A' }}>
                    Reject Presence Request
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {formatCleanTableLabel(rejectingModalReq.table_number, rejectingModalReq.space_type)} • Request P-{rejectingModalReq.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setRejectingModalReq(null)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B'
                }}
              >
                ✕
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '8px' }}>
                Select Reason for Rejection:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Customer not visible at table',
                  'Wrong table / seat',
                  'Unable to verify physical presence',
                  'Other'
                ].map(reason => (
                  <label
                    key={reason}
                    onClick={() => setSelectedRejectReason(reason)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: selectedRejectReason === reason ? '2px solid #DC2626' : '1px solid #E2E8F0',
                      background: selectedRejectReason === reason ? '#FEF2F2' : '#FFFFFF',
                      cursor: 'pointer',
                      fontSize: '0.86rem',
                      fontWeight: selectedRejectReason === reason ? 800 : 500,
                      color: selectedRejectReason === reason ? '#991B1B' : '#334155',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name="reject_reason"
                      checked={selectedRejectReason === reason}
                      onChange={() => setSelectedRejectReason(reason)}
                      style={{ accentColor: '#DC2626' }}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {selectedRejectReason === 'Other' && (
                <input
                  type="text"
                  placeholder="Type reason for rejection..."
                  value={customRejectReason}
                  onChange={(e) => setCustomRejectReason(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box'
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setRejectingModalReq(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#F1F5F9',
                  color: '#475569',
                  fontWeight: 800,
                  border: 'none',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                style={{
                  flex: 1.5,
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  border: 'none',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)'
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

