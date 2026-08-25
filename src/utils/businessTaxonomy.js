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
  'dine_in',
  'hotel',
  'cinema'
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
  dine_in: { label: '🍽️ Dine-In', icon: '🍽️', emoji: '🍽️', desc: 'Restaurant table QR and dine-in ordering' },
  hotel: { label: '🏨 Hotel', icon: '🏨', emoji: '🏨', desc: 'Hotel dining and guest room service' },
  cinema: { label: '🎬 Cinema', icon: '🎬', emoji: '🎬', desc: 'Cinema snacks and seat-based ordering' }
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
  'table': 'dine_in',
  'dine_in': 'dine_in',
  'dine_in_table': 'dine_in',
  'room': 'hotel',
  'room_service': 'hotel',
  'in_room_dining': 'hotel',
  'hotel': 'hotel',
  'seat': 'cinema',
  'seat_service': 'cinema',
  'seat_delivery': 'cinema',
  'cinema': 'cinema'
});

export const BUSINESS_TYPE_DEFAULT_SERVICE_MODEL = Object.freeze({
  restaurant: 'dine_in',
  cafe: 'dine_in',
  bakery_confectionery: 'dine_in',
  sweet_shop: 'dine_in',
  fast_food_qsr: 'dine_in',
  dhaba: 'dine_in',
  food_court: 'dine_in',
  cloud_kitchen: 'dine_in',
  canteen_cafeteria: 'dine_in',
  hotel_resort: 'hotel',
  cinema_theatre: 'cinema',
  lounge: 'dine_in',
  pub_bar: 'dine_in',
  club: 'dine_in',
  juice_beverage: 'dine_in',
  ice_cream_dessert: 'dine_in',
  food_truck: 'dine_in',
  catering: 'dine_in',
  institutional: 'dine_in',
  other: 'dine_in'
});

export const BUSINESS_TYPE_ALLOWED_SERVICE_MODELS = Object.freeze({
  restaurant: Object.freeze(['dine_in']),
  cafe: Object.freeze(['dine_in']),
  bakery_confectionery: Object.freeze(['dine_in']),
  sweet_shop: Object.freeze(['dine_in']),
  fast_food_qsr: Object.freeze(['dine_in']),
  dhaba: Object.freeze(['dine_in']),
  food_court: Object.freeze(['dine_in']),
  cloud_kitchen: Object.freeze(['dine_in']),
  canteen_cafeteria: Object.freeze(['dine_in']),
  hotel_resort: Object.freeze(['hotel']),
  cinema_theatre: Object.freeze(['cinema']),
  lounge: Object.freeze(['dine_in']),
  pub_bar: Object.freeze(['dine_in']),
  club: Object.freeze(['dine_in']),
  juice_beverage: Object.freeze(['dine_in']),
  ice_cream_dessert: Object.freeze(['dine_in']),
  food_truck: Object.freeze(['dine_in']),
  catering: Object.freeze(['dine_in']),
  institutional: Object.freeze(['dine_in']),
  other: Object.freeze(['dine_in'])
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
 * Resolves the canonical business category / service_model from a business type.
 * @param {string} businessType
 * @returns {'dine_in'|'hotel'|'cinema'}
 */
export function resolveBusinessCategoryFromType(businessType) {
  const cleanBiz = businessType ? String(businessType).trim().toLowerCase() : 'restaurant';
  const canonicalBiz = BUSINESS_TYPE_ALIASES[cleanBiz] || (isValidBusinessType(cleanBiz) ? cleanBiz : 'restaurant');
  return BUSINESS_TYPE_DEFAULT_SERVICE_MODEL[canonicalBiz] || 'dine_in';
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
 * Resolves the authoritative service model (category) for a business type.
 * @param {string} businessType
 * @param {string|null} [currentServiceModel=null]
 * @returns {string}
 */
export function resolveServiceModelForBusinessType(businessType, currentServiceModel = null) {
  return resolveBusinessCategoryFromType(businessType);
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

/**
 * Returns the list of valid physical space types for a given business type and service model.
 * @param {string} businessType
 * @param {string} serviceModel
 * @param {object} [options={}] - { total_tables, total_cabins, total_rooms, total_vip }
 * @returns {Array<{ id: string, label: string, singular: string, plural: string, badge: string, param: string }>}
 */
export function getAvailableSpaceTypesForBusiness(businessType, serviceModel, options = {}) {
  const cleanBiz = businessType ? String(businessType).trim().toLowerCase() : 'restaurant';
  const canonicalBiz = BUSINESS_TYPE_ALIASES[cleanBiz] || (isValidBusinessType(cleanBiz) ? cleanBiz : 'restaurant');
  const cleanService = serviceModel ? String(serviceModel).trim().toLowerCase() : resolveServiceModelForBusinessType(canonicalBiz);
  const canonicalService = SERVICE_MODEL_ALIASES[cleanService] || cleanService;

  if (canonicalBiz === 'cinema_theatre' || canonicalService === 'cinema') {
    return [
      { id: 'cinema_seat', label: '🎬 Cinema Seat', singular: 'Cinema Seat', plural: 'Cinema Seats', badge: 'CINEMA SEAT', param: 'cinema' }
    ];
  }

  if (canonicalBiz === 'hotel_resort' || canonicalService === 'hotel') {
    return [
      { id: 'room', label: '🏨 Hotel Room', singular: 'Room', plural: 'Rooms', badge: 'ROOM NO.', param: 'room' }
    ];
  }

  // All other dining / food service models (dine_in_table)
  return [
    { id: 'table', label: '🍽️ Dining Table', singular: 'Table', plural: 'Tables', badge: 'TABLE NO.', param: 'table' },
    { id: 'cabin', label: '🛋️ Private Cabin', singular: 'Cabin', plural: 'Cabins', badge: 'CABIN NO.', param: 'cabin' },
    { id: 'vip', label: '👑 VIP Lounge', singular: 'VIP Lounge', plural: 'VIP Lounges', badge: 'VIP LOUNGE', param: 'vip' }
  ];
}

/**
 * Resolves standard space configuration (singular, plural, badge, param) for a given space type prefix.
 * @param {string} prefix - 'table' | 'cabin' | 'room' | 'vip' | 'cinema_seat'
 * @returns {{ id: string, label: string, singular: string, plural: string, badge: string, param: string }}
 */
export function getSpaceConfig(prefix = 'table') {
  const t = String(prefix || 'table').toLowerCase();
  if (t === 'cinema_seat' || t === 'cinema') {
    return { id: 'cinema_seat', label: '🎬 Cinema Seat', singular: 'Cinema Seat', plural: 'Cinema Seats', badge: 'CINEMA SEAT', param: 'cinema' };
  }
  if (t === 'cabin') {
    return { id: 'cabin', label: '🛋️ Private Cabin', singular: 'Cabin', plural: 'Cabins', badge: 'CABIN NO.', param: 'cabin' };
  }
  if (t === 'room') {
    return { id: 'room', label: '🏨 Hotel Room', singular: 'Room', plural: 'Rooms', badge: 'ROOM NO.', param: 'room' };
  }
  if (t === 'vip') {
    return { id: 'vip', label: '👑 VIP Lounge', singular: 'VIP Lounge', plural: 'VIP Lounges', badge: 'VIP LOUNGE', param: 'vip' };
  }
  return { id: 'table', label: '🍽️ Dining Table', singular: 'Table', plural: 'Tables', badge: 'TABLE NO.', param: 'table' };
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
  resolveBusinessCategoryFromType,
  resolveServiceModelForBusinessType,
  resolveBusinessProfile,
  resolveBannerBadge,
  getAvailableSpaceTypesForBusiness,
  getSpaceConfig
};
