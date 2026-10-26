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

  const effectiveGst = (restaurantInfo?.gst_enabled !== undefined && restaurantInfo?.gst_enabled !== null)
    ? restaurantInfo.gst_enabled
    : settingsForm?.gst_enabled;
  const isGst = Boolean(
    effectiveGst === 1 ||
    effectiveGst === '1' ||
    effectiveGst === true
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
  } else if (order.status !== 'rejected' && order.status !== 'cancelled') {
    // Ensure the target order itself is guaranteed to be in sessionOrders if not already present
    const hasTarget = sessionOrders.some(o => String(o.id) === String(order.id));
    if (!hasTarget) {
      sessionOrders.push(order);
    }
  }

  sessionOrders.sort((a, b) => (Number(a.round_number) || Number(a.id)) - (Number(b.round_number) || Number(b.id)));

  const totalRoundsCount = sessionOrders.length;
  const isMultiRound = totalRoundsCount > 1;

  let subtotal = 0;
  sessionOrders.forEach(ord => {
    const parsed = safeParseItems(ord.items);
    if (parsed.length > 0) {
      parsed.forEach(i => {
        const lineTotal = Number(i.price || 0) * Number(i.quantity || 1);
        subtotal += lineTotal;
      });
    } else if (Number(ord.subtotal_amount) > 0) {
      subtotal += Number(ord.subtotal_amount);
    } else if (Number(ord.total_amount) > 0) {
      const tot = Number(ord.total_amount);
      const tax = Number(ord.tax_amount || (Number(ord.cgst_amount || 0) + Number(ord.sgst_amount || 0)));
      if (tax > 0 && tot >= tax) {
        subtotal += (tot - tax);
      } else if (isGst) {
        subtotal += Math.round((tot / 1.05) * 100) / 100;
      } else {
        subtotal += tot;
      }
    }
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
    currency,
    spaceLabel: formatOrderLocation(order, restaurantInfo || settingsForm)
  };
}

/**
 * Resolves a human-readable, multi-business destination label for an order.
 * Accurately formats Counter orders, Cinema seats, Hotel rooms, Cabins, VIP, and Tables.
 *
 * @param {Object} order - Order record
 * @param {Object} [restaurantInfo={}] - Business / outlet profile
 * @returns {string} E.g., 'Billing Counter', 'Room 302', 'Seat B12', 'Table 4'
 */
export function formatOrderLocation(order = {}, restaurantInfo = {}) {
  if (!order) return 'Takeaway / Counter';
  const raw = String(order.table_number || order.delivery_location || '').trim();
  const spaceType = String(order.space_type || '').toLowerCase();
  const bizType = String(restaurantInfo?.business_type || '').toLowerCase();
  const serviceModel = String(restaurantInfo?.service_model || '').toLowerCase();

  if (spaceType === 'counter' || raw.toLowerCase() === 'counter' || raw.toLowerCase() === 'counter:counter' || /^counter/i.test(raw)) {
    const cleanNum = raw.replace(/^counter\s*#?/i, '').trim();
    return cleanNum && cleanNum.toUpperCase() !== 'COUNTER' ? `Counter ${cleanNum}` : 'Billing Counter';
  }

  const cMatch = raw.match(/^S?(\d+)[- •]+(?:Row[- ]*)?([A-Za-z]+)[- •]+(?:Seat[- ]*)?(\d+)$/i) ||
                 raw.match(/Screen\s*(\d+)\s*[-•]\s*Row\s*([A-Za-z]+)\s*[-•]\s*Seat\s*(\d+)/i);
  if (cMatch) {
    return `Screen ${cMatch[1]} Row ${cMatch[2].toUpperCase()} Seat ${cMatch[3]}`;
  }

  if (bizType === 'cinema_theatre' || serviceModel === 'cinema' || spaceType === 'cinema_seat' || spaceType === 'cinema' || /^seat/i.test(raw)) {
    return raw.toLowerCase().startsWith('screen') ? raw : `Seat ${raw.replace(/^seat\s*#?/i, '')}`;
  }

  if (bizType === 'hotel_resort' || serviceModel === 'hotel' || spaceType === 'room' || /^room/i.test(raw)) {
    return `Room ${raw.replace(/^room\s*#?/i, '')}`;
  }

  if (spaceType === 'cabin' || /^cabin/i.test(raw)) {
    return `Cabin ${raw.replace(/^cabin\s*#?/i, '')}`;
  }

  if (spaceType === 'vip' || /^vip/i.test(raw)) {
    return `VIP ${raw.replace(/^vip\s*#?/i, '')}`;
  }

  if (/^(takeaway|parcel|pickup)/i.test(raw)) {
    return 'Takeaway';
  }

  if (!raw) return 'Table 1';
  if (/^table/i.test(raw)) return raw;
  return `Table ${raw}`;
}

/**
 * Safely triggers the billing/settlement modal action for an order.
 * If onOpenBillModal is missing or not a function, alerts the user and refuses to settle.
 *
 * @param {Object} order - Order to open billing modal for
 * @param {Function} onOpenBillModal - Callback to open billing modal
 * @param {Function} [alertFn] - Optional alert implementation (defaults to global alert)
 */
export function triggerBillAction(order, onOpenBillModal, alertFn = (typeof alert === 'function' ? alert : console.error)) {
  if (!order) return;
  if (typeof onOpenBillModal === 'function') {
    onOpenBillModal(order);
  } else {
    console.error('[BILLING SAFETY] Bill modal handler is unavailable. Refusing to complete order without explicit payment settlement.');
    if (typeof alertFn === 'function') {
      alertFn('Billing modal is unavailable. Orders cannot be completed without explicit payment settlement.');
    }
  }
}
