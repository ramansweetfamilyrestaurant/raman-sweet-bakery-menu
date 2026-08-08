import { query } from '../server/db.js';

async function checkRestos() {
  try {
    const restos = await query("SELECT id, name, slug, plan_tier, plan_expires_at, trial_started_at, trial_ends_at, active FROM restaurants");
    console.log('RESTOS:', restos);
    const subs = await query("SELECT * FROM subscriptions");
    console.log('SUBS:', subs);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkRestos();
