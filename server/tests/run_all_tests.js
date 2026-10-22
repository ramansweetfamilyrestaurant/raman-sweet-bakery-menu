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
    name: 'P0 Admin Authorization Security Boundary',
    file: 'server/tests/p0_admin_authorization.test.js',
    requiresDb: true
  },
  {
    name: 'P1 KDS Authorization, Entitlement & Recall',
    file: 'server/tests/p1_kds_authorization_and_recall.test.js',
    requiresDb: true
  },
  {
    name: 'P2 KDS Data Integrity, Queue Consistency & Ticket Presentation',
    file: 'server/tests/p2_kds_data_integrity.test.js',
    requiresDb: true
  },
  {
    name: 'P3 KDS Reliability & Shared-Device Safety',
    file: 'server/tests/p3_kds_reliability_and_safety.test.js',
    requiresDb: true
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
  },
  {
    name: 'P0 Subscription Billing Bug Fixes',
    file: 'server/tests/p0_billing_fixes.test.js',
    requiresDb: true
  },
  {
    name: 'Billing Hardening Regression & Consistency',
    file: 'server/tests/billing_hardening.test.js',
    requiresDb: true
  },
  {
    name: 'Impersonation & Tenant Authorization Regression',
    file: 'server/tests/impersonation_and_tenant_data_fixes.test.js',
    requiresDb: true
  },
  {
    name: 'Tenant-Driven Resolution & Default Elimination',
    file: 'server/tests/tenant_defaults_and_isolation.test.js',
    requiresDb: true
  },
  {
    name: 'Support Ticket System & Safeguards',
    file: 'server/tests/support_tickets_system.test.js',
    requiresDb: true
  },
  {
    name: 'Honest Admin Dashboard UI & Incomplete Features',
    file: 'server/tests/honest_admin_ui.test.js',
    requiresDb: false
  },
  {
    name: 'Super Admin Bootstrap Security & Safeguards',
    file: 'server/tests/superadmin_bootstrap_security.test.js',
    requiresDb: true
  },
  {
    name: 'PostgreSQL Migration Workflow & Guard',
    file: 'server/tests/migration_workflow_guard.test.js',
    requiresDb: false
  },
  {
    name: 'Serverless Distributed Rate Limiting',
    file: 'server/tests/serverless_rate_limiting.test.js',
    requiresDb: false
  },
  {
    name: 'Hotel Rooms & Space Management',
    file: 'server/tests/hotel_rooms_management.test.js',
    requiresDb: true
  },
  {
    name: 'KDS & Cinema Security Fixes',
    file: 'server/tests/kds_and_cinema_fixes.test.js',
    requiresDb: true
  },
  {
    name: 'VIP Access Lifecycle E2E Regression',
    file: 'server/tests/vip_access_lifecycle_e2e.test.js',
    requiresDb: true
  },
  {
    name: 'Super Admin VIP Data Parity & Consistency',
    file: 'server/tests/superadmin_vip_data_parity.test.js',
    requiresDb: true
  },
  {
    name: 'VIP Duration & Auto-Renew Consistency',
    file: 'server/tests/vip_duration_consistency.test.js',
    requiresDb: true
  },
  {
    name: 'Super Admin Audit Log Category & Actor Normalization',
    file: 'server/tests/superadmin_audit_log_regression.test.js',
    requiresDb: false
  },
  {
    name: 'Tenant Admin Catalog Activity Logging',
    file: 'server/tests/tenant_catalog_audit_logging.test.js',
    requiresDb: true
  },
  {
    name: 'Tenant Admin Security, QR & Settings Activity Logging',
    file: 'server/tests/tenant_security_settings_audit_logging.test.js',
    requiresDb: true
  },
  {
    name: 'Audit Logs Index Migration Guard & Performance Optimization',
    file: 'server/tests/audit_logs_index_migration_guard.test.js',
    requiresDb: false
  },
  {
    name: 'Audit Log Storage & Archival Comprehensive Architecture',
    file: 'server/tests/audit_log_archival_comprehensive.test.js',
    requiresDb: true
  },
  {
    name: 'Archival Operator CLI Isolation & Zero-Pruning Guard',
    file: 'server/tests/archive_audit_logs_cli.test.js',
    requiresDb: true
  },
  {
    name: 'Super Admin Audit Archives HTTP Request/Response Security',
    file: 'server/tests/superadmin_audit_archives_http.test.js',
    requiresDb: true
  },
  {
    name: 'Audit Log Archival Migration Infrastructure & Invariants',
    file: 'server/tests/audit_log_archival_migration.test.js',
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
