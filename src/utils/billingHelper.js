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
  if (order.token_display) {
    return `Takeaway • Token #${order.token_display}`;
  }
  if (order.token_number) {
    return `Takeaway • Token #${order.token_number}`;
  }
  if (order.counter_token) {
    return `Takeaway • Token #${order.counter_token}`;
  }
  if (order.order_type === 'takeaway') {
    return 'Takeaway / Parcel';
  }
  if (order.order_type === 'delivery' || /^delivery/i.test(order.table_number || '')) {
    return 'Home Delivery';
  }
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
    return 'Takeaway / Parcel';
  }

  if (/^delivery/i.test(raw)) {
    return 'Home Delivery';
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

/**
 * Builds an authoritative NPCI UPI deep-link URI for instant QR scanning and payment.
 * Works seamlessly across Google Pay, PhonePe, Paytm, BHIM, CRED, Amazon Pay, and all Indian banking apps.
 *
 * Spec: upi://pay?pa={upiId}&pn={payeeName}&am={amount}&cu=INR&tn={note}
 *
 * @param {Object} params
 * @param {string} params.upiId - Merchant VPA (e.g. 'merchant@upi' or '9876543210@paytm')
 * @param {string} [params.payeeName] - Business display name (e.g. 'Raman Sweets')
 * @param {number|string} params.amount - Total bill amount
 * @param {string|number} [params.invoiceId] - Invoice/order identifier
 * @param {string} [params.spaceLabel] - Table/Room/Counter location
 * @returns {string|null} - NPCI UPI URI string, or null if upiId is missing/invalid
 */
export function buildUpiPaymentUri({ upiId, payeeName = '', amount = 0, invoiceId = '', spaceLabel = '' }) {
  if (!upiId || typeof upiId !== 'string') return null;
  const cleanId = upiId.trim();
  if (!cleanId || !cleanId.includes('@')) return null;

  const numAmount = Number(amount);
  const formattedAmount = (!isNaN(numAmount) && numAmount > 0) ? numAmount.toFixed(2) : null;
  const cleanPayee = (payeeName || 'Restaurant Merchant').trim().substring(0, 99);

  let noteParts = [];
  if (invoiceId) noteParts.push(`Bill ${String(invoiceId).replace(/[^\w]/g, '')}`);
  if (spaceLabel) noteParts.push(String(spaceLabel).replace(/[^\w\s]/g, '').trim());
  const rawNote = noteParts.filter(Boolean).join(' ') || 'Restaurant Bill';
  const cleanNote = rawNote.substring(0, 50).trim();

  // NPCI UPI Specification requires literal '@' in pa parameter and standard percent-encoding (%20) for spaces.
  // Using URLSearchParams converts '@' to '%40' and spaces to '+', which breaks bank routing in GPay, PhonePe & Paytm.
  const queryParts = [
    `pa=${cleanId}`,
    `pn=${encodeURIComponent(cleanPayee)}`
  ];

  if (formattedAmount) {
    queryParts.push(`am=${formattedAmount}`);
  }

  queryParts.push('cu=INR');

  if (cleanNote) {
    queryParts.push(`tn=${encodeURIComponent(cleanNote)}`);
  }

  return `upi://pay?${queryParts.join('&')}`;
}

/**
 * Generates clean thermal printer HTML for Cashier Day-End Closing Slip (58mm or 80mm).
 */
export function buildDayClosingSlipHtml({
  restaurant = {},
  closingData = {},
  actualCash = 0,
  discrepancy = 0,
  closedBy = 'Cashier',
  shiftName = 'Full Day',
  notes = '',
  paperWidth = '80mm'
}) {
  const is58mm = paperWidth === '58mm';
  const widthPx = is58mm ? '58mm' : '80mm';
  const bodyWidth = is58mm ? '48mm' : '72mm';
  const fontSizeBase = is58mm ? '11px' : '12px';
  const fontSizeHeader = is58mm ? '14px' : '16px';
  const sym = closingData.currency_symbol || restaurant.currency_symbol || '₹';

  const formatMoney = (val) => `${sym}${(Number(val) || 0).toFixed(2)}`;

  const serviceModel = String(restaurant.service_model || closingData.service_model || '').toLowerCase();
  const businessType = String(restaurant.business_type || closingData.business_type || '').toLowerCase();
  const isCinema = serviceModel === 'cinema' || businessType === 'cinema_theatre' || Boolean(restaurant.is_cinema || closingData.is_cinema);
  const isHotel = serviceModel === 'hotel' || businessType === 'hotel_resort' || Boolean(restaurant.is_hotel || closingData.is_hotel);

  const reportTitle = isCinema
    ? 'CINEMA CONCESSIONS & AUDI CLOSING'
    : isHotel
    ? 'HOTEL NIGHT AUDIT & DAY CLOSING'
    : 'DAY CLOSING REPORT';

  const topItemsHtml = (closingData.top_items && closingData.top_items.length > 0)
    ? `
      <div style="margin: 6px 0; border-top: 1px dashed #000; padding-top: 4px;">
        <div style="font-weight: bold; margin-bottom: 2px;">TOP ITEMS SOLD:</div>
        ${closingData.top_items.map(i => `
          <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
            <span>• ${i.name}</span>
            <span>x${i.quantity} (${formatMoney(i.revenue)})</span>
          </div>
        `).join('')}
      </div>
    `
    : '';

  const discStatus = discrepancy === 0
    ? `MATCHED (${formatMoney(0)})`
    : (discrepancy > 0 ? `+${formatMoney(discrepancy)} OVER` : `${formatMoney(discrepancy)} SHORT`);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${reportTitle}</title>
        <style>
          @page { size: ${widthPx} auto; margin: 0; }
          body {
            margin: 0;
            padding: ${is58mm ? '4mm 2mm' : '6mm 4mm'};
            font-family: 'Courier New', Courier, monospace;
            font-size: ${fontSizeBase};
            line-height: 1.3;
            color: #000;
            background: #fff;
            width: ${bodyWidth};
            box-sizing: border-box;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: ${fontSizeHeader};">${(restaurant.name || 'RAMAN SWEET & BAKERY').toUpperCase()}</div>
        <div class="center bold" style="margin: 2px 0;">${reportTitle}</div>
        <div class="center" style="font-size: 0.85em;">Date: ${closingData.date || new Date().toISOString().slice(0, 10)} | ${shiftName}</div>
        ${restaurant.phone ? `<div class="center" style="font-size: 0.8em;">Tel: ${restaurant.phone}</div>` : ''}

        <div class="double-divider"></div>

        <div class="row">
          <span>Total Orders:</span>
          <span class="bold">${closingData.total_orders || 0}</span>
        </div>
        <div class="row bold" style="font-size: 1.1em;">
          <span>GROSS SALES:</span>
          <span>${formatMoney(closingData.gross_sales)}</span>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>💵 Cash Sales:</span>
          <span class="bold">${formatMoney(closingData.cash_sales)}</span>
        </div>
        <div class="row">
          <span>📲 UPI / QR Pay:</span>
          <span class="bold">${formatMoney(closingData.upi_sales)}</span>
        </div>
        ${(closingData.card_sales > 0) ? `
          <div class="row">
            <span>💳 Card Pay:</span>
            <span class="bold">${formatMoney(closingData.card_sales)}</span>
          </div>
        ` : ''}
        ${(closingData.other_sales > 0) ? `
          <div class="row">
            <span>Other Modes:</span>
            <span class="bold">${formatMoney(closingData.other_sales)}</span>
          </div>
        ` : ''}
        ${(closingData.tax_amount > 0) ? `
          <div class="row" style="font-size: 0.9em;">
            <span>GST Tax (Incl):</span>
            <span>${formatMoney(closingData.tax_amount)}</span>
          </div>
        ` : ''}

        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 2px;">SALES BY CHANNEL:</div>
        ${isCinema ? `
          <div class="row">
            <span>• 🎬 Seat Audi Orders (${closingData.cinema_orders || 0}):</span>
            <span>${formatMoney(closingData.cinema_sales || 0)}</span>
          </div>
          <div class="row">
            <span>• 🍿 Concession Counter (${closingData.takeaway_orders || 0}):</span>
            <span>${formatMoney(closingData.takeaway_sales || 0)}</span>
          </div>
          ${((closingData.dine_in_orders || 0) > 0 || (closingData.dine_in_sales || 0) > 0) ? `
          <div class="row">
            <span>• 🍽️ Lounge / Cafe (${closingData.dine_in_orders || 0}):</span>
            <span>${formatMoney(closingData.dine_in_sales || 0)}</span>
          </div>` : ''}
        ` : isHotel ? `
          <div class="row">
            <span>• 🏨 Room Service (${closingData.room_orders || 0}):</span>
            <span>${formatMoney(closingData.room_sales || 0)}</span>
          </div>
          <div class="row">
            <span>• 🍽️ Hotel Restaurant (${closingData.dine_in_orders || 0}):</span>
            <span>${formatMoney(closingData.dine_in_sales || 0)}</span>
          </div>
          <div class="row">
            <span>• 📦 Front Desk / Cafe (${closingData.takeaway_orders || 0}):</span>
            <span>${formatMoney(closingData.takeaway_sales || 0)}</span>
          </div>
          ${((closingData.delivery_orders || 0) > 0 || (closingData.delivery_sales || 0) > 0) ? `
          <div class="row">
            <span>• 🛵 Delivery (${closingData.delivery_orders || 0}):</span>
            <span>${formatMoney(closingData.delivery_sales || 0)}</span>
          </div>` : ''}
        ` : `
          <div class="row">
            <span>• 🍽️ Dine-In (${closingData.dine_in_orders || 0}):</span>
            <span>${formatMoney(closingData.dine_in_sales || 0)}</span>
          </div>
          <div class="row">
            <span>• 📦 Takeaway (${closingData.takeaway_orders || 0}):</span>
            <span>${formatMoney(closingData.takeaway_sales || 0)}</span>
          </div>
          ${((closingData.delivery_orders || 0) > 0 || (closingData.delivery_sales || 0) > 0) ? `
          <div class="row">
            <span>• 🛵 Delivery (${closingData.delivery_orders || 0}):</span>
            <span>${formatMoney(closingData.delivery_sales || 0)}</span>
          </div>` : ''}
          ${((closingData.room_orders || 0) > 0 || (closingData.room_sales || 0) > 0) ? `
          <div class="row">
            <span>• 🏨 Room Service (${closingData.room_orders || 0}):</span>
            <span>${formatMoney(closingData.room_sales || 0)}</span>
          </div>` : ''}
          ${((closingData.cinema_orders || 0) > 0 || (closingData.cinema_sales || 0) > 0) ? `
          <div class="row">
            <span>• 🎬 Seat Audi Orders (${closingData.cinema_orders || 0}):</span>
            <span>${formatMoney(closingData.cinema_sales || 0)}</span>
          </div>` : ''}
        `}

        ${topItemsHtml}

        <div class="double-divider"></div>

        <div class="row bold">
          <span>Cash in Drawer:</span>
          <span>${formatMoney(actualCash)}</span>
        </div>
        <div class="row bold" style="color: ${discrepancy === 0 ? '#000' : '#b91c1c'};">
          <span>Discrepancy:</span>
          <span>${discStatus}</span>
        </div>

        ${notes ? `
          <div style="font-size: 0.85em; margin-top: 4px;">
            <span class="bold">Notes:</span> ${notes}
          </div>
        ` : ''}

        <div style="margin-top: 14px; text-align: left; font-size: 0.85em;">
          <div>Closed By: ${closedBy}</div>
          <div style="margin-top: 10px;">Signature: __________________</div>
        </div>

        <div class="center" style="margin-top: 10px; font-size: 0.75em;">
          TouchQR POS • Automated Shift Audit
        </div>
      </body>
    </html>
  `;
}

/**
 * Builds formatted WhatsApp message text for 1-Click Day Closing share.
 */
export function buildDayClosingWhatsAppMessage({
  restaurant = {},
  closingData = {},
  actualCash = 0,
  discrepancy = 0,
  closedBy = 'Cashier',
  shiftName = 'Full Day',
  notes = ''
}) {
  const sym = closingData.currency_symbol || restaurant.currency_symbol || '₹';
  const formatMoney = (val) => `${sym}${(Number(val) || 0).toFixed(2)}`;

  const serviceModel = String(restaurant.service_model || closingData.service_model || '').toLowerCase();
  const businessType = String(restaurant.business_type || closingData.business_type || '').toLowerCase();
  const isCinema = serviceModel === 'cinema' || businessType === 'cinema_theatre' || Boolean(restaurant.is_cinema || closingData.is_cinema);
  const isHotel = serviceModel === 'hotel' || businessType === 'hotel_resort' || Boolean(restaurant.is_hotel || closingData.is_hotel);

  const reportHeader = isCinema
    ? '🎬 *CINEMA CONCESSIONS & AUDI CLOSING REPORT*'
    : isHotel
    ? '🏨 *HOTEL NIGHT AUDIT & DAY CLOSING REPORT*'
    : '📊 *DAY CLOSING REPORT*';

  let msg = `🏪 *${(restaurant.name || 'RAMAN SWEET & BAKERY').toUpperCase()}*\n`;
  msg += `${reportHeader}\n`;
  msg += `📅 Date: ${closingData.date || new Date().toISOString().slice(0, 10)} (${shiftName})\n`;
  msg += `----------------------------------\n`;
  msg += `• Total Orders: *${closingData.total_orders || 0}*\n`;
  msg += `• Gross Sales : *${formatMoney(closingData.gross_sales)}*\n`;
  msg += `----------------------------------\n`;
  msg += `💵 Cash Collected: *${formatMoney(closingData.cash_sales)}*\n`;
  msg += `📲 UPI / QR Pay  : *${formatMoney(closingData.upi_sales)}*\n`;
  if (closingData.card_sales > 0) {
    msg += `💳 Card Pay      : *${formatMoney(closingData.card_sales)}*\n`;
  }
  if (closingData.tax_amount > 0) {
    msg += `🧾 GST Tax (Incl): ${formatMoney(closingData.tax_amount)}\n`;
  }
  msg += `----------------------------------\n`;
  if (isCinema) {
    msg += `🎬 Audi In-Seat Sales: *${formatMoney(closingData.cinema_sales || 0)}* (${closingData.cinema_orders || 0} orders)\n`;
    msg += `🍿 Concession Counter: *${formatMoney(closingData.takeaway_sales || 0)}* (${closingData.takeaway_orders || 0} orders)\n`;
    if ((closingData.dine_in_orders || 0) > 0 || (closingData.dine_in_sales || 0) > 0) {
      msg += `🍽️ Lounge / Cafe     : *${formatMoney(closingData.dine_in_sales || 0)}* (${closingData.dine_in_orders || 0} orders)\n`;
    }
  } else if (isHotel) {
    msg += `🏨 In-Room Dining    : *${formatMoney(closingData.room_sales || 0)}* (${closingData.room_orders || 0} orders)\n`;
    msg += `🍽️ Hotel Restaurant  : *${formatMoney(closingData.dine_in_sales || 0)}* (${closingData.dine_in_orders || 0} orders)\n`;
    msg += `📦 Front Desk / Cafe : *${formatMoney(closingData.takeaway_sales || 0)}* (${closingData.takeaway_orders || 0} orders)\n`;
    if ((closingData.delivery_orders || 0) > 0 || (closingData.delivery_sales || 0) > 0) {
      msg += `🛵 Delivery Sales    : *${formatMoney(closingData.delivery_sales || 0)}* (${closingData.delivery_orders || 0} orders)\n`;
    }
  } else {
    msg += `🍽️ Dine-In Sales: *${formatMoney(closingData.dine_in_sales || 0)}* (${closingData.dine_in_orders || 0} orders)\n`;
    msg += `📦 Takeaway / Parcel: *${formatMoney(closingData.takeaway_sales || 0)}* (${closingData.takeaway_orders || 0} orders)\n`;
    if ((closingData.delivery_orders || 0) > 0 || (closingData.delivery_sales || 0) > 0) {
      msg += `🛵 Delivery Sales: *${formatMoney(closingData.delivery_sales || 0)}* (${closingData.delivery_orders || 0} orders)\n`;
    }
    if ((closingData.room_orders || 0) > 0 || (closingData.room_sales || 0) > 0) {
      msg += `🏨 Room Service: *${formatMoney(closingData.room_sales || 0)}* (${closingData.room_orders || 0} orders)\n`;
    }
    if ((closingData.cinema_orders || 0) > 0 || (closingData.cinema_sales || 0) > 0) {
      msg += `🎬 Seat Audi Sales: *${formatMoney(closingData.cinema_sales || 0)}* (${closingData.cinema_orders || 0} orders)\n`;
    }
  }
  msg += `----------------------------------\n`;
  msg += `💰 Actual Cash in Drawer: *${formatMoney(actualCash)}*\n`;
  if (discrepancy === 0) {
    msg += `✅ Discrepancy: *MATCHED (${formatMoney(0)})*\n`;
  } else if (discrepancy > 0) {
    msg += `⚠️ Discrepancy: *+${formatMoney(discrepancy)} (EXCESS)*\n`;
  } else {
    msg += `❌ Discrepancy: *${formatMoney(discrepancy)} (SHORTAGE)*\n`;
  }
  if (notes) {
    msg += `📝 Notes: ${notes}\n`;
  }
  msg += `----------------------------------\n`;
  msg += `👤 Shift Closed By: *${closedBy}*\n`;
  msg += `_Generated via TouchQR POS_`;

  return msg;
}


