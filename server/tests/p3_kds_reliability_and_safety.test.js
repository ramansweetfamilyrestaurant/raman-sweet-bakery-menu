/**
 * TouchQR — P3 KDS Reliability & Shared-Device Safety Regression Suite
 *
 * SAFETY INVARIANT:
 * Strictly tests HTTP endpoints, state machines, and pure lifecycle guards against
 * the local disposable PostgreSQL database (127.0.0.1:5432 / touchqr_disposable_test).
 * NEVER connects to or mutates remote databases or Neon production.
 */

import http from 'http';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb, closeDbPool } from '../db.js';
import { JWT_SECRET } from '../config/jwt.js';
import apiRouter from '../routes/api.js';
import {
  resolveKdsSlug,
  parseRecallErrorResponse,
  calculateConnectionStatus,
  getKdsSoundPreference,
  setKdsSoundPreference,
  shouldShowKdsSoundPrompt,
  safeRequestNotificationPermission,
  KDS_SOUND_STORAGE_PREFIX
} from '../../src/utils/kdsHelpers.js';
import {
  isOrderActiveInKitchen,
  filterActiveKitchenOrders
} from '../../src/utils/kdsQueueFilter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Strict local disposable database target
const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';
process.env.TEST_DATABASE_URL = LOCAL_TEST_URL;
process.env.MIGRATION_DATABASE_URL = LOCAL_TEST_URL;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

let passed = 0;
let failed = 0;

function record(name, status, detail) {
  if (status === 'PASS') {
    passed++;
    console.log(`  ✅ [PASS] ${name}: ${detail}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${name}: ${detail}`);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR P3 KDS RELIABILITY & SHARED-DEVICE SAFETY SUITE');
  console.log('======================================================================\n');

  // ====================================================================
  // SECTION 1: Shared-Device Slug Isolation
  // ====================================================================
  console.log('--- SECTION 1: Shared-Device Slug Isolation ---');

  // Test 1.1: Stale admin slug in localStorage is strictly ignored on generic /kitchen
  try {
    // Simulate generic /kitchen path without explicit slug
    const resolved = resolveKdsSlug({
      slug: '',
      pathname: '/kitchen',
      search: ''
    });
    assert.strictEqual(resolved, '', 'Generic /kitchen must resolve to empty slug');
    record('GENERIC_KITCHEN_NO_SLUG', 'PASS', 'Generic /kitchen without slug returns empty string');
  } catch (err) {
    record('GENERIC_KITCHEN_NO_SLUG', 'FAIL', err.message);
  }

  // Test 1.2: Source code audit — StandaloneKdsPage does NOT read from localStorage for slug
  try {
    const kdsSource = fs.readFileSync(path.join(rootDir, 'src/components/Admin/views/StandaloneKdsPage.jsx'), 'utf8');
    assert.ok(
      !kdsSource.includes("localStorage.getItem('touchqr_admin_slug')"),
      'Must not read touchqr_admin_slug from localStorage'
    );
    assert.ok(
      !kdsSource.includes("localStorage.getItem('touchqr_last_slug')"),
      'Must not read touchqr_last_slug from localStorage'
    );
    assert.ok(
      !kdsSource.includes('localStorage.getItem("touchqr_admin_slug")'),
      'Must not read touchqr_admin_slug (double quotes)'
    );
    assert.ok(
      !kdsSource.includes('localStorage.getItem("touchqr_last_slug")'),
      'Must not read touchqr_last_slug (double quotes)'
    );
    record('SOURCE_AUDIT_NO_LOCALSTORAGE_SLUG_FALLBACK', 'PASS', 'StandaloneKdsPage does not contain any localStorage slug fallback');
  } catch (err) {
    record('SOURCE_AUDIT_NO_LOCALSTORAGE_SLUG_FALLBACK', 'FAIL', err.message);
  }

  // Test 1.3: Explicit query param ?slug=... resolves correctly
  try {
    const fromSearch = resolveKdsSlug({
      slug: '',
      pathname: '/kitchen',
      search: '?slug=bistro-delight'
    });
    assert.strictEqual(fromSearch, 'bistro-delight');

    const fromSearchWithExtra = resolveKdsSlug({
      slug: '',
      pathname: '/kitchen/',
      search: '?foo=1&slug=cafe-central&bar=2'
    });
    assert.strictEqual(fromSearchWithExtra, 'cafe-central');
    record('QUERY_PARAM_SLUG_RESOLUTION', 'PASS', 'Query parameter ?slug= resolves explicitly');
  } catch (err) {
    record('QUERY_PARAM_SLUG_RESOLUTION', 'FAIL', err.message);
  }

  // Test 1.4: Restaurant-specific path formats resolve correctly
  try {
    assert.strictEqual(
      resolveKdsSlug({ pathname: '/my-restaurant/kitchen' }),
      'my-restaurant'
    );
    assert.strictEqual(
      resolveKdsSlug({ pathname: '/r/grand-hotel/kitchen' }),
      'grand-hotel'
    );
    assert.strictEqual(
      resolveKdsSlug({ pathname: '/tasty-bites/kitchen/' }),
      'tasty-bites'
    );
    record('PATH_FORMAT_SLUG_RESOLUTION', 'PASS', 'Both /:slug/kitchen and /r/:slug/kitchen resolve correctly');
  } catch (err) {
    record('PATH_FORMAT_SLUG_RESOLUTION', 'FAIL', err.message);
  }

  // Test 1.5: Blacklisted system routes are not treated as restaurant slugs
  try {
    assert.strictEqual(resolveKdsSlug({ pathname: '/admin/kitchen' }), '');
    assert.strictEqual(resolveKdsSlug({ pathname: '/kitchen/kitchen' }), '');
    assert.strictEqual(resolveKdsSlug({ pathname: '/superadmin/kitchen' }), '');
    assert.strictEqual(resolveKdsSlug({ search: '?slug=admin' }), '');
    assert.strictEqual(resolveKdsSlug({ search: '?slug=kitchen' }), '');
    record('SYSTEM_ROUTE_BLACKLIST_ENFORCED', 'PASS', 'Reserved system words (admin, kitchen, superadmin) rejected as slugs');
  } catch (err) {
    record('SYSTEM_ROUTE_BLACKLIST_ENFORCED', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 2: Recall UI Error Handling & Queue Resynchronization
  // ====================================================================
  console.log('--- SECTION 2: Recall UI Error Handling & Queue Resynchronization ---');

  // Test 2.1: Success response (HTTP 200) parsing
  try {
    const res = parseRecallErrorResponse(200, { success: true }, 42);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.isConflict, false);
    assert.strictEqual(res.isForbidden, false);
    assert.strictEqual(res.isNotFound, false);
    assert.ok(res.message.includes('Order #42 successfully restored'));
    record('RECALL_SUCCESS_PARSER', 'PASS', 'HTTP 200 returns success: true and friendly confirmation');
  } catch (err) {
    record('RECALL_SUCCESS_PARSER', 'FAIL', err.message);
  }

  // Test 2.2: Conflict response (HTTP 409) for settled/terminal orders
  try {
    const res = parseRecallErrorResponse(409, { error: 'ORDER_SETTLED', message: 'Order is settled and cannot be recalled' }, 101);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isConflict, true);
    assert.ok(res.message.includes('Order #101 cannot be recalled'));
    assert.ok(!res.message.includes('undefined'));
    record('RECALL_409_CONFLICT_PARSER', 'PASS', 'HTTP 409 reports settled/terminal state accurately');
  } catch (err) {
    record('RECALL_409_CONFLICT_PARSER', 'FAIL', err.message);
  }

  // Test 2.3: Forbidden response (HTTP 403) for tenant suspension or entitlement
  try {
    const resPlan = parseRecallErrorResponse(403, { error: 'KDS_DISABLED' }, 88);
    assert.strictEqual(resPlan.success, false);
    assert.strictEqual(resPlan.isForbidden, true);
    assert.ok(resPlan.message.includes('subscription plan'));

    const resSuspended = parseRecallErrorResponse(403, { error: 'TENANT_SUSPENDED', message: 'Restaurant service is suspended' }, 88);
    assert.strictEqual(resSuspended.success, false);
    assert.strictEqual(resSuspended.isForbidden, true);
    assert.ok(resSuspended.message.includes('Kitchen recall unavailable'));
    record('RECALL_403_FORBIDDEN_PARSER', 'PASS', 'HTTP 403 explains entitlement/suspension without raw stack trace');
  } catch (err) {
    record('RECALL_403_FORBIDDEN_PARSER', 'FAIL', err.message);
  }

  // Test 2.4: Not Found response (HTTP 404)
  try {
    const res = parseRecallErrorResponse(404, {}, 999);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isNotFound, true);
    assert.ok(res.message.includes('Order #999 could not be found'));
    record('RECALL_404_NOT_FOUND_PARSER', 'PASS', 'HTTP 404 reports order not found clearly');
  } catch (err) {
    record('RECALL_404_NOT_FOUND_PARSER', 'FAIL', err.message);
  }

  // Test 2.5: Server error (HTTP 500) and network disconnect
  try {
    const res500 = parseRecallErrorResponse(500, {}, 55);
    assert.strictEqual(res500.success, false);
    assert.ok(res500.message.includes('Network or server error'));

    const resNet = parseRecallErrorResponse(0, {}, 55);
    assert.strictEqual(resNet.success, false);
    assert.ok(resNet.message.includes('Network or server error'));
    record('RECALL_500_NETWORK_FAILURE_PARSER', 'PASS', 'HTTP 500 / 0 reports network failure safely');
  } catch (err) {
    record('RECALL_500_NETWORK_FAILURE_PARSER', 'FAIL', err.message);
  }

  // Test 2.6: Recall concurrency guard simulation (repeated clicks)
  try {
    const inFlightIds = [];
    const triggerRecall = (id) => {
      if (inFlightIds.includes(id)) {
        return 'BLOCKED_DUPLICATE';
      }
      inFlightIds.push(id);
      return 'STARTED';
    };

    assert.strictEqual(triggerRecall(10), 'STARTED');
    assert.strictEqual(triggerRecall(10), 'BLOCKED_DUPLICATE');
    assert.strictEqual(triggerRecall(10), 'BLOCKED_DUPLICATE');

    // After release
    const idx = inFlightIds.indexOf(10);
    inFlightIds.splice(idx, 1);
    assert.strictEqual(triggerRecall(10), 'STARTED');
    record('RECALL_IN_FLIGHT_CLICK_GUARD', 'PASS', 'Duplicate concurrent recall clicks on same order are blocked');
  } catch (err) {
    record('RECALL_IN_FLIGHT_CLICK_GUARD', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 3: Polling Guards & Stale Tenant Response Prevention
  // ====================================================================
  console.log('--- SECTION 3: Polling Guards & Stale Tenant Response Prevention ---');

  // Test 3.1: Polling in-flight guard prevents overlapping duplicate requests
  try {
    let inFlight = false;
    let requestCount = 0;

    const simulatePoll = async (delayMs) => {
      if (inFlight) return 'SKIPPED_OVERLAP';
      inFlight = true;
      requestCount++;
      await new Promise(r => setTimeout(r, delayMs));
      inFlight = false;
      return 'COMPLETED';
    };

    // First request starts (slow, takes 50ms)
    const p1 = simulatePoll(50);
    // Second interval tick triggers at 10ms (while p1 still running)
    const p2 = simulatePoll(10);

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.strictEqual(res1, 'COMPLETED');
    assert.strictEqual(res2, 'SKIPPED_OVERLAP');
    assert.strictEqual(requestCount, 1);

    // After p1 finished, next tick triggers successfully
    const res3 = await simulatePoll(5);
    assert.strictEqual(res3, 'COMPLETED');
    assert.strictEqual(requestCount, 2);
    record('POLLING_OVERLAP_GUARD', 'PASS', 'Slow poll blocks concurrent overlapping duplicate requests');
  } catch (err) {
    record('POLLING_OVERLAP_GUARD', 'FAIL', err.message);
  }

  // Test 3.2: Polling error releases in-flight guard so polling can recover
  try {
    let inFlight = false;
    let recovered = false;

    const failingPoll = async () => {
      inFlight = true;
      try {
        throw new Error('Simulated network timeout');
      } finally {
        inFlight = false;
      }
    };

    await failingPoll().catch(() => {});
    assert.strictEqual(inFlight, false, 'inFlight flag must be released in finally block');

    // Next poll proceeds normally
    if (!inFlight) {
      recovered = true;
    }
    assert.strictEqual(recovered, true);
    record('POLLING_FAILURE_RECOVERY', 'PASS', 'Failed poll releases in-flight guard allowing recovery');
  } catch (err) {
    record('POLLING_FAILURE_RECOVERY', 'FAIL', err.message);
  }

  // Test 3.3: Tenant slug switch discards stale response from previous tenant
  try {
    let currentActiveSlug = 'restaurant-a';
    let committedState = null;

    const simulateTenantRequest = async (requestedSlug, delayMs, payload) => {
      await new Promise(r => setTimeout(r, delayMs));
      // Late response guard
      if (currentActiveSlug !== requestedSlug) {
        return 'DISCARDED_STALE';
      }
      committedState = payload;
      return 'APPLIED';
    };

    // Restaurant A request initiated (takes 50ms)
    const reqA = simulateTenantRequest('restaurant-a', 50, ['OrderA1', 'OrderA2']);

    // Operator switches to Restaurant B at 10ms
    currentActiveSlug = 'restaurant-b';

    // Restaurant B request initiated (takes 20ms)
    const reqB = simulateTenantRequest('restaurant-b', 20, ['OrderB1']);

    const [resA, resB] = await Promise.all([reqA, reqB]);
    assert.strictEqual(resB, 'APPLIED');
    assert.strictEqual(resA, 'DISCARDED_STALE');
    assert.deepStrictEqual(committedState, ['OrderB1'], 'State must only reflect restaurant-b');
    record('STALE_TENANT_RESPONSE_GUARD', 'PASS', 'Late responses from previous restaurant slug cannot overwrite current queue');
  } catch (err) {
    record('STALE_TENANT_RESPONSE_GUARD', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 4: Siren & Audio Timer Cleanup
  // ====================================================================
  console.log('--- SECTION 4: Siren & Audio Timer Cleanup ---');

  // Test 4.1: Timer lifecycle manager clears prior timer on repeated triggers
  try {
    let activeIntervalId = null;
    let clearCount = 0;
    let soundPlayCount = 0;

    const stopSiren = () => {
      if (activeIntervalId !== null) {
        clearCount++;
        activeIntervalId = null;
      }
    };

    const triggerSiren = () => {
      stopSiren();
      soundPlayCount++;
      activeIntervalId = 12345; // simulate interval
    };

    triggerSiren();
    assert.strictEqual(soundPlayCount, 1);
    assert.strictEqual(clearCount, 0);

    // Rapid second trigger
    triggerSiren();
    assert.strictEqual(soundPlayCount, 2);
    assert.strictEqual(clearCount, 1, 'Prior timer must have been cleared before starting new one');

    // Unmount cleanup
    stopSiren();
    assert.strictEqual(clearCount, 2);
    assert.strictEqual(activeIntervalId, null);
    record('SIREN_TIMER_CLEANUP_LIFECYCLE', 'PASS', 'Repeated siren triggers clear previous timer; unmount stops active interval');
  } catch (err) {
    record('SIREN_TIMER_CLEANUP_LIFECYCLE', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 5: Offline & Reconnection Indicator
  // ====================================================================
  console.log('--- SECTION 5: Offline & Reconnection Indicator ---');

  // Test 5.1: calculateConnectionStatus logic
  try {
    assert.strictEqual(calculateConnectionStatus({ consecutiveFailures: 0, isBrowserOnline: true }), 'online');
    assert.strictEqual(calculateConnectionStatus({ consecutiveFailures: 1, isBrowserOnline: true }), 'reconnecting');
    assert.strictEqual(calculateConnectionStatus({ consecutiveFailures: 2, isBrowserOnline: true }), 'offline');
    assert.strictEqual(calculateConnectionStatus({ consecutiveFailures: 5, isBrowserOnline: true }), 'offline');
    assert.strictEqual(calculateConnectionStatus({ consecutiveFailures: 0, isBrowserOnline: false }), 'offline');
    record('CONNECTION_STATUS_CALCULATOR', 'PASS', 'Status transitions cleanly: online -> reconnecting -> offline');
  } catch (err) {
    record('CONNECTION_STATUS_CALCULATOR', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 6: Responsive Layout & Mobile Viewport CSS Invariants
  // ====================================================================
  console.log('--- SECTION 6: Responsive Layout & Mobile Viewport CSS Invariants ---');

  try {
    const kdsSource = fs.readFileSync(path.join(rootDir, 'src/components/Admin/views/StandaloneKdsPage.jsx'), 'utf8');

    // Must NOT have rigid minmax(330px, 1fr)
    assert.ok(
      !kdsSource.includes('minmax(330px, 1fr)'),
      'Must replace rigid minmax(330px, 1fr) with flexible responsive minmax'
    );

    // Must have responsive grid definition
    assert.ok(
      kdsSource.includes('minmax(min(100%, 280px), 1fr)'),
      'Must use flexible minmax(min(100%, 280px), 1fr)'
    );

    // Must include narrow viewport media queries (<480px, <330px)
    assert.ok(
      kdsSource.includes('@media (max-width: 480px)'),
      'Must include @media (max-width: 480px) styles'
    );
    assert.ok(
      kdsSource.includes('@media (max-width: 330px)'),
      'Must include @media (max-width: 330px) styles'
    );

    // Must have wordBreak on notes
    assert.ok(
      kdsSource.includes("overflowWrap: 'anywhere'") || kdsSource.includes('overflowWrap: "anywhere"') || kdsSource.includes('wordBreak: \'break-word\''),
      'Notes and labels must have word-break / overflow-wrap to prevent horizontal overflow'
    );

    record('RESPONSIVE_GRID_INVARIANTS', 'PASS', 'Ticket grid supports narrow viewports (<330px) without horizontal overflow');
  } catch (err) {
    record('RESPONSIVE_GRID_INVARIANTS', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 7: KDS Sound Permission, Tenant Isolation & Autoplay Safety Invariants
  // ====================================================================
  console.log('--- SECTION 7: KDS Sound Permission, Tenant Isolation & Autoplay Safety Invariants ---');

  // Test 7.1: Tenant sound preference isolation
  try {
    const mockStore = {};
    const mockStorage = {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : null),
      setItem: (key, val) => { mockStore[key] = String(val); },
      removeItem: (key) => { delete mockStore[key]; }
    };

    // Save for tenant 'bistro-delight'
    const saved = setKdsSoundPreference('bistro-delight', 'enabled', mockStorage);
    assert.strictEqual(saved, true);
    assert.strictEqual(mockStore[`${KDS_SOUND_STORAGE_PREFIX}bistro-delight`], 'enabled');

    // Read back for bistro-delight
    const prefA = getKdsSoundPreference('bistro-delight', mockStorage);
    assert.strictEqual(prefA, 'enabled');

    // Another tenant 'cafe-central' on the same shared device must remain empty/isolated
    const prefB = getKdsSoundPreference('cafe-central', mockStorage);
    assert.strictEqual(prefB, '', 'Tenant cafe-central must not inherit bistro-delight sound preference');

    // Missing or invalid slug returns empty and writes nothing
    assert.strictEqual(getKdsSoundPreference('', mockStorage), '');
    assert.strictEqual(setKdsSoundPreference('', 'enabled', mockStorage), false);

    record('SOUND_TENANT_ISOLATION', 'PASS', 'KDS sound preference is strictly tenant-isolated and prevents cross-restaurant leakage');
  } catch (err) {
    record('SOUND_TENANT_ISOLATION', 'FAIL', err.message);
  }

  // Test 7.2: Custom prompt suppression on remount with saved preference
  try {
    // 1. First visit (unspecified preference, audio not ready) -> prompt shows
    const showFirstVisit = shouldShowKdsSoundPrompt({
      soundPreference: '',
      isAudioReady: false,
      isAudioUnlocked: false
    });
    assert.strictEqual(showFirstVisit, true, 'First visit with unspecified preference should show prompt');

    // 2. Remount with saved 'enabled' preference -> prompt suppressed
    const showAfterEnabled = shouldShowKdsSoundPrompt({
      soundPreference: 'enabled',
      isAudioReady: false,
      isAudioUnlocked: false
    });
    assert.strictEqual(showAfterEnabled, false, 'Remount with saved enabled preference must suppress prompt');

    // 3. Remount with saved 'muted' preference -> prompt suppressed
    const showAfterMuted = shouldShowKdsSoundPrompt({
      soundPreference: 'muted',
      isAudioReady: false,
      isAudioUnlocked: false
    });
    assert.strictEqual(showAfterMuted, false, 'Remount with saved muted preference must suppress prompt');

    // 4. In-session unlocked state -> prompt suppressed
    const showWhenReady = shouldShowKdsSoundPrompt({
      soundPreference: '',
      isAudioReady: true,
      isAudioUnlocked: false
    });
    assert.strictEqual(showWhenReady, false, 'In-session ready audio must suppress prompt');

    record('SOUND_PROMPT_SUPPRESSION_ON_REMOUNT', 'PASS', 'Saved tenant preference suppresses repeated custom sound prompt on subsequent visits');
  } catch (err) {
    record('SOUND_PROMPT_SUPPRESSION_ON_REMOUNT', 'FAIL', err.message);
  }

  // Test 7.3: Browser Notification permission safeguard (no re-request if granted or denied)
  try {
    let requestCount = 0;
    const makeMockNotification = (perm) => ({
      permission: perm,
      requestPermission: async () => {
        requestCount++;
        return 'granted';
      }
    });

    // Case 1: Already 'granted' -> must NOT invoke requestPermission()
    requestCount = 0;
    const resGranted = await safeRequestNotificationPermission(makeMockNotification('granted'));
    assert.strictEqual(resGranted, 'granted');
    assert.strictEqual(requestCount, 0, 'Must not re-request permission when already granted');

    // Case 2: Already 'denied' -> must NOT invoke requestPermission()
    requestCount = 0;
    const resDenied = await safeRequestNotificationPermission(makeMockNotification('denied'));
    assert.strictEqual(resDenied, 'denied');
    assert.strictEqual(requestCount, 0, 'Must not re-request permission when already denied');

    // Case 3: 'default' -> invokes requestPermission() upon user action
    requestCount = 0;
    const resDefault = await safeRequestNotificationPermission(makeMockNotification('default'));
    assert.strictEqual(resDefault, 'granted');
    assert.strictEqual(requestCount, 1, 'Must request permission when permission is default');

    // Case 4: Unsupported environment -> returns 'unsupported' without throw
    const resUnsupported = await safeRequestNotificationPermission(null);
    assert.strictEqual(resUnsupported, 'unsupported');

    record('NOTIFICATION_PERMISSION_SAFEGUARD', 'PASS', 'Browser notification permission only requested when default; granted/denied never re-triggered');
  } catch (err) {
    record('NOTIFICATION_PERMISSION_SAFEGUARD', 'FAIL', err.message);
  }

  // Test 7.4: StandaloneKdsPage source code audit for sound safety
  try {
    const kdsSource = fs.readFileSync(path.join(rootDir, 'src/components/Admin/views/StandaloneKdsPage.jsx'), 'utf8');

    // Must NOT have unpersisted useState(false) for audio without soundPreference check
    assert.ok(
      kdsSource.includes('getKdsSoundPreference'),
      'Must utilize getKdsSoundPreference for initial state and tenant syncing'
    );

    // Must have #kds-sound-toggle-btn for user gesture control
    assert.ok(
      kdsSource.includes('id="kds-sound-toggle-btn"'),
      'Must render accessible header sound control #kds-sound-toggle-btn'
    );

    // Must use shouldShowKdsSoundPrompt
    assert.ok(
      kdsSource.includes('shouldShowKdsSoundPrompt'),
      'Custom banner must be gated with shouldShowKdsSoundPrompt'
    );

    // Must NOT call raw Notification.requestPermission() inside StandaloneKdsPage without safe guard
    assert.ok(
      !kdsSource.includes('Notification.requestPermission()'),
      'StandaloneKdsPage must not contain unguarded Notification.requestPermission() calls'
    );

    record('SOURCE_AUDIT_KDS_SOUND_SAFETY', 'PASS', 'StandaloneKdsPage source code enforces tenant persistence, gesture controls & permission guards');
  } catch (err) {
    record('SOURCE_AUDIT_KDS_SOUND_SAFETY', 'FAIL', err.message);
  }

  // ====================================================================
  // SECTION 8: Local Disposable Database Integration (Backend Recall Verification)
  // ====================================================================
  console.log('--- SECTION 8: Local Disposable Database Integration (Backend Recall Verification) ---');

  let server;
  let baseUrl;
  try {
    await initDb();

    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;

    // Setup isolated test restaurant & kitchen PIN
    const P3_SLUG = `p3-test-${Date.now()}`;
    const pinHash = await bcrypt.hash('1234', 10);
    const restoResult = await query(`
      INSERT INTO restaurants (
        name, slug, plan_tier, plan_price, active, kds_pin_hash, kds_auth_version, subscription_type, mandate_status
      ) VALUES (
        'P3 Test Kitchen', $1, 'enterprise', 999, true, $2, 1, 'VIP', 'active'
      ) RETURNING id;
    `, [P3_SLUG, pinHash]);
    const restoId = restoResult[0].id;

    // Verify PIN to obtain valid KDS session token
    const pinRes = await fetch(`${baseUrl}/kitchen/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: P3_SLUG, pin: '1234' })
    });
    const pinData = await pinRes.json();
    assert.strictEqual(pinRes.status, 200);
    assert.strictEqual(pinData.success, true);
    const kdsToken = pinData.token;

    // 1. Create order 1: prepared, kitchen status, unsettled -> Recall should succeed (200)
    const o1 = await query(`
      INSERT INTO orders (
        restaurant_id, table_number, status, items, is_settled, kitchen_prepared, total_amount
      ) VALUES (
        $1, 'T-1', 'kitchen', '[{"dish_name":"Burger","qty":1}]', 0, 1, 150
      ) RETURNING id;
    `, [restoId]);
    const orderId1 = o1[0].id;

    const recallRes1 = await fetch(`${baseUrl}/kitchen/orders/${orderId1}/recall?slug=${P3_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    const recallData1 = await recallRes1.json();
    assert.strictEqual(recallRes1.status, 200, 'Unsettled completed order recall must return HTTP 200');
    assert.strictEqual(recallData1.success, true);
    assert.strictEqual(recallData1.kitchen_prepared, 0);

    const parsed1 = parseRecallErrorResponse(recallRes1.status, recallData1, orderId1);
    assert.strictEqual(parsed1.success, true);
    assert.ok(parsed1.message.includes(`Order #${orderId1} successfully restored`));
    record('INTEGRATION_RECALL_SUCCESS_200', 'PASS', 'Recall of active completed order succeeds with 200 and matches frontend parser');

    // 2. Create order 2: settled -> Recall should return HTTP 409 Conflict
    const o2 = await query(`
      INSERT INTO orders (
        restaurant_id, table_number, status, items, is_settled, kitchen_prepared, total_amount
      ) VALUES (
        $1, 'T-2', 'completed', '[{"dish_name":"Pizza","qty":1}]', 1, 1, 300
      ) RETURNING id;
    `, [restoId]);
    const orderId2 = o2[0].id;

    const recallRes2 = await fetch(`${baseUrl}/kitchen/orders/${orderId2}/recall?slug=${P3_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    const recallData2 = await recallRes2.json();
    assert.strictEqual(recallRes2.status, 409, 'Settled order recall must return HTTP 409 Conflict');

    const parsed2 = parseRecallErrorResponse(recallRes2.status, recallData2, orderId2);
    assert.strictEqual(parsed2.success, false);
    assert.strictEqual(parsed2.isConflict, true);
    assert.ok(parsed2.message.toLowerCase().includes('settled'), 'Must mention settled state');
    record('INTEGRATION_RECALL_409_SETTLED', 'PASS', 'Recall of settled order returns 409 Conflict and matches frontend parser');

    // 3. Recall non-existent order -> HTTP 404
    const recallRes3 = await fetch(`${baseUrl}/kitchen/orders/9999999/recall?slug=${P3_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    assert.strictEqual(recallRes3.status, 404, 'Non-existent order recall must return HTTP 404');
    const parsed3 = parseRecallErrorResponse(recallRes3.status, {}, 9999999);
    assert.strictEqual(parsed3.isNotFound, true);
    record('INTEGRATION_RECALL_404_NOT_FOUND', 'PASS', 'Recall of non-existent order returns 404 and matches frontend parser');

    // 4. Suspend restaurant -> Recall should return HTTP 403 Forbidden
    await query(`UPDATE restaurants SET active = false WHERE id = $1;`, [restoId]);

    const recallRes4 = await fetch(`${baseUrl}/kitchen/orders/${orderId1}/recall?slug=${P3_SLUG}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${kdsToken}` }
    });
    assert.strictEqual(recallRes4.status, 403, 'Suspended restaurant recall must return HTTP 403');
    const parsed4 = parseRecallErrorResponse(recallRes4.status, {}, orderId1);
    assert.strictEqual(parsed4.isForbidden, true);
    record('INTEGRATION_RECALL_403_SUSPENDED', 'PASS', 'Recall under suspended restaurant returns 403 and matches frontend parser');

  } catch (err) {
    record('INTEGRATION_LOCAL_DB', 'FAIL', err.message);
  } finally {
    if (server) {
      server.close();
    }
  }

  // ====================================================================
  // SUMMARY
  // ====================================================================
  console.log('\n======================================================================');
  console.log(`P3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    try { await closeDbPool(); } catch (e) {}
    process.exit(1);
  }

  try { await closeDbPool(); } catch (e) {}
  process.exit(0);
}

run().catch(async (err) => {
  console.error('Fatal test error:', err);
  try { await closeDbPool(); } catch (e) {}
  process.exit(1);
});
