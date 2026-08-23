/**
 * TouchQR Canonical Business Profile Taxonomy Source of Truth (Frontend)
 * 
 * Provides UI metadata, labels, icons, descriptions, allowed values,
 * and profile resolution for the customer app, admin setup, and onboarding.
 */

export const BUSINESS_TYPES = Object.freeze([
  'restaurant',
  'cafe',
  'bakery_confectionery',
  'sweet_shop',
  'fast_food_qsr',
  'dhaba',
  'food_court',
  'cloud_kitchen',
  'canteen_cafeteria',
  'hotel_resort',
  'cinema_theatre',
  'lounge',
  'pub_bar',
  'club',
  'juice_beverage',
  'ice_cream_dessert',
  'food_truck',
  'catering',
  'institutional',
  'other'
]);

export const FOOD_TYPES = Object.freeze([
  'pure_veg',
  'veg_nonveg',
  'vegan',
  'eggitarian',
  'mixed',
  'not_applicable'
]);

export const SERVICE_MODELS = Object.freeze([
  'dine_in_table',
  'seat_service',
  'in_room_dining'
]);

export const BUSINESS_TYPE_METADATA = Object.freeze({
  restaurant: { label: 'Restaurant / Family Dine', icon: '🍽️', desc: 'Full-service dine-in restaurant with table ordering' },
  cafe: { label: 'Cafe / Coffee House', icon: '☕', desc: 'Coffee, beverages, and cafe snacks' },
  bakery_confectionery: { label: 'Bakery & Confectionery', icon: '🍰', desc: 'Cakes, pastries, breads, and confectionery' },
  sweet_shop: { label: 'Sweet Shop / Mithai', icon: '🍬', desc: 'Traditional sweets, mithai, and namkeen/farsan' },
  fast_food_qsr: { label: 'Fast Food / QSR', icon: '🍔', desc: 'Quick-service burgers, rolls, pizzas, and chaat' },
  dhaba: { label: 'Dhaba / Highway Eatery', icon: '🥘', desc: 'Authentic local cuisine and highway dining' },
  food_court: { label: 'Food Court / Multi-Vendor Hub', icon: '🏬', desc: 'Mall or collective multi-brand food court' },
  cloud_kitchen: { label: 'Cloud Kitchen / Takeaway', icon: '🏪', desc: 'Commercial kitchen with counter takeaway & parcel' },
  canteen_cafeteria: { label: 'Canteen / Cafeteria', icon: '🏢', desc: 'Corporate, office, or campus food facility' },
  hotel_resort: { label: 'Hotel & Resort Dining', icon: '🏨', desc: 'In-room guest dining and resort dining rooms' },
  cinema_theatre: { label: 'Cinema & Theatre Dining', icon: '🎬', desc: 'Multiplex seat food ordering and concessions' },
  lounge: { label: 'Lounge', icon: '🛋️', desc: 'Relaxed ambient lounge and mocktail bar' },
  pub_bar: { label: 'Pub & Bar', icon: '🍺', desc: 'Pub, craft beer, and bar bites' },
  club: { label: 'Club / Nightclub', icon: '🪩', desc: 'Nightclub, DJ lounge, and table bottle service' },
  juice_beverage: { label: 'Juice & Beverage Bar', icon: '🥤', desc: 'Fresh juices, smoothies, shakes, and mocktails' },
  ice_cream_dessert: { label: 'Ice Cream & Dessert Parlor', icon: '🍨', desc: 'Ice creams, waffles, sundaes, and desserts' },
  food_truck: { label: 'Food Truck / Kiosk', icon: '🚚', desc: 'Mobile food truck or outdoor pop-up kiosk' },
  catering: { label: 'Catering Service', icon: '👨‍🍳', desc: 'Event catering and banquet food service' },
  institutional: { label: 'Institutional Cafeteria', icon: '🏥', desc: 'Hospital, university, or school cafeteria' },
  other: { label: 'Other Hospitality Venue', icon: '🏪', desc: 'General venue or custom food & beverage concept' }
});

export const FOOD_TYPE_METADATA = Object.freeze({
  pure_veg: { label: '100% Pure Veg 🟢', icon: '🟢', desc: 'Strictly vegetarian menu (No meat, fish, or egg)' },
  veg_nonveg: { label: 'Veg & Non-Veg 🔴', icon: '🔴', desc: 'Serves both vegetarian and non-vegetarian dishes' },
  vegan: { label: '100% Vegan (Plant-Based) 🌱', icon: '🌱', desc: 'Strictly plant-based without dairy or animal products' },
  eggitarian: { label: 'Eggitarian (Veg + Egg) 🟡', icon: '🟡', desc: 'Vegetarian menu with egg options' },
  mixed: { label: 'Multi-Dietary Mixed 🍱', icon: '🍱', desc: 'Specialized dietary sections across all profiles' },
  not_applicable: { label: 'Not Applicable ⚪', icon: '⚪', desc: 'General retail or non-food venue' }
});

export const SERVICE_MODEL_METADATA = Object.freeze({
  dine_in_table: { label: '🍽️ Dine-In Table', icon: '🍽️', desc: 'Guests order from tables with waiter service' },
  seat_service: { label: '🎬 Seat Service', icon: '🎬', desc: 'Food served directly to numbered cinema or theatre seats' },
  in_room_dining: { label: '🏨 In-Room Dining', icon: '🏨', desc: 'Food served directly to hotel or resort guest rooms' }
});

export const BUSINESS_TYPE_ALIASES = Object.freeze({
  'bakery': 'bakery_confectionery',
  'sweets': 'sweet_shop',
  'sweet': 'sweet_shop',
  'fast_food': 'fast_food_qsr',
  'qsr': 'fast_food_qsr',
  'hotel': 'hotel_resort',
  'resort': 'hotel_resort',
  'cinema': 'cinema_theatre',
  'theater': 'cinema_theatre',
  'theatre': 'cinema_theatre',
  'pub': 'pub_bar',
  'bar': 'pub_bar',
  'canteen': 'canteen_cafeteria',
  'cafeteria': 'canteen_cafeteria',
  'ice_cream': 'ice_cream_dessert',
  'dessert': 'ice_cream_dessert',
  'juice': 'juice_beverage',
  'entertainment_venue': 'other',
  'entertainment': 'other'
});

export const FOOD_TYPE_ALIASES = Object.freeze({
  'veg': 'pure_veg',
  'vegetarian': 'pure_veg',
  'non_veg': 'veg_nonveg',
  'nonveg': 'veg_nonveg',
  'both': 'veg_nonveg',
  'egg': 'eggitarian',
  'na': 'not_applicable'
});

export const SERVICE_MODEL_ALIASES = Object.freeze({
  'table': 'dine_in_table',
  'dine_in': 'dine_in_table',
  'room': 'in_room_dining',
  'room_service': 'in_room_dining',
  'seat': 'seat_service',
  'seat_service': 'seat_service',
  'seat_delivery': 'seat_service'
});

export const BUSINESS_TYPE_DEFAULT_SERVICE_MODEL = Object.freeze({
  restaurant: 'dine_in_table',
  cafe: 'dine_in_table',
  bakery_confectionery: 'dine_in_table',
  sweet_shop: 'dine_in_table',
  fast_food_qsr: 'dine_in_table',
  dhaba: 'dine_in_table',
  food_court: 'dine_in_table',
  cloud_kitchen: 'dine_in_table',
  canteen_cafeteria: 'dine_in_table',
  hotel_resort: 'in_room_dining',
  cinema_theatre: 'seat_service',
  lounge: 'dine_in_table',
  pub_bar: 'dine_in_table',
  club: 'dine_in_table',
  juice_beverage: 'dine_in_table',
  ice_cream_dessert: 'dine_in_table',
  food_truck: 'dine_in_table',
  catering: 'dine_in_table',
  institutional: 'dine_in_table',
  other: 'dine_in_table'
});

export const BUSINESS_TYPE_ALLOWED_SERVICE_MODELS = Object.freeze({
  restaurant: Object.freeze(['dine_in_table']),
  cafe: Object.freeze(['dine_in_table']),
  bakery_confectionery: Object.freeze(['dine_in_table']),
  sweet_shop: Object.freeze(['dine_in_table']),
  fast_food_qsr: Object.freeze(['dine_in_table']),
  dhaba: Object.freeze(['dine_in_table']),
  food_court: Object.freeze(['dine_in_table']),
  cloud_kitchen: Object.freeze(['dine_in_table']),
  canteen_cafeteria: Object.freeze(['dine_in_table']),
  hotel_resort: Object.freeze(['in_room_dining']),
  cinema_theatre: Object.freeze(['seat_service']),
  lounge: Object.freeze(['dine_in_table']),
  pub_bar: Object.freeze(['dine_in_table']),
  club: Object.freeze(['dine_in_table']),
  juice_beverage: Object.freeze(['dine_in_table']),
  ice_cream_dessert: Object.freeze(['dine_in_table']),
  food_truck: Object.freeze(['dine_in_table']),
  catering: Object.freeze(['dine_in_table']),
  institutional: Object.freeze(['dine_in_table']),
  other: Object.freeze(['dine_in_table'])
});

export function isValidBusinessType(value) {
  if (!value || typeof value !== 'string') return false;
  return BUSINESS_TYPES.includes(value.trim().toLowerCase());
}

export function isValidFoodType(value) {
  if (!value || typeof value !== 'string') return false;
  return FOOD_TYPES.includes(value.trim().toLowerCase());
}

export function isValidServiceModel(value) {
  if (!value || typeof value !== 'string') return false;
  return SERVICE_MODELS.includes(value.trim().toLowerCase());
}

/**
 * Validates whether a service model is allowed for the given business type.
 * @param {string} businessType
 * @param {string} serviceModel
 * @returns {boolean}
 */
export function isServiceModelValidForBusinessType(businessType, serviceModel) {
  if (!businessType || !serviceModel) return false;
  const cleanBiz = String(businessType).trim().toLowerCase();
  const canonicalBiz = BUSINESS_TYPE_ALIASES[cleanBiz] || (isValidBusinessType(cleanBiz) ? cleanBiz : 'restaurant');
  const cleanService = String(serviceModel).trim().toLowerCase();
  const canonicalService = SERVICE_MODEL_ALIASES[cleanService] || cleanService;

  const allowed = BUSINESS_TYPE_ALLOWED_SERVICE_MODELS[canonicalBiz];
  if (!allowed) return false;
  return allowed.includes(canonicalService);
}

/**
 * Resolves the authoritative service model for a business type, preserving valid selections or defaulting safely.
 * @param {string} businessType
 * @param {string|null} [currentServiceModel=null]
 * @returns {string}
 */
export function resolveServiceModelForBusinessType(businessType, currentServiceModel = null) {
  const cleanBiz = businessType ? String(businessType).trim().toLowerCase() : 'restaurant';
  const canonicalBiz = BUSINESS_TYPE_ALIASES[cleanBiz] || (isValidBusinessType(cleanBiz) ? cleanBiz : 'restaurant');

  if (currentServiceModel) {
    const cleanService = String(currentServiceModel).trim().toLowerCase();
    const canonicalService = SERVICE_MODEL_ALIASES[cleanService] || cleanService;
    if (isServiceModelValidForBusinessType(canonicalBiz, canonicalService)) {
      return canonicalService;
    }
  }

  return BUSINESS_TYPE_DEFAULT_SERVICE_MODEL[canonicalBiz] || 'dine_in_table';
}

export function resolveBusinessProfile(restaurant = {}) {
  const rawBiz = restaurant.business_type ? String(restaurant.business_type).trim().toLowerCase() : '';
  const rawFood = restaurant.food_type ? String(restaurant.food_type).trim().toLowerCase() : '';
  const rawService = restaurant.service_model ? String(restaurant.service_model).trim().toLowerCase() : '';
  const legacyResto = (restaurant.resto_type ? String(restaurant.resto_type) : '').trim().toLowerCase();

  let business_type = null;
  let food_type = null;
  let service_model = null;

  if (rawBiz && isValidBusinessType(rawBiz)) {
    business_type = rawBiz;
  } else if (rawBiz && BUSINESS_TYPE_ALIASES[rawBiz]) {
    business_type = BUSINESS_TYPE_ALIASES[rawBiz];
  } else if (legacyResto === 'bakery') {
    business_type = 'bakery_confectionery';
  } else if (legacyResto === 'cafe') {
    business_type = 'cafe';
  } else if (legacyResto === 'fast_food') {
    business_type = 'fast_food_qsr';
  } else if (legacyResto === 'pure_veg' || legacyResto === 'veg_nonveg' || legacyResto === 'non_veg') {
    business_type = 'restaurant';
  } else {
    business_type = 'restaurant';
  }

  // Food Type is completely independent
  if (rawFood && isValidFoodType(rawFood)) {
    food_type = rawFood;
  } else if (rawFood && FOOD_TYPE_ALIASES[rawFood]) {
    food_type = FOOD_TYPE_ALIASES[rawFood];
  } else if (legacyResto === 'pure_veg') {
    food_type = 'pure_veg';
  } else if (legacyResto === 'veg_nonveg' || legacyResto === 'non_veg') {
    food_type = 'veg_nonveg';
  } else {
    food_type = null;
  }

  // Service Model is determined by Business Type dependency
  if (rawService && isServiceModelValidForBusinessType(business_type, rawService)) {
    service_model = SERVICE_MODEL_ALIASES[rawService] || rawService;
  } else if (rawService && SERVICE_MODEL_ALIASES[rawService] && isServiceModelValidForBusinessType(business_type, SERVICE_MODEL_ALIASES[rawService])) {
    service_model = SERVICE_MODEL_ALIASES[rawService];
  } else if (rawService) {
    service_model = resolveServiceModelForBusinessType(business_type, rawService);
  } else {
    service_model = resolveServiceModelForBusinessType(business_type);
  }

  const is_pure_veg = food_type === 'pure_veg' || food_type === 'vegan' || (food_type === null && legacyResto === 'pure_veg');

  return {
    business_type,
    food_type,
    service_model,
    legacy_resto_type: restaurant.resto_type || 'pure_veg',
    is_pure_veg
  };
}

export function resolveBannerBadge(restaurant = {}) {
  const profile = resolveBusinessProfile(restaurant);
  const { business_type, food_type, is_pure_veg } = profile;

  if (is_pure_veg) {
    if (business_type === 'bakery_confectionery') return '100% Pure Veg Bakery';
    if (business_type === 'sweet_shop') return '100% Pure Veg Sweets';
    if (business_type === 'cafe') return '100% Pure Veg Cafe';
    return '100% Pure Veg';
  }

  if (food_type === 'vegan') return '100% Vegan (Plant-Based)';
  if (food_type === 'eggitarian') return 'Egg & Vegetarian';
  if (food_type === 'veg_nonveg') return 'Veg & Non-Veg';

  if (business_type === 'bakery_confectionery') return 'Bakery & Confectionery';
  if (business_type === 'sweet_shop') return 'Sweets & Confectionery';
  if (business_type === 'cafe') return 'Cafe & Bakery';
  if (business_type === 'fast_food_qsr') return 'Fast Food & Snacks';
  if (business_type === 'cinema_theatre') return 'Cinema & Theatre Dining';
  if (business_type === 'hotel_resort') return 'Hotel & Resort Dining';

  return 'Veg & Non-Veg';
}

export default {
  BUSINESS_TYPES,
  FOOD_TYPES,
  SERVICE_MODELS,
  BUSINESS_TYPE_METADATA,
  FOOD_TYPE_METADATA,
  SERVICE_MODEL_METADATA,
  BUSINESS_TYPE_ALIASES,
  FOOD_TYPE_ALIASES,
  SERVICE_MODEL_ALIASES,
  BUSINESS_TYPE_DEFAULT_SERVICE_MODEL,
  BUSINESS_TYPE_ALLOWED_SERVICE_MODELS,
  isValidBusinessType,
  isValidFoodType,
  isValidServiceModel,
  isServiceModelValidForBusinessType,
  resolveServiceModelForBusinessType,
  resolveBusinessProfile,
  resolveBannerBadge
};
