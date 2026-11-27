import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(0);

/**
 * Publish a tenant-scoped order lifecycle event for connected live streams.
 * Non-persistent best-effort push signal; authoritative data still comes from DB queries.
 */
export function publishOrderLiveEvent(restaurantId, payload = {}) {
  const rid = Number(restaurantId);
  if (!rid || !Number.isFinite(rid)) return;
  bus.emit(`resto:${rid}`, {
    restaurant_id: rid,
    order_id: payload.orderId ?? payload.order_id ?? null,
    primary_order_id: payload.primaryOrderId ?? payload.primary_order_id ?? null,
    session_id: payload.sessionId ?? payload.session_id ?? null,
    table_number: payload.tableNumber ?? payload.table_number ?? null,
    status: payload.status ?? null,
    kitchen_prepared: payload.kitchen_prepared ?? null,
    sent_to_kds: payload.sent_to_kds ?? null,
    is_settled: payload.is_settled ?? null,
    ts: Date.now()
  });
}

/**
 * Subscribe to tenant-scoped order lifecycle events. Returns an unsubscribe callback.
 */
export function subscribeRestaurantOrders(restaurantId, listener) {
  const rid = Number(restaurantId);
  if (!rid || !Number.isFinite(rid) || typeof listener !== 'function') {
    return () => {};
  }
  const channel = `resto:${rid}`;
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}
