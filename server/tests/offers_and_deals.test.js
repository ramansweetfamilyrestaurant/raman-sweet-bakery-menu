import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'touchqr-offers-test-'));
const TEMP_DB_PATH = path.join(TEMP_DIR, 'offers_and_deals_test.db');
process.env.TEST_DATABASE_URL = `sqlite:${TEMP_DB_PATH}`;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const { query, initDb } = await import('../db.js');
const { default: adminRouter } = await import('../routes/admin.js');
const {
  default: apiRouter,
  calculateOfferPrice,
  resolveActiveOfferMaps,
  resolveBestOfferForPrice,
  enrichItemsWithActiveOffers,
  clearMenuBundleCache
} = await import('../routes/api.js');
const { JWT_SECRET } = await import('../config/jwt.js');
const { generateHmacQrToken, generateRestaurantQrSecret } = await import('../utils/qrSecurity.js');
const { generatePresenceToken, generateQrContextHash } = await import('../utils/presenceVerification.js');

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
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, body: parsed, text: data });
        });
      }
    );
    req.on('error', reject);
    if (body !== null) {
      req.write(JSON.stringify(body));
    }
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
      "INSERT INTO saas_plans (key, name, price, allowed_themes, direct_ordering_enabled) VALUES ('enterprise', 'Enterprise', 1999, 'ALL', 1)"
    );

    const qrSecret = generateRestaurantQrSecret();
    const slug = `offers-audit-${Date.now()}`;
    const futureIso = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

    const restoRes = await query(
      `INSERT INTO restaurants (
        name, slug, plan_tier, active, mandate_status, plan_expires_at, subscription_type,
        direct_ordering_enabled, total_tables, table_verification_mode, qr_secret, currency_symbol
      ) VALUES ($1, $2, 'enterprise', 1, 'active', $3, 'COMPLIMENTARY', 1, 10, 'QR_ONLY', $4, '₹') RETURNING id`,
      ['Offers Audit Kitchen', slug, futureIso, qrSecret]
    );
    const restoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    const otherRestoRes = await query(
      `INSERT INTO restaurants (
        name, slug, plan_tier, active, mandate_status, plan_expires_at, subscription_type
      ) VALUES ('Other Kitchen', $1, 'enterprise', 1, 'active', $2, 'COMPLIMENTARY') RETURNING id`,
      [`other-${slug}`, futureIso]
    );
    const otherRestoId = otherRestoRes[0]?.id || otherRestoRes.lastInsertRowid;

    const catRes = await query(
      `INSERT INTO categories (restaurant_id, name, active, sort_order) VALUES ($1, 'Mains', 1, 1) RETURNING id`,
      [restoId]
    );
    const catId = catRes[0]?.id || catRes.lastInsertRowid;

    const dishFullAndHalfRes = await query(
      `INSERT INTO dishes (restaurant_id, category_id, name, price, price_half, portion_half_label, available)
       VALUES ($1, $2, 'Paneer Tikka', 260, 140, 'Small', 1) RETURNING id`,
      [restoId, catId]
    );
    const dishId = dishFullAndHalfRes[0]?.id || dishFullAndHalfRes.lastInsertRowid;

    const dish2Res = await query(
      `INSERT INTO dishes (restaurant_id, category_id, name, price, available)
       VALUES ($1, $2, 'Masala Chaas', 90, 1) RETURNING id`,
      [restoId, catId]
    );
    const dish2Id = dish2Res[0]?.id || dish2Res.lastInsertRowid;

    const comboRes = await query(
      `INSERT INTO combos (restaurant_id, name, price, description, items, available)
       VALUES ($1, 'Tikka Meal Combo', 350, 'Paneer Tikka + Chaas', '[]', 1) RETURNING id`,
      [restoId]
    );
    const comboId = comboRes[0]?.id || comboRes.lastInsertRowid;

    const adminToken = jwt.sign({ id: 1, restaurant_id: restoId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    const otherAdminToken = jwt.sign({ id: 2, restaurant_id: otherRestoId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use('/api', apiRouter);

    server = app.listen(0);
    let createdOfferId = null;

    await check('rejects invalid offer payloads (whitespace name, bad schedule, empty items, high special_price)', async () => {
      const whitespaceRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: '   ',
        type: 'percentage',
        value: 10,
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(whitespaceRes.status, 400);

      const badScheduleRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Broken Window',
        type: 'percentage',
        value: 15,
        starts_at: '2026-12-10T10:00:00.000Z',
        ends_at: '2026-12-09T10:00:00.000Z',
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(badScheduleRes.status, 400);
      assert.match(badScheduleRes.body.error, /after start time/i);

      const emptyItemsRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Empty Items Offer',
        type: 'flat',
        value: 20,
        items: []
      });
      assert.strictEqual(emptyItemsRes.status, 400);

      const inflatedSpecialRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Overpriced Special',
        type: 'special_price',
        value: 300,
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(inflatedSpecialRes.status, 400);

      const boolStartRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Bool Timestamp',
        type: 'percentage',
        value: 10,
        starts_at: true,
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(boolStartRes.status, 400);

      const boolEndRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Bool End Timestamp',
        type: 'percentage',
        value: 10,
        ends_at: false,
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(boolEndRes.status, 400);

      const partialInvalidItemRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Mixed Valid and Foreign Items',
        type: 'percentage',
        value: 10,
        items: [{ dish_id: dishId }, { dish_id: 999999 }]
      });
      assert.strictEqual(partialInvalidItemRes.status, 400);

      const boolDishRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Bool Dish ID',
        type: 'percentage',
        value: 10,
        items: [{ dish_id: true }]
      });
      assert.strictEqual(boolDishRes.status, 400);

      const boolComboRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Bool Combo ID',
        type: 'percentage',
        value: 10,
        items: [{ combo_id: true }]
      });
      assert.strictEqual(boolComboRes.status, 400);
    });

    await check('returns 404 on missing offer PUT, PATCH toggle, and DELETE', async () => {
      const missingPut = await requestJson(server, 'PUT', '/api/admin/offers/999999', adminToken, {
        name: 'Missing',
        type: 'percentage',
        value: 10,
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(missingPut.status, 404);

      const missingToggle = await requestJson(server, 'PATCH', '/api/admin/offers/999999/toggle', adminToken, {
        active: false
      });
      assert.strictEqual(missingToggle.status, 404);

      const missingDelete = await requestJson(server, 'DELETE', '/api/admin/offers/999999', adminToken);
      assert.strictEqual(missingDelete.status, 404);
    });

    await check('creates combo+dish offer, preserves active/starts_at on partial PUT, and atomic toggle works', async () => {
      const originalStart = '2026-01-01T00:00:00.000Z';
      const createRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Special Launch',
        type: 'special_price',
        value: 200,
        starts_at: originalStart,
        ends_at: null,
        active: false,
        items: [{ dish_id: dishId }, { combo_id: comboId }]
      });
      assert.strictEqual(createRes.status, 200);
      createdOfferId = createRes.body.id;

      const crossPut = await requestJson(server, 'PUT', `/api/admin/offers/${createdOfferId}`, otherAdminToken, {
        name: 'Hijack',
        type: 'percentage',
        value: 50,
        items: [{ dish_id: dishId }]
      });
      assert.strictEqual(crossPut.status, 404);

      const updateRes = await requestJson(server, 'PUT', `/api/admin/offers/${createdOfferId}`, adminToken, {
        name: 'Special Launch Updated',
        type: 'special_price',
        value: 200,
        items: [{ dish_id: String(dishId) }, { dish_id: dish2Id }, { combo_id: String(comboId) }]
      });
      assert.strictEqual(updateRes.status, 200);

      const listRes = await requestJson(server, 'GET', '/api/admin/offers', adminToken);
      assert.strictEqual(listRes.status, 200);
      const updated = listRes.body.find(o => o.id === createdOfferId);
      assert.ok(updated);
      assert.strictEqual(updated.active, 0);
      assert.strictEqual(updated.starts_at, originalStart);
      assert.strictEqual(updated.items.length, 3);

      // Atomic omitted toggle (false -> true) + idempotent explicit toggle
      const toggleRes = await requestJson(server, 'PATCH', `/api/admin/offers/${createdOfferId}/toggle`, adminToken, {});
      assert.strictEqual(toggleRes.status, 200);
      assert.strictEqual(toggleRes.body.active, true);

      const explicitSame = await requestJson(server, 'PATCH', `/api/admin/offers/${createdOfferId}/toggle`, adminToken, { active: true });
      assert.strictEqual(explicitSame.status, 200);
      assert.strictEqual(explicitSame.body.active, true);
    });

    await check('editing older offer A after newer offer B still keeps B as winner on menu & checkout, with fallback on non-applicable items', async () => {
      // Offer A: 20% OFF on Dish 1 (260) & Dish 2 (90 -> 72)
      const offerARes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Offer A Older',
        type: 'percentage',
        value: 20,
        active: true,
        items: [{ dish_id: dishId }, { dish_id: dish2Id }]
      });
      assert.strictEqual(offerARes.status, 200);
      const offerAId = offerARes.body.id;

      // Offer B (newer ID): Special Price 150 on Dish 1 (260 -> 150) & Dish 2 (90 -> ineligible, must fallback to Offer A's 72!)
      const newerEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const offerBRes = await requestJson(server, 'POST', '/api/admin/offers', adminToken, {
        name: 'Offer B Newer',
        type: 'special_price',
        value: 150,
        starts_at: new Date(Date.now() - 60000).toISOString(),
        ends_at: newerEnd,
        active: true,
        items: [{ dish_id: dishId }, { dish_id: dish2Id }]
      });
      assert.strictEqual(offerBRes.status, 200);
      const offerBId = offerBRes.body.id;

      // Edit Offer A AFTER Offer B (re-creating A's offer_items rows with higher link IDs)
      const editARes = await requestJson(server, 'PUT', `/api/admin/offers/${offerAId}`, adminToken, {
        name: 'Offer A Edited Later',
        type: 'percentage',
        value: 20,
        active: true,
        items: [{ dish_id: dishId }, { dish_id: dish2Id }]
      });
      assert.strictEqual(editARes.status, 200);

      // Verify alias slug (-menu) warms/clears identically & canonical Offer B wins for Dish 1 (150), Offer A wins by fallback for Dish 2 (72)
      const aliasRes = await requestJson(server, 'GET', `/api/menu-bundle?slug=${encodeURIComponent(slug + '-menu')}&scan=0`, null);
      assert.strictEqual(aliasRes.status, 200);

      const aliasDish1 = aliasRes.body.dishes.find(d => d.id === dishId);
      const aliasDish2 = aliasRes.body.dishes.find(d => d.id === dish2Id);
      const aliasCombo = aliasRes.body.combos.find(c => c.id === comboId);

      assert.strictEqual(aliasDish1.offer_id, offerBId);
      assert.strictEqual(aliasDish1.offer_price, 150);
      assert.strictEqual(aliasDish1.offer.ends_at, newerEnd);
      assert.strictEqual(aliasDish1.offer_ends_at, newerEnd);

      // Dish 2 (price 90) cannot take special_price 150 -> falls back to Offer A (20% off 90 = 72)
      assert.strictEqual(aliasDish2.offer_id, offerAId);
      assert.strictEqual(aliasDish2.offer_price, 72);

      // Combo (350) still uses Special Launch (200)
      assert.strictEqual(aliasCombo.offer_price, 200);

      // Verify editing Offer B invalidates -menu alias cache too
      const repriceBRes = await requestJson(server, 'PUT', `/api/admin/offers/${offerBId}`, adminToken, {
        name: 'Offer B Newer Repriced',
        type: 'special_price',
        value: 145,
        ends_at: newerEnd,
        active: true,
        items: [{ dish_id: dishId }, { dish_id: dish2Id }]
      });
      assert.strictEqual(repriceBRes.status, 200);

      const refreshedAliasRes = await requestJson(server, 'GET', `/api/menu-bundle?slug=${encodeURIComponent(slug + '-menu')}&scan=0`, null);
      assert.strictEqual(refreshedAliasRes.status, 200);
      assert.strictEqual(refreshedAliasRes.body.dishes.find(d => d.id === dishId).offer_price, 145);

      // Checkout order with:
      // 1) Full Paneer Tikka (Offer B -> 145)
      // 2) Label-only custom Half "Small" WITHOUT portion_type (stays regular 140, NO offer!)
      // 3) Dish 2 Masala Chaas (falls back to Offer A -> 72)
      // 4) Combo (Special Launch -> 200)
      const qrToken = generateHmacQrToken(slug, 'table', '1', qrSecret);
      const presenceToken = generatePresenceToken({
        verificationToken: `vtok-${Date.now()}`,
        restaurantId: restoId,
        slug,
        spaceType: 'table',
        spaceNumber: '1',
        verificationMethod: 'QR',
        qrContextHash: generateQrContextHash(slug, 'table', '1', qrToken)
      });
      const orderRes = await requestJson(server, 'POST', '/api/orders', null, {
        slug,
        table_number: '1',
        space_type: 'table',
        table_token: qrToken,
        presence_token: presenceToken,
        items: [
          { dish_id: dishId, name: 'Paneer Tikka', portion: 'Full', portion_type: 'full', quantity: 1 },
          { dish_id: dishId, name: 'Paneer Tikka', portion: 'Small', quantity: 1 },
          { dish_id: dish2Id, name: 'Masala Chaas', quantity: 1 },
          { dish_id: `combo_${comboId}`, type: 'combo', name: 'Tikka Meal Combo', quantity: 1 }
        ]
      });
      assert.strictEqual(orderRes.status, 200, `Expected 200 order response, got ${orderRes.status}: ${orderRes.text}`);

      const orderRows = await query('SELECT items, total_amount FROM orders WHERE id = $1', [orderRes.body.order_id]);
      assert.strictEqual(orderRows.length, 1);
      const savedItems = JSON.parse(orderRows[0].items);
      assert.strictEqual(savedItems[0].price, 145);
      assert.strictEqual(savedItems[0].offer_id, offerBId);
      assert.strictEqual(savedItems[1].price, 140);
      assert.strictEqual(savedItems[1].discount_amount, 0);
      assert.strictEqual(savedItems[1].offer_id, null);
      assert.strictEqual(savedItems[2].price, 72);
      assert.strictEqual(savedItems[2].offer_id, offerAId);
      assert.strictEqual(savedItems[3].price, 200);
      assert.strictEqual(Number(orderRows[0].total_amount), 145 + 140 + 72 + 200);
    });

    await check('helper unit checks: decimal percentage rounding, exclusive endsAt, invalid special_price, and tenant-safe -menu slug cache', async () => {
      // 100% off 10.25 must discount full 10.25 -> 0
      const fullPct = calculateOfferPrice(10.25, { id: 1, name: 'Free', type: 'percentage', value: 100 });
      assert.strictEqual(fullPct.offer_price, 0);
      assert.strictEqual(fullPct.discount_amount, 10.25);

      // Invalid/empty/nonnumeric special_price values must return null rather than becoming free (0)
      assert.strictEqual(calculateOfferPrice(100, { id: 1, name: 'Null Val', type: 'special_price', value: null }), null);
      assert.strictEqual(calculateOfferPrice(100, { id: 1, name: 'Empty Val', type: 'special_price', value: '' }), null);
      assert.strictEqual(calculateOfferPrice(100, { id: 1, name: 'Bad Str', type: 'special_price', value: 'abc' }), null);
      assert.strictEqual(calculateOfferPrice(100, { id: 1, name: 'Bool Val', type: 'special_price', value: false }), null);
      assert.strictEqual(calculateOfferPrice(100, { id: 1, name: 'Bad', type: 'special_price', value: 120 }), null);
      assert.strictEqual(calculateOfferPrice(100, { id: 1, name: 'Equal', type: 'special_price', value: 100 }), null);

      const flat = calculateOfferPrice(40, { id: 2, name: 'Big Flat', type: 'flat', value: 100 }, '₹');
      assert.strictEqual(flat.offer_price, 0);
      assert.strictEqual(flat.discount_amount, 40);

      // Exclusive endsAt === nowMs
      const now = new Date('2026-06-01T12:00:00.000Z');
      const futureStart = new Date('2026-06-01T12:00:10.000Z');
      const exactEndRes = resolveActiveOfferMaps(
        [
          { id: 11, starts_at: null, ends_at: now.toISOString() },
          { id: 10, starts_at: futureStart.toISOString(), ends_at: null }
        ],
        [],
        now
      );
      assert.strictEqual(exactEndRes.validOffersMap.size, 0);
      assert.strictEqual(exactEndRes.nextTransitionAt, futureStart.getTime());

      // Fallback helper check
      const best = resolveBestOfferForPrice(
        [
          { id: 2, type: 'special_price', value: 150 },
          { id: 1, type: 'percentage', value: 20 }
        ],
        90
      );
      assert.strictEqual(best.offer_id, 1);
      assert.strictEqual(best.offer_price, 72);

      // Distinct tenant owning actual `-menu` suffix slug must not receive base slug's cached bundle or steal scan_count
      const splitBaseSlug = `split-base-${Date.now()}`;
      const splitMenuSlug = `${splitBaseSlug}-menu`;
      const splitBaseRes = await query(
        `INSERT INTO restaurants (name, slug, plan_tier, active, mandate_status, plan_expires_at, subscription_type)
         VALUES ('Base Slug Tenant', $1, 'enterprise', 1, 'active', $2, 'COMPLIMENTARY') RETURNING id`,
        [splitBaseSlug, futureIso]
      );
      const splitBaseId = splitBaseRes[0]?.id || splitBaseRes.lastInsertRowid;

      const dedicatedRestoRes = await query(
        `INSERT INTO restaurants (name, slug, plan_tier, active, mandate_status, plan_expires_at, subscription_type)
         VALUES ('Dedicated Menu Tenant', $1, 'enterprise', 1, 'active', $2, 'COMPLIMENTARY') RETURNING id`,
        [splitMenuSlug, futureIso]
      );
      const dedicatedRestoId = dedicatedRestoRes[0]?.id || dedicatedRestoRes.lastInsertRowid;

      const baseWarmRes = await requestJson(server, 'GET', `/api/menu-bundle?slug=${encodeURIComponent(splitBaseSlug)}&scan=0`, null);
      assert.strictEqual(baseWarmRes.status, 200);
      assert.strictEqual(baseWarmRes.body.info.id, splitBaseId);

      const dedicatedRes = await requestJson(server, 'GET', `/api/menu-bundle?slug=${encodeURIComponent(splitMenuSlug)}&scan=1`, null);
      assert.strictEqual(dedicatedRes.status, 200);
      assert.strictEqual(dedicatedRes.body.info.id, dedicatedRestoId);

      const scanRows = await query('SELECT scan_count FROM restaurants WHERE id = $1', [dedicatedRestoId]);
      assert.strictEqual(Number(scanRows[0].scan_count), 1);

      const delRes = await requestJson(server, 'DELETE', `/api/admin/offers/${createdOfferId}`, adminToken);
      assert.strictEqual(delRes.status, 200);
      const remainingItems = await query('SELECT * FROM offer_items WHERE offer_id = $1', [createdOfferId]);
      assert.strictEqual(remainingItems.length, 0);

      await enrichItemsWithActiveOffers(restoId, [], []);
    });

    console.log(`\nOffers & Deals suite: ${passed} passed, 0 failed`);
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
  console.error(err);
  process.exit(1);
});
