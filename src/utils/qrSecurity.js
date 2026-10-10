// Client-side QR format validation & space normalization helpers
// Note: Cryptographic signing and verification are authoritatively performed exclusively on the server.

/**
 * Validates whether a token string matches a supported QR token format
 * (supports both 64-character HMAC-SHA256 signatures and 8-character legacy migration tokens).
 *
 * @param {string} token
 * @returns {boolean}
 */
export function isValidQrTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  return /^[0-9a-fA-F]{8,64}$/.test(clean);
}

/**
 * Strict format validator for modern 64-character HMAC-SHA256 signatures.
 * Used exclusively for standee export-readiness gates (print, PNG download, bulk print).
 *
 * @param {string} token
 * @returns {boolean}
 */
export function isValidHmacTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  return /^[0-9a-fA-F]{64}$/.test(clean);
}

/**
 * Canonical client space type normalizer ('table', 'cabin', 'room', 'vip', 'cinema_seat').
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeSpaceType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('cinema') || s.includes('seat')) return 'cinema_seat';
  if (s.includes('cabin')) return 'cabin';
  if (s.includes('room')) return 'room';
  if (s.includes('vip')) return 'vip';
  return 'table';
}

/**
 * Canonical space number / identifier normalizer.
 * Matches canonical server implementation without defaulting empty inputs to '1'.
 *
 * @param {string|number} raw
 * @returns {string}
 */
export function normalizeSpaceNumber(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  const cinemaMatch = s.match(/^(?:screen\s*(\d+)[\s\-_•|,]+row\s*([a-zA-Z]+)[\s\-_•|,]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
  if (cinemaMatch) {
    const screen = cinemaMatch[1] || cinemaMatch[4];
    const row = (cinemaMatch[2] || cinemaMatch[5]).toUpperCase();
    const seat = cinemaMatch[3] || cinemaMatch[6];
    return `S${screen}-${row}-${seat}`;
  }

  const cleaned = s.replace(/^(table|cabin|room|vip|tbl|🍽️|🛋️|🏨|👑|🎬|\s)+/i, '').trim();
  if (/^\d+$/.test(cleaned)) {
    return String(parseInt(cleaned, 10));
  }
  return cleaned || s;
}

/**
 * @deprecated Legacy client token stub. Authoritative signing is performed via authenticated server API.
 */
export function generateQrToken(slug, type, num, secret) {
  const cleanSlug = String(slug || '').toLowerCase();
  const cleanType = normalizeSpaceType(type);
  const cleanNum = normalizeSpaceNumber(num) || '1';
  const cleanSecret = String(secret || 'tq_secure_sign');

  let hash = 0;
  const str = cleanSlug + ':' + cleanType + ':' + cleanNum + ':' + cleanSecret;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export default { generateQrToken, isValidQrTokenFormat, isValidHmacTokenFormat, normalizeSpaceType, normalizeSpaceNumber };

