/**
 * Shared Combo Backend Helpers
 * Centralizes combo item parsing, component availability validation,
 * live dish synchronization, dietary classification, and kitchen includes formatting.
 */

export function parseComboItems(rawItems) {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === 'string' && rawItems.trim()) {
    try {
      const parsed = JSON.parse(rawItems);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isFlagEnabled(val, fallback = true) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val).trim().toLowerCase();
  if (s === 'false' || s === '0' || s === 'f' || s === 'no') return false;
  if (s === 'true' || s === '1' || s === 't' || s === 'yes') return true;
  return Boolean(val);
}

export function buildDishNameMap(dishMapOrList) {
  const nameMap = new Map();
  if (!dishMapOrList) return nameMap;
  const iter = dishMapOrList instanceof Map ? dishMapOrList.values() : dishMapOrList;
  for (const d of iter) {
    if (!d || typeof d !== 'object' || !d.name) continue;
    const key = String(d.name).trim().toLowerCase();
    if (key && !nameMap.has(key)) {
      nameMap.set(key, d);
    }
  }
  return nameMap;
}

export function findMatchingDishForComboItem(item, dishMap = null, dishNameMap = null) {
  if (!item || typeof item !== 'object') return null;
  if (dishMap && item.dish_id !== undefined && item.dish_id !== null && String(item.dish_id).trim() !== '') {
    const byId = dishMap.get(String(item.dish_id));
    if (byId) return byId;
  }
  const rawName = String(item.dish_name || item.name || item.title || '').trim().toLowerCase();
  if (rawName) {
    if (dishNameMap && dishNameMap.has(rawName)) return dishNameMap.get(rawName);
    if (dishMap) {
      for (const d of dishMap.values()) {
        if (d?.name && String(d.name).trim().toLowerCase() === rawName) return d;
      }
    }
  }
  return null;
}

export function formatComboIncludesText(rawItems, dishMap = null) {
  const items = parseComboItems(rawItems);
  if (items.length === 0) return '';
  const dishNameMap = buildDishNameMap(dishMap);

  return items
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const matchedDish = findMatchingDishForComboItem(item, dishMap, dishNameMap);
      const dishName = String(matchedDish?.name || item.dish_name || item.name || item.title || '').trim();
      if (!dishName) return '';
      const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
      const isHalf = String(item.portion || '').trim().toLowerCase() === 'half';
      return `${qty > 1 ? `${qty}x ` : ''}${dishName}${isHalf ? ' (H)' : ''}`;
    })
    .filter(Boolean)
    .join(' + ');
}

export function inspectComboComponentAvailability(combo, dishMap) {
  const items = parseComboItems(combo?.items);
  if (items.length === 0 || !dishMap || dishMap.size === 0) {
    return { allAvailable: true, unavailableNames: [] };
  }

  const dishNameMap = buildDishNameMap(dishMap);
  const unavailableNames = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const matchedDish = findMatchingDishForComboItem(item, dishMap, dishNameMap);
    // Only mark unavailable when the linked dish exists in the menu and is explicitly marked Sold Out
    if (matchedDish && !isFlagEnabled(matchedDish.available, true)) {
      const label = String(matchedDish.name || item.dish_name || item.name || 'Item').trim();
      if (label && !unavailableNames.includes(label)) {
        unavailableNames.push(label);
      }
    }
  }

  return {
    allAvailable: unavailableNames.length === 0,
    unavailableNames
  };
}

const NONVEG_KEYWORDS = [
  'chicken', 'mutton', 'fish', 'prawn', 'meat', 'pork',
  'beef', 'bacon', 'seafood', 'keema', 'lamb', 'non-veg', 'nonveg'
];

export function resolveComboDietType(combo, dishMap = null) {
  const items = parseComboItems(combo?.items);
  const dishNameMap = buildDishNameMap(dishMap);
  let hasEgg = false;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const dish = findMatchingDishForComboItem(item, dishMap, dishNameMap);

    const typeStr = String(dish?.type || item.type || '').trim().toLowerCase();
    const foodTypeStr = String(dish?.food_type || item.food_type || '').trim().toLowerCase();

    if (
      typeStr === 'nonveg' || typeStr === 'non_veg' ||
      foodTypeStr === 'nonveg' || foodTypeStr === 'non_veg' ||
      dish?.is_veg === false || dish?.is_veg === 0 || dish?.is_veg === '0' || dish?.is_non_veg === true
    ) {
      return 'nonveg';
    }
    if (typeStr === 'egg' || foodTypeStr === 'egg') {
      hasEgg = true;
    }
  }

  const itemsText = items
    .map(i => typeof i === 'string' ? i : `${i?.dish_name || i?.name || ''}`)
    .join(' ');
  const textToCheck = `${combo?.name || ''} ${combo?.description || ''} ${itemsText}`.toLowerCase();

  if (NONVEG_KEYWORDS.some(kw => textToCheck.includes(kw))) {
    return 'nonveg';
  }
  if (hasEgg || textToCheck.includes('egg') || textToCheck.includes('अंडा')) {
    return 'egg';
  }
  return 'veg';
}

export function enrichCombosWithLiveDishes(combos = [], allDishes = []) {
  const dishMap = new Map((allDishes || []).map(d => [String(d.id), d]));
  const dishNameMap = buildDishNameMap(dishMap);

  return (combos || []).map(combo => {
    const rawItems = parseComboItems(combo?.items);
    const syncedItems = rawItems.map(item => {
      if (!item || typeof item !== 'object') return item;
      const dish = findMatchingDishForComboItem(item, dishMap, dishNameMap);
      if (!dish) return item;

      const isHalf = String(item.portion || '').trim().toLowerCase() === 'half';
      const liveUnitPrice = (isHalf && dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0)
        ? Number(dish.price_half)
        : (Number(dish.price) || Number(item.original_price) || 0);

      return {
        ...item,
        dish_id: dish.id ?? item.dish_id,
        dish_name: dish.name || item.dish_name || item.name,
        original_price: liveUnitPrice
      };
    });

    const availability = inspectComboComponentAvailability({ ...combo, items: syncedItems }, dishMap);
    const dietType = resolveComboDietType({ ...combo, items: syncedItems }, dishMap);

    return {
      ...combo,
      items: syncedItems,
      diet_type: dietType,
      has_unavailable_items: !availability.allAvailable,
      unavailable_item_names: availability.unavailableNames
    };
  });
}
