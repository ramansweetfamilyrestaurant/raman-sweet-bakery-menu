/**
 * TouchQR — Menu Item & Category Add Flow Regression Suite
 *
 * Verifies:
 * 1. Category creation validates names cleanly, allows sort_order=0, and invalidates menu bundle cache.
 * 2. Dish creation supports price=0, trims names, stores modifiers, and invalidates menu bundle cache.
 * 3. Quota enforcement returns descriptive plan_limit_reached messages on categories and dishes independently.
 * 4. Frontend MenuView, DishFormModal, AdminDashboard, and App handle activeTabAtLimit, awaited reloads,
 *    defaultCategoryId preselection, clear filters, and readable error extraction consistently.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

import { JWT_SECRET } from '../config/jwt.js';
import { initDb, query } from '../db.js';
import adminRoutes from '../routes/admin.js';
import apiRoutes from '../routes/api.js';
import { isAuthoritativePureVeg, resolveBusinessProfile as resolveFrontendBusinessProfile } from '../../src/utils/businessTaxonomy.js';
import { resolveBusinessProfile as resolveBackendBusinessProfile } from '../config/businessTaxonomy.js';

let passed = 0;
let failed = 0;

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 MENU ITEM & CATEGORY ADD FLOW VERIFICATION SUITE');
  console.log('======================================================================\n');

  await initDb({ isTest: true });

  const futureExpiry = new Date(Date.now() + 30 * 86400000).toISOString();
  await query(`
    INSERT INTO restaurants (name, slug, plan_tier, subscription_type, mandate_status, plan_expires_at, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, ['Catalog Flow Cafe', 'catalog-flow-cafe', 'basic', 'PAID', 'active', futureExpiry, 1]);
  const [resto] = await query("SELECT id, slug FROM restaurants WHERE slug = 'catalog-flow-cafe'");
  const token = jwt.sign({ id: 101, username: 'owner', role: 'restaurant_admin', restaurant_id: resto.id }, JWT_SECRET, { expiresIn: '1h' });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await testAsync('1. Prime empty menu-bundle cache before creating category and dish', async () => {
      const bundle = await fetch(`${baseUrl}/api/menu-bundle?slug=${resto.slug}`).then(r => r.json());
      assert.strictEqual(bundle.categories.length, 0);
      assert.strictEqual(bundle.dishes.length, 0);
    });

    let createdCategoryId = null;
    await testAsync('2. Category creation trims whitespace, rejects blank name, and invalidates bundle cache', async () => {
      const badRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: '   ', sort_order: 0 })
      });
      assert.strictEqual(badRes.status, 400);

      const goodRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: '  Starters  ', name_hi: '  स्टार्टर्स  ', sort_order: 0 })
      });
      const goodData = await goodRes.json();
      assert.strictEqual(goodRes.status, 200);
      assert.strictEqual(goodData.success, true);
      createdCategoryId = goodData.id;

      const adminCats = await fetch(`${baseUrl}/api/categories?admin_view=true&slug=${resto.slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      assert.strictEqual(adminCats.length, 1);
      assert.strictEqual(adminCats[0].name, 'Starters');
    });

    await testAsync('3. Dish creation supports zero price, modifiers, trims whitespace, and refreshes customer bundle', async () => {
      const badRes = await fetch(`${baseUrl}/api/admin/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: '  ', category_id: createdCategoryId, price: 120 })
      });
      assert.strictEqual(badRes.status, 400);

      const freeRes = await fetch(`${baseUrl}/api/admin/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Complimentary Papad', category_id: createdCategoryId, price: 0 })
      });
      assert.strictEqual(freeRes.status, 200);

      const dishRes = await fetch(`${baseUrl}/api/admin/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: '  Paneer Tikka  ',
          category_id: createdCategoryId,
          price: 220,
          price_half: 130,
          type: 'veg',
          modifiers: [{ name: 'Extra Mint Chutney', price: 20 }]
        })
      });
      const dishData = await dishRes.json();
      assert.strictEqual(dishRes.status, 200);
      assert.strictEqual(dishData.success, true);

      const adminDishes = await fetch(`${baseUrl}/api/dishes?admin_view=true&slug=${resto.slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      assert.strictEqual(adminDishes.length, 2);
      assert.strictEqual(adminDishes[0].name, 'Paneer Tikka');

      const bundle = await fetch(`${baseUrl}/api/menu-bundle?slug=${resto.slug}`).then(r => r.json());
      assert.strictEqual(bundle.categories.length, 1);
      assert.strictEqual(bundle.dishes.length, 2);
    });

    await testAsync('4. Quota limits enforce independently on dishes vs categories and return readable messages', async () => {
      await query("UPDATE saas_plans SET max_dishes = 2, max_categories = 5 WHERE LOWER(key) = 'basic'");
      const blockedDishRes = await fetch(`${baseUrl}/api/admin/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Third Dish', category_id: createdCategoryId, price: 150 })
      });
      const blockedDishData = await blockedDishRes.json();
      assert.strictEqual(blockedDishRes.status, 403);
      assert.strictEqual(blockedDishData.error, 'plan_limit_reached');
      assert.ok(blockedDishData.message && blockedDishData.message.includes('maximum of 2 dishes'));

      // Categories remain creatable when only dish quota is reached
      const secondCatRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Beverages' })
      });
      assert.strictEqual(secondCatRes.status, 200);
    });

    await testAsync('5. Frontend catalog save, quota gating, defaultCategoryId, and empty filter recovery contracts', async () => {
      const testDir = path.dirname(fileURLToPath(import.meta.url));
      const rootDir = path.resolve(testDir, '../..');
      const menuViewCode = fs.readFileSync(path.join(rootDir, 'src/components/Admin/views/MenuView.jsx'), 'utf8');
      const dashboardCode = fs.readFileSync(path.join(rootDir, 'src/components/Admin/AdminDashboard.jsx'), 'utf8');
      const dishModalCode = fs.readFileSync(path.join(rootDir, 'src/components/Admin/DishFormModal.jsx'), 'utf8');
      const appCode = fs.readFileSync(path.join(rootDir, 'src/App.jsx'), 'utf8');

      assert.ok(menuViewCode.includes('activeTabAtLimit'), 'MenuView must compute per-tab quota state');
      assert.ok(!menuViewCode.includes('disabled={dishQuota.isAtLimit}'), 'MenuView add buttons must not disable categories/combos based on dish quota');
      assert.ok(menuViewCode.includes('prevDishCountRef'), 'MenuView must reset pagination to page 1 when new dishes are added');
      assert.ok(menuViewCode.includes('Clear Filters'), 'MenuView empty state must offer Clear Filters when filters are active');

      assert.ok(dashboardCode.includes('saveCatalogEntity'), 'AdminDashboard must share saveCatalogEntity helper across dish and category saves');
      assert.ok(dashboardCode.includes('await loadData(true);'), 'AdminDashboard must await loadData(true) before closing modals');
      assert.ok(dashboardCode.includes('defaultCategoryId={selectedCatFilter'), 'AdminDashboard must pass active selectedCatFilter into DishFormModal');

      assert.ok(dishModalCode.includes("defaultCategoryId = ''"), 'DishFormModal must accept defaultCategoryId');
      assert.ok(dishModalCode.includes('noValidate'), 'DishFormModal must use noValidate so multi-tab submit validates across unmounted tabs cleanly');
      assert.ok(dishModalCode.includes('Next: Pricing'), 'DishFormModal must provide Next step navigation across tabs');
      assert.ok(dishModalCode.includes('dish-modal-field'), 'DishFormModal must use unified field styling and focus borders');
      assert.ok(dishModalCode.includes('descriptionHi'), 'DishFormModal Tab 3 must expose Hindi description input');

      const custDishModalCode = fs.readFileSync(path.join(rootDir, 'src/components/DishModal.jsx'), 'utf8');
      assert.ok(custDishModalCode.includes('dish.taste_profile'), 'Customer DishModal must display taste_profile when present');
      assert.ok(appCode.includes('saveInlineCatalogEntity'), 'App.jsx inline dish and category saves must use shared helper and await reload');
      assert.ok(appCode.includes("id: 'uncategorized'"), 'App.jsx uncategorized bucket must have explicit id');
    });

    await testAsync('6. Authoritative Pure Veg resolution does not lock egg/nonveg businesses or bakeries by business_type alone', async () => {
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', is_pure_veg: false, food_type: 'non_veg' }), false);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', food_type: 'veg_nonveg' }), false);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', food_type: 'egg' }), false);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery' }), false);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'sweet_shop' }), false);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', is_pure_veg: false, resto_type: 'pure_veg' }), false);
      assert.strictEqual(isAuthoritativePureVeg({ food_type: 'non_veg', is_pure_veg: true }), false);

      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', is_pure_veg: true, food_type: 'pure_veg' }), true);
      assert.strictEqual(isAuthoritativePureVeg({ food_type: 'only_veg' }), true);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', food_type: 'only_veg', is_pure_veg: false }), true);
      assert.strictEqual(isAuthoritativePureVeg({ business_type: 'bakery_confectionery', food_type: null, resto_type: 'pure_veg', is_pure_veg: false }), false);
      assert.strictEqual(isAuthoritativePureVeg({ resto_type: 'pure_veg' }), true);
      assert.strictEqual(isAuthoritativePureVeg({ resto_type: 'only_veg' }), true);
      assert.strictEqual(isAuthoritativePureVeg({ is_pure_veg: true }), true);
      assert.strictEqual(isAuthoritativePureVeg({ is_pure_veg: '1' }), true);

      const feOnlyVeg = resolveFrontendBusinessProfile({ business_type: 'bakery_confectionery', food_type: 'only_veg', resto_type: 'bakery' });
      const beOnlyVeg = resolveBackendBusinessProfile({ business_type: 'bakery_confectionery', food_type: 'only_veg', resto_type: 'bakery' });
      assert.strictEqual(feOnlyVeg.food_type, 'pure_veg');
      assert.strictEqual(feOnlyVeg.is_pure_veg, true);
      assert.strictEqual(beOnlyVeg.food_type, 'pure_veg');
      assert.strictEqual(beOnlyVeg.is_pure_veg, true);

      const testDir = path.dirname(fileURLToPath(import.meta.url));
      const rootDir = path.resolve(testDir, '../..');
      const dishModalCode = fs.readFileSync(path.join(rootDir, 'src/components/Admin/DishFormModal.jsx'), 'utf8');
      assert.ok(dishModalCode.includes('isAuthoritativePureVeg(restaurantInfo)'), 'DishFormModal must resolve isPureVegResto via isAuthoritativePureVeg');
      assert.ok(!dishModalCode.includes("'bakery_confectionery'") && !dishModalCode.includes("'sweet_shop'"), 'DishFormModal must not lock dietary type from business_type alone');
      assert.ok(dishModalCode.includes('dish?.type || (isPureVegResto'), 'DishFormModal must preserve existing dish.type when permitted');
      assert.ok(dishModalCode.includes("type: isPureVegResto ? 'veg' : type"), 'DishFormModal save payload must preserve non-pure-veg dietary types');
    });

    await testAsync('7. Accessibility controls and price_half persistence with modifiers disabled', async () => {
      // Disable modifiers and raise dish quota on basic tier, then create dish with full=200 and half=100
      await query("UPDATE saas_plans SET modifiers_enabled = 0, max_dishes = 10 WHERE LOWER(key) = 'basic'");

      const halfDishRes = await fetch(`${baseUrl}/api/admin/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Veg Biryani',
          category_id: createdCategoryId,
          price: 200,
          price_half: 100,
          portion_half_label: 'Half',
          portion_full_label: 'Full',
          type: 'veg',
          modifiers: []
        })
      });
      const halfDishData = await halfDishRes.json();
      assert.strictEqual(halfDishRes.status, 200);
      assert.strictEqual(halfDishData.success, true);

      const bundle = await fetch(`${baseUrl}/api/menu-bundle?slug=${resto.slug}`).then(r => r.json());
      assert.strictEqual(bundle.info.modifiers_enabled, false, 'Menu bundle must reflect disabled modifiers flag');
      const savedHalfDish = bundle.dishes.find(d => d.id === halfDishData.id);
      assert.ok(savedHalfDish, 'Dish created while modifiers are disabled must appear in menu bundle');
      assert.strictEqual(Number(savedHalfDish.price), 200);
      assert.strictEqual(Number(savedHalfDish.price_half), 100);

      const testDir = path.dirname(fileURLToPath(import.meta.url));
      const rootDir = path.resolve(testDir, '../..');
      const dishFormCode = fs.readFileSync(path.join(rootDir, 'src/components/Admin/DishFormModal.jsx'), 'utf8');
      const custDishModalCode = fs.readFileSync(path.join(rootDir, 'src/components/DishModal.jsx'), 'utf8');
      const dishCardCode = fs.readFileSync(path.join(rootDir, 'src/components/DishCard.jsx'), 'utf8');
      const menuCardCode = fs.readFileSync(path.join(rootDir, 'src/components/MenuCardItem.jsx'), 'utf8');

      // Finding 1: Keyboard-accessible file upload button + no display: 'none' on file input
      assert.ok(!/type="file"[^>]*display:\s*'none'/.test(dishFormCode), 'DishFormModal file input must not use display: none');
      assert.ok(dishFormCode.includes('fileInputRef.current?.click()') && dishFormCode.includes('onChange={handleFileUpload}'), 'DishFormModal must use focusable native button opening file input while preserving handleFileUpload');

      // Finding 2: Half price retention & portion offering independent of modifiersEnabled
      assert.ok(dishFormCode.includes('price_half: (hasHalf'), 'DishFormModal must serialize price_half independently of modifiersEnabled');
      assert.ok(custDishModalCode.includes("dish.price_half !== null && dish.price_half !== undefined && Number(dish.price_half) > 0") && custDishModalCode.includes("setSelectedPortion('half')"), 'Customer DishModal must offer half portion independently of modifiersEnabled');
      assert.ok(dishCardCode.includes("handleAddAction(e, 'half')") && menuCardCode.includes("setPortionMode('half')"), 'DishCard and MenuCardItem must expose half portion independently of modifiersEnabled');

      // Finding 3: Native button for stock availability with accessible name, aria-pressed, and focus indicator
      const hasSingleAvailabilityButton = (source) => {
        const buttonOpeningTags = source.match(/<button\b(?:[^><{}]|\{(?:[^{}]|\{[^{}]*\})*\})*>/g) || [];
        return buttonOpeningTags.some(tag =>
          /\btype="button"/.test(tag) &&
          /aria-label=\{`Toggle \$\{itemLabel\} availability`\}/.test(tag) &&
          /aria-pressed=\{Boolean\(available\)\}/.test(tag)
        );
      };
      assert.ok(
        hasSingleAvailabilityButton(dishFormCode),
        'DishFormModal availability toggle must be a single native button with type="button", accessible name, and aria-pressed'
      );
      const mutatedWithDiv = dishFormCode.replace(
        /<button\b([^>]*aria-label=\{`Toggle \$\{itemLabel\} availability`\})/,
        '<div$1'
      );
      assert.strictEqual(
        hasSingleAvailabilityButton(mutatedWithDiv),
        false,
        'Replacing the availability button with a div must fail the native button check'
      );
      assert.ok(dishFormCode.includes('.dish-modal-focus-btn:focus-visible'), 'DishFormModal interactive buttons must define visible focus indicators');
    });
  } finally {
    server.close();
  }

  console.log(`\n----------------------------------------------------------------------`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`----------------------------------------------------------------------\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
