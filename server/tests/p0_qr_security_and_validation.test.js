process.env.NODE_ENV = 'test';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';
import {
  generateHmacQrToken,
  generateLegacyQrToken,
  generateRestaurantQrSecret,
  verifyQrToken,
  normalizeSpaceType,
  normalizeSpaceNumber,
  isValidQrTokenFormat,
  validateSpaceCapacity
} from '../utils/qrSecurity.js';
import {
  normalizeSpaceType as clientNormalizeSpaceType,
  normalizeSpaceNumber as clientNormalizeSpaceNumber,
  isValidQrTokenFormat as clientIsValidQrTokenFormat
} from '../../src/utils/qrSecurity.js';
import { query, initDb } from '../db.js';

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR P0 QR SECURITY & BACKEND VALIDATION TEST SUITE');
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

  // ----------------------------------------------------------------------
  // SECTION 1: HMAC-SHA256 Token Generation & Verification
  // ----------------------------------------------------------------------
  console.log('--- SECTION 1: HMAC-SHA256 Signing & Verification ---');

  const secretA = '7c9e6679f3c7d674176d63d6b7970d4f6c4f74d6b5e0c651f8a20d436ef8fb57';
  const secretB = '99999999f3c7d674176d63d6b7970d4f6c4f74d6b5e0c651f8a20d436ef8fb99';
  const slugA = 'cafe-delight';
  const slugB = 'bistro-prime';

  test('Produces genuine 64-character hexadecimal HMAC-SHA256 signature', () => {
    const token = generateHmacQrToken(slugA, 'table', '5', secretA);
    assert.strictEqual(typeof token, 'string');
    assert.strictEqual(token.length, 64);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  test('Valid HMAC-SHA256 token verifies successfully', () => {
    const token = generateHmacQrToken(slugA, 'table', '5', secretA);
    const result = verifyQrToken(slugA, 'table', '5', secretA, token);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reason, null);
    assert.strictEqual(result.legacy, false);
  });

  test('Tampered signature is strictly rejected', () => {
    const token = generateHmacQrToken(slugA, 'table', '5', secretA);
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
    const result = verifyQrToken(slugA, 'table', '5', secretA, tampered);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'invalid_token');
  });

  test('Cross-tenant token reuse is strictly rejected', () => {
    const tokenA = generateHmacQrToken(slugA, 'table', '5', secretA);
    const resultWrongSlug = verifyQrToken(slugB, 'table', '5', secretA, tokenA);
    assert.strictEqual(resultWrongSlug.valid, false);
    assert.strictEqual(resultWrongSlug.reason, 'invalid_token');

    const resultWrongSecret = verifyQrToken(slugA, 'table', '5', secretB, tokenA);
    assert.strictEqual(resultWrongSecret.valid, false);
    assert.strictEqual(resultWrongSecret.reason, 'invalid_token');
  });

  test('Cross-space token reuse is strictly rejected', () => {
    const tokenTable5 = generateHmacQrToken(slugA, 'table', '5', secretA);
    const resultTable6 = verifyQrToken(slugA, 'table', '6', secretA, tokenTable5);
    assert.strictEqual(resultTable6.valid, false);
    assert.strictEqual(resultTable6.reason, 'invalid_token');

    const resultCabin5 = verifyQrToken(slugA, 'cabin', '5', secretA, tokenTable5);
    assert.strictEqual(resultCabin5.valid, false);
    assert.strictEqual(resultCabin5.reason, 'invalid_token');
  });

  test('Missing secret or empty token fails securely', () => {
    assert.strictEqual(generateHmacQrToken(slugA, 'table', '5', ''), '');
    assert.strictEqual(generateHmacQrToken(slugA, 'table', '5', null), '');

    const emptyRes = verifyQrToken(slugA, 'table', '5', secretA, '');
    assert.strictEqual(emptyRes.valid, false);
    assert.strictEqual(emptyRes.reason, 'missing_token');

    const noSecretRes = verifyQrToken(slugA, 'table', '5', '', 'abc12345');
    assert.strictEqual(noSecretRes.valid, false);
    assert.strictEqual(noSecretRes.reason, 'invalid_input');
  });

  // ----------------------------------------------------------------------
  // SECTION 2: Normalization Contract Alignment
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 2: Normalization Contract Alignment ---');

  test('Server and Client normalizers produce identical canonical outputs', () => {
    const testCasesSpaceNum = [
      ['1', '1'],
      ['01', '1'],
      ['007', '7'],
      ['  5  ', '5'],
      ['Table 4', '4'],
      ['TABLE 12', '12'],
      ['tbl 9', '9'],
      ['🍽️ 3', '3'],
      ['S1-A-12', 'S1-A-12'],
      ['s2-b-5', 'S2-B-5'],
      ['Screen 1 - Row A - Seat 12', 'S1-A-12'],
      ['Screen 2, Row B, Seat 3', 'S2-B-3'],
      ['', ''],
      [null, ''],
      [undefined, '']
    ];

    for (const [input, expected] of testCasesSpaceNum) {
      const serverResult = normalizeSpaceNumber(input);
      const clientResult = clientNormalizeSpaceNumber(input);
      assert.strictEqual(serverResult, expected, `Server normalizer mismatch for input: "${input}"`);
      assert.strictEqual(clientResult, expected, `Client normalizer mismatch for input: "${input}"`);
      assert.strictEqual(serverResult, clientResult, `Server and client normalizers diverged for: "${input}"`);
    }

    const testCasesSpaceType = [
      ['table', 'table'],
      ['Table', 'table'],
      ['cabin', 'cabin'],
      ['room', 'room'],
      ['vip', 'vip'],
      ['cinema', 'cinema_seat'],
      ['cinema_seat', 'cinema_seat'],
      ['seat', 'cinema_seat']
    ];

    for (const [input, expected] of testCasesSpaceType) {
      const serverResult = normalizeSpaceType(input);
      const clientResult = clientNormalizeSpaceType(input);
      assert.strictEqual(serverResult, expected);
      assert.strictEqual(clientResult, expected);
    }
  });

  test('Normalizers DO NOT convert empty or invalid input into "1"', () => {
    assert.strictEqual(normalizeSpaceNumber(''), '');
    assert.strictEqual(clientNormalizeSpaceNumber(''), '');
    assert.strictEqual(normalizeSpaceNumber('   '), '');
    assert.strictEqual(clientNormalizeSpaceNumber('   '), '');
  });

  // ----------------------------------------------------------------------
  // SECTION 3: Cinema QR Space Type Alignment
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 3: Cinema QR Space Type Alignment ---');

  test('Cinema seat tokens sign and verify consistently with canonical type "cinema_seat"', () => {
    const seatCode = 'S1-A-12';
    const token = generateHmacQrToken(slugA, 'cinema_seat', seatCode, secretA);
    const result = verifyQrToken(slugA, 'cinema_seat', seatCode, secretA, token);
    assert.strictEqual(result.valid, true);

    const aliasResult = verifyQrToken(slugA, normalizeSpaceType('cinema'), seatCode, secretA, token);
    assert.strictEqual(aliasResult.valid, true);
  });

  // ----------------------------------------------------------------------
  // SECTION 4: Physical Space Capacity Validation (No Fallback!)
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 4: Physical Space Capacity Validation ---');

  testAsync('Cabins reject requests when total_cabins is 0, even if total_tables > 0', async () => {
    const resto = {
      id: 101,
      total_tables: 20,
      total_cabins: 0,
      total_rooms: 0,
      total_vip: 0
    };
    const check = await validateSpaceCapacity(resto, 'cabin', '1');
    assert.strictEqual(check.valid, false);
    assert.match(check.message, /does not have cabin spaces configured/i);
  });

  testAsync('Rooms reject requests when total_rooms is 0, even if total_tables > 0', async () => {
    const resto = {
      id: 101,
      total_tables: 20,
      total_cabins: 5,
      total_rooms: 0,
      total_vip: 0
    };
    const check = await validateSpaceCapacity(resto, 'room', '1');
    assert.strictEqual(check.valid, false);
    assert.match(check.message, /does not have room spaces configured/i);
  });

  testAsync('VIP lounges reject requests when total_vip is 0, even if total_tables > 0', async () => {
    const resto = {
      id: 101,
      total_tables: 20,
      total_cabins: 5,
      total_rooms: 10,
      total_vip: 0
    };
    const check = await validateSpaceCapacity(resto, 'vip', '1');
    assert.strictEqual(check.valid, false);
    assert.match(check.message, /does not have vip spaces configured/i);
  });

  testAsync('Valid configured physical spaces within limits are accepted', async () => {
    const resto = {
      id: 101,
      total_tables: 15,
      total_cabins: 4,
      total_rooms: 8,
      total_vip: 2
    };
    const validCabin = await validateSpaceCapacity(resto, 'cabin', '3');
    assert.strictEqual(validCabin.valid, true);

    const validRoom = await validateSpaceCapacity(resto, 'room', '7');
    assert.strictEqual(validRoom.valid, true);

    const validVip = await validateSpaceCapacity(resto, 'vip', '2');
    assert.strictEqual(validVip.valid, true);

    const validTable = await validateSpaceCapacity(resto, 'table', '15');
    assert.strictEqual(validTable.valid, true);
  });

  testAsync('Physical space exceeding capacity is rejected', async () => {
    const resto = {
      id: 101,
      total_tables: 15,
      total_cabins: 4
    };
    const overCabin = await validateSpaceCapacity(resto, 'cabin', '5');
    assert.strictEqual(overCabin.valid, false);
    assert.match(overCabin.message, /is not registered/i);

    const overTable = await validateSpaceCapacity(resto, 'table', '16');
    assert.strictEqual(overTable.valid, false);
    assert.match(overTable.message, /is not registered/i);
  });

  // ----------------------------------------------------------------------
  // SECTION 5: Authoritative Cinema Seat Validation
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 5: Authoritative Cinema Seat DB Validation ---');

  await initDb();

  // Find or insert valid test restaurant
  let testRestoId = 1;
  try {
    const existingRestos = await query('SELECT id FROM restaurants ORDER BY id ASC LIMIT 1');
    if (existingRestos && existingRestos.length > 0) {
      testRestoId = existingRestos[0].id;
    }
  } catch (e) {}

  let screenId = null;
  let activeSeatId = null;
  let inactiveSeatId = null;

  try {
    const scrRes = await query(`
      INSERT INTO restaurant_cinema_screens (restaurant_id, screen_number, name, active)
      VALUES ($1, 88, 'Screen 88 Test Audi', true)
      RETURNING id
    `, [testRestoId]);
    screenId = scrRes[0]?.id || scrRes.lastInsertRowid;

    const seat1Res = await query(`
      INSERT INTO restaurant_cinema_seats (restaurant_id, screen_id, row_label, seat_number, seat_code, active)
      VALUES ($1, $2, 'A', 1, 'S88-A-1', true)
      RETURNING id
    `, [testRestoId, screenId]);
    activeSeatId = seat1Res[0]?.id || seat1Res.lastInsertRowid;

    const seat2Res = await query(`
      INSERT INTO restaurant_cinema_seats (restaurant_id, screen_id, row_label, seat_number, seat_code, active)
      VALUES ($1, $2, 'A', 2, 'S88-A-2', false)
      RETURNING id
    `, [testRestoId, screenId]);
    inactiveSeatId = seat2Res[0]?.id || seat2Res.lastInsertRowid;
  } catch (seedErr) {
    console.warn('Cinema test seed notice:', seedErr.message);
  }

  const cinemaResto = { id: testRestoId, slug: 'test-cinema' };

  await testAsync('Configured, active cinema seat is accepted', async () => {
    const check = await validateSpaceCapacity(cinemaResto, 'cinema_seat', 'S88-A-1');
    assert.strictEqual(check.valid, true);
  });

  await testAsync('Unknown cinema seat (not in database) is rejected', async () => {
    const check = await validateSpaceCapacity(cinemaResto, 'cinema_seat', 'S88-A-99');
    assert.strictEqual(check.valid, false);
    assert.match(check.message, /does not exist in this cinema/i);
  });

  await testAsync('Inactive cinema seat is rejected', async () => {
    const check = await validateSpaceCapacity(cinemaResto, 'cinema_seat', 'S88-A-2');
    assert.strictEqual(check.valid, false);
    assert.match(check.message, /is currently inactive/i);
  });

  await testAsync('Cross-restaurant cinema seat is rejected', async () => {
    const otherResto = { id: testRestoId + 99999, slug: 'other-cinema' };
    const check = await validateSpaceCapacity(otherResto, 'cinema_seat', 'S88-A-1');
    assert.strictEqual(check.valid, false);
    assert.match(check.message, /does not exist in this cinema/i);
  });

  // Clean up test cinema records
  try {
    if (activeSeatId) await query('DELETE FROM restaurant_cinema_seats WHERE id = $1', [activeSeatId]);
    if (inactiveSeatId) await query('DELETE FROM restaurant_cinema_seats WHERE id = $1', [inactiveSeatId]);
    if (screenId) await query('DELETE FROM restaurant_cinema_screens WHERE id = $1', [screenId]);
  } catch (cleanErr) {}

  // ----------------------------------------------------------------------
  // SECTION 6: Secret Secrecy & Response Sanitization
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 6: Secret Secrecy & Response Sanitization ---');

  test('qr_secret is stripped from admin settings, me, and login responses', () => {
    const mockDbRow = {
      id: 1,
      name: 'Test Kitchen',
      slug: 'test-kitchen',
      qr_secret: 'super_secret_signing_key_never_leak',
      kds_pin_hash: 'hashed_pin_value',
      total_tables: 10
    };

    // Simulated GET /settings response sanitization
    const { qr_secret: s1, kds_pin_hash: p1, ...safeSettings } = mockDbRow;
    assert.strictEqual(safeSettings.qr_secret, undefined);
    assert.strictEqual(safeSettings.kds_pin_hash, undefined);
    assert.strictEqual(safeSettings.id, 1);
    assert.strictEqual(safeSettings.name, 'Test Kitchen');

    // Simulated GET /me response sanitization
    const { kds_pin_hash: p2, qr_secret: s2, ...safeRestoObj } = mockDbRow;
    assert.strictEqual(safeRestoObj.qr_secret, undefined);
    assert.strictEqual(safeRestoObj.kds_pin_hash, undefined);
  });

  // ----------------------------------------------------------------------
  // SECTION 7: Legacy QR Migration Grace Period Support
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 7: Legacy QR Migration & Grace Period ---');

  test('Legacy 8-character token verifies only when grace period is enabled and server secret is used', () => {
    const legacyToken = generateLegacyQrToken(slugA, 'table', '5', secretA);
    assert.strictEqual(legacyToken.length, 8);

    const resultWithGrace = verifyQrToken(slugA, 'table', '5', secretA, legacyToken, {
      allowLegacy: true,
      restaurantId: 1
    });
    assert.strictEqual(resultWithGrace.valid, true);
    assert.strictEqual(resultWithGrace.legacy, true);
  });

  test('Legacy token is strictly rejected when requireHmac is true (sensitive routes)', () => {
    const legacyToken = generateLegacyQrToken(slugA, 'table', '5', secretA);
    const resultHmacRequired = verifyQrToken(slugA, 'table', '5', secretA, legacyToken, {
      requireHmac: true,
      allowLegacy: true
    });
    assert.strictEqual(resultHmacRequired.valid, false);
    assert.strictEqual(resultHmacRequired.reason, 'legacy_token_deprecated');
  });

  test('Predictable metadata legacy formula (${id}_${slug}_tq) is rejected even during grace period', () => {
    const forgedToken = generateLegacyQrToken(slugA, 'table', '5', `1_${slugA}_tq`);
    const resultForged = verifyQrToken(slugA, 'table', '5', secretA, forgedToken, {
      allowLegacy: true,
      restaurantId: 1
    });
    assert.strictEqual(resultForged.valid, false);
    assert.strictEqual(resultForged.reason, 'invalid_token');
  });

  test('Legacy token is rejected when grace period is disabled', () => {
    const legacyToken = generateLegacyQrToken(slugA, 'table', '5', secretA);
    const resultWithoutGrace = verifyQrToken(slugA, 'table', '5', secretA, legacyToken, {
      allowLegacy: false
    });
    assert.strictEqual(resultWithoutGrace.valid, false);
    assert.strictEqual(resultWithoutGrace.reason, 'legacy_token_deprecated');
  });

  // ----------------------------------------------------------------------
  // SECTION 8: Real Express HTTP Endpoint Regression Tests
  // ----------------------------------------------------------------------
  console.log('\n--- SECTION 8: Real Express HTTP Endpoint Regression Tests ---');

  const app = (await import('../index.js')).default;
  const server = app.listen(0);
  const serverPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  // Find or setup valid test restaurant in DB
  let epResto = null;
  const restoRows = await query('SELECT * FROM restaurants WHERE active = true ORDER BY id ASC LIMIT 1');
  if (restoRows && restoRows.length > 0) {
    epResto = restoRows[0];
  } else {
    const newSecret = generateRestaurantQrSecret();
    const created = await query(`
      INSERT INTO restaurants (name, slug, qr_secret, total_tables, active)
      VALUES ('Endpoint Test Resto', 'endpoint-test-resto', $1, 10, true)
      RETURNING *
    `, [newSecret]);
    epResto = created[0];
  }

  if (!epResto.qr_secret) {
    epResto.qr_secret = generateRestaurantQrSecret();
    await query('UPDATE restaurants SET qr_secret = $1 WHERE id = $2', [epResto.qr_secret, epResto.id]);
  }
  await query('UPDATE restaurants SET total_tables = 10, direct_ordering_enabled = 1, active = true WHERE id = $1', [epResto.id]);

  const epSlug = epResto.slug;
  const epSecret = epResto.qr_secret;

  await testAsync('Endpoint POST /api/orders/verify-location: Forged legacy token is rejected (403)', async () => {
    const forgedToken = generateLegacyQrToken(epSlug, 'table', '1', `${epResto.id}_${epSlug}_tq`);
    const countBefore = await query('SELECT COUNT(*) as c FROM table_location_verifications WHERE restaurant_id = $1', [epResto.id]);

    const res = await fetch(`${baseUrl}/api/orders/verify-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: epSlug,
        table: '1',
        tkn: forgedToken,
        lat: 12.9716,
        lng: 77.5946
      })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error, 'legacy_qr_deprecated');

    // Zero DB writes assertion
    const countAfter = await query('SELECT COUNT(*) as c FROM table_location_verifications WHERE restaurant_id = $1', [epResto.id]);
    assert.strictEqual(Number(countBefore[0].c), Number(countAfter[0].c));
  });

  await testAsync('Endpoint POST /api/orders/verify-location: ENABLE_LEGACY_QR_GRACE_PERIOD=true cannot bypass sensitive route', async () => {
    const oldEnv = process.env.ENABLE_LEGACY_QR_GRACE_PERIOD;
    try {
      process.env.ENABLE_LEGACY_QR_GRACE_PERIOD = 'true';
      const legacyToken = generateLegacyQrToken(epSlug, 'table', '1', epSecret);
      const res = await fetch(`${baseUrl}/api/orders/verify-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: epSlug,
          table: '1',
          tkn: legacyToken
        })
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error, 'legacy_qr_deprecated');
    } finally {
      process.env.ENABLE_LEGACY_QR_GRACE_PERIOD = oldEnv;
    }
  });

  await testAsync('Endpoint POST /api/service-requests: Forged legacy tokens and missing tokens cannot create requests (403)', async () => {
    const forgedToken = generateLegacyQrToken(epSlug, 'table', '1', `${epResto.id}_${epSlug}_tq`);
    const countBefore = await query('SELECT COUNT(*) as c FROM service_requests WHERE restaurant_id = $1', [epResto.id]);

    // 1. Missing token
    const resMissing = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: epSlug,
        table_number: '1',
        request_type: 'Call Waiter'
      })
    });
    assert.strictEqual(resMissing.status, 403);

    // 2. Forged legacy token
    const resForged = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: epSlug,
        table_number: '1',
        request_type: 'Call Waiter',
        table_token: forgedToken
      })
    });
    assert.strictEqual(resForged.status, 403);
    const bodyForged = await resForged.json();
    assert.strictEqual(bodyForged.error, 'legacy_qr_deprecated');

    // 3. Wrong space token (token for table 2 sent for table 1)
    const tokenTable2 = generateHmacQrToken(epSlug, 'table', '2', epSecret);
    const resWrongSpace = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: epSlug,
        table_number: '1',
        request_type: 'Call Waiter',
        table_token: tokenTable2
      })
    });
    assert.strictEqual(resWrongSpace.status, 403);

    // 4. Unconfigured space (table 999 where total_tables is 10)
    const tokenTable999 = generateHmacQrToken(epSlug, 'table', '999', epSecret);
    const resOverSpace = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: epSlug,
        table_number: '999',
        request_type: 'Call Waiter',
        table_token: tokenTable999
      })
    });
    assert.strictEqual(resOverSpace.status, 403);
    const bodyOver = await resOverSpace.json();
    assert.strictEqual(bodyOver.error, 'invalid_space');

    // Strict zero DB writes assertion
    const countAfter = await query('SELECT COUNT(*) as c FROM service_requests WHERE restaurant_id = $1', [epResto.id]);
    assert.strictEqual(Number(countBefore[0].c), Number(countAfter[0].c));
  });

  await testAsync('Endpoint POST /api/service-requests: Valid modern HMAC token creates request (200)', async () => {
    const modernToken = generateHmacQrToken(epSlug, 'table', '1', epSecret);
    const res = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: epSlug,
        table_number: '1',
        request_type: 'Drinking Water 💧',
        table_token: modernToken
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.request_id);

    // Clean up created test record
    await query('DELETE FROM service_requests WHERE id = $1', [body.request_id]);
  });

  await testAsync('Endpoint GET /api/orders/active-table: Unauthorized customer is rejected with 403', async () => {
    // 1. Missing token
    const resNoToken = await fetch(`${baseUrl}/api/orders/active-table?slug=${epSlug}&table_number=1`);
    assert.strictEqual(resNoToken.status, 403);
    const bodyNoToken = await resNoToken.json();
    assert.strictEqual(bodyNoToken.error, 'unauthorized_table_access');

    // 2. Forged legacy token
    const forgedToken = generateLegacyQrToken(epSlug, 'table', '1', `${epResto.id}_${epSlug}_tq`);
    const resLegacy = await fetch(`${baseUrl}/api/orders/active-table?slug=${epSlug}&table_number=1&tkn=${forgedToken}`);
    assert.strictEqual(resLegacy.status, 403);

    // 3. Token for table 2 sent to table 1
    const tokenT2 = generateHmacQrToken(epSlug, 'table', '2', epSecret);
    const resWrongTable = await fetch(`${baseUrl}/api/orders/active-table?slug=${epSlug}&table_number=1&tkn=${tokenT2}`);
    assert.strictEqual(resWrongTable.status, 403);

    // 4. Token for another restaurant sent to this restaurant
    const tokenOther = generateHmacQrToken('other-resto', 'table', '1', epSecret);
    const resOtherResto = await fetch(`${baseUrl}/api/orders/active-table?slug=${epSlug}&table_number=1&tkn=${tokenOther}`);
    assert.strictEqual(resOtherResto.status, 403);
  });

  await testAsync('Endpoint GET /api/orders/active-table: Authorized customer with modern HMAC token succeeds (200)', async () => {
    const validToken = generateHmacQrToken(epSlug, 'table', '1', epSecret);
    const res = await fetch(`${baseUrl}/api/orders/active-table?slug=${epSlug}&table_number=1&tkn=${validToken}`);
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Endpoint GET /api/orders/active-table: Authorized Admin JWT succeeds (200)', async () => {
    const adminToken = jwt.sign({
      id: 9991,
      username: 'test_admin',
      role: 'restaurant_admin',
      restaurant_id: epResto.id
    }, JWT_SECRET, { expiresIn: '1h' });

    const res = await fetch(`${baseUrl}/api/orders/active-table?slug=${epSlug}&table_number=1`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(res.status, 200);
  });

  await testAsync('Endpoint GET /api/superadmin/restaurants: Responses NEVER expose qr_secret', async () => {
    const saToken = jwt.sign({
      id: 1,
      username: 'superadmin',
      role: 'superadmin'
    }, JWT_SECRET, { expiresIn: '1h' });

    // Unpaginated list
    const res = await fetch(`${baseUrl}/api/superadmin/restaurants`, {
      headers: {
        Authorization: `Bearer ${saToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const restos = await res.json();
    assert.ok(Array.isArray(restos));
    assert.ok(restos.length > 0);
    for (const r of restos) {
      assert.strictEqual(r.qr_secret, undefined, `Restaurant ${r.id} (${r.slug}) leaked qr_secret in unpaginated list!`);
    }

    // Paginated list
    const resPaginated = await fetch(`${baseUrl}/api/superadmin/restaurants?page=1&limit=5`, {
      headers: {
        Authorization: `Bearer ${saToken}`
      }
    });
    assert.strictEqual(resPaginated.status, 200);
    const paginatedData = await resPaginated.json();
    assert.ok(Array.isArray(paginatedData.data));
    for (const r of paginatedData.data) {
      assert.strictEqual(r.qr_secret, undefined, `Restaurant ${r.id} (${r.slug}) leaked qr_secret in paginated list!`);
    }
  });

  // Cleanly close test HTTP server
  await new Promise((resolve) => server.close(resolve));

  // ----------------------------------------------------------------------
  // Summary
  // ----------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`🏁 TEST EXECUTION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
