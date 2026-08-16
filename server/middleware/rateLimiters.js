import rateLimit from 'express-rate-limit';

/**
 * Custom 429 response handler that logs coarse diagnostic information safely
 * without leaking sensitive credentials, tokens, or auth codes.
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
 * 1. Single-Use Auth Code Exchange Rate Limiter
 * Strict: 10 requests per IP per 5 minutes
 */
export const authExchangeRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: { error: 'Too many registration attempts. Please try again later.' },
  handler: createRateLimitHandler({ error: 'Too many registration attempts. Please try again later.' })
});
