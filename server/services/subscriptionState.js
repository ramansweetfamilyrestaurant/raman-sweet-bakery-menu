import { resolveBusinessProfile, getAvailableSpaceTypesForBusiness } from '../config/businessTaxonomy.js';

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
  ADMIN_GRANTED: 'admin_granted',
  SUSPENDED: 'suspended'
});

/**
 * Authoritatively determines if a restaurant tenant has complimentary VIP / Admin-granted access.
 * Derives strictly from trusted database records (restaurants table, subscriptions table).
 * Handles both canonical and legacy historical records safely.
 *
 * @param {Object} resto - Restaurant record from DB
 * @param {Object|null} [sub] - Optional subscription record from DB
 * @returns {boolean}
 */
export function isAuthoritativeComplimentaryTenant(resto, sub = null) {
  if (!resto) return false;

  const subType = String(resto.subscription_type || '').toUpperCase().trim();
  const mandate = String(resto.mandate_status || '').toLowerCase().trim();
  const planTier = String(resto.plan_tier || '').toLowerCase().trim();
  const subRecType = sub ? String(sub.subscription_type || '').toUpperCase().trim() : '';
  const subGateway = sub ? String(sub.gateway || '').toLowerCase().trim() : '';

  // Canonical admin-granted markers in restaurants table
  if (subType === 'ADMIN_GRANTED' || subType === 'COMPLIMENTARY' || subType === 'VIP') {
    return true;
  }
  if (mandate === 'admin_granted' || mandate === 'complimentary') {
    return true;
  }

  // Canonical admin-granted markers in subscriptions table
  if (subRecType === 'ADMIN_GRANTED' || subGateway === 'admin_granted') {
    return true;
  }

  // Legacy edge-case: plan_tier was set to vip/vip_ultra/vip_ultra_plan with ₹0 price and not on an active paid mandate
  if ((planTier === 'vip' || planTier === 'vip_ultra' || planTier === 'vip_ultra_plan') && Number(resto.plan_price || 0) === 0 && mandate !== 'active') {
    return true;
  }

  return false;
}

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

  // Explicit Super Admin Suspension check:
  // An explicitly suspended tenant (restaurants.active false/0) must NEVER be shown as active
  // merely because the payment gateway subscription still says active or tenant has VIP access.
  const isSuspended = resto.active === false || resto.active === 0 || resto.active === '0' || resto.active === 'false';
  if (isSuspended) {
    const isComplimentary = isAuthoritativeComplimentaryTenant(resto, sub);
    return {
      status: SUBSCRIPTION_STATES.SUSPENDED,
      active: false,
      isComplimentary,
      inGracePeriod: false,
      accessUntil: resto.plan_expires_at || (sub?.current_period_end || null),
      badge: { label: 'Account Suspended', color: '#EF4444', icon: '⚫' }
    };
  }

  // 1. Super Admin 100% Complimentary Lifetime Access
  if (isAuthoritativeComplimentaryTenant(resto, sub)) {
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

/**
 * Resolves authoritative SaaS entitlements and quotas for a tenant.
 * Guarantees that complimentary VIP tenants receive Enterprise VIP capabilities and unlimited quotas (9999).
 *
 * @param {Object} params
 * @param {Object} params.resto - Restaurant record
 * @param {Object|null} [params.sub] - Optional subscription record
 * @param {Object|null} [params.saasPlan] - Optional SaaS plan record
 * @returns {{
 *   isComplimentary: boolean,
 *   quotas: {
 *     max_dishes: number,
 *     max_categories: number,
 *     max_combos: number,
 *     max_tables: number,
 *     max_staff_accounts: number,
 *     order_retention_days: number
 *   },
 *   capabilities: {
 *     direct_ordering_enabled: boolean,
 *     whatsapp_ordering_enabled: boolean,
 *     kds_enabled: boolean,
 *     bluetooth_kot_enabled: boolean,
 *     dual_printer_enabled: boolean,
 *     gst_invoice_enabled: boolean,
 *     analytics_export_enabled: boolean,
 *     modifiers_enabled: boolean,
 *     google_reviews_enabled: boolean,
 *     ai_review_enabled: boolean,
 *     watermark_removal_enabled: boolean,
 *     custom_domain_enabled: boolean,
 *     staff_roles_enabled: boolean,
 *     allowed_themes: string
 *   }
 * }}
 */
export function resolveAuthoritativeEntitlements({ resto, sub = null, saasPlan = null }) {
  const isComplimentary = isAuthoritativeComplimentaryTenant(resto, sub);
  const tierKey = (resto?.plan_tier || 'pro').toLowerCase().trim();
  const plan = saasPlan || {};

  const profile = resolveBusinessProfile(resto || {});
  const businessType = profile.business_type || 'restaurant';
  const serviceModel = profile.service_model || 'dine_in';
  const isHotel = serviceModel === 'hotel' || businessType === 'hotel_resort';
  const isCinema = serviceModel === 'cinema' || businessType === 'cinema_theatre';
  const isBakeryOrSweet = businessType === 'bakery_confectionery' || businessType === 'sweet_shop';
  const isCatering = businessType === 'catering';

  const isValTrue = (val, def = true) => (val !== undefined && val !== null ? (val === 1 || val === true || val === '1' || val === 'true') : def);

  const maxDishes = isComplimentary ? 9999 : (plan.max_dishes !== undefined && plan.max_dishes !== null ? Number(plan.max_dishes) : (plan.dish_limit ? Number(plan.dish_limit) : 500));
  const maxCategories = isComplimentary ? 9999 : (plan.max_categories !== undefined && plan.max_categories !== null ? Number(plan.max_categories) : (plan.category_limit ? Number(plan.category_limit) : 50));
  const maxCombos = isComplimentary ? 9999 : (plan.max_combos !== undefined && plan.max_combos !== null ? Number(plan.max_combos) : (tierKey === 'basic' ? 3 : tierKey === 'pro' ? 10 : 9999));
  const maxTables = isComplimentary ? 9999 : (plan.max_tables !== undefined && plan.max_tables !== null ? Number(plan.max_tables) : (plan.table_limit ? Number(plan.table_limit) : 100));
  const maxRooms = isHotel ? (isComplimentary ? 9999 : (plan.max_rooms !== undefined && plan.max_rooms !== null ? Number(plan.max_rooms) : (plan.room_limit ? Number(plan.room_limit) : (plan.table_limit ? Number(plan.table_limit) : 100)))) : null;
  const maxSeats = isCinema ? (isComplimentary ? 9999 : (plan.max_seats !== undefined && plan.max_seats !== null ? Number(plan.max_seats) : (plan.seat_limit ? Number(plan.seat_limit) : (plan.table_limit ? Number(plan.table_limit) : 500)))) : null;
  const maxStaff = isComplimentary ? 9999 : (plan.max_staff_accounts !== undefined && plan.max_staff_accounts !== null ? Number(plan.max_staff_accounts) : 9999);
  const retentionDays = isComplimentary ? 365 : (plan.order_retention_days !== undefined && plan.order_retention_days !== null ? Number(plan.order_retention_days) : 365);

  const quotas = {
    dishes: maxDishes,
    categories: maxCategories,
    combos: maxCombos,
    tables: maxTables,
    rooms: maxRooms,
    seats: maxSeats,
    staff_accounts: maxStaff,
    max_dishes: maxDishes,
    max_categories: maxCategories,
    max_combos: maxCombos,
    max_tables: maxTables,
    max_rooms: maxRooms,
    max_seats: maxSeats,
    max_staff_accounts: maxStaff,
    order_retention_days: retentionDays
  };

  // Industry applicability
  const isKdsApplicable = !isCinema && !isCatering && !isBakeryOrSweet;
  const isKotApplicable = !isCinema && !isCatering;

  const capabilities = {
    direct_ordering_enabled: isComplimentary ? true : isValTrue(plan.direct_ordering_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan'),
    whatsapp_ordering_enabled: isComplimentary ? true : isValTrue(plan.whatsapp_ordering_enabled ?? plan.whatsapp_enabled, tierKey !== 'basic'),
    kds_enabled: isKdsApplicable ? (isComplimentary ? true : isValTrue(plan.kds_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan')) : false,
    bluetooth_kot_enabled: isKotApplicable ? (isComplimentary ? true : isValTrue(plan.bluetooth_kot_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan')) : false,
    dual_printer_enabled: isKotApplicable ? (isComplimentary ? true : isValTrue(plan.dual_printer_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan')) : false,
    cinema_ordering_enabled: isCinema ? (isComplimentary ? true : isValTrue(plan.cinema_ordering_enabled ?? plan.direct_ordering_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan')) : false,
    room_ordering_enabled: isHotel ? (isComplimentary ? true : isValTrue(plan.room_ordering_enabled ?? plan.direct_ordering_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan')) : false,
    gst_invoice_enabled: isValTrue(plan.gst_invoice_enabled, true),
    analytics_export_enabled: isValTrue(plan.analytics_export_enabled, true),
    modifiers_enabled: isValTrue(plan.modifiers_enabled, true),
    google_reviews_enabled: isComplimentary ? true : isValTrue(plan.google_reviews_enabled, tierKey !== 'basic'),
    ai_review_enabled: isValTrue(plan.ai_review_enabled, true),
    watermark_removal_enabled: isValTrue(plan.watermark_removal_enabled, true),
    custom_domain_enabled: isComplimentary ? true : isValTrue(plan.custom_domain_enabled, true),
    staff_roles_enabled: isValTrue(plan.staff_roles_enabled, true),
    allowed_themes: isComplimentary ? 'ALL' : (plan.allowed_themes || (tierKey === 'basic' ? 'gold' : tierKey === 'pro' ? 'gold,emerald,crimson,navy' : 'ALL'))
  };

  const feature_matrix = {
    direct_ordering_enabled: {
      label: isHotel ? 'In-Room QR Dining' : isCinema ? 'Cinema Seat QR Ordering' : 'Direct Table / Space Ordering',
      enabled: capabilities.direct_ordering_enabled,
      applicable: true,
      status: capabilities.direct_ordering_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    whatsapp_ordering_enabled: {
      label: 'WhatsApp Direct Ordering',
      enabled: capabilities.whatsapp_ordering_enabled,
      applicable: true,
      status: capabilities.whatsapp_ordering_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    kds_enabled: {
      label: 'Kitchen Display System (KDS)',
      enabled: capabilities.kds_enabled,
      applicable: isKdsApplicable,
      status: isKdsApplicable ? (capabilities.kds_enabled ? 'AVAILABLE' : 'LOCKED') : 'UNSUPPORTED',
      inapplicable_reason: isCinema ? 'Not applicable for cinema concessions' : isBakeryOrSweet ? 'Retail counter service (No live cookline)' : 'Not applicable for catering'
    },
    bluetooth_kot_enabled: {
      label: 'Bluetooth KOT & Thermal Printing',
      enabled: capabilities.bluetooth_kot_enabled,
      applicable: isKotApplicable,
      status: isKotApplicable ? (capabilities.bluetooth_kot_enabled ? 'AVAILABLE' : 'LOCKED') : 'UNSUPPORTED',
      inapplicable_reason: isCinema ? 'Not applicable for cinema multiplex' : 'Not applicable for catering'
    },
    dual_printer_enabled: {
      label: 'Dual Kitchen & Counter Routing',
      enabled: capabilities.dual_printer_enabled,
      applicable: isKotApplicable,
      status: isKotApplicable ? (capabilities.dual_printer_enabled ? 'AVAILABLE' : 'LOCKED') : 'UNSUPPORTED',
      inapplicable_reason: isCinema ? 'Not applicable for cinema multiplex' : 'Not applicable for catering'
    },
    cinema_ordering_enabled: {
      label: 'Multiplex Seat QR Ordering',
      enabled: capabilities.cinema_ordering_enabled,
      applicable: isCinema,
      status: isCinema ? (capabilities.cinema_ordering_enabled ? 'AVAILABLE' : 'LOCKED') : 'UNSUPPORTED',
      inapplicable_reason: 'Applicable to Cinema & Multiplex only'
    },
    room_ordering_enabled: {
      label: 'Hotel Guest In-Room Dining',
      enabled: capabilities.room_ordering_enabled,
      applicable: isHotel,
      status: isHotel ? (capabilities.room_ordering_enabled ? 'AVAILABLE' : 'LOCKED') : 'UNSUPPORTED',
      inapplicable_reason: 'Applicable to Hotel & Resort only'
    },
    gst_invoice_enabled: {
      label: '5% GST Tax Invoicing',
      enabled: capabilities.gst_invoice_enabled,
      applicable: true,
      status: capabilities.gst_invoice_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    analytics_export_enabled: {
      label: 'Analytics CSV Export',
      enabled: capabilities.analytics_export_enabled,
      applicable: true,
      status: capabilities.analytics_export_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    modifiers_enabled: {
      label: 'Item Modifiers & Variations',
      enabled: capabilities.modifiers_enabled,
      applicable: true,
      status: capabilities.modifiers_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    google_reviews_enabled: {
      label: 'Google Reviews Redirect',
      enabled: capabilities.google_reviews_enabled,
      applicable: true,
      status: capabilities.google_reviews_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    ai_review_enabled: {
      label: 'AI Smart Review Assistant',
      enabled: capabilities.ai_review_enabled,
      applicable: true,
      status: capabilities.ai_review_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    watermark_removal_enabled: {
      label: 'White-Label Branding',
      enabled: capabilities.watermark_removal_enabled,
      applicable: true,
      status: capabilities.watermark_removal_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    custom_domain_enabled: {
      label: 'Custom Web Domain',
      enabled: capabilities.custom_domain_enabled,
      applicable: true,
      status: capabilities.custom_domain_enabled ? 'AVAILABLE' : 'LOCKED'
    },
    staff_roles_enabled: {
      label: 'Staff Account Roles',
      enabled: capabilities.staff_roles_enabled,
      applicable: true,
      status: capabilities.staff_roles_enabled ? 'AVAILABLE' : 'LOCKED'
    }
  };

  const effectivePlanTier = isComplimentary ? 'enterprise' : tierKey;
  const effectivePlanName = isComplimentary
    ? 'Enterprise VIP Access'
    : (plan.name || (resto?.plan_name ? resto.plan_name : `${tierKey.toUpperCase()} Plan`));
  const rawPrice = (resto?.plan_price !== undefined && resto?.plan_price !== null && resto?.plan_price !== '')
    ? Number(resto.plan_price)
    : (sub && sub.amount !== undefined && sub.amount !== null && sub.amount !== ''
        ? Number(sub.amount)
        : (plan.price !== undefined && plan.price !== null ? Number(plan.price) : 999));
  const effectivePlanPrice = isComplimentary ? 0 : (isNaN(rawPrice) ? 999 : rawPrice);

  return {
    isComplimentary,
    is_vip: isComplimentary,
    plan_tier: effectivePlanTier,
    plan_name: effectivePlanName,
    plan_price: effectivePlanPrice,
    business_type: businessType,
    service_model: serviceModel,
    quotas,
    capabilities,
    feature_matrix
  };
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
    : isAuthoritativeComplimentaryTenant(tenant);

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
