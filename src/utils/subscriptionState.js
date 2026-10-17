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
  ADMIN_GRANTED: 'admin_granted',
  SUSPENDED: 'suspended'
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
    case 'suspended':
      return {
        label: 'Account Suspended',
        color: '#EF4444',
        icon: '⚫',
        description: 'This business account has been suspended by Super Admin.',
        isInformational: false
      };

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

/**
 * Calculates authoritative normalized monthly recurring revenue (MRR) for a tenant.
 *
 * Rules:
 * - Excludes complimentary VIP accounts (₹0 MRR).
 * - Excludes suspended, expired, trialing, pending or non-paying accounts.
 * - Preserves custom/negotiated pricing (e.g. ₹799, ₹299) rather than forcing catalog list prices.
 * - Normalizes yearly/annual subscriptions by dividing by 12.
 *
 * @param {Object} tenant - Tenant restaurant record with subscription metadata
 * @returns {number} Normalized MRR in INR
 */
export function calculateTenantMrr(tenant) {
  if (!tenant) return 0;

  // 1. Explicitly suspended tenants must never contribute to recurring MRR
  const isSuspended = tenant.active === false || tenant.active === 0 || tenant.active === '0' || tenant.active === 'false' || tenant.subscription_status === 'suspended';
  if (isSuspended) return 0;

  // 2. Complimentary VIP tenants have ₹0 recurring revenue
  const isVip = Boolean(
    tenant.is_vip ||
    tenant.is_complimentary ||
    tenant.subscription_type === 'ADMIN_GRANTED' ||
    tenant.mandate_status === 'admin_granted' ||
    Number(tenant.plan_price) === 0 ||
    Number(tenant.effective_plan_price) === 0
  );
  if (isVip) return 0;

  // 3. Exclude non-active / non-paying states (trials, expired, cancelled, failed, awaiting charge)
  // Only operational active paid accounts count towards recurring paid revenue
  const status = String(tenant.subscription_status || '').toLowerCase();
  if (status && status !== 'active') {
    return 0;
  }

  // 4. Resolve the authoritative actual recurring price (preserving custom/negotiated pricing like ₹799, ₹299)
  let rawAmount = 0;
  if (tenant.recurring_amount !== undefined && tenant.recurring_amount !== null && tenant.recurring_amount !== '') {
    rawAmount = Number(tenant.recurring_amount);
  } else if (tenant.effective_plan_price !== undefined && tenant.effective_plan_price !== null && tenant.effective_plan_price !== '') {
    rawAmount = Number(tenant.effective_plan_price);
  } else if (tenant.plan_price !== undefined && tenant.plan_price !== null && tenant.plan_price !== '') {
    rawAmount = Number(tenant.plan_price);
  }

  if (isNaN(rawAmount) || rawAmount <= 0) return 0;

  // 5. Normalize billing periods (e.g. annual subscriptions / 12)
  const cycle = String(tenant.billing_cycle || tenant.billing_frequency || '').toLowerCase();
  if (cycle.includes('year') || cycle.includes('annual')) {
    return Math.round((rawAmount / 12) * 100) / 100;
  }

  return rawAmount;
}

/**
 * Authoritatively determines if a restaurant matches a given status filter.
 * Guarantees 1:1 parity between filter count pills and rendered table rows.
 *
 * @param {Object} r - Restaurant record
 * @param {string} filter - Filter key: 'all' | 'active' | 'suspended' | 'vip' | 'trial' | 'failed' | 'expired' | 'cancelled' | 'scheduled'
 * @returns {boolean}
 */
export function matchesTenantStatusFilter(r, filter) {
  if (!r) return false;
  if (!filter || filter === 'all') return true;

  const isSuspended = (r.active === false || r.active === 0 || r.active === '0' || r.active === 'false' || r.subscription_status === 'suspended');
  if (filter === 'suspended') return isSuspended;
  if (isSuspended) return false;

  const explicitVipFlag = (r.is_vip !== undefined)
    ? Boolean(r.is_vip)
    : (r.is_complimentary !== undefined)
      ? Boolean(r.is_complimentary)
      : null;

  const rawExp = r.plan_expires_at || r.access_until;
  const isVipExpired = rawExp && String(rawExp).toLowerCase() !== 'lifetime' && new Date(rawExp) < new Date();

  const isVip = (explicitVipFlag !== null)
    ? (explicitVipFlag && !isVipExpired)
    : !isVipExpired && Boolean(
        r.subscription_type === 'ADMIN_GRANTED' ||
        r.subscription_type === 'COMPLIMENTARY' ||
        r.mandate_status === 'admin_granted' ||
        r.mandate_status === 'complimentary' ||
        (r.effective_plan_tier === 'enterprise' && Number(r.effective_plan_price) === 0)
      );

  if (filter === 'vip' || filter === 'complimentary') return isVip;

  const isTrial = !isVip && (r.subscription_status === 'trialing' || r.subscription_status === 'trial' || r.subscription_type === 'TRIAL' || (r.trial_ends_at && new Date(r.trial_ends_at) > new Date()));
  if (filter === 'trial') return isTrial;

  const isExpired = !isVip && (r.subscription_status === 'expired' || (r.plan_expires_at && new Date(r.plan_expires_at) < new Date()));
  if (filter === 'expired') return isExpired;

  const isFailed = !isVip && (r.subscription_status === 'payment_failed' || r.subscription_status === 'past_due' || r.subscription_status === 'failed');
  if (filter === 'failed') return isFailed;

  if (filter === 'cancelled') {
    return !isVip && (r.cancel_requested_at !== null || r.subscription_status === 'cancelled' || r.auto_renew === 0);
  }

  if (filter === 'scheduled') {
    return !isVip && Boolean(r.scheduled_plan_key);
  }

  if (filter === 'active') {
    return !isExpired && !isFailed;
  }

  return true;
}

/**
 * Authoritatively formats tenant plan display labels across Directory, Cards, Subscriptions, and 360 views.
 *
 * Rules:
 * 1. For a tenant with authoritative complimentary VIP access, uses 'Enterprise VIP Access' as the primary plan label.
 * 2. Retains stored base tier only as secondary information (e.g. 'Base: BASIC' / 'Base: PRO') if different from enterprise.
 * 3. Never displays 'BASIC' or 'PRO' as the primary effective plan label for VIP accounts.
 * 4. Preserves ₹0 price and VIP badge.
 * 5. Ordinary paid and trial tenants display their catalog/custom plan name and price accurately.
 *
 * @param {Object} tenant
 * @returns {{ primaryLabel: string, secondaryLabel: string, badgeText: string|null, fullDisplay: string }}
 */
export function formatTenantPlanDisplay(tenant) {
  if (!tenant) {
    return {
      primaryLabel: 'Pro Plan',
      secondaryLabel: '₹999/mo',
      badgeText: null,
      fullDisplay: 'Pro Plan (₹999/mo)'
    };
  }

  const isVip = (tenant.is_vip !== undefined || tenant.is_complimentary !== undefined)
    ? Boolean(tenant.is_vip || tenant.is_complimentary)
    : Boolean(
        tenant.subscription_type === 'ADMIN_GRANTED' ||
        tenant.subscription_type === 'COMPLIMENTARY' ||
        tenant.subscription_type === 'VIP' ||
        tenant.mandate_status === 'admin_granted' ||
        tenant.mandate_status === 'complimentary'
      );

  if (isVip) {
    const rawBase = (tenant.plan_tier || '').trim();
    const hasBaseTier = rawBase && rawBase.toLowerCase() !== 'enterprise';
    const baseTier = hasBaseTier ? rawBase.toUpperCase() : null;

    return {
      primaryLabel: 'Enterprise VIP Access',
      secondaryLabel: baseTier ? `₹0/mo (Base: ${baseTier})` : '₹0/mo',
      badgeText: '★ VIP',
      fullDisplay: `Enterprise VIP Access (₹0/mo${baseTier ? ` • Base: ${baseTier}` : ''})`
    };
  }

  const primaryLabel = tenant.plan_name || (tenant.plan_tier ? `${tenant.plan_tier.toUpperCase()} Plan` : 'Pro Plan');
  const price = (tenant.effective_plan_price !== undefined && tenant.effective_plan_price !== null)
    ? tenant.effective_plan_price
    : (tenant.plan_price !== undefined && tenant.plan_price !== null ? tenant.plan_price : 999);
  const secondaryLabel = `₹${price}/mo`;

  return {
    primaryLabel,
    secondaryLabel,
    badgeText: null,
    fullDisplay: `${primaryLabel} (${secondaryLabel})`
  };
}

/**
 * Authoritatively determines if a tenant restaurant is VIP / Complimentary.
 *
 * @param {Object} r - Restaurant record
 * @returns {boolean}
 */
export function isVipTenant(r) {
  if (!r) return false;
  return matchesTenantStatusFilter(r, 'vip');
}

/**
 * Authoritatively determines if a VIP tenant has lifetime (or quasi-lifetime / 10-year grant) access.
 *
 * Rules:
 * - Must be an active VIP / Complimentary tenant.
 * - Access is considered Lifetime if:
 *   - Explicit string 'Lifetime', 'never', 'infinity', or 'indefinite'
 *   - No expiry date specified (null / undefined / empty)
 *   - Expiry year is far in the future (> 2030, e.g. 10-year VIP grants like 2036-10-06)
 * - Returns FALSE for finite / short-term VIP grants (e.g. 1-year VIP expiring in 2026 like Tenant 52).
 *
 * @param {Object} r - Restaurant record
 * @returns {boolean}
 */
export function isLifetimeVipTenant(r) {
  if (!r) return false;
  const isVip = isVipTenant(r) || Boolean(
    r.is_vip ||
    r.is_complimentary ||
    r.subscription_type === 'ADMIN_GRANTED' ||
    r.subscription_type === 'COMPLIMENTARY' ||
    r.subscription_type === 'VIP' ||
    r.mandate_status === 'admin_granted' ||
    r.mandate_status === 'complimentary' ||
    r.is_lifetime ||
    r.isLifetime
  );
  if (!isVip) return false;

  const exp = r.access_until || r.plan_expires_at || r.current_period_end;
  if (!exp) return true; // VIP with no explicit expiry is indefinite/lifetime

  const str = String(exp).trim().toLowerCase();
  if (str === 'lifetime' || str === 'never' || str === 'infinity' || str === 'indefinite') return true;

  const d = new Date(exp);
  if (isNaN(d.getTime())) return false;
  return d.getFullYear() > 2030;
}
