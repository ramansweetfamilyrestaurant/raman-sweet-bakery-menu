import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from '../db.js';
import { JWT_SECRET } from '../config/jwt.js';
import { resolveCanonicalSubscriptionState } from '../services/subscriptionState.js';

// Fast In-Memory Cache for Subscription Status (15s TTL)
const subStatusCache = new Map();
const SUB_CACHE_TTL_MS = 15000;

export function clearSubStatusCache(restaurantId) {
  if (restaurantId) {
    subStatusCache.delete(Number(restaurantId));
  } else {
    subStatusCache.clear();
  }
}

export async function checkSubscriptionStatus(restaurantId) {
  if (!restaurantId) return { status: 'unknown', active: false };
  
  const rId = Number(restaurantId);
  const cached = subStatusCache.get(rId);
  if (cached && (Date.now() - cached.timestamp < SUB_CACHE_TTL_MS)) {
    return cached.payload;
  }

  try {
    const rows = await query('SELECT * FROM restaurants WHERE id = $1', [restaurantId]);
    if (!rows || rows.length === 0) {
      const res = { status: 'not_found', active: false };
      subStatusCache.set(rId, { payload: res, timestamp: Date.now() });
      return res;
    }
    const resto = rows[0];

    // Explicit Super Admin Suspension check - MUST override all trial & granted access!
    const isExplicitlyActive = resto.active === 1 || resto.active === true || resto.active === '1' || resto.active === undefined || resto.active === null;
    if (!isExplicitlyActive || resto.active === false || resto.active === 0 || resto.active === 'false') {
      const res = { status: 'suspended', active: false, resto, sub: null };
      subStatusCache.set(rId, { payload: res, timestamp: Date.now() });
      return res;
    }

    const subRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [restaurantId]);
    const sub = subRows[0] || null;

    const canonical = resolveCanonicalSubscriptionState({ resto, sub, now: new Date() });
    const payload = {
      status: canonical.status,
      active: canonical.active,
      resto,
      sub,
      isComplimentary: canonical.isComplimentary,
      inGracePeriod: canonical.inGracePeriod,
      accessUntil: canonical.accessUntil,
      badge: canonical.badge
    };

    subStatusCache.set(rId, { payload, timestamp: Date.now() });
    return payload;
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
