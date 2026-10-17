/**
 * TouchQR — Step 5A Tenant Admin Catalog Activity Logging Integration Tests
 *
 * Verifies:
 * 1. All 14 Catalog audit events:
 *    - Categories: TENANT_CATEGORY_CREATED, TENANT_CATEGORY_UPDATED, TENANT_CATEGORY_DELETED, TENANT_CATEGORY_TOGGLED, TENANT_CATEGORIES_REORDERED
 *    - Dishes: TENANT_DISH_CREATED, TENANT_DISH_UPDATED, TENANT_DISH_PRICE_CHANGED, TENANT_DISH_AVAILABILITY_TOGGLED, TENANT_DISH_DELETED
 *    - Combos: TENANT_COMBO_CREATED, TENANT_COMBO_UPDATED, TENANT_COMBO_TOGGLED, TENANT_COMBO_DELETED
 * 2. Authenticated tenant context strictly used (req.user.restaurant_id).
 * 3. Actor role (admin, restaurant_admin, tenant_admin) correctly logged.
 * 4. Failed business operations produce NO false success audit events.
 * 5. Cross-tenant ID manipulation is rejected (404) and produces NO audit events.
 * 6. Body-injected restaurant_id cannot spoof audit tenant association.
 * 7. Sensitive data (passwords, tokens, secrets) is never leaked in audit details.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import adminRoutes from '../routes/admin.js';
import { JWT_SECRET } from '../config/jwt.js';

const TEST_DB_PATH = path.resolve('menu_test_catalog_audit.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('🛡️  TOUCHQR STEP 5A: TENANT ADMIN CATALOG ACTIVITY LOGGING TESTS');
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

async function run() {
  if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
    const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
    if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  // 1. Initialize schema
  await initDb();

  // 2. Setup ephemeral Express server
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/admin`;

  try {
    // 3. Setup test tenant restaurants
    await query("DELETE FROM audit_logs WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM dishes WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM categories WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM combos WHERE restaurant_id IN (801, 802)");
    await query("DELETE FROM restaurants WHERE id IN (801, 802)");

    await query(`
      INSERT INTO restaurants (id, name, slug, plan_tier, active, owner_name, owner_email, subscription_type, plan_expires_at)
      VALUES 
        (801, 'Spice Garden', 'spice-garden', 'enterprise', true, 'Owner One', 'owner1@example.com', 'COMPLIMENTARY', '2099-12-31'),
        (802, 'Sweet Treats', 'sweet-treats', 'enterprise', true, 'Owner Two', 'owner2@example.com', 'COMPLIMENTARY', '2099-12-31')
    `);

    // Ensure SaaS plans exist so quota checks pass
    const existingPlan = await query('SELECT id FROM saas_plans WHERE key = $1', ['enterprise']);
    if (!existingPlan || existingPlan.length === 0) {
      await query(`
        INSERT INTO saas_plans (key, name, max_categories, max_dishes, max_combos)
        VALUES ('enterprise', 'Enterprise Plan', 9999, 9999, 9999)
      `);
    }

    // Generate tokens
    const token801 = jwt.sign(
      { id: 801, username: 'owner1', restaurant_id: 801, role: 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const token802 = jwt.sign(
      { id: 802, username: 'owner2', restaurant_id: 802, role: 'tenant_admin' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ====================================================================
    // CATEGORY AUDIT EVENTS
    // ====================================================================

    let catId = null;

    await test('POST /categories logs TENANT_CATEGORY_CREATED with authenticated tenant and actor role', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ name: 'North Indian', sort_order: 1 })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.id, 'Must return created category ID');
      catId = data.id;

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_CATEGORY_CREATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write TENANT_CATEGORY_CREATED log');
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.strictEqual(logs[0].actor_role, 'restaurant_admin');
      assert.ok(logs[0].details.includes('North Indian'));
      assert.ok(logs[0].details.includes(String(catId)));
    });

    await test('PUT /categories/:id logs TENANT_CATEGORY_UPDATED with old and new name', async () => {
      const res = await fetch(`${baseUrl}/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ name: 'North Indian Delights', sort_order: 1 })
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_CATEGORY_UPDATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write TENANT_CATEGORY_UPDATED log');
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.strictEqual(logs[0].actor_role, 'restaurant_admin');
      assert.ok(logs[0].details.includes('North Indian'));
      assert.ok(logs[0].details.includes('North Indian Delights'));
    });

    await test('PATCH /categories/:id/toggle logs TENANT_CATEGORY_TOGGLED', async () => {
      const res = await fetch(`${baseUrl}/categories/${catId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ active: false })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.active, false);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_CATEGORY_TOGGLED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('deactivated') || logs[0].details.includes('false'));
    });

    await test('POST /categories/reorder logs TENANT_CATEGORIES_REORDERED', async () => {
      const res = await fetch(`${baseUrl}/categories/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ orders: [{ id: catId, sort_order: 5 }] })
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_CATEGORIES_REORDERED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('1 categories'));
    });

    await test('DELETE /categories/:id logs TENANT_CATEGORY_DELETED', async () => {
      const res = await fetch(`${baseUrl}/categories/${catId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token801}` }
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_CATEGORY_DELETED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('North Indian Delights'));
    });

    // ====================================================================
    // DISH AUDIT EVENTS
    // ====================================================================

    // Re-create a category for dishes testing
    const catRes = await query("INSERT INTO categories (restaurant_id, name, sort_order) VALUES (801, 'Starters', 1) RETURNING id");
    const activeCatId = catRes[0]?.id || catRes.lastInsertRowid;
    let dishId = null;

    await test('POST /dishes logs TENANT_DISH_CREATED with price and category details', async () => {
      const res = await fetch(`${baseUrl}/dishes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({
          category_id: activeCatId,
          name: 'Paneer Butter Masala',
          price: 280,
          price_half: 160
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.id);
      dishId = data.id;

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_DISH_CREATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.strictEqual(logs[0].actor_role, 'restaurant_admin');
      assert.ok(logs[0].details.includes('Paneer Butter Masala'));
      assert.ok(logs[0].details.includes('280'));
      assert.ok(logs[0].details.includes('Starters'));
    });

    await test('PUT /dishes/:id logs TENANT_DISH_UPDATED', async () => {
      const res = await fetch(`${baseUrl}/dishes/${dishId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({
          category_id: activeCatId,
          name: 'Royal Paneer Butter Masala',
          price: 280, // Price unchanged
          available: true
        })
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_DISH_UPDATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('Royal Paneer Butter Masala'));
    });

    await test('PATCH /dishes/:id/price logs TENANT_DISH_PRICE_CHANGED with old and new prices', async () => {
      const res = await fetch(`${baseUrl}/dishes/${dishId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ price: 310, price_half: 180 })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.price, 310);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_DISH_PRICE_CHANGED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('280'));
      assert.ok(logs[0].details.includes('310'));
      assert.ok(logs[0].details.includes('180'));
    });

    await test('PATCH /dishes/:id/toggle logs TENANT_DISH_AVAILABILITY_TOGGLED', async () => {
      const res = await fetch(`${baseUrl}/dishes/${dishId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ available: false })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.available, false);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_DISH_AVAILABILITY_TOGGLED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('unavailable'));
    });

    await test('DELETE /dishes/:id logs TENANT_DISH_DELETED', async () => {
      const res = await fetch(`${baseUrl}/dishes/${dishId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token801}` }
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 801 AND action = 'TENANT_DISH_DELETED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 801);
      assert.ok(logs[0].details.includes('Royal Paneer Butter Masala'));
    });

    // ====================================================================
    // COMBO AUDIT EVENTS
    // ====================================================================

    let comboId = null;

    await test('POST /combos logs TENANT_COMBO_CREATED with price and details', async () => {
      const res = await fetch(`${baseUrl}/combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token802}` },
        body: JSON.stringify({
          name: 'Executive Lunch Combo',
          price: 249,
          items: ['Dal Makhani', 'Naan', 'Salad']
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.id);
      comboId = data.id;

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 802 AND action = 'TENANT_COMBO_CREATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 802);
      assert.strictEqual(logs[0].actor_role, 'tenant_admin');
      assert.ok(logs[0].details.includes('Executive Lunch Combo'));
      assert.ok(logs[0].details.includes('249'));
    });

    await test('PUT /combos/:id logs TENANT_COMBO_UPDATED', async () => {
      const res = await fetch(`${baseUrl}/combos/${comboId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token802}` },
        body: JSON.stringify({
          name: 'Royal Executive Lunch Combo',
          price: 279,
          items: ['Dal Makhani', 'Butter Naan', 'Salad', 'Gulab Jamun']
        })
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 802 AND action = 'TENANT_COMBO_UPDATED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 802);
      assert.ok(logs[0].details.includes('Royal Executive Lunch Combo'));
      assert.ok(logs[0].details.includes('279'));
    });

    await test('PATCH /combos/:id/toggle logs TENANT_COMBO_TOGGLED with combo name, ID, and availability state', async () => {
      const res = await fetch(`${baseUrl}/combos/${comboId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token802}` },
        body: JSON.stringify({ available: false })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.available, false);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 802 AND action = 'TENANT_COMBO_TOGGLED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1, 'Must write TENANT_COMBO_TOGGLED log');
      assert.strictEqual(logs[0].restaurant_id, 802);
      assert.strictEqual(logs[0].actor_role, 'tenant_admin');
      assert.ok(logs[0].details.includes('Royal Executive Lunch Combo'));
      assert.ok(logs[0].details.includes(String(comboId)));
      assert.ok(logs[0].details.includes('unavailable'));
    });

    await test('DELETE /combos/:id logs TENANT_COMBO_DELETED', async () => {
      const res = await fetch(`${baseUrl}/combos/${comboId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token802}` }
      });
      assert.strictEqual(res.status, 200);

      const logs = await query("SELECT * FROM audit_logs WHERE restaurant_id = 802 AND action = 'TENANT_COMBO_DELETED' ORDER BY id DESC LIMIT 1");
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].restaurant_id, 802);
      assert.ok(logs[0].details.includes('Royal Executive Lunch Combo'));
    });

    // ====================================================================
    // SAFETY, ISOLATION & FAILURE HANDLING
    // ====================================================================

    await test('Failed business operation (missing category name) returns 400 and creates NO audit log', async () => {
      const beforeCountRows = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 801");
      const beforeCount = Number(beforeCountRows[0]?.count || 0);

      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ sort_order: 1 }) // missing name!
      });
      assert.strictEqual(res.status, 400);

      const afterCountRows = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 801");
      const afterCount = Number(afterCountRows[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount, 'No audit record must be written on 400 validation failure');
    });

    await test('Cross-tenant category manipulation is rejected (404) and creates NO audit log', async () => {
      // Tenant 801 creates a category
      const createRes = await query("INSERT INTO categories (restaurant_id, name) VALUES (801, 'Private Cat 801') RETURNING id");
      const privateCatId = createRes[0]?.id || createRes.lastInsertRowid;

      const beforeLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const beforeCount = Number(beforeLogs802[0]?.count || 0);

      // Tenant 802 attempts to delete Tenant 801's category
      const res = await fetch(`${baseUrl}/categories/${privateCatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token802}` }
      });
      assert.strictEqual(res.status, 404, 'Must return 404 for cross-tenant category deletion');

      const afterLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const afterCount = Number(afterLogs802[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount, 'Must not create audit record on unauthorized cross-tenant attempt');
    });

    await test('Cross-tenant dish price manipulation is rejected (404) and creates NO audit log', async () => {
      // Tenant 801 creates a dish under its valid category
      const dishRes = await query("INSERT INTO dishes (restaurant_id, category_id, name, price) VALUES (801, $1, 'Target Dish', 100) RETURNING id", [activeCatId]);
      const targetDishId = dishRes[0]?.id || dishRes.lastInsertRowid;

      const beforeLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const beforeCount = Number(beforeLogs802[0]?.count || 0);

      // Tenant 802 attempts to change price of Tenant 801's dish
      const res = await fetch(`${baseUrl}/dishes/${targetDishId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token802}` },
        body: JSON.stringify({ price: 9999 })
      });
      assert.strictEqual(res.status, 404, 'Must return 404 for cross-tenant dish price modification');

      const afterLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const afterCount = Number(afterLogs802[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount, 'Must not create audit record on unauthorized cross-tenant attempt');
    });

    await test('Cross-tenant combo manipulation is rejected (404) and creates NO audit log', async () => {
      // Tenant 801 creates a combo
      const comboRes = await query("INSERT INTO combos (restaurant_id, name, price, items) VALUES (801, 'Target Combo', 150, '[]') RETURNING id");
      const targetComboId = comboRes[0]?.id || comboRes.lastInsertRowid;

      const beforeLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const beforeCount = Number(beforeLogs802[0]?.count || 0);

      // Tenant 802 attempts to update Tenant 801's combo
      const res = await fetch(`${baseUrl}/combos/${targetComboId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token802}` },
        body: JSON.stringify({ name: 'Hacked Combo', price: 10, items: [] })
      });
      assert.strictEqual(res.status, 404, 'Must return 404 for cross-tenant combo update');

      const afterLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const afterCount = Number(afterLogs802[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount);
    });

    await test('Cross-tenant combo toggle is rejected (404) and creates NO audit log', async () => {
      // Tenant 801 creates a combo
      const comboRes = await query("INSERT INTO combos (restaurant_id, name, price, items, available) VALUES (801, 'Target Toggle Combo', 199, '[]', true) RETURNING id");
      const targetComboId = comboRes[0]?.id || comboRes.lastInsertRowid;

      const beforeLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const beforeCount = Number(beforeLogs802[0]?.count || 0);

      // Tenant 802 attempts to toggle Tenant 801's combo
      const res = await fetch(`${baseUrl}/combos/${targetComboId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token802}` },
        body: JSON.stringify({ available: false })
      });
      assert.strictEqual(res.status, 404, 'Must return 404 for cross-tenant combo toggle');

      const afterLogs802 = await query("SELECT COUNT(*)::int as count FROM audit_logs WHERE restaurant_id = 802");
      const afterCount = Number(afterLogs802[0]?.count || 0);
      assert.strictEqual(afterCount, beforeCount, 'Must not create audit record on unauthorized cross-tenant combo toggle');
    });

    await test('Body-injected restaurant_id cannot spoof audit log tenant ownership', async () => {
      // Tenant 801 passes { restaurant_id: 802 } in the request body
      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token801}` },
        body: JSON.stringify({ name: 'Spoof Test Category', restaurant_id: 802, sort_order: 1 })
      });
      assert.strictEqual(res.status, 200);

      // Check that the category was created for 801 (not 802)
      const spoofCat = await query("SELECT restaurant_id FROM categories WHERE name = 'Spoof Test Category'");
      assert.strictEqual(spoofCat[0]?.restaurant_id, 801, 'Category must be strictly assigned to authenticated restaurant_id');

      // Check that audit log was recorded for 801 (not 802)
      const spoofAudit = await query("SELECT restaurant_id FROM audit_logs WHERE details LIKE '%Spoof Test Category%'");
      assert.strictEqual(spoofAudit[0]?.restaurant_id, 801, 'Audit log must record authenticated restaurant_id');
    });

    await test('No sensitive tokens, secrets, or passwords appear in any catalog audit log details', async () => {
      const allLogs = await query("SELECT details FROM audit_logs WHERE restaurant_id IN (801, 802)");
      const sensitiveTokens = ['password', 'secret', 'qr_secret', 'bearer', 'token', 'jwt'];
      for (const row of allLogs) {
        const text = (row.details || '').toLowerCase();
        for (const bad of sensitiveTokens) {
          assert.ok(!text.includes(bad), `Audit detail "${row.details}" leaked sensitive pattern "${bad}"`);
        }
      }
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
}

try {
  await run();
  console.log('\n======================================================================');
  console.log(`INTEGRATION TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
  else process.exit(0);
} catch (err) {
  console.error('Fatal test error:', err);
  process.exit(1);
}
