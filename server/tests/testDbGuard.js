/**
 * Test Database Isolation & Safety Guard
 * TouchQR SaaS Billing Architecture
 *
 * Guarantees that automated tests NEVER silently connect to or mutate
 * the production database, requiring an explicitly designated TEST_DATABASE_URL.
 */

import path from 'path';

export function getStagingHostAllowlist(options = {}, argv = process.argv) {
  const allowlist = new Set();
  if (options.stagingHost) {
    allowlist.add(String(options.stagingHost).trim().toLowerCase());
  }
  if (options.testHost) {
    allowlist.add(String(options.testHost).trim().toLowerCase());
  }
  if (Array.isArray(options.allowedStagingHosts)) {
    options.allowedStagingHosts.forEach(h => allowlist.add(String(h).trim().toLowerCase()));
  }
  if (Array.isArray(options.allowedTestHosts)) {
    options.allowedTestHosts.forEach(h => allowlist.add(String(h).trim().toLowerCase()));
  }
  if (Array.isArray(argv)) {
    const sIdx = argv.indexOf('--staging-host');
    if (sIdx !== -1 && argv[sIdx + 1]) {
      allowlist.add(argv[sIdx + 1].trim().toLowerCase());
    }
    const tIdx = argv.indexOf('--test-host');
    if (tIdx !== -1 && argv[tIdx + 1]) {
      allowlist.add(argv[tIdx + 1].trim().toLowerCase());
    }
  }
  const envHosts = [
    process.env.TEST_DATABASE_HOST,
    process.env.STAGING_DATABASE_HOST
  ];
  for (const envVal of envHosts) {
    if (envVal && typeof envVal === 'string') {
      envVal.split(',').map(h => h.trim().toLowerCase()).filter(Boolean).forEach(h => allowlist.add(h));
    }
  }
  return allowlist;
}

/**
 * Validates a test database connection string or identifier.
 * Ensures the target is not production, not equal to DATABASE_URL,
 * targets an explicitly permitted endpoint, and contains no production indicators.
 *
 * @param {string} testUrl - The test database URL or identifier to validate
 * @param {object} [options] - Optional allowlist or verification options
 * @returns {{ url: string, isPostgres: boolean, isSqlite: boolean }}
 */
export function validateTestDatabaseUrl(testUrl, options = {}) {
  if (!testUrl || typeof testUrl !== 'string' || !testUrl.trim()) {
    throw new Error(
      'TEST_DB_CONFIG_MISSING: TEST_DATABASE_URL environment variable is required to run database integration tests. Silent fallback to DATABASE_URL is prohibited to prevent accidental production mutations.'
    );
  }

  const trimmedUrl = testUrl.trim();

  // 1. Must never match the application's default/production DATABASE_URL
  const appDbUrl = (process.env.DATABASE_URL || '').trim();
  if (appDbUrl && trimmedUrl === appDbUrl) {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL is identical to DATABASE_URL. Database tests cannot run against the application default database.'
    );
  }

  // 1b. Must never match the application's staging MIGRATION_DATABASE_URL
  const migrationDbUrl = (process.env.MIGRATION_DATABASE_URL || process.env.STAGING_DATABASE_URL || '').trim();
  if (migrationDbUrl && trimmedUrl === migrationDbUrl) {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL is identical to MIGRATION_DATABASE_URL. Database tests cannot run against the application staging migration database.'
    );
  }

  // 2. Reject if execution environment is explicitly production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: Database integration tests cannot run when NODE_ENV is set to production or VERCEL_ENV is set to production.'
    );
  }

  // 3. Inspect target safely without printing connection secrets
  let isPostgres = false;
  let isSqlite = false;

  if (trimmedUrl.startsWith('postgres://') || trimmedUrl.startsWith('postgresql://')) {
    isPostgres = true;

    try {
      const parsed = new URL(trimmedUrl);
      const pathname = (parsed.pathname || '').toLowerCase();
      const hostname = (parsed.hostname || '').toLowerCase();
      const search = (parsed.search || '').toLowerCase();
      const username = (parsed.username || '').toLowerCase();
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

      // Resolve known production endpoint hostname from DATABASE_URL
      let prodHostname = '';
      if (appDbUrl && (appDbUrl.startsWith('postgres://') || appDbUrl.startsWith('postgresql://'))) {
        try {
          const parsedApp = new URL(appDbUrl);
          prodHostname = (parsedApp.hostname || '').toLowerCase();
        } catch (_) {}
      }

      const isProdHostLocal = prodHostname === 'localhost' || prodHostname === '127.0.0.1' || prodHostname === '::1';

      // STRICT PRODUCTION HOST ISOLATION:
      // Reject any test target matching the remote production hostname regardless of database name,
      // username, or path tricks (e.g. even if db is /touchqr_staging_app or /touchqr_staging_test).
      if (prodHostname && !isProdHostLocal && hostname === prodHostname) {
        throw new Error(
          `TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL targets the production database endpoint '${hostname}'. Integration tests are strictly prohibited from targeting the production host under any database name.`
        );
      }

      // Check if TEST_DATABASE_URL targets the same host and database as DATABASE_URL (for local development)
      if (prodHostname && isProdHostLocal && hostname === prodHostname) {
        try {
          const parsedApp = new URL(appDbUrl);
          if (parsedApp.pathname.toLowerCase() === pathname) {
            throw new Error(
              'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL targets the same host and database as DATABASE_URL.'
            );
          }
        } catch (appErr) {
          if (appErr.message && appErr.message.startsWith('TEST_DB_SAFETY_VIOLATION:')) throw appErr;
        }
      }

      // Check if TEST_DATABASE_URL targets the same host and database as MIGRATION_DATABASE_URL
      if (migrationDbUrl && (migrationDbUrl.startsWith('postgres://') || migrationDbUrl.startsWith('postgresql://'))) {
        try {
          const parsedMig = new URL(migrationDbUrl);
          if (
            parsedMig.hostname.toLowerCase() === hostname &&
            parsedMig.pathname.toLowerCase() === pathname
          ) {
            throw new Error(
              'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL targets the same host and database as MIGRATION_DATABASE_URL.'
            );
          }
        } catch (migErr) {
          if (migErr.message && migErr.message.startsWith('TEST_DB_SAFETY_VIOLATION:')) {
            throw migErr;
          }
        }
      }

      // Check for production markers in database name, host, search params, or username
      const prodMarkers = [
        'production',
        'prod_db',
        'master_db',
        'touchqr_prod',
        'touchqr_production',
        'live_db',
        'neondb_prod',
        'neondb',
        'main_db'
      ];
      const hasProdPath =
        prodMarkers.some(m => pathname.includes(m)) ||
        pathname === '/prod' ||
        pathname === '/master' ||
        pathname === '/live' ||
        pathname.endsWith('_prod') ||
        pathname.endsWith('-prod');

      const hasProdHost =
        hostname.includes('production') ||
        hostname.startsWith('prod-') ||
        hostname.endsWith('-prod') ||
        hostname.includes('.prod.') ||
        hostname.startsWith('live-') ||
        hostname.endsWith('-live') ||
        hostname.startsWith('main-') ||
        hostname.endsWith('-main');

      const hasProdParam =
        search.includes('env=production') ||
        search.includes('env=prod') ||
        search.includes('environment=production') ||
        search.includes('environment=prod') ||
        search.includes('is_production=true') ||
        search.includes('target=production') ||
        search.includes('stage=prod');

      const hasProdUser =
        username === 'prod' ||
        username === 'production' ||
        username.startsWith('prod_') ||
        username.startsWith('production_') ||
        username.endsWith('_prod');

      if (hasProdPath || hasProdHost || hasProdParam || hasProdUser) {
        throw new Error(
          'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL targets a database or host marked as production. Integration tests are strictly prohibited from targeting production.'
        );
      }

      // Check for application database markers (must never target application staging databases like touchqr_staging_app)
      const appMarkers = [
        'touchqr_staging_app',
        'staging_app',
        'prod_app',
        'live_app'
      ];
      const dbName = pathname.replace(/^\//, '');
      const hasAppPath =
        appMarkers.some(m => dbName.includes(m)) ||
        dbName === 'app' ||
        dbName === 'staging' ||
        dbName.endsWith('_app') ||
        dbName.endsWith('-app');

      if (hasAppPath) {
        throw new Error(
          `TEST_DB_SAFETY_VIOLATION: Target database '${dbName}' is an application database. Integration tests are strictly prohibited from targeting application databases.`
        );
      }

      // Positive check: Database name must be explicitly recognized as a dedicated test database
      const isExplicitTestDb =
        dbName.includes('test') ||
        dbName.includes('disposable');

      if (!isExplicitTestDb) {
        throw new Error(
          `TEST_DB_SAFETY_VIOLATION: Target database '${dbName}' is not explicitly recognized as a dedicated test database (must contain 'test' or 'disposable').`
        );
      }

      // POSITIVE STAGING/TEST ENDPOINT IDENTIFICATION FOR REMOTE TARGETS:
      // Remote targets must match an explicitly configured staging/test endpoint allowlist
      if (!isLocal) {
        const stagingAllowlist = getStagingHostAllowlist(options, process.argv);

        if (stagingAllowlist.size === 0) {
          throw new Error(
            'TEST_DB_SAFETY_VIOLATION: Remote TEST_DATABASE_URL requires an explicitly configured test/staging host allowlist via STAGING_DATABASE_HOST or TEST_DATABASE_HOST environment variable (or --staging-host / --test-host argument). Remote targets fail closed when endpoint identity is unconfigured.'
          );
        }

        // Ensure allowed staging/test host does not match production host
        if (prodHostname && stagingAllowlist.has(prodHostname)) {
          throw new Error(
            `TEST_DB_SAFETY_VIOLATION: Configured STAGING_DATABASE_HOST/TEST_DATABASE_HOST matches the production database endpoint '${prodHostname}'. Test endpoint must be distinct from production.`
          );
        }

        // Compare parsed hostname exactly against allowlist
        if (!stagingAllowlist.has(hostname)) {
          throw new Error(
            `TEST_DB_SAFETY_VIOLATION: Target host '${hostname}' does not match the explicitly configured test/staging endpoint allowlist (${Array.from(stagingAllowlist).join(', ')}). Arbitrary remote endpoints are prohibited.`
          );
        }
      }
    } catch (parseErr) {
      if (parseErr.message && parseErr.message.startsWith('TEST_DB_SAFETY_VIOLATION:')) {
        throw parseErr;
      }
      // Malformed URL check
      throw new Error(
        'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL is not a valid database connection URL.'
      );
    }
  } else if (
    trimmedUrl.startsWith('sqlite:') ||
    trimmedUrl.startsWith('file:') ||
    trimmedUrl.endsWith('.db') ||
    trimmedUrl === ':memory:' ||
    trimmedUrl === 'sqlite'
  ) {
    isSqlite = true;

    const lower = trimmedUrl.toLowerCase();
    const rawPath = trimmedUrl.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();

    // Check if target is the application's default database file
    const appDbPath = path.resolve('menu.db');
    if (rawPath === ':memory:') {
      // In-memory SQLite is isolated and safe
    } else {
      const resolvedPath = path.resolve(rawPath || 'menu_test.db');
      if (
        resolvedPath === appDbPath ||
        rawPath === 'menu.db' ||
        lower.endsWith('/menu.db') ||
        lower.endsWith('\\menu.db')
      ) {
        throw new Error(
          'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL cannot target the application database file (menu.db).'
        );
      }
    }

    if (lower.includes('prod') && !lower.includes('test')) {
      throw new Error(
        'TEST_DB_SAFETY_VIOLATION: TEST_DATABASE_URL targets a database file marked as production.'
      );
    }
  } else {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: Unrecognized TEST_DATABASE_URL scheme. Expected PostgreSQL (postgres://) or SQLite (sqlite:..., file:..., or .db).'
    );
  }

  return {
    url: trimmedUrl,
    isPostgres,
    isSqlite
  };
}

/**
 * Reads and verifies TEST_DATABASE_URL from process.env.
 * Throws a secret-free error if missing or invalid.
 *
 * @param {object} [options] - Optional allowlist or verification options
 * @returns {string} The verified test database connection string or path
 */
export function getVerifiedTestDatabaseUrl(options = {}) {
  const testUrl = process.env.TEST_DATABASE_URL;
  const validated = validateTestDatabaseUrl(testUrl, options);
  return validated.url;
}

/**
 * Checks whether a valid TEST_DATABASE_URL is currently configured.
 *
 * @param {object} [options] - Optional allowlist or verification options
 * @returns {boolean}
 */
export function hasTestDatabaseConfigured(options = {}) {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || typeof testUrl !== 'string' || !testUrl.trim()) {
    return false;
  }
  // Validate target: if invalid or marked as production, throw safety violation immediately
  validateTestDatabaseUrl(testUrl, options);
  return true;
}

/**
 * Detects the configured test database dialect/engine.
 *
 * @returns {'POSTGRESQL' | 'SQLITE' | 'NONE'}
 */
export function getTestDatabaseType() {
  const url = (process.env.TEST_DATABASE_URL || '').trim();
  if (!url) return 'NONE';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'POSTGRESQL';
  if (
    url.startsWith('sqlite:') ||
    url.startsWith('file:') ||
    url.endsWith('.db') ||
    url === ':memory:' ||
    url === 'sqlite'
  ) return 'SQLITE';
  return 'NONE';
}

/**
 * Checks whether CI / required validation mode is active.
 *
 * @returns {boolean}
 */
export function isCiTestMode() {
  return Boolean(
    process.env.CI === 'true' ||
    process.env.CI === '1' ||
    process.env.CONTINUOUS_INTEGRATION === 'true' ||
    process.env.REQUIRE_DB_TESTS === 'true' ||
    process.env.REQUIRE_DB_TESTS === '1' ||
    process.argv.includes('--ci') ||
    process.argv.includes('--require-db')
  );
}

/**
 * Enforces test database requirement for database-dependent test suites.
 * - In CI / required-validation mode: Fails with exit status 1 if TEST_DATABASE_URL is missing.
 * - In local developer mode: Logs NOT RUN and exits with status 0 safely.
 *
 * @param {string} suiteName - The name of the test suite
 * @param {object} [options] - Optional allowlist or verification options
 * @returns {string} The verified test database connection string or path
 */
export function checkTestDatabaseRequirement(suiteName, options = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: Database integration tests cannot run when NODE_ENV is set to production or VERCEL_ENV is set to production.'
    );
  }
  process.env.NODE_ENV = 'test';
  const hasDb = hasTestDatabaseConfigured(options);
  const isCi = isCiTestMode();

  if (!hasDb) {
    if (isCi) {
      console.error(
        `\n❌ [CI VALIDATION FAILURE] ${suiteName} requires an isolated test database (TEST_DATABASE_URL). Integration tests cannot be skipped in CI mode.\n`
      );
      process.exit(1);
    } else {
      console.log(
        `⚠️  [NOT RUN] ${suiteName} skipped: TEST_DATABASE_URL not set (isolated test database required).`
      );
      process.exit(0);
    }
  }

  return assertTestDatabaseEnv(options);
}

/**
 * Entry-point assertion for test scripts.
 * Sets NODE_ENV='test' and validates test database configuration.
 *
 * @param {object} [options] - Optional allowlist or verification options
 * @returns {string} The verified test database connection string or path
 */
export function assertTestDatabaseEnv(options = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: Database integration tests cannot run when NODE_ENV is set to production or VERCEL_ENV is set to production.'
    );
  }
  process.env.NODE_ENV = 'test';
  return getVerifiedTestDatabaseUrl(options);
}

/**
 * Supports an explicit test-database identity check against a live database connection.
 * Verifies that the connected database identifies itself as an isolated test database
 * and matches configured infrastructure expectations (e.g. TEST_DB_EXPECTED_NAME).
 *
 * @param {Function|object} queryFnOrClient - query function or database client
 * @param {object} [options] - Options for identity check
 * @returns {Promise<{ verified: boolean, identity: string, dbType: string }>}
 */
export async function verifyTestDatabaseIdentity(queryFnOrClient, options = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'TEST_DB_SAFETY_VIOLATION: Database integration tests cannot run when NODE_ENV is set to production or VERCEL_ENV is set to production.'
    );
  }
  const isPostgres = options.isPostgres ?? (typeof queryFnOrClient?.query === 'function' && !queryFnOrClient?.pragma);

  if (isPostgres) {
    const testUrl = (process.env.TEST_DATABASE_URL || options.testUrl || '').trim();
    if (testUrl && (testUrl.startsWith('postgres://') || testUrl.startsWith('postgresql://'))) {
      try {
        const parsedTest = new URL(testUrl);
        const testHostname = (parsedTest.hostname || '').toLowerCase();
        const isLocal = testHostname === 'localhost' || testHostname === '127.0.0.1' || testHostname === '::1';

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

        if (prodHostname && !isProdHostLocal && testHostname === prodHostname) {
          throw new Error(
            `TEST_DB_SAFETY_VIOLATION: Database identity check failed. TEST_DATABASE_URL targets the production database endpoint '${testHostname}'.`
          );
        }

        // 2. Positive Staging Target Identification for Remote Targets
        if (!isLocal) {
          const stagingAllowlist = getStagingHostAllowlist(options, process.argv);
          if (stagingAllowlist.size === 0) {
            throw new Error(
              'TEST_DB_SAFETY_VIOLATION: Database identity check failed. Remote test endpoint requires an explicitly configured allowlist via STAGING_DATABASE_HOST or TEST_DATABASE_HOST.'
            );
          }
          if (prodHostname && stagingAllowlist.has(prodHostname)) {
            throw new Error(
              `TEST_DB_SAFETY_VIOLATION: Database identity check failed. Configured STAGING_DATABASE_HOST/TEST_DATABASE_HOST matches the production database endpoint '${prodHostname}'.`
            );
          }
          if (!stagingAllowlist.has(testHostname)) {
            throw new Error(
              `TEST_DB_SAFETY_VIOLATION: Database identity check failed. Target host '${testHostname}' does not match the configured test/staging host allowlist (${Array.from(stagingAllowlist).join(', ')}).`
            );
          }
        }
      } catch (err) {
        if (err.message && err.message.startsWith('TEST_DB_SAFETY_VIOLATION:')) throw err;
      }
    }

    const runQuery = typeof queryFnOrClient === 'function'
      ? queryFnOrClient
      : (sql, params) => queryFnOrClient.query(sql, params).then(r => r.rows || r);

    const rows = await runQuery('SELECT current_database() as db_name, current_user as user_name');
    const dbName = String(rows[0]?.db_name || '').toLowerCase();

    // 1. Must not match known production identifiers
    const prodDbNames = [
      'production',
      'prod_db',
      'master_db',
      'touchqr_prod',
      'touchqr_production',
      'live_db',
      'neondb_prod',
      'neondb',
      'main_db',
      'prod',
      'master',
      'live'
    ];
    if (
      prodDbNames.includes(dbName) ||
      dbName.endsWith('_prod') ||
      dbName.endsWith('-prod')
    ) {
      throw new Error(
        'TEST_DB_SAFETY_VIOLATION: Database identity check failed. Connected database is marked as production.'
      );
    }

    // 1b. Must not target application database (e.g. touchqr_staging_app)
    if (
      dbName === 'touchqr_staging_app' ||
      dbName.includes('staging_app') ||
      dbName.endsWith('_app') ||
      dbName.endsWith('-app')
    ) {
      throw new Error(
        'TEST_DB_SAFETY_VIOLATION: Database identity check failed. Connected database is an application database, not a dedicated test database.'
      );
    }

    // 1c. Positive check: Connected database must be recognized as a dedicated test database
    if (!dbName.includes('test') && !dbName.includes('disposable')) {
      throw new Error(
        `TEST_DB_SAFETY_VIOLATION: Database identity check failed. Connected database '${dbName}' is not recognized as a dedicated test database (must contain 'test' or 'disposable').`
      );
    }

    // 2. Must not match the database name in DATABASE_URL if targeting same host
    const appDbUrl = (process.env.DATABASE_URL || '').trim();
    if (appDbUrl && (appDbUrl.startsWith('postgres://') || appDbUrl.startsWith('postgresql://'))) {
      try {
        const parsedApp = new URL(appDbUrl);
        const appDbName = parsedApp.pathname.replace(/^\//, '').toLowerCase();
        if (appDbName && dbName === appDbName) {
          // If the test database name equals application database name, check if host is identical
          const testUrl = process.env.TEST_DATABASE_URL || '';
          if (testUrl) {
            const parsedTest = new URL(testUrl);
            if (parsedTest.hostname.toLowerCase() === parsedApp.hostname.toLowerCase()) {
              throw new Error(
                'TEST_DB_SAFETY_VIOLATION: Database identity check failed. Connected database matches production DATABASE_URL identity.'
              );
            }
          }
        }
      } catch (e) {
        if (e.message && e.message.startsWith('TEST_DB_SAFETY_VIOLATION:')) throw e;
      }
    }

    // 2b. Must not match the database name in MIGRATION_DATABASE_URL if targeting same host
    const migrationDbUrl = (process.env.MIGRATION_DATABASE_URL || process.env.STAGING_DATABASE_URL || '').trim();
    if (migrationDbUrl && (migrationDbUrl.startsWith('postgres://') || migrationDbUrl.startsWith('postgresql://'))) {
      try {
        const parsedMig = new URL(migrationDbUrl);
        const migDbName = parsedMig.pathname.replace(/^\//, '').toLowerCase();
        if (migDbName && dbName === migDbName) {
          const testUrl = process.env.TEST_DATABASE_URL || '';
          if (testUrl) {
            const parsedTest = new URL(testUrl);
            if (parsedTest.hostname.toLowerCase() === parsedMig.hostname.toLowerCase()) {
              throw new Error(
                'TEST_DB_SAFETY_VIOLATION: Database identity check failed. Connected database matches MIGRATION_DATABASE_URL identity.'
              );
            }
          }
        }
      } catch (e) {
        if (e.message && e.message.startsWith('TEST_DB_SAFETY_VIOLATION:')) throw e;
      }
    }

    // 3. Infrastructure-configured expected name check
    const expectedName = (process.env.TEST_DB_EXPECTED_NAME || process.env.TEST_DB_IDENTITY || '').trim().toLowerCase();
    if (expectedName && dbName !== expectedName) {
      throw new Error(
        `TEST_DB_SAFETY_VIOLATION: Database identity check mismatch. Expected test database '${expectedName}' but connected to '${dbName}'.`
      );
    }

    return { verified: true, identity: dbName, dbType: 'postgres' };
  } else {
    // SQLite Identity Check
    const runQuery = typeof queryFnOrClient === 'function'
      ? queryFnOrClient
      : (sql) => queryFnOrClient.prepare ? queryFnOrClient.prepare(sql).all() : [];

    let fileList = [];
    try {
      fileList = await runQuery('PRAGMA database_list');
    } catch (e) {}

    const mainFile = String(fileList[0]?.file || '').toLowerCase();
    const appDbPath = path.resolve('menu.db').toLowerCase();

    if (mainFile && mainFile === appDbPath) {
      throw new Error(
        'TEST_DB_SAFETY_VIOLATION: Database identity check failed. Connected SQLite database is application menu.db.'
      );
    }

    if (mainFile.includes('prod') && !mainFile.includes('test')) {
      throw new Error(
        'TEST_DB_SAFETY_VIOLATION: Database identity check failed. SQLite file is marked as production.'
      );
    }

    const expectedName = (process.env.TEST_DB_EXPECTED_NAME || process.env.TEST_DB_IDENTITY || '').trim().toLowerCase();
    if (expectedName && mainFile && !mainFile.includes(expectedName)) {
      throw new Error(
        `TEST_DB_SAFETY_VIOLATION: Database identity check mismatch. SQLite file does not match expected name '${expectedName}'.`
      );
    }

    return { verified: true, identity: mainFile || ':memory:', dbType: 'sqlite' };
  }
}
