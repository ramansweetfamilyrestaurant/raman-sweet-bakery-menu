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

export function formatComboIncludesText(rawItems, dishMap = null) {
  const items = parseComboItems(rawItems);
  if (items.length === 0) return '';

  return items
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const matchedDish = (dishMap && item.dish_id !== undefined && item.dish_id !== null)
        ? dishMap.get(String(item.dish_id))
        : null;
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
  let hasEgg = false;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const dish = (dishMap && item.dish_id !== undefined && item.dish_id !== null)
      ? dishMap.get(String(item.dish_id))
      : null;

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
 */
export function resolveComboMeta(combo, dishMap = null) {
  const rawItems = parseComboItems(combo?.items);
  const unavailableNames = Array.isArray(combo?.unavailable_item_names)
    ? [...combo.unavailable_item_names]
    : [];
  const hasDishCatalog = Boolean(dishMap && dishMap.size > 0);

  const syncedItems = rawItems.map(item => {
    if (!item || typeof item !== 'object') return item;
    const dish = (dishMap && item.dish_id !== undefined && item.dish_id !== null)
      ? dishMap.get(String(item.dish_id))
      : null;

    const hasDishRef = item.dish_id !== undefined && item.dish_id !== null && String(item.dish_id).trim() !== '';
    if (hasDishCatalog && hasDishRef) {
      if (!dish || !isFlagEnabled(dish.available, true)) {
        const label = String(dish?.name || item.dish_name || item.name || 'Item').trim();
        if (label && !unavailableNames.includes(label)) {
          unavailableNames.push(label);
        }
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
  const hasUnavailableItems = Boolean(combo?.has_unavailable_items) || unavailableNames.length > 0;
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
