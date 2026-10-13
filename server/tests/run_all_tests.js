/**
 * TouchQR Automated Test Suite Runner
 *
 * Runs all unit and integration test suites with strict database isolation guarantees.
 * Prevents false-green CI results by failing with a non-zero exit code if required database
 * integration tests are NOT RUN in CI / required-validation mode.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  hasTestDatabaseConfigured,
  getTestDatabaseType,
  isCiTestMode
} from './testDbGuard.js';

const suites = [
  {
    name: 'Server Modules & Export Syntax',
    file: 'server/tests/test-standalone.js',
    requiresDb: false
  },
  {
    name: 'Standee Workspace & QR Token Security',
    file: 'server/tests/standee_workspace_unified.test.js',
    requiresDb: false
  },
  {
    name: 'Database Isolation Hardening & Guard',
    file: 'server/tests/test_db_isolation.test.js',
    requiresDb: false // Tests isolation guard logic itself
  },
  {
    name: 'P0 QR Security & Backend Validation',
    file: 'server/tests/p0_qr_security_and_validation.test.js',
    requiresDb: false // Unit tests run always; DB integration sections gated
  },
  {
    name: 'Phase 4 Subscription Lifecycle & Cron',
    file: 'server/tests/subscription-lifecycle.test.js',
    requiresDb: true
  },
  {
    name: 'Cashfree Billing Security Remediation',
    file: 'server/tests/security-remediation.test.js',
    requiresDb: true
  },
  {
    name: 'Phase 6 Subscription Lifecycle Audit',
    file: 'server/tests/phase6_lifecycle_test.js',
    requiresDb: true
  },
  {
    name: 'Phase 6B Complimentary Access Acceptance',
    file: 'server/tests/phase6b_complimentary_ui_test.js',
    requiresDb: true
  },
  {
    name: 'Payment-First Registration Architecture',
    file: 'server/test_registration.js',
    requiresDb: true
  }
];

const hasTestDb = hasTestDatabaseConfigured();
const dbEngine = getTestDatabaseType();
const isCi = isCiTestMode();

console.log('======================================================================');
console.log('🛡️  TOUCHQR AUTOMATED TEST SUITE RUNNER');
console.log('======================================================================');
console.log(`🔒 EXECUTION MODE: ${isCi ? 'CI / REQUIRED VALIDATION (Strict Zero-Skip Gating)' : 'LOCAL DEVELOPER (Safe NOT RUN Permitted)'}`);
console.log(`⚡ TEST DATABASE  : ${hasTestDb ? `CONFIGURED (${dbEngine})` : 'NOT CONFIGURED'}`);

if (hasTestDb) {
  console.log(`   Engine Target : ${dbEngine === 'POSTGRESQL' ? 'Real PostgreSQL (TEST_DATABASE_URL)' : 'Isolated SQLite (' + (process.env.TEST_DATABASE_URL || 'file') + ')'}`);
} else {
  console.log('   Notice        : Database integration suites will report NOT RUN.');
  if (isCi) {
    console.log('   ⚠️  CI ALERT   : Overall run will FAIL because database tests are required in CI mode.');
  } else {
    console.log('   Tip           : Set TEST_DATABASE_URL to run integration suites locally.');
  }
}
console.log('======================================================================\n');

const results = [];
let totalPassed = 0;
let totalFailed = 0;
let totalNotRun = 0;

for (const suite of suites) {
  process.stdout.write(`▶ Running: ${suite.name}... `);

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    ...(isCi ? { CI: 'true', REQUIRE_DB_TESTS: 'true' } : {})
  };

  const start = Date.now();
  const res = spawnSync(process.execPath, [suite.file], {
    env,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const duration = Date.now() - start;

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const combined = stdout + stderr;

  // Determine suite database target description for reporting
  let suiteTarget = 'Unit (No DB)';
  if (suite.requiresDb) {
    suiteTarget = hasTestDb ? dbEngine : 'DB Required';
  } else if (suite.file.includes('p0_qr')) {
    suiteTarget = hasTestDb ? `${dbEngine} + Unit` : 'Unit (DB Skip)';
  }

  if (res.status === 0) {
    if (combined.includes('[NOT RUN]')) {
      console.log(`⚠️  NOT RUN (${duration}ms)`);
      results.push({ name: suite.name, target: suiteTarget, status: 'NOT RUN', duration });
      totalNotRun++;
    } else {
      console.log(`✅ PASSED (${duration}ms)`);
      results.push({ name: suite.name, target: suiteTarget, status: 'PASSED', duration });
      totalPassed++;
    }
  } else {
    console.log(`❌ FAILED (${duration}ms)`);
    console.error(`\n--- Error Output for ${suite.name} ---`);
    console.error(combined.trim());
    console.error('--------------------------------------\n');
    results.push({ name: suite.name, target: suiteTarget, status: 'FAILED', duration });
    totalFailed++;
  }
}

console.log('\n======================================================================');
console.log('📊 TEST EXECUTION SUMMARY TABLE');
console.log('======================================================================');
console.log(
  'Suite Name'.padEnd(42) +
  'Engine Target'.padEnd(16) +
  'Status'.padEnd(12) +
  'Duration'
);
console.log('-'.repeat(78));

for (const r of results) {
  const icon = r.status === 'PASSED' ? '✅ ' : r.status === 'NOT RUN' ? '⚠️  ' : '❌ ';
  console.log(
    r.name.padEnd(42) +
    r.target.padEnd(16) +
    (icon + r.status).padEnd(12) +
    `${r.duration}ms`
  );
}

console.log('-'.repeat(78));
console.log(`SUMMARY COUNTS: ${totalPassed} PASSED | ${totalNotRun} NOT RUN | ${totalFailed} FAILED`);
console.log(`ACTIVE ENGINE : ${hasTestDb ? dbEngine : 'None (Unit Tests Only)'}`);
console.log('======================================================================\n');

// Prevent False-Green CI Results Policy:
if (totalFailed > 0) {
  console.error(`❌ FINAL VERDICT: FAILED (${totalFailed} suite(s) failed).\n`);
  process.exit(1);
} else if (totalNotRun > 0) {
  if (isCi) {
    console.error(
      `❌ FINAL VERDICT: FAILED (CI/Required mode active: ${totalNotRun} required database integration suite(s) were NOT RUN).\n` +
      `   Set TEST_DATABASE_URL to an isolated test database in your CI pipeline environment.\n`
    );
    process.exit(1);
  } else {
    console.log(
      `⚠️  FINAL VERDICT: PARTIAL PASS (LOCAL MODE: ${totalPassed} passed, ${totalNotRun} not run).\n` +
      `   This run did NOT execute database integration suites. It is NOT labeled a full pass.\n`
    );
    process.exit(0);
  }
} else {
  console.log(`✅ FINAL VERDICT: FULL PASS (${totalPassed}/${suites.length} suites passed on ${dbEngine} with 0 skipped).\n`);
  process.exit(0);
}
