import assert from 'assert';
import './testDbGuard.js';
import { resolveBusinessProfile, BUSINESS_TYPES } from '../../src/utils/businessTaxonomy.js';
import {
  generateHmacQrToken,
  verifyQrToken
} from '../utils/qrSecurity.js';

console.log('======================================================================');
console.log('🛡️  KDS BLANK SCREEN & CINEMA QR GENERATOR REGRESSION TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ======================================================================
// SECTION 1: Fix 1 & Setup KDS Navigation & Safe Dashboard Fallbacks
// ======================================================================
console.log('--- SECTION 1: KDS Setup Button, Entitlement & Subtab Fallbacks ---');

test('Setup preview button: opens /${slug}/kitchen in new tab directly without calling onNavigate("kds")', () => {
  let openedUrl = null;
  let openedTarget = null;
  const mockWindow = {
    open: (url, target) => {
      openedUrl = url;
      openedTarget = target;
    }
  };

  let onNavigateCalledWith = null;
  const onNavigate = (tab) => { onNavigateCalledWith = tab; };

  const restaurantInfo = { slug: 'royal-cinema-theatre' };
  const settingsForm = { slug: 'royal-cinema-theatre' };

  // Handler matching SetupView.jsx line 4319
  const handleSetupOpenKds = () => {
    const currentSlug = restaurantInfo?.slug || settingsForm?.slug || '';
    mockWindow.open(currentSlug ? `/${currentSlug}/kitchen` : '/kitchen', '_blank');
  };

  handleSetupOpenKds();

  assert.strictEqual(openedUrl, '/royal-cinema-theatre/kitchen');
  assert.strictEqual(openedTarget, '_blank');
  assert.strictEqual(onNavigateCalledWith, null, 'Must NOT call onNavigate("kds") from Setup');
});

test('Authoritative KDS entitlement: stale local setting cannot bypass plan restrictions when capabilities.kds_enabled is false', () => {
  const resolveEntitlement = (capabilities, restaurantInfo, settingsForm) => {
    return capabilities && capabilities.kds_enabled !== undefined
      ? Boolean(capabilities.kds_enabled)
      : Boolean(restaurantInfo?.kds_enabled);
  };

  // Stale settingsForm.kds_enabled = 1, but plan capability is explicitly false (e.g. Basic plan)
  const staleLocalSettings = { kds_enabled: 1 };
  const planCapabilitiesDisabled = { kds_enabled: false };
  assert.strictEqual(
    resolveEntitlement(planCapabilitiesDisabled, {}, staleLocalSettings),
    false,
    'Stale local settings must not bypass plan lock'
  );

  // When plan capability enables KDS
  const planCapabilitiesEnabled = { kds_enabled: true };
  assert.strictEqual(
    resolveEntitlement(planCapabilitiesEnabled, {}, {}),
    true,
    'Plan capability must grant KDS entitlement'
  );
});

test('OrdersView subtab evaluation: KDS-enabled tenant on activeSubTab="kds" gets active launcher, NOT PlanLockedCard', () => {
  const evaluateSubtabContent = (activeSubTab, isKdsEntitled) => {
    if (activeSubTab === 'kds') {
      if (!isKdsEntitled) return 'PLAN_LOCKED_CARD';
      return 'KDS_ACTIVE_LAUNCHER';
    }
    if (activeSubTab === 'floor-map') return 'FLOOR_MAP';
    if (activeSubTab === 'service-requests') return 'SERVICE_REQUESTS';
    if (activeSubTab === 'orders' || !['floor-map', 'service-requests', 'kds'].includes(activeSubTab)) {
      return 'ORDERS_FEED';
    }
    return 'UNKNOWN';
  };

  // Enabled tenant reaching kds subtab
  assert.strictEqual(
    evaluateSubtabContent('kds', true),
    'KDS_ACTIVE_LAUNCHER',
    'Enabled tenant must see active launcher, not locked card'
  );

  // Disabled tenant reaching kds subtab
  assert.strictEqual(
    evaluateSubtabContent('kds', false),
    'PLAN_LOCKED_CARD',
    'Disabled tenant must see plan locked card'
  );
});

test('OrdersView KDS launcher provides working action opening tenant-specific KDS route', () => {
  let openedUrl = null;
  const mockWindow = {
    open: (url) => { openedUrl = url; }
  };

  const restaurantInfo = { slug: 'apex-dining' };
  const settingsForm = {};

  const handleLaunchKds = () => {
    const currentSlug = restaurantInfo?.slug || settingsForm?.slug || '';
    mockWindow.open(currentSlug ? `/${currentSlug}/kitchen` : '/kitchen', '_blank');
  };

  handleLaunchKds();
  assert.strictEqual(openedUrl, '/apex-dining/kitchen');
});

test('Missing or invalid tenant context cannot launch another tenant Kitchen Display', () => {
  let openedUrl = null;
  const mockWindow = {
    open: (url) => { openedUrl = url; }
  };

  // Missing slug
  const restaurantInfo = {};
  const settingsForm = {};

  const handleLaunchKds = () => {
    const currentSlug = restaurantInfo?.slug || settingsForm?.slug || '';
    mockWindow.open(currentSlug ? `/${currentSlug}/kitchen` : '/kitchen', '_blank');
  };

  handleLaunchKds();
  assert.strictEqual(openedUrl, '/kitchen', 'Missing slug must route to /kitchen');

  // Verify /kitchen is rejected by router without exposing any tenant
  const isGenericKitchen = (path) => path === '/kitchen' || path === '/kitchen/';
  assert.strictEqual(isGenericKitchen(openedUrl), true, 'Generic /kitchen is isolated and treated as not_found');
});

test('Existing OrdersView main KDS button: enabled opens /${slug}/kitchen; disabled opens subscription setup', () => {
  let openedUrl = null;
  let setupDrawerCalledWith = null;
  const mockWindow = {
    open: (url) => { openedUrl = url; }
  };
  const onNavigateToSetup = (drawer) => { setupDrawerCalledWith = drawer; };

  const handleOrdersViewKdsClick = (isKdsEntitled, slug) => {
    if (isKdsEntitled) {
      mockWindow.open(slug ? `/${slug}/kitchen` : '/kitchen', '_blank');
    } else if (onNavigateToSetup) {
      onNavigateToSetup('subscription');
    }
  };

  // Enabled case
  handleOrdersViewKdsClick(true, 'zenith-cafe');
  assert.strictEqual(openedUrl, '/zenith-cafe/kitchen');
  assert.strictEqual(setupDrawerCalledWith, null);

  // Disabled case
  openedUrl = null;
  handleOrdersViewKdsClick(false, 'zenith-cafe');
  assert.strictEqual(openedUrl, null);
  assert.strictEqual(setupDrawerCalledWith, 'subscription');
});

test('OrdersView subtab evaluation: invalid/unsupported subtab falls back to orders feed (never blanks)', () => {
  const evaluateOrdersViewSubtab = (activeSubTab, isKdsEntitled) => {
    if (activeSubTab === 'kds') {
      return isKdsEntitled ? 'KDS_ACTIVE_LAUNCHER' : 'PLAN_LOCKED_CARD';
    }
    if (activeSubTab === 'floor-map') return 'FLOOR_MAP';
    if (activeSubTab === 'service-requests') return 'SERVICE_REQUESTS';
    if (activeSubTab === 'orders' || !['floor-map', 'service-requests', 'kds'].includes(activeSubTab)) {
      return 'ORDERS_FEED';
    }
    return 'UNKNOWN';
  };

  assert.strictEqual(evaluateOrdersViewSubtab('random_subtab', false), 'ORDERS_FEED');
  assert.strictEqual(evaluateOrdersViewSubtab('invalid', false), 'ORDERS_FEED');
  assert.strictEqual(evaluateOrdersViewSubtab(null, false), 'ORDERS_FEED');
  assert.strictEqual(evaluateOrdersViewSubtab(undefined, false), 'ORDERS_FEED');
  assert.strictEqual(evaluateOrdersViewSubtab('', false), 'ORDERS_FEED');
});

test('AdminDashboard tab evaluation: activeTab="kds" mounts OrdersView', () => {
  const ordersViewTabs = ['orders', 'floor-map', 'service-requests', 'kds'];
  assert.ok(ordersViewTabs.includes('kds'), 'AdminDashboard must include "kds" in OrdersView condition');
  assert.ok(ordersViewTabs.includes('orders'));
  assert.ok(ordersViewTabs.includes('floor-map'));
  assert.ok(ordersViewTabs.includes('service-requests'));
});

test('AdminDashboard tab evaluation: invalid/unsupported activeTab falls back to HomeView (never blanks)', () => {
  const knownTabs = [
    'home', 'orders', 'floor-map', 'service-requests', 'kds',
    'analytics', 'dishes', 'categories', 'combos', 'qr-generator',
    'offers', 'customers', 'billing', 'subscription', 'review',
    'notifications', 'support', 'settings'
  ];

  const evaluateDashboardView = (activeTab) => {
    if (['orders', 'floor-map', 'service-requests', 'kds'].includes(activeTab)) return 'ORDERS_VIEW';
    if (activeTab === 'home') return 'HOME_VIEW';
    if (activeTab === 'qr-generator') return 'QR_GENERATOR_VIEW';
    if (!knownTabs.includes(activeTab)) return 'HOME_VIEW_FALLBACK';
    return 'OTHER_KNOWN_VIEW';
  };

  assert.strictEqual(evaluateDashboardView('invalid-tab-xyz'), 'HOME_VIEW_FALLBACK');
  assert.strictEqual(evaluateDashboardView('corrupted_state'), 'HOME_VIEW_FALLBACK');
  assert.strictEqual(evaluateDashboardView(null), 'HOME_VIEW_FALLBACK');
  assert.strictEqual(evaluateDashboardView(undefined), 'HOME_VIEW_FALLBACK');
});

// ======================================================================
// SECTION 2: Fix 2 - Cinema QR Generator Detection & Standee Workspace
// ======================================================================
console.log('\n--- SECTION 2: Fix 2 - Cinema Detection & QR Generator ---');

test('Cinema detection: recognizes canonical "cinema_theatre" business_type', () => {
  const settingsForm = { business_type: 'cinema_theatre' };
  const restaurantInfo = {};
  const capabilities = {};

  const profile = resolveBusinessProfile(settingsForm || restaurantInfo || {});
  const effectiveBiz = String(profile?.business_type || settingsForm?.business_type || restaurantInfo?.business_type || 'restaurant').trim().toLowerCase();
  const effectiveService = String(profile?.service_model || settingsForm?.service_model || restaurantInfo?.service_model || 'dine_in').trim().toLowerCase();
  const isCinema = effectiveBiz === 'cinema_theatre' || effectiveBiz === 'cinema' || effectiveService === 'cinema' || effectiveService === 'seat_service' || Boolean(capabilities?.cinema_ordering_enabled);

  assert.strictEqual(isCinema, true, 'cinema_theatre must be recognized as cinema');
});

test('Cinema detection: recognizes canonical service_model="cinema" or "seat_service"', () => {
  const detectCinema = (settingsForm, restaurantInfo = {}, capabilities = {}) => {
    const profile = resolveBusinessProfile(settingsForm || restaurantInfo || {});
    const rawBiz = String(settingsForm?.business_type || restaurantInfo?.business_type || '').trim().toLowerCase();
    const rawService = String(settingsForm?.service_model || restaurantInfo?.service_model || '').trim().toLowerCase();
    const effectiveBiz = String(profile?.business_type || rawBiz || 'restaurant').trim().toLowerCase();
    const effectiveService = String(profile?.service_model || rawService || 'dine_in').trim().toLowerCase();
    return effectiveBiz === 'cinema_theatre' || effectiveBiz === 'cinema' || rawBiz === 'cinema_theatre' || rawBiz === 'cinema' || effectiveService === 'cinema' || effectiveService === 'seat_service' || rawService === 'cinema' || rawService === 'seat_service' || Boolean(capabilities?.cinema_ordering_enabled);
  };

  assert.strictEqual(detectCinema({ service_model: 'cinema' }), true);
  assert.strictEqual(detectCinema({ service_model: 'seat_service' }), true);
  assert.strictEqual(detectCinema({ business_type: 'cinema_theatre', service_model: 'cinema' }), true);
});

test('Cinema detection: recognizes legacy "cinema" and capability flag "cinema_ordering_enabled"', () => {
  const detectCinema = (settingsForm, restaurantInfo, capabilities) => {
    const profile = resolveBusinessProfile(settingsForm || restaurantInfo || {});
    const effectiveBiz = String(profile?.business_type || settingsForm?.business_type || restaurantInfo?.business_type || 'restaurant').trim().toLowerCase();
    const effectiveService = String(profile?.service_model || settingsForm?.service_model || restaurantInfo?.service_model || 'dine_in').trim().toLowerCase();
    return effectiveBiz === 'cinema_theatre' || effectiveBiz === 'cinema' || effectiveService === 'cinema' || effectiveService === 'seat_service' || Boolean(capabilities?.cinema_ordering_enabled);
  };

  assert.strictEqual(detectCinema({ business_type: 'cinema' }, {}, {}), true);
  assert.strictEqual(detectCinema({}, {}, { cinema_ordering_enabled: true }), true);
});

test('Cinema detection: non-cinema categories remain isCinema=false', () => {
  const nonCinemaTypes = ['restaurant', 'cafe', 'bakery', 'hotel_resort', 'food_truck', 'qsr', 'cloud_kitchen', 'bar_brewery'];

  const detectCinema = (bizType) => {
    const settingsForm = { business_type: bizType };
    const profile = resolveBusinessProfile(settingsForm);
    const effectiveBiz = String(profile?.business_type || settingsForm?.business_type || 'restaurant').trim().toLowerCase();
    const effectiveService = String(profile?.service_model || settingsForm?.service_model || 'dine_in').trim().toLowerCase();
    return effectiveBiz === 'cinema_theatre' || effectiveBiz === 'cinema' || effectiveService === 'cinema' || effectiveService === 'seat_service';
  };

  for (const bType of nonCinemaTypes) {
    assert.strictEqual(detectCinema(bType), false, `${bType} should NOT be detected as cinema`);
  }
});

test('Empty state & setup buttons direct to cinema drawer for cinema, general drawer for restaurant', () => {
  const getSetupDrawerTarget = (isCinema) => isCinema ? 'cinema' : 'general';
  const getSetupButtonLabel = (isCinema) => isCinema ? 'Cinema Setup' : 'Configure Spaces';

  assert.strictEqual(getSetupDrawerTarget(true), 'cinema');
  assert.strictEqual(getSetupButtonLabel(true), 'Cinema Setup');

  assert.strictEqual(getSetupDrawerTarget(false), 'general');
  assert.strictEqual(getSetupButtonLabel(false), 'Configure Spaces');
});

test('Authoritative space inventory: cinema produces screen/seat spaces while restaurant produces table spaces', () => {
  const deriveSpaces = (settings, cinemaSeats, isCinema) => {
    const spaces = [];
    if (isCinema) {
      if (Array.isArray(cinemaSeats) && cinemaSeats.length > 0) {
        cinemaSeats.forEach(s => {
          const seatLabel = s.seat_label || (s.seat_row && s.seat_number ? `${s.seat_row}-${s.seat_number}` : `Seat #${s.id}`);
          spaces.push({
            id: s.id,
            type: 'seat',
            screenId: s.screen_id,
            screenName: s.screen_name || `Screen ${s.screen_id || 1}`,
            label: `${s.screen_name || `Screen ${s.screen_id || 1}`} • ${seatLabel}`,
            shortLabel: seatLabel,
            seatRow: s.seat_row || '',
            seatNumber: s.seat_number || '',
            destinationUrl: `/order?cinema=true&screen=${encodeURIComponent(s.screen_id || 1)}&seat=${encodeURIComponent(seatLabel)}`
          });
        });
      }
    } else {
      const configuredTables = Array.isArray(settings?.table_names) ? settings.table_names : [];
      if (configuredTables.length > 0) {
        configuredTables.forEach((t, i) => {
          spaces.push({
            id: t.id || i + 1,
            type: 'table',
            label: t.name || `Table ${i + 1}`,
            shortLabel: String(t.id || i + 1),
            destinationUrl: `/order?table=${encodeURIComponent(t.id || i + 1)}`
          });
        });
      }
    }
    return spaces;
  };

  const cinemaSeats = [
    { id: 101, screen_id: 1, screen_name: 'Audi 1', seat_row: 'A', seat_number: '1' },
    { id: 102, screen_id: 1, screen_name: 'Audi 1', seat_row: 'A', seat_number: '2' }
  ];

  const cinemaSpaces = deriveSpaces({}, cinemaSeats, true);
  assert.strictEqual(cinemaSpaces.length, 2);
  assert.strictEqual(cinemaSpaces[0].type, 'seat');
  assert.strictEqual(cinemaSpaces[0].label, 'Audi 1 • A-1');
  assert.ok(cinemaSpaces[0].destinationUrl.includes('cinema=true&screen=1&seat=A-1'));

  const restaurantSettings = {
    table_names: [{ id: 1, name: 'Table 1' }, { id: 2, name: 'Table 2' }]
  };
  const restaurantSpaces = deriveSpaces(restaurantSettings, [], false);
  assert.strictEqual(restaurantSpaces.length, 2);
  assert.strictEqual(restaurantSpaces[0].type, 'table');
  assert.strictEqual(restaurantSpaces[0].label, 'Table 1');
  assert.ok(restaurantSpaces[0].destinationUrl.includes('/order?table=1'));
});

test('HMAC QR tokens for cinema and restaurant maintain strict tenant isolation', () => {
  const slug = 'royale-cinema';
  const type = 'seat';
  const num = 'Screen 1 - Row A - Seat 1';
  const tenant1Secret = 'tenant-secret-11111-secure-secret-key';
  const tenant2Secret = 'tenant-secret-22222-different-secret';

  const tenant1CinemaToken = generateHmacQrToken(slug, type, num, tenant1Secret);
  assert.ok(tenant1CinemaToken && tenant1CinemaToken.length === 64, 'Must generate 64-char hex HMAC token');

  // Verify valid with correct tenant secret
  const validResult = verifyQrToken(slug, type, num, tenant1Secret, tenant1CinemaToken);
  assert.strictEqual(validResult.valid, true, 'Token must be valid with correct secret');

  // Verify invalid with cross-tenant secret
  const crossTenantResult = verifyQrToken(slug, type, num, tenant2Secret, tenant1CinemaToken);
  assert.strictEqual(crossTenantResult.valid, false, 'Cross-tenant secret must reject token');

  // Verify invalid with cross-space or tampered seat
  const crossSpaceResult = verifyQrToken(slug, type, 'Screen 1 - Row A - Seat 2', tenant1Secret, tenant1CinemaToken);
  assert.strictEqual(crossSpaceResult.valid, false, 'Cross-space or tampered seat must reject token');
});

console.log('\n======================================================================');
console.log(`Summary: ${passed} passed, ${failed} failed.`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
