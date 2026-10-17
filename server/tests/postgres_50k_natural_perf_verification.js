/**
 * Real PostgreSQL 16 Disposable 50,000-Row Natural Performance Verification Script
 *
 * CRITICAL SAFETY & INTEGRITY INVARIANTS:
 * 1. Strictly targets local disposable container (127.0.0.1:5432 / touchqr_disposable_test).
 * 2. NEVER touches Neon or remote production databases.
 * 3. NO FORCED PLANNER SETTINGS (enable_seqscan remains ON).
 *    Validates that PostgreSQL query planner naturally chooses the index scans based on table statistics.
 */

import assert from 'assert';
import pg from 'pg';
import {
  runAuditLogsIndexMigration,
  verifyIndexDefinitionMatch,
  MIGRATION_OWNED_INDEX_TARGETS
} from '../scripts/migrate_audit_logs_indexes.js';
import { isProductionDatabaseUrl } from '../scripts/migrate_production_postgres.js';

const { Pool } = pg;

const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';

// Safety Guard: Strictly verify target is localhost
assert.strictEqual(isProductionDatabaseUrl(LOCAL_TEST_URL), false, 'Test URL must NOT be recognized as production');
assert(LOCAL_TEST_URL.includes('127.0.0.1') || LOCAL_TEST_URL.includes('localhost'), 'Must strictly target localhost');

console.log('======================================================================');
console.log('🐘 50,000-ROW NATURAL POSTGRESQL 16 PERFORMANCE & SAFETY VERIFICATION');
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
    // 0. Setup clean tables & seed 50,000 rows
    console.log('  📦 Step 0: Initializing tables and seeding 50,000 synthetic audit records...');
    await pool.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
    await pool.query('DROP TABLE IF EXISTS restaurants CASCADE;');

    await pool.query(`
      CREATE TABLE restaurants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        logo VARCHAR(1000)
      );
    `);

    // Insert 15 restaurants
    for (let r = 1; r <= 15; r++) {
      await pool.query(
        'INSERT INTO restaurants (id, name, slug, logo) VALUES ($1, $2, $3, $4)',
        [r, `Restaurant ${r}`, `resto-${r}`, `/logos/resto_${r}.png`]
      );
    }

    await pool.query(`
      CREATE TABLE audit_logs (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE SET NULL,
        actor_role VARCHAR(50),
        action VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // High-speed bulk generation of 50,000 synthetic records
    await pool.query(`
      INSERT INTO audit_logs (restaurant_id, actor_role, action, details, created_at)
      SELECT 
        (i % 15) + 1 AS restaurant_id,
        CASE (i % 4)
          WHEN 0 THEN 'superadmin'
          WHEN 1 THEN 'restaurant_admin'
          WHEN 2 THEN 'tenant_admin'
          ELSE 'system'
        END AS actor_role,
        CASE (i % 6)
          WHEN 0 THEN 'TENANT_DISH_CREATED'
          WHEN 1 THEN 'SECURITY_LOGIN'
          WHEN 2 THEN 'TENANT_CATEGORY_UPDATED'
          WHEN 3 THEN 'GRANT_ADMIN_ACCESS'
          WHEN 4 THEN 'PRE_DEBIT_NOTIFICATION_RECEIVED'
          ELSE 'TENANT_SETTINGS_UPDATED'
        END AS action,
        '{"batch": ' || i || ', "event": "test", "dishId": ' || (i % 200) || '}' AS details,
        NOW() - ((i || ' seconds')::INTERVAL) AS created_at
      FROM generate_series(1, 50000) AS s(i);
    `);

    const countCheck = await pool.query('SELECT COUNT(*) as cnt FROM audit_logs;');
    const totalRows = parseInt(countCheck.rows[0].cnt, 10);
    assert.strictEqual(totalRows, 50000, 'Must have exactly 50,000 rows seeded');
    console.log(`  ✅ 50,000 synthetic rows successfully seeded across 15 tenants.\n`);

    // -----------------------------------------------------------------
    // TEST 1: Fresh Concurrent Migration Apply
    // -----------------------------------------------------------------
    let migrationReport = null;
    await test('1. Fresh Apply: Concurrent index creation on 50,000-row table', async () => {
      migrationReport = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(migrationReport.success, true);
      assert.strictEqual(migrationReport.executed.length, 2);
      assert.strictEqual(migrationReport.skipped.length, 0);

      // Verify indexes in PostgreSQL system catalog
      const idxRes = await pool.query(`
        SELECT i.relname AS indexname, ix.indisvalid AS is_valid, pg_get_indexdef(ix.indexrelid) AS indexdef
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        WHERE t.relname = 'audit_logs' AND i.relname IN ('idx_audit_logs_created_id', 'idx_audit_logs_resto_created_id');
      `);

      assert.strictEqual(idxRes.rows.length, 2);
      for (const row of idxRes.rows) {
        assert.strictEqual(row.is_valid, true);
      }
    });

    // -----------------------------------------------------------------
    // Run ANALYZE to update statistics
    // -----------------------------------------------------------------
    console.log('\n  📊 Running ANALYZE audit_logs to update PostgreSQL optimizer statistics...');
    await pool.query('ANALYZE audit_logs;');
    await pool.query('ANALYZE restaurants;');
    console.log('  ✓ Optimizer statistics updated.\n');

    // -----------------------------------------------------------------
    // TEST 2: NATURAL Global Pagination Plan (enable_seqscan = ON)
    // -----------------------------------------------------------------
    await test('2. Natural Global Pagination: Optimizer naturally chooses idx_audit_logs_created_id (NO forced planner settings)', async () => {
      // Verify enable_seqscan is ON (natural query planning)
      const settingRes = await pool.query("SHOW enable_seqscan;");
      assert.strictEqual(settingRes.rows[0].enable_seqscan, 'on', 'enable_seqscan MUST be ON to verify natural planner choice');

      const explainRes = await pool.query(`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT 
          a.id, a.restaurant_id, a.actor_role, a.action, a.details, a.created_at,
          r.name AS restaurant_name, r.logo AS restaurant_logo
        FROM audit_logs a
        LEFT JOIN restaurants r ON r.id = a.restaurant_id
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 50 OFFSET 0;
      `);

      const planLines = explainRes.rows.map(r => r['QUERY PLAN']);
      const planText = planLines.join('\n');

      console.log('     --- NATURAL GLOBAL QUERY PLAN ---');
      planLines.forEach(l => console.log(`     ${l}`));
      console.log('     ---------------------------------');

      // Assertions:
      // 1. Must use Index Scan using idx_audit_logs_created_id on audit_logs
      assert(
        planText.includes('Index Scan') && planText.includes('idx_audit_logs_created_id'),
        `Query planner must naturally choose idx_audit_logs_created_id. Plan: ${planText}`
      );
      // 2. Must NOT perform a Sort node (index completely eliminates sorting 50k rows)
      assert(!planText.includes('Sort Method'), 'Pre-sorted index scan must eliminate Sort node');
    });

    // -----------------------------------------------------------------
    // TEST 3: NATURAL Tenant 360 Timeline Plan (enable_seqscan = ON)
    // -----------------------------------------------------------------
    await test('3. Natural Tenant 360 Plan: Optimizer naturally chooses idx_audit_logs_resto_created_id (NO forced planner settings)', async () => {
      const settingRes = await pool.query("SHOW enable_seqscan;");
      assert.strictEqual(settingRes.rows[0].enable_seqscan, 'on', 'enable_seqscan MUST be ON');

      const explainRes = await pool.query(`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT id, actor_role, action, details, created_at 
        FROM audit_logs 
        WHERE restaurant_id = 5 
        ORDER BY created_at DESC, id DESC 
        LIMIT 50;
      `);

      const planLines = explainRes.rows.map(r => r['QUERY PLAN']);
      const planText = planLines.join('\n');

      console.log('     --- NATURAL TENANT 360 PLAN ---');
      planLines.forEach(l => console.log(`     ${l}`));
      console.log('     ---------------------------------');

      // Assertions:
      assert(
        planText.includes('idx_audit_logs_resto_created_id'),
        `Query planner must naturally choose idx_audit_logs_resto_created_id. Plan: ${planText}`
      );
      assert(!planText.includes('Sort Method'), 'Tenant index scan must eliminate Sort node');
    });

    // -----------------------------------------------------------------
    // TEST 4: Repeat Apply Idempotency
    // -----------------------------------------------------------------
    await test('4. Repeat Apply: Strictly idempotent on 50k dataset (0 DDL executed)', async () => {
      const repeatReport = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(repeatReport.success, true);
      assert.strictEqual(repeatReport.executed.length, 0);
      assert.strictEqual(repeatReport.skipped.length, 2);
    });

    // -----------------------------------------------------------------
    // TEST 5: Definition Mismatch Safety Halt
    // -----------------------------------------------------------------
    await test('5. Definition Mismatch Safety Halt: Halts execution without --allow-mismatched-rebuild', async () => {
      await pool.query('DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_created_id;');
      await pool.query('CREATE INDEX CONCURRENTLY idx_audit_logs_created_id ON audit_logs (created_at ASC);');

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

      // Verify the mismatched index is preserved
      const checkRes = await pool.query("SELECT pg_get_indexdef(c.oid) AS def FROM pg_class c WHERE c.relname = 'idx_audit_logs_created_id'");
      assert.strictEqual(checkRes.rows.length, 1);
    });

    // -----------------------------------------------------------------
    // TEST 6: Explicit Authorized Rebuild
    // -----------------------------------------------------------------
    await test('6. Explicit Authorized Rebuild: Rebuilds mismatched index with --allow-mismatched-rebuild', async () => {
      const fixReport = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false,
        allowMismatchedRebuild: true
      });

      assert.strictEqual(fixReport.success, true);
      assert(fixReport.executed.includes('index:idx_audit_logs_created_id'));

      const checkRes = await pool.query("SELECT pg_get_indexdef(c.oid) AS def FROM pg_class c WHERE c.relname = 'idx_audit_logs_created_id'");
      assert.strictEqual(checkRes.rows.length, 1);
      assert(verifyIndexDefinitionMatch(checkRes.rows[0].def, ['created_at DESC', 'id DESC']));
    });

    // -----------------------------------------------------------------
    // TEST 7: Invalid Index Recovery & Foreign Index Protection
    // -----------------------------------------------------------------
    await test('7. Invalid Index Recovery: Targets only migration-owned targets; foreign index preserved', async () => {
      // Create foreign invalid index
      await pool.query('CREATE INDEX foreign_feature_idx ON audit_logs (action);');
      await pool.query("UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'foreign_feature_idx'::regclass;");

      // Corrupt migration-owned index
      await pool.query("UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'idx_audit_logs_resto_created_id'::regclass;");

      const recoverReport = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        dryRun: false
      });

      assert.strictEqual(recoverReport.success, true);
      assert(recoverReport.invalidFixed.includes('idx_audit_logs_resto_created_id'));
      assert(!recoverReport.invalidFixed.includes('foreign_feature_idx'));

      // Check foreign index was preserved untouched
      const fCheck = await pool.query("SELECT relname FROM pg_class WHERE relname = 'foreign_feature_idx'");
      assert.strictEqual(fCheck.rows.length, 1);

      await pool.query('DROP INDEX IF EXISTS foreign_feature_idx;');
    });

    // -----------------------------------------------------------------
    // TEST 8: Concurrent Rollback & Row Count Integrity
    // -----------------------------------------------------------------
    await test('8. Concurrent Rollback: Drops indexes with all 50,000 rows intact', async () => {
      const rollbackReport = await runAuditLogsIndexMigration({
        migrationUrl: LOCAL_TEST_URL,
        rollback: true
      });

      assert.strictEqual(rollbackReport.success, true);
      assert.strictEqual(rollbackReport.executed.length, 2);

      const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM audit_logs;');
      assert.strictEqual(parseInt(finalCount.rows[0].cnt, 10), 50000, 'All 50,000 rows must remain 100% intact');
    });

  } finally {
    await pool.end();
  }

  console.log('\n======================================================================');
  console.log(`📊 50,000-ROW POSTGRESQL VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
