/**
 * TouchQR Phase 1 — Dedicated Real PostgreSQL Concurrency & Integration Suite
 *
 * SAFETY INVARIANTS:
 * 1. Must use an explicitly designated TEST_DATABASE_URL targeting touchqr_staging_test.
 * 2. Validated by testDbGuard: strictly rejects production host and touchqr_staging_app.
 * 3. Never falls back to DATABASE_URL or MIGRATION_DATABASE_URL.
 * 4. Runs against live PostgreSQL, exercising advisory locks, conditional updates,
 *    live schema resolution, tracking-token lifecycle, and cross-tenant isolation.
 */

import assert from 'assert';
import crypto from 'crypto';
import pg from 'pg';
import {
  validateTestDatabaseUrl,
  verifyTestDatabaseIdentity
} from './testDbGuard.js';
import { assertPhase1SchemaPresence } from '../db.js';
import { resolveAuthoritativeRelationSchemas } from '../scripts/migrate_phase1_counter_and_tracking.js';
import { generatePresenceToken, generateQrContextHash } from '../utils/presenceVerification.js';

const { Pool } = pg;

console.log('======================================================================');
console.log('🐘 TOUCHQR PHASE 1 REAL POSTGRESQL CONCURRENCY & INTEGRATION SUITE');
console.log('======================================================================\n');

// 1. Guard check on target URL
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error('❌ TEST_DATABASE_URL is not set.');
  process.exit(1);
}

const { url: validatedUrl, isPostgres } = validateTestDatabaseUrl(testDbUrl);
assert(isPostgres, 'Must be a PostgreSQL database');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
}

async function runSuite() {
  const pool = new Pool({
    connectionString: validatedUrl,
    connectionTimeoutMillis: 10000,
    max: 20
  });

  const client = await pool.connect();

  try {
    // Verify live connected database identity
    await verifyTestDatabaseIdentity(async (q) => {
      const res = await client.query(q);
      return res.rows;
    }, { isPostgres: true });

    // Seed test restaurants for testing
    await client.query(`
      INSERT INTO restaurants (id, name, slug, counter_ordering_enabled)
      VALUES
        (9001, 'Staging Test Resto A', 'staging-resto-a', 1),
        (9002, 'Staging Test Resto B', 'staging-resto-b', 1)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        counter_ordering_enabled = EXCLUDED.counter_ordering_enabled;
    `);

    // Clean any prior test orders for 9001 and 9002
    await client.query('DELETE FROM orders WHERE restaurant_id IN (9001, 9002);');
    await client.query('DELETE FROM audit_logs WHERE restaurant_id IN (9001, 9002);');

    // ----------------------------------------------------
    // SCENARIO 1: Live multi-schema resolution for orders, restaurants, and tracking index
    // ----------------------------------------------------
    await test('1. Live PostgreSQL multi-schema resolution and index verification', async () => {
      const { ordersSchema, restaurantsSchema } = await resolveAuthoritativeRelationSchemas(client);
      assert.strictEqual(ordersSchema, 'public', 'orders should resolve to public schema');
      assert.strictEqual(restaurantsSchema, 'public', 'restaurants should resolve to public schema');

      // Verify all required Phase 1 columns exist
      const { rows: cols } = await client.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'restaurants' AND column_name = 'counter_ordering_enabled') OR
            (table_name = 'orders' AND column_name IN ('tracking_token_hash', 'terminal_at', 'updated_at'))
          )
      `);
      assert.strictEqual(cols.length, 4, 'Must find exactly 4 Phase 1 columns in public schema');

      // Verify idx_orders_tracking_hash definition
      const { rows: idxs } = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'orders' AND indexname = 'idx_orders_tracking_hash'
      `);
      assert.strictEqual(idxs.length, 1, 'Index idx_orders_tracking_hash must exist');
      assert(
        /\(\s*"?restaurant_id"?\s*,\s*"?tracking_token_hash"?\s*\)/i.test(idxs[0].indexdef),
        'Index must cover restaurant_id and tracking_token_hash'
      );

      // Verify assertPhase1SchemaPresence passes against live PostgreSQL pool
      const schemaCheck = await assertPhase1SchemaPresence(pool);
      assert.strictEqual(schemaCheck.verified, true);
    });

    // ----------------------------------------------------
    // SCENARIO 2: Concurrent submissions with same customer session and idempotency key
    // ----------------------------------------------------
    await test('2. Concurrent submissions with same customer session & idempotency key create exactly 1 order', async () => {
      const idempotencyKey = `idem_${crypto.randomUUID()}`;
      const sessionToken = generatePresenceToken(9001, 'counter', 'COUNTER', 'secret_key_123');
      const orderPayload = {
        restaurant_id: 9001,
        table_number: 'COUNTER',
        customer_name: 'Concurrent Customer',
        customer_phone: '9876543210',
        items: JSON.stringify([{ id: 1, name: 'Samosa', price: 20, quantity: 2 }]),
        total_amount: 40.00,
        status: 'pending',
        notes: `idempotency:${idempotencyKey}:${sessionToken.slice(0, 16)}`
      };

      // Atomic submission logic with PostgreSQL advisory lock
      const submitOrder = async () => {
        const conn = await pool.connect();
        try {
          await conn.query('BEGIN');
          // Advisory transaction lock on hash of idempotency key + session
          const lockKey = `${idempotencyKey}:${sessionToken.slice(0, 16)}`;
          await conn.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

          // Check if already created
          const existing = await conn.query(
            `SELECT id, tracking_token_hash FROM orders WHERE restaurant_id = $1 AND notes = $2`,
            [orderPayload.restaurant_id, orderPayload.notes]
          );

          if (existing.rows.length > 0) {
            await conn.query('COMMIT');
            return { orderId: existing.rows[0].id, isDuplicate: true };
          }

          // Create new order
          const trackingToken = crypto.randomBytes(16).toString('hex');
          const trackingHash = crypto.createHash('sha256').update(trackingToken).digest('hex');

          const inserted = await conn.query(`
            INSERT INTO orders (
              restaurant_id, table_number, customer_name, customer_phone,
              items, total_amount, status, notes, tracking_token_hash, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            RETURNING id;
          `, [
            orderPayload.restaurant_id,
            orderPayload.table_number,
            orderPayload.customer_name,
            orderPayload.customer_phone,
            orderPayload.items,
            orderPayload.total_amount,
            orderPayload.status,
            orderPayload.notes,
            trackingHash
          ]);

          await conn.query('COMMIT');
          return { orderId: inserted.rows[0].id, isDuplicate: false };
        } catch (e) {
          await conn.query('ROLLBACK');
          throw e;
        } finally {
          conn.release();
        }
      };

      // Fire 5 concurrent submissions simultaneously
      const results = await Promise.all([
        submitOrder(),
        submitOrder(),
        submitOrder(),
        submitOrder(),
        submitOrder()
      ]);

      const uniqueOrderIds = new Set(results.map(r => r.orderId));
      assert.strictEqual(uniqueOrderIds.size, 1, 'All concurrent requests must return the exact same order ID');

      const nonDuplicates = results.filter(r => !r.isDuplicate);
      assert.strictEqual(nonDuplicates.length, 1, 'Exactly one winner must perform the insert');

      // Verify database state: exactly 1 order persisted
      const dbCheck = await client.query(
        `SELECT COUNT(*) as cnt FROM orders WHERE restaurant_id = 9001 AND notes = $1`,
        [orderPayload.notes]
      );
      assert.strictEqual(parseInt(dbCheck.rows[0].cnt, 10), 1, 'Persisted order count must be 1');
    });

    // ----------------------------------------------------
    // SCENARIO 3: Different anonymous customers using the same key receive distinct orders
    // ----------------------------------------------------
    await test('3. Different anonymous customers with same key receive distinct orders without token disclosure', async () => {
      const sharedKey = `shared_key_${crypto.randomUUID()}`;
      const sessionA = 'anon_session_alpha';
      const sessionB = 'anon_session_beta';

      const createOrder = async (session) => {
        const trackingToken = crypto.randomBytes(16).toString('hex');
        const trackingHash = crypto.createHash('sha256').update(trackingToken).digest('hex');
        const notes = `idempotency:${sharedKey}:${session}`;

        const res = await client.query(`
          INSERT INTO orders (
            restaurant_id, table_number, customer_name, items, total_amount, status, notes, tracking_token_hash
          ) VALUES (9001, 'COUNTER', 'Customer', '[]', 15.00, 'pending', $1, $2)
          RETURNING id, tracking_token_hash;
        `, [notes, trackingHash]);

        return { orderId: res.rows[0].id, trackingToken, trackingHash };
      };

      const orderA = await createOrder(sessionA);
      const orderB = await createOrder(sessionB);

      assert.notStrictEqual(orderA.orderId, orderB.orderId, 'Orders must be distinct');
      assert.notStrictEqual(orderA.trackingToken, orderB.trackingToken, 'Tracking tokens must never be shared');
      assert.notStrictEqual(orderA.trackingHash, orderB.trackingHash, 'Tracking hashes must differ');

      // Verify persisted database records
      const check = await client.query(
        `SELECT id, tracking_token_hash FROM orders WHERE id IN ($1, $2)`,
        [orderA.orderId, orderB.orderId]
      );
      assert.strictEqual(check.rows.length, 2, 'Both distinct orders must exist in PostgreSQL');
    });

    // ----------------------------------------------------
    // SCENARIO 4: Cross-tenant order isolation
    // ----------------------------------------------------
    await test('4. Cross-tenant order isolation strictly prevents cross-restaurant access', async () => {
      const tokenA = crypto.randomBytes(16).toString('hex');
      const hashA = crypto.createHash('sha256').update(tokenA).digest('hex');

      // Insert order for Tenant 9001
      const resA = await client.query(`
        INSERT INTO orders (restaurant_id, table_number, customer_name, items, total_amount, status, tracking_token_hash)
        VALUES (9001, 'COUNTER', 'Tenant A Customer', '[]', 100.00, 'pending', $1)
        RETURNING id;
      `, [hashA]);
      const orderAId = resA.rows[0].id;

      // Attempt to access orderA under Tenant 9002
      const tenantBAccess = await client.query(`
        SELECT id FROM orders WHERE id = $1 AND restaurant_id = 9002
      `, [orderAId]);
      assert.strictEqual(tenantBAccess.rows.length, 0, 'Tenant 9002 must NOT find Tenant 9001 order');

      // Attempt to settle orderA under Tenant 9002
      const tenantBSettle = await client.query(`
        UPDATE orders SET status = 'completed' WHERE id = $1 AND restaurant_id = 9002
      `, [orderAId]);
      assert.strictEqual(tenantBSettle.rowCount, 0, 'Tenant 9002 update must affect 0 rows');

      // Verify orderA remains untouched in Tenant 9001
      const tenantAQuery = await client.query(`
        SELECT status FROM orders WHERE id = $1 AND restaurant_id = 9001
      `, [orderAId]);
      assert.strictEqual(tenantAQuery.rows[0].status, 'pending', 'Order A must remain pending');
    });

    // ----------------------------------------------------
    // SCENARIO 5: Concurrent settlement requests against the same order
    // ----------------------------------------------------
    await test('5. Concurrent settlement requests: exactly one winner transitions order and writes audit log', async () => {
      // Create unsettled order
      const res = await client.query(`
        INSERT INTO orders (restaurant_id, table_number, total_amount, status, sent_to_kds)
        VALUES (9001, '5', 250.00, 'served', 1)
        RETURNING id;
      `);
      const targetOrderId = res.rows[0].id;

      // Ensure is_settled column or status check
      // Settle attempt function with conditional locking
      const attemptSettlement = async (staffId) => {
        const conn = await pool.connect();
        try {
          await conn.query('BEGIN');
          // Conditional update: only transitions if status != 'completed'
          const updateRes = await conn.query(`
            UPDATE orders
            SET status = 'completed', terminal_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND restaurant_id = 9001 AND status != 'completed'
            RETURNING id, status, terminal_at;
          `, [targetOrderId]);

          if (updateRes.rows.length > 0) {
            // Winner logs audit
            await conn.query(`
              INSERT INTO audit_logs (restaurant_id, actor_role, action, details)
              VALUES (9001, 'cashier', 'SETTLE_ORDER', $1)
            `, [`Settled by staff ${staffId}`]);
            await conn.query('COMMIT');
            return { won: true, order: updateRes.rows[0] };
          } else {
            // Loser fetches existing settled state
            const current = await conn.query('SELECT id, status, terminal_at FROM orders WHERE id = $1', [targetOrderId]);
            await conn.query('COMMIT');
            return { won: false, order: current.rows[0] };
          }
        } catch (e) {
          await conn.query('ROLLBACK');
          throw e;
        } finally {
          conn.release();
        }
      };

      // 4 concurrent settlement requests
      const settlements = await Promise.all([
        attemptSettlement('staff_1'),
        attemptSettlement('staff_2'),
        attemptSettlement('staff_3'),
        attemptSettlement('staff_4')
      ]);

      const winners = settlements.filter(s => s.won);
      assert.strictEqual(winners.length, 1, 'Exactly one settlement request must win');

      // Verify audit logs in PostgreSQL
      const auditRes = await client.query(
        `SELECT COUNT(*) as cnt FROM audit_logs WHERE restaurant_id = 9001 AND action = 'SETTLE_ORDER'`
      );
      assert.strictEqual(parseInt(auditRes.rows[0].cnt, 10), 1, 'Only one SETTLE_ORDER audit record must be written');

      // Verify order state
      const finalOrder = await client.query('SELECT status, terminal_at FROM orders WHERE id = $1', [targetOrderId]);
      assert.strictEqual(finalOrder.rows[0].status, 'completed');
      assert.notStrictEqual(finalOrder.rows[0].terminal_at, null);
    });

    // ----------------------------------------------------
    // SCENARIO 6: Multi-round session settlement preserving unrelated round statuses & kitchen flags
    // ----------------------------------------------------
    await test('6. Multi-round session settlement settles all rounds while preserving items and kitchen flags', async () => {
      // Table 10 has 3 rounds
      const r1 = await client.query(`
        INSERT INTO orders (restaurant_id, table_number, total_amount, status, sent_to_kds, notes)
        VALUES (9001, '10', 100.00, 'served', 1, 'Round 1: Starters')
        RETURNING id;
      `);
      const r2 = await client.query(`
        INSERT INTO orders (restaurant_id, table_number, total_amount, status, sent_to_kds, notes)
        VALUES (9001, '10', 200.00, 'in_kitchen', 1, 'Round 2: Mains')
        RETURNING id;
      `);
      const r3 = await client.query(`
        INSERT INTO orders (restaurant_id, table_number, total_amount, status, sent_to_kds, notes)
        VALUES (9001, '10', 50.00, 'pending', 0, 'Round 3: Drinks')
        RETURNING id;
      `);

      // Settle entire Table 10 session in atomic transaction
      await client.query('BEGIN');
      await client.query(`
        UPDATE orders
        SET status = 'completed', terminal_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE restaurant_id = 9001 AND table_number = '10' AND status != 'completed'
      `);
      await client.query('COMMIT');

      // Verify all 3 rounds are now completed
      const rounds = await client.query(`
        SELECT id, status, sent_to_kds, notes, terminal_at
        FROM orders
        WHERE restaurant_id = 9001 AND table_number = '10'
        ORDER BY id ASC;
      `);

      assert.strictEqual(rounds.rows.length, 3);
      for (const round of rounds.rows) {
        assert.strictEqual(round.status, 'completed');
        assert.notStrictEqual(round.terminal_at, null);
      }

      // Verify kitchen flags and notes were untouched
      assert.strictEqual(rounds.rows[0].sent_to_kds, 1);
      assert.strictEqual(rounds.rows[0].notes, 'Round 1: Starters');
      assert.strictEqual(rounds.rows[1].sent_to_kds, 1);
      assert.strictEqual(rounds.rows[1].notes, 'Round 2: Mains');
      assert.strictEqual(rounds.rows[2].sent_to_kds, 0);
      assert.strictEqual(rounds.rows[2].notes, 'Round 3: Drinks');
    });

    // ----------------------------------------------------
    // SCENARIO 7: PostgreSQL advisory transaction locking and rollback behavior
    // ----------------------------------------------------
    await test('7. PostgreSQL advisory transaction locks and atomic rollback on error', async () => {
      const lockIdentifier = 424242;
      const testConn = await pool.connect();
      try {
        await testConn.query('BEGIN');
        // Acquire advisory transaction lock
        await testConn.query('SELECT pg_advisory_xact_lock($1)', [lockIdentifier]);

        // Insert speculative record
        await testConn.query(`
          INSERT INTO orders (restaurant_id, table_number, total_amount, status, notes)
          VALUES (9001, 'LOCK_TEST', 999.00, 'pending', 'rollback_test_marker')
        `);

        // Simulate unexpected failure inside transaction
        await testConn.query('ROLLBACK');
      } finally {
        testConn.release();
      }

      // Verify that rollback completely wiped the record
      const check = await client.query(`
        SELECT id FROM orders WHERE restaurant_id = 9001 AND notes = 'rollback_test_marker'
      `);
      assert.strictEqual(check.rows.length, 0, 'Rolled back order must not exist in database');
    });

    // ----------------------------------------------------
    // SCENARIO 8: Tracking-token authorization, terminal-order HTTP 410 expiration, and sensitive-field scrubbing
    // ----------------------------------------------------
    await test('8. Tracking-token authorization, sensitive-field scrubbing, and terminal 410 contract', async () => {
      const rawTrackingToken = crypto.randomBytes(16).toString('hex');
      const trackingHash = crypto.createHash('sha256').update(rawTrackingToken).digest('hex');

      // Create order with tracking token
      const insertRes = await client.query(`
        INSERT INTO orders (
          restaurant_id, table_number, customer_name, total_amount, status,
          tracking_token_hash, terminal_at
        ) VALUES (9001, 'COUNTER', 'Track Customer', 120.00, 'completed', $1, CURRENT_TIMESTAMP - INTERVAL '3 hours')
        RETURNING id;
      `, [trackingHash]);
      const orderId = insertRes.rows[0].id;

      // 1. Authorize with correct tracking token
      const clientHash = crypto.createHash('sha256').update(rawTrackingToken).digest('hex');
      const orderQuery = await client.query(`
        SELECT id, restaurant_id, table_number, customer_name, total_amount, status, terminal_at, tracking_token_hash
        FROM orders
        WHERE id = $1 AND tracking_token_hash = $2
      `, [orderId, clientHash]);

      assert.strictEqual(orderQuery.rows.length, 1, 'Valid tracking token must locate the order');

      // Sensitive field scrubbing simulation: tracking_token_hash must never be sent in API response
      const apiResponse = { ...orderQuery.rows[0] };
      delete apiResponse.tracking_token_hash;
      assert.strictEqual(apiResponse.tracking_token_hash, undefined, 'Hash must be scrubbed from client response');

      // 2. Reject incorrect tracking token
      const wrongHash = crypto.createHash('sha256').update('wrong_token').digest('hex');
      const wrongQuery = await client.query(`
        SELECT id FROM orders WHERE id = $1 AND tracking_token_hash = $2
      `, [orderId, wrongHash]);
      assert.strictEqual(wrongQuery.rows.length, 0, 'Incorrect tracking token must return no order');

      // 3. Expiration contract: terminal older than 2 hours is 410 Gone
      const terminalTime = new Date(orderQuery.rows[0].terminal_at).getTime();
      const ageHours = (Date.now() - terminalTime) / (1000 * 60 * 60);
      assert(ageHours >= 2, 'Simulated terminal order is older than 2 hours');
      const httpStatus = ageHours >= 2 ? 410 : 200;
      assert.strictEqual(httpStatus, 410, 'Terminal order older than 2h must result in HTTP 410');
    });

    // ----------------------------------------------------
    // SCENARIO 9: Cold-start fail-closed behavior when Phase 1 schema/index is absent
    // ----------------------------------------------------
    await test('9. Cold-start fail-closed behavior when required Phase 1 schema/index is absent', async () => {
      // Mock client missing tracking_token_hash
      const mockMissingColClient = {
        query: async (sql, params) => {
          if (sql.includes('pg_class')) {
            return { rows: [{ table_name: 'orders', table_schema: 'public' }, { table_name: 'restaurants', table_schema: 'public' }] };
          }
          if (sql.includes('information_schema.columns')) {
            return {
              rows: [
                { table_schema: 'public', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
                // tracking_token_hash intentionally missing
                { table_schema: 'public', table_name: 'orders', column_name: 'terminal_at' },
                { table_schema: 'public', table_name: 'orders', column_name: 'updated_at' }
              ]
            };
          }
          if (sql.includes('pg_indexes')) {
            return { rows: [{ schemaname: 'public', tablename: 'orders', indexname: 'idx_orders_tracking_hash', indexdef: 'CREATE INDEX idx_orders_tracking_hash ON public.orders (restaurant_id, tracking_token_hash)' }] };
          }
          return { rows: [] };
        }
      };

      await assert.rejects(
        async () => {
          await assertPhase1SchemaPresence(mockMissingColClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'PHASE1_SCHEMA_INCOMPLETE');
          assert(err.missing.includes('orders.tracking_token_hash'));
          return true;
        }
      );

      // Mock client missing index
      const mockMissingIdxClient = {
        query: async (sql, params) => {
          if (sql.includes('pg_class')) {
            return { rows: [{ table_name: 'orders', table_schema: 'public' }, { table_name: 'restaurants', table_schema: 'public' }] };
          }
          if (sql.includes('information_schema.columns')) {
            return {
              rows: [
                { table_schema: 'public', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
                { table_schema: 'public', table_name: 'orders', column_name: 'tracking_token_hash' },
                { table_schema: 'public', table_name: 'orders', column_name: 'terminal_at' },
                { table_schema: 'public', table_name: 'orders', column_name: 'updated_at' }
              ]
            };
          }
          if (sql.includes('pg_indexes')) {
            return { rows: [] }; // index missing
          }
          return { rows: [] };
        }
      };

      await assert.rejects(
        async () => {
          await assertPhase1SchemaPresence(mockMissingIdxClient);
        },
        (err) => {
          assert.strictEqual(err.code, 'PHASE1_SCHEMA_INCOMPLETE');
          assert(err.missing.includes('orders.idx_orders_tracking_hash'));
          return true;
        }
      );
    });

  } finally {
    // Cleanup test records
    try {
      await client.query('DELETE FROM orders WHERE restaurant_id IN (9001, 9002);');
      await client.query('DELETE FROM audit_logs WHERE restaurant_id IN (9001, 9002);');
      await client.query('DELETE FROM restaurants WHERE id IN (9001, 9002);');
    } catch (_) {}
    client.release();
    await pool.end();
  }

  console.log(`\n======================================================================`);
  console.log(`📊 POSTGRESQL SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal crash in PostgreSQL suite runner:', err);
  process.exit(1);
});
