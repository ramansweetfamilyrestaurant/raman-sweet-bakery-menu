/**
 * Shared Pure KDS Queue Filter Utility
 *
 * Centralizes active kitchen queue filtering logic shared across
 * embedded KDS views (KdsDisplayView.jsx), standalone KDS pages, and regression test suites.
 *
 * Policy:
 * 1. Malformed order objects are rejected (!order || typeof order !== 'object').
 * 2. Missing lifecycle fields (is_settled === undefined || kitchen_prepared === undefined)
 *    are rejected because their state is unknown.
 *    Explicit legacy database NULL is treated as 0 (unsettled / unprepared).
 * 3. Explicitly settled orders (is_settled === 1 || is_settled === true || is_settled === '1') are excluded.
 * 4. Explicitly prepared orders (kitchen_prepared === 1 || kitchen_prepared === true || kitchen_prepared === '1') are excluded.
 * 5. Status check:
 *    - 'kitchen' and 'preparing' orders are INCLUDED regardless of sent_to_kds.
 *    - 'accepted' orders are INCLUDED ONLY IF sent_to_kds explicitly equals 1, true, or '1'.
 *    - All other statuses ('pending', 'completed', 'cancelled', 'rejected', unknown) are EXCLUDED.
 */

export function isOrderActiveInKitchen(order) {
  if (!order || typeof order !== 'object') {
    return false;
  }

  // Orders missing is_settled or kitchen_prepared are excluded (state unknown)
  // Explicit database NULL is tolerated and treated as 0 (unsettled / unprepared)
  if (order.is_settled === undefined || order.kitchen_prepared === undefined) {
    return false;
  }

  // Exclude explicitly settled orders
  const isSettled = order.is_settled === 1 || order.is_settled === true || order.is_settled === '1';
  if (isSettled) {
    return false;
  }

  // Exclude explicitly prepared orders
  const isPrepared = order.kitchen_prepared === 1 || order.kitchen_prepared === true || order.kitchen_prepared === '1';
  if (isPrepared) {
    return false;
  }

  // Status and KDS routing evaluation
  const status = typeof order.status === 'string' ? order.status.trim().toLowerCase() : '';

  if (status === 'kitchen' || status === 'preparing') {
    return true;
  }

  if (status === 'accepted') {
    const isSentToKds = order.sent_to_kds === 1 || order.sent_to_kds === true || order.sent_to_kds === '1';
    return isSentToKds;
  }

  // All other statuses ('pending', 'completed', 'cancelled', 'rejected', unknown) are excluded
  return false;
}

export function filterActiveKitchenOrders(orders) {
  if (!Array.isArray(orders)) {
    return [];
  }

  const active = orders.filter(isOrderActiveInKitchen);

  // FIFO kitchen queue ordering (oldest tickets first)
  return active.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeA - timeB;
  });
}
