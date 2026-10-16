/**
 * TouchQR — VIP Access End-to-End Regression Test Suite
 *
 * Validates all 12 Phase 6 VIP access lifecycle requirements:
 * 1. Super Admin creates a VIP tenant; database state is correct.
 * 2. /api/info and /api/admin/subscription-status return consistent VIP metadata.
 * 3. resolveTenantCapabilities() shows complimentary/VIP access, ₹0 and expected plan name.
 * 4. VIP tenants on basic/pro base tiers can place eligible direct QR orders.
 * 5. VIP KDS, dual-printer and combo entitlements follow intended policy.
 * 6. Editing VIP profile details preserves ₹0 and complimentary status.
 * 7. Grant/revoke invalidates cached status and updates effective access.
 * 8. Revoke does not grant VIP capabilities afterward.
 * 9. Existing paid, pending-mandate and 16-day trial tenants retain correct behavior.
 * 10. Forged client-provided VIP identifiers cannot grant access.
 * 11. Impersonation uses selected tenant's actual data.
 * 12. Re-running relevant operations does not corrupt subscription or payment records.
 */

import assert from 'assert';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Ensure test database isolation before loading db pool
const DEFAULT_TEST_SQLITE = 'sqlite:menu_test_runner.db';
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = DEFAULT_TEST_SQLITE;
}

import { checkTestDatabaseRequirement, validateTestDatabaseUrl } from './testDbGuard.js';

try {
  checkTestDatabaseRequirement('VIP Access Lifecycle E2E Regression Suite');
} catch (guardErr) {
  console.error(`❌ ${guardErr.message}`);
  process.exit(1);
}

import { query, initDb, closeDbPool, getDbType } from '../db.js';
import superadminRoutes from '../routes/superadmin.js';
import adminRoutes from '../routes/admin.js';
import apiRoutes from '../routes/api.js';
import { JWT_SECRET } from '../config/jwt.js';
import { resolveTenantCapabilities } from '../../src/utils/planCapabilities.js';
import { clearSubStatusCache } from '../middleware/auth.js';
import { isAuthoritativeComplimentaryTenant } from '../services/subscriptionState.js';
import { generateHmacQrToken, generateRestaurantQrSecret } from '../utils/qrSecurity.js';
import { generatePresenceToken, generateQrContextHash } from '../utils/presenceVerification.js';

console.log('======================================================================');
console.log('👑  TOUCHQR VIP ACCESS LIFECYCLE E2E REGRESSION SUITE');
console.log('======================================================================\n');

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(`     Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    }
    failedCount++;
  }
}

async function runAllTests() {
  await initDb();

  // Create isolated express app
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin', superadminRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Helper tokens
  const superAdminToken = jwt.sign(
    { id: 1, username: 'superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  function makeAdminToken(adminId, restoId, username = 'admin_user') {
    return jwt.sign(
      { id: adminId, restaurant_id: restoId, username, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  try {
    // Ensure saas_plans have required test rows
    const ensurePlan = async (key, name, price, maxCombos = 9999, directOrdering = 1, kds = 1) => {
      const existing = await query('SELECT * FROM saas_plans WHERE key = $1', [key]);
      if (!existing || existing.length === 0) {
        await query(`
          INSERT INTO saas_plans (key, name, price, max_combos, direct_ordering_enabled, kds_enabled, dual_printer_enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [key, name, price, maxCombos, directOrdering, kds, key === 'enterprise' ? 1 : 0]);
      }
    };

    await ensurePlan('basic', 'Basic Starter Plan', 499, 1, 0, 0);
    await ensurePlan('pro', 'Pro Luxury Plan', 999, 10, 0, 0);
    await ensurePlan('enterprise', 'Enterprise VIP Plan', 1999, 9999, 1, 1);

    await query("UPDATE saas_plans SET kds_enabled = 0, direct_ordering_enabled = 0, dual_printer_enabled = 0, max_combos = 1 WHERE key = 'basic'");
    await query("UPDATE saas_plans SET kds_enabled = 0, direct_ordering_enabled = 0, dual_printer_enabled = 0, max_combos = 10 WHERE key = 'pro'");
    await query("UPDATE saas_plans SET kds_enabled = 1, direct_ordering_enabled = 1, dual_printer_enabled = 1, max_combos = 9999 WHERE key = 'enterprise'");

    const testTimestamp = Date.now();

    // --------------------------------------------------------------------------
    // TEST 1: Super Admin creates a VIP tenant; database state is correct
    // --------------------------------------------------------------------------
    let createdVipRestoId = null;
    let createdVipAdminId = null;
    const vipSlug = `vip-e2e-${testTimestamp}`;
    const vipUsername = `vipuser_${testTimestamp}`;

    await test('1. Super Admin creates a VIP tenant with correct database state', async () => {
      const res = await fetch(`${baseUrl}/superadmin/restaurants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          name: 'VIP Grand Palace',
          slug: vipSlug,
          owner_username: vipUsername,
          owner_password: 'Password123!',
          phone: `99${String(Date.now()).slice(-8)}`,
          address: '77 VIP Boulevard',
          onboarding_mode: 'vip',
          isVip: true
        })
      });

      const body = await res.json();
      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}: ${JSON.stringify(body)}`);
      assert(body.success, 'Response should have success: true');
      createdVipRestoId = body.restaurant_id || body.id;
      assert(createdVipRestoId, 'Created restaurant id should be present');

      // Check DB records in restaurants
      const restoRows = await query('SELECT * FROM restaurants WHERE id = $1', [createdVipRestoId]);
      assert.strictEqual(restoRows.length, 1, 'Restaurant row must exist in DB');
      const resto = restoRows[0];

      assert.strictEqual(resto.subscription_type, 'ADMIN_GRANTED', 'subscription_type must be ADMIN_GRANTED');
      assert.strictEqual(resto.mandate_status, 'admin_granted', 'mandate_status must be admin_granted');
      assert.strictEqual(Number(resto.auto_debit_enabled), 0, 'auto_debit_enabled must be 0');
      assert.strictEqual(Number(resto.plan_price), 0, 'plan_price must be 0');
      assert.strictEqual(resto.active === 1 || resto.active === true || resto.active === '1', true, 'Tenant must be active');

      // Check DB records in subscriptions
      const subRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [createdVipRestoId]);
      assert(subRows.length > 0, 'Subscription row must exist');
      const sub = subRows[0];
      assert.strictEqual(sub.gateway, 'admin_granted', 'Gateway must be admin_granted');
      assert.strictEqual(sub.status, 'active', 'Subscription status must be active');
      assert.strictEqual(Number(sub.amount), 0, 'Subscription amount must be 0');
      assert.strictEqual(Number(sub.auto_renew), 0, 'auto_renew must be 0');
      assert.strictEqual(sub.subscription_type, 'ADMIN_GRANTED', 'subscription_type must be ADMIN_GRANTED');

      // Check admin user created
      const adminRows = await query('SELECT * FROM admins WHERE restaurant_id = $1', [createdVipRestoId]);
      assert(adminRows.length > 0, 'Admin row must exist');
      createdVipAdminId = adminRows[0].id;
    });

    let vipAdminToken = makeAdminToken(createdVipAdminId || 1, createdVipRestoId, vipUsername);

    // --------------------------------------------------------------------------
    // TEST 2: /api/info and /api/admin/subscription-status return consistent VIP metadata
    // --------------------------------------------------------------------------
    await test('2. /api/info and /api/admin/subscription-status return consistent VIP metadata', async () => {
      // 1. GET /api/info
      const infoRes = await fetch(`${baseUrl}/info?slug=${vipSlug}`);
      assert.strictEqual(infoRes.status, 200, 'GET /api/info must succeed');
      const infoData = await infoRes.json();

      assert.strictEqual(infoData.subscription_type, 'ADMIN_GRANTED', 'info.subscription_type must be ADMIN_GRANTED');
      assert.strictEqual(infoData.mandate_status, 'admin_granted', 'info.mandate_status must be admin_granted');
      assert.strictEqual(infoData.is_complimentary, true, 'info.is_complimentary must be true');
      assert.strictEqual(infoData.is_vip, true, 'info.is_vip must be true');
      assert.strictEqual(infoData.plan_price, 0, 'info.plan_price must be 0');
      assert.strictEqual(infoData.plan_name, 'Enterprise VIP Access', 'info.plan_name must be Enterprise VIP Access');
      assert.strictEqual(infoData.direct_ordering_enabled, true, 'info.direct_ordering_enabled must be true');
      assert.strictEqual(infoData.kds_enabled, true, 'info.kds_enabled must be true');
      assert.strictEqual(infoData.dual_printer_enabled, true, 'info.dual_printer_enabled must be true');

      // 2. GET /api/admin/subscription-status
      const subRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${vipAdminToken}` }
      });
      assert.strictEqual(subRes.status, 200, 'GET /api/admin/subscription-status must succeed');
      const subData = await subRes.json();

      assert.strictEqual(subData.subscription_type, 'ADMIN_GRANTED', 'subData.subscription_type must be ADMIN_GRANTED');
      assert.strictEqual(subData.mandate_status, 'admin_granted', 'subData.mandate_status must be admin_granted');
      assert.strictEqual(subData.is_complimentary, true, 'subData.is_complimentary must be true');
      assert.strictEqual(subData.is_vip, true, 'subData.is_vip must be true');
      assert.strictEqual(subData.plan_price, 0, 'subData.plan_price must be 0');
      assert.strictEqual(subData.plan_name, 'Enterprise VIP Access', 'subData.plan_name must be Enterprise VIP Access');
      assert.strictEqual(subData.auto_debit_enabled, false, 'subData.auto_debit_enabled must be false');
      assert.strictEqual(subData.auto_renew, 0, 'subData.auto_renew must be 0');
      assert.strictEqual(subData.permissions.direct_ordering_enabled, true, 'subData.permissions.direct_ordering_enabled must be true');
      assert.strictEqual(subData.permissions.kds_enabled, true, 'subData.permissions.kds_enabled must be true');
      assert.strictEqual(subData.permissions.dual_printer_enabled, true, 'subData.permissions.dual_printer_enabled must be true');
      assert.strictEqual(subData.permissions.max_combos, 9999, 'subData.permissions.max_combos must be 9999');
    });

    // --------------------------------------------------------------------------
    // TEST 3: resolveTenantCapabilities() shows complimentary/VIP access, ₹0 and expected plan name
    // --------------------------------------------------------------------------
    await test('3. resolveTenantCapabilities() shows complimentary/VIP access, ₹0 and expected plan name', async () => {
      const restoRows = await query('SELECT * FROM restaurants WHERE id = $1', [createdVipRestoId]);
      const subRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [createdVipRestoId]);

      const caps = resolveTenantCapabilities({
        restaurant: restoRows[0],
        subscription: subRows[0]
      });

      assert.strictEqual(caps.is_complimentary, true, 'caps.is_complimentary must be true');
      assert.strictEqual(caps.is_vip, true, 'caps.is_vip must be true');
      assert.strictEqual(caps.plan_name, 'Enterprise VIP Access', 'caps.plan_name must be Enterprise VIP Access');
      assert.strictEqual(caps.plan_price, 0, 'caps.plan_price must be 0');
      assert.strictEqual(caps.subscription_status, 'active', 'caps.subscription_status must be active');
      assert.strictEqual(caps.direct_ordering_enabled, true, 'caps.direct_ordering_enabled must be true');
      assert.strictEqual(caps.kds_enabled, true, 'caps.kds_enabled must be true');
      assert.strictEqual(caps.dual_printer_enabled, true, 'caps.dual_printer_enabled must be true');
      assert.strictEqual(caps.max_combos, 9999, 'caps.max_combos must be 9999');
    });

    // --------------------------------------------------------------------------
    // TEST 4: VIP tenants on basic/pro base tiers can place eligible direct QR orders
    // --------------------------------------------------------------------------
    let basicVipRestoId = null;
    let basicPaidRestoId = null;
    const basicVipSlug = `basic-vip-${testTimestamp}`;
    const basicPaidSlug = `basic-paid-${testTimestamp}`;

    await test('4. VIP tenants on basic base tier can place eligible direct QR orders', async () => {
      const qrSecret = 'test_qr_secret_vip_32_bytes_super_secure!';

      // 1. Create VIP tenant on basic plan
      const r1 = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, auto_debit_enabled, active, qr_secret, direct_ordering_enabled, location_initialized, total_tables)
        VALUES ('Basic VIP Cafe', $1, 'basic', 0, 'ADMIN_GRANTED', 'admin_granted', 0, true, $2, 1, false, 10)
        RETURNING id
      `, [basicVipSlug, qrSecret]);
      basicVipRestoId = r1[0]?.id || r1.lastInsertRowid;

      // 2. Create ordinary non-VIP tenant on basic plan
      const r2 = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, auto_debit_enabled, active, qr_secret, direct_ordering_enabled, location_initialized, total_tables)
        VALUES ('Basic Paid Cafe', $1, 'basic', 499, 'PAID', 'active', 1, true, $2, 0, false, 10)
        RETURNING id
      `, [basicPaidSlug, qrSecret]);
      basicPaidRestoId = r2[0]?.id || r2.lastInsertRowid;

      // Seed category and dish for both
      const c1 = await query(`INSERT INTO categories (restaurant_id, name) VALUES ($1, 'Main') RETURNING id`, [basicVipRestoId]);
      const cat1Id = c1[0]?.id || c1.lastInsertRowid;
      const d1 = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, 'VIP Chai', 50, true) RETURNING id`, [basicVipRestoId, cat1Id]);
      const dish1Id = d1[0]?.id || d1.lastInsertRowid;

      const c2 = await query(`INSERT INTO categories (restaurant_id, name) VALUES ($1, 'Main') RETURNING id`, [basicPaidRestoId]);
      const cat2Id = c2[0]?.id || c2.lastInsertRowid;
      const d2 = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, 'Plain Chai', 50, true) RETURNING id`, [basicPaidRestoId, cat2Id]);
      const dish2Id = d2[0]?.id || d2.lastInsertRowid;

      // Generate valid QR and presence tokens for Basic VIP tenant
      const qrTokenVip = generateHmacQrToken(basicVipSlug, 'table', '1', qrSecret);
      const hashVip = generateQrContextHash(basicVipSlug, 'table', '1', qrTokenVip);
      const presenceTokenVip = generatePresenceToken({
        verificationToken: `tq_${Date.now()}_vip`,
        restaurantId: basicVipRestoId,
        slug: basicVipSlug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'GPS',
        qrContextHash: hashVip,
        expiryMinutes: 20
      });

      // Place order on Basic VIP tenant -> MUST SUCCEED (200/201)
      const orderVipRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: basicVipSlug,
          table_number: '1',
          customer_name: 'VIP Diner',
          table_token: qrTokenVip,
          presence_token: presenceTokenVip,
          items: [{ dish_id: dish1Id, name: 'VIP Chai', price: 50, quantity: 1 }],
          total_amount: 50
        })
      });
      const orderVipData = await orderVipRes.json();
      assert(orderVipRes.status === 200 || orderVipRes.status === 201, `VIP order must succeed, got ${orderVipRes.status}: ${JSON.stringify(orderVipData)}`);
      assert(orderVipData.success, 'VIP order response must have success: true');

      // Place order on Non-VIP Basic tenant -> MUST FAIL with 403 ordering_disabled
      const qrTokenPaid = generateHmacQrToken(basicPaidSlug, 'table', '1', qrSecret);
      const hashPaid = generateQrContextHash(basicPaidSlug, 'table', '1', qrTokenPaid);
      const presenceTokenPaid = generatePresenceToken({
        verificationToken: `tq_${Date.now()}_paid`,
        restaurantId: basicPaidRestoId,
        slug: basicPaidSlug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'GPS',
        qrContextHash: hashPaid,
        expiryMinutes: 20
      });

      const orderPaidRes = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: basicPaidSlug,
          table_number: '1',
          customer_name: 'Normal Diner',
          table_token: qrTokenPaid,
          presence_token: presenceTokenPaid,
          items: [{ dish_id: dish2Id, name: 'Plain Chai', price: 50, quantity: 1 }],
          total_amount: 50
        })
      });
      assert.strictEqual(orderPaidRes.status, 403, 'Non-VIP basic order must be rejected with 403');
    });

    // --------------------------------------------------------------------------
    // TEST 5: VIP KDS, dual-printer and combo entitlements follow intended policy
    // --------------------------------------------------------------------------
    await test('5. VIP KDS, dual-printer and combo entitlements follow intended policy', async () => {
      const basicVipAdminToken = makeAdminToken(9981, basicVipRestoId, 'basic_vip_admin');
      const basicPaidAdminToken = makeAdminToken(9982, basicPaidRestoId, 'basic_paid_admin');

      // 1. KDS Access: GET /api/kitchen/orders
      const kdsVipRes = await fetch(`${baseUrl}/kitchen/orders?slug=${basicVipSlug}`, {
        headers: { 'Authorization': `Bearer ${basicVipAdminToken}` }
      });
      assert.strictEqual(kdsVipRes.status, 200, `VIP tenant on basic tier must have KDS access (200), got ${kdsVipRes.status}`);

      const kdsPaidRes = await fetch(`${baseUrl}/kitchen/orders?slug=${basicPaidSlug}`, {
        headers: { 'Authorization': `Bearer ${basicPaidAdminToken}` }
      });
      assert.strictEqual(kdsPaidRes.status, 403, 'Non-VIP basic tenant must be denied KDS access with 403');

      // 2. Combos: Basic tier has max_combos = 1.
      // Seed 1 combo for both
      await query(`
        INSERT INTO combos (restaurant_id, name, price, items)
        VALUES ($1, 'Combo 1', 199, '[]')
      `, [basicVipRestoId]);

      await query(`
        INSERT INTO combos (restaurant_id, name, price, items)
        VALUES ($1, 'Combo 1', 199, '[]')
      `, [basicPaidRestoId]);

      // Adding 2nd combo on VIP tenant -> MUST SUCCEED (quota unlocked)
      const comboVipRes = await fetch(`${baseUrl}/admin/combos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${basicVipAdminToken}`
        },
        body: JSON.stringify({
          name: 'VIP Feast Combo',
          price: 299,
          items: [{ name: 'Item 1' }]
        })
      });
      const comboVipData = await comboVipRes.json();
      assert(comboVipRes.status === 200 || comboVipRes.status === 201, `VIP combo creation must succeed, got ${comboVipRes.status}: ${JSON.stringify(comboVipData)}`);

      // Adding 2nd combo on Non-VIP basic tenant -> MUST BE REJECTED with 403
      const comboPaidRes = await fetch(`${baseUrl}/admin/combos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${basicPaidAdminToken}`
        },
        body: JSON.stringify({
          name: 'Paid 2nd Combo',
          price: 299,
          items: [{ name: 'Item 1' }]
        })
      });
      assert.strictEqual(comboPaidRes.status, 403, 'Non-VIP basic tenant exceeding combo quota must receive 403');

      // 3. Dual-printer entitlement in settings
      const printerVipRes = await fetch(`${baseUrl}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${basicVipAdminToken}`
        },
        body: JSON.stringify({
          printer_mode: 'dual'
        })
      });
      assert(printerVipRes.status === 200, `VIP tenant dual-printer setting must succeed, got ${printerVipRes.status}`);
      const updatedVipResto = await query('SELECT printer_mode FROM restaurants WHERE id = $1', [basicVipRestoId]);
      assert.strictEqual(updatedVipResto[0]?.printer_mode, 'dual', 'VIP tenant printer_mode must be dual');
    });

    // --------------------------------------------------------------------------
    // TEST 6: Editing VIP profile details preserves ₹0 and complimentary status
    // --------------------------------------------------------------------------
    await test('6. Editing VIP profile details preserves ₹0 and complimentary status', async () => {
      const updatedPhone = `98${String(Date.now()).slice(-8)}`;
      // Superadmin edits name, phone, address, omitting plan_price
      const editRes = await fetch(`${baseUrl}/superadmin/restaurants/${createdVipRestoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          name: 'VIP Grand Palace Renovated',
          phone: updatedPhone,
          address: '88 Diamond Way, Suite 100'
        })
      });

      assert.strictEqual(editRes.status, 200, 'Profile update must succeed');

      // Verify DB row
      const rows = await query('SELECT * FROM restaurants WHERE id = $1', [createdVipRestoId]);
      const r = rows[0];
      assert.strictEqual(r.name, 'VIP Grand Palace Renovated', 'Name should be updated');
      assert.strictEqual(r.phone, updatedPhone, 'Phone should be updated');
      assert.strictEqual(Number(r.plan_price), 0, 'plan_price MUST RETAIN 0, NEVER reset to 999');
      assert.strictEqual(r.subscription_type, 'ADMIN_GRANTED', 'subscription_type must remain ADMIN_GRANTED');
      assert.strictEqual(r.mandate_status, 'admin_granted', 'mandate_status must remain admin_granted');
      assert.strictEqual(Number(r.auto_debit_enabled), 0, 'auto_debit_enabled must remain 0');
    });

    // --------------------------------------------------------------------------
    // TEST 7: Grant/revoke invalidates cached status and updates effective access
    // --------------------------------------------------------------------------
    let toggleRestoId = null;
    const toggleSlug = `toggle-resto-${testTimestamp}`;

    await test('7. Grant/revoke invalidates cached status and updates effective access', async () => {
      // Create regular tenant on basic
      const insRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Toggle Bistro', $1, 'basic', 499, 'PAID', 'active', true)
        RETURNING id
      `, [toggleSlug]);
      toggleRestoId = insRes[0]?.id || insRes.lastInsertRowid;

      await query(`
        INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, auto_renew)
        VALUES ($1, 1, 'cashfree', 'active', 499, 1)
      `, [toggleRestoId]);

      const toggleAdminToken = makeAdminToken(8811, toggleRestoId, 'toggle_admin');

      // 1. Warm subscription-status cache
      const initialSubRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${toggleAdminToken}` }
      });
      const initialData = await initialSubRes.json();
      assert.strictEqual(initialData.is_complimentary, false, 'Initial state must not be complimentary');
      assert.strictEqual(initialData.plan_price, 499, 'Initial price must be 499');

      // 2. Superadmin grants free VIP access
      const grantRes = await fetch(`${baseUrl}/superadmin/restaurants/${toggleRestoId}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          duration_days: 30,
          admin_notes: 'E2E Grant Test'
        })
      });
      assert.strictEqual(grantRes.status, 200, 'Grant access must succeed');

      // 3. Query subscription-status immediately -> cache must be invalidated!
      const postGrantRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${toggleAdminToken}` }
      });
      const postGrantData = await postGrantRes.json();
      assert.strictEqual(postGrantData.is_complimentary, true, 'Cache invalidated: is_complimentary must be true');
      assert.strictEqual(postGrantData.plan_price, 0, 'Cache invalidated: plan_price must be 0');
      assert.strictEqual(postGrantData.plan_name, 'Enterprise VIP Access', 'Cache invalidated: plan_name must be Enterprise VIP Access');
    });

    // --------------------------------------------------------------------------
    // TEST 8: Revoke does not grant VIP capabilities afterward
    // --------------------------------------------------------------------------
    await test('8. Revoke does not grant VIP capabilities afterward', async () => {
      const toggleAdminToken = makeAdminToken(8811, toggleRestoId, 'toggle_admin');

      // Revoke free access
      const revokeRes = await fetch(`${baseUrl}/superadmin/restaurants/${toggleRestoId}/revoke-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          admin_notes: 'E2E Revoke Test'
        })
      });
      assert.strictEqual(revokeRes.status, 200, 'Revoke access must succeed');

      // Query subscription-status immediately -> cache invalidated, VIP revoked
      const postRevokeRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${toggleAdminToken}` }
      });
      const postRevokeData = await postRevokeRes.json();
      assert.strictEqual(postRevokeData.is_complimentary, false, 'is_complimentary must be false after revoke');
      assert.strictEqual(postRevokeData.is_vip, false, 'is_vip must be false after revoke');
      assert.notStrictEqual(postRevokeData.plan_name, 'Enterprise VIP Access', 'plan_name must revert from VIP');

      // Attempting KDS access on revoked basic tenant must now be 403
      const kdsRevokedRes = await fetch(`${baseUrl}/kitchen/orders?slug=${toggleSlug}`, {
        headers: { 'Authorization': `Bearer ${toggleAdminToken}` }
      });
      assert.strictEqual(kdsRevokedRes.status, 403, 'Revoked tenant on basic tier must be rejected from KDS (403)');
    });

    // --------------------------------------------------------------------------
    // TEST 9: Existing paid, pending-mandate and 16-day trial tenants retain correct behavior
    // --------------------------------------------------------------------------
    await test('9. Existing paid, pending-mandate and 16-day trial tenants retain correct behavior', async () => {
      // 1. Paid tenant with active mandate
      const paidRestoRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Paid Pro Diner', $1, 'pro', 999, 'PAID', 'active', true)
        RETURNING id
      `, [`paid-pro-${testTimestamp}`]);
      const paidId = paidRestoRes[0]?.id || paidRestoRes.lastInsertRowid;
      const paidToken = makeAdminToken(771, paidId, 'paid_user');

      const paidStatusRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${paidToken}` }
      });
      const paidStatusData = await paidStatusRes.json();
      assert.strictEqual(paidStatusData.is_complimentary, false, 'Paid tenant is not complimentary');
      assert.strictEqual(paidStatusData.plan_price, 999, 'Paid tenant price is 999');
      assert.strictEqual(paidStatusData.plan_name, 'Pro Luxury Plan', 'Paid tenant is Pro Luxury Plan');

      // 2. Pending mandate tenant
      const pendingRestoRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Pending Mandate Diner', $1, 'pro', 999, 'PAID', 'pending', true)
        RETURNING id
      `, [`pending-mandate-${testTimestamp}`]);
      const pendingId = pendingRestoRes[0]?.id || pendingRestoRes.lastInsertRowid;
      const pendingToken = makeAdminToken(772, pendingId, 'pending_user');

      const pendingStatusRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${pendingToken}` }
      });
      const pendingStatusData = await pendingStatusRes.json();
      assert.strictEqual(pendingStatusData.is_complimentary, false, 'Pending tenant is not complimentary');
      assert.strictEqual(pendingStatusData.mandate_status, 'pending', 'Mandate status is pending');

      // 3. 16-day trial tenant
      const trialEnds = new Date(Date.now() + 16 * 86400 * 1000).toISOString();
      const trialRestoRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, trial_ends_at, active)
        VALUES ('Trial Diner', $1, 'pro', 0, 'TRIAL', 'pending', $2, true)
        RETURNING id
      `, [`trial-diner-${testTimestamp}`, trialEnds]);
      const trialId = trialRestoRes[0]?.id || trialRestoRes.lastInsertRowid;
      await query(`
        INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, subscription_type)
        VALUES ($1, 2, 'none', 'trialing', 0, 'TRIAL')
      `, [trialId]);
      const trialToken = makeAdminToken(773, trialId, 'trial_user');

      const trialStatusRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${trialToken}` }
      });
      const trialStatusData = await trialStatusRes.json();
      assert.strictEqual(trialStatusData.is_complimentary, false, 'Trial tenant is not marked complimentary VIP');
      assert.strictEqual(trialStatusData.status, 'trialing', 'Trial tenant status is trialing');
    });

    // --------------------------------------------------------------------------
    // TEST 10: Forged client-provided VIP identifiers cannot grant access
    // --------------------------------------------------------------------------
    await test('10. Forged client-provided VIP identifiers cannot grant access', async () => {
      // Create non-VIP basic tenant
      const forgedSlug = `forged-test-${testTimestamp}`;
      const fRestoRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, direct_ordering_enabled)
        VALUES ('Forged Attempt Cafe', $1, 'basic', 499, 'PAID', 'active', true, 0)
        RETURNING id
      `, [forgedSlug]);
      const forgedId = fRestoRes[0]?.id || fRestoRes.lastInsertRowid;
      const forgedToken = makeAdminToken(661, forgedId, 'forged_user');

      // Attempt to access KDS while sending fake VIP headers or body
      const kdsAttempt = await fetch(`${baseUrl}/kitchen/orders?slug=${forgedSlug}`, {
        headers: {
          'Authorization': `Bearer ${forgedToken}`,
          'X-Client-Plan': 'vip_ultra_plan',
          'X-VIP-Access': 'true'
        }
      });
      assert.strictEqual(kdsAttempt.status, 403, 'Server must reject forged VIP headers on KDS');

      // Attempt to create combo with forged body payload claiming VIP
      await query(`INSERT INTO combos (restaurant_id, name, price, items) VALUES ($1, 'Combo A', 100, '[]')`, [forgedId]);
      const comboAttempt = await fetch(`${baseUrl}/admin/combos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${forgedToken}`
        },
        body: JSON.stringify({
          name: 'Forged Combo 2',
          price: 150,
          items: [{ name: 'Item' }],
          plan_tier: 'enterprise',
          subscription_type: 'ADMIN_GRANTED',
          is_vip: true
        })
      });
      assert.strictEqual(comboAttempt.status, 403, 'Server must reject forged VIP body in combo creation');
    });

    // --------------------------------------------------------------------------
    // TEST 11: Impersonation uses the selected tenant's actual data
    // --------------------------------------------------------------------------
    await test("11. Impersonation uses the selected tenant's actual data", async () => {
      // Fetch 360 overview for created VIP tenant
      const vipOverviewRes = await fetch(`${baseUrl}/superadmin/restaurants/${createdVipRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(vipOverviewRes.status, 200, 'Superadmin 360 for VIP must succeed');
      const vipOverview = await vipOverviewRes.json();
      assert.strictEqual(vipOverview.subscription.is_complimentary, true, 'Impersonation sees VIP is_complimentary: true');
      assert.strictEqual(vipOverview.subscription.plan_price, 0, 'Impersonation sees VIP plan_price: 0');
      assert.strictEqual(vipOverview.subscription.plan_name, 'Enterprise VIP Access', 'Impersonation sees Enterprise VIP Access');

      // Fetch 360 overview for basic paid tenant
      const paidOverviewRes = await fetch(`${baseUrl}/superadmin/restaurants/${basicPaidRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(paidOverviewRes.status, 200, 'Superadmin 360 for Paid must succeed');
      const paidOverview = await paidOverviewRes.json();
      assert.strictEqual(paidOverview.subscription.is_complimentary, false, 'Impersonation sees Paid is_complimentary: false');
      assert.strictEqual(paidOverview.subscription.plan_price, 499, 'Impersonation sees Paid plan_price: 499');
      assert.strictEqual(paidOverview.subscription.plan_name, 'Basic Starter Plan', 'Impersonation sees Basic Starter Plan');
    });

    // --------------------------------------------------------------------------
    // TEST 12: Re-running relevant operations does not corrupt subscription or payment records
    // --------------------------------------------------------------------------
    await test('12. Re-running operations does not corrupt subscription or payment records', async () => {
      const idempotencyRestoRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Idempotency Cafe', $1, 'pro', 999, 'PAID', 'active', true)
        RETURNING id
      `, [`idempotent-${testTimestamp}`]);
      const idempId = idempotencyRestoRes[0]?.id || idempotencyRestoRes.lastInsertRowid;

      // Seed an initial payment record
      await query(`
        INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, status, payment_type)
        VALUES ($1, 'cashfree', $2, 999, 'SUCCESS', 'subscription_mandate')
      `, [idempId, `pay_test_${testTimestamp}`]);

      // Call grant-free-access 3 times in a row
      for (let i = 0; i < 3; i++) {
        const grantRes = await fetch(`${baseUrl}/superadmin/restaurants/${idempId}/grant-free-access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminToken}`
          },
          body: JSON.stringify({ duration_days: 30, admin_notes: `Grant run ${i + 1}` })
        });
        assert.strictEqual(grantRes.status, 200, `Grant run ${i + 1} must succeed`);
      }

      // Verify active subscription count is exactly 1 (no duplicate active leaks)
      const activeSubs = await query(`
        SELECT * FROM subscriptions WHERE restaurant_id = $1 AND status = 'active'
      `, [idempId]);
      assert.strictEqual(activeSubs.length, 1, 'Exactly one active subscription must exist');
      assert.strictEqual(activeSubs[0].subscription_type, 'ADMIN_GRANTED', 'Subscription type is ADMIN_GRANTED');
      assert.strictEqual(Number(activeSubs[0].amount), 0, 'Subscription amount is 0');

      // Verify payments table is untouched
      const payments = await query(`
        SELECT * FROM payments WHERE restaurant_id = $1
      `, [idempId]);
      assert.strictEqual(payments.length, 1, 'Payment records must not be deleted or corrupted');
      assert.strictEqual(Number(payments[0].amount), 999, 'Original payment amount is preserved');
      assert.strictEqual(payments[0].status, 'SUCCESS', 'Payment status is preserved');

      // Re-run profile edits multiple times
      for (let i = 0; i < 3; i++) {
        const editRes = await fetch(`${baseUrl}/superadmin/restaurants/${idempId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${superAdminToken}`
          },
          body: JSON.stringify({ name: `Idempotency Cafe Run ${i + 1}` })
        });
        assert.strictEqual(editRes.status, 200, `Profile edit run ${i + 1} must succeed`);
      }

      const finalResto = await query('SELECT * FROM restaurants WHERE id = $1', [idempId]);
      assert.strictEqual(Number(finalResto[0].plan_price), 0, 'Plan price must stay 0 through repeated profile edits');
      assert.strictEqual(finalResto[0].subscription_type, 'ADMIN_GRANTED', 'subscription_type must stay ADMIN_GRANTED');
    });

  } finally {
    server.close();
    await closeDbPool().catch(() => {});
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`E2E SUITE RESULTS: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('----------------------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal E2E test execution error:', err);
  process.exit(1);
});
