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
export function resolveTenantCapabilities(restaurantInfo = {}, settingsForm = {}) {
  const planTier = (restaurantInfo?.plan_tier || settingsForm?.plan_tier || 'pro').toLowerCase();
  const perms = restaurantInfo?.permissions || {};

  const isBoolTrue = (val, fallback = false) => {
    if (val === undefined || val === null) return fallback;
    return val === 1 || val === true || val === '1' || val === 'true';
  };

  const getNum = (val, fallback = 9999) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  return {
    plan_tier: planTier,
    plan_name: restaurantInfo?.plan_name || `${planTier.toUpperCase()} Plan`,
    plan_price: getNum(restaurantInfo?.plan_price, 999),
    subscription_status: restaurantInfo?.subscription_status || 'active',
    business_type: restaurantInfo?.business_type || 'restaurant',
    service_model: restaurantInfo?.service_model || 'dine_in',

    // Features
    direct_ordering_enabled: isBoolTrue(restaurantInfo?.direct_ordering_enabled ?? perms?.direct_ordering_enabled, true),
    whatsapp_ordering_enabled: isBoolTrue(restaurantInfo?.whatsapp_ordering_enabled ?? perms?.whatsapp_ordering_enabled, true),
    kds_enabled: isBoolTrue(restaurantInfo?.kds_enabled ?? perms?.kds_enabled, true),
    bluetooth_kot_enabled: isBoolTrue(restaurantInfo?.bluetooth_kot_enabled ?? perms?.bluetooth_kot_enabled, false),
    dual_printer_enabled: isBoolTrue(restaurantInfo?.dual_printer_enabled ?? perms?.dual_printer_enabled, false),
    gst_invoice_enabled: isBoolTrue(restaurantInfo?.gst_invoice_enabled ?? perms?.gst_invoice_enabled, true),
    analytics_export_enabled: isBoolTrue(restaurantInfo?.analytics_export_enabled ?? perms?.analytics_export_enabled, true),
    modifiers_enabled: isBoolTrue(restaurantInfo?.modifiers_enabled ?? perms?.modifiers_enabled, true),
    google_reviews_enabled: isBoolTrue(restaurantInfo?.google_reviews_enabled ?? perms?.google_reviews_enabled, true),
    ai_review_enabled: isBoolTrue(restaurantInfo?.ai_review_enabled ?? perms?.ai_review_enabled, true),
    watermark_removal_enabled: isBoolTrue(restaurantInfo?.watermark_removal_enabled ?? perms?.watermark_removal_enabled, true),
    presence_verification_enabled: isBoolTrue(restaurantInfo?.presence_verification_enabled ?? perms?.presence_verification_enabled, true),
    allowed_themes: restaurantInfo?.allowed_themes || 'ALL',

    // Quotas
    max_dishes: getNum(restaurantInfo?.max_dishes, 9999),
    max_categories: getNum(restaurantInfo?.max_categories, 9999),
    max_combos: getNum(restaurantInfo?.max_combos, 9999),
    max_tables: getNum(restaurantInfo?.max_tables, 9999),
    order_retention_days: getNum(restaurantInfo?.order_retention_days, 365)
  };
}

/**
 * Determines feature state (AVAILABLE, LOCKED, UNSUPPORTED, etc.)
 */
export function getFeatureState(featureKey, capabilities = {}, businessType = 'restaurant') {
  // Business type constraints
  if (featureKey === 'cinema_management') {
    if (businessType !== 'cinema_theatre') {
      return FEATURE_STATES.UNSUPPORTED;
    }
    return FEATURE_STATES.AVAILABLE;
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
