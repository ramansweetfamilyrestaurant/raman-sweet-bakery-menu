/**
 * TouchQR — Billing & Financial Session Aggregation Utilities
 *
 * Provides shared, authoritative bill calculation logic across:
 * 1. Admin Payment / Settlement Modal (AdminDashboard.jsx)
 * 2. Silent & Preview Bill Printing (getBillHTML in AdminDashboard.jsx)
 * 3. Multi-round dining session aggregation and tax computation
 */

/**
 * Safely parse items from order records (handles stringified JSON, null, undefined, or arrays).
 * @param {Array|string|null} rawItems
 * @returns {Array}
 */
export function safeParseItems(rawItems) {
  if (!rawItems) return [];
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === 'string') {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * Safely parse modifiers from dish items.
 * @param {Array|string|null} rawModifiers
 * @returns {Array}
 */
export function safeParseModifiers(rawModifiers) {
  if (!rawModifiers) return [];
  if (Array.isArray(rawModifiers)) return rawModifiers;
  if (typeof rawModifiers === 'string') {
    try {
      const parsed = JSON.parse(rawModifiers);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * Calculates authoritative consolidated bill details for a target order and its session.
 * Ensures consistent line-item aggregation, GST computation, and inclusion/exclusion rules
 * between the Admin UI Payment Modal and generated print invoices.
 *
 * @param {Object} order - The target order being billed or settled
 * @param {Array} allOrders - In-memory list of orders from the admin state
 * @param {Object} restaurantInfo - Tenant information (GST flag, currency symbol, etc.)
 * @param {Object} settingsForm - Fallback tenant settings
 * @returns {Object} { sessionOrders, totalRoundsCount, isMultiRound, subtotal, cgst, sgst, grandTotal, currency }
 */
export function calculateBillDetails(order, allOrders = [], restaurantInfo = {}, settingsForm = {}) {
  if (!order) {
    return {
      sessionOrders: [],
      totalRoundsCount: 0,
      isMultiRound: false,
      subtotal: 0,
      cgst: 0,
      sgst: 0,
      grandTotal: 0,
      currency: '₹'
    };
  }

  const isGst = Boolean(
    restaurantInfo?.gst_enabled === 1 ||
    restaurantInfo?.gst_enabled === '1' ||
    restaurantInfo?.gst_enabled === true
  );

  const currency = (restaurantInfo?.currency_symbol !== undefined && restaurantInfo?.currency_symbol !== null)
    ? restaurantInfo.currency_symbol
    : ((settingsForm?.currency_symbol !== undefined && settingsForm?.currency_symbol !== null) ? settingsForm.currency_symbol : '₹');

  const isTargetSettled = Boolean(order.is_settled === 1 || order.is_settled === '1' || order.is_settled === true);

  // Consolidate ONLY eligible orders belonging to this exact dining session
  let sessionOrders = [];
  if (order.session_id) {
    sessionOrders = (Array.isArray(allOrders) ? allOrders : []).filter(o => {
      if (o.session_id !== order.session_id) return false;
      if (o.status === 'rejected' || o.status === 'cancelled') return false;
      // Do not double-count previously settled items when billing an active unsettled session
      if (!isTargetSettled && (o.is_settled === 1 || o.is_settled === '1' || o.is_settled === true)) {
        return false;
      }
      return true;
    });
  } else if (order.parent_order_id) {
    sessionOrders = (Array.isArray(allOrders) ? allOrders : []).filter(o => {
      const matchesParent = (o.id === order.parent_order_id || o.parent_order_id === order.parent_order_id || o.id === order.id);
      if (!matchesParent) return false;
      if (o.status === 'rejected' || o.status === 'cancelled') return false;
      if (!isTargetSettled && (o.is_settled === 1 || o.is_settled === '1' || o.is_settled === true)) {
        return false;
      }
      return true;
    });
  } else {
    // Standalone single order (or parent order without session_id)
    sessionOrders = (Array.isArray(allOrders) ? allOrders : []).filter(o => {
      const matchesParent = (o.id === order.id || o.parent_order_id === order.id);
      if (!matchesParent) return false;
      if (o.status === 'rejected' || o.status === 'cancelled') return false;
      if (!isTargetSettled && (o.is_settled === 1 || o.is_settled === '1' || o.is_settled === true)) {
        return false;
      }
      return true;
    });
  }

  if (sessionOrders.length === 0) {
    if (order.status !== 'rejected' && order.status !== 'cancelled') {
      sessionOrders = [order];
    } else {
      sessionOrders = [];
    }
  }

  sessionOrders.sort((a, b) => (Number(a.round_number) || Number(a.id)) - (Number(b.round_number) || Number(b.id)));

  const totalRoundsCount = sessionOrders.length;
  const isMultiRound = totalRoundsCount > 1;

  let subtotal = 0;
  sessionOrders.forEach(ord => {
    const parsed = safeParseItems(ord.items);
    parsed.forEach(i => {
      const lineTotal = Number(i.price || 0) * Number(i.quantity || 1);
      subtotal += lineTotal;
    });
  });

  let cgst = 0;
  let sgst = 0;
  let grandTotal = subtotal;

  if (isGst) {
    cgst = Math.round(subtotal * 0.025 * 100) / 100;
    sgst = Math.round(subtotal * 0.025 * 100) / 100;
    grandTotal = Math.round((subtotal + cgst + sgst) * 100) / 100;
  }

  return {
    sessionOrders,
    totalRoundsCount,
    isMultiRound,
    subtotal,
    cgst,
    sgst,
    grandTotal,
    currency
  };
}
