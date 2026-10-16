/**
 * Super Admin Bootstrap Security & Production Seeding Safeguard Test Suite
 *
 * Verifies that:
 * 1. Automatic production seeding STRICTLY refuses to create default superadmin/superadmin123 credentials.
 * 2. In non-production/test environments, safe development fixtures are created.
 * 3. bootstrapSuperAdminUser accepts a valid password, hashes with bcrypt, and creates a superadmin account.
 * 4. bootstrapSuperAdminUser rejects passwords shorter than 8 characters.
 * 5. bootstrapSuperAdminUser strictly refuses to overwrite an existing Super Admin account.
 * 6. Hardcoded default credentials cannot authenticate against a bootstrapped account.
 */

import assert from 'assert';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { initDb, query, resetDbForTesting, bootstrapSuperAdminUser, seedData } from '../db.js';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_superadmin_sec.db');
process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;

console.log('======================================================================');
console.log('🛡️  SUPER ADMIN BOOTSTRAP SECURITY & PRODUCTION SEEDING TEST SUITE');
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

async function cleanupDb() {
  await resetDbForTesting();
  if (fs.existsSync(TEST_DB_PATH)) {
    try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
  }
}

async function runSuite() {
  try {
    // -------------------------------------------------------------------
    // 1. Production Mode: seedData() MUST NOT create default superadmin credentials
    // -------------------------------------------------------------------
    await test('1. Production seeding (NODE_ENV=production) refuses to create default superadmin/superadmin123', async () => {
      await cleanupDb();

      // Initialize empty DB schema without seeding default superadmin
      process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
      process.env.NODE_ENV = 'test';
      await initDb({ skipSeed: true });

      // Simulate production environment
      process.env.NODE_ENV = 'production';
      delete process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;

      await seedData();

      const superCheck = await query('SELECT COUNT(*) as count FROM admins WHERE role = $1 OR username = $2', ['superadmin', 'superadmin']);
      const count = parseInt(superCheck[0]?.count || 0, 10);
      assert.strictEqual(count, 0, 'Production seed must NOT create default superadmin credentials');

      process.env.NODE_ENV = 'test';
    });

    // -------------------------------------------------------------------
    // 2. Production Mode: VERCEL_ENV=production also blocks default superadmin
    // -------------------------------------------------------------------
    await test('2. Production seeding (VERCEL_ENV=production) refuses to create default superadmin/superadmin123', async () => {
      process.env.NODE_ENV = 'test';
      process.env.VERCEL_ENV = 'production';
      delete process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;

      await seedData();

      const superCheck = await query('SELECT COUNT(*) as count FROM admins WHERE role = $1 OR username = $2', ['superadmin', 'superadmin']);
      const count = parseInt(superCheck[0]?.count || 0, 10);
      assert.strictEqual(count, 0, 'VERCEL_ENV=production seed must NOT create default superadmin credentials');

      delete process.env.VERCEL_ENV;
    });

    // -------------------------------------------------------------------
    // 3. bootstrapSuperAdminUser rejects weak or short passwords
    // -------------------------------------------------------------------
    await test('3. bootstrapSuperAdminUser rejects password under 8 characters', async () => {
      await assert.rejects(
        async () => {
          await bootstrapSuperAdminUser({ username: 'superadmin', password: 'short' });
        },
        /BOOTSTRAP_ERROR/
      );

      await assert.rejects(
        async () => {
          await bootstrapSuperAdminUser({ username: 'superadmin', password: '' });
        },
        /BOOTSTRAP_ERROR/
      );
    });

    // -------------------------------------------------------------------
    // 4. bootstrapSuperAdminUser creates Super Admin with secure password
    // -------------------------------------------------------------------
    await test('4. bootstrapSuperAdminUser provisions Super Admin with properly hashed secret', async () => {
      const secretPassword = 'MySecretSecurePassword2026!';
      const result = await bootstrapSuperAdminUser({ username: 'custom_superadmin', password: secretPassword });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.username, 'custom_superadmin');

      const adminRes = await query('SELECT * FROM admins WHERE username = $1', ['custom_superadmin']);
      assert.strictEqual(adminRes.length, 1);
      const admin = adminRes[0];

      assert.strictEqual(admin.role, 'superadmin');
      assert.strictEqual(admin.restaurant_id, null, 'Super Admin must not be bound to a restaurant tenant');

      // Verify bcrypt match with the secret password
      const matchSecret = await bcrypt.compare(secretPassword, admin.password_hash);
      assert.strictEqual(matchSecret, true, 'Stored hash must match configured secret password');

      // Verify default password 'superadmin123' fails
      const matchDefault = await bcrypt.compare('superadmin123', admin.password_hash);
      assert.strictEqual(matchDefault, false, 'Default password superadmin123 must NOT authenticate');
    });

    // -------------------------------------------------------------------
    // 5. bootstrapSuperAdminUser strictly refuses to overwrite existing Super Admin
    // -------------------------------------------------------------------
    await test('5. bootstrapSuperAdminUser strictly refuses to overwrite existing Super Admin', async () => {
      await assert.rejects(
        async () => {
          await bootstrapSuperAdminUser({ username: 'custom_superadmin', password: 'AnotherNewPassword999!' });
        },
        /BOOTSTRAP_REFUSED/
      );

      await assert.rejects(
        async () => {
          await bootstrapSuperAdminUser({ username: 'different_user', password: 'AnotherNewPassword999!' });
        },
        /BOOTSTRAP_REFUSED/,
        'Should refuse even with different username because role=superadmin already exists'
      );
    });

    // -------------------------------------------------------------------
    // 6. Safe development fixture in non-production environment
    // -------------------------------------------------------------------
    await test('6. Safe development fixture creation in non-production local environment', async () => {
      await cleanupDb();
      process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
      process.env.NODE_ENV = 'test';
      delete process.env.VERCEL_ENV;
      delete process.env.VERCEL;

      // Seed database in test/development mode
      await initDb();

      const adminRes = await query('SELECT * FROM admins WHERE username = $1', ['superadmin']);
      assert.strictEqual(adminRes.length, 1, 'Local test/dev fixture superadmin must be created');
      assert.strictEqual(adminRes[0].role, 'superadmin');

      const match = await bcrypt.compare('superadmin123', adminRes[0].password_hash);
      assert.strictEqual(match, true, 'Dev fixture should match expected test credentials');
    });

    // -------------------------------------------------------------------
    // 7. bootstrap_superadmin.js CLI strictly rejects --password argument
    // -------------------------------------------------------------------
    await test('7. bootstrap_superadmin.js CLI rejects plaintext --password argument with security error', async () => {
      const { spawnSync } = await import('child_process');
      const scriptPath = path.resolve('server/scripts/bootstrap_superadmin.js');
      const proc = spawnSync(process.execPath, [scriptPath, '--password=plainSecret123'], {
        encoding: 'utf8'
      });

      assert.strictEqual(proc.status, 1, 'Process must exit with code 1 when --password is used');
      assert(proc.stderr.includes('SECURITY ERROR') || proc.stdout.includes('SECURITY ERROR'), 'Must output security error');
      assert(proc.stderr.includes('strictly prohibited') || proc.stdout.includes('strictly prohibited'));
      assert(!proc.stdout.includes('plainSecret123') && !proc.stderr.includes('plainSecret123'), 'Secret must never appear in output');
    });

  } finally {
    await cleanupDb();
  }

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
