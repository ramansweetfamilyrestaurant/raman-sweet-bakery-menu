/**
 * TOUCHQR — DISH MODIFIERS / ADD-ONS SERVER PRICING TEST SUITE
 *
 * Verifies that:
 * 1. Dish modifiers / add-ons selected by customer are authoritatively priced and verified by backend.
 * 2. Order subtotal, tax breakdown, and total amount accurately reflect the dish base price + modifier price.
 * 3. calculateBillDetails properly aggregates orders with modifiers.
 */

import path from 'path';
import fs from 'fs';
import assert from 'assert';
import bcrypt from 'bcryptjs';

import { calculateBillDetails, safeParseItems, safeParseModifiers } from '../../src/utils/billingHelper.js';

const DISPOSABLE_DB_FILE = 'menu_live_e2e_disposable.db';
const DISPOSABLE_DB_PATH = path.resolve(DISPOSABLE_DB_FILE);

try {
  if (fs.existsSync(DISPOSABLE_DB_PATH)) {
    fs.unlinkSync(DISPOSABLE_DB_PATH);
  }
} catch (_) {}

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = `sqlite:${DISPOSABLE_DB_FILE}`;
process.env.PORT = '5057';
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

// 1. Validate safety guard
const { validateTestDatabaseUrl } = await import('./testDbGuard.js');
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

// 2. Initialize DB & tables
const { initDb, query, withTransaction, getDbType } = await import('../db.js');
await initDb();

// 3. Import security utilities & express app
const { generateHmacQrToken } = await import('../utils/qrSecurity.js');
const { generatePresenceToken, generateQrContextHash } = await import('../utils/presenceVerification.js');
const { default: app } = await import('../index.js');

const BASE_URL = 'http://localhost:5057';

function record(name, success, details = '') {
  if (success) {
    console.log(`  ✅ [PASS] ${name} ${details ? '(' + details + ')' : ''}`);
  } else {
    console.error(`  ❌ [FAIL] ${name}: ${details}`);
    process.exit(1);
  }
}

async function runModifiersPricingTests() {
  console.log('======================================================================');
  console.log('🍕 TOUCHQR DISH MODIFIERS & ADD-ONS PRICING TEST SUITE');
  console.log('======================================================================\n');

  const tenantSecret = 'c0ffee1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const kdsPinHash = await bcrypt.hash('1234', 10);
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 86400 * 1000);
  const graceEnd = new Date(now.getTime() + 37 * 86400 * 1000);

  // Seed restaurant with GST enabled
  const restoRes = await query(`
    INSERT INTO restaurants (
      name, slug, tagline, phone, address, active, plan_tier, plan_price,
      counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
      direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at,
      gst_enabled, gstin_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING id
  `, [
    'Pizza & Burger House', 'pizza-house', 'Cheesy Goodness', '+919876543210',
    '42 Food Street', 1, 'enterprise', 1999,
    1, 10, tenantSecret, kdsPinHash, 1,
    1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString(),
    1, '29ABCDE1234F1Z5'
  ]);
  const restoId = (restoRes.rows || restoRes)[0]?.id || restoRes.lastInsertRowid;

  const catRes = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3) RETURNING id', [restoId, 'Pizzas', 1]);
  const catId = (catRes.rows || catRes)[0]?.id || catRes.lastInsertRowid;

  // Dish with modifiers: Base ₹200, Modifiers: 'Extra Cheese' (+₹50), 'Jalapenos' (+₹30)
  const dishMods = JSON.stringify([
    { name: 'Extra Cheese', price: 50 },
    { name: 'Jalapenos', price: 30 }
  ]);
  const dishRes = await query(`
    INSERT INTO dishes (restaurant_id, category_id, name, price, available, modifiers)
    VALUES ($1, $2, $3, $4, 1, $5)
    RETURNING id
  `, [restoId, catId, 'Margherita Pizza', 200, dishMods]);
  const dishId = (dishRes.rows || dishRes)[0]?.id || dishRes.lastInsertRowid;

  const server = await new Promise((resolve) => {
    const s = app.listen(5057, () => {
      resolve(s);
    });
  });

  try {
    const tableToken = generateHmacQrToken('pizza-house', 'table', '1', tenantSecret);
    const contextHash = generateQrContextHash('pizza-house', 'table', '1', tableToken);
    const presenceToken = generatePresenceToken({
      verificationToken: `vtok_${Date.now()}`,
      restaurantId: restoId,
      slug: 'pizza-house',
      spaceType: 'table',
      spaceNumber: '1',
      verificationMethod: 'GPS',
      qrContextHash: contextHash,
      expiryMinutes: 60
    });

    // Customer orders 1x Margherita Pizza (200) with 'Extra Cheese' (50) and 'Jalapenos' (30) = Unit price 280
    // Total subtotal: 280. GST 5%: 14 (CGST 7, SGST 7). Grand total: 294
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'pizza-house',
        table_number: '1',
        space_type: 'table',
        table_token: tableToken,
        presence_token: presenceToken,
        customer_name: 'Rahul Sharma',
        items: [
          {
            dish_id: dishId,
            quantity: 1,
            modifiers: [
              { name: 'Extra Cheese', price: 50 },
              { name: 'Jalapenos', price: 30 }
            ]
          }
        ]
      })
    });

    const orderData = await orderRes.json();
    assert.strictEqual(orderRes.status, 200, `Order creation should succeed: ${JSON.stringify(orderData)}`);
    const orderId = orderData.order_id;

    // Check DB persistence
    const dbRows = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const savedOrder = dbRows[0];
    assert.strictEqual(Number(savedOrder.subtotal_amount), 280, 'Subtotal amount must include dish base (200) + Extra Cheese (50) + Jalapenos (30) = 280');
    assert.strictEqual(Number(savedOrder.tax_amount), 14, 'Tax amount must be 5% of 280 = 14');
    assert.strictEqual(Number(savedOrder.total_amount), 294, 'Grand total amount must be 280 + 14 = 294');
    record('MODIFIERS_PRICING', true, 'Server-authoritative subtotal and grand total accurately include dish modifiers (Subtotal: 280, Tax: 14, Grand Total: 294)');

    // Verify verifiedItems item.price inside savedOrder.items
    const parsedItems = safeParseItems(savedOrder.items);
    assert.strictEqual(parsedItems.length, 1);
    assert.strictEqual(Number(parsedItems[0].price), 280, 'Item price inside items array must be 280 (base 200 + modifiers 80)');
    record('ITEM_PRICE_INTEGRITY', true, 'Item line price stored in database includes modifier prices');

    // Test calculateBillDetails with this order
    const bill = calculateBillDetails(savedOrder, [savedOrder], { gst_enabled: 1 });
    assert.strictEqual(bill.subtotal, 280);
    assert.strictEqual(bill.cgst, 7);
    assert.strictEqual(bill.sgst, 7);
    assert.strictEqual(bill.grandTotal, 294);
    record('CALCULATE_BILL_DETAILS', true, 'calculateBillDetails matches server stored amounts for order with modifiers');

    // 4. Test unpriced/tampered modifier rejection
    const invalidModRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'pizza-house',
        table_number: '1',
        space_type: 'table',
        table_token: tableToken,
        presence_token: presenceToken,
        customer_name: 'Attacker',
        items: [
          {
            dish_id: dishId,
            quantity: 1,
            modifiers: [
              { name: 'Fake Truffle Oil', price: 5 }
            ]
          }
        ]
      })
    });
    assert.strictEqual(invalidModRes.status, 400, 'Unconfigured/unpriced modifier must be rejected with HTTP 400');
    const invalidModData = await invalidModRes.json();
    assert.strictEqual(invalidModData.error, 'invalid_modifier');
    record('REJECT_UNPRICED_MODIFIERS', true, 'Client cannot inject arbitrary add-ons or fake prices; rejected with HTTP 400 invalid_modifier');

    console.log('\n======================================================================');
    console.log('ALL MODIFIERS PRICING TESTS PASSED (4/4)');
    console.log('======================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runModifiersPricingTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
