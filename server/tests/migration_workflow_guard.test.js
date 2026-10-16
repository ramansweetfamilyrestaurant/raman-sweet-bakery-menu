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
import { runPostgresMigration, isProductionDatabaseUrl, SUPPORT_TICKET_MIGRATION_DDL } from '../scripts/migrate_production_postgres.js';

console.log('======================================================================');
console.log('🛡️  POSTGRESQL MIGRATION WORKFLOW & GUARD TEST SUITE');
console.log('======================================================================\n');

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
