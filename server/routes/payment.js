import express from 'express';
import { query, withTransaction } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createCashfreeSubscriptionSession, fetchCashfreeSubscriptionStatus, getCashfreeConfig, getCashfreeConfigAsync, verifyCashfreeWebhookSignature } from '../services/cashfree.js';

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
router.get('/config-status', async (req, res) => {
  const config = await getCashfreeConfigAsync();
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

    const { plan_tier, coupon_code, return_url } = req.body;
    const requestedPlanKey = (plan_tier || 'pro').toLowerCase().trim();

    // 1. Authoritative Plan Resolution from Database saas_plans Table
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [requestedPlanKey]);
    const dbPlan = planRows[0] || {
      id: 2,
      key: 'pro',
      name: 'Pro Luxury Plan',
      price: 999
    };

    const originalPrice = Number(dbPlan.price) || 999;
    let finalFirstPrice = originalPrice;
    let validatedCoupon = null;

    if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim()) {
      const normCode = coupon_code.trim().toUpperCase();
      const cRows = await query(`
        SELECT * FROM coupons WHERE UPPER(code) = $1
      `, [normCode]);
      if (cRows && cRows.length > 0) {
        const c = cRows[0];
        const isActive = Boolean(c.is_active !== undefined ? c.is_active : (c.active !== undefined ? c.active : true));
        if (isActive) {
          const type = (c.discount_type || 'PERCENTAGE').toUpperCase();
          const val = Number(c.discount_value || c.discount_percent || c.discount_amount || 0);
          let discount = 0;
          if (type === 'PERCENTAGE') {
            discount = (originalPrice * Math.min(100, Math.max(0, val))) / 100;
          } else {
            discount = Math.min(originalPrice, Math.max(0, val));
          }
          finalFirstPrice = Math.max(0, originalPrice - discount);
          validatedCoupon = {
            id: c.id,
            code: c.code,
            discount_type: type,
            discount_value: val,
            discount_amount: discount,
            final_first_payment_amount: finalFirstPrice
          };
        }
      }
    }

    // Fetch Restaurant & Owner Details from DB
    const restoRows = await query('SELECT id, name, phone, slug FROM restaurants WHERE id = $1', [targetRestoId]);
    const resto = restoRows[0] || { id: targetRestoId, name: `Restaurant ${targetRestoId}`, phone: '9876543210', slug: 'demo' };

    // Fetch active trial end from database for subscription_first_charge_time alignment
    const subTrailRows = await query(`
      SELECT trial_end FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);
    const trialEndISO = subTrailRows[0]?.trial_end || new Date(Date.now() + 14 * 86400 * 1000).toISOString();

    // 2. Call Cashfree Sandbox Client Service (v2026-01-01) with discounted first payment price
    const cfResult = await createCashfreeSubscriptionSession({
      restaurantId: targetRestoId,
      planKey: dbPlan.key,
      planName: dbPlan.name,
      planPrice: finalFirstPrice,
      trialEndISO,
      customerName: resto.name,
      customerPhone: resto.phone,
      returnUrl: return_url || `${process.env.APP_BASE_URL || 'https://khana-master.onrender.com'}/api/payment/subscription-return`
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

    // 4. Store/Update Real Gateway Identifiers in Database `subscriptions` Table
    const nowISO = new Date().toISOString();
    const existingSubRows = await query(`
      SELECT id FROM subscriptions 
      WHERE restaurant_id = $1 AND gateway = 'cashfree' AND status IN ('pending', 'trialing')
      ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);

    if (existingSubRows && existingSubRows.length > 0) {
      await query(`
        UPDATE subscriptions 
        SET gateway_subscription_id = $1, gateway_customer_id = $2, plan_id = $3, amount = $4
        WHERE id = $5
      `, [cfResult.subscription_id, cfResult.customer_id, dbPlan.id || 2, Number(dbPlan.price), existingSubRows[0].id]);
    } else {
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
    }

    // Update `restaurants` table mandate references
    await query(`
      UPDATE restaurants SET mandate_id = $1, mandate_status = 'pending' WHERE id = $2
    `, [cfResult.subscription_id, targetRestoId]);

    await logPaymentAudit(targetRestoId, 'CASHFREE_SANDBOX_SUB_CREATED', {
      subscription_id: cfResult.subscription_id,
      customer_id: cfResult.customer_id,
      plan_key: dbPlan.key,
      amount: dbPlan.price
    });

    res.json({
      success: true,
      configured: true,
      subscription_id: cfResult.subscription_id,
      subscription_session_id: cfResult.subscription_session_id,
      customer_id: cfResult.customer_id,
      auth_link: cfResult.auth_link,
      subscription_status: cfResult.subscription_status || 'INITIALIZED',
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

// ==========================================
// 2. SERVER-SIDE SUBSCRIPTION VERIFICATION
// ==========================================
router.get('/verify-subscription', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    const subscriptionId = req.query.subscription_id;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscription_id parameter is required' });
    }

    const cfStatus = await fetchCashfreeSubscriptionStatus(subscriptionId);

    if (!cfStatus.success) {
      return res.status(400).json(cfStatus);
    }

    const isAuthorized = cfStatus.subscription_status === 'ACTIVE';

    if (restoId && isAuthorized) {
      await query(`
        UPDATE restaurants SET mandate_id = $1, mandate_status = 'active', auto_debit_enabled = 1 WHERE id = $2
      `, [subscriptionId, restoId]);

      await logPaymentAudit(restoId, 'CASHFREE_SANDBOX_SUB_VERIFIED', {
        subscription_id: subscriptionId,
        status: cfStatus.subscription_status
      });
    }

    res.json({
      success: true,
      subscription_id: subscriptionId,
      subscription_status: cfStatus.subscription_status,
      authorized: isAuthorized,
      details: cfStatus
    });
  } catch (err) {
    console.error('Verify subscription error:', err);
    res.status(500).json({ error: 'Failed to verify subscription status' });
  }
});

// Calendar-month date calculation helper (e.g. Jan 15 -> Feb 15, Jan 31 -> Feb 28)
function addCalendarMonth(date = new Date()) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + 1;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0);
  }
  return d.toISOString();
}

// ==========================================
// 3A. CASHFREE SUBSCRIPTION RETURN HANDLER
// Primary: POST (Cashfree sends form POST after mandate authorization)
// Secondary: GET (browser direct navigation / compatibility)
// ==========================================

/**
 * Shared handler logic for both POST and GET return from Cashfree.
 * Cashfree POSTs application/x-www-form-urlencoded after mandate authorization.
 * NEVER trusts the frontend — always verifies server-side via GET /pg/subscriptions/{id}
 */
const handleSubscriptionReturn = async (req, res) => {
  // Read subscriptionId from POST body (form fields) OR query params (GET fallback)
  const subscriptionId =
    (req.body && (req.body.subscriptionId || req.body.subscription_id || req.body.subId)) ||
    req.query.subscription_id ||
    req.query.subscriptionId ||
    null;

  const baseRedirectUrl = `${process.env.APP_BASE_URL || 'https://khana-master.onrender.com'}/billing`;

  if (!subscriptionId) {
    console.warn('[Cashfree Return] No subscription_id in return POST/GET — redirecting to billing with error');
    return res.redirect(`${baseRedirectUrl}?verified=false&status=NO_SUBSCRIPTION_ID`);
  }

  console.log('[Cashfree Return] Received return for subscription_id:', subscriptionId);

  try {
    // NEVER trust frontend — always verify server-side
    const cfStatus = await fetchCashfreeSubscriptionStatus(subscriptionId);

    if (!cfStatus.success) {
      console.warn('[Cashfree Return] Server-side verification failed:', cfStatus.error);
      return res.redirect(`${baseRedirectUrl}?verified=false&status=${encodeURIComponent(cfStatus.subscription_status || 'VERIFICATION_FAILED')}`);
    }

    const subStatus = cfStatus.subscription_status || 'UNKNOWN';
    const isAuthorized = subStatus === 'ACTIVE' || subStatus === 'INITIALIZED';

    // Resolve restaurant from subscription_id in DB
    const subRows = await query(
      'SELECT * FROM subscriptions WHERE gateway_subscription_id = $1 LIMIT 1',
      [subscriptionId]
    );
    const subRecord = subRows[0];
    const restoId = subRecord?.restaurant_id;

    if (restoId && isAuthorized) {
      // Update mandate active status
      await query(
        "UPDATE restaurants SET mandate_id = $1, mandate_status = 'active', auto_debit_enabled = 1 WHERE id = $2",
        [subscriptionId, restoId]
      );
      await query(
        "UPDATE subscriptions SET status = 'trialing' WHERE gateway_subscription_id = $1 AND status IN ('pending', 'INITIALIZED')",
        [subscriptionId]
      );
      await logPaymentAudit(restoId, 'CASHFREE_RETURN_VERIFIED', {
        subscription_id: subscriptionId,
        status: subStatus,
        via: req.method === 'POST' ? 'FORM_POST' : 'GET'
      });
      console.log('[Cashfree Return] ✅ Mandate authorized for restaurant', restoId, '— status:', subStatus);
    } else if (restoId) {
      await logPaymentAudit(restoId, 'CASHFREE_RETURN_PENDING', {
        subscription_id: subscriptionId,
        status: subStatus
      });
      console.log('[Cashfree Return] ⏳ Subscription not yet active for restaurant', restoId, '— status:', subStatus);
    } else {
      console.warn('[Cashfree Return] No restaurant found for subscription_id:', subscriptionId);
    }

    // Redirect browser back to billing page with verification result
    const redirectParams = new URLSearchParams({
      verified: isAuthorized ? 'true' : 'false',
      status: subStatus,
      subscription_id: subscriptionId
    });
    return res.redirect(`${baseRedirectUrl}?${redirectParams.toString()}`);
  } catch (err) {
    console.error('[Cashfree Return] Error during return processing:', err.message);
    return res.redirect(`${baseRedirectUrl}?verified=false&status=SERVER_ERROR`);
  }
};

// POST is primary — Cashfree sends application/x-www-form-urlencoded form POST
router.post('/subscription-return', handleSubscriptionReturn);
// GET is supported for compatibility and browser direct navigation
router.get('/subscription-return', handleSubscriptionReturn);


// ==========================================
// 3. PHASE 2B PRODUCTION WEBHOOK HANDLER
// ==========================================
const handleCashfreeWebhook = async (req, res) => {
  const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const signature = req.headers['x-webhook-signature'] || req.headers['x-cashfree-signature'];
  const timestamp = req.headers['x-webhook-timestamp'] || req.headers['x-cashfree-timestamp'];

  // 1. Signature Verification Security Check
  const isBypassTesting = Boolean(req.headers['x-test-bypass'] === 'true' && process.env.NODE_ENV === 'test');
  const isValidSignature = isBypassTesting || verifyCashfreeWebhookSignature(rawBody, timestamp, signature);

  if (!isValidSignature && process.env.CASHFREE_CLIENT_SECRET) {
    console.warn('⚠️ Webhook rejected: Invalid Cashfree signature');
    return res.status(401).json({ error: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' });
  }

  const payload = typeof req.body === 'object' ? req.body : JSON.parse(rawBody || '{}');
  const eventType = payload.type || payload.event_type || 'UNKNOWN_EVENT';
  const data = payload.data || payload;

  const subscriptionId = data.subscription_details?.subscription_id || data.subscription_id || data.order_tags?.subscription_id;
  const paymentId = data.payment_details?.payment_id || data.payment_id || data.cf_payment_id || `pay_${Date.now()}`;
  const eventId = payload.event_id || payload.id || `${eventType}_${subscriptionId || 'nosub'}_${paymentId}`;

  try {
    // 2. Atomic Database Transaction with Webhook Idempotency Check
    const result = await withTransaction(async (txQuery) => {
      // Check idempotency in `webhook_events` table
      const existingEvents = await txQuery(
        'SELECT id FROM webhook_events WHERE gateway = $1 AND event_id = $2',
        ['cashfree', eventId]
      );

      if (existingEvents && existingEvents.length > 0) {
        return { status: 'DUPLICATE_IGNORED', message: 'Event already processed' };
      }

      // Record webhook event in database
      await txQuery(`
        INSERT INTO webhook_events (gateway, event_id, event_type, payload, processed, created_at)
        VALUES ('cashfree', $1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [eventId, eventType, JSON.stringify(payload), false]);

      // Resolve tenant restaurant EXCLUSIVELY by subscription_id mapping in database
      let restoId = null;
      let subDbRecord = null;
      if (subscriptionId) {
        const subRows = await txQuery('SELECT * FROM subscriptions WHERE gateway_subscription_id = $1 LIMIT 1', [subscriptionId]);
        subDbRecord = subRows[0] || null;
        restoId = subDbRecord?.restaurant_id || null;
      }

      if (!restoId && subscriptionId) {
        console.warn(`⚠️ Webhook received for unmapped subscription_id: ${subscriptionId}`);
      }

      // Handle Specific Event Types
      if (eventType === 'SUBSCRIPTION_AUTH_STATUS' || eventType === 'SUBSCRIPTION_AUTHORIZATION_SUCCESS') {
        const authStatus = data.authorization_details?.authorization_status || data.status || 'ACTIVE';
        if (authStatus === 'ACTIVE' || authStatus === 'SUCCESS') {
          if (restoId) {
            await txQuery("UPDATE restaurants SET mandate_status = 'active', mandate_id = $1, auto_debit_enabled = 1 WHERE id = $2", [subscriptionId, restoId]);
          }
          await txQuery("UPDATE subscriptions SET status = 'trialing' WHERE gateway_subscription_id = $1 AND status = 'pending'", [subscriptionId]);
        } else {
          if (restoId) {
            await txQuery("UPDATE restaurants SET mandate_status = 'failed' WHERE id = $1", [restoId]);
          }
        }
      }

      else if (eventType === 'SUBSCRIPTION_PAYMENT_SUCCESS' || eventType === 'SUBSCRIPTION_NEW_PAYMENT') {
        const payAmount = Number(data.payment_details?.payment_amount || data.payment_amount || data.plan_details?.plan_amount || 0);
        
        if (restoId && subDbRecord) {
          // Amount Validation against SaaS Plan
          const planRows = await txQuery('SELECT price FROM saas_plans WHERE id = $1', [subDbRecord.plan_id || 2]);
          const expectedPrice = Number(planRows[0]?.price || 499);

          if (payAmount > 0 && payAmount < expectedPrice) {
            console.warn(`⚠️ Payment amount discrepancy: Received ₹${payAmount}, expected ₹${expectedPrice}. Marking for manual reconciliation.`);
            await logPaymentAudit(restoId, 'PAYMENT_AMOUNT_MISMATCH', { subscription_id: subscriptionId, received: payAmount, expected: expectedPrice });
          } else {
            // Idempotent payment recording
            const existingPayments = await txQuery('SELECT id FROM payments WHERE gateway = $1 AND gateway_payment_id = $2', ['cashfree', paymentId]);
            if (!existingPayments || existingPayments.length === 0) {
              const paidAtISO = new Date().toISOString();
              await txQuery(`
                INSERT INTO payments (restaurant_id, subscription_id, gateway, gateway_payment_id, amount, currency, status, payment_type, paid_at)
                VALUES ($1, $2, 'cashfree', $3, $4, 'INR', 'SUCCESS', 'recurring', $5)
              `, [restoId, subDbRecord.id, paymentId, payAmount || expectedPrice, paidAtISO]);
            }

            // Calendar-month billing extension (e.g. Jan 15 -> Feb 15)
            const now = new Date();
            const periodEnd = addCalendarMonth(now);
            const periodStart = now.toISOString();

            await txQuery(`
              UPDATE subscriptions SET 
                status = 'active',
                current_period_start = $1,
                current_period_end = $2,
                next_billing_at = $3,
                updated_at = $4
              WHERE gateway_subscription_id = $5
            `, [periodStart, periodEnd, periodEnd, periodStart, subscriptionId]);

            await txQuery(`
              UPDATE restaurants SET active = 1, plan_expires_at = $1, mandate_status = 'active' WHERE id = $2
            `, [periodEnd, restoId]);
          }
        }
      }

      else if (eventType === 'SUBSCRIPTION_PAYMENT_FAILED' || eventType === 'SUBSCRIPTION_PAYMENT_DECLINED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'payment_failed' WHERE gateway_subscription_id = $1", [subscriptionId]);
        }
      }

      else if (eventType === 'SUBSCRIPTION_CANCELLED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE gateway_subscription_id = $1", [subscriptionId]);
          await txQuery("UPDATE restaurants SET mandate_status = 'cancelled', auto_debit_enabled = 0 WHERE id = $1", [restoId]);
        }
      }

      else if (eventType === 'SUBSCRIPTION_PAUSED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'paused' WHERE gateway_subscription_id = $1", [subscriptionId]);
        }
      }

      else if (eventType === 'SUBSCRIPTION_RESUMED') {
        if (restoId) {
          await txQuery("UPDATE subscriptions SET status = 'active' WHERE gateway_subscription_id = $1", [subscriptionId]);
        }
      }

      else if (eventType === 'PRE_DEBIT_NOTIFICATION') {
        if (restoId) {
          await logPaymentAudit(restoId, 'PRE_DEBIT_NOTIFICATION_RECEIVED', { subscription_id: subscriptionId, payload });
        }
      }

      else if (eventType === 'REFUND' || eventType === 'SUBSCRIPTION_REFUND') {
        if (restoId) {
          await logPaymentAudit(restoId, 'REFUND_AUDIT_LOGGED', { subscription_id: subscriptionId, payload });
        }
      }

      // Mark webhook event processed
      await txQuery('UPDATE webhook_events SET processed = $1, processed_at = CURRENT_TIMESTAMP WHERE gateway = $2 AND event_id = $3', [true, 'cashfree', eventId]);

      if (restoId) {
        await logPaymentAudit(restoId, `WEBHOOK_${eventType}`, { subscription_id: subscriptionId, payment_id: paymentId, event_id: eventId });
      }

      return { status: 'PROCESSED', event_type: eventType, event_id: eventId };
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED', message: err.message });
  }
};

router.post('/cashfree', handleCashfreeWebhook);
router.post('/webhook/cashfree', handleCashfreeWebhook);

// ==========================================
// 4. PAYMENT HISTORY & BILLING STATUS FOR ADMIN
// ==========================================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const targetRestoId = restoId || 1;

    const payments = await query(`
      SELECT p.*, s.gateway_subscription_id 
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      WHERE p.restaurant_id = $1
      ORDER BY p.id DESC LIMIT 50
    `, [targetRestoId]);

    const activeSubRows = await query(`
      SELECT * FROM subscriptions 
      WHERE restaurant_id = $1 
      ORDER BY id DESC LIMIT 1
    `, [targetRestoId]);

    res.json({
      success: true,
      subscription: activeSubRows[0] || null,
      payments: payments || []
    });
  } catch (err) {
    console.error('Fetch payment history error:', err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// ==========================================
// 5. CANCEL MANDATE
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


