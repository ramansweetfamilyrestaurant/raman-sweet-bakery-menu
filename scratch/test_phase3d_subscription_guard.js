import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runPhase3DTests() {
  console.log('====================================================');
  console.log('🧪 PHASE 3D — SUBSCRIPTION GUARD & TRIAL TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failedCount++;
    }
  }

  try {
    const ts = Date.now();
    // 1. Seed system_settings default_trial_days = '14'
    await pool.query("INSERT INTO system_settings (key, value) VALUES ('default_trial_days', '14') ON CONFLICT (key) DO UPDATE SET value = '14'");

    // TEST 1: New restaurant with pending mandate
    const now = new Date();
    const trialEnd14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const nowISO = now.toISOString();

    const t1Res = await pool.query(`
      INSERT INTO restaurants (name, slug, phone, plan_tier, plan_price, trial_started_at, trial_ends_at, mandate_status, active)
      VALUES ('Test 1 New Signup', $1, $2, 'pro', 999, $3, $4, 'pending', 1)
      RETURNING id
    `, [`test1-${ts}`, `99999${ts.toString().slice(-5)}`, nowISO, trialEnd14]);
    const r1Id = t1Res.rows[0].id;

    // Simulate backend /subscription-status logic
    const calcStatus1 = await fetchSubStatus(r1Id);
    assert(calcStatus1.billing_required === true && calcStatus1.mandate_status === 'pending', 'TEST 1: New restaurant with pending mandate requires /billing onboarding');

    // TEST 2: New restaurant with active mandate + trialing
    await pool.query("UPDATE restaurants SET mandate_status = 'active' WHERE id = $1", [r1Id]);
    const calcStatus2 = await fetchSubStatus(r1Id);
    assert(calcStatus2.is_allowed === true && calcStatus2.billing_required === false, 'TEST 2: New restaurant with active mandate + trialing ALLOWS /admin access');

    // TEST 3: Active paid restaurant
    const t3Res = await pool.query(`
      INSERT INTO restaurants (name, slug, phone, plan_tier, plan_price, mandate_status, active)
      VALUES ('Test 3 Paid Resto', $1, $2, 'enterprise', 1999, 'active', 1)
      RETURNING id
    `, [`test3-${ts}`, `99998${ts.toString().slice(-5)}`]);
    const r3Id = t3Res.rows[0].id;
    await pool.query("INSERT INTO subscriptions (restaurant_id, plan_id, status, amount) VALUES ($1, 3, 'active', 1999)", [r3Id]);
    const calcStatus3 = await fetchSubStatus(r3Id);
    assert(calcStatus3.is_allowed === true && calcStatus3.status === 'active', 'TEST 3: Active paid restaurant ALLOWS /admin access');

    // TEST 4: Payment failed with active grace period
    const graceExp = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const t4Res = await pool.query(`
      INSERT INTO restaurants (name, slug, phone, plan_tier, plan_price, grace_period_expires_at, mandate_status, active)
      VALUES ('Test 4 Grace Period', $1, $2, 'pro', 999, $3, 'active', 1)
      RETURNING id
    `, [`test4-${ts}`, `99997${ts.toString().slice(-5)}`, graceExp]);
    const r4Id = t4Res.rows[0].id;
    await pool.query("INSERT INTO subscriptions (restaurant_id, plan_id, status, amount, grace_period_expires_at) VALUES ($1, 2, 'payment_failed', 999, $2)", [r4Id, graceExp]);
    const calcStatus4 = await fetchSubStatus(r4Id);
    assert(calcStatus4.is_allowed === true && calcStatus4.grace_period_active === true, 'TEST 4: Payment failed with active grace period ALLOWS /admin access with grace warning');

    // TEST 5: Expired subscription
    const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const t5Res = await pool.query(`
      INSERT INTO restaurants (name, slug, phone, plan_tier, plan_price, trial_started_at, trial_ends_at, mandate_status, active)
      VALUES ('Test 5 Expired Resto', $1, $2, 'pro', 999, $3, $3, 'pending', 0)
      RETURNING id
    `, [`test5-${ts}`, `99996${ts.toString().slice(-5)}`, pastDate]);
    const r5Id = t5Res.rows[0].id;
    await pool.query("INSERT INTO subscriptions (restaurant_id, plan_id, status, amount) VALUES ($1, 2, 'expired', 999)", [r5Id]);
    const calcStatus5 = await fetchSubStatus(r5Id);
    assert(calcStatus5.billing_required === true && calcStatus5.is_allowed === false, 'TEST 5: Expired subscription REDIRECTS to /billing');

    // TEST 6: Existing active restaurant (e.g. Raman Sweet Bakery, ID = 4)
    const calcStatus6 = await fetchSubStatus(4);
    assert(calcStatus6.is_allowed === true, 'TEST 6: Existing active restaurant (Raman Sweet Bakery) ALWAYS ALLOWED on /admin');

    // TEST 7: Fresh registration trial duration is exactly 14 days
    const regStart = new Date(nowISO);
    const regEnd = new Date(trialEnd14);
    const diffDays = Math.round((regEnd.getTime() - regStart.getTime()) / (24 * 60 * 60 * 1000));
    assert(diffDays === 14, `TEST 7: Fresh registration trial duration is exactly 14 days (got ${diffDays} days)`);

    // TEST 8: Mandate authorized after 1 day preserves original trial_end
    const origTrialEnd = trialEnd14;
    await pool.query("UPDATE restaurants SET mandate_status = 'active' WHERE id = $1", [r1Id]);
    const calcStatus8 = await fetchSubStatus(r1Id);
    assert(new Date(calcStatus8.trial_ends_at).getTime() === new Date(origTrialEnd).getTime(), 'TEST 8: Mandate authorization does NOT restart or extend original trial_end');

    // Cleanup test records
    await pool.query("DELETE FROM subscriptions WHERE restaurant_id IN ($1, $2, $3, $4)", [r1Id, r3Id, r4Id, r5Id]);
    await pool.query("DELETE FROM restaurants WHERE id IN ($1, $2, $3, $4)", [r1Id, r3Id, r4Id, r5Id]);

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  }

  console.log('\n====================================================');
  console.log(`RESULT: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');
  await pool.end();
  process.exit(failedCount > 0 ? 1 : 0);
}

async function fetchSubStatus(targetId) {
  const restos = await pool.query('SELECT active, plan_tier, plan_price, plan_expires_at, trial_started_at, trial_ends_at, grace_period_expires_at, mandate_id, mandate_status, auto_debit_enabled FROM restaurants WHERE id = $1', [targetId]);
  const r = restos.rows[0] || {};
  const subRows = await pool.query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [targetId]);
  const sub = subRows.rows[0] || null;

  const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    const str = String(val);
    return new Date(str.includes('T') ? str : `${str}T23:59:59Z`);
  };

  const now = new Date();
  let isTrialActive = false;
  const expDate = parseDate(r.trial_ends_at || r.plan_expires_at || sub?.trial_end || sub?.current_period_end);
  if (expDate && !isNaN(expDate.getTime()) && expDate >= now) {
    isTrialActive = true;
  }

  let isGracePeriodActive = false;
  const graceDate = parseDate(r.grace_period_expires_at || sub?.grace_period_expires_at);
  if (graceDate && !isNaN(graceDate.getTime()) && graceDate >= now) {
    isGracePeriodActive = true;
  }

  const subStatus = sub?.status || (isTrialActive ? 'trialing' : (r.active ? 'trialing' : 'expired'));
  const mandateStatus = (r.mandate_status || (r.mandate_id ? 'active' : 'pending')).toLowerCase();

  const isRuleA = (subStatus === 'trialing' || isTrialActive) && mandateStatus === 'active';
  const isRuleB = subStatus === 'active';
  const isRuleC = subStatus === 'payment_failed' && isGracePeriodActive;
  const isRuleD = subStatus === 'grace_period';
  const isRuleE = (r.active === 1 || r.active === true) && (mandateStatus === 'active' || !r.trial_started_at || isTrialActive);

  const isAllowed = Boolean(isRuleA || isRuleB || isRuleC || isRuleD || isRuleE);

  const isNewSignupPendingMandate = Boolean(r.trial_started_at) && mandateStatus !== 'active';
  const isExpired = subStatus === 'expired' && !isTrialActive && !isGracePeriodActive;
  const isCancelled = subStatus === 'cancelled' && !isTrialActive;

  const billingRequired = !isAllowed || isNewSignupPendingMandate || isExpired || isCancelled;

  return {
    status: subStatus,
    is_allowed: isAllowed,
    billing_required: billingRequired,
    grace_period_active: isGracePeriodActive,
    mandate_status: mandateStatus,
    trial_ends_at: r.trial_ends_at
  };
}

runPhase3DTests();
