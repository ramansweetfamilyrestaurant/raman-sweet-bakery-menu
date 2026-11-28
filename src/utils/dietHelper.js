/**
 * TouchQR — Dietary Classification & Filter Helper
 *
 * Authoritative logic to determine whether a dish or combo is non-veg.
 * Checks dish.type, dish.food_type, dish.is_veg, dish.is_non_veg, and combo contents.
 *
 * @param {Object} item
 * @returns {boolean} true if non-veg, false if pure-veg
 */
export function isPosItemNonVeg(item) {
  if (!item) return false;
  // 0. Pre-resolved dietary type (e.g. combos enriched from backend/dishes)
  const resolvedDiet = String(item.diet_type || '').trim().toLowerCase();
  if (resolvedDiet === 'nonveg' || resolvedDiet === 'non_veg' || resolvedDiet === 'egg') {
    return true;
  }
  if (resolvedDiet === 'veg') {
    return false;
  }

  const typeStr = String(item.type || '').trim().toLowerCase();
  const foodTypeStr = String(item.food_type || '').trim().toLowerCase();

  // 1. Explicit non-veg values
  if (
    typeStr === 'nonveg' ||
    typeStr === 'non_veg' ||
    foodTypeStr === 'non_veg' ||
    foodTypeStr === 'nonveg' ||
    typeStr === 'egg' ||
    foodTypeStr === 'egg'
  ) {
    return true;
  }

  // 2. Explicit boolean flags
  if (item.is_veg === false || item.is_veg === 0 || item.is_veg === '0' || item.is_non_veg === true) {
    return true;
  }

  // 3. Explicit veg flags
  if (
    typeStr === 'veg' ||
    foodTypeStr === 'veg' ||
    foodTypeStr === 'pure_veg' ||
    item.is_veg === true ||
    item.is_veg === 1 ||
    item.is_veg === '1'
  ) {
    return false;
  }

  // 4. Combos or items without explicit diet indicators: inspect text keywords
  const itemsText = Array.isArray(item.items)
    ? item.items.map(i => i.dish_name || i.name || '').join(' ')
    : (typeof item.items === 'string' ? item.items : '');
  const textToCheck = `${item.name || ''} ${item.description || ''} ${itemsText}`.toLowerCase();
  if (
    textToCheck.includes('chicken') ||
    textToCheck.includes('mutton') ||
    textToCheck.includes('fish') ||
    textToCheck.includes('egg') ||
    textToCheck.includes('prawn') ||
    textToCheck.includes('meat') ||
    textToCheck.includes('pork') ||
    textToCheck.includes('beef') ||
    textToCheck.includes('bacon') ||
    textToCheck.includes('seafood') ||
    textToCheck.includes('keema') ||
    textToCheck.includes('lamb') ||
    textToCheck.includes('अंडा')
  ) {
    return true;
  }

  return false;
}
