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
import express from 'express';
import { JWT_SECRET } from '../config/jwt.js';
import { query, initDb } from '../db.js';
import { calculateOrderTax } from '../routes/api.js';
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

    } finally {
      server.close();
    }
  });
});
