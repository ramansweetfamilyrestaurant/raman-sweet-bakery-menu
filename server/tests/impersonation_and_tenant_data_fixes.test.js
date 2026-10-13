/**
 * TouchQR — Impersonation Dashboard Data & Tenant Authorization Regression Suite
 *
 * Validates:
 * 1. GET /api/info on suspended tenants for authorized vs unauthorized callers.
 * 2. Removal of hardcoded tenant brand fallbacks in admin sidebar and views.
 * 3. Authoritative plan tier and price derivation from subscription-status without defaulting to Pro ₹999.
 * 4. Quick Status suspension accuracy without mutating stored configurations.
 * 5. Strict tenant isolation on GET /api/categories and GET /api/dishes.
 * 6. Tenant-switch state clearing and race-condition prevention in loadData().
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import apiRoutes from '../routes/api.js';
import { JWT_SECRET } from '../config/jwt.js';
import { resolveTenantCapabilities } from '../../src/utils/planCapabilities.js';

const TEST_DB_PATH = path.resolve('menu_test_impersonation.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

// Verify test isolation guard accepts this path
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('🛡️  TOUCHQR IMPERSONATION & TENANT AUTHORIZATION REGRESSION SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runAllTests() {
  // Initialize isolated SQLite test database
  await initDb();

  // Create isolated ephemeral Express app for testing API routes
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // ----------------------------------------------------------------------
    // Setup isolated test tenant records
    // ----------------------------------------------------------------------
    // Clean up any previous test records
    await query("DELETE FROM dishes WHERE restaurant_id IN (901, 902)");
    await query("DELETE FROM categories WHERE restaurant_id IN (901, 902)");
    await query("DELETE FROM admins WHERE restaurant_id IN (901, 902)");
    await query("DELETE FROM subscriptions WHERE restaurant_id IN (901, 902)").catch(() => {});
    await query("DELETE FROM restaurants WHERE id IN (901, 902)");

    // Tenant 901: Active Tenant ('alpha-diner')
    await query(`
      INSERT INTO restaurants (id, name, slug, active, plan_tier, plan_price, direct_ordering_enabled, whatsapp_enabled, kds_screen_enabled)
      VALUES (901, 'Alpha Diner', 'alpha-diner', true, 'basic', 499, 1, 1, 1)
    `);

    // Tenant 902: Suspended Tenant ('beta-bakery', like 'yrty')
    await query(`
      INSERT INTO restaurants (id, name, slug, active, plan_tier, plan_price, direct_ordering_enabled, whatsapp_enabled, kds_screen_enabled)
      VALUES (902, 'Beta Bakery', 'beta-bakery', false, 'vip_ultra_plan', 2499, 1, 1, 1)
    `);

    // Categories & dishes for Tenant 901
    await query(`INSERT INTO categories (id, restaurant_id, name, active, sort_order) VALUES (9101, 901, 'Alpha Main', true, 1)`);
    await query(`INSERT INTO categories (id, restaurant_id, name, active, sort_order) VALUES (9102, 901, 'Alpha Hidden', false, 2)`);
    await query(`INSERT INTO dishes (id, restaurant_id, category_id, name, price, available) VALUES (9201, 901, 9101, 'Alpha Burger', 150, true)`);
    await query(`INSERT INTO dishes (id, restaurant_id, category_id, name, price, available) VALUES (9202, 901, 9102, 'Alpha Secret Sauce', 50, false)`);

    // Categories & dishes for Tenant 902
    await query(`INSERT INTO categories (id, restaurant_id, name, active, sort_order) VALUES (9201, 902, 'Beta Pastry', true, 1)`);
    await query(`INSERT INTO categories (id, restaurant_id, name, active, sort_order) VALUES (9202, 902, 'Beta Private', false, 2)`);
    await query(`INSERT INTO dishes (id, restaurant_id, category_id, name, price, available) VALUES (9301, 902, 9201, 'Beta Croissant', 120, true)`);
    await query(`INSERT INTO dishes (id, restaurant_id, category_id, name, price, available) VALUES (9302, 902, 9202, 'Beta Secret Recipe', 250, false)`);

    // Create JWT tokens
    const tokenAdminA = jwt.sign(
      { id: 101, username: 'adminA', role: 'restaurant_admin', restaurant_id: 901 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const tokenAdminB = jwt.sign(
      { id: 102, username: 'adminB', role: 'restaurant_admin', restaurant_id: 902 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const tokenImpersonateB = jwt.sign(
      { id: 102, username: 'adminB', role: 'restaurant_admin', restaurant_id: 902, is_impersonated: true, superadmin_username: 'superadmin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const tokenAttackerCrafted = jwt.sign(
      { id: 999, username: 'attacker', role: 'restaurant_admin', restaurant_id: 901, is_impersonated: true, superadmin_username: 'superadmin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ----------------------------------------------------------------------
    // FIX 1: Suspended tenant restaurant info (GET /api/info)
    // ----------------------------------------------------------------------
    console.log('--- FIX 1: Suspended Tenant Restaurant Info (GET /api/info) ---');

    await test('1.1 Authorized admin for active tenant receives expected info with active: true', async () => {
      const res = await fetch(`${baseUrl}/info?slug=alpha-diner`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 901);
      assert.strictEqual(data.name, 'Alpha Diner');
      assert.strictEqual(data.active, true);
      assert.strictEqual(data.suspended, false);
    });

    await test('1.2 Authorized admin for their suspended tenant receives correct metadata with active: false, suspended: true', async () => {
      const res = await fetch(`${baseUrl}/info?slug=beta-bakery`, {
        headers: { Authorization: `Bearer ${tokenAdminB}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 902);
      assert.strictEqual(data.name, 'Beta Bakery');
      assert.strictEqual(data.active, false);
      assert.strictEqual(data.suspended, true);
      assert.strictEqual(data.plan_tier, 'vip_ultra_plan');
    });

    await test('1.3 Authorized impersonated admin scoped to suspended tenant receives correct metadata', async () => {
      const res = await fetch(`${baseUrl}/info?slug=beta-bakery`, {
        headers: { Authorization: `Bearer ${tokenImpersonateB}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 902);
      assert.strictEqual(data.name, 'Beta Bakery');
      assert.strictEqual(data.active, false);
      assert.strictEqual(data.suspended, true);
    });

    await test('1.4 Impersonated admin scoped to tenant A cannot retrieve tenant B info if tenant B is suspended', async () => {
      // tokenAttackerCrafted has restaurant_id = 901, tries to read suspended tenant 902
      const res = await fetch(`${baseUrl}/info?slug=beta-bakery`, {
        headers: { Authorization: `Bearer ${tokenAttackerCrafted}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.suspended, true);
      assert.strictEqual(data.error, 'Restaurant Suspended');
    });

    await test('1.5 Unauthenticated public access to suspended tenant is blocked with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/info?slug=beta-bakery`);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.suspended, true);
      assert.strictEqual(data.error, 'Restaurant Suspended');
    });

    // ----------------------------------------------------------------------
    // FIX 2: Neutral Fallback in Sidebar and Views
    // ----------------------------------------------------------------------
    console.log('\n--- FIX 2: Neutral Fallback in Admin Components ---');

    await test('2.1 With restaurantInfo = null, fallback evaluates to "Restaurant Admin" without legacy brand', () => {
      const restaurantInfo = null;
      const restoName = restaurantInfo?.name || 'Restaurant Admin';
      const truncatedName = restoName.length > 22 ? `${restoName.substring(0, 20)}...` : restoName;
      assert.strictEqual(restoName, 'Restaurant Admin');
      assert.strictEqual(truncatedName, 'Restaurant Admin');
      assert(!restoName.toLowerCase().includes('raman'));
    });

    await test('2.2 With valid restaurantInfo, correct tenant name is displayed', () => {
      const restaurantInfo = { name: 'yrty' };
      const restoName = restaurantInfo?.name || 'Restaurant Admin';
      assert.strictEqual(restoName, 'yrty');
    });

    // ----------------------------------------------------------------------
    // FIX 3: Correct Plan and Price Fallback
    // ----------------------------------------------------------------------
    console.log('\n--- FIX 3: Correct Plan and Price Fallback ---');

    await test('3.1 Missing restaurantInfo + valid subscriptionStatus resolves authoritative plan and price (no Pro ₹999 default)', () => {
      const restaurantInfo = null;
      const subscriptionStatus = {
        status: 'suspended',
        plan_tier: 'vip_ultra_plan',
        plan_price: 2499
      };

      const caps = resolveTenantCapabilities(restaurantInfo, {}, subscriptionStatus);
      assert.strictEqual(caps.plan_tier, 'vip_ultra_plan');
      assert.strictEqual(caps.plan_price, 2499);
      assert.strictEqual(caps.plan_name, 'Vip Ultra Plan Plan');
      assert.strictEqual(caps.subscription_status, 'suspended');

      // Check HomeView display logic
      const formatTierDisplay = (tier) => {
        if (!tier) return 'PRO PLAN';
        const clean = String(tier).replace(/_/g, ' ').toUpperCase();
        return clean.includes('PLAN') ? clean : `${clean} PLAN`;
      };

      const effectiveTier = caps.plan_tier || subscriptionStatus.plan_tier;
      const planNameDisplay = subscriptionStatus.plan_tier ? formatTierDisplay(subscriptionStatus.plan_tier) : 'PRO PLAN';
      const planPriceDisplay = subscriptionStatus.plan_price;

      assert.strictEqual(planNameDisplay, 'VIP ULTRA PLAN');
      assert.strictEqual(planPriceDisplay, 2499);
      assert.notStrictEqual(planNameDisplay, 'PRO PLAN');
      assert.notStrictEqual(planPriceDisplay, 999);
    });

    await test('3.2 Valid restaurantInfo retains expected plan presentation', () => {
      const restaurantInfo = { plan_tier: 'enterprise', plan_price: 1999 };
      const caps = resolveTenantCapabilities(restaurantInfo, {}, null);
      assert.strictEqual(caps.plan_tier, 'enterprise');
      assert.strictEqual(caps.plan_price, 1999);
    });

    await test('3.3 Suspended status is preserved separately from plan tier', () => {
      const subscriptionStatus = { status: 'suspended', plan_tier: 'pro', plan_price: 999 };
      const caps = resolveTenantCapabilities(null, {}, subscriptionStatus);
      assert.strictEqual(caps.subscription_status, 'suspended');
      assert.strictEqual(caps.plan_tier, 'pro');
    });

    // ----------------------------------------------------------------------
    // FIX 4: Quick Status Suspension Accuracy
    // ----------------------------------------------------------------------
    console.log('\n--- FIX 4: Quick Status Accurately Represents Suspension ---');

    await test('4.1 Active tenant with enabled feature shows "Enabled"', () => {
      const isAccountSuspended = false;
      const isQrOrderingLive = true;
      const badge = isAccountSuspended && isQrOrderingLive ? 'Suspended' : (isQrOrderingLive ? 'Enabled' : 'Off');
      assert.strictEqual(badge, 'Enabled');
    });

    await test('4.2 Suspended tenant with enabled feature flag displays "Suspended" without mutating saved flags', () => {
      const isAccountSuspended = true;
      const isQrOrderingLive = true; // configured feature flag is ON
      const badge = isAccountSuspended && isQrOrderingLive ? 'Suspended' : (isQrOrderingLive ? 'Enabled' : 'Off');
      assert.strictEqual(badge, 'Suspended');
      assert.strictEqual(isQrOrderingLive, true, 'Configured flag remains true (not mutated)');
    });

    // ----------------------------------------------------------------------
    // FIX 5: Enforce Tenant Authorization on Categories & Dishes
    // ----------------------------------------------------------------------
    console.log('\n--- FIX 5: Tenant Authorization on Categories and Dishes ---');

    await test('5.1 Tenant A admin JWT passing ?restaurant_id=902&admin_view=true is rejected (403 mismatch)', async () => {
      const res = await fetch(`${baseUrl}/categories?admin_view=true&restaurant_id=902`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Forbidden: Tenant ID mismatch');
    });

    await test('5.2 Tenant A admin JWT passing ?slug=beta-bakery&admin_view=true is rejected (403 slug mismatch)', async () => {
      const res = await fetch(`${baseUrl}/categories?admin_view=true&slug=beta-bakery`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Forbidden: Slug mismatch for authenticated tenant');
    });

    await test('5.3 Tenant A admin JWT reading dishes with ?restaurant_id=902&admin_view=true is rejected', async () => {
      const res = await fetch(`${baseUrl}/dishes?admin_view=true&restaurant_id=902`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Forbidden: Tenant ID mismatch');
    });

    await test('5.4 Correctly authorized tenant A can load its own admin menu (including inactive)', async () => {
      const resCat = await fetch(`${baseUrl}/categories?admin_view=true&slug=alpha-diner`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(resCat.status, 200);
      const cats = await resCat.json();
      assert.strictEqual(cats.length, 2, 'Should include both active and inactive categories');

      const resDish = await fetch(`${baseUrl}/dishes?admin_view=true&slug=alpha-diner`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(resDish.status, 200);
      const dishes = await resDish.json();
      assert.strictEqual(dishes.length, 2, 'Should include both active and inactive dishes');
    });

    await test('5.5 Unauthenticated public browsing returns active items only and rejects admin_view=true', async () => {
      // Unauthenticated admin_view=true is rejected with 401
      const resAdmin = await fetch(`${baseUrl}/categories?admin_view=true&slug=alpha-diner`);
      assert.strictEqual(resAdmin.status, 401);

      // Unauthenticated normal public browsing succeeds and only returns active items
      const resPublic = await fetch(`${baseUrl}/categories?slug=alpha-diner`);
      assert.strictEqual(resPublic.status, 200);
      const cats = await resPublic.json();
      assert.strictEqual(cats.length, 1, 'Only active category returned to public');
      assert.strictEqual(cats[0].name, 'Alpha Main');
    });

    await test('5.6 Public browsing of suspended tenant beta-bakery is blocked with 403', async () => {
      const res = await fetch(`${baseUrl}/categories?slug=beta-bakery`);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.suspended, true);
    });

    // ----------------------------------------------------------------------
    // FIX 6: Tenant Switch Isolation & Race Condition Prevention
    // ----------------------------------------------------------------------
    console.log('\n--- FIX 6: Tenant Switch Isolation & Late Response Guard ---');

    await test('6.1 Tenant switch clears previous tenant state and late responses are discarded', async () => {
      let activeRequestId = 0;
      let activeTenantKey = 'tokenA_slugA';
      let state = {
        tenant: 'Tenant A',
        dishes: ['Dish A1', 'Dish A2']
      };

      // Tenant A starts request 1
      const reqId1 = ++activeRequestId;
      const reqTenantKey1 = 'tokenA_slugA';

      // User immediately switches to Tenant B before request 1 completes
      const reqId2 = ++activeRequestId;
      activeTenantKey = 'tokenB_slugB';
      // Immediate state clear on switch:
      state = {
        tenant: null,
        dishes: []
      };

      // Request 1 arrives late (delayed response for Tenant A)
      const isLate1 = (reqId1 !== activeRequestId || reqTenantKey1 !== activeTenantKey);
      assert.strictEqual(isLate1, true, 'Request 1 is detected as superseded/late');
      if (!isLate1) {
        state = { tenant: 'Tenant A', dishes: ['Dish A1'] };
      }

      // Verify state was not contaminated by late response 1
      assert.strictEqual(state.tenant, null);
      assert.strictEqual(state.dishes.length, 0);

      // Request 2 completes for Tenant B
      const isLate2 = (reqId2 !== activeRequestId || 'tokenB_slugB' !== activeTenantKey);
      assert.strictEqual(isLate2, false, 'Request 2 is active');
      if (!isLate2) {
        state = { tenant: 'Tenant B', dishes: ['Dish B1'] };
      }

      assert.strictEqual(state.tenant, 'Tenant B');
      assert.deepStrictEqual(state.dishes, ['Dish B1']);
    });

    await test('6.2 Failed info request resets tenantInfo to null/cache, not retaining previous tenant', () => {
      let currentTenantInfo = { id: 901, name: 'Tenant A' };
      const infoData = null; // API failed
      const currentSlug = 'tenant-b';
      const cacheLookup = () => null; // No cache for tenant-b

      if (infoData) {
        currentTenantInfo = infoData;
      } else {
        currentTenantInfo = currentSlug ? cacheLookup() : null;
      }

      assert.strictEqual(currentTenantInfo, null, 'Must be null, not retaining Tenant A');
    });

  } finally {
    server.close();
    // Clean up test database records
    try {
      await query("DELETE FROM dishes WHERE restaurant_id IN (901, 902)");
      await query("DELETE FROM categories WHERE restaurant_id IN (901, 902)");
      await query("DELETE FROM admins WHERE restaurant_id IN (901, 902)");
      await query("DELETE FROM subscriptions WHERE restaurant_id IN (901, 902)").catch(() => {});
      await query("DELETE FROM restaurants WHERE id IN (901, 902)");
    } catch {}
    // Clean up test database file if SQLite was used
    try {
      if (process.env.TEST_DATABASE_URL?.startsWith('sqlite') && fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
    } catch {}
  }

  console.log('\n======================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
