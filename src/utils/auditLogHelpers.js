import { Key, Store, CreditCard, Sparkles, Settings } from 'lucide-react';

/**
 * Audit Log Category Identifier Constants
 */
export const AUDIT_CATEGORIES = {
  SECURITY: 'security',
  VIP: 'vip',
  BILLING: 'billing',
  TENANT: 'tenant',
  SYSTEM: 'system'
};

/**
 * Normalizes actor role variants into standard platform categories.
 * Maps:
 * - 'admin', 'restaurant_admin', 'tenant_admin', 'resto_admin' -> 'admin'
 * - 'superadmin', 'super_admin' -> 'superadmin'
 * - 'payment_gateway', 'cashfree', 'gateway' -> 'payment_gateway'
 * - 'system', 'system_worker', 'worker' -> 'system'
 *
 * Strictly prevents incorrect merging between Super Admin, Restaurant Admin, and System Worker.
 *
 * @param {string} rawRole
 * @returns {string} Normalized role
 */
export const normalizeActorRole = (rawRole) => {
  if (!rawRole) return 'system';
  const r = String(rawRole).trim().toLowerCase();
  if (r === 'superadmin' || r === 'super_admin') {
    return 'superadmin';
  }
  if (r === 'admin' || r === 'restaurant_admin' || r === 'tenant_admin' || r === 'resto_admin') {
    return 'admin';
  }
  if (r === 'payment_gateway' || r === 'cashfree' || r === 'gateway') {
    return 'payment_gateway';
  }
  if (r === 'system' || r === 'system_worker' || r === 'worker') {
    return 'system';
  }
  return r;
};

/**
 * Resolves UI presentation badge and label for an actor role.
 * Handles role variants (e.g., 'tenant_admin', uppercase 'SYSTEM', 'superadmin', etc.)
 *
 * @param {string} role
 * @returns {{ label: string, bg: string, color: string }}
 */
export const getActorDetails = (role) => {
  const norm = normalizeActorRole(role);
  switch (norm) {
    case 'superadmin':
      return { label: '👑 Super Admin', bg: '#FEF3C7', color: '#92400E' };
    case 'admin':
      return { label: '🏢 Resto Owner', bg: '#EFF6FF', color: '#1E40AF' };
    case 'payment_gateway':
      return { label: '💳 Cashfree Gateway', bg: '#DCFCE7', color: '#166534' };
    case 'system':
      return { label: '⚙️ System Worker', bg: '#F1F5F9', color: '#334155' };
    default:
      return { label: role ? `👤 ${role}` : '⚙️ System Worker', bg: '#F1F5F9', color: '#334155' };
  }
};

/**
 * Categorizes an audit log entry.
 * Priority order ensures VIP grants/revocations and webhook billing events are never swallowed by System:
 * 1. Security & Authentication
 * 2. VIP & Grants (GRANT_ADMIN_ACCESS, VIP_ACCESS_REVOKED, COMPLIMENTARY, ADMIN_GRANTED)
 * 3. Shop / Tenant Lifecycle
 * 4. Billing & Cashfree Webhooks (PRE_DEBIT_NOTIFICATION_RECEIVED, REFUND_AUDIT_LOGGED, etc.)
 * 5. System (Fallback)
 *
 * @param {object} log
 * @returns {{ id: string, label: string, icon: object, color: string, bg: string, border: string }}
 */
export const getCategory = (log) => {
  const act = (log?.action || '').toUpperCase();

  // 1. Security
  if (
    act.includes('SECURITY') || 
    act.includes('LOGIN') || 
    act.includes('LOGOUT') || 
    act.includes('CREDENTIAL') || 
    act.includes('PASSWORD') || 
    act.includes('IMPERSONAT')
  ) {
    return { id: 'security', label: 'Security', icon: Key, color: '#9333EA', bg: '#F3E8FF', border: '#D8B4FE' };
  }

  // 2. VIP & Grants (GRANT_ADMIN_ACCESS, VIP_ACCESS_REVOKED, COMPLIMENTARY, ADMIN_GRANTED, FREE_ACCESS)
  if (
    act.includes('VIP') || 
    act.includes('GRANT') || 
    act.includes('COMPLIMENTARY') || 
    act.includes('ADMIN_GRANTED') || 
    act.includes('FREE_ACCESS') ||
    act.includes('ADMIN_ACCESS')
  ) {
    return { id: 'vip', label: 'VIP & Grants', icon: Sparkles, color: '#D97706', bg: '#FEF3C7', border: '#FCD34D' };
  }

  // 3. Billing, Cashfree Webhooks, Subscriptions, Refunds, Pre-debits, Mandates, Plans
  if (
    act.includes('CASHFREE') || 
    act.includes('PAYMENT') || 
    act.includes('SUB_') || 
    act.includes('SUBSCRIPTION') || 
    act.includes('PLAN') || 
    act.includes('CANCEL') || 
    act.includes('RENEW') || 
    act.includes('REFUND') || 
    act.includes('DEBIT') || 
    act.includes('PRE_DEBIT') || 
    act.includes('INVOICE') || 
    act.includes('CHECKOUT') || 
    act.includes('MANDATE') || 
    act.includes('WEBHOOK') || 
    act.includes('BILLING')
  ) {
    return { id: 'billing', label: 'Billing', icon: CreditCard, color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' };
  }

  // 4. Shop / Tenant Lifecycle
  if (
    act.includes('TENANT') || 
    act.includes('RESTAURANT') || 
    act.includes('ACTIVAT') || 
    act.includes('SUSPEND') || 
    act.includes('DELETE') || 
    act.includes('REGISTER') || 
    act.includes('OWNER_EMAIL') ||
    act.includes('CATEGORY') ||
    act.includes('DISH') ||
    act.includes('COMBO') ||
    act.includes('SETTINGS')
  ) {
    return { id: 'tenant', label: 'Shop', icon: Store, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
  }

  // 5. System (Fallback)
  return { id: 'system', label: 'System', icon: Settings, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
};

/**
 * Computes exact category metrics counts for audit log stream.
 * VIP entries have their own distinct count and are NEVER included in System count.
 *
 * @param {Array} logs
 * @returns {{ total: number, security: number, billing: number, tenant: number, vip: number, system: number }}
 */
export const computeAuditStats = (logs = []) => {
  let security = 0;
  let billing = 0;
  let tenant = 0;
  let vip = 0;
  let system = 0;

  (logs || []).forEach(log => {
    const cat = getCategory(log).id;
    if (cat === 'security') security++;
    else if (cat === 'vip') vip++;
    else if (cat === 'billing') billing++;
    else if (cat === 'tenant') tenant++;
    else system++;
  });

  return {
    total: logs ? logs.length : 0,
    security,
    billing,
    tenant,
    vip,
    system
  };
};

/**
 * Resolves restaurant/tenant display name and association for an audit log.
 * Priority:
 * 1. log.restaurant_name (from API response / SQL join)
 * 2. loaded restaurant tenant object in dashboard state (fallback)
 * 3. parsed restaurant name in log details (e.g. deletion snapshot)
 * 4. 'Shop #${log.restaurant_id}' fallback
 *
 * Guarantees no blank tenant name if API response includes restaurant_name.
 *
 * @param {object} log
 * @param {Array} restaurants
 * @returns {{ name: string|null, loadedTenant: object|null, hasLink: boolean }}
 */
export const resolveTenantDisplay = (log, restaurants = []) => {
  if (!log) {
    return { name: null, loadedTenant: null, hasLink: false };
  }

  // 1. Primary: use log.restaurant_name from API response
  let name = (log.restaurant_name && typeof log.restaurant_name === 'string' && log.restaurant_name.trim()) 
    ? log.restaurant_name.trim() 
    : null;

  // 2. Fallback: look up in loaded tenant list
  const loadedTenant = log.restaurant_id && Array.isArray(restaurants)
    ? restaurants.find(r => r && (r.id === log.restaurant_id || String(r.id) === String(log.restaurant_id)))
    : null;

  if (!name && loadedTenant?.name && typeof loadedTenant.name === 'string' && loadedTenant.name.trim()) {
    name = loadedTenant.name.trim();
  }

  // 3. Fallback: parse details if log was a deletion snapshot with tenant name
  if (!name && log.details && typeof log.details === 'string') {
    const quoteMatch = log.details.match(/tenant ["']([^"']+)["']/i);
    if (quoteMatch && quoteMatch[1] && quoteMatch[1].trim()) {
      name = quoteMatch[1].trim();
    }
  }

  // 4. Fallback if restaurant_id exists
  if (!name && log.restaurant_id) {
    name = `Shop #${log.restaurant_id}`;
  }

  return {
    name,
    loadedTenant: loadedTenant || null,
    hasLink: Boolean(loadedTenant)
  };
};

/**
 * Formats an audit log error object, HTTP response, or network failure into a user-visible message.
 *
 * @param {Error|object|string} err
 * @returns {string|null}
 */
export const formatAuditErrorMessage = (err) => {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (err.isUnauthorized || err.status === 401) {
    return 'Authentication session has expired. Please sign in again to view platform audit logs.';
  }
  if (err.status === 403) {
    return 'Access denied: Super Admin privileges are required to view platform audit logs.';
  }
  if (err.name === 'AbortError' || (err.message && err.message.toLowerCase().includes('timeout'))) {
    return 'The request timed out while loading platform audit logs. Please try again.';
  }
  if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
    return 'Unable to connect to the platform server. Please check your network connection and retry.';
  }
  return err.message || 'Failed to load audit logs due to an unexpected server error.';
};

/**
 * Coordinates async fetch operations to prevent duplicate in-flight requests.
 * Concurrent executions share the same pending promise, avoiding race conditions
 * and double API calls in React development Strict Mode and rapid navigation.
 *
 * @param {Function} fetcherFn - Async function performing the fetch
 * @returns {{ execute: Function, isInFlight: Function, reset: Function }}
 */
export const createDeduplicatedFetcher = (fetcherFn) => {
  let inFlightPromise = null;

  const execute = async (...args) => {
    if (inFlightPromise) {
      return inFlightPromise;
    }
    inFlightPromise = (async () => {
      try {
        return await fetcherFn(...args);
      } finally {
        inFlightPromise = null;
      }
    })();
    return inFlightPromise;
  };

  const isInFlight = () => inFlightPromise !== null;

  const reset = () => {
    inFlightPromise = null;
  };

  return { execute, isInFlight, reset };
};

