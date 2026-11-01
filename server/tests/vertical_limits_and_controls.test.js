import express from 'express';
import path from 'path';
import assert from 'assert';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_runner.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { initDb, query } from '../db.js';
import adminRoutes from '../routes/admin.js';
import superadminRoutes from '../routes/superadmin.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'touchqr_ultra_secure_jwt_secret_dev_2026';

(async () => {
  console.log('======================================================================');
  console.log('🛡️ TouchQR Vertical Quotas & Hard Limits Enforcement Test');
  console.log('======================================================================\n');

  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/superadmin', superadminRoutes);

  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`⚡ Test server active on ${baseUrl}\n`);

  try {
    const timestamp = Date.now();

    // 1. HOTEL: Test max_rooms limit enforcement on hotel_basic (20 rooms max)
    console.log('[TEST 1: Hotel Rooms Quota Enforcement (hotel_basic: 20 rooms)]');
    const hotelSlug = `quota-hotel-${timestamp}`;
    const hotelIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_rooms, total_tables, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'hotel_resort', 'hotel_basic', 999, 1, 10, 0, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Quota Palace Hotel', hotelSlug]);
    const hotelId = hotelIns[0]?.id || hotelIns.lastInsertRowid;
    const hotelToken = jwt.sign({ id: 991, restaurant_id: hotelId, username: 'hotel_mgr', role: 'restaurant_admin' }, JWT_SECRET);

    // Update rooms to 20 (within quota) -> Should succeed (200)
    const hGoodRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hotelToken}` },
      body: JSON.stringify({ total_rooms: 20 })
    });
    const hGoodData = await hGoodRes.json();
    assert(hGoodRes.status === 200 && hGoodData.success, 'Setting total_rooms = 20 within quota succeeds');
    console.log('  ✅ PASS: Updating total_rooms to 20 (allowed limit) succeeds');

    // Update rooms to 25 (exceeds hotel_basic quota of 20) -> Should fail with 403 plan_limit_reached
    const hBadRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hotelToken}` },
      body: JSON.stringify({ total_rooms: 25 })
    });
    const hBadData = await hBadRes.json();
    assert(hBadRes.status === 403, 'Exceeding hotel_basic rooms quota returns 403');
    assert(hBadData.error === 'plan_limit_reached' && hBadData.resource === 'rooms', 'Error code is plan_limit_reached for resource rooms');
    console.log(`  ✅ PASS: Updating total_rooms to 25 correctly blocked: ${hBadData.message}`);

    // 2. RESTAURANT: Test max_tables limit enforcement on basic (20 tables max)
    console.log('\n[TEST 2: Restaurant Dining Tables Quota Enforcement (basic: 20 tables)]');
    const restoSlug = `quota-resto-${timestamp}`;
    const restoIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, total_rooms, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'basic', 499, 1, 10, 0, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Quota Bistro', restoSlug]);
    const restoId = restoIns[0]?.id || restoIns.lastInsertRowid;
    const restoToken = jwt.sign({ id: 992, restaurant_id: restoId, username: 'bistro_mgr', role: 'restaurant_admin' }, JWT_SECRET);

    // Update tables to 20 -> Should succeed (200)
    const rGoodRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${restoToken}` },
      body: JSON.stringify({ total_tables: 20 })
    });
    const rGoodData = await rGoodRes.json();
    assert(rGoodRes.status === 200 && rGoodData.success, 'Setting total_tables = 20 within quota succeeds');
    console.log('  ✅ PASS: Updating total_tables to 20 (allowed limit) succeeds');

    // Update tables to 25 -> Should fail with 403 plan_limit_reached
    const rBadRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${restoToken}` },
      body: JSON.stringify({ total_tables: 25 })
    });
    const rBadData = await rBadRes.json();
    assert(rBadRes.status === 403, 'Exceeding restaurant basic tables quota returns 403');
    assert(rBadData.error === 'plan_limit_reached' && rBadData.resource === 'tables', 'Error code is plan_limit_reached for resource tables');
    console.log(`  ✅ PASS: Updating total_tables to 25 correctly blocked: ${rBadData.message}`);

    // 3. CINEMA: Test max_screens and max_seats limit enforcement on cinema_basic (1 screen, 200 seats)
    console.log('\n[TEST 3: Cinema Screens & Seats Quota Enforcement (cinema_basic: 1 screen, 200 seats)]');
    const cinemaSlug = `quota-cine-${timestamp}`;
    const cinemaIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'cinema_theatre', 'cinema_basic', 1499, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Quota Single Screen Cinema', cinemaSlug]);
    const cinemaId = cinemaIns[0]?.id || cinemaIns.lastInsertRowid;
    const cinemaToken = jwt.sign({ id: 993, restaurant_id: cinemaId, username: 'cine_mgr', role: 'restaurant_admin' }, JWT_SECRET);

    // Screen 1 creation -> Should succeed (200)
    const scr1Res = await fetch(`${baseUrl}/api/admin/cinema/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cinemaToken}` },
      body: JSON.stringify({ screen_number: 1, name: 'Main Audi 1' })
    });
    const scr1Data = await scr1Res.json();
    assert(scr1Res.status === 200 && scr1Data.success, 'Creating screen 1 within 1-screen limit succeeds');
    const screen1Id = scr1Data.screen.id;
    console.log('  ✅ PASS: Creating Audi Screen 1 succeeds');

    // Screen 2 creation -> Should fail with 403 plan_limit_reached (cinema_basic allows only 1 screen)
    const scr2Res = await fetch(`${baseUrl}/api/admin/cinema/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cinemaToken}` },
      body: JSON.stringify({ screen_number: 2, name: 'Audi 2' })
    });
    const scr2Data = await scr2Res.json();
    assert(scr2Res.status === 403, 'Exceeding cinema_basic screen quota returns 403');
    assert(scr2Data.error === 'plan_limit_reached' && scr2Data.resource === 'screens', 'Error code is plan_limit_reached for resource screens');
    console.log(`  ✅ PASS: Creating second screen on cinema_basic correctly blocked: ${scr2Data.message}`);

    // Batch add 100 seats (Row A: 1-100) -> Should succeed (200)
    const batch1Res = await fetch(`${baseUrl}/api/admin/cinema/seats/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cinemaToken}` },
      body: JSON.stringify({ screen_id: screen1Id, row_label: 'A', seat_start: 1, seat_end: 100 })
    });
    const batch1Data = await batch1Res.json();
    assert(batch1Res.status === 200 && batch1Data.success, 'Adding 100 seats within 200 seat quota succeeds');
    console.log('  ✅ PASS: Batch adding 100 seats in Row A succeeds');

    // Batch add another 100 seats (Row B: 1-100) -> Total now exactly 200 -> Should succeed (200)
    const batch2Res = await fetch(`${baseUrl}/api/admin/cinema/seats/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cinemaToken}` },
      body: JSON.stringify({ screen_id: screen1Id, row_label: 'B', seat_start: 1, seat_end: 100 })
    });
    const batch2Data = await batch2Res.json();
    assert(batch2Res.status === 200 && batch2Data.success, 'Adding next 100 seats up to 200 seat quota succeeds');
    console.log('  ✅ PASS: Batch adding 100 seats in Row B (total 200) succeeds');

    // Batch add 10 more seats (Row C: 1-10) -> Would be 210 seats (exceeds cinema_basic 200 seats) -> Should fail with 403
    const batch3Res = await fetch(`${baseUrl}/api/admin/cinema/seats/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cinemaToken}` },
      body: JSON.stringify({ screen_id: screen1Id, row_label: 'C', seat_start: 1, seat_end: 10 })
    });
    const batch3Data = await batch3Res.json();
    assert(batch3Res.status === 403, 'Exceeding cinema_basic 200 seats quota returns 403');
    assert(batch3Data.error === 'plan_limit_reached' && batch3Data.resource === 'seats', 'Error code is plan_limit_reached for resource seats');
    console.log(`  ✅ PASS: Adding 10 more seats beyond 200 limit correctly blocked: ${batch3Data.message}`);

    console.log('\n======================================================================');
    console.log('🎉 ALL VERTICAL QUOTAS & LIMITS ENFORCEMENT CHECKS PASSED: 100% SUCCESS');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n❌ Vertical limits test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
})();
