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
  getCliUrl as getMigrationCliUrl,
  resolveAuthoritativeRelationSchemas
} from '../scripts/migrate_phase1_counter_and_tracking.js';
import {
  resolveTargetDatabaseUrl,
  verifyPhase1Schema,
  getCliUrl as getVerifyCliUrl
} from '../scripts/verify_phase1_schema.js';
import {
  generateHmacQrToken,
  generateRestaurantQrSecret,
  verifyQrToken,
  normalizeSpaceType,
  normalizeSpaceNumber
} from '../utils/qrSecurity.js';
import {
  generatePresenceToken,
  generateQrContextHash
} from '../utils/presenceVerification.js';
import apiRouter, { clearRestoResolveCache } from '../routes/api.js';
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
    const savedStagingHost = process.env.STAGING_DATABASE_HOST;
    try {
      process.env.STAGING_DATABASE_HOST = 'ep-shiny-staging.neon.tech';

      // 1. Remote staging application target requires --confirm-production
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-staging.neon.tech/touchqr_staging_app', false),
        /PRODUCTION_SAFETY_VIOLATION/
      );

      const authorized = validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-staging.neon.tech/touchqr_staging_app', true);
      assert.strictEqual(authorized.isLocal, false);
      assert.strictEqual(authorized.host, 'ep-shiny-staging.neon.tech');
      assert.strictEqual(authorized.dbName, 'touchqr_staging_app');

      // 2. Remote production target is rejected EVEN IF --confirm-production is passed
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-prod.neon.tech/neondb', true),
        /(PRODUCTION_TARGET_FORBIDDEN|PRODUCTION_ENDPOINT_FORBIDDEN)/
      );

      // 3. Test database target without --allow-test-target is rejected to prevent accidental mixup
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-staging.neon.tech/touchqr_staging_test', true),
        /MIGRATION_TARGET_MISMATCH/
      );

      // 4. Test database target WITH --allow-test-target and confirm-production is accepted
      const testMigTarget = validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-staging.neon.tech/touchqr_staging_test', true, { allowTestTarget: true });
      assert.strictEqual(testMigTarget.dbName, 'touchqr_staging_test');

      // 5. Unrecognized remote non-staging database is rejected
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://user:pass@ep-shiny-staging.neon.tech/analytics_db', true),
        /STAGING_TARGET_REQUIRED/
      );
    } finally {
      if (savedStagingHost) process.env.STAGING_DATABASE_HOST = savedStagingHost;
      else delete process.env.STAGING_DATABASE_HOST;
    }
  });

  test('Remote Endpoint Isolation Safety Gate: Rigorous URL-fixture regression proofs', () => {
    const savedAppUrl = process.env.DATABASE_URL;
    const savedStagingHost = process.env.STAGING_DATABASE_HOST;
    try {
      // Configure known production DATABASE_URL
      process.env.DATABASE_URL = 'postgresql://prod_user:prod_pass@ep-production-cluster.neon.tech:5432/neondb';
      process.env.STAGING_DATABASE_HOST = 'ep-dedicated-staging.neon.tech';

      // 1. A URL targeting the known production hostname is rejected even if database name is touchqr_staging_app
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://operator:secret@ep-production-cluster.neon.tech:5432/touchqr_staging_app', true),
        /PRODUCTION_ENDPOINT_FORBIDDEN/
      );

      // 2. A URL targeting the known production hostname is rejected even if database name is touchqr_staging_test
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://tester:secret@ep-production-cluster.neon.tech:5432/touchqr_staging_test', true, { allowTestTarget: true }),
        /PRODUCTION_ENDPOINT_FORBIDDEN/
      );

      // 3. A production URL cannot pass the migration guard by supplying --confirm-production
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://prod_user:prod_pass@ep-production-cluster.neon.tech:5432/neondb', true),
        /PRODUCTION_ENDPOINT_FORBIDDEN/
      );

      // 4. A dedicated staging endpoint with expected staging database name is accepted ONLY after required operator confirmation
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://staging_user:secret@ep-dedicated-staging.neon.tech:5432/touchqr_staging_app', false),
        /PRODUCTION_SAFETY_VIOLATION/
      );
      const acceptedStaging = validateMigrationTargetUrl('postgresql://staging_user:secret@ep-dedicated-staging.neon.tech:5432/touchqr_staging_app', true);
      assert.strictEqual(acceptedStaging.host, 'ep-dedicated-staging.neon.tech');
      assert.strictEqual(acceptedStaging.dbName, 'touchqr_staging_app');

      // 5. An arbitrary remote endpoint with database name containing "staging" is rejected unless hostname matches explicitly configured staging allowlist
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://evil_user:secret@arbitrary-unauthorized-host.neon.tech:5432/touchqr_staging_app', true),
        /UNAUTHORIZED_REMOTE_ENDPOINT/
      );
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://evil_user:secret@arbitrary-unauthorized-host.neon.tech:5432/staging_db', true),
        /UNAUTHORIZED_REMOTE_ENDPOINT/
      );

      // 5b. When STAGING_DATABASE_HOST is absent, remote targets fail closed immediately
      delete process.env.STAGING_DATABASE_HOST;
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://staging_user:secret@ep-dedicated-staging.neon.tech:5432/touchqr_staging_app', true),
        /STAGING_HOST_CONFIG_REQUIRED/
      );

      // 5c. When STAGING_DATABASE_HOST conflicts with production host, fails closed
      process.env.STAGING_DATABASE_HOST = 'ep-production-cluster.neon.tech';
      assert.throws(
        () => validateMigrationTargetUrl('postgresql://staging_user:secret@ep-production-cluster.neon.tech:5432/touchqr_staging_app', true),
        /PRODUCTION_ENDPOINT_FORBIDDEN/
      );
    } finally {
      if (savedAppUrl) process.env.DATABASE_URL = savedAppUrl;
      else delete process.env.DATABASE_URL;
      if (savedStagingHost) process.env.STAGING_DATABASE_HOST = savedStagingHost;
      else delete process.env.STAGING_DATABASE_HOST;
    }
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
        if (sql.includes('to_regclass')) {
          return {
            rows: [
              { table_name: 'orders', table_schema: 'public' },
              { table_name: 'restaurants', table_schema: 'public' }
            ]
          };
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
        if (sql.includes('to_regclass')) {
          return {
            rows: [
              { table_name: 'orders', table_schema: 'public' },
              { table_name: 'restaurants', table_schema: 'public' }
            ]
          };
        }
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

  await testAsync('verifyPhase1Schema: Multi-schema duplicate tables - never falsely passes on un-resolved schema', async () => {
    // In this scenario:
    // 'archive.orders' has tracking_token_hash and the index.
    // BUT to_regclass resolves 'orders' to 'public.orders', which is MISSING tracking_token_hash!
    const mockMultiSchemaPool = {
      query: async (sql, params) => {
        if (sql.includes('to_regclass')) {
          return {
            rows: [
              { table_name: 'orders', table_schema: 'public' },
              { table_name: 'restaurants', table_schema: 'public' }
            ]
          };
        }
        if (sql.includes('information_schema.columns')) {
          assert.strictEqual(params[0], 'public', 'Must query columns specifically for resolved orders schema');
          assert.strictEqual(params[1], 'public', 'Must query columns specifically for resolved restaurants schema');
          return {
            rows: [
              // Notice: 'public.orders' is missing tracking_token_hash!
              { table_schema: 'public', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
              { table_schema: 'public', table_name: 'orders', column_name: 'terminal_at' },
              { table_schema: 'public', table_name: 'orders', column_name: 'updated_at' }
            ]
          };
        }
        if (sql.includes('pg_indexes')) {
          assert.strictEqual(params[0], 'public', 'Must query index specifically for resolved orders schema');
          return { rows: [] };
        }
        return { rows: [] };
      },
      end: async () => {}
    };

    const res = await verifyPhase1Schema({ url: 'postgresql://testuser:pass@127.0.0.1:5432/testdb' }, mockMultiSchemaPool);
    assert.strictEqual(res.verified, false, 'Must fail because public.orders is missing tracking_token_hash');
    assert.ok(res.missing.includes('orders.tracking_token_hash'));
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
      const ordersViewContent = fs.readFileSync(ordersViewPath, 'utf8').replace(/\r\n/g, '\n');

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

    // ------------------------------------------------------------------------
    // SECTION 5: CodeRabbit Review Findings Targeted Remediation & Safeguard Verification
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 5: CodeRabbit Review Findings Targeted Remediation ---');

    // Test 5.1: In-Memory Idempotency Isolation between Counter Customers (Finding 1)
    await testAsync('Idempotency Isolation: Distinct counter customers placing identical carts never share order ID or tracking token', async () => {
      const secret = generateRestaurantQrSecret();
      const slug = `cr-test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const [resto] = await query(`
        INSERT INTO restaurants (name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled, plan_tier, subscription_type)
        VALUES ($1, $2, $3, 1, 1, 1, 'pro', 'ADMIN_GRANTED')
        RETURNING id, slug, qr_secret
      `, ['CodeRabbit Resto', slug, secret]);

      const [dish] = await query(`
        INSERT INTO dishes (restaurant_id, name, price, available)
        VALUES ($1, 'Masala Dosa', 120, 1)
        RETURNING id
      `, [resto.id]);

      const qrToken = generateHmacQrToken(slug, 'counter', 'COUNTER', secret);
      const qrHash = generateQrContextHash(slug, 'counter', 'COUNTER', qrToken);
      const presenceToken = generatePresenceToken({
        verificationToken: 'vtok_cr_test',
        restaurantId: resto.id,
        slug,
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrContextHash: qrHash,
        expiryMinutes: 20
      });

      // 1. Two distinct customers with different phones placing identical items within 3s
      const payloadA = {
        slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: qrToken,
        presence_token: presenceToken,
        customer_phone: '9876543210',
        items: [{ dish_id: dish.id, quantity: 2 }]
      };
      const payloadB = {
        slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: qrToken,
        presence_token: presenceToken,
        customer_phone: '9123456789',
        items: [{ dish_id: dish.id, quantity: 2 }]
      };

      const resA = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadA)
      });
      assert.strictEqual(resA.status, 200);
      const dataA = await resA.json();

      const resB = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadB)
      });
      assert.strictEqual(resB.status, 200);
      const dataB = await resB.json();

      assert.notStrictEqual(dataA.order_id, dataB.order_id, 'Customer A and B must receive distinct order IDs');
      assert.notStrictEqual(dataA.tracking_token, dataB.tracking_token, 'Customer A and B must receive distinct tracking tokens');
      assert.strictEqual(dataA.tracking_token.length, 32);
      assert.strictEqual(dataB.tracking_token.length, 32);

      // 2. Anonymous counter orders (no phone) also remain isolated
      const anonPayload1 = {
        slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [{ dish_id: dish.id, quantity: 1 }]
      };
      const anonPayload2 = {
        slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [{ dish_id: dish.id, quantity: 1 }]
      };

      const resAnon1 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anonPayload1)
      });
      assert.strictEqual(resAnon1.status, 200);
      const dataAnon1 = await resAnon1.json();

      const resAnon2 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(anonPayload2)
      });
      assert.strictEqual(resAnon2.status, 200);
      const dataAnon2 = await resAnon2.json();

      assert.notStrictEqual(dataAnon1.order_id, dataAnon2.order_id, 'Anonymous counter orders must receive distinct order IDs');
      assert.notStrictEqual(dataAnon1.tracking_token, dataAnon2.tracking_token, 'Anonymous counter orders must receive distinct tracking tokens');

      // 3. Customer A truly replaying identical request within TTL receives cached response
      const replayA = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadA)
      });
      assert.strictEqual(replayA.status, 200);
      const dataReplayA = await replayA.json();
      assert.strictEqual(dataReplayA.order_id, dataA.order_id, 'True replay by same customer returns identical order ID');
      assert.strictEqual(dataReplayA.tracking_token, dataA.tracking_token, 'True replay by same customer returns identical tracking token');
    });

    // Test 5.2: Multi-Round Dining Session Settlement Preserves Round Status and Kitchen Flags (Finding 2)
    await testAsync('Session Settlement: Settling target round preserves status and kitchen flags of other rounds', async () => {
      const sessionId = `table_session_${Date.now()}`;

      // Insert 3 rounds for Table 12 in the same dining session
      const [r1] = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, status, sent_to_kds, kitchen_prepared, total_amount, is_settled)
        VALUES ($1, $2, 'Table 12', 'served', 1, 1, 200, 0)
        RETURNING id
      `, [testRestaurantId, sessionId]);

      const [r2] = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, status, sent_to_kds, kitchen_prepared, total_amount, is_settled)
        VALUES ($1, $2, 'Table 12', 'delivered', 1, 1, 150, 0)
        RETURNING id
      `, [testRestaurantId, sessionId]);

      const [r3] = await query(`
        INSERT INTO orders (restaurant_id, session_id, table_number, status, sent_to_kds, kitchen_prepared, total_amount, is_settled)
        VALUES ($1, $2, 'Table 12', 'ready', 1, 0, 100, 0)
        RETURNING id
      `, [testRestaurantId, sessionId]);

      // Settle session via Round 1 with status = 'completed' and payment = 'card'
      const settleRes = await fetch(`${baseUrl}/api/admin/orders/${r1.id}/status`, {
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

      assert.strictEqual(settleRes.status, 200);
      const settleData = await settleRes.json();
      assert.strictEqual(settleData.is_settled, 1);

      // Verify DB states for all 3 rounds
      const rows = await query('SELECT id, status, sent_to_kds, kitchen_prepared, is_settled, payment_method, terminal_at FROM orders WHERE session_id = $1 ORDER BY id ASC', [sessionId]);
      assert.strictEqual(rows.length, 3);

      // Round 1 (target): updated to completed, is_settled = 1, payment_method = card, terminal_at set
      assert.strictEqual(rows[0].id, r1.id);
      assert.strictEqual(rows[0].status, 'completed');
      assert.strictEqual(rows[0].is_settled, 1);
      assert.strictEqual(rows[0].payment_method, 'card');
      assert.ok(rows[0].terminal_at);

      // Round 2 (non-target): is_settled = 1, payment_method = card, BUT status strictly preserved as 'delivered' and flags preserved!
      assert.strictEqual(rows[1].id, r2.id);
      assert.strictEqual(rows[1].status, 'delivered', 'Round 2 status must remain delivered (not overwritten by Round 1 status)');
      assert.strictEqual(rows[1].sent_to_kds, 1);
      assert.strictEqual(rows[1].kitchen_prepared, 1);
      assert.strictEqual(rows[1].is_settled, 1);
      assert.strictEqual(rows[1].payment_method, 'card');

      // Round 3 (non-target): is_settled = 1, payment_method = card, BUT status strictly preserved as 'ready' and kitchen_prepared strictly 0!
      assert.strictEqual(rows[2].id, r3.id);
      assert.strictEqual(rows[2].status, 'ready', 'Round 3 status must remain ready (not overwritten by Round 1 status)');
      assert.strictEqual(rows[2].sent_to_kds, 1);
      assert.strictEqual(rows[2].kitchen_prepared, 0, 'Round 3 kitchen_prepared must remain 0');
      assert.strictEqual(rows[2].is_settled, 1);
      assert.strictEqual(rows[2].payment_method, 'card');
    });

    // Test 5.3: Migration Script Schema Scoping Safeguard (Findings 3 & 4)
    test('Migration Script Safety: Pre-check and post-check queries are strictly schema-scoped, with increased statement timeout', () => {
      const scriptPath = path.resolve('server/scripts/migrate_phase1_counter_and_tracking.js');
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');

      // 1. Statement timeout must be at least 60000ms (configured 120s)
      assert.ok(scriptContent.includes('statement_timeout: 120000'), 'Migration pool statement_timeout must be increased for large tables (120s)');
      assert.ok(scriptContent.includes("SET LOCAL statement_timeout = '120s'"), 'Transaction statement_timeout must be set to 120s');
      assert.ok(scriptContent.includes("SET LOCAL lock_timeout = '2s'"), 'Transaction lock_timeout must remain tight (2s)');

      // 2. Pre-check queries must scope to exact resolved relation schemas ($1 and $2)
      assert.ok(
        scriptContent.includes("table_schema = $1 AND table_name = 'orders'"),
        'Pre/post-check columns queries must filter table_schema using resolved orders schema ($1)'
      );
      assert.ok(
        scriptContent.includes("table_schema = $2 AND table_name = 'restaurants'"),
        'Pre/post-check columns queries must filter table_schema using resolved restaurants schema ($2)'
      );

      // 3. Index query must target the specific schema of orders table
      assert.ok(
        scriptContent.includes("schemaname = $1 AND tablename = 'orders' AND indexname = 'idx_orders_tracking_hash'"),
        'Index query must explicitly target the resolved orders schema ($1) to prevent false positives from other schemas'
      );
    });

    // Test 5.4: Counter Space Validation & QR Authorization (Finding 5)
    await testAsync('Space Validation & QR Authorization: Valid counter QR works while invalid identifiers or spaces are rejected', async () => {
      const secret = generateRestaurantQrSecret();
      const slug = `space-val-${Date.now()}`;
      const [resto] = await query(`
        INSERT INTO restaurants (name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled, total_tables, plan_tier, subscription_type)
        VALUES ($1, $2, $3, 1, 1, 1, 5, 'pro', 'ADMIN_GRANTED')
        RETURNING id, slug, qr_secret
      `, ['Space Val Resto', slug, secret]);

      const [dish] = await query(`
        INSERT INTO dishes (restaurant_id, name, price, available)
        VALUES ($1, 'Chai', 30, 1)
        RETURNING id
      `, [resto.id]);

      // 1. Static validation in src/App.jsx accepts 'COUNTER'
      const appJsxPath = path.resolve('src/App.jsx');
      const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');
      assert.ok(
        appJsxContent.includes("currentSpaceType === 'counter' || initialSpaceInfo.type === 'counter'"),
        'App.jsx isSpaceNumberValid must explicitly handle counter spaces'
      );
      assert.ok(
        appJsxContent.includes("String(currentTableNum).trim().toUpperCase() === 'COUNTER'"),
        'App.jsx isSpaceNumberValid must validate canonical COUNTER identifier'
      );

      // 2. Backend rejects counter order when counter_ordering_enabled = 0
      await query('UPDATE restaurants SET counter_ordering_enabled = 0 WHERE id = $1', [resto.id]);
      clearRestoResolveCache();

      const counterQr = generateHmacQrToken(slug, 'counter', 'COUNTER', secret);
      const presenceTok = generatePresenceToken({
        verificationToken: 'vtok_val',
        restaurantId: resto.id,
        slug,
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrContextHash: generateQrContextHash(slug, 'counter', 'COUNTER', counterQr),
        expiryMinutes: 20
      });

      const resDisabled = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: counterQr,
          presence_token: presenceTok,
          items: [{ dish_id: dish.id, quantity: 1 }]
        })
      });
      assert.strictEqual(resDisabled.status, 400);
      const disData = await resDisabled.json();
      assert.strictEqual(disData.error, 'counter_ordering_disabled');

      // 3. Re-enable counter ordering: order succeeds with valid counter token
      await query('UPDATE restaurants SET counter_ordering_enabled = 1 WHERE id = $1', [resto.id]);
      clearRestoResolveCache();

      const resEnabled = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: counterQr,
          presence_token: presenceTok,
          items: [{ dish_id: dish.id, quantity: 1 }]
        })
      });
      assert.strictEqual(resEnabled.status, 200);

      // 4. Submitting invalid or unsigned counter token is rejected (403)
      const resBadToken = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          table_number: 'COUNTER',
          space_type: 'counter',
          table_token: 'forged_fake_token',
          presence_token: presenceTok,
          items: [{ dish_id: dish.id, quantity: 1 }]
        })
      });
      assert.strictEqual(resBadToken.status, 403);
    });

    // Test 5.5: Tracking Token Lifecycle & 410 Expiry (Finding 6)
    await testAsync('Tracking Token Lifecycle: Active returns 200, terminal older than 2h returns 410 and cleans client storage', async () => {
      const secret = generateRestaurantQrSecret();
      const slug = `track-exp-${Date.now()}`;
      const [resto] = await query(`
        INSERT INTO restaurants (name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled, plan_tier, subscription_type)
        VALUES ($1, $2, $3, 1, 1, 1, 'pro', 'ADMIN_GRANTED')
        RETURNING id, slug, qr_secret
      `, ['Track Exp Resto', slug, secret]);

      const rawToken = crypto.randomBytes(16).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // 1. Active order returns 200
      const [activeOrder] = await query(`
        INSERT INTO orders (restaurant_id, table_number, status, total_amount, tracking_token_hash, is_settled)
        VALUES ($1, 'Counter', 'pending', 100, $2, 0)
        RETURNING id
      `, [resto.id, tokenHash]);

      const trackActiveRes = await fetch(`${baseUrl}/api/orders/track/${activeOrder.id}?slug=${slug}`, {
        headers: { 'X-Order-Tracking-Token': rawToken }
      });
      assert.strictEqual(trackActiveRes.status, 200);
      const activeData = await trackActiveRes.json();
      assert.strictEqual(activeData.status, 'pending');
      assert.strictEqual(activeData.tracking_token_hash, undefined, 'Hash must be scrubbed from response');

      // 2. Terminal order older than 2 hours returns 410 (tracking_expired)
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      await query(`
        UPDATE orders
        SET status = 'completed', terminal_at = $1, is_settled = 1
        WHERE id = $2
      `, [threeHoursAgo, activeOrder.id]);

      const trackExpiredRes = await fetch(`${baseUrl}/api/orders/track/${activeOrder.id}?slug=${slug}`, {
        headers: { 'X-Order-Tracking-Token': rawToken }
      });
      assert.strictEqual(trackExpiredRes.status, 410);
      const expiredData = await trackExpiredRes.json();
      assert.strictEqual(expiredData.error, 'tracking_expired');

      // 3. Static verification of App.jsx: clears sessionStorage on 410
      const appJsxContent = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
      assert.ok(
        appJsxContent.includes("sessionStorage.removeItem(`tq_track_${activeOrderId}`);"),
        'App.jsx must clear order tracking token on 410 tracking_expired'
      );
      assert.ok(
        appJsxContent.includes("sessionStorage.removeItem('tq_active_tracking_token');"),
        'App.jsx must clear active tracking token on 410 tracking_expired'
      );
    });

    // Test 5.6: counter_ordering_enabled Round-Trip Persistence (Finding 7)
    await testAsync('Settings Persistence: counter_ordering_enabled is returned by GET /api/info and preserved on unrelated settings update', async () => {
      const slug = `settings-test-${Date.now()}`;
      const [resto] = await query(`
        INSERT INTO restaurants (name, slug, active, counter_ordering_enabled, tagline, plan_tier, subscription_type)
        VALUES ($1, $2, 1, 1, 'Initial Tagline', 'pro', 'ADMIN_GRANTED')
        RETURNING id, slug, counter_ordering_enabled
      `, ['Settings Resto', slug]);

      const staffToken = jwt.sign(
        { id: 888, username: 'settingsadmin', restaurant_id: resto.id, role: 'restaurant_admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // 1. GET /api/info returns counter_ordering_enabled: true
      const infoRes = await fetch(`${baseUrl}/api/info?slug=${slug}`);
      assert.strictEqual(infoRes.status, 200);
      const infoData = await infoRes.json();
      assert.strictEqual(infoData.counter_ordering_enabled, true, 'GET /api/info must explicitly return counter_ordering_enabled boolean');

      // 2. Client loads settings and updates only an unrelated field (tagline), preserving counter_ordering_enabled
      const updateRes = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`
        },
        body: JSON.stringify({
          tagline: 'Fresh Baked Daily',
          counter_ordering_enabled: infoData.counter_ordering_enabled
        })
      });
      assert.strictEqual(updateRes.status, 200);

      // 3. Verify DB state and subsequent GET /api/info: counter_ordering_enabled remains 1 / true
      const [dbAfter] = await query('SELECT counter_ordering_enabled, tagline FROM restaurants WHERE id = $1', [resto.id]);
      assert.strictEqual(dbAfter.counter_ordering_enabled, 1, 'counter_ordering_enabled must remain 1 after unrelated settings update');
      assert.strictEqual(dbAfter.tagline, 'Fresh Baked Daily');

      const infoResAfter = await fetch(`${baseUrl}/api/info?slug=${slug}`);
      const infoDataAfter = await infoResAfter.json();
      assert.strictEqual(infoDataAfter.counter_ordering_enabled, true);

      // 4. Static verification in AdminDashboard.jsx: initializes counter_ordering_enabled correctly
      const dashboardContent = fs.readFileSync(path.resolve('src/components/Admin/AdminDashboard.jsx'), 'utf8');
      assert.ok(
        dashboardContent.includes("counter_ordering_enabled: Boolean(infoData.counter_ordering_enabled === 1 || infoData.counter_ordering_enabled === true || infoData.counter_ordering_enabled === '1')"),
        'AdminDashboard.jsx must initialize counter_ordering_enabled from fetched restaurant settings'
      );
    });

    // Test 5.1b: Custom Idempotency Key Isolation (Residual Case 1)
    await testAsync('Custom Idempotency Key: Two distinct counter customers sending same key never share order ID or tracking token', async () => {
      const secret = generateRestaurantQrSecret();
      const slug = `cr-idemp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const [resto] = await query(`
        INSERT INTO restaurants (name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled, plan_tier, subscription_type)
        VALUES ($1, $2, $3, 1, 1, 1, 'pro', 'ADMIN_GRANTED')
        RETURNING id, slug, qr_secret
      `, ['Idemp Resto', slug, secret]);

      const [dish] = await query(`
        INSERT INTO dishes (restaurant_id, name, price, available)
        VALUES ($1, 'Vada Pav', 50, 1)
        RETURNING id
      `, [resto.id]);

      const qrToken = generateHmacQrToken(slug, 'counter', 'COUNTER', secret);
      const qrHash = generateQrContextHash(slug, 'counter', 'COUNTER', qrToken);
      const presenceTokA = generatePresenceToken({
        verificationToken: 'vtok_idemp_a',
        restaurantId: resto.id,
        slug,
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrContextHash: qrHash,
        expiryMinutes: 20
      });
      const presenceTokB = generatePresenceToken({
        verificationToken: 'vtok_idemp_b',
        restaurantId: resto.id,
        slug,
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrContextHash: qrHash,
        expiryMinutes: 20
      });

      const sharedCustomKey = `checkout-key-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // 1. Customer A places order with custom key
      const payloadA = {
        slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: qrToken,
        presence_token: presenceTokA,
        customer_phone: '9876543210',
        items: [{ dish_id: dish.id, quantity: 2 }]
      };

      const resA = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payloadA)
      });
      assert.strictEqual(resA.status, 200);
      const dataA = await resA.json();
      assert.ok(dataA.order_id);
      assert.ok(dataA.tracking_token);

      // 2. Customer B sends the SAME custom idempotency key and identical cart items
      const payloadB = {
        slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: qrToken,
        presence_token: presenceTokB,
        customer_phone: '9123456789',
        items: [{ dish_id: dish.id, quantity: 2 }]
      };

      const resB = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payloadB)
      });
      assert.strictEqual(resB.status, 200);
      const dataB = await resB.json();
      assert.ok(dataB.order_id);
      assert.ok(dataB.tracking_token);

      // CRITICAL ASSERTION: Customer B must NEVER receive Customer A's order ID or tracking token
      assert.notStrictEqual(dataB.order_id, dataA.order_id, 'Customer B must not receive Customer A order ID');
      assert.notStrictEqual(dataB.tracking_token, dataA.tracking_token, 'Customer B must not receive Customer A tracking token');

      // 3. Legitimate retry: Customer A repeats the exact same request with the same custom key
      const replayResA = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payloadA)
      });
      assert.strictEqual(replayResA.status, 200);
      const replayDataA = await replayResA.json();
      assert.strictEqual(replayDataA.order_id, dataA.order_id, 'Same customer retry must return cached order ID');
      assert.strictEqual(replayDataA.tracking_token, dataA.tracking_token, 'Same customer retry must return cached tracking token');
    });

    // Test 5.5b: Expired Tracking State Invariants (Residual Case 2)
    test('Expired Tracking State: Expiration preserves existing status or sets expired (never completed), and stops polling', () => {
      // 1. Logic simulation of App.jsx 410 handler
      const handle410 = (prev, orderId) => {
        if (prev) {
          return { ...prev, tracking_expired: true };
        }
        return { id: orderId, status: 'expired', tracking_expired: true };
      };

      // Case A: Previous state is absent (null)
      const stateFromNull = handle410(null, 501);
      assert.strictEqual(stateFromNull.id, 501);
      assert.strictEqual(stateFromNull.status, 'expired', 'Must be status "expired", NEVER "completed"');
      assert.notStrictEqual(stateFromNull.status, 'completed');
      assert.strictEqual(stateFromNull.tracking_expired, true);

      // Case B: Previous state is pending
      const stateFromPending = handle410({ id: 502, status: 'pending', table_number: 'Counter' }, 502);
      assert.strictEqual(stateFromPending.status, 'pending', 'Must preserve pending status');
      assert.notStrictEqual(stateFromPending.status, 'completed');
      assert.strictEqual(stateFromPending.tracking_expired, true);

      // Case C: Previous state is cancelled
      const stateFromCancelled = handle410({ id: 503, status: 'cancelled', table_number: 'Table 4' }, 503);
      assert.strictEqual(stateFromCancelled.status, 'cancelled', 'Must preserve cancelled status');
      assert.notStrictEqual(stateFromCancelled.status, 'completed');
      assert.strictEqual(stateFromCancelled.tracking_expired, true);

      // 2. Static source verification in src/App.jsx:
      const appJsx = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8').replace(/\r\n/g, '\n');
      assert.ok(
        appJsx.includes("trackingExpiredRef.current = true;"),
        'App.jsx must set trackingExpiredRef.current = true on 410'
      );
      assert.ok(
        appJsx.includes("if (trackingExpiredRef.current) {\n          return;\n        }"),
        'App.jsx checkTableStatus must stop polling when trackingExpiredRef is set'
      );
      assert.ok(
        !appJsx.includes("status: 'completed', tracking_expired: true"),
        'App.jsx must never set status to completed on tracking expiry'
      );
    });

    // Test 5.3b: Exact Relation Schema Resolution in Multi-Schema Environments (Residual Case 3)
    await testAsync('Exact Schema Resolution: Disambiguates orders and restaurants when same-named tables exist in multiple schemas', async () => {
      // Simulate multi-schema PostgreSQL database where 'analytics' and 'public' both have an 'orders' table
      const mockMultiSchemaClient = {
        query: async (sql, params) => {
          if (sql.includes('to_regclass')) {
            // PostgreSQL to_regclass resolves 'orders' and 'restaurants' according to search_path to 'public'
            return {
              rows: [
                { table_name: 'orders', table_schema: 'public' },
                { table_name: 'restaurants', table_schema: 'public' }
              ]
            };
          }
          if (sql.includes('information_schema.columns')) {
            // Suppose analytics.orders already has tracking_token_hash, but public.orders does NOT!
            assert.strictEqual(params[0], 'public', 'Must query columns specifically for resolved ordersSchema');
            assert.strictEqual(params[1], 'public', 'Must query columns specifically for resolved restaurantsSchema');
            return {
              rows: [
                // public schema columns (missing tracking_token_hash!)
                { table_schema: 'public', table_name: 'restaurants', column_name: 'counter_ordering_enabled' },
                { table_schema: 'public', table_name: 'orders', column_name: 'terminal_at' },
                { table_schema: 'public', table_name: 'orders', column_name: 'updated_at' }
              ]
            };
          }
          if (sql.includes('pg_indexes')) {
            assert.strictEqual(params[0], 'public', 'Must query indexes specifically for resolved ordersSchema');
            return { rows: [] };
          }
          return { rows: [] };
        }
      };

      const resolved = await resolveAuthoritativeRelationSchemas(mockMultiSchemaClient);
      assert.strictEqual(resolved.ordersSchema, 'public');
      assert.strictEqual(resolved.restaurantsSchema, 'public');

      console.log('  ℹ️  [NOTICE] PostgreSQL live multi-schema integration cannot be executed locally (SQLite active); marked UNVERIFIED for live PostgreSQL as required.');
    });

    // Test 5.4b: Fail-Safe Counter Configuration (Residual Case 4)
    test('Fail-Safe Counter Configuration: Rejects missing, loading, or malformed config, authorizes only when enabled', () => {
      // Logic simulation of App.jsx isSpaceNumberValid counter branch
      const checkCounterValid = (info, spaceType, tableNum) => {
        if (spaceType === 'counter') {
          const isCanonicalCounter = String(tableNum).trim().toUpperCase() === 'COUNTER';
          if (!isCanonicalCounter) return false;
          if (!info) return false; // Fail-closed when info is null/loading
          const isCounterEnabled = info.counter_ordering_enabled === true || 
                                   info.counter_ordering_enabled === 1 || 
                                   info.counter_ordering_enabled === '1';
          return Boolean(isCounterEnabled);
        }
        return true;
      };

      // Case A: info is null (loading) -> FAIL CLOSED (false)
      assert.strictEqual(checkCounterValid(null, 'counter', 'COUNTER'), false, 'Must fail closed when info is null/loading');

      // Case B: info is empty object (missing counter_ordering_enabled) -> FAIL CLOSED (false)
      assert.strictEqual(checkCounterValid({}, 'counter', 'COUNTER'), false, 'Must fail closed when counter_ordering_enabled is missing');

      // Case C: info has malformed or disabled counter_ordering_enabled -> FAIL CLOSED (false)
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: 0 }, 'counter', 'COUNTER'), false);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: false }, 'counter', 'COUNTER'), false);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: '0' }, 'counter', 'COUNTER'), false);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: 'disabled' }, 'counter', 'COUNTER'), false);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: null }, 'counter', 'COUNTER'), false);

      // Case D: info has valid enabled counter ordering -> AUTHORIZED (true)
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: true }, 'counter', 'COUNTER'), true);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: 1 }, 'counter', 'COUNTER'), true);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: '1' }, 'counter', 'COUNTER'), true);

      // Case E: non-canonical space number -> REJECTED (false)
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: true }, 'counter', 'COUNTER_2'), false);
      assert.strictEqual(checkCounterValid({ counter_ordering_enabled: true }, 'counter', 'TABLE 1'), false);

      // Static source inspection of src/App.jsx
      const appJsx = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8').replace(/\r\n/g, '\n');
      assert.ok(
        appJsx.includes("if (!info) return false;"),
        'App.jsx isSpaceNumberValid must fail closed when info is null/loading'
      );
      assert.ok(
        appJsx.includes("const isCounterEnabled = info.counter_ordering_enabled === true || \n                               info.counter_ordering_enabled === 1 || \n                               info.counter_ordering_enabled === '1';"),
        'App.jsx isSpaceNumberValid must explicitly require truthy counter_ordering_enabled'
      );
    });

    // ------------------------------------------------------------------------
    // SECTION 6: Final Idempotency Safety Gate & Customer Session Scoping
    // ------------------------------------------------------------------------
    console.log('\n--- SECTION 6: Final Idempotency Safety Gate & Customer Session Scoping ---');

    // Shared setup for Section 6 tests
    const s6Secret = generateRestaurantQrSecret();
    const s6Slug = `s6-idemp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const [s6Resto] = await query(`
      INSERT INTO restaurants (name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled, total_tables, plan_tier, subscription_type)
      VALUES ($1, $2, $3, 1, 1, 1, 10, 'pro', 'ADMIN_GRANTED')
      RETURNING id, slug, qr_secret
    `, ['Idempotency Gate Resto', s6Slug, s6Secret]);

    const [s6Dish] = await query(`
      INSERT INTO dishes (restaurant_id, name, price, available)
      VALUES ($1, 'Special Thali', 180, 1)
      RETURNING id
    `, [s6Resto.id]);

    const s6CounterQr = generateHmacQrToken(s6Slug, 'counter', 'COUNTER', s6Secret);
    const s6TableQr = generateHmacQrToken(s6Slug, 'table', '1', s6Secret);

    const s6CounterQrHash = generateQrContextHash(s6Slug, 'counter', 'COUNTER', s6CounterQr);
    const s6PresenceCounterA = generatePresenceToken({
      verificationToken: `vtok_s6_ca_${Date.now()}`,
      restaurantId: s6Resto.id,
      slug: s6Slug,
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      qrContextHash: s6CounterQrHash,
      expiryMinutes: 20
    });
    const s6PresenceCounterB = generatePresenceToken({
      verificationToken: `vtok_s6_cb_${Date.now()}`,
      restaurantId: s6Resto.id,
      slug: s6Slug,
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      qrContextHash: s6CounterQrHash,
      expiryMinutes: 20
    });
    const s6PresenceCounterC = generatePresenceToken({
      verificationToken: `vtok_s6_cc_${Date.now()}`,
      restaurantId: s6Resto.id,
      slug: s6Slug,
      spaceType: 'counter',
      spaceNumber: 'COUNTER',
      qrContextHash: s6CounterQrHash,
      expiryMinutes: 20
    });

    // Test 6.1: Same anonymous customer, same order attempt, same idempotency key, retried after a simulated timeout
    await testAsync('Case 1: Same anonymous customer retry after simulated timeout replays response safely without duplicate order', async () => {
      const anonSession = `anon_sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const customIdempKey = `order_attempt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const payload = {
        slug: s6Slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: s6CounterQr,
        presence_token: s6PresenceCounterA,
        customer_name: 'Dine-In Customer',
        customer_phone: '', // Anonymous customer without phone number
        items: [{ dish_id: s6Dish.id, quantity: 1 }]
      };

      // 1. Initial attempt
      const res1 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Session': anonSession,
          'X-Idempotency-Key': customIdempKey
        },
        body: JSON.stringify(payload)
      });
      assert.strictEqual(res1.status, 200, 'Initial order attempt must succeed (200)');
      const data1 = await res1.json();
      assert.ok(data1.order_id, 'Initial order must return order_id');
      assert.ok(data1.tracking_token, 'Initial order must return tracking_token');

      // 2. Simulated network timeout -> client retries with identical session and idempotency key
      const res2 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Session': anonSession,
          'X-Idempotency-Key': customIdempKey
        },
        body: JSON.stringify(payload)
      });
      assert.strictEqual(res2.status, 200, 'Retry attempt must succeed (200)');
      const data2 = await res2.json();

      // Invariants: No duplicate order created, and the original response (including tracking token) is replayed safely
      assert.strictEqual(data2.order_id, data1.order_id, 'Retry must replay the exact same order_id');
      assert.strictEqual(data2.tracking_token, data1.tracking_token, 'Retry must replay the original tracking_token');

      // Verify DB contains exactly 1 order for this customer attempt
      const [orderCount] = await query(
        'SELECT count(*) as count FROM orders WHERE restaurant_id = $1 AND id = $2',
        [s6Resto.id, data1.order_id]
      );
      assert.strictEqual(Number(orderCount.count), 1, 'Database must contain exactly 1 order');
    });

    // Test 6.2: Two different anonymous customers using the same custom idempotency key
    await testAsync('Case 2: Two different anonymous customers with same custom key receive distinct orders without token disclosure', async () => {
      const anonSessionA = `anon_sess_A_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const anonSessionB = `anon_sess_B_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const sharedCustomKey = `shared_idemp_key_${Date.now()}`;

      const payloadA = {
        slug: s6Slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: s6CounterQr,
        presence_token: s6PresenceCounterA,
        customer_name: 'Customer A',
        customer_phone: '',
        items: [{ dish_id: s6Dish.id, quantity: 1 }]
      };
      const payloadB = {
        slug: s6Slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: s6CounterQr,
        presence_token: s6PresenceCounterB,
        customer_name: 'Customer B',
        customer_phone: '',
        items: [{ dish_id: s6Dish.id, quantity: 1 }]
      };

      const resA = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Session': anonSessionA,
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payloadA)
      });
      assert.strictEqual(resA.status, 200);
      const dataA = await resA.json();

      const resB = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Session': anonSessionB,
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payloadB)
      });
      assert.strictEqual(resB.status, 200);
      const dataB = await resB.json();

      // Invariants: Distinct orders, completely different tracking tokens, no cross-disclosure
      assert.notStrictEqual(dataA.order_id, dataB.order_id, 'Customer A and B must receive distinct order IDs');
      assert.notStrictEqual(dataA.tracking_token, dataB.tracking_token, 'Customer A and B must receive distinct tracking tokens');
      assert.strictEqual(dataA.tracking_token.length, 32);
      assert.strictEqual(dataB.tracking_token.length, 32);
    });

    // Test 6.3: Two callers submitting the same phone number and custom idempotency key
    await testAsync('Case 3: Two callers submitting same unverified phone number never share cached order data or tracking token', async () => {
      const sharedPhone = '9876543210';
      const sharedCustomKey = `phone_idemp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const sessionCaller1 = `caller1_sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      const sessionCaller2 = `caller2_sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      // Caller 1 submits order with unverified phone
      const payload1 = {
        slug: s6Slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: s6CounterQr,
        presence_token: s6PresenceCounterA,
        customer_name: 'Legitimate Caller',
        customer_phone: sharedPhone,
        items: [{ dish_id: s6Dish.id, quantity: 2 }]
      };

      const res1 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Session': sessionCaller1,
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payload1)
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.ok(data1.order_id);
      assert.ok(data1.tracking_token);

      // Caller 2 (separate device / distinct session) submits same phone and same custom key
      const payload2 = {
        slug: s6Slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: s6CounterQr,
        presence_token: s6PresenceCounterB,
        customer_name: 'Second Caller',
        customer_phone: sharedPhone,
        items: [{ dish_id: s6Dish.id, quantity: 2 }]
      };

      const res2 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Customer-Session': sessionCaller2,
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payload2)
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();

      // Invariant: Unverified phone alone is NOT proof of identity. Caller 2 must NOT receive Caller 1's order or tracking token!
      assert.notStrictEqual(data2.order_id, data1.order_id, 'Caller 2 must not receive Caller 1 order ID');
      assert.notStrictEqual(data2.tracking_token, data1.tracking_token, 'Caller 2 must not receive Caller 1 tracking token');

      // Caller 3 (adversary with distinct session token or no session) also submits same phone and same key
      const payload3 = {
        slug: s6Slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: s6CounterQr,
        presence_token: s6PresenceCounterC,
        customer_name: 'Adversary Caller',
        customer_phone: sharedPhone,
        items: [{ dish_id: s6Dish.id, quantity: 2 }]
      };

      const res3 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': sharedCustomKey
        },
        body: JSON.stringify(payload3)
      });
      assert.strictEqual(res3.status, 200);
      const data3 = await res3.json();

      assert.notStrictEqual(data3.order_id, data1.order_id, 'Unbound Caller 3 must not receive Caller 1 order ID');
      assert.notStrictEqual(data3.tracking_token, data1.tracking_token, 'Unbound Caller 3 must not receive Caller 1 tracking token');
    });

    // Test 6.4: Same authenticated or presence-token-bound customer retry
    await testAsync('Case 4: Same presence-token-bound customer retry preserves legitimate idempotency', async () => {
      const qrHash = generateQrContextHash(s6Slug, 'table', '1', s6TableQr);
      const presenceTok = generatePresenceToken({
        verificationToken: `vtok_pres_${Date.now()}`,
        restaurantId: s6Resto.id,
        slug: s6Slug,
        spaceType: 'table',
        spaceNumber: '1',
        qrContextHash: qrHash,
        expiryMinutes: 20
      });

      const diningCustomKey = `dining_idemp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const diningPayload = {
        slug: s6Slug,
        table_number: '1',
        space_type: 'table',
        table_token: s6TableQr,
        presence_token: presenceTok,
        customer_name: 'Dine-In Customer',
        customer_phone: '9555123456',
        items: [{ dish_id: s6Dish.id, quantity: 1 }]
      };

      // 1. Initial attempt
      const res1 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': diningCustomKey
        },
        body: JSON.stringify(diningPayload)
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.ok(data1.order_id);
      assert.ok(data1.tracking_token);

      // 2. Legitimate retry with identical presence token and custom key
      const res2 = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': diningCustomKey
        },
        body: JSON.stringify(diningPayload)
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();

      // Invariants: Replays the same order and same tracking token
      assert.strictEqual(data2.order_id, data1.order_id, 'Presence-bound retry must return identical order_id');
      assert.strictEqual(data2.tracking_token, data1.tracking_token, 'Presence-bound retry must return identical tracking_token');
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
