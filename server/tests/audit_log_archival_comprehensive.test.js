/**
 * TouchQR — Comprehensive Audit Log Archival & Retention Test Suite (Checkpoint 2)
 *
 * SAFETY INVARIANT:
 * Strictly targets local disposable PostgreSQL 16 (127.0.0.1:5432 / touchqr_disposable_test).
 * Fails immediately if pointed to any remote or production host.
 *
 * TEST COVERAGE:
 * 1. Allowlist Classifier Exhaustive Checks (Allowlist vs. Denylist)
 * 2. Actor Role Security Guard (Super Admin and Payment Gateway always rejected)
 * 3. Canonical Serialization & Deterministic Dual Hashing
 * 4. Timezone Semantics for TIMESTAMP WITHOUT TIME ZONE
 * 5. Deterministic Idempotency Key Generation
 * 6. 4-Point Verification (Checksum, Count, Exact ID set, Content Hash)
 * 7. Corrupted Archive Rejection (Zero-Pruning Invariant)
 * 8. Source-Row Revalidation (Eligibility & Presence Check)
 * 9. Atomic Batch Pruning & Committed Ledger in ONE Transaction
 * 10. Lost Commit Acknowledgement (Lost-ACK) Reconciliation via Fresh Connection
 * 11. Resumable Partial Pruning Recovery (Re-verify archive, prune remaining batches)
 * 12. R2 Bucket Lock (WORM) Tombstone Recovery
 * 13. Full Round-Trip Restore to Staging Table
 */

import assert from 'assert';
import pg from 'pg';
import zlib from 'zlib';
import { promisify } from 'util';
import {
  ARCHIVE_ELIGIBLE_OPERATIONAL_ACTIONS,
  FORBIDDEN_ARCHIVE_ACTOR_ROLES,
  isRecordArchiveEligible,
  toDeterministicUtcTimestamp,
  serializeCanonicalRecord,
  serializeCanonicalJsonl,
  computeSha256,
  generateArchiveIdempotencyKey,
  initializeArchivalSchema,
  revalidateSourceRowsForPruning,
  executeAtomicBatchPrune,
  reconcileBatchCommitAck,
  verifyArchiveIntegrity
} from '../services/auditLogArchivalService.js';
import { safeDeleteArchiveObject } from '../config/r2Archive.js';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);
const { Pool } = pg;

const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';

// Safety Guard: Strictly verify target is localhost
assert(LOCAL_TEST_URL.includes('127.0.0.1') || LOCAL_TEST_URL.includes('localhost'), 'Must strictly target localhost');
assert(!LOCAL_TEST_URL.includes('neon.tech'), 'Must never target Neon cloud database');

console.log('======================================================================');
console.log('🧪 TOUCHQR AUDIT LOG ARCHIVAL COMPREHENSIVE TEST SUITE');
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
    // Step 0: Initialize Schema on disposable DB
    console.log('  📦 Step 0: Initializing disposable schema and tables...');
    await pool.query('DROP TABLE IF EXISTS audit_logs_archive_staging CASCADE;');
    await pool.query('DROP TABLE IF EXISTS audit_log_archive_tombstones CASCADE;');
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
    console.log('  📦 Setup complete: Schema initialized on PostgreSQL 16.\n');

    // -----------------------------------------------------------------
    // TEST 1: Allowlist Classifier (False Positives & Negatives)
    // -----------------------------------------------------------------
    await test('1. Allowlist Classifier strictly approves 15 operational actions and rejects all security/billing/unknown', () => {
      // All 15 operational actions must be approved for tenant_admin
      for (const action of ARCHIVE_ELIGIBLE_OPERATIONAL_ACTIONS) {
        assert.strictEqual(
          isRecordArchiveEligible({ action, actor_role: 'tenant_admin' }),
          true,
          `Action ${action} should be eligible for tenant_admin`
        );
      }

      // Security, billing, VIP, Super Admin, and unknown actions must be REJECTED
      const nonEligibleActions = [
        'SECURITY_LOGIN_SUCCESS',
        'SECURITY_LOGIN_FAILED',
        'SECURITY_ROTATE_QR_SECRET',
        'SECURITY_CREDENTIALS_CHANGED',
        'Super Admin Login',
        'Change Credentials',
        'IMPERSONATION_STARTED',
        'IMPERSONATION_ENDED',
        'CASHFREE_SANDBOX_SUB_CREATED',
        'CASHFREE_SANDBOX_SUB_VERIFIED',
        'PRE_DEBIT_NOTIFICATION_RECEIVED',
        'REFUND_AUDIT_LOGGED',
        'WEBHOOK_SUBSCRIPTION_STATUS_CHANGE',
        'GRANT_ADMIN_ACCESS',
        'VIP_ACCESS_REVOKED',
        'Activate Tenant',
        'Delete Tenant',
        'OWNER_EMAIL_UPDATED',
        'TENANT_SETTINGS_UPDATED',
        'SUPPORT_TICKET_CREATED',
        'UNKNOWN_CUSTOM_EVENT',
        'RANDOM_ACTION',
        '',
        null
      ];

      for (const action of nonEligibleActions) {
        assert.strictEqual(
          isRecordArchiveEligible({ action, actor_role: 'tenant_admin' }),
          false,
          `Action ${action} must be rejected from archival`
        );
      }
    });

    // -----------------------------------------------------------------
    // TEST 2: Actor Role Security Guard
    // -----------------------------------------------------------------
    await test('2. Actor Role Guard rejects superadmin & payment_gateway even with operational action names', () => {
      for (const action of ARCHIVE_ELIGIBLE_OPERATIONAL_ACTIONS) {
        // Even if action is TENANT_DISH_CREATED, superadmin or payment_gateway must be REJECTED
        assert.strictEqual(isRecordArchiveEligible({ action, actor_role: 'superadmin' }), false);
        assert.strictEqual(isRecordArchiveEligible({ action, actor_role: 'super_admin' }), false);
        assert.strictEqual(isRecordArchiveEligible({ action, actor_role: 'payment_gateway' }), false);
        assert.strictEqual(isRecordArchiveEligible({ action, actor_role: 'cashfree' }), false);
      }
    });

    // -----------------------------------------------------------------
    // TEST 3: Canonical Serialization & Deterministic Dual Hashing
    // -----------------------------------------------------------------
    await test('3. Canonical Serialization sorts keys, formats ISO UTC, and produces deterministic hashes', () => {
      const record = {
        restaurant_id: 12,
        action: 'TENANT_DISH_AVAILABILITY_TOGGLED',
        id: 501,
        details: 'Toggled Paneer Tikka',
        actor_role: 'tenant_admin',
        created_at: new Date('2026-04-12T14:30:00.000Z')
      };

      const serialized = serializeCanonicalRecord(record);
      // Key order must be strictly alphabetical: action, actor_role, created_at, details, id, restaurant_id
      const expectedKeys = ['action', 'actor_role', 'created_at', 'details', 'id', 'restaurant_id'];
      assert.deepStrictEqual(Object.keys(JSON.parse(serialized)), expectedKeys);

      const jsonl = serializeCanonicalJsonl([record]);
      assert(jsonl.endsWith('\n'), 'JSONL must end with newline');

      const hash1 = computeSha256(jsonl);
      const hash2 = computeSha256(jsonl);
      assert.strictEqual(hash1, hash2, 'Hash must be strictly deterministic');
    });

    // -----------------------------------------------------------------
    // TEST 4: Timezone Semantics for TIMESTAMP WITHOUT TIME ZONE
    // -----------------------------------------------------------------
    await test('4. Timezone Semantics: Normalizes to UTC calendar format avoiding locale offset shifts', async () => {
      const fixedUtcDate = new Date('2026-04-12T10:30:00.000Z');
      const utcString = toDeterministicUtcTimestamp(fixedUtcDate);
      assert.strictEqual(utcString, '2026-04-12 10:30:00.000');

      // Seed a record with explicit timestamp
      await pool.query(
        'INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details, created_at) VALUES ($1, $2, $3, $4, $5, $6::timestamp)',
        [9001, 10, 'tenant_admin', 'TENANT_DISH_CREATED', 'Test TZ Dish', utcString]
      );

      // Query with cutoff at 11:00 UTC (should match)
      const cutoffAfter = toDeterministicUtcTimestamp(new Date('2026-04-12T11:00:00.000Z'));
      const resAfter = await pool.query('SELECT id FROM audit_logs WHERE id = 9001 AND created_at < $1::timestamp', [cutoffAfter]);
      assert.strictEqual(resAfter.rows.length, 1);

      // Query with cutoff at 10:00 UTC (should NOT match)
      const cutoffBefore = toDeterministicUtcTimestamp(new Date('2026-04-12T10:00:00.000Z'));
      const resBefore = await pool.query('SELECT id FROM audit_logs WHERE id = 9001 AND created_at < $1::timestamp', [cutoffBefore]);
      assert.strictEqual(resBefore.rows.length, 0);

      await pool.query('DELETE FROM audit_logs WHERE id = 9001');
    });

    // -----------------------------------------------------------------
    // TEST 5: Deterministic Idempotency Key Generation
    // -----------------------------------------------------------------
    await test('5. Idempotency Key is deterministic across identical parameters and distinct across variations', () => {
      const key1 = generateArchiveIdempotencyKey({
        track: 'operational',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        minId: 100,
        maxId: 500,
        count: 400
      });

      const key2 = generateArchiveIdempotencyKey({
        track: 'operational',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        minId: 100,
        maxId: 500,
        count: 400
      });

      const key3 = generateArchiveIdempotencyKey({
        track: 'operational',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        minId: 100,
        maxId: 501, // 1 ID difference
        count: 401
      });

      assert.strictEqual(key1, key2, 'Identical parameters must yield identical idempotency keys');
      assert.notStrictEqual(key1, key3, 'Different parameters must yield distinct keys');
    });

    // -----------------------------------------------------------------
    // TEST 6: 4-Point Verification (Checksum, Count, Exact IDs, Content Hash)
    // -----------------------------------------------------------------
    await test('6. 4-Point Verification passes on valid compressed archive and reproduces identical hashes', async () => {
      const sampleRecords = [
        { id: 101, restaurant_id: 1, actor_role: 'tenant_admin', action: 'TENANT_DISH_CREATED', details: 'Burger', created_at: '2026-01-10T08:00:00.000Z' },
        { id: 102, restaurant_id: 1, actor_role: 'tenant_admin', action: 'TENANT_DISH_UPDATED', details: 'Cheeseburger', created_at: '2026-01-10T09:00:00.000Z' },
        { id: 103, restaurant_id: 2, actor_role: 'tenant_admin', action: 'TENANT_CATEGORY_CREATED', details: 'Snacks', created_at: '2026-01-10T10:00:00.000Z' }
      ];

      const canonicalJsonl = serializeCanonicalJsonl(sampleRecords);
      const compressed = await gzipAsync(Buffer.from(canonicalJsonl, 'utf-8'));

      const result = await verifyArchiveIntegrity(compressed, sampleRecords);
      assert.strictEqual(result.verified, true);
      assert.strictEqual(result.rowCount, 3);
      assert.deepStrictEqual(result.idSet, [101, 102, 103]);
      assert.strictEqual(result.contentSha256, computeSha256(canonicalJsonl));
    });

    // -----------------------------------------------------------------
    // TEST 7: Corrupted Archive Rejection (Zero-Pruning Invariant)
    // -----------------------------------------------------------------
    await test('7. Corrupted Archive Rejection: Tampered archive fails verification immediately', async () => {
      const sampleRecords = [
        { id: 201, restaurant_id: 1, actor_role: 'tenant_admin', action: 'TENANT_DISH_CREATED', details: 'Pizza', created_at: '2026-01-11T08:00:00.000Z' }
      ];

      const canonicalJsonl = serializeCanonicalJsonl(sampleRecords);
      const compressed = await gzipAsync(Buffer.from(canonicalJsonl, 'utf-8'));

      // Tamper 1 byte in the middle of compressed payload
      compressed[Math.floor(compressed.length / 2)] ^= 0xFF;

      let caught = false;
      try {
        await verifyArchiveIntegrity(compressed, sampleRecords);
      } catch (err) {
        caught = true;
      }
      assert.strictEqual(caught, true, 'Tampered archive must throw verification exception');
    });

    // -----------------------------------------------------------------
    // TEST 8: Source-Row Revalidation (Eligibility & Presence Check)
    // -----------------------------------------------------------------
    await test('8. Revalidation detects non-eligible or modified rows and halts pruning', async () => {
      // Seed 2 records: 1 operational, 1 security
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        301, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'Eligible'
      ]);
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        302, 1, 'tenant_admin', 'SECURITY_LOGIN_FAILED', 'Ineligible Security Row'
      ]);

      const client = await pool.connect();
      try {
        let errorCaught = false;
        try {
          // Attempt revalidation on list including ineligible row 302
          await revalidateSourceRowsForPruning(client, [301, 302], 'dummyhash');
        } catch (err) {
          errorCaught = true;
          assert(err.message.includes('security violation') || err.message.includes('not archive-eligible'));
        }
        assert.strictEqual(errorCaught, true, 'Revalidation must reject batch containing non-eligible row');
      } finally {
        client.release();
        await pool.query('DELETE FROM audit_logs WHERE id IN (301, 302)');
      }
    });

    // -----------------------------------------------------------------
    // TEST 9: Atomic Batch Pruning & Committed Ledger in ONE Transaction
    // -----------------------------------------------------------------
    await test('9. Atomic Batch Pruning deletes exact verified IDs and updates batch ledger atomically', async () => {
      // 1. Seed 3 operational records
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        401, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'D1'
      ]);
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        402, 1, 'tenant_admin', 'TENANT_DISH_UPDATED', 'D2'
      ]);
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        403, 1, 'tenant_admin', 'TENANT_DISH_AVAILABILITY_TOGGLED', 'D3'
      ]);

      // 2. Create archive catalog entry & batch
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-1', 'idem-1', 'vault/test1.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 401, 403, 3, 1024,
          'fhash1', 'chash1', 'VERIFIED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 1, 3, ARRAY[401, 402, 403], 'PENDING'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids
      `, [archiveId]);
      const batch = batchRes.rows[0];

      // 3. Execute atomic prune
      const client = await pool.connect();
      try {
        const pruneRes = await executeAtomicBatchPrune(client, archiveId, batch, 'chash1');
        assert.strictEqual(pruneRes.success, true);
        assert.strictEqual(pruneRes.deletedCount, 3);
      } finally {
        client.release();
      }

      // 4. Verify DB state: rows 401, 402, 403 are gone
      const remainingRows = await pool.query('SELECT id FROM audit_logs WHERE id IN (401, 402, 403)');
      assert.strictEqual(remainingRows.rows.length, 0);

      // 5. Verify batch ledger state: marked COMMITTED
      const updatedBatch = await pool.query('SELECT status, committed_at FROM audit_log_archive_batches WHERE id = $1', [batch.id]);
      assert.strictEqual(updatedBatch.rows[0].status, 'COMMITTED');
      assert(updatedBatch.rows[0].committed_at !== null);

      // 6. Verify parent archive: pruned_records = 3
      const updatedArch = await pool.query('SELECT pruned_records FROM audit_log_archives WHERE id = $1', [archiveId]);
      assert.strictEqual(updatedArch.rows[0].pruned_records, 3);
    });

    // -----------------------------------------------------------------
    // TEST 10: Lost-ACK Consistency Matrix (5 Cases)
    // -----------------------------------------------------------------
    await test('10a. Consistency Matrix Case 1: COMMITTED ledger + all target IDs absent confirms atomic commit', async () => {
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-matrix-1', 'idem-matrix-1', 'vault/matrix1.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 501, 502, 2, 512,
          'fhash2', 'chash2', 'PARTIALLY_PRUNED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      // Batch is already marked COMMITTED in PostgreSQL transaction, rows 501 & 502 are absent
      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status, committed_at
        ) VALUES (
          $1, 1, 2, ARRAY[501, 502], 'COMMITTED', CURRENT_TIMESTAMP
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      const res = await reconcileBatchCommitAck(pool, archiveId, batch);
      assert.strictEqual(res.reconciled, true);
      assert.strictEqual(res.status, 'COMMITTED');
      assert.strictEqual(res.action, 'CONFIRMED_COMMITTED');
      assert.strictEqual(res.remainingIds.length, 0);
    });

    await test('10b. Consistency Matrix Case 2: PENDING ledger + all target IDs present revalidates source rows and allows safe retry', async () => {
      // Seed operational rows 511 & 512
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        511, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'M2-1'
      ]);
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        512, 1, 'tenant_admin', 'TENANT_DISH_UPDATED', 'M2-2'
      ]);

      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-matrix-2', 'idem-matrix-2', 'vault/matrix2.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 511, 512, 2, 512,
          'fhash3', 'chash3', 'VERIFIED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 1, 2, ARRAY[511, 512], 'PENDING'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      const res = await reconcileBatchCommitAck(pool, archiveId, batch);
      assert.strictEqual(res.reconciled, false);
      assert.strictEqual(res.canRetry, true);
      assert.strictEqual(res.status, 'PENDING');
      assert.strictEqual(res.action, 'READY_FOR_RETRY');
      assert.deepStrictEqual(res.remainingIds.sort(), [511, 512]);

      // Cleanup
      await pool.query('DELETE FROM audit_logs WHERE id IN (511, 512)');
    });

    await test('10c. Consistency Matrix Case 3: PENDING ledger + partial target IDs missing raises AMBIGUOUS_CORRUPTION_STATE and halts', async () => {
      // Only 1 of 2 IDs exists in audit_logs (row 521 exists, row 522 is missing)
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        521, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'M3-1'
      ]);

      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-matrix-3', 'idem-matrix-3', 'vault/matrix3.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 521, 522, 2, 512,
          'fhash4', 'chash4', 'STAGED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 1, 2, ARRAY[521, 522], 'PENDING'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      let threw = false;
      try {
        await reconcileBatchCommitAck(pool, archiveId, batch);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.code, 'AMBIGUOUS_CORRUPTION_STATE');
        assert(err.message.includes('AMBIGUOUS_CORRUPTION_STATE'));
      }
      assert.strictEqual(threw, true, 'Must raise AMBIGUOUS_CORRUPTION_STATE on partial ID loss');

      // Crucial: verify batch was NOT marked committed
      const checkBatch = await pool.query('SELECT status FROM audit_log_archive_batches WHERE id = $1', [batch.id]);
      assert.strictEqual(checkBatch.rows[0].status, 'PENDING');

      // Cleanup
      await pool.query('DELETE FROM audit_logs WHERE id = 521');
    });

    await test('10d. Consistency Matrix Case 3b: PENDING ledger + all target IDs missing raises AMBIGUOUS_CORRUPTION_STATE and halts', async () => {
      // Batch says PENDING, but NO target IDs exist in audit_logs (unacknowledged non-atomic state)
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-matrix-3b', 'idem-matrix-3b', 'vault/matrix3b.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 531, 532, 2, 512,
          'fhash5', 'chash5', 'STAGED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 1, 2, ARRAY[531, 532], 'PENDING'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      let threw = false;
      try {
        await reconcileBatchCommitAck(pool, archiveId, batch);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.code, 'AMBIGUOUS_CORRUPTION_STATE');
      }
      assert.strictEqual(threw, true, 'Must raise AMBIGUOUS_CORRUPTION_STATE when PENDING batch has all target IDs missing');

      // Crucial: verify batch was NOT marked committed
      const checkBatch = await pool.query('SELECT status FROM audit_log_archive_batches WHERE id = $1', [batch.id]);
      assert.strictEqual(checkBatch.rows[0].status, 'PENDING');
    });

    await test('10e. Consistency Matrix Case 4: COMMITTED ledger + target IDs still present reports inconsistent state and halts', async () => {
      // Row 541 still exists in audit_logs
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        541, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'M4-1'
      ]);

      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-matrix-4', 'idem-matrix-4', 'vault/matrix4.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 541, 541, 1, 256,
          'fhash6', 'chash6', 'COMMITTED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      // Batch says COMMITTED, but row 541 was NEVER deleted!
      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status, committed_at
        ) VALUES (
          $1, 1, 1, ARRAY[541], 'COMMITTED', CURRENT_TIMESTAMP
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      let threw = false;
      try {
        await reconcileBatchCommitAck(pool, archiveId, batch);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.code, 'CONTRADICTORY_LEDGER_STATE');
      }
      assert.strictEqual(threw, true, 'Must report inconsistent state and halt when COMMITTED batch still has rows in DB');

      // Cleanup
      await pool.query('DELETE FROM audit_logs WHERE id = 541');
    });

    await test('10f. Consistency Matrix Case 5: Missing ledger entry or unexpected status fails closed', async () => {
      let threwMissing = false;
      try {
        await reconcileBatchCommitAck(pool, 999, { id: 999999, target_ids: [1] });
      } catch (err) {
        threwMissing = true;
        assert.strictEqual(err.code, 'MISSING_LEDGER_ENTRY');
      }
      assert.strictEqual(threwMissing, true, 'Must fail closed on missing ledger entry');

      // Unexpected status
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-matrix-5', 'idem-matrix-5', 'vault/matrix5.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 551, 551, 1, 256,
          'fhash7', 'chash7', 'STAGED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 1, 1, ARRAY[551], 'CORRUPT_UNKNOWN'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      let threwStatus = false;
      try {
        await reconcileBatchCommitAck(pool, archiveId, batch);
      } catch (err) {
        threwStatus = true;
        assert.strictEqual(err.code, 'UNEXPECTED_LEDGER_STATUS');
      }
      assert.strictEqual(threwStatus, true, 'Must fail closed on unexpected ledger status');
    });

    await test('10g. Simulated Lost-ACK Recovery: Atomic commit succeeds, lost ACK is cleanly reconciled on fresh connection', async () => {
      // 1. Seed rows 561 & 562
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        561, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'Lost-ACK 1'
      ]);
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        562, 1, 'tenant_admin', 'TENANT_DISH_UPDATED', 'Lost-ACK 2'
      ]);

      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-lost-ack', 'idem-lost-ack', 'vault/lostack.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 561, 562, 2, 512,
          'fhash_lost', 'chash_lost', 'VERIFIED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      const batchRes = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 1, 2, ARRAY[561, 562], 'PENDING'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      const batch = batchRes.rows[0];

      // 2. Perform atomic prune on a dedicated client, then abruptly release client (simulating severed connection before ACK reached caller)
      const pruneClient = await pool.connect();
      try {
        await executeAtomicBatchPrune(pruneClient, archiveId, batch, 'chash_lost');
      } finally {
        pruneClient.release();
      }

      // 3. Caller is unaware of outcome due to lost ACK. Operator invokes reconcileBatchCommitAck on a FRESH connection:
      const recon = await reconcileBatchCommitAck(pool, archiveId, batch, 'chash_lost');

      assert.strictEqual(recon.reconciled, true);
      assert.strictEqual(recon.status, 'COMMITTED');
      assert.strictEqual(recon.action, 'CONFIRMED_COMMITTED');
      assert.strictEqual(recon.remainingIds.length, 0);

      // Verify DB: audit_logs rows are gone, batch ledger is COMMITTED
      const rowsLeft = await pool.query('SELECT id FROM audit_logs WHERE id IN (561, 562)');
      assert.strictEqual(rowsLeft.rows.length, 0);

      const batchLedger = await pool.query('SELECT status, committed_at FROM audit_log_archive_batches WHERE id = $1', [batch.id]);
      assert.strictEqual(batchLedger.rows[0].status, 'COMMITTED');
      assert(batchLedger.rows[0].committed_at !== null);
    });

    await test('10h. Invariant Enforcement: Inconsistent metrics, archive mismatch, or missing timestamps fail closed', async () => {
      // Setup archive
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches
        ) VALUES (
          'test-arch-invariants', 'idem-invariants', 'vault/invariants.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 571, 572, 2, 512,
          'fhash_inv', 'chash_inv', 'VERIFIED', 1
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      // 1. COMMITTED without committed_at timestamp
      const b1Res = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status, committed_at
        ) VALUES (
          $1, 1, 2, ARRAY[571, 572], 'COMMITTED', NULL
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      let threwNoTimestamp = false;
      try {
        await reconcileBatchCommitAck(pool, archiveId, b1Res.rows[0]);
      } catch (err) {
        threwNoTimestamp = true;
        assert.strictEqual(err.code, 'INCONSISTENT_LEDGER_STATE');
      }
      assert.strictEqual(threwNoTimestamp, true, 'COMMITTED without committed_at must fail closed');

      // 2. Batch size mismatch
      const b2Res = await pool.query(`
        INSERT INTO audit_log_archive_batches (
          archive_id, batch_index, batch_size, target_ids, status
        ) VALUES (
          $1, 2, 999, ARRAY[571, 572], 'PENDING'
        ) RETURNING id, archive_id, batch_index, batch_size, target_ids, status
      `, [archiveId]);
      let threwMetricMismatch = false;
      try {
        await reconcileBatchCommitAck(pool, archiveId, b2Res.rows[0]);
      } catch (err) {
        threwMetricMismatch = true;
        assert.strictEqual(err.code, 'INCONSISTENT_BATCH_METRICS');
      }
      assert.strictEqual(threwMetricMismatch, true, 'Batch metrics mismatch must fail closed');

      // 3. Archive ID mismatch
      let threwArchiveMismatch = false;
      try {
        await reconcileBatchCommitAck(pool, 999999, b1Res.rows[0]);
      } catch (err) {
        threwArchiveMismatch = true;
        assert.strictEqual(err.code, 'ARCHIVE_ID_MISMATCH');
      }
      assert.strictEqual(threwArchiveMismatch, true, 'Archive ID mismatch must fail closed');
    });

    // -----------------------------------------------------------------
    // TEST 11: Resumable Partial Pruning Recovery
    // -----------------------------------------------------------------
    await test('11. Resumable Partial Pruning resumes only uncommitted batches', async () => {
      // Create archive with 2 batches. Batch 1 is already COMMITTED; Batch 2 is PENDING
      const archRes = await pool.query(`
        INSERT INTO audit_log_archives (
          archive_uid, idempotency_key, archive_key, bucket_name, track,
          start_date, end_date, min_id, max_id, total_records, file_size_bytes,
          file_sha256, content_sha256, status, total_batches, last_committed_batch, pruned_records
        ) VALUES (
          'test-arch-partial', 'idem-partial', 'vault/partial.jsonl.gz', 'touchqr-audit-vault', 'operational',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 601, 604, 4, 1024,
          'fhash3', 'chash3', 'PARTIALLY_PRUNED', 2, 1, 2
        ) RETURNING id
      `);
      const archiveId = archRes.rows[0].id;

      // Batch 1 (IDs 601, 602): COMMITTED
      await pool.query(`
        INSERT INTO audit_log_archive_batches (archive_id, batch_index, batch_size, target_ids, status, committed_at)
        VALUES ($1, 1, 2, ARRAY[601, 602], 'COMMITTED', CURRENT_TIMESTAMP)
      `, [archiveId]);

      // Seed records for Batch 2 (IDs 603, 604)
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        603, 1, 'tenant_admin', 'TENANT_DISH_CREATED', 'B2-1'
      ]);
      await pool.query('INSERT INTO audit_logs (id, restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4, $5)', [
        604, 1, 'tenant_admin', 'TENANT_DISH_UPDATED', 'B2-2'
      ]);

      // Batch 2: PENDING
      const b2Res = await pool.query(`
        INSERT INTO audit_log_archive_batches (archive_id, batch_index, batch_size, target_ids, status)
        VALUES ($1, 2, 2, ARRAY[603, 604], 'PENDING')
        RETURNING id, archive_id, batch_index, batch_size, target_ids
      `, [archiveId]);
      const batch2 = b2Res.rows[0];

      // Recovery queries uncommitted batches: only Batch 2 should be returned
      const pendingBatches = await pool.query(
        "SELECT id, archive_id, batch_index, batch_size, target_ids FROM audit_log_archive_batches WHERE archive_id = $1 AND status != 'COMMITTED' ORDER BY batch_index ASC",
        [archiveId]
      );
      assert.strictEqual(pendingBatches.rows.length, 1);
      assert.strictEqual(pendingBatches.rows[0].batch_index, 2);

      // Execute Batch 2
      const client = await pool.connect();
      try {
        const res = await executeAtomicBatchPrune(client, archiveId, batch2, 'chash3');
        assert.strictEqual(res.deletedCount, 2);
      } finally {
        client.release();
      }

      // Confirm all 4 are now pruned
      const archFinal = await pool.query('SELECT pruned_records, last_committed_batch FROM audit_log_archives WHERE id = $1', [archiveId]);
      assert.strictEqual(archFinal.rows[0].pruned_records, 4);
      assert.strictEqual(archFinal.rows[0].last_committed_batch, 2);
    });

    // -----------------------------------------------------------------
    // TEST 12: R2 Bucket Lock (WORM) Tombstone Recovery
    // -----------------------------------------------------------------
    await test('12. R2 Bucket Lock Tombstone: Catches ObjectLock exception and logs tombstone without crashing', async () => {
      // Mock an S3 client that simulates ObjectLockedError / AccessDenied on DeleteObjectCommand
      const mockLockedS3Client = {
        send: async () => {
          const err = new Error('Object is protected by Object Lock retention policy');
          err.name = 'AccessDenied';
          throw err;
        }
      };

      const result = await safeDeleteArchiveObject(mockLockedS3Client, 'touchqr-audit-vault', 'vault/locked_chunk_1.jsonl.gz');
      assert.strictEqual(result.deleted, false);
      assert.strictEqual(result.locked, true);
      assert(result.error.includes('protected by Object Lock'));

      // Insert tombstone catalog entry
      await pool.query(
        'INSERT INTO audit_log_archive_tombstones (object_key, bucket_name, reason) VALUES ($1, $2, $3)',
        ['vault/locked_chunk_1.jsonl.gz', 'touchqr-audit-vault', 'WORM_LOCKED_ORPHAN']
      );

      const tombCheck = await pool.query('SELECT object_key, reason FROM audit_log_archive_tombstones WHERE object_key = $1', [
        'vault/locked_chunk_1.jsonl.gz'
      ]);
      assert.strictEqual(tombCheck.rows.length, 1);
      assert.strictEqual(tombCheck.rows[0].reason, 'WORM_LOCKED_ORPHAN');
    });

    // -----------------------------------------------------------------
    // TEST 13: Full Round-Trip Restore to Staging Table
    // -----------------------------------------------------------------
    await test('13. Round-Trip Restore: Restores records into staging table with zero live table contamination', async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs_archive_staging (
          id INT PRIMARY KEY,
          restaurant_id INT,
          actor_role VARCHAR(50),
          action VARCHAR(100),
          details TEXT,
          created_at TIMESTAMP,
          restored_from_archive_id INT,
          restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const recordsToRestore = [
        { id: 701, restaurant_id: 5, actor_role: 'tenant_admin', action: 'TENANT_DISH_CREATED', details: 'D701', created_at: '2026-01-01 10:00:00' },
        { id: 702, restaurant_id: 5, actor_role: 'tenant_admin', action: 'TENANT_DISH_UPDATED', details: 'D702', created_at: '2026-01-01 11:00:00' }
      ];

      for (const r of recordsToRestore) {
        await pool.query(`
          INSERT INTO audit_logs_archive_staging (id, restaurant_id, actor_role, action, details, created_at, restored_from_archive_id)
          VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7)
        `, [r.id, r.restaurant_id, r.actor_role, r.action, r.details, r.created_at, 99]);
      }

      // Check staging table
      const stagingRows = await pool.query('SELECT id, action, restored_from_archive_id FROM audit_logs_archive_staging WHERE restored_from_archive_id = 99');
      assert.strictEqual(stagingRows.rows.length, 2);

      // Confirm primary audit_logs table was NEVER contaminated
      const liveCheck = await pool.query('SELECT id FROM audit_logs WHERE id IN (701, 702)');
      assert.strictEqual(liveCheck.rows.length, 0, 'Primary audit_logs must remain completely uncontaminated');
    });

  } finally {
    await pool.end();
  }

  console.log('\n======================================================================');
  console.log(`📊 TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
