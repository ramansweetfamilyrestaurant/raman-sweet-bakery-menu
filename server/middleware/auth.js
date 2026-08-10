import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from '../db.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

export async function checkSubscriptionStatus(restaurantId) {
  if (!restaurantId) return { status: 'unknown', active: false };
  
  try {
    const rows = await query('SELECT * FROM restaurants WHERE id = $1', [restaurantId]);
    if (!rows || rows.length === 0) return { status: 'not_found', active: false };
    const resto = rows[0];

    // Super Admin granted 100% complimentary VIP lifetime access
    if (resto.mandate_status === 'admin_granted' || resto.subscription_type === 'ADMIN_GRANTED') {
      return { status: 'active', active: true, resto, sub: null, isComplimentary: true };
    }

    const now = new Date();
    
    // Check trial end date (trial_ends_at or plan_expires_at)
    let isTrialing = false;
    const expStr = resto.trial_ends_at || resto.plan_expires_at;
    if (expStr) {
      const trialExp = new Date(String(expStr).includes('T') ? expStr : `${expStr}T23:59:59Z`);
      if (!isNaN(trialExp.getTime()) && trialExp >= now) {
        isTrialing = true;
      }
    }

    // Check subscriptions table for active paid subscription status
    const subRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [restaurantId]);
    const sub = subRows[0];

    // Active paid subscription
    if (sub && sub.status === 'active') {
      // Even if cancel_requested, if current_period_end is in the future, still active
      if (sub.cancel_requested_at && sub.current_period_end) {
        const periodEnd = new Date(sub.current_period_end);
        if (periodEnd >= now) {
          return { status: 'active', active: true, resto, sub };
        }
      } else {
        return { status: 'active', active: true, resto, sub };
      }
    }

    // Trialing subscription with cancel requested but trial not ended yet
    if (sub && sub.cancel_requested_at && (sub.status === 'trialing' || sub.status === 'active')) {
      if (isTrialing) {
        return { status: 'trialing', active: true, resto, sub };
      }
      // Check current_period_end
      if (sub.current_period_end) {
        const periodEnd = new Date(sub.current_period_end);
        if (periodEnd >= now) {
          return { status: 'active', active: true, resto, sub };
        }
      }
    }

    if (isTrialing) {
      return { status: 'trialing', active: true, resto, sub };
    }

    // If active flag is set to false in DB or trial/plan expired
    if (resto.active === 0 || resto.active === false) {
      return { status: 'expired', active: false, resto, sub };
    }

    // Default fallback
    if (isTrialing || resto.active === 1 || resto.active === true) {
      return { status: 'trialing', active: true, resto, sub };
    }

    return { status: 'expired', active: false, resto, sub };
  } catch (err) {
    console.error('Subscription status check error:', err.message);
    return { status: 'unknown', active: true };
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;

    // Attach subscription status for tenant admins without blocking expired access
    if (user && user.role !== 'superadmin' && user.restaurant_id) {
      const subInfo = await checkSubscriptionStatus(user.restaurant_id);
      req.restaurant = subInfo.resto;
      req.subscriptionStatus = subInfo.status;
    } else {
      req.subscriptionStatus = 'active';
    }

    next();
  });
}

export function requireActiveSubscription(req, res, next) {
  // Super Admin always retains master access
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }

  const status = req.subscriptionStatus || 'active';
  if (status === 'expired') {
    return res.status(403).json({
      error: 'SUBSCRIPTION_EXPIRED',
      message: 'Your 14-day trial or SaaS subscription has expired. Please renew your subscription to continue using operational features.'
    });
  }

  next();
}
