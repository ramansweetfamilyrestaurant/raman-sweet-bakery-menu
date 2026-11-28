/**
 * Shared Analytics & Sales Export Helpers
 * Centralizes IST date handling, period window resolution, formula-safe CSV escaping,
 * payment classification, and case-insensitive plan export entitlement checks.
 */

export function parseSafeDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  let str = String(dateVal).trim();
  if (!str) return null;
  if (str.includes(' ') && !str.includes('T')) {
    str = str.replace(' ', 'T');
  }
  str = str.replace(/([+-]\d{2})$/, '$1:00');
  if (!str.endsWith('Z') && !str.includes('+') && !str.slice(10).includes('-')) {
    str = `${str}Z`;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function getFormattedLocalDate(dateObj) {
  const d = parseSafeDate(dateObj);
  if (!d) return '';
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch (e) {
    // Fallback below uses deterministic UTC+05:30 calculation
  }
  const ist = new Date(d.getTime() + 19800000);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getISTDateOffset(daysBack = 0, referenceNow = Date.now()) {
  const targetMs = Number(referenceNow) - (Number(daysBack) || 0) * 86400000;
  return getFormattedLocalDate(new Date(targetMs));
}

export function formatISTMonthLabel(year, month, style = 'long') {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (!y || !m || m < 1 || m > 12) return '';
  const anchor = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
  return anchor.toLocaleDateString('en-US', {
    month: style === 'short' ? 'short' : 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

export function resolveAnalyticsPeriod(qPeriod, qYear, qMonth, referenceNow = Date.now()) {
  const todayStr = getFormattedLocalDate(new Date(referenceNow));
  const isValidFourDigitYear = (raw) => {
    const str = raw !== undefined && raw !== null ? String(raw).trim() : '';
    if (!/^\d{4}$/.test(str)) return null;
    const y = parseInt(str, 10);
    return (y >= 2000 && y <= 2100) ? y : null;
  };
  const isValidMonthNum = (raw) => {
    const str = raw !== undefined && raw !== null ? String(raw).trim() : '';
    if (!/^\d{1,2}$/.test(str)) return null;
    const m = parseInt(str, 10);
    return (m >= 1 && m <= 12) ? m : null;
  };

  let parsedYear = isValidFourDigitYear(qYear);
  let parsedMonth = isValidMonthNum(qMonth);

  const rawPeriod = String(qPeriod || '').trim();
  if ((!parsedYear || !parsedMonth) && rawPeriod.startsWith('month:')) {
    const parts = rawPeriod.slice(6).split('-');
    if (parts.length === 2) {
      const y = isValidFourDigitYear(parts[0]);
      const m = isValidMonthNum(parts[1]);
      if (y && m) {
        parsedYear = y;
        parsedMonth = m;
      }
    }
  }

  if (parsedYear && parsedMonth) {
    const mm = String(parsedMonth).padStart(2, '0');
    const monthPrefix = `${parsedYear}-${mm}`;
    const daysInMonth = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
    return {
      selectedPeriod: `month:${monthPrefix}`,
      year: parsedYear,
      month: parsedMonth,
      todayStr,
      periodStartDate: `${monthPrefix}-01`,
      periodEndDate: `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`,
      periodLabel: `Month ${monthPrefix}`,
      filePeriodSlug: `Month_${monthPrefix}`
    };
  }

  const normalizedPeriod = ['today', '7d', '30d', '6m'].includes(rawPeriod) ? rawPeriod : 'all';
  if (normalizedPeriod === 'today') {
    return {
      selectedPeriod: 'today',
      year: null,
      month: null,
      todayStr,
      periodStartDate: todayStr,
      periodEndDate: todayStr,
      periodLabel: `Today (${todayStr})`,
      filePeriodSlug: 'Today'
    };
  }
  if (normalizedPeriod === '7d') {
    const start = getISTDateOffset(6, referenceNow);
    return {
      selectedPeriod: '7d',
      year: null,
      month: null,
      todayStr,
      periodStartDate: start,
      periodEndDate: todayStr,
      periodLabel: `Last 7 Days (${start} to ${todayStr})`,
      filePeriodSlug: 'Last_7_Days'
    };
  }
  if (normalizedPeriod === '30d') {
    const start = getISTDateOffset(29, referenceNow);
    return {
      selectedPeriod: '30d',
      year: null,
      month: null,
      todayStr,
      periodStartDate: start,
      periodEndDate: todayStr,
      periodLabel: `Last 30 Days (${start} to ${todayStr})`,
      filePeriodSlug: 'Last_30_Days'
    };
  }
  if (normalizedPeriod === '6m') {
    const start = getISTDateOffset(180, referenceNow);
    return {
      selectedPeriod: '6m',
      year: null,
      month: null,
      todayStr,
      periodStartDate: start,
      periodEndDate: todayStr,
      periodLabel: `Last 6 Months (${start} to ${todayStr})`,
      filePeriodSlug: 'Last_6_Months'
    };
  }

  return {
    selectedPeriod: 'all',
    year: null,
    month: null,
    todayStr,
    periodStartDate: null,
    periodEndDate: null,
    periodLabel: 'All-Time',
    filePeriodSlug: 'All_Time'
  };
}

export function isDateInPeriod(dStr, selectedPeriod, periodStartDate, periodEndDate) {
  if (!dStr) return false;
  if (selectedPeriod === 'all' || (!periodStartDate && !periodEndDate)) return true;
  if (periodStartDate && periodEndDate) {
    return dStr >= periodStartDate && dStr <= periodEndDate;
  }
  return true;
}

export function classifyPaymentMethod(rawMethod) {
  const pMethod = String(rawMethod || 'cash').toLowerCase();
  if (
    pMethod.includes('upi') ||
    pMethod.includes('online') ||
    pMethod.includes('paytm') ||
    pMethod.includes('gpay') ||
    pMethod.includes('phonepe')
  ) {
    return 'upi';
  }
  if (pMethod.includes('card')) return 'card';
  if (pMethod.includes('cash')) return 'cash';
  return 'other';
}

export function escapeCSVCell(val) {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `"${val}"`;
  }
  let str = String(val);
  // Prevent CSV / spreadsheet formula injection (ASCII & fullwidth/control prefixes)
  if (/^[=+\-@\t\r\n\uFF1D\uFF0B\uFF0D\uFF20]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function sanitizeAttachmentFilename(name) {
  return String(name || 'Sales_Report').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function roundMoney(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export function normalizeAnalyticsCurrencySymbol(symbol) {
  if (symbol === undefined || symbol === null) return '₹';
  const str = String(symbol).trim();
  const lower = str.toLowerCase();
  if (lower === 'none' || lower === 'hidden') return '';
  if (!str) return '₹';
  if (str === '₹ INR' || str === 'INR' || str === '₹') return '₹';
  if (str === '$ USD' || str === 'USD' || str === '$') return '$';
  if (str === '€ EUR' || str === 'EUR' || str === '€') return '€';
  if (str === '£ GBP' || str === 'GBP' || str === '£') return '£';
  if (str === 'AED') return 'AED ';
  return str;
}

export function resolveAnalyticsCurrencyCode(symbol) {
  const sym = normalizeAnalyticsCurrencySymbol(symbol).trim();
  if (!sym) return '';
  if (sym === '₹') return 'INR';
  if (sym === '$') return 'USD';
  if (sym === '€') return 'EUR';
  if (sym === '£') return 'GBP';
  return sym;
}

export function resolvePlanAnalyticsExport(isComplimentary, saasPlanRow) {
  if (isComplimentary) {
    return true;
  }
  if (!saasPlanRow) {
    return false;
  }
  const flag = saasPlanRow.analytics_export_enabled;
  if (flag === undefined || flag === null) {
    return true;
  }
  return flag === 1 || flag === true || flag === '1' || String(flag).trim().toLowerCase() === 'true';
}

export async function isAnalyticsExportAllowed(queryFn, isComplimentaryFn, resto) {
  if (!resto) return false;
  const isComplimentary = typeof isComplimentaryFn === 'function' && Boolean(isComplimentaryFn(resto));
  if (isComplimentary) {
    return true;
  }
  const planTier = String(resto.plan_tier || 'pro').trim().toLowerCase();
  const planRows = await queryFn(
    'SELECT analytics_export_enabled FROM saas_plans WHERE LOWER(key) = LOWER($1)',
    [planTier]
  );
  return resolvePlanAnalyticsExport(false, planRows && planRows.length > 0 ? planRows[0] : null);
}

export function isComboOrderItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.combo_id !== undefined && item.combo_id !== null && String(item.combo_id).trim() !== '') return true;
  if (String(item.type || '').trim().toLowerCase() === 'combo') return true;
  if (item.is_combo === true || item.isCombo === true) return true;
  const rawRef = String(item.dish_id ?? item.id ?? '').trim().toLowerCase();
  return rawRef.startsWith('combo:') || rawRef.startsWith('combo_');
}

export function extractRawDishId(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.dish_id === null && (item.combo_id === undefined || item.combo_id === null)) {
    return null;
  }
  if (isComboOrderItem(item)) {
    const rawCombo = (item.combo_id !== undefined && item.combo_id !== null && String(item.combo_id).trim() !== '')
      ? item.combo_id
      : (item.dish_id ?? item.id ?? null);
    if (rawCombo === null || rawCombo === undefined) return null;
    const stripped = String(rawCombo).trim().replace(/^combo[:_]/i, '').trim();
    return stripped ? `combo:${stripped}` : null;
  }
  return item.dish_id === null ? null : (item.dish_id ?? item.id ?? null);
}

export function extractRawDishName(item) {
  return String(item?.name || item?.title || item?.dish_name || '').trim();
}

export function parseJsonItems(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    return (Array.isArray(parsed) ? parsed : []).filter(it => it && typeof it === 'object');
  } catch (e) {
    return [];
  }
}

export function scanCompactDishRefsFromJson(raw, onRef) {
  if (!raw || typeof onRef !== 'function') return;
  if (Array.isArray(raw)) {
    for (const it of raw) {
      if (it && typeof it === 'object') onRef(extractRawDishId(it), extractRawDishName(it));
    }
    return;
  }
  if (typeof raw !== 'string') return;
  const s = raw.trim();
  if (!s || s === '[]' || s[0] !== '[') return;
  const len = s.length;
  let i = 1;

  const skipString = (start) => {
    let idx = start + 1;
    while (idx < len) {
      if (s[idx] === '\\') { idx += 2; continue; }
      if (s[idx] === '"') return idx + 1;
      idx++;
    }
    return len;
  };
  const skipWs = (idx) => {
    while (idx < len && (s[idx] === ' ' || s[idx] === '\t' || s[idx] === '\n' || s[idx] === '\r')) idx++;
    return idx;
  };
  const skipNested = (idx) => {
    let depth = 0;
    while (idx < len) {
      const ch = s[idx];
      if (ch === '"') { idx = skipString(idx); continue; }
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return idx + 1;
      }
      idx++;
    }
    return len;
  };

  while (i < len) {
    i = skipWs(i);
    if (i >= len || s[i] === ']') break;
    if (s[i] === ',') { i++; continue; }
    if (s[i] !== '{') {
      if (s[i] === '[') i = skipNested(i);
      else if (s[i] === '"') i = skipString(i);
      else { while (i < len && s[i] !== ',' && s[i] !== ']') i++; }
      continue;
    }
    i++;
    let hasDishIdKey = false;
    let itemDishId;
    let itemId;
    let hasComboIdKey = false;
    let itemComboId;
    let itemType;
    let itemIsComboSnake;
    let itemIsComboCamel;
    let itemName = '';
    let itemTitle = '';
    let itemDishName = '';
    while (i < len) {
      i = skipWs(i);
      if (i >= len || s[i] === '}') { if (s[i] === '}') i++; break; }
      if (s[i] === ',') { i++; continue; }
      if (s[i] !== '"') { i++; continue; }
      const keyEnd = skipString(i);
      let keyName = '';
      try { keyName = JSON.parse(s.slice(i, keyEnd)); } catch { keyName = ''; }
      i = skipWs(keyEnd);
      if (s[i] === ':') i++;
      i = skipWs(i);
      let val;
      if (s[i] === '"') {
        const valEnd = skipString(i);
        try { val = JSON.parse(s.slice(i, valEnd)); } catch { val = undefined; }
        i = valEnd;
      } else if (s[i] === '{' || s[i] === '[') {
        i = skipNested(i);
      } else {
        const primStart = i;
        while (i < len && s[i] !== ',' && s[i] !== '}') i++;
        const primStr = s.slice(primStart, i).trim();
        if (primStr === 'null') val = null;
        else if (primStr === 'true') val = true;
        else if (primStr === 'false') val = false;
        else if (primStr !== '') {
          const num = Number(primStr);
          if (!Number.isNaN(num)) val = num;
        }
      }
      if (keyName === 'dish_id') { hasDishIdKey = true; itemDishId = val; }
      else if (keyName === 'id') { itemId = val; }
      else if (keyName === 'combo_id') { hasComboIdKey = true; itemComboId = val; }
      else if (keyName === 'type') { itemType = val; }
      else if (keyName === 'is_combo') { itemIsComboSnake = val; }
      else if (keyName === 'isCombo') { itemIsComboCamel = val; }
      else if (keyName === 'name') { itemName = val; }
      else if (keyName === 'title') { itemTitle = val; }
      else if (keyName === 'dish_name') { itemDishName = val; }
    }
    const resolvedRawId = extractRawDishId({
      ...(hasDishIdKey ? { dish_id: itemDishId } : {}),
      ...(itemId !== undefined ? { id: itemId } : {}),
      ...(hasComboIdKey ? { combo_id: itemComboId } : {}),
      ...(itemType !== undefined ? { type: itemType } : {}),
      ...(itemIsComboSnake !== undefined ? { is_combo: itemIsComboSnake } : {}),
      ...(itemIsComboCamel !== undefined ? { isCombo: itemIsComboCamel } : {})
    });
    onRef(resolvedRawId, String(itemName || itemTitle || itemDishName || '').trim());
  }
}
