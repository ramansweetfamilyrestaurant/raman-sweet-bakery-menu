/**
 * TouchQR — P1 KDS Authorization, Entitlement & Recall Regression Suite
 *
 * Verifies:
 * 1. Authoritative Tenant Suspension & KDS SaaS Plan Entitlement:
 *    - Active tenant with enabled plan succeeds
 *    - Suspended tenant rejected (403 RESTAURANT_SUSPENDED) across all 4 endpoints
 *    - Suspended complimentary/VIP tenant rejected
 *    - Complimentary/VIP exception on disabled plan succeeds
 *    - Disabled plan rejected (403 KDS_DISABLED)
 *    - Missing/unknown plan fails closed (403 KDS_DISABLED)
 *    - Database lookup failure returns 503 PLAN_VERIFICATION_UNAVAILABLE
 *    - Compatibility with both kds_screen and restaurant_admin roles
 * 2. Recall Endpoint Lifecycle & Concurrency (PATCH /api/kitchen/orders/:id/recall):
 *    - First recall returns 200, kitchen_prepared = 0, idempotent: false
 *    - Duplicate recall returns 200, idempotent: true
 *    - Settled orders rejected (409 ORDER_ALREADY_SETTLED)
 *    - Terminal orders rejected (409 ORDER_TERMINAL)
 *    - Ineligible accepted orders rejected (409 ORDER_NOT_IN_KDS)
 *    - Cross-tenant recall rejected (404 ORDER_NOT_FOUND)
 *    - Missing/invalid auth rejected (401/403)
 * 3. Standalone KDS Queue Filter Synchronization (GET /api/kitchen/orders):
 *    - Full truth table assertion (kitchen/preparing with NULL sent_to_kds, accepted with sent_to_kds=1, exclusions)
 *    - Legacy NULL handling
 * 4. Settlement Race & Concurrency:
 *    - Settlement before recall
 *    - Recall followed by settlement
 *    - Concurrent settlement and recall guarantee settled state and queue exclusion
 */

import http from 'http';
import assert from 'assert';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkTestDatabaseRequirement, validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import { JWT_SECRET } from '../config/jwt.js';
import apiRouter, { verifyKdsTenantAndEntitlement } from '../routes/api.js';
import adminRouter from '../routes/admin.js';

// Pre-flight Database Guard: strictly enforce local disposable test DB
const rawTestUrl = process.env.TEST_DATABASE_URL;
if (!rawTestUrl) {
  try {
    checkTestDatabaseRequirement('P1 KDS Authorization, Entitlement & Recall Regression Suite');
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// Strict local PostgreSQL verification: reject any non-local or production URL
validateTestDatabaseUrl(rawTestUrl);
const parsedUrl = new URL(rawTestUrl);
const host = (parsedUrl.hostname || '').toLowerCase();
const pathname = (parsedUrl.pathname || '').toLowerCase();
if (host !== '127.0.0.1' && host !== 'localhost') {
  console.error(`❌ SAFETY VIOLATION: Test database must run on 127.0.0.1 or localhost, got: ${host}`);
  process.exit(1);
}
if (!pathname.includes('touchqr_disposable_test')) {
  console.error(`❌ SAFETY VIOLATION: Database name must be touchqr_disposable_test, got: ${pathname}`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

function record(name, status, detail) {
  if (status === 'PASS') {
    passed++;
    console.log(`  ✅ [PASS] ${name}: ${detail}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name}: ${detail}`);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR P1 KDS AUTHORIZATION, ENTITLEMENT & RECALL SUITE');
  console.log('======================================================================\n');

  await initDb();

  // Create isolated ephemeral Express test server mounting api and admin routers
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Tenant Fixture IDs
  const ACTIVE_RESTO_ID = 9101;
  const ACTIVE_SLUG = 'p1-kds-active';

  const SUSPENDED_RESTO_ID = 9102;
  const SUSPENDED_SLUG = 'p1-kds-suspended';

  const SUSPENDED_VIP_ID = 9103;
  const SUSPENDED_VIP_SLUG = 'p1-kds-susp-vip';

  const VIP_BASIC_ID = 9104;
  const VIP_BASIC_SLUG = 'p1-kds-vip-basic';

  const DISABLED_PLAN_ID = 9105;
  const DISABLED_PLAN_SLUG = 'p1-kds-disabled-plan';

  const UNKNOWN_PLAN_ID = 9106;
  const UNKNOWN_PLAN_SLUG = 'p1-kds-unknown-plan';

  const CROSS_RESTO_ID = 9107;
  const CROSS_SLUG = 'p1-kds-cross-tenant';

  const ALL_TEST_RESTOS = [
    ACTIVE_RESTO_ID,
    SUSPENDED_RESTO_ID,
    SUSPENDED_VIP_ID,
    VIP_BASIC_ID,
    DISABLED_PLAN_ID,
    UNKNOWN_PLAN_ID,
    CROSS_RESTO_ID
  ];

  const TEST_PIN = '4321';

  try {
    // 0. Ensure saas_plans have required baseline records
    const ensurePlan = async (key, name, kds_enabled) => {
      const existing = await query('SELECT key FROM saas_plans WHERE key = $1', [key]);
      if (!existing || existing.length === 0) {
        await query(
          'INSERT INTO saas_plans (key, name, price, kds_enabled, is_active) VALUES ($1, $2, 999, $3, true)',
          [key, name, kds_enabled]
        );
      } else {
        await query('UPDATE saas_plans SET kds_enabled = $1 WHERE key = $2', [kds_enabled, key]);
      }
    };
    await ensurePlan('enterprise', 'Enterprise VIP', 1);
    await ensurePlan('basic', 'Basic Starter', 0);
    await ensurePlan('pro', 'Pro Luxury', 0);

    // Clean up any stale records from previous runs
    for (const rid of ALL_TEST_RESTOS) {
      await query('DELETE FROM subscriptions WHERE restaurant_id = $1', [rid]);
      await query('DELETE FROM orders WHERE restaurant_id = $1', [rid]);
      await query('DELETE FROM admins WHERE restaurant_id = $1', [rid]);
      await query('DELETE FROM restaurants WHERE id = $1', [rid]);
    }

    const pinHash = await bcrypt.hash(TEST_PIN, 10);
    const passHash = await bcrypt.hash('AdminPass123!', 10);

    // 1. Seed Active Tenant (Enterprise, active = true)
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Active Kitchen', $2, 'enterprise', true, $3, 1, 'VIP', 'active')
    `, [ACTIVE_RESTO_ID, ACTIVE_SLUG, pinHash]);
    await query(`
      INSERT INTO admins (id, username, password_hash, restaurant_id, role)
      VALUES ($1, 'p1_active_owner', $2, $1, 'restaurant_admin')
    `, [ACTIVE_RESTO_ID, passHash]);

    // 2. Seed Suspended Tenant (active = false)
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Suspended Kitchen', $2, 'enterprise', false, $3, 1, 'standard', 'active')
    `, [SUSPENDED_RESTO_ID, SUSPENDED_SLUG, pinHash]);

    // 3. Seed Suspended Complimentary/VIP Tenant (subscription_type = 'VIP', active = false)
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Suspended VIP', $2, 'enterprise', false, $3, 1, 'VIP', 'active')
    `, [SUSPENDED_VIP_ID, SUSPENDED_VIP_SLUG, pinHash]);

    // 4. Seed Active Complimentary/VIP Tenant on Basic Tier (kds_enabled = 0, but VIP = true, active = true)
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 VIP on Basic', $2, 'basic', true, $3, 1, 'VIP', 'active')
    `, [VIP_BASIC_ID, VIP_BASIC_SLUG, pinHash]);

    // 5. Seed Active Non-VIP Tenant on Disabled Plan (basic tier, active = true)
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Disabled Plan Resto', $2, 'basic', true, $3, 1, 'standard', 'active')
    `, [DISABLED_PLAN_ID, DISABLED_PLAN_SLUG, pinHash]);

    // 6. Seed Active Tenant with Unknown/Missing Plan
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Unknown Plan Resto', $2, 'non_existent_plan_xyz', true, $3, 1, 'standard', 'active')
    `, [UNKNOWN_PLAN_ID, UNKNOWN_PLAN_SLUG, pinHash]);

    // 7. Seed Cross-Tenant Restaurant
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Cross Tenant Resto', $2, 'enterprise', true, $3, 1, 'VIP', 'active')
    `, [CROSS_RESTO_ID, CROSS_SLUG, pinHash]);

    // Helper token generators
    const makeKdsToken = (rid, slug, perms = ['kds:read', 'kds:complete']) => jwt.sign(
      { role: 'kds_screen', restaurant_id: rid, slug, auth_version: 1, permissions: perms },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const makeAdminToken = (adminId, rid) => jwt.sign(
      { id: adminId, username: `admin_${rid}`, restaurant_id: rid, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const activeKdsToken = makeKdsToken(ACTIVE_RESTO_ID, ACTIVE_SLUG);
    const activeAdminToken = makeAdminToken(ACTIVE_RESTO_ID, ACTIVE_RESTO_ID);
    const suspendedKdsToken = makeKdsToken(SUSPENDED_RESTO_ID, SUSPENDED_SLUG);
    const suspendedVipToken = makeKdsToken(SUSPENDED_VIP_ID, SUSPENDED_VIP_SLUG);
    const disabledPlanToken = makeKdsToken(DISABLED_PLAN_ID, DISABLED_PLAN_SLUG);
    const crossKdsToken = makeKdsToken(CROSS_RESTO_ID, CROSS_SLUG);

    // =========================================================================
    // SECTION A: SUSPENSION AND ENTITLEMENT TESTS
    // =========================================================================
    console.log('--- SECTION A: Suspension and Entitlement Enforcement ---');

    // A.1: Active tenant with enabled KDS entitlement succeeds
    const resA1Pin = await fetch(`${baseUrl}/kitchen/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ACTIVE_SLUG, pin: TEST_PIN })
    });
    const dataA1Pin = await resA1Pin.json();
    record('A1_ACTIVE_PIN', resA1Pin.status === 200 && dataA1Pin.token ? 'PASS' : 'FAIL',
      `POST /api/kitchen/verify-pin on active tenant returned ${resA1Pin.status}`);

    const resA1Orders = await fetch(`${baseUrl}/kitchen/orders?slug=${ACTIVE_SLUG}`, {
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    record('A1_ACTIVE_ORDERS', resA1Orders.status === 200 ? 'PASS' : 'FAIL',
      `GET /api/kitchen/orders on active tenant returned ${resA1Orders.status}`);

    // A.2: Suspended tenant rejected across all four KDS endpoints with 403 RESTAURANT_SUSPENDED
    // A.2.a: verify-pin
    const resA2Pin = await fetch(`${baseUrl}/kitchen/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: SUSPENDED_SLUG, pin: TEST_PIN })
    });
    const dataA2Pin = await resA2Pin.json();
    record('A2_SUSPENDED_PIN', resA2Pin.status === 403 && dataA2Pin.error === 'RESTAURANT_SUSPENDED' ? 'PASS' : 'FAIL',
      `verify-pin on suspended tenant returned ${resA2Pin.status} (${dataA2Pin.error})`);

    // A.2.b: GET orders
    const resA2Orders = await fetch(`${baseUrl}/kitchen/orders?slug=${SUSPENDED_SLUG}`, {
      headers: { 'Authorization': `Bearer ${suspendedKdsToken}` }
    });
    const dataA2Orders = await resA2Orders.json();
    record('A2_SUSPENDED_ORDERS', resA2Orders.status === 403 && dataA2Orders.error === 'RESTAURANT_SUSPENDED' ? 'PASS' : 'FAIL',
      `GET orders on suspended tenant returned ${resA2Orders.status} (${dataA2Orders.error})`);

    // A.2.c: complete order
    const resA2Complete = await fetch(`${baseUrl}/kitchen/orders/1/complete?slug=${SUSPENDED_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${suspendedKdsToken}` }
    });
    const dataA2Complete = await resA2Complete.json();
    record('A2_SUSPENDED_COMPLETE', resA2Complete.status === 403 && dataA2Complete.error === 'RESTAURANT_SUSPENDED' ? 'PASS' : 'FAIL',
      `complete order on suspended tenant returned ${resA2Complete.status} (${dataA2Complete.error})`);

    // A.2.d: recall order
    const resA2Recall = await fetch(`${baseUrl}/kitchen/orders/1/recall?slug=${SUSPENDED_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${suspendedKdsToken}` }
    });
    const dataA2Recall = await resA2Recall.json();
    record('A2_SUSPENDED_RECALL', resA2Recall.status === 403 && dataA2Recall.error === 'RESTAURANT_SUSPENDED' ? 'PASS' : 'FAIL',
      `recall order on suspended tenant returned ${resA2Recall.status} (${dataA2Recall.error})`);

    // A.3: Suspended complimentary/VIP tenant MUST NOT bypass suspension
    const resA3VipSusp = await fetch(`${baseUrl}/kitchen/orders?slug=${SUSPENDED_VIP_SLUG}`, {
      headers: { 'Authorization': `Bearer ${suspendedVipToken}` }
    });
    const dataA3VipSusp = await resA3VipSusp.json();
    record('A3_SUSPENDED_VIP', resA3VipSusp.status === 403 && dataA3VipSusp.error === 'RESTAURANT_SUSPENDED' ? 'PASS' : 'FAIL',
      `Suspended VIP tenant rejected with ${resA3VipSusp.status} (${dataA3VipSusp.error})`);

    // A.4: Active complimentary/VIP tenant on basic tier bypasses plan restriction
    const vipBasicToken = makeKdsToken(VIP_BASIC_ID, VIP_BASIC_SLUG);
    const resA4VipBasic = await fetch(`${baseUrl}/kitchen/orders?slug=${VIP_BASIC_SLUG}`, {
      headers: { 'Authorization': `Bearer ${vipBasicToken}` }
    });
    record('A4_ACTIVE_VIP_BASIC', resA4VipBasic.status === 200 ? 'PASS' : 'FAIL',
      `Active VIP on basic tier permitted KDS access (HTTP ${resA4VipBasic.status})`);

    // A.5: Active non-VIP tenant on disabled plan rejected with 403 KDS_DISABLED
    const resA5Disabled = await fetch(`${baseUrl}/kitchen/orders?slug=${DISABLED_PLAN_SLUG}`, {
      headers: { 'Authorization': `Bearer ${disabledPlanToken}` }
    });
    const dataA5Disabled = await resA5Disabled.json();
    record('A5_DISABLED_PLAN', resA5Disabled.status === 403 && dataA5Disabled.error === 'KDS_DISABLED' ? 'PASS' : 'FAIL',
      `Non-VIP on disabled plan returned ${resA5Disabled.status} (${dataA5Disabled.error})`);

    // A.6: Missing / unknown plan fails closed with 403 KDS_DISABLED
    const unknownPlanToken = makeKdsToken(UNKNOWN_PLAN_ID, UNKNOWN_PLAN_SLUG);
    const resA6Unknown = await fetch(`${baseUrl}/kitchen/orders?slug=${UNKNOWN_PLAN_SLUG}`, {
      headers: { 'Authorization': `Bearer ${unknownPlanToken}` }
    });
    const dataA6Unknown = await resA6Unknown.json();
    record('A6_UNKNOWN_PLAN_CLOSED', resA6Unknown.status === 403 && dataA6Unknown.error === 'KDS_DISABLED' ? 'PASS' : 'FAIL',
      `Unknown plan failed closed with ${resA6Unknown.status} (${dataA6Unknown.error})`);

    // A.7: Database lookup failure returns HTTP 503 PLAN_VERIFICATION_UNAVAILABLE
    const syntheticDbFailResto = { id: 99999, slug: 'mock-fail', plan_tier: 'enterprise', active: 1, subscription_type: 'none' };
    const simulatedErrorCheck = await verifyKdsTenantAndEntitlement(syntheticDbFailResto, async () => {
      throw new Error('Simulated database connection failure');
    });
    record('A7_PLAN_VERIFICATION_UNAVAILABLE',
      simulatedErrorCheck.status === 503 && simulatedErrorCheck.error === 'PLAN_VERIFICATION_UNAVAILABLE' ? 'PASS' : 'FAIL',
      `verifyKdsTenantAndEntitlement catches DB failures and returns ${simulatedErrorCheck.status} ${simulatedErrorCheck.error}`);

    // A.8: Compatible with existing authorization model (both kds_screen and restaurant_admin accepted)
    const resA8Admin = await fetch(`${baseUrl}/kitchen/orders?slug=${ACTIVE_SLUG}`, {
      headers: { 'Authorization': `Bearer ${activeAdminToken}` }
    });
    record('A8_ADMIN_KDS_COMPAT', resA8Admin.status === 200 ? 'PASS' : 'FAIL',
      `Restaurant admin token permitted to read KDS orders (HTTP ${resA8Admin.status})`);

    // =========================================================================
    // SECTION B: RECALL LIFECYCLE TESTS
    // =========================================================================
    console.log('\n--- SECTION B: Recall Endpoint Lifecycle & Diagnostics ---');

    // Seed test order for Active Resto
    const ORDER_ELIGIBLE_ID = 501;
    const ORDER_SETTLED_ID = 502;
    const ORDER_COMPLETED_ID = 503;
    const ORDER_CANCELLED_ID = 504;
    const ORDER_REJECTED_ID = 505;
    const ORDER_ACCEPTED_NOKDS_ID = 506;
    const ORDER_ACCEPTED_WITHKDS_ID = 507;
    const ORDER_PENDING_ID = 508;
    const ORDER_CROSS_ID = 509;

    // Clean up test order IDs
    await query('DELETE FROM orders WHERE id IN (501, 502, 503, 504, 505, 506, 507, 508, 509)');

    // 1. Eligible kitchen order that has been prepared
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T1', '[]', 'kitchen', 1, 1, 0, 250)
    `, [ORDER_ELIGIBLE_ID, ACTIVE_RESTO_ID]);

    // 2. Settled order
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T2', '[]', 'kitchen', 1, 1, 1, 300)
    `, [ORDER_SETTLED_ID, ACTIVE_RESTO_ID]);

    // 3. Completed terminal order
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T3', '[]', 'completed', 1, 1, 0, 400)
    `, [ORDER_COMPLETED_ID, ACTIVE_RESTO_ID]);

    // 4. Cancelled order
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T4', '[]', 'cancelled', 1, 1, 0, 150)
    `, [ORDER_CANCELLED_ID, ACTIVE_RESTO_ID]);

    // 5. Rejected order
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T5', '[]', 'rejected', 1, 1, 0, 150)
    `, [ORDER_REJECTED_ID, ACTIVE_RESTO_ID]);

    // 6. Accepted order NOT fired to KDS (sent_to_kds = 0)
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T6', '[]', 'accepted', 0, 1, 0, 180)
    `, [ORDER_ACCEPTED_NOKDS_ID, ACTIVE_RESTO_ID]);

    // 7. Accepted order fired to KDS (sent_to_kds = 1)
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T7', '[]', 'accepted', 1, 1, 0, 220)
    `, [ORDER_ACCEPTED_WITHKDS_ID, ACTIVE_RESTO_ID]);

    // 8. Pending order
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T8', '[]', 'pending', 0, 1, 0, 100)
    `, [ORDER_PENDING_ID, ACTIVE_RESTO_ID]);

    // 9. Cross-tenant order (belongs to CROSS_RESTO_ID)
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T9', '[]', 'kitchen', 1, 1, 0, 500)
    `, [ORDER_CROSS_ID, CROSS_RESTO_ID]);

    // B.1: First eligible recall
    const resB1 = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ELIGIBLE_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB1 = await resB1.json();
    const rowsB1 = await query('SELECT kitchen_prepared FROM orders WHERE id = $1', [ORDER_ELIGIBLE_ID]);
    record('B1_FIRST_RECALL_SUCCESS',
      resB1.status === 200 && dataB1.idempotent === false && rowsB1[0].kitchen_prepared === 0 ? 'PASS' : 'FAIL',
      `First recall returned HTTP ${resB1.status}, idempotent=${dataB1.idempotent}, DB kitchen_prepared=${rowsB1[0]?.kitchen_prepared}`);

    // B.2: Duplicate / repeated recall on the same order
    const resB2 = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ELIGIBLE_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB2 = await resB2.json();
    record('B2_DUPLICATE_RECALL_IDEMPOTENT',
      resB2.status === 200 && dataB2.idempotent === true ? 'PASS' : 'FAIL',
      `Repeated recall returned HTTP ${resB2.status}, idempotent=${dataB2.idempotent}`);

    // B.3: Settled order recall rejected (409 ORDER_ALREADY_SETTLED)
    const resB3 = await fetch(`${baseUrl}/kitchen/orders/${ORDER_SETTLED_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB3 = await resB3.json();
    record('B3_SETTLED_REJECTED',
      resB3.status === 409 && dataB3.error === 'ORDER_ALREADY_SETTLED' ? 'PASS' : 'FAIL',
      `Settled order recall rejected with ${resB3.status} (${dataB3.error})`);

    // B.4: Terminal orders rejected (completed, cancelled, rejected)
    const resB4a = await fetch(`${baseUrl}/kitchen/orders/${ORDER_COMPLETED_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB4a = await resB4a.json();
    record('B4_COMPLETED_REJECTED',
      resB4a.status === 409 && dataB4a.error === 'ORDER_TERMINAL' ? 'PASS' : 'FAIL',
      `Completed order recall rejected with ${resB4a.status} (${dataB4a.error})`);

    const resB4b = await fetch(`${baseUrl}/kitchen/orders/${ORDER_CANCELLED_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB4b = await resB4b.json();
    record('B4_CANCELLED_REJECTED',
      resB4b.status === 409 && dataB4b.error === 'ORDER_TERMINAL' ? 'PASS' : 'FAIL',
      `Cancelled order recall rejected with ${resB4b.status} (${dataB4b.error})`);

    const resB4c = await fetch(`${baseUrl}/kitchen/orders/${ORDER_REJECTED_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB4c = await resB4c.json();
    record('B4_REJECTED_REJECTED',
      resB4c.status === 409 && dataB4c.error === 'ORDER_TERMINAL' ? 'PASS' : 'FAIL',
      `Rejected order recall rejected with ${resB4c.status} (${dataB4c.error})`);

    // B.5: Accepted order without KDS rejected (409 ORDER_NOT_IN_KDS)
    const resB5a = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ACCEPTED_NOKDS_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB5a = await resB5a.json();
    record('B5_ACCEPTED_NO_KDS_REJECTED',
      resB5a.status === 409 && dataB5a.error === 'ORDER_NOT_IN_KDS' ? 'PASS' : 'FAIL',
      `Accepted order without sent_to_kds rejected with ${resB5a.status} (${dataB5a.error})`);

    // B.5b: Accepted order fired to KDS can be recalled
    const resB5b = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ACCEPTED_WITHKDS_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB5b = await resB5b.json();
    record('B5_ACCEPTED_WITH_KDS_RECALLED',
      resB5b.status === 200 && dataB5b.idempotent === false ? 'PASS' : 'FAIL',
      `Accepted order with sent_to_kds=1 recalled successfully (HTTP ${resB5b.status})`);

    // B.6: Pending order rejected
    const resB6 = await fetch(`${baseUrl}/kitchen/orders/${ORDER_PENDING_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    record('B6_PENDING_ORDER_REJECTED', resB6.status === 409 ? 'PASS' : 'FAIL',
      `Pending order rejected from recall with HTTP ${resB6.status}`);

    // B.7: Cross-tenant recall returns 404 ORDER_NOT_FOUND
    const resB7 = await fetch(`${baseUrl}/kitchen/orders/${ORDER_CROSS_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataB7 = await resB7.json();
    record('B7_CROSS_TENANT_RECALL_404',
      resB7.status === 404 && dataB7.error === 'ORDER_NOT_FOUND' ? 'PASS' : 'FAIL',
      `Cross-tenant recall attempt returned ${resB7.status} (${dataB7.error})`);

    // B.8: Missing or invalid authentication rejected
    const resB8NoAuth = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ELIGIBLE_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH'
    });
    record('B8_NO_AUTH_REJECTED', resB8NoAuth.status === 401 ? 'PASS' : 'FAIL',
      `Recall with missing token returned HTTP ${resB8NoAuth.status}`);

    const resB8BadAuth = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ELIGIBLE_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer invalid.fake.token' }
    });
    record('B8_BAD_AUTH_REJECTED', resB8BadAuth.status === 401 ? 'PASS' : 'FAIL',
      `Recall with invalid token returned HTTP ${resB8BadAuth.status}`);

    // B.9: Read-only KDS token lacks kds:complete permission
    const readOnlyToken = makeKdsToken(ACTIVE_RESTO_ID, ACTIVE_SLUG, ['kds:read']);
    const resB9ReadOnly = await fetch(`${baseUrl}/kitchen/orders/${ORDER_ELIGIBLE_ID}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${readOnlyToken}` }
    });
    record('B9_READ_ONLY_TOKEN_REJECTED', resB9ReadOnly.status === 403 ? 'PASS' : 'FAIL',
      `Recall with read-only token returned HTTP ${resB9ReadOnly.status}`);

    // =========================================================================
    // SECTION C: STANDALONE KDS QUEUE FILTER SYNCHRONIZATION
    // =========================================================================
    console.log('\n--- SECTION C: Standalone KDS Queue Filter Truth Table ---');

    // Create a dedicated tenant for queue truth table to avoid any order collision
    const QUEUE_RESTO_ID = 9108;
    const QUEUE_SLUG = 'p1-kds-queue-truth';
    await query('DELETE FROM subscriptions WHERE restaurant_id = $1', [QUEUE_RESTO_ID]);
    await query('DELETE FROM orders WHERE restaurant_id = $1', [QUEUE_RESTO_ID]);
    await query('DELETE FROM restaurants WHERE id = $1', [QUEUE_RESTO_ID]);

    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status)
      VALUES ($1, 'P1 Queue Truth Resto', $2, 'enterprise', true, $3, 1, 'VIP', 'active')
    `, [QUEUE_RESTO_ID, QUEUE_SLUG, pinHash]);

    const queueToken = makeKdsToken(QUEUE_RESTO_ID, QUEUE_SLUG);

    // Truth Table Seeding:
    // Q1:  status='kitchen',   sent_to_kds=NULL, kitchen_prepared=0, is_settled=0 -> SHOULD INCLUDE
    // Q2:  status='preparing', sent_to_kds=NULL, kitchen_prepared=0, is_settled=0 -> SHOULD INCLUDE
    // Q3:  status='accepted',  sent_to_kds=1,    kitchen_prepared=0, is_settled=0 -> SHOULD INCLUDE
    // Q4:  status='accepted',  sent_to_kds=0,    kitchen_prepared=0, is_settled=0 -> EXCLUDE
    // Q5:  status='accepted',  sent_to_kds=NULL, kitchen_prepared=0, is_settled=0 -> EXCLUDE
    // Q6:  status='pending',   sent_to_kds=0,    kitchen_prepared=0, is_settled=0 -> EXCLUDE
    // Q7:  status='kitchen',   sent_to_kds=1,    kitchen_prepared=1, is_settled=0 -> EXCLUDE (prepared)
    // Q8:  status='kitchen',   sent_to_kds=1,    kitchen_prepared=0, is_settled=1 -> EXCLUDE (settled)
    // Q9:  status='completed', sent_to_kds=1,    kitchen_prepared=1, is_settled=1 -> EXCLUDE
    // Q10: status='cancelled', sent_to_kds=1,    kitchen_prepared=0, is_settled=0 -> EXCLUDE
    // Q11: status='rejected',  sent_to_kds=1,    kitchen_prepared=0, is_settled=0 -> EXCLUDE
    // Q12: status='kitchen',   sent_to_kds=1,    kitchen_prepared=NULL, is_settled=NULL -> SHOULD INCLUDE (legacy NULLs)

    const seedQueueOrder = async (id, status, sent_to_kds, kitchen_prepared, is_settled) => {
      await query(`
        INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
        VALUES ($1, $2, 'T', '[]', $3, $4, $5, $6, 100)
      `, [id, QUEUE_RESTO_ID, status, sent_to_kds, kitchen_prepared, is_settled]);
    };

    await seedQueueOrder(601, 'kitchen', null, 0, 0);
    await seedQueueOrder(602, 'preparing', null, 0, 0);
    await seedQueueOrder(603, 'accepted', 1, 0, 0);
    await seedQueueOrder(604, 'accepted', 0, 0, 0);
    await seedQueueOrder(605, 'accepted', null, 0, 0);
    await seedQueueOrder(606, 'pending', 0, 0, 0);
    await seedQueueOrder(607, 'kitchen', 1, 1, 0);
    await seedQueueOrder(608, 'kitchen', 1, 0, 1);
    await seedQueueOrder(609, 'completed', 1, 1, 1);
    await seedQueueOrder(610, 'cancelled', 1, 0, 0);
    await seedQueueOrder(611, 'rejected', 1, 0, 0);
    await seedQueueOrder(612, 'kitchen', 1, null, null);

    const resQueue = await fetch(`${baseUrl}/kitchen/orders?slug=${QUEUE_SLUG}`, {
      headers: { 'Authorization': `Bearer ${queueToken}` }
    });
    const dataQueue = await resQueue.json();
    const returnedIds = (dataQueue.orders || []).map(o => o.id).sort((a, b) => a - b);

    const expectedIds = [601, 602, 603, 612];
    const isQueueAccurate = JSON.stringify(returnedIds) === JSON.stringify(expectedIds);

    record('C1_QUEUE_TRUTH_TABLE', isQueueAccurate ? 'PASS' : 'FAIL',
      `Active queue returned [${returnedIds.join(', ')}], expected [${expectedIds.join(', ')}]`);

    // Verify individual inclusion/exclusion expectations
    record('C2_KITCHEN_NULL_SENT_INCLUDED', returnedIds.includes(601) ? 'PASS' : 'FAIL',
      'kitchen status with sent_to_kds=NULL is included');
    record('C3_PREPARING_NULL_SENT_INCLUDED', returnedIds.includes(602) ? 'PASS' : 'FAIL',
      'preparing status with sent_to_kds=NULL is included');
    record('C4_ACCEPTED_SENT_INCLUDED', returnedIds.includes(603) ? 'PASS' : 'FAIL',
      'accepted status with sent_to_kds=1 is included');
    record('C5_ACCEPTED_UNSENT_EXCLUDED', !returnedIds.includes(604) && !returnedIds.includes(605) ? 'PASS' : 'FAIL',
      'accepted status with sent_to_kds=0 or NULL is excluded');
    record('C6_PREPARED_EXCLUDED', !returnedIds.includes(607) ? 'PASS' : 'FAIL',
      'prepared order (kitchen_prepared=1) is excluded');
    record('C7_SETTLED_EXCLUDED', !returnedIds.includes(608) ? 'PASS' : 'FAIL',
      'settled order (is_settled=1) is excluded');
    record('C8_TERMINAL_EXCLUDED', !returnedIds.includes(606) && !returnedIds.includes(609) && !returnedIds.includes(610) && !returnedIds.includes(611) ? 'PASS' : 'FAIL',
      'pending, completed, cancelled, and rejected orders are excluded');
    record('C9_LEGACY_NULLS_INCLUDED', returnedIds.includes(612) ? 'PASS' : 'FAIL',
      'legacy NULLs in kitchen_prepared and is_settled treated as 0 and included');

    // =========================================================================
    // SECTION D: SETTLEMENT RACE & CONCURRENCY TESTS
    // =========================================================================
    console.log('\n--- SECTION D: Settlement Race & Concurrency Tests ---');

    const RACE_ORDER_1 = 701;
    const RACE_ORDER_2 = 702;
    const RACE_ORDER_3 = 703;

    await query('DELETE FROM orders WHERE id IN (701, 702, 703)');

    // D.1: Settlement before recall results in recall rejection
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T-R1', '[]', 'kitchen', 1, 1, 0, 350)
    `, [RACE_ORDER_1, ACTIVE_RESTO_ID]);

    // Admin settles order via actual existing settlement endpoint
    const resSettle1 = await fetch(`${baseUrl}/admin/orders/${RACE_ORDER_1}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeAdminToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    const dataSettle1 = await resSettle1.json();
    assert.strictEqual(resSettle1.status, 200, 'Admin settlement should succeed');

    // Attempt recall on settled order
    const resRecallAfterSettle = await fetch(`${baseUrl}/kitchen/orders/${RACE_ORDER_1}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    record('D1_SETTLEMENT_BEFORE_RECALL', resRecallAfterSettle.status === 409 ? 'PASS' : 'FAIL',
      `Recall after settlement rejected with HTTP ${resRecallAfterSettle.status}`);

    // D.2: Recall followed by settlement removes order from active queue
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T-R2', '[]', 'kitchen', 1, 1, 0, 420)
    `, [RACE_ORDER_2, ACTIVE_RESTO_ID]);

    // 1. Recall the order
    const resRecall2 = await fetch(`${baseUrl}/kitchen/orders/${RACE_ORDER_2}/recall?slug=${ACTIVE_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    assert.strictEqual(resRecall2.status, 200, 'Recall should succeed');

    // 2. Verify it is now present in active queue
    const resQueueBeforeSettle = await fetch(`${baseUrl}/kitchen/orders?slug=${ACTIVE_SLUG}`, {
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataQueueBefore = await resQueueBeforeSettle.json();
    const inQueueBefore = (dataQueueBefore.orders || []).some(o => o.id === RACE_ORDER_2);
    assert.ok(inQueueBefore, 'Recalled order must appear in active queue');

    // 3. Admin settles order
    const resSettle2 = await fetch(`${baseUrl}/admin/orders/${RACE_ORDER_2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeAdminToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    assert.strictEqual(resSettle2.status, 200, 'Admin settlement should succeed');

    // 4. Verify it is removed from active queue
    const resQueueAfterSettle = await fetch(`${baseUrl}/kitchen/orders?slug=${ACTIVE_SLUG}`, {
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataQueueAfter = await resQueueAfterSettle.json();
    const inQueueAfter = (dataQueueAfter.orders || []).some(o => o.id === RACE_ORDER_2);
    record('D2_RECALL_THEN_SETTLEMENT_REMOVED', !inQueueAfter ? 'PASS' : 'FAIL',
      `Order ${RACE_ORDER_2} recalled then settled is correctly absent from active queue`);

    // D.3: Overlapping concurrent settlement and recall leaves order settled and absent from queue
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, items, status, sent_to_kds, kitchen_prepared, is_settled, total_amount)
      VALUES ($1, $2, 'T-R3', '[]', 'kitchen', 1, 1, 0, 500)
    `, [RACE_ORDER_3, ACTIVE_RESTO_ID]);

    // Fire settlement and recall concurrently
    const [settleRes, recallRes] = await Promise.all([
      fetch(`${baseUrl}/admin/orders/${RACE_ORDER_3}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeAdminToken}`
        },
        body: JSON.stringify({ status: 'completed' })
      }),
      fetch(`${baseUrl}/kitchen/orders/${RACE_ORDER_3}/recall?slug=${ACTIVE_SLUG}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${activeKdsToken}` }
      })
    ]);

    // Inspect database state: final state MUST be settled
    const dbOrder3 = await query('SELECT status, is_settled FROM orders WHERE id = $1', [RACE_ORDER_3]);
    const finalOrder = dbOrder3[0];

    const resQueueRace = await fetch(`${baseUrl}/kitchen/orders?slug=${ACTIVE_SLUG}`, {
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataQueueRace = await resQueueRace.json();
    const inQueueRace = (dataQueueRace.orders || []).some(o => o.id === RACE_ORDER_3);

    record('D3_CONCURRENT_RACE_SETTLED',
      finalOrder.is_settled === 1 && !inQueueRace ? 'PASS' : 'FAIL',
      `Concurrent settlement & recall: DB is_settled=${finalOrder.is_settled}, absent from queue=${!inQueueRace}`);

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // Cleanup test fixtures
    try {
      for (const rid of ALL_TEST_RESTOS.concat([9108])) {
        await query('DELETE FROM subscriptions WHERE restaurant_id = $1', [rid]);
        await query('DELETE FROM orders WHERE restaurant_id = $1', [rid]);
        await query('DELETE FROM admins WHERE restaurant_id = $1', [rid]);
        await query('DELETE FROM restaurants WHERE id = $1', [rid]);
      }
      await query('DELETE FROM orders WHERE id IN (501, 502, 503, 504, 505, 506, 507, 508, 509, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610, 611, 612, 701, 702, 703)');
    } catch (cleanErr) {
      console.warn('Cleanup notice:', cleanErr.message);
    }
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`🏁 P1 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
