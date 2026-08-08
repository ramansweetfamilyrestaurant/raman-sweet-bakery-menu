import express from 'express';
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
// 1. CREATE PAYMENT ORDER (Reserved for Phase 2)
// ==========================================
router.post('/create-order', async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    res.json({
      success: false,
      phase2_notice: true,
      message: 'Payment gateway integration is reserved for Phase 2. No live or fake payment order created.'
    });
  } catch (err) {
    console.error('Create payment order error:', err);
    res.status(500).json({ error: 'Failed to process payment request' });
  }
});

// ==========================================
// 2. CASHFREE WEBHOOK HANDLER (Reserved for Phase 2)
// ==========================================
router.post('/cashfree', async (req, res) => {
  try {
    const payload = req.body;
    console.log('💳 Received Cashfree Webhook:', JSON.stringify(payload));
    res.status(200).json({ status: 'OK', note: 'Cashfree webhook processing reserved for Phase 2' });
  } catch (err) {
    console.error('Cashfree Webhook Error:', err);
    res.status(200).json({ status: 'OK', note: 'Handled safely' });
  }
});

// ==========================================
// 3. RAZORPAY WEBHOOK HANDLER (Reserved for Phase 2)
// ==========================================
router.post('/razorpay', async (req, res) => {
  try {
    const payload = req.body;
    console.log('💳 Received Razorpay Webhook:', JSON.stringify(payload));
    res.status(200).json({ status: 'OK', note: 'Razorpay webhook processing reserved for Phase 2' });
  } catch (err) {
    console.error('Razorpay Webhook Error:', err);
    res.status(200).json({ status: 'OK', note: 'Handled safely' });
  }
});

// ==========================================
// 4. CREATE UPI AUTOPAY MANDATE (Reserved for Phase 2)
// ==========================================
router.post('/create-mandate', async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    res.json({
      success: false,
      phase2_notice: true,
      message: 'Recurring UPI Autopay mandate gateway integration is reserved for Phase 2.'
    });
  } catch (err) {
    console.error('Create mandate error:', err);
    res.status(500).json({ error: 'Failed to process mandate request' });
  }
});

// ==========================================
// 5. CANCEL MANDATE
// ==========================================
router.post('/cancel-mandate', async (req, res) => {
  try {
    const { restaurant_id } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    await query(
      "UPDATE restaurants SET auto_debit_enabled = 0, mandate_status = 'cancelled' WHERE id = $1",
      [restaurant_id]
    );

    await query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE restaurant_id = $1 AND status IN ('trialing', 'active')",
      [restaurant_id]
    );

    await logPaymentAudit(restaurant_id, 'Mandate Cancelled', { message: 'Autopay mandate cancelled by owner' });

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
