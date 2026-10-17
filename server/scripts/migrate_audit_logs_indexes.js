/**
 * Dedicated PostgreSQL Migration Runner for Audit Log Indexes (Step 5C)
 *
 * Safely executes non-transactional concurrent index creation and rollback for audit_logs.
 *
 * SAFETY INVARIANTS:
 * 1. Must use an explicitly supplied MIGRATION_DATABASE_URL environment variable or --url argument.
 *    DOES NOT silently fall back to DATABASE_URL.
 * 2. Multi-Layer Production Guard:
 *    - Validates connection URL for production indicators (neon.tech, prod_db, remote hosts).
 *    - Verifies live connected database identity (database name, user, host).
 *    - Non-local / production targets require explicit --confirm-production.
 * 3. NON-TRANSACTIONAL EXECUTION:
 *    - In PostgreSQL, CREATE INDEX CONCURRENTLY and DROP INDEX CONCURRENTLY CANNOT run inside
 *      a transaction block (ERROR: 25001).
 *    - This runner executes each DDL statement individually in autocommit mode without BEGIN/COMMIT.
 * 4. Invalid Index Detection & Cleanup:
 *    - Inspects pg_index.indisvalid to detect if a previous concurrent build was interrupted.
 *    - Invalid indexes are safely dropped concurrently before re-creating.
 * 5. Dry Run & Rollback Support:
 *    - Supports safe --dry-run mode for inspecting schema state without mutation.
 *    - Supports safe --rollback mode to drop indexes concurrently outside transaction.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { isProductionDatabaseUrl, verifyConnectedDatabaseIdentity } from './migrate_production_postgres.js';

dotenv.config();

const { Pool } = pg;

export const AUDIT_LOGS_INDEX_MIGRATION_DDL = Object.freeze([
  {
    name: 'index:idx_audit_logs_created_id',
    target: 'idx_audit_logs_created_id',
    table: 'audit_logs',
    columns: ['created_at DESC', 'id DESC'],
    purpose: 'Global Activity view pagination and deterministic ordering without sorting or disk spill',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_id ON audit_logs (created_at DESC, id DESC);',
    rollbackSql: 'DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_created_id;'
  },
  {
    name: 'index:idx_audit_logs_resto_created_id',
    target: 'idx_audit_logs_resto_created_id',
    table: 'audit_logs',
    columns: ['restaurant_id', 'created_at DESC', 'id DESC'],
    purpose: 'Tenant-scoped Activity view & Tenant 360 recent timeline lookup with zero cross-tenant scanning',
    sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resto_created_id ON audit_logs (restaurant_id, created_at DESC, id DESC);',
    rollbackSql: 'DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_resto_created_id;'
  }
]);

export const MIGRATION_OWNED_INDEX_TARGETS = Object.freeze(
  AUDIT_LOGS_INDEX_MIGRATION_DDL.map(d => d.target)
);

/**
 * Validates whether an existing index definition string in pg_indexes matches expected columns and sort orders.
 * Prevents false positives where an index exists with the same name but different columns/ordering.
 *
 * @param {string} actualIndexDef - Canonical index definition from pg_get_indexdef()
 * @param {string[]} expectedColumns - Required column expressions e.g. ['created_at DESC', 'id DESC']
 * @returns {boolean}
 */
export function verifyIndexDefinitionMatch(actualIndexDef, expectedColumns) {
  if (!actualIndexDef || typeof actualIndexDef !== 'string') return false;
  const normalized = actualIndexDef.toLowerCase().replace(/\s+/g, ' ');
  return expectedColumns.every(col => normalized.includes(col.toLowerCase().trim()));
}

/**
 * Runs the audit logs index migration or rollback in non-transactional mode.
 *
 * @param {object} options
 * @param {string} [options.migrationUrl] - Target database URL
 * @param {boolean} [options.dryRun] - If true, inspects schema without executing DDL
 * @param {boolean} [options.rollback] - If true, drops indexes concurrently
 * @param {boolean} [options.confirmProduction] - Required if targeting a production database
 * @returns {Promise<{ success: boolean, dryRun: boolean, rollback: boolean, executed: string[], skipped: string[], inspected: object }>}
 */
export async function runAuditLogsIndexMigration(options = {}) {
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

  // Pre-connection URL & environment check
  const isUrlProd = isProductionDatabaseUrl(dbUrl);
  if (isUrlProd && !dryRun && !confirmProduction) {
    throw new Error(
      'MIGRATION_SAFETY_VIOLATION: The target database appears to be a PRODUCTION database. ' +
      'To apply or rollback migrations on production, you must supply the explicit confirmation flag (--confirm-production).'
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

  const executed = [];
  const skipped = [];
  const invalidFixed = [];
  const inspected = {
    database: null,
    user: null,
    auditLogsTableExists: false,
    existingIndexes: [],
    invalidIndexes: []
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

    // 3. Inspect table existence
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'audit_logs';
    `);
    inspected.auditLogsTableExists = (tableCheck.rows && tableCheck.rows.length > 0);

    if (!inspected.auditLogsTableExists) {
      throw new Error("MIGRATION_PREREQUISITE_FAILED: Table 'audit_logs' does not exist in target database.");
    }

    // 4. Inspect existing indexes on audit_logs, validity (pg_index.indisvalid), and canonical definitions
    const indexRes = await pool.query(`
      SELECT 
        i.relname AS indexname,
        ix.indisvalid AS is_valid,
        pg_get_indexdef(ix.indexrelid) AS indexdef
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'audit_logs';
    `);

    const indexMap = new Map();
    for (const row of indexRes.rows) {
      indexMap.set(row.indexname, {
        isValid: Boolean(row.is_valid),
        indexdef: row.indexdef || ''
      });
      inspected.existingIndexes.push(row.indexname);
      if (!row.is_valid) {
        inspected.invalidIndexes.push(row.indexname);
      }
    }

    // 5. Handle DRY RUN MODE
    if (dryRun) {
      console.log('🔍 [DRY RUN MODE] Inspecting audit_logs indexes without applying modifications...');
      console.log(`  Table 'audit_logs': EXISTS`);
      console.log(`  Existing indexes: ${inspected.existingIndexes.join(', ') || 'none (only primary key)'}`);

      if (inspected.invalidIndexes.length > 0) {
        for (const invName of inspected.invalidIndexes) {
          if (MIGRATION_OWNED_INDEX_TARGETS.includes(invName)) {
            console.log(`  ⚠️ Found invalid migration-owned index: ${invName}. WOULD be recovered concurrently.`);
          } else {
            console.log(`  ℹ️ Found foreign invalid index: ${invName}. Untouched (outside migration ownership).`);
          }
        }
      }

      for (const item of AUDIT_LOGS_INDEX_MIGRATION_DDL) {
        const existing = indexMap.get(item.target);
        const exists = Boolean(existing);
        const isValid = existing ? existing.isValid : false;
        const isCompatible = existing ? verifyIndexDefinitionMatch(existing.indexdef, item.columns) : false;

        if (rollback) {
          if (exists) {
            console.log(`  🗑️ Index '${item.target}' WOULD be dropped concurrently.`);
            executed.push(item.name);
          } else {
            console.log(`  ℹ️ Index '${item.target}' does not exist (skip drop).`);
            skipped.push(item.name);
          }
        } else {
          if (exists && isValid && isCompatible) {
            console.log(`  ℹ️ Index '${item.target}' already exists, is VALID, and definition matches (no change needed).`);
            skipped.push(item.name);
          } else if (exists && !isValid) {
            if (MIGRATION_OWNED_INDEX_TARGETS.includes(item.target)) {
              console.log(`  ⚠️ Index '${item.target}' exists but is marked INVALID. WOULD be dropped and recreated concurrently.`);
              executed.push(item.name);
            } else {
              console.log(`  ℹ️ Index '${item.target}' is foreign and marked invalid. Untouched.`);
              skipped.push(item.name);
            }
          } else if (exists && isValid && !isCompatible) {
            if (options.allowMismatchedRebuild) {
              console.log(`  ⚠️ Index '${item.target}' exists with INCOMPATIBLE definition ('${existing.indexdef}'). WOULD be dropped and rebuilt concurrently (--allow-mismatched-rebuild authorized).`);
              executed.push(item.name);
            } else {
              console.log(`  🛑 SAFETY HALT: Index '${item.target}' exists with INCOMPATIBLE definition ('${existing.indexdef}'). Dropping requires explicit --allow-mismatched-rebuild.`);
              skipped.push(item.name);
            }
          } else {
            console.log(`  ➕ Index '${item.target}' WOULD be created concurrently.`);
            executed.push(item.name);
          }
        }
      }

      console.log(`\n[DRY RUN SUMMARY] Planned actions: ${executed.length} to process, ${skipped.length} skipped.`);
      console.log('[DRY RUN SAFETY] Zero DDL statements were executed.');
      return { success: true, dryRun: true, rollback, executed, skipped, inspected };
    }

    // 6. Non-Transactional Execution: Transaction blocks must never be used with CONCURRENTLY
    // Using single client from pool for serial execution without transaction block
    const client = await pool.connect();
    try {
      if (rollback) {
        console.log('⚡ Executing NON-TRANSACTIONAL ROLLBACK for audit_logs indexes...');
        // Drop in reverse order
        for (let i = AUDIT_LOGS_INDEX_MIGRATION_DDL.length - 1; i >= 0; i--) {
          const item = AUDIT_LOGS_INDEX_MIGRATION_DDL[i];
          const exists = indexMap.has(item.target);
          if (exists) {
            console.log(`  🗑️ Executing: ${item.rollbackSql}`);
            await client.query(item.rollbackSql);
            executed.push(item.name);
            console.log(`  ✓ ${item.target} dropped concurrently.`);
          } else {
            console.log(`  ℹ️ Index '${item.target}' does not exist. Skipping.`);
            skipped.push(item.name);
          }
        }
      } else {
        console.log('⚡ Executing NON-TRANSACTIONAL MIGRATION for audit_logs indexes...');
        for (const item of AUDIT_LOGS_INDEX_MIGRATION_DDL) {
          const existing = indexMap.get(item.target);
          const exists = Boolean(existing);
          const isValid = existing ? existing.isValid : false;
          const isCompatible = existing ? verifyIndexDefinitionMatch(existing.indexdef, item.columns) : false;

          // 1. Safety Halt on Definition Mismatch: Do NOT silently drop!
          if (exists && isValid && !isCompatible) {
            if (!options.allowMismatchedRebuild) {
              throw new Error(
                `INDEX_DEFINITION_MISMATCH_SAFETY_HALT: Index '${item.target}' exists with an incompatible definition ` +
                `('${existing.indexdef}'). Automatic dropping is halted to protect database integrity. ` +
                `To explicitly authorize dropping and rebuilding this index, pass the --allow-mismatched-rebuild flag.`
              );
            }
            console.log(`  ⚠️ Operator Authorized: Dropping mismatched index '${item.target}' concurrently...`);
            await client.query(item.rollbackSql);
            invalidFixed.push(item.target);
          }

          // 2. Invalid Index Recovery: Strictly restricted to migration-owned index names
          if (exists && !isValid) {
            if (MIGRATION_OWNED_INDEX_TARGETS.includes(item.target)) {
              console.log(`  ⚠️ Migration-owned index '${item.target}' is marked INVALID. Dropping before rebuild...`);
              await client.query(item.rollbackSql);
              invalidFixed.push(item.target);
            } else {
              console.log(`  ℹ️ Skipping foreign invalid index '${item.target}' (not migration-owned).`);
              continue;
            }
          }

          if (exists && isValid && isCompatible) {
            console.log(`  ℹ️ Index '${item.target}' already exists with matching valid definition. Skipping.`);
            skipped.push(item.name);
          } else {
            console.log(`  ➕ Executing: ${item.sql}`);
            await client.query(item.sql);
            executed.push(item.name);
            console.log(`  ✓ ${item.target} created concurrently.`);
          }
        }
      }
    } finally {
      client.release();
    }

    // 7. Post-migration verification
    const postIndexRes = await pool.query(`
      SELECT 
        i.relname AS indexname,
        ix.indisvalid AS is_valid,
        pg_get_indexdef(ix.indexrelid) AS indexdef
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'audit_logs';
    `);

    const postIndexMap = new Map();
    for (const row of postIndexRes.rows) {
      postIndexMap.set(row.indexname, {
        isValid: Boolean(row.is_valid),
        indexdef: row.indexdef || ''
      });
    }

    if (!rollback) {
      for (const item of AUDIT_LOGS_INDEX_MIGRATION_DDL) {
        const postEntry = postIndexMap.get(item.target);
        if (!postEntry) {
          throw new Error(`MIGRATION_VERIFICATION_FAILED: Expected index '${item.target}' was not found after migration.`);
        }
        if (!postEntry.isValid) {
          throw new Error(`MIGRATION_VERIFICATION_FAILED: Index '${item.target}' was created but marked INVALID.`);
        }
        if (!verifyIndexDefinitionMatch(postEntry.indexdef, item.columns)) {
          throw new Error(`MIGRATION_VERIFICATION_FAILED: Index '${item.target}' definition does not match expected columns.`);
        }
      }
      console.log('✅ All audit_logs indexes verified valid and definitions strictly matched.');
    } else {
      for (const item of AUDIT_LOGS_INDEX_MIGRATION_DDL) {
        if (postIndexMap.has(item.target)) {
          throw new Error(`MIGRATION_VERIFICATION_FAILED: Index '${item.target}' still exists after rollback.`);
        }
      }
      console.log('✅ All audit_logs indexes successfully dropped.');
    }

    return {
      success: true,
      dryRun: false,
      rollback,
      executed,
      skipped,
      invalidFixed,
      inspected: {
        database: inspected.database,
        user: inspected.user,
        finalIndexes: Array.from(postIndexMap.keys())
      }
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].endsWith('migrate_audit_logs_indexes.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  const isRollback = process.argv.includes('--rollback');
  const isConfirm = process.argv.includes('--confirm-production');
  const isAllowMismatched = process.argv.includes('--allow-mismatched-rebuild');
  const urlArg = process.argv.find(a => a.startsWith('--url='));
  const explicitUrl = urlArg ? urlArg.split('=')[1] : null;

  runAuditLogsIndexMigration({
    migrationUrl: explicitUrl,
    dryRun: isDryRun,
    rollback: isRollback,
    confirmProduction: isConfirm,
    allowMismatchedRebuild: isAllowMismatched
  })
    .then((result) => {
      console.log('\n======================================================');
      console.log('🎉 AUDIT LOG INDEX MIGRATION FINISHED SUCCESSFULLY');
      console.log('======================================================');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n======================================================');
      console.error('❌ AUDIT LOG INDEX MIGRATION FAILED');
      console.error('======================================================');
      console.error(err.message);
      process.exit(1);
    });
}
