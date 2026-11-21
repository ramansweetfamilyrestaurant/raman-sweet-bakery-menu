/**
 * TouchQR — Takeaway & Daily Sequential Token Lifecycle Test Suite
 *
 * Rigorously verifies:
 * 1. Dine-In orders do NOT generate takeaway tokens.
 * 2. Table orders with order_type: 'takeaway' generate sequential tokens (TK-01).
 * 3. Counter QR orders automatically generate sequential tokens (TK-02, TK-03...).
 * 4. Tracking endpoint (/api/orders/track/:id) returns token metadata.
 * 5. KDS queue (/api/kds/orders) delivers token metadata to kitchen screens.
 * 6. Formatting helpers correctly format Takeaway tokens for display and printing.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import http from 'http';
import express from 'express';
import { JWT_SECRET } from '../config/jwt.js';
import { generateHmacQrToken } from '../utils/qrSecurity.js';
import { generatePresenceToken, generateQrContextHash } from '../utils/presenceVerification.js';
import { query, initDb } from '../db.js';
import apiRouter from '../routes/api.js';
import adminRouter from '../routes/admin.js';
import { formatOrderLocation } from '../../src/utils/billingHelper.js';

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

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR TAKEAWAY & TOKEN LIFECYCLE RIGOROUS VERIFICATION');
  console.log('======================================================================\n');

  await initDb({ isTest: true, skipSeed: true });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const testSlug = 'sweet-bakery-takeaway';
    const qrSecret = crypto.randomBytes(32).toString('hex');

    // 1. Setup SaaS Plan, Restaurant & Menu Item
    await query(`
      INSERT OR REPLACE INTO saas_plans (key, name, direct_ordering_enabled, kds_enabled)
      VALUES ('enterprise', 'Enterprise Plan', 1, 1)
    `);

    const restoInsert = await query(`
      INSERT INTO restaurants (
        name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled,
        total_tables, plan_tier, subscription_type, table_verification_mode, kds_screen_enabled
      ) VALUES ($1, $2, $3, 1, 1, 1, 10, 'enterprise', 'paid', 'QR_ONLY', 1)
      RETURNING id
    `, ['Sweet Bakery & Fast Food', testSlug, qrSecret]);

    const restoId = restoInsert[0].id;

    const dishInsert = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Rasgulla (1kg Box)', 240, 1)
      RETURNING id
    `, [restoId]);
    const dishId = dishInsert[0].id;

    const table1Token = generateHmacQrToken(testSlug, 'table', '1', qrSecret);
    const counterToken = generateHmacQrToken(testSlug, 'counter', 'COUNTER', qrSecret);

    const table1PresenceToken = generatePresenceToken({
      verificationToken: 'vtok_table1_test',
      restaurantId: restoId,
      slug: testSlug,
      spaceType: 'table',
      spaceNumber: '1',
      qrContextHash: generateQrContextHash(testSlug, 'table', '1', table1Token),
      expiryMinutes: 20
    });

    const counterPresenceToken = generatePresenceToken({
      verificationToken: 'vtok_counter_test',
      restaurantId: restoId,
      slug: testSlug,
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      qrContextHash: generateQrContextHash(testSlug, 'counter', 'COUNTER', counterToken),
      expiryMinutes: 20
    });

    let dineInOrderId = null;
    let takeawayOrderId = null;
    let counterOrderId = null;
    let counterOrderTrackingToken = null;

    // --- TEST 1: Standard Dine-In Order (Table 1) ---
    await testAsync('1. Standard Dine-In Order: does NOT generate takeaway token', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: testSlug,
          table_number: '1',
          space_type: 'table',
          table_token: table1Token,
          presence_token: table1PresenceToken,
          order_type: 'dine_in',
          items: [{ dish_id: dishId, quantity: 1 }]
        })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.order_type, 'dine_in');
      assert.strictEqual(data.token_number, null);
      assert.strictEqual(data.token_display, null);
      dineInOrderId = data.order_id;

      // Verify DB row
      const rows = await query('SELECT order_type, token_number, token_display FROM orders WHERE id = $1', [dineInOrderId]);
      assert.strictEqual(rows[0].order_type, 'dine_in');
      assert.strictEqual(rows[0].token_number, null);
      assert.strictEqual(rows[0].token_display, null);
    });

    // --- TEST 2: Hybrid Order (Table 1 with order_type: 'takeaway') ---
    await testAsync('2. Table Order with order_type="takeaway": Generates Token TK-01', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: testSlug,
          table_number: '1',
          space_type: 'table',
          table_token: table1Token,
          presence_token: table1PresenceToken,
          order_type: 'takeaway',
          items: [{ dish_id: dishId, quantity: 2 }]
        })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.order_type, 'takeaway');
      assert.strictEqual(data.token_number, 1);
      assert.strictEqual(data.token_display, 'TK-01');
      assert.ok(data.message.includes('TK-01'));
      takeawayOrderId = data.order_id;

      // Verify DB row & multi-round session linkage
      const rows = await query('SELECT order_type, token_number, token_display, round_number, parent_order_id, session_id FROM orders WHERE id = $1', [takeawayOrderId]);
      assert.strictEqual(rows[0].order_type, 'takeaway');
      assert.strictEqual(rows[0].token_number, 1);
      assert.strictEqual(rows[0].token_display, 'TK-01');
      assert.strictEqual(rows[0].round_number, 2, 'Table takeaway order must be linked as Round 2 of active dining session');
      assert.strictEqual(rows[0].parent_order_id, dineInOrderId, 'Table takeaway order must link to parent order');
      const parentRows = await query('SELECT session_id FROM orders WHERE id = $1', [dineInOrderId]);
      assert.strictEqual(rows[0].session_id, parentRows[0].session_id, 'Table takeaway order must share same session_id as Dine-in Round 1');
    });

    // --- TEST 3: Counter QR Order ---
    await testAsync('3. Counter QR Order: Automatically generates sequential Token TK-02', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: testSlug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: counterToken,
          presence_token: counterPresenceToken,
          items: [{ dish_id: dishId, quantity: 1 }]
        })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.order_type, 'takeaway');
      assert.strictEqual(data.token_number, 2);
      assert.strictEqual(data.token_display, 'TK-02');
      assert.ok(data.message.includes('TK-02'));
      counterOrderId = data.order_id;
      counterOrderTrackingToken = data.tracking_token;

      // Verify DB row
      const rows = await query('SELECT order_type, token_number, token_display FROM orders WHERE id = $1', [counterOrderId]);
      assert.strictEqual(rows[0].order_type, 'takeaway');
      assert.strictEqual(rows[0].token_number, 2);
      assert.strictEqual(rows[0].token_display, 'TK-02');
    });

    // --- TEST 4: Second Counter QR Order ---
    await testAsync('4. Second Counter QR Order: Generates sequential Token TK-03', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: testSlug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: counterToken,
          presence_token: counterPresenceToken,
          items: [{ dish_id: dishId, quantity: 3 }]
        })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200 but got ${res.status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.order_type, 'takeaway');
      assert.strictEqual(data.token_number, 3);
      assert.strictEqual(data.token_display, 'TK-03');
    });

    // --- TEST 5: Customer Tracking Endpoint Verification ---
    await testAsync('5. GET /api/orders/track/:id: Returns order_type, token_number, and token_display', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${counterOrderId}?slug=${testSlug}`, {
        headers: {
          'X-Order-Tracking-Token': counterOrderTrackingToken
        }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, counterOrderId);
      assert.strictEqual(data.order_type, 'takeaway');
      assert.strictEqual(data.token_number, 2);
      assert.strictEqual(data.token_display, 'TK-02');
    });

    // --- TEST 6: Kitchen KDS Endpoint Verification ---
    await testAsync('6. GET /api/kitchen/orders: Delivers token_display for kitchen terminal screens', async () => {
      // Move counter order to kitchen stage so it appears in KDS queue
      await query("UPDATE orders SET status = 'kitchen', sent_to_kds = 1 WHERE id = $1", [counterOrderId]);

      const kdsToken = jwt.sign(
        {
          role: 'kds_screen',
          restaurant_id: restoId,
          slug: testSlug,
          auth_version: 1,
          permissions: ['kds:read', 'kds:complete']
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/api/kitchen/orders?slug=${testSlug}`, {
        headers: { Authorization: `Bearer ${kdsToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.orders));

      const kdsOrder = data.orders.find(o => o.id === counterOrderId);
      assert.ok(kdsOrder, 'Counter order must be present in KDS active orders');
      assert.strictEqual(kdsOrder.token_display, 'TK-02');
      assert.strictEqual(kdsOrder.order_type, 'takeaway');
    });

    // --- TEST 7: Formatting Helper Verification ---
    await testAsync('7. formatOrderLocation helper formats Dine-in and Takeaway tokens correctly', () => {
      const dineInOrder = { table_number: '1', order_type: 'dine_in' };
      assert.strictEqual(formatOrderLocation(dineInOrder), 'Table 1');

      const takeawayOrder = { table_number: '1', order_type: 'takeaway', token_display: 'TK-01' };
      assert.strictEqual(formatOrderLocation(takeawayOrder), 'Takeaway • Token TK-01');

      const counterOrder = { table_number: 'COUNTER', order_type: 'takeaway', token_display: 'TK-02' };
      assert.strictEqual(formatOrderLocation(counterOrder), 'Takeaway • Token TK-02');
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
