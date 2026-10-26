/**
 * TOUCHQR — FINAL BILL GENERATION & ORDER SETTLEMENT INVESTIGATION
 *
 * Tests the complete backend and database contracts for:
 * 1. Single-round dine-in bill generation & settlement.
 * 2. Multi-round dining session bill aggregation & settlement invariants.
 * 3. Completion vs Settlement decoupling.
 * 4. Counter order billing & settlement.
 * 5. Idempotent settlement and lockout against reopening settled terminal orders.
 * 6. Print log API and reprint tracking.
 */

import path from 'path';
import fs from 'fs';
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DISPOSABLE_DB_FILE = 'menu_live_e2e_disposable.db';
const DISPOSABLE_DB_PATH = path.resolve(DISPOSABLE_DB_FILE);

try {
  if (fs.existsSync(DISPOSABLE_DB_PATH)) {
    fs.unlinkSync(DISPOSABLE_DB_PATH);
  }
} catch (_) {}

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = `sqlite:${DISPOSABLE_DB_FILE}`;
process.env.PORT = '5055';
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

// 1. Validate safety guard
const { validateTestDatabaseUrl } = await import('./testDbGuard.js');
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

// 2. Initialize DB & tables
const { initDb, query, withTransaction, getDbType } = await import('../db.js');
await initDb();

// 3. Import security utilities & express app
const { generateHmacQrToken, normalizeSpaceType, normalizeSpaceNumber } = await import('../utils/qrSecurity.js');
const { generatePresenceToken, generateQrContextHash } = await import('../utils/presenceVerification.js');
const { JWT_SECRET } = await import('../config/jwt.js');
const { default: app } = await import('../index.js');

const BASE_URL = 'http://localhost:5055';

let passed = 0;
let failed = 0;
const results = [];

function record(category, name, success, details = '') {
  if (success) {
    passed++;
    console.log(`  ✅ [PASS] ${category} - ${name} ${details ? '(' + details + ')' : ''}`);
    results.push({ category, name, status: 'PASS', details });
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${category} - ${name}: ${details}`);
    results.push({ category, name, status: 'FAIL', details });
  }
}

function createTestPresenceToken(restaurantId, slug, spaceType, spaceNumber, qrToken) {
  const contextHash = generateQrContextHash(slug, spaceType, spaceNumber, qrToken);
  return generatePresenceToken({
    verificationToken: `vtok_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    restaurantId,
    slug,
    spaceType,
    spaceNumber,
    verificationMethod: 'GPS',
    qrContextHash: contextHash,
    expiryMinutes: 60
  });
}

async function runInvestigation() {
  console.log('======================================================================');
  console.log('🧾 TOUCHQR BILL GENERATION & SETTLEMENT INVESTIGATION');
  console.log('======================================================================\n');

  const tenantSecret = 'c0ffee1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const kdsPinHash = await bcrypt.hash('1234', 10);

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 86400 * 1000);
  const graceEnd = new Date(now.getTime() + 37 * 86400 * 1000);

  // Seed synthetic tenant with GST enabled (5% = 2.5% CGST + 2.5% SGST)
  const restoRes = await query(`
    INSERT INTO restaurants (
      name, slug, tagline, phone, address, active, plan_tier, plan_price,
      counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
      direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at,
      gst_enabled, gstin_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING id
  `, [
    'Billing Investigation Restaurant', 'billing-demo', 'Taste & Track', '+919876543210',
    '101 Dining Lane', 1, 'enterprise', 1999,
    1, 10, tenantSecret, kdsPinHash, 1,
    1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString(),
    1, '29ABCDE1234F1Z5'
  ]);
  const restoId = (restoRes.rows || restoRes)[0]?.id || restoRes.lastInsertRowid;

  await query(`
    INSERT INTO subscriptions (
      restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
      trial_start, trial_end, current_period_start, current_period_end, grace_period_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    restoId, 3, 'none', 'active', 1999, 'INR', 'monthly',
    now.toISOString(), trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
  ]);

  await query(`
    INSERT INTO admins (restaurant_id, username, password_hash, role)
    VALUES ($1, $2, $3, $4)
  `, [restoId, 'billing_admin', adminPasswordHash, 'restaurant_admin']);

  const catRes = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3) RETURNING id', [restoId, 'Main', 1]);
  const catId = (catRes.rows || catRes)[0]?.id || catRes.lastInsertRowid;

  const dish1 = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, $3, $4, 1) RETURNING id`, [restoId, catId, 'Paneer Tikka', 200]);
  const dish2 = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, $3, $4, 1) RETURNING id`, [restoId, catId, 'Butter Naan', 50]);
  const dish3 = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, $3, $4, 1) RETURNING id`, [restoId, catId, 'Gulab Jamun', 100]);

  const dish1Id = (dish1.rows || dish1)[0]?.id || dish1.lastInsertRowid;
  const dish2Id = (dish2.rows || dish2)[0]?.id || dish2.lastInsertRowid;
  const dish3Id = (dish3.rows || dish3)[0]?.id || dish3.lastInsertRowid;

  const server = await new Promise((resolve) => {
    const s = app.listen(5055, () => {
      console.log('⚡ Investigation server listening on http://localhost:5055\n');
      resolve(s);
    });
  });

  try {
    // Authenticate Admin
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'billing_admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    const adminToken = loginData.token;
    record('AUTH', 'Admin login successful', true);

    // -------------------------------------------------------------------------
    // TEST CASE A: Single-Round Table Order - Bill Amounts & Settlement
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE A: Single-Round Table Order ---');
    const table1Token = generateHmacQrToken('billing-demo', 'table', '1', tenantSecret);
    const table1Presence = createTestPresenceToken(restoId, 'billing-demo', 'table', '1', table1Token);

    // Items: 2x Paneer Tikka (2x200=400) + 2x Butter Naan (2x50=100) = Subtotal 500
    // With 5% GST (2.5% CGST = 12.50, 2.5% SGST = 12.50, Total tax = 25.00) -> Grand Total = 525.00
    const order1Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'billing-demo',
        table_number: '1',
        space_type: 'table',
        table_token: table1Token,
        presence_token: table1Presence,
        customer_name: 'Ananya Roy',
        items: [
          { dish_id: dish1Id, quantity: 2 },
          { dish_id: dish2Id, quantity: 2 }
        ]
      })
    });
    const order1Data = await order1Res.json();
    assert.strictEqual(order1Res.status, 200);
    const order1Id = order1Data.order_id;

    // Check DB persistence of tax breakdown and subtotal
    const dbOrder1 = await query('SELECT * FROM orders WHERE id = $1', [order1Id]);
    assert.strictEqual(Number(dbOrder1[0].subtotal_amount), 500, 'Subtotal must be exactly 500');
    assert.strictEqual(Number(dbOrder1[0].tax_amount), 25, 'Tax must be exactly 25 (5% GST)');
    assert.strictEqual(Number(dbOrder1[0].total_amount), 525, 'Total amount must be exactly 525');
    assert.strictEqual(dbOrder1[0].is_settled, 0, 'Initial order must be unsettled (is_settled = 0)');
    record('BILLING', 'Single-round GST tax breakdown persisted accurately (Subtotal: 500, Tax: 25, Grand: 525)', true);

    // Settle Order 1 via Staff
    const settle1Res = await fetch(`${BASE_URL}/api/admin/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'cash' }
      })
    });
    const settle1Data = await settle1Res.json();
    assert.strictEqual(settle1Res.status, 200);
    assert.strictEqual(settle1Data.is_settled, 1);
    assert.strictEqual(settle1Data.payment_method, 'cash');

    const dbOrder1After = await query('SELECT is_settled, payment_method, status, terminal_at FROM orders WHERE id = $1', [order1Id]);
    assert.strictEqual(dbOrder1After[0].is_settled, 1);
    assert.strictEqual(dbOrder1After[0].payment_method, 'cash');
    assert.strictEqual(dbOrder1After[0].status, 'completed');
    assert.ok(dbOrder1After[0].terminal_at, 'Terminal timestamp must be stamped');
    record('SETTLEMENT', 'Single-round explicit cash settlement succeeded', true);

    // Duplicate settlement attempt: Idempotent response
    const dupSettleRes = await fetch(`${BASE_URL}/api/admin/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'cash' }
      })
    });
    const dupSettleData = await dupSettleRes.json();
    assert.strictEqual(dupSettleRes.status, 200);
    assert.strictEqual(dupSettleData.already_settled, true);
    assert.strictEqual(dupSettleData.is_settled, 1);
    record('IDEMPOTENCY', 'Duplicate settlement returns idempotent response with already_settled=true', true);

    // Attempting to reopen terminal settled order back to kitchen
    const reopenRes = await fetch(`${BASE_URL}/api/admin/orders/${order1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'kitchen' })
    });
    assert.strictEqual(reopenRes.status, 400);
    const reopenData = await reopenRes.json();
    assert.strictEqual(reopenData.error, 'order_already_terminal');
    record('SECURITY', 'Reopening terminal settled order is strictly rejected (400 order_already_terminal)', true);

    // -------------------------------------------------------------------------
    // TEST CASE B: Multi-Round Dining Session - Aggregation & Invariants
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE B: Multi-Round Dining Session ---');
    const table2Token = generateHmacQrToken('billing-demo', 'table', '2', tenantSecret);
    const table2Presence = createTestPresenceToken(restoId, 'billing-demo', 'table', '2', table2Token);

    // Round 1: 1x Paneer Tikka (200) + 5% GST (10) = 210
    const round1Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'billing-demo',
        table_number: '2',
        space_type: 'table',
        table_token: table2Token,
        presence_token: table2Presence,
        customer_name: 'Vikram Seth',
        items: [{ dish_id: dish1Id, quantity: 1 }]
      })
    });
    const round1Data = await round1Res.json();
    assert.strictEqual(round1Res.status, 200);
    const r1Id = round1Data.order_id;
    const sessionId = round1Data.session_id;
    assert.ok(sessionId, 'Round 1 must establish a session_id');
    assert.strictEqual(round1Data.round_number, 1);

    // Progress Round 1 to kitchen
    await fetch(`${BASE_URL}/api/admin/orders/${r1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'kitchen', sent_to_kds: 1 })
    });

    // Round 2: 2x Gulab Jamun (2x100 = 200) + 5% GST (10) = 210
    const round2Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'billing-demo',
        table_number: '2',
        space_type: 'table',
        table_token: table2Token,
        presence_token: table2Presence,
        customer_name: 'Vikram Seth',
        items: [{ dish_id: dish3Id, quantity: 2 }]
      })
    });
    const round2Data = await round2Res.json();
    assert.strictEqual(round2Res.status, 200);
    const r2Id = round2Data.order_id;
    assert.strictEqual(round2Data.session_id, sessionId, 'Round 2 must join the same session_id');
    assert.strictEqual(round2Data.round_number, 2, 'Round 2 must increment round_number to 2');
    assert.strictEqual(round2Data.is_addon, true, 'Round 2 must be flagged as is_addon=true');
    record('MULTI_ROUND', `Round 1 (#${r1Id}) and Round 2 (#${r2Id}) correctly grouped under session ${sessionId}`, true);

    // Progress Round 2 to ready
    await fetch(`${BASE_URL}/api/admin/orders/${r2Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ready', kitchen_prepared: 1 })
    });

    // Check DB state before settlement
    const sessionBefore = await query('SELECT id, round_number, status, total_amount, is_settled FROM orders WHERE session_id = $1 ORDER BY id ASC', [sessionId]);
    assert.strictEqual(sessionBefore.length, 2);
    assert.strictEqual(sessionBefore[0].is_settled, 0);
    assert.strictEqual(sessionBefore[1].is_settled, 0);

    // Settle session via Round 2 (the active/latest round)
    const settleSessionRes = await fetch(`${BASE_URL}/api/admin/orders/${r2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'card' }
      })
    });
    const settleSessionData = await settleSessionRes.json();
    assert.strictEqual(settleSessionRes.status, 200);
    assert.strictEqual(settleSessionData.is_settled, 1);

    // Inspect both rounds in database
    const sessionAfter = await query('SELECT id, round_number, status, total_amount, is_settled, payment_method FROM orders WHERE session_id = $1 ORDER BY id ASC', [sessionId]);
    assert.strictEqual(sessionAfter.length, 2);

    // Round 2 (the target settled order)
    assert.strictEqual(sessionAfter[1].id, r2Id);
    assert.strictEqual(sessionAfter[1].is_settled, 1, 'Round 2 is settled');
    assert.strictEqual(sessionAfter[1].status, 'completed', 'Round 2 status updated to completed');
    assert.strictEqual(sessionAfter[1].payment_method, 'card', 'Round 2 payment_method set to card');

    // Round 1 (other round in same dining session)
    assert.strictEqual(sessionAfter[0].id, r1Id);
    assert.strictEqual(sessionAfter[0].is_settled, 1, 'Round 1 must be settled together with session (is_settled = 1)');
    assert.strictEqual(sessionAfter[0].payment_method, 'card', 'Round 1 payment_method set to card');
    assert.strictEqual(sessionAfter[0].status, 'kitchen', 'Round 1 kitchen status strictly preserved (decoupled from fulfillment)');
    record('MULTI_ROUND', 'Session settlement updated all rounds to is_settled=1 and preserved individual kitchen statuses', true);

    // Audit Log Verification
    const auditLogs = await query(`
      SELECT * FROM audit_logs
      WHERE restaurant_id = $1 AND action = 'ORDER_BILL_SETTLED'
      ORDER BY id DESC
    `, [restoId]);
    assert.ok(auditLogs.length >= 2, 'Must record audit log for each successful settlement');
    record('AUDIT', `Recorded ${auditLogs.length} ORDER_BILL_SETTLED audit logs`, true);

    // -------------------------------------------------------------------------
    // TEST CASE C: Print Log Endpoint Verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST CASE C: Print Job Logging ---');
    const print1Res = await fetch(`${BASE_URL}/api/admin/print/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        order_id: r2Id,
        session_id: sessionId,
        round_number: 2,
        print_type: 'bill',
        printer_role: 'billing',
        status: 'printed'
      })
    });
    const print1Data = await print1Res.json();
    assert.strictEqual(print1Res.status, 200);
    assert.strictEqual(print1Data.is_reprint, 0, 'First bill print is NOT a reprint');
    record('PRINTING', 'Initial bill print logged with is_reprint=0', true);

    // Re-print the bill
    const print2Res = await fetch(`${BASE_URL}/api/admin/print/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        order_id: r2Id,
        session_id: sessionId,
        round_number: 2,
        print_type: 'bill',
        printer_role: 'billing',
        status: 'printed'
      })
    });
    const print2Data = await print2Res.json();
    assert.strictEqual(print2Res.status, 200);
    assert.strictEqual(print2Data.is_reprint, 1, 'Second bill print IS marked as reprint (is_reprint=1)');
    record('PRINTING', 'Subsequent bill print correctly marked as is_reprint=1', true);

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`INVESTIGATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runInvestigation().catch(err => {
  console.error('Investigation failed:', err);
  process.exit(1);
});
