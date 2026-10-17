/**
 * TouchQR — Operator CLI Isolated Verification Test Suite
 *
 * PROVES:
 * 1. Invocation with no arguments defaults strictly to --dry-run.
 * 2. Default CLI mode and --dry-run mode CANNOT prune or delete source rows.
 * 3. --verify-only mode verifies existing archives without deleting or creating batches.
 * 4. Unsupported or conflicting flags are strictly rejected.
 * 5. Production databases are strictly rejected by the CLI safety guard.
 */

import assert from 'assert';
import pg from 'pg';
import {
  parseArchiveCliArgs,
  validateTargetDatabaseUrl,
  runArchiveAuditLogsCli
} from '../scripts/archive_audit_logs.js';
import { initializeArchivalSchema } from '../services/auditLogArchivalService.js';

const { Pool } = pg;
const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';

console.log('======================================================================');
console.log('🛠️  TOUCHQR ARCHIVAL OPERATOR CLI ISOLATED TEST SUITE');
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
    // Setup clean tables on disposable DB
    await pool.query('DROP TABLE IF EXISTS audit_log_archive_batches CASCADE;');
    await pool.query('DROP TABLE IF EXISTS audit_log_archives CASCADE;');
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

    await initializeArchivalSchema(async (sql, params) => pool.query(sql, params));

    // Seed test audit records:
    // 5 old eligible operational records (100 days old)
    // 3 old security/ineligible records (100 days old)
    // 2 recent eligible records (5 days old)
    for (let i = 1; i <= 5; i++) {
      await pool.query(
        'INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details, created_at) VALUES ($1, 1, $2, $3, $4, NOW() - INTERVAL \'100 days\')',
        [100 + i, 'tenant_admin', 'TENANT_DISH_CREATED', `Dish ${i}`]
      );
    }
    for (let i = 1; i <= 3; i++) {
      await pool.query(
        'INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details, created_at) VALUES ($1, 1, $2, $3, $4, NOW() - INTERVAL \'100 days\')',
        [200 + i, 'tenant_admin', 'SECURITY_LOGIN_FAILED', `Sec ${i}`]
      );
    }
    for (let i = 1; i <= 2; i++) {
      await pool.query(
        'INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details, created_at) VALUES ($1, 1, $2, $3, $4, NOW() - INTERVAL \'5 days\')',
        [300 + i, 'tenant_admin', 'TENANT_DISH_CREATED', `Recent ${i}`]
      );
    }

    const initialCountRes = await pool.query('SELECT COUNT(*)::int as count FROM audit_logs');
    const initialRowCount = initialCountRes.rows[0].count;
    assert.strictEqual(initialRowCount, 10, 'Expected exactly 10 seeded audit records');

    // -----------------------------------------------------------------
    // TEST 1: Default Invocation Mode
    // -----------------------------------------------------------------
    await test('1. Argument parsing: Empty arguments default strictly to dry-run mode', () => {
      const parsed = parseArchiveCliArgs([]);
      assert.strictEqual(parsed.mode, 'dry-run');
      assert.strictEqual(parsed.dryRun, true);
      assert.strictEqual(parsed.verifyOnly, false);
      assert.strictEqual(parsed.cutoffDays, 90);
    });

    // -----------------------------------------------------------------
    // TEST 2: Reject Conflicting Flags
    // -----------------------------------------------------------------
    await test('2. Argument parsing: Rejects conflicting --dry-run and --verify-only flags', () => {
      assert.throws(
        () => parseArchiveCliArgs(['--dry-run', '--verify-only']),
        /Conflicting flags/
      );
    });

    // -----------------------------------------------------------------
    // TEST 3: Reject Unsupported Flags and Invalid Parameters
    // -----------------------------------------------------------------
    await test('3. Argument parsing: Rejects unsupported or dangerous flags and invalid parameters', () => {
      assert.throws(
        () => parseArchiveCliArgs(['--delete-all']),
        /Unsupported flag: '--delete-all'/
      );
      assert.throws(
        () => parseArchiveCliArgs(['--prune-now']),
        /Unsupported flag: '--prune-now'/
      );
      assert.throws(
        () => parseArchiveCliArgs(['--force']),
        /Unsupported flag: '--force'/
      );
      assert.throws(
        () => parseArchiveCliArgs(['--cutoff-days', '0']),
        /Flag '--cutoff-days' requires a positive integer/
      );
      assert.throws(
        () => parseArchiveCliArgs(['--cutoff-days=-10']),
        /Flag '--cutoff-days' requires a positive integer/
      );
      assert.throws(
        () => parseArchiveCliArgs(['--archive-id', '-5']),
        /Flag '--archive-id' requires a positive integer/
      );
      assert.throws(
        () => parseArchiveCliArgs(['--archive-id=abc']),
        /requires an integer archive ID/
      );
    });

    // -----------------------------------------------------------------
    // TEST 4: Production URL Guard
    // -----------------------------------------------------------------
    await test('4. Production Safety Guard: Strictly rejects Neon cloud and production connection strings', () => {
      assert.throws(
        () => validateTargetDatabaseUrl('postgres://neondb_owner:secret@ep-morning.aws.neon.tech/neondb'),
        /CLI_SAFETY_VIOLATION.*production database/
      );
      assert.throws(
        () => validateTargetDatabaseUrl('postgres://postgres:secret@prod-db.example.com/touchqr_prod'),
        /CLI_SAFETY_VIOLATION.*production database/
      );
    });

    // -----------------------------------------------------------------
    // TEST 5: Default CLI Run Proof of Zero Deletion
    // -----------------------------------------------------------------
    await test('5. Default CLI mode (no args) executes dry-run and proves ZERO rows pruned or deleted', async () => {
      // Execute with empty args, supplying only the local test URL
      const result = await runArchiveAuditLogsCli(['--url', LOCAL_TEST_URL]);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, 'dry-run');
      assert.strictEqual(result.dryRun, true);
      assert.strictEqual(result.deletedCount, 0);
      assert.strictEqual(result.pruned, false);
      assert.strictEqual(result.candidateOperationalRecords, 5); // 5 eligible records older than 90 days
      assert.strictEqual(result.permanentlyProtectedRecords, 3); // 3 security records older than 90 days

      // VERIFY DB: 100% of rows MUST still exist untouched in audit_logs!
      const postRunCountRes = await pool.query('SELECT COUNT(*)::int as count FROM audit_logs');
      assert.strictEqual(
        postRunCountRes.rows[0].count,
        initialRowCount,
        'CRITICAL SAFETY INVARIANT: Default CLI run must not delete any rows'
      );

      // Verify exact IDs: all IDs 101-105, 201-203, 301-302 must still exist
      const allRows = await pool.query('SELECT id FROM audit_logs ORDER BY id ASC');
      const ids = allRows.rows.map(r => r.id);
      assert.deepStrictEqual(ids, [101, 102, 103, 104, 105, 201, 202, 203, 301, 302]);
    });

    // -----------------------------------------------------------------
    // TEST 6: Verify-Only Mode Proof of Zero Deletion & Zero Creation
    // -----------------------------------------------------------------
    await test('6. Verify-Only mode verifies archives without deleting, updating source rows, or creating batches', async () => {
      // Seed 1 archive entry with 1 batch
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-cli-1', 'idem-cli-1', 'vault/cli1.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 101, 105, 5, 1024,
          'fhash_cli', 'chash_cli', 'COMMITTED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status, committed_at
        ) VALUES (
          $1, 1, 5, ARRAY[101, 102, 103, 104, 105], 'COMMITTED', CURRENT_TIMESTAMP
        )
      `, [archiveId]);

      const initialBatchesCountRes = await pool.query('SELECT COUNT(*)::int as count FROM audit_log_archive_batches');
      const initialBatchCount = initialBatchesCountRes.rows[0].count;

      // Execute in --verify-only mode
      const result = await runArchiveAuditLogsCli(['--verify-only', '--url', LOCAL_TEST_URL]);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, 'verify-only');
      assert.strictEqual(result.verifyOnly, true);
      assert.strictEqual(result.deletedCount, 0);
      assert.strictEqual(result.pruned, false);
      assert.strictEqual(result.archivesVerified, 1);
      assert.strictEqual(result.archives[0].committedBatches, 1);
      assert.strictEqual(result.archives[0].pendingBatches, 0);

      // VERIFY DB: Zero rows deleted from audit_logs
      const postVerifyCount = await pool.query('SELECT COUNT(*)::int as count FROM audit_logs');
      assert.strictEqual(postVerifyCount.rows[0].count, initialRowCount);

      // VERIFY DB: Zero new batches created
      const postVerifyBatches = await pool.query('SELECT COUNT(*)::int as count FROM audit_log_archive_batches');
      assert.strictEqual(postVerifyBatches.rows[0].count, initialBatchCount);
    });

  } finally {
    await pool.query('DELETE FROM audit_log_archive_batches CASCADE;').catch(() => {});
    await pool.query('DELETE FROM audit_log_archives CASCADE;').catch(() => {});
    await pool.query('DELETE FROM audit_logs WHERE id >= 100 AND id <= 400;').catch(() => {});
    await pool.end();
  }

  console.log('\n======================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal CLI test error:', err);
  process.exit(1);
});
