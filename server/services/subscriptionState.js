/**
 * CANONICAL SUBSCRIPTION STATE MACHINE & RESOLUTION HELPER
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
 * Resolves the canonical subscription state and access decision for a tenant.
 *
 * @param {Object} params
 * @param {Object} params.resto - Restaurant record from DB
 * @param {Object|null} params.sub - Latest subscription record from DB
 * @param {Date} [params.now=new Date()] - Reference date for evaluation
 * @returns {{
 *   status: string,
 *   active: boolean,
 *   isComplimentary: boolean,
 *   inGracePeriod: boolean,
 *   accessUntil: string|null,
 *   badge: { label: string, color: string, icon: string }
 * }}
 */
export function resolveCanonicalSubscriptionState({ resto, sub, now = new Date() }) {
  if (!resto) {
    return {
      status: SUBSCRIPTION_STATES.EXPIRED,
      active: false,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: null,
      badge: { label: 'Expired', color: '#EF4444', icon: '🔴' }
    };
  }

  // 1. Super Admin 100% Complimentary Lifetime Access
  if (resto.mandate_status === 'admin_granted' || resto.subscription_type === 'ADMIN_GRANTED') {
    return {
      status: SUBSCRIPTION_STATES.ACTIVE,
      active: true,
      isComplimentary: true,
      inGracePeriod: false,
      accessUntil: resto.plan_expires_at || 'Lifetime',
      badge: { label: 'Complimentary Access Active', color: '#3B82F6', icon: '🎁' }
    };
  }

  // 2. Check Trial End Date
  let isTrialing = false;
  let trialEnd = null;
  if (resto.trial_ends_at) {
    const trialExp = new Date(String(resto.trial_ends_at).includes('T') ? resto.trial_ends_at : `${resto.trial_ends_at}T23:59:59Z`);
    if (!isNaN(trialExp.getTime())) {
      trialEnd = trialExp;
      if (trialExp >= now) {
        isTrialing = true;
      }
    }
  }

  // 3. Check Plan Expiration Date
  let isPlanActive = false;
  let planEnd = null;
  if (resto.plan_expires_at) {
    const planExp = new Date(String(resto.plan_expires_at).includes('T') ? resto.plan_expires_at : `${resto.plan_expires_at}T23:59:59Z`);
    if (!isNaN(planExp.getTime())) {
      planEnd = planExp;
      if (planExp >= now) {
        isPlanActive = true;
      }
    }
  }

  // 4. Legitimate Trial Active (Trial access policy is independent from mandate status)
  // Legitimate trial access is preserved even if mandate is pending, bank_approval_pending, failed, or cancelled
  if (isTrialing) {
    if (sub && sub.cancel_requested_at) {
      return {
        status: SUBSCRIPTION_STATES.TRIALING,
        active: true,
        isComplimentary: false,
        inGracePeriod: false,
        accessUntil: resto.trial_ends_at,
        badge: { label: 'Free Trial Active (Auto-Renew Off)', color: '#86EFAC', icon: '🎁' }
      };
    }
    return {
      status: SUBSCRIPTION_STATES.TRIALING,
      active: true,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: resto.trial_ends_at,
      badge: { label: 'Free Trial Active', color: '#86EFAC', icon: '🎁' }
    };
  }

  // 5. Check Active Paid Subscription in subscriptions table
  if (sub && sub.status === 'active') {
    if (sub.cancel_requested_at && sub.current_period_end) {
      const periodEnd = new Date(sub.current_period_end);
      if (periodEnd >= now) {
        return {
          status: SUBSCRIPTION_STATES.CANCELLED,
          active: true,
          isComplimentary: false,
          inGracePeriod: false,
          accessUntil: sub.current_period_end,
          badge: { label: 'Auto-Renew Off (Active until period end)', color: '#F97316', icon: '🟠' }
        };
      }
    } else if (resto.mandate_status === 'active') {
      return {
        status: SUBSCRIPTION_STATES.ACTIVE,
        active: true,
        isComplimentary: false,
        inGracePeriod: false,
        accessUntil: sub.current_period_end || resto.plan_expires_at,
        badge: { label: 'Subscription Active', color: '#22C55E', icon: '🟢' }
      };
    }
  }

  // 6. Payment Failed with Active Grace Period
  if (sub && sub.status === 'payment_failed') {
    // If period end or plan expires is still in future (e.g. grace window)
    if (isPlanActive) {
      return {
        status: SUBSCRIPTION_STATES.PAYMENT_FAILED,
        active: true,
        isComplimentary: false,
        inGracePeriod: true,
        accessUntil: resto.plan_expires_at || (sub.current_period_end || null),
        badge: { label: 'Payment Failed (Grace Period Active)', color: '#EAB308', icon: '🟡' }
      };
    }
  }

  // 7. Cancelled Subscription with remaining paid period
  if (sub && sub.cancel_requested_at && sub.current_period_end) {
    const periodEnd = new Date(sub.current_period_end);
    if (periodEnd >= now) {
      return {
        status: SUBSCRIPTION_STATES.CANCELLED,
        active: true,
        isComplimentary: false,
        inGracePeriod: false,
        accessUntil: sub.current_period_end,
        badge: { label: 'Auto-Renew Off (Active until period end)', color: '#F97316', icon: '🟠' }
      };
    }
  }

  // 8. General Plan Active — ONLY if confirmed mandate_status === 'active'
  // Failed, rejected, cancelled, missing, unknown, or pending mandates NEVER grant active paid status!
  if (isPlanActive && resto.mandate_status === 'active') {
    return {
      status: SUBSCRIPTION_STATES.ACTIVE,
      active: true,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: resto.plan_expires_at,
      badge: { label: 'Subscription Active', color: '#22C55E', icon: '🟢' }
    };
  }

  // 9. Bank Approval Pending (Trial expired or not trialing)
  if (resto.mandate_status === 'bank_approval_pending') {
    return {
      status: SUBSCRIPTION_STATES.BANK_APPROVAL_PENDING,
      active: false,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: resto.trial_ends_at || null,
      badge: { label: 'Bank Approval Pending', color: '#EAB308', icon: '⏳' }
    };
  }

  // 10. Mandate Pending / Initialized on new onboarding
  if (resto.mandate_status === 'pending' || resto.mandate_status === 'initialized') {
    return {
      status: SUBSCRIPTION_STATES.PENDING,
      active: false,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: null,
      badge: { label: 'Authorization Pending', color: '#EAB308', icon: '🟡' }
    };
  }

  // 11. Mandate Failed or Rejected
  if (resto.mandate_status === 'failed' || resto.mandate_status === 'rejected') {
    return {
      status: SUBSCRIPTION_STATES.PAYMENT_FAILED,
      active: false,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: resto.plan_expires_at || resto.trial_ends_at || null,
      badge: { label: 'Payment Authorization Failed', color: '#EF4444', icon: '❌' }
    };
  }

  // 12. Mandate Cancelled
  if (resto.mandate_status === 'cancelled') {
    return {
      status: SUBSCRIPTION_STATES.CANCELLED,
      active: false,
      isComplimentary: false,
      inGracePeriod: false,
      accessUntil: resto.plan_expires_at || resto.trial_ends_at || null,
      badge: { label: 'Subscription Cancelled', color: '#F97316', icon: '🟠' }
    };
  }

  // 13. Expired / Missing / Unknown Fallback (Never grants unauthorized paid entitlement)
  return {
    status: SUBSCRIPTION_STATES.EXPIRED,
    active: false,
    isComplimentary: false,
    inGracePeriod: false,
    accessUntil: resto.plan_expires_at || resto.trial_ends_at || null,
    badge: { label: 'Subscription Expired', color: '#EF4444', icon: '🔴' }
  };
}
