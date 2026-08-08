import { query } from './db.js';

export async function checkExpiredSubscriptions() {
  try {
    const nowISO = new Date().toISOString();
    // 7-day grace period threshold (7 * 86400 * 1000 ms)
    const graceThresholdISO = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    
    // Select restaurants where trial AND plan expiry have both passed grace threshold
    const expiredRestos = await query(`
      SELECT id, name, slug, plan_expires_at, trial_ends_at
      FROM restaurants
      WHERE (active = 1 OR active = true)
        AND (
          (plan_expires_at IS NOT NULL AND plan_expires_at < $1)
          OR (trial_ends_at IS NOT NULL AND trial_ends_at < $1)
        )
    `, [graceThresholdISO]);

    if (expiredRestos && expiredRestos.length > 0) {
      console.log(`⏰ Found ${expiredRestos.length} expired restaurant subscription(s) beyond grace period. Updating status to expired...`);

      for (const resto of expiredRestos) {
        await query('UPDATE restaurants SET active = 0 WHERE id = $1', [resto.id]);
        await query("UPDATE subscriptions SET status = 'expired' WHERE restaurant_id = $1 AND status IN ('trialing', 'active', 'payment_failed')", [resto.id]);
        console.log(`🔒 Subscription expired & status updated to expired for restaurant: ${resto.name} (ID: ${resto.id})`);
      }
    }
  } catch (err) {
    console.error('Subscription cron error:', err.message);
  }
}

// Run check immediately on start and repeat every 1 hour
export function startSubscriptionCron() {
  checkExpiredSubscriptions();
  setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);
}
