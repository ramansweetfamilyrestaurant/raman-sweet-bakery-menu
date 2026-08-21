import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';
import { normalizeSpaceType, normalizeSpaceNumber } from './qrSecurity.js';

export const VERIFICATION_MODES = Object.freeze({
  QR_ONLY: 'QR_ONLY',
  GPS_ONLY: 'GPS_ONLY',
  GPS_WITH_STAFF_FALLBACK: 'GPS_WITH_STAFF_FALLBACK',
  STAFF_ONLY: 'STAFF_ONLY'
});

export const ALL_VERIFICATION_MODES = Object.freeze([
  VERIFICATION_MODES.QR_ONLY,
  VERIFICATION_MODES.GPS_ONLY,
  VERIFICATION_MODES.GPS_WITH_STAFF_FALLBACK,
  VERIFICATION_MODES.STAFF_ONLY
]);

export const DEFAULT_VERIFICATION_MODE = VERIFICATION_MODES.GPS_WITH_STAFF_FALLBACK;

export const VALID_VERIFICATION_METHODS = Object.freeze(['GPS', 'STAFF', 'QR']);
export const VALID_VERIFICATION_STATUSES = Object.freeze(['pending', 'verified', 'rejected', 'expired']);

/**
 * Validates if the given value is an exact supported verification mode.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidVerificationMode(value) {
  if (!value || typeof value !== 'string') return false;
  const clean = value.trim().toUpperCase();
  return ALL_VERIFICATION_MODES.includes(clean);
}

/**
 * Normalizes a verification mode safely. Invalid values safely fall back to GPS_WITH_STAFF_FALLBACK.
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeVerificationMode(value, fallback = DEFAULT_VERIFICATION_MODE) {
  if (!value || typeof value !== 'string') return fallback;
  const clean = value.trim().toUpperCase();
  if (ALL_VERIFICATION_MODES.includes(clean)) {
    return clean;
  }
  return fallback;
}

/**
 * Generates an anti-tamper hash binding the presence verification to the exact scanned physical QR context.
 * @param {string} slug
 * @param {string} spaceType
 * @param {string|number} spaceNumber
 * @param {string} qrToken
 * @returns {string} SHA256 hex string
 */
export function generateQrContextHash(slug, spaceType, spaceNumber, qrToken) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const cleanType = normalizeSpaceType(spaceType);
  const cleanNum = normalizeSpaceNumber(spaceNumber);
  const cleanTkn = String(qrToken || '').trim();
  const str = `${cleanSlug}:${cleanType}:${cleanNum}:${cleanTkn}`;
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Resolves the authoritative effective verification policy across SuperAdmin global controls,
 * SaaS plan entitlements, and restaurant-specific settings.
 *
 * @param {Object} params
 * @param {Object} [params.systemPolicy] - Global system settings (e.g. system_settings table)
 * @param {Object} [params.planPermissions] - Tenant's assigned SaaS plan record or permissions object
 * @param {string} [params.restaurantMode] - Restaurant's configured table_verification_mode
 * @param {number} [params.staffTimeoutSeconds] - Restaurant's configured staff_verification_timeout_seconds
 * @returns {Object} Effective structured policy
 */
export function resolveEffectiveVerificationPolicy({
  systemPolicy = {},
  planPermissions = {},
  restaurantMode = DEFAULT_VERIFICATION_MODE,
  staffTimeoutSeconds = 120
} = {}) {
  // 1. Resolve Global SuperAdmin Override (Highest Priority)
  const globalSetting = systemPolicy?.global_table_verification_mode || systemPolicy?.verification_mode;
  let globalMode = null;
  if (globalSetting && isValidVerificationMode(globalSetting)) {
    globalMode = normalizeVerificationMode(globalSetting);
  }

  // 2. Resolve SaaS Plan Allowed Modes & Entitlements (Second Priority)
  const isPlanPresenceEnabled = planPermissions?.presence_verification_enabled !== false &&
    planPermissions?.presence_verification_enabled !== 0 &&
    planPermissions?.presence_verification_enabled !== '0' &&
    planPermissions?.presence_verification_enabled !== 'false';

  let rawAllowedModes = planPermissions?.allowed_verification_modes || planPermissions?.allowedModes;
  let planAllowedModes = [...ALL_VERIFICATION_MODES];

  if (typeof rawAllowedModes === 'string' && rawAllowedModes.trim() !== '') {
    const parsed = rawAllowedModes.split(',').map(m => m.trim().toUpperCase()).filter(isValidVerificationMode);
    if (parsed.length > 0) {
      planAllowedModes = parsed;
    }
  } else if (Array.isArray(rawAllowedModes) && rawAllowedModes.length > 0) {
    const parsed = rawAllowedModes.map(m => String(m).trim().toUpperCase()).filter(isValidVerificationMode);
    if (parsed.length > 0) {
      planAllowedModes = parsed;
    }
  }

  // If SaaS plan explicitly disables presence verification, downgrade strictly to QR_ONLY
  if (!isPlanPresenceEnabled) {
    planAllowedModes = [VERIFICATION_MODES.QR_ONLY];
  }

  // 3. Resolve Restaurant Setting (Tenant-level Preference)
  const requestedRestaurantMode = normalizeVerificationMode(restaurantMode);

  // 4. Compute Effective Mode:
  let effectiveMode = requestedRestaurantMode;
  let resolutionSource = 'restaurant';

  if (globalMode) {
    effectiveMode = globalMode;
    resolutionSource = 'global_system_setting';
  } else if (!isPlanPresenceEnabled) {
    effectiveMode = VERIFICATION_MODES.QR_ONLY;
    resolutionSource = 'saas_plan_disabled';
  } else if (!planAllowedModes.includes(requestedRestaurantMode)) {
    // If restaurant selected a mode not entitled in its plan, fallback to the safest allowed mode
    if (planAllowedModes.includes(DEFAULT_VERIFICATION_MODE)) {
      effectiveMode = DEFAULT_VERIFICATION_MODE;
    } else {
      effectiveMode = planAllowedModes[0] || VERIFICATION_MODES.QR_ONLY;
    }
    resolutionSource = 'saas_plan_entitlement_fallback';
  }

  const staffFallbackAllowed = [VERIFICATION_MODES.GPS_WITH_STAFF_FALLBACK, VERIFICATION_MODES.STAFF_ONLY].includes(effectiveMode);
  const boundedTimeout = Math.min(600, Math.max(30, parseInt(staffTimeoutSeconds, 10) || 120));

  return {
    enabled: effectiveMode !== VERIFICATION_MODES.QR_ONLY,
    mode: effectiveMode,
    allowedModes: planAllowedModes,
    staffFallbackAllowed,
    staffTimeoutSeconds: boundedTimeout,
    source: {
      applied: resolutionSource,
      restaurantRequested: requestedRestaurantMode,
      globalSetting: globalMode || 'none',
      planPresenceEnabled: isPlanPresenceEnabled
    }
  };
}

/**
 * Signs an authoritative, short-lived opaque Presence Token.
 *
 * @param {Object} params
 * @param {string} params.verificationToken - The unique verification token ID
 * @param {number|string} params.restaurantId - Restaurant ID
 * @param {string} params.slug - Restaurant unique slug
 * @param {string} params.spaceType - Space type ('table', 'cabin', 'room', 'vip')
 * @param {string|number} params.spaceNumber - Space / Table number
 * @param {string} params.verificationMethod - 'GPS' | 'STAFF' | 'QR'
 * @param {string} [params.qrContextHash] - Context hash binding to physical QR scan
 * @param {string} [params.sessionId] - Active Customer Session ID (if established)
 * @param {number} [params.expiryMinutes=20] - Expiration window in minutes
 * @param {string} [params.jwtSecret=JWT_SECRET] - Server signing secret
 * @returns {string} Signed JWT presence authorization token
 */
export function generatePresenceToken({
  verificationToken,
  restaurantId,
  slug,
  spaceType,
  spaceNumber,
  verificationMethod = 'GPS',
  qrContextHash = '',
  sessionId = null,
  expiryMinutes = 20,
  jwtSecret = JWT_SECRET
}) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const cleanType = normalizeSpaceType(spaceType);
  const cleanNum = normalizeSpaceNumber(spaceNumber);
  const cleanMethod = VALID_VERIFICATION_METHODS.includes(String(verificationMethod).toUpperCase())
    ? String(verificationMethod).toUpperCase()
    : 'GPS';

  const payload = {
    vtoken: String(verificationToken || ''),
    restaurant_id: Number(restaurantId),
    slug: cleanSlug,
    space_type: cleanType,
    space_number: cleanNum,
    method: cleanMethod,
    qr_hash: String(qrContextHash || ''),
    session_id: sessionId ? String(sessionId) : null,
    iss_at: Date.now()
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: `${expiryMinutes}m` });
}

export const GPS_TOLERANCE = Object.freeze({
  MIN_BUFFER_METERS: 5,
  MAX_BUFFER_METERS: 40,
  ACCURACY_SCALE_FACTOR: 0.35,
  MAX_REJECT_ACCURACY_METERS: 600
});

/**
 * Calculates a bounded, progressive GPS tolerance buffer based on client accuracy.
 * Never allows unbounded accuracy to bypass geofencing.
 *
 * @param {number} accuracyMeters - Client-reported GPS accuracy radius in meters
 * @returns {number} Bounded tolerance in meters
 */
export function calculateEffectiveGpsTolerance(accuracyMeters) {
  const acc = Number(accuracyMeters);
  if (isNaN(acc) || acc <= 0) return GPS_TOLERANCE.MIN_BUFFER_METERS;
  const scaled = acc * GPS_TOLERANCE.ACCURACY_SCALE_FACTOR;
  return Math.min(Math.max(scaled, GPS_TOLERANCE.MIN_BUFFER_METERS), GPS_TOLERANCE.MAX_BUFFER_METERS);
}

/**
 * Authoritatively verifies a Presence Token on the server against the incoming request context.
 *
 * @param {Object} params
 * @param {string} params.presenceToken - The JWT presence token
 * @param {number|string} params.restaurantId - Expected restaurant ID
 * @param {string} params.slug - Expected restaurant slug
 * @param {string} params.spaceType - Expected space type
 * @param {string|number} params.spaceNumber - Expected space number
 * @param {string} [params.qrToken] - Expected physical QR token (if binding check requested)
 * @param {Array<string>} [params.allowedMethods] - Allowed verification methods (e.g. ['GPS'], ['GPS', 'STAFF'])
 * @param {string} [params.jwtSecret=JWT_SECRET] - Server signing secret
 * @returns {{ valid: boolean, reason: string|null, method?: string, allowedMethods?: Array<string>, payload?: Object }}
 */
export function verifyPresenceToken({
  presenceToken,
  restaurantId,
  slug,
  spaceType,
  spaceNumber,
  qrToken = '',
  allowedMethods = null,
  jwtSecret = JWT_SECRET
}) {
  if (!presenceToken || typeof presenceToken !== 'string') {
    return { valid: false, reason: 'missing_presence_token' };
  }

  try {
    const decoded = jwt.verify(presenceToken.trim(), jwtSecret);
    if (!decoded || typeof decoded !== 'object') {
      return { valid: false, reason: 'malformed_presence_token' };
    }

    // 1. Restaurant Tenant Isolation Check
    if (Number(decoded.restaurant_id) !== Number(restaurantId)) {
      return { valid: false, reason: 'tenant_mismatch' };
    }

    if (slug && decoded.slug && String(decoded.slug).toLowerCase() !== String(slug).toLowerCase()) {
      return { valid: false, reason: 'slug_mismatch' };
    }

    // 2. Space Type & Table Number Binding Check
    const tokenSpaceType = normalizeSpaceType(decoded.space_type);
    const expectedSpaceType = normalizeSpaceType(spaceType);
    if (tokenSpaceType !== expectedSpaceType) {
      return { valid: false, reason: 'space_type_mismatch' };
    }

    const tokenSpaceNum = normalizeSpaceNumber(decoded.space_number);
    const expectedSpaceNum = normalizeSpaceNumber(spaceNumber);
    if (tokenSpaceNum !== expectedSpaceNum) {
      return { valid: false, reason: 'table_number_mismatch' };
    }

    // 3. Physical QR Context Hash Binding Check (Anti-Replay / Anti-Tamper)
    if (qrToken && decoded.qr_hash) {
      const expectedHash = generateQrContextHash(slug, spaceType, spaceNumber, qrToken);
      if (decoded.qr_hash !== expectedHash) {
        return { valid: false, reason: 'qr_context_mismatch' };
      }
    }

    // 4. Allowed Verification Method Check (GPS vs STAFF vs QR)
    if (Array.isArray(allowedMethods) && allowedMethods.length > 0) {
      const method = String(decoded.method || 'GPS').toUpperCase();
      const normalizedAllowed = allowedMethods.map(m => String(m).toUpperCase());
      if (!normalizedAllowed.includes(method)) {
        return { valid: false, reason: 'method_not_allowed', method, allowedMethods: normalizedAllowed };
      }
    }

    return { valid: true, reason: null, payload: decoded };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, reason: 'presence_token_expired' };
    }
    return { valid: false, reason: 'invalid_presence_token' };
  }
}

export default {
  VERIFICATION_MODES,
  ALL_VERIFICATION_MODES,
  DEFAULT_VERIFICATION_MODE,
  VALID_VERIFICATION_METHODS,
  VALID_VERIFICATION_STATUSES,
  GPS_TOLERANCE,
  isValidVerificationMode,
  normalizeVerificationMode,
  generateQrContextHash,
  resolveEffectiveVerificationPolicy,
  generatePresenceToken,
  verifyPresenceToken,
  calculateEffectiveGpsTolerance
};
