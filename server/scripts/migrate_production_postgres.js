/**
 * Dedicated Production PostgreSQL Migration Script for TouchQR
 *
 * Safely executes additive, idempotent DDL for support ticket tables and indexes.
 *
 * SAFETY INVARIANTS:
 * 1. Must use an explicitly supplied MIGRATION_DATABASE_URL environment variable.
 *    DOES NOT fall back to DATABASE_URL or load production URL by default.
 * 2. Multi-Layer Production Guard:
 *    - Validates connection URL for production indicators.
 *    - Verifies live connected database identity (database name, user, host).
 *    - Any non-local target requires --confirm-production.
 *    - Mutation cannot be authorized merely by removing keywords from a connection string.
 * 3. Supports safe --dry-run mode that inspects schema and reports planned DDL without mutation.
 * 4. Verifies target database prerequisites and applies migrations in an atomic transaction.
 * 5. Strictly additive: NEVER drops tables, columns, indexes, or existing records.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const SUPPORT_TICKET_MIGRATION_DDL = Object.freeze([
  {
    name: 'table:support_tickets',
    type: 'table',
    target: 'support_tickets',
    sql: `
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        ticket_ref VARCHAR(64) UNIQUE NOT NULL,
        subject VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        assigned_to_admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
        assigned_to_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
      );
    `
  },
  {
    name: 'table:support_ticket_messages',
    type: 'table',
    target: 'support_ticket_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL,
        sender_id INT DEFAULT NULL,
        sender_name VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  },
  {
    name: 'index:idx_support_tickets_resto_created',
    type: 'index',
    target: 'idx_support_tickets_resto_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_resto_created ON support_tickets(restaurant_id, created_at DESC);'
  },
  {
    name: 'index:idx_support_tickets_resto_updated',
    type: 'index',
    target: 'idx_support_tickets_resto_updated',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_resto_updated ON support_tickets(restaurant_id, updated_at DESC);'
  },
  {
    name: 'index:idx_support_tickets_status',
    type: 'index',
    target: 'idx_support_tickets_status',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);'
  },
  {
    name: 'index:idx_support_tickets_priority',
    type: 'index',
    target: 'idx_support_tickets_priority',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);'
  },
  {
    name: 'index:idx_support_tickets_ref',
    type: 'index',
    target: 'idx_support_tickets_ref',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_ref ON support_tickets(ticket_ref);'
  },
  {
    name: 'index:idx_support_tickets_assigned',
    type: 'index',
    target: 'idx_support_tickets_assigned',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to_admin_id);'
  },
  {
    name: 'index:idx_support_ticket_msgs_ticket',
    type: 'index',
    target: 'idx_support_ticket_msgs_ticket',
    sql: 'CREATE INDEX IF NOT EXISTS idx_support_ticket_msgs_ticket ON support_ticket_messages(ticket_id, created_at ASC);'
  }
]);

export const ORDERS_NOTES_MIGRATION_DDL = Object.freeze([
  {
    name: 'column:orders.notes',
    type: 'column',
    schema: 'public',
    table: 'orders',
    column: 'notes',
    target: 'orders.notes',
    sql: 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;'
  }
]);

export const PRODUCTION_MIGRATION_DDL = Object.freeze([
  ...SUPPORT_TICKET_MIGRATION_DDL,
  ...ORDERS_NOTES_MIGRATION_DDL
]);

/**
 * Checks whether a PostgreSQL connection URL or environment represents production.
 */
export function isProductionDatabaseUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();

  // Keyword markers
  if (
    lower.includes('neon.tech') ||
    lower.includes('aws.neon.tech') ||
    lower.includes('touchqr_prod') ||
    lower.includes('/production') ||
    lower.includes('env=production') ||
    (lower.includes('prod') && !lower.includes('test'))
  ) {
    return true;
  }

  // Environment markers
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return true;
  }

  // Non-local host without 'test' indicator is treated as remote production target
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const db = (parsed.pathname || '').replace(/^\//, '').toLowerCase();

    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isTestDb = db.includes('test');

    if (!isLocal && !isTestDb) {
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Validates connected database identity against known production indicators.
 */
export function verifyConnectedDatabaseIdentity(dbName, userName, appDbUrl = null) {
  const lowerDb = String(dbName || '').toLowerCase();
  const lowerUser = String(userName || '').toLowerCase();

  const prodDbNames = ['production', 'prod_db', 'master_db', 'touchqr_prod', 'touchqr_production', 'live_db', 'neondb'];
  if (prodDbNames.includes(lowerDb) || (lowerDb.includes('prod') && !lowerDb.includes('test'))) {
    return { isProduction: true, reason: `Database name '${dbName}' is marked as production.` };
  }

  const prodUsers = ['prod_user', 'production_admin', 'neondb_owner'];
  if (prodUsers.includes(lowerUser)) {
    return { isProduction: true, reason: `Database user '${userName}' is a production administrative role.` };
  }

  if (appDbUrl && (appDbUrl.startsWith('postgres://') || appDbUrl.startsWith('postgresql://'))) {
    try {
      const parsedApp = new URL(appDbUrl);
      const appDbName = parsedApp.pathname.replace(/^\//, '').toLowerCase();
      if (appDbName && lowerDb === appDbName) {
        return { isProduction: true, reason: `Connected database matches application default DATABASE_URL name '${appDbName}'.` };
      }
    } catch (e) {}
  }

  return { isProduction: false, reason: null };
}

/**
 * Resolves a single migration or full registry from a migration name.
 * Rejects unknown or empty migration names with clear MIGRATION_CONFIG_ERROR before connection.
 */
export function resolveSelectedMigrations(migrationName) {
  if (migrationName === undefined || migrationName === null) {
    return PRODUCTION_MIGRATION_DDL;
  }
  const rawName = String(migrationName).trim();
  if (!rawName) {
    throw new Error('MIGRATION_CONFIG_ERROR: --migration flag cannot be empty.');
  }
  const matched = PRODUCTION_MIGRATION_DDL.filter(m => m.name === rawName);
  if (matched.length === 0) {
    const available = PRODUCTION_MIGRATION_DDL.map(m => m.name).join(', ');
    throw new Error(`MIGRATION_CONFIG_ERROR: Unknown migration name '${rawName}'. Available migrations: ${available}`);
  }
  return matched;
}

/**
 * Executes or previews PostgreSQL migration with multi-layer safety guards.
 *
 * @param {object} options
 * @param {string} [options.migrationUrl] - Target database URL (must be provided or MIGRATION_DATABASE_URL set)
 * @param {boolean} [options.dryRun] - If true, inspects schema and reports planned DDL without applying changes
 * @param {boolean} [options.confirmProduction] - Required if targeting a production database
 * @param {Array} [options.migrations] - Specific migrations to execute (defaults to PRODUCTION_MIGRATION_DDL)
 * @param {string} [options.migrationName] - Single migration name to execute from registry
 * @param {object} [options.pool] - Optional existing pg.Pool instance for testing
 * @returns {Promise<{ success: boolean, dryRun: boolean, executed: string[], skipped: string[], inspected: object }>}
 */
export async function runPostgresMigration(options = {}) {
  let migrations = options.migrations;
  if (!migrations) {
    migrations = resolveSelectedMigrations(options.migrationName);
  }
  const rawUrl = options.migrationUrl || process.env.MIGRATION_DATABASE_URL;

  // 1. Invariant: MIGRATION_DATABASE_URL must be explicitly supplied.
  // Never fall back to DATABASE_URL.
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
  const confirmProduction = Boolean(options.confirmProduction);

  // Pre-connection URL & environment check
  const isUrlProd = isProductionDatabaseUrl(dbUrl);
  if (isUrlProd && !dryRun && !confirmProduction) {
    throw new Error(
      'MIGRATION_SAFETY_VIOLATION: The target database appears to be a PRODUCTION database. ' +
      'To apply migrations to production, you must supply the explicit confirmation flag (--confirm-production).'
    );
  }

  const isLocalOrNoSsl =
    dbUrl.includes('sslmode=disable') ||
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1');

  const pool = options.pool || new Pool({
    connectionString: dbUrl,
    ssl: isLocalOrNoSsl ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  const executed = [];
  const skipped = [];
  const inspected = {
    database: null,
    user: null,
    existingTables: [],
    existingIndexes: [],
    existingColumns: []
  };

  try {
    // 2. Identity Verification: Query live connected database identity
    const ping = await pool.query('SELECT current_database() as db, current_user as usr, version()');
    const dbInfo = ping.rows[0];
    inspected.database = dbInfo.db;
    inspected.user = dbInfo.usr;

    console.log(`📡 Connected to database: ${dbInfo.db} as ${dbInfo.usr}`);

    // Live Database Identity Guard
    const identityCheck = verifyConnectedDatabaseIdentity(dbInfo.db, dbInfo.usr, process.env.DATABASE_URL);
    if (identityCheck.isProduction && !dryRun && !confirmProduction) {
      throw new Error(
        `MIGRATION_SAFETY_VIOLATION: Connected database identity check failed (${identityCheck.reason}). ` +
        'Applying mutations to production targets requires explicit --confirm-production.'
      );
    }

    // Query existing tables, indexes, and columns
    const tablesRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('support_tickets', 'support_ticket_messages', 'restaurants', 'admins', 'orders');
    `);
    inspected.existingTables = (tablesRes.rows || []).map(r => r.table_name);

    const indexesRes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('support_tickets', 'support_ticket_messages');
    `);
    inspected.existingIndexes = (indexesRes.rows || []).map(r => r.indexname);

    const columnsRes = await pool.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders';
    `);
    inspected.existingColumns = (columnsRes.rows || []).map(r => `${r.table_name}.${r.column_name}`);

    if (dryRun) {
      console.log('🔍 [DRY RUN MODE] Inspecting schema without applying modifications...');
      for (const item of migrations) {
        if (item.type === 'table') {
          const exists = inspected.existingTables.includes(item.target);
          if (exists) {
            console.log(`  ℹ️ Table '${item.target}' already exists (no change needed).`);
            skipped.push(item.name);
          } else {
            console.log(`  ➕ Table '${item.target}' WOULD be created.`);
            executed.push(item.name);
          }
        } else if (item.type === 'index') {
          const exists = inspected.existingIndexes.includes(item.target);
          if (exists) {
            console.log(`  ℹ️ Index '${item.target}' already exists (no change needed).`);
            skipped.push(item.name);
          } else {
            console.log(`  ➕ Index '${item.target}' WOULD be created.`);
            executed.push(item.name);
          }
        } else if (item.type === 'column') {
          const colTarget = item.target || `${item.table}.${item.column}`;
          const exists = inspected.existingColumns.includes(colTarget);
          if (exists) {
            console.log(`  ℹ️ Column '${colTarget}' already exists (no change needed).`);
            skipped.push(item.name);
          } else {
            console.log(`  ➕ Column '${colTarget}' WOULD be added.`);
            executed.push(item.name);
          }
        }
      }

      console.log('\n[DRY RUN SUMMARY] Planned actions: ' + executed.length + ' to create/add, ' + skipped.length + ' already exist.');
      console.log('[DRY RUN SAFETY] Zero DDL statements were executed.');
      return { success: true, dryRun: true, executed, skipped, inspected };
    }

    // 3. Prerequisite check: parent tables must exist
    const hasSupportTickets = migrations.some(m => m.name && m.name.includes('support_ticket'));
    if (hasSupportTickets) {
      const restoCheck = inspected.existingTables.includes('restaurants');
      if (!restoCheck) {
        const reg = await pool.query("SELECT to_regclass('public.restaurants') as tbl");
        if (!reg.rows[0]?.tbl) {
          throw new Error("MIGRATION_PREREQUISITE_FAILED: Parent table 'restaurants' does not exist in target database.");
        }
      }
    }

    const hasOrdersMigration = migrations.some(m => m.type === 'column' && (m.table === 'orders' || (m.target && m.target.startsWith('orders'))));
    if (hasOrdersMigration) {
      const ordersCheck = inspected.existingTables.includes('orders');
      if (!ordersCheck) {
        const reg = await pool.query("SELECT to_regclass('public.orders') as tbl");
        if (!reg.rows[0]?.tbl) {
          throw new Error("MIGRATION_PREREQUISITE_FAILED: Target table 'orders' does not exist in target database.");
        }
      }
    }

    // Capture pre-migration row counts if support ticket tables already exist
    let preTicketCount = 0;
    let preMsgCount = 0;
    if (hasSupportTickets && inspected.existingTables.includes('support_tickets')) {
      const cRes = await pool.query('SELECT COUNT(*) as count FROM support_tickets');
      preTicketCount = parseInt(cRes.rows[0]?.count || 0, 10);
    }
    if (hasSupportTickets && inspected.existingTables.includes('support_ticket_messages')) {
      const mRes = await pool.query('SELECT COUNT(*) as count FROM support_ticket_messages');
      preMsgCount = parseInt(mRes.rows[0]?.count || 0, 10);
    }

    // Apply migrations inside a single atomic transaction
    console.log('⚡ Applying migrations in target database (atomic transaction)...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of migrations) {
        await client.query(item.sql);
        executed.push(item.name);
        console.log(`  ✓ ${item.name} applied successfully.`);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Verify post-migration table presence & row counts for support tickets
    if (hasSupportTickets && inspected.existingTables.includes('support_tickets') && inspected.existingTables.includes('support_ticket_messages')) {
      const postTicketCountRes = await pool.query('SELECT COUNT(*) as count FROM support_tickets');
      const postMsgCountRes = await pool.query('SELECT COUNT(*) as count FROM support_ticket_messages');
      const postTicketCount = parseInt(postTicketCountRes.rows[0]?.count || 0, 10);
      const postMsgCount = parseInt(postMsgCountRes.rows[0]?.count || 0, 10);

      if (postTicketCount < preTicketCount || postMsgCount < preMsgCount) {
        throw new Error('MIGRATION_INTEGRITY_VIOLATION: Row count decreased post-migration.');
      }

      console.log(`📊 Post-migration verification: ${postTicketCount} tickets, ${postMsgCount} messages exist (data preserved).`);
    }

    // Targeted schema verification for column additions (e.g., orders.notes)
    // Avoids full-table COUNT(*) on orders for fast, metadata-only column additions
    if (hasOrdersMigration) {
      const colRes = await pool.query(`
        SELECT table_schema, table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'notes';
      `);

      if (!colRes.rows || colRes.rows.length === 0) {
        throw new Error("MIGRATION_VERIFICATION_FAILED: Column 'public.orders.notes' was not found in information_schema after migration.");
      }

      const col = colRes.rows[0];
      if (col.data_type !== 'text') {
        throw new Error(`MIGRATION_VERIFICATION_FAILED: Expected column 'public.orders.notes' data_type to be 'text', got '${col.data_type}'.`);
      }
      if (col.is_nullable !== 'YES') {
        throw new Error(`MIGRATION_VERIFICATION_FAILED: Expected column 'public.orders.notes' is_nullable to be 'YES', got '${col.is_nullable}'.`);
      }

      console.log(`🔍 Verified column public.orders.notes: data_type=${col.data_type}, is_nullable=${col.is_nullable}`);
    }

    return { success: true, dryRun: false, executed, skipped, inspected };
  } finally {
    if (!options.pool) {
      await pool.end().catch(() => {});
    }
  }
}

// CLI entry point
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('migrate_production_postgres.js')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirmProduction = args.includes('--confirm-production');
  const migrationArg = args.find(a => a.startsWith('--migration=') || a === '--migration');

  let migrationName = undefined;
  if (migrationArg) {
    if (migrationArg === '--migration') {
      const idx = args.indexOf('--migration');
      migrationName = args[idx + 1] !== undefined ? args[idx + 1] : '';
    } else {
      migrationName = migrationArg.slice('--migration='.length);
    }
  }

  console.log('======================================================================');
  console.log('🛡️  TOUCHQR POSTGRESQL MIGRATION RUNNER');
  console.log('======================================================================');
  if (migrationName !== undefined) {
    console.log(`Target: SINGLE MIGRATION (${migrationName || '<empty>'})`);
  } else {
    console.log('Target: ALL REGISTERED MIGRATIONS (Default)');
  }
  if (dryRun) {
    console.log('Mode: DRY RUN (Read-Only Safety Check)');
  }

  runPostgresMigration({ dryRun, confirmProduction, migrationName })
    .then((result) => {
      console.log('\n======================================================================');
      if (result.dryRun) {
        console.log('✅ DRY RUN COMPLETED SUCCESSFULLY (No changes were made)');
      } else {
        console.log('✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY');
      }
      console.log('======================================================================\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ MIGRATION FAILED:', err.message);
      process.exit(1);
    });
}
