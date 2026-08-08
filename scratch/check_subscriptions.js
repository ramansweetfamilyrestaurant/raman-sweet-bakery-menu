import { query, initDb } from '../server/db.js';

async function checkSubscriptionsData() {
  try {
    await initDb();
    console.log('=== RESTAURANTS TABLE ===');
    const restos = await query("SELECT id, name, slug, plan_tier, plan_expires_at, trial_started_at, trial_ends_at, active FROM restaurants");
    console.log(JSON.stringify(restos, null, 2));

    console.log('\n=== SUBSCRIPTIONS TABLE ===');
    const subs = await query("SELECT * FROM subscriptions");
    console.log(JSON.stringify(subs, null, 2));

    console.log('\n=== SAAS PLANS TABLE ===');
    const plans = await query("SELECT * FROM saas_plans");
    console.log(JSON.stringify(plans, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Check Error:', err);
    process.exit(1);
  }
}

checkSubscriptionsData();
