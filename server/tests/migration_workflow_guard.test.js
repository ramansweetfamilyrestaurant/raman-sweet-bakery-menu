/**
 * PostgreSQL Migration Workflow & Production Guard Test Suite
 *
 * Verifies that:
 * 1. Missing MIGRATION_DATABASE_URL is rejected with explicit error.
 * 2. Does NOT fall back to DATABASE_URL.
 * 3. Production targets require --confirm-production and throw without it.
 * 4. Dry-run mode behaves safely without modifying schemas.
 * 5. DDL is strictly additive and idempotent.
 */

import assert from 'assert';
import pg from 'pg';
import {
  runPostgresMigration,
  isProductionDatabaseUrl,
  resolveSelectedMigrations,
  SUPPORT_TICKET_MIGRATION_DDL,
  ORDERS_NOTES_MIGRATION_DDL,
  PRODUCTION_MIGRATION_DDL
} from '../scripts/migrate_production_postgres.js';
import { validateMigrationTargetUrl } from '../scripts/migrate_orders_notes.js';

console.log('======================================================================');
console.log('🛡️  POSTGRESQL MIGRATION WORKFLOW & GUARD TEST SUITE');
console.log('======================================================================\n');

const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

async function runSuite() {
  // Validate local test URL before connecting
  validateMigrationTargetUrl(LOCAL_TEST_URL);

  // -------------------------------------------------------------------
  // 1. Missing MIGRATION_DATABASE_URL is rejected
  // -------------------------------------------------------------------
  await test('1. Missing MIGRATION_DATABASE_URL is rejected with clear error', async () => {
    delete process.env.MIGRATION_DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://fake_user:fake_pass@fake-host:5432/fake_db';

    await assert.rejects(
      async () => {
        await runPostgresMigration();
      },
      (err) => {
        assert(err.message.includes('MIGRATION_CONFIG_ERROR'), `Expected MIGRATION_CONFIG_ERROR, got: ${err.message}`);
        assert(err.message.includes('MIGRATION_DATABASE_URL environment variable is required'));
        assert(err.message.includes('Silent fallback to DATABASE_URL is prohibited'));
        return true;
      }
    );
  });

  // -------------------------------------------------------------------
  // 2. Non-Postgres URL is rejected
  // -------------------------------------------------------------------
  await test('2. Non-Postgres URL is rejected', async () => {
    await assert.rejects(
      async () => {
        await runPostgresMigration({ migrationUrl: 'sqlite:menu.db' });
      },
      /must be a valid PostgreSQL connection string/
    );
  });

  // -------------------------------------------------------------------
  // 3. Production target recognition
  // -------------------------------------------------------------------
  await test('3. isProductionDatabaseUrl identifies production indicators', () => {
    assert.strictEqual(isProductionDatabaseUrl('postgres://user:pass@ep-cool-fog-123.aws.neon.tech/neondb'), true);
    assert.strictEqual(isProductionDatabaseUrl('postgres://user:pass@ep-cool-fog-123.neon.tech/touchqr_prod'), true);
    assert.strictEqual(isProductionDatabaseUrl('postgresql://user:pass@prod-server.com/touchqr_production'), true);
    assert.strictEqual(isProductionDatabaseUrl('postgres://user:pass@myhost:5432/touchqr_test'), false);
    assert.strictEqual(isProductionDatabaseUrl('postgres://user:pass@localhost:5432/dev_db'), false);
  });

  // -------------------------------------------------------------------
  // 4. Production target requires explicit --confirm-production
  // -------------------------------------------------------------------
  await test('4. Production target throws MIGRATION_SAFETY_VIOLATION when confirmProduction is false', async () => {
    const prodUrl = 'postgres://user:pass@ep-cool-fog-123.aws.neon.tech/neondb';

    await assert.rejects(
      async () => {
        await runPostgresMigration({ migrationUrl: prodUrl, dryRun: false, confirmProduction: false });
      },
      (err) => {
        assert(err.message.includes('MIGRATION_SAFETY_VIOLATION'), `Expected MIGRATION_SAFETY_VIOLATION, got: ${err.message}`);
        assert(err.message.includes('--confirm-production'));
        return true;
      }
    );
  });

  // -------------------------------------------------------------------
  // 5. Migration DDL contains required support ticket tables and indexes
  // -------------------------------------------------------------------
  await test('5. Migration DDL definitions are strictly additive (IF NOT EXISTS)', () => {
    assert(SUPPORT_TICKET_MIGRATION_DDL.length >= 9, 'Must define at least 2 tables and 7 indexes');

    const tableNames = SUPPORT_TICKET_MIGRATION_DDL.filter(d => d.type === 'table').map(d => d.target);
    assert(tableNames.includes('support_tickets'), 'Must include support_tickets table');
    assert(tableNames.includes('support_ticket_messages'), 'Must include support_ticket_messages table');

    for (const ddl of SUPPORT_TICKET_MIGRATION_DDL) {
      assert(ddl.sql.includes('IF NOT EXISTS'), `DDL for ${ddl.name} must use IF NOT EXISTS for idempotency`);
      assert(!ddl.sql.includes('DROP TABLE'), `DDL for ${ddl.name} must not drop tables`);
      assert(!ddl.sql.includes('DROP INDEX'), `DDL for ${ddl.name} must not drop indexes`);
      assert(!ddl.sql.includes('TRUNCATE'), `DDL for ${ddl.name} must not truncate data`);
    }
  });

  // -------------------------------------------------------------------
  // 6. verifyConnectedDatabaseIdentity checks
  // -------------------------------------------------------------------
  await test('6. verifyConnectedDatabaseIdentity flags production database names and administrative roles', async () => {
    const { verifyConnectedDatabaseIdentity } = await import('../scripts/migrate_production_postgres.js');

    const check1 = verifyConnectedDatabaseIdentity('touchqr_prod', 'app_user');
    assert.strictEqual(check1.isProduction, true);

    const check2 = verifyConnectedDatabaseIdentity('neondb', 'neondb_owner');
    assert.strictEqual(check2.isProduction, true);

    const check3 = verifyConnectedDatabaseIdentity('my_test_db', 'test_user');
    assert.strictEqual(check3.isProduction, false);

    const check4 = verifyConnectedDatabaseIdentity('custom_db', 'app_user', 'postgresql://user:pass@somehost/custom_db');
    assert.strictEqual(check4.isProduction, true);
  });

  // -------------------------------------------------------------------
  // 7. Non-local target without 'test' indicator requires --confirm-production
  // -------------------------------------------------------------------
  await test('7. Remote PostgreSQL target without test indicator requires --confirm-production', async () => {
    const remoteUrl = 'postgresql://user:pass@remote-postgres.internal:5432/appdb';
    assert.strictEqual(isProductionDatabaseUrl(remoteUrl), true, 'Remote target must be treated as production');

    await assert.rejects(
      async () => {
        await runPostgresMigration({ migrationUrl: remoteUrl, dryRun: false, confirmProduction: false });
      },
      /MIGRATION_SAFETY_VIOLATION/
    );
  });

  // -------------------------------------------------------------------
  // 8. orders.notes registration in PRODUCTION_MIGRATION_DDL
  // -------------------------------------------------------------------
  await test('8. orders.notes is registered with exact DDL and strictly additive invariants', () => {
    assert(ORDERS_NOTES_MIGRATION_DDL.length === 1, 'ORDERS_NOTES_MIGRATION_DDL must define exactly 1 migration item');
    const item = ORDERS_NOTES_MIGRATION_DDL[0];
    assert.strictEqual(item.name, 'column:orders.notes');
    assert.strictEqual(item.type, 'column');
    assert.strictEqual(item.schema, 'public');
    assert.strictEqual(item.table, 'orders');
    assert.strictEqual(item.column, 'notes');
    assert.strictEqual(item.sql, 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes TEXT;');

    // Invariants: nullable, no default, no NOT NULL, no DROP / RENAME
    assert(item.sql.includes('IF NOT EXISTS'), 'DDL must use IF NOT EXISTS for idempotency');
    assert(!item.sql.includes('NOT NULL'), 'notes column must remain nullable');
    assert(!item.sql.includes('DEFAULT'), 'notes column must not set a default value');
    assert(!item.sql.includes('DROP'), 'DDL must not drop any column');
    assert(!item.sql.includes('RENAME'), 'DDL must not rename any column');

    // Confirm presence in PRODUCTION_MIGRATION_DDL
    const prodItems = PRODUCTION_MIGRATION_DDL.map(m => m.name);
    assert(prodItems.includes('column:orders.notes'), 'PRODUCTION_MIGRATION_DDL must include column:orders.notes');
    assert(prodItems.includes('table:support_tickets'), 'PRODUCTION_MIGRATION_DDL must include support_tickets');
  });

  // -------------------------------------------------------------------
  // 9. resolveSelectedMigrations resolves single migration and preserves default
  // -------------------------------------------------------------------
  await test('9. resolveSelectedMigrations resolves single named migration and preserves default', () => {
    // Single named migration
    const selected = resolveSelectedMigrations('column:orders.notes');
    assert.strictEqual(selected.length, 1);
    assert.strictEqual(selected[0].name, 'column:orders.notes');

    // Preserves default when omitted
    const allDefault = resolveSelectedMigrations(undefined);
    assert.strictEqual(allDefault.length, PRODUCTION_MIGRATION_DDL.length);
    assert.strictEqual(allDefault, PRODUCTION_MIGRATION_DDL);

    const nullDefault = resolveSelectedMigrations(null);
    assert.strictEqual(nullDefault.length, PRODUCTION_MIGRATION_DDL.length);
  });

  // -------------------------------------------------------------------
  // 10. Unknown or empty migration names fail safely before connection
  // -------------------------------------------------------------------
  await test('10. Unknown or empty migration names fail safely with MIGRATION_CONFIG_ERROR', async () => {
    // Empty migration name
    assert.throws(
      () => resolveSelectedMigrations(''),
      /MIGRATION_CONFIG_ERROR: --migration flag cannot be empty/
    );
    assert.throws(
      () => resolveSelectedMigrations('   '),
      /MIGRATION_CONFIG_ERROR: --migration flag cannot be empty/
    );

    // Unknown migration name
    assert.throws(
      () => resolveSelectedMigrations('unknown:some_random_table'),
      /MIGRATION_CONFIG_ERROR: Unknown migration name 'unknown:some_random_table'/
    );

    // SQL injection attempt through migration name rejected
    assert.throws(
      () => resolveSelectedMigrations('column:orders.notes; DROP TABLE orders;'),
      /MIGRATION_CONFIG_ERROR: Unknown migration name/
    );

    // runPostgresMigration fails closed before opening DB connection
    await assert.rejects(
      async () => {
        await runPostgresMigration({
          migrationUrl: LOCAL_TEST_URL,
          migrationName: 'invalid_migration_name'
        });
      },
      /MIGRATION_CONFIG_ERROR: Unknown migration name/
    );

    await assert.rejects(
      async () => {
        await runPostgresMigration({
          migrationUrl: LOCAL_TEST_URL,
          migrationName: ''
        });
      },
      /MIGRATION_CONFIG_ERROR: --migration flag cannot be empty/
    );
  });

  // -------------------------------------------------------------------
  // 11. --migration=column:orders.notes --dry-run examines only column:orders.notes
  // -------------------------------------------------------------------
  await test('11. --migration=column:orders.notes --dry-run examines ONLY orders.notes (missing column mock)', async () => {
    const mockQueries = [];
    const mockPool = {
      query: async (sql) => {
        mockQueries.push(sql);
        if (sql.includes('SELECT current_database()')) {
          return { rows: [{ db: 'touchqr_disposable_test', usr: 'postgres', version: 'PostgreSQL 16' }] };
        }
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ table_name: 'orders' }] };
        }
        if (sql.includes('pg_indexes')) {
          return { rows: [] };
        }
        if (sql.includes('information_schema.columns')) {
          // Table exists but 'notes' column is missing
          return { rows: [{ table_schema: 'public', table_name: 'orders', column_name: 'id', data_type: 'integer', is_nullable: 'NO' }] };
        }
        return { rows: [] };
      },
      end: async () => {}
    };

    const dryRunResult = await runPostgresMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: true,
      migrationName: 'column:orders.notes',
      pool: mockPool
    });

    assert.strictEqual(dryRunResult.dryRun, true, 'Result must report dryRun = true');
    assert.strictEqual(dryRunResult.executed.length, 1, 'Only orders.notes must be planned');
    assert.strictEqual(dryRunResult.executed[0], 'column:orders.notes');
    assert.strictEqual(dryRunResult.skipped.length, 0);

    // Crucial: No support ticket tables or indexes are in executed or skipped
    const allActions = [...dryRunResult.executed, ...dryRunResult.skipped];
    assert(!allActions.some(a => a.includes('support_ticket')), 'Support ticket migrations must be completely excluded');
    assert(!mockQueries.some(q => q.includes('ALTER TABLE')), 'Dry run must NOT execute ALTER TABLE DDL');
  });

  // -------------------------------------------------------------------
  // 12. Existing orders.notes reported as already present, with no DDL during dry-run
  // -------------------------------------------------------------------
  await test('12. Existing orders.notes is reported as already present, with no DDL during dry-run', async () => {
    const dryRunReal = await runPostgresMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: true,
      migrationName: 'column:orders.notes'
    });

    assert.strictEqual(dryRunReal.dryRun, true);
    assert.strictEqual(dryRunReal.skipped.length, 1);
    assert.strictEqual(dryRunReal.skipped[0], 'column:orders.notes', 'Existing column must be reported as skipped in dry-run');
    assert.strictEqual(dryRunReal.executed.length, 0, 'Planned actions must be 0 when column already exists');

    // Confirms support tickets were NOT examined
    const allActions = [...dryRunReal.executed, ...dryRunReal.skipped];
    assert(!allActions.some(a => a.includes('support_ticket')), 'Support ticket migrations must be completely excluded');
  });

  // -------------------------------------------------------------------
  // 13. Selected execution applies only the notes migration
  // -------------------------------------------------------------------
  await test('13. Selected execution applies ONLY the notes migration', async () => {
    const applyResult = await runPostgresMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: false,
      migrationName: 'column:orders.notes'
    });

    assert.strictEqual(applyResult.success, true);
    assert.strictEqual(applyResult.dryRun, false);
    assert.strictEqual(applyResult.executed.length, 1);
    assert.strictEqual(applyResult.executed[0], 'column:orders.notes');
    assert(!applyResult.executed.some(a => a.includes('support_ticket')), 'No support ticket migrations were executed');
  });

  // -------------------------------------------------------------------
  // 14. Repeated selected execution is idempotent
  // -------------------------------------------------------------------
  await test('14. Repeated selected execution is idempotent', async () => {
    const rerunResult = await runPostgresMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: false,
      migrationName: 'column:orders.notes'
    });

    assert.strictEqual(rerunResult.success, true);
    assert.strictEqual(rerunResult.dryRun, false);

    // Verify column exists exactly once in information_schema
    const pool = new pg.Pool({ connectionString: LOCAL_TEST_URL });
    try {
      const countRes = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'notes';
      `);
      assert.strictEqual(parseInt(countRes.rows[0].count, 10), 1, 'Column public.orders.notes must exist exactly once');

      // Verify schema properties
      const colRes = await pool.query(`
        SELECT data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'notes';
      `);
      assert.strictEqual(colRes.rows[0].data_type, 'text');
      assert.strictEqual(colRes.rows[0].is_nullable, 'YES');
      assert.strictEqual(colRes.rows[0].column_default, null);
    } finally {
      await pool.end();
    }
  });

  // -------------------------------------------------------------------
  // 15. Omitting --migration preserves existing default registry behavior
  // -------------------------------------------------------------------
  await test('15. Omitting --migration preserves existing default registry behavior (all 10 migrations)', async () => {
    const defaultDryRun = await runPostgresMigration({
      migrationUrl: LOCAL_TEST_URL,
      dryRun: true
    });

    assert.strictEqual(defaultDryRun.dryRun, true);
    const totalExamined = defaultDryRun.executed.length + defaultDryRun.skipped.length;
    assert.strictEqual(totalExamined, PRODUCTION_MIGRATION_DDL.length, 'Must examine all 10 registered migrations by default');

    const examinedNames = [...defaultDryRun.executed, ...defaultDryRun.skipped];
    assert(examinedNames.includes('table:support_tickets'));
    assert(examinedNames.includes('table:support_ticket_messages'));
    assert(examinedNames.includes('index:idx_support_tickets_resto_created'));
    assert(examinedNames.includes('column:orders.notes'));
  });

  // -------------------------------------------------------------------
  // 16. Production confirmation requirements remain enforced with single migration
  // -------------------------------------------------------------------
  await test('16. Production confirmation requirements remain enforced with --migration', async () => {
    const prodUrl = 'postgres://user:pass@ep-cool-fog-123.aws.neon.tech/neondb';

    await assert.rejects(
      async () => {
        await runPostgresMigration({
          migrationUrl: prodUrl,
          migrationName: 'column:orders.notes',
          dryRun: false,
          confirmProduction: false
        });
      },
      /MIGRATION_SAFETY_VIOLATION/
    );
  });

  // -------------------------------------------------------------------
  // 17. Local-only migrate_orders_notes.js continues to reject remote/production targets
  // -------------------------------------------------------------------
  await test('17. Local-only migrate_orders_notes.js strictly rejects remote and production targets', () => {
    // Neon production target
    assert.throws(
      () => validateMigrationTargetUrl('postgres://user:pass@ep-cool-fog-123.aws.neon.tech/neondb'),
      /MIGRATION_SAFETY_VIOLATION/
    );

    // Non-local IP host
    assert.throws(
      () => validateMigrationTargetUrl('postgres://user:pass@192.168.1.100:5432/touchqr_disposable_test'),
      /restricted to local targets only/
    );

    // Non-disposable DB name
    assert.throws(
      () => validateMigrationTargetUrl('postgres://postgres:postgres@127.0.0.1:5432/touchqr_production'),
      /Database name must be exactly touchqr_disposable_test/
    );

    // Non-postgres protocol
    assert.throws(
      () => validateMigrationTargetUrl('http://127.0.0.1:5432/touchqr_disposable_test'),
      /Protocol must be postgres: or postgresql:/
    );

    // Missing URL
    assert.throws(
      () => validateMigrationTargetUrl(''),
      /MIGRATION_CONFIG_ERROR/
    );

    // Identical to DATABASE_URL guard
    const originalDbUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = LOCAL_TEST_URL;
      assert.throws(
        () => validateMigrationTargetUrl(LOCAL_TEST_URL),
        /MIGRATION_SAFETY_VIOLATION: MIGRATION_DATABASE_URL is identical to DATABASE_URL/
      );
    } finally {
      if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
      else delete process.env.DATABASE_URL;
    }

    // Valid local disposable target
    const valid = validateMigrationTargetUrl(LOCAL_TEST_URL);
    assert.strictEqual(valid.host, '127.0.0.1');
    assert.strictEqual(valid.database, 'touchqr_disposable_test');
  });

  // -------------------------------------------------------------------
  // 18. CLI End-to-End: --migration flag parsing via child_process
  // -------------------------------------------------------------------
  await test('18. CLI invocations handle --migration flag and errors end-to-end', async () => {
    const { spawnSync } = await import('child_process');

    // Valid selected dry run
    const cliValid = spawnSync(
      process.execPath,
      ['server/scripts/migrate_production_postgres.js', '--migration=column:orders.notes', '--dry-run'],
      {
        env: { ...process.env, MIGRATION_DATABASE_URL: LOCAL_TEST_URL },
        encoding: 'utf8'
      }
    );
    assert.strictEqual(cliValid.status, 0, `CLI should succeed, got output: ${cliValid.stderr || cliValid.stdout}`);
    assert(cliValid.stdout.includes('Target: SINGLE MIGRATION (column:orders.notes)'));
    assert(cliValid.stdout.includes('column:orders.notes'));
    assert(!cliValid.stdout.includes('support_tickets WOULD be created'));

    // Unknown migration name rejected before DB connection
    const cliUnknown = spawnSync(
      process.execPath,
      ['server/scripts/migrate_production_postgres.js', '--migration=unknown_test_col', '--dry-run'],
      {
        env: { ...process.env, MIGRATION_DATABASE_URL: LOCAL_TEST_URL },
        encoding: 'utf8'
      }
    );
    assert.strictEqual(cliUnknown.status, 1);
    assert(cliUnknown.stderr.includes('MIGRATION_CONFIG_ERROR: Unknown migration name'));

    // Empty migration name rejected
    const cliEmpty = spawnSync(
      process.execPath,
      ['server/scripts/migrate_production_postgres.js', '--migration='],
      {
        env: { ...process.env, MIGRATION_DATABASE_URL: LOCAL_TEST_URL },
        encoding: 'utf8'
      }
    );
    assert.strictEqual(cliEmpty.status, 1);
    assert(cliEmpty.stderr.includes('MIGRATION_CONFIG_ERROR: --migration flag cannot be empty'));
  });

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
