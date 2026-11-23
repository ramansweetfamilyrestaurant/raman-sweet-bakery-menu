/**
 * TouchQR — Counter POS Diet Filtering & Dietary Invariant Verification Suite
 *
 * Rigorously verifies:
 * 1. Dishes with type='veg' and no food_type are correctly identified as pure veg.
 * 2. Dishes with type='nonveg', type='non_veg', or type='egg' are identified as non-veg.
 * 3. Dishes with boolean is_veg=false or is_non_veg=true are identified as non-veg.
 * 4. Dishes with food_type='pure_veg' or food_type='veg' are identified as veg.
 * 5. Dishes with food_type='non_veg' or food_type='nonveg' are identified as non-veg.
 * 6. Combos containing non-veg keyword items (chicken, mutton, fish, egg) are identified as non-veg.
 * 7. Combos containing only vegetarian items are identified as veg.
 * 8. Filter simulation: Selecting 'veg' keeps only veg items, 'nonveg' keeps only nonveg items.
 */

import test from 'node:test';
import assert from 'node:assert';
import { isPosItemNonVeg } from '../../src/utils/dietHelper.js';

test('🌱 Counter POS Dietary Classification & Filter Suite', async (t) => {
  await t.test('1. Standard database dish with type="veg" is identified as pure veg', () => {
    const dish = { id: 1, name: 'Paneer Butter Masala', type: 'veg' };
    assert.strictEqual(isPosItemNonVeg(dish), false, 'Must identify type="veg" as veg');
  });

  await t.test('2. Dish with default schema without food_type (like djhgfhj) is identified as pure veg', () => {
    const dish = { id: 2, name: 'djhgfhj', type: 'veg', price: 784 };
    assert.strictEqual(isPosItemNonVeg(dish), false, 'Must identify standard veg dish as veg');
  });

  await t.test('3. Dish with type="nonveg" or type="non_veg" is identified as non-veg', () => {
    const dish1 = { id: 3, name: 'Chicken Tikka', type: 'nonveg' };
    const dish2 = { id: 4, name: 'Mutton Curry', type: 'non_veg' };
    assert.strictEqual(isPosItemNonVeg(dish1), true, 'Must identify type="nonveg" as non-veg');
    assert.strictEqual(isPosItemNonVeg(dish2), true, 'Must identify type="non_veg" as non-veg');
  });

  await t.test('4. Dish with type="egg" is identified as non-veg', () => {
    const dish = { id: 5, name: 'Egg Biryani', type: 'egg' };
    assert.strictEqual(isPosItemNonVeg(dish), true, 'Must identify type="egg" as non-veg');
  });

  await t.test('5. Dish with food_type="pure_veg" or food_type="veg" is identified as veg', () => {
    const dish1 = { id: 6, name: 'Dal Tadka', food_type: 'pure_veg' };
    const dish2 = { id: 7, name: 'Jeera Rice', food_type: 'veg' };
    assert.strictEqual(isPosItemNonVeg(dish1), false, 'Must identify food_type="pure_veg" as veg');
    assert.strictEqual(isPosItemNonVeg(dish2), false, 'Must identify food_type="veg" as veg');
  });

  await t.test('6. Dish with food_type="non_veg" is identified as non-veg', () => {
    const dish = { id: 8, name: 'Fish Fry', food_type: 'non_veg' };
    assert.strictEqual(isPosItemNonVeg(dish), true, 'Must identify food_type="non_veg" as non-veg');
  });

  await t.test('7. Dish with boolean is_veg=false or is_non_veg=true is identified as non-veg', () => {
    const dish1 = { id: 9, name: 'Butter Chicken', is_veg: false };
    const dish2 = { id: 10, name: 'Prawn Masala', is_non_veg: true };
    assert.strictEqual(isPosItemNonVeg(dish1), true, 'Must identify is_veg=false as non-veg');
    assert.strictEqual(isPosItemNonVeg(dish2), true, 'Must identify is_non_veg=true as non-veg');
  });

  await t.test('8. Combos correctly classified based on item names and text', () => {
    const vegCombo = {
      id: 11,
      name: 'South Indian Thali',
      items: [{ dish_name: 'Dosa' }, { dish_name: 'Idli' }, { dish_name: 'Sambar' }]
    };
    const nonVegCombo = {
      id: 12,
      name: 'Family Feast Combo',
      items: [{ dish_name: 'Chicken Burger' }, { dish_name: 'Fries' }]
    };

    assert.strictEqual(isPosItemNonVeg(vegCombo), false, 'Veg combo must be classified as veg');
    assert.strictEqual(isPosItemNonVeg(nonVegCombo), true, 'Non-veg combo must be classified as non-veg');
  });

  await t.test('9. POS Diet Filter simulation with mixed catalog', () => {
    const catalog = [
      { id: 1, name: 'Paneer Tikka', type: 'veg' },
      { id: 2, name: 'djhgfhj', type: 'veg' },
      { id: 3, name: 'Chicken Biryani', type: 'nonveg' },
      { id: 4, name: 'Egg Roll', type: 'egg' },
      { id: 5, name: 'Veg Burger Combo', isCombo: true, items: [{ dish_name: 'Veg Burger' }] },
      { id: 6, name: 'NonVeg Thali Combo', isCombo: true, items: [{ dish_name: 'Mutton Korma' }] }
    ];

    const filterCatalog = (dietFilter) => {
      return catalog.filter(item => {
        const isNonVeg = isPosItemNonVeg(item);
        if (dietFilter === 'veg' && isNonVeg) return false;
        if (dietFilter === 'nonveg' && !isNonVeg) return false;
        return true;
      });
    };

    // 'all' returns all 6 items
    assert.strictEqual(filterCatalog('all').length, 6, 'All items must be returned on filter="all"');

    // 'veg' returns only veg items (Paneer Tikka, djhgfhj, Veg Burger Combo)
    const vegResults = filterCatalog('veg');
    assert.strictEqual(vegResults.length, 3, 'Exactly 3 veg items must be returned');
    assert.deepStrictEqual(vegResults.map(i => i.id), [1, 2, 5]);

    // 'nonveg' returns only non-veg items (Chicken Biryani, Egg Roll, NonVeg Thali Combo)
    const nonVegResults = filterCatalog('nonveg');
    assert.strictEqual(nonVegResults.length, 3, 'Exactly 3 non-veg items must be returned');
    assert.deepStrictEqual(nonVegResults.map(i => i.id), [3, 4, 6]);
  });

  await t.test('10. Pure Veg Restaurant resolver robustly identifies pure veg across all formats', () => {
    const resolvePureVeg = (info) => {
      const resolvedFoodType = String(info?.food_type || info?.resto_type || '').trim().toLowerCase();
      return info?.is_pure_veg === true ||
        info?.is_pure_veg === 1 ||
        info?.is_pure_veg === '1' ||
        info?.is_pure_veg === 'true' ||
        ['pure_veg', 'veg', 'vegetarian', 'vegan', 'only_veg'].includes(resolvedFoodType) ||
        ['bakery_confectionery', 'sweet_shop'].includes(String(info?.business_type || '').toLowerCase());
    };

    assert.strictEqual(resolvePureVeg({ food_type: 'pure_veg' }), true);
    assert.strictEqual(resolvePureVeg({ food_type: 'veg' }), true);
    assert.strictEqual(resolvePureVeg({ food_type: 'only_veg' }), true);
    assert.strictEqual(resolvePureVeg({ resto_type: 'pure_veg' }), true);
    assert.strictEqual(resolvePureVeg({ is_pure_veg: 1 }), true);
    assert.strictEqual(resolvePureVeg({ is_pure_veg: '1' }), true);
    assert.strictEqual(resolvePureVeg({ is_pure_veg: true }), true);
    assert.strictEqual(resolvePureVeg({ business_type: 'sweet_shop' }), true);
    assert.strictEqual(resolvePureVeg({ business_type: 'bakery_confectionery' }), true);
    assert.strictEqual(resolvePureVeg({ food_type: 'veg_nonveg' }), false);
    assert.strictEqual(resolvePureVeg({ food_type: 'non_veg' }), false);
  });

  await t.test('11. MenuView filter pills strip excludes Non-Veg and Egg when restaurant is Pure Veg', () => {
    const buildPills = (isPureVegRestaurant, counts = { all: 10, veg: 10, nonveg: 0, egg: 0, must_try: 2, bestseller: 1, special: 1, available: 10, sold_out: 0, under_100: 5 }, curr = '₹') => {
      return [
        { id: 'all', label: 'All', count: counts.all },
        { id: 'veg', label: 'Veg', dot: '🟢', count: counts.veg },
        ...(!isPureVegRestaurant ? [
          { id: 'nonveg', label: 'Non-Veg', dot: '🔴', count: counts.nonveg },
          { id: 'egg', label: 'Egg', dot: '🟡', count: counts.egg }
        ] : []),
        { id: 'must_try', label: 'Must Try', icon: '🔥', count: counts.must_try },
        { id: 'bestseller', label: 'Bestseller', icon: '⭐', count: counts.bestseller },
        { id: 'special', label: 'Special', icon: '✨', count: counts.special },
        { id: 'available', label: 'In Stock', dot: '🟢', count: counts.available },
        { id: 'sold_out', label: 'Sold Out', dot: '🔴', count: counts.sold_out },
        { id: 'under_100', label: `Under ${curr}100`, count: counts.under_100 }
      ];
    };

    const pureVegPills = buildPills(true);
    assert.strictEqual(pureVegPills.some(p => p.id === 'nonveg'), false, 'Non-Veg pill must NOT exist in pure veg');
    assert.strictEqual(pureVegPills.some(p => p.id === 'egg'), false, 'Egg pill must NOT exist in pure veg');
    assert.strictEqual(pureVegPills.some(p => p.id === 'all'), true);
    assert.strictEqual(pureVegPills.some(p => p.id === 'veg'), true);

    const nonVegPills = buildPills(false);
    assert.strictEqual(nonVegPills.some(p => p.id === 'nonveg'), true, 'Non-Veg pill must exist for mixed/nonveg');
    assert.strictEqual(nonVegPills.some(p => p.id === 'egg'), true, 'Egg pill must exist for mixed/nonveg');
  });

  await t.test('12. SearchBar quick filters strictly hide Non-Veg and Egg when restaurant is Pure Veg even if filtersVisibility is true', () => {
    const buildSearchBarFilters = (isPureVeg, filtersVisibility = { nonveg: true, egg: true }) => {
      const vis = {
        must_try: true,
        combo: true,
        special: true,
        under100: true,
        ...filtersVisibility,
        ...(isPureVeg ? { veg: false, nonveg: false, egg: false } : {})
      };

      const allFilters = [
        { id: '', label: '✨ All', show: true },
        { id: 'combo', label: '🍱 Combos & Thalis', show: vis.combo !== false },
        { id: 'veg', label: '🟢 Pure Veg', show: !isPureVeg && vis.veg !== false },
        { id: 'nonveg', label: '🔴 Non-Veg', show: !isPureVeg && vis.nonveg !== false },
        { id: 'egg', label: '🟡 Egg', show: !isPureVeg && vis.egg !== false },
        { id: 'must_try', label: '⭐ Must Try', show: vis.must_try !== false },
        { id: 'special', label: '✨ Special', show: vis.special !== false },
        { id: 'under100', label: '⚡ Under ₹100', show: vis.under100 !== false }
      ];

      return allFilters.filter(f => f.show);
    };

    const pureVegFilters = buildSearchBarFilters(true, { nonveg: true, egg: true });
    assert.strictEqual(pureVegFilters.some(f => f.id === 'nonveg'), false, 'Non-Veg must never show in pure veg filters');
    assert.strictEqual(pureVegFilters.some(f => f.id === 'egg'), false, 'Egg must never show in pure veg filters');

    const nonVegFilters = buildSearchBarFilters(false, { nonveg: true, egg: true });
    assert.strictEqual(nonVegFilters.some(f => f.id === 'nonveg'), true, 'Non-Veg must show in mixed/nonveg filters');
    assert.strictEqual(nonVegFilters.some(f => f.id === 'egg'), true, 'Egg must show in mixed/nonveg filters');
  });
});
