import express from 'express';
import path from 'path';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_runner.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { initDb, query } from '../db.js';
import adminRoutes from '../routes/admin.js';
import apiRoutes from '../routes/api.js';
import { getCustomerReviewProfile, generateSmartReview } from '../../src/utils/aiReviewGenerator.js';

const JWT_SECRET = process.env.JWT_SECRET || 'touchqr_ultra_secure_jwt_secret_dev_2026';

(async () => {
  console.log('======================================================================');
  console.log('🖨️ TouchQR Thermal Printer, Analytics & AI Review Audit Suite');
  console.log('======================================================================\n');

  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiRoutes);

  let server;
  let baseUrl;

  try {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`⚡ Test server active on ${baseUrl}\n`);

    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // TEST 1: Basic Plan Tenant Blocked from Dual Printer Mode
    // -------------------------------------------------------------------------
    console.log('[TEST 1: Basic Plan Tenant Blocked from Dual Printer Mode]');
    const basicSlug = `basic-print-${timestamp}`;
    const basicIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'basic', 499, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Basic Cafe', basicSlug]);
    const basicId = basicIns[0]?.id || basicIns.lastInsertRowid;
    const basicToken = jwt.sign({ id: 101, restaurant_id: basicId, username: 'basic_admin', role: 'restaurant_admin' }, JWT_SECRET);

    // Attempt via PUT /api/admin/settings
    const bSetRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${basicToken}` },
      body: JSON.stringify({ printer_mode: 'dual' })
    });
    const bSetData = await bSetRes.json();
    assert.strictEqual(bSetRes.status, 403, 'Basic plan cannot set printer_mode=dual via settings');
    assert.strictEqual(bSetData.error, 'feature_locked');
    assert.strictEqual(bSetData.feature, 'dual_printer_enabled');
    console.log('  ✅ PASS: Basic plan rejected (403 feature_locked) on PUT /api/admin/settings');

    // Attempt via PUT /api/admin/printers
    const bPrintRes = await fetch(`${baseUrl}/api/admin/printers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${basicToken}` },
      body: JSON.stringify({ printer_mode: 'dual' })
    });
    const bPrintData = await bPrintRes.json();
    assert.strictEqual(bPrintRes.status, 403, 'Basic plan cannot set printer_mode=dual via /printers');
    assert.strictEqual(bPrintData.error, 'feature_locked');
    console.log('  ✅ PASS: Basic plan rejected (403 feature_locked) on PUT /api/admin/printers');

    // -------------------------------------------------------------------------
    // TEST 2: Enterprise Plan Tenant Can Configure Dual Printers
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2: Enterprise Plan Tenant Configures Dual Printers]');
    const entSlug = `ent-print-${timestamp}`;
    const entIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'enterprise', 1999, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Enterprise Diner', entSlug]);
    const entId = entIns[0]?.id || entIns.lastInsertRowid;
    const entToken = jwt.sign({ id: 102, restaurant_id: entId, username: 'ent_admin', role: 'restaurant_admin' }, JWT_SECRET);

    const entSaveRes = await fetch(`${baseUrl}/api/admin/printers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${entToken}` },
      body: JSON.stringify({
        printer_mode: 'dual',
        auto_print_kot: 1,
        auto_print_bill: 1,
        printer_paper_width: '80mm',
        printers: [
          { role: 'kitchen', name: 'Kitchen KOT Printer', connection_type: 'direct_esc', target_address: '192.168.1.101', paper_width: '80mm', auto_print_kot: 1 },
          { role: 'billing', name: 'Billing Counter Printer', connection_type: 'rawbt', target_address: '00:11:22:33:44:55', paper_width: '80mm', auto_print_bill: 1 }
        ]
      })
    });
    const entSaveData = await entSaveRes.json();
    assert.strictEqual(entSaveRes.status, 200, 'Enterprise plan successfully configures dual printers');
    assert.strictEqual(entSaveData.success, true);
    assert.strictEqual(entSaveData.printer_mode, 'dual');
    console.log('  ✅ PASS: Enterprise plan successfully saves dual printer configuration');

    // Fetch printer settings to verify persistence
    const entFetchRes = await fetch(`${baseUrl}/api/admin/printers`, {
      headers: { Authorization: `Bearer ${entToken}` }
    });
    const entFetchData = await entFetchRes.json();
    assert.strictEqual(entFetchRes.status, 200);
    assert.strictEqual(entFetchData.dual_printer_allowed, true);
    assert.strictEqual(entFetchData.printer_mode, 'dual');
    assert.strictEqual(entFetchData.auto_print_kot, 1);
    assert.strictEqual(entFetchData.auto_print_bill, 1);
    assert(Array.isArray(entFetchData.printers) && entFetchData.printers.length >= 2, 'Persisted both kitchen & billing printers');
    console.log('  ✅ PASS: Persisted dual printer configuration verified via GET /api/admin/printers');

    // -------------------------------------------------------------------------
    // TEST 3: VIP / Complimentary Tenant Unlocks Dual Printer on Basic Tier
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3: VIP / Complimentary Tenant Unlocks Dual Printer on Basic Tier]');
    const vipSlug = `vip-print-${timestamp}`;
    const vipIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, subscription_type, mandate_status, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'basic', 0, 'ADMIN_GRANTED', 'admin_granted', 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['VIP Bakery', vipSlug]);
    const vipId = vipIns[0]?.id || vipIns.lastInsertRowid;
    const vipToken = jwt.sign({ id: 103, restaurant_id: vipId, username: 'vip_admin', role: 'restaurant_admin' }, JWT_SECRET);

    const vipSetRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vipToken}` },
      body: JSON.stringify({ printer_mode: 'dual', auto_print_kot: 1, auto_print_bill: 1 })
    });
    const vipSetData = await vipSetRes.json();
    assert.strictEqual(vipSetRes.status, 200, 'Complimentary VIP tenant on basic plan unlocks dual printer mode');
    assert.strictEqual(vipSetData.success, true);
    console.log('  ✅ PASS: VIP complimentary tenant successfully enabled dual printer mode');

    // -------------------------------------------------------------------------
    // TEST 4: Print Job Logging (POST /api/admin/print/log)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4: Print Job Logging Audit Trail]');
    const orderIns = await query(`
      INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, customer_name, customer_phone, items, created_at)
      VALUES ($1, 450.00, 'completed', 'upi', 'Table 4', 'Raman User', '9876543210', '[{"name":"Paneer Tikka","price":250,"quantity":1},{"name":"Butter Naan","price":50,"quantity":4}]', CURRENT_TIMESTAMP)
      RETURNING id
    `, [entId]);
    const testOrderId = orderIns[0]?.id || orderIns.lastInsertRowid;

    const printLogRes = await fetch(`${baseUrl}/api/admin/print/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${entToken}` },
      body: JSON.stringify({
        order_id: testOrderId,
        print_type: 'kot',
        printer_role: 'kitchen',
        status: 'printed'
      })
    });
    const printLogData = await printLogRes.json();
    assert.strictEqual(printLogRes.status, 200, 'Print job log recorded successfully');
    assert.strictEqual(printLogData.success, true);
    console.log('  ✅ PASS: Print job execution logged with audit trail');

    // -------------------------------------------------------------------------
    // TEST 5: Analytics CSV Export Across Verticals & Time Ranges
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5: Analytics CSV & XLSX Export]');

    const csvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, {
      headers: { Authorization: `Bearer ${entToken}` }
    });
    assert.strictEqual(csvRes.status, 200, 'CSV export returns 200');
    assert(csvRes.headers.get('content-type')?.includes('text/csv'), 'Content-type is text/csv');
    const csvText = await csvRes.text();
    assert(csvText.includes('Record Type'), 'CSV contains header Record Type');
    assert(csvText.includes('Table / Space'), 'CSV contains Table / Space header');
    assert(csvText.includes('Paneer Tikka'), 'CSV contains order item detail');
    assert(csvText.includes('450'), 'CSV contains total order amount');
    console.log('  ✅ PASS: Analytics CSV export generated with RFC 4180 headers & order data');

    // Test XLSX Export
    const xlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, {
      headers: { Authorization: `Bearer ${entToken}` }
    });
    assert.strictEqual(xlsxRes.status, 200, 'XLSX export returns 200');
    assert(xlsxRes.headers.get('content-type')?.includes('spreadsheetml'), 'Content-type is Excel spreadsheet');
    const xlsxBuffer = await xlsxRes.arrayBuffer();
    assert(xlsxBuffer.byteLength > 1000, 'XLSX binary payload returned valid length');
    console.log(`  ✅ PASS: Analytics XLSX 3-sheet export generated successfully (${xlsxBuffer.byteLength} bytes)`);

    // Test VIP Tenant CSV Export on Basic Tier
    const vipCsvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, {
      headers: { Authorization: `Bearer ${vipToken}` }
    });
    assert.strictEqual(vipCsvRes.status, 200, 'VIP tenant successfully exports CSV on basic plan');
    console.log('  ✅ PASS: VIP tenant allowed CSV export even on basic plan tier');

    // -------------------------------------------------------------------------
    // TEST 6: AI Review Generator NLP Across Business Verticals
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6: AI Review Generator NLP Across Verticals]');
    
    // Hotel Profile
    const hotelProf = getCustomerReviewProfile('hotel_resort', 'hotel_resort');
    assert.strictEqual(hotelProf.typeKey, 'hotel_resort');
    assert(hotelProf.question.includes('stay'), 'Hotel review question is stay-specific');
    const hotelReview = generateSmartReview({
      restoName: 'Grand Hyatt',
      businessType: 'hotel_resort',
      restoType: 'hotel_resort',
      rating: 5,
      selectedChips: ['🛏️ Comfortable Room', '🤝 Great Hospitality'],
      customNote: 'Room 402 was immaculate'
    });
    assert(hotelReview.includes('Grand Hyatt'), 'Review includes venue name');
    assert(hotelReview.includes('Room 402 was immaculate'), 'Review includes custom note');
    console.log('  ✅ PASS: Hotel Review Profile generated correctly:', hotelReview.substring(0, 80) + '...');

    // Cinema Profile
    const cinemaProf = getCustomerReviewProfile('cinema_theatre', 'cinema_theatre');
    assert.strictEqual(cinemaProf.typeKey, 'cinema_theatre');
    assert(cinemaProf.question.includes('movie'), 'Cinema review question is movie-specific');
    const cinemaReview = generateSmartReview({
      restoName: 'PVR IMAX',
      businessType: 'cinema_theatre',
      restoType: 'cinema_theatre',
      rating: 5,
      selectedChips: ['🎬 Great Movie Experience', '🔊 Sound & Screen Quality'],
      customNote: 'Dolby Atmos was mindblowing'
    });
    assert(cinemaReview.includes('PVR IMAX'), 'Review includes theatre name');
    assert(cinemaReview.includes('Dolby Atmos was mindblowing'), 'Review includes custom note');
    console.log('  ✅ PASS: Cinema Review Profile generated correctly:', cinemaReview.substring(0, 80) + '...');

    // Restaurant Profile
    const restoProf = getCustomerReviewProfile('restaurant', 'multi_cuisine');
    assert.strictEqual(restoProf.typeKey, 'multi_cuisine');
    const restoReview = generateSmartReview({
      restoName: 'Royal Spice',
      businessType: 'restaurant',
      restoType: 'multi_cuisine',
      rating: 5,
      selectedChips: ['🥘 Delicious Food'],
      customNote: 'Butter Chicken was top notch'
    });
    assert(restoReview.includes('Royal Spice'), 'Review includes restaurant name');
    console.log('  ✅ PASS: Restaurant Review Profile generated correctly:', restoReview.substring(0, 80) + '...');

    // Sweet & Bakery Profile
    const sweetProf = getCustomerReviewProfile('restaurant', 'sweet_bakery');
    assert.strictEqual(sweetProf.typeKey, 'sweet_bakery');
    const sweetReview = generateSmartReview({
      restoName: 'Haldiram Sweets',
      businessType: 'restaurant',
      restoType: 'sweet_bakery',
      rating: 5,
      selectedChips: ['🍬 Fresh Sweets']
    });
    assert(sweetReview.includes('Haldiram Sweets'));
    console.log('  ✅ PASS: Sweet & Bakery Review Profile generated correctly:', sweetReview.substring(0, 80) + '...');

    console.log('\n======================================================================');
    console.log('🎉 ALL PRINTER, ANALYTICS & AI REVIEW AUDIT TESTS PASSED (100%)');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n❌ AUDIT TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    process.exit(process.exitCode || 0);
  }
})();
