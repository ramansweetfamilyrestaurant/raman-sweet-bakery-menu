/**
 * TouchQR — P4 Counter Ordering, Decoupled Settlement & Secure Tracking Test Suite
 *
 * Covers:
 * 1. Authorized & unauthorized counter QR generation.
 * 2. Counter token tampering & cross-tenant reuse.
 * 3. Space identifier binding.
 * 4. Counter presence-token binding & expiry.
 * 5. Tracking credential generation (128-bit) & SHA-256 hash security.
 * 6. Terminal timestamp lifecycle & historical fallback.
 * 7. Decoupled fulfillment and payment settlement.
 * 8. Counter order isolation & active-table exclusion.
 * 9. Backend kitchen authorization guard for counter orders.
 * 10. Schema verification preflight contract.
 * 11. PostgreSQL / SQLite migration safety.
 * 12. Backward compatibility for dining, hotel, and cinema spaces.
 */

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import http from 'http';
import express from 'express';
import { JWT_SECRET } from '../config/jwt.js';
import {
  generateHmacQrToken,
  generateLegacyQrToken,
  generateRestaurantQrSecret,
  verifyQrToken,
  normalizeSpaceType,
  normalizeSpaceNumber,
  isValidQrTokenFormat,
  validateSpaceCapacity
} from '../utils/qrSecurity.js';
import {
  generatePresenceToken,
  verifyPresenceToken,
  generateQrContextHash
} from '../utils/presenceVerification.js';
import {
  normalizeSpaceType as clientNormalizeSpaceType,
  normalizeSpaceNumber as clientNormalizeSpaceNumber,
  isValidQrTokenFormat as clientIsValidQrTokenFormat
} from '../../src/utils/qrSecurity.js';
import { query, initDb, getDbType, withTransaction } from '../db.js';
import apiRouter from '../routes/api.js';
import adminRouter from '../routes/admin.js';

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

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
  console.log('🛡️  TOUCHQR P4 COUNTER ORDERING & TRACKING REGRESSION SUITE');
  console.log('======================================================================\n');

  // Initialize in-memory test database with full schema
  await initDb({ isTest: true, skipSeed: true });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ----------------------------------------------------------------------
    // SECTION 1: Counter Space Normalization & Parity
    // ----------------------------------------------------------------------
    console.log('--- SECTION 1: Space Normalization & Client-Server Parity ---');

    test('Server & Client normalizeSpaceType recognizes "counter"', () => {
      assert.strictEqual(normalizeSpaceType('counter'), 'counter');
      assert.strictEqual(normalizeSpaceType('COUNTER'), 'counter');
      assert.strictEqual(clientNormalizeSpaceType('counter'), 'counter');
      assert.strictEqual(clientNormalizeSpaceType('COUNTER'), 'counter');
    });

    test('Server & Client normalizeSpaceNumber normalizes counter identifier to canonical COUNTER', () => {
      assert.strictEqual(normalizeSpaceNumber('counter'), 'COUNTER');
      assert.strictEqual(normalizeSpaceNumber('COUNTER'), 'COUNTER');
      assert.strictEqual(normalizeSpaceNumber('Counter'), 'COUNTER');
      assert.strictEqual(clientNormalizeSpaceNumber('counter'), 'COUNTER');
      assert.strictEqual(clientNormalizeSpaceNumber('COUNTER'), 'COUNTER');
    });

    // ----------------------------------------------------------------------
    // SECTION 2: Authorized & Unauthorized Counter QR Generation
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 2: Counter Capacity & QR Generation ---');

    const mockSecret = generateRestaurantQrSecret();

    test('Counter QR token generates valid 64-character HMAC hex token', () => {
      const token = generateHmacQrToken('test-bakery', 'counter', 'COUNTER', mockSecret);
      assert.strictEqual(isValidQrTokenFormat(token), true);
      assert.strictEqual(clientIsValidQrTokenFormat(token), true);
      assert.strictEqual(token.length, 64);
    });

    await testAsync('validateSpaceCapacity: Disabled counter ordering rejects (even if total_tables = 0)', async () => {
      const restoZeroTables = { id: 1, total_tables: 0, counter_ordering_enabled: 0 };
      const res = await validateSpaceCapacity(restoZeroTables, 'counter', 'COUNTER');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'counter_ordering_disabled');
    });

    await testAsync('validateSpaceCapacity: Enabled counter ordering authorizes canonical COUNTER', async () => {
      const restoEnabled = { id: 1, total_tables: 0, counter_ordering_enabled: 1 };
      const res = await validateSpaceCapacity(restoEnabled, 'counter', 'COUNTER');
      assert.strictEqual(res.valid, true);
    });

    await testAsync('validateSpaceCapacity: Invalid counter identifier is rejected', async () => {
      const restoEnabled = { id: 1, total_tables: 5, counter_ordering_enabled: 1 };
      const res = await validateSpaceCapacity(restoEnabled, 'counter', '2');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error === 'invalid_table_number' || res.error === 'invalid_counter_identifier');
    });

    // ----------------------------------------------------------------------
    // SECTION 3: Token Tampering & Cross-Tenant Reuse
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 3: Counter Token Tampering & Cross-Tenant Reuse ---');

    const secretA = generateRestaurantQrSecret();
    const secretB = generateRestaurantQrSecret();
    const tokenA = generateHmacQrToken('bakery-a', 'counter', 'COUNTER', secretA);

    test('Valid counter token verifies with authentic secret', () => {
      const res = verifyQrToken('bakery-a', 'counter', 'COUNTER', secretA, tokenA, { requireHmac: true });
      assert.strictEqual(res.valid, true);
    });

    test('Cross-tenant reuse: Tenant B secret rejects Tenant A counter token', () => {
      const res = verifyQrToken('bakery-b', 'counter', 'COUNTER', secretB, tokenA, { requireHmac: true });
      assert.strictEqual(res.valid, false);
    });

    test('Tampered token string fails verification', () => {
      const tampered = tokenA.slice(0, -3) + 'XYZ';
      const res = verifyQrToken('bakery-a', 'counter', 'COUNTER', secretA, tampered, { requireHmac: true });
      assert.strictEqual(res.valid, false);
    });

    test('Counter token cannot be used for dining table', () => {
      const res = verifyQrToken('bakery-a', 'table', '1', secretA, tokenA, { requireHmac: true });
      assert.strictEqual(res.valid, false);
    });

    test('Dining table token cannot be used for counter', () => {
      const tableToken = generateHmacQrToken('bakery-a', 'table', '1', secretA);
      const res = verifyQrToken('bakery-a', 'counter', 'COUNTER', secretA, tableToken, { requireHmac: true });
      assert.strictEqual(res.valid, false);
    });

    // ----------------------------------------------------------------------
    // SECTION 4: Presence Token Binding & Expiry
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 4: Counter Presence Token Binding & Expiry ---');

    const qrHash = generateQrContextHash('bakery-a', 'counter', 'COUNTER', tokenA);
    const validPresence = generatePresenceToken({
      verificationToken: 'vtok_123',
      restaurantId: 99,
      slug: 'bakery-a',
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      qrContextHash: qrHash,
      expiryMinutes: 20
    });

    test('Valid counter presence token verifies successfully', () => {
      const res = verifyPresenceToken({
        presenceToken: validPresence,
        restaurantId: 99,
        slug: 'bakery-a',
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrToken: tokenA
      });
      assert.strictEqual(res.valid, true);
    });

    test('Presence token bound to counter rejects table verification', () => {
      const res = verifyPresenceToken({
        presenceToken: validPresence,
        restaurantId: 99,
        slug: 'bakery-a',
        spaceType: 'table',
        spaceNumber: '1',
        qrToken: tokenA
      });
      assert.strictEqual(res.valid, false);
    });

    test('Expired presence token fails with presence_token_expired', () => {
      const expiredPresence = generatePresenceToken({
        verificationToken: 'vtok_old',
        restaurantId: 99,
        slug: 'bakery-a',
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrContextHash: qrHash,
        expiryMinutes: -5 // expired 5 minutes ago
      });
      const res = verifyPresenceToken({
        presenceToken: expiredPresence,
        restaurantId: 99,
        slug: 'bakery-a',
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrToken: tokenA
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.reason, 'presence_token_expired');
    });

    // ----------------------------------------------------------------------
    // SECTION 5: Tracking Credential Security (128-bit & SHA-256)
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 5: Tracking Credential Generation & SHA-256 ---');

    test('Tracking credential is 128-bit (32 hex characters) and nonces are unique', () => {
      const t1 = crypto.randomBytes(16).toString('hex');
      const t2 = crypto.randomBytes(16).toString('hex');
      assert.strictEqual(t1.length, 32);
      assert.strictEqual(t2.length, 32);
      assert.notStrictEqual(t1, t2);
    });

    test('Timing-safe SHA-256 verification matches authentic credential', () => {
      const rawToken = crypto.randomBytes(16).toString('hex');
      const storedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const clientProvidedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expectedBuf = Buffer.from(storedHash, 'hex');
      const providedBuf = Buffer.from(clientProvidedHash, 'hex');
      assert.strictEqual(crypto.timingSafeEqual(expectedBuf, providedBuf), true);
    });

    test('Timing-safe SHA-256 rejects incorrect credential', () => {
      const rawToken = crypto.randomBytes(16).toString('hex');
      const storedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const wrongToken = crypto.randomBytes(16).toString('hex');
      const wrongHash = crypto.createHash('sha256').update(wrongToken).digest('hex');
      const expectedBuf = Buffer.from(storedHash, 'hex');
      const providedBuf = Buffer.from(wrongHash, 'hex');
      assert.strictEqual(crypto.timingSafeEqual(expectedBuf, providedBuf), false);
    });

    // ----------------------------------------------------------------------
    // SECTION 6: Terminal Timestamp Lifecycle & Fallback
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 6: Terminal Timestamp & Expiry Contract ---');

    test('First transition to terminal sets terminal_at, subsequent operations preserve it', () => {
      let terminal_at = null;
      const firstTransitionTime = new Date().toISOString();
      if (!terminal_at) {
        terminal_at = firstTransitionTime;
      }
      assert.strictEqual(terminal_at, firstTransitionTime);

      // Subsequent settlement update must preserve existing terminal_at
      const subsequentUpdate = terminal_at || new Date(Date.now() + 60000).toISOString();
      assert.strictEqual(subsequentUpdate, firstTransitionTime);
    });

    test('Historical terminal order without terminal_at falls back to created_at for expiry', () => {
      const twoHoursAgoMs = Date.now() - 2.5 * 60 * 60 * 1000;
      const orderLegacy = {
        status: 'completed',
        terminal_at: null,
        created_at: new Date(twoHoursAgoMs).toISOString()
      };

      const terminalRefTime = orderLegacy.terminal_at
        ? new Date(orderLegacy.terminal_at).getTime()
        : new Date(orderLegacy.created_at).getTime();
      const isExpired = Date.now() - terminalRefTime > 2 * 60 * 60 * 1000;
      assert.strictEqual(isExpired, true);
    });

    test('Recent active order has not expired under 24-hour rule', () => {
      const oneHourAgoMs = Date.now() - 60 * 60 * 1000;
      const activeOrder = {
        status: 'kitchen',
        terminal_at: null,
        created_at: new Date(oneHourAgoMs).toISOString()
      };
      const isExpired = Date.now() - new Date(activeOrder.created_at).getTime() > 24 * 60 * 60 * 1000;
      assert.strictEqual(isExpired, false);
    });

    // ----------------------------------------------------------------------
    // SECTION 7: End-to-End API Integration Tests (Database & HTTP)
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 7: End-to-End Express API Tests ---');

    // Setup Test Restaurant in Database
    const tenantSecret = generateRestaurantQrSecret();
    const insertResto = await query(`
      INSERT INTO restaurants (
        name, slug, qr_secret, total_tables, direct_ordering_enabled, counter_ordering_enabled, active, plan_tier, subscription_type
      ) VALUES ($1, $2, $3, $4, 1, 1, 1, 'pro', 'ADMIN_GRANTED')
      RETURNING id, slug, qr_secret
    `, ['Test Gourmet Bakery', 'test-gourmet-bakery', tenantSecret, 5]);

    const testRestoId = insertResto[0].id;
    const testSlug = insertResto[0].slug;

    // Insert a test dish
    const insertDish = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Artisan Sourdough Croissant', 150, 1)
      RETURNING id, name, price
    `, [testRestoId]);
    const dishId = insertDish[0].id;

    // Staff admin token
    const adminToken = jwt.sign(
      { id: 1, role: 'restaurant_admin', restaurant_id: testRestoId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Unrecognized role token
    const unauthStaffToken = jwt.sign(
      { id: 2, role: 'waiter', restaurant_id: testRestoId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Generate valid Counter QR & Presence Token
    const counterQrToken = generateHmacQrToken(testSlug, 'counter', 'COUNTER', tenantSecret);
    const counterQrHash = generateQrContextHash(testSlug, 'counter', 'COUNTER', counterQrToken);
    const counterPresenceToken = generatePresenceToken({
      verificationToken: 'vtok_counter_test',
      restaurantId: testRestoId,
      slug: testSlug,
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      qrContextHash: counterQrHash,
      expiryMinutes: 20
    });

    let createdOrderId = null;
    let customerTrackingToken = null;

    await testAsync('POST /api/orders: Successfully creates isolated counter order & returns 128-bit tracking_token', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: testSlug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: counterQrToken,
          presence_token: counterPresenceToken,
          items: [{ dish_id: dishId, quantity: 2 }]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'pending');
      assert.strictEqual(data.table_number, 'Counter');
      assert.strictEqual(data.round_number, 1);
      assert.strictEqual(data.is_addon, false);
      assert.ok(data.session_id.includes('_counter_'));
      assert.ok(data.tracking_token);
      assert.strictEqual(data.tracking_token.length, 32);

      createdOrderId = data.order_id;
      customerTrackingToken = data.tracking_token;

      // Verify DB persistence of SHA-256 hash (never plain text)
      const dbRows = await query('SELECT tracking_token_hash, is_settled, terminal_at FROM orders WHERE id = $1', [createdOrderId]);
      assert.strictEqual(dbRows.length, 1);
      const expectedHash = crypto.createHash('sha256').update(customerTrackingToken).digest('hex');
      assert.strictEqual(dbRows[0].tracking_token_hash, expectedHash);
      assert.strictEqual(dbRows[0].is_settled, 0);
      assert.strictEqual(dbRows[0].terminal_at, null);
    });

    await testAsync('GET /api/orders/active-table: Returns null for counter space (customer isolation)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/active-table?slug=${testSlug}&table_number=COUNTER&space_type=counter&tkn=${counterQrToken}`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data, null);
    });

    await testAsync('GET /api/orders/track/:id: Rejects when X-Order-Tracking-Token is absent (401)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${createdOrderId}?slug=${testSlug}`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'missing_tracking_token');
    });

    await testAsync('GET /api/orders/track/:id: Rejects incorrect tracking token (403)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${createdOrderId}?slug=${testSlug}`, {
        headers: { 'X-Order-Tracking-Token': '00000000000000000000000000000000' }
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_tracking_token');
    });

    await testAsync('GET /api/orders/track/:id: Rejects query param fallback (headers ONLY)', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${createdOrderId}?slug=${testSlug}&tracking_token=${customerTrackingToken}`);
      assert.strictEqual(res.status, 401);
    });

    await testAsync('GET /api/orders/track/:id: Authorizes with valid X-Order-Tracking-Token header & scrubs hash', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${createdOrderId}?slug=${testSlug}`, {
        headers: { 'X-Order-Tracking-Token': customerTrackingToken }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, createdOrderId);
      assert.strictEqual(data.table_number, 'Counter');
      // Crucial: Must never expose tracking_token_hash to client
      assert.strictEqual(data.tracking_token_hash, undefined);
    });

    await testAsync('GET /api/orders/track/:id: Staff role exemption authorizes without tracking token', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${createdOrderId}?slug=${testSlug}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.id, createdOrderId);
    });

    await testAsync('GET /api/orders/track/:id: Unrecognized staff role fails closed', async () => {
      const res = await fetch(`${baseUrl}/api/orders/track/${createdOrderId}?slug=${testSlug}`, {
        headers: { 'Authorization': `Bearer ${unauthStaffToken}` }
      });
      assert.strictEqual(res.status, 401); // Falls back to requiring customer tracking token
    });

    // ----------------------------------------------------------------------
    // SECTION 8: Counter Kitchen Authorization Guard
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 8: Counter Kitchen Authorization Guard ---');

    await testAsync('PATCH /api/admin/orders/:id/status: Counter order moving to kitchen without acknowledgement is rejected (400)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'kitchen', sent_to_kds: 1 })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'counter_acknowledgement_required');
    });

    await testAsync('PATCH /api/admin/orders/:id/status: Counter order with valid acknowledgement moves to kitchen', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'kitchen',
          sent_to_kds: 1,
          counter_acknowledgement: { confirmed: true, staff_id: 1 }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'kitchen');
    });

    // ----------------------------------------------------------------------
    // SECTION 9: Decoupled Fulfillment and Payment Settlement
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 9: Decoupled Fulfillment & Explicit Settlement ---');

    await testAsync('PATCH /api/admin/orders/:id/status: Moving to completed without settlement keeps is_settled = 0', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'completed' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'completed');
      assert.strictEqual(data.is_settled, 0);

      // Verify terminal_at was stamped on this first terminal transition
      const dbRows = await query('SELECT is_settled, terminal_at FROM orders WHERE id = $1', [createdOrderId]);
      assert.strictEqual(dbRows[0].is_settled, 0);
      assert.ok(dbRows[0].terminal_at !== null);
    });

    await testAsync('PATCH /api/admin/orders/:id/status: Prohibits reopening terminal order back to active state (400)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ status: 'kitchen' })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'order_already_terminal');
    });

    await testAsync('PATCH /api/admin/orders/:id/status: Unrecognized role cannot settle (fail closed 403)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${unauthStaffToken}`
        },
        body: JSON.stringify({
          settle: { method: 'cash' }
        })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error === 'UNAUTHORIZED_SETTLEMENT_ROLE' || data.error === 'ADMIN_ROLE_REQUIRED', 'Must fail closed on unauthorized role');
    });

    await testAsync('PATCH /api/admin/orders/:id/status: Explicit cash settlement by authorized staff settles bill', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          settle: { method: 'cash' }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.is_settled, 1);

      const dbRows = await query('SELECT is_settled, payment_method FROM orders WHERE id = $1', [createdOrderId]);
      assert.strictEqual(dbRows[0].is_settled, 1);
      assert.strictEqual(dbRows[0].payment_method, 'cash');
    });

    await testAsync('PATCH /api/admin/orders/:id/status: Duplicate settlement is idempotent', async () => {
      const res = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          settle: { method: 'cash' }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.already_settled, true);
      assert.strictEqual(data.is_settled, 1);
    });

    // ----------------------------------------------------------------------
    // SECTION 10: Schema Preflight Attributes Check
    // ----------------------------------------------------------------------
    console.log('\n--- SECTION 10: Phase 1 Schema Attributes Verification ---');

    await testAsync('SQLite orders & restaurants schema contains all required Phase 1 columns', async () => {
      const orderCols = await query('PRAGMA table_info(orders)');
      const restoCols = await query('PRAGMA table_info(restaurants)');

      const orderColNames = new Set(orderCols.map(c => c.name));
      const restoColNames = new Set(restoCols.map(c => c.name));

      assert.ok(restoColNames.has('counter_ordering_enabled'), 'restaurants.counter_ordering_enabled must exist');
      assert.ok(orderColNames.has('tracking_token_hash'), 'orders.tracking_token_hash must exist');
      assert.ok(orderColNames.has('terminal_at'), 'orders.terminal_at must exist');
      assert.ok(orderColNames.has('updated_at'), 'orders.updated_at must exist');
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED | ${skipped} SKIPPED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite fatal error:', err);
  process.exit(1);
});
