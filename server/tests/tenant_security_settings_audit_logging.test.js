/**
 * TouchQR — Step 5B Tenant Admin Security, QR & Settings Activity Logging Integration Tests
 *
 * Verifies:
 * 1. QR Secret Rotation:
 *    - POST /api/admin/qr/rotate-secret logs SECURITY_ROTATE_QR_SECRET.
 *    - Event details never contain raw QR secret, JWT tokens, or session tokens.
 * 2. Shop Settings Updates:
 *    - PUT/POST /api/admin/settings logs TENANT_SETTINGS_UPDATED.
 *    - Details record only allowlisted changed field names and safe summaries.
 *    - KDS PIN setting logs 'KDS PIN updated' or 'KDS PIN cleared'; raw PIN or hash is NEVER logged.
 * 3. Credential Changes:
 *    - POST /api/admin/change-password logs SECURITY_CREDENTIALS_CHANGED on success.
 *    - Details never contain passwords, hashes, or credentials.
 *    - Failed password change (invalid current password) creates NO false success log.
 * 4. Tenant Login Activity:
 *    - POST /api/admin/login logs SECURITY_LOGIN_SUCCESS on successful login.
 *    - POST /api/admin/login logs SECURITY_LOGIN_FAILED on invalid credentials.
 *    - Passwords, hashes, and session tokens are strictly excluded from audit details.
 * 5. Isolation, Classification & Safety:
 *    - Security events classified into 'security' category.
 *    - Settings update events classified into 'tenant' (Shop) category.
 *    - Tenant ID derived strictly from authenticated user context (req.user.restaurant_id).
 *    - Cross-tenant spoofing via body-injected restaurant_id is rejected.
 *    - Zero data leakage across all audit details.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import adminRoutes from '../routes/admin.js';
import { JWT_SECRET } from '../config/jwt.js';
import { getCategory } from '../../src/utils/auditLogHelpers.js';

const TEST_DB_PATH = path.resolve('menu_test_sec_settings_audit.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('🛡️  TOUCHQR STEP 5B: TENANT SECURITY, QR & SETTINGS LOGGING TESTS');
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

async function run() {
  if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
    const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
    if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  // 1. Initialize schema
  await initDb();

  // 2. Setup ephemeral Express server
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin`;

  try {
    // 3. Setup test tenant restaurants & admins
    await query("DELETE FROM audit_logs WHERE restaurant_id IN (901, 902)");
    await query("DELETE FROM admins WHERE restaurant_id IN (901, 902)");
    await query("DELETE FROM restaurants WHERE id IN (901, 902)");

    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, owner_name, owner_email, subscription_type, plan_expires_at, qr_secret)
      VALUES 
        (901, 'Spice Bistro', 'spice-bistro', 'enterprise', true, 'Owner NineOne', 'owner901@example.com', 'COMPLIMENTARY', '2099-12-31', 'initial_secret_901'),
        (902, 'Royal Lounge', 'royal-lounge', 'enterprise', true, 'Owner NineTwo', 'owner902@example.com', 'COMPLIMENTARY', '2099-12-31', 'initial_secret_902')
    `);

    // Ensure SaaS plans exist so quota checks pass
    const existingPlan = await query('SELECT id FROM saas_plans WHERE key = $1', ['enterprise']);
    if (!existingPlan || existingPlan.length === 0) {
      await query(`
        INSERT INTO saas_plans (key, name, max_categories, max_dishes, max_combos, max_tables, dual_printer_enabled, gst_invoice_enabled)
        VALUES ('enterprise', 'Enterprise Plan', 9999, 9999, 9999, 9999, 1, 1)
      `);
    }

    const salt = await bcrypt.genSalt(10);
    const passHash1 = await bcrypt.hash('secretpass123', salt);
    const passHash2 = await bcrypt.hash('secretpass456', salt);

    const admin1Res = await query(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES (901, 'bistro_owner', $1, 'restaurant_admin')
      RETURNING id
    `, [passHash1]);
    const admin1Id = admin1Res[0]?.id || admin1Res.lastInsertRowid;

    const admin2Res = await query(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES (902, 'lounge_owner', $1, 'tenant_admin')
      RETURNING id
    `, [passHash2]);
    const admin2Id = admin2Res[0]?.id || admin2Res.lastInsertRowid;

    // Generate tokens
    const token901 = jwt.sign(
      { id: admin1Id, username: 'bistro_owner', restaurant_id: 901, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const token902 = jwt.sign(
      { id: admin2Id, username: 'lounge_owner', restaurant_id: 902, role: 'tenant_admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ====================================================================
    // 1. QR SECRET ROTATION
    // ====================================================================

    await test('POST /qr/rotate-secret logs SECURITY_ROTATE_QR_SECRET with tenant context and zero raw secret', async () => {
      const res = await fetch(`${baseUrl}/qr/rotate-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token901}` }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 901 AND action = 'SECURITY_ROTATE_QR_SECRET' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write SECURITY_ROTATE_QR_SECRET log');
      assert.strictEqual(logs[0].restaurant_id, 901);
      assert.strictEqual(logs[0].actor_role, 'restaurant_admin');

      // Fetch new secret from DB to verify it was NOT logged in details
      const restoRows = await query('SELECT qr_secret FROM restaurants WHERE id = 901');
      const newSecret = restoRows[0]?.qr_secret;
      assert.ok(newSecret && newSecret !== 'initial_secret_901', 'Secret must have rotated in DB');
      assert.strictEqual(logs[0].details.includes(newSecret), false, 'Raw new QR secret must NEVER appear in audit log details');
      assert.strictEqual(logs[0].details.includes('initial_secret_901'), false, 'Old QR secret must NEVER appear in audit log details');

      // Verify category
      assert.strictEqual(getCategory({ action: logs[0].action }).id, 'security');
    });

    // ====================================================================
    // 2. SHOP SETTINGS UPDATES
    // ====================================================================

    await test('PUT /settings logs TENANT_SETTINGS_UPDATED with allowlisted field names', async () => {
      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          name: 'Spice Bistro & Bar',
          phone: '9876543210',
          printer_mode: 'dual',
          total_tables: 25
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 901 AND action = 'TENANT_SETTINGS_UPDATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write TENANT_SETTINGS_UPDATED log');
      assert.strictEqual(logs[0].restaurant_id, 901);
      assert.strictEqual(logs[0].actor_role, 'restaurant_admin');
      assert.ok(logs[0].details.includes('name'));
      assert.ok(logs[0].details.includes('phone'));
      assert.ok(logs[0].details.includes('printer_mode'));
      assert.ok(logs[0].details.includes('total_tables'));

      // Verify category
      assert.strictEqual(getCategory({ action: logs[0].action }).id, 'tenant');
    });

    await test('PUT /settings with KDS PIN logs "KDS PIN updated" without exposing PIN value or hash', async () => {
      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          kds_pin: '7890'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 901 AND action = 'TENANT_SETTINGS_UPDATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.ok(logs[0].details.includes('KDS PIN updated'), 'Must mention KDS PIN updated');
      assert.strictEqual(logs[0].details.includes('7890'), false, 'Raw KDS PIN 7890 must NEVER appear in audit log details');

      // Check DB to verify hash is also absent from details
      const restoRows = await query('SELECT kds_pin_hash FROM restaurants WHERE id = 901');
      assert.ok(restoRows[0]?.kds_pin_hash, 'Hash should exist in DB');
      assert.strictEqual(logs[0].details.includes(restoRows[0].kds_pin_hash), false, 'KDS PIN hash must NEVER appear in audit log details');
    });

    await test('PUT /settings clearing KDS PIN logs "KDS PIN cleared"', async () => {
      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          kds_pin: ''
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 901 AND action = 'TENANT_SETTINGS_UPDATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.ok(logs[0].details.includes('KDS PIN cleared'), 'Must record KDS PIN cleared');
    });

    await test('PUT /settings with invalid KDS PIN returns 400 and writes NO audit log', async () => {
      const beforeCountRows = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 901");
      const beforeCount = Number(beforeCountRows[0]?.count || 0);

      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          kds_pin: 'abcd' // Invalid! Must be 4 numeric digits
        })
      });
      assert.strictEqual(res.status, 400);

      const afterCountRows = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 901");
      const afterCount = Number(afterCountRows[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount, 'Failed settings update must NOT write an audit log');
    });

    // ====================================================================
    // 3. CREDENTIAL CHANGES
    // ====================================================================

    await test('POST /change-password logs SECURITY_CREDENTIALS_CHANGED without password or hash', async () => {
      const res = await fetch(`${baseUrl}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          currentPassword: 'secretpass123',
          newPassword: 'brandnewpassword999',
          newUsername: 'bistro_owner_updated'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.username, 'bistro_owner_updated');

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 901 AND action = 'SECURITY_CREDENTIALS_CHANGED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write SECURITY_CREDENTIALS_CHANGED log');
      assert.strictEqual(logs[0].restaurant_id, 901);
      assert.strictEqual(logs[0].actor_role, 'restaurant_admin');
      assert.ok(logs[0].details.includes('password updated'));
      assert.ok(logs[0].details.includes('bistro_owner_updated'));

      // Zero-logging rule verification
      assert.strictEqual(logs[0].details.includes('secretpass123'), false, 'Current password must NEVER appear in details');
      assert.strictEqual(logs[0].details.includes('brandnewpassword999'), false, 'New password must NEVER appear in details');

      // Verify category
      assert.strictEqual(getCategory({ action: logs[0].action }).id, 'security');
    });

    await test('POST /change-password with invalid current password returns 400 and creates NO audit log', async () => {
      const beforeCountRows = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 901 AND action = 'SECURITY_CREDENTIALS_CHANGED'");
      const beforeCount = Number(beforeCountRows[0]?.count || 0);

      const res = await fetch(`${baseUrl}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          currentPassword: 'wrongpassword',
          newPassword: 'attempted_hacked_pass'
        })
      });
      assert.strictEqual(res.status, 400);

      const afterCountRows = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 901 AND action = 'SECURITY_CREDENTIALS_CHANGED'");
      const afterCount = Number(afterCountRows[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount, 'Failed password change must NOT write an audit log');
    });

    // ====================================================================
    // 4. TENANT LOGIN OUTCOME AUDITING
    // ====================================================================

    await test('POST /login with valid credentials logs SECURITY_LOGIN_SUCCESS with tenant identity', async () => {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'lounge_owner',
          password: 'secretpass456'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.token);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 902 AND action = 'SECURITY_LOGIN_SUCCESS' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write SECURITY_LOGIN_SUCCESS log');
      assert.strictEqual(logs[0].restaurant_id, 902);
      assert.strictEqual(logs[0].actor_role, 'tenant_admin');
      assert.ok(logs[0].details.includes('lounge_owner'));
      assert.strictEqual(logs[0].details.includes('secretpass456'), false, 'Password must NEVER be logged');
      assert.strictEqual(logs[0].details.includes(data.token), false, 'JWT token must NEVER be logged');

      // Verify category
      assert.strictEqual(getCategory({ action: logs[0].action }).id, 'security');
    });

    await test('POST /login with incorrect password logs SECURITY_LOGIN_FAILED and never records password', async () => {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'lounge_owner',
          password: 'definitely_wrong_password_999'
        })
      });
      assert.strictEqual(res.status, 401);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 902 AND action = 'SECURITY_LOGIN_FAILED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write SECURITY_LOGIN_FAILED log');
      assert.strictEqual(logs[0].restaurant_id, 902, 'Should associate with target restaurant');
      assert.strictEqual(logs[0].details.includes('definitely_wrong_password_999'), false, 'Attempted password must NEVER be logged');

      // Verify category
      assert.strictEqual(getCategory({ action: logs[0].action }).id, 'security');
    });

    await test('POST /login with unknown username logs SECURITY_LOGIN_FAILED at platform level', async () => {
      const res = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'completely_unknown_user_xyz',
          password: 'some_password'
        })
      });
      assert.strictEqual(res.status, 401);

      const logs = await query("SELECT * FROM audit_logs WHERE action = 'SECURITY_LOGIN_FAILED' AND restaurant_id IS NULL ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, null);
      assert.strictEqual(logs[0].details.includes('some_password'), false);
    });

    // ====================================================================
    // 5. CROSS-TENANT & ZERO-LEAK SECURITY SCAN
    // ====================================================================

    await test('Body-injected restaurant_id cannot redirect settings update or spoof audit ownership', async () => {
      // Tenant 901 attempts to inject restaurant_id: 902 in settings payload
      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token901}` },
        body: JSON.stringify({
          restaurant_id: 902,
          tagline: 'Spoofed Tagline Test'
        })
      });
      assert.strictEqual(res.status, 200);

      // Verify that Restaurant 902 was NOT modified
      const resto902 = await query('SELECT tagline FROM restaurants WHERE id = 902');
      assert.notStrictEqual(resto902[0]?.tagline, 'Spoofed Tagline Test', 'Tenant 902 must NOT be modified by Tenant 901');

      // Verify that Restaurant 901 received the update
      const resto901 = await query('SELECT tagline FROM restaurants WHERE id = 901');
      assert.strictEqual(resto901[0]?.tagline, 'Spoofed Tagline Test', 'Tenant 901 must receive its own update');

      // Verify audit log was recorded strictly for 901, NOT 902
      const auditLog = await query("SELECT restaurant_id FROM audit_logs WHERE details LIKE '%tagline%' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(auditLog[0]?.restaurant_id, 901, 'Audit log must record authenticated restaurant_id');
    });

    await test('Zero-leak scan: No sensitive tokens, secrets, hashes or credentials appear in any audit log details', async () => {
      const allLogs = await query("SELECT action, details FROM audit_logs WHERE restaurant_id IN (901, 902) OR restaurant_id IS NULL");
      const forbiddenTokens = [
        'secretpass',
        'initial_secret',
        'brandnewpassword',
        'attempted_hacked',
        'definitely_wrong',
        '$2b$', // bcrypt salt/hash indicator
        'eyJ'   // jwt token indicator
      ];

      for (const row of allLogs) {
        const text = (row.details || '');
        for (const token of forbiddenTokens) {
          assert.strictEqual(
            text.includes(token),
            false,
            `Audit log [${row.action}] leaked forbidden pattern "${token}" in details: "${row.details}"`
          );
        }
      }
    });

  } finally {
    server.close();
    if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
      const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
      if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
        try { fs.unlinkSync(rawPath); } catch {}
      }
    }
  }
}

try {
  await run();
  console.log('\n======================================================================');
  console.log(`INTEGRATION TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
  else process.exit(0);
} catch (err) {
  console.error('Fatal test error:', err);
  process.exit(1);
}
