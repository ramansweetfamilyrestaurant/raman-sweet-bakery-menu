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
      process.env.STAGING_DATABASE_HOST = 'ep-isolated-test.aws.neon.tech';
      const res = validateTestDatabaseUrl('postgresql://testuser:secret@ep-isolated-test.aws.neon.tech/touchqr_test');
      assert.strictEqual(res.isPostgres, true);
      assert.strictEqual(res.isSqlite, false);
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 9: Same host and DB as DATABASE_URL with different params is rejected
    // ----------------------------------------------------
    await test('9. Target with same host and db as DATABASE_URL is rejected', async () => {
      process.env.DATABASE_URL = 'postgresql://mainuser:secret@127.0.0.1:5432/touchqr?sslmode=disable';
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://different_user:different_secret@127.0.0.1:5432/touchqr?sslmode=disable');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('same host and database') || err.message.includes('identical to DATABASE_URL'), `Expected same host and database violation`);
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

    // ----------------------------------------------------
    // TEST 16: Targeting staging application database (touchqr_staging_app) is rejected
    // ----------------------------------------------------
    await test('16. Targeting staging application database (touchqr_staging_app) is rejected', async () => {
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://staging_user:secret123@ep-staging.aws.neon.tech/touchqr_staging_app');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('application database'), `Expected application database message`);
          assert(!err.message.includes('secret123'), 'Must not leak credentials');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 17: TEST_DATABASE_URL matching MIGRATION_DATABASE_URL is rejected
    // ----------------------------------------------------
    await test('17. TEST_DATABASE_URL identical or same host+db as MIGRATION_DATABASE_URL is rejected', async () => {
      process.env.MIGRATION_DATABASE_URL = 'postgresql://mig_user:secret123@ep-staging.aws.neon.tech/touchqr_staging_test';
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://mig_user:secret123@ep-staging.aws.neon.tech/touchqr_staging_test');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('MIGRATION_DATABASE_URL'), `Expected MIGRATION_DATABASE_URL check error`);
          return true;
        }
      );

      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://diff_user:diff_secret@ep-staging.aws.neon.tech/touchqr_staging_test?sslmode=require');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('MIGRATION_DATABASE_URL'), `Expected MIGRATION_DATABASE_URL check error`);
          return true;
        }
      );
      delete process.env.MIGRATION_DATABASE_URL;
    });

    // ----------------------------------------------------
    // TEST 18: Targeting production neondb is rejected even when DATABASE_URL is unset
    // ----------------------------------------------------
    await test('18. Targeting production neondb is rejected unconditionally', async () => {
      delete process.env.DATABASE_URL;
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://user:secret123@ep-random.aws.neon.tech/neondb');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('production'), 'Expected production mention');
          assert(!err.message.includes('secret123'), 'Must not leak credentials');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 19: Non-test target without test or disposable in name fails closed
    // ----------------------------------------------------
    await test('19. Non-test target without "test" or "disposable" fails closed', async () => {
      delete process.env.DATABASE_URL;
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://user:secret123@ep-random.aws.neon.tech/analytics');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('not explicitly recognized as a dedicated test database'), `Expected fail-closed message`);
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 20: Valid dedicated staging test target (touchqr_staging_test) passes
    // ----------------------------------------------------
    await test('20. Valid dedicated staging test target (touchqr_staging_test) passes validation', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.MIGRATION_DATABASE_URL;
      process.env.STAGING_DATABASE_HOST = 'ep-staging.aws.neon.tech';
      const res = validateTestDatabaseUrl('postgresql://test_user:secret123@ep-staging.aws.neon.tech/touchqr_staging_test?sslmode=require');
      assert.strictEqual(res.isPostgres, true);
      assert.strictEqual(res.isSqlite, false);
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 21: Legitimate dedicated staging test target using neondb_owner role passes validation
    // ----------------------------------------------------
    await test('21. Legitimate dedicated staging test target using neondb_owner role passes validation', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.MIGRATION_DATABASE_URL;
      process.env.STAGING_DATABASE_HOST = 'ep-staging.aws.neon.tech';
      const res = validateTestDatabaseUrl('postgresql://neondb_owner:secret123@ep-staging.aws.neon.tech/touchqr_staging_test?sslmode=require');
      assert.strictEqual(res.isPostgres, true);
      assert.strictEqual(res.isSqlite, false);
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 22: neondb_owner role targeting production neondb is rejected
    // ----------------------------------------------------
    await test('22. neondb_owner role targeting production neondb is rejected', async () => {
      delete process.env.DATABASE_URL;
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://neondb_owner:secret123@ep-prod.aws.neon.tech/neondb');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('production'), 'Expected production mention');
          assert(!err.message.includes('secret123'), 'Must not leak credentials');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 23: neondb_owner role targeting application touchqr_staging_app is rejected
    // ----------------------------------------------------
    await test('23. neondb_owner role targeting application touchqr_staging_app is rejected', async () => {
      delete process.env.DATABASE_URL;
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://neondb_owner:secret123@ep-staging.aws.neon.tech/touchqr_staging_app');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('application database'), 'Expected application database mention');
          assert(!err.message.includes('secret123'), 'Must not leak credentials');
          return true;
        }
      );
    });

    // ----------------------------------------------------
    // TEST 24: Known production hostname is rejected even if database name is touchqr_staging_app
    // ----------------------------------------------------
    await test('24. URL targeting known production hostname is rejected even if db name is touchqr_staging_app', async () => {
      process.env.DATABASE_URL = 'postgresql://main_user:secret@ep-prod-cluster.neon.tech:5432/neondb';
      process.env.STAGING_DATABASE_HOST = 'ep-dedicated-staging.neon.tech';
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://tester:secret@ep-prod-cluster.neon.tech:5432/touchqr_staging_app');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('production database endpoint'), `Must identify production endpoint`);
          return true;
        }
      );
      delete process.env.DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 25: Known production hostname is rejected even if database name is touchqr_staging_test
    // ----------------------------------------------------
    await test('25. URL targeting known production hostname is rejected even if db name is touchqr_staging_test', async () => {
      process.env.DATABASE_URL = 'postgresql://main_user:secret@ep-prod-cluster.neon.tech:5432/neondb';
      process.env.STAGING_DATABASE_HOST = 'ep-dedicated-staging.neon.tech';
      assert.throws(
        () => {
          validateTestDatabaseUrl('postgresql://tester:secret@ep-prod-cluster.neon.tech:5432/touchqr_staging_test');
        },
        (err) => {
          assert(err.message.includes('TEST_DB_SAFETY_VIOLATION'), `Expected violation, got: ${err.message}`);
          assert(err.message.includes('production database endpoint'), `Must identify production endpoint`);
          return true;
        }
      );
      delete process.env.DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 26: Automated test target is rejected if it points to production endpoint or touchqr_staging_app regardless of username/tricks
    // ----------------------------------------------------
    await test('26. Automated test target rejected if pointing to production or touchqr_staging_app regardless of tricks', async () => {
      process.env.DATABASE_URL = 'postgresql://main_user:secret@ep-prod-cluster.neon.tech:5432/neondb';
      process.env.STAGING_DATABASE_HOST = 'ep-dedicated-staging.neon.tech';

      // Trick 1: staging username targeting production host
      assert.throws(
        () => validateTestDatabaseUrl('postgresql://staging_user:secret@ep-prod-cluster.neon.tech:5432/my_test_db'),
        /TEST_DB_SAFETY_VIOLATION/
      );

      // Trick 2: test username targeting touchqr_staging_app on allowed staging host
      assert.throws(
        () => validateTestDatabaseUrl('postgresql://test_runner:secret@ep-dedicated-staging.neon.tech:5432/touchqr_staging_app'),
        /application database/
      );

      delete process.env.DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 27: Arbitrary remote endpoint with db containing staging/test rejected unless in allowlist
    // ----------------------------------------------------
    await test('27. Arbitrary remote endpoint with "staging" or "test" rejected unless in allowlist', async () => {
      delete process.env.DATABASE_URL;
      process.env.STAGING_DATABASE_HOST = 'ep-dedicated-staging.neon.tech';

      assert.throws(
        () => validateTestDatabaseUrl('postgresql://attacker:secret@arbitrary-unauthorized-host.neon.tech:5432/touchqr_staging_test'),
        /does not match the explicitly configured test\/staging endpoint allowlist/
      );

      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 28: Remote test database fails closed if STAGING_DATABASE_HOST / TEST_DATABASE_HOST is absent
    // ----------------------------------------------------
    await test('28. Remote test database fails closed if STAGING_DATABASE_HOST is absent', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
      delete process.env.TEST_DATABASE_HOST;

      assert.throws(
        () => validateTestDatabaseUrl('postgresql://tester:secret@ep-some-remote-host.neon.tech:5432/touchqr_staging_test'),
        /Remote TEST_DATABASE_URL requires an explicitly configured test\/staging host allowlist/
      );
    });

    // ----------------------------------------------------
    // TEST 29: STAGING_DATABASE_HOST matching production DATABASE_URL hostname triggers safety violation
    // ----------------------------------------------------
    await test('29. STAGING_DATABASE_HOST matching production DATABASE_URL hostname fails closed', async () => {
      process.env.DATABASE_URL = 'postgresql://main_user:secret@ep-prod-cluster.neon.tech:5432/neondb';
      process.env.STAGING_DATABASE_HOST = 'ep-prod-cluster.neon.tech,ep-other-staging.neon.tech';

      // Targeting remote host while STAGING_DATABASE_HOST conflicts with production host
      assert.throws(
        () => validateTestDatabaseUrl('postgresql://tester:secret@ep-other-staging.neon.tech:5432/touchqr_staging_test'),
        /matches the production database endpoint/
      );

      delete process.env.DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 30: verifyTestDatabaseIdentity rejects live connection if TEST_DATABASE_URL points to production endpoint
    // ----------------------------------------------------
    await test('30. verifyTestDatabaseIdentity rejects live connection if TEST_DATABASE_URL points to production endpoint', async () => {
      process.env.DATABASE_URL = 'postgresql://main_user:secret@ep-prod-cluster.neon.tech:5432/neondb';
      process.env.TEST_DATABASE_URL = 'postgresql://tester:secret@ep-prod-cluster.neon.tech:5432/touchqr_staging_test';
      process.env.STAGING_DATABASE_HOST = 'ep-prod-cluster.neon.tech';

      const mockQuery = async () => [{ db_name: 'touchqr_staging_test', user_name: 'tester' }];

      await assert.rejects(
        async () => {
          await verifyTestDatabaseIdentity(mockQuery, { isPostgres: true });
        },
        /TEST_DB_SAFETY_VIOLATION/
      );

      delete process.env.DATABASE_URL;
      delete process.env.TEST_DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 31: verifyTestDatabaseIdentity rejects live connection if connected database is touchqr_staging_app
    // ----------------------------------------------------
    await test('31. verifyTestDatabaseIdentity rejects live connection if connected db is touchqr_staging_app', async () => {
      delete process.env.DATABASE_URL;
      process.env.STAGING_DATABASE_HOST = 'ep-dedicated-staging.neon.tech';
      process.env.TEST_DATABASE_URL = 'postgresql://tester:secret@ep-dedicated-staging.neon.tech:5432/touchqr_staging_app';

      const mockQuery = async () => [{ db_name: 'touchqr_staging_app', user_name: 'tester' }];

      await assert.rejects(
        async () => {
          await verifyTestDatabaseIdentity(mockQuery, { isPostgres: true });
        },
        /application database/
      );

      delete process.env.TEST_DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
    });

    // ----------------------------------------------------
    // TEST 32: verifyTestDatabaseIdentity rejects live connection on remote host if STAGING_DATABASE_HOST is not configured
    // ----------------------------------------------------
    await test('32. verifyTestDatabaseIdentity rejects live connection on remote host if STAGING_DATABASE_HOST is unconfigured', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.STAGING_DATABASE_HOST;
      delete process.env.TEST_DATABASE_HOST;
      process.env.TEST_DATABASE_URL = 'postgresql://tester:secret@ep-dedicated-staging.neon.tech:5432/touchqr_staging_test';

      const mockQuery = async () => [{ db_name: 'touchqr_staging_test', user_name: 'tester' }];

      await assert.rejects(
        async () => {
          await verifyTestDatabaseIdentity(mockQuery, { isPostgres: true });
        },
        /Remote test endpoint requires an explicitly configured allowlist/
      );

      delete process.env.TEST_DATABASE_URL;
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
