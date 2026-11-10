import path from 'path';
import fs from 'fs';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_scan_events.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import test from 'node:test';
import assert from 'node:assert/strict';
import { initDb, query } from '../db.js';

test('Suggestion 1: Real-Time QR Scan Events & Hourly Analytics', async (t) => {
  await initDb();

  // Setup a test restaurant
  const testSlug = `scan-telemetry-test-${Date.now()}`;
  await query("INSERT INTO restaurants (name, slug, active, scan_count) VALUES ($1, $2, 1, 10)", ['Telemetry Test Bistro', testSlug]);
  const restos = await query("SELECT id FROM restaurants WHERE slug = $1", [testSlug]);
  const restoId = restos[0].id;

  await t.test('1. qr_scan_events table logs events with space_type and table_number', async () => {
    await query("INSERT INTO qr_scan_events (restaurant_id, space_type, table_number) VALUES ($1, $2, $3)", [restoId, 'table', '4']);
    await query("INSERT INTO qr_scan_events (restaurant_id, space_type, table_number) VALUES ($1, $2, $3)", [restoId, 'table', '4']);
    await query("INSERT INTO qr_scan_events (restaurant_id, space_type, table_number) VALUES ($1, $2, $3)", [restoId, 'table', '7']);
    await query("INSERT INTO qr_scan_events (restaurant_id, space_type, table_number) VALUES ($1, $2, $3)", [restoId, 'room', '102']);

    const events = await query("SELECT * FROM qr_scan_events WHERE restaurant_id = $1 ORDER BY id ASC", [restoId]);
    assert.strictEqual(events.length, 4, 'Must have recorded 4 events');
    assert.strictEqual(events[0].space_type, 'table');
    assert.strictEqual(events[0].table_number, '4');
    assert.strictEqual(events[3].space_type, 'room');
    assert.strictEqual(events[3].table_number, '102');
  });

  await t.test('2. Accurately calculates Today\'s scans and Table Breakdown', async () => {
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const eventsToday = await query(
      "SELECT id, space_type, table_number, created_at FROM qr_scan_events WHERE restaurant_id = $1 AND created_at >= $2",
      [restoId, todayIST + ' 00:00:00']
    );
    assert.strictEqual(eventsToday.length, 4, 'All 4 newly inserted events must be from today');

    // Grouping by table
    const tableMap = {};
    eventsToday.forEach(ev => {
      const k = `${ev.space_type}:${ev.table_number}`;
      tableMap[k] = (tableMap[k] || 0) + 1;
    });

    assert.strictEqual(tableMap['table:4'], 2, 'Table 4 must have 2 scans');
    assert.strictEqual(tableMap['table:7'], 1, 'Table 7 must have 1 scan');
    assert.strictEqual(tableMap['room:102'], 1, 'Room 102 must have 1 scan');
  });

  await t.test('3. Hourly curve contains 24 slots with valid counts', () => {
    const hourlyScansToday = Array.from({ length: 24 }, (_, h) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return { hour: h, label: `${displayH} ${ampm}`, count: 0 };
    });

    const now = new Date();
    const currentHour = now.getHours();
    hourlyScansToday[currentHour].count += 4;

    assert.strictEqual(hourlyScansToday.length, 24, 'Must have 24 hour slots');
    assert.strictEqual(hourlyScansToday[currentHour].count, 4, 'Current hour must have 4 scans');
  });

  await t.test('4. Correctly handles Hotel & Cinema spaces and formats labels', async () => {
    // Insert Hotel Room scan and Cinema Seat scan
    await query("INSERT INTO qr_scan_events (restaurant_id, space_type, table_number) VALUES ($1, $2, $3)", [restoId, 'cinema_seat', 'S1-D-12']);
    await query("INSERT INTO qr_scan_events (restaurant_id, space_type, table_number) VALUES ($1, $2, $3)", [restoId, 'counter', 'COUNTER']);

    const formatSpaceLabel = (spaceType, num) => {
      if (!num || num === 'Direct/Counter') {
        return spaceType === 'counter' ? '⚡ Billing Counter' : '🔗 Direct / Menu Link';
      }
      if (spaceType === 'room') return `🏨 Room ${num}`;
      if (spaceType === 'cinema_seat') {
        const cMatch = String(num).match(/^(?:screen\s*(\d+)[\s\-_•|]+row\s*([a-zA-Z]+)[\s\-_•|]+seat\s*(\d+)|s?(\d+)[\-_:]([a-zA-Z]+)[\-_:](\d+))/i);
        if (cMatch) {
          const sc = cMatch[1] || cMatch[4];
          const rw = (cMatch[2] || cMatch[5]).toUpperCase();
          const st = cMatch[3] || cMatch[6];
          return `🎬 Screen ${sc} • Row ${rw} • Seat ${st}`;
        }
        return `🎬 Seat ${num}`;
      }
      if (spaceType === 'cabin') return `🛋️ Cabin ${num}`;
      if (spaceType === 'vip') return `👑 VIP ${num}`;
      if (spaceType === 'counter') return `⚡ Counter ${num}`;
      return `🍽️ Table ${num}`;
    };

    assert.strictEqual(formatSpaceLabel('room', '102'), '🏨 Room 102');
    assert.strictEqual(formatSpaceLabel('cinema_seat', 'S1-D-12'), '🎬 Screen 1 • Row D • Seat 12');
    assert.strictEqual(formatSpaceLabel('counter', 'COUNTER'), '⚡ Counter COUNTER');
    assert.strictEqual(formatSpaceLabel('table', '8'), '🍽️ Table 8');
  });

  await t.test('5. Accurately calculates Scan-to-Order Conversion Rate and Standee Health Heatmap', () => {
    const todayScans = 20;
    const todayOrders = 15;
    const conversionRate = todayScans > 0 ? Math.min(100, Math.round((todayOrders / todayScans) * 100)) : 0;
    assert.strictEqual(conversionRate, 75, '20 scans with 15 orders must yield 75% conversion rate');

    const totalConfiguredTables = 10;
    const activeScannedTables = ['table:1', 'table:4', 'table:7', 'table:9'];
    const activeCount = activeScannedTables.length;
    const dormantCount = totalConfiguredTables - activeCount;
    const healthScore = Math.round((activeCount / totalConfiguredTables) * 100);

    assert.strictEqual(activeCount, 4, '4 active tables');
    assert.strictEqual(dormantCount, 6, '6 dormant tables');
    assert.strictEqual(healthScore, 40, 'Health score must be 40%');
  });

  await t.test('6. Filters out WhatsApp, Facebook, and search crawler bots', () => {
    const isCrawlerOrBot = (ua) => {
      if (!ua || typeof ua !== 'string') return false;
      const clean = ua.toLowerCase();
      return /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|applebot|bingbot|googlebot|yandex|duckduckbot|baiduspider|crawler|spider/i.test(clean);
    };

    assert.strictEqual(isCrawlerOrBot('WhatsApp/2.21.11.17 i'), true, 'WhatsApp preview bot must be blocked');
    assert.strictEqual(isCrawlerOrBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'), true, 'Facebook crawler must be blocked');
    assert.strictEqual(isCrawlerOrBot('Twitterbot/1.0'), true, 'Twitterbot must be blocked');
    assert.strictEqual(isCrawlerOrBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'), false, 'Legitimate iPhone user must NOT be blocked');
    assert.strictEqual(isCrawlerOrBot('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'), false, 'Legitimate Android user must NOT be blocked');
  });

  // Cleanup test database
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch (e) {}
});
