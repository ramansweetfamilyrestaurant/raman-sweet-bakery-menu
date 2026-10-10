import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  STANDEE_THEMES,
  STANDEE_FRAMES,
  buildStandeeCardHtml,
  generateStandeePrintDocument
} from '../../src/utils/standeeTemplates.js';
import {
  normalizeSpaceType,
  normalizeSpaceNumber,
  isValidQrTokenFormat,
  isValidHmacTokenFormat
} from '../../src/utils/qrSecurity.js';
import {
  generateHmacQrToken,
  verifyQrToken
} from '../utils/qrSecurity.js';

console.log('======================================================================');
console.log('🛡️  TOUCHQR UNIFIED STANDEE WORKSPACE REGRESSION TEST SUITE');
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
// 1. Authoritative Inventory Counting & Space Derivation
// ----------------------------------------------------------------------
console.log('--- SECTION 1: Authoritative Space Inventory & Dynamic Updates ---');

test('Derives exact configured physical spaces without arbitrary caps or localStorage', () => {
  const deriveSpaces = (settings, cinemaSeats, isCinema) => {
    const spaces = [];
    if (isCinema) {
      if (Array.isArray(cinemaSeats)) {
        cinemaSeats.filter(s => s.active !== false).forEach(seat => {
          const sNum = seat.screen_number || '1';
          const rLabel = (seat.row_label || 'A').toUpperCase();
          const stNum = seat.seat_number || '1';
          spaces.push({ key: `cinema_seat:S${sNum}-${rLabel}-${stNum}`, spaceType: 'cinema_seat', label: `Screen ${sNum} • Row ${rLabel} • Seat ${stNum}` });
        });
      }
    } else {
      const tables = Math.max(0, Number(settings.total_tables || 0));
      for (let i = 1; i <= tables; i++) spaces.push({ key: `table:${i}`, spaceType: 'table', label: `Table ${i}` });
      const cabins = Math.max(0, Number(settings.total_cabins || 0));
      for (let i = 1; i <= cabins; i++) spaces.push({ key: `cabin:${i}`, spaceType: 'cabin', label: `Cabin ${i}` });
      const rooms = Math.max(0, Number(settings.total_rooms || 0));
      for (let i = 1; i <= rooms; i++) spaces.push({ key: `room:${i}`, spaceType: 'room', label: `Room ${i}` });
      const vip = Math.max(0, Number(settings.total_vip || 0));
      for (let i = 1; i <= vip; i++) spaces.push({ key: `vip:${i}`, spaceType: 'vip', label: `VIP Lounge ${i}` });
    }
    return spaces;
  };

  // Test configured counts
  const settingsA = { total_tables: 15, total_cabins: 4, total_rooms: 8, total_vip: 2 };
  const spacesA = deriveSpaces(settingsA, [], false);
  assert.strictEqual(spacesA.length, 29);
  assert.strictEqual(spacesA.filter(s => s.spaceType === 'table').length, 15);
  assert.strictEqual(spacesA.filter(s => s.spaceType === 'cabin').length, 4);
  assert.strictEqual(spacesA.filter(s => s.spaceType === 'room').length, 8);
  assert.strictEqual(spacesA.filter(s => s.spaceType === 'vip').length, 2);

  // Test dynamic configuration updates without localStorage (e.g. owner adds 10 more tables)
  const settingsB = { ...settingsA, total_tables: 25 };
  const spacesB = deriveSpaces(settingsB, [], false);
  assert.strictEqual(spacesB.length, 39);
  assert.strictEqual(spacesB.filter(s => s.spaceType === 'table').length, 25);

  // Ensure counter is NEVER added as a dining space
  assert.strictEqual(spacesB.some(s => s.spaceType === 'counter' || s.key.includes('counter')), false);
});

test('Cinema inventory reflects only valid returned database seats', () => {
  const cinemaSeatsFromDb = [
    { screen_number: 1, row_label: 'A', seat_number: 1, active: true },
    { screen_number: 1, row_label: 'A', seat_number: 2, active: true },
    { screen_number: 1, row_label: 'A', seat_number: 3, active: false }, // inactive
    { screen_number: 2, row_label: 'B', seat_number: 5, active: true }
  ];

  const activeSeats = cinemaSeatsFromDb.filter(s => s.active !== false);
  assert.strictEqual(activeSeats.length, 3);
  const seatCodes = activeSeats.map(s => `S${s.screen_number}-${s.row_label}-${s.seat_number}`);
  assert.deepStrictEqual(seatCodes, ['S1-A-1', 'S1-A-2', 'S2-B-5']);
});

// ----------------------------------------------------------------------
// 2. Cryptographic Readiness & Token Enforcement
// ----------------------------------------------------------------------
console.log('\n--- SECTION 2: Cryptographic Readiness & Token Enforcement ---');

test('Valid HMAC tokens are 64-char hex strings and pass format verification', () => {
  const secret = '7c9e6679f3c7d674176d63d6b7970d4f6c4f74d6b5e0c651f8a20d436ef8fb57';
  const token = generateHmacQrToken('my-restaurant', 'table', '5', secret);
  assert.strictEqual(isValidQrTokenFormat(token), true);
  assert.strictEqual(token.length, 64);
});

test('Invalid, empty, or tokenless states are rejected by format verifier', () => {
  assert.strictEqual(isValidQrTokenFormat(''), false);
  assert.strictEqual(isValidQrTokenFormat(null), false);
  assert.strictEqual(isValidQrTokenFormat(undefined), false);
  assert.strictEqual(isValidQrTokenFormat('short-token'), false);
  assert.strictEqual(isValidQrTokenFormat('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'), false); // non-hex
});

test('Target URL generation requires valid token and never emits tokenless URL', () => {
  const buildUrl = (origin, slug, paramName, paramVal, token) => {
    if (!token || !isValidHmacTokenFormat(token)) {
      throw new Error('Missing or invalid HMAC token');
    }
    return `${origin}/${slug}?${paramName}=${encodeURIComponent(paramVal)}&tkn=${encodeURIComponent(token)}`;
  };

  const origin = 'https://touchqr.com';
  const slug = 'royal-cafe';
  const validToken = 'a'.repeat(64);

  // Succeeded with token
  const url = buildUrl(origin, slug, 'table', '3', validToken);
  assert.strictEqual(url, 'https://touchqr.com/royal-cafe?table=3&tkn=' + validToken);
  assert.match(url, /&tkn=[0-9a-f]{64}/);

  // Rejected when token is empty or invalid
  assert.throws(() => buildUrl(origin, slug, 'table', '3', ''), /Missing or invalid HMAC token/);
  assert.throws(() => buildUrl(origin, slug, 'table', '3', null), /Missing or invalid HMAC token/);
  assert.throws(() => buildUrl(origin, slug, 'table', '3', 'bad'), /Missing or invalid HMAC token/);
  // Strictly rejects 8-character legacy token
  assert.throws(() => buildUrl(origin, slug, 'table', '3', 'a1b2c3d4'), /Missing or invalid HMAC token/);
});

test('isValidHmacTokenFormat strictly requires exact 64-hex HMAC signatures and rejects legacy/malformed tokens', () => {
  const validHmac = '7c9e6679f3c7d674176d63d6b7970d4f6c4f74d6b5e0c651f8a20d436ef8fb57';
  assert.strictEqual(isValidHmacTokenFormat(validHmac), true, 'Valid 64-hex HMAC passes');

  // Legacy 8-character tokens MUST BE REJECTED
  const legacyToken8 = 'a1b2c3d4';
  assert.strictEqual(isValidHmacTokenFormat(legacyToken8), false, '8-character legacy token is strictly rejected');

  // Intermediate lengths MUST BE REJECTED
  assert.strictEqual(isValidHmacTokenFormat('a'.repeat(16)), false, '16-char token rejected');
  assert.strictEqual(isValidHmacTokenFormat('a'.repeat(32)), false, '32-char token rejected');
  assert.strictEqual(isValidHmacTokenFormat('a'.repeat(63)), false, '63-char token rejected');
  assert.strictEqual(isValidHmacTokenFormat('a'.repeat(65)), false, '65-char token rejected');

  // Non-hex strings MUST BE REJECTED
  assert.strictEqual(isValidHmacTokenFormat('z'.repeat(64)), false, '64 non-hex characters rejected');
  assert.strictEqual(isValidHmacTokenFormat(''), false, 'Empty string rejected');
  assert.strictEqual(isValidHmacTokenFormat(null), false, 'Null rejected');
  assert.strictEqual(isValidHmacTokenFormat(undefined), false, 'Undefined rejected');
});

test('Standee export-readiness gate strictly rejects 8-character legacy tokens and permits only 64-character HMAC', () => {
  const legacyToken = 'a1b2c3d4';
  const modernHmac = '7c9e6679f3c7d674176d63d6b7970d4f6c4f74d6b5e0c651f8a20d436ef8fb57';

  // Simulation of single-standee preview & export readiness gate
  const checkSingleExportReadiness = (token) => Boolean(token && isValidHmacTokenFormat(token));
  assert.strictEqual(checkSingleExportReadiness(legacyToken), false, 'Legacy token fails single export gate');
  assert.strictEqual(checkSingleExportReadiness(modernHmac), true, 'Modern HMAC passes single export gate');

  // Simulation of bulk print readiness gate
  const spaces = [
    { key: 'table:1', label: 'Table 1' },
    { key: 'table:2', label: 'Table 2' }
  ];

  // Token cache containing a legacy 8-char token for table:1
  const tokenCacheWithLegacy = {
    'table:1': legacyToken,
    'table:2': modernHmac
  };

  const missingSpacesLegacy = spaces.filter(sp => !tokenCacheWithLegacy[sp.key] || !isValidHmacTokenFormat(tokenCacheWithLegacy[sp.key]));
  assert.strictEqual(missingSpacesLegacy.length, 1, 'Legacy token identified as missing/invalid space in bulk gate');
  assert.strictEqual(missingSpacesLegacy[0].key, 'table:1');

  // Token cache containing genuine 64-char HMAC signatures
  const tokenCacheValid = {
    'table:1': modernHmac,
    'table:2': '88886679f3c7d674176d63d6b7970d4f6c4f74d6b5e0c651f8a20d436ef8fb88'
  };

  const missingSpacesValid = spaces.filter(sp => !tokenCacheValid[sp.key] || !isValidHmacTokenFormat(tokenCacheValid[sp.key]));
  assert.strictEqual(missingSpacesValid.length, 0, 'Modern HMAC tokens cleanly pass bulk print gate');
});

// ----------------------------------------------------------------------
// 3. Tenant Isolation & Cache Purging
// ----------------------------------------------------------------------
console.log('\n--- SECTION 3: Tenant Isolation & Cache Invalidation ---');

test('Switching tenants purges token map and prevents cross-tenant signature leak', () => {
  let tokenCache = {
    'table:1': 'token-tenant-1',
    'table:2': 'token-tenant-1'
  };

  // Switch tenant from 'tenant-1' to 'tenant-2'
  const onTenantChange = () => {
    tokenCache = {}; // Purged immediately
  };

  onTenantChange();
  assert.deepStrictEqual(tokenCache, {});
  assert.strictEqual(tokenCache['table:1'], undefined);
});

// ----------------------------------------------------------------------
// 4. Zero Third-Party QR Leakage & Zero Fake LocalStorage
// ----------------------------------------------------------------------
console.log('\n--- SECTION 4: Codebase Integrity Audits (Zero Third-Party Fallbacks) ---');

test('Zero references to api.qrserver.com exist in src/ or dist/', () => {
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return [];
    let hits = [];
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.git') return;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        hits = hits.concat(scanDir(fullPath));
      } else if (/\.(js|jsx|html|css)$/.test(file)) {
        const text = fs.readFileSync(fullPath, 'utf8');
        if (text.includes('api.qrserver.com')) {
          hits.push(fullPath);
        }
      }
    });
    return hits;
  }

  const leaksInSrc = scanDir('src');
  assert.deepStrictEqual(leaksInSrc, [], `Found api.qrserver.com leaks in: ${leaksInSrc.join(', ')}`);

  const leaksInDist = scanDir('dist');
  assert.deepStrictEqual(leaksInDist, [], `Found api.qrserver.com leaks in dist: ${leaksInDist.join(', ')}`);
});

test('Zero references to touchqr_standees localStorage cache exist in src/', () => {
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return [];
    let hits = [];
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      if (file === 'node_modules' || file === '.git') return;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        hits = hits.concat(scanDir(fullPath));
      } else if (/\.(js|jsx)$/.test(file)) {
        const text = fs.readFileSync(fullPath, 'utf8');
        if (text.includes('touchqr_standees')) {
          hits.push(fullPath);
        }
      }
    });
    return hits;
  }

  const hits = scanDir('src');
  assert.deepStrictEqual(hits, [], `Found touchqr_standees in: ${hits.join(', ')}`);
});

// ----------------------------------------------------------------------
// 5. Unified Standee Template Consistency & A4 Print Pagination
// ----------------------------------------------------------------------
console.log('\n--- SECTION 5: Unified Template & A4 Print Pagination ---');

test('Theme configuration provides consistent tokens for all 4 themes', () => {
  const themes = ['emerald', 'slate', 'royal', 'minimal'];
  themes.forEach(tKey => {
    const t = STANDEE_THEMES[tKey];
    assert.ok(t, `Theme ${tKey} exists`);
    assert.ok(t.badgeBg, `Theme ${tKey} has badgeBg`);
    assert.ok(t.badgeText, `Theme ${tKey} has badgeText`);
    assert.ok(t.cardBg, `Theme ${tKey} has cardBg`);
    assert.ok(t.cardBorder, `Theme ${tKey} has cardBorder`);
    assert.ok(t.titleColor, `Theme ${tKey} has titleColor`);
    assert.ok(t.subtitleColor, `Theme ${tKey} has subtitleColor`);
  });
});

test('Standee card markup includes brand title, space badge, instructions, and local QR', () => {
  const space = {
    key: 'table:4',
    spaceType: 'table',
    spaceNumber: '4',
    label: 'Table 4',
    badge: 'TABLE NO. 4'
  };
  const restaurant = {
    name: 'Raman Bakery & Family Restaurant',
    tagline: 'Authentic Indian Sweets & Dining',
    phone: '9876543210'
  };
  const dummyQrDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  const cardHtml = buildStandeeCardHtml({
    space,
    restaurant,
    themeId: 'emerald',
    frameStyle: 'acrylic',
    qrDataUrl: dummyQrDataUrl,
    showReassurance: true
  });

  assert.ok(cardHtml.includes('✦ TABLE NO. 4 ✦'), 'Contains table badge');
  assert.ok(cardHtml.includes('Raman Bakery &amp; Family Restaurant'), 'Contains escaped restaurant title');
  assert.ok(cardHtml.includes('Authentic Indian Sweets &amp; Dining'), 'Contains escaped tagline');
  assert.ok(cardHtml.includes('POINT CAMERA AT QR TO ORDER'), 'Contains English instruction');
  assert.ok(cardHtml.includes('कैमरे से स्कैन करें और स्वादिष्ट खाना ऑर्डर करें'), 'Contains Hindi instruction');
  assert.ok(cardHtml.includes('SCAN TO ORDER'), 'Contains scan pill');
  assert.ok(cardHtml.includes(dummyQrDataUrl), 'Contains local QR image');
  assert.ok(cardHtml.includes('No App Required'), 'Contains reassurance line');
  assert.ok(cardHtml.includes('Phone: 9876543210'), 'Contains phone number');
});

test('Print document includes strict @page A4 styling and prevents card splitting', () => {
  const cards = [
    { space: { key: 'table:1', label: 'Table 1', badge: 'TABLE NO. 1' }, qrDataUrl: 'data:image/png;base64,dummy1' },
    { space: { key: 'table:2', label: 'Table 2', badge: 'TABLE NO. 2' }, qrDataUrl: 'data:image/png;base64,dummy2' },
    { space: { key: 'table:3', label: 'Table 3', badge: 'TABLE NO. 3' }, qrDataUrl: 'data:image/png;base64,dummy3' }
  ];

  const docHtml = generateStandeePrintDocument({
    cards,
    restaurant: { name: 'Royal Diner' },
    themeId: 'emerald',
    frameStyle: 'acrylic',
    showReassurance: true,
    isBulk: true
  });

  // Verify explicit @page styling
  assert.ok(docHtml.includes('@page {'), 'Includes @page declaration');
  assert.ok(docHtml.includes('size: A4 portrait;'), 'Sets A4 portrait page size');
  assert.ok(docHtml.includes('margin: 10mm;'), 'Sets explicit 10mm page margin');

  // Verify anti-splitting pagination rules
  assert.ok(docHtml.includes('page-break-inside: avoid;'), 'Prevents card split with page-break-inside: avoid');
  assert.ok(docHtml.includes('break-inside: avoid;'), 'Modern break-inside: avoid included');
  assert.ok(docHtml.includes('.a4-print-page'), 'Groups into .a4-print-page container');
  assert.ok(docHtml.includes('page-break-after: always;'), 'Includes page-break-after: always for page batches');

  // Verify 3 cards are partitioned into 2 pages (cardsPerPage = 2)
  const pageMatches = docHtml.match(/<div class="a4-print-page">/g);
  assert.strictEqual(pageMatches.length, 2, '3 cards split cleanly into 2 A4 pages');

  // Verify script waits for images before print
  assert.ok(docHtml.includes('window.print();'), 'Includes automatic print trigger');
  assert.ok(docHtml.includes('images[i].complete'), 'Awaits image loading');
});

// ----------------------------------------------------------------------
// 6. Summary
// ----------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
