/**
 * TouchQR — P0 Admin Authorization Security Boundary Regression Test Suite
 *
 * SAFETY INVARIANT:
 * Strictly tests HTTP request/response behavior against local disposable test database.
 * NEVER connects to or mutates production database.
 *
 * TEST REQUIREMENTS:
 * 1. kds_screen token receives HTTP 403 ADMIN_ROLE_REQUIRED on representative administrative routes (/me, /subscription-status, /orders, /dishes).
 * 2. Unauthenticated request to protected administrative route receives HTTP 401.
 * 3. POST /api/admin/login remains publicly accessible and retains existing validation behavior.
 * 4. POST /api/admin/forgot-password remains publicly accessible and retains existing HTTP 410 behavior.
 * 5. Valid restaurant_admin token retains intended access to tenant-scoped routes.
 * 6. Valid impersonation token with role restaurant_admin and valid tenant ID retains intended access.
 * 7. Master superadmin token without tenant context cannot access tenant operational data (HTTP 401).
 * 8. Legitimate KDS endpoints (/api/kitchen/verify-pin, /api/kitchen/orders) continue to function uninterrupted.
 */

import assert from 'assert';
import http from 'http';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

import { validateTestDatabaseUrl } from './testDbGuard.js';

// Enforce local disposable test database URL strictly
const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';
process.env.TEST_DATABASE_URL = LOCAL_TEST_URL;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { query, initDb } from '../db.js';
import adminRouter from '../routes/admin.js';
import apiRouter from '../routes/api.js';
import { JWT_SECRET } from '../config/jwt.js';

console.log('======================================================================');
console.log('🛡️  TOUCHQR P0 ADMIN AUTHORIZATION REGRESSION TEST SUITE');
console.log('======================================================================\n');

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
  await initDb();

  // Create isolated test harness Express app
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const TEST_RESTO_ID = 9801;
  const TEST_SLUG = 'p0-sec-kitchen';
  const TEST_PIN = '1234';

  try {
    // 0. Setup isolated test fixtures
    await query(`DELETE FROM subscriptions WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
    await query(`DELETE FROM orders WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
    await query(`DELETE FROM dishes WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
    await query(`DELETE FROM admins WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
    await query(`DELETE FROM restaurants WHERE id = $1`, [TEST_RESTO_ID]);

    const pinHash = await bcrypt.hash(TEST_PIN, 10);
    const passwordHash = await bcrypt.hash('CorrectPass123!', 10);

    // Insert test restaurant with active VIP enterprise subscription tier and valid KDS PIN
    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, kds_pin_hash, kds_auth_version, direct_ordering_enabled, subscription_type, mandate_status)
      VALUES ($1, 'P0 Security Test Kitchen', $2, 'enterprise', true, $3, 1, 1, 'VIP', 'active')
    `, [TEST_RESTO_ID, TEST_SLUG, pinHash]);

    // Insert test restaurant admin
    await query(`
      INSERT INTO admins (id, username, password_hash, restaurant_id, role)
      VALUES ($1, 'p0_owner', $2, $1, 'restaurant_admin')
    `, [TEST_RESTO_ID, passwordHash]);

    // Insert test dish for tenant 9801
    await query(`
      INSERT INTO dishes (id, restaurant_id, name, price, available)
      VALUES ($1, $1, 'P0 Safety Biryani', 320, true)
    `, [TEST_RESTO_ID]);

    // Insert test active order for tenant 9801
    await query(`
      INSERT INTO orders (id, restaurant_id, table_number, customer_name, items, status, sent_to_kds, kitchen_prepared, total_amount)
      VALUES ($1, $1, 'T-01', 'Security Guest', '[{"name":"P0 Safety Biryani","quantity":1}]', 'kitchen', 1, 0, 320)
    `, [TEST_RESTO_ID]);

    // Generate tokens
    const kdsToken = jwt.sign(
      {
        role: 'kds_screen',
        restaurant_id: TEST_RESTO_ID,
        slug: TEST_SLUG,
        auth_version: 1,
        permissions: ['kds:read', 'kds:complete']
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const validAdminToken = jwt.sign(
      {
        id: TEST_RESTO_ID,
        username: 'p0_owner',
        restaurant_id: TEST_RESTO_ID,
        role: 'restaurant_admin'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const validImpersonationToken = jwt.sign(
      {
        id: TEST_RESTO_ID,
        username: 'p0_owner',
        role: 'restaurant_admin',
        restaurant_id: TEST_RESTO_ID,
        is_impersonated: true,
        superadmin_username: 'master_superadmin'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const masterSuperAdminToken = jwt.sign(
      {
        id: 1,
        username: 'master_superadmin',
        role: 'superadmin'
        // Intentionally NO restaurant_id
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ====================================================================
    // VERIFICATION 1: KDS token receives HTTP 403 ADMIN_ROLE_REQUIRED
    // ====================================================================
    console.log('--- 1. KDS Token Exclusion from Administrative Routes ---');

    // 1a: GET /api/admin/me
    const resKdsMe = await fetch(`${baseUrl}/admin/me`, {
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    const dataKdsMe = await resKdsMe.json();
    if (resKdsMe.status === 403 && dataKdsMe.error === 'ADMIN_ROLE_REQUIRED') {
      record('KDS_BLOCKED_ME', 'PASS', 'GET /api/admin/me returned 403 ADMIN_ROLE_REQUIRED');
    } else {
      record('KDS_BLOCKED_ME', 'FAIL', `Expected 403 ADMIN_ROLE_REQUIRED, got ${resKdsMe.status}: ${JSON.stringify(dataKdsMe)}`);
    }

    // 1b: GET /api/admin/subscription-status
    const resKdsSub = await fetch(`${baseUrl}/admin/subscription-status`, {
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    const dataKdsSub = await resKdsSub.json();
    if (resKdsSub.status === 403 && dataKdsSub.error === 'ADMIN_ROLE_REQUIRED') {
      record('KDS_BLOCKED_SUB_STATUS', 'PASS', 'GET /api/admin/subscription-status returned 403 ADMIN_ROLE_REQUIRED');
    } else {
      record('KDS_BLOCKED_SUB_STATUS', 'FAIL', `Expected 403 ADMIN_ROLE_REQUIRED, got ${resKdsSub.status}: ${JSON.stringify(dataKdsSub)}`);
    }

    // 1c: GET /api/admin/orders
    const resKdsOrders = await fetch(`${baseUrl}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    const dataKdsOrders = await resKdsOrders.json();
    if (resKdsOrders.status === 403 && dataKdsOrders.error === 'ADMIN_ROLE_REQUIRED') {
      record('KDS_BLOCKED_ADMIN_ORDERS', 'PASS', 'GET /api/admin/orders returned 403 ADMIN_ROLE_REQUIRED');
    } else {
      record('KDS_BLOCKED_ADMIN_ORDERS', 'FAIL', `Expected 403 ADMIN_ROLE_REQUIRED, got ${resKdsOrders.status}: ${JSON.stringify(dataKdsOrders)}`);
    }

    // 1d: GET /api/admin/dishes
    const resKdsDishes = await fetch(`${baseUrl}/admin/dishes`, {
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    const dataKdsDishes = await resKdsDishes.json();
    if (resKdsDishes.status === 403 && dataKdsDishes.error === 'ADMIN_ROLE_REQUIRED') {
      record('KDS_BLOCKED_DISHES', 'PASS', 'GET /api/admin/dishes returned 403 ADMIN_ROLE_REQUIRED');
    } else {
      record('KDS_BLOCKED_DISHES', 'FAIL', `Expected 403 ADMIN_ROLE_REQUIRED, got ${resKdsDishes.status}: ${JSON.stringify(dataKdsDishes)}`);
    }

    // ====================================================================
    // VERIFICATION 2: Unauthenticated request receives HTTP 401
    // ====================================================================
    console.log('\n--- 2. Unauthenticated Request Enforcement ---');

    const resUnauthMe = await fetch(`${baseUrl}/admin/me`);
    const dataUnauthMe = await resUnauthMe.json();
    if (resUnauthMe.status === 401) {
      record('UNAUTH_BLOCKED_ME', 'PASS', `Unauthenticated GET /api/admin/me returned 401: ${dataUnauthMe.error}`);
    } else {
      record('UNAUTH_BLOCKED_ME', 'FAIL', `Expected 401, got ${resUnauthMe.status}`);
    }

    const resUnauthOrders = await fetch(`${baseUrl}/admin/orders`);
    if (resUnauthOrders.status === 401) {
      record('UNAUTH_BLOCKED_ORDERS', 'PASS', 'Unauthenticated GET /api/admin/orders returned 401');
    } else {
      record('UNAUTH_BLOCKED_ORDERS', 'FAIL', `Expected 401, got ${resUnauthOrders.status}`);
    }

    // ====================================================================
    // VERIFICATION 3: POST /api/admin/login remains public with validations
    // ====================================================================
    console.log('\n--- 3. Public Admin Login Accessibility & Validation ---');

    // Missing credentials -> 400
    const resLoginEmpty = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const dataLoginEmpty = await resLoginEmpty.json();
    if (resLoginEmpty.status === 400 && dataLoginEmpty.error === 'Username and password are required') {
      record('LOGIN_EMPTY_VALIDATION', 'PASS', 'POST /api/admin/login without body rejected with 400 validation error');
    } else {
      record('LOGIN_EMPTY_VALIDATION', 'FAIL', `Expected 400, got ${resLoginEmpty.status}: ${JSON.stringify(dataLoginEmpty)}`);
    }

    // Invalid credentials -> 401
    const resLoginBad = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'p0_owner', password: 'WrongPassword999!' })
    });
    if (resLoginBad.status === 401) {
      record('LOGIN_INVALID_PASSWORD', 'PASS', 'POST /api/admin/login with invalid password rejected with 401');
    } else {
      record('LOGIN_INVALID_PASSWORD', 'FAIL', `Expected 401, got ${resLoginBad.status}`);
    }

    // Valid credentials -> 200
    const resLoginGood = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'p0_owner', password: 'CorrectPass123!' })
    });
    const dataLoginGood = await resLoginGood.json();
    if (resLoginGood.status === 200 && dataLoginGood.token && dataLoginGood.role === 'restaurant_admin') {
      record('LOGIN_SUCCESS', 'PASS', `POST /api/admin/login authenticated successfully; token issued for ${dataLoginGood.username}`);
    } else {
      record('LOGIN_SUCCESS', 'FAIL', `Expected 200, got ${resLoginGood.status}: ${JSON.stringify(dataLoginGood)}`);
    }

    // ====================================================================
    // VERIFICATION 4: POST /api/admin/forgot-password remains public 410
    // ====================================================================
    console.log('\n--- 4. Public Forgot Password Accessibility ---');

    const resForgot = await fetch(`${baseUrl}/admin/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'p0_owner' })
    });
    const dataForgot = await resForgot.json();
    if (resForgot.status === 410 && dataForgot.error === 'PASSWORD_RESET_DISABLED') {
      record('FORGOT_PASSWORD_410', 'PASS', 'POST /api/admin/forgot-password returned public HTTP 410 PASSWORD_RESET_DISABLED');
    } else {
      record('FORGOT_PASSWORD_410', 'FAIL', `Expected 410, got ${resForgot.status}: ${JSON.stringify(dataForgot)}`);
    }

    // ====================================================================
    // VERIFICATION 5: Valid restaurant_admin token retains intended access
    // ====================================================================
    console.log('\n--- 5. Valid Tenant Admin Route Access ---');

    const resAdminMe = await fetch(`${baseUrl}/admin/me`, {
      headers: { 'Authorization': `Bearer ${validAdminToken}` }
    });
    const dataAdminMe = await resAdminMe.json();
    if (resAdminMe.status === 200 && dataAdminMe.restaurant && dataAdminMe.restaurant.id === TEST_RESTO_ID) {
      record('ADMIN_ACCESS_ME', 'PASS', `GET /api/admin/me returned 200 for tenant '${dataAdminMe.restaurant.name}'`);
    } else {
      record('ADMIN_ACCESS_ME', 'FAIL', `Expected 200, got ${resAdminMe.status}: ${JSON.stringify(dataAdminMe)}`);
    }

    const resAdminOrders = await fetch(`${baseUrl}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${validAdminToken}` }
    });
    const dataAdminOrders = await resAdminOrders.json();
    if (resAdminOrders.status === 200 && Array.isArray(dataAdminOrders.orders || dataAdminOrders)) {
      record('ADMIN_ACCESS_ORDERS', 'PASS', 'GET /api/admin/orders returned 200 with tenant orders');
    } else {
      record('ADMIN_ACCESS_ORDERS', 'FAIL', `Expected 200, got ${resAdminOrders.status}: ${JSON.stringify(dataAdminOrders)}`);
    }

    const resAdminDishes = await fetch(`${baseUrl}/admin/dishes`, {
      headers: { 'Authorization': `Bearer ${validAdminToken}` }
    });
    const dataAdminDishes = await resAdminDishes.json();
    if (resAdminDishes.status === 200 && Array.isArray(dataAdminDishes)) {
      record('ADMIN_ACCESS_DISHES', 'PASS', `GET /api/admin/dishes returned 200 with ${dataAdminDishes.length} items`);
    } else {
      record('ADMIN_ACCESS_DISHES', 'FAIL', `Expected 200, got ${resAdminDishes.status}: ${JSON.stringify(dataAdminDishes)}`);
    }

    // ====================================================================
    // VERIFICATION 6: Valid Impersonation token retains intended access
    // ====================================================================
    console.log('\n--- 6. Impersonation Token Tenant Access ---');

    const resImpMe = await fetch(`${baseUrl}/admin/me`, {
      headers: { 'Authorization': `Bearer ${validImpersonationToken}` }
    });
    const dataImpMe = await resImpMe.json();
    if (resImpMe.status === 200 && dataImpMe.restaurant && dataImpMe.restaurant.id === TEST_RESTO_ID) {
      record('IMPERSONATION_ACCESS_ME', 'PASS', `Impersonation token accessed GET /api/admin/me for tenant '${dataImpMe.restaurant.name}'`);
    } else {
      record('IMPERSONATION_ACCESS_ME', 'FAIL', `Expected 200, got ${resImpMe.status}: ${JSON.stringify(dataImpMe)}`);
    }

    const resImpOrders = await fetch(`${baseUrl}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${validImpersonationToken}` }
    });
    if (resImpOrders.status === 200) {
      record('IMPERSONATION_ACCESS_ORDERS', 'PASS', 'Impersonation token accessed GET /api/admin/orders');
    } else {
      record('IMPERSONATION_ACCESS_ORDERS', 'FAIL', `Expected 200, got ${resImpOrders.status}`);
    }

    // ====================================================================
    // VERIFICATION 7: Master superadmin token without tenant context blocked
    // ====================================================================
    console.log('\n--- 7. Master Superadmin Without Tenant Context Guard ---');

    const resSuperMe = await fetch(`${baseUrl}/admin/me`, {
      headers: { 'Authorization': `Bearer ${masterSuperAdminToken}` }
    });
    const dataSuperMe = await resSuperMe.json();
    if (resSuperMe.status === 401 && dataSuperMe.error === 'Restaurant identity is missing from authentication context') {
      record('MASTER_SUPERADMIN_NO_TENANT_ME', 'PASS', 'Master superadmin token without tenant context correctly rejected with 401 on /me');
    } else {
      record('MASTER_SUPERADMIN_NO_TENANT_ME', 'FAIL', `Expected 401, got ${resSuperMe.status}: ${JSON.stringify(dataSuperMe)}`);
    }

    const resSuperOrders = await fetch(`${baseUrl}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${masterSuperAdminToken}` }
    });
    const dataSuperOrders = await resSuperOrders.json();
    if (resSuperOrders.status === 401 && dataSuperOrders.error === 'Restaurant identity is missing from authentication context') {
      record('MASTER_SUPERADMIN_NO_TENANT_ORDERS', 'PASS', 'Master superadmin token without tenant context correctly rejected with 401 on /orders');
    } else {
      record('MASTER_SUPERADMIN_NO_TENANT_ORDERS', 'FAIL', `Expected 401, got ${resSuperOrders.status}: ${JSON.stringify(dataSuperOrders)}`);
    }

    // ====================================================================
    // VERIFICATION 8: Legitimate KDS endpoints remain unbroken
    // ====================================================================
    console.log('\n--- 8. Legitimate KDS Endpoints Operational Continuity ---');

    // 8a: Verify PIN generates valid KDS session token
    const resKdsPin = await fetch(`${baseUrl}/kitchen/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: TEST_SLUG, pin: TEST_PIN })
    });
    const dataKdsPin = await resKdsPin.json();
    const decodedKds = dataKdsPin.token ? jwt.decode(dataKdsPin.token) : null;
    if (resKdsPin.status === 200 && dataKdsPin.success && decodedKds && decodedKds.role === 'kds_screen') {
      record('KDS_PIN_VERIFY_SUCCESS', 'PASS', `POST /api/kitchen/verify-pin returned 200 and issued token with role: ${decodedKds.role}`);
    } else {
      record('KDS_PIN_VERIFY_SUCCESS', 'FAIL', `Expected 200, got ${resKdsPin.status}: ${JSON.stringify(dataKdsPin)}`);
    }

    // 8b: Fetch KDS orders with legitimate KDS token
    const activeKdsToken = dataKdsPin.token || kdsToken;
    const resKdsFetch = await fetch(`${baseUrl}/kitchen/orders?slug=${TEST_SLUG}`, {
      headers: { 'Authorization': `Bearer ${activeKdsToken}` }
    });
    const dataKdsFetch = await resKdsFetch.json();
    if (resKdsFetch.status === 200 && Array.isArray(dataKdsFetch.orders)) {
      record('KDS_ORDERS_FETCH_SUCCESS', 'PASS', `GET /api/kitchen/orders returned 200 with ${dataKdsFetch.orders.length} active kitchen tickets`);
    } else {
      record('KDS_ORDERS_FETCH_SUCCESS', 'FAIL', `Expected 200, got ${resKdsFetch.status}: ${JSON.stringify(dataKdsFetch)}`);
    }

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // 9. Clean up test fixtures from disposable DB
    try {
      await query(`DELETE FROM subscriptions WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
      await query(`DELETE FROM orders WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
      await query(`DELETE FROM dishes WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
      await query(`DELETE FROM admins WHERE restaurant_id = $1`, [TEST_RESTO_ID]);
      await query(`DELETE FROM restaurants WHERE id = $1`, [TEST_RESTO_ID]);
    } catch (cleanErr) {
      console.warn('Cleanup notice:', cleanErr.message);
    }
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`🏁 P0 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

