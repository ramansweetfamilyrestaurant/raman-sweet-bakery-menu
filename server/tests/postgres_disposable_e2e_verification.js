/**
 * Real PostgreSQL 16 Disposable Environment Verification Script for Step 5C
 *
 * SAFETY INVARIANT:
 * STRICTLY tests against local disposable PostgreSQL 16 (127.0.0.1:5432 / touchqr_disposable_test).
 * Fails immediately if pointed to any remote or production host.
 */

import assert from 'assert';
import pg from 'pg';
import {
  runAuditLogsIndexMigration,
  AUDIT_LOGS_INDEX_MIGRATION_DDL,
  MIGRATION_OWNED_INDEX_TARGETS,
  verifyIndexDefinitionMatch
} from '../scripts/migrate_audit_logs_indexes.js';
import { isProductionDatabaseUrl } from '../scripts/migrate_production_postgres.js';

const { Pool } = pg;

const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';

// Safety Guard: Strictly verify target is localhost
assert.strictEqual(isProductionDatabaseUrl(LOCAL_TEST_URL), false, 'Test URL must NOT be recognized as production');
assert(LOCAL_TEST_URL.includes('127.0.0.1') || LOCAL_TEST_URL.includes('localhost'), 'Must strictly target localhost');

console.log('======================================================================');
console.log('🐘 REAL POSTGRESQL 16 DISPOSABLE ENVIRONMENT E2E VERIFICATION');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function run() {
  const pool = new Pool({ connectionString: LOCAL_TEST_URL });

  try {
    // 0. Setup clean table & seed realistic test records
    await pool.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
    await pool.query(`
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        restaurant_id INT,
        actor_role VARCHAR(50),
        action VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert 100 sample audit records across 3 tenants
    for (let i = 1; i <= 100; i++) {
      const restoId = (i % 3) + 1;
      const role = i % 4 === 0 ? 'superadmin' : 'restaurant_admin';
      const action = i % 2 === 0 ? 'TENANT_DISH_CREATED' : 'SECURITY_LOGIN';
      await pool.query(
        'INSERT INTO audit_logs (restaurant_id, actor_role, action, details, created_at) VALUES ($1, $2, $3, $4, NOW() - ($5 || \' hours\')::INTERVAL)',
        [restoId, role, action, JSON.stringify({ dishId: i }), i]
      );
    }
    console.log('  📦 Setup: Base audit_logs table created with 100 seeded rows.\n');

    // -----------------------------------------------------------------
    // TEST 1: Fresh Migration Apply with CREATE INDEX CONCURRENTLY
    // -----------------------------------------------------------------
    await test('1. Fresh Apply: Creates indexes CONCURRENTLY outside transaction', async () => {
      const result = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executed.length, 2);
      assert.strictEqual(result.skipped.length, 0);

      // Verify in pg_index that both indexes are valid
      const idxRes = await pool.query(`
        SELECT i.relname AS indexname, ix.indisvalid AS is_valid, pg_get_indexdef(ix.indexrelid) AS indexdef
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE t.relname = 'audit_logs' AND i.relname IN ('idx_audit_logs_created_id', 'idx_audit_logs_resto_created_id');
      `);

      assert.strictEqual(idxRes.rows.length, 2);
      for (const row of idxRes.rows) {
        assert.strictEqual(row.is_valid, true, `Index ${row.indexname} must be marked valid`);
      }

      // Verify query planner uses idx_audit_logs_created_id without Sort node
      const client = await pool.connect();
      try {
        await client.query('SET enable_seqscan = OFF;');
        const explainGlobal = await client.query(`
          EXPLAIN SELECT id, restaurant_id, actor_role, action, created_at
          FROM audit_logs
          ORDER BY created_at DESC, id DESC
          LIMIT 50;
        `);
        const globalPlan = explainGlobal.rows.map(r => r['QUERY PLAN']).join('\n');
        assert(
          globalPlan.includes('idx_audit_logs_created_id'),
          `Planner must use idx_audit_logs_created_id. Plan: ${globalPlan}`
        );
        assert(!globalPlan.includes('->  Sort'), 'Index scan must eliminate Sort node');

        const explainTenant = await client.query(`
          EXPLAIN SELECT id, restaurant_id, actor_role, action, created_at
          FROM audit_logs
          WHERE restaurant_id = 1
          ORDER BY created_at DESC, id DESC
          LIMIT 50;
        `);
        const tenantPlan = explainTenant.rows.map(r => r['QUERY PLAN']).join('\n');
        assert(
          tenantPlan.includes('idx_audit_logs_resto_created_id'),
          `Planner must use idx_audit_logs_resto_created_id. Plan: ${tenantPlan}`
        );
      } finally {
        await client.query('SET enable_seqscan = ON;').catch(() => {});
        client.release();
      }
    });

    // -----------------------------------------------------------------
    // TEST 2: Idempotent Repeat Apply
    // -----------------------------------------------------------------
    await test('2. Repeat Apply: Strictly idempotent (0 DDL executed, 2 skipped)', async () => {
      const result = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.executed.length, 0, 'No DDL should be executed on repeat run');
      assert.strictEqual(result.skipped.length, 2, 'Both valid existing indexes must be skipped');
    });

    // -----------------------------------------------------------------
    // TEST 3: Definition Mismatch Safety Halt (Refuses Auto-Drop)
    // -----------------------------------------------------------------
    await test('3. Definition Mismatch Safety Halt: Halts execution if index exists with wrong columns/order', async () => {
      // Intentionally drop and recreate idx_audit_logs_created_id with wrong sort (ASC)
      await pool.query('DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_created_id;');
      await pool.query('CREATE INDEX CONCURRENTLY idx_audit_logs_created_id ON audit_logs (created_at ASC);');

      // Attempt migration WITHOUT --allow-mismatched-rebuild -> must THROW
      await assert.rejects(
        async () => {
          await runAuditLogsIndexMigration({
            migrationUrl: LOCAL_TEST_URL,
            dryRun: false,
            allowMismatchedRebuild: false
          });
        },
        (err) => {
          assert(err.message.includes('INDEX_DEFINITION_MISMATCH_SAFETY_HALT'));
          assert(err.message.includes('--allow-mismatched-rebuild'));
          return true;
        }
      );

      // Verify the mismatched index was NOT dropped (halt preserved it)
      const checkRes = await pool.query("SELECT pg_get_indexdef(c.oid) AS def FROM pg_class c WHERE c.relname = 'idx_audit_logs_created_id'");
      assert(checkRes.rows.length === 1);
      assert(checkRes.rows[0].def.includes('created_at'));
    });

    // -----------------------------------------------------------------
    // TEST 4: Authorized Rebuild with --allow-mismatched-rebuild
    // -----------------------------------------------------------------
    await test('4. Operator Authorized Rebuild: Rebuilds mismatched index when flag is supplied', async () => {
      const result = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false,
        allowMismatchedRebuild: true
      });

      assert.strictEqual(result.success, true);
      assert(result.executed.includes('index:idx_audit_logs_created_id'));

      // Verify that the index is now corrected to DESC, id DESC
      const checkRes = await pool.query("SELECT pg_get_indexdef(c.oid) AS def FROM pg_class c WHERE c.relname = 'idx_audit_logs_created_id'");
      assert.strictEqual(checkRes.rows.length, 1);
      assert(verifyIndexDefinitionMatch(checkRes.rows[0].def, ['created_at DESC', 'id DESC']));
    });

    // -----------------------------------------------------------------
    // TEST 5: Interrupted / Invalid Index Recovery (Restricted to Targets)
    // -----------------------------------------------------------------
    await test('5. Invalid Index Recovery: Detects and fixes invalid index for migration-owned targets', async () => {
      // Simulate an interrupted build by setting indisvalid = false
      await pool.query("UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'idx_audit_logs_resto_created_id'::regclass;");

      const checkPre = await pool.query("SELECT indisvalid FROM pg_index WHERE indexrelid = 'idx_audit_logs_resto_created_id'::regclass;");
      assert.strictEqual(checkPre.rows[0].indisvalid, false, 'Index must be marked invalid before test');

      const result = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(result.success, true);
      assert(result.invalidFixed.includes('idx_audit_logs_resto_created_id'));

      // Verify index is now restored and valid
      const checkPost = await pool.query("SELECT indisvalid FROM pg_index WHERE indexrelid = 'idx_audit_logs_resto_created_id'::regclass;");
      assert.strictEqual(checkPost.rows[0].indisvalid, true, 'Index must be restored to valid');
    });

    // -----------------------------------------------------------------
    // TEST 6: Foreign Invalid Index Preservation
    // -----------------------------------------------------------------
    await test('6. Foreign Invalid Index Protection: Non-migration invalid indexes are untouched', async () => {
      // Create a foreign index and corrupt it
      await pool.query('CREATE INDEX foreign_test_idx ON audit_logs (action);');
      await pool.query("UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'foreign_test_idx'::regclass;");

      const result = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(result.success, true);
      assert(!result.invalidFixed.includes('foreign_test_idx'), 'Must NOT touch foreign index');

      // Verify foreign index still exists
      const foreignCheck = await pool.query("SELECT relname FROM pg_class WHERE relname = 'foreign_test_idx'");
      assert.strictEqual(foreignCheck.rows.length, 1, 'Foreign index must remain untouched');

      await pool.query('DROP INDEX IF EXISTS foreign_test_idx;');
    });

    // -----------------------------------------------------------------
    // TEST 7: Concurrent Rollback Execution & Zero Data Loss
    // -----------------------------------------------------------------
    await test('7. Concurrent Rollback: Drops indexes concurrently with ZERO data loss', async () => {
      const countBefore = await pool.query('SELECT COUNT(*) as cnt FROM audit_logs;');
      const preRows = parseInt(countBefore.rows[0].cnt, 10);
      assert.strictEqual(preRows, 100);

      const result = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        rollback: true
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.rollback, true);
      assert.strictEqual(result.executed.length, 2);

      // Verify indexes are dropped
      const postIdx = await pool.query(`
        SELECT i.relname FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE t.relname = 'audit_logs' AND i.relname IN ('idx_audit_logs_created_id', 'idx_audit_logs_resto_created_id');
      `);
      assert.strictEqual(postIdx.rows.length, 0, 'Both indexes must be dropped');

      // Verify all 100 rows are 100% intact
      const countAfter = await pool.query('SELECT COUNT(*) as cnt FROM audit_logs;');
      const postRows = parseInt(countAfter.rows[0].cnt, 10);
      assert.strictEqual(postRows, 100, 'All audit records must be preserved with ZERO loss');
    });

  } finally {
    await pool.end();
  }

  console.log('\n======================================================================');
  console.log(`📊 REAL POSTGRESQL VERIFICATION: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal error during real PostgreSQL verification:', err);
  process.exit(1);
});
