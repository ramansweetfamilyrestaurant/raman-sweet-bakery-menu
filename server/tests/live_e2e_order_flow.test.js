/**
 * TOUCHQR — LIVE END-TO-END ORDER FLOW TEST SUITE
 *
 * Safely executes the complete order lifecycle against an isolated,
 * disposable local test database (menu_live_e2e_disposable.db).
 *
 * STRICT INVARIANT:
 * Zero production mutations. Strictly gated by testDbGuard.
 */

import path from 'path';
import fs from 'fs';
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DISPOSABLE_DB_FILE = 'menu_live_e2e_disposable.db';
const DISPOSABLE_DB_PATH = path.resolve(DISPOSABLE_DB_FILE);

try {
  if (fs.existsSync(DISPOSABLE_DB_PATH)) {
    fs.unlinkSync(DISPOSABLE_DB_PATH);
  }
} catch (_) {}

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = `sqlite:${DISPOSABLE_DB_FILE}`;
process.env.PORT = '5055';
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

// 1. Validate safety guard
const { validateTestDatabaseUrl } = await import('./testDbGuard.js');
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

// 2. Initialize DB & tables
const { initDb, query, withTransaction, getDbType } = await import('../db.js');
await initDb();

// 3. Import security utilities & express app
const { generateHmacQrToken, normalizeSpaceType, normalizeSpaceNumber } = await import('../utils/qrSecurity.js');
const { generatePresenceToken, generateQrContextHash } = await import('../utils/presenceVerification.js');
const { JWT_SECRET } = await import('../config/jwt.js');
const { default: app } = await import('../index.js');

const BASE_URL = 'http://localhost:5055';

let passed = 0;
let failed = 0;
const results = [];

function record(section, name, success, details = '') {
  if (success) {
    passed++;
    console.log(`  ✅ [PASS] ${section} - ${name} ${details ? `(${details})` : ''}`);
    results.push({ section, name, status: 'PASS', details });
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${section} - ${name}: ${details}`);
    results.push({ section, name, status: 'FAIL', details });
  }
}

// Helper to create a valid presence token for test orders
function createTestPresenceToken(restoId, slug, spaceType, spaceNum, qrToken) {
  const qrHash = generateQrContextHash(slug, spaceType, spaceNum, qrToken);
  return generatePresenceToken({
    verificationToken: 'tq_loc_' + crypto.randomBytes(16).toString('hex'),
    restaurantId: restoId,
    slug,
    spaceType,
    spaceNumber: spaceNum,
    verificationMethod: 'GPS',
    qrContextHash: qrHash,
    expiryMinutes: 20
  });
}

async function run() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR LIVE END-TO-END ORDER LIFECYCLE VERIFICATION');
  console.log('======================================================================\n');
  console.log(`📍 Test Database: Isolated SQLite (${DISPOSABLE_DB_PATH})`);
  console.log(`⚡ Engine       : ${getDbType()}`);
  console.log(`🌐 Target Server: ${BASE_URL}\n`);

  // -------------------------------------------------------------------------
  // STEP 1: PROVISION SYNTHETIC FIXTURES
  // -------------------------------------------------------------------------
  console.log('--- STEP 1: Synthetic Fixtures Provisioning ---');

  const tenantASecret = crypto.randomBytes(32).toString('hex');
  const tenantBSecret = crypto.randomBytes(32).toString('hex');
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const kdsPinAHash = await bcrypt.hash('1234', 10);
  const kdsPinBHash = await bcrypt.hash('5678', 10);

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 86400 * 1000);
  const graceEnd = new Date(now.getTime() + 37 * 86400 * 1000);

  // Tenant A (Demo Restaurant with Counter Enabled)
  const restoARes = await query(`
    INSERT INTO restaurants (
      name, slug, tagline, phone, address, active, plan_tier, plan_price,
      counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
      direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  `, [
    'TouchQR Demo Restaurant', 'touchqr-demo', 'Finest Flavors', '+919876543210',
    '101 Gourmet Ave', 1, 'enterprise', 1999,
    1, 10, tenantASecret, kdsPinAHash, 1,
    1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
  ]);
  const restoAId = restoARes.lastInsertRowid || 1;

  // Insert active subscription for Tenant A
  await query(`
    INSERT INTO subscriptions (
      restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
      trial_start, trial_end, current_period_start, current_period_end, grace_period_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    restoAId, 3, 'none', 'active', 1999, 'INR', 'monthly',
    now.toISOString(), trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
  ]);

  // Tenant A Admin
  await query(`
    INSERT INTO admins (restaurant_id, username, password_hash, role)
    VALUES ($1, $2, $3, $4)
  `, [restoAId, 'demo_admin', adminPasswordHash, 'restaurant_admin']);

  // Tenant A Categories & Dishes
  const cat1Res = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoAId, 'Starters', 1]);
  const cat1Id = cat1Res.lastInsertRowid || 1;
  const cat2Res = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoAId, 'Main Course', 1]);
  const cat2Id = cat2Res.lastInsertRowid || 2;
  const cat3Res = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoAId, 'Desserts', 1]);
  const cat3Id = cat3Res.lastInsertRowid || 3;

  const dish1Res = await query(`
    INSERT INTO dishes (restaurant_id, category_id, name, price, type, available)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [restoAId, cat1Id, 'Crispy Paneer Tikka', 250, 'veg', 1]);
  const dish1Id = dish1Res.lastInsertRowid || 1;

  const dish2Res = await query(`
    INSERT INTO dishes (restaurant_id, category_id, name, price, type, available)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [restoAId, cat2Id, 'Butter Chicken Special', 350, 'nonveg', 1]);
  const dish2Id = dish2Res.lastInsertRowid || 2;

  const dish3Res = await query(`
    INSERT INTO dishes (restaurant_id, category_id, name, price, type, available)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [restoAId, cat3Id, 'Gulab Jamun with Ice Cream', 120, 'veg', 1]);
  const dish3Id = dish3Res.lastInsertRowid || 3;

  // Tenant B (Tenant B Bistro with Counter DISABLED)
  const restoBRes = await query(`
    INSERT INTO restaurants (
      name, slug, tagline, phone, address, active, plan_tier, plan_price,
      counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
      direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  `, [
    'Tenant B Bistro', 'tenant-b-bistro', 'Artisanal Cafe', '+919876543211',
    '202 High St', 1, 'enterprise', 1999,
    0, 5, tenantBSecret, kdsPinBHash, 1,
    1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
  ]);
  const restoBId = restoBRes.lastInsertRowid || 2;

  // Insert active subscription for Tenant B
  await query(`
    INSERT INTO subscriptions (
      restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
      trial_start, trial_end, current_period_start, current_period_end, grace_period_expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    restoBId, 3, 'none', 'active', 1999, 'INR', 'monthly',
    now.toISOString(), trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
  ]);

  await query(`
    INSERT INTO admins (restaurant_id, username, password_hash, role)
    VALUES ($1, $2, $3, $4)
  `, [restoBId, 'tenant_b_admin', adminPasswordHash, 'restaurant_admin']);

  const catBRes = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoBId, 'Beverages', 1]);
  const catBId = catBRes.lastInsertRowid || 4;

  const dishBRes = await query(`
    INSERT INTO dishes (restaurant_id, category_id, name, price, type, available)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [restoBId, catBId, 'Iced Espresso', 150, 'veg', 1]);
  const dishBId = dishBRes.lastInsertRowid || 4;

  record('SETUP', 'Synthetic tenants, admins, categories, and dishes provisioned', true);

  // Start HTTP server on port 5055
  const server = await new Promise((resolve) => {
    const s = app.listen(5055, () => {
      console.log('⚡ Live HTTP server listening on http://localhost:5055\n');
      resolve(s);
    });
  });

  try {
    // -------------------------------------------------------------------------
    // STEP 2: EXECUTE CUSTOMER ORDER FLOW (DINE-IN & COUNTER)
    // -------------------------------------------------------------------------
    console.log('--- STEP 2: Customer Order Flow ---');

    // 2.1 Load restaurant info
    const infoRes = await fetch(`${BASE_URL}/api/info?slug=touchqr-demo`);
    const infoData = await infoRes.json();
    assert.strictEqual(infoRes.status, 200);
    assert.strictEqual(infoData.name, 'TouchQR Demo Restaurant');
    assert.strictEqual(Boolean(infoData.counter_ordering_enabled), true);
    record('CUSTOMER', '2.1 Load restaurant info for Tenant A (touchqr-demo)', true);

    // 2.2 Dine-in Order at Table 1 with valid HMAC QR token & presence token
    const table1Token = generateHmacQrToken('touchqr-demo', 'table', '1', tenantASecret);
    assert.strictEqual(table1Token.length, 64);

    const table1Presence = createTestPresenceToken(restoAId, 'touchqr-demo', 'table', '1', table1Token);

    const dineInPayload = {
      slug: 'touchqr-demo',
      table_number: '1',
      space_type: 'table',
      table_token: table1Token,
      presence_token: table1Presence,
      customer_name: 'Priya Sharma',
      customer_phone: '9876543210',
      items: [
        { dish_id: dish1Id, name: 'Crispy Paneer Tikka', price: 250, quantity: 1 },
        { dish_id: dish2Id, name: 'Butter Chicken Special', price: 350, quantity: 1 }
      ],
      total_amount: 600
    };

    const customerSession1 = 'cust_sess_token_abc1234567890';
    const dineInRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': customerSession1
      },
      body: JSON.stringify(dineInPayload)
    });

    const dineInData = await dineInRes.json();
    assert.ok([200, 201].includes(dineInRes.status), `Expected 200/201, got ${dineInRes.status}: ${JSON.stringify(dineInData)}`);
    const dineInOrderId = dineInData.order_id || dineInData.orderId;
    const dineInTrackingToken = dineInData.tracking_token;
    assert.ok(dineInOrderId, 'Response must include order_id');
    assert.ok(dineInTrackingToken, 'Response must include tracking_token');
    assert.strictEqual(dineInTrackingToken.length, 32, 'Tracking token must be 32 hex chars');

    record('CUSTOMER', '2.2 Create dine-in table 1 order with signed QR route', true, `OrderID: ${dineInOrderId}`);

    // Verify DB record for dine-in order
    const dineInDbRows = await query('SELECT * FROM orders WHERE id = $1', [dineInOrderId]);
    assert.strictEqual(dineInDbRows.length, 1);
    const dineInOrderRow = dineInDbRows[0];
    assert.strictEqual(dineInOrderRow.restaurant_id, restoAId);
    assert.strictEqual(dineInOrderRow.table_number, '1');
    assert.strictEqual(Number(dineInOrderRow.total_amount), 600);
    assert.strictEqual(dineInOrderRow.status, 'pending');
    assert.strictEqual(dineInOrderRow.is_settled, 0);
    assert.ok(dineInOrderRow.tracking_token_hash, 'Must persist SHA-256 hash in DB');
    const expectedHash = crypto.createHash('sha256').update(dineInTrackingToken).digest('hex');
    assert.strictEqual(dineInOrderRow.tracking_token_hash, expectedHash, 'DB hash must match SHA-256 of tracking_token');
    record('CUSTOMER', '2.3 Verify persisted order record, amounts, status, and tracking_token_hash', true);

    // 2.4 Authenticated Customer Order Tracking
    const trackRes = await fetch(`${BASE_URL}/api/orders/track/${dineInOrderId}?slug=touchqr-demo`, {
      headers: { 'X-Order-Tracking-Token': dineInTrackingToken }
    });
    const trackData = await trackRes.json();
    assert.strictEqual(trackRes.status, 200);
    assert.strictEqual(trackData.id, dineInOrderId);
    assert.strictEqual(trackData.status, 'pending');
    assert.strictEqual(trackData.tracking_token_hash, undefined, 'Sensitive hash must be scrubbed from client response');
    record('CUSTOMER', '2.4 Authenticated order tracking with X-Order-Tracking-Token (scrubbed hash)', true);

    // 2.5 Unauthorized Tracking Attacks
    // Attack A: Missing token
    const unauthNoTokenRes = await fetch(`${BASE_URL}/api/orders/track/${dineInOrderId}?slug=touchqr-demo`);
    assert.strictEqual(unauthNoTokenRes.status, 401, 'Must reject missing tracking token with 401');

    // Attack B: Corrupt / Invalid token
    const unauthBadTokenRes = await fetch(`${BASE_URL}/api/orders/track/${dineInOrderId}?slug=touchqr-demo`, {
      headers: { 'X-Order-Tracking-Token': 'deadbeef00000000deadbeef00000000' }
    });
    assert.strictEqual(unauthBadTokenRes.status, 403, 'Must reject invalid tracking token with 403');

    // Attack C: Query parameter fallback attempt (?token=...)
    const unauthQueryRes = await fetch(`${BASE_URL}/api/orders/track/${dineInOrderId}?slug=touchqr-demo&token=${dineInTrackingToken}`);
    assert.strictEqual(unauthQueryRes.status, 401, 'Must reject query parameter token fallback');

    // Attack D: Other customer's tracking token
    const dummyOtherToken = crypto.randomBytes(16).toString('hex');
    const unauthOtherRes = await fetch(`${BASE_URL}/api/orders/track/${dineInOrderId}?slug=touchqr-demo`, {
      headers: { 'X-Order-Tracking-Token': dummyOtherToken }
    });
    assert.strictEqual(unauthOtherRes.status, 403, 'Must reject unassociated customer tracking token');
    record('CUSTOMER', '2.5 Unauthorized tracking rejections (missing, invalid, query-fallback, mismatch)', true);

    // 2.6 Counter Order Flow
    const counterToken = generateHmacQrToken('touchqr-demo', 'counter', 'COUNTER', tenantASecret);
    const counterPresence = createTestPresenceToken(restoAId, 'touchqr-demo', 'counter', 'COUNTER', counterToken);

    const counterPayload = {
      slug: 'touchqr-demo',
      table_number: 'COUNTER',
      space_type: 'counter',
      table_token: counterToken,
      presence_token: counterPresence,
      customer_name: 'Rahul Verma',
      customer_phone: '9812345678',
      items: [
        { dish_id: dish3Id, name: 'Gulab Jamun with Ice Cream', price: 120, quantity: 2 }
      ],
      total_amount: 240
    };

    const customerSession2 = 'cust_sess_token_xyz9876543210';
    const counterRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': customerSession2
      },
      body: JSON.stringify(counterPayload)
    });

    const counterData = await counterRes.json();
    assert.ok([200, 201].includes(counterRes.status), `Expected 200/201 for counter order, got ${counterRes.status}`);
    const counterOrderId = counterData.order_id || counterData.orderId;
    const counterTrackingToken = counterData.tracking_token;
    assert.ok(counterOrderId);
    assert.ok(counterTrackingToken);

    const counterDbRows = await query('SELECT * FROM orders WHERE id = $1', [counterOrderId]);
    assert.strictEqual(counterDbRows.length, 1);
    assert.strictEqual(counterDbRows[0].table_number.toLowerCase(), 'counter');
    assert.strictEqual(counterDbRows[0].status, 'pending');
    assert.strictEqual(counterDbRows[0].sent_to_kds, 0, 'Counter order must NOT start in KDS');
    assert.strictEqual(counterDbRows[0].is_settled, 0);

    // Verify counter active-table isolation: counter orders never bleed into active dining table session
    const activeTableRes = await fetch(`${BASE_URL}/api/orders/active-table?slug=touchqr-demo&space_type=counter&table=COUNTER`);
    const activeTableData = await activeTableRes.json();
    assert.ok(activeTableData === null || activeTableData?.active === false, 'Counter space must return active: false / null for table session');
    record('CUSTOMER', '2.6 Valid signed counter QR order creation & active-table isolation', true, `Counter OrderID: ${counterOrderId}`);

    // -------------------------------------------------------------------------
    // STEP 3: RESTAURANT ADMIN AND KDS FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Restaurant Admin and KDS Flow ---');

    // 3.1 Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo_admin', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200);
    assert.ok(adminLoginData.token, 'Admin login must return JWT token');
    const adminToken = adminLoginData.token;
    record('ADMIN', '3.1 Admin Login with synthetic credentials (demo_admin)', true);

    // 3.2 Verify orders appear in Admin Dashboard
    const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders?scope=live`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminOrdersData = await adminOrdersRes.json();
    assert.strictEqual(adminOrdersRes.status, 200);
    const liveOrders = adminOrdersData.orders || adminOrdersData;
    const foundDineIn = liveOrders.find(o => o.id === dineInOrderId);
    const foundCounter = liveOrders.find(o => o.id === counterOrderId);
    assert.ok(foundDineIn, 'Dine-in order must appear in admin orders');
    assert.ok(foundCounter, 'Counter order must appear in admin orders');
    assert.strictEqual(Number(foundDineIn.total_amount), 600);
    assert.strictEqual(Number(foundCounter.total_amount), 240);
    record('ADMIN', '3.2 Verify orders appear in Admin dashboard with correct totals and items', true);

    // 3.3 Counter Order Kitchen Authorization Guard
    // Direct prohibited transition without acknowledgement
    const directKitchenRes = await fetch(`${BASE_URL}/api/admin/orders/${counterOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'preparing' })
    });
    assert.strictEqual(directKitchenRes.status, 400, 'Direct transition to kitchen without counter acknowledgement must be rejected (400)');
    const directErrData = await directKitchenRes.json();
    assert.strictEqual(directErrData.error, 'counter_acknowledgement_required');
    record('ADMIN', '3.3 Reject direct kitchen transition without counter staff acknowledgement (400)', true);

    // 3.4 Authorized Staff Counter Acknowledgement
    const ackRes = await fetch(`${BASE_URL}/api/admin/orders/${counterOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'preparing',
        sent_to_kds: 1,
        counter_acknowledgement: {
          confirmed: true,
          staff_notes: 'Acknowledged and verified at billing desk'
        }
      })
    });
    assert.strictEqual(ackRes.status, 200, 'Acknowledged counter order transition must succeed');
    const ackDbRows = await query('SELECT status, sent_to_kds FROM orders WHERE id = $1', [counterOrderId]);
    assert.strictEqual(ackDbRows[0].status, 'preparing');
    assert.strictEqual(ackDbRows[0].sent_to_kds, 1);
    record('ADMIN', '3.4 Acknowledge counter order via staff workflow & route to kitchen', true);

    // 3.5 KDS Screen Flow
    // Kitchen screen PIN verification
    const kdsPinRes = await fetch(`${BASE_URL}/api/kitchen/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'touchqr-demo', pin: '1234' })
    });
    const kdsPinData = await kdsPinRes.json();
    assert.strictEqual(kdsPinRes.status, 200);
    assert.ok(kdsPinData.token, 'KDS PIN auth must return token');
    const kdsToken = kdsPinData.token;

    // Fetch KDS orders
    const kdsOrdersRes = await fetch(`${BASE_URL}/api/kitchen/orders?slug=touchqr-demo`, {
      headers: { Authorization: `Bearer ${kdsToken}` }
    });
    const kdsOrdersData = await kdsOrdersRes.json();
    assert.strictEqual(kdsOrdersRes.status, 200);
    const kdsList = Array.isArray(kdsOrdersData) ? kdsOrdersData : (kdsOrdersData.orders || []);
    assert.ok(kdsList.some(o => o.id === counterOrderId), 'Acknowledged counter order must appear in KDS queue');
    record('KDS', '3.5 KDS Login via 4-digit PIN (1234) & verify order presence in KDS queue', true);

    // 3.6 Progress Kitchen Status: preparing -> ready -> completed
    const prepRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'preparing' })
    });
    assert.strictEqual(prepRes.status, 200);

    const readyRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'ready', kitchen_prepared: 1 })
    });
    assert.strictEqual(readyRes.status, 200);

    const compRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'completed' })
    });
    assert.strictEqual(compRes.status, 200);

    // Verify Customer Tracking view receives the 'completed' status
    const trackCompletedRes = await fetch(`${BASE_URL}/api/orders/track/${dineInOrderId}?slug=touchqr-demo`, {
      headers: { 'X-Order-Tracking-Token': dineInTrackingToken }
    });
    const trackCompletedData = await trackCompletedRes.json();
    assert.strictEqual(trackCompletedData.status, 'completed');
    record('ADMIN/KDS', '3.6 Progress order through preparing -> ready -> completed & verify in tracking', true);

    // 3.7 Decoupled Fulfillment & Settlement Invariant
    // CRITICAL: Completing fulfillment does NOT automatically mark bill as paid!
    const postCompDbRows = await query('SELECT status, is_settled FROM orders WHERE id = $1', [dineInOrderId]);
    assert.strictEqual(postCompDbRows[0].status, 'completed');
    assert.strictEqual(postCompDbRows[0].is_settled, 0, 'Completing fulfillment MUST leave is_settled = 0 (unsettled)');
    record('SETTLEMENT', '3.7 Completion of fulfillment strictly preserves is_settled = 0 (decoupled)', true);

    // 3.8 Explicit Authorized Staff Settlement
    const settleRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        settle: {
          method: 'cash'
        }
      })
    });
    assert.strictEqual(settleRes.status, 200);
    const postSettleDbRows = await query('SELECT status, is_settled, payment_method FROM orders WHERE id = $1', [dineInOrderId]);
    assert.strictEqual(postSettleDbRows[0].is_settled, 1, 'Order must now be settled');
    assert.strictEqual(postSettleDbRows[0].payment_method, 'cash', 'Payment method must be cash');
    record('SETTLEMENT', '3.8 Explicit staff settlement records is_settled = 1 in database', true);

    // -------------------------------------------------------------------------
    // STEP 4: SUPERADMIN AND TENANT-ISOLATION FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: Superadmin and Tenant Isolation Flow ---');

    // 4.1 Superadmin Login
    const superLoginRes = await fetch(`${BASE_URL}/api/superadmin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'superadmin123' })
    });
    const superLoginData = await superLoginRes.json();
    assert.strictEqual(superLoginRes.status, 200);
    assert.ok(superLoginData.token, 'Superadmin login must return token');
    const superadminToken = superLoginData.token;
    record('SUPERADMIN', '4.1 Master Superadmin login (superadmin / superadmin123)', true);

    // 4.2 Superadmin Tenant Overview
    const superRestosRes = await fetch(`${BASE_URL}/api/superadmin/restaurants`, {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    const superRestosData = await superRestosRes.json();
    assert.strictEqual(superRestosRes.status, 200);
    const restosList = superRestosData.restaurants || superRestosData;
    assert.ok(restosList.some(r => r.slug === 'touchqr-demo'), 'Tenant A must appear in superadmin view');
    assert.ok(restosList.some(r => r.slug === 'tenant-b-bistro'), 'Tenant B must appear in superadmin view');
    record('SUPERADMIN', '4.2 Superadmin tenant fleet overview shows Tenant A & Tenant B', true);

    // 4.3 Tenant Isolation: Tenant B admin cannot see Tenant A's orders
    const tenantBLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tenant_b_admin', password: 'admin123' })
    });
    const tenantBLoginData = await tenantBLoginRes.json();
    assert.strictEqual(tenantBLoginRes.status, 200);
    const tenantBToken = tenantBLoginData.token;

    const tenantBOrdersRes = await fetch(`${BASE_URL}/api/admin/orders?scope=live`, {
      headers: { Authorization: `Bearer ${tenantBToken}` }
    });
    const tenantBOrdersData = await tenantBOrdersRes.json();
    const bOrders = tenantBOrdersData.orders || tenantBOrdersData;
    assert.strictEqual(bOrders.some(o => o.id === dineInOrderId), false, 'Tenant A order must NOT be visible to Tenant B');
    assert.strictEqual(bOrders.some(o => o.id === counterOrderId), false, 'Tenant A counter order must NOT be visible to Tenant B');
    record('ISOLATION', '4.3 Tenant B admin orders query strictly excludes Tenant A orders', true);

    // 4.4 Cross-Tenant Status Tampering Attempt
    const crossTenantPatchRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantBToken}`
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    // Server must reject (403 or 404)
    assert.ok([403, 404].includes(crossTenantPatchRes.status), `Cross-tenant PATCH must be rejected with 403/404, got ${crossTenantPatchRes.status}`);
    record('ISOLATION', '4.4 Cross-tenant status tampering attempt rejected (403/404)', true);

    // 4.5 Customer attempt to access privileged admin/superadmin routes
    const custAdminAttempt = await fetch(`${BASE_URL}/api/admin/orders`);
    assert.strictEqual(custAdminAttempt.status, 401, 'Customer without token hitting /api/admin/orders must get 401');

    const custSuperAttempt = await fetch(`${BASE_URL}/api/superadmin/restaurants`);
    assert.strictEqual(custSuperAttempt.status, 401, 'Customer without token hitting /api/superadmin/restaurants must get 401');
    record('ISOLATION', '4.5 Anonymous customer access to admin/superadmin routes rejected (401)', true);

    // 4.6 Privileged access does not expose raw tracking tokens
    assert.strictEqual(foundDineIn.tracking_token, undefined, 'Admin orders list must NOT leak raw tracking token');
    record('ISOLATION', '4.6 Admin dashboard data never exposes raw tracking tokens', true);

    // -------------------------------------------------------------------------
    // STEP 5: RETRY, IDEMPOTENCY, AND FAILURE SCENARIOS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Retry, Idempotency, and Failure Scenarios ---');

    // 5.1 Immediate Client Retry / Double-Click with same Idempotency Key
    const idempKey1 = 'idemp_key_double_click_test_001';
    const retrySession = 'retry_customer_session_777';
    const table2Token = generateHmacQrToken('touchqr-demo', 'table', '2', tenantASecret);
    const table2Presence = createTestPresenceToken(restoAId, 'touchqr-demo', 'table', '2', table2Token);

    const retryPayload = {
      slug: 'touchqr-demo',
      table_number: '2',
      space_type: 'table',
      table_token: table2Token,
      presence_token: table2Presence,
      customer_name: 'Amit Patel',
      customer_phone: '9988776655',
      items: [{ dish_id: dish1Id, name: 'Crispy Paneer Tikka', price: 250, quantity: 1 }],
      total_amount: 250
    };

    // First attempt
    const firstAttemptRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': retrySession,
        'X-Idempotency-Key': idempKey1
      },
      body: JSON.stringify(retryPayload)
    });
    const firstAttemptData = await firstAttemptRes.json();
    assert.ok([200, 201].includes(firstAttemptRes.status));
    const initialOrderId = firstAttemptData.order_id || firstAttemptData.orderId;

    // Simulated double-click retry
    const retryAttemptRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': retrySession,
        'X-Idempotency-Key': idempKey1
      },
      body: JSON.stringify(retryPayload)
    });
    const retryAttemptData = await retryAttemptRes.json();
    assert.ok([200, 201].includes(retryAttemptRes.status));
    const retriedOrderId = retryAttemptData.order_id || retryAttemptData.orderId;
    assert.strictEqual(retriedOrderId, initialOrderId, 'Retry must return same orderId without duplicating');

    // Verify DB count: exactly ONE order row created for Table 2
    const table2Rows = await query("SELECT * FROM orders WHERE table_number = '2' AND restaurant_id = $1", [restoAId]);
    assert.strictEqual(table2Rows.length, 1, 'Exactly one order row must exist in DB for double-click');
    record('IDEMPOTENCY', '5.1 Double-click / retry with same Idempotency Key returns same order and creates exactly 1 DB record', true);

    // 5.2 Two Independent Customers Using Same Custom Idempotency Key
    // Customer 1 and Customer 2 send same custom key but distinct session/identity
    const sharedCustomKey = 'client_fixed_custom_uuid_888';
    const table3Token = generateHmacQrToken('touchqr-demo', 'table', '3', tenantASecret);
    const table3Presence = createTestPresenceToken(restoAId, 'touchqr-demo', 'table', '3', table3Token);

    const table4Token = generateHmacQrToken('touchqr-demo', 'table', '4', tenantASecret);
    const table4Presence = createTestPresenceToken(restoAId, 'touchqr-demo', 'table', '4', table4Token);

    const cust1Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': 'cust_session_alpha_111',
        'X-Idempotency-Key': sharedCustomKey
      },
      body: JSON.stringify({
        slug: 'touchqr-demo',
        table_number: '3',
        space_type: 'table',
        table_token: table3Token,
        presence_token: table3Presence,
        customer_name: 'Customer Alpha',
        items: [{ dish_id: dish1Id, name: 'Crispy Paneer Tikka', price: 250, quantity: 1 }],
        total_amount: 250
      })
    });
    const cust1Data = await cust1Res.json();
    assert.ok([200, 201].includes(cust1Res.status));
    const cust1OrderId = cust1Data.order_id || cust1Data.orderId;

    const cust2Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': 'cust_session_beta_222',
        'X-Idempotency-Key': sharedCustomKey
      },
      body: JSON.stringify({
        slug: 'touchqr-demo',
        table_number: '4',
        space_type: 'table',
        table_token: table4Token,
        presence_token: table4Presence,
        customer_name: 'Customer Beta',
        items: [{ dish_id: dish1Id, name: 'Crispy Paneer Tikka', price: 250, quantity: 1 }],
        total_amount: 250
      })
    });
    const cust2Data = await cust2Res.json();
    assert.ok([200, 201].includes(cust2Res.status));
    const cust2OrderId = cust2Data.order_id || cust2Data.orderId;

    assert.notStrictEqual(cust1OrderId, cust2OrderId, 'Two independent customers MUST receive distinct order IDs');
    assert.notStrictEqual(cust1Data.tracking_token, cust2Data.tracking_token, 'Two independent customers MUST receive distinct tracking tokens');
    record('IDEMPOTENCY', '5.2 Two independent customers with same custom idempotency key receive distinct orders & tokens', true);

    // 5.3 Two Tenants Using Same Custom Idempotency Key
    const tenantKey = 'shared_tenant_idemp_key_999';
    const table5Token = generateHmacQrToken('touchqr-demo', 'table', '5', tenantASecret);
    const table5Presence = createTestPresenceToken(restoAId, 'touchqr-demo', 'table', '5', table5Token);

    const tenantBTable1Token = generateHmacQrToken('tenant-b-bistro', 'table', '1', tenantBSecret);
    const tenantBTable1Presence = createTestPresenceToken(restoBId, 'tenant-b-bistro', 'table', '1', tenantBTable1Token);

    const orderTenantARes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': 'cust_tenant_a_session',
        'X-Idempotency-Key': tenantKey
      },
      body: JSON.stringify({
        slug: 'touchqr-demo',
        table_number: '5',
        space_type: 'table',
        table_token: table5Token,
        presence_token: table5Presence,
        customer_name: 'Tenant A Diner',
        items: [{ dish_id: dish1Id, name: 'Crispy Paneer Tikka', price: 250, quantity: 1 }],
        total_amount: 250
      })
    });
    const orderTenantAData = await orderTenantARes.json();

    const orderTenantBRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Customer-Session': 'cust_tenant_b_session',
        'X-Idempotency-Key': tenantKey
      },
      body: JSON.stringify({
        slug: 'tenant-b-bistro',
        table_number: '1',
        space_type: 'table',
        table_token: tenantBTable1Token,
        presence_token: tenantBTable1Presence,
        customer_name: 'Tenant B Diner',
        items: [{ dish_id: dishBId, name: 'Iced Espresso', price: 150, quantity: 1 }],
        total_amount: 150
      })
    });
    const orderTenantBData = await orderTenantBRes.json();
    assert.ok([200, 201].includes(orderTenantARes.status));
    assert.ok([200, 201].includes(orderTenantBRes.status));
    const orderTenantAId = orderTenantAData.order_id || orderTenantAData.orderId;
    const orderTenantBId = orderTenantBData.order_id || orderTenantBData.orderId;
    assert.notStrictEqual(orderTenantAId, orderTenantBId);
    record('IDEMPOTENCY', '5.3 Two tenants using same custom idempotency key maintain strict tenant scoping', true);

    // 5.4 Duplicate Settlement Idempotency
    const dupSettleRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        settle: {
          method: 'cash'
        }
      })
    });
    assert.strictEqual(dupSettleRes.status, 200, 'Duplicate settlement attempt must return idempotent 200');
    const dupSettleDbRows = await query('SELECT is_settled FROM orders WHERE id = $1', [dineInOrderId]);
    assert.strictEqual(dupSettleDbRows[0].is_settled, 1);
    record('SETTLEMENT', '5.4 Duplicate payment settlement attempts succeed idempotently without corruption', true);

    // 5.5 Prohibit Reopening Terminal Settled Order
    const reopenRes = await fetch(`${BASE_URL}/api/admin/orders/${dineInOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'preparing' })
    });
    assert.strictEqual(reopenRes.status, 400, 'Reopening a terminal settled order must be rejected (400)');
    record('SETTLEMENT', '5.5 Prohibit reopening terminal settled order back to active state (400)', true);

    // -------------------------------------------------------------------------
    // STEP 6: VERIFY DATABASE AND AUDIT RECORDS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Verify Database and Audit Records ---');

    const totalOrdersRes = await query('SELECT COUNT(*) as cnt FROM orders');
    const totalOrders = Number(totalOrdersRes[0].cnt || 0);
    assert.ok(totalOrders >= 5, `Expected at least 5 orders created across scenarios, got ${totalOrders}`);

    const settledOrdersRes = await query('SELECT COUNT(*) as cnt FROM orders WHERE is_settled = 1');
    const settledOrders = Number(settledOrdersRes[0].cnt || 0);
    assert.strictEqual(settledOrders, 1, 'Exactly one order was explicitly settled');

    const auditRows = await query('SELECT * FROM audit_logs ORDER BY id ASC');
    assert.ok(auditRows.length > 0, 'Privileged staff actions must generate audit log entries');
    record('AUDIT', '6.1 Verified database integrity: order records, settlement count, and audit entries', true, `Total Orders: ${totalOrders}, Audit Logs: ${auditRows.length}`);

  } finally {
    server.close();
    console.log('\n⚡ Test HTTP server stopped.');
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

await run();
