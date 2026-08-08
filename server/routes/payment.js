import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';

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

// ==========================================
// 1. CREATE PAYMENT ORDER (Cashfree / Razorpay)
// ==========================================
router.post('/create-order', async (req, res) => {
  try {
    const { restaurant_id, plan_tier, coupon_code, gateway = 'cashfree' } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({ error: 'Restaurant ID is required for payment' });
    }

    // Fetch plan details from saas_plans DB
    const targetPlanKey = (plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [targetPlanKey]);
    const plan = planRows && planRows.length > 0 ? planRows[0] : { price: 999, name: 'Pro Luxury Plan' };

    let finalPrice = Number(plan.price) || 999;
    let appliedDiscount = 0;

    // Apply Coupon Code if provided
    if (coupon_code && typeof coupon_code === 'string') {
      const cRows = await query('SELECT * FROM coupons WHERE UPPER(code) = $1 AND active = 1', [coupon_code.trim().toUpperCase()]);
      if (cRows && cRows.length > 0) {
        const coupon = cRows[0];
        if (coupon.discount_percent > 0) {
          appliedDiscount = Math.round((finalPrice * coupon.discount_percent) / 100);
        } else if (coupon.discount_amount > 0) {
          appliedDiscount = Math.min(finalPrice, Number(coupon.discount_amount));
        }
        finalPrice = Math.max(0, finalPrice - appliedDiscount);
      }
    }

    const orderId = `KM_SUB_${restaurant_id}_${Date.now()}`;

    res.json({
      success: true,
      order_id: orderId,
      gateway,
      amount: finalPrice,
      currency: 'INR',
      plan_tier: targetPlanKey,
      plan_name: plan.name,
      discount_applied: appliedDiscount,
      message: `Payment order ${orderId} created for ₹${finalPrice}`
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ==========================================
// 2. CASHFREE WEBHOOK HANDLER
// ==========================================
router.post('/cashfree', async (req, res) => {
  try {
    const payload = req.body;
    console.log('💳 Received Cashfree Webhook:', JSON.stringify(payload));

    const orderId = payload?.data?.order?.order_id || payload?.orderId;
    const paymentStatus = payload?.data?.payment?.payment_status || payload?.txStatus;

    if (paymentStatus === 'SUCCESS' && orderId) {
      // Extract restaurant_id from order_id format: KM_SUB_<restaurant_id>_<timestamp>
      const parts = orderId.split('_');
      const restoId = parseInt(parts[2], 10);

      if (restoId) {
        // Calculate new expiry date (Current date + 30 days)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const expiryStr = expiryDate.toISOString().split('T')[0];

        await query(
          "UPDATE restaurants SET status = 'active', active = 1, plan_expires_at = $1 WHERE id = $2",
          [expiryStr, restoId]
        );

        await logPaymentAudit(restoId, 'Cashfree Webhook Success', { orderId, amount: payload?.data?.order?.order_amount, expiryStr });
        console.log(`✅ Restaurant ID ${restoId} subscription extended to ${expiryStr} via Cashfree`);
      }
    }

    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('Cashfree Webhook Error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==========================================
// 3. RAZORPAY WEBHOOK HANDLER (BACKUP GATEWAY)
// ==========================================
router.post('/razorpay', async (req, res) => {
  try {
    const payload = req.body;
    console.log('💳 Received Razorpay Webhook:', JSON.stringify(payload));

    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id || paymentEntity?.notes?.order_id;

    if ((event === 'payment.captured' || event === 'order.paid') && paymentEntity) {
      const notesRestoId = paymentEntity?.notes?.restaurant_id;
      let restoId = notesRestoId ? parseInt(notesRestoId, 10) : null;

      if (!restoId && orderId && orderId.startsWith('KM_SUB_')) {
        const parts = orderId.split('_');
        restoId = parseInt(parts[2], 10);
      }

      if (restoId) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        const expiryStr = expiryDate.toISOString().split('T')[0];

        await query(
          "UPDATE restaurants SET status = 'active', active = 1, plan_expires_at = $1 WHERE id = $2",
          [expiryStr, restoId]
        );

        await logPaymentAudit(restoId, 'Razorpay Webhook Success', { event, orderId, amount: paymentEntity?.amount ? paymentEntity.amount / 100 : 0, expiryStr });
        console.log(`✅ Restaurant ID ${restoId} subscription extended to ${expiryStr} via Razorpay Backup`);
      }
    } else if (event === 'payment.failed' && paymentEntity) {
      const notesRestoId = paymentEntity?.notes?.restaurant_id;
      if (notesRestoId) {
        await logPaymentAudit(notesRestoId, 'Razorpay Payment Failed', { reason: paymentEntity?.error_description });
      }
    }

    res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('Razorpay Webhook Error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==========================================
// 4. CREATE UPI AUTOPAY MANDATE ORDER (₹0 Today, Auto-Debit on Day 15)
// ==========================================
router.post('/create-mandate', async (req, res) => {
  try {
    const { restaurant_id, plan_tier, coupon_code, gateway = 'cashfree' } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    const targetPlanKey = (plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [targetPlanKey]);
    const plan = planRows && planRows.length > 0 ? planRows[0] : { price: 999, name: 'Pro Luxury Plan' };

    let finalPrice = Number(plan.price) || 999;
    if (coupon_code && typeof coupon_code === 'string') {
      const cRows = await query('SELECT * FROM coupons WHERE UPPER(code) = $1 AND active = 1', [coupon_code.trim().toUpperCase()]);
      if (cRows && cRows.length > 0) {
        const coupon = cRows[0];
        if (coupon.discount_percent > 0) {
          finalPrice = Math.round(finalPrice * (1 - coupon.discount_percent / 100));
        } else if (coupon.discount_amount > 0) {
          finalPrice = Math.max(0, finalPrice - coupon.discount_amount);
        }
      }
    }

    const mandateId = `KM_MANDATE_${restaurant_id}_${Date.now()}`;
    const trialEndsDate = new Date();
    trialEndsDate.setDate(trialEndsDate.getDate() + 14);
    const trialEndsStr = trialEndsDate.toISOString().split('T')[0];

    // Save mandate details in restaurant DB
    await query(
      "UPDATE restaurants SET mandate_id = $1, mandate_status = 'active', trial_ends_at = $2, auto_debit_enabled = 1, plan_price = $3 WHERE id = $4",
      [mandateId, trialEndsStr, finalPrice, restaurant_id]
    );

    await logPaymentAudit(restaurant_id, 'UPI Autopay Mandate Created', { mandateId, gateway, monthlyAmount: finalPrice, trialEndsStr });

    res.json({
      success: true,
      mandate_id: mandateId,
      first_charge_amount: 0,
      monthly_recurring_amount: finalPrice,
      trial_ends_at: trialEndsStr,
      gateway,
      message: '₹0 UPI Autopay Mandate authorized successfully! 14-Day Free Trial activated.'
    });
  } catch (err) {
    console.error('Create Mandate Error:', err);
    res.status(500).json({ error: 'Failed to authorize UPI Autopay mandate' });
  }
});

// ==========================================
// 5. CANCEL AUTOPAY MANDATE
// ==========================================
router.post('/cancel-mandate', async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    await query(
      "UPDATE restaurants SET mandate_status = 'cancelled', auto_debit_enabled = 0 WHERE id = $1",
      [restaurant_id]
    );

    await logPaymentAudit(restaurant_id, 'Autopay Mandate Cancelled by User', { date: new Date().toISOString() });

    res.json({ success: true, message: 'UPI Autopay Mandate cancelled successfully.' });
  } catch (err) {
    console.error('Cancel Mandate Error:', err);
    res.status(500).json({ error: 'Failed to cancel Autopay mandate' });
  }
});

export default router;
