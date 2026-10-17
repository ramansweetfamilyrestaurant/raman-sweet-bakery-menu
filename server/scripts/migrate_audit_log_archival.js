/**
 * Dedicated PostgreSQL Migration Runner for Audit Log Archival Infrastructure (Step 6 / Checkpoint 3 Readiness)
 *
 * Safely provisions all audit log archival catalog, batch ledger, tombstone, and staging tables + indexes.
 *
 * SAFETY INVARIANTS:
 * 1. Must use an explicitly supplied MIGRATION_DATABASE_URL environment variable or --url argument.
 *    DOES NOT silently fall back to DATABASE_URL.
 * 2. Multi-Layer Production Guard:
 *    - Validates connection URL for production indicators (neon.tech, prod_db, remote hosts).
 *    - Verifies live connected database identity (database name, user, host).
 *    - Non-local / production targets require explicit --confirm-production.
 * 3. TRANSACTIONAL INTEGRITY:
 *    - Executes additive DDL inside a single atomic BEGIN ... COMMIT block.
 *    - Clean rollback if any error occurs.
 * 4. Dry Run & Rollback Support:
 *    - Supports safe --dry-run mode for inspecting schema state without mutation.
 *    - Supports safe --rollback mode to cleanly drop archival tables inside an atomic transaction.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { isProductionDatabaseUrl, verifyConnectedDatabaseIdentity } from './migrate_production_postgres.js';

dotenv.config();

const { Pool } = pg;

export const ARCHIVAL_MIGRATION_DDL = Object.freeze([
  {
    name: 'table:audit_log_archives',
    type: 'table',
    target: 'audit_log_archives',
    purpose: 'Catalog tracking archive chunk metadata, content SHA-256, byte sizes, status',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log_archives (
        id SERIAL PRIMARY KEY,
        archive_uid VARCHAR(64) NOT NULL UNIQUE,
        idempotency_key VARCHAR(64) NOT NULL UNIQUE,
        archive_key VARCHAR(500) NOT NULL UNIQUE,
        bucket_name VARCHAR(255) NOT NULL,
        track VARCHAR(20) NOT NULL DEFAULT 'operational',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        min_id INT NOT NULL,
        max_id INT NOT NULL,
        total_records INT NOT NULL,
        pruned_records INT NOT NULL DEFAULT 0,
        file_size_bytes BIGINT NOT NULL,
        file_sha256 VARCHAR(64) NOT NULL,
        content_sha256 VARCHAR(64) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'STAGED',
        last_committed_batch INT NOT NULL DEFAULT 0,
        total_batches INT NOT NULL DEFAULT 1,
        attempt_count INT NOT NULL DEFAULT 1,
        last_error TEXT,
        verified_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: 'table:audit_log_archive_batches',
    type: 'table',
    target: 'audit_log_archive_batches',
    purpose: 'Batch transaction ledger tracking batch indices, target IDs, and commit status',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log_archive_batches (
        id SERIAL PRIMARY KEY,
        archive_id INT NOT NULL REFERENCES audit_log_archives(id) ON DELETE CASCADE,
        batch_index INT NOT NULL,
        batch_size INT NOT NULL,
        target_ids INT[] NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        committed_at TIMESTAMP,
        UNIQUE(archive_id, batch_index)
      );
    `
  },
  {
    name: 'table:audit_log_archive_tombstones',
    type: 'table',
    target: 'audit_log_archive_tombstones',
    purpose: 'Tombstone registry tracking orphaned WORM storage chunks in R2',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log_archive_tombstones (
        id SERIAL PRIMARY KEY,
        object_key VARCHAR(500) NOT NULL,
        bucket_name VARCHAR(255) NOT NULL,
        reason VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: 'table:audit_logs_archive_staging',
    type: 'table',
    target: 'audit_logs_archive_staging',
    purpose: 'Isolated staging table for safe record rehydration during restore operations',
    sql: `
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
    `
  },
  {
    name: 'index:idx_audit_log_archives_status',
    type: 'index',
    target: 'idx_audit_log_archives_status',
    table: 'audit_log_archives',
    purpose: 'Fast lookup and filtering by archive status (STAGED, VERIFIED, COMMITTED, PARTIALLY_PRUNED)',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_archives_status ON audit_log_archives (status);'
  },
  {
    name: 'index:idx_audit_log_archives_track_created',
    type: 'index',
    target: 'idx_audit_log_archives_track_created',
    table: 'audit_log_archives',
    purpose: 'Deterministic order and filtering by operational/security track and creation time',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_archives_track_created ON audit_log_archives (track, created_at DESC);'
  },
  {
    name: 'index:idx_audit_log_archives_created_at',
    type: 'index',
    target: 'idx_audit_log_archives_created_at',
    table: 'audit_log_archives',
    purpose: 'Catalog pagination ordered by creation time',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_archives_created_at ON audit_log_archives (created_at DESC);'
  },
  {
    name: 'index:idx_audit_log_archive_batches_arch_status',
    type: 'index',
    target: 'idx_audit_log_archive_batches_arch_status',
    table: 'audit_log_archive_batches',
    purpose: 'Ledger batch resolution and reconciliation by archive ID and batch status',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_archive_batches_arch_status ON audit_log_archive_batches (archive_id, status);'
  },
  {
    name: 'index:idx_audit_log_archive_tombstones_created',
    type: 'index',
    target: 'idx_audit_log_archive_tombstones_created',
    table: 'audit_log_archive_tombstones',
    purpose: 'Tombstone history ordered by creation time',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_log_archive_tombstones_created ON audit_log_archive_tombstones (created_at DESC);'
  },
  {
    name: 'index:idx_audit_logs_archive_staging_restored_from',
    type: 'index',
    target: 'idx_audit_logs_archive_staging_restored_from',
    table: 'audit_logs_archive_staging',
    purpose: 'Filtering restored staged records by source archive chunk ID',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_staging_restored_from ON audit_logs_archive_staging (restored_from_archive_id);'
  },
  {
    name: 'index:idx_audit_logs_archive_staging_resto_created',
    type: 'index',
    target: 'idx_audit_logs_archive_staging_resto_created',
    table: 'audit_logs_archive_staging',
    purpose: 'Tenant-scoped inspection of restored records',
    sql: 'CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_staging_resto_created ON audit_logs_archive_staging (restaurant_id, created_at DESC);'
  }
]);

export const ROLLBACK_STATEMENTS = Object.freeze([
  'DROP TABLE IF EXISTS audit_logs_archive_staging CASCADE;',
  'DROP TABLE IF EXISTS audit_log_archive_tombstones CASCADE;',
  'DROP TABLE IF EXISTS audit_log_archive_batches CASCADE;',
  'DROP TABLE IF EXISTS audit_log_archives CASCADE;'
]);

/**
 * Runs the audit log archival tables migration, rollback, or dry run.
 *
 * @param {object} options
 * @param {string} [options.migrationUrl]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.rollback]
 * @param {boolean} [options.confirmProduction]
 * @returns {Promise<{ success: boolean, dryRun: boolean, rollback: boolean, executed: string[], skipped: string[], inspected: object }>}
 */
export async function runAuditLogArchivalMigration(options = {}) {
  const rawUrl = options.migrationUrl || process.env.MIGRATION_DATABASE_URL;

  // 1. Mandatory URL Invariant: Never silently fall back to DATABASE_URL
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error(
      'MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL environment variable is required. ' +
      'Silent fallback to DATABASE_URL is prohibited to prevent unintended schema mutations.'
    );
  }

  const dbUrl = rawUrl.trim();
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    throw new Error('MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL must be a valid PostgreSQL connection string.');
  }

  const dryRun = Boolean(options.dryRun);
  const rollback = Boolean(options.rollback);
  const confirmProduction = Boolean(options.confirmProduction);

  // 2. Production URL Static Analysis Guard
  const urlIndicatesProduction = isProductionDatabaseUrl(dbUrl);
  if (urlIndicatesProduction && !confirmProduction) {
    throw new Error(
      'PRODUCTION_GUARD_TRIGGERED: Target database URL indicates a PRODUCTION environment. ' +
      'Schema operations require explicit --confirm-production flag.'
    );
  }

  const isLocalOrNoSsl =
    dbUrl.includes('sslmode=disable') ||
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalOrNoSsl ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  const client = await pool.connect();

  try {
    // 3. Live Database Identity Check
    const idRes = await client.query('SELECT current_database() as db_name, current_user as user_name, version() as version');
    const { db_name, user_name, version } = idRes.rows[0];

    const identityCheck = verifyConnectedDatabaseIdentity(db_name, user_name, process.env.DATABASE_URL);
    const isTargetProduction = urlIndicatesProduction || identityCheck.isProduction;

    if (isTargetProduction && !confirmProduction) {
      const reason = identityCheck.reason || 'Connection URL indicates a production environment.';
      throw new Error(
        `PRODUCTION_GUARD_TRIGGERED: Target database is detected as PRODUCTION (${reason}). ` +
        'Schema migration requires explicit --confirm-production flag.'
      );
    }

    // 4. Inspect Current Schema State
    const existingTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = new Set(existingTablesRes.rows.map(r => r.table_name));

    const existingIndexesRes = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    const existingIndexes = new Set(existingIndexesRes.rows.map(r => r.indexname));

    const inspected = {
      connectedDatabase: db_name,
      connectedUser: user_name,
      postgresVersion: version,
      isProduction: isTargetProduction,
      existingArchivalTables: ARCHIVAL_MIGRATION_DDL
        .filter(d => d.type === 'table')
        .map(d => ({ table: d.target, exists: existingTables.has(d.target) })),
      existingArchivalIndexes: ARCHIVAL_MIGRATION_DDL
        .filter(d => d.type === 'index')
        .map(d => ({ index: d.target, exists: existingIndexes.has(d.target) }))
    };

    const executed = [];
    const skipped = [];

    // 5. Rollback Branch
    if (rollback) {
      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          rollback: true,
          executed: [],
          skipped: [],
          inspected,
          plan: ROLLBACK_STATEMENTS
        };
      }

      await client.query('BEGIN');
      try {
        for (const sql of ROLLBACK_STATEMENTS) {
          await client.query(sql);
          executed.push(sql);
        }
        await client.query('COMMIT');
        return {
          success: true,
          dryRun: false,
          rollback: true,
          executed,
          skipped: [],
          inspected
        };
      } catch (rbErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw rbErr;
      }
    }

    // 6. Forward Migration Branch
    const plannedDdl = [];
    for (const ddl of ARCHIVAL_MIGRATION_DDL) {
      const alreadyExists = ddl.type === 'table' 
        ? existingTables.has(ddl.target)
        : existingIndexes.has(ddl.target);

      if (alreadyExists) {
        skipped.push({ name: ddl.name, reason: 'Already exists' });
      } else {
        plannedDdl.push(ddl);
      }
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        rollback: false,
        executed: [],
        skipped,
        inspected,
        plannedCount: plannedDdl.length,
        plan: plannedDdl.map(d => ({ name: d.name, purpose: d.purpose, sql: d.sql.trim() }))
      };
    }

    // 7. Execute DDL in Atomic Transaction
    await client.query('BEGIN');
    try {
      for (const ddl of plannedDdl) {
        await client.query(ddl.sql);
        executed.push(ddl.name);
      }
      await client.query('COMMIT');
    } catch (migErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw migErr;
    }

    return {
      success: true,
      dryRun: false,
      rollback: false,
      executed,
      skipped,
      inspected
    };
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

// CLI Execution Entrypoint
if (process.argv[1] && process.argv[1].endsWith('migrate_audit_log_archival.js')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rollback = args.includes('--rollback');
  const confirmProduction = args.includes('--confirm-production');
  const urlArgIndex = args.indexOf('--url');
  const migrationUrl = urlArgIndex !== -1 ? args[urlArgIndex + 1] : process.env.MIGRATION_DATABASE_URL;

  runAuditLogArchivalMigration({
    migrationUrl,
    dryRun,
    rollback,
    confirmProduction
  })
    .then(result => {
      console.log('✅ Audit log archival migration finished successfully:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Audit log archival migration failed:', err.message);
      process.exit(1);
    });
}
