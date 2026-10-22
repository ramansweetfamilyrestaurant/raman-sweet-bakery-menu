import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  validateTestDatabaseUrl,
  getVerifiedTestDatabaseUrl,
  assertTestDatabaseEnv,
  verifyTestDatabaseIdentity
} from './testDbGuard.js';
import { initDb, query, resetDbForTesting } from '../db.js';

console.log('🛡️ Starting Test Database Isolation Hardening Verification Suite...\n');

async function runIsolationTests() {
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  };

  const origEnv = { ...process.env };

  try {
    // ----------------------------------------------------
    // TEST 1: Missing TEST_DATABASE_URL blocks execution safely
    // ----------------------------------------------------
    await test('1. Missing TEST_DATABASE_URL is rejected with clear, secret-free error', async () => {
      delete process.env.TEST_DATABASE_URL;
      assert.throws(
        () => {
          validateTestDatabaseUrl(undefined);
        },
        (err) => {
          assert(err.message.includes('TEST_DB_CONFIG_MISSING'), `Expected TEST_DB_CONFIG_MISSING, got: ${err.message}`);
          assert(!err.message.includes('postgres://'), 'Must not leak credentials in error');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 2: TEST_DATABASE_URL matching DATABASE_URL is rejected
    // ----------------------------------------------------
    await test('2. TEST_DATABASE_URL identical to DATABASE_URL is rejected', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host.tech/sample_db';
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://user:pass@host.tech/sample_db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected TEST_DB_SAFETY_VIOLATION, got: ${err.message}`);
          assert(err.message.includes('identical to DATABASE_URL'), `Expected identical check error`);
          assert(!err.message.includes('user:pass'), 'Must not leak credentials in error');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 3: Production-marked host is rejected
    // ----------------------------------------------------
    await test('3. Production-marked database host is rejected', async () => {
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://user:secret123@prod-db.internal.touchqr.in/app_db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('production'), 'Expected production mention');
          assert(!err.message.includes('secret123'), 'Must not leak password in error');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 4: Production-marked database name is rejected
    // ----------------------------------------------------
    await test('4. Production-marked database name (/production, /touchqr_prod) is rejected', async () => {
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://user:secret123@ep-test.aws.neon.tech/touchqr_prod');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(!err.message.includes('secret123'), 'Must not leak password in error');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 5: Production-marked query parameter is rejected
    // ----------------------------------------------------
    await test('5. Production-marked query parameters (?env=production) are rejected', async () => {
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://user:secret123@ep-test.aws.neon.tech/test_db?env=production');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(!err.message.includes('secret123'), 'Must not leak password in error');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 6: Running with NODE_ENV=production is rejected
    // ----------------------------------------------------
    await test('6. Running tests when NODE_ENV=production is rejected', async () => {
      process.env.NODE_ENV = 'production';
      assert.throws(
        () => {
          validateTestDatabaseUrl('sqlite:menu_test.db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('NODE_ENV is set to production'));
          return true;
        }
      );
      process.env.NODE_ENV = 'test';
    });

    // ----------------------------------------------------
    // TEST 6B: Running with VERCEL_ENV=production is rejected
    // ----------------------------------------------------
    await test('6B. Running tests when VERCEL_ENV=production is rejected', async () => {
      process.env.NODE_ENV = 'test';
      process.env.VERCEL_ENV = 'production';
      assert.throws(
        () => {
          validateTestDatabaseUrl('sqlite:menu_test.db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('VERCEL_ENV is set to production'));
          return true;
        }
      );
      delete process.env.VERCEL_ENV;
    });

    // ----------------------------------------------------
    // TEST 7: Valid dedicated SQLite test database passes validation
    // ----------------------------------------------------
    await test('7. Valid designated SQLite test database passes validation', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.DATABASE_URL;
      const res = validateTestDatabaseUrl('sqlite:menu_test_isolated.db');
      assert.strictEqual(res.isSqlite, true);
      assert.strictEqual(res.isPostgres, false);
      assert.strictEqual(res.url, 'sqlite:menu_test_isolated.db');
    });

    // ----------------------------------------------------
    // TEST 8: Valid designated PostgreSQL test database passes validation
    // ----------------------------------------------------
    await test('8. Valid designated PostgreSQL test database passes validation', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://mainuser:secret@ep-main.aws.neon.tech/neondb';
      const res = validateTestDatabaseUrl('postgresql://testuser:secret@ep-isolated-test.aws.neon.tech/touchqr_test');
      assert.strictEqual(res.isPostgres, true);
      assert.strictEqual(res.isSqlite, false);
    });

    // ----------------------------------------------------
    // TEST 9: Same host and DB as DATABASE_URL with different params is rejected
    // ----------------------------------------------------
    await test('9. Target with same host and db as DATABASE_URL is rejected', async () => {
      process.env.DATABASE_URL = 'postgresql://mainuser:secret@ep-cluster.neon.tech/touchqr?sslmode=require';
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://different_user:different_secret@ep-cluster.neon.tech/touchqr?sslmode=verify-full');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('same host and database'), `Expected same host and database violation`);
          assert(!err.message.includes('different_secret'), 'Must not leak credentials');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 10: Targeting application menu.db directly is rejected
    // ----------------------------------------------------
    await test('10. Targeting application menu.db directly or relatively is rejected', async () => {
      assert.throws(
        () => {
          validateTestDatabaseUrl('menu.db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('menu.db'), 'Must mention menu.db');
          return true;
        }
      );

      assert.throws(
        () => {
          validateTestDatabaseUrl('sqlite:./menu.db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 11: Production username in PostgreSQL URL is rejected
    // ----------------------------------------------------
    await test('11. Production username (prod_user, production_admin) in URL is rejected', async () => {
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://prod_admin:supersecret@test-ep.neon.tech/test_db');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(!err.message.includes('supersecret'), 'Must not leak secret');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 12: initDb in test mode throws if TEST_DATABASE_URL is missing
    // ----------------------------------------------------
    await test('12. initDb() in test mode strictly refuses to fall back to DATABASE_URL', async () => {
      await resetDbForTesting();
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgresql://sample:sample@sample.tech/sample_db';
      delete process.env.TEST_DATABASE_URL;

      await assert.rejects(
        async () => {
          await initDb();
        },
        (err) => {
          assert(err.message.includes('TEST_DB_CONFIG_MISSING'), `Expected TEST_DB_CONFIG_MISSING, got: ${err.message}`);
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 13: initDb connects to and initializes isolated test DB
    // ----------------------------------------------------
    await test('13. initDb() connects to isolated test database when TEST_DATABASE_URL is set', async () => {
      await resetDbForTesting();
      const testDbPath = 'menu_isolated_test.db';
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = `sqlite:${testDbPath}`;

      await initDb();

      // Query isolated test db
      const tables = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'");
      assert.strictEqual(tables.length, 1, 'Expected subscriptions table in test DB');

      await resetDbForTesting();

      // Clean up test file
      try {
        if (fs.existsSync(testDbPath)) {
          fs.unlinkSync(testDbPath);
        }
      } catch (e) {}
    });

    // ----------------------------------------------------
    // TEST 14: verifyTestDatabaseIdentity validates isolated test DB
    // ----------------------------------------------------
    await test('14. verifyTestDatabaseIdentity() validates isolated test DB and rejects production markers', async () => {
      await resetDbForTesting();
      const testDbPath = 'menu_identity_test.db';
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = `sqlite:${testDbPath}`;

      await initDb();

      // Identity check against isolated test DB should verify successfully
      const checkRes = await verifyTestDatabaseIdentity(query, { isPostgres: false });
      assert.strictEqual(checkRes.verified, true);
      assert.strictEqual(checkRes.dbType, 'sqlite');

      // Test with expected name matching filename
      process.env.TEST_DB_EXPECTED_NAME = 'menu_identity_test.db';
      const checkNamed = await verifyTestDatabaseIdentity(query, { isPostgres: false });
      assert.strictEqual(checkNamed.verified, true);

      // Test with mismatched expected name throws safety violation
      process.env.TEST_DB_EXPECTED_NAME = 'different_database_name';
      await assert.rejects(
        async () => {
          await verifyTestDatabaseIdentity(query, { isPostgres: false });
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('identity check mismatch'), `Expected identity mismatch message`);
          return true;
        }
      );

      delete process.env.TEST_DB_EXPECTED_NAME;
      await resetDbForTesting();

      try {
        if (fs.existsSync(testDbPath)) {
          fs.unlinkSync(testDbPath);
        }
      } catch (e) {}
    });

    // ----------------------------------------------------
    // TEST 15: initDb() validates identity BEFORE schema creation/seeding
    // ----------------------------------------------------
    await test('15. initDb() performs identity check before creating any tables or seeding', async () => {
      await resetDbForTesting();
      const testDbPath = 'menu_premutation_guard_test.db';
      process.env.NODE_ENV = 'test';
      process.env.TEST_DATABASE_URL = `sqlite:${testDbPath}`;
      // Set expected name to something that definitely mismatches the connected file
      process.env.TEST_DB_EXPECTED_NAME = 'non_existent_isolated_target';

      await assert.rejects(
        async () => {
          await initDb();
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('identity check mismatch'), `Expected identity mismatch, got: ${err.message}`);
          return true;
        }
      );

      delete process.env.TEST_DB_EXPECTED_NAME;

      // Verify that NO tables were created in the database file
      const sqliteModule = await import('better-sqlite3');
      const Database = sqliteModule.default || sqliteModule;
      const rawDb = new Database(path.resolve(testDbPath));
      try {
        const tables = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        assert.strictEqual(tables.length, 0, `Expected 0 tables created before identity check failure, found: ${tables.map(t => t.name).join(', ')}`);
      } finally {
        rawDb.close();
        await resetDbForTesting();
        try {
          if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
          }
        } catch (e) {}
      }
    });

  } finally {
    process.env = origEnv;
    await resetDbForTesting();
  }

  console.log(`\n====================================================`);
  console.log(`📊 ISOLATION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runIsolationTests().catch(err => {
  console.error('Isolation suite runner crashed:', err);
  process.exit(1);
});
