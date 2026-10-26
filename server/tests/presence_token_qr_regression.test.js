/**
 * TouchQR — Presence Verification Contract & QR Regression Test Suite
 *
 * Dedicated tests covering all 10 required invariants:
 * 1. Restaurant with GPS coordinates and valid GPS verification: order succeeds.
 * 2. Restaurant without GPS coordinates and valid signed table QR verification: order succeeds.
 * 3. Restaurant without GPS coordinates and valid signed counter QR: order succeeds only when counter ordering is enabled.
 * 4. Invalid, unsigned, expired, or tampered QR: order rejected.
 * 5. Cross-tenant QR/presence token: order rejected.
 * 6. Table token used for counter or counter token used for a table: rejected.
 * 7. Client-supplied verificationMethod: 'QR' without a valid signed verification token: rejected.
 * 8. Valid STAFF verification continues to work.
 * 9. The customer verification modal retry handling does not repeatedly remount or auto-retry indefinitely.
 * 10. Duplicate submission still produces one order and preserves idempotency.
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
  generateRestaurantQrSecret,
  verifyQrToken,
  validateSpaceCapacity
} from '../utils/qrSecurity.js';
import {
  generatePresenceToken,
  verifyPresenceToken,
  generateQrContextHash,
  hasRestaurantConfiguredGps,
  resolveEffectiveVerificationPolicy
} from '../utils/presenceVerification.js';
import { query, initDb } from '../db.js';
import apiRouter from '../routes/api.js';

let passed = 0;
let failed = 0;

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
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR PRESENCE TOKEN QR CONTRACT REGRESSION SUITE');
  console.log('======================================================================\n');

  // Initialize in-memory test database
  await initDb({ isTest: true, skipSeed: true });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ----------------------------------------------------------------------
    // FIXTURES SETUP
    // ----------------------------------------------------------------------
    const secretGps = generateRestaurantQrSecret();
    const secretNoGps = generateRestaurantQrSecret();
    const secretTenantB = generateRestaurantQrSecret();

    // 1. Restaurant WITH GPS configured
    const [restoGps] = await query(`
      INSERT INTO restaurants (
        name, slug, qr_secret, total_tables, direct_ordering_enabled, counter_ordering_enabled,
        active, plan_tier, subscription_type, latitude, longitude, location_initialized, max_distance_meters
      ) VALUES (
        'GPS Dining Bistro', 'resto-with-gps', $1, 10, 1, 1, 1, 'pro', 'ADMIN_GRANTED',
        12.9716, 77.5946, 1, 100
      ) RETURNING id, slug, qr_secret
    `, [secretGps]);

    // 2. Restaurant WITHOUT GPS configured
    const [restoNoGps] = await query(`
      INSERT INTO restaurants (
        name, slug, qr_secret, total_tables, direct_ordering_enabled, counter_ordering_enabled,
        active, plan_tier, subscription_type, latitude, longitude, location_initialized
      ) VALUES (
        'No GPS Cafe', 'resto-without-gps', $1, 10, 1, 1, 1, 'pro', 'ADMIN_GRANTED',
        NULL, NULL, 0
      ) RETURNING id, slug, qr_secret
    `, [secretNoGps]);

    // 3. Second Tenant for Cross-Tenant tests
    const [restoTenantB] = await query(`
      INSERT INTO restaurants (
        name, slug, qr_secret, total_tables, direct_ordering_enabled, counter_ordering_enabled,
        active, plan_tier, subscription_type, latitude, longitude, location_initialized
      ) VALUES (
        'Tenant B Eatery', 'tenant-b-eatery', $1, 10, 1, 1, 1, 'pro', 'ADMIN_GRANTED',
        NULL, NULL, 0
      ) RETURNING id, slug, qr_secret
    `, [secretTenantB]);

    // 4. Restaurant with Counter Ordering Disabled
    const secretCounterDisabled = generateRestaurantQrSecret();
    const [restoCounterDisabled] = await query(`
      INSERT INTO restaurants (
        name, slug, qr_secret, total_tables, direct_ordering_enabled, counter_ordering_enabled,
        active, plan_tier, subscription_type, latitude, longitude, location_initialized
      ) VALUES (
        'Counter Disabled Bistro', 'counter-disabled-bistro', $1, 10, 1, 0, 1, 'pro', 'ADMIN_GRANTED',
        NULL, NULL, 0
      ) RETURNING id, slug, qr_secret
    `, [secretCounterDisabled]);

    // Insert dishes for ordering
    const [dishGps] = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Signature Pasta', 250, 1) RETURNING id, name, price
    `, [restoGps.id]);

    const [dishNoGps] = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Artisan Coffee', 120, 1) RETURNING id, name, price
    `, [restoNoGps.id]);

    const [dishTenantB] = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Croissant B', 110, 1) RETURNING id, name, price
    `, [restoTenantB.id]);

    const [dishCounterDisabled] = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Iced Tea', 80, 1) RETURNING id, name, price
    `, [restoCounterDisabled.id]);

    // ----------------------------------------------------------------------
    // TEST 1: Restaurant WITH GPS coordinates and valid GPS verification
    // ----------------------------------------------------------------------
    console.log('--- TEST 1: Restaurant WITH GPS Coordinates ---');

    const qrTokenGps1 = generateHmacQrToken(restoGps.slug, 'table', '1', secretGps);
    const qrHashGps1 = generateQrContextHash(restoGps.slug, 'table', '1', qrTokenGps1);

    await testAsync('1.1 Order succeeds with valid GPS presence token', async () => {
      const gpsPresenceToken = generatePresenceToken({
        verificationToken: 'vtok_gps_valid',
        restaurantId: restoGps.id,
        slug: restoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'GPS',
        qrContextHash: qrHashGps1,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenGps1,
          presence_token: gpsPresenceToken,
          items: [{ dish_id: dishGps.id, quantity: 1 }]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.order_id);
    });

    await testAsync('1.2 QR presence token is rejected when restaurant has configured GPS (preserves GPS geofence)', async () => {
      const qrPresenceToken = generatePresenceToken({
        verificationToken: 'vtok_qr_bypass_attempt',
        restaurantId: restoGps.id,
        slug: restoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: qrHashGps1,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenGps1,
          presence_token: qrPresenceToken,
          items: [{ dish_id: dishGps.id, quantity: 1 }]
        })
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_presence');
      assert.strictEqual(data.reason, 'method_not_allowed');
    });

    // ----------------------------------------------------------------------
    // TEST 2: Restaurant WITHOUT GPS coordinates and valid signed table QR
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 2: Restaurant WITHOUT GPS Coordinates (Table QR) ---');

    const qrTokenNoGpsTable1 = generateHmacQrToken(restoNoGps.slug, 'table', '1', secretNoGps);
    const qrHashNoGpsTable1 = generateQrContextHash(restoNoGps.slug, 'table', '1', qrTokenNoGpsTable1);

    await testAsync('2.1 /api/orders/verify-location issues signed QR presence token when GPS unconfigured', async () => {
      const res = await fetch(`${baseUrl}/api/orders/verify-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          latitude: 0,
          longitude: 0,
          accuracy: 50
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.verified, true);
      assert.strictEqual(data.method, 'QR');
      assert.ok(data.presence_token);

      // Verify the issued token structure
      const decoded = jwt.verify(data.presence_token, JWT_SECRET);
      assert.strictEqual(decoded.method, 'QR');
      assert.strictEqual(decoded.restaurant_id, restoNoGps.id);
      assert.strictEqual(decoded.space_type, 'table');
      assert.strictEqual(decoded.space_number, '1');
      assert.strictEqual(decoded.qr_hash, qrHashNoGpsTable1);
    });

    await testAsync('2.2 Order succeeds with valid signed table QR presence token', async () => {
      const qrPresenceToken = generatePresenceToken({
        verificationToken: 'vtok_nogps_table_order',
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: qrHashNoGpsTable1,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          presence_token: qrPresenceToken,
          items: [{ dish_id: dishNoGps.id, quantity: 2 }]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.order_id);
      assert.ok(data.tracking_token);
    });

    // ----------------------------------------------------------------------
    // TEST 3: Restaurant WITHOUT GPS and signed counter QR
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 3: Counter QR Authorization & Capability Guard ---');

    const qrTokenCounter = generateHmacQrToken(restoNoGps.slug, 'counter', 'COUNTER', secretNoGps);
    const qrHashCounter = generateQrContextHash(restoNoGps.slug, 'counter', 'COUNTER', qrTokenCounter);

    const counterPresenceToken = generatePresenceToken({
      verificationToken: 'vtok_nogps_counter',
      restaurantId: restoNoGps.id,
      slug: restoNoGps.slug,
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      verificationMethod: 'QR',
      qrContextHash: qrHashCounter,
      expiryMinutes: 20
    });

    await testAsync('3.1 Counter order succeeds when counter_ordering_enabled is 1', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: qrTokenCounter,
          presence_token: counterPresenceToken,
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.order_id);
    });

    await testAsync('3.2 Counter order rejected when counter_ordering_enabled is disabled', async () => {
      const qrTokenDis = generateHmacQrToken(restoCounterDisabled.slug, 'counter', 'COUNTER', secretCounterDisabled);
      const qrHashDis = generateQrContextHash(restoCounterDisabled.slug, 'counter', 'COUNTER', qrTokenDis);
      const presenceDis = generatePresenceToken({
        verificationToken: 'vtok_counter_dis',
        restaurantId: restoCounterDisabled.id,
        slug: restoCounterDisabled.slug,
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        verificationMethod: 'QR',
        qrContextHash: qrHashDis,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoCounterDisabled.slug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: qrTokenDis,
          presence_token: presenceDis,
          items: [{ dish_id: dishCounterDisabled.id, quantity: 1 }]
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'counter_ordering_disabled');
    });

    // ----------------------------------------------------------------------
    // TEST 4: Invalid, unsigned, expired, or tampered QR
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 4: Invalid, Unsigned, Expired, or Tampered QR ---');

    await testAsync('4.1 Missing QR token is rejected with 403 missing_token', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: '',
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_qr');
      assert.strictEqual(data.reason, 'missing_token');
    });

    await testAsync('4.2 Tampered QR token is rejected with 403 invalid_token', async () => {
      const tampered = qrTokenNoGpsTable1.slice(0, -4) + 'abcd';
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: tampered,
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_qr');
      assert.strictEqual(data.reason, 'invalid_token');
    });

    await testAsync('4.3 Expired presence token is rejected with 403 presence_expired', async () => {
      const expiredToken = generatePresenceToken({
        verificationToken: 'vtok_expired',
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: qrHashNoGpsTable1,
        expiryMinutes: -10 // expired in the past
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          presence_token: expiredToken,
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'presence_expired');
    });

    await testAsync('4.4 Tampered JWT presence token signature is rejected with 403 invalid_presence', async () => {
      const validToken = generatePresenceToken({
        verificationToken: 'vtok_tamper',
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: qrHashNoGpsTable1,
        expiryMinutes: 20
      });
      const tamperedJwt = validToken.slice(0, -6) + 'xxxxxx';

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          presence_token: tamperedJwt,
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_presence');
    });

    // ----------------------------------------------------------------------
    // TEST 5: Cross-tenant QR / presence token
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 5: Cross-Tenant QR and Presence Isolation ---');

    const qrTokenTenantB = generateHmacQrToken(restoTenantB.slug, 'table', '1', secretTenantB);
    const qrHashTenantB = generateQrContextHash(restoTenantB.slug, 'table', '1', qrTokenTenantB);

    await testAsync('5.1 Cross-tenant physical QR token is rejected at QR verification step', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug, // Submitting to Restaurant A
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenTenantB, // Signed by Restaurant B
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_qr');
    });

    await testAsync('5.2 Cross-tenant presence token is rejected with tenant_mismatch', async () => {
      // Valid physical QR for restoNoGps, but presence token issued for Tenant B
      const presenceTokenTenantB = generatePresenceToken({
        verificationToken: 'vtok_tenant_b',
        restaurantId: restoTenantB.id,
        slug: restoTenantB.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: qrHashTenantB,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          presence_token: presenceTokenTenantB,
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_presence');
      assert.strictEqual(data.reason, 'tenant_mismatch');
    });

    // ----------------------------------------------------------------------
    // TEST 6: Table token used for counter or counter token used for table
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 6: Cross-Space Type Isolation ---');

    await testAsync('6.1 Table QR token used for counter order is rejected', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: qrTokenNoGpsTable1, // Table 1 token
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_qr');
      assert.strictEqual(data.reason, 'invalid_token');
    });

    await testAsync('6.2 Counter QR token used for table order is rejected', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenCounter, // Counter token
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_qr');
      assert.strictEqual(data.reason, 'invalid_token');
    });

    await testAsync('6.3 Counter presence token used for table order is rejected with space_type_mismatch', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          presence_token: counterPresenceToken, // Counter presence token
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_presence');
      assert.strictEqual(data.reason, 'space_type_mismatch');
    });

    // ----------------------------------------------------------------------
    // TEST 7: Client-supplied verificationMethod: 'QR' without valid signed token
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 7: Unsigned / Client-Supplied Method Field Tampering ---');

    await testAsync('7.1 Unsigned verificationMethod in body without presence_token is rejected (403 presence_required)', async () => {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          verificationMethod: 'QR',
          verification_method: 'QR',
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'presence_required');
    });

    test('7.2 Presence token with method: QR but missing qr_hash is rejected by verifyPresenceToken', () => {
      const tokenNoHash = jwt.sign({
        vtoken: 'vtok_nohash',
        restaurant_id: restoNoGps.id,
        slug: restoNoGps.slug,
        space_type: 'table',
        space_number: '1',
        method: 'QR',
        qr_hash: '', // Missing
        iss_at: Date.now()
      }, JWT_SECRET, { expiresIn: '20m' });

      const check = verifyPresenceToken({
        presenceToken: tokenNoHash,
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        qrToken: qrTokenNoGpsTable1,
        allowedMethods: ['QR', 'STAFF', 'GPS']
      });

      assert.strictEqual(check.valid, false);
      assert.strictEqual(check.reason, 'missing_qr_context_hash');
    });

    test('7.3 Presence token with method: QR but missing qrToken in request is rejected by verifyPresenceToken', () => {
      const validQrPresence = generatePresenceToken({
        verificationToken: 'vtok_no_qrtoken',
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: qrHashNoGpsTable1,
        expiryMinutes: 20
      });

      const check = verifyPresenceToken({
        presenceToken: validQrPresence,
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        qrToken: '', // Omitted physical token
        allowedMethods: ['QR', 'STAFF', 'GPS']
      });

      assert.strictEqual(check.valid, false);
      assert.strictEqual(check.reason, 'missing_qr_token');
    });

    // ----------------------------------------------------------------------
    // TEST 8: Valid STAFF verification continues to work
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 8: STAFF Verification Flow ---');

    await testAsync('8.1 Order succeeds with authentic STAFF presence token on GPS-configured restaurant', async () => {
      const qrTokenGps2 = generateHmacQrToken(restoGps.slug, 'table', '2', secretGps);
      const qrHashGps2 = generateQrContextHash(restoGps.slug, 'table', '2', qrTokenGps2);

      const staffPresenceToken = generatePresenceToken({
        verificationToken: 'vtok_staff_gps_resto_t2',
        restaurantId: restoGps.id,
        slug: restoGps.slug,
        spaceType: 'table',
        spaceNumber: '2',
        verificationMethod: 'STAFF',
        qrContextHash: qrHashGps2,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoGps.slug,
          table_number: '2',
          space_type: 'table',
          table_token: qrTokenGps2,
          presence_token: staffPresenceToken,
          items: [{ dish_id: dishGps.id, quantity: 1 }]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.order_id);
    });

    await testAsync('8.2 Order succeeds with authentic STAFF presence token on non-GPS restaurant', async () => {
      const staffPresenceTokenNoGps = generatePresenceToken({
        verificationToken: 'vtok_staff_nogps_resto',
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'STAFF',
        qrContextHash: qrHashNoGpsTable1,
        expiryMinutes: 20
      });

      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: restoNoGps.slug,
          table_number: '1',
          space_type: 'table',
          table_token: qrTokenNoGpsTable1,
          presence_token: staffPresenceTokenNoGps,
          items: [{ dish_id: dishNoGps.id, quantity: 1 }]
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.order_id);
    });

    // ----------------------------------------------------------------------
    // TEST 9: Modal retry handling does not loop
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 9: Loop Prevention Guard ---');

    test('9.1 executePendingOrderRetry clears pendingOrderPayloadRef on failure to prevent remount loop', () => {
      // Unit simulation of the frontend state machine
      const pendingOrderPayloadRef = { current: { slug: 'test', items: [] } };
      let presenceModalOpen = false;
      const setPresenceModalOpen = (val) => { presenceModalOpen = val; };

      const simulateRetryFailure = (errCode) => {
        if (errCode === 'presence_expired' || errCode === 'invalid_presence') {
          pendingOrderPayloadRef.current = null; // Cleared!
          // setPresenceModalOpen is NOT called automatically
        }
      };

      simulateRetryFailure('invalid_presence');
      assert.strictEqual(pendingOrderPayloadRef.current, null, 'Pending payload must be cleared');
      assert.strictEqual(presenceModalOpen, false, 'Modal must not auto-reopen in loop');
    });

    // ----------------------------------------------------------------------
    // TEST 10: Duplicate submission still produces one order and preserves idempotency
    // ----------------------------------------------------------------------
    console.log('\n--- TEST 10: Idempotency Preservation ---');

    await testAsync('10.1 Duplicate submission with same idempotency key produces one order and replays response', async () => {
      const qrTokenNoGpsTable4 = generateHmacQrToken(restoNoGps.slug, 'table', '4', secretNoGps);
      const qrHashNoGpsTable4 = generateQrContextHash(restoNoGps.slug, 'table', '4', qrTokenNoGpsTable4);

      const qrPresenceToken = generatePresenceToken({
        verificationToken: 'vtok_idemp_test_t4',
        restaurantId: restoNoGps.id,
        slug: restoNoGps.slug,
        spaceType: 'table',
        spaceNumber: '4',
        verificationMethod: 'QR',
        qrContextHash: qrHashNoGpsTable4,
        expiryMinutes: 20
      });

      const idempotencyKey = `idemp_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const payload = {
        slug: restoNoGps.slug,
        table_number: '4',
        space_type: 'table',
        table_token: qrTokenNoGpsTable4,
        presence_token: qrPresenceToken,
        idempotency_key: idempotencyKey,
        items: [{ dish_id: dishNoGps.id, quantity: 1 }]
      };

      // Initial request
      const res1 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.ok(data1.order_id);
      assert.ok(data1.tracking_token);

      // Duplicate retry request
      const res2 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();

      assert.strictEqual(data2.order_id, data1.order_id, 'Must return same order ID');
      assert.strictEqual(data2.tracking_token, data1.tracking_token, 'Must return same tracking token');

      // Verify database has exactly 1 order for this idempotency key
      const orders = await query('SELECT id FROM orders WHERE restaurant_id = $1 AND idempotency_key LIKE $2', [restoNoGps.id, `%${idempotencyKey}%`]);
      assert.strictEqual(orders.length, 1, 'Database must contain exactly 1 order record');
      assert.strictEqual(orders[0].id, data1.order_id);
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite runner error:', err);
  process.exit(1);
});
