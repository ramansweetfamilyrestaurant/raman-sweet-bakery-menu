import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

let redisClient = null;
let isRedisAvailable = false;

// Optional Distributed Redis Shared Store Initialization
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 4000,
      lazyConnect: true,
      enableOfflineQueue: false
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      console.log('⚡ [DISTRIBUTED RATE LIMITER] Connected to Redis shared store.');
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      console.warn('⚠️ [DISTRIBUTED RATE LIMITER] Redis connection notice (fallback to MemoryStore):', err.message);
    });

    redisClient.connect().catch((err) => {
      isRedisAvailable = false;
      console.warn('⚠️ [DISTRIBUTED RATE LIMITER] Redis initial connection failed (using MemoryStore fallback):', err.message);
    });
  } catch (err) {
    isRedisAvailable = false;
    console.warn('⚠️ [DISTRIBUTED RATE LIMITER] Redis init notice:', err.message);
  }
}

/**
 * Returns a Redis-backed store when Redis is available, or undefined for MemoryStore fallback
 */
export function getRateLimitStore(prefix = 'rl:') {
  if (redisClient && isRedisAvailable) {
    try {
      return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `touchqr:${prefix}`
      });
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Custom 429 response handler that logs coarse diagnostic information safely
 * without leaking sensitive credentials, tokens, or internal infrastructure details.
 */
function createRateLimitHandler(customMessage) {
  return (req, res, next, options) => {
    const retryAfterSec = Math.ceil(options.windowMs / 1000);
    console.warn(`⚠️ [RATE LIMIT EXCEEDED] Path: ${req.originalUrl || req.url} | Client IP: ${req.ip} | Retry After: ${retryAfterSec}s`);
    
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json(options.message);
  };
}

/**
 * Scoped key generator that binds rate limiting to scopeName + restaurant slug + client IP
 * Prevents cross-tenant rate limit exhaustion while isolating restaurant traffic
 */
export function createScopedKeyGenerator(scopeName = 'default') {
  return (req) => {
    const rawSlug = req.body?.slug || req.query?.slug || req.params?.slug || 'global';
    const slug = String(rawSlug).toLowerCase().trim().substring(0, 50);
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return `${scopeName}:${slug}:${clientIp}`;
  };
}

/**
 * 1. Single-Use Auth Code Exchange Rate Limiter
 * Strict: 10 requests per IP per 5 minutes
 */
export const authExchangeRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('auth_exch:'),
  message: { error: 'Too many authentication code exchange requests. Please try again later.' },
  handler: createRateLimitHandler({ error: 'Too many authentication code exchange requests. Please try again later.' })
});

/**
 * 2. Admin Login Rate Limiter
 * Protection: 10 attempts per IP per 15 minutes
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('admin_login:'),
  message: { error: 'Too many login attempts. Please try again later.' },
  handler: createRateLimitHandler({ error: 'Too many login attempts. Please try again later.' })
});

/**
 * 3. Master SuperAdmin Login Rate Limiter
 * Strict: 5 attempts per IP per 15 minutes
 */
export const superAdminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('super_login:'),
  message: { error: 'Too many SuperAdmin login attempts. Please try again later.' },
  handler: createRateLimitHandler({ error: 'Too many SuperAdmin login attempts. Please try again later.' })
});

/**
 * 4. Self-Service Registration & Payment Setup Rate Limiter
 * Moderate: 15 requests per IP per 15 minutes
 */
export const registrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  store: getRateLimitStore('reg_setup:'),
  message: { error: 'Too many registration attempts. Please try again later.' },
  handler: createRateLimitHandler({ error: 'Too many registration attempts. Please try again later.' })
});

/**
 * 5. Customer Location Verification Rate Limiter
 * Protection against location verification spam & QR token brute forcing
 * Generous for shared restaurant Wi-Fi: 30 requests per IP per restaurant per 5 minutes
 */
export const locationVerifyRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: createScopedKeyGenerator('loc_verify'),
  store: getRateLimitStore('loc_verify:'),
  message: { error: 'Too many location verification requests. Please wait a moment and try again.' },
  handler: createRateLimitHandler({ error: 'Too many location verification requests. Please wait a moment and try again.' })
});

/**
 * 6. Direct Table Order Creation Rate Limiter
 * Protection against automated order submission spam & brute-force replay
 * Generous for shared restaurant Wi-Fi: 25 requests per IP per restaurant per 5 minutes
 */
export const orderCreationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: createScopedKeyGenerator('order_create'),
  store: getRateLimitStore('order_create:'),
  message: { error: 'Too many order requests. Please wait a moment before trying again.' },
  handler: createRateLimitHandler({ error: 'Too many order requests. Please wait a moment before trying again.' })
});

/**
 * 7. Customer Waiter / Service Request Rate Limiter
 * Protection against waiter call bell spamming
 * Limit: 12 requests per IP per restaurant per 5 minutes
 */
export const serviceRequestRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: createScopedKeyGenerator('svc_req'),
  store: getRateLimitStore('svc_req:'),
  message: { error: 'Too many service requests. Please wait a moment before calling staff again.' },
  handler: createRateLimitHandler({ error: 'Too many service requests. Please wait a moment before calling staff again.' })
});

/**
 * 8. Kitchen Display System (KDS) PIN Verification Rate Limiter
 * Protection against PIN brute-forcing
 * Limit: 10 attempts per IP per restaurant per 15 minutes
 */
export const kdsPinRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: createScopedKeyGenerator('kds_pin'),
  store: getRateLimitStore('kds_pin:'),
  message: { error: 'TOO_MANY_PIN_ATTEMPTS', message: 'Too many KDS PIN attempts. Please wait 15 minutes and try again.' },
  handler: createRateLimitHandler({ error: 'TOO_MANY_PIN_ATTEMPTS', message: 'Too many KDS PIN attempts. Please wait 15 minutes and try again.' })
});

