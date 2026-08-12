import { query, initDb } from '../server/db.js';

async function check() {
  try {
    await initDb();
    const plans = await query('SELECT key, name, google_reviews_enabled FROM saas_plans');
    console.log('SAAS PLANS IN DB:', JSON.stringify(plans, null, 2));
    const restos = await query('SELECT id, name, slug, plan_tier FROM restaurants');
    console.log('RESTAURANTS IN DB:', JSON.stringify(restos, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
check();
