// Centralized Enterprise SaaS Plans & Pricing Control Matrix
export const SAAS_PLANS = {
  // 🍽️ Standard Restaurant / Cafe Plans
  basic: {
    id: 'basic',
    key: 'basic',
    name: 'Basic Starter Plan',
    price: 499,
    original_price: 999,
    badge: '⚡ BASIC',
    description: 'Digital Menu Viewing & Luxury Theme Engine',
    industry: 'restaurant',
    max_combos: 3,
    max_tables: 20,
    features: {
      whatsapp_enabled: false,
      direct_ordering_enabled: false,
      google_reviews_enabled: false,
      kds_enabled: false,
      bluetooth_kot_enabled: false,
      dual_printer_enabled: false
    }
  },
  pro: {
    id: 'pro',
    key: 'pro',
    name: 'Pro Luxury Plan',
    price: 999,
    original_price: 1999,
    badge: '👑 PRO',
    description: 'Digital Menu + WhatsApp Ordering + Google Reviews',
    industry: 'restaurant',
    max_combos: 10,
    max_tables: 100,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: false,
      google_reviews_enabled: true,
      kds_enabled: true,
      bluetooth_kot_enabled: true,
      dual_printer_enabled: false
    }
  },
  enterprise: {
    id: 'enterprise',
    key: 'enterprise',
    name: 'Enterprise VIP Plan',
    price: 1999,
    original_price: 3999,
    badge: '🚀 ENTERPRISE',
    description: 'All Features + Direct Table QR KOT Ordering & Kitchen System',
    industry: 'restaurant',
    max_combos: 9999,
    max_tables: 9999,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true,
      kds_enabled: true,
      bluetooth_kot_enabled: true,
      dual_printer_enabled: true
    }
  },

  // 🏨 Hotel & Resort In-Room Dining Plans
  hotel_basic: {
    id: 'hotel_basic',
    key: 'hotel_basic',
    name: 'Hotel Basic (Room Directory)',
    price: 999,
    original_price: 1999,
    badge: '🏨 BASIC',
    description: 'In-Room Digital Menu Viewing & Hotel Amenities Directory',
    industry: 'hotel',
    max_combos: 5,
    max_rooms: 20,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: false,
      google_reviews_enabled: true,
      amenities_booking_enabled: true,
      kds_enabled: false,
      bluetooth_kot_enabled: false,
      dual_printer_enabled: false
    }
  },
  hotel_pro: {
    id: 'hotel_pro',
    key: 'hotel_pro',
    name: 'Hotel Pro (In-Room QR Dining)',
    price: 1999,
    original_price: 3499,
    badge: '👑 PRO',
    description: 'In-Room QR Ordering + Room Service Pantry Dispatch',
    industry: 'hotel',
    max_combos: 20,
    max_rooms: 60,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true,
      amenities_booking_enabled: true,
      kds_enabled: true,
      bluetooth_kot_enabled: true,
      dual_printer_enabled: false
    }
  },
  hotel_enterprise: {
    id: 'hotel_enterprise',
    key: 'hotel_enterprise',
    name: 'Hotel Enterprise (Resort & Dining)',
    price: 3499,
    original_price: 5999,
    badge: '🚀 ENTERPRISE',
    description: 'Unlimited Rooms + In-House Restaurant Dining + Butler Service',
    industry: 'hotel',
    max_combos: 9999,
    max_rooms: 9999,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true,
      amenities_booking_enabled: true,
      kds_enabled: true,
      bluetooth_kot_enabled: true,
      dual_printer_enabled: true
    }
  },

  // 🎬 Cinema & Multiplex In-Seat Ordering Plans
  cinema_basic: {
    id: 'cinema_basic',
    key: 'cinema_basic',
    name: 'Cinema Basic (Digital Canteen)',
    price: 1499,
    original_price: 2499,
    badge: '🎬 BASIC',
    description: 'Digital Concessions Menu Board & QR Viewing',
    industry: 'cinema',
    max_combos: 5,
    max_screens: 1,
    max_seats: 200,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: false,
      google_reviews_enabled: true,
      seat_runner_dispatch_enabled: true,
      interval_rush_mode_enabled: true,
      kds_enabled: false,
      bluetooth_kot_enabled: false,
      dual_printer_enabled: false
    }
  },
  cinema_pro: {
    id: 'cinema_pro',
    key: 'cinema_pro',
    name: 'Cinema Pro (In-Seat Ordering)',
    price: 2999,
    original_price: 4999,
    badge: '👑 PRO',
    description: 'In-Seat QR Ordering + Concessions Runner Dispatch',
    industry: 'cinema',
    max_combos: 20,
    max_screens: 3,
    max_seats: 800,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true,
      seat_runner_dispatch_enabled: true,
      interval_rush_mode_enabled: true,
      kds_enabled: true,
      bluetooth_kot_enabled: true,
      dual_printer_enabled: false
    }
  },
  cinema_enterprise: {
    id: 'cinema_enterprise',
    key: 'cinema_enterprise',
    name: 'Cinema Enterprise (Multiplex)',
    price: 4999,
    original_price: 7999,
    badge: '🚀 ENTERPRISE',
    description: 'Unlimited Screens & Multiplex Scale Concessions Delivery',
    industry: 'cinema',
    max_combos: 9999,
    max_screens: 9999,
    max_seats: 9999,
    features: {
      whatsapp_enabled: true,
      direct_ordering_enabled: true,
      google_reviews_enabled: true,
      seat_runner_dispatch_enabled: true,
      interval_rush_mode_enabled: true,
      kds_enabled: true,
      bluetooth_kot_enabled: true,
      dual_printer_enabled: true
    }
  }
};

export function getPlanDetails(tierKey) {
  const key = (tierKey || 'pro').toLowerCase();
  return SAAS_PLANS[key] || SAAS_PLANS.pro;
}

export function getPlansForIndustry(industry = 'restaurant') {
  const norm = (industry || 'restaurant').toLowerCase();
  const targetIndustry = (norm === 'hotel' || norm === 'hotel_resort') 
    ? 'hotel' 
    : (norm === 'cinema' || norm === 'cinema_theatre') 
      ? 'cinema' 
      : 'restaurant';
  
  return Object.values(SAAS_PLANS).filter(p => p.industry === targetIndustry);
}
