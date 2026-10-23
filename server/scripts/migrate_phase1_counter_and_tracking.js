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

export function getStagingHostAllowlist(options = {}, argv = process.argv) {
  const allowlist = new Set();
  if (options.stagingHost) {
    allowlist.add(String(options.stagingHost).trim().toLowerCase());
  }
  if (Array.isArray(options.allowedStagingHosts)) {
    options.allowedStagingHosts.forEach(h => allowlist.add(String(h).trim().toLowerCase()));
  }
  if (Array.isArray(argv)) {
    const idx = argv.indexOf('--staging-host');
    if (idx !== -1 && argv[idx + 1]) {
      allowlist.add(argv[idx + 1].trim().toLowerCase());
    }
  }
  const envHost = (process.env.STAGING_DATABASE_HOST || '').trim().toLowerCase();
  if (envHost) {
    envHost.split(',').map(h => h.trim()).filter(Boolean).forEach(h => allowlist.add(h));
  }
  return allowlist;
}

export function validateMigrationTargetUrl(rawUrl, confirmProduction = false, options = {}) {
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
  const pathname = (parsed.pathname || '').toLowerCase();
  const dbName = pathname.replace(/^\//, '');
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  // 1. Prohibit targeting the known production database (by host or db name)
  const appDbUrl = (process.env.DATABASE_URL || '').trim();
  let prodHostname = '';
  if (appDbUrl && (appDbUrl.startsWith('postgres://') || appDbUrl.startsWith('postgresql://'))) {
    try {
      const parsedApp = new URL(appDbUrl);
      prodHostname = (parsedApp.hostname || '').toLowerCase();
    } catch (_) {}
  }

  const isProdHostLocal = prodHostname === 'localhost' || prodHostname === '127.0.0.1' || prodHostname === '::1';

  // Reject ANY URL that targets the known production hostname regardless of database name or confirmProduction
  if (prodHostname && !isProdHostLocal && hostname === prodHostname) {
    throw new Error(
      `PRODUCTION_ENDPOINT_FORBIDDEN: Target host '${hostname}' is the production database endpoint. Migrations are strictly prohibited from targeting the production host under any database name.`
    );
  }
  if (prodHostname && isProdHostLocal && hostname === prodHostname) {
    try {
      const parsedApp = new URL(appDbUrl);
      if (parsedApp.pathname.toLowerCase() === pathname) {
        throw new Error(
          `PRODUCTION_TARGET_FORBIDDEN: Target database '${dbName}' matches the active application database in DATABASE_URL. Phase 1 migration cannot target the application database.`
        );
      }
    } catch (e) {
      if (e.message && e.message.startsWith('PRODUCTION_TARGET_FORBIDDEN:')) throw e;
    }
  }

  const prodHostMarkers = ['prod-', '-prod.', '.prod.'];
  if (prodHostMarkers.some(m => hostname.includes(m)) || hostname.startsWith('prod.') || hostname.endsWith('-prod')) {
    throw new Error(
      `PRODUCTION_ENDPOINT_FORBIDDEN: Target host '${hostname}' is marked as production.`
    );
  }

  const prodDbNames = [
    'production',
    'prod_db',
    'master_db',
    'touchqr_prod',
    'touchqr_production',
    'live_db',
    'neondb',
    'neondb_prod',
    'main_db'
  ];
  if (
    prodDbNames.includes(dbName) ||
    dbName.endsWith('_prod') ||
    dbName.endsWith('-prod')
  ) {
    throw new Error(
      `PRODUCTION_TARGET_FORBIDDEN: Target database '${dbName}' is a production database. Phase 1 staging migration cannot target production.`
    );
  }

  // 2. Prevent accidental migration of test database during application migration
  const isTestTarget = dbName.includes('test') || dbName.includes('disposable');
  if (isTestTarget && !options.allowTestTarget) {
    throw new Error(
      `MIGRATION_TARGET_MISMATCH: Target database '${dbName}' is an automated test database. Phase 1 application migration must target 'touchqr_staging_app'. To migrate a test database explicitly, provide --allow-test-target.`
    );
  }

  // 3. Positive Staging Target Identification for Remote Targets
  if (!isLocal) {
    const stagingAllowlist = getStagingHostAllowlist(options, process.argv);

    if (stagingAllowlist.size === 0) {
      throw new Error(
        'STAGING_HOST_CONFIG_REQUIRED: Remote migration requires an explicitly configured staging host allowlist via STAGING_DATABASE_HOST environment variable (or --staging-host argument). Remote targets fail closed when endpoint identity is unconfigured.'
      );
    }

    // Ensure allowed staging host does not match production host
    if (prodHostname && stagingAllowlist.has(prodHostname)) {
      throw new Error(
        `STAGING_HOST_CONFIG_CONFLICT: Configured STAGING_DATABASE_HOST matches the production database endpoint '${prodHostname}'. Staging endpoint must be distinct from production.`
      );
    }

    // Compare parsed hostname exactly against allowlist
    if (!stagingAllowlist.has(hostname)) {
      throw new Error(
        `UNAUTHORIZED_REMOTE_ENDPOINT: Target host '${hostname}' does not match the explicitly configured staging endpoint allowlist (${Array.from(stagingAllowlist).join(', ')}). Arbitrary remote endpoints are prohibited.`
      );
    }

    // Database name must be touchqr_staging_app (or allowed test target)
    const isExpectedStagingDb = dbName === 'touchqr_staging_app' || (isTestTarget && options.allowTestTarget);
    if (!isExpectedStagingDb) {
      throw new Error(
        `STAGING_TARGET_REQUIRED: Remote migration target database '${dbName}' is invalid. Application migration must target 'touchqr_staging_app'.`
      );
    }

    if (!confirmProduction) {
      throw new Error(
        `PRODUCTION_SAFETY_VIOLATION: Target host '${hostname}' is a non-local/production database. ` +
        'You must explicitly provide --confirm-production to authorize migration against this host.'
      );
    }
  }

  return { url: trimmed, host: hostname, isLocal, dbName };
}

export async function resolveAuthoritativeRelationSchemas(client) {
  try {
    const { rows } = await client.query(`
      SELECT 
        c.relname AS table_name,
        n.nspname AS table_schema
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.oid IN (to_regclass('orders'), to_regclass('restaurants'))
    `);
    const relSchemaMap = new Map((rows || []).map(r => [r.table_name, r.table_schema]));
    return {
      ordersSchema: relSchemaMap.get('orders') || 'public',
      restaurantsSchema: relSchemaMap.get('restaurants') || 'public'
    };
  } catch (err) {
    return { ordersSchema: 'public', restaurantsSchema: 'public' };
  }
}

export async function runPhase1Migration(options = {}) {
  const isDryRun = Boolean(options.dryRun || process.argv.includes('--dry-run'));
  const isConfirmProduction = Boolean(options.confirmProduction || process.argv.includes('--confirm-production'));
  const isAllowTestTarget = Boolean(options.allowTestTarget || process.argv.includes('--allow-test-target'));
  const rawUrl = (typeof options === 'string' ? options : (options.url || options.migrationUrl)) ||
    getCliUrl(process.argv) ||
    process.env.MIGRATION_DATABASE_URL;

  const { url, host, isLocal } = validateMigrationTargetUrl(rawUrl, isConfirmProduction, { allowTestTarget: isAllowTestTarget });

  console.log(`\n==================================================`);
  console.log(`🚀 TOUCHQR PHASE 1 MIGRATION RUNNER`);
  console.log(`==================================================`);
  console.log(`Target Host        : ${host} (${isLocal ? 'LOCAL' : 'REMOTE/PRODUCTION'})`);
  console.log(`Dry Run Mode       : ${isDryRun ? 'YES (Inspection only)' : 'NO (Applying DDL)'}`);

  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    statement_timeout: 120000
  });

  const client = await pool.connect();
  try {
    // 0. Authoritatively resolve the exact relation schemas for 'orders' and 'restaurants' in the search path
    const { ordersSchema, restaurantsSchema } = await resolveAuthoritativeRelationSchemas(client);

    // 1. Inspect existing schema state strictly within the authoritatively resolved schemas
    const { rows: existingCols } = await client.query(`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE (table_schema = $1 AND table_name = 'orders' AND column_name IN ('tracking_token_hash', 'terminal_at', 'updated_at'))
         OR (table_schema = $2 AND table_name = 'restaurants' AND column_name = 'counter_ordering_enabled')
    `, [ordersSchema, restaurantsSchema]);

    const { rows: existingIdxs } = await client.query(`
      SELECT schemaname, tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = $1 AND tablename = 'orders' AND indexname = 'idx_orders_tracking_hash'
    `, [ordersSchema]);

    const pendingOps = [];
    for (const ddl of PHASE1_MIGRATION_DDL) {
      const targetSchema = ddl.target === 'orders' ? ordersSchema : restaurantsSchema;
      let isPresent = false;
      if (ddl.column) {
        isPresent = existingCols.some(c => c.table_schema === targetSchema && c.table_name === ddl.target && c.column_name === ddl.column);
      } else if (ddl.index) {
        isPresent = existingIdxs.some(i => i.schemaname === targetSchema && i.tablename === ddl.target && i.indexname === ddl.index);
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

    // 2. Execute pending DDL inside an atomic transaction with 2s lock timeout and 120s statement timeout
    console.log('\nApplying DDL in atomic transaction...');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '2s';");
    await client.query("SET LOCAL statement_timeout = '120s';");

    for (const op of pendingOps) {
      console.log(`  Executing: ${op.name}`);
      await client.query(op.sql);
    }

    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully.');

    // 3. Post-execution verification scoped to active search path
    // 3. Post-execution verification strictly scoped to resolved relation schemas
    const { rows: verifyCols } = await client.query(`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE (table_schema = $1 AND table_name = 'orders' AND column_name IN ('tracking_token_hash', 'terminal_at', 'updated_at'))
         OR (table_schema = $2 AND table_name = 'restaurants' AND column_name = 'counter_ordering_enabled')
    `, [ordersSchema, restaurantsSchema]);
    const { rows: verifyIdxs } = await client.query(`
      SELECT schemaname, tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = $1 AND tablename = 'orders' AND indexname = 'idx_orders_tracking_hash'
    `, [ordersSchema]);

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
