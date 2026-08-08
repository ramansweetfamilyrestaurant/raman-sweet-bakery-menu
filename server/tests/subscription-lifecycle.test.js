import assert from 'assert';
import { query, initDb } from '../db.js';
import { checkSubscriptionStatus } from '../middleware/auth.js';
import { checkExpiredSubscriptions } from '../subscriptionCron.js';

console.log('🧪 Starting Phase 4 Subscription Lifecycle Test Suite...');

async function runTests() {
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

  // Ensure DB initialized
  await initDb();

  // Test 1: Database Migration Audit & Column Existence
  await test('1. Database Migration: New columns exist on subscriptions table', async () => {
    const rows = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'subscriptions'
    `).catch(async () => {
      // SQLite fallback: PRAGMA table_info
      const pragma = await query("PRAGMA table_info('subscriptions')");
      return pragma.map(p => ({ column_name: p.name }));
    });

    const colNames = rows.map(r => r.column_name || r.name);
    assert(colNames.includes('cancel_requested_at'), 'Missing cancel_requested_at column');
    assert(colNames.includes('auto_renew'), 'Missing auto_renew column');
    assert(colNames.includes('scheduled_plan_key'), 'Missing scheduled_plan_key column');
    assert(colNames.includes('plan_change_effective_at'), 'Missing plan_change_effective_at column');
  });

  // Test 2: Pre-migration data safety / counts intact
  await test('2. Data Safety: Restaurants and subscriptions count accessible', async () => {
    const restos = await query('SELECT COUNT(*) as count FROM restaurants');
    const subs = await query('SELECT COUNT(*) as count FROM subscriptions');
    assert(Number(restos[0].count) >= 0, 'Restaurants count error');
    assert(Number(subs[0].count) >= 0, 'Subscriptions count error');
  });

  // Test 3: Plan price resolution from saas_plans (authoritative)
  await test('3. Authoritative Pricing: saas_plans prices basic=499, pro=999, enterprise=1999', async () => {
    const plans = await query('SELECT key, price FROM saas_plans');
    const planMap = {};
    plans.forEach(p => { planMap[p.key.toLowerCase()] = Number(p.price); });
    assert.strictEqual(planMap.basic, 499, 'Basic plan price must be 499');
    assert.strictEqual(planMap.pro, 999, 'Pro plan price must be 999');
    assert.strictEqual(planMap.enterprise, 1999, 'Enterprise plan price must be 1999');
  });

  // Test 4: Auth middleware treats cancel-requested with future period as active
  await test('4. Cancellation Business Rule: cancel_requested with future period stays active', async () => {
    // Create temporary test restaurant & subscription
    const now = new Date();
    const futureDate = new Date(now.getTime() + 15 * 86400 * 1000).toISOString();

    const testResto = await query(`
      INSERT INTO restaurants (name, slug, active, mandate_status)
      VALUES ('Test Resto Cancel', 'test-resto-cancel-${Date.now()}', 1, 'cancelled')
      RETURNING id
    `).catch(async () => {
      await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Test Resto Cancel', 'test-resto-cancel-${Date.now()}', 1, 'cancelled')`);
      return await query("SELECT id FROM restaurants WHERE name = 'Test Resto Cancel' ORDER BY id DESC LIMIT 1");
    });

    const restoId = testResto[0].id;

    await query(`
      INSERT INTO subscriptions (restaurant_id, status, cancel_requested_at, auto_renew, current_period_end)
      VALUES ($1, 'active', $2, 0, $3)
    `, [restoId, now.toISOString(), futureDate]);

    const statusObj = await checkSubscriptionStatus(restoId);
    assert.strictEqual(statusObj.status, 'active', 'Subscription must remain ACTIVE during active period even if cancel_requested_at is set');
    assert.strictEqual(statusObj.active, true, 'Tenant must remain active');

    await query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restoId]);
    await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
  });

  // Test 5: Cron cancels subscription ONLY when current period has expired
  await test('5. Cron Logic: Expire cancel-requested subscription only after period end', async () => {
    const now = new Date();
    const pastPeriodEnd = new Date(now.getTime() - 1 * 86400 * 1000).toISOString();

    const testResto = await query(`
      INSERT INTO restaurants (name, slug, active, mandate_status)
      VALUES ('Test Cron Expire', 'test-cron-expire-${Date.now()}', 1, 'cancelled')
      RETURNING id
    `).catch(async () => {
      await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Test Cron Expire', 'test-cron-expire-${Date.now()}', 1, 'cancelled')`);
      return await query("SELECT id FROM restaurants WHERE name = 'Test Cron Expire' ORDER BY id DESC LIMIT 1");
    });

    const restoId = testResto[0].id;

    await query(`
      INSERT INTO subscriptions (restaurant_id, status, cancel_requested_at, auto_renew, current_period_end)
      VALUES ($1, 'active', $2, 0, $3)
    `, [restoId, pastPeriodEnd, pastPeriodEnd]);

    await checkExpiredSubscriptions();

    const subRows = await query('SELECT status FROM subscriptions WHERE restaurant_id = $1', [restoId]);
    const restoRows = await query('SELECT active FROM restaurants WHERE id = $1', [restoId]);

    assert.strictEqual(subRows[0].status, 'cancelled', 'Subscription status should be updated to cancelled after period end');
    assert(restoRows[0].active === 0 || restoRows[0].active === false, 'Restaurant active flag should be set to 0');

    await query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restoId]);
    await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
  });

  // Test 6: Scheduled plan change activation in cron
  await test('6. Cron Logic: Scheduled plan change activates when effective date passed', async () => {
    const now = new Date();
    const pastEffective = new Date(now.getTime() - 1 * 86400 * 1000).toISOString();

    const testResto = await query(`
      INSERT INTO restaurants (name, slug, plan_tier, plan_price, active)
      VALUES ('Test Plan Change', 'test-plan-change-${Date.now()}', 'basic', 499, 1)
      RETURNING id
    `).catch(async () => {
      await query(`INSERT INTO restaurants (name, slug, plan_tier, plan_price, active) VALUES ('Test Plan Change', 'test-plan-change-${Date.now()}', 'basic', 499, 1)`);
      return await query("SELECT id FROM restaurants WHERE name = 'Test Plan Change' ORDER BY id DESC LIMIT 1");
    });

    const restoId = testResto[0].id;

    await query(`
      INSERT INTO subscriptions (restaurant_id, status, scheduled_plan_key, plan_change_effective_at, amount)
      VALUES ($1, 'active', 'pro', $2, 499)
    `, [restoId, pastEffective]);

    await checkExpiredSubscriptions();

    const restoRows = await query('SELECT plan_tier, plan_price FROM restaurants WHERE id = $1', [restoId]);
    const subRows = await query('SELECT scheduled_plan_key, amount FROM subscriptions WHERE restaurant_id = $1', [restoId]);

    assert.strictEqual(restoRows[0].plan_tier, 'pro', 'Restaurant plan_tier should be updated to pro');
    assert.strictEqual(Number(restoRows[0].plan_price), 999, 'Restaurant plan_price should be updated to 999');
    assert.strictEqual(subRows[0].scheduled_plan_key, null, 'scheduled_plan_key should be cleared after activation');
    assert.strictEqual(Number(subRows[0].amount), 999, 'Subscription amount should be updated to 999');

    await query('DELETE FROM subscriptions WHERE restaurant_id = $1', [restoId]);
    await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
  });

  console.log(`\n========================================`);
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
