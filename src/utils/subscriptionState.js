/**
 * CANONICAL SUBSCRIPTION STATE MACHINE & UI MAPPER (FRONTEND)
 * TouchQR Billing System — Canonical Source of Truth
 */

export const SUBSCRIPTION_STATES = Object.freeze({
  PENDING: 'pending',
  INITIALIZED: 'initialized',
  BANK_APPROVAL_PENDING: 'bank_approval_pending',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAYMENT_FAILED: 'payment_failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  ADMIN_GRANTED: 'admin_granted'
});

/**
 * Returns canonical UI presentation details for any given subscription/mandate state.
 *
 * @param {string} state - Raw state string
 * @param {Object} [meta] - Metadata (e.g. accessUntil, trialDays, etc.)
 * @returns {{ label: string, color: string, icon: string, description: string, isInformational: boolean }}
 */
export function getSubscriptionUIMeta(state, meta = {}) {
  const normalized = (state || '').toLowerCase().trim();

  switch (normalized) {
    case 'initialized':
    case 'bank_approval_pending':
    case 'pending':
      return {
        label: 'Authorization Pending',
        color: '#EAB308',
        icon: '🟡',
        description: "Your UPI AutoPay authorization is still being processed. We'll update this page automatically.",
        isInformational: true
      };

    case 'trialing':
      return {
        label: `${meta.trialDays || 16}-Day Free Trial Active`,
        color: '#86EFAC',
        icon: '🎁',
        description: `Your free trial is active until ${meta.trialEndFormatted || 'the trial end date'}. No charge today.`,
        isInformational: false
      };

    case 'active':
      return {
        label: 'Subscription Active',
        color: '#22C55E',
        icon: '🟢',
        description: 'Auto-Renew is ON via Cashfree UPI AutoPay.',
        isInformational: false
      };

    case 'payment_failed':
      return {
        label: 'Payment Failed (Grace Period)',
        color: '#EAB308',
        icon: '🟡',
        description: 'Recent payment attempt could not be processed. Operational access remains available during the grace period.',
        isInformational: false
      };

    case 'cancelled':
      return {
        label: 'Auto-Renew Off',
        color: '#F97316',
        icon: '🟠',
        description: `Auto-Renew has been cancelled. Access continues until ${meta.accessUntilFormatted || 'the current period ends'}.`,
        isInformational: false
      };

    case 'admin_granted':
      return {
        label: 'Complimentary Access Active',
        color: '#3B82F6',
        icon: '🎁',
        description: 'Your account has been granted complimentary VIP access by Super Admin.',
        isInformational: false
      };

    case 'expired':
    default:
      return {
        label: 'Subscription Expired',
        color: '#EF4444',
        icon: '🔴',
        description: 'Your free trial or SaaS plan has expired. Please renew your subscription to continue using operational features.',
        isInformational: false
      };
  }
}
