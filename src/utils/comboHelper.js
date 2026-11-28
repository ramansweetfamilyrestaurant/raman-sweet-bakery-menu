import { isFlagEnabled } from './customerHelpers.js';

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

const NONVEG_KEYWORDS = [
  'chicken', 'mutton', 'fish', 'prawn', 'meat', 'pork',
  'beef', 'bacon', 'seafood', 'keema', 'lamb', 'non-veg', 'nonveg'
];

export function resolveComboDietType(combo, dishMap = null) {
  if (combo?.diet_type === 'nonveg' || combo?.diet_type === 'egg' || combo?.diet_type === 'veg') {
    return combo.diet_type;
  }

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

/**
 * Resolves live included dish names, original total value, availability & diet type for a combo.
 * When the server has already set an explicit boolean `combo.has_unavailable_items`,
 * that authoritative server value is preserved (e.g. customer menu where hidden categories omit dishes).
 */
export function resolveComboMeta(combo, dishMap = null) {
  const rawItems = parseComboItems(combo?.items);
  const dishNameMap = buildDishNameMap(dishMap);
  const hasExplicitServerFlag = typeof combo?.has_unavailable_items === 'boolean';

  const unavailableNames = Array.isArray(combo?.unavailable_item_names)
    ? [...combo.unavailable_item_names]
    : [];
  const hasDishCatalog = Boolean(dishMap && dishMap.size > 0);

  const syncedItems = rawItems.map(item => {
    if (!item || typeof item !== 'object') return item;
    const dish = findMatchingDishForComboItem(item, dishMap, dishNameMap);

    if (!hasExplicitServerFlag && hasDishCatalog && dish && !isFlagEnabled(dish.available, true)) {
      const label = String(dish.name || item.dish_name || item.name || 'Item').trim();
      if (label && !unavailableNames.includes(label)) {
        unavailableNames.push(label);
      }
    }

    if (!dish) return item;

    const isHalf = String(item.portion || '').trim().toLowerCase() === 'half';
    const liveUnitPrice = (isHalf && dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0)
      ? Number(dish.price_half)
      : (Number(dish.price) || Number(item.original_price) || 0);

    return {
      ...item,
      dish_name: dish.name || item.dish_name || item.name,
      original_price: liveUnitPrice
    };
  });

  const originalTotal = syncedItems.reduce((sum, i) => {
    if (!i || typeof i !== 'object') return sum;
    return sum + ((Number(i.original_price || i.price) || 0) * Math.max(1, Number(i.qty ?? i.quantity ?? 1) || 1));
  }, 0);

  const includesText = formatComboIncludesText(syncedItems, dishMap);
  const hasUnavailableItems = hasExplicitServerFlag
    ? combo.has_unavailable_items
    : unavailableNames.length > 0;
  const comboSelfAvailable = isFlagEnabled(combo?.available, true) && isFlagEnabled(combo?.is_available, true);
  const isOrderable = comboSelfAvailable && !hasUnavailableItems;
  const dietType = resolveComboDietType({ ...combo, items: syncedItems }, dishMap);

  return {
    comboItems: syncedItems,
    originalTotal,
    itemsSummaryText: includesText,
    hasUnavailableItems,
    unavailableNames,
    isOrderable,
    dietType
  };
}
