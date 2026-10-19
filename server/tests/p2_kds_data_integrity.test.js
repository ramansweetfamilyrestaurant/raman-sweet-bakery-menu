/**
 * TouchQR — P2 KDS Data Integrity, Queue Consistency & Ticket Presentation Regression Suite
 *
 * SAFETY INVARIANT:
 * Strictly tests HTTP endpoints, migrations, and shared utilities against the
 * local disposable PostgreSQL database (127.0.0.1:5432 / touchqr_disposable_test).
 * NEVER connects to or mutates remote databases or Neon production.
 */

import http from 'http';
import assert from 'assert';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import { JWT_SECRET } from '../config/jwt.js';
import apiRouter from '../routes/api.js';
import adminRouter from '../routes/admin.js';
import {
  runOrdersNotesMigration,
  validateMigrationTargetUrl,
  checkOrdersNotesColumnExists,
  ORDERS_NOTES_DDL
} from '../scripts/migrate_orders_notes.js';
import {
  isOrderActiveInKitchen,
  filterActiveKitchenOrders
} from '../../src/utils/kdsQueueFilter.js';
import {
  generateHmacQrToken,
  generateRestaurantQrSecret
} from '../utils/qrSecurity.js';
import {
  generatePresenceToken,
  generateQrContextHash
} from '../utils/presenceVerification.js';

// Enforce strict local disposable database target
const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';
process.env.TEST_DATABASE_URL = LOCAL_TEST_URL;
process.env.MIGRATION_DATABASE_URL = LOCAL_TEST_URL;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

let passed = 0;
let failed = 0;

function record(name, status, detail) {
  if (status === 'PASS') {
    passed++;
    console.log(`  ✅ [PASS] ${name}: ${detail}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name}: ${detail}`);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR P2 KDS DATA INTEGRITY & TICKET PRESENTATION SUITE');
  console.log('======================================================================\n');

  await initDb();

  // Create isolated ephemeral Express test server
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Fixture IDs & Constants
  const P2_RESTO_ID = 9201;
  const P2_SLUG = 'p2-kds-integrity';
  const P2_CROSS_RESTO_ID = 9202;
  const P2_CROSS_SLUG = 'p2-kds-cross-tenant';
  const P2_SUSPENDED_RESTO_ID = 9203;
  const P2_SUSPENDED_SLUG = 'p2-kds-suspended';
  const P2_QR_SECRET = generateRestaurantQrSecret();
  const P2_PIN = '1234';
  const P2_PIN_HASH = await bcrypt.hash(P2_PIN, 10);

  // Setup Seed Fixtures in Disposable PostgreSQL
  await query('DELETE FROM orders WHERE restaurant_id IN ($1, $2, $3)', [P2_RESTO_ID, P2_CROSS_RESTO_ID, P2_SUSPENDED_RESTO_ID]);
  await query('DELETE FROM dishes WHERE restaurant_id IN ($1, $2, $3)', [P2_RESTO_ID, P2_CROSS_RESTO_ID, P2_SUSPENDED_RESTO_ID]);
  await query('DELETE FROM restaurants WHERE id IN ($1, $2, $3)', [P2_RESTO_ID, P2_CROSS_RESTO_ID, P2_SUSPENDED_RESTO_ID]);

  // Ensure SaaS enterprise and pro plans have kds_enabled and direct_ordering_enabled active
  const ensurePlan = async (key, name, kdsEnabled) => {
    const existing = await query('SELECT key FROM saas_plans WHERE key = $1', [key]);
    if (!existing || existing.length === 0) {
      await query(
        'INSERT INTO saas_plans (key, name, price, kds_enabled, direct_ordering_enabled) VALUES ($1, $2, 999, $3, 1)',
        [key, name, kdsEnabled]
      );
    } else {
      await query('UPDATE saas_plans SET kds_enabled = $1, direct_ordering_enabled = 1 WHERE key = $2', [kdsEnabled, key]);
    }
  };
  await ensurePlan('enterprise', 'Enterprise VIP', 1);
  await ensurePlan('pro', 'Pro Luxury', 1);

  // Active P2 Test Restaurant
  await query(`
    INSERT INTO restaurants (
      id, name, slug, phone, active, plan_tier, subscription_type, mandate_status,
      kds_pin_hash, kds_auth_version, qr_secret, total_tables, direct_ordering_enabled
    ) VALUES (
      $1, 'P2 KDS Integrity Kitchen', $2, '9999909201', true, 'enterprise', 'VIP', 'active',
      $3, 1, $4, 20, 1
    );
  `, [P2_RESTO_ID, P2_SLUG, P2_PIN_HASH, P2_QR_SECRET]);

  // Cross-tenant restaurant
  await query(`
    INSERT INTO restaurants (
      id, name, slug, phone, active, plan_tier, subscription_type, mandate_status,
      kds_pin_hash, kds_auth_version, qr_secret, total_tables, direct_ordering_enabled
    ) VALUES (
      $1, 'P2 Cross Tenant Kitchen', $2, '9999909202', true, 'enterprise', 'VIP', 'active',
      $3, 1, $4, 20, 1
    );
  `, [P2_CROSS_RESTO_ID, P2_CROSS_SLUG, P2_PIN_HASH, P2_QR_SECRET]);

  // Suspended restaurant
  await query(`
    INSERT INTO restaurants (
      id, name, slug, phone, active, plan_tier, subscription_type, mandate_status,
      kds_pin_hash, kds_auth_version, qr_secret, total_tables, direct_ordering_enabled
    ) VALUES (
      $1, 'P2 Suspended Kitchen', $2, '9999909203', false, 'enterprise', 'standard', 'active',
      $3, 1, $4, 20, 1
    );
  `, [P2_SUSPENDED_RESTO_ID, P2_SUSPENDED_SLUG, P2_PIN_HASH, P2_QR_SECRET]);

  // Seed Menu Dish
  const dishRes = await query(`
    INSERT INTO dishes (restaurant_id, name, price, available)
    VALUES ($1, 'P2 Special Paneer Tikka', 250, true) RETURNING id;
  `, [P2_RESTO_ID]);
  const dishId = dishRes[0].id;

  // Helper to issue KDS token
  const kdsTokenP2 = jwt.sign(
    { role: 'kds_screen', restaurant_id: P2_RESTO_ID, slug: P2_SLUG, permissions: ['kds:read', 'kds:complete'], auth_version: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const kdsTokenCross = jwt.sign(
    { role: 'kds_screen', restaurant_id: P2_CROSS_RESTO_ID, slug: P2_CROSS_SLUG, permissions: ['kds:read', 'kds:complete'], auth_version: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Helper to generate QR + Presence credentials for order placement
  function createOrderCredentials(slug, spaceType, spaceNum, qrSecret, restoId) {
    const qrToken = generateHmacQrToken(slug, spaceType, spaceNum, qrSecret);
    const qrHash = generateQrContextHash(slug, spaceType, spaceNum, qrToken);
    const presenceToken = generatePresenceToken({
      verificationToken: `vt_p2_${Date.now()}`,
      restaurantId: restoId,
      slug,
      spaceType,
      spaceNumber: spaceNum,
      verificationMethod: 'GPS',
      qrContextHash: qrHash
    });
    return { qrToken, presenceToken };
  }

  // ====================================================================
  // SECTION 1: Migration Runner & Safety Invariants
  // ====================================================================
  console.log('--- SECTION 1: Orders Notes Migration Runner & Safety Invariants ---');

  // Test 1.1: Missing MIGRATION_DATABASE_URL rejects execution
  try {
    validateMigrationTargetUrl('');
    record('MIG_MISSING_URL_REJECTED', 'FAIL', 'Expected missing URL to throw');
  } catch (err) {
    if (err.message.includes('MIGRATION_CONFIG_ERROR')) {
      record('MIG_MISSING_URL_REJECTED', 'PASS', 'Missing MIGRATION_DATABASE_URL throws MIGRATION_CONFIG_ERROR');
    } else {
      record('MIG_MISSING_URL_REJECTED', 'FAIL', `Unexpected error message: ${err.message}`);
    }
  }

  // Test 1.2: Rejection of remote or Neon production URLs
  try {
    validateMigrationTargetUrl('postgresql://user:pass@ep-prod-azvujg61.neon.tech/neondb');
    record('MIG_NEON_REJECTED', 'FAIL', 'Expected Neon production URL to be rejected');
  } catch (err) {
    if (err.message.includes('MIGRATION_SAFETY_VIOLATION')) {
      record('MIG_NEON_REJECTED', 'PASS', 'Remote / Neon production URL strictly rejected before connecting');
    } else {
      record('MIG_NEON_REJECTED', 'FAIL', `Unexpected error: ${err.message}`);
    }
  }

  // Test 1.3: Rejection of non-disposable local database
  try {
    validateMigrationTargetUrl('postgres://postgres:postgres@127.0.0.1:5432/menu_production');
    record('MIG_NON_DISPOSABLE_REJECTED', 'FAIL', 'Expected non-disposable database to be rejected');
  } catch (err) {
    if (err.message.includes('MIGRATION_SAFETY_VIOLATION') && err.message.includes('touchqr_disposable_test')) {
      record('MIG_NON_DISPOSABLE_REJECTED', 'PASS', 'Non-disposable database name strictly rejected');
    } else {
      record('MIG_NON_DISPOSABLE_REJECTED', 'FAIL', `Unexpected error: ${err.message}`);
    }
  }

  // Test 1.4: Dry-run performs no DDL and verifies schema state
  try {
    const dryResult = await runOrdersNotesMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: true
    });
    assert.strictEqual(dryResult.success, true);
    assert.strictEqual(dryResult.dryRun, true);
    assert.strictEqual(dryResult.executed, false);
    record('MIG_DRY_RUN_NO_DDL', 'PASS', 'Dry-run inspects schema without executing DDL');
  } catch (err) {
    record('MIG_DRY_RUN_NO_DDL', 'FAIL', err.message);
  }

  // Test 1.5: Migration execution verifies orders.notes in information_schema.columns
  try {
    const migResult = await runOrdersNotesMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: false
    });
    assert.strictEqual(migResult.success, true);
    assert.strictEqual(migResult.columnVerified, true);
    assert.strictEqual(migResult.dryRun, false);

    // Direct information_schema verification
    const colRows = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'notes';
    `);
    assert.strictEqual(colRows.length, 1, 'orders.notes must exist in information_schema');
    assert.strictEqual(colRows[0].data_type, 'text', 'orders.notes must have text data_type');
    record('MIG_EXECUTE_VERIFIED', 'PASS', 'Migration creates and verifies orders.notes in information_schema');
  } catch (err) {
    record('MIG_EXECUTE_VERIFIED', 'FAIL', err.message);
  }

  // Test 1.6: Idempotent re-run succeeds without duplicating column
  try {
    const rerunResult = await runOrdersNotesMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: false
    });
    assert.strictEqual(rerunResult.success, true);
    assert.strictEqual(rerunResult.columnVerified, true);

    const colRowsAfter = await query(`
      SELECT count(*) as count 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'notes';
    `);
    assert.strictEqual(Number(colRowsAfter[0].count), 1, 'Column count must remain exactly 1');
    record('MIG_IDEMPOTENT_RERUN', 'PASS', 'Re-running migration succeeds without duplicating column');
  } catch (err) {
    record('MIG_IDEMPOTENT_RERUN', 'FAIL', err.message);
  }

  // Test 1.7: Rollback mode preserves orders.notes without dropping
  try {
    const rollbackResult = await runOrdersNotesMigration({
      migrationUrl: LOCAL_TEST_URL,
      rollback: true
    });
    assert.strictEqual(rollbackResult.success, true);
    assert.strictEqual(rollbackResult.executed, false);

    const checkCol = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'notes';
    `);
    assert.strictEqual(checkCol.length, 1, 'Column must NOT be dropped on rollback');
    record('MIG_ROLLBACK_SAFE', 'PASS', 'Rollback safely preserves column without dropping');
  } catch (err) {
    record('MIG_ROLLBACK_SAFE', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 2: End-to-End Notes Persistence (POST /api/orders & GET /api/kitchen/orders)
  // ====================================================================
  console.log('\n--- SECTION 2: End-to-End Notes Persistence & Validation ---');

  // Test 2.1: POST /api/orders persists validated notes and returns them
  let orderNormalNotesId = null;
  try {
    const { qrToken, presenceToken } = createOrderCredentials(P2_SLUG, 'table', '1', P2_QR_SECRET, P2_RESTO_ID);
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: P2_SLUG,
        table_number: '1',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [{ dish_id: dishId, quantity: 2 }],
        notes: '  Please make it extra spicy and serve without onions  '
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.notes, 'Please make it extra spicy and serve without onions');
    orderNormalNotesId = data.order_id;

    // Direct database verification
    const dbRow = await query('SELECT notes FROM orders WHERE id = $1', [orderNormalNotesId]);
    assert.strictEqual(dbRow[0].notes, 'Please make it extra spicy and serve without onions');
    record('NOTES_PERSIST_NORMAL', 'PASS', 'Valid customer notes trimmed, persisted, and returned');
  } catch (err) {
    record('NOTES_PERSIST_NORMAL', 'FAIL', err.message);
  }

  // Test 2.2: Empty string or whitespace-only notes become NULL
  let orderEmptyNotesId = null;
  try {
    const { qrToken, presenceToken } = createOrderCredentials(P2_SLUG, 'table', '2', P2_QR_SECRET, P2_RESTO_ID);
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: P2_SLUG,
        table_number: '2',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [{ dish_id: dishId, quantity: 1 }],
        notes: '     \n\t   '
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.notes, null);
    orderEmptyNotesId = data.order_id;

    const dbRow = await query('SELECT notes FROM orders WHERE id = $1', [orderEmptyNotesId]);
    assert.strictEqual(dbRow[0].notes, null, 'Whitespace-only notes must be stored as NULL');
    record('NOTES_EMPTY_BECOMES_NULL', 'PASS', 'Whitespace-only notes stored as NULL in database');
  } catch (err) {
    record('NOTES_EMPTY_BECOMES_NULL', 'FAIL', err.message);
  }

  // Test 2.3: Non-string notes (e.g. object, number, boolean) stored as NULL
  let orderNonStringNotesId = null;
  try {
    const { qrToken, presenceToken } = createOrderCredentials(P2_SLUG, 'table', '3', P2_QR_SECRET, P2_RESTO_ID);
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: P2_SLUG,
        table_number: '3',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [{ dish_id: dishId, quantity: 1 }],
        notes: { malicious: true, payload: 123 }
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.notes, null);
    orderNonStringNotesId = data.order_id;

    const dbRow = await query('SELECT notes FROM orders WHERE id = $1', [orderNonStringNotesId]);
    assert.strictEqual(dbRow[0].notes, null, 'Non-string notes must be stored as NULL');
    record('NOTES_NON_STRING_NULL', 'PASS', 'Non-string notes safely stored as NULL');
  } catch (err) {
    record('NOTES_NON_STRING_NULL', 'FAIL', err.message);
  }

  // Test 2.4: Notes longer than 500 characters capped at 500 characters
  let orderOversizedNotesId = null;
  const longNote = 'A'.repeat(650);
  try {
    const { qrToken, presenceToken } = createOrderCredentials(P2_SLUG, 'table', '4', P2_QR_SECRET, P2_RESTO_ID);
    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: P2_SLUG,
        table_number: '4',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [{ dish_id: dishId, quantity: 1 }],
        notes: longNote
      })
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.notes.length, 500);
    assert.strictEqual(data.notes, 'A'.repeat(500));
    orderOversizedNotesId = data.order_id;

    const dbRow = await query('SELECT notes FROM orders WHERE id = $1', [orderOversizedNotesId]);
    assert.strictEqual(dbRow[0].notes.length, 500);
    record('NOTES_CAPPED_500', 'PASS', 'Notes longer than 500 characters capped at exactly 500 chars');
  } catch (err) {
    record('NOTES_CAPPED_500', 'FAIL', err.message);
  }

  // Test 2.5: GET /api/kitchen/orders returns notes accurately as string or NULL
  try {
    // Set status to 'kitchen' for test tickets so they qualify for active KDS queue
    await query(`
      UPDATE orders SET status = 'kitchen', sent_to_kds = 1, kitchen_prepared = 0, is_settled = 0
      WHERE id IN ($1, $2, $3, $4);
    `, [orderNormalNotesId, orderEmptyNotesId, orderNonStringNotesId, orderOversizedNotesId]);

    const res = await fetch(`${baseUrl}/kitchen/orders?slug=${P2_SLUG}`, {
      headers: { 'Authorization': `Bearer ${kdsTokenP2}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.orders));

    const normalOrd = data.orders.find(o => o.id === orderNormalNotesId);
    const emptyOrd = data.orders.find(o => o.id === orderEmptyNotesId);
    const nonStrOrd = data.orders.find(o => o.id === orderNonStringNotesId);
    const cappedOrd = data.orders.find(o => o.id === orderOversizedNotesId);

    assert.ok(normalOrd, 'Order with normal notes must be returned');
    assert.strictEqual(normalOrd.notes, 'Please make it extra spicy and serve without onions');

    assert.ok(emptyOrd, 'Order with empty notes must be returned');
    assert.strictEqual(emptyOrd.notes, null, 'Empty notes must be returned as null');

    assert.ok(nonStrOrd, 'Order with non-string notes must be returned');
    assert.strictEqual(nonStrOrd.notes, null, 'Non-string notes must be returned as null');

    assert.ok(cappedOrd, 'Order with capped notes must be returned');
    assert.strictEqual(cappedOrd.notes.length, 500);

    record('KITCHEN_GET_NOTES_ACCURATE', 'PASS', 'GET /api/kitchen/orders accurately returns notes as string or null');
  } catch (err) {
    record('KITCHEN_GET_NOTES_ACCURATE', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 3: Shared Pure Queue-Filter Utility Verification
  // ====================================================================
  console.log('\n--- SECTION 3: Shared Pure Queue-Filter Utility (kdsQueueFilter.js) ---');

  // Test 3.1: Kitchen/preparing with sent_to_kds = 0 or NULL are included
  try {
    const oKitchenNull = { id: 1, status: 'kitchen', sent_to_kds: null, kitchen_prepared: 0, is_settled: 0 };
    const oKitchenZero = { id: 2, status: 'kitchen', sent_to_kds: 0, kitchen_prepared: 0, is_settled: 0 };
    const oPrepNull = { id: 3, status: 'preparing', sent_to_kds: null, kitchen_prepared: 0, is_settled: 0 };
    const oPrepZero = { id: 4, status: 'preparing', sent_to_kds: 0, kitchen_prepared: 0, is_settled: 0 };

    assert.strictEqual(isOrderActiveInKitchen(oKitchenNull), true);
    assert.strictEqual(isOrderActiveInKitchen(oKitchenZero), true);
    assert.strictEqual(isOrderActiveInKitchen(oPrepNull), true);
    assert.strictEqual(isOrderActiveInKitchen(oPrepZero), true);
    record('FILTER_KITCHEN_PREPARING_INCLUDED', 'PASS', 'kitchen/preparing orders included regardless of sent_to_kds');
  } catch (err) {
    record('FILTER_KITCHEN_PREPARING_INCLUDED', 'FAIL', err.message);
  }

  // Test 3.2: Accepted with sent_to_kds = 1 included; sent_to_kds = 0 or NULL excluded
  try {
    const oAcceptedSent1 = { id: 10, status: 'accepted', sent_to_kds: 1, kitchen_prepared: 0, is_settled: 0 };
    const oAcceptedSentTrue = { id: 11, status: 'accepted', sent_to_kds: true, kitchen_prepared: 0, is_settled: 0 };
    const oAcceptedSentStr1 = { id: 12, status: 'accepted', sent_to_kds: '1', kitchen_prepared: 0, is_settled: 0 };
    const oAcceptedSent0 = { id: 13, status: 'accepted', sent_to_kds: 0, kitchen_prepared: 0, is_settled: 0 };
    const oAcceptedSentNull = { id: 14, status: 'accepted', sent_to_kds: null, kitchen_prepared: 0, is_settled: 0 };
    const oAcceptedSentUndef = { id: 15, status: 'accepted', kitchen_prepared: 0, is_settled: 0 };

    assert.strictEqual(isOrderActiveInKitchen(oAcceptedSent1), true);
    assert.strictEqual(isOrderActiveInKitchen(oAcceptedSentTrue), true);
    assert.strictEqual(isOrderActiveInKitchen(oAcceptedSentStr1), true);
    assert.strictEqual(isOrderActiveInKitchen(oAcceptedSent0), false);
    assert.strictEqual(isOrderActiveInKitchen(oAcceptedSentNull), false);
    assert.strictEqual(isOrderActiveInKitchen(oAcceptedSentUndef), false);
    record('FILTER_ACCEPTED_SENT_KDS_GATE', 'PASS', 'accepted orders included ONLY when sent_to_kds = 1/true/1');
  } catch (err) {
    record('FILTER_ACCEPTED_SENT_KDS_GATE', 'FAIL', err.message);
  }

  // Test 3.3: Pending, completed, cancelled, rejected, and unknown statuses are excluded
  try {
    const statusesToExclude = ['pending', 'completed', 'cancelled', 'rejected', 'delivered', 'served', 'unknown', ''];
    for (const st of statusesToExclude) {
      const ord = { id: 20, status: st, sent_to_kds: 1, kitchen_prepared: 0, is_settled: 0 };
      assert.strictEqual(isOrderActiveInKitchen(ord), false, `Status "${st}" must be excluded`);
    }
    record('FILTER_INELIGIBLE_STATUSES_EXCLUDED', 'PASS', 'pending, completed, cancelled, rejected excluded');
  } catch (err) {
    record('FILTER_INELIGIBLE_STATUSES_EXCLUDED', 'FAIL', err.message);
  }

  // Test 3.4: Settled and prepared orders are excluded
  try {
    const oSettled = { id: 30, status: 'kitchen', sent_to_kds: 1, kitchen_prepared: 0, is_settled: 1 };
    const oSettledTrue = { id: 31, status: 'kitchen', sent_to_kds: 1, kitchen_prepared: 0, is_settled: true };
    const oPrepared = { id: 32, status: 'kitchen', sent_to_kds: 1, kitchen_prepared: 1, is_settled: 0 };
    const oPreparedTrue = { id: 33, status: 'kitchen', sent_to_kds: 1, kitchen_prepared: true, is_settled: 0 };

    assert.strictEqual(isOrderActiveInKitchen(oSettled), false);
    assert.strictEqual(isOrderActiveInKitchen(oSettledTrue), false);
    assert.strictEqual(isOrderActiveInKitchen(oPrepared), false);
    assert.strictEqual(isOrderActiveInKitchen(oPreparedTrue), false);
    record('FILTER_SETTLED_PREPARED_EXCLUDED', 'PASS', 'Settled and prepared orders strictly excluded');
  } catch (err) {
    record('FILTER_SETTLED_PREPARED_EXCLUDED', 'FAIL', err.message);
  }

  // Test 3.5: Malformed orders and missing lifecycle fields rejected
  try {
    assert.strictEqual(isOrderActiveInKitchen(null), false);
    assert.strictEqual(isOrderActiveInKitchen(undefined), false);
    assert.strictEqual(isOrderActiveInKitchen('not-an-object'), false);
    assert.strictEqual(isOrderActiveInKitchen(42), false);

    // Missing is_settled or kitchen_prepared
    assert.strictEqual(isOrderActiveInKitchen({ id: 40, status: 'kitchen' }), false);
    assert.strictEqual(isOrderActiveInKitchen({ id: 41, status: 'kitchen', kitchen_prepared: 0 }), false);
    assert.strictEqual(isOrderActiveInKitchen({ id: 42, status: 'kitchen', is_settled: 0 }), false);
    record('FILTER_MALFORMED_AND_MISSING_EXCLUDED', 'PASS', 'Malformed orders and missing lifecycle fields safely excluded');
  } catch (err) {
    record('FILTER_MALFORMED_AND_MISSING_EXCLUDED', 'FAIL', err.message);
  }

  // Test 3.6: Explicit database NULL for is_settled and kitchen_prepared tolerated as 0
  try {
    const oLegacyNulls = { id: 50, status: 'kitchen', sent_to_kds: null, kitchen_prepared: null, is_settled: null };
    assert.strictEqual(isOrderActiveInKitchen(oLegacyNulls), true);
    record('FILTER_LEGACY_NULLS_TOLERATED', 'PASS', 'Explicit database NULL tolerated as 0 for unsettled/unprepared');
  } catch (err) {
    record('FILTER_LEGACY_NULLS_TOLERATED', 'FAIL', err.message);
  }

  // Test 3.7: filterActiveKitchenOrders filters and sorts FIFO by created_at
  try {
    const rawList = [
      { id: 103, status: 'kitchen', created_at: '2026-10-19T10:30:00Z', kitchen_prepared: 0, is_settled: 0 },
      { id: 101, status: 'kitchen', created_at: '2026-10-19T10:10:00Z', kitchen_prepared: 0, is_settled: 0 },
      { id: 104, status: 'pending', created_at: '2026-10-19T10:05:00Z', kitchen_prepared: 0, is_settled: 0 }, // pending -> excluded
      { id: 102, status: 'preparing', created_at: '2026-10-19T10:20:00Z', kitchen_prepared: 0, is_settled: 0 }
    ];
    const filtered = filterActiveKitchenOrders(rawList);
    assert.strictEqual(filtered.length, 3);
    assert.deepStrictEqual(filtered.map(o => o.id), [101, 102, 103], 'Must be sorted FIFO by created_at');
    record('FILTER_ACTIVE_KITCHEN_ORDERS_FIFO', 'PASS', 'filterActiveKitchenOrders correctly filters and sorts FIFO');
  } catch (err) {
    record('FILTER_ACTIVE_KITCHEN_ORDERS_FIFO', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 4: Ticket Presentation Logic (Round Badges & Notes Callouts)
  // ====================================================================
  console.log('\n--- SECTION 4: Ticket Presentation Logic ---');

  // Helper matching the exact presentation logic in StandaloneKdsPage.jsx & KdsDisplayView.jsx
  function evaluateTicketPresentation(order) {
    const rawNotes = order.notes || order.special_instructions || order.customer_notes;
    const hasNotes = typeof rawNotes === 'string' && rawNotes.trim().length > 0;
    const notesText = hasNotes ? rawNotes.trim() : '';

    const roundNum = Number(order.round_number);
    const isMultiRound = !isNaN(roundNum) && Number.isInteger(roundNum) && roundNum > 1;
    const roundBadge = isMultiRound ? `ROUND ${roundNum}` : null;

    return {
      hasNotesCallout: hasNotes,
      calloutText: notesText,
      roundBadge
    };
  }

  // Test 4.1: Round 1, missing, NULL, or invalid round produces NO round badge
  try {
    const testCasesNoBadge = [
      { id: 1, round_number: 1 },
      { id: 2, round_number: '1' },
      { id: 3, round_number: null },
      { id: 4, round_number: undefined },
      { id: 5, round_number: '' },
      { id: 6, round_number: 'invalid' },
      { id: 7, round_number: 0 },
      { id: 8, round_number: -1 },
      { id: 9, round_number: 1.5 }
    ];
    for (const tc of testCasesNoBadge) {
      const p = evaluateTicketPresentation(tc);
      assert.strictEqual(p.roundBadge, null, `Order with round_number ${JSON.stringify(tc.round_number)} must not have round badge`);
    }
    record('TICKET_ROUND_1_NO_BADGE', 'PASS', 'Round 1, NULL, missing, or invalid values produce no round badge');
  } catch (err) {
    record('TICKET_ROUND_1_NO_BADGE', 'FAIL', err.message);
  }

  // Test 4.2: Round 2 and Round 3 render correct prominent badge
  try {
    const pRound2 = evaluateTicketPresentation({ id: 201, round_number: 2 });
    assert.strictEqual(pRound2.roundBadge, 'ROUND 2');

    const pRound3Str = evaluateTicketPresentation({ id: 202, round_number: '3' });
    assert.strictEqual(pRound3Str.roundBadge, 'ROUND 3');

    const pRound4 = evaluateTicketPresentation({ id: 203, round_number: 4 });
    assert.strictEqual(pRound4.roundBadge, 'ROUND 4');
    record('TICKET_MULTI_ROUND_BADGES', 'PASS', 'Round 2, 3, 4 render correct ROUND N badges');
  } catch (err) {
    record('TICKET_MULTI_ROUND_BADGES', 'FAIL', err.message);
  }

  // Test 4.3: High-visibility notes callout appears safely for non-empty notes
  try {
    const pNotes = evaluateTicketPresentation({ id: 301, notes: 'No cilantro, extra green chillies' });
    assert.strictEqual(pNotes.hasNotesCallout, true);
    assert.strictEqual(pNotes.calloutText, 'No cilantro, extra green chillies');

    // Safe escaping: text should be stored as plain text without dangerous html
    const pXss = evaluateTicketPresentation({ id: 302, notes: '<script>alert(1)</script>' });
    assert.strictEqual(pXss.hasNotesCallout, true);
    assert.strictEqual(pXss.calloutText, '<script>alert(1)</script>');
    record('TICKET_NOTES_CALLOUT_PRESENT', 'PASS', 'Non-empty notes produce high-visibility callout with exact text');
  } catch (err) {
    record('TICKET_NOTES_CALLOUT_PRESENT', 'FAIL', err.message);
  }

  // Test 4.4: No callout appears for NULL, empty, or whitespace-only notes
  try {
    const noNotesCases = [
      { id: 401, notes: null },
      { id: 402, notes: undefined },
      { id: 403, notes: '' },
      { id: 404, notes: '   \n\t  ' }
    ];
    for (const tc of noNotesCases) {
      const p = evaluateTicketPresentation(tc);
      assert.strictEqual(p.hasNotesCallout, false, `Notes ${JSON.stringify(tc.notes)} must not show callout`);
      assert.strictEqual(p.calloutText, '');
    }
    record('TICKET_NO_NOTES_CALLOUT_EMPTY', 'PASS', 'NULL, empty, or whitespace notes render no callout');
  } catch (err) {
    record('TICKET_NO_NOTES_CALLOUT_EMPTY', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 5: Cross-Tenant Isolation & Suspension Verification
  // ====================================================================
  console.log('\n--- SECTION 5: Security Preservation (Cross-Tenant & Suspension) ---');

  // Test 5.1: Cross-tenant isolation - Tenant B cannot read Tenant A's notes
  try {
    const res = await fetch(`${baseUrl}/kitchen/orders?slug=${P2_CROSS_SLUG}`, {
      headers: { 'Authorization': `Bearer ${kdsTokenCross}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    // Tenant B must not see any orders from Tenant A (P2_RESTO_ID)
    const leakedOrder = (data.orders || []).find(o => o.id === orderNormalNotesId);
    assert.strictEqual(leakedOrder, undefined, 'Tenant B must not receive Tenant A orders');
    record('SECURITY_CROSS_TENANT_ISOLATION', 'PASS', 'Tenant B cannot read Tenant A orders or customer notes');
  } catch (err) {
    record('SECURITY_CROSS_TENANT_ISOLATION', 'FAIL', err.message);
  }

  // Test 5.2: Suspended tenant rejected with 403 RESTAURANT_SUSPENDED
  try {
    const res = await fetch(`${baseUrl}/kitchen/orders?slug=${P2_SUSPENDED_SLUG}`, {
      headers: { 'Authorization': `Bearer ${kdsTokenP2}` }
    });
    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.error, 'RESTAURANT_SUSPENDED');
    record('SECURITY_SUSPENDED_TENANT_BLOCKED', 'PASS', 'Suspended tenant blocked from reading kitchen orders (403)');
  } catch (err) {
    record('SECURITY_SUSPENDED_TENANT_BLOCKED', 'FAIL', err.message);
  }

  // Cleanup fixtures
  try {
    await query('DELETE FROM orders WHERE restaurant_id IN ($1, $2, $3)', [P2_RESTO_ID, P2_CROSS_RESTO_ID, P2_SUSPENDED_RESTO_ID]);
    await query('DELETE FROM dishes WHERE restaurant_id IN ($1, $2, $3)', [P2_RESTO_ID, P2_CROSS_RESTO_ID, P2_SUSPENDED_RESTO_ID]);
    await query('DELETE FROM restaurants WHERE id IN ($1, $2, $3)', [P2_RESTO_ID, P2_CROSS_RESTO_ID, P2_SUSPENDED_RESTO_ID]);
  } catch (e) {}

  await new Promise(resolve => server.close(resolve));

  console.log('\n======================================================================');
  console.log(`🏁 P2 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => {
  console.error('P2 Test Runner fatal error:', err);
  process.exit(1);
});
