import { isValidQrTokenFormat, normalizeSpaceType, normalizeSpaceNumber } from './qrSecurity.js';

export function isFlagEnabled(val, fallback = true) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'f' || s === 'no') return false;
  if (s === 'true' || s === '1' || s === 't' || s === 'yes') return true;
  return Boolean(val);
}

const EXCLUDED_PLATFORM_HOSTS = [
  'touchqr.in',
  'touchqr.com',
  'touchqr.app',
  'localhost',
  'vercel.app',
  '127.0.0.1'
];

function matchesHostOrSubdomain(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function isCustomDomainHost(hostname) {
  const host = String(hostname || '')
    .split(':')[0]
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.+$/, '')
    .trim();
  if (!host) return false;
  return !EXCLUDED_PLATFORM_HOSTS.some((domain) => matchesHostOrSubdomain(host, domain));
}

export function parseCustomerSpaceFromLocation(searchStr = '', pathnameStr = '') {
  const urlParams = new URLSearchParams(searchStr || '');
  const token = (urlParams.get('tkn') || urlParams.get('token') || urlParams.get('sig') || '').trim();
  let type = '';
  let num = '';

  const explicitSpaceType = urlParams.get('space_type') ? normalizeSpaceType(urlParams.get('space_type')) : '';
  const explicitTableNum = (urlParams.get('table_num') || '').trim();

  if (urlParams.get('screen') && urlParams.get('row')) {
    type = 'cinema_seat';
    const screen = urlParams.get('screen').trim();
    const row = urlParams.get('row').trim().toUpperCase();
    const seat = (urlParams.get('seatno') || urlParams.get('seat_num') || urlParams.get('seat') || '1').trim();
    num = `S${screen}-${row}-${seat}`;
  } else if (urlParams.get('cinema') || urlParams.get('seat')) {
    type = 'cinema_seat';
    num = (urlParams.get('cinema') || urlParams.get('seat')).trim();
  } else if (urlParams.get('counter') || urlParams.get('takeaway') || explicitSpaceType === 'counter') {
    type = 'counter';
    num = 'COUNTER';
  } else if (urlParams.get('cabin')) {
    type = 'cabin';
    num = urlParams.get('cabin').trim();
  } else if (urlParams.get('room')) {
    type = 'room';
    num = urlParams.get('room').trim();
  } else if (urlParams.get('vip')) {
    type = 'vip';
    num = urlParams.get('vip').trim();
  } else if (urlParams.get('table') || urlParams.get('t') || urlParams.get('tableno') || urlParams.get('tbl')) {
    type = explicitSpaceType || 'table';
    num = (urlParams.get('table') || urlParams.get('t') || urlParams.get('tableno') || urlParams.get('tbl')).trim();
  } else if (explicitSpaceType && explicitTableNum) {
    type = explicitSpaceType;
    num = explicitTableNum;
  } else {
    const parts = String(pathnameStr || '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const prevPart = parts[parts.length - 2].toLowerCase();
      if (prevPart === 'cinema' || prevPart === 'seat') {
        type = 'cinema_seat';
        num = lastPart;
      } else if (prevPart === 'counter' || prevPart === 'takeaway' || lastPart.toLowerCase() === 'counter' || lastPart.toLowerCase() === 'takeaway') {
        type = 'counter';
        num = 'COUNTER';
      } else if (/^\d+$/.test(lastPart)) {
        if (prevPart === 'cabin') { type = 'cabin'; num = lastPart; }
        else if (prevPart === 'room') { type = 'room'; num = lastPart; }
        else if (prevPart === 'vip') { type = 'vip'; num = lastPart; }
        else if (prevPart === 'table' || prevPart === 'tbl' || prevPart === 'r') { type = 'table'; num = lastPart; }
      }
    }
  }

  const isScanned = Boolean(type && num);
  const isValidTokenShape = Boolean(token && isValidQrTokenFormat(token));

  return { type, num, token, isScanned, isValidTokenShape };
}

export function isCustomerSpaceValid({ currentTableNum, currentSpaceType, hasValidTokenShape, info }) {
  if (!currentTableNum) return true;
  if (!hasValidTokenShape) return false;

  const activeType = normalizeSpaceType(currentSpaceType || info?.table_prefix || 'table');

  if (activeType === 'counter') {
    if (String(currentTableNum).trim().toUpperCase() !== 'COUNTER') return false;
    if (!info) return true;
    return Boolean(
      isFlagEnabled(info.counter_ordering_enabled, false) ||
      Boolean(hasValidTokenShape && info.resto_type !== 'cinema' && info.business_type !== 'cinema_theatre')
    );
  }

  if (activeType === 'cinema_seat') {
    const cMatch = String(currentTableNum).match(/^(?:screen\s*(\d+)[\s\-_•|]+row\s*([a-zA-Z]+)[\s\-_•|]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
    return Boolean(cMatch || String(currentTableNum).trim().length > 0);
  }

  const trimmed = String(currentTableNum).trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const num = parseInt(trimmed, 10);
  if (num <= 0) return false;

  if (!info) return true;

  let maxAllowed = 0;
  if (activeType === 'cabin') maxAllowed = Number(info.total_cabins) || 0;
  else if (activeType === 'room') maxAllowed = Number(info.total_rooms) || 0;
  else if (activeType === 'vip') maxAllowed = Number(info.total_vip) || 0;
  else maxAllowed = Number(info.total_tables) || 0;

  if (maxAllowed <= 0 || num > maxAllowed) {
    return false;
  }
  return true;
}

export function buildScopedStorageKey(prefix, { slug = '', spaceType = 'table', tableNumber = '' } = {}) {
  const cleanSpace = normalizeSpaceType(spaceType || 'table');
  const cleanNum = cleanSpace === 'counter'
    ? (String(tableNumber || '').trim() ? 'COUNTER' : '')
    : normalizeSpaceNumber(tableNumber);
  if (!cleanNum) return null;
  const cleanSlug = String(slug || 'default').trim().toLowerCase() || 'default';
  return `${prefix}_${cleanSlug}_${cleanSpace}_${cleanNum}`;
}
