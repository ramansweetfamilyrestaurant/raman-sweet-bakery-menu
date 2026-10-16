import crypto from 'crypto';

export const CANONICAL_CATEGORIES = Object.freeze([
  'orders',
  'menu',
  'qr',
  'kds',
  'billing',
  'printer',
  'analytics',
  'settings',
  'other'
]);

/**
 * Backward-compatible category aliases mapping older/alternate names
 * to TouchQR's single authoritative category model.
 */
export const CATEGORY_ALIASES = Object.freeze({
  hardware: 'printer', // Hardware / thermal printer inquiries
  table_qr: 'qr',      // Table QR / standee inquiries
  account: 'other'     // Account / general administrative inquiries
});

export const VALID_CATEGORIES = Object.freeze([
  ...CANONICAL_CATEGORIES,
  ...Object.keys(CATEGORY_ALIASES)
]);

/**
 * Normalizes input category to its canonical representation.
 * Returns canonical category string or null if invalid.
 */
export function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return null;
  const clean = category.toLowerCase().trim();
  if (CATEGORY_ALIASES[clean]) return CATEGORY_ALIASES[clean];
  if (CANONICAL_CATEGORIES.includes(clean)) return clean;
  return null;
}

export const VALID_PRIORITIES = Object.freeze([
  'low',
  'medium',
  'high',
  'urgent'
]);

export const VALID_STATUSES = Object.freeze([
  'open',
  'in_progress',
  'waiting_on_tenant',
  'resolved',
  'closed'
]);

/**
 * Generate a cryptographically random, collision-resistant ticket reference.
 * Format: TKT-YYYYMMDD-XXXXXX (e.g. TKT-20261016-A1B2C3)
 */
export function generateTicketReference() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const randHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TKT-${year}${month}${day}-${randHex}`;
}

/**
 * Validates ticket creation payload.
 */
export function validateTicketInput({ subject, category, message, priority }) {
  const errors = [];
  let code = null;

  const trimmedSubject = String(subject || '').trim();
  if (!trimmedSubject || trimmedSubject.length < 3 || trimmedSubject.length > 200) {
    errors.push('Subject must be between 3 and 200 characters.');
    if (!code) code = 'INVALID_SUBJECT';
  }

  const cleanCategory = String(category || '').toLowerCase().trim();
  const normalizedCategory = normalizeCategory(cleanCategory);
  if (!normalizedCategory) {
    errors.push(`Category must be one of: ${CANONICAL_CATEGORIES.join(', ')}.`);
    if (!code) code = 'INVALID_CATEGORY';
  }

  const cleanPriority = String(priority || 'medium').toLowerCase().trim();
  if (!VALID_PRIORITIES.includes(cleanPriority)) {
    errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    if (!code) code = 'INVALID_PRIORITY';
  }

  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage || trimmedMessage.length < 5 || trimmedMessage.length > 5000) {
    errors.push('Message must be between 5 and 5000 characters.');
    if (!code) code = 'INVALID_MESSAGE';
  }

  return {
    isValid: errors.length === 0,
    errors,
    code: code || null,
    data: {
      subject: trimmedSubject,
      category: normalizedCategory,
      message: trimmedMessage,
      priority: cleanPriority
    }
  };
}

/**
 * Validates reply message payload.
 */
export function validateReplyInput(message) {
  const trimmed = String(message || '').trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 5000) {
    return {
      isValid: false,
      error: 'Reply message must be between 2 and 5000 characters.',
      code: 'INVALID_REPLY',
      data: null
    };
  }
  return {
    isValid: true,
    error: null,
    code: null,
    data: trimmed
  };
}

/**
 * Validates status transitions.
 * Returns { isValid: boolean, error?: string }
 */
export function validateStatusTransition(currentStatus, targetStatus) {
  if (!VALID_STATUSES.includes(targetStatus)) {
    return {
      isValid: false,
      error: `Invalid status '${targetStatus}'. Allowed: ${VALID_STATUSES.join(', ')}.`
    };
  }

  // If already at status, it's a no-op
  if (currentStatus === targetStatus) {
    return { isValid: true };
  }

  // If closed, only superadmin can explicitly reopen to open or in_progress
  if (currentStatus === 'closed') {
    if (targetStatus !== 'open' && targetStatus !== 'in_progress') {
      return {
        isValid: false,
        error: "Closed tickets can only be transitioned back to 'open' or 'in_progress'."
      };
    }
  }

  return { isValid: true };
}
