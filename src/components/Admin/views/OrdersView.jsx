import React from 'react';
import { Clock, Printer, MapPin, Bell, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function OrdersView({
  orders = [],
  activeSubTab = 'orders',
  setActiveSubTab,
  kotFilter = 'all',
  setKotFilter,
  onUpdateStatus,
  onOpenBillModal,
  serviceRequests = [],
  onResolveServiceRequest,
  restaurantInfo
}) {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeServiceRequests = Array.isArray(serviceRequests) ? serviceRequests : [];

  const filteredOrders = safeOrders.filter(o => {
    if (kotFilter === 'pending') return o.status === 'pending';
    if (kotFilter === 'kitchen') return o.status === 'kitchen' || o.status === 'accepted';
    if (kotFilter === 'served') return o.status === 'served';
    if (kotFilter === 'completed') return o.status === 'completed';
    return true;
  });

  const totalTables = Number(restaurantInfo?.total_tables) || 10;
  const tableGrid = Array.from({ length: totalTables }, (_, i) => {
    const tableNum = String(i + 1);
    const activeOrder = safeOrders.find(o => String(o.table_number) === tableNum && o.status !== 'completed' && o.status !== 'rejected');
    const serviceReq = safeServiceRequests.find(s => String(s.table_number) === tableNum);

    let status = 'available';
    if (serviceReq) status = 'service_needed';
    else if (activeOrder) status = 'occupied';

    return { tableNumber: tableNum, status, activeOrder, serviceRequest: serviceReq };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--adm-primary)', margin: '0 0 2px 0' }}>
            Real-Time Orders & Kitchen KOT
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Live table orders, dining hall floor map, and waiter service calls.
          </span>
        </div>
      </div>

      {/* Sub-Navigation Chips */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'orders' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
          style={{ padding: '6px 14px', borderRadius: 'var(--adm-radius-full)' }}
        >
          Live Orders ({safeOrders.length})
        </button>
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
              { id: 'all', label: `All (${safeOrders.length})` },
              { id: 'pending', label: `🟡 Pending (${safeOrders.filter(o => o.status === 'pending').length})` },
              { id: 'kitchen', label: `👨‍🍳 Kitchen (${safeOrders.filter(o => o.status === 'kitchen' || o.status === 'accepted').length})` },
              { id: 'served', label: `🍽 Served (${safeOrders.filter(o => o.status === 'served').length})` },
              { id: 'completed', label: `✅ Complete (${safeOrders.filter(o => o.status === 'completed').length})` }
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

                    <span className={`adm-badge adm-badge-${order.status === 'pending' ? 'warning' : (order.status === 'kitchen' || order.status === 'accepted') ? 'info' : 'success'}`}>
                      {(order.status || 'PENDING').toUpperCase()}
                    </span>
                  </div>

                  {/* Order Items */}
                  <div style={{ fontSize: '0.84rem', background: 'var(--adm-surface-subtle)', padding: '10px 12px', borderRadius: 'var(--adm-radius-sm)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {Array.isArray(order.items) ? order.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.name} ×{item.quantity}</span>
                        <strong>₹{item.price * item.quantity}</strong>
                      </div>
                    )) : <span>Order Items</span>}
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                    <strong style={{ fontSize: '1rem', color: 'var(--adm-primary)' }}>₹{order.total_amount}</strong>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {order.status === 'pending' && (
                        <button onClick={() => onUpdateStatus(order.id, 'kitchen')} className="adm-btn adm-btn-primary adm-btn-sm" style={{ fontWeight: 800 }}>
                          Accept to Kitchen
                        </button>
                      )}
                      {(order.status === 'kitchen' || order.status === 'accepted') && (
                        <button onClick={() => onUpdateStatus(order.id, 'served')} className="adm-btn adm-btn-accent adm-btn-sm" style={{ fontWeight: 800 }}>
                          Mark Served
                        </button>
                      )}
                      {order.status === 'served' && (
                        <button onClick={() => onUpdateStatus(order.id, 'completed')} className="adm-btn adm-btn-primary adm-btn-sm" style={{ fontWeight: 800 }}>
                          Complete Order
                        </button>
                      )}
                      <button onClick={() => onOpenBillModal(order)} className="adm-btn adm-btn-secondary adm-btn-sm" style={{ fontWeight: 800 }}>
                        <Printer size={14} /> Bill
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
                        <span style={{ color: 'var(--adm-danger)' }}>₹{t.activeOrder.total_amount}</span>
                      </div>
                      <div style={{ color: 'var(--adm-muted)', marginTop: '2px' }}>
                        {t.activeOrder.customer_name || 'Guest'} • {Array.isArray(t.activeOrder.items) ? t.activeOrder.items.length : 1} items
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

                <div style={{ display: 'flex', gap: '6px' }}>
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
