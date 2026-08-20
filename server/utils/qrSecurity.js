import crypto from 'crypto';

/**
 * Generates the authoritative 32-bit legacy TouchQR anti-tamper token.
 * Replicates the exact algorithm used on existing printed QR codes and Admin QR Generator.
 *
 * @param {string} slug - Restaurant unique slug
 * @param {string} type - Space type ('table', 'cabin', 'room', 'vip')
 * @param {string|number} num - Space / Table number
 * @param {string} secret - Restaurant private signing secret
 * @returns {string} 8-character hexadecimal token
 */
export function generateQrToken(slug, type, num, secret) {
  try {
    const cleanSlug = String(slug || '').trim().toLowerCase();
    const cleanType = String(type || 'table').trim().toLowerCase();
    const cleanNum = String(num || '1').trim();
    const cleanSecret = String(secret || 'tq_secure_sign');

    let hash = 0;
    const str = cleanSlug + ':' + cleanType + ':' + cleanNum + ':' + cleanSecret;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  } catch (err) {
    return '';
  }
}

/**
 * Normalizes space type representation ('table', 'cabin', 'room', 'vip').
 *
 * @param {string} type
 * @returns {string}
 */
export function normalizeSpaceType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t.includes('cabin')) return 'cabin';
  if (t.includes('room')) return 'room';
  if (t.includes('vip')) return 'vip';
  return 'table';
}

/**
 * Normalizes space / table number (e.g. 'Table 1' -> '1', ' 2 ' -> '2').
 *
 * @param {string|number} num
 * @returns {string}
 */
export function normalizeSpaceNumber(num) {
  const raw = String(num || '1').trim();
  const cleaned = raw.replace(/^(table|cabin|room|vip|tbl|🍽️|🛋️|🏨|👑|\s)+/i, '').trim();
  return cleaned || raw || '1';
}

/**
 * Authoritatively verifies a legacy QR token against restaurant identity parameters.
 *
 * @param {string} slug - Restaurant unique slug
 * @param {string} type - Space type ('table', 'cabin', 'room', 'vip')
 * @param {string|number} num - Space / Table number
 * @param {string} secret - Restaurant private signing secret
 * @param {string} token - The QR token supplied in URL/request (e.g. ?tkn=...)
 * @returns {{ valid: boolean, reason: string|null }}
 */
export function verifyQrToken(slug, type, num, secret, token) {
  try {
    // 1. Missing Token Check
    if (token === undefined || token === null || String(token).trim() === '') {
      return { valid: false, reason: 'missing_token' };
    }

    const tokenStr = String(token).trim();

    // 2. Missing Identity Inputs Check
    if (!slug || !num || !secret) {
      return { valid: false, reason: 'invalid_input' };
    }

    // 3. Malformed Token Check (Legacy tokens are 1 to 8 hex characters, padded to 8)
    if (!/^[0-9a-fA-F]{1,32}$/.test(tokenStr)) {
      return { valid: false, reason: 'malformed_token' };
    }

    const cleanSlug = String(slug).trim().toLowerCase();
    const cleanType = normalizeSpaceType(type);
    const cleanNum = normalizeSpaceNumber(num);

    // 4. Generate Expected Token using authoritative legacy algorithm
    const expectedToken = generateQrToken(cleanSlug, cleanType, cleanNum, String(secret));
    if (!expectedToken) {
      return { valid: false, reason: 'invalid_input' };
    }

    // 5. Compare using timing-safe comparison where length matches
    const tokenNormalized = tokenStr.toLowerCase().padStart(8, '0');
    const expectedNormalized = expectedToken.toLowerCase();

    let isMatch = false;
    if (tokenNormalized.length === expectedNormalized.length) {
      try {
        isMatch = crypto.timingSafeEqual(
          Buffer.from(tokenNormalized, 'utf8'),
          Buffer.from(expectedNormalized, 'utf8')
        );
      } catch {
        isMatch = tokenNormalized === expectedNormalized;
      }
    }

    // Also check raw num if normalization was slightly different (guarantees 100% legacy compatibility)
    if (!isMatch && String(num).trim() !== cleanNum) {
      const rawExpected = generateQrToken(cleanSlug, cleanType, String(num).trim(), String(secret));
      if (rawExpected && rawExpected.toLowerCase() === tokenNormalized) {
        isMatch = true;
      }
    }

    if (isMatch) {
      return { valid: true, reason: null };
    }

    return { valid: false, reason: 'invalid_token' };
  } catch (err) {
    return { valid: false, reason: 'invalid_token' };
  }
}

export default {
  generateQrToken,
  normalizeSpaceType,
  normalizeSpaceNumber,
  verifyQrToken
};
