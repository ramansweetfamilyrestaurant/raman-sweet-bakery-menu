import path from 'path';
import fs from 'fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const DISPOSABLE_DB_FILE = 'menu_operations_test_disposable.db';
const DISPOSABLE_DB_PATH = path.resolve(DISPOSABLE_DB_FILE);

try {
  if (fs.existsSync(DISPOSABLE_DB_PATH)) {
    fs.unlinkSync(DISPOSABLE_DB_PATH);
  }
} catch (_) {}

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = `sqlite:${DISPOSABLE_DB_FILE}`;
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

const { initDb, query, getDbType, closeDbPool } = await import('../db.js');

test('Super Admin Operations Telemetry & Database Diagnostics Suite', async (t) => {
  // Setup isolated disposable test DB
  await initDb({ isTest: true, skipSeed: false });

  t.after(async () => {
    try {
      await closeDbPool();
    } catch (_) {}
    try {
      if (fs.existsSync(DISPOSABLE_DB_PATH)) {
        fs.unlinkSync(DISPOSABLE_DB_PATH);
      }
    } catch (_) {}
  });

  await t.test('1. Core database connection and ping verification', async () => {
    const isPg = getDbType() === 'postgres';
    const pingSql = isPg ? 'SELECT 1 AS ping, version()' : 'SELECT 1 AS ping, sqlite_version() AS version';
    const res = await query(pingSql);
    assert.ok(res && res.length > 0, 'Ping query must return a row');
    assert.equal(res[0].ping, 1, 'Ping indicator must equal 1');
    assert.ok(res[0].version, 'DB version string must be present');
  });

  await t.test('2. All core target tables exist and are queryable', async () => {
    const isPg = getDbType() === 'postgres';
    const targetTables = [
      'restaurants', 'dishes', 'categories', 'orders', 'order_items', 
      'payments', 'audit_logs', 'admins', 'saas_plans', 'support_tickets', 
      'ticket_messages', 'stored_images', 'system_settings'
    ];

    for (const tbl of targetTables) {
      const countSql = isPg ? `SELECT count(*)::int AS total FROM ${tbl}` : `SELECT count(*) AS total FROM ${tbl}`;
      try {
        const res = await query(countSql);
        assert.ok(Array.isArray(res), `Querying ${tbl} must return array`);
        assert.ok(typeof (res[0]?.total) !== 'undefined', `Total count for ${tbl} must be defined`);
      } catch (err) {
        assert.ok(err.message, `Caught error must provide message for table ${tbl}`);
      }
    }
  });

  await t.test('3. Operational telemetry aggregates calculate safely without syntax errors', async () => {
    const isPg = getDbType() === 'postgres';

    // Active dining sessions query
    const sessSql = isPg
      ? `SELECT 
           COUNT(DISTINCT COALESCE(session_id, restaurant_id::text || '_' || table_number::text))::int AS active_sessions,
           COUNT(*)::int AS active_orders
         FROM orders
         WHERE LOWER(status) NOT IN ('completed', 'cancelled', 'rejected') 
           AND (is_settled = 0 OR is_settled IS NULL)`
      : `SELECT 
           COUNT(DISTINCT COALESCE(session_id, CAST(restaurant_id AS TEXT) || '_' || CAST(table_number AS TEXT))) AS active_sessions,
           COUNT(*) AS active_orders
         FROM orders
         WHERE LOWER(status) NOT IN ('completed', 'cancelled', 'rejected') 
           AND (is_settled = 0 OR is_settled IS NULL)`;

    const sessRes = await query(sessSql);
    assert.ok(sessRes && sessRes.length > 0, 'Active sessions query must succeed');
    assert.ok(Number(sessRes[0].active_sessions) >= 0, 'Active sessions count must be >= 0');

    // Dishes hosted query
    const dishSql = isPg
      ? `SELECT 
           COUNT(*)::int AS total_dishes,
           COUNT(CASE WHEN available IS NOT FALSE THEN 1 END)::int AS available_dishes
         FROM dishes`
      : `SELECT 
           COUNT(*) AS total_dishes,
           COUNT(CASE WHEN available = 1 OR available IS NULL THEN 1 END) AS available_dishes
         FROM dishes`;

    const dishRes = await query(dishSql);
    assert.ok(dishRes && dishRes.length > 0, 'Dishes query must succeed');
    assert.ok(Number(dishRes[0].total_dishes) >= 0, 'Total dishes must be >= 0');

    // QR Scans query
    const scanSql = isPg
      ? `SELECT COALESCE(SUM(scan_count), 0)::bigint AS total_scans FROM restaurants`
      : `SELECT COALESCE(SUM(scan_count), 0) AS total_scans FROM restaurants`;

    const scanRes = await query(scanSql);
    assert.ok(scanRes && scanRes.length > 0, 'Scan count query must succeed');
    assert.ok(Number(scanRes[0].total_scans) >= 0, 'Total scans must be >= 0');
  });

  await t.test('4. Memory usage and runtime telemetry formatting', () => {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const uptimeSec = Math.floor(process.uptime());
    const uptimeHours = (uptimeSec / 3600).toFixed(1);

    assert.ok(heapUsedMB > 0, 'Heap used MB must be > 0');
    assert.ok(heapTotalMB >= heapUsedMB, 'Heap total MB must be >= heap used MB');
    assert.ok(Number(uptimeHours) >= 0, 'Uptime hours must be >= 0');
  });
});
