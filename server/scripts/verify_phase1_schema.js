/**
 * Standalone Release Preflight Verification Script for TouchQR Phase 1
 *
 * Verifies presence of all required Phase 1 schema attributes in PostgreSQL:
 * - restaurants.counter_ordering_enabled
 * - orders.tracking_token_hash
 * - orders.terminal_at
 * - orders.updated_at
 * - orders.idx_orders_tracking_hash (with exact table, schema, and column coverage)
 *
 * SAFETY INVARIANTS:
 * 1. Must use explicit, consistent database target via MIGRATION_DATABASE_URL (or --url argument).
 *    NEVER silently falls back to DATABASE_URL.
 * 2. Strictly read-only: Zero DDL execution.
 * 3. Exits 0 on success, exits 1 on failure or missing configuration.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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

export function resolveTargetDatabaseUrl(options = {}, argv = process.argv) {
  const rawUrl = (typeof options === 'string' ? options : (options.url || options.migrationUrl)) ||
    getCliUrl(argv) ||
    process.env.MIGRATION_DATABASE_URL;

  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(
      'DATABASE_TARGET_CONFIG_ERROR: MIGRATION_DATABASE_URL environment variable (or --url argument) is required. ' +
      'Silent fallback to DATABASE_URL is strictly prohibited to prevent target database mismatch.'
    );
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error(`DATABASE_TARGET_CONFIG_ERROR: Target database URL is malformed: ${err.message}`);
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  // 1. Prohibit targeting the known production database endpoint
  const appDbUrl = (process.env.DATABASE_URL || '').trim();
  let prodHostname = '';
  if (appDbUrl && (appDbUrl.startsWith('postgres://') || appDbUrl.startsWith('postgresql://'))) {
    try {
      const parsedApp = new URL(appDbUrl);
      prodHostname = (parsedApp.hostname || '').toLowerCase();
    } catch (_) {}
  }

  const isProdHostLocal = prodHostname === 'localhost' || prodHostname === '127.0.0.1' || prodHostname === '::1';

  if (prodHostname && !isProdHostLocal && hostname === prodHostname) {
    throw new Error(
      `PRODUCTION_ENDPOINT_FORBIDDEN: Target host '${hostname}' is the production database endpoint. Schema verification cannot target the production host.`
    );
  }

  // 2. Positive Staging Target Identification for Remote Targets
  if (!isLocal) {
    const stagingAllowlist = getStagingHostAllowlist(options, argv);

    if (stagingAllowlist.size === 0) {
      throw new Error(
        'STAGING_HOST_CONFIG_REQUIRED: Remote schema verification requires an explicitly configured staging host allowlist via STAGING_DATABASE_HOST (or --staging-host argument).'
      );
    }

    if (prodHostname && stagingAllowlist.has(prodHostname)) {
      throw new Error(
        `STAGING_HOST_CONFIG_CONFLICT: Configured STAGING_DATABASE_HOST matches the production database endpoint '${prodHostname}'. Staging endpoint must be distinct from production.`
      );
    }

    if (!stagingAllowlist.has(hostname)) {
      throw new Error(
        `UNAUTHORIZED_REMOTE_ENDPOINT: Target host '${hostname}' does not match the explicitly configured staging endpoint allowlist (${Array.from(stagingAllowlist).join(', ')}). Arbitrary remote endpoints are prohibited.`
      );
    }
  }

  return { url: trimmed, host: hostname, isLocal };
}

export async function resolveAuthoritativeRelationSchemas(clientOrPool) {
  try {
    const { rows } = await clientOrPool.query(`
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

export async function verifyPhase1Schema(options = {}, poolOverride = null) {
  const { url, host, isLocal } = resolveTargetDatabaseUrl(options);

  console.log(`\n==================================================`);
  console.log(`🔍 TOUCHQR PHASE 1 SCHEMA PREFLIGHT VERIFIER`);
  console.log(`==================================================`);
  console.log(`Target Host        : ${host} (${isLocal ? 'LOCAL' : 'REMOTE/PRODUCTION'})`);

  const isExternalPool = Boolean(poolOverride || options.pool);
  const pool = poolOverride || options.pool || new Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000
  });

  try {
    // 0. Authoritatively resolve the exact relation schemas for 'orders' and 'restaurants' in the search path
    const { ordersSchema, restaurantsSchema } = await resolveAuthoritativeRelationSchemas(pool);

    // 1. Inspect existing schema state strictly within the authoritatively resolved schemas
    const { rows: columns } = await pool.query(`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE (table_schema = $1 AND table_name = 'orders' AND column_name IN ('tracking_token_hash', 'terminal_at', 'updated_at'))
         OR (table_schema = $2 AND table_name = 'restaurants' AND column_name = 'counter_ordering_enabled')
    `, [ordersSchema, restaurantsSchema]);

    const restoCols = (columns || []).filter(c => c.table_schema === restaurantsSchema && c.table_name === 'restaurants');
    const orderCols = (columns || []).filter(c => c.table_schema === ordersSchema && c.table_name === 'orders');

    const hasRestoCounter = restoCols.some(c => c.column_name === 'counter_ordering_enabled');
    const hasOrderHash = orderCols.some(c => c.column_name === 'tracking_token_hash');
    const hasOrderTerminal = orderCols.some(c => c.column_name === 'terminal_at');
    const hasOrderUpdated = orderCols.some(c => c.column_name === 'updated_at');

    const { rows: indexes } = await pool.query(`
      SELECT schemaname, tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = $1
        AND tablename = 'orders'
        AND indexname = 'idx_orders_tracking_hash'
    `, [ordersSchema]);

    const targetIndex = (indexes || []).find(i =>
      i.schemaname === ordersSchema &&
      i.tablename === 'orders' &&
      i.indexname === 'idx_orders_tracking_hash'
    );

    const hasValidIndex = Boolean(
      targetIndex &&
      typeof targetIndex.indexdef === 'string' &&
      /\(\s*"?restaurant_id"?\s*,\s*"?tracking_token_hash"?\s*\)/i.test(targetIndex.indexdef)
    );

    const missing = [];
    if (!hasRestoCounter) missing.push('restaurants.counter_ordering_enabled');
    if (!hasOrderHash) missing.push('orders.tracking_token_hash');
    if (!hasOrderTerminal) missing.push('orders.terminal_at');
    if (!hasOrderUpdated) missing.push('orders.updated_at');
    if (!hasValidIndex) missing.push('orders.idx_orders_tracking_hash');

    if (missing.length > 0) {
      console.error('❌ PHASE 1 PREFLIGHT FAILED: Missing required schema attributes:\n  - ' + missing.join('\n  - '));
      return { verified: false, missing };
    }

    console.log('✅ Phase 1 schema attributes verified successfully.');
    return { verified: true, missing: [] };
  } finally {
    if (!isExternalPool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

if (process.argv[1]?.endsWith('verify_phase1_schema.js')) {
  verifyPhase1Schema()
    .then(res => {
      if (!res.verified) process.exit(1);
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal preflight error:', err.message);
      process.exit(1);
    });
}
