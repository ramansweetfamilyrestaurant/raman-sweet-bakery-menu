/**
 * TouchQR — Multi-Industry Vertical Locking & Plans Architecture Test Suite
 *
 * Verifies:
 * 1. Database seed contains all 9 industry plans (restaurant, hotel, cinema) with correct capacities.
 * 2. System plans across all industries are protected from deletion.
 * 3. SuperAdmin API allows updating tenant business_type and capacity quotas (tables, rooms, screens, seats).
 * 4. Tenant Admin API rejects attempts to change business_type with 403 Forbidden (locked).
 * 5. Tenant Admin API safely accepts legitimate settings updates while preserving locked industry.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import superadminRoutes from '../routes/superadmin.js';
import adminRoutes from '../routes/admin.js';
import paymentRoutes from '../routes/payment.js';
import { JWT_SECRET } from '../config/jwt.js';

const TEST_DB_PATH = path.resolve('menu_test_multi_industry.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('🏨  TOUCHQR MULTI-INDUSTRY PLANS & VERTICAL LOCKING REGRESSION SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
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

async function runSuite() {
  if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
    const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
    if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  await initDb();

  // Create superadmin token
  const saRows = await query("SELECT id, username FROM admins WHERE role = 'superadmin' LIMIT 1");
  const superAdminId = saRows[0]?.id || 1;
  const superAdminToken = jwt.sign(
    { id: superAdminId, username: 'superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Set up Express app mounting both superadmin and admin routes
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin', superadminRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/payment', paymentRoutes);

  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const port = server.address().port;
  const saBaseUrl = `http://127.0.0.1:${port}/api/superadmin`;
  const adminBaseUrl = `http://127.0.0.1:${port}/api/admin`;
  const paymentBaseUrl = `http://127.0.0.1:${port}/api/payment`;

  try {
    // Clean test fixture records if leftover
    await query("DELETE FROM subscriptions WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug IN ('grand-palace', 'corner-cafe', 'cine-star'))").catch(() => {});
    await query("DELETE FROM admins WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug IN ('grand-palace', 'corner-cafe', 'cine-star'))").catch(() => {});
    await query("DELETE FROM restaurants WHERE slug IN ('grand-palace', 'corner-cafe', 'cine-star')").catch(() => {});
    // -----------------------------------------------------------------------------------------------------
    await test('1. saas_plans catalog seeds 9 plans across restaurant, hotel, cinema with correct capacities', async () => {
      const plans = await query('SELECT key, name, price, industry, max_tables, max_rooms, max_screens, max_seats FROM saas_plans');
      assert(plans.length >= 9, `Expected at least 9 plans, found ${plans.length}`);

      const planMap = new Map(plans.map(p => [p.key.toLowerCase(), p]));

      // Restaurant
      assert(planMap.has('basic'), 'basic plan missing');
      assert(planMap.has('pro'), 'pro plan missing');
      assert(planMap.has('enterprise'), 'enterprise plan missing');
      assert.strictEqual(planMap.get('basic').industry, 'restaurant');

      // Hotel
      assert(planMap.has('hotel_basic'), 'hotel_basic missing');
      assert(planMap.has('hotel_pro'), 'hotel_pro missing');
      assert(planMap.has('hotel_enterprise'), 'hotel_enterprise missing');
      assert.strictEqual(planMap.get('hotel_basic').industry, 'hotel');
      assert.strictEqual(Number(planMap.get('hotel_basic').max_rooms), 20);
      assert.strictEqual(Number(planMap.get('hotel_pro').max_rooms), 60);

      // Cinema
      assert(planMap.has('cinema_basic'), 'cinema_basic missing');
      assert(planMap.has('cinema_pro'), 'cinema_pro missing');
      assert(planMap.has('cinema_enterprise'), 'cinema_enterprise missing');
      assert.strictEqual(planMap.get('cinema_basic').industry, 'cinema');
      assert.strictEqual(Number(planMap.get('cinema_basic').max_screens), 1);
      assert.strictEqual(Number(planMap.get('cinema_basic').max_seats), 200);
      assert.strictEqual(Number(planMap.get('cinema_pro').max_screens), 3);
      assert.strictEqual(Number(planMap.get('cinema_pro').max_seats), 800);
    });

    // -----------------------------------------------------------------------------------------------------
    await test('2. System plans across all 3 verticals are strictly protected from deletion in SuperAdmin API', async () => {
      const keysToTest = ['basic', 'hotel_pro', 'cinema_enterprise'];
      for (const key of keysToTest) {
        const res = await fetch(`${saBaseUrl}/plans/${key}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(res.status, 400, `Expected 400 when deleting system plan ${key}, got ${res.status}`);
        const data = await res.json();
        assert(data.error && data.error.includes('Standard system plans cannot be deleted'), `Unexpected error body: ${JSON.stringify(data)}`);
      }
    });

    // -----------------------------------------------------------------------------------------------------
    await test('3. SuperAdmin can update tenant business_type and capacity fields (tables, rooms, screens, seats)', async () => {
      // Create a test restaurant
      const insertResto = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, total_tables, total_rooms, total_screens, total_seats)
        VALUES ('Grand Palace', 'grand-palace', 'restaurant', 'dine_in', 10, 0, 0, 0)
        RETURNING id
      `);
      const restoId = insertResto[0].id;

      // SuperAdmin updates it to a Hotel with 45 rooms
      const updateRes = await fetch(`${saBaseUrl}/restaurants/${restoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          business_type: 'hotel_resort',
          total_rooms: 45,
          total_tables: 15
        })
      });
      assert.strictEqual(updateRes.status, 200, `Expected 200 from superadmin update, got ${updateRes.status}`);

      const rows = await query('SELECT business_type, service_model, total_rooms, total_tables FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(rows[0].business_type, 'hotel_resort');
      assert.strictEqual(rows[0].service_model, 'hotel');
      assert.strictEqual(Number(rows[0].total_rooms), 45);
      assert.strictEqual(Number(rows[0].total_tables), 15);
    });

    // -----------------------------------------------------------------------------------------------------
    await test('4. Tenant Admin CANNOT alter business_type via /api/admin/settings (rejected with 403)', async () => {
      // Create a regular tenant restaurant with active subscription and admin
      const insertResto = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, total_tables, plan_tier)
        VALUES ('Corner Cafe', 'corner-cafe', 'cafe', 'dine_in', 8, 'pro')
        RETURNING id
      `);
      const restoId = insertResto[0].id;

      await query(`
        INSERT INTO subscriptions (restaurant_id, status, current_period_end)
        VALUES ($1, 'active', '2030-01-01 00:00:00')
      `, [restoId]);
      await query(`
        UPDATE restaurants 
        SET plan_tier = 'pro', 
            subscription_type = 'COMPLIMENTARY', 
            plan_expires_at = '2030-01-01T00:00:00.000Z' 
        WHERE id = $1
      `, [restoId]);

      const tenantToken = jwt.sign(
        { id: 9999, username: 'corner_admin', role: 'restaurant_admin', restaurant_id: restoId },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      // Attempt to tamper/switch to cinema_theatre
      const tamperRes = await fetch(`${adminBaseUrl}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({
          business_type: 'cinema_theatre'
        })
      });

      assert.strictEqual(tamperRes.status, 403, `Expected 403 Forbidden for tenant tampering business_type, got ${tamperRes.status}`);
      const tamperBody = await tamperRes.json();
      assert.strictEqual(tamperBody.error, 'business_type_locked');

      // Verify DB unchanged
      const rows = await query('SELECT business_type, service_model FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(rows[0].business_type, 'cafe');
      assert.strictEqual(rows[0].service_model, 'dine_in');
    });

    // -----------------------------------------------------------------------------------------------------
    await test('5. Tenant Admin can safely update legitimate settings while preserving locked industry', async () => {
      const restoRows = await query("SELECT id FROM restaurants WHERE slug = 'corner-cafe'");
      const restoId = restoRows[0].id;

      const tenantToken = jwt.sign(
        { id: 9999, username: 'corner_admin', role: 'restaurant_admin', restaurant_id: restoId },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      // Legitimate update: phone, tagline, address (and sending current business_type or omitting it)
      const updateRes = await fetch(`${adminBaseUrl}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({
          tagline: 'Best Artisan Coffee in Town',
          phone: '9876543210',
          business_type: 'cafe' // sending current matching type
        })
      });

      assert.strictEqual(updateRes.status, 200, `Expected 200 for legitimate settings update, got ${updateRes.status}`);

      const rows = await query('SELECT tagline, phone, business_type, service_model FROM restaurants WHERE id = $1', [restoId]);
      assert.strictEqual(rows[0].tagline, 'Best Artisan Coffee in Town');
      assert.strictEqual(rows[0].phone, '9876543210');
      assert.strictEqual(rows[0].business_type, 'cafe');
      assert.strictEqual(rows[0].service_model, 'dine_in');
    });

    // -----------------------------------------------------------------------------------------------------
    await test('6. Cinema tenant CANNOT hop to a Restaurant plan via /api/payment/change-plan (rejected with 403 industry_mismatch)', async () => {
      const insertResto = await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, total_screens, total_seats, plan_tier)
        VALUES ('Cine Star', 'cine-star', 'cinema_theatre', 'cinema', 2, 400, 'cinema_pro')
        RETURNING id
      `);
      const restoId = insertResto[0].id;

      await query(`
        INSERT INTO subscriptions (restaurant_id, status, current_period_end)
        VALUES ($1, 'active', '2030-01-01 00:00:00')
      `, [restoId]);
      await query(`
        UPDATE restaurants 
        SET plan_tier = 'cinema_pro', 
            subscription_type = 'COMPLIMENTARY', 
            plan_expires_at = '2030-01-01T00:00:00.000Z' 
        WHERE id = $1
      `, [restoId]);

      const cinemaToken = jwt.sign(
        { id: 8888, username: 'cine_admin', role: 'restaurant_admin', restaurant_id: restoId },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      // Attempt to change plan to Restaurant Basic (arbitrage attempt)
      const changeRes = await fetch(`${paymentBaseUrl}/change-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cinemaToken}`
        },
        body: JSON.stringify({ plan: 'basic' })
      });

      assert.strictEqual(changeRes.status, 403, `Expected 403 Forbidden for cross-industry plan hopping, got ${changeRes.status}`);
      const changeBody = await changeRes.json();
      assert.strictEqual(changeBody.error, 'industry_mismatch');
    });

    // -----------------------------------------------------------------------------------------------------
    await test('7. SuperAdmin GET /plans correctly aggregates enrolled_count for hotel and cinema vertical plans', async () => {
      // Seed a hotel business with generic 'enterprise' tier and a cinema business with 'pro'
      await query(`
        INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier)
        VALUES 
          ('Grand Hotel Test', 'grand-hotel-test', 'hotel_resort', 'hotel', 'enterprise'),
          ('Star Cinema Test', 'star-cinema-test', 'cinema_theatre', 'cinema', 'pro')
      `);

      const res = await fetch(`${saBaseUrl}/plans`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const plans = await res.json();
      const planMap = new Map(plans.map(p => [p.key.toLowerCase(), p]));

      // Verify hotel_enterprise has at least 1 enrolled hotel
      assert(planMap.has('hotel_enterprise'), 'hotel_enterprise plan must exist');
      assert.strictEqual(planMap.get('hotel_enterprise').enrolled_count >= 1, true, `hotel_enterprise should count hotel businesses with enterprise tier, got ${planMap.get('hotel_enterprise').enrolled_count}`);

      // Verify cinema_pro has at least 1 enrolled cinema
      assert(planMap.has('cinema_pro'), 'cinema_pro plan must exist');
      assert.strictEqual(planMap.get('cinema_pro').enrolled_count >= 1, true, `cinema_pro should count cinema businesses with pro tier, got ${planMap.get('cinema_pro').enrolled_count}`);
    });

  } finally {
    server.close();
    if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
      const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
      if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
        try { fs.unlinkSync(rawPath); } catch {}
      }
    }
  }

  console.log('\n======================================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
