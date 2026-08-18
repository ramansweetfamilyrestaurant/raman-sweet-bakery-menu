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

  const totalTables = Number(restaurantInfo?.total_tables) || 10;
  const tableGrid = Array.from({ length: totalTables }, (_, i) => {
    const tableNum = String(i + 1);
    const activeOrder = validOrders.find(o => String(o.table_number) === tableNum && o.status !== 'completed' && o.status !== 'rejected' && o.status !== 'cancelled');
    const serviceReq = safeServiceRequests.find(s => String(s.table_number) === tableNum);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            Orders & Kitchen Operations
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Live table orders, floor map & kitchen display screen
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
              { id: 'kitchen', label: `👨‍🍳 Kitchen (${kitchenCount})` },
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
                      <strong style={{ fontSize: '1rem', color: 'var(--adm-primary)', display: 'block' }}>
                        Table {order.table_number || 'Takeaway'} <span style={{ fontSize: '0.78rem', color: 'var(--adm-muted)' }}>#{order.id}</span>
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--adm-muted)' }}>
                        {order.customer_name || 'Dine-in Guest'} • {new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`adm-badge adm-badge-${order.status === 'pending' ? 'warning' : (order.status === 'kitchen' || order.status === 'accepted') ? 'info' : 'success'}`}>
                        {(order.status || 'PENDING').toUpperCase()}
                      </span>
                      {isPrep(order.kitchen_prepared) ? (
                        <span style={{ fontSize: '0.68rem', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', fontWeight: 900, boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)' }}>
                          🍳 PREPARED IN KITCHEN
                        </span>
                      ) : (dualPrinterEnabled && (order.sent_to_kds === 0 || order.sent_to_kds === '0')) ? (
                        <span style={{ fontSize: '0.68rem', background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF', padding: '1px 6px', borderRadius: '12px', fontWeight: 800 }}>📦 Counter Only</span>
                      ) : (order.status === 'kitchen' || order.status === 'preparing' || order.status === 'accepted') ? (
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
                          <button
                            onClick={() => onUpdateStatus(order.id, 'kitchen', { sent_to_kds: 1 })}
                            className="adm-btn adm-btn-primary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#38BDF8', border: '1px solid #38BDF8' }}
                          >
                            🍳 Send to Kitchen
                          </button>
                          <button
                            onClick={() => onUpdateStatus(order.id, 'served', { sent_to_kds: 0, kitchen_prepared: 1, silent: true })}
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            style={{ fontWeight: 800, minHeight: '44px', padding: '0 12px' }}
                          >
                            📦 Fulfill at Counter
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
                          <button onClick={() => onUpdateStatus(order.id, 'completed')} className="adm-btn adm-btn-primary adm-btn-sm" style={{ fontWeight: 800, minHeight: '44px', padding: '0 14px' }}>
                            💳 Serve & Complete Bill
                          </button>
                        </>
                      )}
                      {order.status === 'served' && (
                        <button onClick={() => onUpdateStatus(order.id, 'completed')} className="adm-btn adm-btn-primary adm-btn-sm" style={{ fontWeight: 800, minHeight: '44px', padding: '0 14px' }}>
                          💳 Serve & Complete Bill
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
                    <strong style={{ fontSize: '1rem', color: 'var(--adm-primary)' }}>TABLE #{t.tableNumber}</strong>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {safeServiceRequests.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '36px', textAlign: 'center', background: '#FFF', borderRadius: 'var(--adm-radius-md)', border: '1px solid var(--adm-border)' }}>
              <CheckCircle2 size={36} color="var(--adm-success)" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--adm-primary)' }}>No pending waiter calls. All tables are attended!</p>
            </div>
          ) : (
            safeServiceRequests.map(sr => (
              <div key={sr.id} className="adm-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px', background: 'var(--adm-warning-bg)', borderColor: 'var(--adm-warning-border)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--adm-warning)' }}>TABLE #{sr.table_number}</strong>
                    <span className="adm-badge adm-badge-warning">PENDING CALL</span>
                  </div>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--adm-text)', display: 'block' }}>{sr.request_type}</strong>
                  {sr.note && <span style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--adm-muted)' }}>"{sr.note}"</span>}
                  <span style={{ fontSize: '0.7rem', color: 'var(--adm-muted)', display: 'block', marginTop: '4px' }}>
                    Called at {new Date(sr.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <button onClick={() => onResolveServiceRequest(sr.id)} className="adm-btn adm-btn-warning" style={{ width: '100%', fontWeight: 800 }}>
                  ✓ Mark Attended & Resolve
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

