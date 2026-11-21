/**
 * TouchQR — Dedicated Counter POS & Quick-Billing Test Suite
 *
 * Rigorously verifies:
 * 1. POST /api/admin/pos-order rejects unauthenticated requests.
 * 2. POST /api/admin/pos-order rejects empty item payloads.
 * 3. POST /api/admin/pos-order creates accepted & settled Takeaway counter orders.
 * 4. Daily sequential tokens increment properly (TK-01, TK-02...).
 * 5. GST and totals are calculated authoritatively on the server.
 * 6. Dine-in counter orders preserve specific table numbers.
 * 7. Upfront payment methods (cash, upi, card) are persisted accurately.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import assert from 'assert';
import jwt from 'jsonwebtoken';
import http from 'http';
import express from 'express';
import { JWT_SECRET } from '../config/jwt.js';
import { query, initDb } from '../db.js';
import adminRouter from '../routes/admin.js';

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
  console.log('⚡ TOUCHQR COUNTER POS & QUICK-BILLING VERIFICATION SUITE');
  console.log('======================================================================\n');

  await initDb({ isTest: true, skipSeed: true });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Seed a test restaurant with active admin-granted subscription
    const restoRes = await query(`
      INSERT INTO restaurants (name, slug, gst_enabled, plan_tier, subscription_type, mandate_status, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, slug
    `, ['Shree Sweets & Cafe', 'shree-sweets', 1, 'pro', 'ADMIN_GRANTED', 'admin_granted', 1]);
    const rRows = restoRes.rows || restoRes;
    const testResto = rRows[0];
    const restoId = testResto.id;

    // Generate valid admin token
    const adminToken = jwt.sign(
      { id: 999, username: 'counter_cashier', role: 'admin', restaurant_id: restoId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TEST 1: Reject unauthenticated request
    await testAsync('1. Unauthenticated POS order request is rejected (401)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ name: 'Samosa', price: 20, quantity: 2 }] })
      });
      assert.strictEqual(res.status, 401, 'Must return 401 Unauthorized without token');
    });

    // TEST 2: Reject empty items array
    await testAsync('2. POS order with empty items array is rejected (400)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ items: [] })
      });
      assert.strictEqual(res.status, 400, 'Must return 400 Bad Request');
      const body = await res.json();
      assert.strictEqual(body.error, 'invalid_items');
    });

    // TEST 3: Create initial Takeaway counter order with Cash
    let firstTokenDisplay = null;
    await testAsync('3. Creates accepted & settled Takeaway counter order with TK-01 token and 5% GST', async () => {
      const payload = {
        order_type: 'takeaway',
        customer_name: 'Rahul Sharma',
        customer_phone: '9876543210',
        payment_method: 'cash',
        notes: 'Pack separately in foil',
        items: [
          { id: 1, name: 'Paneer Butter Masala', price: 240, quantity: 1, variant: 'full' },
          { id: 2, name: 'Butter Naan', price: 40, quantity: 2, variant: null }
        ]
      };

      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.order, 'Order object must be returned');

      const o = data.order;
      assert.strictEqual(o.restaurant_id, restoId);
      assert.strictEqual(o.table_number, 'Counter');
      assert.strictEqual(o.status, 'accepted');
      assert.strictEqual(o.is_settled, 1);
      assert.strictEqual(o.sent_to_kds, 1);
      assert.strictEqual(o.payment_method, 'cash');
      assert.strictEqual(o.order_type, 'takeaway');

      // Subtotal: 240 + 80 = 320. CGST 2.5% = 8, SGST 2.5% = 8, Total = 336
      assert.strictEqual(Number(o.subtotal_amount), 320);
      assert.strictEqual(Number(o.cgst_amount), 8);
      assert.strictEqual(Number(o.sgst_amount), 8);
      assert.strictEqual(Number(o.tax_amount), 16);
      assert.strictEqual(Number(o.grand_total_amount), 336);

      // Token check
      assert.strictEqual(data.token_number, 1);
      assert.strictEqual(data.token_display, 'TK-01');
      firstTokenDisplay = data.token_display;
    });

    // TEST 4: Next Takeaway order gets TK-02
    await testAsync('4. Subsequent Takeaway order receives sequential token TK-02', async () => {
      const payload = {
        order_type: 'takeaway',
        payment_method: 'upi',
        items: [{ id: 3, name: 'Gulab Jamun (2 pcs)', price: 60, quantity: 2 }]
      };

      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.token_number, 2);
      assert.strictEqual(data.token_display, 'TK-02');
      assert.strictEqual(data.order.payment_method, 'upi');
      assert.strictEqual(data.order.table_number, 'Counter');
    });

    // TEST 5: Dine-In order via counter POS preserves table number
    await testAsync('5. Dine-In order punched at POS preserves specific table number without generating token', async () => {
      const payload = {
        order_type: 'dine_in',
        table_number: 'Table 7',
        customer_name: 'Amit Patel',
        payment_method: 'card',
        items: [{ id: 4, name: 'Veg Biryani', price: 180, quantity: 1 }]
      };

      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.order.table_number, 'Table 7');
      assert.strictEqual(data.order.order_type, 'dine_in');
      assert.strictEqual(data.order.payment_method, 'card');
      assert.strictEqual(data.order.status, 'accepted');
      assert.strictEqual(data.order.is_settled, 1);
      assert.strictEqual(data.token_number, null);
    });

    // TEST 6: POS order with combo item
    await testAsync('6. POS order supports combos and correctly aggregates into settled order with TK-03', async () => {
      const payload = {
        order_type: 'takeaway',
        payment_method: 'cash',
        items: [
          { id: 'combo_1', name: '[Combo] Deluxe Thali Feast', price: 350, quantity: 2, variant: 'combo' }
        ]
      };

      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.token_number, 3);
      assert.strictEqual(data.token_display, 'TK-03');
      // Subtotal 700 + 5% GST (35) = 735
      assert.strictEqual(Number(data.order.subtotal_amount), 700);
      assert.strictEqual(Number(data.order.tax_amount), 35);
      assert.strictEqual(Number(data.order.grand_total_amount), 735);
      assert.strictEqual(data.order.is_settled, 1);
    });

  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
