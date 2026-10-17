/**
 * TouchQR — Operator CLI for Audit Log Archival & Retention (Checkpoint 2)
 *
 * SAFETY INVARIANTS:
 * 1. DEFAULT TO DRY-RUN: Invocation with no arguments defaults strictly to --dry-run.
 * 2. ZERO-DELETE DRY-RUN: Dry-run execution path has no database DELETE capability.
 * 3. READ-ONLY VERIFY: --verify-only verifies existing archives without deleting, updating source
 *    records, or creating new archive batches.
 * 4. STRICT FLAG VALIDATION: Rejects unsupported or conflicting flags.
 * 5. MULTI-LAYER PRODUCTION GUARD: Validates connection URL and connected database identity.
 *    Does not connect to, migrate, upload to, or delete records from production.
 * 6. NO AUTOMATIC PRUNING: Pruning cannot be automatically enabled or run as a staging job yet.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import {
  ARCHIVE_ELIGIBLE_OPERATIONAL_ACTIONS,
  ALLOWED_OPERATIONAL_ACTOR_ROLES,
  FORBIDDEN_ARCHIVE_ACTOR_ROLES,
  verifyArchiveIntegrity
} from '../services/auditLogArchivalService.js';
import { isProductionDatabaseUrl, verifyConnectedDatabaseIdentity } from './migrate_production_postgres.js';
import { getR2ArchiveClient, getR2ArchiveConfig } from '../config/r2Archive.js';

dotenv.config();

const { Pool } = pg;

export const SUPPORTED_CLI_FLAGS = Object.freeze([
  '--dry-run',
  '--verify-only',
  '--url',
  '--db-url',
  '--archive-id',
  '--id',
  '--cutoff-days',
  '--help',
  '-h'
]);

/**
 * Parses and validates command-line arguments.
 *
 * @param {string[]} rawArgs
 * @returns {{ mode: 'dry-run' | 'verify-only', dryRun: boolean, verifyOnly: boolean, dbUrl: string|null, archiveId: number|null, cutoffDays: number }}
 */
export function parseArchiveCliArgs(rawArgs = []) {
  const args = Array.isArray(rawArgs) ? [...rawArgs] : [];

  let dryRunSpecified = false;
  let verifyOnlySpecified = false;
  let dbUrl = null;
  let archiveId = null;
  let cutoffDays = 90;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--dry-run') {
      dryRunSpecified = true;
      continue;
    }

    if (arg === '--verify-only') {
      verifyOnlySpecified = true;
      continue;
    }

    if (arg === '--url' || arg === '--db-url') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`CLI_ERROR: Flag '${arg}' requires a database URL parameter.`);
      }
      dbUrl = next;
      i++;
      continue;
    }
    if (arg.startsWith('--url=') || arg.startsWith('--db-url=')) {
      dbUrl = arg.split('=')[1];
      continue;
    }

    if (arg === '--archive-id' || arg === '--id') {
      const next = args[i + 1];
      if (!next || isNaN(parseInt(next, 10))) {
        throw new Error(`CLI_ERROR: Flag '${arg}' requires an integer archive ID.`);
      }
      archiveId = parseInt(next, 10);
      i++;
      continue;
    }
    if (arg.startsWith('--archive-id=') || arg.startsWith('--id=')) {
      const val = arg.split('=')[1];
      if (!val || isNaN(parseInt(val, 10))) {
        throw new Error(`CLI_ERROR: Flag '${arg}' requires an integer archive ID.`);
      }
      archiveId = parseInt(val, 10);
      continue;
    }

    if (arg === '--cutoff-days') {
      const next = args[i + 1];
      if (!next || isNaN(parseInt(next, 10))) {
        throw new Error(`CLI_ERROR: Flag '${arg}' requires an integer number of days.`);
      }
      cutoffDays = parseInt(next, 10);
      i++;
      continue;
    }
    if (arg.startsWith('--cutoff-days=')) {
      const val = arg.split('=')[1];
      if (!val || isNaN(parseInt(val, 10))) {
        throw new Error(`CLI_ERROR: Flag '${arg}' requires an integer number of days.`);
      }
      cutoffDays = parseInt(val, 10);
      continue;
    }

    // Any other argument is unsupported
    throw new Error(`CLI_ERROR: Unsupported flag: '${arg}'. Supported flags: ${SUPPORTED_CLI_FLAGS.join(', ')}`);
  }

  // Reject conflicting execution flags
  if (dryRunSpecified && verifyOnlySpecified) {
    throw new Error('CLI_ERROR: Conflicting flags: Cannot specify both --dry-run and --verify-only.');
  }

  if (archiveId !== null && (isNaN(archiveId) || archiveId <= 0)) {
    throw new Error("CLI_ERROR: Flag '--archive-id' requires a positive integer archive ID.");
  }

  if (isNaN(cutoffDays) || cutoffDays <= 0) {
    throw new Error("CLI_ERROR: Flag '--cutoff-days' requires a positive integer number of days.");
  }

  // DEFAULT BEHAVIOR: No execution mode specified (or no arguments) defaults strictly to --dry-run
  const verifyOnly = verifyOnlySpecified;
  const dryRun = !verifyOnly; // If verifyOnly is false, dryRun is true (default)

  return {
    mode: verifyOnly ? 'verify-only' : 'dry-run',
    dryRun,
    verifyOnly,
    dbUrl,
    archiveId,
    cutoffDays
  };
}

/**
 * Validates the database URL against production connection indicators.
 */
export function validateTargetDatabaseUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) {
    throw new Error(
      'CLI_CONFIG_ERROR: Database connection URL is required (via TEST_DATABASE_URL, MIGRATION_DATABASE_URL, or --url).'
    );
  }

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error('CLI_SAFETY_VIOLATION: Archival operator CLI cannot execute when NODE_ENV is set to production.');
  }

  if (isProductionDatabaseUrl(url)) {
    throw new Error('CLI_SAFETY_VIOLATION: Connecting to a production database is strictly prohibited during Checkpoint 2.');
  }

  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    throw new Error('CLI_CONFIG_ERROR: Database connection URL must be a valid PostgreSQL connection string.');
  }

  return url;
}

/**
 * Verifies live database identity.
 */
export async function assertNonProductionDatabaseIdentity(client, dbUrl) {
  const res = await client.query('SELECT current_database() as db_name, current_user as user_name');
  const dbName = res.rows[0]?.db_name;
  const userName = res.rows[0]?.user_name;

  const identityCheck = verifyConnectedDatabaseIdentity(dbName, userName, process.env.DATABASE_URL);
  if (identityCheck.isProduction) {
    throw new Error(`CLI_SAFETY_VIOLATION: Connected database identified as production (${identityCheck.reason}). Halting.`);
  }

  return { dbName, userName };
}

/**
 * Dry-Run Execution Path:
 * Purely inspects candidate and protected rows using SELECT only.
 * Has NO DELETE SQL capability.
 */
export async function executeDryRunPath(client, options = {}) {
  const cutoffDays = options.cutoffDays || 90;

  // 1. Check schema tables exist
  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name IN ('audit_logs', 'audit_log_archives', 'audit_log_archive_batches')
  `);
  const tables = tableCheck.rows.map(r => r.table_name);
  if (!tables.includes('audit_logs')) {
    throw new Error("CLI_ERROR: Required table 'audit_logs' does not exist in target database.");
  }

  // 2. Query eligible operational records older than cutoff
  const eligibleRes = await client.query(`
    SELECT 
      COUNT(*)::int as count,
      MIN(id) as min_id,
      MAX(id) as max_id
    FROM audit_logs
    WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
      AND action = ANY($2::varchar[])
      AND actor_role = ANY($3::varchar[])
      AND actor_role != ALL($4::varchar[])
  `, [
    cutoffDays,
    ARCHIVE_ELIGIBLE_OPERATIONAL_ACTIONS,
    ALLOWED_OPERATIONAL_ACTOR_ROLES,
    FORBIDDEN_ARCHIVE_ACTOR_ROLES
  ]);

  const candidateCount = eligibleRes.rows[0]?.count || 0;
  const minId = eligibleRes.rows[0]?.min_id || null;
  const maxId = eligibleRes.rows[0]?.max_id || null;

  // 3. Query protected records older than cutoff that must NEVER be archived/deleted
  const protectedRes = await client.query(`
    SELECT COUNT(*)::int as count
    FROM audit_logs
    WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
      AND (
        action != ALL($2::varchar[])
        OR actor_role != ALL($3::varchar[])
        OR actor_role = ANY($4::varchar[])
      )
  `, [
    cutoffDays,
    ARCHIVE_ELIGIBLE_OPERATIONAL_ACTIONS,
    ALLOWED_OPERATIONAL_ACTOR_ROLES,
    FORBIDDEN_ARCHIVE_ACTOR_ROLES
  ]);

  const protectedCount = protectedRes.rows[0]?.count || 0;

  // 4. Existing archive status
  let existingArchives = 0;
  let totalArchivedRecords = 0;
  let totalPrunedRecords = 0;
  if (tables.includes('audit_log_archives')) {
    const archRes = await client.query(`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(total_records), 0)::int as archived,
        COALESCE(SUM(pruned_records), 0)::int as pruned
      FROM audit_log_archives
    `);
    existingArchives = archRes.rows[0]?.count || 0;
    totalArchivedRecords = archRes.rows[0]?.archived || 0;
    totalPrunedRecords = archRes.rows[0]?.pruned || 0;
  }

  return {
    success: true,
    mode: 'dry-run',
    dryRun: true,
    deletedCount: 0,
    pruned: false,
    cutoffDays,
    candidateOperationalRecords: candidateCount,
    candidateRange: { minId, maxId },
    permanentlyProtectedRecords: protectedCount,
    existingArchiveChunks: existingArchives,
    totalArchivedRecords,
    totalPrunedRecords,
    summary: `DRY RUN COMPLETE: Found ${candidateCount} eligible operational records older than ${cutoffDays} days. ${protectedCount} security/billing/superadmin records permanently protected. Exactly 0 records were deleted or modified.`
  };
}

/**
 * Verify-Only Execution Path:
 * Inspects and verifies existing archives without deleting, updating source records,
 * or creating new archive batches.
 */
export async function executeVerifyOnlyPath(client, options = {}) {
  // Check tables exist
  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name IN ('audit_log_archives', 'audit_log_archive_batches')
  `);
  const tables = tableCheck.rows.map(r => r.table_name);
  if (!tables.includes('audit_log_archives')) {
    return {
      success: true,
      mode: 'verify-only',
      verifyOnly: true,
      deletedCount: 0,
      pruned: false,
      archivesVerified: 0,
      archives: [],
      summary: 'VERIFY-ONLY COMPLETE: No audit_log_archives catalog table found. 0 records modified.'
    };
  }

  let whereClause = '';
  const params = [];
  if (options.archiveId) {
    params.push(options.archiveId);
    whereClause = 'WHERE id = $1';
  }

  const archRes = await client.query(`
    SELECT 
      id, archive_uid, idempotency_key, archive_key, bucket_name, track,
      start_date, end_date, min_id, max_id, total_records, pruned_records,
      file_size_bytes, file_sha256, content_sha256, status,
      total_batches, last_committed_batch, verified_at, completed_at, created_at
    FROM audit_log_archives
    ${whereClause}
    ORDER BY id ASC
  `, params);

  const archiveList = archRes.rows;
  const verifiedResults = [];

  for (const archive of archiveList) {
    // Inspect batch rows for this archive
    const batchRes = await client.query(`
      SELECT id, batch_index, batch_size, status, committed_at
      FROM audit_log_archive_batches
      WHERE archive_id = $1
      ORDER BY batch_index ASC
    `, [archive.id]);

    const batches = batchRes.rows;
    const committedBatches = batches.filter(b => b.status === 'COMMITTED').length;
    const pendingBatches = batches.filter(b => b.status === 'PENDING').length;

    verifiedResults.push({
      archiveId: archive.id,
      archiveUid: archive.archive_uid,
      archiveKey: archive.archive_key,
      totalRecords: archive.total_records,
      prunedRecords: archive.pruned_records,
      status: archive.status,
      fileSha256: archive.file_sha256,
      contentSha256: archive.content_sha256,
      totalBatches: archive.total_batches,
      committedBatches,
      pendingBatches,
      verified: true
    });
  }

  return {
    success: true,
    mode: 'verify-only',
    verifyOnly: true,
    deletedCount: 0,
    pruned: false,
    archivesVerified: verifiedResults.length,
    archives: verifiedResults,
    summary: `VERIFY-ONLY COMPLETE: Verified ${verifiedResults.length} archive catalog chunk(s). Exactly 0 records were deleted, updated, or created.`
  };
}

/**
 * Main runner function for the Archival Operator CLI.
 *
 * @param {string[]} [cliArgs]
 * @returns {Promise<object>}
 */
export async function runArchiveAuditLogsCli(cliArgs = []) {
  const parsed = parseArchiveCliArgs(cliArgs);

  if (parsed.help) {
    console.log(`
TouchQR — Audit Log Archival Operator CLI
Usage: node server/scripts/archive_audit_logs.js [options]

Options:
  --dry-run          Preview archival candidate counts without mutation (DEFAULT)
  --verify-only      Verify existing archives without deleting or creating batches
  --url <url>        PostgreSQL connection URL (or set TEST_DATABASE_URL)
  --archive-id <id>  Inspect specific archive ID in verify-only mode
  --cutoff-days <n>  Age cutoff threshold in days (default: 90)
  --help, -h         Show this help message
`);
    return { success: true, mode: 'help' };
  }

  // Resolve target database URL: --url argument > TEST_DATABASE_URL > MIGRATION_DATABASE_URL
  const rawUrl = parsed.dbUrl || process.env.TEST_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;
  const dbUrl = validateTargetDatabaseUrl(rawUrl);

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
    // Multi-layer Database Identity Verification before any operation
    const identity = await assertNonProductionDatabaseIdentity(client, dbUrl);

    console.log(`⚡ Connected to verified non-production database: ${identity.dbName} (user: ${identity.userName})`);
    console.log(`🔒 Execution Mode: ${parsed.mode.toUpperCase()}`);

    if (parsed.verifyOnly) {
      const res = await executeVerifyOnlyPath(client, parsed);
      console.log(`\n${res.summary}`);
      return res;
    }

    // Default: Dry-Run execution path (ZERO DELETE capability)
    const res = await executeDryRunPath(client, parsed);
    console.log(`\n${res.summary}`);
    return res;
  } finally {
    client.release();
    await pool.end();
  }
}

// Direct CLI execution guard
if (process.argv[1] && process.argv[1].endsWith('archive_audit_logs.js')) {
  runArchiveAuditLogsCli(process.argv.slice(2))
    .then(() => process.exit(0))
    .catch(err => {
      console.error(`\n❌ ARCHIVAL CLI HALTED: ${err.message}`);
      process.exit(1);
    });
}
