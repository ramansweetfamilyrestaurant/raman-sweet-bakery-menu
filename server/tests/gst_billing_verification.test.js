/**
 * TouchQR — GST Billing & Tax Invariant Verification Suite
 *
 * Rigorously verifies:
 * 1. calculateOrderTax calculates exactly 2.5% CGST + 2.5% SGST = 5.0% GST when enabled.
 * 2. calculateOrderTax returns 0 tax when GST is disabled.
 * 3. calculateBillDetails aggregates session orders with exact GST computation.
 * 4. PUT /api/admin/settings persists gst_enabled and gstin_number with alias support.
 * 5. POS order creation (/api/admin/pos-order) correctly records subtotal, cgst, sgst, and tax_amount.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import { JWT_SECRET } from '../config/jwt.js';
import { query, initDb } from '../db.js';
import apiRouter, { calculateOrderTax } from '../routes/api.js';
import { calculateBillDetails } from '../../src/utils/billingHelper.js';
import adminRouter from '../routes/admin.js';

test('🛡️ TouchQR GST Billing & Invoicing Verification Suite', async (t) => {
  await t.test('1. calculateOrderTax returns exact 5% GST (2.5% CGST + 2.5% SGST) when enabled', () => {
    const tax = calculateOrderTax(100, true);
    assert.strictEqual(tax.subtotal, 100);
    assert.strictEqual(tax.cgst, 2.5);
    assert.strictEqual(tax.sgst, 2.5);
    assert.strictEqual(tax.tax_total, 5.0);
    assert.strictEqual(tax.grand_total, 105);
    assert.strictEqual(tax.gst_rate, 5.0);
  });

  await t.test('2. calculateOrderTax returns 0 tax and uninflated total when GST is disabled', () => {
    const tax = calculateOrderTax(100, false);
    assert.strictEqual(tax.subtotal, 100);
    assert.strictEqual(tax.cgst, 0);
    assert.strictEqual(tax.sgst, 0);
    assert.strictEqual(tax.tax_total, 0);
    assert.strictEqual(tax.grand_total, 100);
    assert.strictEqual(tax.gst_rate, 0);
  });

  await t.test('3. calculateBillDetails correctly computes tax and grandTotal for single & multi-item orders', () => {
    const orderWithGst = {
      id: 101,
      items: [
        { name: 'Paneer Butter Masala', price: 200, quantity: 2 },
        { name: 'Butter Naan', price: 40, quantity: 4 }
      ]
    };
    const restoGst = { gst_enabled: 1, gstin_number: '10AAAAA0000A1Z5', currency_symbol: '₹' };
    const bill = calculateBillDetails(orderWithGst, [orderWithGst], restoGst);

    // Subtotal = 200*2 + 40*4 = 400 + 160 = 560
    assert.strictEqual(bill.subtotal, 560, 'Subtotal must be 560');
    assert.strictEqual(bill.cgst, 14, 'CGST 2.5% of 560 is 14.00');
    assert.strictEqual(bill.sgst, 14, 'SGST 2.5% of 560 is 14.00');
    assert.strictEqual(bill.grandTotal, 588, 'Grand total must be 560 + 14 + 14 = 588');

    // Without GST
    const restoNoGst = { gst_enabled: 0, currency_symbol: '₹' };
    const billNoGst = calculateBillDetails(orderWithGst, [orderWithGst], restoNoGst);
    assert.strictEqual(billNoGst.subtotal, 560);
    assert.strictEqual(billNoGst.cgst, 0);
    assert.strictEqual(billNoGst.sgst, 0);
    assert.strictEqual(billNoGst.grandTotal, 560);
  });

  await t.test('4. End-to-end API test: Settings persist GST and POS creates GST-compliant order', async () => {
    await initDb({ isTest: true, skipSeed: true });

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use('/api', apiRouter);

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Create test restaurant
      const restoRes = await query(`
        INSERT INTO restaurants (name, slug, gst_enabled, gstin_number, plan_tier, subscription_type, mandate_status, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, slug
      `, ['GST Test Restaurant', 'gst-test-resto', 0, null, 'pro', 'ADMIN_GRANTED', 'admin_granted', 1]);
      const rRows = restoRes.rows || restoRes;
      const testResto = rRows[0];
      const restoId = testResto.id;

      const adminToken = jwt.sign(
        { id: 888, username: 'gst_admin', role: 'admin', restaurant_id: restoId },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Step A: Update settings using Business Profile aliases (is_gst_registered: true, gst_number: '10ABCDE1234F1Z5')
      const updateRes = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          is_gst_registered: true,
          gst_number: '10ABCDE1234F1Z5'
        })
      });
      assert.strictEqual(updateRes.status, 200, 'Settings update must succeed with 200');

      // Verify in DB that gst_enabled is 1 and gstin_number is persisted
      const checkResto = await query('SELECT gst_enabled, gstin_number FROM restaurants WHERE id = $1', [restoId]);
      const cr = checkResto.rows || checkResto;
      assert.strictEqual(Number(cr[0].gst_enabled), 1, 'gst_enabled must be persisted as 1');
      assert.strictEqual(cr[0].gstin_number, '10ABCDE1234F1Z5', 'gstin_number must match upper-case GSTIN');

      // Step B: Create a POS order now that GST is enabled
      const posRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          items: [{ name: 'Special Thali', price: 100, quantity: 1 }],
          order_type: 'takeaway',
          payment_method: 'cash'
        })
      });
      assert.strictEqual(posRes.status, 200, 'POS order must return 200 OK');
      const posBody = await posRes.json();
      assert.strictEqual(posBody.success, true);
      assert.strictEqual(Number(posBody.order.subtotal_amount), 100);
      assert.strictEqual(Number(posBody.order.cgst_amount), 2.5);
      assert.strictEqual(Number(posBody.order.sgst_amount), 2.5);
      assert.strictEqual(Number(posBody.order.tax_amount), 5.0);
      assert.strictEqual(Number(posBody.order.total_amount), 105);

      // Step C: Verify /api/orders/track/:id returns consolidated multi-round bill_summary when settled
      const rawTrackingToken = 'track-secret-post-bill-test';
      const trackingHash = crypto.createHash('sha256').update(rawTrackingToken).digest('hex');
      const sessId = `sess_${restoId}_T4_test`;
      const nowIso = new Date().toISOString();

      const r1Insert = await query(`
        INSERT INTO orders (
          restaurant_id, table_number, customer_name, items, total_amount, subtotal_amount,
          cgst_amount, sgst_amount, tax_amount, grand_total_amount, gst_rate, status,
          session_id, round_number, is_settled, payment_method, tracking_token_hash, created_at, terminal_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id
      `, [
        restoId, '4', 'Rahul',
        JSON.stringify([{ name: 'Paneer Tikka', price: 200, quantity: 1 }]),
        210, 200, 5, 5, 10, 210, 5, 'served',
        sessId, 1, 1, 'upi', trackingHash, nowIso, nowIso
      ]);
      const r1Id = (r1Insert.rows || r1Insert)[0].id;

      await query(`
        INSERT INTO orders (
          restaurant_id, table_number, customer_name, items, total_amount, subtotal_amount,
          cgst_amount, sgst_amount, tax_amount, grand_total_amount, gst_rate, status,
          session_id, round_number, parent_order_id, is_settled, payment_method, created_at, terminal_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        restoId, '4', 'Rahul',
        JSON.stringify([{ name: 'Butter Naan', price: 100, quantity: 2 }]),
        210, 200, 5, 5, 10, 210, 5, 'completed',
        sessId, 2, r1Id, 1, 'upi', nowIso, nowIso
      ]);

      const trackRes = await fetch(`${baseUrl}/api/orders/track/${r1Id}?slug=gst-test-resto`, {
        headers: { 'X-Order-Tracking-Token': rawTrackingToken }
      });
      assert.strictEqual(trackRes.status, 200, 'Customer tracking endpoint must return 200 for settled bill');
      const trackBody = await trackRes.json();
      assert.strictEqual(trackBody.tracking_token_hash, undefined, 'tracking_token_hash must be scrubbed');
      assert.strictEqual(trackBody.is_settled, 1, 'is_settled must be returned as 1');
      assert.strictEqual(trackBody.payment_method, 'upi', 'payment_method must be returned');
      assert.ok(trackBody.bill_summary, 'bill_summary must be included for settled bill');
      assert.strictEqual(trackBody.bill_summary.round_count, 2, 'bill_summary must merge both rounds');
      assert.strictEqual(trackBody.bill_summary.subtotal_amount, 400, 'consolidated subtotal must be 400');
      assert.strictEqual(trackBody.bill_summary.cgst_amount, 10, 'consolidated cgst must be 10');
      assert.strictEqual(trackBody.bill_summary.sgst_amount, 10, 'consolidated sgst must be 10');
      assert.strictEqual(trackBody.bill_summary.grand_total_amount, 420, 'consolidated grand total must be 420');
      assert.strictEqual(trackBody.bill_summary.gstin_number, '10ABCDE1234F1Z5', 'gstin_number must propagate');

    } finally {
      server.close();
    }
  });
});
