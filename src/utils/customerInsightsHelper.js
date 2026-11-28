import { formatOrderLocation } from './billingHelper.js';

const roundMoney = (val) => Math.round((Number(val) || 0) * 100) / 100;

/**
 * Parses timestamps consistently across SQLite ("YYYY-MM-DD HH:MM:SS" UTC),
 * PostgreSQL ISO timestamps, and Date objects.
 */
export function parseOrderDateSafe(d, fallback = new Date()) {
  if (!d) return fallback;
  if (d instanceof Date) return isNaN(d.getTime()) ? fallback : d;
  let str = String(d).trim();
  if (!str) return fallback;
  if (str.includes(' ') && !str.includes('T')) {
    str = str.replace(' ', 'T');
  }
  str = str.replace(/([+-]\d{2})$/, '$1:00');
  if (!str.endsWith('Z') && !str.includes('+') && !str.slice(10).includes('-')) {
    str = `${str}Z`;
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * Formats a Date into IST YYYY-MM-DD key.
 */
export function getISTDateKey(dateObj, fallbackMs = Date.now()) {
  const d = dateObj ? parseOrderDateSafe(dateObj) : new Date(fallbackMs);
  try {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  } catch (_) { }
  const ist = new Date(d.getTime() + 19800000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Filters out cancelled/rejected orders and applies IST-safe timeframe windows.
 */
export function filterOrdersByTimeframe(rawOrders = [], timeframeFilter = 'all', nowMs = Date.now()) {
  if (!Array.isArray(rawOrders)) return [];
  const validOrders = rawOrders.filter(o => o && o.status !== 'cancelled' && o.status !== 'rejected');
  if (timeframeFilter === 'all') return validOrders;

  const todayIst = getISTDateKey(new Date(nowMs), nowMs);
  const sevenDaysAgo = nowMs - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = nowMs - (30 * 24 * 60 * 60 * 1000);

  return validOrders.filter(o => {
    const ordDate = parseOrderDateSafe(o.created_at, null);
    if (!ordDate) return false;
    if (timeframeFilter === 'today') {
      return getISTDateKey(ordDate, nowMs) === todayIst;
    }
    if (timeframeFilter === '7d') return ordDate.getTime() >= sevenDaysAgo;
    if (timeframeFilter === '30d') return ordDate.getTime() >= thirtyDaysAgo;
    return true;
  });
}

/**
 * Canonical order channel classifier: 'WhatsApp' | 'QR' | 'Direct / POS'.
 * Distinguishes Counter POS sessions (counter/settled non-QR-tracking sessions) from Customer QR orders.
 */
export function classifyOrderChannel(order = {}) {
  const orderTypeStr = String(order.order_type || order.source || '').toLowerCase().trim();
  const sessionId = String(order.session_id || '').trim();
  const tableNum = String(order.table_number || '').trim();

  if (orderTypeStr.includes('whatsapp')) {
    return 'WhatsApp';
  }

  const isExplicitPosSession =
    /^sess_\d+_counter_/i.test(sessionId) ||
    (/^sess_\d+_/.test(sessionId) && !order.tracking_token_hash && Number(order.is_settled) === 1 && Boolean(order.payment_method));

  const isPos =
    orderTypeStr.includes('pos') ||
    isExplicitPosSession ||
    tableNum.toLowerCase() === 'counter' ||
    (orderTypeStr === 'takeaway' && !orderTypeStr.includes('qr') && !order.tracking_token_hash);

  if (isPos) {
    return 'Direct / POS';
  }

  const isQR =
    Boolean(sessionId) ||
    Boolean(order.tracking_token_hash) ||
    orderTypeStr.includes('qr') ||
    (Boolean(tableNum) && !['counter', 'takeaway', 'dine-in'].includes(tableNum.toLowerCase()));

  return isQR ? 'QR' : 'Direct / POS';
}

export function isGenericGuestLabel(name = '') {
  const clean = String(name || '').trim().toLowerCase();
  if (!clean || clean.length < 2) return true;
  return (
    clean.includes('guest') ||
    clean.includes('table') ||
    clean.includes('counter customer') ||
    clean.includes('room customer') ||
    clean.includes('cabin customer') ||
    clean.includes('seat customer') ||
    clean.includes('vip customer') ||
    clean.includes('walk-in') ||
    clean.includes('walkin') ||
    clean === 'customer'
  );
}

export function parseOrderItemsSafe(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * Formats an order's location without double-prefixing named spaces (e.g. Booth 1) or tokens.
 */
export function formatGuestOrderLocation(order = {}, restaurantInfo = {}) {
  if (!order) return 'Dine-In';
  if (order.token_display) return `Token ${order.token_display}`;
  if (order.token_number) return `Token ${order.token_number}`;
  const raw = String(order.table_number || '').trim();
  if (!raw) return formatOrderLocation(order, restaurantInfo);
  if (/^[a-zA-Z]{2,}[\s\-_]+\S+/.test(raw) && !/^(table|room|cabin|vip|seat|screen|counter|takeaway|parcel|pickup|delivery)/i.test(raw)) {
    return raw;
  }
  return formatOrderLocation(order, restaurantInfo);
}

/**
 * Groups filtered orders into factual guest sessions and computes summary CRM metrics.
 */
export function buildGuestRecordsAndMetrics(filteredOrders = [], restaurantInfo = {}) {
  const map = new Map();
  let qrCount = 0;
  let waCount = 0;
  let directCount = 0;
  let totalRevenue = 0;
  const overallItemsMap = {};

  filteredOrders.forEach(o => {
    const name = String(o.customer_name || '').trim();
    const phone = String(o.customer_phone || '').trim();
    const sessionId = String(o.session_id || '').trim();
    const tableNum = String(o.table_number || '').trim();
    const amount = Number(o.total_amount || o.grand_total_amount || 0);
    const createdAt = parseOrderDateSafe(o.created_at);
    const source = classifyOrderChannel(o);

    if (source === 'WhatsApp') waCount++;
    else if (source === 'QR') qrCount++;
    else directCount++;
    totalRevenue += amount;

    const digitsOnly = phone.replace(/\D/g, '');
    let groupKey = '';
    let isIdentified = false;
    let displayName = '';

    if (phone && digitsOnly.length >= 6) {
      const canonicalDigits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
      groupKey = `phone_${canonicalDigits}`;
      isIdentified = true;
      displayName = (!isGenericGuestLabel(name) ? name : '') || `Guest (${canonicalDigits.slice(-4)})`;
    } else if (!isGenericGuestLabel(name)) {
      groupKey = `name_${name.toLowerCase()}`;
      isIdentified = true;
      displayName = name;
    } else if (sessionId) {
      groupKey = `sess_${sessionId}`;
      isIdentified = false;
      const shortHash = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
      displayName = `Guest #${shortHash || o.id}`;
    } else {
      groupKey = `order_${o.id}`;
      isIdentified = false;
      displayName = `Guest #${String(o.order_number || o.id).slice(-4)}`;
    }

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        id: groupKey,
        isIdentified,
        displayName,
        customerName: !isGenericGuestLabel(name) ? name : null,
        customerPhone: phone || null,
        primaryTable: tableNum || 'Dine-In',
        primaryOrder: o,
        primaryLocation: formatGuestOrderLocation(o, restaurantInfo),
        sources: new Set([source]),
        ordersCount: 0,
        totalSpend: 0,
        firstActivity: createdAt,
        lastActivity: createdAt,
        orders: [],
        itemsMap: {}
      });
    }

    const rec = map.get(groupKey);
    if (!rec.customerName && !isGenericGuestLabel(name)) {
      rec.customerName = name;
      rec.displayName = name;
    }
    rec.ordersCount += 1;
    rec.totalSpend = roundMoney(rec.totalSpend + amount);
    rec.sources.add(source);
    if (createdAt >= rec.lastActivity) {
      rec.lastActivity = createdAt;
      rec.primaryTable = tableNum || rec.primaryTable;
      rec.primaryOrder = o;
      rec.primaryLocation = formatGuestOrderLocation(o, restaurantInfo);
    }
    if (createdAt < rec.firstActivity) rec.firstActivity = createdAt;
    rec.orders.push(o);

    const items = parseOrderItemsSafe(o.items);
    items.forEach(it => {
      const iName = it.name || it.dish_name || 'Item';
      const qty = Number(it.quantity || it.qty || 1);
      const price = Number(it.price || 0);
      rec.itemsMap[iName] = (rec.itemsMap[iName] || 0) + qty;

      if (!overallItemsMap[iName]) {
        overallItemsMap[iName] = { name: iName, quantity: 0, revenue: 0 };
      }
      overallItemsMap[iName].quantity += qty;
      overallItemsMap[iName].revenue = roundMoney(overallItemsMap[iName].revenue + price * qty);
    });
  });

  const guestRecords = Array.from(map.values())
    .map(r => {
      r.orders.sort((a, b) => parseOrderDateSafe(b.created_at) - parseOrderDateSafe(a.created_at));
      r.sourcesList = Array.from(r.sources);
      r.primarySource = r.sourcesList[0] || 'QR';
      return r;
    })
    .sort((a, b) => b.lastActivity - a.lastActivity);

  const totalGuests = guestRecords.length;
  const identifiedGuests = guestRecords.filter(g => g.isIdentified).length;
  const anonymousGuests = totalGuests - identifiedGuests;
  const qrGuestsCount = guestRecords.filter(g => g.sources.has('QR')).length;
  const waGuestsCount = guestRecords.filter(g => g.sources.has('WhatsApp')).length;
  const totalOrders = filteredOrders.length;
  const roundedRevenue = roundMoney(totalRevenue);
  const avgSpendPerGuest = totalGuests > 0 ? Math.round(roundedRevenue / totalGuests) : 0;
  const avgSpendPerOrder = totalOrders > 0 ? Math.round(roundedRevenue / totalOrders) : 0;
  const returningCount = guestRecords.filter(g => g.ordersCount > 1).length;
  const singleOrderCount = totalGuests - returningCount;
  const returningRate = totalGuests > 0 ? Math.round((returningCount / totalGuests) * 100) : 0;
  const topItems = Object.values(overallItemsMap)
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 5);

  return {
    guestRecords,
    metrics: {
      totalGuests,
      identifiedGuests,
      anonymousGuests,
      qrGuestsCount,
      waGuestsCount,
      totalOrders,
      totalRevenue: roundedRevenue,
      avgSpendPerGuest,
      avgSpendPerOrder,
      qrCount,
      waCount,
      directCount,
      returningCount,
      singleOrderCount,
      returningRate,
      topItems
    }
  };
}
