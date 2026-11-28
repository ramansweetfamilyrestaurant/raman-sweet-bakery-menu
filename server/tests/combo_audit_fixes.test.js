import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'touchqr-combo-audit-'));
const TEMP_DB_PATH = path.join(TEMP_DIR, 'combo_audit_test.db');
process.env.TEST_DATABASE_URL = `sqlite:${TEMP_DB_PATH}`;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const { query, initDb } = await import('../db.js');
const { default: adminRouter } = await import('../routes/admin.js');
const { default: apiRouter, clearMenuBundleCache } = await import('../routes/api.js');
const { JWT_SECRET } = await import('../config/jwt.js');
const { generateHmacQrToken, generateRestaurantQrSecret } = await import('../utils/qrSecurity.js');
const { generatePresenceToken, generateQrContextHash } = await import('../utils/presenceVerification.js');
const {
  formatComboIncludesText,
  inspectComboComponentAvailability,
  resolveComboDietType,
  enrichCombosWithLiveDishes
} = await import('../utils/comboHelper.js');
const { resolveComboMeta } = await import('../../src/utils/comboHelper.js');
const { isPosItemNonVeg } = await import('../../src/utils/dietHelper.js');
const { BUSINESS_TYPES, getComboTerminology } = await import('../../src/utils/businessTaxonomy.js');

function requestJson(server, method, reqPath, token, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (_) {}
          resolve({ status: res.statusCode, body: parsed, text: data });
        });
      }
    );
    req.on('error', reject);
    if (body !== null) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  let passed = 0;
  const check = async (label, fn) => {
    await fn();
    passed++;
    console.log(`  [PASS] ${label}`);
  };

  let server = null;

  try {
    await initDb({ skipSeed: true });
    clearMenuBundleCache();

    await query("DELETE FROM saas_plans WHERE key = 'enterprise'");
    await query(
      "INSERT INTO saas_plans (key, name, price, allowed_themes, direct_ordering_enabled, counter_ordering_enabled, max_combos) VALUES ('enterprise', 'Enterprise', 1999, 'ALL', 1, 1, 9999)"
    );

    const qrSecret = generateRestaurantQrSecret();
    const slug = `combo-audit-${Date.now()}`;
    const futureIso = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    const restoRes = await query(
      `INSERT INTO restaurants (
        name, slug, plan_tier, active, mandate_status, plan_expires_at, subscription_type,
        direct_ordering_enabled, total_tables, table_verification_mode, qr_secret, currency_symbol
      ) VALUES ($1, $2, 'enterprise', 1, 'active', $3, 'COMPLIMENTARY', 1, 10, 'QR_ONLY', $4, '₹') RETURNING id`,
      ['Combo Audit Kitchen', slug, futureIso, qrSecret]
    );
    const restoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    const adminToken = jwt.sign(
      { id: 1, username: 'combo-admin', role: 'restaurant_admin', restaurant_id: restoId },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    const catRes = await query(
      `INSERT INTO categories (restaurant_id, name, active, sort_order) VALUES ($1, 'Mains', 1, 1) RETURNING id`,
      [restoId]
    );
    const catId = catRes[0]?.id || catRes.lastInsertRowid;

    const dVegRes = await query(
      `INSERT INTO dishes (restaurant_id, category_id, name, price, type, available) VALUES ($1, $2, 'Paneer Butter Masala', 240, 'veg', 1) RETURNING id`,
      [restoId, catId]
    );
    const vegDishId = dVegRes[0]?.id || dVegRes.lastInsertRowid;

    const dBreadRes = await query(
      `INSERT INTO dishes (restaurant_id, category_id, name, price, type, available) VALUES ($1, $2, 'Butter Naan', 50, 'veg', 1) RETURNING id`,
      [restoId, catId]
    );
    const breadDishId = dBreadRes[0]?.id || dBreadRes.lastInsertRowid;

    const dNonVegRes = await query(
      `INSERT INTO dishes (restaurant_id, category_id, name, price, type, available) VALUES ($1, $2, 'Special Gravy', 320, 'nonveg', 1) RETURNING id`,
      [restoId, catId]
    );
    const nonVegDishId = dNonVegRes[0]?.id || dNonVegRes.lastInsertRowid;

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use('/api', apiRouter);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });

    await check('unit: backend & frontend combo helpers resolve live prices, diet_type, includes, and component availability', async () => {
      const dishMap = new Map([
        [String(vegDishId), { id: vegDishId, name: 'Paneer Butter Masala Updated', price: 280, type: 'veg', available: 1 }],
        [String(breadDishId), { id: breadDishId, name: 'Butter Naan', price: 50, type: 'veg', available: 0 }],
        [String(nonVegDishId), { id: nonVegDishId, name: 'Special Gravy', price: 320, type: 'nonveg', available: 1 }]
      ]);

      const neutralCombo = {
        id: 1,
        name: 'Royal Chef Feast',
        description: 'Chef special platter',
        price: 399,
        available: 1,
        items: [
          { dish_id: vegDishId, dish_name: 'Old Name', qty: 1, portion: 'full', original_price: 200 },
          { dish_id: nonVegDishId, dish_name: 'Special Gravy', qty: 1, portion: 'full', original_price: 320 }
        ]
      };

      assert.strictEqual(resolveComboDietType(neutralCombo, dishMap), 'nonveg');
      const [enriched] = enrichCombosWithLiveDishes([neutralCombo], Array.from(dishMap.values()));
      assert.strictEqual(enriched.diet_type, 'nonveg');
      assert.strictEqual(enriched.items[0].dish_name, 'Paneer Butter Masala Updated');
      assert.strictEqual(enriched.items[0].original_price, 280);
      assert.strictEqual(enriched.has_unavailable_items, false);

      const feMeta = resolveComboMeta(enriched, dishMap);
      assert.strictEqual(feMeta.originalTotal, 600);
      assert.strictEqual(feMeta.isOrderable, true);
      assert.strictEqual(isPosItemNonVeg(enriched), true);
      assert.strictEqual(formatComboIncludesText(enriched.items, dishMap), 'Paneer Butter Masala Updated + Special Gravy');

      const brokenCombo = {
        id: 2,
        name: 'Naan Combo',
        price: 199,
        available: 1,
        items: [
          { dish_id: vegDishId, dish_name: 'Paneer', qty: 1 },
          { dish_id: breadDishId, dish_name: 'Butter Naan', qty: 2 }
        ]
      };
      const availCheck = inspectComboComponentAvailability(brokenCombo, dishMap);
      assert.strictEqual(availCheck.allAvailable, false);
      assert.deepStrictEqual(availCheck.unavailableNames, ['Butter Naan']);
    });

    let freeComboId = null;
    await check('POST /api/admin/combos allows ₹0 free combo and rejects negative price', async () => {
      const badRes = await requestJson(server, 'POST', '/api/admin/combos', adminToken, {
        name: 'Bad Combo',
        price: -10,
        items: [{ dish_id: vegDishId, dish_name: 'Paneer', qty: 1 }]
      });
      assert.strictEqual(badRes.status, 400);

      const freeRes = await requestJson(server, 'POST', '/api/admin/combos', adminToken, {
        name: 'Promotional Free Tasting',
        price: 0,
        items: [
          { dish_id: vegDishId, dish_name: 'Paneer Butter Masala', qty: 1, original_price: 240 },
          { dish_id: breadDishId, dish_name: 'Butter Naan', qty: 2, original_price: 50 }
        ]
      });
      assert.strictEqual(freeRes.status, 200);
      assert.ok(freeRes.body.id);
      freeComboId = freeRes.body.id;
    });

    await check('PUT /api/admin/combos/:id preserves Sold Out availability when omitted from payload', async () => {
      const toggleRes = await requestJson(server, 'PATCH', `/api/admin/combos/${freeComboId}/toggle`, adminToken, {
        available: false
      });
      assert.strictEqual(toggleRes.status, 200);
      assert.strictEqual(toggleRes.body.available, false);

      const editRes = await requestJson(server, 'PUT', `/api/admin/combos/${freeComboId}`, adminToken, {
        name: 'Promotional Tasting Updated',
        price: 199,
        description: 'Best seller combo',
        items: [
          { dish_id: vegDishId, dish_name: 'Paneer Butter Masala', qty: 1, original_price: 240 },
          { dish_id: breadDishId, dish_name: 'Butter Naan', qty: 2, original_price: 50 }
        ],
        sort_order: 3
      });
      assert.strictEqual(editRes.status, 200);

      const rows = await query('SELECT available, sort_order, price FROM combos WHERE id = $1', [freeComboId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(Number(rows[0].available), 0);
      assert.strictEqual(Number(rows[0].sort_order), 3);
      assert.strictEqual(Number(rows[0].price), 199);

      // Re-enable for order tests
      const toggleOnRes = await requestJson(server, 'PATCH', `/api/admin/combos/${freeComboId}/toggle`, adminToken, {
        available: true
      });
      assert.strictEqual(toggleOnRes.status, 200);
    });

    let chefComboId = null;
    await check('GET /menu-bundle & /combos enrich live dish price, neutral-name nonveg diet_type, and component sold-out state', async () => {
      const createRes = await requestJson(server, 'POST', '/api/admin/combos', adminToken, {
        name: 'Chef Special Thali',
        description: 'Chef special weekend thali',
        price: 450,
        items: [
          { dish_id: vegDishId, dish_name: 'Old Paneer Name', qty: 1, portion: 'full', original_price: 150 },
          { dish_id: nonVegDishId, dish_name: 'Special Gravy', qty: 1, portion: 'full', original_price: 320 }
        ]
      });
      assert.strictEqual(createRes.status, 200);
      chefComboId = createRes.body.id;

      clearMenuBundleCache(slug);
      const bundleRes = await requestJson(server, 'GET', `/api/menu-bundle?slug=${slug}`, null);
      assert.strictEqual(bundleRes.status, 200);
      const bundleCombo = bundleRes.body.combos.find(c => Number(c.id) === Number(chefComboId));
      assert.ok(bundleCombo);
      assert.strictEqual(bundleCombo.diet_type, 'nonveg');
      assert.strictEqual(bundleCombo.items[0].dish_name, 'Paneer Butter Masala');
      assert.strictEqual(bundleCombo.items[0].original_price, 240);
      assert.strictEqual(bundleCombo.has_unavailable_items, false);
    });

    await check('Customer order preserves real items in includes (not overwritten by description) and blocks combos with sold-out dish', async () => {
      const qrToken = generateHmacQrToken(slug, 'table', '3', qrSecret);
      const presenceToken = generatePresenceToken({
        verificationToken: `vtok-${Date.now()}`,
        restaurantId: restoId,
        slug,
        spaceType: 'table',
        spaceNumber: '3',
        verificationMethod: 'QR',
        qrContextHash: generateQrContextHash(slug, 'table', '3', qrToken)
      });

      const okOrder = await requestJson(server, 'POST', '/api/orders', null, {
        slug,
        table_number: '3',
        space_type: 'table',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [
          { dish_id: `combo_${chefComboId}`, type: 'combo', name: 'Chef Special Thali', quantity: 1 }
        ]
      });
      assert.strictEqual(okOrder.status, 200, `Expected 200, got ${okOrder.status}: ${okOrder.text}`);
      const ordRow = await query('SELECT items FROM orders WHERE id = $1', [okOrder.body.order_id]);
      const savedItems = JSON.parse(ordRow[0].items);
      assert.strictEqual(savedItems[0].type, 'combo');
      assert.strictEqual(savedItems[0].includes, 'Paneer Butter Masala + Special Gravy');

      // Mark nonVegDish sold out
      await query('UPDATE dishes SET available = 0 WHERE id = $1', [nonVegDishId]);
      clearMenuBundleCache(slug);

      const bundleAfterSoldOut = await requestJson(server, 'GET', `/api/menu-bundle?slug=${slug}`, null);
      const comboAfterSoldOut = bundleAfterSoldOut.body.combos.find(c => Number(c.id) === Number(chefComboId));
      assert.strictEqual(comboAfterSoldOut.has_unavailable_items, true);
      assert.deepStrictEqual(comboAfterSoldOut.unavailable_item_names, ['Special Gravy']);

      const blockedOrder = await requestJson(server, 'POST', '/api/orders', null, {
        slug,
        table_number: '3',
        space_type: 'table',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [
          { dish_id: `combo_${chefComboId}`, type: 'combo', name: 'Chef Special Thali', quantity: 1 }
        ]
      });
      assert.strictEqual(blockedOrder.status, 400);
      assert.strictEqual(blockedOrder.body.error, 'dish_unavailable');
    });

    await check('unit: getComboTerminology provides unified Combo / Combo Deals copy across all 20 business types', async () => {
      for (const bType of BUSINESS_TYPES) {
        const terms = getComboTerminology({ business_type: bType });
        assert.strictEqual(terms.sectionEn, 'Combo Deals');
        assert.strictEqual(terms.sectionHi, 'कॉम्बो डील्स');
        assert.strictEqual(terms.navEn, 'Combos');
        assert.strictEqual(terms.navHi, 'कॉम्बो');
        assert.strictEqual(terms.addBtnEn, 'ADD COMBO TO CART');
        assert.strictEqual(terms.sectionEn.includes('Thali'), false);
        assert.strictEqual(typeof terms.includedEn(2), 'string');
        assert.strictEqual(typeof terms.includedHi(2), 'string');
      }
      assert.doesNotThrow(() => getComboTerminology(null));
    });

    await check('POS order sets type=combo and includes from DB and rejects combo with sold-out dish', async () => {
      const blockedPos = await requestJson(server, 'POST', '/api/admin/pos-order', adminToken, {
        order_type: 'takeaway',
        payment_method: 'cash',
        items: [
          { dish_id: `combo_${chefComboId}`, name: '[Combo] Chef Special Thali', price: 450, quantity: 1, type: 'combo' }
        ]
      });
      assert.strictEqual(blockedPos.status, 400);
      assert.strictEqual(blockedPos.body.error, 'dish_unavailable');

      // Free combo uses vegDish + breadDish (both available)
      const okPos = await requestJson(server, 'POST', '/api/admin/pos-order', adminToken, {
        order_type: 'takeaway',
        payment_method: 'cash',
        items: [
          { dish_id: `combo_${freeComboId}`, name: '[Combo] Promotional Tasting Updated', price: 199, quantity: 1, type: 'combo' }
        ]
      });
      assert.strictEqual(okPos.status, 200, `Expected 200 POS order, got ${okPos.status}: ${okPos.text}`);
      const posItems = okPos.body.order.items;
      assert.strictEqual(posItems[0].type, 'combo');
      assert.strictEqual(posItems[0].includes, 'Paneer Butter Masala + 2x Butter Naan');
    });

    console.log(`\n🎉 COMBO AUDIT TEST SUITE: ALL ${passed} CHECKS PASSED!`);
  } finally {
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (_) {}
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Combo audit test failed:', err);
  process.exit(1);
});
