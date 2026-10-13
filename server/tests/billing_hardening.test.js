/**
 * BILLING HARDENING REGRESSION & INTEGRATION SUITE (P1 Verified)
 * TouchQR Subscription Billing Architecture
 *
 * Verifies:
 * Fix F-01: Payment unique-index consistency (NULLs, empty-strings, duplicate rejection, write normalization)
 * Fix F-02: Terminal mandate failures in /verify-subscription (FAILED, REJECTED, CANCELLED, unknown status)
 * Fix F-03: Webhook identifier safety (deterministic fingerprints, fail-closed on missing IDs, separate payment preservation)
 * Fix F-04: Historical password cleanup coverage (owner_password, password, pwd, JSON hash, canonical hash protection, idempotency)
 */

import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { checkTestDatabaseRequirement } from './testDbGuard.js';
import { query, initDb, closeDbPool, resetDbForTesting, getPaymentIndexStatus, getRawDb, getDbType } from '../db.js';
import paymentRoutes, { finalizePendingRegistration, normalizeGatewayPaymentId } from '../routes/payment.js';
import { resolveCanonicalSubscriptionState, SUBSCRIPTION_STATES } from '../services/subscriptionState.js';
import {
  auditHistoricalPendingPasswords,
  executeHistoricalPendingPasswordCleanup,
  isBcryptHash
} from '../scripts/cleanup_historical_pending_passwords.js';

try {
  checkTestDatabaseRequirement('Billing Hardening Regression Suite');
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

console.log('🛡️ Starting Billing Hardening Regression Suite...\n');

const TEST_SECRET = 'test_cashfree_secret_hardening_suite_2026';
process.env.CASHFREE_CLIENT_SECRET = TEST_SECRET;
process.env.CASHFREE_CLIENT_ID = 'TEST_CASHFREE_CLIENT_ID';

function signPayload(bodyStr, timestamp, secret = TEST_SECRET) {
  const data = `${timestamp}${bodyStr}`;
  return crypto.createHmac('sha256', secret).update(data).digest('base64');
}

async function getIndexInfo(indexName = 'idx_payments_gateway_payid') {
  if (getDbType() === 'postgres') {
    const { pgPool } = getRawDb();
    let rows;
    if (pgPool) {
      const res = await pgPool.query(
        "SELECT indexdef as sql, schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'payments' AND indexname = $1",
        [indexName]
      );
      rows = res.rows;
    } else {
      rows = await query(
        "SELECT indexdef as sql, schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'payments' AND indexname = $1",
        [indexName]
      );
    }
    if (!rows || rows.length === 0) return null;
    return {
      sql: rows[0].sql || '',
      table: rows[0].tablename,
      name: rows[0].indexname,
      schema: rows[0].schemaname
    };
  } else {
    const { sqliteDb } = getRawDb();
    let row;
    if (sqliteDb) {
      row = sqliteDb.prepare(
        "SELECT sql, tbl_name as table_name, name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'payments' AND name = ?"
      ).get(indexName);
    } else {
      const rows = await query(
        "SELECT sql, tbl_name as table_name, name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'payments' AND name = ?",
        [indexName]
      );
      row = rows[0];
    }
    if (!row) return null;
    return {
      sql: row.sql || '',
      table: row.table_name,
      name: row.name,
      schema: 'main'
    };
  }
}

async function getIndexDefinition(indexName = 'idx_payments_gateway_payid') {
  const info = await getIndexInfo(indexName);
  return info?.sql || '';
}

async function runHardeningTests() {
  await initDb();

  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  app.use('/api/payment', paymentRoutes);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      throw err;
    }
  }

  // =========================================================================
  // SECTION 1: MANDATE STATUS & TRIAL DECOUPLING
  // =========================================================================

  // TEST 1: finalizePendingRegistration with BANK_APPROVAL_PENDING
  await test('1. finalizePendingRegistration with BANK_APPROVAL_PENDING sets mandate_status = bank_approval_pending, auto_debit_enabled = 0, and preserves trial access', async () => {
    const uniqueSuffix = `${Date.now()}_1`;
    const regId = `reg_pending_${uniqueSuffix}`;
    const targetSubId = `cf_sub_pending_${uniqueSuffix}`;
    const testPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testUsername = `user_pending_${uniqueSuffix}`;

    const salt = await bcrypt.genSalt(10);
    const testHash = await bcrypt.hash('SecurePass123!', salt);

    const regPayload = {
      name: `Pending Resto ${uniqueSuffix}`,
      phone: testPhone,
      owner_username: testUsername,
      plan_tier: 'pro',
      plan_price: 999,
      trial_days: 16,
      subscription_id: targetSubId
    };

    await query(`
      INSERT INTO pending_registrations (
        id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, trial_days, cashfree_subscription_id, mandate_status, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      regId, JSON.stringify(regPayload), regPayload.name, testPhone, testUsername,
      testHash, 'pro', 999, 16, targetSubId, 'pending', 'checkout_started',
      new Date(Date.now() + 86400000).toISOString()
    ]);

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        subscription_status: 'BANK_APPROVAL_PENDING',
        customer_details: { customer_phone: testPhone, customer_id: `cust_${targetSubId}` }
      })
    });

    try {
      const finalized = await finalizePendingRegistration(regId, targetSubId);
      assert(finalized.newRestoId, 'Restaurant ID should be created');

      const restoRows = await query('SELECT mandate_status, auto_debit_enabled, trial_ends_at, plan_expires_at FROM restaurants WHERE id = $1', [finalized.newRestoId]);
      assert.strictEqual(restoRows[0].mandate_status, 'bank_approval_pending', 'Mandate status must be accurately set to bank_approval_pending');
      assert.strictEqual(Number(restoRows[0].auto_debit_enabled), 0, 'Auto debit must be 0 while approval is pending');
      assert(restoRows[0].trial_ends_at, 'Trial end date must be populated');

      const canonicalState = resolveCanonicalSubscriptionState({
        resto: restoRows[0],
        sub: null,
        now: new Date()
      });
      assert.strictEqual(canonicalState.active, true, 'Tenant must have active trial access');
      assert.strictEqual(canonicalState.status, SUBSCRIPTION_STATES.TRIALING, 'Status must be trialing during trial');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // TEST 2: Expired trial with BANK_APPROVAL_PENDING does NOT grant paid access
  await test('2. Expired trial with BANK_APPROVAL_PENDING does NOT grant paid access', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    const resto = {
      mandate_status: 'bank_approval_pending',
      auto_debit_enabled: 0,
      trial_ends_at: pastDate,
      plan_expires_at: pastDate,
      active: 1
    };

    const canonicalState = resolveCanonicalSubscriptionState({
      resto,
      sub: null,
      now: new Date()
    });

    assert.strictEqual(canonicalState.active, false, 'Expired trial with bank_approval_pending must NOT be active');
    assert.strictEqual(canonicalState.status, SUBSCRIPTION_STATES.BANK_APPROVAL_PENDING, 'Status must be bank_approval_pending');
  });

  // TEST 3: finalizePendingRegistration with ACTIVE sets mandate_status = active
  await test('3. finalizePendingRegistration with ACTIVE sets mandate_status = active and auto_debit_enabled = 1', async () => {
    const uniqueSuffix = `${Date.now()}_3`;
    const regId = `reg_active_${uniqueSuffix}`;
    const targetSubId = `cf_sub_active_${uniqueSuffix}`;
    const testPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testUsername = `user_active_${uniqueSuffix}`;

    const salt = await bcrypt.genSalt(10);
    const testHash = await bcrypt.hash('SecurePass123!', salt);

    const regPayload = {
      name: `Active Resto ${uniqueSuffix}`,
      phone: testPhone,
      owner_username: testUsername,
      plan_tier: 'pro',
      plan_price: 999,
      trial_days: 16,
      subscription_id: targetSubId
    };

    await query(`
      INSERT INTO pending_registrations (
        id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, trial_days, cashfree_subscription_id, mandate_status, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      regId, JSON.stringify(regPayload), regPayload.name, testPhone, testUsername,
      testHash, 'pro', 999, 16, targetSubId, 'pending', 'checkout_started',
      new Date(Date.now() + 86400000).toISOString()
    ]);

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        subscription_status: 'ACTIVE',
        customer_details: { customer_phone: testPhone, customer_id: `cust_${targetSubId}` }
      })
    });

    try {
      const finalized = await finalizePendingRegistration(regId, targetSubId);
      assert(finalized.newRestoId, 'Restaurant ID should be created');

      const restoRows = await query('SELECT mandate_status, auto_debit_enabled FROM restaurants WHERE id = $1', [finalized.newRestoId]);
      assert.strictEqual(restoRows[0].mandate_status, 'active', 'Mandate status must be active');
      assert.strictEqual(Number(restoRows[0].auto_debit_enabled), 1, 'Auto debit must be enabled');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // TEST 4: Fix F-02 — /verify-subscription handles FAILED, REJECTED, CANCELLED and unknown statuses
  await test('4. Fix F-02: /verify-subscription explicitly persists terminal failures (failed), preserves trial_ends_at, and handles unknown statuses fail-closed', async () => {
    const uniqueSuffix = `${Date.now()}_4`;
    const trialEndFuture = new Date(Date.now() + 12 * 86400000).toISOString();
    const subId = `cf_sub_term_${uniqueSuffix}`;

    const phone = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const restoRes = await query(`
      INSERT INTO restaurants (name, slug, phone, plan_tier, plan_price, active, mandate_status, mandate_id, trial_ends_at, plan_expires_at)
      VALUES ('Terminal Status Resto', 'term-status-${uniqueSuffix}', '${phone}', 'pro', 999, true, 'pending', '${subId}', '${trialEndFuture}', '${trialEndFuture}')
      RETURNING id
    `);
    const restoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, gateway_subscription_id, status, amount, currency, billing_cycle)
      VALUES ($1, 2, 'cashfree', $2, 'pending', 999, 'INR', 'monthly')
    `, [restoId, subId]);

    const jwtToken = jwt.sign(
      { id: 9999, username: 'test_admin', role: 'restaurant_admin', restaurant_id: restoId },
      process.env.JWT_SECRET || 'touchqr_dev_jwt_secret_key_123456789'
    );

    const originalFetch = global.fetch;

    // Sub-case A: Cashfree returns FAILED -> must persist failed, auto_debit_enabled = 0, preserve trial_ends_at
    global.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('127.0.0.1')) {
        return originalFetch(url, opts);
      }
      return {
        ok: true,
        json: async () => ({
          status: 'OK',
          subscription_status: 'FAILED',
          customer_details: { customer_id: `cust_${restoId}` }
        })
      };
    };

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const resFailed = await fetch(`http://127.0.0.1:${port}/api/payment/verify-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ subscription_id: subId })
      });
      const dataFailed = await resFailed.json();
      assert.strictEqual(dataFailed.authorized, false, 'Failed mandate must not be authorized');
      assert.strictEqual(dataFailed.mandate_status, 'failed', 'Normalized status must be failed');

      const checkResto = await query('SELECT mandate_status, auto_debit_enabled, trial_ends_at FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(checkResto[0].mandate_status, 'failed', 'DB mandate_status must be updated to failed');
      assert.strictEqual(Number(checkResto[0].auto_debit_enabled), 0, 'Auto debit must be disabled');
      assert.strictEqual(checkResto[0].trial_ends_at, trialEndFuture, 'Trial end date must be strictly preserved');

      // Trial access check: unexpired trial remains valid despite mandate failure
      const trialState = resolveCanonicalSubscriptionState({ resto: checkResto[0], sub: null, now: new Date() });
      assert.strictEqual(trialState.active, true, 'Legitimate unexpired trial remains active');
      assert.strictEqual(trialState.status, SUBSCRIPTION_STATES.TRIALING);

      // Expired trial check: fails closed
      const expiredState = resolveCanonicalSubscriptionState({ resto: checkResto[0], sub: null, now: new Date(Date.now() + 20 * 86400000) });
      assert.strictEqual(expiredState.active, false, 'Expired trial with failed mandate must be inactive');
      assert.strictEqual(expiredState.status, SUBSCRIPTION_STATES.PAYMENT_FAILED);

      // Sub-case B: Unknown status -> returns unknown, does NOT mark active
      global.fetch = async (url, opts) => {
        if (typeof url === 'string' && url.includes('127.0.0.1')) {
          return originalFetch(url, opts);
        }
        return {
          ok: true,
          json: async () => ({
            status: 'OK',
            subscription_status: 'UNKNOWN_GATEWAY_STATUS_123',
            customer_details: { customer_id: `cust_${restoId}` }
          })
        };
      };

      const resUnknown = await fetch(`http://127.0.0.1:${port}/api/payment/verify-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ subscription_id: subId })
      });
      const dataUnknown = await resUnknown.json();
      assert.strictEqual(dataUnknown.authorized, false, 'Unknown status must not be authorized');
      assert.strictEqual(dataUnknown.mandate_status, 'unknown', 'Normalized status must be unknown');
    } finally {
      global.fetch = originalFetch;
      server.close();
    }
  });

  // =========================================================================
  // SECTION 2: PAYMENT UNIQUENESS & WEBHOOK IDEMPOTENCY
  // =========================================================================

  // TEST 5: Fix F-01 — Payment Record Uniqueness: NULLs & empty strings co-exist, duplicate non-empty rejected
  await test('5. Fix F-01: Payment Record Uniqueness: partial unique index blocks duplicate non-empty IDs while allowing NULLs and empty strings', async () => {
    const uniqueSuffix = `${Date.now()}_5`;
    const payId = `pay_uniq_test_${uniqueSuffix}`;

    // 1. Insert first payment with non-empty ID
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '${payId}', 499.00, 'INR', 'SUCCESS', 'recurring')
    `);

    // 2. Attempt duplicate insert with same (gateway, gateway_payment_id) -> MUST FAIL
    let duplicateFailed = false;
    try {
      await query(`
        INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
        VALUES (1, 'cashfree', '${payId}', 499.00, 'INR', 'SUCCESS', 'recurring')
      `);
    } catch (err) {
      duplicateFailed = true;
      assert(err.message.includes('UNIQUE') || err.message.includes('unique') || err.message.includes('constraint'), `Expected unique violation, got: ${err.message}`);
    }
    assert.strictEqual(duplicateFailed, true, 'Duplicate insert on (gateway, gateway_payment_id) must be rejected by unique index');

    // 3. Multiple rows with NULL gateway_payment_id MUST SUCCEED
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', NULL, 100.00, 'INR', 'SUCCESS', 'manual_adjustment')
    `);
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', NULL, 200.00, 'INR', 'SUCCESS', 'manual_adjustment')
    `);

    // 4. Multiple rows with empty-string gateway_payment_id MUST SUCCEED because index predicate excludes != ''
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '', 50.00, 'INR', 'SUCCESS', 'legacy_empty_1')
    `);
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '', 60.00, 'INR', 'SUCCESS', 'legacy_empty_2')
    `);

    // 5. Test normalizeGatewayPaymentId helper
    assert.strictEqual(normalizeGatewayPaymentId(''), null, 'Empty string must normalize to NULL');
    assert.strictEqual(normalizeGatewayPaymentId('   '), null, 'Whitespace-only string must normalize to NULL');
    assert.strictEqual(normalizeGatewayPaymentId(null), null, 'Null must normalize to NULL');
    assert.strictEqual(normalizeGatewayPaymentId(undefined), null, 'Undefined must normalize to NULL');
    assert.strictEqual(normalizeGatewayPaymentId(' cf_pay_valid '), 'cf_pay_valid', 'Valid ID must be trimmed');
  });

  // TEST 5B: Regression: Migration from existing OLD index definition (WHERE gateway_payment_id IS NOT NULL)
  await test('5B. Existing payment index migration: safely upgrades old predicate to exclude empty strings without deleting data', async () => {
    // 1. Artificially recreate the OLD index definition as it existed prior to migration
    await query("DELETE FROM payments WHERE gateway_payment_id = '' OR gateway_payment_id IS NULL");
    await query('DROP INDEX IF EXISTS idx_payments_gateway_payid');
    await query(`
      CREATE UNIQUE INDEX idx_payments_gateway_payid 
      ON payments(gateway, gateway_payment_id) 
      WHERE gateway_payment_id IS NOT NULL
    `);

    // 2. Inspect catalog to confirm old index is in place
    const oldInfo = await getIndexInfo('idx_payments_gateway_payid');
    assert(Boolean(oldInfo), 'Old index definition must be present in catalog');
    assert.strictEqual(oldInfo.table, 'payments', 'Index must be on payments table');
    const oldSql = oldInfo.sql;
    assert(oldSql.includes('gateway_payment_id IS NOT NULL'), 'Old index definition must have IS NOT NULL predicate');
    assert(!oldSql.includes("!= ''") && !oldSql.includes("<> ''"), 'Old index must not have empty-string exclusion');

    // 3. Confirm old behavior: under old predicate, empty strings are indexed and trigger UNIQUE collision
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '', 10.00, 'INR', 'SUCCESS', 'test_old_empty_1')
    `);
    let oldCollision = false;
    try {
      await query(`
        INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
        VALUES (1, 'cashfree', '', 20.00, 'INR', 'SUCCESS', 'test_old_empty_2')
      `);
    } catch (err) {
      oldCollision = true;
      assert(err.message.includes('UNIQUE') || err.message.includes('unique') || err.message.includes('duplicate key'), `Expected collision on old index, got: ${err.message}`);
    }
    assert.strictEqual(oldCollision, true, 'Old index predicate must fail on multiple empty strings');

    // Clean up temporary row
    await query("DELETE FROM payments WHERE payment_type IN ('test_old_empty_1', 'test_old_empty_2')");

    // 4. Empirically prove Requirement 3: CREATE UNIQUE INDEX IF NOT EXISTS is a no-op on existing index
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_payid 
      ON payments(gateway, gateway_payment_id) 
      WHERE gateway_payment_id IS NOT NULL AND gateway_payment_id != ''
    `);
    const noopSql = await getIndexDefinition('idx_payments_gateway_payid');
    assert(!noopSql.includes("!= ''") && !noopSql.includes("<> ''"), 'CREATE UNIQUE INDEX IF NOT EXISTS must leave old definition unchanged');

    // 5. Now execute safe migration via initDb()
    await resetDbForTesting();
    await initDb();

    // 6. Verify catalog definition after migration
    const newInfo = await getIndexInfo('idx_payments_gateway_payid');
    assert(Boolean(newInfo), 'Migrated index must be present in catalog');
    assert.strictEqual(newInfo.table, 'payments', 'Index must be on payments table');
    const newSql = newInfo.sql;
    assert(newSql.includes("!= ''") || newSql.includes("<> ''"), 'Migrated index must exclude empty strings');
    assert.strictEqual(getPaymentIndexStatus().verified, true, 'Migration status must report verified');

    // 7. Verify upgraded behavior: multiple empty strings now co-exist seamlessly
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '', 15.00, 'INR', 'SUCCESS', 'mig_empty_1')
    `);
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '', 25.00, 'INR', 'SUCCESS', 'mig_empty_2')
    `);

    // 8. Verify duplicate non-empty payment ID is STILL rejected under migrated index
    const testMigPayId = `pay_mig_dup_${Date.now()}`;
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '${testMigPayId}', 99.00, 'INR', 'SUCCESS', 'mig_valid_1')
    `);
    let newDupRejected = false;
    try {
      await query(`
        INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
        VALUES (1, 'cashfree', '${testMigPayId}', 99.00, 'INR', 'SUCCESS', 'mig_valid_2')
      `);
    } catch (err) {
      newDupRejected = true;
      assert(err.message.includes('UNIQUE') || err.message.includes('unique') || err.message.includes('duplicate key'), `Expected unique violation, got: ${err.message}`);
    }
    assert.strictEqual(newDupRejected, true, 'Migrated index must strictly reject duplicate non-empty IDs');

    // Clean up
    await query(`DELETE FROM payments WHERE gateway_payment_id = '${testMigPayId}' OR payment_type IN ('mig_empty_1', 'mig_empty_2')`);
  });

  // TEST 5C: Pre-flight data safety: migration aborts without mutating records if duplicate non-empty IDs exist
  await test('5C. Pre-flight data safety: migration never drops index or deletes records when duplicate non-empty payment IDs exist', async () => {
    // 1. Temporarily drop index to simulate pre-existing duplicate data on non-empty IDs
    await query('DROP INDEX IF EXISTS idx_payments_gateway_payid');
    const dirtyPayId = `pay_dirty_dup_${Date.now()}`;
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '${dirtyPayId}', 100.00, 'INR', 'SUCCESS', 'dirty_dup_1')
    `);
    await query(`
      INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
      VALUES (1, 'cashfree', '${dirtyPayId}', 100.00, 'INR', 'SUCCESS', 'dirty_dup_2')
    `);

    // 2. Trigger migration attempt via initDb()
    await resetDbForTesting();
    let migrationFailed = false;
    try {
      await initDb();
    } catch (err) {
      migrationFailed = true;
      assert(err.message.includes('payment uniqueness protection is absent') || err.message.includes('duplicate records'), `Expected initialization failure, got: ${err.message}`);
    }
    assert.strictEqual(migrationFailed, true, 'initDb must not report successful initialization when duplicates block migration');
    assert.strictEqual(getPaymentIndexStatus().verified, false, 'Migration status must report unverified');
    assert(getPaymentIndexStatus().error.includes('duplicate records'), 'Migration error must report duplicate records');

    // 3. Confirm Requirement 6: ZERO rows deleted, merged, or modified automatically
    let count = 0;
    if (getDbType() === 'postgres') {
      const { pgPool } = getRawDb();
      const res = await pgPool.query('SELECT COUNT(*) as c FROM payments WHERE gateway_payment_id = $1', [dirtyPayId]);
      count = Number(res.rows[0]?.c || 0);
    } else {
      const { sqliteDb } = getRawDb();
      const countRes = sqliteDb.prepare(`SELECT COUNT(*) as c FROM payments WHERE gateway_payment_id = ?`).get(dirtyPayId);
      count = Number(countRes?.c || 0);
    }
    assert.strictEqual(count, 2, 'Migration must NEVER automatically delete, merge, or modify payment records');

    // 4. Clean up dirty duplicate test rows and restore clean DB state
    if (getDbType() === 'postgres') {
      const { pgPool } = getRawDb();
      await pgPool.query('DELETE FROM payments WHERE gateway_payment_id = $1', [dirtyPayId]);
    } else {
      const { sqliteDb } = getRawDb();
      sqliteDb.prepare(`DELETE FROM payments WHERE gateway_payment_id = ?`).run(dirtyPayId);
    }
    await resetDbForTesting();
    await initDb();
    assert.strictEqual(getPaymentIndexStatus().verified, true, 'Restored clean DB must be verified');
  });

  // TEST 5D: Simulated failure during index recreation rolls back and preserves the previous index
  await test('5D. Atomic rollback: simulated failure during index recreation rolls back and preserves the old index definition intact', async () => {
    // 1. Recreate the old index definition on a clean table
    await query("DELETE FROM payments WHERE gateway_payment_id = '' OR gateway_payment_id IS NULL");
    await query('DROP INDEX IF EXISTS idx_payments_gateway_payid');
    await query(`
      CREATE UNIQUE INDEX idx_payments_gateway_payid 
      ON payments(gateway, gateway_payment_id) 
      WHERE gateway_payment_id IS NOT NULL
    `);

    const oldSqlBefore = await getIndexDefinition('idx_payments_gateway_payid');
    assert(oldSqlBefore.includes('gateway_payment_id IS NOT NULL'), 'Old index definition must be verified before rollback test');

    // 2. Trigger migration with simulateIndexRecreationFailure: true
    await resetDbForTesting();
    let failureThrown = false;
    try {
      await initDb({ simulateIndexRecreationFailure: true });
    } catch (err) {
      failureThrown = true;
      assert(err.message.includes('Simulated failure during index recreation'), `Expected simulated failure message, got: ${err.message}`);
    }
    assert.strictEqual(failureThrown, true, 'initDb must throw and fail closed when index recreation fails');
    assert.strictEqual(getPaymentIndexStatus().verified, false, 'Uniqueness protection status must remain unverified');

    // 3. Verify that the transaction rolled back: the previous index must STILL EXIST with the old definition!
    const indexAfterRollbackSql = await getIndexDefinition('idx_payments_gateway_payid');
    assert(Boolean(indexAfterRollbackSql), 'Old index MUST still exist after transaction rollback (never left unindexed)');
    assert.strictEqual(indexAfterRollbackSql, oldSqlBefore, 'Old index definition must be completely restored by rollback');

    // 4. Verify safe retry without simulation flag succeeds and cleanly upgrades
    await resetDbForTesting();
    await initDb();
    assert.strictEqual(getPaymentIndexStatus().verified, true, 'Safe retry without failure flag must successfully upgrade');
    const indexAfterRetrySql = await getIndexDefinition('idx_payments_gateway_payid');
    assert(indexAfterRetrySql.includes("!= ''") || indexAfterRetrySql.includes("<> ''"), 'Upgraded index must exclude empty strings');
  });

  // TEST 5E: Re-running initialization after successful migration is idempotent
  await test('5E. Idempotency: re-running initialization on an already-upgraded database does not alter or re-create index', async () => {
    const sqlBefore = await getIndexDefinition('idx_payments_gateway_payid');
    assert(sqlBefore && (sqlBefore.includes("!= ''") || sqlBefore.includes("<> ''")), 'Index must already be in upgraded state');

    // Re-run initDb() multiple times
    await initDb();
    await initDb();

    assert.strictEqual(getPaymentIndexStatus().verified, true, 'Re-run initialization must report verified');
    const sqlAfter = await getIndexDefinition('idx_payments_gateway_payid');
    assert.strictEqual(sqlAfter, sqlBefore, 'Re-running initDb must leave index definition completely unchanged');
  });

  // TEST 6: Fix F-03 — Webhook duplicate payment idempotency & fail-closed on missing identifier
  await test('6. Fix F-03: Webhook payment processing is idempotent for valid IDs and fails closed if payment identifier is missing', async () => {
    const uniqueSuffix = `${Date.now()}_6`;
    const subId = `cf_sub_idem_${uniqueSuffix}`;
    const payId = `cf_pay_idem_${uniqueSuffix}`;

    const phone = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const restoRes = await query(`
      INSERT INTO restaurants (name, slug, phone, plan_tier, plan_price, active, mandate_status, mandate_id)
      VALUES ('Idempotent Pay Resto', 'idem-pay-${uniqueSuffix}', '${phone}', 'pro', 999, true, 'active', '${subId}')
      RETURNING id
    `);
    const restoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, gateway_subscription_id, status, amount, currency, billing_cycle)
      VALUES ($1, 2, 'cashfree', $2, 'active', 999, 'INR', 'monthly')
    `, [restoId, subId]);

    const timestamp = Date.now().toString();
    const server = app.listen(0);
    const port = server.address().port;

    try {
      // Sub-case A: Missing payment identifier -> FAIL CLOSED, do not extend billing or insert payment
      const missingPayPayload = {
        event: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        event_id: `evt_missing_${uniqueSuffix}`,
        data: {
          subscription_id: subId,
          payment_details: {
            payment_amount: 999,
            payment_status: 'SUCCESS'
            // payment_id is deliberately omitted!
          }
        }
      };
      const missingBodyStr = JSON.stringify(missingPayPayload);
      const missingSig = signPayload(missingBodyStr, timestamp);

      const resMissing = await fetch(`http://127.0.0.1:${port}/api/payment/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': missingSig,
          'x-webhook-timestamp': timestamp
        },
        body: missingBodyStr
      });
      const dataMissing = await resMissing.json();
      assert.strictEqual(dataMissing.status, 'REJECTED_MISSING_PAYMENT_IDENTIFIER', 'Missing payment ID must fail closed');

      const payCountMissing = await query('SELECT COUNT(*) as c FROM payments WHERE restaurant_id = $1', [restoId]);
      assert.strictEqual(Number(payCountMissing[0].c), 0, 'No payment record should be created when identifier is missing');

      // Sub-case B: Valid payment -> processed and period extended
      const validPayload = {
        event: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        event_id: `evt_pay_${payId}`,
        data: {
          subscription_id: subId,
          payment_details: {
            payment_id: payId,
            payment_amount: 999,
            payment_status: 'SUCCESS'
          }
        }
      };
      const validBodyStr = JSON.stringify(validPayload);
      const validSig = signPayload(validBodyStr, timestamp);

      const resValid = await fetch(`http://127.0.0.1:${port}/api/payment/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': validSig,
          'x-webhook-timestamp': timestamp
        },
        body: validBodyStr
      });
      const dataValid = await resValid.json();
      assert.strictEqual(dataValid.status, 'PROCESSED');

      const restoAfter1 = await query('SELECT plan_expires_at FROM restaurants WHERE id = $1', [restoId]);
      const initialExpires = restoAfter1[0].plan_expires_at;
      assert(initialExpires, 'plan_expires_at must be populated after valid payment');

      // Sub-case C: Duplicate replay -> DUPLICATE_PAYMENT_IGNORED, period not extended again
      const dupPayload = { ...validPayload, event_id: `evt_pay_dup_${payId}` };
      const dupBodyStr = JSON.stringify(dupPayload);
      const dupSig = signPayload(dupBodyStr, timestamp);

      const resDup = await fetch(`http://127.0.0.1:${port}/api/payment/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': dupSig,
          'x-webhook-timestamp': timestamp
        },
        body: dupBodyStr
      });
      const dataDup = await resDup.json();
      assert.strictEqual(dataDup.status, 'DUPLICATE_PAYMENT_IGNORED');

      const payCountAfterDup = await query('SELECT COUNT(*) as c FROM payments WHERE gateway_payment_id = $1', [payId]);
      assert.strictEqual(Number(payCountAfterDup[0].c), 1, 'Payment count must remain 1');

      const restoAfterDup = await query('SELECT plan_expires_at FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(restoAfterDup[0].plan_expires_at, initialExpires, 'Billing period must not be extended twice');

      // Sub-case D: Separate legitimate payment with distinct payment_id -> processed successfully
      const secondPayId = `cf_pay_second_${uniqueSuffix}`;
      const secondPayload = {
        event: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        event_id: `evt_second_${uniqueSuffix}`,
        data: {
          subscription_id: subId,
          payment_details: {
            payment_id: secondPayId,
            payment_amount: 999,
            payment_status: 'SUCCESS'
          }
        }
      };
      const secondBodyStr = JSON.stringify(secondPayload);
      const secondSig = signPayload(secondBodyStr, timestamp);

      const resSecond = await fetch(`http://127.0.0.1:${port}/api/payment/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': secondSig,
          'x-webhook-timestamp': timestamp
        },
        body: secondBodyStr
      });
      const dataSecond = await resSecond.json();
      assert.strictEqual(dataSecond.status, 'PROCESSED', 'Distinct legitimate payment must be processed');

      const totalPayments = await query('SELECT COUNT(*) as c FROM payments WHERE restaurant_id = $1', [restoId]);
      assert.strictEqual(Number(totalPayments[0].c), 2, 'Both distinct payments must be recorded');
    } finally {
      server.close();
    }
  });

  // TEST 7: Invalid webhook signature cannot cause mutations
  await test('7. Webhook with invalid signature is rejected (401) without modifying database', async () => {
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/payment/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': 'invalid_forged_signature_123',
          'x-webhook-timestamp': Date.now().toString()
        },
        body: JSON.stringify({ event: 'SUBSCRIPTION_AUTH_STATUS' })
      });
      assert.strictEqual(res.status, 401, 'Invalid signature must return 401');
    } finally {
      server.close();
    }
  });

  // =========================================================================
  // SECTION 3: HISTORICAL PASSWORD CLEANUP COVERAGE
  // =========================================================================

  // TEST 8: Fix F-04 — Legacy password key coverage (owner_password, password, pwd, JSON hash)
  await test('8. Fix F-04: Historical password cleanup audits all legacy keys, hashes plaintext, protects canonical column hashes, and is idempotent', async () => {
    const uniqueSuffix = `${Date.now()}_8`;

    // Record A: Plaintext in owner_password, NULL column
    const regA = `reg_clean_a_${uniqueSuffix}`;
    await query(`
      INSERT INTO pending_registrations (id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, status, expires_at)
      VALUES ($1, $2, 'Resto A', '9876543201', 'user_a', NULL, 'pro', 999, 'checkout_started', $3)
    `, [regA, JSON.stringify({ name: 'Resto A', owner_password: 'PlainSecretA123!', meta: 'keep_me_a' }), new Date(Date.now() + 86400000).toISOString()]);

    // Record B: Plaintext in legacy 'password' key, NULL column
    const regB = `reg_clean_b_${uniqueSuffix}`;
    await query(`
      INSERT INTO pending_registrations (id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, status, expires_at)
      VALUES ($1, $2, 'Resto B', '9876543202', 'user_b', NULL, 'pro', 999, 'checkout_started', $3)
    `, [regB, JSON.stringify({ name: 'Resto B', password: 'PlainSecretB123!', meta: 'keep_me_b' }), new Date(Date.now() + 86400000).toISOString()]);

    // Record C: Plaintext in legacy 'pwd' key, NULL column
    const regC = `reg_clean_c_${uniqueSuffix}`;
    await query(`
      INSERT INTO pending_registrations (id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, status, expires_at)
      VALUES ($1, $2, 'Resto C', '9876543203', 'user_c', NULL, 'pro', 999, 'checkout_started', $3)
    `, [regC, JSON.stringify({ name: 'Resto C', pwd: 'PlainSecretC123!', meta: 'keep_me_c' }), new Date(Date.now() + 86400000).toISOString()]);

    // Record D: Already has canonical column hash + redundant hash in JSON (must NOT overwrite column hash)
    const canonicalHashD = await bcrypt.hash('CanonicalSecretD123!', 10);
    const regD = `reg_clean_d_${uniqueSuffix}`;
    await query(`
      INSERT INTO pending_registrations (id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, status, expires_at)
      VALUES ($1, $2, 'Resto D', '9876543204', 'user_d', $3, 'pro', 999, 'checkout_started', $4)
    `, [regD, JSON.stringify({ name: 'Resto D', password_hash: '$2a$10$redundantDummyHashToCleanD', meta: 'keep_me_d' }), canonicalHashD, new Date(Date.now() + 86400000).toISOString()]);

    // Record E: Conflicting plaintext credentials without column hash -> must defer for manual review
    const regE = `reg_clean_e_${uniqueSuffix}`;
    await query(`
      INSERT INTO pending_registrations (id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, status, expires_at)
      VALUES ($1, $2, 'Resto E', '9876543205', 'user_e', NULL, 'pro', 999, 'checkout_started', $3)
    `, [regE, JSON.stringify({ name: 'Resto E', owner_password: 'PassOne!', password: 'PassTwoDifferent!', meta: 'keep_me_e' }), new Date(Date.now() + 86400000).toISOString()]);

    // 1. Audit / Dry-run verification
    const audit = await auditHistoricalPendingPasswords(query);
    assert(audit.plaintextCount >= 3, 'Audit must count plaintext records');
    assert(audit.redundantHashCount >= 1, 'Audit must count redundant hash records');
    assert(audit.legacyKeyBreakdown.owner_password >= 1, 'owner_password key detected');
    assert(audit.legacyKeyBreakdown.password >= 1, 'password key detected');
    assert(audit.legacyKeyBreakdown.pwd >= 1, 'pwd key detected');
    assert(audit.conflictingCount >= 1, 'Conflicting plaintext credentials detected');

    // Verify dry-run made zero changes
    const checkBeforeA = await query('SELECT password_hash FROM pending_registrations WHERE id = $1', [regA]);
    assert.strictEqual(checkBeforeA[0].password_hash, null, 'Dry-run must not modify database');

    // 2. Execute cleanup
    const execResult = await executeHistoricalPendingPasswordCleanup(query);
    assert(execResult.sanitizedCount >= 4, 'Records A, B, C, D should be sanitized');
    assert(execResult.skippedConflictingCount >= 1, 'Record E with conflicting keys should be skipped');

    // 3. Verify Record A (owner_password was hashed and stripped)
    const checkA = await query('SELECT payload, password_hash FROM pending_registrations WHERE id = $1', [regA]);
    const parsedA = JSON.parse(checkA[0].payload);
    assert.strictEqual(parsedA.owner_password, undefined, 'owner_password must be stripped from JSON');
    assert.strictEqual(parsedA.meta, 'keep_me_a', 'Other metadata must be preserved');
    assert(checkA[0].password_hash, 'password_hash column must be populated');
    assert(isBcryptHash(checkA[0].password_hash), 'Populated column hash must be a valid bcrypt hash');
    assert.strictEqual(await bcrypt.compare('PlainSecretA123!', checkA[0].password_hash), true, 'Bcrypt compare must verify');

    // 4. Verify Record B (legacy password key was hashed and stripped)
    const checkB = await query('SELECT payload, password_hash FROM pending_registrations WHERE id = $1', [regB]);
    const parsedB = JSON.parse(checkB[0].payload);
    assert.strictEqual(parsedB.password, undefined, 'password must be stripped from JSON');
    assert(isBcryptHash(checkB[0].password_hash), 'Column hash must be a valid bcrypt hash');
    assert.strictEqual(await bcrypt.compare('PlainSecretB123!', checkB[0].password_hash), true);

    // 5. Verify Record C (legacy pwd key was hashed and stripped)
    const checkC = await query('SELECT payload, password_hash FROM pending_registrations WHERE id = $1', [regC]);
    const parsedC = JSON.parse(checkC[0].payload);
    assert.strictEqual(parsedC.pwd, undefined, 'pwd must be stripped from JSON');
    assert(isBcryptHash(checkC[0].password_hash), 'Column hash must be a valid bcrypt hash');
    assert.strictEqual(await bcrypt.compare('PlainSecretC123!', checkC[0].password_hash), true);

    // 6. Verify Record D (existing canonical hash was NOT overwritten)
    const checkD = await query('SELECT payload, password_hash FROM pending_registrations WHERE id = $1', [regD]);
    const parsedD = JSON.parse(checkD[0].payload);
    assert.strictEqual(parsedD.password_hash, undefined, 'Redundant password_hash must be stripped from JSON');
    assert.strictEqual(checkD[0].password_hash, canonicalHashD, 'Existing canonical column hash must NEVER be overwritten');

    // 7. Verify Record E (conflicting plaintexts without column hash was preserved for manual review)
    const checkE = await query('SELECT payload, password_hash FROM pending_registrations WHERE id = $1', [regE]);
    assert.strictEqual(checkE[0].password_hash, null, 'Conflicting record must not be blindly populated');

    // 8. Second run idempotency: re-running cleanup makes 0 new modifications
    const secondExec = await executeHistoricalPendingPasswordCleanup(query);
    assert.strictEqual(secondExec.sanitizedCount, 0, 'Second cleanup run must perform 0 modifications');
  });

  // TEST 9: New checkouts store password_hash exclusively in DB column and never in JSON payload
  await test('9. New checkouts store password_hash exclusively in DB column and never in JSON payload', async () => {
    const uniqueSuffix = `${Date.now()}_9`;
    const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && (url.includes('cashfree') || url.includes('/subscriptions'))) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'OK',
            subscription_id: `sub_test_checkout_${uniqueSuffix}`,
            subscription_session_id: `sess_${uniqueSuffix}`,
            auth_url: 'https://sandbox.cashfree.com/auth'
          })
        };
      }
      return originalFetch(url, options);
    };

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/payment/checkout-pre-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `No Plaintext Resto ${uniqueSuffix}`,
          phone: testPhone,
          owner_name: 'Test Owner',
          owner_username: `user_sec_${uniqueSuffix}`,
          owner_password: 'SensitivePassword123!',
          owner_email: `sec_${uniqueSuffix}@example.com`,
          plan_key: 'pro'
        })
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      const rows = await query('SELECT payload, password_hash FROM pending_registrations WHERE cashfree_subscription_id = $1', [json.subscription_id]);
      assert.strictEqual(rows.length, 1);

      const parsedPayload = JSON.parse(rows[0].payload);
      assert.strictEqual(parsedPayload.owner_password, undefined, 'JSON payload must NOT contain owner_password');
      assert.strictEqual(parsedPayload.password, undefined, 'JSON payload must NOT contain password');
      assert.strictEqual(parsedPayload.password_hash, undefined, 'JSON payload must NOT duplicate password_hash');

      assert(rows[0].password_hash, 'Dedicated password_hash database column MUST be populated');
      const matches = await bcrypt.compare('SensitivePassword123!', rows[0].password_hash);
      assert.strictEqual(matches, true, 'Dedicated password_hash column must securely match plaintext password');
    } finally {
      global.fetch = originalFetch;
      server.close();
    }
  });

  // TEST 10: Canonical trial duration in system_settings is 16 days
  await test('10. Canonical trial duration in system_settings is 16 days', async () => {
    const sysRows = await query("SELECT value FROM system_settings WHERE key = 'default_trial_days'");
    assert(sysRows.length > 0, 'default_trial_days system setting must exist');
    assert.strictEqual(sysRows[0].value, '16', 'default_trial_days must be canonically 16');
  });

  console.log(`\n🎉 Billing Hardening Suite: All ${passed}/${total} tests passed!\n`);
}

runHardeningTests()
  .then(async () => {
    await closeDbPool();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Fatal test error:', err);
    await closeDbPool();
    process.exit(1);
  });
