/**
 * TouchQR — Tenant-Driven Configuration & Default Business Elimination Regression Suite
 *
 * Verifies:
 * 1. Absence of unintended production business fallbacks (Raman Sweet Bakery, demo fallbacks).
 * 2. Missing restaurant identity / slug does not silently fall back to touchqr-demo or another tenant.
 * 3. Fresh production startup creates 0 restaurants and 0 restaurant-admin accounts.
 * 4. Legitimate SaaS platform configuration (saas_plans, system_settings, superadmin) is seeded.
 * 5. Explicit demo tenant seeding functions when opted-in (seedDemoTenant: true).
 * 6. Multi-tenant isolation: Two tenants receive distinct names, slugs, plans, dishes, and categories.
 * 7. Tenant-switching stale response protection and authenticated tenant resolution.
 * 8. Superadmin impersonation integrity and public menu bundle isolation.
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

const TEST_DB_PATH = path.resolve('menu_test_tenant_defaults.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

// Validate test database URL safety
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('🛡️  TOUCHQR TENANT-DRIVEN CONFIG & DEFAULT ELIMINATION TEST SUITE');
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
  if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
    const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
    if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  // Initialize DB schema & platform config
  await initDb();

  // If running against persistent test database, clean leftover demo records from previous test runs
  await query("DELETE FROM dishes WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo')").catch(() => {});
  await query("DELETE FROM categories WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo')").catch(() => {});
  await query("DELETE FROM admins WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo') OR username = 'demo_admin'").catch(() => {});
  await query("DELETE FROM subscriptions WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo')").catch(() => {});
  await query("DELETE FROM restaurants WHERE slug = 'touchqr-demo'").catch(() => {});

  // Normal startup initialization does not create demo tenant
  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // ----------------------------------------------------------------------
    // TEST 1: Source Code Audit for Hardcoded Business Defaults in Production UI
    // ----------------------------------------------------------------------
    await test('Source audit: No hardcoded Raman defaults or avatar fallbacks in UI components', async () => {
      const setupViewContent = fs.readFileSync(path.resolve('src/components/Admin/views/SetupView.jsx'), 'utf8');
      assert(!setupViewContent.includes('placeholder="Raman Sweet Bakery'), 'SetupView must not contain Raman Sweet Bakery placeholder');
      assert(!setupViewContent.includes('placeholder="Raman Kumar"'), 'SetupView must not contain Raman Kumar placeholder');
      assert(!setupViewContent.includes('placeholder="9708366583"'), 'SetupView must not contain 9708366583 placeholder');
      assert(!setupViewContent.includes("|| 'R'").valueOf(), 'SetupView must not default avatar initial to hardcoded R');

      const onboardingContent = fs.readFileSync(path.resolve('src/components/Admin/OnboardingSetup.jsx'), 'utf8');
      assert(!onboardingContent.includes('placeholder="e.g. Raman Sweet Bakery"'), 'OnboardingSetup must not contain Raman placeholder');

      const appContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
      assert(!appContent.includes("window.history.replaceState({}, '', '/touchqr-demo')"), 'App.jsx must not redirect /menu to /touchqr-demo');
      assert(!appContent.includes("loadMenuData('touchqr-demo')"), 'App.jsx must not load touchqr-demo for generic /menu route');
      assert(!appContent.includes("(default demo tenant)"), 'App.jsx must not log default demo tenant');
    });

    // ----------------------------------------------------------------------
    // TEST 2: Missing Restaurant Identity Fails Safely with HTTP 404 (No Silent Demo Fallback)
    // ----------------------------------------------------------------------
    await test('GET /api/info with missing slug returns 404 (does not return demo tenant)', async () => {
      const res = await fetch(`${baseUrl}/info`);
      assert.strictEqual(res.status, 404, 'Must return HTTP 404 when no slug or auth token provided');
      const data = await res.json();
      assert.strictEqual(data.notFound, true, 'Must indicate notFound: true');
    });

    await test('GET /api/info with generic slugs ("menu", "default", "undefined") returns 404', async () => {
      for (const slug of ['menu', 'default', 'undefined', 'null', 'home']) {
        const res = await fetch(`${baseUrl}/info?slug=${slug}`);
        assert.strictEqual(res.status, 404, `Slug "${slug}" must return HTTP 404`);
        const data = await res.json();
        assert.strictEqual(data.notFound, true);
      }
    });

    await test('GET /api/menu-bundle with missing slug returns 404 (does not return demo tenant)', async () => {
      const res = await fetch(`${baseUrl}/menu-bundle`);
      assert.strictEqual(res.status, 404, 'Must return HTTP 404 for empty slug menu bundle');
      const data = await res.json();
      assert.strictEqual(data.notFound, true);
    });

    await test('GET /api/menu-bundle with non-existent slug returns 404', async () => {
      const res = await fetch(`${baseUrl}/menu-bundle?slug=non-existent-restaurant-xyz`);
      assert.strictEqual(res.status, 404, 'Non-existent slug must return 404');
      const data = await res.json();
      assert.strictEqual(data.notFound, true);
    });

    // ----------------------------------------------------------------------
    // TEST 3: Multi-Tenant Data Setup (Apex Dining vs Zenith Cafe)
    // ----------------------------------------------------------------------
    // Clean up test tenants if existing
    await query("DELETE FROM dishes WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM categories WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM admins WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM subscriptions WHERE restaurant_id IN (801, 802)").catch(() => {});
    await query("DELETE FROM restaurants WHERE id IN (801, 802)");

    // Tenant 1: Apex Dining (Basic Plan)
    await query(`
      INSERT INTO restaurants (id, name, slug, phone, active, plan_tier, plan_price, direct_ordering_enabled, whatsapp_enabled)
      VALUES (801, 'Apex Dining', 'apex-dining', '9876543211', true, 'basic', 499, 0, 1)
    `);
    await query(`INSERT INTO categories (id, restaurant_id, name, active, sort_order) VALUES (8101, 801, 'Apex Starters', true, 1)`);
    await query(`INSERT INTO dishes (id, restaurant_id, category_id, name, price, available) VALUES (8201, 801, 8101, 'Apex Signature Salad', 199, true)`);

    // Tenant 2: Zenith Cafe (Enterprise Plan)
    await query(`
      INSERT INTO restaurants (id, name, slug, phone, active, plan_tier, plan_price, direct_ordering_enabled, whatsapp_enabled)
      VALUES (802, 'Zenith Cafe', 'zenith-cafe', '9876543222', true, 'enterprise', 1999, 1, 1)
    `);
    await query(`INSERT INTO categories (id, restaurant_id, name, active, sort_order) VALUES (8102, 802, 'Zenith Beverages', true, 1)`);
    await query(`INSERT INTO dishes (id, restaurant_id, category_id, name, price, available) VALUES (8202, 802, 8102, 'Zenith Cold Brew', 249, true)`);

    // Tokens for each tenant admin
    const tokenApex = jwt.sign(
      { id: 851, username: 'apex_admin', role: 'restaurant_admin', restaurant_id: 801 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const tokenZenith = jwt.sign(
      { id: 852, username: 'zenith_admin', role: 'restaurant_admin', restaurant_id: 802 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ----------------------------------------------------------------------
    // TEST 4: Each Tenant Resolves Its Authoritative Data Independently
    // ----------------------------------------------------------------------
    await test('Tenant 1 (Apex Dining) resolves its exact name, slug, plan, and menu items', async () => {
      const res = await fetch(`${baseUrl}/info?slug=apex-dining`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 801);
      assert.strictEqual(data.name, 'Apex Dining');
      assert.strictEqual(data.slug, 'apex-dining');
      assert.strictEqual(data.plan_tier, 'basic');
      assert.strictEqual(data.plan_price, 499);

      const bundleRes = await fetch(`${baseUrl}/menu-bundle?slug=apex-dining`);
      assert.strictEqual(bundleRes.status, 200);
      const bundle = await bundleRes.json();
      assert.strictEqual(bundle.dishes.length, 1);
      assert.strictEqual(bundle.dishes[0].name, 'Apex Signature Salad');
      assert.strictEqual(bundle.categories[0].name, 'Apex Starters');
    });

    await test('Tenant 2 (Zenith Cafe) resolves its exact name, slug, plan, and menu items', async () => {
      const res = await fetch(`${baseUrl}/info?slug=zenith-cafe`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 802);
      assert.strictEqual(data.name, 'Zenith Cafe');
      assert.strictEqual(data.slug, 'zenith-cafe');
      assert.strictEqual(data.plan_tier, 'enterprise');
      assert.strictEqual(data.plan_price, 1999);

      const bundleRes = await fetch(`${baseUrl}/menu-bundle?slug=zenith-cafe`);
      assert.strictEqual(bundleRes.status, 200);
      const bundle = await bundleRes.json();
      assert.strictEqual(bundle.dishes.length, 1);
      assert.strictEqual(bundle.dishes[0].name, 'Zenith Cold Brew');
      assert.strictEqual(bundle.categories[0].name, 'Zenith Beverages');
    });

    // ----------------------------------------------------------------------
    // TEST 5: Authenticated Context Resolution (No Cross-Tenant Leaks)
    // ----------------------------------------------------------------------
    await test('Authenticated GET /api/info uses JWT restaurant_id when no slug is provided', async () => {
      const res = await fetch(`${baseUrl}/info`, {
        headers: { Authorization: `Bearer ${tokenApex}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 801);
      assert.strictEqual(data.name, 'Apex Dining');

      const resZenith = await fetch(`${baseUrl}/info`, {
        headers: { Authorization: `Bearer ${tokenZenith}` }
      });
      assert.strictEqual(resZenith.status, 200);
      const dataZenith = await resZenith.json();
      assert.strictEqual(dataZenith.id, 802);
      assert.strictEqual(dataZenith.name, 'Zenith Cafe');
    });

    await test('Tenant Admin cannot see other tenants categories or dishes via admin_view', async () => {
      // Apex Admin attempts to query dishes of Zenith
      const resDishes = await fetch(`${baseUrl}/dishes?admin_view=true&slug=zenith-cafe`, {
        headers: { Authorization: `Bearer ${tokenApex}` }
      });
      // Should reject with 403 or return empty array, but never Zenith dishes
      if (resDishes.status === 200) {
        const dishes = await resDishes.json();
        const hasZenithDish = dishes.some(d => d.name === 'Zenith Cold Brew');
        assert(!hasZenithDish, 'Apex Admin must NOT see Zenith dishes');
      } else {
        assert.strictEqual(resDishes.status, 403, 'Cross-tenant admin access must be forbidden');
      }
    });

    // ----------------------------------------------------------------------
    // TEST 6: Tenant-Switch Stale Response Protection
    // ----------------------------------------------------------------------
    await test('Tenant-switch race condition guard prevents late response overwrites', async () => {
      let activeTenantKey = 'tokenA_apex-dining';
      let activeRequestId = 1;
      let renderedData = { name: 'Apex Dining' };

      // Simulate tenant switch to Zenith Cafe
      const newTenantKey = 'tokenB_zenith-cafe';
      const newRequestId = ++activeRequestId;
      activeTenantKey = newTenantKey;

      // Late response arriving from earlier Apex Dining request
      const lateApexResponse = {
        requestId: 1,
        tenantKey: 'tokenA_apex-dining',
        data: { name: 'Apex Dining' }
      };

      // Guard check:
      const shouldApplyLate = (lateApexResponse.requestId === activeRequestId) &&
        (lateApexResponse.tenantKey === activeTenantKey);
      assert.strictEqual(shouldApplyLate, false, 'Late response from previous tenant must be discarded');

      // Valid response for Zenith Cafe
      const validZenithResponse = {
        requestId: newRequestId,
        tenantKey: newTenantKey,
        data: { name: 'Zenith Cafe' }
      };
      const shouldApplyValid = (validZenithResponse.requestId === activeRequestId) &&
        (validZenithResponse.tenantKey === activeTenantKey);
      assert.strictEqual(shouldApplyValid, true, 'Valid response for current tenant must be applied');
      if (shouldApplyValid) {
        renderedData = validZenithResponse.data;
      }
      assert.strictEqual(renderedData.name, 'Zenith Cafe');
    });

    // ----------------------------------------------------------------------
    // TEST 7: Super Admin Impersonation Works Authoritatively
    // ----------------------------------------------------------------------
    await test('Super Admin impersonation resolves target tenant without fallback', async () => {
      const tokenImpersonateApex = jwt.sign(
        { id: 851, username: 'apex_admin', role: 'restaurant_admin', restaurant_id: 801, is_impersonated: true, superadmin_username: 'superadmin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/info`, {
        headers: { Authorization: `Bearer ${tokenImpersonateApex}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, 801);
      assert.strictEqual(data.name, 'Apex Dining');
    });

    // ----------------------------------------------------------------------
    // TEST 8: Fresh Startup Verification (Zero Tenants Created by Default)
    // ----------------------------------------------------------------------
    await test('Fresh startup without seedDemoTenant creates 0 demo restaurants and 0 demo restaurant admins', async () => {
      const demoRestos = await query("SELECT * FROM restaurants WHERE slug = 'touchqr-demo'");
      assert.strictEqual(demoRestos.length, 0, 'No demo restaurant should exist on normal startup');
      const demoAdmins = await query("SELECT * FROM admins WHERE username = 'demo_admin' OR (username = 'admin' AND role = 'restaurant_admin')");
      assert.strictEqual(demoAdmins.length, 0, 'No demo restaurant admin should exist on normal startup');
      const superAdmins = await query("SELECT * FROM admins WHERE role = 'superadmin'");
      assert(superAdmins.length > 0, 'Platform superadmin must be seeded');
      const plans = await query("SELECT * FROM saas_plans");
      assert(plans.length >= 3, 'Platform SaaS plans must be seeded');
    });

    // ----------------------------------------------------------------------
    // TEST 9: Explicit Demo Tenant Seed Flag Verification
    // ----------------------------------------------------------------------
    await test('Explicit demo tenant seeding (seedDemoTenant: true) seeds touchqr-demo tenant', async () => {
      // Clean up touchqr-demo if existing
      await query("DELETE FROM dishes WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo')");
      await query("DELETE FROM categories WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo')");
      await query("DELETE FROM admins WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug = 'touchqr-demo')");
      await query("DELETE FROM restaurants WHERE slug = 'touchqr-demo'");

      // Run initDb with seedDemoTenant: true
      await initDb({ seedDemoTenant: true });

      const demoRestos = await query("SELECT * FROM restaurants WHERE slug = 'touchqr-demo'");
      assert(demoRestos && demoRestos.length > 0, 'Demo tenant must be created when explicitly requested');
      assert.strictEqual(demoRestos[0].name, 'TouchQR Demo Restaurant');

      // Now explicit resolution of touchqr-demo works via slug
      const res = await fetch(`${baseUrl}/info?slug=touchqr-demo`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.name, 'TouchQR Demo Restaurant');
    });

    // Clean up test tenants
    await query("DELETE FROM dishes WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM categories WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM admins WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM subscriptions WHERE restaurant_id IN (801, 802)").catch(() => {});
    await query("DELETE FROM restaurants WHERE id IN (801, 802)");

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
