import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { resolveImageUrl } from '../../src/utils/imageHelper.js';
import { getBusinessTerminology } from '../../src/utils/businessTaxonomy.js';
import { 
  ADMIN_NAVIGATION_ITEMS, 
  DESKTOP_SIDEBAR_ITEMS, 
  MOBILE_DRAWER_ITEMS, 
  isNavItemActive, 
  getLocalizedNavLabel 
} from '../../src/components/Admin/adminNavigation.js';

test('👑 Admin Sidebar & Header Business-First Invariant Test Suite', async (t) => {
  const sidebarPath = path.resolve('src/components/Admin/components/AdminSidebar.jsx');
  const headerPath = path.resolve('src/components/Admin/components/AdminHeader.jsx');

  assert.ok(fs.existsSync(sidebarPath), 'AdminSidebar.jsx file must exist');
  assert.ok(fs.existsSync(headerPath), 'AdminHeader.jsx file must exist');

  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const headerCode = fs.readFileSync(headerPath, 'utf8');

  await t.test('1. AdminSidebar has no TouchQR master logo or tagline in top hero', () => {
    assert.strictEqual(
      sidebarCode.includes('Smart Menu. Simple Orders.'),
      false,
      'AdminSidebar must NOT have hardcoded tagline "Smart Menu. Simple Orders."'
    );
    assert.strictEqual(
      sidebarCode.includes('MASTER BRAND LOGO'),
      false,
      'AdminSidebar must NOT have obsolete MASTER BRAND LOGO block'
    );
  });

  await t.test('2. AdminSidebar retains ⚡ FAST badge on Counter POS', () => {
    assert.ok(
      sidebarCode.includes('⚡ FAST'),
      'AdminSidebar must retain the ⚡ FAST badge on Counter POS'
    );
    assert.ok(
      sidebarCode.includes('capabilities?.counter_ordering_enabled === false'),
      'AdminSidebar must check capabilities for PRO gating'
    );
    assert.ok(
      sidebarCode.includes('🔒 PRO'),
      'AdminSidebar must show 🔒 PRO when locked'
    );
  });

  await t.test('3. AdminSidebar implements business logo fallback with error handling', () => {
    assert.ok(
      sidebarCode.includes('logoFailed'),
      'AdminSidebar must have logoFailed state for resilient fallback'
    );
    assert.ok(
      sidebarCode.includes('setLogoFailed(true)'),
      'AdminSidebar must set logoFailed on image load error'
    );
    assert.ok(
      sidebarCode.includes('(restoName || \'R\').charAt(0).toUpperCase()'),
      'AdminSidebar must render initial character fallback'
    );
  });

  await t.test('4. AdminHeader mobile drawer implements Business-First header', () => {
    assert.ok(
      headerCode.includes('Header: Business-First'),
      'AdminHeader must have Business-First header in mobile drawer'
    );
    assert.ok(
      headerCode.includes('resolvedMobileLogo'),
      'AdminHeader must resolve outlet logo for mobile drawer'
    );
    assert.ok(
      headerCode.includes('categoryMobileLabel'),
      'AdminHeader must show business category in mobile drawer'
    );
  });

  await t.test('5. Image URL resolver invariants for local, R2, and fallbacks', () => {
    assert.strictEqual(resolveImageUrl(null), '');
    assert.strictEqual(resolveImageUrl(undefined), '');
    assert.strictEqual(resolveImageUrl(''), '');
    assert.strictEqual(resolveImageUrl('null'), '');
    assert.strictEqual(resolveImageUrl('/uploads/logo.jpg'), '/uploads/logo.jpg');
    assert.strictEqual(resolveImageUrl('https://example.com/logo.png'), 'https://example.com/logo.png');
    assert.strictEqual(
      resolveImageUrl('https://pub-abc.r2.dev/outlets/logo.png'),
      '/api/r2-proxy/outlets/logo.png'
    );
  });

  await t.test('6. Business taxonomy fallback resilience', () => {
    // Null safety
    const nullTerms = getBusinessTerminology(null);
    assert.strictEqual(nullTerms.venueName, 'Restaurant & Dining');

    const emptyTerms = getBusinessTerminology({});
    assert.strictEqual(emptyTerms.venueName, 'Restaurant & Dining');

    // Bakery
    const bakeryTerms = getBusinessTerminology({ business_type: 'bakery_confectionery' });
    assert.strictEqual(bakeryTerms.venueName, 'Bakery & Confectionery');

    // Hotel
    const hotelTerms = getBusinessTerminology({ business_type: 'hotel_resort' });
    assert.strictEqual(hotelTerms.venueName, 'Hotel & Resort');

    // Cafe
    const cafeTerms = getBusinessTerminology({ business_type: 'cafe' });
    assert.strictEqual(cafeTerms.venueName, 'Cafe & Roastery');
  });

  await t.test('7. Navigation items integrity across desktop, mobile drawer, and bottom nav', () => {
    assert.ok(DESKTOP_SIDEBAR_ITEMS.length >= 7, 'Desktop sidebar must have at least 7 items');
    assert.ok(MOBILE_DRAWER_ITEMS.length >= 8, 'Mobile drawer must have at least 8 items');

    const posItem = DESKTOP_SIDEBAR_ITEMS.find(item => item.id === 'pos');
    assert.ok(posItem, 'Counter POS must be present in desktop sidebar items');
    assert.strictEqual(posItem.label, 'Counter POS');

    const ordersItem = DESKTOP_SIDEBAR_ITEMS.find(item => item.id === 'orders');
    assert.ok(ordersItem, 'Orders must be present in desktop sidebar items');
    assert.strictEqual(ordersItem.hasBadge, true);

    // Active tab matching
    assert.strictEqual(isNavItemActive(posItem, 'pos', 'desktop'), true);
    assert.strictEqual(isNavItemActive(posItem, 'home', 'desktop'), false);
    assert.strictEqual(isNavItemActive(ordersItem, 'floor-map', 'desktop'), true);
  });
});
