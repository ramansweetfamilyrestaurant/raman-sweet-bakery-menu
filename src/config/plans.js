// Centralized Enterprise SaaS Plans & Pricing Control Matrix
export const SAAS_PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic Starter Plan',
    price: 499,
    badge: '⚡ BASIC',
    description: 'Digital Menu Viewing & Luxury Theme Engine',
    features: {
      whatsapp_enabled: false,
      direct_ordering_enabled: false,
      google_reviews_enabled: false
    }
  },
  pro: {
    id: 'pro',
    name: 'Pro Luxury Plan',
    price: 999,
    badge: '👑 PRO',
    description: 'Digital Menu + WhatsApp Ordering + Google Reviews',
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: false,
      google_reviews_enabled: true
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise VIP Plan',
    price: 1999,
    badge: '🚀 ENTERPRISE',
    description: 'All Features + Direct Table QR KOT Ordering & Kitchen System',
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true
    }
  }
};

export function getPlanDetails(tierKey) {
  const key = (tierKey || 'pro').toLowerCase();
  return SAAS_PLANS[key] || SAAS_PLANS.pro;
}
