import express from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createCashfreeSubscriptionSession, getCashfreeConfig } from '../services/cashfree.js';

const router = express.Router();

// Helper to log payment audit trail
async function logPaymentAudit(restaurantId, action, details) {
  try {
    await query(
      'INSERT INTO audit_logs (restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4)',
      [restaurantId || null, 'payment_gateway', action, typeof details === 'object' ? JSON.stringify(details) : String(details)]
    );
  } catch (err) {
    console.warn('Audit log write error:', err.message);
  }
}

// GET /api/payment/config-status (Backend status check for Cashfree Sandbox)
router.get('/config-status', (req, res) => {
  const config = getCashfreeConfig();
  res.json({
    configured: config.isConfigured,
    environment: config.environment,
    is_sandbox: config.isSandbox,
    client_id_present: Boolean(config.clientId)
  });
});

// ==========================================
// 1. CREATE CASHFREE SANDBOX SUBSCRIPTION
// ==========================================
const handleCreateSubscription = async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required for subscription setup' });
    }
    const targetRestoId = restoId || 1;

    const { plan_tier, return_url } = req.body;
    const requestedPlanKey = (plan_tier || 'pro').toLowerCase().trim();

    // 1. Authoritative Plan Resolution from Database saas_plans Table
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [requestedPlanKey]);
    const dbPlan = planRows[0] || {
      id: 2,
      key: 'pro',
      name: 'Pro Luxury Plan',
      price: 999
    };

    // Fetch Restaurant & Owner Details from DB
    const restoRows = await query('SELECT id, name, phone, slug FROM restaurants WHERE id = $1', [targetRestoId]);
    const resto = restoRows[0] || { id: targetRestoId, name: `Restaurant ${targetRestoId}`, phone: '9876543210', slug: 'demo' };

    // 2. Duplicate Subscription Protection: Reuse existing pending/trialing Cashfree subscription if valid
    const existingSubRows = await query(`
      SELECT * FROM subscriptions 
      WHERE restaurant_id = $1 AND gateway = 'cashfree' AND gateway_subscription_id IS NOT NULL AND status IN ('pending', 'trialing')
      ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);

    if (existingSubRows && existingSubRows.length > 0) {
      const existingSub = existingSubRows[0];
      const config = getCashfreeConfig();
      console.log(`♻️ Found existing Cashfree subscription (${existingSub.gateway_subscription_id}) for restaurant ${targetRestoId}. Reusing.`);

      return res.json({
        success: true,
        reused: true,
        configured: config.isConfigured,
        subscription_id: existingSub.gateway_subscription_id,
        customer_id: existingSub.gateway_customer_id,
        sub_status: existingSub.status,
        payment_session_id: null,
        auth_link: null,
        is_sandbox: config.isSandbox,
        plan: {
          id: dbPlan.id,
          key: dbPlan.key,
          name: dbPlan.name,
          price: Number(dbPlan.price)
        },
        message: 'Existing subscription session retrieved successfully.'
      });
    }

    // 3. Call Cashfree Sandbox Client Service
    const cfResult = await createCashfreeSubscriptionSession({
      restaurantId: targetRestoId,
      planKey: dbPlan.key,
      planName: dbPlan.name,
      planPrice: dbPlan.price,
      customerName: resto.name,
      customerPhone: resto.phone,
      returnUrl: return_url || `https://khanamaster.com/${resto.slug}/admin`
    });

    if (!cfResult.configured) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: 'CASHFREE_SANDBOX_CREDENTIALS_MISSING',
        message: 'Cashfree Sandbox API keys (CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET) are not configured in backend environment.'
      });
    }

    if (!cfResult.success) {
      return res.status(400).json({
        success: false,
        configured: true,
        error: cfResult.error || 'CASHFREE_CREATION_FAILED',
        message: cfResult.message || 'Failed to create Cashfree Sandbox subscription.'
      });
    }

    // 4. Store Real Gateway Identifiers in Database `subscriptions` Table
    const nowISO = new Date().toISOString();
    await query(`
      INSERT INTO subscriptions (
        restaurant_id, plan_id, gateway, gateway_subscription_id, gateway_customer_id, status, amount, currency, billing_cycle, trial_start
      ) VALUES ($1, $2, 'cashfree', $3, $4, 'pending', $5, 'INR', 'monthly', $6)
    `, [
      targetRestoId,
      dbPlan.id || 2,
      cfResult.subscription_id,
      cfResult.customer_id,
      Number(dbPlan.price),
      nowISO
    ]);

    // Update `restaurants` table mandate references
    await query(`
      UPDATE restaurants SET mandate_id = $1, mandate_status = 'pending' WHERE id = $2
    `, [cfResult.subscription_id, targetRestoId]);

    await logPaymentAudit(targetRestoId, 'CASHFREE_SANDBOX_SUB_CREATED', {
      subscription_id: cfResult.subscription_id,
      plan_key: dbPlan.key,
      amount: dbPlan.price
    });

    res.json({
      success: true,
      configured: true,
      subscription_id: cfResult.subscription_id,
      customer_id: cfResult.customer_id,
      payment_session_id: cfResult.payment_session_id,
      auth_link: cfResult.auth_link,
      is_sandbox: cfResult.is_sandbox,
      plan: {
        id: dbPlan.id,
        key: dbPlan.key,
        name: dbPlan.name,
        price: Number(dbPlan.price)
      },
      message: 'Cashfree Sandbox subscription created successfully.'
    });
  } catch (err) {
    console.error('Create Cashfree subscription error:', err);
    res.status(500).json({ error: 'Internal server error while creating subscription' });
  }
};

router.post('/create-subscription', authenticateToken, handleCreateSubscription);
router.post('/create-mandate', authenticateToken, handleCreateSubscription);
router.post('/create-order', authenticateToken, handleCreateSubscription);

// ==========================================
// 2. CASHFREE WEBHOOK HANDLER (Reserved for Phase 2B)
// ==========================================
router.post('/cashfree', async (req, res) => {
  try {
    const payload = req.body;
    console.log('💳 Received Cashfree Webhook:', JSON.stringify(payload));
    res.status(200).json({ status: 'OK', note: 'Cashfree full webhook processing reserved for Phase 2B' });
  } catch (err) {
    console.error('Cashfree Webhook Error:', err);
    res.status(200).json({ status: 'OK', note: 'Handled safely' });
  }
});

// ==========================================
// 3. CANCEL MANDATE
// ==========================================
router.post('/cancel-mandate', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const targetRestoId = restoId || 1;

    await query(
      "UPDATE restaurants SET auto_debit_enabled = 0, mandate_status = 'cancelled' WHERE id = $1",
      [targetRestoId]
    );

    await query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE restaurant_id = $1 AND status IN ('trialing', 'pending', 'active')",
      [targetRestoId]
    );

    await logPaymentAudit(targetRestoId, 'Mandate Cancelled', { message: 'Autopay mandate cancelled by owner' });

    res.json({
      success: true,
      message: 'Autopay mandate cancelled successfully.'
    });
  } catch (err) {
    console.error('Cancel mandate error:', err);
    res.status(500).json({ error: 'Failed to cancel mandate' });
  }
});

export default router;
