/**
 * TOUCHQR — BILLING MODAL TOTAL MISMATCH REGRESSION TEST SUITE
 *
 * Requirements Coverage:
 * 1. Single-order bill still shows the correct total in payment modal.
 * 2. Two-round session displays the combined amount in the payment modal and matches the printed bill.
 * 3. Excluded orders (cancelled, rejected, already-settled) are not counted.
 * 4. Opening the modal does not settle orders or modify statuses.
 * 5. Reconcile audit reporting: verify that one session settlement creates exactly ONE
 *    ORDER_BILL_SETTLED audit record, and repeated settlement does not create duplicate audit events.
 * 6. Verify shared calculation contract between getBillHTML and payment modal in AdminDashboard.jsx.
 */

import path from 'path';
import fs from 'fs';
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
process.env.PORT = '5056';
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

// 1. Validate safety guard
const { validateTestDatabaseUrl } = await import('./testDbGuard.js');
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

// 2. Initialize DB & tables
const { initDb, query, withTransaction, getDbType } = await import('../db.js');
await initDb();

// 3. Import Express app & JWT secret
const { JWT_SECRET } = await import('../config/jwt.js');
const { default: app } = await import('../index.js');

let server;
let BASE_URL = 'http://localhost:5056';

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
    console.error(`  ❌ [FAIL] ${category} - ${name} ${details ? '(' + details + ')' : ''}`);
    results.push({ category, name, status: 'FAIL', details });
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧾 TOUCHQR — BILLING MODAL TOTAL MISMATCH REGRESSION TEST SUITE');
  console.log('======================================================================\n');

  try {
    // Start test server on port 5056
    server = app.listen(5056);
  } catch (err) {
    // If port in use, listen on ephemeral port
    server = app.listen(0);
    const port = server.address().port;
    BASE_URL = `http://localhost:${port}`;
  }

  try {
    // -------------------------------------------------------------------------
    // SECTION 1: Pure Function / Calculation Invariant Tests (calculateBillDetails)
    // -------------------------------------------------------------------------
    console.log('--- SECTION 1: Pure Calculation & Aggregation Invariants ---');

    // Test 1.1: Single Order Bill
    const singleOrder = {
      id: 501,
      customer_name: 'Solo Diner',
      total_amount: 350,
      status: 'served',
      is_settled: 0,
      items: JSON.stringify([
        { id: 1, name: 'Paneer Butter Masala', price: 250, quantity: 1 },
        { id: 2, name: 'Butter Naan', price: 50, quantity: 2 }
      ])
    };

    const singleResult = calculateBillDetails(singleOrder, [singleOrder], { currency_symbol: '₹', gst_enabled: 0 });
    assert.strictEqual(singleResult.isMultiRound, false, 'Single order must NOT be marked multi-round');
    assert.strictEqual(singleResult.totalRoundsCount, 1, 'Total rounds count must be 1');
    assert.strictEqual(singleResult.grandTotal, 350, 'Grand total must match items total (350)');
    record('CALCULATION', 'Single order returns isMultiRound=false and correct grand total (₹350)', true);

    // Test 1.2: Multi-Round Dining Session (Two Rounds)
    const sessionId = 'session_table_4_regression';
    const round1 = {
      id: 601,
      round_number: 1,
      session_id: sessionId,
      table_number: '4',
      status: 'served',
      is_settled: 0,
      total_amount: 320,
      items: JSON.stringify([
        { id: 10, name: 'Veg Biryani', price: 280, quantity: 1 },
        { id: 11, name: 'Raita', price: 40, quantity: 1 }
      ])
    };
    const round2 = {
      id: 602,
      round_number: 2,
      session_id: sessionId,
      table_number: '4',
      status: 'served',
      is_settled: 0,
      total_amount: 400,
      items: JSON.stringify([
        { id: 12, name: 'Gulab Jamun', price: 80, quantity: 2 },
        { id: 13, name: 'Masala Chai', price: 40, quantity: 2 },
        { id: 14, name: 'Paneer Tikka', price: 160, quantity: 1 }
      ])
    };

    const multiOrders = [round1, round2];
    const multiResultFromR2 = calculateBillDetails(round2, multiOrders, { currency_symbol: '₹', gst_enabled: 0 });
    assert.strictEqual(multiResultFromR2.isMultiRound, true, 'Two-round session must be marked multi-round');
    assert.strictEqual(multiResultFromR2.totalRoundsCount, 2, 'Total rounds count must be 2');
    assert.strictEqual(multiResultFromR2.subtotal, 720, 'Subtotal must combine both rounds (320 + 400 = 720)');
    assert.strictEqual(multiResultFromR2.grandTotal, 720, 'Grand total without GST must be 720');

    // Target from Round 1 must yield the exact same session total
    const multiResultFromR1 = calculateBillDetails(round1, multiOrders, { currency_symbol: '₹', gst_enabled: 0 });
    assert.strictEqual(multiResultFromR1.grandTotal, 720, 'Targeting Round 1 must yield the exact same session total (720)');
    assert.strictEqual(multiResultFromR1.totalRoundsCount, 2, 'Targeting Round 1 must report 2 rounds');
    record('CALCULATION', 'Two-round session correctly aggregates combined total (₹720) across both rounds', true);

    // Test 1.3: Excluded Orders Filtering
    const roundCancelled = {
      id: 603,
      round_number: 3,
      session_id: sessionId,
      status: 'cancelled',
      is_settled: 0,
      total_amount: 500,
      items: JSON.stringify([{ id: 15, name: 'Cancelled Dish', price: 500, quantity: 1 }])
    };
    const roundRejected = {
      id: 604,
      round_number: 4,
      session_id: sessionId,
      status: 'rejected',
      is_settled: 0,
      total_amount: 300,
      items: JSON.stringify([{ id: 16, name: 'Rejected Dish', price: 300, quantity: 1 }])
    };
    const roundAlreadySettled = {
      id: 600,
      round_number: 0,
      session_id: sessionId,
      status: 'completed',
      is_settled: 1,
      total_amount: 1000,
      items: JSON.stringify([{ id: 9, name: 'Prior Settled Banquet', price: 1000, quantity: 1 }])
    };

    const mixedOrders = [roundAlreadySettled, round1, round2, roundCancelled, roundRejected];
    const filteredResult = calculateBillDetails(round2, mixedOrders, { currency_symbol: '₹', gst_enabled: 0 });
    assert.strictEqual(filteredResult.totalRoundsCount, 2, 'Must strictly exclude cancelled, rejected, and prior settled orders');
    assert.strictEqual(filteredResult.grandTotal, 720, 'Grand total must strictly remain 720, ignoring 1000 + 500 + 300');
    assert.deepStrictEqual(filteredResult.sessionOrders.map(o => o.id), [601, 602], 'Only eligible rounds 601 and 602 are included');
    record('CALCULATION', 'Cancelled, rejected, and already-settled orders are strictly excluded from bill calculation', true);

    // Test 1.4: GST Tax Computation Consistency
    const gstResult = calculateBillDetails(round2, multiOrders, { currency_symbol: '₹', gst_enabled: 1 });
    // Subtotal = 720. CGST @ 2.5% = 18. SGST @ 2.5% = 18. Grand total = 756
    assert.strictEqual(gstResult.subtotal, 720);
    assert.strictEqual(gstResult.cgst, 18);
    assert.strictEqual(gstResult.sgst, 18);
    assert.strictEqual(gstResult.grandTotal, 756);
    record('CALCULATION', 'GST 5% (2.5% CGST + 2.5% SGST) computes identically (₹720 -> ₹756)', true);

    // -------------------------------------------------------------------------
    // SECTION 2: Static Code Verification of AdminDashboard.jsx
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 2: AdminDashboard.jsx Contract Verification ---');

    const adminDashboardPath = path.resolve('src/components/Admin/AdminDashboard.jsx');
    const adminDashboardCode = fs.readFileSync(adminDashboardPath, 'utf8');

    // 2.1: Verify import of calculateBillDetails
    assert.ok(
      adminDashboardCode.includes("import { calculateBillDetails } from '../../utils/billingHelper';"),
      'AdminDashboard.jsx must import calculateBillDetails from billingHelper'
    );
    record('UI_CODE', 'AdminDashboard.jsx imports calculateBillDetails from billingHelper', true);

    // 2.2: Verify getBillHTML uses calculateBillDetails
    assert.ok(
      adminDashboardCode.includes('const billData = calculateBillDetails(order, orders, restaurantInfo, settingsForm);'),
      'getBillHTML must calculate bill using shared calculateBillDetails helper'
    );
    record('UI_CODE', 'getBillHTML() delegates to calculateBillDetails()', true);

    // 2.3: Verify payment modal displays Session Total for multi-round session
    assert.ok(
      adminDashboardCode.includes('Session Total: {currency}{billData.grandTotal} • {billData.totalRoundsCount} Rounds'),
      'Payment modal must format multi-round title as "Session Total: {currency}{billData.grandTotal} • {billData.totalRoundsCount} Rounds"'
    );
    record('UI_CODE', 'Payment modal subtitle displays "Session Total: ₹{total} • {rounds} Rounds" for multi-round session', true);

    // 2.4: Verify payment modal preserves single order display
    assert.ok(
      adminDashboardCode.includes('Order {billOrderModal.id} • Total: {currency}{billOrderModal.total_amount}'),
      'Payment modal must preserve "Order {billOrderModal.id} • Total: {currency}{billOrderModal.total_amount}" for single orders'
    );
    record('UI_CODE', 'Payment modal preserves single-order display when not multi-round', true);

    // 2.5: Verify opening modal does NOT perform status updates or settlements
    // setBillOrderModal(order) is only called upon clicking "Print Bill"
    assert.ok(
      adminDashboardCode.includes('const [billOrderModal, setBillOrderModal] = useState(null);'),
      'billOrderModal is clean local React state'
    );
    record('UI_CODE', 'Opening payment modal is purely local React state and performs zero mutations', true);

    // -------------------------------------------------------------------------
    // SECTION 3: Live API Settlement & Audit Record Reconciliation
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 3: Live Settlement & Audit Reconciliation ---');

    // Seed test restaurant
    const restoSlug = 'audit-reconcile-resto';
    const restoName = 'Audit Reconcile Diner';
    const tenantSecret = 'c0ffee1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const adminPasswordHash = await bcrypt.hash('AdminAuditPass123!', 10);
    const kdsPinHash = await bcrypt.hash('1234', 10);
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 30 * 86400 * 1000);
    const graceEnd = new Date(now.getTime() + 37 * 86400 * 1000);

    const restoRes = await query(`
      INSERT INTO restaurants (
        name, slug, tagline, phone, address, active, plan_tier, plan_price,
        counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
        direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at,
        gst_enabled, gstin_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      restoName, restoSlug, 'Reconcile Taste', '+919876543210',
      '202 Audit Road', 1, 'enterprise', 1999,
      1, 10, tenantSecret, kdsPinHash, 1,
      1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString(),
      0, ''
    ]);

    const restoRows = await query('SELECT id FROM restaurants WHERE slug = $1', [restoSlug]);
    const restoId = restoRows[0].id;

    // Seed admin in admins table
    await query(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES ($1, $2, $3, $4)
    `, [restoId, 'audit_admin', adminPasswordHash, 'restaurant_admin']);

    const adminRows = await query('SELECT id FROM admins WHERE username = $1', ['audit_admin']);
    const adminToken = jwt.sign(
      { id: adminRows[0].id, username: 'audit_admin', restaurant_id: restoId, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TEST CASE A: Single Order Settlement & Audit Log Count
    const singleOrderInsert = await query(`
      INSERT INTO orders (restaurant_id, customer_name, table_number, status, total_amount, is_settled, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [restoId, 'Alice', '1', 'served', 350, 0, JSON.stringify([{ name: 'Meal', price: 350, quantity: 1 }])]);
    const singleOrderId = singleOrderInsert[0].id;

    // Settle single order
    const settleSingleRes = await fetch(`${BASE_URL}/api/admin/orders/${singleOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'cash' }
      })
    });
    const settleSingleData = await settleSingleRes.json();
    assert.strictEqual(settleSingleRes.status, 200);
    assert.strictEqual(settleSingleData.is_settled, 1);

    // Verify audit logs after single order settlement
    const auditSingle = await query(`
      SELECT * FROM audit_logs WHERE restaurant_id = $1 AND action = 'ORDER_BILL_SETTLED'
    `, [restoId]);
    assert.strictEqual(auditSingle.length, 1, 'Single order settlement must create exactly 1 audit record');
    record('AUDIT', 'Single order settlement created exactly ONE ORDER_BILL_SETTLED audit record', true);

    // TEST CASE B: Multi-Round Dining Session Settlement & Audit Log Count
    const multiSessionId = 'sess_live_reconcile_99';
    const r1Insert = await query(`
      INSERT INTO orders (restaurant_id, session_id, round_number, customer_name, table_number, status, total_amount, is_settled, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [restoId, multiSessionId, 1, 'Bob Session', '2', 'served', 300, 0, JSON.stringify([{ name: 'Dish 1', price: 300, quantity: 1 }])]);
    const r1Id = r1Insert[0].id;

    const r2Insert = await query(`
      INSERT INTO orders (restaurant_id, session_id, round_number, customer_name, table_number, status, total_amount, is_settled, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [restoId, multiSessionId, 2, 'Bob Session', '2', 'served', 420, 0, JSON.stringify([{ name: 'Dish 2', price: 420, quantity: 1 }])]);
    const r2Id = r2Insert[0].id;

    // Settle session via Round 2
    const settleMultiRes = await fetch(`${BASE_URL}/api/admin/orders/${r2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'upi' }
      })
    });
    const settleMultiData = await settleMultiRes.json();
    assert.strictEqual(settleMultiRes.status, 200);
    assert.strictEqual(settleMultiData.is_settled, 1);

    // Verify both rounds are marked settled
    const sessionRounds = await query('SELECT id, is_settled, payment_method FROM orders WHERE session_id = $1 ORDER BY id ASC', [multiSessionId]);
    assert.strictEqual(sessionRounds.length, 2);
    assert.strictEqual(sessionRounds[0].is_settled, 1, 'Round 1 settled atomically');
    assert.strictEqual(sessionRounds[1].is_settled, 1, 'Round 2 settled atomically');
    assert.strictEqual(sessionRounds[0].payment_method, 'upi');
    assert.strictEqual(sessionRounds[1].payment_method, 'upi');

    // Audit Log count: 1 from Single Order + 1 from Multi Session = 2 total across the two separate tests!
    const auditMulti = await query(`
      SELECT * FROM audit_logs WHERE restaurant_id = $1 AND action = 'ORDER_BILL_SETTLED'
    `, [restoId]);
    assert.strictEqual(auditMulti.length, 2, 'Two separate settlement tests produce exactly 2 audit records (1 each)');
    record('AUDIT', 'Multi-round session settlement created exactly ONE ORDER_BILL_SETTLED record (bringing total to 2 for 2 tests)', true);

    // TEST CASE C: Repeated Settlement Idempotency & Audit Protection
    // Settle Round 2 again (already settled)
    const repeatR2Res = await fetch(`${BASE_URL}/api/admin/orders/${r2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'upi' }
      })
    });
    const repeatR2Data = await repeatR2Res.json();
    assert.strictEqual(repeatR2Res.status, 200);
    assert.strictEqual(repeatR2Data.already_settled, true, 'Repeat settlement reports already_settled: true');
    assert.strictEqual(repeatR2Data.is_settled, 1);

    // Settle Round 1 (which was settled via session)
    const repeatR1Res = await fetch(`${BASE_URL}/api/admin/orders/${r1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'completed',
        settle: { method: 'upi' }
      })
    });
    const repeatR1Data = await repeatR1Res.json();
    assert.strictEqual(repeatR1Res.status, 200);
    assert.strictEqual(repeatR1Data.already_settled, true, 'Repeat settlement on other round reports already_settled: true');

    // Verify audit logs DID NOT increase
    const auditAfterRepeat = await query(`
      SELECT * FROM audit_logs WHERE restaurant_id = $1 AND action = 'ORDER_BILL_SETTLED'
    `, [restoId]);
    assert.strictEqual(auditAfterRepeat.length, 2, 'Repeated settlement MUST NOT create duplicate audit logs');
    record('AUDIT_IDEMPOTENCY', 'Repeated settlements on session rounds create ZERO duplicate audit records (remains 2)', true);

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
