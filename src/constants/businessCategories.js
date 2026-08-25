/**
 * Canonical Business Category Registry for TouchQR (Step 3.159)
 * 
 * Defines canonical tenant classifications:
 * 1. DINE_IN (🍽️ Dine-In)
 * 2. HOTEL (🏨 Hotel)
 * 3. CINEMA (🎬 Cinema)
 */

export const BUSINESS_CATEGORIES = {
  DINE_IN: {
    value: 'dine_in',
    label: 'Dine-In',
    icon: 'Utensils',
    emoji: '🍽️',
    description: 'Restaurant table QR and dine-in ordering'
  },
  HOTEL: {
    value: 'hotel',
    label: 'Hotel',
    icon: 'Hotel',
    emoji: '🏨',
    description: 'Hotel dining and room service'
  },
  CINEMA: {
    value: 'cinema',
    label: 'Cinema',
    icon: 'Film',
    emoji: '🎬',
    description: 'Cinema snacks and seat-based ordering'
  }
};

export const BUSINESS_CATEGORY_LIST = Object.values(BUSINESS_CATEGORIES);

export const DEFAULT_BUSINESS_CATEGORY = 'dine_in';

export const VALID_BUSINESS_CATEGORIES = new Set(
  BUSINESS_CATEGORY_LIST.map(c => c.value)
);

/**
 * Checks if a given string is a valid canonical business category value.
 */
export function isValidBusinessCategory(val) {
  if (!val || typeof val !== 'string') return false;
  return VALID_BUSINESS_CATEGORIES.has(val.trim().toLowerCase());
}

const CATEGORY_ALIASES = {
  seat_service: 'cinema',
  seat: 'cinema',
  cinema: 'cinema',
  in_room_dining: 'hotel',
  room: 'hotel',
  hotel: 'hotel',
  dine_in_table: 'dine_in',
  table: 'dine_in',
  dine_in: 'dine_in'
};

/**
 * Safely resolves any string or legacy/null value to a valid canonical category.
 * Defaults safely to 'dine_in'.
 */
export function resolveBusinessCategory(val) {
  if (!val || typeof val !== 'string') return DEFAULT_BUSINESS_CATEGORY;
  const normalized = val.trim().toLowerCase();
  if (CATEGORY_ALIASES[normalized]) {
    return CATEGORY_ALIASES[normalized];
  }
  if (VALID_BUSINESS_CATEGORIES.has(normalized)) {
    return normalized;
  }
  return DEFAULT_BUSINESS_CATEGORY;
}

/**
 * Returns full metadata object for a category value.
 */
export function getBusinessCategoryMeta(val) {
  const resolved = resolveBusinessCategory(val);
  return (
    BUSINESS_CATEGORY_LIST.find(c => c.value === resolved) ||
    BUSINESS_CATEGORIES.DINE_IN
  );
}

/**
 * Returns human-readable label for a category value.
 */
export function getBusinessCategoryLabel(val) {
  return getBusinessCategoryMeta(val).label;
}

/**
 * Returns emoji icon for a category value.
 */
export function getBusinessCategoryEmoji(val) {
  return getBusinessCategoryMeta(val).emoji;
}
