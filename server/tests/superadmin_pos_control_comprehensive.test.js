import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import adminRouter from '../routes/admin.js';
import superadminRouter from '../routes/superadmin.js';
import apiRouter from '../routes/api.js';
import { JWT_SECRET } from '../config/jwt.js';
import { resolveTenantCapabilities, FEATURE_METADATA } from '../../src/utils/planCapabilities.js';

test('👑 360° Super Admin POS Control & Gating Invariant Test Suite', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api/superadmin', superadminRouter);
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const superToken = jwt.sign(
    { id: 1, username: 'master_superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // 1. Seed SaaS Plans
    await query(`
      INSERT OR REPLACE INTO saas_plans (key, name, price, counter_ordering_enabled)
      VALUES 
        ('test_basic', 'Test Basic Plan', 499, 0),
        ('test_pro', 'Test Pro Plan', 999, 1),
        ('test_enterprise', 'Test Enterprise Plan', 1999, 1)
    `);

    // 2. Seed Test Restaurants
    const futureExpiry = new Date(Date.now() + 60 * 86400000).toISOString();
    
    // Restaurant A on test_basic (Paid, active, counter_ordering_enabled = 0 by default)
    const restoARes = await query(`
      INSERT INTO restaurants (name, slug, gst_enabled, plan_tier, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, ['Test Basic Diner', 'test-basic-diner', 1, 'test_basic', 'PAID', 'active', 1, futureExpiry]);
    const restoAId = (restoARes.rows || restoARes)[0].id;

    // Restaurant B on test_pro (Paid, active, counter_ordering_enabled = 1 by plan)
    const restoBRes = await query(`
      INSERT INTO restaurants (name, slug, gst_enabled, plan_tier, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, ['Test Pro Cafe', 'test-pro-cafe', 1, 'test_pro', 'PAID', 'active', 1, futureExpiry]);
    const restoBId = (restoBRes.rows || restoBRes)[0].id;

    const tokenA = jwt.sign({ id: 101, username: 'admin_a', role: 'admin', restaurant_id: restoAId }, JWT_SECRET, { expiresIn: '1h' });
    const tokenB = jwt.sign({ id: 102, username: 'admin_b', role: 'admin', restaurant_id: restoBId }, JWT_SECRET, { expiresIn: '1h' });

    // TEST 1: Super Admin GET /api/superadmin/plans returns counter_ordering_enabled
    await t.test('1. GET /api/superadmin/plans exposes counter_ordering_enabled for all plans', async () => {
      const res = await fetch(`${baseUrl}/api/superadmin/plans`, {
        headers: { Authorization: `Bearer ${superToken}` }
      });
      assert.strictEqual(res.status, 200);
      const plans = await res.json();
      assert.ok(Array.isArray(plans));
      const planBasic = plans.find(p => p.key === 'test_basic');
      const planPro = plans.find(p => p.key === 'test_pro');
      assert.ok(planBasic);
      assert.ok(planPro);
      assert.strictEqual(planBasic.counter_ordering_enabled, false);
      assert.strictEqual(planPro.counter_ordering_enabled, true);
    });

    // TEST 2: Tenant A on test_basic is blocked from placing POS orders (403)
    await t.test('2. Tenant A (Basic plan) receives 403 feature_locked when creating POS order', async () => {
      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          order_type: 'takeaway',
          items: [{ id: 1, name: 'Samosa', price: 20, quantity: 2 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'feature_locked');
      assert.strictEqual(data.feature, 'counter_ordering_enabled');
    });

    // TEST 3: Tenant B on test_pro succeeds in placing POS order (200)
    await t.test('3. Tenant B (Pro plan) succeeds in creating POS order with token TK-01', async () => {
      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({
          order_type: 'takeaway',
          customer_name: 'Priya',
          items: [{ id: 2, name: 'Cold Coffee', price: 80, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.token_display, 'TK-01');
    });

    // TEST 4: Super Admin PUT /api/superadmin/plans/test_basic updates counter_ordering_enabled = 1
    await t.test('4. Super Admin enables POS on test_basic via PUT /api/superadmin/plans/:key', async () => {
      const updateRes = await fetch(`${baseUrl}/api/superadmin/plans/test_basic`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({
          name: 'Test Basic Plan (POS Enabled)',
          price: 599,
          counter_ordering_enabled: 1
        })
      });
      assert.strictEqual(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.strictEqual(updateData.success, true);

      // Now Tenant A should be able to create POS order without error
      const posRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          order_type: 'takeaway',
          customer_name: 'Amit',
          items: [{ id: 1, name: 'Masala Dosa', price: 120, quantity: 1 }]
        })
      });
      assert.strictEqual(posRes.status, 200);
      const posData = await posRes.json();
      assert.strictEqual(posData.success, true);
      assert.strictEqual(posData.token_display, 'TK-01');
    });

    // TEST 5: Super Admin PUT /api/superadmin/restaurants/:id disables POS specifically for Restaurant A
    await t.test('5. Super Admin overrides POS = 0 on specific restaurant via PUT /api/superadmin/restaurants/:id', async () => {
      const restoUpdateRes = await fetch(`${baseUrl}/api/superadmin/restaurants/${restoAId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({
          counter_ordering_enabled: 0
        })
      });
      assert.strictEqual(restoUpdateRes.status, 200);

      // Even though test_basic plan currently has counter_ordering_enabled = 1,
      // the restaurant-specific override of 0 must strictly block it!
      const blockedRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          order_type: 'takeaway',
          items: [{ id: 1, name: 'Tea', price: 15, quantity: 1 }]
        })
      });
      assert.strictEqual(blockedRes.status, 403);
      const body = await blockedRes.json();
      assert.strictEqual(body.error, 'feature_locked');
      assert.strictEqual(body.feature, 'counter_ordering_enabled');
    });

    // TEST 6: Super Admin Shop 360° Profile API (/api/superadmin/restaurants/:id/360) reflects feature matrix
    await t.test('6. GET /api/superadmin/restaurants/:id/360 includes counter_ordering_enabled in feature_matrix', async () => {
      const res360 = await fetch(`${baseUrl}/api/superadmin/restaurants/${restoAId}/360`, {
        headers: { Authorization: `Bearer ${superToken}` }
      });
      assert.strictEqual(res360.status, 200);
      const profileData = await res360.json();
      assert.ok(profileData.usage);
      assert.ok(profileData.usage.feature_matrix);
      assert.ok(profileData.usage.feature_matrix.counter_ordering_enabled);
      assert.strictEqual(profileData.usage.feature_matrix.counter_ordering_enabled.label, 'Counter Quick POS & Token Billing');
      // Because we set counter_ordering_enabled = 0 on Resto A in Test 5, it must be LOCKED
      assert.strictEqual(profileData.usage.feature_matrix.counter_ordering_enabled.status, 'LOCKED');
    });

    // TEST 7: Super Admin POST /api/superadmin/plans creates a new custom plan with counter_ordering_enabled
    await t.test('7. POST /api/superadmin/plans creates new plan with counter_ordering_enabled flag', async () => {
      const createRes = await fetch(`${baseUrl}/api/superadmin/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({
          key: 'test_kiosk',
          name: 'Kiosk Takeaway Plan',
          price: 799,
          counter_ordering_enabled: 1
        })
      });
      assert.strictEqual(createRes.status, 200);

      const checkPlansRes = await fetch(`${baseUrl}/api/superadmin/plans`, {
        headers: { Authorization: `Bearer ${superToken}` }
      });
      const allPlans = await checkPlansRes.json();
      const createdPlan = allPlans.find(p => p.key === 'test_kiosk');
      assert.ok(createdPlan);
      assert.strictEqual(createdPlan.counter_ordering_enabled, true);
    });

    // TEST 8: Super Admin UNTICKS POS on test_pro -> Tenant B is instantly locked across API & resolveTenantCapabilities
    await t.test('8. Unticking POS on test_pro instantly locks Tenant B across API & frontend capabilities', async () => {
      const untickRes = await fetch(`${baseUrl}/api/superadmin/plans/test_pro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${superToken}` },
        body: JSON.stringify({
          counter_ordering_enabled: 0
        })
      });
      assert.strictEqual(untickRes.status, 200);

      // Verify subscription status endpoint
      const subRes = await fetch(`${baseUrl}/api/admin/subscription-status`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert.strictEqual(subRes.status, 200);
      const subData = await subRes.json();
      assert.strictEqual(subData.counter_ordering_enabled, false);
      assert.strictEqual(subData.permissions.counter_ordering_enabled, false);

      // Verify resolveTenantCapabilities returns false EVEN with stale settingsForm: true
      const caps = resolveTenantCapabilities(
        { restaurant: { id: restoBId, plan_tier: 'test_pro', counter_ordering_enabled: null } },
        { counter_ordering_enabled: true },
        subData
      );
      assert.strictEqual(caps.counter_ordering_enabled, false);

      // Verify pos-order returns 403 feature_locked
      const orderRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({
          order_type: 'takeaway',
          items: [{ id: 1, name: 'Coffee', price: 50, quantity: 1 }]
        })
      });
      assert.strictEqual(orderRes.status, 403);
      const orderErr = await orderRes.json();
      assert.strictEqual(orderErr.error, 'feature_locked');
    });

    // TEST 9: Tenant B attempting to enable counter_ordering_enabled via PUT /api/admin/settings is constrained
    await t.test('9. Tenant cannot re-enable counter_ordering_enabled via settings when plan forbids it', async () => {
      const updateSettingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({
          counter_ordering_enabled: true
        })
      });
      assert.strictEqual(updateSettingsRes.status, 200);

      // Ensure restaurants table has not been set to 1
      const checkResto = await query('SELECT counter_ordering_enabled FROM restaurants WHERE id = $1', [restoBId]);
      const val = (checkResto.rows || checkResto)[0].counter_ordering_enabled;
      assert.ok(val === 0 || val === null, `Expected counter_ordering_enabled to be 0 or null, got ${val}`);
    });

    // TEST 10: Generating counter QR token does not set restaurants.counter_ordering_enabled = 1
    await t.test('10. Generating counter QR token does not mutate restaurants.counter_ordering_enabled', async () => {
      const qrTokenRes = await fetch(`${baseUrl}/api/admin/qr/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({
          space_type: 'counter',
          space_number: 'COUNTER'
        })
      });
      assert.strictEqual(qrTokenRes.status, 200);

      const checkResto = await query('SELECT counter_ordering_enabled FROM restaurants WHERE id = $1', [restoBId]);
      const val = (checkResto.rows || checkResto)[0].counter_ordering_enabled;
      assert.ok(val === 0 || val === null, `Expected counter_ordering_enabled to remain 0 or null, got ${val}`);
    });

    // TEST 11: Even if restaurants.counter_ordering_enabled is forcibly set to 1 in DB, plan untick strictly overrides and locks it
    await t.test('11. Restaurant row with counter_ordering_enabled = 1 is strictly overridden when plan unticks POS', async () => {
      // Forcibly set counter_ordering_enabled = 1 in DB for Tenant B
      await query('UPDATE restaurants SET counter_ordering_enabled = 1 WHERE id = $1', [restoBId]);

      // 1. Check /api/admin/subscription-status
      const subRes = await fetch(`${baseUrl}/api/admin/subscription-status`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert.strictEqual(subRes.status, 200);
      const subData = await subRes.json();
      assert.strictEqual(subData.counter_ordering_enabled, false, 'subscription-status must return false when plan disables POS');
      assert.strictEqual(subData.permissions.counter_ordering_enabled, false);

      // 2. Check /api/info
      const infoRes = await fetch(`${baseUrl}/api/info?slug=test-pro-cafe`, {
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      if (infoRes.status !== 200) {
        console.error('infoRes status:', infoRes.status, await infoRes.text());
      }
      assert.strictEqual(infoRes.status, 200);
      const infoData = await infoRes.json();
      assert.strictEqual(infoData.counter_ordering_enabled, false, '/api/info must return false when plan disables POS');

      // 3. Check resolveTenantCapabilities
      const caps = resolveTenantCapabilities(
        { restaurant: { id: restoBId, plan_tier: 'test_pro', counter_ordering_enabled: 1 } },
        { counter_ordering_enabled: true },
        subData
      );
      assert.strictEqual(caps.counter_ordering_enabled, false, 'resolveTenantCapabilities must return false even if restaurant has 1');

      // 4. Check pos-order is blocked with 403
      const orderRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({
          order_type: 'takeaway',
          items: [{ id: 1, name: 'Samosa', price: 20, quantity: 2 }]
        })
      });
      assert.strictEqual(orderRes.status, 403, 'pos-order must return 403');
      const orderErr = await orderRes.json();
      assert.strictEqual(orderErr.error, 'feature_locked');
    });

  } finally {
    await new Promise(resolve => server.close(resolve));
    setTimeout(() => process.exit(0), 100);
  }
});
