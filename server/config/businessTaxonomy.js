/**
 * TouchQR Canonical Business Profile Taxonomy Source of Truth
 * 
 * Provides unified, authoritative allowed values, aliases, validation functions,
 * and backward-compatible resolvers for:
 * 1. Business Type / Venue Type ("What kind of establishment is this?")
 * 2. Food Type / Dietary Profile ("What dietary rules apply to the menu?")
 * 3. Service Model ("How does the customer receive/service the order?")
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
  'entertainment_venue',
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
  'juice': 'juice_beverage'
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

/**
 * Validates if the given value is a canonical Business Type.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidBusinessType(value) {
  if (!value || typeof value !== 'string') return false;
  return BUSINESS_TYPES.includes(value.trim().toLowerCase());
}

/**
 * Validates if the given value is a canonical Food Type.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidFoodType(value) {
  if (!value || typeof value !== 'string') return false;
  return FOOD_TYPES.includes(value.trim().toLowerCase());
}

/**
 * Validates if the given value is a canonical Service Model.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidServiceModel(value) {
  if (!value || typeof value !== 'string') return false;
  return SERVICE_MODELS.includes(value.trim().toLowerCase());
}

/**
 * Authoritatively resolves a restaurant's 3-axis taxonomy profile with safe fallback to legacy resto_type.
 *
 * @param {Object} restaurant - Database restaurant record or request body
 * @returns {{ business_type: string, food_type: string|null, service_model: string, legacy_resto_type: string, is_pure_veg: boolean }}
 */
export function resolveBusinessProfile(restaurant = {}) {
  const rawBiz = restaurant.business_type ? String(restaurant.business_type).trim().toLowerCase() : '';
  const rawFood = restaurant.food_type ? String(restaurant.food_type).trim().toLowerCase() : '';
  const rawService = restaurant.service_model ? String(restaurant.service_model).trim().toLowerCase() : '';
  const legacyResto = (restaurant.resto_type ? String(restaurant.resto_type) : '').trim().toLowerCase();

  let business_type = null;
  let food_type = null;
  let service_model = null;

  // 1. Resolve Business Type
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

  // 2. Resolve Food Type
  if (rawFood && isValidFoodType(rawFood)) {
    food_type = rawFood;
  } else if (rawFood && FOOD_TYPE_ALIASES[rawFood]) {
    food_type = FOOD_TYPE_ALIASES[rawFood];
  } else if (legacyResto === 'pure_veg') {
    food_type = 'pure_veg';
  } else if (legacyResto === 'veg_nonveg' || legacyResto === 'non_veg') {
    food_type = 'veg_nonveg';
  } else {
    // For legacy cafe, fast_food, bakery where food_type was not specified, do NOT guess.
    food_type = null;
  }

  // 3. Resolve Service Model
  if (rawService && isValidServiceModel(rawService)) {
    service_model = rawService;
  } else if (rawService && SERVICE_MODEL_ALIASES[rawService]) {
    service_model = SERVICE_MODEL_ALIASES[rawService];
  } else if (rawService) {
    // Preserve stored legacy value for merchant review warning without crashing
    service_model = rawService;
  } else if (business_type === 'hotel_resort') {
    service_model = 'in_room_dining';
  } else if (business_type === 'cinema_theatre') {
    service_model = 'seat_service';
  } else {
    service_model = 'dine_in_table';
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

/**
 * Single backend badge resolver combining business_type and food_type semantically.
 *
 * @param {Object} restaurant - Database restaurant record
 * @returns {string} Customer-facing banner badge text
 */
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
  BUSINESS_TYPE_ALIASES,
  FOOD_TYPE_ALIASES,
  SERVICE_MODEL_ALIASES,
  isValidBusinessType,
  isValidFoodType,
  isValidServiceModel,
  resolveBusinessProfile,
  resolveBannerBadge
};
