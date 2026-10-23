/**
 * Dedicated Production PostgreSQL Migration Runner for TouchQR Phase 1
 *
 * Safely executes additive, idempotent DDL for:
 * - restaurants.counter_ordering_enabled
 * - orders.tracking_token_hash
 * - orders.terminal_at
 * - orders.updated_at
 * - orders.idx_orders_tracking_hash
 *
 * SAFETY INVARIANTS:
 * 1. Must use an explicitly supplied MIGRATION_DATABASE_URL environment variable (or --url argument).
 *    NEVER silently falls back to DATABASE_URL or TEST_DATABASE_URL.
 * 2. Multi-Layer Production Guard:
 *    - Validates connection URL for production indicators (neon.tech, aws, rds, etc.).
 *    - Any non-local target strictly requires --confirm-production.
 * 3. Dry Run Support:
 *    - Supports --dry-run mode that inspects schema and reports planned DDL without mutating data.
 * 4. Lock Timeout & Atomic Transaction:
 *    - Executes with SET lock_timeout = '2s'; inside a single atomic transaction.
 * 5. Strictly Additive:
 *    - NEVER drops tables, columns, indexes, or existing records.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const PHASE1_MIGRATION_DDL = Object.freeze([
  {
    name: 'column:restaurants.counter_ordering_enabled',
    target: 'restaurants',
    column: 'counter_ordering_enabled',
    sql: 'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS counter_ordering_enabled INT DEFAULT 0;'
  },
  {
    name: 'column:orders.tracking_token_hash',
    target: 'orders',
    column: 'tracking_token_hash',
    sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token_hash VARCHAR(64);'
  },
  {
    name: 'column:orders.terminal_at',
    target: 'orders',
    column: 'terminal_at',
    sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS terminal_at TIMESTAMP DEFAULT NULL;'
  },
  {
    name: 'column:orders.updated_at',
    target: 'orders',
    column: 'updated_at',
    sql: 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;'
  },
  {
    name: 'index:orders.idx_orders_tracking_hash',
    target: 'orders',
    index: 'idx_orders_tracking_hash',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_tracking_hash ON orders (restaurant_id, tracking_token_hash);'
  }
]);

export function getCliUrl(argv = process.argv) {
  const idx = argv.indexOf('--url');
  if (idx !== -1 && argv[idx + 1]) {
    return argv[idx + 1].trim();
  }
  return null;
}

export function validateMigrationTargetUrl(rawUrl, confirmProduction = false) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(
      'MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL environment variable (or --url argument) is required. ' +
      'Silent fallback to DATABASE_URL is strictly prohibited to prevent target database mismatch.'
    );
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error(`MIGRATION_CONFIG_ERROR: Target database URL is malformed: ${err.message}`);
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (!isLocal && !confirmProduction) {
    throw new Error(
      `PRODUCTION_SAFETY_VIOLATION: Target host '${hostname}' is a non-local/production database. ` +
      'You must explicitly provide --confirm-production to authorize migration against this host.'
    );
  }

  return { url: trimmed, host: hostname, isLocal };
}

export async function runPhase1Migration(options = {}) {
  const isDryRun = Boolean(options.dryRun || process.argv.includes('--dry-run'));
  const isConfirmProduction = Boolean(options.confirmProduction || process.argv.includes('--confirm-production'));
  const rawUrl = (typeof options === 'string' ? options : (options.url || options.migrationUrl)) ||
    getCliUrl(process.argv) ||
    process.env.MIGRATION_DATABASE_URL;

  const { url, host, isLocal } = validateMigrationTargetUrl(rawUrl, isConfirmProduction);

  console.log(`\n==================================================`);
  console.log(`🚀 TOUCHQR PHASE 1 MIGRATION RUNNER`);
  console.log(`==================================================`);
  console.log(`Target Host        : ${host} (${isLocal ? 'LOCAL' : 'REMOTE/PRODUCTION'})`);
  console.log(`Dry Run Mode       : ${isDryRun ? 'YES (Inspection only)' : 'NO (Applying DDL)'}`);

  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000
  });

  const client = await pool.connect();
  try {
    // 1. Inspect existing schema state
    const { rows: existingCols } = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE (table_name = 'restaurants' AND column_name = 'counter_ordering_enabled')
         OR (table_name = 'orders' AND column_name IN ('tracking_token_hash', 'terminal_at', 'updated_at'))
    `);

    const { rows: existingIdxs } = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname = 'idx_orders_tracking_hash'
    `);

    const pendingOps = [];
    for (const ddl of PHASE1_MIGRATION_DDL) {
      let isPresent = false;
      if (ddl.column) {
        isPresent = existingCols.some(c => c.table_name === ddl.target && c.column_name === ddl.column);
      } else if (ddl.index) {
        isPresent = existingIdxs.some(i => i.tablename === ddl.target && i.indexname === ddl.index);
      }

      if (!isPresent) {
        pendingOps.push(ddl);
      }
    }

    console.log(`Total Operations   : ${PHASE1_MIGRATION_DDL.length}`);
    console.log(`Already Present    : ${PHASE1_MIGRATION_DDL.length - pendingOps.length}`);
    console.log(`Pending Application: ${pendingOps.length}`);

    if (isDryRun) {
      console.log('\n[DRY RUN SUMMARY] Planned Operations:');
      pendingOps.forEach(op => console.log(`  + [PENDING] ${op.name}`));
      return { success: true, dryRun: true, pendingCount: pendingOps.length };
    }

    if (pendingOps.length === 0) {
      console.log('✅ All Phase 1 schema attributes are already present. No DDL required.');
      return { success: true, pendingCount: 0, appliedCount: 0 };
    }

    // 2. Execute pending DDL inside an atomic transaction with 2s lock timeout
    console.log('\nApplying DDL in atomic transaction...');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '2s';");

    for (const op of pendingOps) {
      console.log(`  Executing: ${op.name}`);
      await client.query(op.sql);
    }

    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully.');

    // 3. Post-execution verification
    const { rows: verifyCols } = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE (table_name = 'restaurants' AND column_name = 'counter_ordering_enabled')
         OR (table_name = 'orders' AND column_name IN ('tracking_token_hash', 'terminal_at', 'updated_at'))
    `);
    const { rows: verifyIdxs } = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname = 'idx_orders_tracking_hash'
    `);

    if (verifyCols.length < 4 || verifyIdxs.length < 1) {
      throw new Error('POST_MIGRATION_VERIFICATION_FAILED: Not all columns or indexes exist after commit.');
    }

    console.log('✅ Post-migration verification passed. Phase 1 schema is ready.\n');
    return { success: true, appliedCount: pendingOps.length };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error(`❌ Migration failed: ${err.message}`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('migrate_phase1_counter_and_tracking.js')) {
  runPhase1Migration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Migration script error: ${err.message}`);
      process.exit(1);
    });
}
