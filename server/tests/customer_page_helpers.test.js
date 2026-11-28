import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  isFlagEnabled,
  isCustomDomainHost,
  parseCustomerSpaceFromLocation,
  isCustomerSpaceValid,
  buildScopedStorageKey
} from '../../src/utils/customerHelpers.js';
import { generateHmacQrToken, verifyQrToken } from '../utils/qrSecurity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

async function runTests() {
  let passed = 0;
  function test(name, fn) {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  }
  async function testAsync(name, fn) {
    await fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  }

  test('isFlagEnabled normalizes booleans, integers, strings, and fallbacks', () => {
    assert.equal(isFlagEnabled(true, false), true);
    assert.equal(isFlagEnabled(1, false), true);
    assert.equal(isFlagEnabled('1', false), true);
    assert.equal(isFlagEnabled('true', false), true);
    assert.equal(isFlagEnabled(false, true), false);
    assert.equal(isFlagEnabled(0, true), false);
    assert.equal(isFlagEnabled('0', true), false);
    assert.equal(isFlagEnabled('false', true), false);
    assert.equal(isFlagEnabled('FALSE', true), false);
    assert.equal(isFlagEnabled(null, true), true);
    assert.equal(isFlagEnabled(undefined, false), false);
  });

  test('isCustomDomainHost uses boundary-aware matching for platform and local hosts', () => {
    assert.equal(isCustomDomainHost('menu.spicevilla.in'), true);
    assert.equal(isCustomDomainHost('order.mycafe.com:443'), true);
    assert.equal(isCustomDomainHost('touchqrbistro.com'), true);
    assert.equal(isCustomDomainHost('touchqr.restaurant.com'), true);
    assert.equal(isCustomDomainHost('localhostel.com'), true);
    assert.equal(isCustomDomainHost('my-vercel-app-clone.com'), true);
    assert.equal(isCustomDomainHost('touchqr.in'), false);
    assert.equal(isCustomDomainHost('www.touchqr.in'), false);
    assert.equal(isCustomDomainHost('app.touchqr.in'), false);
    assert.equal(isCustomDomainHost('touchqr.com'), false);
    assert.equal(isCustomDomainHost('sub.touchqr.com'), false);
    assert.equal(isCustomDomainHost('demo.vercel.app'), false);
    assert.equal(isCustomDomainHost('localhost'), false);
    assert.equal(isCustomDomainHost('app.localhost:5173'), false);
    assert.equal(isCustomDomainHost('127.0.0.1:5173'), false);
    assert.equal(isCustomDomainHost(''), false);
  });

  test('parseCustomerSpaceFromLocation supports space_type+table_num and legacy formats', () => {
    const roomQuery = parseCustomerSpaceFromLocation('?space_type=room&table_num=204&tkn=abcd1234', '/hotel-royal');
    assert.deepEqual(roomQuery, { type: 'room', num: '204', token: 'abcd1234', isScanned: true, isValidTokenShape: true });

    const cinemaSeat = parseCustomerSpaceFromLocation('?screen=2&row=b&seatno=14&tkn=1234abcd', '/pvr');
    assert.deepEqual(cinemaSeat, { type: 'cinema_seat', num: 'S2-B-14', token: '1234abcd', isScanned: true, isValidTokenShape: true });

    const cinemaSeatParam = parseCustomerSpaceFromLocation('?screen=3&row=c&seat=9&tkn=1234abcd', '/pvr');
    assert.deepEqual(cinemaSeatParam, { type: 'cinema_seat', num: 'S3-C-9', token: '1234abcd', isScanned: true, isValidTokenShape: true });

    const cinemaDefaultSeat = parseCustomerSpaceFromLocation('?screen=1&row=a&tkn=1234abcd', '/pvr');
    assert.deepEqual(cinemaDefaultSeat, { type: 'cinema_seat', num: 'S1-A-1', token: '1234abcd', isScanned: true, isValidTokenShape: true });

    const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const realToken = generateHmacQrToken('pvr-imax', 'cinema_seat', 'S3-C-9', secret);
    const verifiedParsed = parseCustomerSpaceFromLocation(`?screen=3&row=c&seat=9&tkn=${realToken}`, '/pvr-imax');
    assert.equal(verifiedParsed.type, 'cinema_seat');
    assert.equal(verifiedParsed.num, 'S3-C-9');
    assert.equal(verifiedParsed.isValidTokenShape, true);
    assert.equal(verifyQrToken('pvr-imax', verifiedParsed.type, verifiedParsed.num, secret, verifiedParsed.token).valid, true);

    const counterQuery = parseCustomerSpaceFromLocation('?space_type=counter&tkn=deadbeef', '/cafe');
    assert.deepEqual(counterQuery, { type: 'counter', num: 'COUNTER', token: 'deadbeef', isScanned: true, isValidTokenShape: true });

    const pathTable = parseCustomerSpaceFromLocation('?tkn=cafe1234', '/r/bistro/table/7');
    assert.deepEqual(pathTable, { type: 'table', num: '7', token: 'cafe1234', isScanned: true, isValidTokenShape: true });
  });

  test('isCustomerSpaceValid rejects zero-capacity spaces and invalid tokens', () => {
    // Missing/invalid token shape rejected
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: '1',
        currentSpaceType: 'table',
        hasValidTokenShape: false,
        info: { total_tables: 10 }
      }),
      false
    );

    // Zero capacity configured (total_tables = 0) MUST fail closed
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: '1',
        currentSpaceType: 'table',
        hasValidTokenShape: true,
        info: { total_tables: 0 }
      }),
      false
    );

    // Zero capacity for rooms (total_rooms = 0) fails closed
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: '101',
        currentSpaceType: 'room',
        hasValidTokenShape: true,
        info: { total_tables: 10, total_rooms: 0 }
      }),
      false
    );

    // Valid within capacity succeeds
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: '5',
        currentSpaceType: 'table',
        hasValidTokenShape: true,
        info: { total_tables: 10 }
      }),
      true
    );

    // Above capacity fails
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: '11',
        currentSpaceType: 'table',
        hasValidTokenShape: true,
        info: { total_tables: 10 }
      }),
      false
    );

    // Counter requires canonical COUNTER + counter_ordering_enabled (or non-cinema restaurant fallback)
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: 'COUNTER',
        currentSpaceType: 'counter',
        hasValidTokenShape: true,
        info: { resto_type: 'cinema', counter_ordering_enabled: 0 }
      }),
      false
    );
    assert.equal(
      isCustomerSpaceValid({
        currentTableNum: 'COUNTER',
        currentSpaceType: 'counter',
        hasValidTokenShape: true,
        info: { resto_type: 'cinema', counter_ordering_enabled: '1' }
      }),
      true
    );
  });

  test('buildScopedStorageKey isolates keys by tenant slug and space type', () => {
    const k1 = buildScopedStorageKey('touchqr_active_order_id', { slug: 'cafe-a', spaceType: 'table', tableNumber: '1' });
    const k2 = buildScopedStorageKey('touchqr_active_order_id', { slug: 'cafe-b', spaceType: 'table', tableNumber: '1' });
    const k3 = buildScopedStorageKey('touchqr_active_order_id', { slug: 'cafe-a', spaceType: 'room', tableNumber: '1' });
    assert.notEqual(k1, k2);
    assert.notEqual(k1, k3);
    assert.equal(k1, 'touchqr_active_order_id_cafe-a_table_1');
  });

  test('buildScopedStorageKey round-trip cleanup removes cinema and counter orders with zero stale keys', () => {
    const store = new Map();

    // Cinema order: submitted with screen/row/seat variant, completed/ended with server-canonical S2-B-14
    const cinemaSubmitKey = buildScopedStorageKey('touchqr_active_order_id', {
      slug: 'pvr-imax',
      spaceType: 'cinema_seat',
      tableNumber: 'Screen 2 • Row b • Seat 14'
    });
    const cinemaReloadKey = buildScopedStorageKey('touchqr_active_order_id', {
      slug: 'pvr-imax',
      spaceType: 'cinema',
      tableNumber: 's2-b-14'
    });
    const cinemaCleanupKey = buildScopedStorageKey('touchqr_active_order_id', {
      slug: 'pvr-imax',
      spaceType: 'cinema_seat',
      tableNumber: 'S2-B-14'
    });
    assert.equal(cinemaSubmitKey, 'touchqr_active_order_id_pvr-imax_cinema_seat_S2-B-14');
    assert.equal(cinemaReloadKey, cinemaSubmitKey);
    assert.equal(cinemaCleanupKey, cinemaSubmitKey);

    store.set(cinemaSubmitKey, '901');
    assert.equal(store.get(cinemaReloadKey), '901');
    store.delete(cinemaCleanupKey);
    assert.equal(store.get(cinemaSubmitKey), undefined);
    assert.equal(store.size, 0);

    // Counter order: submitted/reloaded with 'counter' variant, completed/ended with canonical 'COUNTER'
    const counterSubmitKey = buildScopedStorageKey('touchqr_active_order_id', {
      slug: 'brew-bar',
      spaceType: 'counter',
      tableNumber: 'counter'
    });
    const counterCleanupKey = buildScopedStorageKey('touchqr_active_order_id', {
      slug: 'brew-bar',
      spaceType: 'counter',
      tableNumber: 'COUNTER'
    });
    assert.equal(counterSubmitKey, 'touchqr_active_order_id_brew-bar_counter_COUNTER');
    assert.equal(counterCleanupKey, counterSubmitKey);

    store.set(counterSubmitKey, '902');
    store.delete(counterCleanupKey);
    assert.equal(store.get(counterSubmitKey), undefined);
    assert.equal(store.size, 0);
  });

  test('PresenceVerificationModal sets locks AFTER cleanupAllTimers', () => {
    const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/PresenceVerificationModal.jsx'), 'utf8');
    const gpsIdx = modalSrc.indexOf('const handleAcquireGps = () =>');
    assert.notEqual(gpsIdx, -1);
    const gpsSlice = modalSrc.slice(gpsIdx, gpsIdx + 220);
    const gpsCleanPos = gpsSlice.indexOf('cleanupAllTimers()');
    const gpsLockPos = gpsSlice.indexOf('isAcquiringGpsRef.current = true');
    assert.ok(gpsCleanPos !== -1 && gpsLockPos !== -1 && gpsCleanPos < gpsLockPos, 'handleAcquireGps must run cleanupAllTimers before locking');

    const staffIdx = modalSrc.indexOf('const handleRequestStaff = async () =>');
    assert.notEqual(staffIdx, -1);
    const staffSlice = modalSrc.slice(staffIdx, staffIdx + 220);
    const staffCleanPos = staffSlice.indexOf('cleanupAllTimers()');
    const staffLockPos = staffSlice.indexOf('isRequestingStaffRef.current = true');
    assert.ok(staffCleanPos !== -1 && staffLockPos !== -1 && staffCleanPos < staffLockPos, 'handleRequestStaff must run cleanupAllTimers before locking');
  });

  test('App.jsx avoids trackingToken TDZ in 410 handler and keeps idempotency_key on invalid_presence retry', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    const trackIdx = appSrc.indexOf('if (activeOrderId) {');
    assert.notEqual(trackIdx, -1);
    const trackSlice = appSrc.slice(trackIdx, trackIdx + 600);
    const letTokenPos = trackSlice.indexOf("let trackingToken = ''");
    const tryPos = trackSlice.indexOf('try {');
    assert.ok(letTokenPos !== -1 && tryPos !== -1 && letTokenPos < tryPos, 'trackingToken must be declared outside try block before 410 catch');

    const invIdx = appSrc.indexOf("if (errCode === 'invalid_presence')");
    assert.notEqual(invIdx, -1);
    const invEnd = appSrc.indexOf('setPresenceModalOpen(true)', invIdx);
    const invSlice = appSrc.slice(invIdx, invEnd);
    assert.ok(invSlice.includes('idempotency_key: attemptIdempKey'), 'invalid_presence retry payload must preserve idempotency_key');
  });

  test('App.jsx normalizes gst_enabled consistently and keeps stable tenant storage scope', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    assert.ok(!appSrc.includes('Boolean(info?.gst_enabled)'), 'App.jsx must not use Boolean(info?.gst_enabled) for checkout totals');
    assert.ok(appSrc.includes('isFlagEnabled(info?.gst_enabled, false)'), 'App.jsx must normalize gst_enabled with isFlagEnabled(..., false)');

    const slugHelperIdx = appSrc.indexOf('const getActiveStorageTenantSlug = () =>');
    assert.notEqual(slugHelperIdx, -1);
    const slugHelperSlice = appSrc.slice(slugHelperIdx, slugHelperIdx + 140);
    assert.ok(!slugHelperSlice.includes('hostname'), 'getActiveStorageTenantSlug must not fall back to window.location.hostname');
    assert.ok(appSrc.includes('}, [info?.slug, sessionExpired]);'), 'activeOrderId restoration must observe resolved info?.slug');
    assert.ok(
      appSrc.includes('isOrderRestorationComplete') &&
      appSrc.includes('restoredOrderSlug === tenantSlug') &&
      appSrc.includes('localStorage.getItem(activeOrderKey)'),
      'inactivity effect must wait for restoredOrderSlug and skip while activeOrderKey holds an order'
    );
  });

  test('api.js resolves custom-domain hosts using boundary-aware matching and ensureRestoSecret', () => {
    const apiSrc = fs.readFileSync(path.join(ROOT_DIR, 'server/routes/api.js'), 'utf8');
    assert.ok(apiSrc.includes("import { isCustomDomainHost } from '../../src/utils/customerHelpers.js'"), 'api.js must share isCustomDomainHost');
    assert.ok(apiSrc.includes('if (rawHost && isCustomDomainHost(rawHost))'), 'resolveRestaurant must use boundary-aware isCustomDomainHost');
    assert.ok(apiSrc.includes('return await ensureRestoSecret(domainRestos[0])'), 'custom-domain lookup must ensure qr_secret');
  });

  test('DishModal and handleAddToCart enforce isFlagEnabled availability checks', () => {
    const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/DishModal.jsx'), 'utf8');
    assert.ok(!modalSrc.includes('dish.available !== false'), 'DishModal must not rely on dish.available !== false');
    assert.ok(modalSrc.includes('isFlagEnabled(dish?.available, true)'), 'DishModal must use isFlagEnabled for dish.available');

    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    const addIdx = appSrc.indexOf('const handleAddToCart =');
    assert.notEqual(addIdx, -1);
    const addSlice = appSrc.slice(addIdx, addIdx + 180);
    assert.ok(addSlice.includes('isFlagEnabled(dish.available, true)'), 'handleAddToCart must guard unavailable dishes');
  });

  test('App.jsx and BillCompletedModal handle settled bills without Session Expired shock', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    assert.ok(appSrc.includes("import BillCompletedModal from './components/BillCompletedModal';"), 'App.jsx must import BillCompletedModal');
    const billIdx = appSrc.indexOf('if (isBillSettled) {');
    assert.notEqual(billIdx, -1, 'App.jsx must handle isBillSettled branch separately from cancelled/rejected');
    const billEndIdx = appSrc.indexOf('if (!isCancelledOrRejected)', billIdx);
    const billSlice = billEndIdx > billIdx ? appSrc.slice(billIdx, billEndIdx) : appSrc.slice(billIdx, billIdx + 3800);
    assert.ok(billSlice.includes('setBillCompletedModal(billPayload)'), 'Settled bill must open BillCompletedModal');
    assert.ok(billSlice.includes('setShowRunningOrderModal(false)'), 'Settled bill must reset showRunningOrderModal state');
    assert.ok(billSlice.includes('setSessionExpired(false)'), 'Settled bill must clear session without triggering Session Expired banner');
    assert.ok(
      appSrc.includes('COMPLETED_BILL_TTL_MS') &&
      appSrc.includes('completedBillMetaRef') &&
      appSrc.includes('parseCompletedBillSlot') &&
      appSrc.includes('scheduleNextExpiry') &&
      appSrc.includes('expireCompletedBillIfDue') &&
      appSrc.includes('handleWakeupExpiry'),
      'App.jsx must validate stored bill records, bind receipt tenant+identity, reschedule on backward clock shift, and auto-expire settled e-bill after 2h'
    );
    assert.ok(appSrc.includes('bill_summary'), 'api/frontend post-bill integration checks bill_summary');

    const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/BillCompletedModal.jsx'), 'utf8');
    assert.ok(modalSrc.includes('bill.bill_summary || bill'), 'BillCompletedModal must support consolidated bill_summary');
    assert.ok(modalSrc.includes('escapeHtml'), 'BillCompletedModal printable HTML receipt must escape dynamic strings');
  });

  test('App.jsx forwards trimmed cooking notes to direct order, retry payload, and WhatsApp order', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    assert.ok(appSrc.includes("const [orderNotesInput, setOrderNotesInput] = useState('')"), 'App.jsx must maintain orderNotesInput state');
    assert.ok(appSrc.includes('...(trimmedNotes ? { notes: trimmedNotes } : {})'), 'Direct order and retry payloads must forward trimmed notes');
    assert.ok(appSrc.includes('Cooking Note:'), 'WhatsApp order formatter must append cooking notes');
  });

  test('App.jsx keeps orderSuccessModal free of premature review prompts and shows View Order tracker action', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    const successIdx = appSrc.indexOf('{orderSuccessModal && (() => {');
    const successEnd = appSrc.indexOf('{/* Floating Bottom Navigation Dock */}', successIdx);
    assert.notEqual(successIdx, -1, 'App.jsx must render orderSuccessModal');
    assert.notEqual(successEnd, -1, 'App.jsx must close orderSuccessModal before BottomDock');
    const successSlice = appSrc.slice(successIdx, successEnd);
    assert.ok(!successSlice.includes('Rate & Review Us on Google'), 'orderSuccessModal must not show premature review CTA immediately after placing order');
    assert.ok(successSlice.includes('Track Live Order'), 'orderSuccessModal keeps Track Live Order CTA');

    assert.ok(appSrc.includes("const [showRunningOrderModal, setShowRunningOrderModal] = useState(false)"), 'App.jsx maintains showRunningOrderModal state');
    assert.ok(appSrc.includes('setShowRunningOrderModal(true)'), 'Live order tracker banner exposes View Order action');
    assert.ok(appSrc.includes('Running Order Summary'), 'App.jsx renders Running Order Summary modal for live items and total');
    assert.ok(appSrc.includes('activeOrderTrack.session_summary') && appSrc.includes('trackRounds.length > 1'), 'Running Order Summary consolidates multi-round active sessions');
  });

  test('GET /orders/track/:id exposes notes and active multi-round session_summary', () => {
    const apiSrc = fs.readFileSync(path.join(ROOT_DIR, 'server/routes/api.js'), 'utf8');
    assert.ok(apiSrc.includes('items, notes, created_at'), 'Track order endpoint selects customer cooking notes');
    assert.ok(apiSrc.includes('...(sessionSummary ? { session_summary: sessionSummary } : {})'), 'Track order endpoint includes consolidated session_summary across active rounds');
    assert.ok(apiSrc.includes('prev_order_id') && apiSrc.includes('buildConsolidatedOrderSummary'), 'Active-table endpoint supports prev_order_id settlement detection cleanly');
  });

  test('App.jsx locks settled Dine-In session into ?view=1 View-Only mode and OrdersView avoids Ready label collision', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    assert.ok(appSrc.includes('isPostBillViewOnly'), 'App.jsx maintains post-bill View-Only state');
    assert.ok(appSrc.includes('setIsPostBillViewOnly(!canReuseForOrderAgain)'), 'Dine-In settlement transitions into View-Only mode');
    assert.ok(appSrc.includes('buildViewOnlyUrl()'), 'Dine-In settlement rewrites URL to ?view=1 View-Only URL');
    const viewUrlDeclIdx = appSrc.indexOf('const isViewOnlyUrl =');
    const effTableDeclIdx = appSrc.indexOf('const effectiveTableNum =');
    assert.ok(viewUrlDeclIdx !== -1 && effTableDeclIdx !== -1 && viewUrlDeclIdx < effTableDeclIdx, 'isViewOnlyUrl must be declared before effectiveTableNum to avoid TDZ ReferenceError');

    const ordersViewSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/components/Admin/views/OrdersView.jsx'), 'utf8');
    assert.ok(ordersViewSrc.includes('🔔 KITCHEN READY'), 'OrdersView renders distinct Kitchen Ready badge');
    assert.ok(ordersViewSrc.includes('🍽️ SERVED'), 'OrdersView renders distinct Served badge for served dining orders');
    assert.ok(!ordersViewSrc.includes("return compact ? '✓ Ready' : '✓ Mark Order as Ready / Served'"), 'OrdersView Dine-In button does not collide with KDS Mark Ready');
  });

  test('App.jsx guards active-table polling responses with a per-effect ownership marker', () => {
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/App.jsx'), 'utf8');
    assert.ok(appSrc.includes('let isCurrentEffect = true;'), 'Polling effect declares per-effect ownership flag');
    assert.ok(appSrc.includes('isCurrentEffect = false;'), 'Polling effect clears ownership flag in cleanup');
    const trackIdx = appSrc.indexOf('await trackOrderStatus(');
    const activeIdx = appSrc.indexOf('await fetchActiveTableOrder(');
    assert.ok(trackIdx !== -1 && appSrc.slice(trackIdx, trackIdx + 220).includes('if (!isCurrentEffect) return;'), 'trackOrderStatus response checks effect ownership before mutating state/refs');
    assert.ok(activeIdx !== -1 && appSrc.slice(activeIdx, activeIdx + 300).includes('if (!isCurrentEffect) return;'), 'fetchActiveTableOrder response checks effect ownership before mutating state/refs/URL');
    assert.ok(appSrc.includes('hasRoundPrepared') && appSrc.includes('modalStatusLabel'), 'Customer banner and orderSuccessModal read live kitchen_prepared and round statuses cleanly');
    const themeCss = fs.readFileSync(path.join(ROOT_DIR, 'src/styles/theme.css'), 'utf8');
    assert.ok(themeCss.includes('@keyframes tqOrderModalEnter') && themeCss.includes('@keyframes tqCheckCircleBounce'), 'Smooth GPU-composited order confirmation animations defined in theme.css');
  });

  await testAsync('App component executes initial minified render without ReferenceError', async () => {
    const tmpCompileDir = fs.mkdtempSync(path.join(ROOT_DIR, '.tmp-app-render-'));
    const outFile = path.join(tmpCompileDir, 'App.bundle.mjs');
    const savedKeys = ['window', 'document', 'localStorage', 'sessionStorage', 'location', 'fetch'];
    const prevGlobals = Object.fromEntries(savedKeys.map(k => [k, globalThis[k]]));

    try {
      await esbuild.build({
        entryPoints: [path.join(ROOT_DIR, 'src/App.jsx')],
        outfile: outFile,
        bundle: true,
        minify: true,
        format: 'esm',
        platform: 'node',
        mainFields: ['module', 'main'],
        jsx: 'automatic',
        loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.css': 'empty' },
        external: ['react', 'react-dom', 'react/jsx-runtime']
      });

      const storeMock = () => {
        const map = new Map();
        return {
          getItem: (k) => (map.has(k) ? map.get(k) : null),
          setItem: (k, v) => map.set(k, String(v)),
          removeItem: (k) => map.delete(k)
        };
      };
      const loc = {
        search: '?t=2&tkn=qr_test',
        pathname: '/r/demo-cafe',
        host: 'localhost',
        hostname: 'localhost',
        origin: 'http://localhost',
        href: 'http://localhost/r/demo-cafe?t=2&tkn=qr_test'
      };
      globalThis.location = loc;
      globalThis.localStorage = storeMock();
      globalThis.sessionStorage = storeMock();
      globalThis.window = {
        location: loc,
        history: { replaceState: () => { }, pushState: () => { } },
        localStorage: globalThis.localStorage,
        sessionStorage: globalThis.sessionStorage,
        addEventListener: () => { },
        removeEventListener: () => { },
        innerWidth: 390,
        scrollTo: () => { }
      };
      globalThis.document = {
        cookie: '',
        documentElement: { style: { setProperty: () => { } } },
        createElement: () => ({ style: {} })
      };
      globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

      const appMod = await import(pathToFileURL(outFile).href);
      const AppComp = appMod.default;
      assert.equal(typeof AppComp, 'function', 'Bundled App default export must be a component function');
      const html = renderToString(React.createElement(AppComp));
      assert.equal(typeof html, 'string');
      assert.ok(html.length > 0, 'Minified App component renders non-empty HTML without ReferenceError');
    } finally {
      for (const k of savedKeys) {
        if (prevGlobals[k] === undefined) delete globalThis[k];
        else globalThis[k] = prevGlobals[k];
      }
      try { fs.rmSync(tmpCompileDir, { recursive: true, force: true }); } catch { }
    }
  });

  console.log(`\nAll ${passed} Customer Page helper/regression tests passed.`);
}

runTests();
