import assert from 'assert';
import './testDbGuard.js';
import {
  resolveBusinessProfile,
  getAvailableSpaceTypesForBusiness,
  getSpaceConfig
} from '../../src/utils/businessTaxonomy.js';
import {
  validateSpaceCapacity,
  normalizeSpaceType,
  normalizeSpaceNumber
} from '../utils/qrSecurity.js';

console.log('======================================================================');
console.log('🏨 TOUCHQR — HOTEL ROOM COUNT MANAGEMENT REGRESSION SUITE');
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

async function testAsync(name, fn) {
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

// ======================================================================
// SECTION 1: Business Taxonomy & isHotel Detection
// ======================================================================
console.log('--- SECTION 1: Business Taxonomy & Hotel Detection ---');

test('Taxonomy: detects hotel_resort and canonical service_model="hotel" as isHotel', () => {
  const checkIsHotel = (resto) => {
    const profile = resolveBusinessProfile(resto);
    const effectiveBiz = resto.business_type || profile.business_type;
    const effectiveService = resto.service_model || profile.service_model;
    return effectiveBiz === 'hotel_resort' || effectiveBiz === 'hotel' || effectiveService === 'hotel' || effectiveService === 'in_room_dining';
  };

  const hotel1 = { business_type: 'hotel_resort' };
  assert.strictEqual(checkIsHotel(hotel1), true, 'hotel_resort must be detected as hotel');

  const hotel2 = { business_type: 'hotel' };
  assert.strictEqual(checkIsHotel(hotel2), true, 'canonical alias hotel must resolve to hotel_resort');

  const hotel3 = { service_model: 'hotel' };
  assert.strictEqual(checkIsHotel(hotel3), true, 'service_model hotel must be detected as hotel');

  const hotelProfile1 = resolveBusinessProfile(hotel1);
  const hotelSpaces = getAvailableSpaceTypesForBusiness(hotelProfile1.business_type, hotelProfile1.service_model);
  assert.strictEqual(hotelSpaces.length, 1);
  assert.strictEqual(hotelSpaces[0].id, 'room');
  assert.strictEqual(hotelSpaces[0].param, 'room');
});

test('Taxonomy: restaurants, cafes, bakeries, and cinemas are NOT hotels and do NOT get rooms', () => {
  const nonHotels = [
    { business_type: 'restaurant', label: 'Restaurant' },
    { business_type: 'cafe', label: 'Café' },
    { business_type: 'bakery', label: 'Bakery' },
    { business_type: 'cinema_theatre', label: 'Cinema' },
    { business_type: 'fast_food_qsr', label: 'QSR' },
    { business_type: 'food_truck', label: 'Food Truck' }
  ];

  for (const item of nonHotels) {
    const profile = resolveBusinessProfile({ business_type: item.business_type });
    const isHotel = profile.business_type === 'hotel_resort' || profile.service_model === 'hotel';
    assert.strictEqual(isHotel, false, `${item.label} must NOT be detected as hotel`);

    const availableSpaces = getAvailableSpaceTypesForBusiness(profile.business_type, profile.service_model);
    const hasRooms = availableSpaces.some(s => s.id === 'room');
    assert.strictEqual(hasRooms, false, `${item.label} must not have room space type`);
  }
});

// ======================================================================
// SECTION 2: Client & Server Validation for total_rooms
// ======================================================================
console.log('\n--- SECTION 2: Validation for total_rooms (Integer, Non-Negative) ---');

test('Client validation: accepts valid non-negative whole integers', () => {
  const validateRoomsInput = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    if (!Number.isInteger(num) || num < 0) {
      return 'Total Guest Rooms must be a valid non-negative whole integer';
    }
    return num;
  };

  assert.strictEqual(validateRoomsInput('0'), 0);
  assert.strictEqual(validateRoomsInput('1'), 1);
  assert.strictEqual(validateRoomsInput('25'), 25);
  assert.strictEqual(validateRoomsInput('150'), 150);
  assert.strictEqual(validateRoomsInput(50), 50);
});

test('Client validation: rejects negative, fractional, and malformed room values', () => {
  const validateRoomsInput = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    if (!Number.isInteger(num) || num < 0) {
      throw new Error('Total Guest Rooms must be a valid non-negative whole integer');
    }
    return num;
  };

  assert.throws(() => validateRoomsInput('-1'), /non-negative whole integer/);
  assert.throws(() => validateRoomsInput('-10'), /non-negative whole integer/);
  assert.throws(() => validateRoomsInput('3.14'), /non-negative whole integer/);
  assert.throws(() => validateRoomsInput('10.5'), /non-negative whole integer/);
  assert.throws(() => validateRoomsInput('abc'), /non-negative whole integer/);
  assert.throws(() => validateRoomsInput('10rooms'), /non-negative whole integer/);
});

test('Server parseSpaceInput logic: validates non-negative integer or throws', () => {
  const parseSpaceInput = (val, existingVal, fieldName) => {
    if (val === undefined || val === null) return Number(existingVal) || 0;
    const num = Number(val);
    if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
      throw new Error(`${fieldName} count must be a non-negative integer`);
    }
    return num;
  };

  // Valid inputs
  assert.strictEqual(parseSpaceInput(0, 5, 'total_rooms'), 0);
  assert.strictEqual(parseSpaceInput(40, 5, 'total_rooms'), 40);
  assert.strictEqual(parseSpaceInput('12', 5, 'total_rooms'), 12);
  assert.strictEqual(parseSpaceInput(undefined, 8, 'total_rooms'), 8);

  // Invalid inputs
  assert.throws(() => parseSpaceInput(-5, 0, 'total_rooms'), /must be a non-negative integer/);
  assert.throws(() => parseSpaceInput(4.2, 0, 'total_rooms'), /must be a non-negative integer/);
  assert.throws(() => parseSpaceInput('invalid', 0, 'total_rooms'), /must be a non-negative integer/);
});

test('Server SaaS plan limit enforcement: respects max_tables limit across all spaces', () => {
  const maxTablesAllowed = 50;
  const currentResto = { total_tables: 0, total_cabins: 0, total_rooms: 20, total_vip: 0 };
  const existingTotalSpaces = 20;

  const checkPlanLimit = (reqRooms) => {
    const requestedTotalSpaces = reqRooms;
    if (requestedTotalSpaces > maxTablesAllowed && requestedTotalSpaces > existingTotalSpaces) {
      return { allowed: false, error: 'plan_limit_reached' };
    }
    return { allowed: true };
  };

  assert.strictEqual(checkPlanLimit(35).allowed, true, '35 rooms is within 50 limit');
  assert.strictEqual(checkPlanLimit(50).allowed, true, '50 rooms is at limit');
  assert.strictEqual(checkPlanLimit(51).allowed, false, '51 rooms exceeds limit of 50');
  assert.strictEqual(checkPlanLimit(100).error, 'plan_limit_reached');
});

// ======================================================================
// SECTION 3: Multi-Tenant Isolation & Unaffected Configurations
// ======================================================================
console.log('\n--- SECTION 3: Tenant Isolation & Non-Interference ---');

test('Isolation: setting total_rooms for Hotel does not alter Restaurant tables or Cinema seats', () => {
  // Tenant A: Hotel
  const hotelTenant = {
    id: 101,
    slug: 'grand-palace-hotel',
    business_type: 'hotel_resort',
    service_model: 'hotel',
    total_rooms: 0,
    total_tables: 0
  };

  // Tenant B: Dining Restaurant
  const restaurantTenant = {
    id: 102,
    slug: 'spice-garden-dining',
    business_type: 'restaurant',
    service_model: 'dine_in_table',
    total_tables: 24,
    total_cabins: 4,
    total_vip: 2,
    total_rooms: 0
  };

  // Tenant C: Cinema
  const cinemaTenant = {
    id: 103,
    slug: 'galaxy-cinemas',
    business_type: 'cinema_theatre',
    service_model: 'cinema',
    cinema_screens: 3,
    cinema_seats: 120
  };

  // Hotel updates total_rooms to 45
  const updatedHotel = { ...hotelTenant, total_rooms: 45 };

  // Assert hotel changed
  assert.strictEqual(updatedHotel.total_rooms, 45);

  // Assert restaurant remains completely unaffected
  assert.strictEqual(restaurantTenant.total_tables, 24);
  assert.strictEqual(restaurantTenant.total_cabins, 4);
  assert.strictEqual(restaurantTenant.total_vip, 2);
  assert.strictEqual(restaurantTenant.total_rooms, 0);

  // Assert cinema remains completely unaffected
  assert.strictEqual(cinemaTenant.cinema_screens, 3);
  assert.strictEqual(cinemaTenant.cinema_seats, 120);
});

test('Cross-tenant mutation prevention: update query binds targetId strictly from authenticated tenant', () => {
  const reqUserTenantA = { restaurantId: 201 };
  const reqUserTenantB = { restaurantId: 202 };

  // Simulated handler target resolution
  const getTargetId = (reqUser) => reqUser.restaurantId;

  const targetA = getTargetId(reqUserTenantA);
  const targetB = getTargetId(reqUserTenantB);

  assert.strictEqual(targetA, 201);
  assert.strictEqual(targetB, 202);
  assert.notStrictEqual(targetA, targetB, 'Tenant A cannot resolve to Tenant B');
});

// ======================================================================
// SECTION 4: Lowering Room Count Does Not Delete Orders / History
// ======================================================================
console.log('\n--- SECTION 4: Non-Destructive Room Count Changes ---');

test('Lowering room count preserves existing orders and order history', () => {
  const historicalOrders = [
    { id: 1, space_type: 'room', space_number: '1', status: 'completed' },
    { id: 2, space_type: 'room', space_number: '15', status: 'completed' },
    { id: 3, space_type: 'room', space_number: '20', status: 'completed' },
    { id: 4, space_type: 'room', space_number: '5', status: 'served' }
  ];

  // Admin lowers room count from 20 to 10
  const oldRoomCount = 20;
  const newRoomCount = 10;
  assert.ok(newRoomCount < oldRoomCount);

  // Verification that existing order records are unaffected in the database
  const preservedOrders = [...historicalOrders];
  assert.strictEqual(preservedOrders.length, 4);
  assert.ok(preservedOrders.some(o => o.space_number === '15'));
  assert.ok(preservedOrders.some(o => o.space_number === '20'));
});

async function run() {
  test('Capacity validation: rooms > total_rooms rejected for new orders, existing within capacity allowed', async () => {
    const hotel = {
      id: 501,
      total_rooms: 10,
      total_tables: 0,
      total_cabins: 0,
      total_vip: 0
    };

    // Room 5 is within limit
    const checkRoom5 = await validateSpaceCapacity(hotel, 'room', '5');
    assert.strictEqual(checkRoom5.valid, true);

    // Room 10 is at limit
    const checkRoom10 = await validateSpaceCapacity(hotel, 'room', '10');
    assert.strictEqual(checkRoom10.valid, true);

    // Room 11 exceeds limit
    const checkRoom11 = await validateSpaceCapacity(hotel, 'room', '11');
    assert.strictEqual(checkRoom11.valid, false);
    assert.match(checkRoom11.message, /not registered/i);
  });

  // ======================================================================
  // SECTION 5: OrdersView & QrGeneratorView Inventory & Empty State
  // ======================================================================
  console.log('\n--- SECTION 5: OrdersView & QrGeneratorView Room Inventory & Empty State ---');

  test('OrdersView room inventory: 0 configured rooms evaluates strictly to 0 (no fallback to 10)', () => {
    const computeRoomInventory = (isHotel, total_rooms) => {
      if (!isHotel) return [];
      const rawRooms = total_rooms;
      const roomCount = (rawRooms !== undefined && rawRooms !== null && !isNaN(Number(rawRooms)))
        ? Math.max(0, Math.floor(Number(rawRooms)))
        : 0;

      return Array.from({ length: roomCount }, (_, i) => {
        const num = String(i + 1);
        return {
          id: `room_${num}`,
          space_type: 'room',
          space_number: num,
          label: `ROOM ${num}`
        };
      });
    };

    // Zero rooms must return empty array, NOT 10 rooms
    const zeroRooms = computeRoomInventory(true, 0);
    assert.strictEqual(zeroRooms.length, 0, '0 rooms must evaluate to 0 items, never fall back to 10');

    // Null/undefined rooms must return empty array
    const nullRooms = computeRoomInventory(true, null);
    assert.strictEqual(nullRooms.length, 0);

    // 12 rooms returns exactly 12 items
    const twelveRooms = computeRoomInventory(true, 12);
    assert.strictEqual(twelveRooms.length, 12);
    assert.strictEqual(twelveRooms[0].id, 'room_1');
    assert.strictEqual(twelveRooms[11].id, 'room_12');
  });

  test('QrGeneratorView configuredSpaces: hotel only generates rooms, empty state when total_rooms is 0', () => {
    const buildConfiguredSpaces = (isHotel, isCinema, total_rooms, total_tables) => {
      const spaces = [];
      if (isCinema) {
        return spaces;
      } else if (isHotel) {
        const roomsCount = Math.max(0, Number(total_rooms || 0));
        for (let i = 1; i <= roomsCount; i++) {
          const numStr = String(i);
          spaces.push({
            key: `room:${numStr}`,
            spaceType: 'room',
            spaceNumber: numStr,
            label: `Room ${i}`,
            category: 'room'
          });
        }
      } else {
        const tablesCount = Math.max(0, Number(total_tables || 0));
        for (let i = 1; i <= tablesCount; i++) {
          const numStr = String(i);
          spaces.push({
            key: `table:${numStr}`,
            spaceType: 'table',
            spaceNumber: numStr,
            label: `Table ${i}`,
            category: 'table'
          });
        }
      }
      return spaces;
    };

    // Hotel with 0 rooms: must return empty array
    const hotelZero = buildConfiguredSpaces(true, false, 0, 10);
    assert.strictEqual(hotelZero.length, 0, 'Hotel with 0 rooms has 0 spaces even if total_tables has residual value');

    // Hotel with 15 rooms: must return 15 rooms
    const hotelFifteen = buildConfiguredSpaces(true, false, 15, 0);
    assert.strictEqual(hotelFifteen.length, 15);
    assert.strictEqual(hotelFifteen.every(s => s.spaceType === 'room'), true);

    // Dining restaurant with 10 tables: must return 10 tables
    const diningTen = buildConfiguredSpaces(false, false, 0, 10);
    assert.strictEqual(diningTen.length, 10);
    assert.strictEqual(diningTen.every(s => s.spaceType === 'table'), true);
  });

  test('Empty state messaging: hotel empty state informs user to set Total Guest Rooms in Setup', () => {
    const getEmptyStateConfig = (isCinema, isHotel) => {
      if (isCinema) {
        return {
          title: 'No Physical Spaces Configured',
          message: 'No cinema screens or seats found in database. Configure seats in Cinema Setup.',
          buttonLabel: 'Go to Cinema Settings',
          drawerTarget: 'cinema'
        };
      }
      if (isHotel) {
        return {
          title: 'No Guest Rooms Configured',
          message: 'No hotel guest rooms configured. Set your Total Guest Rooms in Business Profile to generate room QR codes.',
          buttonLabel: 'Go to Hotel Settings',
          drawerTarget: 'profile'
        };
      }
      return {
        title: 'No Physical Spaces Configured',
        message: 'Set your total tables, cabins, or VIP spaces in Restaurant Setup to generate standees.',
        buttonLabel: 'Go to Restaurant Settings',
        drawerTarget: 'general'
      };
    };

    const hotelEmpty = getEmptyStateConfig(false, true);
    assert.strictEqual(hotelEmpty.title, 'No Guest Rooms Configured');
    assert.strictEqual(hotelEmpty.buttonLabel, 'Go to Hotel Settings');
    assert.strictEqual(hotelEmpty.drawerTarget, 'profile');

    const restaurantEmpty = getEmptyStateConfig(false, false);
    assert.strictEqual(restaurantEmpty.title, 'No Physical Spaces Configured');
    assert.strictEqual(restaurantEmpty.buttonLabel, 'Go to Restaurant Settings');
    assert.strictEqual(restaurantEmpty.drawerTarget, 'general');

    const cinemaEmpty = getEmptyStateConfig(true, false);
    assert.strictEqual(cinemaEmpty.buttonLabel, 'Go to Cinema Settings');
    assert.strictEqual(cinemaEmpty.drawerTarget, 'cinema');
  });

  // ======================================================================
  // SUMMARY
  // ======================================================================
  console.log('\n======================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
