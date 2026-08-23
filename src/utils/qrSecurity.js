// Client-side QR format validation & space normalization helpers
// Note: Cryptographic verification is authoritatively performed exclusively on the server.

export function generateQrToken(slug, type, num, secret) {
  const cleanSlug = String(slug || '').toLowerCase();
  const cleanType = String(type || 'table').toLowerCase();
  const cleanNum = String(num || '1');
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

export function isValidQrTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  // Validates legacy 8-character hex token shape
  return /^[0-9a-fA-F]{8}$/.test(clean);
}

export function normalizeSpaceType(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('cinema') || s.includes('seat')) return 'cinema_seat';
  if (s.includes('cabin')) return 'cabin';
  if (s.includes('room')) return 'room';
  if (s.includes('vip')) return 'vip';
  return 'table';
}

export function normalizeSpaceNumber(raw) {
  const s = String(raw || '').trim();
  const cinemaMatch = s.match(/^(?:screen\s*(\d+)[\s\-_•|]+row\s*([a-zA-Z]+)[\s\-_•|]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
  if (cinemaMatch) {
    const screen = cinemaMatch[1] || cinemaMatch[4];
    const row = (cinemaMatch[2] || cinemaMatch[5]).toUpperCase();
    const seat = cinemaMatch[3] || cinemaMatch[6];
    return `S${screen}-${row}-${seat}`;
  }
  const match = s.match(/\d+/);
  return match ? String(parseInt(match[0], 10)) : '1';
}

export default { generateQrToken, isValidQrTokenFormat, normalizeSpaceType, normalizeSpaceNumber };
