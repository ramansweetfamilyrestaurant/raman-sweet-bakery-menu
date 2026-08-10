import React from 'react';
import { ShoppingBag, Clock, CheckCircle2, AlertCircle, Printer, Eye } from 'lucide-react';

export default function OrdersView({
  orders,
  activeSubTab,
  setActiveSubTab,
  kotFilter,
  setKotFilter,
  onUpdateStatus,
  onOpenBillModal,
  serviceRequests,
  onResolveServiceRequest
}) {
  const filteredOrders = orders.filter(o => {
    if (kotFilter === 'pending') return o.status === 'pending';
    if (kotFilter === 'kitchen') return o.status === 'kitchen' || o.status === 'accepted';
    if (kotFilter === 'served') return o.status === 'served';
    if (kotFilter === 'completed') return o.status === 'completed';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--adm-text)', margin: '0 0 2px 0' }}>
            🧾 Real-Time Orders & Kitchen KOT
          </h2>
          <span style={{ fontSize: '0.76rem', color: 'var(--adm-muted)', fontWeight: 600 }}>
            Live table orders, kitchen tickets, and waiter call requests.
          </span>
        </div>
      </div>

      {/* Sub-Navigation Chips */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'orders' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
        >
          Live Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveSubTab('floor-map')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'floor-map' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
        >
          Floor Map
        </button>
        <button
          onClick={() => setActiveSubTab('service-requests')}
          className={`adm-btn adm-btn-sm ${activeSubTab === 'service-requests' ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
        >
          Waiter Calls ({serviceRequests.length})
        </button>
      </div>

      {/* Status Filter Horizontal Strip */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: '🟡 Pending' },
          { id: 'kitchen', label: '👨‍🍳 Kitchen' },
          { id: 'served', label: '🍽 Served' },
          { id: 'completed', label: '✅ Complete' }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setKotFilter(filter.id)}
            className={`adm-btn adm-btn-sm ${kotFilter === filter.id ? 'adm-btn-primary' : 'adm-btn-secondary'}`}
            style={{ flexShrink: 0 }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Orders List / Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredOrders.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#FFF', borderRadius: 'var(--adm-radius-lg)', border: '1px solid var(--adm-border)' }}>
            <Clock size={36} color="var(--adm-muted)" style={{ marginBottom: '8px' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 2px 0' }}>No active orders</h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--adm-muted)', margin: 0 }}>New table QR orders will appear here automatically.</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="adm-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--adm-primary)', display: 'block' }}>
                    Table {order.table_number || 'Takeaway'} <span style={{ fontSize: '0.75rem', color: 'var(--adm-muted)' }}>#{order.id}</span>
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--adm-muted)' }}>
                    {new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className={`adm-badge adm-badge-${order.status === 'pending' ? 'warning' : order.status === 'kitchen' ? 'info' : 'success'}`}>
                  {(order.status || 'PENDING').toUpperCase()}
                </span>
              </div>

              {/* Order Items */}
              <div style={{ fontSize: '0.82rem', background: 'var(--adm-surface-subtle)', padding: '10px', borderRadius: 'var(--adm-radius-sm)' }}>
                {Array.isArray(order.items) ? order.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{item.name} ×{item.quantity}</span>
                    <strong>₹{item.price * item.quantity}</strong>
                  </div>
                )) : <span>Order Items</span>}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--adm-text)' }}>₹{order.total_amount}</strong>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {order.status === 'pending' && (
                    <button onClick={() => onUpdateStatus(order.id, 'kitchen')} className="adm-btn adm-btn-primary adm-btn-sm">
                      Accept to Kitchen
                    </button>
                  )}
                  {order.status === 'kitchen' && (
                    <button onClick={() => onUpdateStatus(order.id, 'served')} className="adm-btn adm-btn-accent adm-btn-sm">
                      Mark Served
                    </button>
                  )}
                  <button onClick={() => onOpenBillModal(order)} className="adm-btn adm-btn-secondary adm-btn-sm">
                    <Printer size={13} /> Bill
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
