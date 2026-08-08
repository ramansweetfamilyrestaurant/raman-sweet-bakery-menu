import { query, initDb } from '../server/db.js';

async function checkAdmin7() {
  try {
    await initDb();
    console.log('=== ALL RESTAURANTS ===');
    const restos = await query("SELECT id, name, slug, plan_tier, plan_expires_at, trial_started_at, trial_ends_at, active FROM restaurants");
    console.log(JSON.stringify(restos, null, 2));

    console.log('=== ALL SUBSCRIPTIONS ===');
    const subs = await query("SELECT * FROM subscriptions");
    console.log(JSON.stringify(subs, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Check Error:', err);
    process.exit(1);
  }
}

checkAdmin7();
