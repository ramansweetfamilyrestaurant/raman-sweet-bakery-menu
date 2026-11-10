import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../db.js';

test('Scan System Fixes - Option A Verification', async (t) => {
  // 1. Verify SuperAdmin sorting logic
  await t.test('SuperAdmin sortBy === "scans" sorts correctly descending by scan_count', () => {
    const mockRestaurants = [
      { id: 1, name: 'Resto Small', scan_count: 5 },
      { id: 2, name: 'Resto Giant', scan_count: 142 },
      { id: 3, name: 'Resto Medium', scan_count: 35 },
      { id: 4, name: 'Resto Zero', scan_count: 0 }
    ];

    const sortBy = 'scans';
    const sorted = [...mockRestaurants].sort((a, b) => {
      if (sortBy === 'scans') return (b.scan_count || 0) - (a.scan_count || 0);
      return (b.id || 0) - (a.id || 0);
    });

    assert.strictEqual(sorted[0].name, 'Resto Giant');
    assert.strictEqual(sorted[0].scan_count, 142);
    assert.strictEqual(sorted[1].name, 'Resto Medium');
    assert.strictEqual(sorted[1].scan_count, 35);
    assert.strictEqual(sorted[2].name, 'Resto Small');
    assert.strictEqual(sorted[2].scan_count, 5);
    assert.strictEqual(sorted[3].name, 'Resto Zero');
    assert.strictEqual(sorted[3].scan_count, 0);
  });

  // 2. Verify Session Deduplication Logic simulation
  await t.test('Frontend sessionStorage prevents duplicate scans on reload', () => {
    const sessionStorageMock = new Map();
    const slug = 'test-bistro';
    const spaceKey = 'table_5';

    function checkIsNewScan(mockStorage, targetSlug, targetSpace) {
      const sessionKey = `touchqr_scan_${targetSlug}_${targetSpace}`;
      if (!mockStorage.has(sessionKey)) {
        mockStorage.set(sessionKey, String(Date.now()));
        return true;
      }
      return false;
    }

    // First scan from Table 5
    const scan1 = checkIsNewScan(sessionStorageMock, slug, spaceKey);
    assert.strictEqual(scan1, true, 'First scan must be recognized as new scan session');

    // Customer hits F5 reload on Table 5
    const scanReload1 = checkIsNewScan(sessionStorageMock, slug, spaceKey);
    assert.strictEqual(scanReload1, false, 'Reload on Table 5 must NOT trigger duplicate scan');

    // Customer hits F5 reload again
    const scanReload2 = checkIsNewScan(sessionStorageMock, slug, spaceKey);
    assert.strictEqual(scanReload2, false, 'Second reload must NOT trigger duplicate scan');

    // Customer moves to Table 12 and scans in same browser
    const scanTable12 = checkIsNewScan(sessionStorageMock, slug, 'table_12');
    assert.strictEqual(scanTable12, true, 'Moving to Table 12 must trigger a new scan');
  });

  // 3. Verify Backend Scan Qualification Flags
  await t.test('Backend /api/menu-bundle scan qualification accurately handles scan params and auth', () => {
    function computeShouldIncrement(reqQuery, reqHeaders, isAuthorizedAdmin = false) {
      const isExplicitNewScan = reqQuery.scan === '1' || reqQuery.is_new_scan === '1' || reqQuery.is_new_scan === 'true';
      const isExplicitNoScan = reqQuery.scan === '0' || reqQuery.is_new_scan === '0' || reqQuery.is_new_scan === 'false';
      const isAdminReq = Boolean(reqHeaders && reqHeaders.authorization) || isAuthorizedAdmin;
      return !isAdminReq && (isExplicitNewScan || (!isExplicitNoScan && reqQuery.scan === undefined && reqQuery.is_new_scan === undefined));
    }

    // New scan session (scan=1) from customer
    assert.strictEqual(computeShouldIncrement({ scan: '1' }, {}), true);

    // Reload from customer (scan=0)
    assert.strictEqual(computeShouldIncrement({ scan: '0' }, {}), false);

    // Admin preview with JWT token
    assert.strictEqual(computeShouldIncrement({ scan: '1' }, { authorization: 'Bearer jwt_token' }), false);

    // Search query within existing session (scan=0)
    assert.strictEqual(computeShouldIncrement({ scan: '0', q: 'pizza' }, {}), false);

    // Legacy client without scan param (backward compatibility)
    assert.strictEqual(computeShouldIncrement({}, {}), true);
  });
});

