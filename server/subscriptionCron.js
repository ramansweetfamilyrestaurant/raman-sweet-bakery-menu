import { query } from './db.js';

export async function checkExpiredSubscriptions() {
  try {
    const expiredRestos = await query(`
      SELECT id, name, slug, plan_expires_at
      FROM restaurants
      WHERE active = true AND plan_expires_at IS NOT NULL AND plan_expires_at < CURRENT_TIMESTAMP
    `);

    if (expiredRestos && expiredRestos.length > 0) {
      console.log(`⏰ Found ${expiredRestos.length} expired restaurant subscription(s). Deactivating...`);

      for (const resto of expiredRestos) {
        await query('UPDATE restaurants SET active = false WHERE id = $1', [resto.id]);
        console.log(`🔒 Subscription expired & deactivated for restaurant: ${resto.name} (Slug: ${resto.slug})`);
      }
    }
  } catch (err) {
    console.error('Subscription cron error:', err);
  }
}

// Run check immediately on start and repeat every 1 hour
export function startSubscriptionCron() {
  checkExpiredSubscriptions();
  setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);
}
