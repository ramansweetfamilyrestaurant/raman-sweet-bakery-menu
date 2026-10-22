/**
 * Pure KDS Reliability & Lifecycle Helpers
 *
 * Centralizes pure logic for:
 * 1. Shared-device slug resolution (strict tenant isolation; ignores cached localStorage admin slugs).
 * 2. Recall API error parsing & safe user-facing messaging.
 * 3. Connection status calculation (anti-flicker reconnecting/offline state).
 * 4. Polling concurrency & stale response guards.
 * 5. Siren interval lifecycle safety.
 */

const SYSTEM_ROUTE_BLACKLIST = new Set([
  'kitchen',
  'admin',
  'superadmin',
  'super-admin',
  'api',
  'uploads',
  'assets',
  'register',
  'billing',
  'privacy',
  'privacy-policy',
  'terms',
  'terms-of-service',
  'refund-policy',
  'security',
  'contact',
  'support'
]);

/**
 * Resolve tenant slug strictly from URL path or explicit ?slug= query parameter.
 * Strictly ignores localStorage.touchqr_admin_slug, touchqr_last_slug, etc.
 *
 * @param {Object} options
 * @param {string} [options.slug] - Explicit slug passed via props
 * @param {string} [options.pathname] - window.location.pathname
 * @param {string} [options.search] - window.location.search
 * @returns {string} Clean tenant slug, or '' if missing/unspecified
 */
export function resolveKdsSlug({ slug = '', pathname = '', search = '' } = {}) {
  // 1. Explicit prop (e.g. from router or wrapper)
  if (slug && typeof slug === 'string') {
    const trimmed = slug.trim().toLowerCase();
    if (trimmed && !SYSTEM_ROUTE_BLACKLIST.has(trimmed)) {
      return trimmed;
    }
  }

  // 2. Explicit query parameter ?slug=...
  if (search && typeof search === 'string') {
    try {
      const params = new URLSearchParams(search);
      const querySlug = (params.get('slug') || '').trim().toLowerCase();
      if (querySlug && !SYSTEM_ROUTE_BLACKLIST.has(querySlug)) {
        return querySlug;
      }
    } catch (e) {
      // ignore query parsing errors
    }
  }

  // 3. Supported path formats
  if (pathname && typeof pathname === 'string') {
    const cleanPath = pathname.toLowerCase().replace(/\/+$/, '');
    const parts = cleanPath.split('/').filter(Boolean);

    // Format: /r/:slug/kitchen
    if (parts.length >= 3 && parts[0] === 'r' && parts[parts.length - 1] === 'kitchen') {
      const candidate = parts[1];
      if (candidate && !SYSTEM_ROUTE_BLACKLIST.has(candidate)) {
        return candidate;
      }
    }

    // Format: /:slug/kitchen
    if (parts.length >= 2 && parts[parts.length - 1] === 'kitchen') {
      const candidate = parts[parts.length - 2];
      if (candidate && !SYSTEM_ROUTE_BLACKLIST.has(candidate)) {
        return candidate;
      }
    }

    // Single segment if not generic system path (e.g. /my-restaurant when mounted at root)
    if (parts.length === 1 && !SYSTEM_ROUTE_BLACKLIST.has(parts[0])) {
      return parts[0];
    }
  }

  // NEVER read from localStorage for tenant resolution on shared devices!
  return '';
}

/**
 * Safely parse Recall API response and provide actionable user-facing messages.
 *
 * @param {number} status - HTTP status code
 * @param {Object} [data] - JSON response payload
 * @param {number|string} [orderId] - ID of the order being recalled
 * @returns {Object} { success, message, isConflict, isForbidden, isNotFound }
 */
export function parseRecallErrorResponse(status, data = {}, orderId = '') {
  const displayId = orderId ? `#${orderId}` : '';

  if (status >= 200 && status < 300) {
    return {
      success: true,
      message: `Order ${displayId} successfully restored to active kitchen queue.`,
      isConflict: false,
      isForbidden: false,
      isNotFound: false
    };
  }

  if (status === 409) {
    const detail = data?.message || data?.error;
    const reason = detail ? `: ${detail}` : ' because it is already settled or in a terminal state.';
    return {
      success: false,
      message: `Order ${displayId} cannot be recalled${reason}`,
      isConflict: true,
      isForbidden: false,
      isNotFound: false
    };
  }

  if (status === 403) {
    const detail = data?.error === 'KDS_DISABLED'
      ? 'Kitchen Display System is not included in the current subscription plan.'
      : data?.message || 'Access denied due to subscription entitlement or restaurant status.';
    return {
      success: false,
      message: `Kitchen recall unavailable: ${detail}`,
      isConflict: false,
      isForbidden: true,
      isNotFound: false
    };
  }

  if (status === 404) {
    return {
      success: false,
      message: `Order ${displayId} could not be found.`,
      isConflict: false,
      isForbidden: false,
      isNotFound: true
    };
  }

  // 500 or other unexpected network/server errors
  return {
    success: false,
    message: `Network or server error while recalling Order ${displayId}. Please try again.`,
    isConflict: false,
    isForbidden: false,
    isNotFound: false
  };
}

/**
 * Compute connection status to avoid UI flicker during transient network drops.
 *
 * @param {Object} options
 * @param {number} options.consecutiveFailures - Number of consecutive failed polls
 * @param {boolean} [options.isBrowserOnline=true] - navigator.onLine
 * @returns {'online' | 'reconnecting' | 'offline'}
 */
export function calculateConnectionStatus({ consecutiveFailures = 0, isBrowserOnline = true } = {}) {
  if (!isBrowserOnline) {
    return 'offline';
  }
  if (consecutiveFailures === 0) {
    return 'online';
  }
  if (consecutiveFailures === 1) {
    // 1 transient failure: indicate reconnecting without jarring offline badge
    return 'reconnecting';
  }
  return 'offline';
}

/**
 * Prefix for tenant-isolated KDS sound preference keys in localStorage.
 * Isolated strictly per restaurant slug: `touchqr_kds_sound_pref_${slug}`.
 */
export const KDS_SOUND_STORAGE_PREFIX = 'touchqr_kds_sound_pref_';

/**
 * Retrieve tenant-isolated KDS sound preference from storage.
 * Strictly scopes by tenant slug to prevent cross-restaurant leakage on shared devices.
 *
 * @param {string} targetSlug - Restaurant tenant slug
 * @param {Storage} [storage] - Optional storage instance (defaults to localStorage if available)
 * @returns {string} 'enabled' | 'muted' | ''
 */
export function getKdsSoundPreference(targetSlug, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!targetSlug || typeof targetSlug !== 'string' || !storage) return '';
  const cleanSlug = targetSlug.trim().toLowerCase();
  if (!cleanSlug) return '';
  try {
    return storage.getItem(`${KDS_SOUND_STORAGE_PREFIX}${cleanSlug}`) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Persist tenant-isolated KDS sound preference to storage.
 *
 * @param {string} targetSlug - Restaurant tenant slug
 * @param {'enabled' | 'muted'} pref - Sound preference value
 * @param {Storage} [storage] - Optional storage instance (defaults to localStorage if available)
 * @returns {boolean}
 */
export function setKdsSoundPreference(targetSlug, pref = 'enabled', storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!targetSlug || typeof targetSlug !== 'string' || !storage) return false;
  const cleanSlug = targetSlug.trim().toLowerCase();
  if (!cleanSlug) return false;
  try {
    storage.setItem(`${KDS_SOUND_STORAGE_PREFIX}${cleanSlug}`, pref);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Determine if custom KDS sound permission prompt should be shown.
 * Suppresses repeated custom prompt if preference is already saved for this tenant,
 * or if audio is already active/unlocked in the current session.
 *
 * @param {Object} options
 * @param {string} [options.soundPreference] - 'enabled' | 'muted' | ''
 * @param {boolean} [options.isAudioReady=false] - Whether Web AudioContext is running
 * @param {boolean} [options.isAudioUnlocked=false] - Ephemeral audio unlocked state
 * @returns {boolean}
 */
export function shouldShowKdsSoundPrompt({ soundPreference = '', isAudioReady = false, isAudioUnlocked = false } = {}) {
  // If user has already chosen their sound preference for this tenant, suppress prompt
  if (soundPreference === 'enabled' || soundPreference === 'muted') {
    return false;
  }
  // If audio is already active or unlocked in the current session
  if (isAudioReady || isAudioUnlocked) {
    return false;
  }
  return true;
}

/**
 * Safely request browser Notification permission only when permission is 'default'.
 * Prevents re-triggering browser permission prompt if already 'granted' or 'denied'.
 *
 * @param {typeof Notification} [NotificationObj] - Notification constructor
 * @returns {Promise<string>} 'granted' | 'denied' | 'default' | 'unsupported'
 */
export async function safeRequestNotificationPermission(NotificationObj = typeof Notification !== 'undefined' ? Notification : null) {
  if (!NotificationObj || typeof NotificationObj.requestPermission !== 'function') {
    return 'unsupported';
  }
  if (NotificationObj.permission === 'granted' || NotificationObj.permission === 'denied') {
    return NotificationObj.permission;
  }
  try {
    return await NotificationObj.requestPermission();
  } catch (err) {
    return NotificationObj.permission || 'denied';
  }
}
