import React from 'react';
import { Clock, Printer, MapPin, Bell, RefreshCw, CheckCircle2, QrCode, XCircle, UtensilsCrossed } from 'lucide-react';
import KdsDisplayView from './KdsDisplayView';

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
  restaurantInfo,
  onPrintQR,
  onDirectPrint,
  onPrintBill,
  onPreviewPrint,
  printingOrderId,
  printingType,
  currencySymbol = '₹',
  ordersEnabled = true
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

  const validOrders = (Array.isArray(orders) ? orders : []).filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
  const safeServiceRequests = Array.isArray(serviceRequests) ? serviceRequests : [];

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

  const prefix = String(restaurantInfo?.table_prefix || 'table').toLowerCase();
  const spaceLabel = prefix === 'cabin' ? 'Cabin' : prefix === 'room' ? 'Room' : prefix === 'vip' ? 'VIP Lounge' : 'Table';
  const spacePlural = prefix === 'cabin' ? 'Cabins' : prefix === 'room' ? 'Rooms' : prefix === 'vip' ? 'VIP Lounges' : 'Tables';
  const spaceField = prefix === 'cabin' ? 'total_cabins' : prefix === 'room' ? 'total_rooms' : prefix === 'vip' ? 'total_vip' : 'total_tables';

  const totalTables = Number(restaurantInfo?.[spaceField]) || Number(restaurantInfo?.total_tables) || 10;
  const tableGrid = Array.from({ length: totalTables }, (_, i) => {
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

  const formatCleanTableLabel = (raw) => {
    if (!raw) return 'Table 1';
    const str = String(raw).trim();
    if (/^(table|room|cabin|vip|takeaway|parcel)/i.test(str) || /^[\p{Emoji}\u2000-\u3300]/u.test(str)) {
      return str;
    }
    return `Table #${str}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            {kdsEnabled ? 'Orders & Kitchen Operations' : 'Live Table Orders & Operations'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            {kdsEnabled ? 'Live table orders, floor map & kitchen display screen' : 'Live table orders, floor map & waiter calls'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--adm-surface-subtle)', padding: '6px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)', fontSize: '0.78rem', fontWeight: 800 }}>
            <strong style={{ color: 'var(--adm-success)' }}>{currencySymbol}{todayTotalSales.toLocaleString()}</strong> Today
          </span>
          <span style={{ background: 'var(--adm-warning-bg)', color: 'var(--adm-warning)', padding: '6px 12px', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-warning-border)', fontSize: '0.78rem', fontWeight: 800 }}>
            {pendingCount} Pending
          </span>
        </div>
      </div>

      {/* Sub-Navigation Chips */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'orders' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          Live Orders ({validOrders.length})
        </button>
        {kdsEnabled && (
          <a
            href={`/${localStorage.getItem('touchqr_admin_slug') || restaurantInfo?.slug || ''}/kitchen`}
            target="_blank"
            rel="noopener noreferrer"
            className="adm-btn adm-btn-sm adm-btn-secondary"
            style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)', background: '#0F172A', color: '#38BDF8', border: '1px solid #38BDF8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}
          >
            🍳 Open /kitchen Screen ↗
          </a>
        )}
        <button
          onClick={() => setActiveSubTab('floor-map')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'floor-map' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          🗺️ Floor Map ({totalTables} Tables)
        </button>
        <button
          onClick={() => setActiveSubTab('service-requests')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'service-requests' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          🛎️ Waiter Calls ({safeServiceRequests.length})
        </button>
      </div>

      {/* LIVE ORDERS SUBTAB */}
      {activeSubTab === 'orders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Status Filter Horizontal Strip */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'all', label: `All (${validOrders.length})` },
              { id: 'pending', label: `🟡 Pending (${pendingCount})` },
              { id: 'kitchen', label: kdsEnabled ? `👨‍🍳 Kitchen (${kitchenCount})` : `🟢 In Progress (${kitchenCount})` },
              { id: 'served', label: `🍽 Served (${servedCount})` },
              { id: 'completed', label: `✅ Complete (${completedCount})` }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setKotFilter(filter.id)}
                className={`adm-btn adm-btn-sm ${kotFilter === filter.id ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--adm-radius-full)' }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Orders Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredOrders.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', background: '#FFF', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
                <Clock size={36} color="var(--adm-muted)" style={{ marginBottom: '8px' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 2px 0' }}>No active orders in this view</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--adm-muted)', margin: 0 }}>New orders scanned via QR will ring and appear here live.</p>
              </div>
            ) : (
              filteredOrders.map(order => (
                <div key={order.id} className="adm-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: 'var(--adm-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{formatCleanTableLabel(order.table_number)}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--adm-muted)' }}>#{order.id}</span>
                        {Number(order.round_number) > 1 && (
                          <span style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', padding: '1px 7px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 900 }}>
                            🔄 Round {order.round_number} (Add-on)
                          </span>
                        )}
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--adm-muted)' }}>
                        {order.customer_name || 'Dine-in Guest'} • {new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`adm-badge adm-badge-${order.status === 'pending' ? 'warning' : (order.status === 'kitchen' || order.status === 'accepted') ? 'info' : 'success'}`}>
                        {(order.status || 'PENDING').toUpperCase()}
                      </span>
                      {kdsEnabled && isPrep(order.kitchen_prepared) ? (
                        <span style={{ fontSize: '0.68rem', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', fontWeight: 900, boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}>
                          🍳 PREPARED IN KITCHEN
                        </span>
                      ) : (kdsEnabled && dualPrinterEnabled && (order.sent_to_kds === 0 || order.sent_to_kds === '0')) ? (
                        <span style={{ fontSize: '0.68rem', background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF', padding: '1px 6px', borderRadius: '12px', fontWeight: 800 }}>📦 Counter Only</span>
                      ) : (kdsEnabled && (order.status === 'kitchen' || order.status === 'preparing' || order.status === 'accepted')) ? (
                        <span style={{ fontSize: '0.68rem', background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', padding: '1px 6px', borderRadius: '12px', fontWeight: 800 }}>🍳 Kitchen KDS</span>
                      ) : null}
                      {onPreviewPrint && (
                        <button
                          onClick={() => onPreviewPrint(order, 'kot')}
                          title="Open Print Preview Window"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--adm-muted)',
                            cursor: 'pointer',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '4px 6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          👁️ Preview
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{ fontSize: '0.84rem', background: 'var(--adm-surface-subtle)', padding: '10px 12px', borderRadius: 'var(--adm-radius-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {safeParseItems(order.items).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: idx < safeParseItems(order.items).length - 1 ? '1px dashed #E2E8F0' : 'none', paddingBottom: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700 }}>{item.name}{item.portion ? ` (${item.portion})` : ''} ×{item.quantity || item.qty || 1}</span>
                          <strong>{currencySymbol}{(Number(item.price) || 0) * (item.quantity || item.qty || 1)}</strong>
                        </div>
                        {(() => {
                          const mods = safeParseModifiers(item.modifiers);
                          if (mods.length === 0) return null;
                          return (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingLeft: '8px', marginTop: '2px' }}>
                              {mods.map((m, mIdx) => (
                                <span key={mIdx} style={{ fontSize: '0.72rem', color: '#065F46', background: '#D1FAE5', border: '1px solid #6EE7B7', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--adm-primary)' }}>{currencySymbol}{order.total_amount}</strong>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onUpdateStatus(order.id, 'accepted')}
                            className="adm-btn adm-btn-primary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 14px' }}
                          >
                            ✓ Accept Order
                          </button>
                          <button onClick={() => onUpdateStatus(order.id, 'rejected')} className="adm-btn adm-btn-danger adm-btn-sm" style={{ fontWeight: 700, minHeight: '44px', padding: '0 10px' }}>
                            <XCircle size={14} /> Reject
                          </button>
                        </>
                      )}
                      {order.status === 'accepted' && (
                        <>
                          {!isPrep(order.kitchen_prepared) && (
                            <button
                              onClick={() => onUpdateStatus(order.id, 'accepted', { kitchen_prepared: 1, silent: true })}
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}
                            >
                              🔔 Mark Ready
                            </button>
                          )}
                          <button
                            onClick={() => onUpdateStatus(order.id, 'served', { sent_to_kds: 0, kitchen_prepared: 1, silent: true })}
                            className="adm-btn adm-btn-primary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px' }}
                          >
                            🍽️ Mark Served
                          </button>
                          <button
                            onClick={() => onOpenBillModal ? onOpenBillModal(order) : onUpdateStatus(order.id, 'completed')}
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px' }}
                          >
                            💳 Settle Bill
                          </button>
                        </>
                      )}
                      {order.status === 'kitchen' && (
                        <>
                          {!isPrep(order.kitchen_prepared) && (
                            <button
                              onClick={() => onUpdateStatus(order.id, 'kitchen', { kitchen_prepared: 1, silent: true })}
                              className="adm-btn adm-btn-secondary adm-btn-sm"
                              style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}
                            >
                              🔔 Mark Ready
                            </button>
                          )}
                          <button
                            onClick={() => onUpdateStatus(order.id, 'served', { sent_to_kds: 0, kitchen_prepared: 1, silent: true })}
                            className="adm-btn adm-btn-primary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px' }}
                          >
                            🍽️ Mark Served
                          </button>
                          <button
                            onClick={() => onOpenBillModal ? onOpenBillModal(order) : onUpdateStatus(order.id, 'completed')}
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px' }}
                          >
                            💳 Settle Bill
                          </button>
                        </>
                      )}
                      {order.status === 'served' && (
                        <button
                          onClick={() => onOpenBillModal ? onOpenBillModal(order) : onUpdateStatus(order.id, 'completed')}
                          className="adm-btn adm-btn-primary adm-btn-sm"
                          style={{ fontWeight: 800, minHeight: '44px', padding: '0 14px', background: '#10B981', color: '#FFFFFF' }}
                        >
                          💳 Settle Bill
                        </button>
                      )}
                      {onDirectPrint && (
                        <button
                          onClick={() => onDirectPrint(order, 'kot')}
                          disabled={printingOrderId === order.id}
                          className="adm-btn adm-btn-secondary adm-btn-sm"
                          style={{
                            fontWeight: 800,
                            minHeight: '44px',
                            padding: '0 12px',
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
                        className="adm-btn adm-btn-secondary adm-btn-sm"
                        style={{
                          fontWeight: 800,
                          minHeight: '44px',
                          padding: '0 12px',
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
              ))
            )}
          </div>
        </div>
      )}



      {/* FLOOR MAP SUBTAB */}
      {activeSubTab === 'floor-map' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {tableGrid.map(t => {
            const isOccupied = t.status === 'occupied';
            const isService = t.status === 'service_needed';
            const isFree = t.status === 'available';

            return (
              <div
                key={t.tableNumber}
                className="adm-card"
                style={{
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px',
                  borderColor: isOccupied ? 'var(--adm-danger-border)' : (isService ? 'var(--adm-warning-border)' : 'var(--adm-success-border)'),
                  background: isOccupied ? 'var(--adm-danger-bg)' : (isService ? 'var(--adm-warning-bg)' : 'var(--adm-surface)')
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--adm-primary)' }}>{spaceLabel.toUpperCase()} {t.tableNumber}</strong>
                    <span className={`adm-badge adm-badge-${isOccupied ? 'danger' : isService ? 'warning' : 'success'}`} style={{ fontSize: '0.64rem' }}>
                      {isOccupied ? '🔴 SEATED' : isService ? '🟡 CALL' : '🟢 FREE'}
                    </span>
                  </div>

                  {isOccupied && t.activeOrder && (
                    <div style={{ fontSize: '0.78rem', background: '#FFF', padding: '8px', borderRadius: '8px', border: '1px solid var(--adm-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                        <span>Order #{t.activeOrder.id}</span>
                        <span style={{ color: 'var(--adm-danger)' }}>{currencySymbol}{t.activeOrder.total_amount}</span>
                      </div>
                      <div style={{ color: 'var(--adm-muted)', marginTop: '2px' }}>
                        {t.activeOrder.customer_name || 'Guest'} • {safeParseItems(t.activeOrder.items).length} items
                      </div>
                    </div>
                  )}

                  {isService && t.serviceRequest && (
                    <div style={{ fontSize: '0.78rem', background: '#FFF', padding: '8px', borderRadius: '8px', border: '1px solid var(--adm-warning-border)' }}>
                      <strong style={{ color: 'var(--adm-warning)', display: 'block' }}>{t.serviceRequest.request_type}</strong>
                      {t.serviceRequest.note && <span style={{ fontStyle: 'italic', color: 'var(--adm-muted)' }}>"{t.serviceRequest.note}"</span>}
                    </div>
                  )}

                  {isFree && (
                    <span style={{ fontSize: '0.76rem', color: 'var(--adm-success)', fontStyle: 'italic', display: 'block', margin: '8px 0' }}>
                      Ready for guests ✨
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {isOccupied && t.activeOrder && (
                    <>
                      <button onClick={() => onOpenBillModal(t.activeOrder)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ flex: 1 }}>
                        <Printer size={12} /> Bill
                      </button>
                      <button onClick={() => onUpdateStatus(t.activeOrder.id, 'completed')} className="adm-btn adm-btn-primary adm-btn-sm" style={{ flex: 1 }}>
                        Clear
                      </button>
                    </>
                  )}

                  {isService && t.serviceRequest && (
                    <button onClick={() => onResolveServiceRequest(t.serviceRequest.id)} className="adm-btn adm-btn-warning adm-btn-sm" style={{ width: '100%' }}>
                      ✓ Attend Call
                    </button>
                  )}

                  {isFree && onPrintQR && (
                    <button onClick={() => onPrintQR(t.tableNumber)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ width: '100%' }}>
                      <QrCode size={12} /> Print Table Standee
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
              safeServiceRequests.map(sr => (
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
                        🍽️ {formatCleanTableLabel(sr.table_number)}
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

