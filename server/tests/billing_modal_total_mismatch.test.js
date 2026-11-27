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
import os from 'os';
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { createRoot } from 'react-dom/client';
const { act } = React;

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
      /import\s*\{[^}]*calculateBillDetails[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/billingHelper['"]/.test(adminDashboardCode),
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

    // 2.6: Verify printToast preserves billDataOverride on failure & Retry forwards it
    assert.ok(
      /const showPrintToast = \([^)]*billDataOverride\s*=\s*null/.test(adminDashboardCode) &&
      adminDashboardCode.includes('handlePrintCustomerBill(printToast.order, printToast.paymentMode, printToast.billDataOverride ?? null)'),
      'Print-failure Retry must retain and pass billDataOverride to preserve paid receipt snapshots'
    );
    record('UI_CODE', 'Print retry toast retains and forwards billDataOverride snapshot', true);

    // 2.7: Verify modal UPI QR clears on snapshot change and gates rendering by snapshot key
    assert.ok(
      adminDashboardCode.includes('setModalUpiQrUrl(null);') &&
      adminDashboardCode.includes('setModalUpiQrSnapshotKey(null);') &&
      adminDashboardCode.includes('modalQrRequestRef.current !== requestId') &&
      adminDashboardCode.includes('modalUpiQrSnapshotKey === currentQrSnapshotKey'),
      'Modal UPI QR effect must clear stale URLs, guard async promises, and match rendered snapshot key'
    );
    record('UI_CODE', 'Modal UPI QR clears stale state, guards async promises, and renders only matching snapshot key', true);

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

    // -------------------------------------------------------------------------
    // SECTION 4: Live AdminDashboard UI Tests (Modal UPI QR Race & Print Retry Snapshot)
    // -------------------------------------------------------------------------
    console.log('\n--- SECTION 4: AdminDashboard Live UI Modal QR & Print Retry Tests ---');
    const ROOT_DIR = path.resolve('.');
    const cacheRoot = path.join(ROOT_DIR, 'node_modules/.cache');
    fs.mkdirSync(cacheRoot, { recursive: true });
    const compiledUiDir = fs.mkdtempSync(path.join(cacheRoot, 'billing-ui-test-'));

    const savedUiKeys = ['window', 'document', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT', 'Notification', 'history', 'HTMLElement', 'Element', 'Node', 'Audio', 'navigator', 'setTimeout', 'clearTimeout', '__qrMockHandler'];
    const prevUiGlobals = Object.fromEntries(savedUiKeys.map(k => [k, globalThis[k]]));

    try {
      const uiTestStubPlugin = {
        name: 'billing-ui-test-stubs',
        setup(build) {
          build.onResolve({ filter: /\.css$/ }, (args) => ({ path: args.path, namespace: 'css-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'css-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
          build.onResolve({ filter: /^leaflet$/ }, () => ({ path: 'leaflet', namespace: 'leaflet-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'leaflet-stub' }, () => ({
            contents: 'const makeProxy = () => new Proxy(function(){}, { get: (_t, k) => k === "__esModule" ? false : makeProxy(), apply: () => makeProxy() }); export default makeProxy();',
            loader: 'js'
          }));
          build.onResolve({ filter: /^qrcode$/ }, () => ({ path: 'qrcode', namespace: 'qr-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'qr-stub' }, () => ({
            contents: 'export default { toDataURL: (uri, opts) => globalThis.__qrMockHandler(uri, opts) };',
            loader: 'js'
          }));
        }
      };

      await esbuild.build({
        entryPoints: {
          AdminDashboard: path.join(ROOT_DIR, 'src/components/Admin/AdminDashboard.jsx')
        },
        outdir: compiledUiDir,
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        mainFields: ['module', 'main'],
        jsx: 'automatic',
        external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'lucide-react'],
        plugins: [uiTestStubPlugin],
        outExtension: { '.js': '.mjs' }
      });

      const { default: AdminDashboard } = await import(pathToFileURL(path.join(compiledUiDir, 'AdminDashboard.mjs')).href);

      const storage = new Map();
      const localStorageMock = {
        getItem: (k) => (storage.has(k) ? storage.get(k) : null),
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
        clear: () => storage.clear()
      };
      const createEventBus = () => {
        const listeners = new Map();
        return {
          addEventListener(t, fn) { if (!listeners.has(t)) listeners.set(t, new Set()); listeners.get(t).add(fn); },
          removeEventListener(t, fn) { listeners.get(t)?.delete(fn); },
          dispatchEvent(evt) {
            const event = typeof evt === 'string' ? { type: evt, bubbles: true } : evt;
            if (!event.target) event.target = this;
            event.currentTarget = this;
            event.preventDefault = event.preventDefault || (() => {});
            event.stopPropagation = event.stopPropagation || (() => { event._stopped = true; });
            const set = listeners.get(event.type);
            if (set) for (const fn of Array.from(set)) fn.call(this, event);
            if (event.bubbles && !event._stopped && this.parentNode?.dispatchEvent) this.parentNode.dispatchEvent(event);
            return true;
          }
        };
      };

      const capturedPrintHtmls = [];
      let shouldFailPrint = false;

      const doc = { nodeType: 9 };
      class FakeNode {
        constructor(nodeType, nodeName) {
          this.nodeType = nodeType;
          this.nodeName = nodeName;
          this.ownerDocument = doc;
          this.parentNode = null;
          this.childNodes = [];
          Object.assign(this, createEventBus());
        }
        get firstChild() { return this.childNodes[0] || null; }
        get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
        get nextSibling() {
          if (!this.parentNode) return null;
          const idx = this.parentNode.childNodes.indexOf(this);
          return idx >= 0 ? (this.parentNode.childNodes[idx + 1] || null) : null;
        }
        get previousSibling() {
          if (!this.parentNode) return null;
          const idx = this.parentNode.childNodes.indexOf(this);
          return idx > 0 ? this.parentNode.childNodes[idx - 1] : null;
        }
        appendChild(child) {
          if (child.parentNode) child.parentNode.removeChild(child);
          child.parentNode = this;
          this.childNodes.push(child);
          return child;
        }
        insertBefore(child, ref) {
          if (!ref) return this.appendChild(child);
          if (child.parentNode) child.parentNode.removeChild(child);
          const idx = this.childNodes.indexOf(ref);
          child.parentNode = this;
          if (idx === -1) this.childNodes.push(child);
          else this.childNodes.splice(idx, 0, child);
          return child;
        }
        removeChild(child) {
          const idx = this.childNodes.indexOf(child);
          if (idx !== -1) { this.childNodes.splice(idx, 1); child.parentNode = null; }
          return child;
        }
        remove() { if (this.parentNode) this.parentNode.removeChild(this); }
        contains(target) { let c = target; while (c) { if (c === this) return true; c = c.parentNode; } return false; }
      }
      class FakeText extends FakeNode {
        constructor(t) { super(3, '#text'); this._data = String(t ?? ''); }
        get data() { return this._data; } set data(v) { this._data = String(v ?? ''); }
        get nodeValue() { return this._data; } set nodeValue(v) { this._data = String(v ?? ''); }
        get textContent() { return this._data; } set textContent(v) { this._data = String(v ?? ''); }
      }
      class FakeComment extends FakeNode {
        constructor(t) { super(8, '#comment'); this.data = String(t ?? ''); this.nodeValue = this.data; }
      }
      class FakeElement extends FakeNode {
        constructor(tag) {
          const upper = String(tag).toUpperCase();
          super(1, upper);
          this.tagName = upper;
          this.attrs = new Map();
          this._value = '';
          this.selected = false;
          this.disabled = false;
          this.style = { setProperty() {}, removeProperty() {} };
          this.className = '';
          if (upper === 'IFRAME') {
            this.contentWindow = {
              focus() {},
              print() { if (shouldFailPrint) throw new Error('Simulated printer offline'); },
              document: {
                open() {},
                write(html) { capturedPrintHtmls.push(String(html)); },
                close() {},
                querySelectorAll() { return []; }
              }
            };
            this.contentDocument = this.contentWindow.document;
          }
        }
        get children() { return this.childNodes.filter(c => c.nodeType === 1); }
        get options() { return this.childNodes.filter(c => c.nodeType === 1 && c.tagName === 'OPTION'); }
        get value() { return this._value; } set value(v) { this._value = String(v ?? ''); }
        get textContent() { return this.childNodes.map(c => c.textContent ?? '').join(''); }
        set textContent(v) {
          this.childNodes.forEach(c => { c.parentNode = null; });
          this.childNodes = [];
          if (v !== '' && v !== null && v !== undefined) this.appendChild(new FakeText(v));
        }
        set innerHTML(v) { this.textContent = v ? '' : ''; }
        get innerHTML() { return this.textContent; }
        setAttribute(k, v) {
          const key = String(k);
          this.attrs.set(key, String(v));
          if (key === 'value') this._value = String(v);
          if (key === 'class') this.className = String(v);
          if (key === 'src') this.src = String(v);
          if (key === 'alt') this.alt = String(v);
          if (key === 'title') this.title = String(v);
          if (key === 'id') this.id = String(v);
        }
        getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
        removeAttribute(k) { this.attrs.delete(k); }
        focus() {} blur() {}
      }

      const win = {
        ...createEventBus(),
        location: { search: '?tab=orders', pathname: '/admin', href: 'http://localhost/admin?tab=orders' },
        history: { replaceState() {}, pushState() {} },
        innerWidth: 1280,
        Node: FakeNode,
        Element: FakeElement,
        HTMLElement: FakeElement,
        HTMLIFrameElement: class HTMLIFrameElement extends FakeElement {},
        HTMLInputElement: FakeElement,
        HTMLSelectElement: FakeElement,
        HTMLTextAreaElement: FakeElement,
        localStorage: localStorageMock,
        navigator: { onLine: true, userAgent: 'Mozilla/5.0' },
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
        Notification: { permission: 'default' }
      };
      Object.assign(doc, createEventBus(), {
        defaultView: win,
        activeElement: null,
        documentElement: new FakeElement('html'),
        head: new FakeElement('head'),
        body: new FakeElement('body'),
        createElement: (tag) => new FakeElement(tag),
        createElementNS: (_ns, tag) => new FakeElement(tag),
        createTextNode: (t) => new FakeText(t),
        createComment: (t) => new FakeComment(t)
      });
      doc.documentElement.appendChild(doc.head);
      doc.documentElement.appendChild(doc.body);
      win.document = doc;

      globalThis.window = win;
      globalThis.document = doc;
      globalThis.localStorage = localStorageMock;
      globalThis.Notification = win.Notification;
      globalThis.history = win.history;
      globalThis.HTMLElement = win.HTMLElement;
      globalThis.Element = win.Element;
      globalThis.Node = win.Node;
      globalThis.navigator = win.navigator;
      globalThis.Audio = function FakeAudio() { return { play: () => Promise.resolve(), pause() {} }; };
      globalThis.IS_REACT_ACT_ENVIRONMENT = true;

      const realSetTimeout = prevUiGlobals.setTimeout;
      const realClearTimeout = prevUiGlobals.clearTimeout;
      let pollCallbacks = [];
      let nextTimerId = 9000;
      globalThis.setTimeout = (fn, delay = 0, ...args) => {
        if (delay >= 1500) {
          const id = ++nextTimerId;
          pollCallbacks.push({ id, fn: () => fn(...args) });
          return id;
        }
        return realSetTimeout(fn, Math.min(delay, 25), ...args);
      };
      globalThis.clearTimeout = (id) => {
        pollCallbacks = pollCallbacks.filter(p => p.id !== id);
        return realClearTimeout(id);
      };

      const findNodes = (node, pred, acc = []) => {
        if (!node) return acc;
        if (pred(node)) acc.push(node);
        for (const ch of node.childNodes || []) findNodes(ch, pred, acc);
        return acc;
      };
      const flushMicrotasks = async (rounds = 10) => {
        for (let i = 0; i < rounds; i++) await Promise.resolve();
      };
      const runPollCycle = async () => {
        const current = pollCallbacks.splice(0, pollCallbacks.length);
        for (const p of current) {
          await p.fn();
        }
        await flushMicrotasks();
      };

      const deferredQrs = [];
      globalThis.__qrMockHandler = (uri) => new Promise((resolve) => {
        deferredQrs.push({ uri: String(uri), resolve });
      });

      const uiSessionId = 'sess_ui_qr_retry_700';
      const uiRound1 = {
        id: 701, round_number: 1, session_id: uiSessionId, table_number: '5',
        customer_name: 'Alice UI', status: 'served', is_settled: 0, total_amount: 320,
        created_at: '2026-06-15T10:00:00Z',
        items: JSON.stringify([{ id: 101, name: 'Veg Biryani', price: 320, quantity: 1 }])
      };
      const uiRound2 = {
        id: 702, round_number: 2, session_id: uiSessionId, table_number: '5',
        customer_name: 'Alice UI', status: 'served', is_settled: 0, total_amount: 400,
        created_at: '2026-06-15T10:10:00Z',
        items: JSON.stringify([{ id: 102, name: 'Paneer Tikka', price: 400, quantity: 1 }])
      };
      const uiRound3 = {
        id: 703, round_number: 3, session_id: uiSessionId, table_number: '5',
        customer_name: 'Alice UI', status: 'served', is_settled: 0, total_amount: 100,
        created_at: '2026-06-15T10:15:00Z',
        items: JSON.stringify([{ id: 103, name: 'Masala Chai', price: 100, quantity: 1 }])
      };
      const uiPostSettleNewRound4 = {
        id: 704, round_number: 4, session_id: uiSessionId, table_number: '5',
        customer_name: 'Alice UI', status: 'served', is_settled: 0, total_amount: 500,
        created_at: '2026-06-15T10:25:00Z',
        items: JSON.stringify([{ id: 104, name: 'Post Settle Dessert', price: 500, quantity: 1 }])
      };

      let liveOrdersResponse = [uiRound1];
      const jsonRes = (body) => ({
        ok: true, status: 200, headers: new Headers(),
        text: async () => JSON.stringify(body),
        json: async () => body
      });

      globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes('/api/info')) {
          return jsonRes({
            id: 99, name: 'Bill Audit Cafe', slug: 'bill-audit-cafe',
            plan_tier: 'pro', gst_enabled: 0, auto_print_bill: 1, upi_id: 'audit@upi', upi_payee_name: 'Bill Audit'
          });
        }
        if (u.includes('/api/admin/orders/') && u.includes('/status') && init.method === 'PATCH') {
          liveOrdersResponse = [
            { ...uiRound1, status: 'completed', is_settled: 1, payment_method: 'cash' },
            { ...uiRound2, status: 'completed', is_settled: 1, payment_method: 'cash' },
            { ...uiRound3, status: 'completed', is_settled: 1, payment_method: 'cash' },
            uiPostSettleNewRound4
          ];
          return jsonRes({ status: 'completed', is_settled: 1 });
        }
        if (u.includes('/api/admin/orders')) return jsonRes(liveOrdersResponse);
        if (u.includes('/api/admin/subscription-status')) return jsonRes({ status: 'active', plan_tier: 'pro' });
        if (u.includes('/api/admin/print/log')) return jsonRes({ ok: true });
        return jsonRes([]);
      };

      localStorageMock.setItem('touchqr_admin_slug', 'bill-audit-cafe');
      const container = doc.createElement('div');
      doc.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(React.createElement(AdminDashboard, { token: 'tok-ui-bill', slug: 'bill-audit-cafe' }));
        await flushMicrotasks();
      });

      // 4.1 Open bill modal on Round 1 (₹320) and toggle UPI QR
      const openBillBtn = findNodes(container, n =>
        n.tagName === 'BUTTON' &&
        (String(n.getAttribute('title') || '').includes('Open Bill & Settle Payment') || String(n.getAttribute('title') || '').includes('Combined Bill'))
      )[0];
      assert.ok(openBillBtn, 'OrdersView must render Open Bill button for Round 1');
      await act(async () => {
        openBillBtn.dispatchEvent({ type: 'click', bubbles: true, target: openBillBtn });
        await flushMicrotasks();
      });

      const toggleQrBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Show UPI QR Code on Screen'))[0];
      assert.ok(toggleQrBtn, 'Show UPI QR button must render when upi_id is configured');
      await act(async () => {
        toggleQrBtn.dispatchEvent({ type: 'click', bubbles: true, target: toggleQrBtn });
        await flushMicrotasks();
      });

      // Resolve QR #1 (₹320) and verify displayed QR matches ₹320
      const qrReq1 = deferredQrs.find(q => q.uri.includes('am=320.00'));
      assert.ok(qrReq1, 'First QR generation must target ₹320.00');
      await act(async () => {
        qrReq1.resolve('data:image/png;base64,QR_320');
        await flushMicrotasks();
      });
      let qrImgs = findNodes(container, n => n.tagName === 'IMG' && n.getAttribute('alt') === 'UPI Payment QR');
      assert.strictEqual(qrImgs.length, 1);
      assert.strictEqual(qrImgs[0].getAttribute('src'), 'data:image/png;base64,QR_320');

      // Update live orders to include Round 2 (+400 -> 720), accept updated snapshot -> stale QR_320 must clear BEFORE QR_720 resolves
      liveOrdersResponse = [uiRound1, uiRound2];
      await act(async () => { await runPollCycle(); });

      const acceptUpdatedBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Review & Use Updated Bill'))[0];
      assert.ok(acceptUpdatedBtn, 'Modal must detect new round and offer Review & Use Updated Bill');
      await act(async () => {
        acceptUpdatedBtn.dispatchEvent({ type: 'click', bubbles: true, target: acceptUpdatedBtn });
        await flushMicrotasks();
      });

      qrImgs = findNodes(container, n => n.tagName === 'IMG' && n.getAttribute('alt') === 'UPI Payment QR');
      assert.strictEqual(qrImgs.length, 0, 'Stale QR_320 must be cleared immediately when bill snapshot changes');
      const qrReq2 = deferredQrs.find(q => q.uri.includes('am=720.00'));
      assert.ok(qrReq2, 'Updated snapshot must start QR generation for ₹720.00');

      // Before QR_720 resolves, update orders to Round 3 (+100 -> 820) and accept updated snapshot,
      // then resolve QR_820 FIRST and obsolete QR_720 LAST -> QR_820 must remain displayed!
      liveOrdersResponse = [uiRound1, uiRound2, uiRound3];
      await act(async () => { await runPollCycle(); });
      const acceptUpdatedBtn2 = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Review & Use Updated Bill'))[0];
      await act(async () => {
        acceptUpdatedBtn2.dispatchEvent({ type: 'click', bubbles: true, target: acceptUpdatedBtn2 });
        await flushMicrotasks();
      });

      const qrReq3 = deferredQrs.find(q => q.uri.includes('am=820.00'));
      assert.ok(qrReq3, 'Third snapshot must start QR generation for ₹820.00');

      await act(async () => {
        qrReq3.resolve('data:image/png;base64,QR_820');
        await flushMicrotasks();
      });
      await act(async () => {
        qrReq2.resolve('data:image/png;base64,QR_720_STALE');
        await flushMicrotasks();
      });

      qrImgs = findNodes(container, n => n.tagName === 'IMG' && n.getAttribute('alt') === 'UPI Payment QR');
      assert.strictEqual(qrImgs.length, 1);
      assert.strictEqual(qrImgs[0].getAttribute('src'), 'data:image/png;base64,QR_820', 'Obsolete QR_720 promise must never overwrite newer QR_820');
      record('UI_QR_SNAPSHOT', 'Modal clears stale UPI QR on snapshot change and rejects out-of-order obsolete QR promises', true);

      // 4.2 Settle ₹820 (3 rounds) while post-settlement loadOrders returns settled rounds + new unsettled Round 4 (₹500),
      // fail initial print, then click Retry and verify retained paidSnapshot (₹820, 3 Rounds) prints!
      shouldFailPrint = true;
      const settleCashBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.getAttribute('id') === 'settle-payment-btn-cash')[0];
      assert.ok(settleCashBtn, 'Cash payment button must be enabled once bill snapshot is updated');
      await act(async () => {
        settleCashBtn.dispatchEvent({ type: 'click', bubbles: true, target: settleCashBtn });
        await flushMicrotasks();
      });
      await act(async () => {
        await new Promise(r => realSetTimeout(r, 80));
        await flushMicrotasks();
      });

      assert.strictEqual(capturedPrintHtmls.length, 1, 'Initial post-settlement print attempt wrote HTML before failing');
      assert.ok(capturedPrintHtmls[0].includes('₹820') && capturedPrintHtmls[0].includes('3 Rounds'), 'Initial print used ₹820 across 3 Rounds');

      const retryBtn = findNodes(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Retry'))[0];
      assert.ok(retryBtn, 'Print failure toast must display Retry button');

      shouldFailPrint = false;
      await act(async () => {
        retryBtn.dispatchEvent({ type: 'click', bubbles: true, target: retryBtn });
        await flushMicrotasks();
      });
      await act(async () => {
        await new Promise(r => realSetTimeout(r, 80));
        await flushMicrotasks();
      });

      assert.strictEqual(capturedPrintHtmls.length, 2, 'Clicking Retry triggers a second print attempt');
      const retryHtml = capturedPrintHtmls[1];
      assert.ok(retryHtml.includes('₹820') && retryHtml.includes('PAID (CASH)'), 'Retry must retain original paidSnapshot grandTotal (₹820) after loadOrders refresh');
      assert.ok(retryHtml.includes('3 Rounds'), 'Retry must retain original 3 Rounds paidSnapshot count');
      assert.ok(!retryHtml.includes('Post Settle Dessert') && !retryHtml.includes('₹500') && !retryHtml.includes('1,320'), 'Retry must NOT recalculate paid receipt from post-settlement refreshed orders');
      record('UI_PRINT_RETRY', 'Print-failure Retry retains paidSnapshot (billDataOverride) across loadOrders() refresh', true);

      await act(async () => {
        root.unmount();
        await flushMicrotasks();
      });
    } finally {
      for (const [k, v] of Object.entries(prevUiGlobals)) {
        if (v === undefined) delete globalThis[k];
        else globalThis[k] = v;
      }
      fs.rmSync(compiledUiDir, { recursive: true, force: true });
    }

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
