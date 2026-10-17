/**
 * TouchQR — VIP Duration, Expiry & Auto-Renew Consistency Test Suite
 *
 * Covers all 13 Phase 5 regression scenarios:
 * 1. Lifetime VIP grant displays Lifetime and does not silently receive a seven-day expiry.
 * 2. Seven-day VIP grant stores a finite expiry exactly seven days from its start.
 * 3. Billing list and Tenant 360 show the same expiry for the same account.
 * 4. An expired seven-day grant is no longer treated as active complimentary access.
 * 5. Re-granting a seven-day account as lifetime updates the expiry correctly.
 * 6. Re-granting a lifetime account as seven-day replaces the old lifetime state correctly.
 * 7. Complimentarily VIP accounts do not show Auto-Renew ON for the VIP entitlement.
 * 8. A separate genuine paid subscription, if preserved, is represented distinctly and is not silently corrupted.
 * 9. Revoking VIP removes the active complimentary entitlement and invalidates cache.
 * 10. Suspended VIP tenants remain suspended independently of expiry and payment state.
 * 11. Ordinary paid, trial and pending-mandate accounts retain existing behavior.
 * 12. Forged client fields cannot set an account's duration or lifetime expiry.
 * 13. All supported business types continue to work (restaurants, bakeries/sweet shops, hotels, cinemas).
 */

import assert from 'assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_TEST_SQLITE = 'sqlite:menu_test_runner.db';
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = DEFAULT_TEST_SQLITE;
}

import { checkTestDatabaseRequirement } from './testDbGuard.js';

try {
  checkTestDatabaseRequirement('VIP Duration & Auto-Renew Consistency Suite');
} catch (guardErr) {
  console.error(`❌ ${guardErr.message}`);
  process.exit(1);
}

import { query, initDb } from '../db.js';
import superadminRoutes from '../routes/superadmin.js';
import adminRoutes from '../routes/admin.js';
import apiRoutes from '../routes/api.js';
import { JWT_SECRET } from '../config/jwt.js';
import { clearSubStatusCache } from '../middleware/auth.js';
import { isAuthoritativeComplimentaryTenant, resolveCanonicalSubscriptionState, resolveAuthoritativeEntitlements } from '../services/subscriptionState.js';

console.log('======================================================================');
console.log('👑  TOUCHQR VIP DURATION, EXPIRY & AUTO-RENEW CONSISTENCY SUITE');
console.log('======================================================================\n');

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(`     Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    }
    failedCount++;
  }
}

async function runAllTests() {
  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api/superadmin', superadminRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const superAdminToken = jwt.sign(
    { id: 1, username: 'superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  function makeAdminToken(adminId, restoId, username = 'admin_user') {
    return jwt.sign(
      { id: adminId, restaurant_id: restoId, username, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  const ts = Date.now();

  try {
    // --------------------------------------------------------------------------
    // Scenario 1: Lifetime VIP grant displays Lifetime and does not silently receive a seven-day expiry
    // --------------------------------------------------------------------------
    let lifetimeRestoId = null;
    let lifetimeSlug = `test-lifetime-${ts}`;

    await test('1. Lifetime VIP grant displays Lifetime and does not silently receive a seven-day expiry', async () => {
      const insRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('TouchQR Lifetime Demo', $1, 'pro', 999, 'PAID', 'active', true)
        RETURNING id
      `, [lifetimeSlug]);
      lifetimeRestoId = insRes[0]?.id || insRes.lastInsertRowid;

      // Super Admin grants explicit lifetime access
      const grantRes = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          plan_key: 'pro',
          is_lifetime: true,
          admin_notes: 'Explicit lifetime grant'
        })
      });
      assert.strictEqual(grantRes.status, 200, 'Grant response must be 200');
      const grantData = await grantRes.json();
      assert.strictEqual(grantData.access_until, 'Lifetime', 'Grant response access_until must be Lifetime');

      // Verify database fields: plan_expires_at must be null (no finite expiry)
      const [restoRow] = await query('SELECT * FROM restaurants WHERE id = $1', [lifetimeRestoId]);
      assert.strictEqual(restoRow.plan_expires_at, null, 'Database plan_expires_at must be null for lifetime grant');
      assert.strictEqual(restoRow.subscription_type, 'ADMIN_GRANTED', 'subscription_type must be ADMIN_GRANTED');

      // Check list API
      const listRes = await fetch(`${baseUrl}/superadmin/restaurants?search=${lifetimeSlug}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const listData = await listRes.json();
      const listTenant = (Array.isArray(listData) ? listData : listData.data).find(r => r.id === lifetimeRestoId);
      assert.strictEqual(listTenant.access_until, 'Lifetime', 'List API access_until must be Lifetime');
      assert.strictEqual(listTenant.is_vip, true, 'is_vip must be true');
      assert.strictEqual(listTenant.is_complimentary, true, 'is_complimentary must be true');
    });

    // --------------------------------------------------------------------------
    // Scenario 2: Seven-day VIP grant stores a finite expiry exactly seven days from its start
    // --------------------------------------------------------------------------
    let sevenDayRestoId = null;
    let sevenDaySlug = `test-7day-${ts}`;
    let grantStartTime = null;

    await test('2. Seven-day VIP grant stores a finite expiry exactly seven days from its start', async () => {
      const insRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Raman 7-Day Bakery', $1, 'pro', 999, 'PAID', 'active', true)
        RETURNING id
      `, [sevenDaySlug]);
      sevenDayRestoId = insRes[0]?.id || insRes.lastInsertRowid;

      grantStartTime = Date.now();
      const grantRes = await fetch(`${baseUrl}/superadmin/restaurants/${sevenDayRestoId}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          plan_key: 'pro',
          duration_days: 7,
          is_lifetime: false,
          admin_notes: '7-day promo grant'
        })
      });
      assert.strictEqual(grantRes.status, 200);
      const grantData = await grantRes.json();

      assert.notStrictEqual(grantData.access_until, 'Lifetime', '7-day grant must NOT return Lifetime');
      const grantedExp = new Date(grantData.access_until).getTime();
      const expectedExp = grantStartTime + 7 * 86400 * 1000;
      assert.ok(Math.abs(grantedExp - expectedExp) < 5000, `Stored expiry must be exactly 7 days from start (diff: ${Math.abs(grantedExp - expectedExp)}ms)`);

      // Verify in DB
      const [restoRow] = await query('SELECT * FROM restaurants WHERE id = $1', [sevenDayRestoId]);
      assert.ok(restoRow.plan_expires_at, 'Database plan_expires_at must be populated for 7-day grant');
      assert.notStrictEqual(restoRow.plan_expires_at, 'Lifetime', 'Database plan_expires_at must not be Lifetime');
    });

    // --------------------------------------------------------------------------
    // Scenario 3: Billing list and Tenant 360 show the same expiry for the same account
    // --------------------------------------------------------------------------
    await test('3. Billing list and Tenant 360 show the same expiry for the same account', async () => {
      // Check for Lifetime tenant
      const listLifeRes = await fetch(`${baseUrl}/superadmin/restaurants?search=${lifetimeSlug}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const listLifeData = await listLifeRes.json();
      const lifeTenantList = (Array.isArray(listLifeData) ? listLifeData : listLifeData.data).find(r => r.id === lifetimeRestoId);

      const t360LifeRes = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360LifeData = await t360LifeRes.json();

      assert.strictEqual(lifeTenantList.access_until, t360LifeData.subscription.access_until, 'Lifetime list and 360 access_until must match');
      assert.strictEqual(t360LifeData.subscription.access_until, 'Lifetime', '360 must show Lifetime');

      // Check for 7-Day tenant
      const list7Res = await fetch(`${baseUrl}/superadmin/restaurants?search=${sevenDaySlug}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const list7Data = await list7Res.json();
      const sevenTenantList = (Array.isArray(list7Data) ? list7Data : list7Data.data).find(r => r.id === sevenDayRestoId);

      const t3607Res = await fetch(`${baseUrl}/superadmin/restaurants/${sevenDayRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t3607Data = await t3607Res.json();

      assert.strictEqual(sevenTenantList.access_until, t3607Data.subscription.access_until, '7-day list and 360 access_until must match');
      assert.notStrictEqual(t3607Data.subscription.access_until, 'Lifetime', '7-day 360 must not show Lifetime');
    });

    // --------------------------------------------------------------------------
    // Scenario 4: An expired seven-day grant is no longer treated as active complimentary access
    // --------------------------------------------------------------------------
    let expiredRestoId = null;
    let expiredSlug = `test-expired-vip-${ts}`;

    await test('4. An expired seven-day grant is no longer treated as active complimentary access', async () => {
      const pastDate = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
      const insRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, plan_expires_at, subscription_type, mandate_status, active)
        VALUES ('Expired VIP Diner', $1, 'pro', 0, $2, 'ADMIN_GRANTED', 'admin_granted', true)
        RETURNING id
      `, [expiredSlug, pastDate]);
      expiredRestoId = insRes[0]?.id || insRes.lastInsertRowid;

      await query(`
        INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, subscription_type, current_period_end, auto_renew)
        VALUES ($1, 2, 'admin_granted', 'active', 0, 'ADMIN_GRANTED', $2, 0)
      `, [expiredRestoId, pastDate]);

      const [restoRow] = await query('SELECT * FROM restaurants WHERE id = $1', [expiredRestoId]);
      const [subRow] = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [expiredRestoId]);

      // Service helper evaluation
      const isComp = isAuthoritativeComplimentaryTenant(restoRow, subRow, new Date());
      assert.strictEqual(isComp, false, 'Expired VIP must return isAuthoritativeComplimentaryTenant = false');

      const canonical = resolveCanonicalSubscriptionState({ resto: restoRow, sub: subRow, now: new Date() });
      assert.strictEqual(canonical.isComplimentary, false, 'Expired VIP canonical state must not be complimentary');
      assert.strictEqual(canonical.status, 'expired', 'Expired VIP canonical status must be expired');

      // Tenant 360 check
      const t360Res = await fetch(`${baseUrl}/superadmin/restaurants/${expiredRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360Data = await t360Res.json();
      assert.strictEqual(t360Data.subscription.is_complimentary, false, '360 is_complimentary must be false');
      assert.strictEqual(t360Data.subscription.is_vip, false, '360 is_vip must be false');
      assert.strictEqual(t360Data.subscription.status, 'expired', '360 status must be expired');
    });

    // --------------------------------------------------------------------------
    // Scenario 5: Re-granting a seven-day account as lifetime updates the expiry correctly
    // --------------------------------------------------------------------------
    await test('5. Re-granting a seven-day account as lifetime updates the expiry correctly', async () => {
      // Re-grant the 7-day tenant as lifetime
      const regrantRes = await fetch(`${baseUrl}/superadmin/restaurants/${sevenDayRestoId}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          plan_key: 'enterprise',
          is_lifetime: true,
          admin_notes: 'Upgraded 7-day to lifetime'
        })
      });
      assert.strictEqual(regrantRes.status, 200);

      const [regrantRow] = await query('SELECT * FROM restaurants WHERE id = $1', [sevenDayRestoId]);
      assert.strictEqual(regrantRow.plan_expires_at, null, 'plan_expires_at must be cleared to null on lifetime upgrade');

      const t360Res = await fetch(`${baseUrl}/superadmin/restaurants/${sevenDayRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360Data = await t360Res.json();
      assert.strictEqual(t360Data.subscription.access_until, 'Lifetime', 'Access until must now be Lifetime');
    });

    // --------------------------------------------------------------------------
    // Scenario 6: Re-granting a lifetime account as seven-day replaces the old lifetime state correctly
    // --------------------------------------------------------------------------
    await test('6. Re-granting a lifetime account as seven-day replaces the old lifetime state correctly', async () => {
      const startTime = Date.now();
      const downgradeRes = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          plan_key: 'pro',
          duration_days: 7,
          is_lifetime: false,
          admin_notes: 'Downgraded lifetime to 7 days'
        })
      });
      assert.strictEqual(downgradeRes.status, 200);

      const [downgradeRow] = await query('SELECT * FROM restaurants WHERE id = $1', [lifetimeRestoId]);
      assert.ok(downgradeRow.plan_expires_at, 'plan_expires_at must be set to finite date');
      assert.notStrictEqual(downgradeRow.plan_expires_at, 'Lifetime');

      const expectedExp = startTime + 7 * 86400 * 1000;
      const actualExp = new Date(downgradeRow.plan_expires_at).getTime();
      assert.ok(Math.abs(actualExp - expectedExp) < 5000, 'Expiry must be exactly 7 days from re-grant start');

      const t360Res = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360Data = await t360Res.json();
      assert.notStrictEqual(t360Data.subscription.access_until, 'Lifetime', '360 must not show Lifetime after finite re-grant');
    });

    // --------------------------------------------------------------------------
    // Scenario 7: Complimentarily VIP accounts do not show Auto-Renew ON for the VIP entitlement
    // --------------------------------------------------------------------------
    await test('7. Complimentarily VIP accounts do not show Auto-Renew ON for the VIP entitlement', async () => {
      // Check both the upgraded lifetime and the finite 7-day accounts
      const t360Res1 = await fetch(`${baseUrl}/superadmin/restaurants/${sevenDayRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data1 = await t360Res1.json();
      assert.strictEqual(data1.subscription.auto_renew, false, 'VIP subscription auto_renew must be false');

      const t360Res2 = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data2 = await t360Res2.json();
      assert.strictEqual(data2.subscription.auto_renew, false, 'Finite VIP subscription auto_renew must be false');

      // Check list API
      const listRes = await fetch(`${baseUrl}/superadmin/restaurants?search=${sevenDaySlug}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const listData = await listRes.json();
      const listTenant = (Array.isArray(listData) ? listData : listData.data).find(r => r.id === sevenDayRestoId);
      assert.strictEqual(listTenant.auto_renew, 0, 'List API effective auto_renew must be 0 for VIP');
    });

    // --------------------------------------------------------------------------
    // Scenario 8: A separate genuine paid subscription, if preserved, is represented distinctly and is not silently corrupted
    // --------------------------------------------------------------------------
    let paidVipRestoId = null;
    let paidVipSlug = `test-paid-vip-${ts}`;

    await test('8. A separate genuine paid subscription, if preserved, is represented distinctly and is not silently corrupted', async () => {
      // 1. Create a paid tenant with active cashfree subscription
      const insRes = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, auto_debit_enabled)
        VALUES ('Active Paid Bistro', $1, 'pro', 999, 'PAID', 'active', true, 1)
        RETURNING id
      `, [paidVipSlug]);
      paidVipRestoId = insRes[0]?.id || insRes.lastInsertRowid;

      const periodEnd = new Date(Date.now() + 25 * 86400 * 1000).toISOString();
      await query(`
        INSERT INTO subscriptions (restaurant_id, plan_id, gateway, gateway_subscription_id, status, amount, subscription_type, current_period_end, auto_renew)
        VALUES ($1, 2, 'cashfree', 'cf_sub_12345', 'active', 999, 'PAID', $2, 1)
      `, [paidVipRestoId, periodEnd]);

      // 2. Superadmin grants complimentary VIP access (without deleting paid sub or calling Cashfree cancel)
      const grantRes = await fetch(`${baseUrl}/superadmin/restaurants/${paidVipRestoId}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          plan_key: 'enterprise',
          duration_days: 7,
          admin_notes: 'Promotional VIP grant on top of paid subscription'
        })
      });
      assert.strictEqual(grantRes.status, 200);

      // 3. Verify that the original paid subscription record still exists in the database
      const paidSubs = await query(`
        SELECT * FROM subscriptions 
        WHERE restaurant_id = $1 AND gateway = 'cashfree' AND subscription_type = 'PAID'
      `, [paidVipRestoId]);
      assert.strictEqual(paidSubs.length, 1, 'Historical paid subscription record must be preserved');
      assert.strictEqual(paidSubs[0].status, 'active', 'Historical paid subscription status must not be corrupted');
      assert.strictEqual(paidSubs[0].gateway_subscription_id, 'cf_sub_12345', 'Mandate record must remain intact');

      // 4. Check 360 API distinct representation
      const t360Res = await fetch(`${baseUrl}/superadmin/restaurants/${paidVipRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360Data = await t360Res.json();
      assert.strictEqual(t360Data.subscription.is_complimentary, true, 'Effective entitlement is complimentary VIP');
      assert.strictEqual(t360Data.subscription.auto_renew, false, 'Effective VIP auto-renew must be false');
      assert.strictEqual(t360Data.subscription.has_underlying_paid_subscription, true, 'has_underlying_paid_subscription must be true');
      assert.strictEqual(t360Data.subscription.underlying_auto_renew, true, 'Underlying auto-renew must be preserved as true');
      assert.ok(t360Data.subscription.underlying_subscription, 'underlying_subscription object must be populated');
      assert.strictEqual(t360Data.subscription.underlying_subscription.status, 'active');
    });

    // --------------------------------------------------------------------------
    // Scenario 9: Revoking VIP removes the active complimentary entitlement and invalidates cache
    // --------------------------------------------------------------------------
    await test('9. Revoking VIP removes the active complimentary entitlement and invalidates cache', async () => {
      const revokeRes = await fetch(`${baseUrl}/superadmin/restaurants/${paidVipRestoId}/revoke-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ admin_notes: 'Revoking promotional grant' })
      });
      assert.strictEqual(revokeRes.status, 200);
      const revokeData = await revokeRes.json();
      assert.strictEqual(revokeData.post_revoke_state, 'PAID_ACTIVE', 'Underlying active paid sub must resume');

      // Verify immediate cache invalidation and resume of paid subscription
      const [restoRow] = await query('SELECT * FROM restaurants WHERE id = $1', [paidVipRestoId]);
      assert.strictEqual(restoRow.subscription_type, 'PAID', 'subscription_type must revert to PAID');
      assert.strictEqual(restoRow.mandate_status, 'active', 'mandate_status must resume active');
      assert.strictEqual(restoRow.auto_debit_enabled, 1, 'auto_debit_enabled must resume 1');

      const t360Res = await fetch(`${baseUrl}/superadmin/restaurants/${paidVipRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360Data = await t360Res.json();
      assert.strictEqual(t360Data.subscription.is_complimentary, false, 'is_complimentary must be false');
      assert.strictEqual(t360Data.subscription.is_vip, false, 'is_vip must be false');
      assert.strictEqual(t360Data.subscription.auto_renew, true, 'Auto-renew must resume true for paid subscription');
    });

    // --------------------------------------------------------------------------
    // Scenario 10: Suspended VIP tenants remain suspended independently of expiry and payment state
    // --------------------------------------------------------------------------
    await test('10. Suspended VIP tenants remain suspended independently of expiry and payment state', async () => {
      // Suspend the lifetime VIP restaurant
      const suspRes = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/toggle-active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ active: false, reason: 'Compliance audit pending' })
      });
      assert.strictEqual(suspRes.status, 200);

      // Verify list API
      const listRes = await fetch(`${baseUrl}/superadmin/restaurants?search=${lifetimeSlug}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const listData = await listRes.json();
      const listTenant = (Array.isArray(listData) ? listData : listData.data).find(r => r.id === lifetimeRestoId);
      assert.strictEqual(listTenant.active, false, 'Tenant active must be false');
      assert.strictEqual(listTenant.subscription_status, 'suspended', 'subscription_status must be suspended despite VIP');

      // Verify 360 API
      const t360Res = await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/360`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const t360Data = await t360Res.json();
      assert.strictEqual(t360Data.tenant.active, false, '360 tenant.active must be false');
      assert.strictEqual(t360Data.subscription.status, 'suspended', '360 subscription.status must be suspended');
      assert.strictEqual(t360Data.subscription.badge.label, 'Account Suspended');

      // Unsuspend
      await fetch(`${baseUrl}/superadmin/restaurants/${lifetimeRestoId}/toggle-active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ active: true })
      });
    });

    // --------------------------------------------------------------------------
    // Scenario 11: Ordinary paid, trial and pending-mandate accounts retain existing behavior
    // --------------------------------------------------------------------------
    await test('11. Ordinary paid, trial and pending-mandate accounts retain existing behavior', async () => {
      // 1. Trial account
      const trialExp = new Date(Date.now() + 10 * 86400 * 1000).toISOString();
      const [trialResto] = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, trial_ends_at, active)
        VALUES ('Ordinary Trial', $1, 'pro', 999, 'TRIAL', 'pending', $2, true)
        RETURNING id
      `, [`trial-${ts}`, trialExp]);
      const trialId = trialResto.id;

      const [trialRow] = await query('SELECT * FROM restaurants WHERE id = $1', [trialId]);
      const trialState = resolveCanonicalSubscriptionState({ resto: trialRow, sub: null, now: new Date() });
      assert.strictEqual(trialState.status, 'trialing', 'Trial account must resolve to trialing');
      assert.strictEqual(trialState.isComplimentary, false, 'Trial account is not complimentary');

      // 2. Pending mandate account
      const [pendingResto] = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Pending Mandate', $1, 'pro', 999, 'PAID', 'pending', true)
        RETURNING id
      `, [`pending-${ts}`]);
      const pendingId = pendingResto.id;

      const [pendingRow] = await query('SELECT * FROM restaurants WHERE id = $1', [pendingId]);
      const pendingState = resolveCanonicalSubscriptionState({ resto: pendingRow, sub: null, now: new Date() });
      assert.strictEqual(pendingState.status, 'pending', 'Pending mandate must resolve to pending');
      assert.strictEqual(pendingState.active, false, 'Pending mandate without active trial must not be active');
    });

    // --------------------------------------------------------------------------
    // Scenario 12: Forged client fields cannot set an account's duration or lifetime expiry
    // --------------------------------------------------------------------------
    await test('12. Forged client fields cannot set an account\'s duration or lifetime expiry', async () => {
      const [tamperResto] = await query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active)
        VALUES ('Tamper Attempt Bistro', $1, 'basic', 499, 'PAID', 'active', true)
        RETURNING id
      `, [`tamper-${ts}`]);
      const tamperId = tamperResto.id;

      const tamperToken = makeAdminToken(9901, tamperId, 'tamper_user');

      // Attempt client profile update with forged subscription metadata
      const updateRes = await fetch(`${baseUrl}/admin/restaurant`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tamperToken}`
        },
        body: JSON.stringify({
          name: 'Tampered Name',
          is_vip: true,
          is_complimentary: true,
          subscription_type: 'ADMIN_GRANTED',
          plan_expires_at: null,
          access_until: 'Lifetime'
        })
      });
      // Even if route succeeds on permitted fields, forged VIP fields must be ignored
      const [afterTamper] = await query('SELECT * FROM restaurants WHERE id = $1', [tamperId]);
      assert.strictEqual(afterTamper.subscription_type, 'PAID', 'Forged subscription_type must be ignored');
      assert.strictEqual(isAuthoritativeComplimentaryTenant(afterTamper, null), false, 'Tenant must not become complimentary VIP');

      const statusRes = await fetch(`${baseUrl}/admin/subscription-status`, {
        headers: { 'Authorization': `Bearer ${tamperToken}` }
      });
      const statusData = await statusRes.json();
      assert.strictEqual(statusData.is_complimentary, false, 'Client status endpoint must report is_complimentary = false');
    });

    // --------------------------------------------------------------------------
    // Scenario 13: All supported business types continue to work
    // --------------------------------------------------------------------------
    await test('13. All supported business types continue to work (restaurants, bakeries, hotels, cinemas)', async () => {
      const types = [
        { type: 'restaurant_cafe', service: 'dine_in', space: 'tables' },
        { type: 'bakery_confectionery', service: 'counter_service', space: 'tables' },
        { type: 'hotel_resort', service: 'hotel', space: 'rooms' },
        { type: 'cinema_theatre', service: 'cinema', space: 'seats' }
      ];

      for (const t of types) {
        const [bizResto] = await query(`
          INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, subscription_type, mandate_status, active)
          VALUES ($1, $2, $3, $4, 'pro', 0, 'ADMIN_GRANTED', 'admin_granted', true)
          RETURNING id
        `, [`VIP ${t.type}`, `vip-${t.type}-${ts}`, t.type, t.service]);
        const bId = bizResto.id;

        const [rRow] = await query('SELECT * FROM restaurants WHERE id = $1', [bId]);
        const entitlements = resolveAuthoritativeEntitlements({ resto: rRow, sub: null, saasPlan: null, now: new Date() });

        assert.strictEqual(entitlements.isComplimentary, true, `${t.type} must receive isComplimentary`);
        assert.strictEqual(entitlements.quotas.dishes, 9999, `${t.type} max dishes must be 9999`);

        if (t.service === 'hotel') {
          assert.strictEqual(entitlements.quotas.rooms, 9999, 'Hotel must receive 9999 room quota');
        } else if (t.service === 'cinema') {
          assert.strictEqual(entitlements.quotas.seats, 9999, 'Cinema must receive 9999 seat quota');
        } else {
          assert.strictEqual(entitlements.quotas.tables, 9999, 'Restaurant/Bakery must receive 9999 table quota');
        }
      }
    });

  } finally {
    server.close();
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`SUITE RESULTS: Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('----------------------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
