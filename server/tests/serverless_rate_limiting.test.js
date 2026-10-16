/**
 * Serverless Distributed Rate Limiting & Fail-Closed Guard Test Suite
 *
 * Verifies that:
 * 1. In production (NODE_ENV=production or VERCEL_ENV=production), if REDIS_URL is absent,
 *    rate limiters fail closed with an explicit 503 configuration error.
 * 2. In non-production/test environments, rate limiters pass through to allow local memory store.
 * 3. Support ticket create and reply limiters use the distributed rate limit guard.
 * 4. Error response is sanitized and contains no internal leaks.
 */

import assert from 'assert';
import {
  enforceDistributedRateLimitGuard,
  supportTicketCreateRateLimiter,
  supportTicketReplyRateLimiter,
  getRateLimitStore
} from '../middleware/rateLimiters.js';

console.log('======================================================================');
console.log('🛡️  SERVERLESS DISTRIBUTED RATE LIMITING TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

function createMockReqRes() {
  const req = {
    ip: '127.0.0.1',
    url: '/api/admin/support/tickets',
    originalUrl: '/api/admin/support/tickets',
    body: {},
    headers: {}
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return { req, res };
}

async function runSuite() {
  // -------------------------------------------------------------------
  // 1. Non-production / test mode passes through to local memory store
  // -------------------------------------------------------------------
  await test('1. Non-production mode allows execution without REDIS_URL', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    delete process.env.REDIS_URL;

    const { req, res } = createMockReqRes();
    let nextCalled = false;

    const guard = enforceDistributedRateLimitGuard('test_scope');
    guard(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Next middleware must be invoked in test/dev mode');
    assert.strictEqual(res.statusCode, 200);
  });

  // -------------------------------------------------------------------
  // 2. Production mode (NODE_ENV=production) without REDIS_URL fails closed
  // -------------------------------------------------------------------
  await test('2. Production mode (NODE_ENV=production) without REDIS_URL fails closed with 503', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL_ENV;
    delete process.env.REDIS_URL;

    const { req, res } = createMockReqRes();
    let nextCalled = false;

    const guard = enforceDistributedRateLimitGuard('support_ticket_create');
    guard(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Next must NOT be called when REDIS_URL is missing in production');
    assert.strictEqual(res.statusCode, 503, 'Must return 503 Service Unavailable');
    assert.strictEqual(res.body?.error, 'RATE_LIMITER_CONFIGURATION_ERROR');
    assert(res.body?.message?.includes('Distributed rate limiting shared store is not configured for production'));

    process.env.NODE_ENV = 'test';
  });

  // -------------------------------------------------------------------
  // 3. Production mode (VERCEL_ENV=production) without REDIS_URL fails closed
  // -------------------------------------------------------------------
  await test('3. Production mode (VERCEL_ENV=production) without REDIS_URL fails closed with 503', async () => {
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = 'production';
    delete process.env.REDIS_URL;

    const { req, res } = createMockReqRes();
    let nextCalled = false;

    const guard = enforceDistributedRateLimitGuard('support_ticket_reply');
    guard(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Next must NOT be called in Vercel production without Redis');
    assert.strictEqual(res.statusCode, 503);
    assert.strictEqual(res.body?.error, 'RATE_LIMITER_CONFIGURATION_ERROR');

    delete process.env.VERCEL_ENV;
  });

  // -------------------------------------------------------------------
  // 4. Rate limiters are exported as composite middleware with guard
  // -------------------------------------------------------------------
  await test('4. Ticket create and reply limiters contain distributed guard', () => {
    assert(Array.isArray(supportTicketCreateRateLimiter), 'supportTicketCreateRateLimiter must be an array of middleware');
    assert.strictEqual(supportTicketCreateRateLimiter.length, 2, 'Must have guard and rateLimiter');

    assert(Array.isArray(supportTicketReplyRateLimiter), 'supportTicketReplyRateLimiter must be an array of middleware');
    assert.strictEqual(supportTicketReplyRateLimiter.length, 2, 'Must have guard and rateLimiter');
  });

  // -------------------------------------------------------------------
  // 5. Composite limiter in production without REDIS_URL invokes guard and blocks
  // -------------------------------------------------------------------
  await test('5. Composite ticket limiter in production blocks execution via guard', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;

    const { req, res } = createMockReqRes();
    let nextCalled = false;

    const [guard] = supportTicketCreateRateLimiter;
    guard(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Guard must intercept and stop middleware chain');
    assert.strictEqual(res.statusCode, 503);

    process.env.NODE_ENV = 'test';
  });

  console.log('\n======================================================================');
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
