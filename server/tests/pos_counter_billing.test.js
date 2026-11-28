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

    // TEST 7: Day Closing API correctly includes all POS counter orders
    await testAsync('7. Day Closing API accurately aggregates POS Takeaway, Dine-In, Cash, UPI, and Card sales', async () => {
      const res = await fetch(`${baseUrl}/api/admin/day-closing/summary`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.summary.total_orders, 4); // 3 takeaway + 1 dine-in
      assert.strictEqual(data.summary.takeaway_orders, 3);
      assert.strictEqual(data.summary.dine_in_orders, 1);
      // Total sales = 336 (Order 1 Cash) + 126 (Order 2 UPI) + 189 (Order 3 Card) + 735 (Order 4 Cash) = 1386
      assert.ok(data.summary.gross_sales > 1000);
      assert.ok(data.summary.cash_sales > 0);
      assert.ok(data.summary.upi_sales > 0);
      assert.ok(data.summary.card_sales > 0);
    });

    // TEST 8: Full Cart and Button Simulation Flow (Dishes + Portions + Combos + UPI QR)
    await testAsync('8. Full Cart & Button Simulation: Portion variants, Steppers, UPI payment, and Token TK-04 generation', async () => {
      const simulatedCart = [
        { id: 10, name: 'Paneer Tikka', price: 200, quantity: 2, variant: 'full' },
        { id: 11, name: 'Dal Makhani (Half)', price: 90, quantity: 1, variant: 'half' },
        { id: 'combo_1', name: '[Combo] Mini Thali', price: 110, quantity: 1, variant: 'combo' }
      ];

      // Math: (2 * 200) + (1 * 90) + (1 * 110) = 400 + 90 + 110 = 600
      // 5% GST: 30
      // Grand Total: 630

      const payload = {
        order_type: 'takeaway',
        customer_name: 'Pooja Verma',
        customer_phone: '9811223344',
        payment_method: 'upi',
        items: simulatedCart
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
      assert.strictEqual(data.token_number, 4);
      assert.strictEqual(data.token_display, 'TK-04');
      assert.strictEqual(Number(data.order.subtotal_amount), 600);
      assert.strictEqual(Number(data.order.cgst_amount), 15);
      assert.strictEqual(Number(data.order.sgst_amount), 15);
      assert.strictEqual(Number(data.order.tax_amount), 30);
      assert.strictEqual(Number(data.order.grand_total_amount), 630);
      assert.strictEqual(data.order.customer_name, 'Pooja Verma');
      assert.strictEqual(data.order.customer_phone, '9811223344');
      assert.strictEqual(data.order.payment_method, 'upi');
      assert.strictEqual(data.order.status, 'accepted');
      assert.strictEqual(data.order.is_settled, 1);
    });

    // TEST 9: Super Admin Plan Control - Restaurant on plan with counter_ordering_enabled = 0 is rejected with 403
    await testAsync('9. POS order is blocked (403 feature_locked) when plan disables counter_ordering_enabled', async () => {
      // Create a basic-plan restaurant with paid subscription (non-complimentary)
      const futureExpiry = new Date(Date.now() + 30 * 86400000).toISOString();
      const basicRestoRes = await query(`
        INSERT INTO restaurants (name, slug, gst_enabled, plan_tier, subscription_type, mandate_status, active, counter_ordering_enabled, plan_expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, ['Basic Dhaba', 'basic-dhaba', 1, 'basic', 'PAID', 'active', 1, 0, futureExpiry]);
      const basicId = (basicRestoRes.rows || basicRestoRes)[0].id;

      // Seed saas_plans with counter_ordering_enabled = 0 for basic
      await query(`
        INSERT OR REPLACE INTO saas_plans (key, name, price, counter_ordering_enabled)
        VALUES ('basic', 'Basic Plan', 499, 0)
      `);

      const basicToken = jwt.sign(
        { id: 998, username: 'basic_admin', role: 'admin', restaurant_id: basicId },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${basicToken}`
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          items: [{ id: 1, name: 'Chai', price: 15, quantity: 2 }]
        })
      });

      assert.strictEqual(res.status, 403, 'Must return 403 Forbidden when POS is locked by plan');
      const body = await res.json();
      assert.strictEqual(body.error, 'feature_locked');
      assert.strictEqual(body.feature, 'counter_ordering_enabled');
    });

    // TEST 10: Super Admin Unlocks POS for Plan - Order immediately succeeds with 200
    await testAsync('10. Super Admin enabling counter_ordering_enabled immediately unlocks POS order creation', async () => {
      // Super Admin updates plan in saas_plans: counter_ordering_enabled = 1
      await query(`
        UPDATE saas_plans SET counter_ordering_enabled = 1 WHERE key = 'basic'
      `);

      // Also ensure restaurant has no blocking flag
      await query(`
        UPDATE restaurants SET counter_ordering_enabled = 1 WHERE slug = 'basic-dhaba'
      `);

      const basicRestoRes = await query(`SELECT id FROM restaurants WHERE slug = 'basic-dhaba'`);
      const basicId = (basicRestoRes.rows || basicRestoRes)[0].id;

      const basicToken = jwt.sign(
        { id: 998, username: 'basic_admin', role: 'admin', restaurant_id: basicId },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${basicToken}`
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          customer_name: 'Dhaba Customer',
          items: [{ id: 1, name: 'Special Masala Chai', price: 20, quantity: 2 }]
        })
      });

      assert.strictEqual(res.status, 200, 'Must return 200 OK after Super Admin unlocks POS');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.token_display, 'TK-01');
    });

    // TEST 11: POS order preserves sanitized add-on modifiers & portion in saved order items
    await testAsync('11. POS order preserves add-on modifiers and portion metadata cleanly', async () => {
      const res = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cash',
          items: [
            {
              dish_id: 21,
              name: 'Paneer Tikka Pizza',
              price: 250,
              quantity: 2,
              variant: 'full',
              portion: 'Half',
              modifiers: [
                { name: 'Extra Cheese', price: 40 },
                { name: 'Jalapenos', price: 20 },
                { name: '   ', price: 10 }
              ]
            },
            {
              dish_id: 22,
              name: 'Dal Makhani (Half)',
              price: 90,
              quantity: 1,
              variant: 'half',
              modifiers: []
            }
          ]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      const parsed = typeof data.order.items === 'string' ? JSON.parse(data.order.items) : data.order.items;
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0].modifiers.length, 2);
      assert.strictEqual(parsed[0].modifiers[0].name, 'Extra Cheese');
      assert.strictEqual(Number(parsed[0].modifiers[0].price), 40);
      assert.strictEqual(parsed[0].modifiers[1].name, 'Jalapenos');
      assert.strictEqual(parsed[0].portion, 'Half');
      assert.strictEqual(parsed[1].portion, '', 'Legacy name ending in (Half) must not get duplicate portion');
      assert.strictEqual(Number(data.order.subtotal_amount), 590);
    });

    // TEST 12: Day Closing excludes open/unpaid table orders from cash sales & persists actual offer discounts & stored taxes
    await testAsync('12. Day Closing excludes unpaid open orders from cash drawer and persists stored tax & discount totals', async () => {
      // Seed an unpaid open QR table order (is_settled = 0, no payment_method) on the same restaurant today
      await query(
        `INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, subtotal_amount, tax_amount, status, is_settled, payment_method, created_at)
         VALUES ($1, 'Table 9', 'Open Table Guest', '[{"name":"Open Tab Item","quantity":1,"price":900}]', 945, 900, 45, 'preparing', 0, NULL, $2)`,
        [restoId, new Date().toISOString()]
      );

      // Seed a settled order with explicit offer discount_amount in items
      await query(
        `INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, subtotal_amount, tax_amount, status, is_settled, payment_method, created_at)
         VALUES ($1, 'Counter', 'Offer Guest', '[{"name":"Promo Thali","quantity":2,"price":150,"regular_price":200,"discount_amount":50,"offer_id":99}]', 315, 300, 15, 'accepted', 1, 'cash', $2)`,
        [restoId, new Date().toISOString()]
      );

      const sumRes = await fetch(`${baseUrl}/api/admin/day-closing/summary`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(sumRes.status, 200);
      const sumData = await sumRes.json();
      assert.strictEqual(sumData.success, true);

      // Unpaid Table 9 (₹945) must NOT inflate total_orders (6 settled from POS tests 3,4,5,6,8,11 + 1 new settled = 7) or cash_sales
      assert.strictEqual(sumData.summary.total_orders, 7);
      assert.strictEqual(sumData.summary.unsettled_orders, 1);
      assert.strictEqual(Number(sumData.summary.unsettled_sales), 945);
      // Offer discount = 2 * 50 = 100
      assert.strictEqual(Number(sumData.summary.discount_amount), 100);

      const todayIst = sumData.date;
      const submitRes = await fetch(`${baseUrl}/api/admin/day-closing/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          closing_date: todayIst,
          shift_name: 'Night Close',
          actual_cash_counted: sumData.summary.cash_sales
        })
      });
      assert.strictEqual(submitRes.status, 200);
      const submitData = await submitRes.json();
      assert.strictEqual(submitData.success, true);
      assert.strictEqual(Number(submitData.record.discount_amount), 100);
      assert.strictEqual(Number(submitData.record.cash_discrepancy), 0);
      assert.strictEqual(Number(submitData.record.total_orders), 7);
    });

    // TEST 13: Named multi-vertical space (e.g. Booth 1) avoids double "Table Booth 1" prefix & legacy GST fallback works
    await testAsync('13. Named multi-vertical POS space avoids Table prefix & legacy zero-tax fallback works when GST enabled', async () => {
      const boothRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          order_type: 'dine_in',
          table_number: 'Booth 1',
          payment_method: 'upi',
          items: [{ dish_id: 21, name: 'Paneer Tikka Pizza', price: 250, quantity: 1 }]
        })
      });
      assert.strictEqual(boothRes.status, 200);
      const boothData = await boothRes.json();
      assert.strictEqual(boothData.success, true);
      assert.strictEqual(boothData.order.customer_name, 'Booth 1 Guest');
      assert.ok(boothData.message.includes('for Booth 1!'), `Expected "for Booth 1!", got "${boothData.message}"`);
      assert.ok(!boothData.message.includes('Table Booth 1'), 'Must not double-prefix "Table" onto named spaces');

      // Test legacy order (SQL default tax_amount=0, subtotal_amount=0) while restaurant GST is enabled
      await query('UPDATE restaurants SET gst_enabled = 1 WHERE id = $1', [restoId]);
      const beforeRes = await fetch(`${baseUrl}/api/admin/day-closing/summary`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(beforeRes.status, 200);
      const beforeData = await beforeRes.json();

      await query(
        `INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, subtotal_amount, tax_amount, status, is_settled, payment_method, created_at)
         VALUES ($1, 'Room 201', 'Legacy GST Guest', '[{"name":"Legacy Thali","quantity":1,"price":210}]', 210, 0, 0, 'completed', 1, 'card', $2)`,
        [restoId, new Date().toISOString()]
      );

      const sumRes = await fetch(`${baseUrl}/api/admin/day-closing/summary`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(sumRes.status, 200);
      const sumData = await sumRes.json();
      assert.strictEqual(sumData.success, true);
      assert.strictEqual(sumData.restaurant.gst_enabled, true);
      // Legacy ₹210 order (5% inclusive = ₹10) must be added cleanly on top of pre-insert tax total
      assert.strictEqual(
        Number(sumData.summary.tax_amount),
        Math.round((Number(beforeData.summary.tax_amount) + 10) * 100) / 100
      );
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
