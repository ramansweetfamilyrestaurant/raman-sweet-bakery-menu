/**
 * TouchQR — Audit Log Archival Migration Runner Unit & Integration Tests
 *
 * Verifies the safety invariants, production guards, dry-run reporting,
 * and idempotent schema provisioning of server/scripts/migrate_audit_log_archival.js.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {
  ARCHIVAL_MIGRATION_DDL,
  ROLLBACK_STATEMENTS,
  runAuditLogArchivalMigration
} from '../scripts/migrate_audit_log_archival.js';

const TEST_DB_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';
const { Pool } = pg;

test('ARCHIVAL_MIGRATION_DDL contains exact required tables and indexes', () => {
  const tableNames = ARCHIVAL_MIGRATION_DDL.filter(d => d.type === 'table').map(d => d.target);
  assert.deepEqual(tableNames.sort(), [
    'audit_log_archive_batches',
    'audit_log_archive_tombstones',
    'audit_log_archives',
    'audit_logs_archive_staging'
  ].sort(), 'All 4 archival tables must be declared in migration DDL');

  const indexNames = ARCHIVAL_MIGRATION_DDL.filter(d => d.type === 'index').map(d => d.target);
  assert.equal(indexNames.length, 7, 'Must declare exactly 7 supporting indexes');
  assert.ok(indexNames.includes('idx_audit_log_archives_status'));
  assert.ok(indexNames.includes('idx_audit_log_archives_track_created'));
  assert.ok(indexNames.includes('idx_audit_log_archives_created_at'));
  assert.ok(indexNames.includes('idx_audit_log_archive_batches_arch_status'));
  assert.ok(indexNames.includes('idx_audit_log_archive_tombstones_created'));
  assert.ok(indexNames.includes('idx_audit_logs_archive_staging_restored_from'));
  assert.ok(indexNames.includes('idx_audit_logs_archive_staging_resto_created'));
});

test('runAuditLogArchivalMigration throws if MIGRATION_DATABASE_URL is missing', async () => {
  const prevEnv = process.env.MIGRATION_DATABASE_URL;
  delete process.env.MIGRATION_DATABASE_URL;
  try {
    await assert.rejects(
      async () => {
        await runAuditLogArchivalMigration({ migrationUrl: '' });
      },
      /MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL environment variable is required/
    );
  } finally {
    if (prevEnv) process.env.MIGRATION_DATABASE_URL = prevEnv;
  }
});

test('runAuditLogArchivalMigration throws if URL is invalid protocol', async () => {
  await assert.rejects(
    async () => {
      await runAuditLogArchivalMigration({ migrationUrl: 'mysql://localhost:3306/db' });
    },
    /MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL must be a valid PostgreSQL connection string/
  );
});

test('runAuditLogArchivalMigration triggers production guard on production URL without confirmProduction', async () => {
  await assert.rejects(
    async () => {
      await runAuditLogArchivalMigration({
        migrationUrl: 'postgres://user:pass@ep-cool-dawn-12345.us-east-2.aws.neon.tech/neondb?sslmode=require',
        dryRun: true,
        confirmProduction: false
      });
    },
    /PRODUCTION_GUARD_TRIGGERED/
  );
});

test('runAuditLogArchivalMigration dry-run inspects schema without mutating database', async () => {
  const result = await runAuditLogArchivalMigration({
    migrationUrl: TEST_DB_URL,
    dryRun: true
  });

  assert.equal(result.success, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.rollback, false);
  assert.ok(Array.isArray(result.executed));
  assert.equal(result.executed.length, 0, 'Dry-run must never execute DDL');
  assert.ok(result.inspected.connectedDatabase === 'touchqr_disposable_test');
  assert.ok(Array.isArray(result.inspected.existingArchivalTables));
  assert.ok(Array.isArray(result.inspected.existingArchivalIndexes));
});

test('runAuditLogArchivalMigration executes idempotently on disposable test database', async () => {
  // First run: ensures all tables & indexes exist
  const res1 = await runAuditLogArchivalMigration({
    migrationUrl: TEST_DB_URL,
    dryRun: false
  });
  assert.equal(res1.success, true);
  assert.equal(res1.dryRun, false);

  // Second run: must skip all existing tables and indexes
  const res2 = await runAuditLogArchivalMigration({
    migrationUrl: TEST_DB_URL,
    dryRun: false
  });
  assert.equal(res2.success, true);
  assert.equal(res2.executed.length, 0, 'Second run must execute 0 statements');
  assert.equal(res2.skipped.length, 11, 'Second run must skip all 11 items');

  // Verify actual database catalog
  const pool = new Pool({ connectionString: TEST_DB_URL });
  try {
    const tableRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('audit_log_archives', 'audit_log_archive_batches', 'audit_log_archive_tombstones', 'audit_logs_archive_staging')
    `);
    assert.equal(tableRes.rows.length, 4, 'All 4 tables must be present in information_schema');

    const indexRes = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname IN (
        'idx_audit_log_archives_status',
        'idx_audit_log_archives_track_created',
        'idx_audit_log_archives_created_at',
        'idx_audit_log_archive_batches_arch_status',
        'idx_audit_log_archive_tombstones_created',
        'idx_audit_logs_archive_staging_restored_from',
        'idx_audit_logs_archive_staging_resto_created'
      )
    `);
    assert.equal(indexRes.rows.length, 7, 'All 7 indexes must be present in pg_indexes');
  } finally {
    await pool.end();
  }
});
