import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { checkTestDatabaseRequirement } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import paymentRoutes from '../routes/payment.js';
import { JWT_SECRET } from '../config/jwt.js';

try {
  checkTestDatabaseRequirement('Cashfree Billing Security Remediation Suite');
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

console.log('🛡️ Starting Cashfree Billing Security Remediation Regression Suite...\n');

const TEST_SECRET = 'test_cashfree_secret_key_remediation_2026';
process.env.CASHFREE_CLIENT_SECRET = TEST_SECRET;
process.env.CASHFREE_CLIENT_ID = 'TEST_CASHFREE_CLIENT_ID';

function signPayload(bodyStr, timestamp, secret = TEST_SECRET) {
  const data = `${timestamp}${bodyStr}`;
  return crypto.createHmac('sha256', secret).update(data).digest('base64');
}

async function runSecurityTests() {
  await initDb();

  // Create isolated ephemeral test server
  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/payment', paymentRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/payment`;

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  };

  try {
    // ----------------------------------------------------
    // TEST 1: Missing callback parameters rejected safely
    // ----------------------------------------------------
    await test('1. /subscription-return with missing parameters fails without provisioning or DB mutations', async () => {
      const restosBefore = await query('SELECT COUNT(*) as count FROM restaurants');
      const res = await fetch(`${baseUrl}/subscription-return`, {
        method: 'GET',
        redirect: 'manual'
      });
      const location = res.headers.get('location') || '';
      assert(res.status === 303 || res.status === 302, `Expected redirect status 303/302, got ${res.status}`);
      assert(location.includes('verified=false'), `Expected verified=false in redirect, got: ${location}`);
      assert(location.includes('MISSING_SUBSCRIPTION_REFERENCE') || location.includes('UNRESOLVED_SUBSCRIPTION_REFERENCE'), `Expected unresolved reference status, got: ${location}`);

      const restosAfter = await query('SELECT COUNT(*) as count FROM restaurants');
      assert.strictEqual(Number(restosBefore[0].count), Number(restosAfter[0].count), 'No new restaurant should be created on unresolved callback');
    });

    // ----------------------------------------------------
    // TEST 2: Cross-tenant /verify-subscription is rejected
    // ----------------------------------------------------
    await test('2. /verify-subscription rejects subscription belonging to a different restaurant', async () => {
      // Create Tenant A and Tenant B
      const uniqueSuffix = Date.now();
      const rA = await query(`
        INSERT INTO restaurants (name, slug, active, mandate_status)
        VALUES ('Tenant Alpha', 'tenant-alpha-${uniqueSuffix}', true, 'pending')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Tenant Alpha', 'tenant-alpha-${uniqueSuffix}', true, 'pending')`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-alpha-${uniqueSuffix}'`);
      });
      const rB = await query(`
        INSERT INTO restaurants (name, slug, active, mandate_status)
        VALUES ('Tenant Beta', 'tenant-beta-${uniqueSuffix}', true, 'pending')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Tenant Beta', 'tenant-beta-${uniqueSuffix}', true, 'pending')`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-beta-${uniqueSuffix}'`);
      });

      const tenantAId = rA[0].id;
      const tenantBId = rB[0].id;
      const subAId = `sub_alpha_${uniqueSuffix}`;

      // Insert subscription belonging to Tenant A
      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, status)
        VALUES ($1, $2, 'pending')
      `, [tenantAId, subAId]);

      // Generate JWT token for Tenant B
      const tokenTenantB = jwt.sign(
        { id: 9999, username: 'admin_beta', role: 'admin', restaurant_id: tenantBId },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Tenant B tries to verify Tenant A's subscription
      const res = await fetch(`${baseUrl}/verify-subscription?subscription_id=${encodeURIComponent(subAId)}`, {
        headers: {
          'Authorization': `Bearer ${tokenTenantB}`
        }
      });

      const data = await res.json();
      assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden, got ${res.status}`);
      assert.strictEqual(data.error, 'SUBSCRIPTION_OWNERSHIP_MISMATCH', `Expected SUBSCRIPTION_OWNERSHIP_MISMATCH, got: ${data.error}`);

      // Verify Tenant B remains pending
      const checkB = await query('SELECT mandate_status FROM restaurants WHERE id = $1', [tenantBId]);
      assert.strictEqual(checkB[0].mandate_status, 'pending', 'Tenant B mandate should not be activated');

      // Cleanup
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subAId]);
      await query('DELETE FROM restaurants WHERE id IN ($1, $2)', [tenantAId, tenantBId]);
    });

    // ----------------------------------------------------
    // TEST 3: Registration callback cannot override stored subscription ID
    // ----------------------------------------------------
    await test('3. Registration callback rejects mismatched subscription ID', async () => {
      const uniqueSuffix = Date.now();
      const regId = `reg_${uniqueSuffix}`;
      const authSubId = `sub_auth_server_${uniqueSuffix}`;
      const attackerSubId = `sub_attacker_override_${uniqueSuffix}`;
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

      const regPayload = {
        name: 'Attacker Override Test Resto',
        phone: '9988776655',
        owner_username: `att_${uniqueSuffix}`,
        password_hash: 'dummyhash',
        plan_key: 'pro',
        plan_price: 999,
        subscription_id: authSubId
      };

      await query(`
        INSERT INTO pending_registrations (
          id, payload, name, phone, owner_username, password_hash, plan_key, plan_price, cashfree_subscription_id, status, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
      `, [
        regId,
        JSON.stringify(regPayload),
        'Attacker Override Test Resto',
        '9988776655',
        `att_${uniqueSuffix}`,
        'dummyhash',
        'pro',
        999,
        authSubId,
        expiresAt
      ]);

      // Attacker attempts callback passing overridden subscription ID
      const res = await fetch(`${baseUrl}/subscription-return?reg_id=${regId}&subscription_id=${encodeURIComponent(attackerSubId)}`, {
        method: 'GET',
        redirect: 'manual'
      });

      const location = res.headers.get('location') || '';
      assert(res.status === 303 || res.status === 302, `Expected redirect, got ${res.status}`);
      assert(location.includes('verified=false'), `Expected verified=false in redirect, got ${location}`);
      assert(location.includes('REGISTRATION_MISMATCH') || location.includes('UNMAPPED_SUBSCRIPTION'), `Expected mismatch or unmapped in redirect, got ${location}`);

      // Verify pending_registration was NOT finalized
      const checkReg = await query('SELECT status FROM pending_registrations WHERE id = $1', [regId]);
      assert.strictEqual(checkReg[0].status, 'pending', 'Registration must remain pending on mismatched subscription ID');

      // Cleanup
      await query('DELETE FROM pending_registrations WHERE id = $1', [regId]);
    });

    // ----------------------------------------------------
    // TEST 4: Invalid webhook signatures rejected (401)
    // ----------------------------------------------------
    await test('4. Missing, malformed, or invalid webhook signatures cause no writes', async () => {
      const eventsBefore = await query('SELECT COUNT(*) as count FROM webhook_events');

      const body = JSON.stringify({ type: 'SUBSCRIPTION_AUTH_STATUS', data: { subscription_id: 'sub_test_123' } });

      // Request with bogus signature
      const res = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': String(Date.now()),
          'x-webhook-signature': 'invalid_base64_signature_here=='
        },
        body
      });

      assert.strictEqual(res.status, 401, `Expected HTTP 401, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.error, 'INVALID_SIGNATURE');

      const eventsAfter = await query('SELECT COUNT(*) as count FROM webhook_events');
      assert.strictEqual(Number(eventsBefore[0].count), Number(eventsAfter[0].count), 'No webhook event record created on invalid signature');
    });

    // ----------------------------------------------------
    // TEST 5: x-test-bypass header CANNOT bypass signature verification
    // ----------------------------------------------------
    await test('5. x-test-bypass request header is completely ignored', async () => {
      const body = JSON.stringify({ type: 'SUBSCRIPTION_AUTH_STATUS', data: { subscription_id: 'sub_test_bypass' } });

      const res = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass': 'true',
          'x-webhook-timestamp': String(Date.now()),
          'x-webhook-signature': 'forged_fake_signature=='
        },
        body
      });

      assert.strictEqual(res.status, 401, `Expected HTTP 401 with x-test-bypass header, got ${res.status}`);
    });

    // ----------------------------------------------------
    // TEST 6: Valid webhook signature processes correctly
    // ----------------------------------------------------
    await test('6. Valid signed webhook processes event for matching subscription', async () => {
      const uniqueSuffix = Date.now();
      const r = await query(`
        INSERT INTO restaurants (name, slug, active, mandate_status)
        VALUES ('Tenant Webhook Valid', 'tenant-valid-${uniqueSuffix}', true, 'pending')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Tenant Webhook Valid', 'tenant-valid-${uniqueSuffix}', true, 'pending')`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-valid-${uniqueSuffix}'`);
      });
      const restoId = r[0].id;
      const subId = `sub_valid_${uniqueSuffix}`;

      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, status)
        VALUES ($1, $2, 'pending')
      `, [restoId, subId]);

      const payload = {
        event: 'SUBSCRIPTION_AUTH_STATUS',
        event_id: `evt_valid_${uniqueSuffix}`,
        data: {
          subscription_id: subId,
          authorization_details: {
            authorization_status: 'ACTIVE'
          }
        }
      };

      const bodyStr = JSON.stringify(payload);
      const timestamp = String(Date.now());
      const validSig = signPayload(bodyStr, timestamp);

      const res = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': validSig
        },
        body: bodyStr
      });

      assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.status, 'PROCESSED');

      // Verify database updates
      const checkResto = await query('SELECT mandate_status, auto_debit_enabled FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(checkResto[0].mandate_status, 'active', 'Mandate should be marked active');
      assert.strictEqual(Number(checkResto[0].auto_debit_enabled), 1, 'Auto debit should be enabled');

      const checkSub = await query('SELECT status FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      assert.strictEqual(checkSub[0].status, 'trialing', 'Subscription should transition to trialing');

      // Cleanup
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
      await query('DELETE FROM webhook_events WHERE event_id = $1', [`evt_valid_${uniqueSuffix}`]);
    });

    // ----------------------------------------------------
    // TEST 7: Missing/unknown webhook status never defaults to ACTIVE
    // ----------------------------------------------------
    await test('7. Webhook with missing or unknown status never defaults to ACTIVE', async () => {
      const uniqueSuffix = Date.now();
      const r = await query(`
        INSERT INTO restaurants (name, slug, active, mandate_status)
        VALUES ('Tenant Status Unknown', 'tenant-unknown-${uniqueSuffix}', true, 'pending')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Tenant Status Unknown', 'tenant-unknown-${uniqueSuffix}', true, 'pending')`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-unknown-${uniqueSuffix}'`);
      });
      const restoId = r[0].id;
      const subId = `sub_unknown_${uniqueSuffix}`;

      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, status)
        VALUES ($1, $2, 'pending')
      `, [restoId, subId]);

      // Payload with missing authorization_status
      const payload = {
        type: 'SUBSCRIPTION_AUTH_STATUS',
        event_id: `evt_unknown_${uniqueSuffix}`,
        data: {
          subscription_id: subId,
          authorization_details: {} // missing status!
        }
      };

      const bodyStr = JSON.stringify(payload);
      const timestamp = String(Date.now());
      const validSig = signPayload(bodyStr, timestamp);

      const res = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': validSig
        },
        body: bodyStr
      });

      assert.strictEqual(res.status, 200);

      // Verify mandate remains pending and subscription remains pending
      const checkResto = await query('SELECT mandate_status FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(checkResto[0].mandate_status, 'pending', 'Mandate must NOT be marked active on missing status');

      const checkSub = await query('SELECT status FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      assert.strictEqual(checkSub[0].status, 'pending', 'Subscription must NOT be transitioned to trialing/active');

      // Cleanup
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
      await query('DELETE FROM webhook_events WHERE event_id = $1', [`evt_unknown_${uniqueSuffix}`]);
    });

    // ----------------------------------------------------
    // TEST 8: Webhook idempotency protects against duplicate events
    // ----------------------------------------------------
    await test('8. Duplicate webhook events are ignored idempotently', async () => {
      const uniqueSuffix = Date.now();
      const r = await query(`
        INSERT INTO restaurants (name, slug, active, mandate_status)
        VALUES ('Tenant Idempotent', 'tenant-idem-${uniqueSuffix}', true, 'pending')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Tenant Idempotent', 'tenant-idem-${uniqueSuffix}', true, 'pending')`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-idem-${uniqueSuffix}'`);
      });
      const restoId = r[0].id;
      const subId = `sub_idem_${uniqueSuffix}`;
      const eventId = `evt_idem_${uniqueSuffix}`;

      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, status)
        VALUES ($1, $2, 'trialing')
      `, [restoId, subId]);

      const payload = {
        type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        event_id: eventId,
        data: {
          subscription_id: subId,
          payment_id: `pay_idem_${uniqueSuffix}`,
          payment_amount: 999
        }
      };

      const bodyStr = JSON.stringify(payload);
      const timestamp = String(Date.now());
      const validSig = signPayload(bodyStr, timestamp);

      // Send 1st time
      const res1 = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': validSig },
        body: bodyStr
      });
      const data1 = await res1.json();
      assert.strictEqual(data1.status, 'PROCESSED', 'First event should be PROCESSED');

      // Send 2nd time (duplicate)
      const res2 = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': validSig },
        body: bodyStr
      });
      const data2 = await res2.json();
      assert.strictEqual(data2.status, 'DUPLICATE_IGNORED', 'Second identical event should return DUPLICATE_IGNORED');

      // Verify exactly one payment row exists
      const payments = await query('SELECT COUNT(*) as count FROM payments WHERE gateway_payment_id = $1', [`pay_idem_${uniqueSuffix}`]);
      assert.strictEqual(Number(payments[0].count), 1, 'Duplicate payment row must not be inserted');

      // Cleanup
      await query('DELETE FROM payments WHERE gateway_payment_id = $1', [`pay_idem_${uniqueSuffix}`]);
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
      await query('DELETE FROM webhook_events WHERE event_id = $1', [eventId]);
    });

    // ----------------------------------------------------
    // TEST 9: Out-of-order activation ignored for terminal states
    // ----------------------------------------------------
    await test('9. Out-of-order activation event does not reactivate cancelled subscription', async () => {
      const uniqueSuffix = Date.now();
      const r = await query(`
        INSERT INTO restaurants (name, slug, active, mandate_status)
        VALUES ('Tenant Cancelled Order', 'tenant-term-${uniqueSuffix}', false, 'cancelled')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, mandate_status) VALUES ('Tenant Cancelled Order', 'tenant-term-${uniqueSuffix}', false, 'cancelled')`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-term-${uniqueSuffix}'`);
      });
      const restoId = r[0].id;
      const subId = `sub_term_${uniqueSuffix}`;
      const eventId = `evt_term_${uniqueSuffix}`;

      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, status)
        VALUES ($1, $2, 'cancelled')
      `, [restoId, subId]);

      const payload = {
        type: 'SUBSCRIPTION_STATUS_CHANGED',
        event_id: eventId,
        data: {
          subscription_id: subId,
          subscription_status: 'ACTIVE'
        }
      };

      const bodyStr = JSON.stringify(payload);
      const timestamp = String(Date.now());
      const validSig = signPayload(bodyStr, timestamp);

      const res = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': validSig },
        body: bodyStr
      });

      const data = await res.json();
      assert.strictEqual(data.status, 'IGNORED_OUT_OF_ORDER', 'Out-of-order activation should be IGNORED_OUT_OF_ORDER');

      const checkSub = await query('SELECT status FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      assert.strictEqual(checkSub[0].status, 'cancelled', 'Subscription must remain cancelled');

      // Cleanup
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
      await query('DELETE FROM webhook_events WHERE event_id = $1', [eventId]);
    });

    // ----------------------------------------------------
    // TEST 10: Lower payment amount does not grant higher tier
    // ----------------------------------------------------
    await test('10. Lower payment amount reconciles access without granting higher-tier entitlement', async () => {
      const uniqueSuffix = Date.now();
      const r = await query(`
        INSERT INTO restaurants (name, slug, active, plan_tier, plan_price)
        VALUES ('Tenant Discrepancy', 'tenant-disc-${uniqueSuffix}', true, 'pro', 999)
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, plan_tier, plan_price) VALUES ('Tenant Discrepancy', 'tenant-disc-${uniqueSuffix}', true, 'pro', 999)`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-disc-${uniqueSuffix}'`);
      });
      const restoId = r[0].id;
      const subId = `sub_disc_${uniqueSuffix}`;
      const eventId = `evt_disc_${uniqueSuffix}`;

      // Subscription expected price is 999 (Pro)
      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, plan_id, amount, status)
        VALUES ($1, $2, 2, 999, 'active')
      `, [restoId, subId]);

      // Only paid 499 (Basic price instead of 999)
      const payload = {
        type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        event_id: eventId,
        data: {
          subscription_id: subId,
          payment_id: `pay_disc_${uniqueSuffix}`,
          payment_amount: 499
        }
      };

      const bodyStr = JSON.stringify(payload);
      const timestamp = String(Date.now());
      const validSig = signPayload(bodyStr, timestamp);

      const res = await fetch(`${baseUrl}/webhook/cashfree`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': validSig },
        body: bodyStr
      });

      assert.strictEqual(res.status, 200);

      // Verify payment was recorded with recurring_mismatch
      const payRecord = await query('SELECT payment_type, amount FROM payments WHERE gateway_payment_id = $1', [`pay_disc_${uniqueSuffix}`]);
      assert.strictEqual(payRecord[0].payment_type, 'recurring_mismatch');
      assert.strictEqual(Number(payRecord[0].amount), 499);

      // Verify access period was extended so tenant is not locked out
      const checkResto = await query('SELECT active, plan_expires_at FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(Boolean(checkResto[0].active), true, 'Tenant should remain active for the paid period');
      assert(checkResto[0].plan_expires_at, 'plan_expires_at should be extended');

      // Cleanup
      await query('DELETE FROM payments WHERE gateway_payment_id = $1', [`pay_disc_${uniqueSuffix}`]);
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
      await query('DELETE FROM webhook_events WHERE event_id = $1', [eventId]);
    });

    // ----------------------------------------------------
    // TEST 11: Plan change flags reauthorization_required
    // ----------------------------------------------------
    await test('11. /change-plan reports reauthorization_required when upgrading mandate amount', async () => {
      const uniqueSuffix = Date.now();
      const r = await query(`
        INSERT INTO restaurants (name, slug, active, plan_tier, plan_price, plan_expires_at)
        VALUES ('Tenant Change Plan', 'tenant-cp-${uniqueSuffix}', true, 'basic', 499, CURRENT_TIMESTAMP + INTERVAL '20 days')
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active, plan_tier, plan_price, plan_expires_at) VALUES ('Tenant Change Plan', 'tenant-cp-${uniqueSuffix}', true, 'basic', 499, datetime('now', '+20 days'))`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-cp-${uniqueSuffix}'`);
      });
      const restoId = r[0].id;
      const subId = `sub_cp_${uniqueSuffix}`;

      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, plan_id, amount, status, current_period_end)
        VALUES ($1, $2, 1, 499, 'active', CURRENT_TIMESTAMP + INTERVAL '20 days')
      `, [restoId, subId]).catch(async () => {
        await query(`
          INSERT INTO subscriptions (restaurant_id, gateway_subscription_id, plan_id, amount, status, current_period_end)
          VALUES ($1, $2, 1, 499, 'active', datetime('now', '+20 days'))
        `, [restoId, subId]);
      });

      const token = jwt.sign(
        { id: 8888, username: 'admin_cp', role: 'admin', restaurant_id: restoId },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/change-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: 'pro' })
      });

      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(data)}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.reauthorization_required, true, 'Upgrading to higher plan price must require reauthorization');
      assert.strictEqual(data.effective, 'next_billing_cycle', 'Active subscription plan change must be scheduled for next billing cycle');

      // Cleanup
      await query('DELETE FROM subscriptions WHERE gateway_subscription_id = $1', [subId]);
      await query('DELETE FROM restaurants WHERE id = $1', [restoId]);
    });

    // ----------------------------------------------------
    // TEST 12: Tenant isolation on payment history
    // ----------------------------------------------------
    await test('12. One tenant cannot inspect another tenant\'s payment history or subscription', async () => {
      const uniqueSuffix = Date.now();
      const rA = await query(`
        INSERT INTO restaurants (name, slug, active)
        VALUES ('Tenant Iso A', 'tenant-iso-a-${uniqueSuffix}', true)
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active) VALUES ('Tenant Iso A', 'tenant-iso-a-${uniqueSuffix}', true)`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-iso-a-${uniqueSuffix}'`);
      });
      const rB = await query(`
        INSERT INTO restaurants (name, slug, active)
        VALUES ('Tenant Iso B', 'tenant-iso-b-${uniqueSuffix}', true)
        RETURNING id
      `).catch(async () => {
        await query(`INSERT INTO restaurants (name, slug, active) VALUES ('Tenant Iso B', 'tenant-iso-b-${uniqueSuffix}', true)`);
        return await query(`SELECT id FROM restaurants WHERE slug = 'tenant-iso-b-${uniqueSuffix}'`);
      });

      const idA = rA[0].id;
      const idB = rB[0].id;

      // Insert payment for Tenant A
      await query(`
        INSERT INTO payments (restaurant_id, gateway, gateway_payment_id, amount, currency, status, payment_type)
        VALUES ($1, 'cashfree', 'pay_iso_a_${uniqueSuffix}', 999, 'INR', 'SUCCESS', 'recurring')
      `, [idA]);

      // Generate token for Tenant B
      const tokenB = jwt.sign(
        { id: 7777, username: 'admin_b', role: 'admin', restaurant_id: idB },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/history`, {
        headers: {
          'Authorization': `Bearer ${tokenB}`
        }
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(Array.isArray(data.payments), 'Expected payments array');
      const hasPaymentA = data.payments.some(p => p.gateway_payment_id === `pay_iso_a_${uniqueSuffix}`);
      assert.strictEqual(hasPaymentA, false, 'Tenant B must not see Tenant A payments');

      // Cleanup
      await query('DELETE FROM payments WHERE gateway_payment_id = $1', [`pay_iso_a_${uniqueSuffix}`]);
      await query('DELETE FROM restaurants WHERE id IN ($1, $2)', [idA, idB]);
    });

  } finally {
    server.close();
  }

  console.log(`\n====================================================`);
  console.log(`📊 SECURITY SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSecurityTests().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
