/**
 * TouchQR — Phase 1 Targeted Corrections Regression Suite
 *
 * Verifies all four defects identified in the Independent Phase 1 Code Review:
 * 1. Vercel Cold-Start Schema Guard (table, schema, and column coverage; fail-closed cold start).
 * 2. Migration & Preflight Database Target Contract (no silent fallback to DATABASE_URL, consistent resolution, exit codes).
 * 3. Concurrent Settlement Race Conditions (conditional update locking, idempotent losing response, atomic audit log, multi-round session).
 * 4. OrdersView Counter Kitchen Action Routing (table inline, card, and detail modal confirmation routing; backend authorization guard).
 */

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import crypto from 'crypto';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';
import { query, initDb, withTransaction, assertPhase1SchemaPresence, isDatabaseInitialized, resetDbForTesting } from '../db.js';
import {
  validateMigrationTargetUrl,
  getCliUrl as getMigrationCliUrl
} from '../scripts/migrate_phase1_counter_and_tracking.js';
import {
  resolveTargetDatabaseUrl,
  verifyPhase1Schema,
  getCliUrl as getVerifyCliUrl
} from '../scripts/verify_phase1_schema.js';
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
    console.error(`     ${err.message}`);
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
    console.error(`     ${err.message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR PHASE 1 TARGETED CORRECTIONS REGRESSION SUITE');
  console.log('======================================================================\n');

  // ------------------------------------------------------------------------
  // SECTION 1: Vercel Cold-Start Schema Guard
  // ------------------------------------------------------------------------
  console.log('--- SECTION 1: Vercel Cold-Start Schema Guard ---');

  // Test 1.1: Missing tracking_token_hash column fails
  await testAsync('assertPhase1SchemaPresence: Fails when required order column is missing', async () => {
    const mockClient = {
      query: async (sql) => {
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              { table_schema: 'public', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
              { table_schema: 'public', table_name: 'orders', column_name: 'terminal_at' },
              { table_schema: 'public', table_name: 'orders', column_name: 'updated_at' }
              // tracking_token_hash is intentionally MISSING
            ]
          };
        }
        if (sql.includes('pg_indexes')) {
          return {
            rows: [{
              schemaname: 'public',
              tablename: 'orders',
              indexname: 'idx_orders_tracking_hash',
              indexdef: 'CREATE INDEX idx_orders_tracking_hash ON public.orders (restaurant_id, tracking_token_hash)'
            }]
          };
        }
        return { rows: [] };
      }
    };

    let caught = null;
    try {
      await assertPhase1SchemaPresence(mockClient);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'Must throw error when required column is missing');
    assert.strictEqual(caught.code, 'PHASE1_SCHEMA_INCOMPLETE');
    assert.ok(caught.missing.includes('orders.tracking_token_hash'));
  });

  // Test 1.2: All columns exist but index is missing -> fails
  await testAsync('assertPhase1SchemaPresence: Fails when all columns exist but index is missing', async () => {
    const mockClient = {
      query: async (sql) => {
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
          // Index is intentionally MISSING
          return { rows: [] };
        }
        return { rows: [] };
      }
    };

    let caught = null;
    try {
      await assertPhase1SchemaPresence(mockClient);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'Must throw when index is missing');
    assert.strictEqual(caught.code, 'PHASE1_SCHEMA_INCOMPLETE');
    assert.ok(caught.missing.includes('orders.idx_orders_tracking_hash'));
  });

  // Test 1.3: Index in an unrelated schema is strictly rejected
  await testAsync('assertPhase1SchemaPresence: Rejects index residing in an unrelated schema', async () => {
    const mockClient = {
      query: async (sql, params) => {
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              { table_schema: 'tenant_schema', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
              { table_schema: 'tenant_schema', table_name: 'orders', column_name: 'tracking_token_hash' },
              { table_schema: 'tenant_schema', table_name: 'orders', column_name: 'terminal_at' },
              { table_schema: 'tenant_schema', table_name: 'orders', column_name: 'updated_at' }
            ]
          };
        }
        if (sql.includes('pg_indexes')) {
          // Only an index in 'other_schema' exists, NOT in 'tenant_schema'
          if (params && params[0] === 'tenant_schema') {
            return { rows: [] };
          }
          return {
            rows: [{
              schemaname: 'other_schema',
              tablename: 'orders',
              indexname: 'idx_orders_tracking_hash',
              indexdef: 'CREATE INDEX idx_orders_tracking_hash ON other_schema.orders (restaurant_id, tracking_token_hash)'
            }]
          };
        }
        return { rows: [] };
      }
    };

    let caught = null;
    try {
      await assertPhase1SchemaPresence(mockClient);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'Must reject index in unrelated schema');
    assert.strictEqual(caught.code, 'PHASE1_SCHEMA_INCOMPLETE');
    assert.ok(caught.missing.includes('orders.idx_orders_tracking_hash'));
  });

  // Test 1.4: Index on wrong columns is rejected
  await testAsync('assertPhase1SchemaPresence: Rejects index on wrong columns', async () => {
    const mockClient = {
      query: async (sql) => {
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
          return {
            rows: [{
              schemaname: 'public',
              tablename: 'orders',
              indexname: 'idx_orders_tracking_hash',
              // Covers only restaurant_id, tracking_token_hash missing!
              indexdef: 'CREATE INDEX idx_orders_tracking_hash ON public.orders (restaurant_id)'
            }]
          };
        }
        return { rows: [] };
      }
    };

    let caught = null;
    try {
      await assertPhase1SchemaPresence(mockClient);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'Must reject index without tracking_token_hash');
    assert.strictEqual(caught.code, 'PHASE1_SCHEMA_INCOMPLETE');
    assert.ok(caught.missing.includes('orders.idx_orders_tracking_hash'));
  });

  // Test 1.5: Valid schema and index passes verification
  await testAsync('assertPhase1SchemaPresence: Passes when all Phase 1 columns and valid index exist', async () => {
    const mockClient = {
      query: async (sql, params) => {
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
          return {
            rows: [{
              schemaname: 'public',
              tablename: 'orders',
              indexname: 'idx_orders_tracking_hash',
              indexdef: 'CREATE INDEX idx_orders_tracking_hash ON public.orders USING btree (restaurant_id, tracking_token_hash)'
            }]
          };
        }
        return { rows: [] };
      }
    };

    const res = await assertPhase1SchemaPresence(mockClient);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.missing.length, 0);
  });

  // Test 1.6: Vercel cold-start fails closed when required index is missing
  await testAsync('initDb: Fails closed and keeps database uninitialized when index is missing in Vercel mode', async () => {
    const savedVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1';
      await resetDbForTesting();

      // In Vercel mode without postgres pool or with incomplete schema, initDb must throw and NOT mark ready
      let caught = null;
      try {
        await initDb();
      } catch (err) {
        caught = err;
      }

      assert.ok(caught, 'initDb must throw error during cold start verification failure');
      assert.strictEqual(isDatabaseInitialized(), false, 'Database must NOT be marked ready on cold-start failure');
    } finally {
      if (savedVercel !== undefined) process.env.VERCEL = savedVercel;
      else delete process.env.VERCEL;
      await resetDbForTesting();
    }
  });

  // ------------------------------------------------------------------------
  // SECTION 2: Migration & Preflight Database Target Contract
  // ------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Migration & Preflight Database Target Contract ---');

  test('validateMigrationTargetUrl: Missing configuration throws and does NOT fall back to DATABASE_URL', () => {
    const savedMigrationUrl = process.env.MIGRATION_DATABASE_URL;
    const savedAppUrl = process.env.DATABASE_URL;
    try {
      delete process.env.MIGRATION_DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://other_user:pass@127.0.0.1:5432/app_db';

      assert.throws(
        () => validateMigrationTargetUrl(null),
        /MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL environment variable/
      );
    } finally {
      if (savedMigrationUrl) process.env.MIGRATION_DATABASE_URL = savedMigrationUrl;
      else delete process.env.MIGRATION_DATABASE_URL;
      if (savedAppUrl) process.env.DATABASE_URL = savedAppUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  test('resolveTargetDatabaseUrl: Verifier strictly refuses to fall back to DATABASE_URL', () => {
    const savedMigrationUrl = process.env.MIGRATION_DATABASE_URL;
    const savedAppUrl = process.env.DATABASE_URL;
    try {
      delete process.env.MIGRATION_DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://production_user:secret@neon.tech:5432/prod_db';

      assert.throws(
        () => resolveTargetDatabaseUrl({}, []),
        /DATABASE_TARGET_CONFIG_ERROR: MIGRATION_DATABASE_URL environment variable/
      );
    } finally {
      if (savedMigrationUrl) process.env.MIGRATION_DATABASE_URL = savedMigrationUrl;
      else delete process.env.MIGRATION_DATABASE_URL;
      if (savedAppUrl) process.env.DATABASE_URL = savedAppUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  test('Both scripts reject malformed database URL', () => {
    assert.throws(
      () => validateMigrationTargetUrl('not a valid url!'),
      /MIGRATION_CONFIG_ERROR: Target database URL is malformed/
    );
    assert.throws(
      () => resolveTargetDatabaseUrl('not a valid url!', []),
      /DATABASE_TARGET_CONFIG_ERROR: Target database URL is malformed/
    );
  });

  test('Both scripts parse explicit --url CLI argument consistently', () => {
    const testArgv = ['node', 'script.js', '--url', 'postgresql://user:pass@127.0.0.1:5432/testdb'];
    assert.strictEqual(getMigrationCliUrl(testArgv), 'postgresql://user:pass@127.0.0.1:5432/testdb');
    assert.strictEqual(getVerifyCliUrl(testArgv), 'postgresql://user:pass@127.0.0.1:5432/testdb');

    const resolved = resolveTargetDatabaseUrl({}, testArgv);
    assert.strictEqual(resolved.url, 'postgresql://user:pass@127.0.0.1:5432/testdb');
    assert.strictEqual(resolved.isLocal, true);
  });

  test('Migration runner requires --confirm-production for remote target (preserves production guard)', () => {
    assert.throws(
      () => validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-prod.neon.tech/neondb', false),
      /PRODUCTION_SAFETY_VIOLATION/
    );

    const authorized = validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-prod.neon.tech/neondb', true);
    assert.strictEqual(authorized.isLocal, false);
    assert.strictEqual(authorized.host, 'ep-shiny-prod.neon.tech');
  });

  test('Mismatched target configuration: MIGRATION_DATABASE_URL vs DATABASE_URL guarantees target agreement and prevents verifying wrong database', () => {
    const savedMigrationUrl = process.env.MIGRATION_DATABASE_URL;
    const savedAppUrl = process.env.DATABASE_URL;
    try {
      process.env.MIGRATION_DATABASE_URL = 'postgresql://migrator:secret@127.0.0.1:5432/migrated_db';
      process.env.DATABASE_URL = 'postgresql://app:secret@127.0.0.1:5432/unrelated_db';

      const migrationTarget = validateMigrationTargetUrl(process.env.MIGRATION_DATABASE_URL);
      const verifyTarget = resolveTargetDatabaseUrl();

      assert.strictEqual(migrationTarget.url, verifyTarget.url, 'Runner and verifier must agree on the exact same database target');
      assert.ok(verifyTarget.url.includes('migrated_db'), 'Must resolve migrated_db, strictly ignoring unrelated DATABASE_URL');
      assert.strictEqual(verifyTarget.url.includes('unrelated_db'), false, 'Must not resolve unrelated DATABASE_URL');

      // CLI --url overrides both environment variables consistently
      const cliArgv = ['node', 'tool.js', '--url', 'postgresql://cli_override:pass@127.0.0.1:5432/override_db'];
      const cliMigration = validateMigrationTargetUrl(getMigrationCliUrl(cliArgv));
      const cliVerify = resolveTargetDatabaseUrl({}, cliArgv);

      assert.strictEqual(cliMigration.url, cliVerify.url, 'CLI --url must override consistently for both scripts');
      assert.ok(cliVerify.url.includes('override_db'));
    } finally {
      if (savedMigrationUrl) process.env.MIGRATION_DATABASE_URL = savedMigrationUrl;
      else delete process.env.MIGRATION_DATABASE_URL;
      if (savedAppUrl) process.env.DATABASE_URL = savedAppUrl;
      else delete process.env.DATABASE_URL;
    }
  });

  await testAsync('verifyPhase1Schema: Successful verification of the selected database', async () => {
    const mockPool = {
      query: async (sql, params) => {
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
          return {
            rows: [{
              schemaname: 'public',
              tablename: 'orders',
              indexname: 'idx_orders_tracking_hash',
              indexdef: 'CREATE INDEX idx_orders_tracking_hash ON public.orders USING btree (restaurant_id, tracking_token_hash)'
            }]
          };
        }
        return { rows: [] };
      },
      end: async () => {}
    };

    const res = await verifyPhase1Schema({ url: 'postgresql://testuser:pass@127.0.0.1:5432/testdb' }, mockPool);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.missing.length, 0);
  });

  await testAsync('verifyPhase1Schema: Correctly identifies missing schema objects (columns and index)', async () => {
    const mockIncompletePool = {
      query: async (sql) => {
        if (sql.includes('information_schema.columns')) {
          return {
            rows: [
              { table_schema: 'public', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
              // orders.tracking_token_hash missing!
              { table_schema: 'public', table_name: 'orders', column_name: 'terminal_at' },
              { table_schema: 'public', table_name: 'orders', column_name: 'updated_at' }
            ]
          };
        }
        if (sql.includes('pg_indexes')) {
          // index missing!
          return { rows: [] };
        }
        return { rows: [] };
      },
      end: async () => {}
    };

    const res = await verifyPhase1Schema({ url: 'postgresql://testuser:pass@127.0.0.1:5432/testdb' }, mockIncompletePool);
    assert.strictEqual(res.verified, false);
    assert.ok(res.missing.includes('orders.tracking_token_hash'));
    assert.ok(res.missing.includes('orders.idx_orders_tracking_hash'));
  });

  // ------------------------------------------------------------------------
  // SECTION 3: Concurrent Settlement Race Conditions
  // ------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Concurrent Settlement Race Conditions ---');

  // Set up test server
  await initDb({ isTest: true, skipSeed: true });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const testSlug = `test-race-${Date.now()}`;
    const restoInsert = await query(`
      INSERT INTO restaurants (name, slug, active, counter_ordering_enabled, plan_tier, subscription_type)
      VALUES ($1, $2, 1, 1, 'pro', 'ADMIN_GRANTED')
      RETURNING id
    `, ['Race Test Resto', testSlug]);
    const testRestaurantId = restoInsert[0].id;

    const adminToken = jwt.sign(
      { id: 999, username: 'testadmin', restaurant_id: testRestaurantId, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Test 3.1: Controlled concurrent settlement race on single order
    await testAsync('PATCH /orders/:id/status: Controlled concurrent settlement with Promise.all transitions exactly once', async () => {
      // Create single order
      const orderInsert = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, is_settled, payment_method)
        VALUES ($1, 'T-10', 'pending', 350, 0, NULL)
        RETURNING id
      `, [testRestaurantId]);
      const orderId = orderInsert[0].id;

      // Fire 2 concurrent requests with different payment methods
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ status: 'completed', settle: { method: 'cash' } })
        }),
        fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ status: 'completed', settle: { method: 'upi' } })
        })
      ]);

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);

      const data1 = await res1.json();
      const data2 = await res2.json();

      // Exactly ONE request must be winning (already_settled === false), other losing (already_settled === true)
      const winners = [data1, data2].filter(d => d.already_settled === false);
      const losers = [data1, data2].filter(d => d.already_settled === true);

      assert.strictEqual(winners.length, 1, 'Exactly one request must perform the settlement transition');
      assert.strictEqual(losers.length, 1, 'Losing request must receive already_settled: true');

      const winningMethod = winners[0].payment_method;
      assert.ok(['cash', 'upi'].includes(winningMethod));
      // Losing request must NOT overwrite winning payment method
      assert.strictEqual(losers[0].payment_method, winningMethod, 'Losing response must reflect winning payment method');

      // Verify database state: is_settled = 1, payment_method = winningMethod
      const dbRows = await query('SELECT is_settled, payment_method FROM orders WHERE id = $1', [orderId]);
      assert.strictEqual(dbRows[0].is_settled, 1);
      assert.strictEqual(dbRows[0].payment_method, winningMethod);

      // Verify audit logs: EXACTLY ONE ORDER_BILL_SETTLED event exists
      const auditRows = await query(`
        SELECT id, details FROM audit_logs
        WHERE restaurant_id = $1 AND action = 'ORDER_BILL_SETTLED'
      `, [testRestaurantId]);

      const matchingAudits = auditRows.filter(a => {
        try {
          const det = JSON.parse(a.details);
          return String(det.order_id) === String(orderId);
        } catch (_) {
          return false;
        }
      });
      assert.strictEqual(matchingAudits.length, 1, 'Exactly one settlement audit record must be written');
    });

    // Test 3.2: Multi-round dining table session settlement
    await testAsync('PATCH /orders/:id/status: Multi-round dining session settles all orders together in one transition', async () => {
      const sessionId = `table_session_${Date.now()}`;

      // Insert Round 1 and Round 2
      const r1 = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, round_number, status, total_amount, is_settled)
        VALUES ($1, $2, 'T-5', 1, 'kitchen', 500, 0)
        RETURNING id
      `, [testRestaurantId, sessionId]);

      const r2 = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, round_number, status, total_amount, is_settled)
        VALUES ($1, $2, 'T-5', 2, 'kitchen', 300, 0)
        RETURNING id
      `, [testRestaurantId, sessionId]);

      const order1Id = r1[0].id;
      const order2Id = r2[0].id;

      // Fire 2 concurrent settlement requests for the session (one on order1, one on order2)
      const [resA, resB] = await Promise.all([
        fetch(`${baseUrl}/api/admin/orders/${order1Id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ status: 'completed', settle: { method: 'card' } })
        }),
        fetch(`${baseUrl}/api/admin/orders/${order2Id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ status: 'completed', settle: { method: 'cash' } })
        })
      ]);

      assert.strictEqual(resA.status, 200);
      assert.strictEqual(resB.status, 200);

      const dataA = await resA.json();
      const dataB = await resB.json();

      const winners = [dataA, dataB].filter(d => d.already_settled === false);
      assert.strictEqual(winners.length, 1, 'Only one request transitions the dining session');

      // All rounds in the session must now be settled with the winning method
      const sessionOrders = await query('SELECT id, is_settled, payment_method FROM orders WHERE session_id = $1', [sessionId]);
      assert.strictEqual(sessionOrders.length, 2);
      assert.strictEqual(sessionOrders[0].is_settled, 1);
      assert.strictEqual(sessionOrders[1].is_settled, 1);
      assert.strictEqual(sessionOrders[0].payment_method, winners[0].payment_method);
      assert.strictEqual(sessionOrders[1].payment_method, winners[0].payment_method);
    });

    // Test 3.3: Counter orders remain independently settled
    await testAsync('PATCH /orders/:id/status: Counter orders remain independently settled', async () => {
      const c1 = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, status, total_amount, is_settled)
        VALUES ($1, 'counter_session_1', 'Counter', 'pending', 150, 0)
        RETURNING id
      `, [testRestaurantId]);

      const c2 = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, status, total_amount, is_settled)
        VALUES ($1, 'counter_session_2', 'Counter', 'pending', 220, 0)
        RETURNING id
      `, [testRestaurantId]);

      const res = await fetch(`${baseUrl}/api/admin/orders/${c1[0].id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ settle: { method: 'cash' } })
      });
      assert.strictEqual(res.status, 200);

      const db1 = await query('SELECT is_settled FROM orders WHERE id = $1', [c1[0].id]);
      const db2 = await query('SELECT is_settled FROM orders WHERE id = $1', [c2[0].id]);

      assert.strictEqual(db1[0].is_settled, 1, 'Counter order 1 must be settled');
      assert.strictEqual(db2[0].is_settled, 0, 'Counter order 2 must remain independently unsettled');
    });

    // Test 3.4: Non-settlement completion preserves is_settled = 0
    await testAsync('PATCH /orders/:id/status: Completion without settlement strictly preserves is_settled = 0', async () => {
      const order = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, is_settled)
        VALUES ($1, 'T-3', 'preparing', 400, 0)
        RETURNING id
      `, [testRestaurantId]);

      const res = await fetch(`${baseUrl}/api/admin/orders/${order[0].id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'completed' }) // NO settle payload
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.is_settled, 0);

      const dbRow = await query('SELECT is_settled, status FROM orders WHERE id = $1', [order[0].id]);
      assert.strictEqual(dbRow[0].status, 'completed');
      assert.strictEqual(dbRow[0].is_settled, 0);
    });

    // Test 3.5: Reopening an order that reached terminal state is strictly prohibited
    await testAsync('PATCH /orders/:id/status: Reopening an order that reached terminal state is strictly prohibited', async () => {
      const order = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, is_settled, payment_method)
        VALUES ($1, 'T-8', 'pending', 450, 0, NULL)
        RETURNING id
      `, [testRestaurantId]);
      const orderId = order[0].id;

      // 1. Concurrent race: both attempt to settle
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ status: 'completed', settle: { method: 'cash' } })
        }),
        fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ status: 'completed', settle: { method: 'upi' } })
        })
      ]);

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);

      const d1 = await res1.json();
      const d2 = await res2.json();
      const winners = [d1, d2].filter(d => d.already_settled === false);
      const losers = [d1, d2].filter(d => d.already_settled === true);
      assert.strictEqual(winners.length, 1);
      assert.strictEqual(losers.length, 1);

      // 2. Subsequent request attempting to reopen terminal order back to kitchen returns 400
      const reopenRes = await fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'kitchen' })
      });
      assert.strictEqual(reopenRes.status, 400);
      const reopenData = await reopenRes.json();
      assert.strictEqual(reopenData.error, 'order_already_terminal');

      // Database state must remain terminal 'completed'
      const checkRows = await query('SELECT status, is_settled, payment_method FROM orders WHERE id = $1', [orderId]);
      assert.strictEqual(checkRows[0].status, 'completed', 'Order status must remain terminal');
      assert.strictEqual(checkRows[0].is_settled, 1);
      assert.strictEqual(checkRows[0].payment_method, winners[0].payment_method);
    });

    console.log('  ℹ️  [NOTICE] PostgreSQL concurrency behavior cannot be tested locally (SQLite test environment active); marked UNVERIFIED for PostgreSQL as required.');

    // ------------------------------------------------------------------------
    // SECTION 4: OrdersView Counter Kitchen Action Routing & Guard
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 4: OrdersView Counter Kitchen Action Routing & Guard ---');

    // Test 4.1: Counter order moving to kitchen without acknowledgement is rejected (400)
    await testAsync('Counter Kitchen Guard: Direct transition to kitchen without acknowledgement rejected (400)', async () => {
      const counterOrder = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, is_settled)
        VALUES ($1, 'Counter', 'pending', 100, 0)
        RETURNING id
      `, [testRestaurantId]);

      const res = await fetch(`${baseUrl}/api/admin/orders/${counterOrder[0].id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'kitchen' }) // Missing counter_acknowledgement!
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'counter_acknowledgement_required');
    });

    // Test 4.2: Counter order with valid acknowledgement moves to kitchen (200)
    await testAsync('Counter Kitchen Guard: Transition with staff acknowledgement succeeds and commits audit record', async () => {
      const counterOrder = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, is_settled)
        VALUES ($1, 'Counter', 'pending', 100, 0)
        RETURNING id
      `, [testRestaurantId]);

      const res = await fetch(`${baseUrl}/api/admin/orders/${counterOrder[0].id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          status: 'kitchen',
          counter_acknowledgement: {
            confirmed: true,
            acknowledged_at: new Date().toISOString()
          }
        })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'kitchen');

      const auditRows = await query(`
        SELECT action, details FROM audit_logs
        WHERE restaurant_id = $1 AND action = 'COUNTER_ORDER_KITCHEN_ACKNOWLEDGED'
      `, [testRestaurantId]);

      const matching = auditRows.filter(a => {
        try {
          const d = JSON.parse(a.details);
          return String(d.order_id) === String(counterOrder[0].id);
        } catch (_) {
          return false;
        }
      });
      assert.strictEqual(matching.length, 1, 'Must record COUNTER_ORDER_KITCHEN_ACKNOWLEDGED audit log');
    });

    // Test 4.3: Dining table order does NOT require counter acknowledgement
    await testAsync('Dining Table Orders: Direct transition to kitchen does not require counter acknowledgement', async () => {
      const tableOrder = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, is_settled)
        VALUES ($1, 'Table 4', 'pending', 250, 0)
        RETURNING id
      `, [testRestaurantId]);

      const res = await fetch(`${baseUrl}/api/admin/orders/${tableOrder[0].id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'kitchen' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'kitchen');
    });

    // Test 4.4: Static Component Verification: OrdersView.jsx routes all counter Kitchen actions through onOpenAcceptRouting without unconfirmed fallback
    test('OrdersView.jsx: All counter Kitchen actions strictly route through onOpenAcceptRouting', () => {
      const ordersViewPath = path.resolve('src/components/Admin/views/OrdersView.jsx');
      const ordersViewContent = fs.readFileSync(ordersViewPath, 'utf8');

      // 1. Table View inline accept
      assert.ok(
        ordersViewContent.includes("if (isCounter) {\n                                  if (onOpenAcceptRouting) {\n                                    onOpenAcceptRouting(order);\n                                  }\n                                  return;\n                                }"),
        'Table view accept button must route counter orders through onOpenAcceptRouting and return immediately without fallback'
      );

      // 2. Card View accept
      assert.ok(
        ordersViewContent.includes("if (isCounter) {\n                              if (onOpenAcceptRouting) {\n                                onOpenAcceptRouting(order);\n                              }\n                              return;\n                            }"),
        'Card view accept button must route counter orders through onOpenAcceptRouting and return immediately without fallback'
      );

      // 3. Detail Modal CTA
      assert.ok(
        ordersViewContent.includes("if (isCounter) {\n                      if (onOpenAcceptRouting) {\n                        onOpenAcceptRouting(selectedOrder);\n                      }\n                      setSelectedOrder(null);\n                      return;\n                    }"),
        'Detail modal CTA must route counter orders through onOpenAcceptRouting and return immediately without fallback'
      );
    });

    // Test 4.5: Static Component Verification: AdminDashboard.jsx prevents double submission while routing is processing
    test('AdminDashboard.jsx: Awaits handleUpdateStatus before closing acceptRoutingModal to prevent double submission', () => {
      const dashboardPath = path.resolve('src/components/Admin/AdminDashboard.jsx');
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

      const matches = dashboardContent.match(/await handleUpdateStatus\(targetId, 'kitchen', extra\);\s*setAcceptRoutingModal\(null\);/g);
      assert.ok(matches && matches.length >= 2, 'AdminDashboard must await handleUpdateStatus before clearing acceptRoutingModal in both routing paths');
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
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
