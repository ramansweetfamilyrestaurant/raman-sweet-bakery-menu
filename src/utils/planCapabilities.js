/**
 * TouchQR Canonical Plan Capability & Feature State Resolver
 * 
 * Provides unified, data-driven capability resolution for the Tenant Admin Dashboard.
 * Resolves feature availability across plans and business types.
 */

export const FEATURE_STATES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  AVAILABLE_EMPTY: 'AVAILABLE_EMPTY',
  LOCKED: 'LOCKED',
  UNSUPPORTED: 'UNSUPPORTED',
  LOADING: 'LOADING',
  ERROR: 'ERROR'
});

export const FEATURE_METADATA = Object.freeze({
  direct_ordering_enabled: {
    name: 'Direct Table / Space QR Ordering',
    benefit: 'Allow customers to scan physical table/space QR codes and place orders directly from their smartphones into your live dashboard.',
    icon: '🧾',
    minTier: 'Enterprise'
  },
  whatsapp_ordering_enabled: {
    name: 'WhatsApp Direct Ordering',
    benefit: 'Customers can place food orders directly via structured WhatsApp chat messages.',
    icon: '💬',
    minTier: 'Pro'
  },
  kds_enabled: {
    name: 'Kitchen Display System (KDS)',
    benefit: 'Digital kitchen ticket display for chefs with PIN protection and live order prep tracking.',
    icon: '🍳',
    minTier: 'Pro'
  },
  bluetooth_kot_enabled: {
    name: 'Bluetooth Thermal KOT & Bill Printing',
    benefit: 'Print physical kitchen order tickets (KOT) and customer thermal receipts wirelessly via 58mm/80mm ESC/POS printers.',
    icon: '🖨️',
    minTier: 'Enterprise'
  },
  dual_printer_enabled: {
    name: 'Dual Printer Routing',
    benefit: 'Route kitchen tickets to kitchen thermal printer and final customer receipts to counter thermal printer automatically.',
    icon: '🖨️',
    minTier: 'VIP'
  },
  gst_invoice_enabled: {
    name: '5% GST Tax Billing',
    benefit: 'Enable 5% GST calculation and professional tax invoice generation on all customer orders.',
    icon: '🏛️',
    minTier: 'Basic'
  },
  analytics_export_enabled: {
    name: 'Analytics CSV Report Export',
    benefit: 'Download complete sales reports, order archives, and revenue telemetry in CSV spreadsheet format.',
    icon: '📊',
    minTier: 'Pro'
  },
  modifiers_enabled: {
    name: 'Dish Modifiers & Add-ons',
    benefit: 'Offer customizable dish toppings, crusts, portion sizes, and optional add-ons to increase average order value.',
    icon: '✨',
    minTier: 'Basic'
  },
  google_reviews_enabled: {
    name: 'Google Reviews Smart Redirect',
    benefit: 'Automatically direct satisfied diners to your Google Maps review page to boost search rankings.',
    icon: '⭐',
    minTier: 'Basic'
  },
  ai_review_enabled: {
    name: 'AI Smart Review Assistant',
    benefit: 'Generate AI-suggested review highlights and customer sentiment analytics automatically.',
    icon: '🤖',
    minTier: 'Basic'
  },
  watermark_removal_enabled: {
    name: 'White-Label Branding',
    benefit: 'Remove TouchQR footer branding and present a 100% white-labeled digital menu experience.',
    icon: '👑',
    minTier: 'Pro'
  },
  presence_verification_enabled: {
    name: 'GPS Geofence Presence Verification',
    benefit: 'Ensure diners are physically present on-premise before they can submit QR orders.',
    icon: '📍',
    minTier: 'Basic'
  }
});

/**
 * Resolves full tenant plan capabilities from live restaurantInfo.
 */
export function resolveTenantCapabilities(restaurantInfo = {}, settingsForm = {}, subscriptionStatus = {}) {
  const actualResto = restaurantInfo?.restaurant || restaurantInfo || {};
  const actualSub = restaurantInfo?.subscription || subscriptionStatus || {};
  const actualSettings = settingsForm || {};

  const rawTier = actualResto?.plan_tier || actualSub?.plan_tier || actualSettings?.plan_tier || '';
  const planTier = (rawTier || 'pro').toLowerCase();
  const perms = actualResto?.permissions || actualSub?.permissions || {};
  const rawPrice = actualResto?.plan_price !== undefined && actualResto?.plan_price !== null && actualResto?.plan_price !== ''
    ? actualResto.plan_price
    : (actualSub?.plan_price !== undefined && actualSub?.plan_price !== null && actualSub?.plan_price !== ''
        ? actualSub.plan_price
        : (actualSettings?.plan_price !== undefined && actualSettings?.plan_price !== null && actualSettings?.plan_price !== ''
            ? actualSettings.plan_price
            : null));

  const priceNum = rawPrice !== null ? Number(rawPrice) : null;
  const isZeroPrice = priceNum === 0 || priceNum === null || isNaN(priceNum);

  const hasLegacyVipAlias = (
    planTier === 'vip' || planTier === 'vip_ultra' || planTier === 'vip_ultra_plan'
  ) && isZeroPrice;

  const isComplimentary = Boolean(
    actualResto?.subscription_type === 'ADMIN_GRANTED' ||
    actualResto?.mandate_status === 'admin_granted' ||
    actualSub?.subscription_type === 'ADMIN_GRANTED' ||
    actualSub?.mandate_status === 'admin_granted' ||
    actualSettings?.subscription_type === 'ADMIN_GRANTED' ||
    actualResto?.is_complimentary === true ||
    actualResto?.is_complimentary === 1 ||
    actualResto?.is_complimentary === '1' ||
    actualSub?.is_complimentary === true ||
    actualSub?.is_complimentary === 1 ||
    actualSub?.is_complimentary === '1' ||
    actualResto?.is_vip === 1 ||
    actualResto?.is_vip === true ||
    actualResto?.is_vip === '1' ||
    actualSub?.is_vip === true ||
    actualSub?.is_vip === 1 ||
    actualSub?.is_vip === '1' ||
    hasLegacyVipAlias
  );

  const isBoolTrue = (val, fallback = false) => {
    if (val === undefined || val === null) return fallback;
    return val === 1 || val === true || val === '1' || val === 'true';
  };

  const getNum = (val, fallback = 9999) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  const formatTierLabel = (tier) => {
    if (!tier) return 'Pro Plan';
    return `${tier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Plan`;
  };

  const defaultPlanName = isComplimentary
    ? 'Enterprise VIP Access'
    : (rawTier ? formatTierLabel(rawTier) : 'Pro Plan');

  const planPrice = isComplimentary ? 0 : (rawPrice !== null ? getNum(rawPrice, 999) : 999);
  const rawSubStatus = actualSub?.status || actualResto?.subscription_status || 'active';
  const subStatus = isComplimentary ? 'active' : rawSubStatus;

  return {
    plan_tier: planTier,
    plan_name: isComplimentary ? 'Enterprise VIP Access' : (actualResto?.plan_name || actualSub?.plan_name || defaultPlanName),
    plan_price: planPrice,
    subscription_status: subStatus,
    is_complimentary: isComplimentary,
    is_vip: isComplimentary || hasLegacyVipAlias,
    business_type: actualResto?.business_type || 'restaurant',
    service_model: actualResto?.service_model || 'dine_in',

    // Features
    direct_ordering_enabled: isBoolTrue(actualResto?.direct_ordering_enabled ?? perms?.direct_ordering_enabled, true),
    whatsapp_ordering_enabled: isBoolTrue(actualResto?.whatsapp_ordering_enabled ?? perms?.whatsapp_ordering_enabled, true),
    kds_enabled: isBoolTrue(actualResto?.kds_enabled ?? perms?.kds_enabled, true),
    bluetooth_kot_enabled: isBoolTrue(actualResto?.bluetooth_kot_enabled ?? perms?.bluetooth_kot_enabled, false),
    dual_printer_enabled: isBoolTrue(actualResto?.dual_printer_enabled ?? perms?.dual_printer_enabled, isComplimentary || planTier === 'vip' || planTier === 'vip_ultra' || planTier === 'vip_ultra_plan'),
    gst_invoice_enabled: isBoolTrue(actualResto?.gst_invoice_enabled ?? perms?.gst_invoice_enabled, true),
    analytics_export_enabled: isBoolTrue(actualResto?.analytics_export_enabled ?? perms?.analytics_export_enabled, true),
    modifiers_enabled: isBoolTrue(actualResto?.modifiers_enabled ?? perms?.modifiers_enabled, true),
    google_reviews_enabled: isBoolTrue(actualResto?.google_reviews_enabled ?? perms?.google_reviews_enabled, true),
    ai_review_enabled: isBoolTrue(actualResto?.ai_review_enabled ?? perms?.ai_review_enabled, true),
    watermark_removal_enabled: isBoolTrue(actualResto?.watermark_removal_enabled ?? perms?.watermark_removal_enabled, true),
    presence_verification_enabled: isBoolTrue(actualResto?.presence_verification_enabled ?? perms?.presence_verification_enabled, true),
    allowed_themes: isComplimentary ? 'ALL' : (actualResto?.allowed_themes || perms?.allowed_themes || 'ALL'),

    // Quotas
    max_dishes: isComplimentary ? 9999 : getNum(actualResto?.max_dishes ?? perms?.max_dishes, 9999),
    max_categories: isComplimentary ? 9999 : getNum(actualResto?.max_categories ?? perms?.max_categories, 9999),
    max_combos: isComplimentary ? 9999 : getNum(actualResto?.max_combos ?? perms?.max_combos, 9999),
    max_tables: isComplimentary ? 9999 : getNum(actualResto?.max_tables ?? perms?.max_tables, 9999),
    order_retention_days: getNum(actualResto?.order_retention_days ?? perms?.order_retention_days, 365)
  };
}

/**
 * Determines feature state (AVAILABLE, LOCKED, UNSUPPORTED, etc.)
 */
export function getFeatureState(featureKey, capabilities = {}, businessType = 'restaurant', serviceModel = null) {
  const isHotel = serviceModel === 'hotel' || businessType === 'hotel_resort';
  const isCinema = serviceModel === 'cinema' || businessType === 'cinema_theatre';
  const isBakeryOrSweet = businessType === 'bakery_confectionery' || businessType === 'sweet_shop';
  const isCatering = businessType === 'catering';

  if (featureKey === 'cinema_management' || featureKey === 'cinema_ordering_enabled') {
    if (!isCinema) {
      return FEATURE_STATES.UNSUPPORTED;
    }
  }

  if (featureKey === 'room_ordering_enabled') {
    if (!isHotel) {
      return FEATURE_STATES.UNSUPPORTED;
    }
  }

  if (featureKey === 'kds_enabled') {
    if (isCinema || isCatering || isBakeryOrSweet) {
      return FEATURE_STATES.UNSUPPORTED;
    }
  }

  if (featureKey === 'bluetooth_kot_enabled' || featureKey === 'dual_printer_enabled') {
    if (isCinema || isCatering) {
      return FEATURE_STATES.UNSUPPORTED;
    }
  }

  const isEnabled = Boolean(capabilities[featureKey]);
  return isEnabled ? FEATURE_STATES.AVAILABLE : FEATURE_STATES.LOCKED;
}

/**
 * Format quota displays (e.g. "42 / 9999" -> "42 / Unlimited" or "2 / 3")
 */
export function formatQuota(count = 0, limit = 9999) {
  const isUnlimited = limit >= 9999;
  return {
    count,
    limit,
    isUnlimited,
    display: `${count} / ${isUnlimited ? 'Unlimited' : limit}`,
    isNearLimit: !isUnlimited && count >= Math.floor(limit * 0.8) && count < limit,
    isAtLimit: !isUnlimited && count >= limit
  };
}
