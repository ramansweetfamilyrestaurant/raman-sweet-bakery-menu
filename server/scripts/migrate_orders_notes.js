/**
 * Dedicated PostgreSQL Migration Runner for Orders Notes Column (P2)
 *
 * Safely executes idempotent column addition for orders.notes on the local disposable test database.
 *
 * SAFETY INVARIANTS:
 * 1. Uses ONLY MIGRATION_DATABASE_URL (or explicit migrationUrl option / --url argument).
 *    NEVER silently falls back to DATABASE_URL or TEST_DATABASE_URL.
 * 2. Strict Local Disposable Guard:
 *    - Validates protocol is postgres: or postgresql:.
 *    - Requires hostname to be exactly 127.0.0.1 or localhost.
 *    - Requires database name to be exactly touchqr_disposable_test.
 *    - Rejects all other targets before opening a connection.
 *    - Strictly blocks any production markers (neon.tech, prod, etc.).
 * 3. Idempotent Execution:
 *    - Uses ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
 *    - Verifies post-execution through information_schema.columns.
 * 4. Dry Run Support:
 *    - Supports --dry-run mode that reports schema state without executing DDL.
 * 5. Rollback Safety:
 *    - Does NOT drop the column automatically during rollback to prevent data loss.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const ORDERS_NOTES_DDL = 'ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;';

/**
 * Validates the migration target database URL against strict local disposable safety invariants.
 *
 * @param {string} rawUrl - Connection URL string
 * @returns {{ url: string, host: string, database: string }}
 */
export function validateMigrationTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(
      'MIGRATION_CONFIG_ERROR: MIGRATION_DATABASE_URL is required. ' +
      'Silent fallback to DATABASE_URL or TEST_DATABASE_URL is prohibited to prevent unintended schema mutations.'
    );
  }

  const trimmed = rawUrl.trim();

  // Guard against identical production DATABASE_URL
  const appDbUrl = (process.env.DATABASE_URL || '').trim();
  if (appDbUrl && trimmed === appDbUrl) {
    throw new Error(
      'MIGRATION_SAFETY_VIOLATION: MIGRATION_DATABASE_URL is identical to DATABASE_URL. Migration runner cannot target default database.'
    );
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error(`MIGRATION_SAFETY_VIOLATION: Invalid database connection URL format: ${err.message}`);
  }

  const protocol = (parsed.protocol || '').toLowerCase();
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error(`MIGRATION_SAFETY_VIOLATION: Protocol must be postgres: or postgresql:, got ${protocol}`);
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error(
      `MIGRATION_SAFETY_VIOLATION: Migration runner is restricted to local targets only (127.0.0.1 or localhost), got: ${hostname}. ` +
      'Remote databases and Neon production are strictly forbidden.'
    );
  }

  const pathname = (parsed.pathname || '').toLowerCase();
  const dbName = pathname.replace(/^\//, '');
  if (dbName !== 'touchqr_disposable_test') {
    throw new Error(
      `MIGRATION_SAFETY_VIOLATION: Database name must be exactly touchqr_disposable_test, got: "${dbName}". ` +
      'Non-disposable databases are strictly forbidden.'
    );
  }

  // Double-check production markers
  const fullLower = trimmed.toLowerCase();
  if (fullLower.includes('neon.tech') || fullLower.includes('prod')) {
    throw new Error('MIGRATION_SAFETY_VIOLATION: Connection string contains production keywords. Aborting.');
  }

  return {
    url: trimmed,
    host: hostname,
    database: dbName
  };
}

/**
 * Checks whether orders.notes column exists in information_schema.columns.
 *
 * @param {pg.PoolClient | pg.Pool} client
 * @returns {Promise<{ exists: boolean, dataType: string | null }>}
 */
export async function checkOrdersNotesColumnExists(client) {
  const res = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'notes';
  `);
  if (res.rows && res.rows.length > 0) {
    return { exists: true, dataType: res.rows[0].data_type };
  }
  return { exists: false, dataType: null };
}

/**
 * Executes the orders notes column migration.
 *
 * @param {object} options
 * @param {string} [options.migrationUrl] - Target database URL
 * @param {boolean} [options.dryRun] - If true, checks schema without executing DDL
 * @param {boolean} [options.rollback] - If true, reports rollback behavior (does not drop column)
 * @returns {Promise<{ success: boolean, dryRun: boolean, executed: boolean, columnVerified: boolean, message: string }>}
 */
export async function runOrdersNotesMigration(options = {}) {
  const rawUrl = options.migrationUrl || process.env.MIGRATION_DATABASE_URL;
  const validated = validateMigrationTargetUrl(rawUrl);

  const dryRun = Boolean(options.dryRun);
  const rollback = Boolean(options.rollback);

  const pool = new Pool({
    connectionString: validated.url,
    ssl: false,
    connectionTimeoutMillis: 5000,
    max: 2
  });

  try {
    const client = await pool.connect();
    try {
      const beforeState = await checkOrdersNotesColumnExists(client);

      if (rollback) {
        // Rollback safety invariant: Do not drop the column automatically during rollback
        console.log('ℹ️  ROLLBACK REQUESTED: Column orders.notes is preserved to prevent irreversible customer data loss.');
        return {
          success: true,
          dryRun,
          executed: false,
          columnVerified: beforeState.exists,
          message: 'Rollback safe: Column orders.notes was preserved without dropping.'
        };
      }

      if (dryRun) {
        if (beforeState.exists) {
          console.log(`🔍 [DRY-RUN] Column orders.notes already exists (data_type: ${beforeState.dataType}). No action needed.`);
          return {
            success: true,
            dryRun: true,
            executed: false,
            columnVerified: true,
            message: `DRY_RUN: Column orders.notes already exists (${beforeState.dataType}). DDL would be skipped.`
          };
        } else {
          console.log(`🔍 [DRY-RUN] Column orders.notes does not exist. Would execute: ${ORDERS_NOTES_DDL}`);
          return {
            success: true,
            dryRun: true,
            executed: false,
            columnVerified: false,
            message: `DRY_RUN: Would execute: ${ORDERS_NOTES_DDL}`
          };
        }
      }

      // Execute DDL
      console.log(`⚡ Executing migration: ${ORDERS_NOTES_DDL}`);
      await client.query(ORDERS_NOTES_DDL);

      // Verify post-execution
      const afterState = await checkOrdersNotesColumnExists(client);
      if (!afterState.exists) {
        throw new Error('VERIFICATION_FAILED: Column orders.notes was not found in information_schema.columns after migration.');
      }

      console.log(`✅ [MIGRATION COMPLETE] orders.notes verified in information_schema (data_type: ${afterState.dataType})`);
      return {
        success: true,
        dryRun: false,
        executed: true,
        columnVerified: true,
        message: `Migration succeeded. orders.notes verified (${afterState.dataType}).`
      };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// CLI Execution Handler
if (process.argv[1] && process.argv[1].endsWith('migrate_orders_notes.js')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const rollback = args.includes('--rollback');
  const urlArg = args.find(a => a.startsWith('--url='));
  const migrationUrl = urlArg ? urlArg.split('=')[1] : process.env.MIGRATION_DATABASE_URL;

  console.log('======================================================================');
  console.log('🛡️  TOUCHQR ORDERS NOTES COLUMN MIGRATION RUNNER');
  console.log('======================================================================');

  runOrdersNotesMigration({ migrationUrl, dryRun, rollback })
    .then(result => {
      console.log('Result:', result.message);
      process.exit(0);
    })
    .catch(err => {
      console.error(`❌ Migration failed: ${err.message}`);
      process.exit(1);
    });
}
