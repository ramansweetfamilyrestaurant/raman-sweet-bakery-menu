import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
const { act } = React;
import { validateTestDatabaseUrl } from './testDbGuard.js';
import {
  parseSafeDate,
  getFormattedLocalDate,
  formatISTMonthLabel,
  resolveAnalyticsPeriod,
  escapeCSVCell,
  isAnalyticsExportAllowed,
  scanCompactDishRefsFromJson
} from '../utils/analyticsHelper.js';
import {
  verifyQrToken,
  normalizeSpaceNumber,
  generateHmacQrToken,
  generateRestaurantQrSecret
} from '../utils/qrSecurity.js';
import { startAnalyticsPolling } from '../../src/utils/analyticsPolling.js';
import { resolveTenantCapabilities } from '../../src/utils/planCapabilities.js';

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'touchqr-analytics-test-'));
const TEST_DB_PATH = path.join(TMP_DIR, 'analytics_audit_test.db');
process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const { initDb, query, closeDbPool, runAutoDataSummarization, configurePgPoolForTesting } = await import('../db.js');
const { default: adminRoutes } = await import('../routes/admin.js');

const JWT_SECRET = process.env.JWT_SECRET || 'touchqr_ultra_secure_jwt_secret_dev_2026';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

(async () => {
  let server;
  let compiledDir = '';
  let passed = 0;

  function pass(msg) {
    passed += 1;
    console.log(`  PASS: ${msg}`);
  }

  try {
    await initDb();
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    // 1. Unit tests on analyticsHelper
    assert.equal(getFormattedLocalDate('2026-08-31T20:00:00Z'), '2026-09-01');
    assert.equal(getFormattedLocalDate('2026-02-03T12:00:00Z'), '2026-02-03');
    assert.equal(formatISTMonthLabel(2026, 9, 'long'), 'September 2026');
    assert.equal(formatISTMonthLabel(2026, 9, 'short'), 'Sep 2026');
    pass('IST date formatting & month label across UTC midnight');

    const monthPeriod = resolveAnalyticsPeriod('month:2026-08', null, null);
    assert.equal(monthPeriod.periodStartDate, '2026-08-01');
    assert.equal(monthPeriod.periodEndDate, '2026-08-31');
    assert.equal(monthPeriod.filePeriodSlug, 'Month_2026-08');
    const feb2024 = resolveAnalyticsPeriod('month:2024-02', null, null);
    assert.equal(feb2024.periodStartDate, '2024-02-01');
    assert.equal(feb2024.periodEndDate, '2024-02-29');
    const feb2024Query = resolveAnalyticsPeriod(undefined, '2024', '2');
    assert.equal(feb2024Query.selectedPeriod, 'month:2024-02');
    const feb2025AllQuery = resolveAnalyticsPeriod('all', '2025', '2');
    assert.equal(feb2025AllQuery.selectedPeriod, 'month:2025-02');
    assert.equal(feb2025AllQuery.periodStartDate, '2025-02-01');
    assert.equal(feb2025AllQuery.periodEndDate, '2025-02-28');
    assert.equal(resolveAnalyticsPeriod('month:24-02', null, null).selectedPeriod, 'all');
    assert.equal(resolveAnalyticsPeriod(undefined, '24', '2').selectedPeriod, 'all');
    assert.equal(resolveAnalyticsPeriod(undefined, '2024abc', '2').selectedPeriod, 'all');
    pass('resolveAnalyticsPeriod enforces 4-digit years and valid leap-year bounds');

    assert.equal(escapeCSVCell("=CMD|'/C calc'!A0"), `"'=CMD|'/C calc'!A0"`);
    assert.equal(escapeCSVCell('+1234'), `"' +1234"`.replace(' ', ''));
    assert.equal(escapeCSVCell('\n=1+1'), `"'\n=1+1"`);
    assert.equal(escapeCSVCell('\uFF1D1+1'), `"'\uFF1D1+1"`);
    assert.equal(escapeCSVCell('\uFF0B1+1'), `"'\uFF0B1+1"`);
    assert.equal(escapeCSVCell(450), '"450"');
    pass('escapeCSVCell neutralizes ASCII, LF, and fullwidth formula injection while preserving numbers');

    // Case-insensitive export entitlement check when basic plan has export disabled
    await query("UPDATE saas_plans SET analytics_export_enabled = 0 WHERE LOWER(key) = 'basic'");
    const basicAllowed = await isAnalyticsExportAllowed(query, () => false, { plan_tier: 'Basic' });
    const vipBasicAllowed = await isAnalyticsExportAllowed(query, () => true, { plan_tier: 'Basic' });
    const proAllowed = await isAnalyticsExportAllowed(query, () => false, { plan_tier: 'PRO' });
    const unknownAllowed = await isAnalyticsExportAllowed(query, () => false, { plan_tier: 'unknown_tier_xyz' });
    assert.equal(basicAllowed, false);
    assert.equal(vipBasicAllowed, true);
    assert.equal(proAllowed, true);
    assert.equal(unknownAllowed, false);
    pass('isAnalyticsExportAllowed handles case-insensitive tiers, VIP override, and fails closed');

    // 2. HTTP test: Basic uppercase plan blocked from CSV & XLSX
    const ts = Date.now();
    const basicRes = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'Basic', 499, 1, 0, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Zero Table Cafe', `zero-tbl-${ts}`]);
    const basicId = basicRes[0].id;
    const basicToken = jwt.sign({ id: 201, restaurant_id: basicId, username: 'b_admin', role: 'restaurant_admin' }, JWT_SECRET);

    const basicCsv = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, {
      headers: { Authorization: `Bearer ${basicToken}` }
    });
    assert.equal(basicCsv.status, 403);
    const basicAnalyticsRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${basicToken}` }
    });
    const basicAnalytics = await basicAnalyticsRes.json();
    assert.equal(basicAnalyticsRes.status, 200);
    assert.equal(basicAnalytics.space_heatmap.length, 0);
    assert.equal(basicAnalytics.standee_health.total_spaces, 0);
    pass('Basic uppercase plan blocked from CSV export and total_tables=0 has 0 heatmap spaces');

    // 3. HTTP test: Pro month CSV export filtering + formula injection sanitization
    const proIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'pro', 999, 1, 5, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Pro Bistro', `pro-bistro-${ts}`]);
    const proId = proIns[0].id;
    const proToken = jwt.sign({ id: 202, restaurant_id: proId, username: 'p_admin', role: 'restaurant_admin' }, JWT_SECRET);

    await query(`
      INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, customer_name, items, created_at)
      VALUES
        ($1, 300, 'completed', 'upi', '2', '=CMD|evil', '[{"name":"Masala Chai","price":150,"quantity":2}]', '2026-08-15T10:00:00Z'),
        ($1, 500, 'completed', 'cash', '3', 'September Guest', '[{"name":"Coffee","price":500,"quantity":1}]', '2026-09-02T10:00:00Z')
    `, [proId]);

    const augCsvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=month:2026-08`, {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(augCsvRes.status, 200);
    const cd = augCsvRes.headers.get('content-disposition') || '';
    assert.ok(cd.includes('Sales_Report_Month_2026-08_'), `Unexpected Content-Disposition: ${cd}`);
    assert.ok(!cd.includes('month:2026-08'), 'Filename must not contain colon');
    const augCsvText = await augCsvRes.text();
    assert.ok(augCsvText.includes('Masala Chai'), 'August order must be included');
    assert.ok(!augCsvText.includes('September Guest'), 'September order must be excluded from August export');
    assert.ok(augCsvText.includes(`"'=CMD|evil"`), 'Formula injection must be sanitized in CSV');
    pass('Monthly CSV export filters period=month:YYYY-MM cleanly and sanitizes formulas');

    // 4 & 5. HTTP test: Frozen IST clock + explicit timestamps for Cinema seat & Hotel heatmap/scan alignment
    const frozenNowMs = new Date('2026-06-15T12:00:00Z').getTime();
    const frozenTimestamp = '2026-06-15T10:00:00Z';
    const origDateNow = Date.now;
    Date.now = () => frozenNowMs;
    try {
      const cinIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, active, total_seats, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'cinema_theatre', 'cinema', 'pro', 999, 1, 24, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['PVR Test', `pvr-test-${ts}`]);
      const cinId = cinIns[0].id;
      const cinToken = jwt.sign({ id: 203, restaurant_id: cinId, username: 'c_admin', role: 'restaurant_admin' }, JWT_SECRET);

      const screenIns = await query(`
        INSERT INTO restaurant_cinema_screens (restaurant_id, screen_number, name, active)
        VALUES ($1, 1, 'Screen 1', 1), ($1, 2, 'Screen 2', 1) RETURNING id, screen_number
      `, [cinId]);
      const screen1Id = screenIns.find(s => Number(s.screen_number) === 1).id;
      const screen2Id = screenIns.find(s => Number(s.screen_number) === 2).id;
      await query(`
        INSERT INTO restaurant_cinema_seats (restaurant_id, screen_id, row_label, seat_number, seat_code, active)
        VALUES ($1, $2, 'B', 4, 'S1-B-4', 1), ($1, $2, 'B', 5, 'S1-B-5', 1), ($1, $3, 'A', 7, 'S2-A-7', 1)
      `, [cinId, screen1Id, screen2Id]);

      await query(`
        INSERT INTO qr_scan_events (restaurant_id, space_type, table_number, created_at)
        VALUES ($1, 'cinema_seat', 'S01-B-04', $2), ($1, 'cinema_seat', 'Screen 2, Row A, Seat 07', $2)
      `, [cinId, frozenTimestamp]);
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, items, created_at)
        VALUES
          ($1, 220, 'completed', 'upi', 'Screen 01 Row B Seat 04', '[{"name":"Popcorn","price":220,"quantity":1}]', $2),
          ($1, 160, 'completed', 'cash', 'Screen 2, Row A, Seat 7', '[{"name":"Nachos","price":160,"quantity":1}]', $2)
      `, [cinId, frozenTimestamp]);

      const cinAnalyticsRes = await fetch(`${baseUrl}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${cinToken}` }
      });
      const cinAnalytics = await cinAnalyticsRes.json();
      assert.equal(cinAnalyticsRes.status, 200);
      assert.equal(cinAnalytics.space_heatmap.length, 3);
      const b4 = cinAnalytics.space_heatmap.find(s => s.space_number === 'S1-B-4');
      const s2a7 = cinAnalytics.space_heatmap.find(s => s.space_number === 'S2-A-7');
      assert.ok(b4 && b4.scans_today === 1 && b4.orders_today === 1, 'Cinema S1-B-4 scan & "Screen 1 Row B Seat 4" order aligned');
      assert.ok(s2a7 && s2a7.scans_today === 1 && s2a7.orders_today === 1, 'Cinema S2-A-7 scan & "Screen 2, Row A, Seat 7" order aligned');
      assert.equal(cinAnalytics.standee_health.health_score, 67);
      assert.equal(cinAnalytics.recent_orders[0].space_type, 'cinema_seat');

      // Cinema with >50 count-only seats and >5000 today scans aggregates by space before limit and preserves full-inventory health
      const largeCinIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, active, total_seats, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'cinema_theatre', 'cinema', 'pro', 999, 1, 65, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Large Cinema', `large-cin-${ts}`]);
      const largeCinToken = jwt.sign({ id: 210, restaurant_id: largeCinIns[0].id, username: 'lc_admin', role: 'restaurant_admin' }, JWT_SECRET);
      await query(`INSERT INTO qr_scan_events (restaurant_id, space_type, table_number, created_at) VALUES ($1, 'cinema_seat', 'Seat 062', $2)`, [largeCinIns[0].id, frozenTimestamp]);
      const bulkScanValues = Array.from({ length: 5005 }, () => `(${largeCinIns[0].id}, NULL, 'Seat 1', '${frozenTimestamp}')`).join(',');
      await query(`INSERT INTO qr_scan_events (restaurant_id, space_type, table_number, created_at) VALUES ${bulkScanValues}`);
      const largeCinRes = await fetch(`${baseUrl}/api/admin/analytics`, { headers: { Authorization: `Bearer ${largeCinToken}` } });
      const largeCinBody = await largeCinRes.json();
      assert.equal(largeCinRes.status, 200);
      assert.equal(largeCinBody.space_heatmap.length, 50, 'Heatmap display remains capped at 50 spaces');
      assert.equal(largeCinBody.standee_health.total_spaces, 65, 'Standee health uses full 65 configured seats');
      assert.equal(largeCinBody.standee_health.active_spaces, 2, 'Both Seat 1 and earlier Seat 62 beyond 5000 raw rows count toward standee_health active_spaces');
      const seat1Heat = largeCinBody.space_heatmap.find(s => String(s.space_number) === '1');
      assert.equal(seat1Heat?.scans_today, 5005, 'Seat 1 must report all 5005 scans without 5000-row truncation');

      // Count-only cinema without restaurant_cinema_seats rows falls back to total_seats
      const countCinIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, active, total_seats, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'cinema_theatre', 'cinema', 'pro', 999, 1, 4, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Count Only Cinema', `count-cin-${ts}`]);
      const countCinToken = jwt.sign({ id: 205, restaurant_id: countCinIns[0].id, username: 'cc_admin', role: 'restaurant_admin' }, JWT_SECRET);
      await query(`INSERT INTO qr_scan_events (restaurant_id, space_type, table_number, created_at) VALUES ($1, 'cinema_seat', '2', $2)`, [countCinIns[0].id, frozenTimestamp]);
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, order_type, customer_name, items, created_at)
        VALUES ($1, 180, 'completed', 'upi', '2', 'dine_in', 'Table Customer (2)', '[{"name":"Nachos","price":180,"quantity":1}]', $2)
      `, [countCinIns[0].id, frozenTimestamp]);
      const countCinRes = await fetch(`${baseUrl}/api/admin/analytics`, { headers: { Authorization: `Bearer ${countCinToken}` } });
      const countCinBody = await countCinRes.json();
      assert.equal(countCinRes.status, 200);
      assert.equal(countCinBody.space_heatmap.length, 4);
      assert.equal(countCinBody.standee_health.total_spaces, 4);
      assert.equal(countCinBody.standee_health.active_spaces, 1);
      assert.equal(countCinBody.recent_orders[0].space_type, 'cinema_seat', 'Cinema numeric table_number with dine_in must classify as cinema_seat');
      const seat2Heat = countCinBody.space_heatmap.find(s => s.space_number === '2');
      assert.ok(seat2Heat && seat2Heat.orders_today === 1, 'Numeric cinema seat order aligns with cinema_seat:2 heatmap bucket');

      // Configured cinema screen with zero active seats must return an empty heatmap (no total_seats fallback)
      const emptyScreenCinIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, active, total_seats, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'cinema_theatre', 'cinema', 'pro', 999, 1, 5, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Empty Screen Cinema', `empty-screen-cin-${ts}`]);
      const emptyScreenIdRes = await query(`
        INSERT INTO restaurant_cinema_screens (restaurant_id, screen_number, name, active)
        VALUES ($1, 1, 'Screen 1', 1) RETURNING id
      `, [emptyScreenCinIns[0].id]);
      await query(`
        INSERT INTO restaurant_cinema_seats (restaurant_id, screen_id, row_label, seat_number, seat_code, active)
        VALUES ($1, $2, 'A', 1, 'S1-A-1', 0)
      `, [emptyScreenCinIns[0].id, emptyScreenIdRes[0].id]);
      const emptyScreenToken = jwt.sign({ id: 208, restaurant_id: emptyScreenCinIns[0].id, username: 'esc_admin', role: 'restaurant_admin' }, JWT_SECRET);
      const emptyScreenRes = await fetch(`${baseUrl}/api/admin/analytics`, { headers: { Authorization: `Bearer ${emptyScreenToken}` } });
      const emptyScreenBody = await emptyScreenRes.json();
      assert.equal(emptyScreenRes.status, 200);
      assert.equal(emptyScreenBody.space_heatmap.length, 0, 'Configured screen with 0 active seats must return empty heatmap despite total_seats');
      assert.equal(emptyScreenBody.standee_health.total_spaces, 0);
      pass('Cinema heatmap uses real screens/seats, aligns telemetry under frozen clock, and skips total_seats fallback when screens/seats are configured');

      // Hotel tenant routes ambiguous numeric orders to room fallback while keeping explicit Table labels as table and ignoring guest-text overrides
      const hotelIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, active, total_rooms, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'hotel_resort', 'hotel', 'pro', 999, 1, 7, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Grand Hotel', `grand-hotel-${ts}`]);
      const hotelId = hotelIns[0].id;
      const hotelToken = jwt.sign({ id: 204, restaurant_id: hotelId, username: 'h_admin', role: 'restaurant_admin' }, JWT_SECRET);

      await query(`
        INSERT INTO qr_scan_events (restaurant_id, space_type, table_number, created_at)
        VALUES ($1, 'table', '2', $2), ($1, 'room', '2', $2), ($1, 'room', '3', $2), ($1, 'room', 'Room 7', $2), ($1, 'room', '5', $2)
      `, [hotelId, frozenTimestamp]);
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, order_type, customer_name, items, created_at)
        VALUES
          ($1, 400, 'completed', 'upi', 'Table 2', 'dine_in', 'Room Guest', '[{"name":"Pasta","price":400,"quantity":1}]', $2),
          ($1, 650, 'completed', 'cash', 'Room 3', 'dine_in', 'Room Guest', '[{"name":"Club Sandwich","price":650,"quantity":1}]', $2),
          ($1, 500, 'completed', 'upi', '2', 'room_service', 'Room Service Guest', '[{"name":"Soup","price":500,"quantity":1}]', $2),
          ($1, 350, 'completed', 'cash', '7', 'room_service', 'Guest 7', '[{"name":"Tea","price":350,"quantity":1}]', $2),
          ($1, 250, 'completed', 'upi', '5', 'dine_in', 'Table Guest', '[{"name":"Coffee","price":250,"quantity":1}]', $2)
      `, [hotelId, frozenTimestamp]);

      const hotelAnalyticsRes = await fetch(`${baseUrl}/api/admin/analytics`, {
        headers: { Authorization: `Bearer ${hotelToken}` }
      });
      const hotelAnalytics = await hotelAnalyticsRes.json();
      assert.equal(hotelAnalyticsRes.status, 200);
      const table2Scan = (hotelAnalytics.top_tables_scanned_today || []).find(t => t.space_type === 'table' && t.table === '2');
      const room2Scan = (hotelAnalytics.top_tables_scanned_today || []).find(t => t.space_type === 'room' && t.table === '2');
      const room3Scan = (hotelAnalytics.top_tables_scanned_today || []).find(t => t.space_type === 'room' && t.table === '3');
      const room5Scan = (hotelAnalytics.top_tables_scanned_today || []).find(t => t.space_type === 'room' && t.table === '5');
      const room7Scan = (hotelAnalytics.top_tables_scanned_today || []).find(t => t.space_type === 'room' && t.table === '7');
      assert.ok(table2Scan && table2Scan.orders_today === 1, 'Hotel explicit "Table 2" must remain table:2 even if customer_name is Room Guest');
      assert.ok(room2Scan && room2Scan.orders_today === 1, 'Hotel room_service order for 2 must remain room:2');
      assert.ok(room3Scan && room3Scan.orders_today === 1, 'Hotel scan "3" and order "Room 3" must align as room:3');
      assert.ok(room5Scan && room5Scan.orders_today === 1, 'Hotel numeric "5" with Table Guest must still classify as room:5');
      assert.ok(room7Scan && room7Scan.orders_today === 1, 'Hotel scan "Room 7" and order "7" must normalize to room:7');
      const room7Heat = (hotelAnalytics.space_heatmap || []).find(h => h.space_type === 'room' && h.space_number === '7');
      assert.ok(room7Heat && room7Heat.scans_today === 1 && room7Heat.orders_today === 1, 'Hotel Room 7 heatmap entry must show 1 scan and 1 order');
      const recentTableOrder = (hotelAnalytics.recent_orders || []).find(o => o.table_number === 'Table 2' && o.total_amount === 400);
      const recentRoomPrefixOrder = (hotelAnalytics.recent_orders || []).find(o => o.table_number === 'Room 3');
      const recentRoomServiceOrder = (hotelAnalytics.recent_orders || []).find(o => o.table_number === '2' && o.total_amount === 500);
      const recentAmbiguousHotelOrder = (hotelAnalytics.recent_orders || []).find(o => o.table_number === '5' && o.total_amount === 250);
      assert.equal(recentTableOrder?.space_type, 'table', 'recent_orders explicit Table 2 order must stay space_type=table');
      assert.equal(recentRoomPrefixOrder?.space_type, 'room', 'recent_orders Room 3 order must stay space_type=room');
      assert.equal(recentRoomServiceOrder?.space_type, 'room', 'recent_orders room_service order must stay space_type=room');
      assert.equal(recentAmbiguousHotelOrder?.space_type, 'room', 'Ambiguous numeric hotel order with dine_in & Table Guest must route to room');

      // Configured dine-in restaurant must NOT classify guest named "Room Guest" as room
      const dineInRoomGuestIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, plan_price, active, total_tables, total_rooms, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'dine_in', 'pro', 999, 1, 5, 0, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['DineIn Bistro', `dinein-bistro-${ts}`]);
      const dineInToken = jwt.sign({ id: 214, restaurant_id: dineInRoomGuestIns[0].id, username: 'di_admin', role: 'restaurant_admin' }, JWT_SECRET);
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, order_type, customer_name, items, created_at)
        VALUES ($1, 320, 'completed', 'cash', '4', '', 'Room Guest', '[{"name":"Biryani","price":320,"quantity":1}]', $2)
      `, [dineInRoomGuestIns[0].id, frozenTimestamp]);
      const diRes = await fetch(`${baseUrl}/api/admin/analytics`, { headers: { Authorization: `Bearer ${dineInToken}` } });
      const diBody = await diRes.json();
      assert.equal(diBody.recent_orders[0]?.space_type, 'table', 'Dine-in restaurant guest named "Room Guest" must stay space_type=table');
      pass('Hotel tenant distinguishes dine_in table:2 from room orders regardless of customer_name heuristics under frozen clock');
    } finally {
      Date.now = origDateNow;
    }

    // 6. HTTP test: XLSX export keeps distinct dish IDs separate, resolves unambiguous ID-less names, leaves ambiguous names separate,
    // and prevents explicit dish_id: null (synthetic POS item) from using line-index id while retaining catalog/non-POS ID merging
    await query(`
      INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, customer_name, items, created_at)
      VALUES
        ($1, 100, 'completed', 'cash', '1', 'Unnamed Live A', '[{"dish_id":101,"name":"   ","price":100,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 200, 'completed', 'cash', '2', 'Unnamed Live B', '[{"dish_id":202,"name":"","price":200,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 55, 'completed', 'upi', '3', 'Same Name ID 901', '[{"dish_id":901,"name":"id:101","price":55,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 70, 'completed', 'upi', '4', 'Unambiguous Name Match', '[{"name":"UNIQUE PLATE","price":70,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 90, 'completed', 'cash', '5', 'Ambiguous Name No ID 1', '[{"name":"chai","price":90,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 180, 'completed', 'cash', '5', 'Ambiguous Name No ID 2', '[{"name":"Chai","price":90,"quantity":2}]', CURRENT_TIMESTAMP),
        ($1, 280, 'completed', 'cash', '6', 'POS Custom Order 1', '[{"id":1,"dish_id":null,"name":"POS Custom Soup","price":120,"quantity":2},{"id":2,"dish_id":null,"name":"POS Custom Chai","price":40,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 120, 'completed', 'upi', '7', 'POS Custom Order 2', '[{"id":1,"dish_id":null,"name":"POS Custom Chai","price":40,"quantity":1},{"id":2,"dish_id":null,"name":"pos custom soup","price":120,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 150, 'completed', 'upi', '8', 'Catalog Dish Order', '[{"id":1,"dish_id":1,"name":"Catalog Masala Dosa","price":150,"quantity":1}]', CURRENT_TIMESTAMP),
        ($1, 150, 'completed', 'cash', '9', 'Legacy Non-POS Dish Order', '[null,{"id":1,"name":"Catalog Masala Dosa","price":150,"quantity":1}]', CURRENT_TIMESTAMP)
    `, [proId]);
    await query(`
      INSERT INTO daily_sales_summaries (restaurant_id, summary_date, total_orders, total_sales, items_summary)
      VALUES ($1, '2026-08-10', 6, 615, '[null,{"dish_id":303,"name":"","price":120,"quantity":1,"revenue":120},{"dish_id":404,"name":"  ","price":180,"quantity":1,"revenue":180},{"dish_id":902,"name":"ID:101","price":45,"quantity":1,"revenue":45},{"dish_id":903,"name":"Unique Plate","price":130,"quantity":1,"revenue":130},{"dish_id":701,"name":"Chai","price":60,"quantity":1,"revenue":60},{"dish_id":702,"name":"CHAI","price":80,"quantity":1,"revenue":80}]')
    `, [proId]);

    const xlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(xlsxRes.status, 200);
    const xlsxBuf = Buffer.from(await xlsxRes.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxBuf);
    const topDishesSheet = wb.getWorksheet('Item Sales');
    assert.ok(topDishesSheet, 'Item Sales sheet must exist in XLSX');
    const unknownRows = [];
    const literalIdNameRows = [];
    const uniquePlateRows = [];
    const chaiRows = [];
    const posSoupRows = [];
    const posChaiRows = [];
    const catalogDosaRows = [];
    topDishesSheet.eachRow((row, idx) => {
      if (idx <= 5) return;
      const entry = {
        dishId: row.getCell(2).value,
        name: row.getCell(3).value,
        qty: Number(row.getCell(4).value),
        rev: Number(row.getCell(5).value)
      };
      if (entry.name === 'Unknown Dish') unknownRows.push(entry);
      else if (String(entry.name || '').toLowerCase() === 'id:101') literalIdNameRows.push(entry);
      else if (String(entry.name || '').toLowerCase() === 'unique plate') uniquePlateRows.push(entry);
      else if (String(entry.name || '').toLowerCase() === 'chai' || String(entry.name || '').toLowerCase().startsWith('chai (')) chaiRows.push(entry);
      else if (String(entry.name || '').toLowerCase() === 'pos custom soup') posSoupRows.push(entry);
      else if (String(entry.name || '').toLowerCase() === 'pos custom chai') posChaiRows.push(entry);
      else if (String(entry.name || '').toLowerCase() === 'catalog masala dosa') catalogDosaRows.push(entry);
    });
    assert.equal(unknownRows.length, 4, `Expected 4 distinct unnamed dish rows, got ${JSON.stringify(unknownRows)}`);
    assert.deepEqual(unknownRows.map(r => r.rev).sort((a, b) => a - b), [100, 120, 180, 200]);
    assert.equal(literalIdNameRows.length, 2, 'Distinct dish IDs 901 & 902 must remain separate even with case-insensitive matching names');
    assert.equal(uniquePlateRows.length, 1, 'ID-less row matching single unique dish ID 903 must merge into it');
    assert.equal(uniquePlateRows[0].qty, 2);
    assert.equal(uniquePlateRows[0].rev, 200);
    assert.equal(chaiRows.length, 3, 'Ambiguous ID-less "chai" sales group into 1 unresolved bucket separate from IDs 701 and 702');
    const unresolvedChai = chaiRows.find(r => !r.dishId);
    assert.ok(unresolvedChai && unresolvedChai.qty === 3 && unresolvedChai.name.includes('Unresolved ID'), 'Both ambiguous ID-less "chai" sales share one clearly labeled unresolved bucket with null Dish ID');
    assert.equal(posSoupRows.length, 1, 'Synthetic POS items (dish_id: null) across different line-index ids must merge by name');
    assert.equal(posSoupRows[0].qty, 3);
    assert.equal(posSoupRows[0].rev, 360);
    assert.ok(!posSoupRows[0].dishId, 'Synthetic POS soup must not adopt line-index id as Dish ID');
    assert.equal(posChaiRows.length, 1, 'Synthetic POS chai must stay distinct from soup and catalog dish id 1');
    assert.equal(posChaiRows[0].qty, 2);
    assert.ok(!posChaiRows[0].dishId, 'Synthetic POS chai must not adopt line-index id as Dish ID');
    assert.equal(catalogDosaRows.length, 1, 'Catalog dish id:1 and legacy non-POS id:1 must merge cleanly');
    assert.equal(String(catalogDosaRows[0].dishId), '1');
    assert.equal(catalogDosaRows[0].qty, 2);
    assert.equal(catalogDosaRows[0].rev, 300);
    pass('XLSX Top Dishes handles catalog IDs, non-POS fallbacks, synthetic null dish_id POS items, and ambiguity accurately');

    // 6a-2. Archived POS orders with reversed line-index IDs & dish_id: null through runAutoDataSummarization -> XLSX export
    const compIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'pro', 999, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['Compaction Bistro', `comp-bistro-${ts}`]);
    const compId = compIns[0].id;
    const compToken = jwt.sign({ id: 209, restaurant_id: compId, username: 'cb_admin', role: 'restaurant_admin' }, JWT_SECRET);
    await query(`
      INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, customer_name, items, created_at)
      VALUES
        ($1, 280, 'completed', 'cash', '1', 'Archive A', '[{"id":1,"dish_id":null,"name":"Archived POS Soup","price":120,"quantity":2},{"id":2,"dish_id":null,"name":"Archived POS Chai","price":40,"quantity":1}]', '2025-05-10T10:00:00Z'),
        ($1, 200, 'completed', 'upi', '2', 'Archive B', '[{"id":1,"dish_id":null,"name":"Archived POS Chai","price":40,"quantity":2},{"id":2,"dish_id":null,"name":"archived pos soup","price":120,"quantity":1}]', '2025-05-10T11:00:00Z'),
        ($1, 150, 'completed', 'cash', '3', 'Archive Cat', '[null,{"id":1,"dish_id":1,"name":"Catalog Item One","price":150,"quantity":1}]', '2025-05-10T12:00:00Z')
    `, [compId]);

    const compSummaryRes = await runAutoDataSummarization(30, compId);
    assert.equal(compSummaryRes.summarized_days, 1);
    assert.equal(compSummaryRes.purged_orders, 3);

    // Insert another eligible order for the same date containing a synthetic null dish_id item & existing catalog dish ID, then compact again
    await query(`
      INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, customer_name, items, created_at)
      VALUES ($1, 540, 'completed', 'upi', '4', 'Archive Repeat', '[{"id":1,"dish_id":null,"name":"Archived POS Soup","price":120,"quantity":2},{"id":1,"dish_id":1,"name":"Catalog Item One","price":150,"quantity":2}]', '2025-05-10T13:00:00Z')
    `, [compId]);

    const secondCompRes = await runAutoDataSummarization(30, compId);
    assert.equal(secondCompRes.summarized_days, 1);
    assert.equal(secondCompRes.purged_orders, 1);

    const emittedSummaryRows = await query(
      'SELECT total_orders, total_sales, items_summary FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = $2',
      [compId, '2025-05-10']
    );
    assert.equal(Number(emittedSummaryRows[0].total_orders), 4);
    assert.equal(Number(emittedSummaryRows[0].total_sales), 1170);
    const emittedItems = JSON.parse(emittedSummaryRows[0].items_summary);
    const emittedSoup = emittedItems.find(i => i.name.toLowerCase() === 'archived pos soup');
    const emittedChai = emittedItems.find(i => i.name.toLowerCase() === 'archived pos chai');
    const emittedCat = emittedItems.find(i => i.name === 'Catalog Item One');
    assert.ok(emittedSoup && emittedSoup.dish_id === null && emittedSoup.quantity === 5 && emittedSoup.revenue === 600, 'Re-compacted synthetic POS soup keeps dish_id=null and cumulative totals');
    assert.ok(emittedChai && emittedChai.dish_id === null && emittedChai.quantity === 3 && emittedChai.revenue === 120, 'Re-compacted synthetic POS chai keeps dish_id=null and stays separate from soup');
    assert.ok(emittedCat && String(emittedCat.dish_id) === '1' && emittedCat.quantity === 3 && emittedCat.revenue === 450, 'Re-compacted catalog item retains dish_id=1 and cumulative totals');

    const compXlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=month:2025-05`, {
      headers: { Authorization: `Bearer ${compToken}` }
    });
    assert.equal(compXlsxRes.status, 200);
    const compWb = new ExcelJS.Workbook();
    await compWb.xlsx.load(Buffer.from(await compXlsxRes.arrayBuffer()));
    const compSheet = compWb.getWorksheet('Item Sales');
    const compRows = [];
    compSheet.eachRow((row, idx) => {
      if (idx <= 5) return;
      compRows.push({
        dishId: row.getCell(2).value,
        name: row.getCell(3).value,
        qty: Number(row.getCell(4).value),
        rev: Number(row.getCell(5).value)
      });
    });
    const compSoupRow = compRows.find(r => String(r.name || '').toLowerCase() === 'archived pos soup');
    const compChaiRow = compRows.find(r => String(r.name || '').toLowerCase() === 'archived pos chai');
    const compCatRow = compRows.find(r => r.name === 'Catalog Item One');
    assert.ok(compSoupRow && !compSoupRow.dishId && compSoupRow.qty === 5 && compSoupRow.rev === 600);
    assert.ok(compChaiRow && !compChaiRow.dishId && compChaiRow.qty === 3 && compChaiRow.rev === 120);
    assert.ok(compCatRow && String(compCatRow.dishId) === '1' && compCatRow.qty === 3 && compCatRow.rev === 450);
    pass('runAutoDataSummarization preserves dish_id: null and separate soup/chai totals cleanly across re-compaction and XLSX export');

    // 6b. Export entitlement projection check: zero-price active vip_ultra qualifies; expired grant is denied
    const vipUltraIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'vip_ultra', 0, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
    `, ['VIP Ultra Bistro', `vip-ultra-${ts}`]);
    const vipUltraToken = jwt.sign({ id: 206, restaurant_id: vipUltraIns[0].id, username: 'vu_admin', role: 'restaurant_admin' }, JWT_SECRET);
    const vuCsvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, { headers: { Authorization: `Bearer ${vipUltraToken}` } });
    const vuXlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, { headers: { Authorization: `Bearer ${vipUltraToken}` } });
    assert.equal(vuCsvRes.status, 200, 'Active zero-price vip_ultra without markers must qualify for CSV export');
    assert.equal(vuXlsxRes.status, 200, 'Active zero-price vip_ultra without markers must qualify for XLSX export');

    const expVipIns = await query(`
      INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, subscription_type, active, trial_ends_at, plan_expires_at)
      VALUES ($1, $2, 'restaurant', 'basic', 0, 'ADMIN_GRANTED', 1, '2030-01-01T00:00:00Z', '2020-01-01T00:00:00Z') RETURNING id
    `, ['Expired VIP Basic', `exp-vip-${ts}`]);
    const expVipToken = jwt.sign({ id: 207, restaurant_id: expVipIns[0].id, username: 'ev_admin', role: 'restaurant_admin' }, JWT_SECRET);
    const expCsvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, { headers: { Authorization: `Bearer ${expVipToken}` } });
    const expXlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, { headers: { Authorization: `Bearer ${expVipToken}` } });
    assert.equal(expCsvRes.status, 403, 'Expired VIP grant on basic plan must be denied CSV export');
    assert.equal(expXlsxRes.status, 403, 'Expired VIP grant on basic plan must be denied XLSX export');
    pass('CSV and XLSX export projections verify zero-price vip_ultra entitlement and deny expired grants');

    // 7. Unit test: Analytics polling supports 12-second slow responses while discarding stale filter responses
    {
      let nowMs = 0;
      let nextTimerId = 1;
      const timers = new Map();
      const fakeSetTimeout = (fn, delay) => {
        const id = nextTimerId++;
        timers.set(id, { fn, runAt: nowMs + delay });
        return id;
      };
      const fakeClearTimeout = (id) => {
        timers.delete(id);
      };
      const advanceTime = async (deltaMs) => {
        const target = nowMs + deltaMs;
        while (true) {
          let earliestId = null;
          let earliestRunAt = Infinity;
          for (const [id, t] of timers.entries()) {
            if (t.runAt <= target && t.runAt < earliestRunAt) {
              earliestId = id;
              earliestRunAt = t.runAt;
            }
          }
          if (earliestId === null) break;
          const t = timers.get(earliestId);
          timers.delete(earliestId);
          nowMs = t.runAt;
          t.fn();
          await Promise.resolve();
          await Promise.resolve();
        }
        nowMs = target;
      };

      const seqRef = { current: 0 };
      const applied = [];

      // Case A: Single active filter with 12s response exceeds 10s interval and must apply
      let callCount = 0;
      const stopA = startAnalyticsPolling({
        seqRef,
        intervalMs: 10000,
        setTimeoutFn: fakeSetTimeout,
        clearTimeoutFn: fakeClearTimeout,
        onSuccess: (d) => applied.push(d),
        fetchAnalytics: () => new Promise((resolve) => {
          const n = ++callCount;
          fakeSetTimeout(() => resolve({ selected_period: 'all', call: n }), 12000);
        })
      });

      await advanceTime(10500);
      assert.equal(callCount, 1, 'No overlapping poll may start at 10s while 12s request is in flight');
      assert.equal(applied.length, 0);
      await advanceTime(2000); // now at 12.5s
      assert.equal(applied.length, 1, '12s response must be applied once settled');
      assert.deepEqual(applied[0], { selected_period: 'all', call: 1 });
      await advanceTime(10000); // next poll schedules at 12s+10s = 22s, takes another 12s -> 34s
      assert.equal(callCount, 2, 'Next poll starts 10s after 12s response settled');
      stopA();

      // Case B: Filter switched mid-flight during a 12s request discards stale response
      const appliedB = [];
      let stopOld = startAnalyticsPolling({
        seqRef,
        intervalMs: 10000,
        setTimeoutFn: fakeSetTimeout,
        clearTimeoutFn: fakeClearTimeout,
        onSuccess: (d) => appliedB.push(d),
        fetchAnalytics: () => new Promise((resolve) => {
          fakeSetTimeout(() => resolve({ selected_period: 'all', stale: true }), 12000);
        })
      });

      await advanceTime(3000);
      stopOld();
      const stopNew = startAnalyticsPolling({
        seqRef,
        intervalMs: 10000,
        setTimeoutFn: fakeSetTimeout,
        clearTimeoutFn: fakeClearTimeout,
        onSuccess: (d) => appliedB.push(d),
        fetchAnalytics: () => new Promise((resolve) => {
          fakeSetTimeout(() => resolve({ selected_period: 'today', fresh: true }), 500);
        })
      });

      await advanceTime(10000); // now at 13s: past 12s old request, before 13.5s second fresh poll
      assert.deepEqual(appliedB, [{ selected_period: 'today', fresh: true }], 'Stale 12s response after filter switch must be ignored');
      stopNew();
      pass('startAnalyticsPolling applies 12s responses cleanly and discards superseded filter responses');
    }

    // 8. Real component & client behavior tests (AdminDashboard, AnalyticsView, api client)
    {
      // 8a. Verify client URL params for August 2026 & pending fetch abort on timeout with controlled clock
      const origFetch = globalThis.fetch;
      const origSetTimeout = globalThis.setTimeout;
      const origClearTimeout = globalThis.clearTimeout;
      const seenUrls = [];
      try {
        const { fetchAdminAnalytics, exportAdminAnalyticsXLSX } = await import('../../src/api/client.js');
        globalThis.fetch = async (url) => {
          seenUrls.push(String(url));
          if (String(url).includes('/export/xlsx')) {
            return {
              ok: true,
              status: 200,
              headers: new Headers({ 'Content-Disposition': 'attachment; filename="Sales_Report_Month_2026-08.xlsx"' }),
              blob: async () => new Blob(['ok'])
            };
          }
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
            text: async () => JSON.stringify({ selected_period: 'month:2026-08' }),
            json: async () => ({ selected_period: 'month:2026-08' })
          };
        };
        await fetchAdminAnalytics('tok-m', 'month', 2026, 8);
        await exportAdminAnalyticsXLSX('tok-m', 'month', 2026, 8);
        assert.ok(seenUrls[0].includes('year=2026') && seenUrls[0].includes('month=8') && !seenUrls[0].includes('period=month&'), 'fetchAdminAnalytics sends year & month cleanly');
        assert.ok(seenUrls[1].includes('year=2026') && seenUrls[1].includes('month=8') && !seenUrls[1].includes('period=month&'), 'exportAdminAnalyticsXLSX sends year & month cleanly');

        // Separate pending-fetch timeout case using controlled clock (no real-time wait)
        let fakeNow = 0;
        let fakeTimerSeq = 1;
        const fakeTimers = new Map();
        globalThis.setTimeout = (fn, delay = 0) => {
          const id = fakeTimerSeq++;
          fakeTimers.set(id, { fn, runAt: fakeNow + Number(delay || 0) });
          return id;
        };
        globalThis.clearTimeout = (id) => {
          fakeTimers.delete(id);
        };
        const advanceClock = async (deltaMs) => {
          const target = fakeNow + deltaMs;
          while (true) {
            let nextId = null;
            let nextRunAt = Infinity;
            for (const [id, t] of fakeTimers.entries()) {
              if (t.runAt <= target && t.runAt < nextRunAt) {
                nextId = id;
                nextRunAt = t.runAt;
              }
            }
            if (nextId === null) break;
            const t = fakeTimers.get(nextId);
            fakeTimers.delete(nextId);
            fakeNow = t.runAt;
            t.fn();
            await Promise.resolve();
          }
          fakeNow = target;
        };

        let observedSignal = null;
        globalThis.fetch = (_url, init = {}) => new Promise((_resolve, reject) => {
          observedSignal = init.signal || null;
          if (observedSignal) {
            observedSignal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });

        const timeoutPromise = fetchAdminAnalytics('tok-timeout', 'all');
        assert.ok(observedSignal, 'fetchAdminAnalytics must pass an AbortSignal to fetch');
        assert.equal(observedSignal.aborted, false, 'Signal must not be aborted before configured timeout');
        await advanceClock(20001);
        assert.equal(observedSignal.aborted, true, 'Signal must abort once controlled clock passes 20s timeout');
        await assert.rejects(timeoutPromise, (err) => Boolean(err && err.isTimeout && err.message.includes('timed out')));
      } finally {
        globalThis.fetch = origFetch;
        globalThis.setTimeout = origSetTimeout;
        globalThis.clearTimeout = origClearTimeout;
      }

      // Build runnable ESM bundles of AdminDashboard & AnalyticsView (CSS & leaflet stubbed, react/react-dom shared)
      const uiTestStubPlugin = {
        name: 'ui-test-stubs',
        setup(build) {
          build.onResolve({ filter: /\.css$/ }, (args) => ({ path: args.path, namespace: 'css-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'css-stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
          build.onResolve({ filter: /^leaflet$/ }, () => ({ path: 'leaflet', namespace: 'leaflet-stub' }));
          build.onLoad({ filter: /.*/, namespace: 'leaflet-stub' }, () => ({
            contents: 'const makeProxy = () => new Proxy(function(){}, { get: (_t, k) => k === "__esModule" ? false : makeProxy(), apply: () => makeProxy() }); export default makeProxy();',
            loader: 'js'
          }));
        }
      };
      const cacheRoot = path.join(ROOT_DIR, 'node_modules/.cache');
      fs.mkdirSync(cacheRoot, { recursive: true });
      compiledDir = fs.mkdtempSync(path.join(cacheRoot, 'analytics-ui-test-'));
      await esbuild.build({
        entryPoints: {
          AdminDashboard: path.join(ROOT_DIR, 'src/components/Admin/AdminDashboard.jsx'),
          AnalyticsView: path.join(ROOT_DIR, 'src/components/Admin/views/AnalyticsView.jsx')
        },
        outdir: compiledDir,
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        mainFields: ['module', 'main'],
        jsx: 'automatic',
        external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'lucide-react', 'qrcode'],
        plugins: [uiTestStubPlugin],
        outExtension: { '.js': '.mjs' }
      });

      const { default: AdminDashboard } = await import(pathToFileURL(path.join(compiledDir, 'AdminDashboard.mjs')).href);
      const { default: AnalyticsView } = await import(pathToFileURL(path.join(compiledDir, 'AnalyticsView.mjs')).href);

      // 8b. Verify AnalyticsView Room formatting, active sync vs error retry, and refresh status labels
      const htmlLoading = renderToStaticMarkup(
        React.createElement(AnalyticsView, {
          analyticsData: {
            selected_period: 'all',
            period_sales: 500,
            total_sales: 500,
            period_orders: 1,
            total_orders: 1,
            last_updated: '2026-06-15T10:00:00Z',
            recent_orders: [
              { id: 1, table_number: 'Room 3', space_type: 'room', total_amount: 250, payment_method: 'upi', status: 'completed', items: [] },
              { id: 2, table_number: '3', space_type: 'room', total_amount: 250, payment_method: 'cash', status: 'completed', items: [] },
              { id: 3, table_number: 'Table 2', total_amount: 100, payment_method: 'cash', status: 'completed', items: [] },
              { id: 4, table_number: '7', total_amount: 120, payment_method: 'upi', status: 'completed', items: [] }
            ]
          },
          selectedFilterPeriod: 'today',
          syncStatus: 'loading',
          restaurantInfo: { business_type: 'hotel_resort', service_model: 'hotel' }
        })
      );
      assert.ok(htmlLoading.includes('Room 3') && !htmlLoading.includes('Room Room 3'), 'AnalyticsView keeps "Room 3" without duplicating prefix');
      assert.ok(htmlLoading.includes('T-02') && !htmlLoading.includes('Room Table 2'), 'AnalyticsView recognizes explicit Table prefix on hotel tenant');
      assert.ok(htmlLoading.includes('Room 7'), 'AnalyticsView retains room default for untyped numeric hotel location');
      assert.ok(htmlLoading.includes('Updating to Today') && htmlLoading.includes('Refreshing…'), 'AnalyticsView shows active update and Refreshing status while in flight');

      const htmlError = renderToStaticMarkup(
        React.createElement(AnalyticsView, {
          analyticsData: {
            selected_period: 'all',
            period_sales: 500,
            total_sales: 500,
            last_updated: '2026-06-15T10:00:00Z'
          },
          selectedFilterPeriod: 'today',
          syncStatus: 'error',
          syncError: 'Network error',
          onRetrySync: () => { }
        })
      );
      assert.ok(htmlError.includes('Sync failed (Today)') && htmlError.includes('>Retry<') && htmlError.includes('Last synced'), 'AnalyticsView shows retry action and last sync time on error');
      assert.ok(
        htmlLoading.includes('analytics-period-box') &&
        htmlLoading.includes('analytics-period-select') &&
        htmlLoading.includes('analytics-refresh-pill') &&
        htmlLoading.includes('min-height: 0 !important') &&
        htmlLoading.includes('analytics-mobile-list') &&
        htmlLoading.includes('analytics-telemetry-grid') &&
        !htmlLoading.includes('minmax(280px, 1fr)') &&
        htmlLoading.includes('vector-effect="non-scaling-stroke"'),
        'AnalyticsView includes mobile-safe header controls, non-distorted chart markers, telemetry grid, and mobile order cards'
      );

      // 8b-2. Verify non-overlapping chart hit strips, xPercent-aligned x-axis edge labels, and readable mobile order timestamps
      const htmlChartMulti = renderToStaticMarkup(
        React.createElement(AnalyticsView, {
          analyticsData: {
            selected_period: '7d',
            period_sales: 1200,
            total_sales: 1200,
            period_orders: 3,
            total_orders: 3,
            daily_chart_data: [
              { date: '2026-06-10', displayDate: 'Jun 10', sales: 200 },
              { date: '2026-06-11', displayDate: 'Jun 11', sales: 500 },
              { date: '2026-06-12', displayDate: 'Jun 12', sales: 150 },
              { date: '2026-06-13', displayDate: 'Jun 13', sales: 350 }
            ],
            recent_orders: [
              { id: 42, table_number: '5', total_amount: 450, payment_method: 'upi', status: 'completed', created_at: '2026-06-13T14:30:00Z', items: [{ name: 'Tea', quantity: 2 }] }
            ]
          }
        })
      );
      assert.ok(htmlChartMulti.includes('transform:translateX(0%);text-align:left') && htmlChartMulti.includes('transform:translateX(-100%);text-align:right'), 'X-axis edge labels clamp alignment within chart bounds');

      // Inspect every chart hit button's geometry and label directly
      const hitButtons = [];
      const hitBtnRe = /<button\b([^>]*\baria-label="([^"]+)"[^>]*)>/gi;
      let hitMatch;
      while ((hitMatch = hitBtnRe.exec(htmlChartMulti)) !== null) {
        const attrsStr = hitMatch[1];
        const ariaLabel = hitMatch[2];
        const styleMatch = attrsStr.match(/\bstyle="([^"]*)"/i);
        const styleStr = styleMatch ? styleMatch[1] : '';
        const leftMatch = styleStr.match(/\bleft\s*:\s*([0-9.]+)%/i);
        const widthMatch = styleStr.match(/\bwidth\s*:\s*([0-9.]+)%/i);
        hitButtons.push({
          ariaLabel,
          styleStr,
          leftPct: leftMatch ? Number(leftMatch[1]) : NaN,
          widthPct: widthMatch ? Number(widthMatch[1]) : NaN
        });
      }
      assert.deepEqual(
        hitButtons.map(b => b.ariaLabel),
        ['Jun 10: ₹200', 'Jun 11: ₹500', 'Jun 12: ₹150', 'Jun 13: ₹350'],
        'All four chart samples must render with their exact interactive hit-button aria-labels'
      );
      for (let hIdx = 0; hIdx < hitButtons.length; hIdx++) {
        const hb = hitButtons[hIdx];
        assert.ok(!/\b(?:width|height)\s*:\s*[^;]*px/i.test(hb.styleStr), `Hit region ${hIdx} must not use fixed-px box (${hb.styleStr})`);
        assert.ok(Number.isFinite(hb.leftPct) && Number.isFinite(hb.widthPct) && hb.widthPct > 0, `Hit region ${hIdx} must declare valid percentage left/width`);
        if (hIdx === 0) {
          assert.ok(Math.abs(hb.leftPct - 0) < 0.01, 'First chart hit region starts cleanly at 0%');
        } else {
          const prev = hitButtons[hIdx - 1];
          assert.ok(Math.abs((prev.leftPct + prev.widthPct) - hb.leftPct) < 0.01, `Hit region ${hIdx} must abut previous region cleanly with zero overlap`);
        }
        if (hIdx === hitButtons.length - 1) {
          assert.ok(Math.abs((hb.leftPct + hb.widthPct) - 100) < 0.01, 'Last chart hit region extends cleanly to 100%');
        }
      }

      // Inspect the mobile stacked order card block for separate, untruncated timestamp element
      const mobileListIdx = htmlChartMulti.indexOf('class="analytics-mobile-list"');
      assert.ok(mobileListIdx !== -1, 'Mobile stacked order card list must render');
      const mobileListSlice = htmlChartMulti.slice(mobileListIdx, mobileListIdx + 2500);
      const sampleOrderDate = new Date('2026-06-13T14:30:00Z');
      const expectedDateTime = `${sampleOrderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })} ${sampleOrderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}`;
      const escapedExpectedDateTime = expectedDateTime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tsSpanMatch = mobileListSlice.match(new RegExp(`<span\\s+style="([^"]*)"[^>]*>${escapedExpectedDateTime}<\\/span>`));
      assert.ok(tsSpanMatch, `Mobile order card must render complete timestamp "${expectedDateTime}" on its own dedicated element`);
      const tsStyle = tsSpanMatch[1];
      assert.ok(
        !/text-overflow\s*:\s*ellipsis/i.test(tsStyle) &&
        !/white-space\s*:\s*nowrap/i.test(tsStyle) &&
        !/overflow\s*:\s*hidden/i.test(tsStyle),
        `Mobile order timestamp span must not apply single-line truncation (style="${tsStyle}")`
      );
      assert.ok(
        new RegExp(`2 items • UPI<\\/span>\\s*<strong[^>]*>₹450<\\/strong>\\s*<\\/div>\\s*<span[^>]*>${escapedExpectedDateTime}<\\/span>`).test(mobileListSlice),
        'Mobile order card must keep amount beside items/payment row and place timestamp on a separate row'
      );

      // 8c. Mount real AdminDashboard with minimal DOM harness & deferred fetch responses
      const createTestDom = (search = '?tab=analytics') => {
        const storage = new Map();
        const localStorageMock = {
          getItem: (k) => (storage.has(k) ? storage.get(k) : null),
          setItem: (k, v) => storage.set(k, String(v)),
          removeItem: (k) => storage.delete(k),
          clear: () => storage.clear()
        };

        const createEventBus = () => {
          const listeners = new Map();
          return {
            addEventListener(type, fn) {
              if (!listeners.has(type)) listeners.set(type, new Set());
              listeners.get(type).add(fn);
            },
            removeEventListener(type, fn) {
              listeners.get(type)?.delete(fn);
            },
            dispatchEvent(evt) {
              const event = typeof evt === 'string' ? { type: evt, bubbles: true } : evt;
              if (!event.target) event.target = this;
              event.currentTarget = this;
              event.preventDefault = event.preventDefault || (() => { });
              event.stopPropagation = event.stopPropagation || (() => { event._stopped = true; });
              const set = listeners.get(event.type);
              if (set) {
                for (const fn of Array.from(set)) fn.call(this, event);
              }
              if (event.bubbles && !event._stopped && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
                this.parentNode.dispatchEvent(event);
              }
              return true;
            }
          };
        };

        const doc = { nodeType: 9 };
        class FakeNode {
          constructor(nodeType, nodeName) {
            this.nodeType = nodeType;
            this.nodeName = nodeName;
            this.ownerDocument = doc;
            this.parentNode = null;
            this.childNodes = [];
            Object.assign(this, createEventBus());
          }
          get firstChild() { return this.childNodes[0] || null; }
          get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
          get nextSibling() {
            if (!this.parentNode) return null;
            const idx = this.parentNode.childNodes.indexOf(this);
            return idx >= 0 ? (this.parentNode.childNodes[idx + 1] || null) : null;
          }
          get previousSibling() {
            if (!this.parentNode) return null;
            const idx = this.parentNode.childNodes.indexOf(this);
            return idx > 0 ? this.parentNode.childNodes[idx - 1] : null;
          }
          appendChild(child) {
            if (child.parentNode) child.parentNode.removeChild(child);
            child.parentNode = this;
            this.childNodes.push(child);
            return child;
          }
          insertBefore(child, ref) {
            if (!ref) return this.appendChild(child);
            if (child.parentNode) child.parentNode.removeChild(child);
            const idx = this.childNodes.indexOf(ref);
            child.parentNode = this;
            if (idx === -1) this.childNodes.push(child);
            else this.childNodes.splice(idx, 0, child);
            return child;
          }
          removeChild(child) {
            const idx = this.childNodes.indexOf(child);
            if (idx !== -1) {
              this.childNodes.splice(idx, 1);
              child.parentNode = null;
            }
            return child;
          }
          contains(target) {
            let cur = target;
            while (cur) {
              if (cur === this) return true;
              cur = cur.parentNode;
            }
            return false;
          }
        }
        class FakeText extends FakeNode {
          constructor(text) {
            super(3, '#text');
            this._data = String(text ?? '');
          }
          get data() { return this._data; }
          set data(v) { this._data = String(v ?? ''); }
          get nodeValue() { return this._data; }
          set nodeValue(v) { this._data = String(v ?? ''); }
          get textContent() { return this._data; }
          set textContent(v) { this._data = String(v ?? ''); }
        }
        class FakeComment extends FakeNode {
          constructor(text) { super(8, '#comment'); this.data = String(text ?? ''); this.nodeValue = this.data; }
        }
        class FakeElement extends FakeNode {
          constructor(tag) {
            const upper = String(tag).toUpperCase();
            super(1, upper);
            this.tagName = upper;
            this.attrs = new Map();
            this._value = '';
            this.selected = false;
            this.disabled = false;
            this.style = { setProperty() { }, removeProperty() { } };
            this.className = '';
          }
          get children() { return this.childNodes.filter(c => c.nodeType === 1); }
          get options() { return this.childNodes.filter(c => c.nodeType === 1 && c.tagName === 'OPTION'); }
          get value() { return this._value; }
          set value(v) { this._value = String(v ?? ''); }
          get textContent() { return this.childNodes.map(c => c.textContent ?? '').join(''); }
          set textContent(v) {
            this.childNodes.forEach(c => { c.parentNode = null; });
            this.childNodes = [];
            if (v !== '' && v !== null && v !== undefined) this.appendChild(new FakeText(v));
          }
          set innerHTML(v) { this.textContent = v ? '' : ''; }
          get innerHTML() { return this.textContent; }
          setAttribute(k, v) {
            const key = String(k);
            this.attrs.set(key, String(v));
            if (key === 'value') this._value = String(v);
            if (key === 'class') this.className = String(v);
          }
          getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
          removeAttribute(k) { this.attrs.delete(k); }
          focus() { }
          blur() { }
        }

        const win = {
          ...createEventBus(),
          location: { search, pathname: '/admin', href: `http://localhost/admin${search}` },
          history: { replaceState() { }, pushState() { } },
          innerWidth: 1280,
          Node: FakeNode,
          Element: FakeElement,
          HTMLElement: FakeElement,
          HTMLIFrameElement: class HTMLIFrameElement extends FakeElement { },
          HTMLInputElement: FakeElement,
          HTMLSelectElement: FakeElement,
          HTMLTextAreaElement: FakeElement,
          localStorage: localStorageMock,
          navigator: { onLine: true },
          matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { } }),
          Notification: { permission: 'default' }
        };
        Object.assign(doc, createEventBus(), {
          defaultView: win,
          activeElement: null,
          documentElement: new FakeElement('html'),
          head: new FakeElement('head'),
          body: new FakeElement('body'),
          createElement: (tag) => new FakeElement(tag),
          createElementNS: (_ns, tag) => new FakeElement(tag),
          createTextNode: (t) => new FakeText(t),
          createComment: (t) => new FakeComment(t)
        });
        doc.documentElement.appendChild(doc.head);
        doc.documentElement.appendChild(doc.body);
        doc.documentElement.parentNode = doc;
        doc.body.parentNode = doc.documentElement;
        win.document = doc;
        return { win, doc, localStorageMock };
      };

      const findNodes = (node, pred, acc = []) => {
        if (!node) return acc;
        if (pred(node)) acc.push(node);
        for (const ch of node.childNodes || []) findNodes(ch, pred, acc);
        return acc;
      };
      const flushMicrotasks = async (rounds = 8) => {
        for (let i = 0; i < rounds; i++) await Promise.resolve();
      };

      const savedKeys = ['window', 'document', 'localStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT', 'Notification', 'history', 'HTMLElement', 'Element', 'Node', 'Audio'];
      const prevGlobals = Object.fromEntries(savedKeys.map(k => [k, globalThis[k]]));
      const applyDomGlobals = (env) => {
        globalThis.window = env.win;
        globalThis.document = env.doc;
        globalThis.localStorage = env.localStorageMock;
        globalThis.Notification = env.win.Notification;
        globalThis.history = env.win.history;
        globalThis.HTMLElement = env.win.HTMLElement;
        globalThis.Element = env.win.Element;
        globalThis.Node = env.win.Node;
        globalThis.Audio = function FakeAudio() { return { play: () => Promise.resolve(), pause() { } }; };
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
      };

      try {
        // Test 0: Verify interactive click selection across all 4 chart samples in mounted AnalyticsView
        const envChart = createTestDom('?tab=analytics');
        applyDomGlobals(envChart);
        const chartContainer = envChart.doc.createElement('div');
        envChart.doc.body.appendChild(chartContainer);
        const chartRoot = createRoot(chartContainer);
        const chartSamples = [
          { date: '2026-06-10', displayDate: 'Jun 10', sales: 200 },
          { date: '2026-06-11', displayDate: 'Jun 11', sales: 500 },
          { date: '2026-06-12', displayDate: 'Jun 12', sales: 150 },
          { date: '2026-06-13', displayDate: 'Jun 13', sales: 350 }
        ];
        await act(async () => {
          chartRoot.render(
            React.createElement(AnalyticsView, {
              analyticsData: {
                selected_period: '7d',
                period_sales: 1200,
                total_sales: 1200,
                period_orders: 3,
                total_orders: 3,
                daily_chart_data: chartSamples
              }
            })
          );
          await flushMicrotasks();
        });
        const sampleBtns = findNodes(chartContainer, n => n.tagName === 'BUTTON' && String(n.getAttribute('aria-label') || '').startsWith('Jun '));
        assert.deepEqual(
          sampleBtns.map(b => b.getAttribute('aria-label')),
          ['Jun 10: ₹200', 'Jun 11: ₹500', 'Jun 12: ₹150', 'Jun 13: ₹350'],
          'Mounted AnalyticsView exposes all 4 independent sample hit buttons'
        );
        for (const s of chartSamples) {
          const targetLabel = `${s.displayDate}: ₹${s.sales}`;
          const btn = sampleBtns.find(b => b.getAttribute('aria-label') === targetLabel);
          await act(async () => {
            btn.dispatchEvent({ type: 'click', bubbles: true, target: btn });
            await flushMicrotasks();
          });
          assert.ok(
            chartContainer.textContent.includes(`${s.displayDate}₹${s.sales}`) ||
            (chartContainer.textContent.includes(s.displayDate) && chartContainer.textContent.includes(`₹${s.sales}`)),
            `Clicking sample hit button "${targetLabel}" selects that sample in tooltip`
          );
        }
        await act(async () => {
          chartRoot.unmount();
          await flushMicrotasks();
        });

        // Test A: Already on Analytics tab — change filter before deferred older poll resolves
        const envA = createTestDom('?tab=analytics');
        const { localStorageMock } = envA;
        applyDomGlobals(envA);

        localStorageMock.setItem('touchqr_admin_slug', 'demo-bistro');
        const initialSavedPayload = JSON.stringify({ selected_period: 'all', period_sales: 100 });
        localStorageMock.setItem('admin_cache_demo-bistro_analytics', initialSavedPayload);

        let resolveStaleAll;
        const staleAllPromise = new Promise(r => { resolveStaleAll = r; });
        const jsonRes = (body) => ({
          ok: true,
          status: 200,
          headers: new Headers(),
          text: async () => JSON.stringify(body),
          json: async () => body
        });

        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('/api/admin/analytics?period=today')) {
            return jsonRes({
              selected_period: 'today',
              period_sales: 777,
              total_sales: 777,
              period_orders: 3,
              total_orders: 3,
              period_aov: 259,
              top_dishes: [],
              category_sales: [],
              daily_chart_data: [],
              last_updated: '2026-06-15T10:05:00Z'
            });
          }
          if (u.includes('/api/admin/analytics')) {
            const payload = await staleAllPromise;
            return jsonRes(payload);
          }
          if (u.includes('/api/info')) return jsonRes({ id: 1, name: 'Demo Bistro', slug: 'demo-bistro', plan_tier: 'pro', analytics_export_enabled: true });
          if (u.includes('/api/admin/subscription-status')) return jsonRes({ status: 'active', plan_tier: 'pro' });
          return jsonRes([]);
        };

        const containerA = envA.doc.createElement('div');
        envA.doc.body.appendChild(containerA);
        const rootA = createRoot(containerA);

        await act(async () => {
          rootA.render(React.createElement(AdminDashboard, { token: 'tok-dash-a', slug: 'demo-bistro' }));
          await flushMicrotasks();
        });

        const selects = findNodes(containerA, n => n.nodeType === 1 && n.tagName === 'SELECT');
        const periodSelect = selects.find(s => findNodes(s, o => o.tagName === 'OPTION' && o.value === 'today').length > 0);
        assert.ok(periodSelect, 'Analytics period selector must render');

        await act(async () => {
          periodSelect.value = 'today';
          periodSelect.dispatchEvent({ type: 'change', bubbles: true, target: periodSelect });
          await flushMicrotasks();
        });

        assert.ok(containerA.textContent.includes('777') && containerA.textContent.includes('Today'), 'Fresh filter response renders immediately');

        await act(async () => {
          resolveStaleAll({
            selected_period: 'all',
            period_sales: 88888,
            total_sales: 88888,
            period_orders: 99,
            total_orders: 99,
            top_dishes: [],
            category_sales: [],
            daily_chart_data: [],
            last_updated: '2026-06-15T09:00:00Z'
          });
          await flushMicrotasks();
        });

        assert.ok(containerA.textContent.includes('777') && !containerA.textContent.includes('88,888'), 'Stale response must not overwrite rendered payload');
        assert.equal(localStorageMock.getItem('admin_cache_demo-bistro_analytics'), initialSavedPayload, 'Stale response must not overwrite saved analytics cache');

        await act(async () => {
          rootA.unmount();
          await flushMicrotasks();
        });

        // Test B: Start on Home tab so initial reload fires analytics; switch to Analytics + filter before reload resolves
        const envB = createTestDom('?tab=home');
        applyDomGlobals(envB);
        envB.localStorageMock.setItem('touchqr_admin_slug', 'home-bistro');
        const savedBeforeSwitch = JSON.stringify({ selected_period: 'all', period_sales: 100 });
        envB.localStorageMock.setItem('admin_cache_home-bistro_analytics', savedBeforeSwitch);

        let resolveReloadAll;
        const reloadAllPromise = new Promise(r => { resolveReloadAll = r; });

        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('/api/admin/analytics?period=today')) {
            return jsonRes({
              selected_period: 'today',
              period_sales: 555,
              total_sales: 555,
              period_orders: 2,
              total_orders: 2,
              top_dishes: [],
              category_sales: [],
              daily_chart_data: [],
              last_updated: '2026-06-15T10:10:00Z'
            });
          }
          if (u.includes('/api/admin/analytics')) {
            const payload = await reloadAllPromise;
            return jsonRes(payload);
          }
          if (u.includes('/api/info')) return jsonRes({ id: 2, name: 'Home Bistro', slug: 'home-bistro', plan_tier: 'pro', analytics_export_enabled: true });
          if (u.includes('/api/admin/subscription-status')) return jsonRes({ status: 'active', plan_tier: 'pro' });
          return jsonRes([]);
        };

        const containerB = envB.doc.createElement('div');
        envB.doc.body.appendChild(containerB);
        const rootB = createRoot(containerB);

        await act(async () => {
          rootB.render(React.createElement(AdminDashboard, { token: 'tok-dash-b', slug: 'home-bistro' }));
          await flushMicrotasks();
        });

        const analyticsNavBtn = findNodes(containerB, n => n.tagName === 'BUTTON' && n.textContent.includes('Analytics'))[0];
        assert.ok(analyticsNavBtn, 'Analytics tab navigation button must exist');

        await act(async () => {
          analyticsNavBtn.dispatchEvent({ type: 'click', bubbles: true, target: analyticsNavBtn });
          await flushMicrotasks();
        });

        const selectB = findNodes(containerB, n => n.tagName === 'SELECT').find(s => findNodes(s, o => o.tagName === 'OPTION' && o.value === 'today').length > 0);
        assert.ok(selectB, 'Analytics period selector must appear after switching tab');

        await act(async () => {
          selectB.value = 'today';
          selectB.dispatchEvent({ type: 'change', bubbles: true, target: selectB });
          await flushMicrotasks();
        });

        assert.ok(containerB.textContent.includes('555'), 'Selected Today filter payload renders cleanly');

        await act(async () => {
          resolveReloadAll({
            selected_period: 'all',
            period_sales: 99999,
            total_sales: 99999,
            period_orders: 77,
            total_orders: 77,
            top_dishes: [],
            category_sales: [],
            daily_chart_data: [],
            last_updated: '2026-06-15T08:00:00Z'
          });
          await flushMicrotasks();
        });

        assert.ok(containerB.textContent.includes('555') && !containerB.textContent.includes('99,999'), 'Late loadData response must not overwrite rendered filtered payload');
        assert.equal(envB.localStorageMock.getItem('admin_cache_home-bistro_analytics'), savedBeforeSwitch, 'Late loadData response must not overwrite saved cache after tab/filter change');

        await act(async () => {
          rootB.unmount();
          await flushMicrotasks();
        });

        // Test C: Older loadData 'all' response must not overwrite newer accepted all-time poll snapshot
        const envC = createTestDom('?tab=home');
        applyDomGlobals(envC);
        envC.localStorageMock.setItem('touchqr_admin_slug', 'lifetime-race');

        let resolveOldLoadAll;
        const oldLoadAllPromise = new Promise(r => { resolveOldLoadAll = r; });
        let allCallsCount = 0;

        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('/api/admin/analytics')) {
            allCallsCount += 1;
            if (allCallsCount === 1) {
              return jsonRes(await oldLoadAllPromise);
            }
            return jsonRes({
              selected_period: 'all',
              period_sales: 22222,
              total_sales: 22222,
              today_sales: 22222,
              today_scans: 789,
              period_orders: 22,
              total_orders: 22,
              top_dishes: [],
              category_sales: [],
              daily_chart_data: [],
              last_updated: '2026-06-15T10:15:00Z'
            });
          }
          if (u.includes('/api/info')) return jsonRes({ id: 3, name: 'Lifetime Race', slug: 'lifetime-race', plan_tier: 'pro', analytics_export_enabled: true });
          if (u.includes('/api/admin/subscription-status')) return jsonRes({ status: 'active', plan_tier: 'pro' });
          return jsonRes([]);
        };

        const containerC = envC.doc.createElement('div');
        envC.doc.body.appendChild(containerC);
        const rootC = createRoot(containerC);

        await act(async () => {
          rootC.render(React.createElement(AdminDashboard, { token: 'tok-dash-c', slug: 'lifetime-race' }));
          await flushMicrotasks();
        });

        // Switch to Analytics tab -> triggers newer 'all' poll (22222), then resolve older loadData (11111)
        const analyticsNavC = findNodes(containerC, n => n.tagName === 'BUTTON' && n.textContent.includes('Analytics'))[0];
        await act(async () => {
          analyticsNavC.dispatchEvent({ type: 'click', bubbles: true, target: analyticsNavC });
          await flushMicrotasks();
        });
        assert.ok(containerC.textContent.includes('22,222'), 'Newer all-time poll snapshot renders');

        await act(async () => {
          resolveOldLoadAll({
            selected_period: 'all',
            period_sales: 11111,
            total_sales: 11111,
            today_sales: 11111,
            today_scans: 654,
            period_orders: 11,
            total_orders: 11,
            top_dishes: [],
            category_sales: [],
            daily_chart_data: [],
            last_updated: '2026-06-15T09:00:00Z'
          });
          await flushMicrotasks();
        });

        const homeNavC = findNodes(containerC, n => n.tagName === 'BUTTON' && n.textContent.includes('Home'))[0];
        await act(async () => {
          homeNavC.dispatchEvent({ type: 'click', bubbles: true, target: homeNavC });
          await flushMicrotasks();
        });
        const scanCardC = findNodes(containerC, n => n.textContent && n.textContent.includes("Today's QR Scans") && n.textContent.includes('789'))[0];
        assert.ok(containerC.textContent.includes('22,222') && Boolean(scanCardC) && !containerC.textContent.includes('11,111') && !containerC.textContent.includes('654'), 'Older loadData response must not overwrite newer all-time snapshot sales or scan count');

        await act(async () => {
          rootC.unmount();
          await flushMicrotasks();
        });

        // Test D: Original pending all-time poll started BEFORE filter switch still updates HomeView independently of later refetches
        const envD = createTestDom('?tab=analytics');
        applyDomGlobals(envD);
        envD.localStorageMock.setItem('touchqr_admin_slug', 'lifetime-filter');

        let resolvePendingPollAll;
        const pendingPollAllPromise = new Promise(r => { resolvePendingPollAll = r; });
        let initialAllTimeCalls = 0;

        globalThis.fetch = async (url) => {
          const u = String(url);
          if (u.includes('/api/admin/analytics?period=today')) {
            return jsonRes({
              selected_period: 'today',
              period_sales: 444,
              total_sales: 444,
              period_orders: 4,
              total_orders: 4,
              top_dishes: [],
              category_sales: [],
              daily_chart_data: [],
              last_updated: '2026-06-15T10:20:00Z'
            });
          }
          if (u.includes('/api/admin/analytics')) {
            initialAllTimeCalls += 1;
            if (initialAllTimeCalls === 1) {
              return jsonRes(await pendingPollAllPromise);
            }
            // Keep any subsequent all-time requests pending so only the pre-filter request can satisfy HomeView
            return new Promise(() => { });
          }
          if (u.includes('/api/info')) return jsonRes({ id: 4, name: 'Lifetime Filter', slug: 'lifetime-filter', plan_tier: 'pro', analytics_export_enabled: true });
          if (u.includes('/api/admin/subscription-status')) return jsonRes({ status: 'active', plan_tier: 'pro' });
          return jsonRes([]);
        };

        const containerD = envD.doc.createElement('div');
        envD.doc.body.appendChild(containerD);
        const rootD = createRoot(containerD);

        await act(async () => {
          rootD.render(React.createElement(AdminDashboard, { token: 'tok-dash-d', slug: 'lifetime-filter' }));
          await flushMicrotasks();
        });
        assert.equal(initialAllTimeCalls, 1, 'Original all-time request must start before switching filter');

        const selectD = findNodes(containerD, n => n.tagName === 'SELECT').find(s => findNodes(s, o => o.tagName === 'OPTION' && o.value === 'today').length > 0);
        await act(async () => {
          selectD.value = 'today';
          selectD.dispatchEvent({ type: 'change', bubbles: true, target: selectD });
          await flushMicrotasks();
        });
        assert.ok(containerD.textContent.includes('444'), 'Filtered Today payload renders');

        await act(async () => {
          resolvePendingPollAll({
            selected_period: 'all',
            period_sales: 33333,
            total_sales: 33333,
            today_sales: 33333,
            today_scans: 891,
            period_orders: 33,
            total_orders: 33,
            top_dishes: [],
            category_sales: [],
            daily_chart_data: [],
            last_updated: '2026-06-15T10:19:00Z'
          });
          await flushMicrotasks();
        });

        assert.ok(containerD.textContent.includes('444') && !containerD.textContent.includes('33,333'), 'AnalyticsView remains on Today filter');

        const homeNavD = findNodes(containerD, n => n.tagName === 'BUTTON' && n.textContent.includes('Home'))[0];
        await act(async () => {
          homeNavD.dispatchEvent({ type: 'click', bubbles: true, target: homeNavD });
          await flushMicrotasks();
        });
        const scanCardD = findNodes(containerD, n => n.textContent && n.textContent.includes("Today's QR Scans") && n.textContent.includes('891'))[0];
        assert.ok(containerD.textContent.includes('33,333') && Boolean(scanCardD), 'HomeView receives original pending all-time poll sales & scan metric despite earlier filter switch');

        await act(async () => {
          rootD.unmount();
          await flushMicrotasks();
        });
      } finally {
        for (const k of savedKeys) {
          if (prevGlobals[k] === undefined) delete globalThis[k];
          else globalThis[k] = prevGlobals[k];
        }
      }

      pass('AdminDashboard deferred-response behavior verified for rendered and saved analytics payloads');
    }

    // 9. VIP / complimentary analytics_export_enabled precedence over explicit false flags & expiry
    const vipBasicCaps = resolveTenantCapabilities(
      {
        plan_tier: 'basic',
        is_vip: true,
        analytics_export_enabled: false,
        permissions: { analytics_export_enabled: false }
      },
      { analytics_export_enabled: true },
      { analytics_export_enabled: false, permissions: { analytics_export_enabled: false } }
    );
    assert.equal(vipBasicCaps.analytics_export_enabled, true, 'VIP tenant must keep analytics_export_enabled=true despite explicit false flags');

    const compBasicCaps = resolveTenantCapabilities(
      {
        plan_tier: 'basic',
        is_complimentary: true,
        analytics_export_enabled: 0,
        permissions: { analytics_export_enabled: 0 }
      },
      {},
      { is_complimentary: true, analytics_export_enabled: false }
    );
    assert.equal(compBasicCaps.analytics_export_enabled, true, 'Complimentary tenant must keep analytics_export_enabled=true despite explicit false/0 flags');

    const expiredLegacyVipCaps = resolveTenantCapabilities(
      {
        plan_tier: 'vip',
        plan_price: 0,
        plan_expires_at: '2020-01-01T00:00:00Z',
        analytics_export_enabled: false
      },
      {},
      {}
    );
    assert.equal(expiredLegacyVipCaps.analytics_export_enabled, false, 'Expired legacy VIP grant must defer to plan export flag');

    const nonVipFalseCaps = resolveTenantCapabilities(
      {
        plan_tier: 'basic',
        is_vip: false,
        analytics_export_enabled: false,
        permissions: { analytics_export_enabled: false }
      },
      { analytics_export_enabled: false },
      { analytics_export_enabled: false }
    );
    assert.equal(nonVipFalseCaps.analytics_export_enabled, false, 'Non-VIP basic tenant with explicit false export flag must stay false');

    const subStatusFalseCaps = resolveTenantCapabilities(
      { plan_tier: 'basic', is_vip: false },
      {},
      { analytics_export_enabled: false }
    );
    assert.equal(subStatusFalseCaps.analytics_export_enabled, false, 'Non-VIP tenant with explicit false in subscriptionStatus must stay false');

    // Plan flag ('true') takes precedence over stale restaurant flag, matching /subscription-status & CSV/XLSX routes
    await query("UPDATE saas_plans SET analytics_export_enabled = 'true' WHERE LOWER(key) = 'basic'");
    const basicSubStatusRes = await fetch(`${baseUrl}/api/admin/subscription-status`, {
      headers: { Authorization: `Bearer ${basicToken}` }
    });
    const basicSubStatusBody = await basicSubStatusRes.json();
    const basicConflictCsv = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, { headers: { Authorization: `Bearer ${basicToken}` } });
    const basicConflictXlsx = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, { headers: { Authorization: `Bearer ${basicToken}` } });
    const conflictCaps = resolveTenantCapabilities(
      { plan_tier: 'basic', is_vip: false, analytics_export_enabled: false },
      {},
      basicSubStatusBody
    );
    assert.equal(basicSubStatusBody.permissions.analytics_export_enabled, true, '/subscription-status interprets string "true" as enabled');
    assert.equal(basicConflictCsv.status, 200);
    assert.equal(basicConflictXlsx.status, 200);
    assert.equal(conflictCaps.analytics_export_enabled, true, 'Dashboard capability matches CSV & XLSX routes when plan flag="true" conflicts with restaurant flag=false');
    await query("UPDATE saas_plans SET analytics_export_enabled = 0 WHERE LOWER(key) = 'basic'");
    pass('resolveTenantCapabilities grants VIP/complimentary export entitlement over explicit false flags while preserving non-VIP behavior');

    // 10. Additional targeted regressions (compaction identity/zero-qty, scan refs, plan NULL/VIP parity, QR normalization, >5000 hourly scans)
    {
      // 10a. Unnamed item re-compaction keeps missing-name identity distinct from 'Item', preserves quantity: 0 over qty/count
      const compRes = await query(`
        INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'pro', 999, 1, 2, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Compact Regression', `compact-reg-${ts}`]);
      const compId = compRes[0].id;
      const compToken = jwt.sign({ id: 205, restaurant_id: compId, username: 'c_admin', role: 'restaurant_admin' }, JWT_SECRET);

      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, items, created_at)
        VALUES ($1, 100, 'completed', 'cash', '1', $2, '2025-05-10T10:00:00Z')
      `, [compId, JSON.stringify([{ dish_id: null, name: '', price: 100, quantity: 1 }])]);
      await runAutoDataSummarization();

      let sumRows = await query(
        `SELECT items_summary FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = '2025-05-10'`,
        [compId]
      );
      assert.equal(sumRows.length, 1);
      let sumItems = JSON.parse(sumRows[0].items_summary);
      assert.equal(sumItems.length, 1);
      assert.equal(sumItems[0].name, null, 'Unnamed item must persist null missing-name identity in items_summary');

      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, items, created_at)
        VALUES ($1, 100, 'completed', 'cash', '1', $2, '2025-05-10T11:00:00Z')
      `, [compId, JSON.stringify([{ dish_id: null, name: 'Item', price: 50, quantity: 2 }])]);
      await runAutoDataSummarization();

      sumRows = await query(
        `SELECT items_summary FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = '2025-05-10'`,
        [compId]
      );
      sumItems = JSON.parse(sumRows[0].items_summary);
      assert.equal(sumItems.length, 2, 'Unnamed items and literal "Item" products must remain distinct across re-compactions');
      assert.ok(sumItems.some(i => i.name === null && i.quantity === 1), 'Missing-name bucket retains quantity=1');
      assert.ok(sumItems.some(i => i.name === 'Item' && i.quantity === 2), 'Literal "Item" bucket retains quantity=2');

      sumItems.push({ dish_id: null, name: 'Zeroed', quantity: 0, qty: 2, count: 5, revenue: 0 });
      await query(
        `UPDATE daily_sales_summaries SET items_summary = $1 WHERE restaurant_id = $2 AND summary_date = '2025-05-10'`,
        [JSON.stringify(sumItems), compId]
      );
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, items, created_at)
        VALUES ($1, 25, 'completed', 'cash', '1', $2, '2025-05-10T12:00:00Z')
      `, [compId, JSON.stringify([{ dish_id: null, name: 'Fresh', price: 25, quantity: 1 }])]);
      await runAutoDataSummarization();

      sumRows = await query(
        `SELECT items_summary FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = '2025-05-10'`,
        [compId]
      );
      sumItems = JSON.parse(sumRows[0].items_summary);
      const zeroEntry = sumItems.find(i => i.name === 'Zeroed');
      assert.ok(zeroEntry, 'Zero-quantity archived item preserved');
      assert.equal(zeroEntry.quantity, 0, 'Explicit quantity: 0 must take precedence over qty: 2 / count: 5');

      const compAnalyticsRes = await fetch(`${baseUrl}/api/admin/analytics?period=all`, {
        headers: { Authorization: `Bearer ${compToken}` }
      });
      assert.equal(compAnalyticsRes.status, 200);
      const compAnalytics = await compAnalyticsRes.json();
      assert.ok(compAnalytics.top_dishes.some(d => d.name === 'Item'), 'Display report maps missing-name fallback cleanly to "Item"');
      pass('Compaction preserves missing-name identity and explicit zero quantity across re-compactions');

      // 10b. scanCompactDishRefsFromJson ignores non-array object wrappers and extracts dish_name
      const wrapperRefs = new Map();
      scanCompactDishRefsFromJson('{"items":[{"dish_id":99,"name":"Ignored Wrapper"}]}', (id, nm) => {
        if (id != null) wrapperRefs.set(String(id), nm);
      });
      assert.equal(wrapperRefs.size, 0, 'scanCompactDishRefsFromJson ignores object wrappers');
      const arrayRefs = new Map();
      scanCompactDishRefsFromJson('[{"dish_id":7,"dish_name":"Paneer Tikka"}]', (id, nm) => {
        if (id != null) arrayRefs.set(String(id), nm);
      });
      assert.equal(arrayRefs.get('7'), 'Paneer Tikka', 'scanCompactDishRefsFromJson extracts dish_name from array JSON');

      // Parity: object array vs JSON-string must produce identical combo references even when is_combo / isCombo disagree
      const mixedComboItems = [
        { dish_id: 7, is_combo: true, isCombo: false, name: 'Family Combo' },
        { dish_id: 8, isCombo: true, is_combo: false, name: 'Duo Combo' }
      ];
      const objComboRefs = [];
      scanCompactDishRefsFromJson(mixedComboItems, (id, nm) => objComboRefs.push([id, nm]));
      const strComboRefs = [];
      scanCompactDishRefsFromJson(JSON.stringify(mixedComboItems), (id, nm) => strComboRefs.push([id, nm]));
      assert.deepEqual(
        strComboRefs,
        objComboRefs,
        'JSON-string scan must match object-array scan when is_combo and isCombo differ'
      );
      assert.deepEqual(strComboRefs, [
        ['combo:7', 'Family Combo'],
        ['combo:8', 'Duo Combo']
      ], 'Earlier true combo flag must not be overridden by later false flag');
      pass('scanCompactDishRefsFromJson ignores object wrappers and reads dish_name');

      // 10c. /subscription-status & export routes treat NULL analytics_export_enabled as enabled and honor complimentary flag
      await query("UPDATE saas_plans SET analytics_export_enabled = NULL WHERE LOWER(key) = 'basic'");
      const nullFlagSubRes = await fetch(`${baseUrl}/api/admin/subscription-status`, {
        headers: { Authorization: `Bearer ${basicToken}` }
      });
      const nullFlagSub = await nullFlagSubRes.json();
      assert.equal(nullFlagSub.permissions.analytics_export_enabled, true, 'NULL analytics_export_enabled on existing plan defaults to true');
      const nullFlagCsv = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, {
        headers: { Authorization: `Bearer ${basicToken}` }
      });
      assert.equal(nullFlagCsv.status, 200, 'CSV export allowed when plan analytics_export_enabled is NULL');
      await query("UPDATE saas_plans SET analytics_export_enabled = 0 WHERE LOWER(key) = 'basic'");

      const vipCompIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, subscription_type, mandate_status, active, total_tables, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'basic', 499, 'COMPLIMENTARY', 'complimentary', 1, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['VIP Basic Bistro', `vip-basic-${ts}`]);
      const vipCompToken = jwt.sign({ id: 206, restaurant_id: vipCompIns[0].id, username: 'v_admin', role: 'restaurant_admin' }, JWT_SECRET);
      const vipSubRes = await fetch(`${baseUrl}/api/admin/subscription-status`, {
        headers: { Authorization: `Bearer ${vipCompToken}` }
      });
      const vipSub = await vipSubRes.json();
      assert.equal(vipSub.permissions.analytics_export_enabled, true, 'Complimentary VIP restaurant gets analytics_export_enabled=true on /subscription-status');
      pass('/subscription-status and export routes agree on NULL plan flag and complimentary VIP override');

      // 10d. QR normalization & raw original spaceNumber HMAC fallback verification
      assert.equal(normalizeSpaceNumber('Seat #05'), '5', 'Seat #05 normalizes to 5');
      assert.equal(normalizeSpaceNumber('Seattle'), 'Seattle', 'Seattle stays intact');
      const qrSecret = generateRestaurantQrSecret();
      const seatSlug = `cinema-${ts}`;
      const canonicalToken = generateHmacQrToken(seatSlug, 'Seat', '005', qrSecret);
      const rawPaddedHmacToken = crypto.createHmac('sha256', qrSecret).update(`${seatSlug}:cinema_seat:005`, 'utf8').digest('hex');
      const prevNormHmacToken = crypto.createHmac('sha256', qrSecret).update(`${seatSlug}:cinema_seat:#05`, 'utf8').digest('hex');
      const otherSeatHmacToken = generateHmacQrToken(seatSlug, 'Seat', '006', qrSecret);
      const legacyHexToken = 'deadbeef';
      const verifiedCanonical = verifyQrToken(seatSlug, 'seat', normalizeSpaceNumber('Seat #005'), qrSecret, canonicalToken, { requireHmac: true, rawSpaceNumber: '005' });
      const verifiedWithRaw = verifyQrToken(seatSlug, 'seat', normalizeSpaceNumber('Seat #005'), qrSecret, rawPaddedHmacToken, { requireHmac: true, rawSpaceNumber: '005' });
      const verifiedWithPrevNorm = verifyQrToken(seatSlug, 'seat', normalizeSpaceNumber('Seat #05'), qrSecret, prevNormHmacToken, { requireHmac: true, rawSpaceNumber: 'Seat #05' });
      const rejectedOtherSeat = verifyQrToken(seatSlug, 'seat', normalizeSpaceNumber('Seat #05'), qrSecret, otherSeatHmacToken, { requireHmac: true, rawSpaceNumber: 'Seat #05' });
      const rejectedLegacyHmac = verifyQrToken(seatSlug, 'seat', normalizeSpaceNumber('Seat #05'), qrSecret, legacyHexToken, { requireHmac: true, rawSpaceNumber: 'Seat #05' });
      assert.equal(verifiedCanonical.valid, true, 'Canonical HMAC token verifies cleanly');
      assert.equal(verifiedWithRaw.valid, true, 'HMAC token signed for padded raw 005 verifies alongside canonical 5');
      assert.equal(verifiedWithPrevNorm.valid, true, 'Older HMAC signed for previously normalized #05 verifies under Seat #05');
      assert.equal(rejectedOtherSeat.valid, false, 'HMAC token for Seat #06 must be rejected for Seat #05');
      assert.equal(rejectedLegacyHmac.valid, false, 'Non-HMAC legacy token must be rejected when requireHmac=true');
      pass('normalizeSpaceNumber handles Seat #05/Seattle and verifyQrToken validates raw & previous normalized HMAC tokens');

      // 10e. >5000 scan events use fixed frozen reference day and do not truncate hourlyScansToday or weeklyScans
      const scanHiIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'pro', 999, 1, 2, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['High Scan Lounge', `hi-scan-${ts}`]);
      const scanHiId = scanHiIns[0].id;
      const scanHiToken = jwt.sign({ id: 207, restaurant_id: scanHiId, username: 's_admin', role: 'restaurant_admin' }, JWT_SECRET);
      const fixedScanTimestamp = '2026-08-18 12:00:00';
      const origScanDateNow = Date.now;
      Date.now = () => Date.parse('2026-08-18T12:00:00.000Z');
      try {
        const totalInsertedScans = 5050;
        for (let offset = 0; offset < totalInsertedScans; offset += 500) {
          const chunkSize = Math.min(500, totalInsertedScans - offset);
          const placeholders = Array.from({ length: chunkSize }, (_, idx) => {
            const base = idx * 2;
            return `($${base + 1}, 'table', '1', $${base + 2})`;
          }).join(', ');
          const params = [];
          for (let idx = 0; idx < chunkSize; idx++) {
            params.push(scanHiId, fixedScanTimestamp);
          }
          await query(`INSERT INTO qr_scan_events (restaurant_id, space_type, table_number, created_at) VALUES ${placeholders}`, params);
        }
        const hiScanRes = await fetch(`${baseUrl}/api/admin/analytics?period=today`, {
          headers: { Authorization: `Bearer ${scanHiToken}` }
        });
        assert.equal(hiScanRes.status, 200);
        const hiScanBody = await hiScanRes.json();
        const hourlySum = (hiScanBody.hourly_scans_today || []).reduce((acc, h) => acc + Number(h.count || 0), 0);
        assert.equal(hiScanBody.today_scans, totalInsertedScans, 'today_scans includes all 5050 events');
        assert.equal(hiScanBody.weekly_scans, totalInsertedScans, 'weekly_scans includes all 5050 events without 5000-row cap');
        assert.equal(hourlySum, totalInsertedScans, 'hourly_scans_today sum matches today_scans without 5000-row cap');
      } finally {
        Date.now = origScanDateNow;
      }
      pass('hourly_scans_today and weekly_scans match today_scans beyond 5000 scan events under fixed clock');

      // 10f. Combo vs Dish ID separation, missing-name backfill in rollup merges, XLSX historical detail lookup, subscription-row VIP export, and +00 offset
      assert.equal(getFormattedLocalDate(parseSafeDate('2026-08-31 20:00:00+00')), '2026-09-01', 'parseSafeDate normalizes hour-only +00 offset to September 1 IST');

      const comboTestIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'pro', 999, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Combo Audit Cafe', `combo-audit-${ts}`]);
      const comboRestoId = comboTestIns[0].id;
      const comboRestoToken = jwt.sign({ id: 215, restaurant_id: comboRestoId, username: 'combo_admin', role: 'restaurant_admin' }, JWT_SECRET);

      // Dish #5 vs Combo #5 + unnamed item sharing dish_id=88 merged with named item + historical summary item with null name & unknown item
      await query(`INSERT INTO dishes (id, restaurant_id, name, price) VALUES (9005, $1, 'Solo Paneer Curry', 200), (9088, $1, 'Masala Papad', 60)`, [comboRestoId]);
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, customer_name, items, created_at)
        VALUES
          ($1, 200, 'completed', 'cash', '1', 'Live Dish', '[{"dish_id":9005,"name":"Solo Paneer Curry","price":200,"quantity":1}]', CURRENT_TIMESTAMP),
          ($1, 350, 'completed', 'upi', '2', 'Live Combo', '[{"dish_id":9005,"type":"combo","name":"Family Thali Combo","price":350,"quantity":1}]', CURRENT_TIMESTAMP)
      `, [comboRestoId]);
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, items, created_at)
        VALUES
          ($1, 60, 'completed', 'cash', '3', $2, '2025-05-12T10:00:00Z'),
          ($1, 60, 'completed', 'cash', '3', $3, '2025-05-12T11:00:00Z'),
          ($1, 90, 'completed', 'cash', '4', $4, '2025-05-13T10:00:00Z')
      `, [
        comboRestoId,
        JSON.stringify([{ dish_id: 9088, name: '', price: 60, quantity: 1 }]),
        JSON.stringify([{ dish_id: 9088, name: 'Masala Papad', price: 60, quantity: 1 }]),
        JSON.stringify([{ dish_id: null, name: '', price: 90, quantity: 1 }])
      ]);
      await runAutoDataSummarization();

      const mergedNameRow = await query(
        `SELECT items_summary FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = '2025-05-12'`,
        [comboRestoId]
      );
      const mergedNameItems = JSON.parse(mergedNameRow[0].items_summary);
      assert.equal(mergedNameItems.length, 1);
      assert.equal(mergedNameItems[0].name, 'Masala Papad', 'Rollup fills missing dish name from incoming named item');

      const comboXlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, {
        headers: { Authorization: `Bearer ${comboRestoToken}` }
      });
      assert.equal(comboXlsxRes.status, 200);
      const comboWb = new ExcelJS.Workbook();
      await comboWb.xlsx.load(Buffer.from(await comboXlsxRes.arrayBuffer()));
      const itemSalesSheet = comboWb.getWorksheet('Item Sales');
      const dish5Rows = [];
      const combo5Rows = [];
      itemSalesSheet.eachRow((row, idx) => {
        if (idx <= 5) return;
        const dIdVal = String(row.getCell(2).value || '');
        const dNameVal = String(row.getCell(3).value || '');
        if (dIdVal === '9005') dish5Rows.push(dNameVal);
        if (dIdVal === 'combo:9005') combo5Rows.push(dNameVal);
      });
      assert.deepEqual(dish5Rows, ['Solo Paneer Curry'], 'Catalog dish 9005 keeps solo sales and dish name');
      assert.deepEqual(combo5Rows, ['Family Thali Combo'], 'Combo sharing numeric ID 9005 stays separate with combo identity and name');

      const salesSheet = comboWb.getWorksheet('Sales Report');
      let foundResolvedArchiveDetail = false;
      let foundItemFallbackDetail = false;
      salesSheet.eachRow((row) => {
        const recType = String(row.getCell(1).value || '');
        const dt = String(row.getCell(3).value || '');
        const detail = String(row.getCell(10).value || '');
        if (recType === 'DAILY_ROLLUP' && dt === '2025-05-12' && detail.includes('Masala Papad (x2)')) foundResolvedArchiveDetail = true;
        if (recType === 'DAILY_ROLLUP' && dt === '2025-05-13' && detail.includes('Item (x1)')) foundItemFallbackDetail = true;
      });
      assert.ok(foundResolvedArchiveDetail && foundItemFallbackDetail, 'Historical summary items_detail resolves stored/catalog names and falls back to "Item" without printing "null"');

      // Subscription-row complimentary grant grants export across /subscription-status, CSV, and XLSX despite basic plan analytics_export_enabled=0
      const subVipRestoIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, total_tables, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'basic', 499, 1, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Sub Row VIP', `sub-row-vip-${ts}`]);
      const subVipId = subVipRestoIns[0].id;
      await query(`
        INSERT INTO subscriptions (restaurant_id, gateway, subscription_type, status, current_period_end)
        VALUES ($1, 'admin_granted', 'ADMIN_GRANTED', 'active', '2030-01-01T00:00:00Z')
      `, [subVipId]);
      const subVipToken = jwt.sign({ id: 216, restaurant_id: subVipId, username: 'sv_admin', role: 'restaurant_admin' }, JWT_SECRET);
      const svStatusRes = await fetch(`${baseUrl}/api/admin/subscription-status`, { headers: { Authorization: `Bearer ${subVipToken}` } });
      const svCsvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv?period=all`, { headers: { Authorization: `Bearer ${subVipToken}` } });
      const svXlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx?period=all`, { headers: { Authorization: `Bearer ${subVipToken}` } });
      const svStatusBody = await svStatusRes.json();
      assert.equal(svStatusBody.permissions.analytics_export_enabled, true);
      assert.equal(svCsvRes.status, 200, 'CSV export agrees with subscription-row complimentary VIP grant');
      assert.equal(svXlsxRes.status, 200, 'XLSX export agrees with subscription-row complimentary VIP grant');
      pass('Combo vs dish IDs, rollup name backfill, historical detail names, +00 offset, and subscription-row VIP export parity verified');

      // 10g. Concurrent global + tenant compaction must not double-count, and PG compaction retry preserves exact item quantities
      const concIns = await query(`
        INSERT INTO restaurants (name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at)
        VALUES ($1, $2, 'restaurant', 'pro', 999, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z') RETURNING id
      `, ['Concurrent Compact Cafe', `conc-compact-${ts}`]);
      const concId = concIns[0].id;
      await query(`
        INSERT INTO orders (restaurant_id, total_amount, status, payment_method, table_number, items, created_at)
        VALUES ($1, 240, 'completed', 'upi', '1', $2, '2025-04-10T10:00:00Z')
      `, [concId, JSON.stringify([{ dish_id: 501, name: 'Idli Plate', price: 120, quantity: 2 }])]);

      await Promise.all([
        runAutoDataSummarization(30, null),
        runAutoDataSummarization(30, concId)
      ]);

      const concSummaries = await query(
        `SELECT total_sales, total_orders, items_summary FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = '2025-04-10'`,
        [concId]
      );
      assert.equal(concSummaries.length, 1);
      assert.equal(Number(concSummaries[0].total_sales), 240, 'Concurrent global & tenant compaction must not double-count total_sales');
      assert.equal(Number(concSummaries[0].total_orders), 1, 'Concurrent global & tenant compaction must not double-count total_orders');
      const concItems = JSON.parse(concSummaries[0].items_summary);
      assert.equal(concItems.length, 1);
      assert.equal(concItems[0].quantity, 2);

      // Simulate PG 40001 retry during runAutoDataSummarization when merging an existing daily summary
      let pgCompactAttempt = 0;
      let capturedUpsertItemsJson = null;
      const runPgCompactQuery = async (sql, params = []) => {
        const s = String(sql).trim();
        if (/^BEGIN|^COMMIT|^ROLLBACK|pg_advisory_xact_lock/i.test(s)) return { rows: [{ ok: 1 }] };
        if (s.startsWith('SELECT * FROM orders WHERE restaurant_id')) {
          return {
            rows: [{
              id: 8801,
              restaurant_id: concId,
              total_amount: 100,
              status: 'completed',
              payment_method: 'cash',
              created_at: '2025-04-10T11:00:00Z',
              items: JSON.stringify([{ dish_id: 501, name: 'Idli Plate', price: 50, quantity: 2 }])
            }]
          };
        }
        if (s.startsWith('DELETE FROM orders WHERE id')) return { rows: [{ id: 8801 }] };
        if (s.includes('FROM daily_sales_summaries')) {
          return {
            rows: [{
              restaurant_id: concId,
              summary_date: '2025-04-10',
              total_sales: 240,
              total_orders: 1,
              items_summary: JSON.stringify([{ dish_id: 501, name: 'Idli Plate', quantity: 2, revenue: 240 }]),
              payment_methods_summary: JSON.stringify({ upi: 240, cash: 0, card: 0, other: 0 })
            }]
          };
        }
        if (s.startsWith('INSERT INTO daily_sales_summaries')) {
          pgCompactAttempt += 1;
          if (pgCompactAttempt === 1) {
            const err = new Error('could not serialize access due to concurrent update');
            err.code = '40001';
            throw err;
          }
          capturedUpsertItemsJson = params[5];
          return { rows: [] };
        }
        return { rows: [] };
      };
      const prevNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      const restoreCompactPg = configurePgPoolForTesting({
        query: runPgCompactQuery,
        connect: async () => ({ query: runPgCompactQuery, release: () => { } })
      }, 'postgres');
      try {
        await runAutoDataSummarization(30, concId);
      } finally {
        restoreCompactPg();
        if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = prevNodeEnv;
      }
      assert.equal(pgCompactAttempt, 2, 'Compaction retried after 40001 conflict');
      const retriedItems = JSON.parse(capturedUpsertItemsJson || '[]');
      assert.equal(retriedItems.length, 1);
      assert.equal(retriedItems[0].quantity, 4, 'PG transaction retry must not double-accumulate item quantity from summary.itemsMap');
      assert.equal(retriedItems[0].revenue, 340, 'PG transaction retry must preserve exact merged revenue');
      pass('Concurrent compaction isolation and retry-safe deep item cloning verified');
    }

    console.log(`\nAll ${passed} Analytics Page audit tests passed.`);
  } catch (err) {
    console.error('Analytics Page audit test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (typeof closeDbPool === 'function') await closeDbPool();
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch { }
    if (compiledDir) {
      try { fs.rmSync(compiledDir, { recursive: true, force: true }); } catch { }
    }
    process.exit(process.exitCode || 0);
  }
})();
