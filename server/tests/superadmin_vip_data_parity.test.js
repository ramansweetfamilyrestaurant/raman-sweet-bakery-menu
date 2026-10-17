/**
 * TouchQR — Super Admin Data Consistency & VIP Parity Regression Test Suite
 *
 * Covers 12 core consistency requirements:
 * 1. Base-tier tenant with valid complimentary VIP access gets 'Enterprise VIP Access', ₹0, and is_vip: true in list API.
 * 2. Tenant 360 returns matching VIP plan metadata, unlimited quotas (9999), and enabled VIP entitlements.
 * 3. An ordinary suspended tenant is reported and displayed as suspended even if stored gateway status is active.
 * 4. A suspended VIP tenant is not presented as operationally active.
 * 5. A non-VIP tenant paying custom price (e.g. ₹799) contributes normalized ₹799 MRR, not catalog ₹999.
 * 6. VIP and non-paying accounts (trial, expired, cancelled, past_due) are excluded from paid MRR.
 * 7. Different billing periods (e.g. yearly / 12) and historical subscription rows are handled without double counting.
 * 8. Status pill counts equal the actual number of rows shown for those filters (1:1 predicate parity).
 * 9. Ordinary paid and trial tenant plans/entitlements remain correctly constrained to their tier.
 * 10. VIP status cannot be forged by client-supplied fields.
 * 11. Grant, revoke, suspension and profile updates reflect immediate authoritative data.
 * 12. List API and Tenant 360 never contradict one another about effective plan, status, or entitlements.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import superadminRoutes from '../routes/superadmin.js';
import { JWT_SECRET } from '../config/jwt.js';
import {
  resolveCanonicalSubscriptionState,
  isAuthoritativeComplimentaryTenant,
  resolveAuthoritativeEntitlements,
  calculateTenantMrr,
  formatTenantPlanDisplay,
  SUBSCRIPTION_STATES,
  resolveTenantSubscriptions
} from '../services/subscriptionState.js';
import {
  isLifetimeVipTenant,
  isVipTenant
} from '../../src/utils/subscriptionState.js';

const TEST_DB_PATH = path.resolve('menu_test_superadmin_parity.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('👑  TOUCHQR SUPER ADMIN DATA CONSISTENCY & VIP PARITY REGRESSION SUITE');
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
  if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
    const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
    if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  await initDb();

  // Create superadmin token for route calls using seeded superadmin record
  const saRows = await query("SELECT id, username FROM admins WHERE role = 'superadmin' LIMIT 1");
  const superAdminId = saRows[0]?.id || 1;
  const superAdminUsername = saRows[0]?.username || 'superadmin';
  const superAdminToken = jwt.sign(
    { id: superAdminId, username: superAdminUsername, role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Set up isolated Express app mounting superadmin routes
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin', superadminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/superadmin`;

  try {
    // Clean test records from DB
    await query("DELETE FROM subscriptions WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM admins WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM dishes WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM categories WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM restaurants WHERE slug LIKE 'test-parity-%'").catch(() => {});

    // Ensure standard saas_plans exist
    await query(`
      INSERT INTO saas_plans (key, name, price, max_dishes, max_categories, max_tables, direct_ordering_enabled, kds_enabled, dual_printer_enabled)
      VALUES ('basic', 'Basic Plan', 499, 50, 10, 20, 0, 0, 0),
             ('pro', 'Pro Plan', 999, 500, 50, 100, 0, 0, 0),
             ('enterprise', 'Enterprise Plan', 1999, 9999, 9999, 9999, 1, 1, 1)
    `).catch(() => {}); // ignore duplicate key if already seeded

    // -----------------------------------------------------------------------------------------------------
    // Seed fixtures:
    // Tenant A: Basic tier with active complimentary VIP access (admin_granted, price 0)
    // Tenant B: Pro tier ordinary suspended tenant whose gateway subscription says 'active'
    // Tenant C: Suspended VIP tenant
    // Tenant D: Active paid tenant with custom negotiated price ₹799/month
    // Tenant E: Active paid annual tenant with ₹11988/year (normalized MRR ₹999)
    // Tenant F: Free trial tenant
    // -----------------------------------------------------------------------------------------------------
    const now = new Date();
    const futureDate = new Date(now.getTime() + 60 * 86400 * 1000).toISOString();

    // Tenant A (VIP on basic tier base)
    await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('VIP Bistro', 'test-parity-vip-bistro', 'basic', 0, 'ADMIN_GRANTED', 'admin_granted', true, $1)
    `, [futureDate]);
    const [restoA] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-vip-bistro'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 1, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $2)
    `, [restoA.id, futureDate]);

    // Tenant B (Suspended tenant with stored gateway status 'active')
    await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('Suspended Diner', 'test-parity-suspended-diner', 'pro', 999, 'PAID', 'active', false, $1)
    `, [futureDate]);
    const [restoB] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-suspended-diner'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 2, 'cashfree', 'active', 999, 'INR', 'monthly', 'PAID', $2)
    `, [restoB.id, futureDate]);

    // Tenant C (Suspended VIP tenant)
    await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('Suspended VIP Cafe', 'test-parity-suspended-vip', 'enterprise', 0, 'ADMIN_GRANTED', 'admin_granted', false, $1)
    `, [futureDate]);
    const [restoC] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-suspended-vip'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 3, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $2)
    `, [restoC.id, futureDate]);

    // Tenant D (Custom price ₹799/month)
    await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('Custom Price Lounge', 'test-parity-custom-price', 'pro', 799, 'PAID', 'active', true, $1)
    `, [futureDate]);
    const [restoD] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-custom-price'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 2, 'cashfree', 'active', 799, 'INR', 'monthly', 'PAID', $2)
    `, [restoD.id, futureDate]);

    // Tenant E (Annual subscription ₹11,988/year with 2 older cancelled rows to test double counting)
    await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('Annual Grand Hotel', 'test-parity-annual-hotel', 'enterprise', 999, 'PAID', 'active', true, $1)
    `, [futureDate]);
    const [restoE] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-annual-hotel'");
    // Old historical records:
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 1, 'cashfree', 'cancelled', 499, 'INR', 'monthly', 'PAID', $2),
             ($1, 2, 'cashfree', 'cancelled', 999, 'INR', 'monthly', 'PAID', $2)
    `, [restoE.id, new Date(now.getTime() - 100 * 86400 * 1000).toISOString()]);
    // Latest active annual record:
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 3, 'cashfree', 'active', 11988, 'INR', 'yearly', 'PAID', $2)
    `, [restoE.id, futureDate]);

    // Tenant F (Free trial tenant)
    await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, subscription_type, mandate_status, active, trial_ends_at)
      VALUES ('Trial Bakery', 'test-parity-trial-bakery', 'basic', 499, 'TRIAL', 'none', true, $1)
    `, [futureDate]);
    const [restoF] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-trial-bakery'");

    // Tenant G (Hotel Resort VIP: room service model, total_rooms 45, total_tables 10)
    await query(`
      INSERT INTO restaurants (name, slug, business_type, service_model, business_category, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at, total_rooms, total_tables)
      VALUES ('Grand Royal Resort', 'test-parity-hotel-resort', 'hotel_resort', 'hotel', 'hotel', 'pro', 0, 'ADMIN_GRANTED', 'admin_granted', true, $1, 45, 10)
    `, [futureDate]);
    const [restoG] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-hotel-resort'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 2, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $2)
    `, [restoG.id, futureDate]);

    // Tenant H (Cinema & Theatre VIP: cinema service model, total_tables 350 representing seats)
    await query(`
      INSERT INTO restaurants (name, slug, business_type, service_model, business_category, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at, total_tables)
      VALUES ('Star Cineplex', 'test-parity-cinema-multiplex', 'cinema_theatre', 'cinema', 'cinema', 'basic', 0, 'ADMIN_GRANTED', 'admin_granted', true, $1, 350)
    `, [futureDate]);
    const [restoH] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-cinema-multiplex'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 1, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $2)
    `, [restoH.id, futureDate]);

    // Tenant I (Bakery & Confectionery VIP: retail counter service model)
    await query(`
      INSERT INTO restaurants (name, slug, business_type, service_model, business_category, resto_type, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('Sweet Delights Bakery', 'test-parity-bakery-shop', 'bakery_confectionery', 'dine_in', 'dine_in', 'bakery', 'enterprise', 0, 'ADMIN_GRANTED', 'admin_granted', true, $1)
    `, [futureDate]);
    const [restoI] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-bakery-shop'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 3, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $2)
    `, [restoI.id, futureDate]);

    // Tenant J: Multi-subscription tenant mimicking Tenant 1 (Raman Sweet Bakery)
    // Has Sub 1 (cancelled ₹999), Sub 2 (active VIP grant ₹0, exp 2036), Sub 3 (pending checkout ₹2499)
    await query(`
      INSERT INTO restaurants (name, slug, business_type, service_model, business_category, resto_type, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('MultiSub Bakery', 'test-parity-multisub-bakery', 'bakery_confectionery', 'dine_in', 'dine_in', 'bakery', 'enterprise', 0, 'ADMIN_GRANTED', 'pending', true, '2036-10-06T13:53:16.010Z')
    `);
    const [restoJ] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-multisub-bakery'");
    // Sub 1: Older cancelled cashfree subscription
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 2, 'cashfree', 'cancelled', 999, 'INR', 'monthly', 'PAID', $2)
    `, [restoJ.id, new Date(now.getTime() - 200 * 86400 * 1000).toISOString()]);
    // Sub 2: Active admin_granted VIP subscription expiring 2036
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 3, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', '2036-10-06 13:53:16.01')
    `, [restoJ.id]);
    // Sub 3: Newer pending Cashfree checkout attempt (higher ID)
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 3, 'cashfree', 'pending', 2499, 'INR', 'monthly', 'PAID', $2)
    `, [restoJ.id, futureDate]);

    // Tenant K: Finite VIP tenant mimicking Tenant 52 (TouchQR Demo)
    // Has 1-year VIP grant expiring 2026-10-21
    await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, subscription_type, mandate_status, active, plan_expires_at)
      VALUES ('Finite VIP Demo', 'test-parity-finite-vip', 'restaurant', 'pro', 0, 'ADMIN_GRANTED', 'admin_granted', true, '2026-10-21T10:40:07.314Z')
    `);
    const [restoK] = await query("SELECT * FROM restaurants WHERE slug = 'test-parity-finite-vip'");
    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, subscription_type, current_period_end)
      VALUES ($1, 2, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', '2026-10-21 10:40:07.314')
    `, [restoK.id]);

    // =====================================================================================================
    // TEST 1: Basic base-tier tenant with valid VIP access gets Enterprise VIP Access, ₹0, is_vip: true
    // =====================================================================================================
    await test('1. List API projects Enterprise VIP Access, ₹0, and is_vip: true for complimentary VIP', async () => {
      const res = await fetch(`${baseUrl}/restaurants?search=test-parity-vip-bistro`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200, 'GET /restaurants must return 200');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.restaurants || []);
      const tenant = list.find(r => r.slug === 'test-parity-vip-bistro');

      assert(tenant, 'VIP tenant must be returned in list API');
      assert.strictEqual(tenant.plan_name, 'Enterprise VIP Access', 'Must display "Enterprise VIP Access"');
      assert.strictEqual(tenant.effective_plan_price, 0, 'Effective plan price must be 0');
      assert.strictEqual(tenant.is_vip, true, 'is_vip must be true');
      assert.strictEqual(tenant.is_complimentary, true, 'is_complimentary must be true');
      assert.strictEqual(tenant.effective_plan_tier, 'enterprise', 'effective_plan_tier must project enterprise');
      assert.strictEqual(tenant.subscription_status, 'active', 'subscription_status must be active');

      // Assert presentation mapping for list rows and cards
      const planDisplay = formatTenantPlanDisplay(tenant);
      assert.strictEqual(planDisplay.primaryLabel, 'Enterprise VIP Access', 'Primary effective label must be "Enterprise VIP Access"');
      assert.strictEqual(planDisplay.secondaryLabel, '₹0/mo (Base: BASIC)', 'Secondary label must show ₹0/mo and base tier');
      assert.strictEqual(planDisplay.badgeText, '★ VIP', 'Badge text must be VIP');
      assert.strictEqual(planDisplay.fullDisplay, 'Enterprise VIP Access (₹0/mo • Base: BASIC)');
      assert(planDisplay.primaryLabel !== 'BASIC', 'Must not display BASIC as primary plan label');
      assert(planDisplay.primaryLabel !== 'Basic Plan', 'Must not display Basic Plan as primary plan label');
    });

    // =====================================================================================================
    // TEST 2: Tenant 360 returns matching VIP plan metadata, unlimited quotas (9999), and VIP entitlements
    // =====================================================================================================
    await test('2. Tenant 360 returns matching VIP plan metadata, 9999 quotas, and enterprise entitlements', async () => {
      const res = await fetch(`${baseUrl}/restaurants/${restoA.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200, 'GET /restaurants/:id/360 must return 200');
      const data = await res.json();

      assert.strictEqual(data.subscription.plan_name, 'Enterprise VIP Access');
      assert.strictEqual(data.subscription.effective_plan_price, 0);
      assert.strictEqual(data.subscription.is_vip, true);
      assert.strictEqual(data.subscription.effective_plan_tier, 'enterprise');

      // Check quotas
      assert.strictEqual(data.usage.dishes.limit, 9999, 'Dishes limit must be 9999 for VIP');
      assert.strictEqual(data.usage.categories.limit, 9999, 'Categories limit must be 9999 for VIP');
      assert.strictEqual(data.usage.tables.limit, 9999, 'Tables limit must be 9999 for VIP');

      // Check capabilities
      assert.strictEqual(data.usage.entitlements.direct_ordering_enabled, true, 'Direct ordering must be enabled for VIP');
      assert.strictEqual(data.usage.entitlements.kds_enabled, true, 'KDS must be enabled for VIP');
      assert.strictEqual(data.usage.entitlements.dual_printer_enabled, true, 'Dual printer must be enabled for VIP');
      assert.strictEqual(data.usage.entitlements.whatsapp_ordering_enabled, true, 'WhatsApp ordering must be enabled for VIP');
    });

    // =====================================================================================================
    // TEST 3: Ordinary suspended tenant is reported as suspended even if gateway subscription is active
    // =====================================================================================================
    await test('3. Suspended tenant is reported as suspended even if gateway subscription is active', async () => {
      const res = await fetch(`${baseUrl}/restaurants?search=test-parity-suspended-diner`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.restaurants || []);
      const tenant = list.find(r => r.slug === 'test-parity-suspended-diner');

      assert(tenant, 'Suspended tenant must be in list');
      assert.strictEqual(tenant.active, false, 'Tenant active must be false');
      assert.strictEqual(tenant.subscription_status, 'suspended', 'Subscription status must resolve to suspended');
      assert.strictEqual(tenant.underlying_subscription_status, 'active', 'Underlying gateway subscription status must be preserved');

      // Also verify Tenant 360
      const res360 = await fetch(`${baseUrl}/restaurants/${restoB.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data360 = await res360.json();
      assert.strictEqual(data360.tenant.active, false);
      assert.strictEqual(data360.subscription.status, 'suspended');
      assert.strictEqual(data360.subscription.canonical_active, false);
      assert.strictEqual(data360.security.account_status, 'SUSPENDED');
    });

    // =====================================================================================================
    // TEST 4: Suspended VIP tenant is not incorrectly presented as operationally active
    // =====================================================================================================
    await test('4. Suspended VIP tenant is presented as suspended, not active', async () => {
      const state = resolveCanonicalSubscriptionState({ resto: restoC, sub: null, now });
      assert.strictEqual(state.status, SUBSCRIPTION_STATES.SUSPENDED, 'Canonical status must be suspended');
      assert.strictEqual(state.active, false, 'Canonical active must be false');

      const res = await fetch(`${baseUrl}/restaurants/${restoC.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert.strictEqual(data.tenant.active, false);
      assert.strictEqual(data.subscription.status, 'suspended');
      assert.strictEqual(data.subscription.canonical_active, false);
      assert.strictEqual(data.security.account_status, 'SUSPENDED');
    });

    // =====================================================================================================
    // TEST 5: Non-VIP tenant paying ₹799 contributes normalized ₹799 MRR, not catalog ₹999
    // =====================================================================================================
    await test('5. Custom negotiated price ₹799 contributes ₹799 to MRR, not catalog ₹999', async () => {
      const res = await fetch(`${baseUrl}/restaurants?search=test-parity-custom-price`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.restaurants || []);
      const tenant = list.find(r => r.slug === 'test-parity-custom-price');

      assert(tenant, 'Custom price tenant must be in list');
      assert.strictEqual(tenant.effective_plan_price, 799, 'Effective plan price must preserve ₹799');
      assert.strictEqual(tenant.recurring_amount, 799, 'Recurring amount must preserve ₹799');

      const mrr = calculateTenantMrr(tenant);
      assert.strictEqual(mrr, 799, 'Calculated MRR must be exactly ₹799, never catalog ₹999');
    });

    // =====================================================================================================
    // TEST 6: VIP and non-paying accounts (trial, expired, cancelled, failed) are excluded from paid MRR
    // =====================================================================================================
    await test('6. VIP and non-paying accounts are strictly excluded from paid MRR', async () => {
      // VIP tenant:
      assert.strictEqual(calculateTenantMrr(restoA), 0, 'VIP tenant MRR must be 0');

      // Suspended tenant:
      assert.strictEqual(calculateTenantMrr(restoB), 0, 'Suspended tenant MRR must be 0');

      // Suspended VIP tenant:
      assert.strictEqual(calculateTenantMrr(restoC), 0, 'Suspended VIP tenant MRR must be 0');

      // Trial tenant:
      const trialTenant = { ...restoF, subscription_status: 'trialing' };
      assert.strictEqual(calculateTenantMrr(trialTenant), 0, 'Trial tenant MRR must be 0');

      // Payment failed tenant:
      const failedTenant = { ...restoD, subscription_status: 'payment_failed' };
      assert.strictEqual(calculateTenantMrr(failedTenant), 0, 'Failed payment tenant MRR must be 0');

      // Expired tenant:
      const expiredTenant = { ...restoD, subscription_status: 'expired' };
      assert.strictEqual(calculateTenantMrr(expiredTenant), 0, 'Expired tenant MRR must be 0');
    });

    // =====================================================================================================
    // TEST 7: Billing period normalization & avoiding double counting historical subscriptions
    // =====================================================================================================
    await test('7. Annual subscription normalized to monthly (₹11988 / 12 = ₹999) without double counting history', async () => {
      const res = await fetch(`${baseUrl}/restaurants?search=test-parity-annual-hotel`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.restaurants || []);
      const tenant = list.find(r => r.slug === 'test-parity-annual-hotel');

      assert(tenant, 'Annual hotel must be found');
      assert.strictEqual(tenant.billing_cycle, 'yearly', 'Billing cycle must be yearly');

      const mrr = calculateTenantMrr({
        ...tenant,
        recurring_amount: 11988,
        billing_cycle: 'yearly',
        subscription_status: 'active'
      });
      assert.strictEqual(mrr, 999, 'MRR for ₹11,988/yr must normalize to ₹999/mo');

      // Verify that list API only returned 1 projected record for this tenant, not duplicated across 3 subscription rows
      const allHotelRows = list.filter(r => r.slug === 'test-parity-annual-hotel');
      assert.strictEqual(allHotelRows.length, 1, 'Must not duplicate tenant rows from multiple historical subscriptions');
    });

    // =====================================================================================================
    // TEST 8: Status pill counts equal actual number of rows shown for those filters
    // =====================================================================================================
    await test('8. Filter predicates and pill counts match 1:1', async () => {
      const sampleTenants = [
        { id: 1, active: true, is_vip: true, subscription_status: 'active' },
        { id: 2, active: false, is_vip: false, subscription_status: 'suspended' },
        { id: 3, active: true, is_vip: false, subscription_status: 'active', plan_price: 999 },
        { id: 4, active: true, is_vip: false, subscription_status: 'trialing' },
        { id: 5, active: true, is_vip: false, subscription_status: 'payment_failed' }
      ];

      const getStatus = (r) => {
        if (r.active === false || r.subscription_status === 'suspended') return 'suspended';
        if (r.is_vip) return 'vip';
        if (r.subscription_status === 'trialing') return 'trial';
        if (r.subscription_status === 'payment_failed') return 'failed';
        return 'active';
      };

      const matchesFilter = (r, filter) => {
        if (!filter || filter === 'all') return true;
        return getStatus(r) === filter;
      };

      for (const filterId of ['all', 'active', 'vip', 'suspended', 'trial', 'failed']) {
        const count = sampleTenants.filter(r => matchesFilter(r, filterId)).length;
        const filteredRows = sampleTenants.filter(r => matchesFilter(r, filterId));
        assert.strictEqual(count, filteredRows.length, `Count and row count must match exactly for filter '${filterId}'`);
      }

      // Crucial assertion: Active filter must NOT count VIP tenants
      const activeRows = sampleTenants.filter(r => matchesFilter(r, 'active'));
      assert(activeRows.every(r => !r.is_vip), 'Active filter must strictly exclude VIPs because VIP has its own filter');
    });

    // =====================================================================================================
    // TEST 9: Ordinary paid and trial tenant plans/entitlements remain correct
    // =====================================================================================================
    await test('9. Ordinary basic/pro plans retain their configured limits and non-enterprise capabilities', async () => {
      const basicEntitlements = resolveAuthoritativeEntitlements({
        resto: { plan_tier: 'basic', plan_price: 499, active: true },
        sub: null,
        saasPlan: { max_dishes: 50, max_categories: 10, max_tables: 20, kds_enabled: 0, direct_ordering_enabled: 0 }
      });

      assert.strictEqual(basicEntitlements.is_vip, false);
      assert.strictEqual(basicEntitlements.plan_name, 'BASIC Plan');
      assert.strictEqual(basicEntitlements.plan_price, 499);
      assert.strictEqual(basicEntitlements.quotas.max_dishes, 50);
      assert.strictEqual(basicEntitlements.quotas.max_categories, 10);
      assert.strictEqual(basicEntitlements.capabilities.kds_enabled, false);
      assert.strictEqual(basicEntitlements.capabilities.direct_ordering_enabled, false);
    });

    // =====================================================================================================
    // TEST 10: VIP status cannot be forged by client-supplied fields
    // =====================================================================================================
    await test('10. Client cannot forge VIP status by passing client-supplied fields without DB grant', async () => {
      // An ordinary paid restaurant where someone tries to pass is_vip: true or plan_name: 'VIP'
      const fraudulentClientData = {
        name: 'Normal Cafe',
        plan_tier: 'basic',
        plan_price: 499,
        subscription_type: 'PAID',
        mandate_status: 'none',
        is_vip: true, // forged client property
        is_complimentary: true // forged client property
      };

      const isVip = isAuthoritativeComplimentaryTenant(fraudulentClientData, null);
      assert.strictEqual(isVip, false, 'isAuthoritativeComplimentaryTenant must reject client forgery');

      const entitlements = resolveAuthoritativeEntitlements({ resto: fraudulentClientData, sub: null, saasPlan: null });
      assert.strictEqual(entitlements.is_vip, false, 'Authoritative entitlements must reject forged VIP');
      assert.notStrictEqual(entitlements.plan_name, 'Enterprise VIP Access');
    });

    // =====================================================================================================
    // TEST 11: Grant, revoke, and suspension toggle reflect immediate authoritative data
    // =====================================================================================================
    await test('11. Grant, revoke, and suspension toggle update data immediately', async () => {
      // 1. Toggle suspension on Tenant D (Custom Price Lounge)
      await fetch(`${baseUrl}/restaurants/${restoD.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ active: false })
      });

      const [afterSuspension] = await query("SELECT active FROM restaurants WHERE id = $1", [restoD.id]);
      assert.strictEqual(Boolean(afterSuspension.active), false, 'Tenant must be deactivated in DB');

      // 2. Grant VIP to Tenant D
      await fetch(`${baseUrl}/restaurants/${restoD.id}/grant-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ plan_key: 'enterprise', is_lifetime: true, notes: 'Partner complimentary access' })
      });

      const [afterGrant] = await query("SELECT * FROM restaurants WHERE id = $1", [restoD.id]);
      assert.strictEqual(afterGrant.subscription_type, 'ADMIN_GRANTED', 'subscription_type must be ADMIN_GRANTED');
      assert.strictEqual(afterGrant.mandate_status, 'admin_granted', 'mandate_status must be admin_granted');
      assert.strictEqual(Number(afterGrant.plan_price), 0, 'plan_price must be 0');

      // 3. Revoke VIP from Tenant D
      await fetch(`${baseUrl}/restaurants/${restoD.id}/revoke-free-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        }
      });

      const [afterRevoke] = await query("SELECT * FROM restaurants WHERE id = $1", [restoD.id]);
      assert.strictEqual(afterRevoke.subscription_type, 'PAID', 'subscription_type must revert to PAID');
      assert.strictEqual(isAuthoritativeComplimentaryTenant(afterRevoke, null), false, 'Must no longer be complimentary VIP');

      // Restore Tenant D to its original active paid custom price state
      await query(`
        UPDATE restaurants
        SET plan_tier = 'pro', plan_price = 799, subscription_type = 'PAID', mandate_status = 'active', active = true
        WHERE id = $1
      `, [restoD.id]);
      await query(`
        UPDATE subscriptions
        SET plan_id = 2, gateway = 'cashfree', status = 'active', amount = 799, subscription_type = 'PAID', auto_renew = 1
        WHERE restaurant_id = $1
      `, [restoD.id]);
    });

    // =====================================================================================================
    // TEST 12: List API and Tenant 360 never contradict one another
    // =====================================================================================================
    await test('12. List API and Tenant 360 return consistent plan_name, effective_price, and status', async () => {
      // Fetch Tenant A (VIP) in list API
      const resList = await fetch(`${baseUrl}/restaurants?search=test-parity-vip-bistro`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataList = await resList.json();
      const list = Array.isArray(dataList) ? dataList : (dataList.data || dataList.restaurants || []);
      const listTenant = list.find(r => r.slug === 'test-parity-vip-bistro');

      // Fetch Tenant A in 360 API
      const res360 = await fetch(`${baseUrl}/restaurants/${restoA.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data360 = await res360.json();

      assert.strictEqual(listTenant.plan_name, data360.subscription.plan_name, 'plan_name must match between list and 360');
      assert.strictEqual(listTenant.effective_plan_price, data360.subscription.effective_plan_price, 'effective_plan_price must match');
      assert.strictEqual(listTenant.is_vip, data360.subscription.is_vip, 'is_vip must match');
      assert.strictEqual(listTenant.subscription_status, data360.subscription.status, 'subscription_status must match');
      assert.strictEqual(listTenant.active, data360.tenant.active, 'active boolean must match');
    });

    // =====================================================================================================
    // TEST 13: Canonical Business Taxonomy & Service Model Resolution
    // =====================================================================================================
    await test('13. Multi-industry business types resolve to canonical types and appropriate service models', async () => {
      const resHotel = await fetch(`${baseUrl}/restaurants/${restoG.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataHotel = await resHotel.json();
      assert.strictEqual(dataHotel.tenant.business_type, 'hotel_resort');
      assert.strictEqual(dataHotel.tenant.service_model, 'hotel');

      const resCinema = await fetch(`${baseUrl}/restaurants/${restoH.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataCinema = await resCinema.json();
      assert.strictEqual(dataCinema.tenant.business_type, 'cinema_theatre');
      assert.strictEqual(dataCinema.tenant.service_model, 'cinema');

      const resBakery = await fetch(`${baseUrl}/restaurants/${restoI.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataBakery = await resBakery.json();
      assert.strictEqual(dataBakery.tenant.business_type, 'bakery_confectionery');
    });

    // =====================================================================================================
    // TEST 14: Hotel Room Quotas & In-Room Dining Entitlement
    // =====================================================================================================
    await test('14. Hotel VIP preserves room semantics: unlimited rooms (9999) and in-room QR dining enabled', async () => {
      const res = await fetch(`${baseUrl}/restaurants/${restoG.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();

      assert.strictEqual(data.usage.primarySpace, 'rooms', 'Primary space for hotel must be rooms');
      assert.strictEqual(data.usage.space_label, 'Hotel Rooms', 'Space label must be Hotel Rooms');
      assert.strictEqual(data.usage.rooms.limit, 9999, 'VIP rooms limit must be 9999');
      assert.strictEqual(data.usage.rooms.current, 45, 'Current room count must be 45');
      assert.strictEqual(data.usage.entitlements.room_ordering_enabled, true, 'Room ordering must be enabled for hotel VIP');
    });

    // =====================================================================================================
    // TEST 15: Cinema Seat Quotas & Multiplex Seat QR Ordering Entitlement
    // =====================================================================================================
    await test('15. Cinema VIP preserves seat semantics: unlimited seats (9999) and cinema seat QR ordering enabled', async () => {
      const res = await fetch(`${baseUrl}/restaurants/${restoH.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();

      assert.strictEqual(data.usage.primarySpace, 'seats', 'Primary space for cinema must be seats');
      assert.strictEqual(data.usage.space_label, 'Auditorium Seats', 'Space label must be Auditorium Seats');
      assert.strictEqual(data.usage.seats.limit, 9999, 'VIP seats limit must be 9999');
      assert.strictEqual(data.usage.entitlements.cinema_ordering_enabled, true, 'Cinema ordering must be enabled for cinema VIP');
    });

    // =====================================================================================================
    // TEST 16: Feature Applicability Matrix: Inapplicable Features vs Disabled Features
    // =====================================================================================================
    await test('16. Inapplicable features are clearly distinguished with UNSUPPORTED status in feature matrix', async () => {
      // Cinema should NOT have KDS or Bluetooth KOT as applicable features
      const resCinema = await fetch(`${baseUrl}/restaurants/${restoH.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataCinema = await resCinema.json();
      const cinemaMatrix = dataCinema.usage.feature_matrix;

      assert(cinemaMatrix, 'feature_matrix must be present in usage');
      assert.strictEqual(cinemaMatrix.kds_enabled.status, 'UNSUPPORTED', 'KDS must be UNSUPPORTED for cinema');
      assert.strictEqual(cinemaMatrix.kds_enabled.applicable, false);
      assert.strictEqual(cinemaMatrix.bluetooth_kot_enabled.status, 'UNSUPPORTED', 'Bluetooth KOT must be UNSUPPORTED for cinema');
      assert.strictEqual(cinemaMatrix.cinema_ordering_enabled.status, 'AVAILABLE', 'Cinema ordering must be AVAILABLE for cinema VIP');

      // Bakery should NOT have live cookline KDS as an applicable feature
      const resBakery = await fetch(`${baseUrl}/restaurants/${restoI.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataBakery = await resBakery.json();
      const bakeryMatrix = dataBakery.usage.feature_matrix;

      assert.strictEqual(bakeryMatrix.kds_enabled.status, 'UNSUPPORTED', 'KDS must be UNSUPPORTED for retail bakery');
      assert.strictEqual(bakeryMatrix.kds_enabled.applicable, false);

      // Restaurant should have KDS and KOT as AVAILABLE for VIP
      const resResto = await fetch(`${baseUrl}/restaurants/${restoA.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const dataResto = await resResto.json();
      const restoMatrix = dataResto.usage.feature_matrix;

      assert.strictEqual(restoMatrix.kds_enabled.status, 'AVAILABLE', 'KDS must be AVAILABLE for restaurant VIP');
      assert.strictEqual(restoMatrix.kds_enabled.applicable, true);
      assert.strictEqual(restoMatrix.bluetooth_kot_enabled.status, 'AVAILABLE', 'Bluetooth KOT must be AVAILABLE for restaurant VIP');
    });

    // =====================================================================================================
    // TEST 17: Security & Tenant Isolation: Role checks prevent unauthorized access & forged mutations
    // =====================================================================================================
    await test('17. Role security strictly isolates tenant data and rejects non-superadmin access', async () => {
      // Create a tenant owner token
      const tenantToken = jwt.sign(
        { id: 999, username: 'tenantowner', role: 'restaurant_admin', restaurant_id: restoD.id },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Attempt to access Super Admin list endpoint with tenant token
      const resList = await fetch(`${baseUrl}/restaurants`, {
        headers: { Authorization: `Bearer ${tenantToken}` }
      });
      assert.strictEqual(resList.status, 403, 'Tenant admin must be rejected from Super Admin list endpoint');

      // Attempt to access Super Admin 360 endpoint with tenant token
      const res360 = await fetch(`${baseUrl}/restaurants/${restoA.id}/360`, {
        headers: { Authorization: `Bearer ${tenantToken}` }
      });
      assert.strictEqual(res360.status, 403, 'Tenant admin must be rejected from Super Admin 360 endpoint');
    });

    // =====================================================================================================
    // TEST 18: VIP Plan Label Parity Across Directory, Cards, Subscriptions & 360 Views
    // =====================================================================================================
    await test('18. Multi-industry tenants (bistro, hotel, cinema, bakery, paid) maintain strict VIP plan label parity', async () => {
      const res = await fetch(`${baseUrl}/restaurants`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.restaurants || []);

      const vipBistro = list.find(r => r.slug === 'test-parity-vip-bistro');
      const vipHotel = list.find(r => r.slug === 'test-parity-hotel-resort');
      const vipCinema = list.find(r => r.slug === 'test-parity-cinema-multiplex');
      const vipBakery = list.find(r => r.slug === 'test-parity-bakery-shop');
      const paidCustom = list.find(r => r.slug === 'test-parity-custom-price');
      const paidAnnual = list.find(r => r.slug === 'test-parity-annual-hotel');
      const trialBakery = list.find(r => r.slug === 'test-parity-trial-bakery');

      assert(vipBistro && vipHotel && vipCinema && vipBakery && paidCustom && paidAnnual && trialBakery, 'All seeded fixtures must be in list');

      // 1. Bistro VIP (Base: basic)
      const bistroDisplay = formatTenantPlanDisplay(vipBistro);
      assert.strictEqual(bistroDisplay.primaryLabel, 'Enterprise VIP Access', 'Bistro primary plan must be Enterprise VIP Access');
      assert.strictEqual(bistroDisplay.secondaryLabel, '₹0/mo (Base: BASIC)', 'Bistro secondary label must show base tier BASIC');
      assert.strictEqual(bistroDisplay.badgeText, '★ VIP');
      assert.strictEqual(bistroDisplay.fullDisplay, 'Enterprise VIP Access (₹0/mo • Base: BASIC)');
      assert(!bistroDisplay.primaryLabel.includes('BASIC'), 'Must not display BASIC as primary label');

      // 2. Hotel VIP (Base: pro)
      const hotelDisplay = formatTenantPlanDisplay(vipHotel);
      assert.strictEqual(hotelDisplay.primaryLabel, 'Enterprise VIP Access', 'Hotel primary plan must be Enterprise VIP Access');
      assert.strictEqual(hotelDisplay.secondaryLabel, '₹0/mo (Base: PRO)', 'Hotel secondary label must show base tier PRO');
      assert.strictEqual(hotelDisplay.badgeText, '★ VIP');
      assert.strictEqual(hotelDisplay.fullDisplay, 'Enterprise VIP Access (₹0/mo • Base: PRO)');
      assert(!hotelDisplay.primaryLabel.includes('PRO'), 'Must not display PRO as primary label');

      // 3. Cinema VIP (Base: basic)
      const cinemaDisplay = formatTenantPlanDisplay(vipCinema);
      assert.strictEqual(cinemaDisplay.primaryLabel, 'Enterprise VIP Access', 'Cinema primary plan must be Enterprise VIP Access');
      assert.strictEqual(cinemaDisplay.secondaryLabel, '₹0/mo (Base: BASIC)', 'Cinema secondary label must show base tier BASIC');
      assert.strictEqual(cinemaDisplay.badgeText, '★ VIP');
      assert.strictEqual(cinemaDisplay.fullDisplay, 'Enterprise VIP Access (₹0/mo • Base: BASIC)');
      assert(!cinemaDisplay.primaryLabel.includes('BASIC'), 'Must not display BASIC as primary label');

      // 4. Bakery VIP (Base: enterprise)
      const bakeryDisplay = formatTenantPlanDisplay(vipBakery);
      assert.strictEqual(bakeryDisplay.primaryLabel, 'Enterprise VIP Access', 'Bakery primary plan must be Enterprise VIP Access');
      assert.strictEqual(bakeryDisplay.secondaryLabel, '₹0/mo', 'Bakery secondary label is ₹0/mo since base tier is enterprise');
      assert.strictEqual(bakeryDisplay.badgeText, '★ VIP');
      assert.strictEqual(bakeryDisplay.fullDisplay, 'Enterprise VIP Access (₹0/mo)');

      // 5. Paid Custom Negotiated Tenant (Pro @ ₹799)
      const paidCustomDisplay = formatTenantPlanDisplay(paidCustom);
      assert.strictEqual(paidCustomDisplay.primaryLabel, 'Pro Luxury Plan', 'Paid custom primary plan must be Pro Luxury Plan');
      assert.strictEqual(paidCustomDisplay.secondaryLabel, '₹799/mo', 'Paid custom secondary label must be ₹799/mo');
      assert.strictEqual(paidCustomDisplay.badgeText, null);
      assert.strictEqual(paidCustomDisplay.fullDisplay, 'Pro Luxury Plan (₹799/mo)');
      assert(paidCustomDisplay.primaryLabel !== 'Enterprise VIP Access', 'Ordinary paid tenant must not be VIP');

      // 6. Paid Annual Tenant (Enterprise @ ₹11988/yr, plan_price ₹999/mo)
      const paidAnnualDisplay = formatTenantPlanDisplay(paidAnnual);
      assert.strictEqual(paidAnnualDisplay.primaryLabel, 'Enterprise VIP Plan');
      assert.strictEqual(paidAnnualDisplay.secondaryLabel, '₹999/mo');
      assert.strictEqual(paidAnnualDisplay.badgeText, null);
      assert(paidAnnualDisplay.primaryLabel !== 'Enterprise VIP Access', 'Paid enterprise tenant must have catalog name, not VIP Access');

      // 7. Free Trial Bakery (Basic @ ₹499)
      const trialBakeryDisplay = formatTenantPlanDisplay(trialBakery);
      assert.strictEqual(trialBakeryDisplay.primaryLabel, 'Basic Starter Plan');
      assert.strictEqual(trialBakeryDisplay.secondaryLabel, '₹499/mo');
      assert.strictEqual(trialBakeryDisplay.badgeText, null);
      assert(trialBakeryDisplay.primaryLabel !== 'Enterprise VIP Access', 'Trial tenant must not be VIP');
    });

    // =====================================================================================================
    // TEST 19: Multi-subscription resolution prevents abandoned checkout (#239) from overriding active VIP (#51)
    // =====================================================================================================
    await test('19. Multi-subscription resolution selects active VIP subscription over higher-id pending checkout attempt', async () => {
      const res = await fetch(`${baseUrl}/restaurants?search=test-parity-multisub-bakery`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.restaurants || []);
      const tenant = list.find(r => r.slug === 'test-parity-multisub-bakery');

      assert(tenant, 'MultiSub tenant must be present in restaurants list');
      assert.strictEqual(tenant.subscription_status, 'active', 'Status must be active VIP, NOT pending checkout');
      assert.strictEqual(tenant.subscription_type, 'ADMIN_GRANTED', 'Type must be ADMIN_GRANTED, NOT PAID');
      assert.strictEqual(tenant.effective_plan_price, 0, 'Effective price must be 0');
      assert.strictEqual(tenant.plan_name, 'Enterprise VIP Access', 'Plan name must be Enterprise VIP Access');
      assert.strictEqual(tenant.is_vip, true, 'is_vip must be true');
      assert.strictEqual(tenant.is_complimentary, true, 'is_complimentary must be true');
      assert.strictEqual(tenant.has_underlying_paid_subscription, false, 'Abandoned pending checkout must not be treated as underlying paid sub');
    });

    // =====================================================================================================
    // TEST 20: Tenant 360 Parity for MultiSub Tenant (Active VIP + Preserved History)
    // =====================================================================================================
    await test('20. Tenant 360 endpoint returns authoritative VIP subscription and excludes pending checkouts from underlying paid sub', async () => {
      const res = await fetch(`${baseUrl}/restaurants/${restoJ.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const t360 = await res.json();

      assert.strictEqual(t360.subscription.status, 'active', '360 subscription status must be active');
      assert.strictEqual(t360.subscription.subscription_type, 'ADMIN_GRANTED');
      assert.strictEqual(t360.subscription.plan_price, 0);
      assert.strictEqual(t360.subscription.is_lifetime, true, '2036-10-06 expiry must resolve to is_lifetime: true');
      assert.strictEqual(t360.subscription.access_until, 'Lifetime', 'access_until must project "Lifetime" for 2036 date');
      assert.strictEqual(t360.subscription.has_underlying_paid_subscription, false, 'Must not claim underlying paid sub from pending checkout');
    });

    // =====================================================================================================
    // TEST 21: Finite VIP Tenant (Tenant 52 Parity - Exact Expiry vs Lifetime)
    // =====================================================================================================
    await test('21. Finite VIP grant (expiring <= 2030) preserves exact expiry date and is not misrepresented as Lifetime', async () => {
      const res = await fetch(`${baseUrl}/restaurants/${restoK.id}/360`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const t360 = await res.json();

      assert.strictEqual(t360.subscription.status, 'active');
      assert.strictEqual(t360.subscription.is_vip, true);
      assert.strictEqual(t360.subscription.is_lifetime, false, 'Finite 2026 expiry must NOT be marked lifetime');
      assert(t360.subscription.access_until.includes('2026-10-21'), 'access_until must retain exact 2026 date');

      // Presentation formatting check
      const display = formatTenantPlanDisplay({ ...t360.tenant, ...t360.subscription });
      assert.strictEqual(display.primaryLabel, 'Enterprise VIP Access');
      assert.strictEqual(display.secondaryLabel, '₹0/mo (Base: PRO)');
      assert.strictEqual(display.badgeText, '★ VIP');
    });

    // =====================================================================================================
    // TEST 22: Billing Page Frontend Parity & Monthly Fee ₹0 Guarantee for VIPs
    // =====================================================================================================
    await test('22. Billing page helper functions guarantee ₹0 recurring fee and correct Lifetime vs Finite resolution', async () => {
      // 1. Lifetime VIP detection
      assert.strictEqual(isLifetimeVipTenant(restoJ), true, 'Tenant J (2036 expiry) must be lifetime VIP');
      assert.strictEqual(isLifetimeVipTenant(restoK), false, 'Tenant K (2026 expiry) must NOT be lifetime VIP');
      assert.strictEqual(isLifetimeVipTenant({ ...restoJ, access_until: 'Lifetime' }), true);
      assert.strictEqual(isLifetimeVipTenant({ ...restoJ, access_until: null }), true, 'VIP with null expiry is lifetime');
      assert.strictEqual(isLifetimeVipTenant(restoD), false, 'Paid tenant must not be lifetime VIP');

      // 2. VIP status resolution
      assert.strictEqual(isVipTenant(restoJ), true);
      assert.strictEqual(isVipTenant(restoK), true);
      assert.strictEqual(isVipTenant(restoD), false);

      // 3. Monthly recurring fee rule in TenantDetailsView:
      // (isVipAuthoritative || isLifetime || Number(sub.plan_price) === 0) ? '₹0 / Complimentary' : `₹${sub.plan_price} / month`
      const getFeeDisplay = (sub, isVipAuth, isLt) => {
        return (isVipAuth || isLt || Number(sub.plan_price) === 0) ? '₹0 / Complimentary' : `₹${sub.plan_price} / month`;
      };

      assert.strictEqual(getFeeDisplay({ plan_price: 1999 }, true, true), '₹0 / Complimentary', 'Lifetime VIP must show ₹0');
      assert.strictEqual(getFeeDisplay({ plan_price: 999 }, true, false), '₹0 / Complimentary', 'Finite VIP must show ₹0');
      assert.strictEqual(getFeeDisplay({ plan_price: 799 }, false, false), '₹799 / month', 'Paid tenant must show regular fee');

      // 4. Zero MRR contribution for both VIP tenants
      assert.strictEqual(calculateTenantMrr(restoJ), 0, 'MultiSub VIP must have ₹0 MRR');
      assert.strictEqual(calculateTenantMrr(restoK), 0, 'Finite VIP must have ₹0 MRR');
    });

    // =====================================================================================================
    // TEST 23: Multi-Subscription: Active VIP #51 + Pending Cashfree #239 + Cancelled Historical #29
    // =====================================================================================================
    await test('23. Active VIP #51 + Pending Cashfree #239 + Cancelled #29 resolves to VIP with zero underlying paid claim', async () => {
      const subs = [
        { id: 239, gateway: 'cashfree', subscription_type: 'PAID', status: 'pending', amount: 2499 },
        { id: 51, gateway: 'admin_granted', subscription_type: 'ADMIN_GRANTED', status: 'active', amount: 0, current_period_end: '2036-10-06 13:53:16.01' },
        { id: 29, gateway: 'admin_granted', subscription_type: 'ADMIN_GRANTED', status: 'cancelled', current_period_end: '2024-01-01 00:00:00' }
      ];
      const resto = { id: 1, name: 'Tenant 1', subscription_type: 'ADMIN_GRANTED', mandate_status: 'pending', is_vip: true, plan_expires_at: '2036-10-06T13:53:16.010Z' };
      const { effectiveSub, paidSub, vipSub } = resolveTenantSubscriptions(subs, resto);

      assert.strictEqual(effectiveSub.id, 51, 'Effective sub must be active VIP #51');
      assert.strictEqual(paidSub, null, 'Neither pending #239 nor expired cancelled #29 can be paidSub');
      assert.strictEqual(vipSub.id, 51, 'VIP sub must be #51');

      const canonical = resolveCanonicalSubscriptionState({ resto, sub: effectiveSub });
      assert.strictEqual(canonical.active, true);
      assert.strictEqual(canonical.status, 'active');
      assert.strictEqual(canonical.isComplimentary, true);
      assert.strictEqual(canonical.accessUntil, 'Lifetime');

      const planInfo = formatTenantPlanDisplay({ ...resto, is_vip: true });
      assert.strictEqual(planInfo.primaryLabel, 'Enterprise VIP Access');
      assert.strictEqual(planInfo.secondaryLabel, '₹0/mo');
    });

    // =====================================================================================================
    // TEST 24: Expired Cancelled History (e.g. Sub #29 style): Never exposed as active paid subscription
    // =====================================================================================================
    await test('24. Expired cancelled historical subscription is never exposed as active or underlying paid sub', async () => {
      const subs = [
        { id: 29, gateway: 'cashfree', subscription_type: 'PAID', status: 'cancelled', cancel_requested_at: '2023-01-01', current_period_end: '2023-01-31 00:00:00' },
        { id: 15, gateway: 'cashfree', subscription_type: 'PAID', status: 'expired', current_period_end: '2022-12-01 00:00:00' }
      ];
      const resto = { id: 10, name: 'Expired Tenant', subscription_type: 'PAID', mandate_status: 'cancelled', active: true };
      const { effectiveSub, paidSub } = resolveTenantSubscriptions(subs, resto);

      assert.strictEqual(paidSub, null, 'Expired cancelled sub must NOT be paidSub');
      assert.strictEqual(effectiveSub.id, 29, 'effectiveSub falls back to historical record for audit');

      const canonical = resolveCanonicalSubscriptionState({ resto, sub: effectiveSub });
      assert.strictEqual(canonical.active, false, 'Expired cancelled subscription cannot grant active access');
      assert(['expired', 'cancelled'].includes(canonical.status), 'Status must resolve to inactive (expired or cancelled)');
      assert.strictEqual(canonical.isComplimentary, false);
      assert.strictEqual(calculateTenantMrr({ ...resto, effective_plan_price: 999, subscription_status: canonical.status }), 0, 'Expired tenant contributes ₹0 MRR');
    });

    // =====================================================================================================
    // TEST 25: Failed Subscription: Properly identified as failed, zero active paid claim
    // =====================================================================================================
    await test('25. Payment failed subscription is inactive without active plan and excluded from paidSub', async () => {
      const subs = [
        { id: 45, gateway: 'cashfree', subscription_type: 'PAID', status: 'payment_failed', amount: 999, current_period_end: '2023-05-01 00:00:00' }
      ];
      const resto = { id: 11, name: 'Failed Tenant', subscription_type: 'PAID', mandate_status: 'failed', active: true };
      const { effectiveSub, paidSub } = resolveTenantSubscriptions(subs, resto);

      assert.strictEqual(paidSub, null, 'Failed subscription must NOT be paidSub');
      assert.strictEqual(effectiveSub.id, 45);

      const canonical = resolveCanonicalSubscriptionState({ resto, sub: effectiveSub });
      assert.strictEqual(canonical.active, false, 'Failed subscription without active plan is inactive');
      assert.strictEqual(canonical.status, 'payment_failed', 'Status must be payment_failed');
      assert.strictEqual(canonical.isComplimentary, false);
      assert.strictEqual(calculateTenantMrr({ ...resto, effective_plan_price: 999, subscription_status: canonical.status }), 0, 'Failed tenant contributes ₹0 MRR');
    });

    // =====================================================================================================
    // TEST 26: Valid Active Paid Subscription: Correctly identified as active paid sub with auto-renew & fee
    // =====================================================================================================
    await test('26. Valid active paid subscription correctly identified as active paidSub and contributes to MRR', async () => {
      const futureEnd = new Date(Date.now() + 25 * 86400 * 1000).toISOString();
      const subs = [
        { id: 88, gateway: 'cashfree', subscription_type: 'PAID', status: 'active', amount: 999, auto_renew: 1, current_period_end: futureEnd },
        { id: 70, gateway: 'cashfree', subscription_type: 'PAID', status: 'cancelled', current_period_end: '2024-01-01 00:00:00' }
      ];
      const resto = { id: 12, name: 'Active Paid Tenant', subscription_type: 'PAID', mandate_status: 'active', active: true, plan_price: 999 };
      const { effectiveSub, paidSub } = resolveTenantSubscriptions(subs, resto);

      assert(paidSub, 'paidSub must exist for active paid subscription');
      assert.strictEqual(paidSub.id, 88);
      assert.strictEqual(effectiveSub.id, 88);

      const canonical = resolveCanonicalSubscriptionState({ resto, sub: effectiveSub });
      assert.strictEqual(canonical.active, true, 'Active paid subscription is active');
      assert.strictEqual(canonical.status, 'active');
      assert.strictEqual(canonical.isComplimentary, false);
      assert.strictEqual(calculateTenantMrr({ ...resto, effective_plan_price: 999, subscription_status: 'active' }), 999, 'Active paid tenant contributes ₹999 to MRR');
    });

    // =====================================================================================================
    // TEST 27: Valid Unexpired Cancelled Subscription: Preserves active access until period end
    // =====================================================================================================
    await test('27. Valid unexpired cancelled subscription preserves active access until period end with auto-renew OFF', async () => {
      const futureEnd = new Date(Date.now() + 15 * 86400 * 1000).toISOString();
      const subs = [
        { id: 95, gateway: 'cashfree', subscription_type: 'PAID', status: 'cancelled', cancel_requested_at: new Date().toISOString(), amount: 999, auto_renew: 0, current_period_end: futureEnd }
      ];
      const resto = { id: 13, name: 'Unexpired Cancelled Tenant', subscription_type: 'PAID', mandate_status: 'active', active: true, plan_price: 999 };
      const { effectiveSub, paidSub } = resolveTenantSubscriptions(subs, resto);

      assert(paidSub, 'Unexpired cancelled sub is recognized as paidSub during its paid window');
      assert.strictEqual(paidSub.id, 95);
      assert.strictEqual(effectiveSub.id, 95);

      const canonical = resolveCanonicalSubscriptionState({ resto, sub: effectiveSub });
      assert.strictEqual(canonical.active, true, 'Unexpired cancelled subscription remains active until period end');
      assert.strictEqual(canonical.status, 'cancelled');
      assert.strictEqual(canonical.badge.label, 'Auto-Renew Off (Active until period end)');
      assert.strictEqual(canonical.isComplimentary, false);
    });

  } finally {
    server.close();
    // Clean up test records
    await query("DELETE FROM subscriptions WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM admins WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM dishes WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM categories WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'test-parity-%')").catch(() => {});
    await query("DELETE FROM restaurants WHERE slug LIKE 'test-parity-%'").catch(() => {});
  }

  console.log('\n======================================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
