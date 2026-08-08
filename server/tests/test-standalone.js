import assert from 'assert';

console.log('🧪 Starting Phase 4 Standalone Verification Test...');

// 1. Verify payment.js routes syntax & export
import paymentRouter from '../routes/payment.js';
assert(paymentRouter, 'payment.js router exported successfully');

// 2. Verify admin.js routes syntax & export
import adminRouter from '../routes/admin.js';
assert(adminRouter, 'admin.js router exported successfully');

// 3. Verify subscriptionCron functions
import { checkExpiredSubscriptions, startSubscriptionCron } from '../subscriptionCron.js';
assert(typeof checkExpiredSubscriptions === 'function', 'checkExpiredSubscriptions is a function');
assert(typeof startSubscriptionCron === 'function', 'startSubscriptionCron is a function');

// 4. Verify auth.js middleware functions
import { checkSubscriptionStatus, authenticateToken, requireActiveSubscription } from '../middleware/auth.js';
assert(typeof checkSubscriptionStatus === 'function', 'checkSubscriptionStatus is a function');
assert(typeof authenticateToken === 'function', 'authenticateToken is a function');
assert(typeof requireActiveSubscription === 'function', 'requireActiveSubscription is a function');

// 5. Verify cashfree service
import { createCashfreeSubscriptionSession, fetchCashfreeSubscriptionStatus, verifyCashfreeWebhookSignature } from '../services/cashfree.js';
assert(typeof createCashfreeSubscriptionSession === 'function', 'createCashfreeSubscriptionSession is a function');
assert(typeof fetchCashfreeSubscriptionStatus === 'function', 'fetchCashfreeSubscriptionStatus is a function');
assert(typeof verifyCashfreeWebhookSignature === 'function', 'verifyCashfreeWebhookSignature is a function');

console.log('✅ ALL SERVER MODULES IMPORTED AND VERIFIED SUCCESSFULLY!');
