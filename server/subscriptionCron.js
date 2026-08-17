import { query } from './db.js';

export async function checkExpiredSubscriptions() {
  try {
    const nowISO = new Date().toISOString();
    // Resolve dynamic grace period days from system_settings DB (default: 7 days)
    const graceSettingRows = await query("SELECT value FROM system_settings WHERE key = 'grace_period_days'");
    const graceDays = Math.max(0, parseInt(graceSettingRows[0]?.value || '7', 10));
    const graceThresholdISO = new Date(Date.now() - graceDays * 86400 * 1000).toISOString();
    
    // === 1. Handle cancel-requested subscriptions whose period has ended ===
    try {
      const cancelledSubs = await query(`
        SELECT s.id, s.restaurant_id, s.current_period_end, s.trial_end, s.status,
               r.trial_ends_at, r.plan_expires_at, r.name
        FROM subscriptions s
        JOIN restaurants r ON r.id = s.restaurant_id
        WHERE s.cancel_requested_at IS NOT NULL
          AND s.auto_renew = 0
          AND s.status NOT IN ('cancelled', 'expired')
      `);

      for (const sub of (cancelledSubs || [])) {
        const periodEnd = sub.current_period_end || sub.trial_end || sub.trial_ends_at || sub.plan_expires_at;
        if (periodEnd && new Date(periodEnd) < new Date()) {
          await query("UPDATE subscriptions SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP) WHERE id = $1", [sub.id]);
          await query('UPDATE restaurants SET active = false WHERE id = $1', [sub.restaurant_id]);
          console.log(`🔒 Cancel-requested subscription expired for: ${sub.name} (ID: ${sub.restaurant_id})`);
        }
      }
    } catch (e) { console.warn('Cron cancel-requested check error:', e.message); }

    // === 2. Handle scheduled plan changes whose effective date has passed ===
    try {
      const scheduledChanges = await query(`
        SELECT s.id, s.restaurant_id, s.scheduled_plan_key, s.plan_change_effective_at, r.name
        FROM subscriptions s
        JOIN restaurants r ON r.id = s.restaurant_id
        WHERE s.scheduled_plan_key IS NOT NULL
          AND s.plan_change_effective_at IS NOT NULL
          AND s.plan_change_effective_at <= $1
          AND s.status IN ('active', 'trialing')
      `, [nowISO]);

      for (const sub of (scheduledChanges || [])) {
        const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [sub.scheduled_plan_key.toLowerCase()]);
        const newPlan = planRows[0];
        if (newPlan) {
          await query(
            `UPDATE subscriptions SET plan_id = $1, amount = $2, scheduled_plan_key = NULL, scheduled_plan_id = NULL, plan_change_effective_at = NULL, updated_at = $3 WHERE id = $4`,
            [newPlan.id, Number(newPlan.price), nowISO, sub.id]
          );
          await query(
            `UPDATE restaurants SET plan_tier = $1, plan_price = $2 WHERE id = $3`,
            [newPlan.key, Number(newPlan.price), sub.restaurant_id]
          );
          console.log(`📋 Scheduled plan change activated: ${sub.name} (ID: ${sub.restaurant_id}) → ${newPlan.key} (₹${newPlan.price})`);
        }
      }
    } catch (e) { console.warn('Cron scheduled plan change error:', e.message); }

    // === 3. Expire subscriptions beyond grace period ===
    const expiredRestos = await query(`
      SELECT r.id, r.name, r.slug, r.plan_expires_at, r.trial_ends_at
      FROM restaurants r
      WHERE (r.active IS TRUE OR r.active = TRUE OR r.active = 1)
        AND (r.mandate_status IS NULL OR r.mandate_status != 'admin_granted')
        AND (r.subscription_type IS NULL OR r.subscription_type != 'ADMIN_GRANTED')
        AND (r.trial_ends_at IS NULL OR r.trial_ends_at < $1)
        AND (r.plan_expires_at IS NULL OR r.plan_expires_at < $1)
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.restaurant_id = r.id
            AND (
              (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end >= $2))
              OR (s.cancel_requested_at IS NOT NULL AND s.current_period_end IS NOT NULL AND s.current_period_end >= $2)
              OR (s.status = 'trialing' AND s.trial_end IS NOT NULL AND s.trial_end >= $2)
            )
        )
    `, [graceThresholdISO, nowISO]);

    if (expiredRestos && expiredRestos.length > 0) {
      console.log(`⏰ Found ${expiredRestos.length} expired restaurant subscription(s) beyond grace period. Updating status to expired...`);

      for (const resto of expiredRestos) {
        await query('UPDATE restaurants SET active = false WHERE id = $1', [resto.id]);
        await query("UPDATE subscriptions SET status = 'expired' WHERE restaurant_id = $1 AND status IN ('trialing', 'active', 'payment_failed')", [resto.id]);
        console.log(`🔒 Subscription expired & status updated to expired for restaurant: ${resto.name} (ID: ${resto.id})`);
      }
    }

    // === 4. Status-based cleanup for abandoned pending registrations > 24 hours old ===
    try {
      const dayAgoISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      await query(`
        UPDATE pending_registrations
        SET status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE status IN ('pending', 'checkout_started', 'authorization_pending')
          AND created_at < $1
      `, [dayAgoISO]);
    } catch (e) { console.warn('Cron pending registrations cleanup notice:', e.message); }
  } catch (err) {
    console.error('Subscription cron error:', err.message);
  }
}

// Run check immediately on start and repeat every 1 hour
export function startSubscriptionCron() {
  checkExpiredSubscriptions();
  setInterval(checkExpiredSubscriptions, 60 * 60 * 1000);
}
