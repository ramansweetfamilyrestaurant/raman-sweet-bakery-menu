/**
 * Resolves the human-facing per-business sequential Order / Bill number,
 * falling back safely to DB `id` for legacy records.
 */
export function resolveBusinessOrderNumber(order) {
  if (!order || typeof order !== 'object') return null;
  const candidate =
    order.order_number ??
    order.bill_summary?.primary_order_number ??
    order.bill_summary?.order_number ??
    order.session_summary?.primary_order_number ??
    order.session_summary?.order_number ??
    order.id ??
    order.order_id;
  if (candidate === null || candidate === undefined || candidate === '') return null;
  return String(candidate).trim();
}

export function formatOrderLabel(order, lang = 'en') {
  const num = resolveBusinessOrderNumber(order);
  if (!num) return '';
  return lang === 'hi' ? `ऑर्डर नं. ${num}` : `Order No: ${num}`;
}

export function resolveTakeawayToken(order) {
  if (!order || typeof order !== 'object') return '';
  if (order.token_display) return String(order.token_display).trim();
  if (order.token_number) return `TK-${String(order.token_number).padStart(2, '0')}`;
  return '';
}

export function formatOrderBillNumber(order, isGst = false) {
  const billNum =
    order?.bill_summary?.primary_order_number ??
    order?.primary_order_number ??
    resolveBusinessOrderNumber(order);
  if (!billNum) return '';
  return isGst ? `INV-${billNum}` : String(billNum);
}
