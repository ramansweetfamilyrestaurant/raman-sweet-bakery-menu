import crypto from 'crypto';
import { query } from '../db.js';

/**
 * Generates an authoritative HMAC-SHA256 QR token bound to tenant identity,
 * canonical space type, and canonical space identifier.
 *
 * @param {string} slug - Restaurant unique slug
 * @param {string} type - Space type ('table', 'cabin', 'room', 'vip', 'cinema_seat')
 * @param {string|number} num - Space / Table number or cinema seat code
 * @param {string} secret - Restaurant private cryptographically secure signing secret
 * @returns {string} 64-character hexadecimal HMAC-SHA256 signature
 */
export function generateHmacQrToken(slug, type, num, secret) {
  if (!slug || !type || !num || !secret) {
    return '';
  }
  const cleanSlug = String(slug).trim().toLowerCase();
  const cleanType = normalizeSpaceType(type);
  const cleanNum = normalizeSpaceNumber(num);
  const cleanSecret = String(secret).trim();

  if (!cleanSlug || !cleanType || !cleanNum || !cleanSecret) {
    return '';
  }

  const payload = `${cleanSlug}:${cleanType}:${cleanNum}`;
  return crypto.createHmac('sha256', cleanSecret).update(payload, 'utf8').digest('hex');
}

/**
 * Legacy 32-bit TouchQR hash algorithm retained exclusively for migration verification
 * of existing printed physical QR codes during the transition grace period.
 *
 * @param {string} slug
 * @param {string} type
 * @param {string|number} num
 * @param {string} secret
 * @returns {string} 8-character hex token
 */
export function generateLegacyQrToken(slug, type, num, secret) {
  try {
    const cleanSlug = String(slug || '').trim().toLowerCase();
    const cleanType = normalizeSpaceType(type);
    const cleanNum = normalizeSpaceNumber(num);
    const cleanSecret = String(secret || '');

    if (!cleanSlug || !cleanType || !cleanNum || !cleanSecret) return '';

    let hash = 0;
    const str = `${cleanSlug}:${cleanType}:${cleanNum}:${cleanSecret}`;
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
 * Primary token generator export defaulting to genuine HMAC-SHA256.
 */
export function generateQrToken(slug, type, num, secret) {
  return generateHmacQrToken(slug, type, num, secret);
}

/**
 * Generates a cryptographically secure 256-bit random signing secret for a restaurant.
 * @returns {string} 64-character hex secret
 */
export function generateRestaurantQrSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Canonical space type normalizer ('table', 'cabin', 'room', 'vip', 'cinema_seat').
 *
 * @param {string} type
 * @returns {string}
 */
export function normalizeSpaceType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (t.includes('cinema') || t.includes('seat')) return 'cinema_seat';
  if (t.includes('cabin')) return 'cabin';
  if (t.includes('room')) return 'room';
  if (t.includes('vip')) return 'vip';
  return 'table';
}

/**
 * Canonical space number / identifier normalizer.
 * Preserves supported alphanumeric identifiers, standardizes cinema seat codes,
 * and normalizes numeric values without defaulting empty inputs to '1'.
 *
 * @param {string|number} num
 * @returns {string}
 */
export function normalizeSpaceNumber(num) {
  if (num === undefined || num === null) return '';
  const s = String(num).trim();
  if (!s) return '';

  // Standardize cinema seat pattern: Screen 1 - Row A - Seat 12, S1-A-12, Screen 1, Row A, Seat 12
  const cinemaMatch = s.match(/^(?:screen\s*(\d+)[\s\-_•|,]+row\s*([a-zA-Z]+)[\s\-_•|,]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
  if (cinemaMatch) {
    const screen = cinemaMatch[1] || cinemaMatch[4];
    const row = (cinemaMatch[2] || cinemaMatch[5]).toUpperCase();
    const seat = cinemaMatch[3] || cinemaMatch[6];
    return `S${screen}-${row}-${seat}`;
  }

  // Strip common label prefixes
  const cleaned = s.replace(/^(table|cabin|room|vip|tbl|🍽️|🛋️|🏨|👑|🎬|\s)+/i, '').trim();

  // If numeric, strip leading zeroes (e.g. "05" -> "5")
  if (/^\d+$/.test(cleaned)) {
    return String(parseInt(cleaned, 10));
  }

  return cleaned || s;
}

/**
 * Authoritatively verifies a QR token against tenant identity and space identity.
 * Rejects tampered, cross-tenant, and cross-space tokens using timing-safe comparison.
 *
 * @param {string} slug - Restaurant unique slug
 * @param {string} type - Space type ('table', 'cabin', 'room', 'vip', 'cinema_seat')
 * @param {string|number} num - Space number / seat identifier
 * @param {string} secret - Restaurant private signing secret
 * @param {string} token - The QR token supplied in request (?tkn=...)
 * @param {object} [options={}] - Optional verification flags
 * @param {boolean} [options.allowLegacy] - Explicit legacy migration control
 * @returns {{ valid: boolean, reason: string|null, legacy?: boolean }}
 */
export function verifyQrToken(slug, type, num, secret, token, options = {}) {
  try {
    // 1. Missing Token Check
    if (token === undefined || token === null || String(token).trim() === '') {
      return { valid: false, reason: 'missing_token' };
    }

    const tokenStr = String(token).trim();

    // 2. Missing Identity Inputs or Secret Check
    if (!slug || !type || !num || !secret) {
      return { valid: false, reason: 'invalid_input' };
    }

    const cleanSlug = String(slug).trim().toLowerCase();
    const cleanType = normalizeSpaceType(type);
    const cleanNum = normalizeSpaceNumber(num);
    const cleanSecret = String(secret).trim();

    if (!cleanSlug || !cleanType || !cleanNum || !cleanSecret) {
      return { valid: false, reason: 'invalid_input' };
    }

    // 3. Format Validation (HMAC-SHA256: 64 hex characters; Legacy: 8-32 hex characters)
    if (!/^[0-9a-fA-F]{8,64}$/.test(tokenStr)) {
      return { valid: false, reason: 'malformed_token' };
    }

    // 4. Primary: HMAC-SHA256 Verification (64 hex characters)
    if (tokenStr.length === 64) {
      const expectedToken = generateHmacQrToken(cleanSlug, cleanType, cleanNum, cleanSecret);
      if (!expectedToken) {
        return { valid: false, reason: 'invalid_input' };
      }

      const bufToken = Buffer.from(tokenStr.toLowerCase(), 'hex');
      const bufExpected = Buffer.from(expectedToken.toLowerCase(), 'hex');

      if (bufToken.length === bufExpected.length && crypto.timingSafeEqual(bufToken, bufExpected)) {
        return { valid: true, reason: null, legacy: false };
      }

      return { valid: false, reason: 'invalid_token' };
    }

    // 5. Strict Security: When modern HMAC is required (all security-sensitive operations:
    // orders, presence verification, waiter/staff requests, table order queries),
    // any legacy/non-64 token MUST be rejected immediately.
    if (options.requireHmac === true) {
      return {
        valid: false,
        reason: 'legacy_token_deprecated',
        legacy: true,
        message: 'Legacy QR token format is deprecated. Modern HMAC-SHA256 QR code is required.'
      };
    }

    // 6. Non-sensitive fallback check (only when requireHmac is false AND grace period is explicitly enabled).
    // Note: NEVER use predictable public metadata secrets (e.g. `${restoId}_${slug}_tq`). Only server cleanSecret is tested.
    const isGracePeriodActive = options.allowLegacy === true && process.env.ENABLE_LEGACY_QR_GRACE_PERIOD !== 'false';
    if (!isGracePeriodActive) {
      return { valid: false, reason: 'legacy_token_deprecated', legacy: true };
    }

    const legacyExpected = generateLegacyQrToken(cleanSlug, cleanType, cleanNum, cleanSecret);
    const tokenNormalized = tokenStr.toLowerCase().padStart(8, '0');

    let isLegacyMatch = false;
    if (legacyExpected && tokenNormalized.length === legacyExpected.length) {
      try {
        isLegacyMatch = crypto.timingSafeEqual(
          Buffer.from(tokenNormalized, 'utf8'),
          Buffer.from(legacyExpected.toLowerCase(), 'utf8')
        );
      } catch {
        isLegacyMatch = tokenNormalized === legacyExpected.toLowerCase();
      }
    }

    if (isLegacyMatch) {
      return { valid: true, reason: null, legacy: true };
    }

    return { valid: false, reason: 'invalid_token' };
  } catch (err) {
    return { valid: false, reason: 'invalid_token' };
  }
}

/**
 * Strict database-backed validation of physical space configuration and capacity.
 * Ensures nonexistent, unconfigured, or inactive cinema seats and dining spaces are rejected.
 *
 * @param {object} resto - Restaurant record
 * @param {string} resolvedSpaceType - Canonical space type ('table', 'cabin', 'room', 'vip', 'cinema_seat')
 * @param {string} resolvedSpaceNum - Canonical space identifier
 * @returns {Promise<{ valid: boolean, error?: string, message?: string }>}
 */
export async function validateSpaceCapacity(resto, resolvedSpaceType, resolvedSpaceNum) {
  if (!resto || !resolvedSpaceType || !resolvedSpaceNum) {
    return {
      valid: false,
      error: 'invalid_table_number',
      message: 'Space type and number are required'
    };
  }

  // 1. Cinema Seat Validation: Authoritative database check against configured screens & seats
  if (resolvedSpaceType === 'cinema_seat') {
    const cMatch = String(resolvedSpaceNum).match(/^S?(\d+)-([A-Za-z]+)-(\d+)$/i);
    if (!cMatch) {
      return {
        valid: false,
        error: 'invalid_table_number',
        message: `Cinema seat "${resolvedSpaceNum}" format is invalid. Expected format e.g. Screen 1, Row A, Seat 12.`
      };
    }

    try {
      const dbScreenNum = parseInt(cMatch[1], 10);
      const dbRowLabel = cMatch[2].toUpperCase();
      const dbSeatNum = parseInt(cMatch[3], 10);

      const seatCheck = await query(`
        SELECT s.id, s.active, sc.active as screen_active
        FROM restaurant_cinema_seats s
        JOIN restaurant_cinema_screens sc ON s.screen_id = sc.id
        WHERE s.restaurant_id = $1 AND sc.screen_number = $2 AND UPPER(s.row_label) = $3 AND s.seat_number = $4
      `, [resto.id, dbScreenNum, dbRowLabel, dbSeatNum]);

      if (!seatCheck || seatCheck.length === 0) {
        return {
          valid: false,
          error: 'invalid_table_number',
          message: `Cinema seat Screen ${dbScreenNum} Row ${dbRowLabel} Seat ${dbSeatNum} does not exist in this cinema.`
        };
      }

      if (!seatCheck[0].active || !seatCheck[0].screen_active) {
        return {
          valid: false,
          error: 'invalid_table_number',
          message: `Cinema seat Screen ${dbScreenNum} Row ${dbRowLabel} Seat ${dbSeatNum} is currently inactive.`
        };
      }

      return { valid: true };
    } catch (dbErr) {
      console.error('Cinema seat database verification error:', dbErr);
      return {
        valid: false,
        error: 'seat_validation_failed',
        message: 'Failed to validate cinema seat against database configuration.'
      };
    }
  }

  // 2. Physical Dining Space Capacity Validation: No fallback to total_tables!
  let maxAllowed = 0;
  if (resolvedSpaceType === 'cabin') {
    maxAllowed = Number(resto.total_cabins) || 0;
  } else if (resolvedSpaceType === 'room') {
    maxAllowed = Number(resto.total_rooms) || 0;
  } else if (resolvedSpaceType === 'vip') {
    maxAllowed = Number(resto.total_vip) || 0;
  } else {
    maxAllowed = Number(resto.total_tables) || 0;
  }

  if (maxAllowed <= 0) {
    return {
      valid: false,
      error: 'invalid_table_number',
      message: `This restaurant does not have ${resolvedSpaceType} spaces configured.`
    };
  }

  const spaceNum = parseInt(resolvedSpaceNum, 10);
  if (isNaN(spaceNum) || spaceNum < 1 || spaceNum > maxAllowed) {
    return {
      valid: false,
      error: 'invalid_table_number',
      message: `${resolvedSpaceType} #${resolvedSpaceNum} is not registered for this restaurant.`
    };
  }

  return { valid: true };
}

/**
 * Validates whether token string conforms to supported hex token format
 * (supports both 64-character HMAC-SHA256 signatures and 8-32 character legacy migration tokens).
 *
 * @param {string} token
 * @returns {boolean}
 */
export function isValidQrTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  return /^[0-9a-fA-F]{8,64}$/.test(token.trim());
}

/**
 * Strict validator for modern 64-character HMAC-SHA256 signatures.
 *
 * @param {string} token
 * @returns {boolean}
 */
export function isValidHmacTokenFormat(token) {
  if (!token || typeof token !== 'string') return false;
  return /^[0-9a-fA-F]{64}$/.test(token.trim());
}

export default {
  generateHmacQrToken,
  generateLegacyQrToken,
  generateQrToken,
  generateRestaurantQrSecret,
  normalizeSpaceType,
  normalizeSpaceNumber,
  verifyQrToken,
  validateSpaceCapacity,
  isValidQrTokenFormat,
  isValidHmacTokenFormat
};

