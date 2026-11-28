process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = 'sqlite::memory:';

import assert from 'assert';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import http from 'http';
import express from 'express';
import { JWT_SECRET } from '../config/jwt.js';
import { generateHmacQrToken } from '../utils/qrSecurity.js';
import { generatePresenceToken, generateQrContextHash } from '../utils/presenceVerification.js';
import { query, withTransaction, initDb, getDbType } from '../db.js';
import { allocateRestaurantOrderNumbers, getIstStartOfDayUtcIso } from '../utils/orderNumbering.js';
import apiRouter from '../routes/api.js';
import adminRouter from '../routes/admin.js';
import {
  resolveBusinessOrderNumber,
  formatOrderLabel,
  formatOrderBillNumber
} from '../../src/utils/orderNumberHelper.js';

let passed = 0;
let failed = 0;

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.stack || err.message}`);
    failed++;
  }
}

async function run() {
  console.log('======================================================================');
  console.log('🛡️  TOUCHQR PER-BUSINESS ORDER NUMBERING & IST TOKEN SUITE');
  console.log('======================================================================\n');

  await initDb({ isTest: true, skipSeed: true });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use('/api/admin', adminRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await query(`
      INSERT OR REPLACE INTO saas_plans (key, name, direct_ordering_enabled, counter_ordering_enabled, kds_enabled, gst_invoice_enabled)
      VALUES ('enterprise', 'Enterprise Plan', 1, 1, 1, 1)
    `);

    const setupTenant = async (name, slug) => {
      const qrSecret = crypto.randomBytes(32).toString('hex');
      const rIns = await query(`
        INSERT INTO restaurants (
          name, slug, qr_secret, active, direct_ordering_enabled, counter_ordering_enabled,
          total_tables, plan_tier, subscription_type, table_verification_mode, kds_screen_enabled, gst_enabled
        ) VALUES ($1, $2, $3, 1, 1, 1, 10, 'enterprise', 'complimentary', 'QR_ONLY', 1, 1)
        RETURNING id
      `, [name, slug, qrSecret]);
      const id = rIns[0].id;
      const dIns = await query(`INSERT INTO dishes (restaurant_id, name, price, available) VALUES ($1, 'Samosa', 30, 1) RETURNING id`, [id]);
      const dishId = dIns[0].id;

      const t1Qr = generateHmacQrToken(slug, 'table', '1', qrSecret);
      const t1Pres = generatePresenceToken({
        verificationToken: `vtok_${slug}_t1`,
        restaurantId: id,
        slug,
        spaceType: 'table',
        spaceNumber: '1',
        qrContextHash: generateQrContextHash(slug, 'table', '1', t1Qr),
        expiryMinutes: 20
      });
      const ctrQr = generateHmacQrToken(slug, 'counter', 'COUNTER', qrSecret);
      const ctrPres = generatePresenceToken({
        verificationToken: `vtok_${slug}_ctr`,
        restaurantId: id,
        slug,
        spaceType: 'counter',
        spaceNumber: 'COUNTER',
        qrContextHash: generateQrContextHash(slug, 'counter', 'COUNTER', ctrQr),
        expiryMinutes: 20
      });
      const adminToken = jwt.sign({ id: 900 + id, restaurant_id: id, role: 'restaurant_admin' }, JWT_SECRET, { expiresIn: '1h' });
      return { id, slug, dishId, t1Qr, t1Pres, ctrQr, ctrPres, adminToken };
    };

    const bizA = await setupTenant('Raman Bakery', 'raman-bakery-num');
    const bizB = await setupTenant('Taj Cafe', 'taj-cafe-num');

    await testAsync('1. IST midnight helper computes exact 00:00 IST in UTC across day boundary', async () => {
      assert.equal(getIstStartOfDayUtcIso(new Date('2026-11-28T18:29:59.000Z')), '2026-11-27T18:30:00.000Z');
      assert.equal(getIstStartOfDayUtcIso(new Date('2026-11-28T18:30:01.000Z')), '2026-11-28T18:30:00.000Z');
    });

    await testAsync('2. Interleaved orders across Biz A and Biz B get independent 1, 2, 3 order_number & TK-01 tokens', async () => {
      const placeOrder = async (tenant, payload) => {
        const res = await fetch(`${baseUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        assert.equal(res.status, 200);
        return res.json();
      };

      const a1 = await placeOrder(bizA, {
        slug: bizA.slug,
        table_number: '1',
        space_type: 'table',
        table_token: bizA.t1Qr,
        presence_token: bizA.t1Pres,
        order_type: 'dine_in',
        items: [{ dish_id: bizA.dishId, quantity: 1 }]
      });
      assert.equal(a1.order_number, 1);

      const b1 = await placeOrder(bizB, {
        slug: bizB.slug,
        table_number: '1',
        space_type: 'table',
        table_token: bizB.t1Qr,
        presence_token: bizB.t1Pres,
        order_type: 'dine_in',
        items: [{ dish_id: bizB.dishId, quantity: 1 }]
      });
      assert.equal(b1.order_number, 1, 'Biz B must start at order_number 1 despite Biz A order');

      // Biz B POS counter order -> Biz B order_number 2, TK-01
      const bPosRes = await fetch(`${baseUrl}/api/admin/pos-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bizB.adminToken}`
        },
        body: JSON.stringify({
          order_type: 'takeaway',
          payment_method: 'cash',
          items: [{ id: bizB.dishId, name: 'Samosa', price: 30, quantity: 1 }]
        })
      });
      assert.equal(bPosRes.status, 200);
      const bPosData = await bPosRes.json();
      assert.equal(bPosData.order_number, 2);
      assert.equal(bPosData.order.order_number, 2);
      assert.equal(bPosData.token_display, 'TK-01');

      // Biz A Counter QR order -> still Biz A order_number 2 and TK-01!
      const a2 = await placeOrder(bizA, {
        slug: bizA.slug,
        table_number: 'COUNTER',
        space_type: 'counter',
        table_token: bizA.ctrQr,
        presence_token: bizA.ctrPres,
        order_type: 'takeaway',
        items: [{ dish_id: bizA.dishId, quantity: 2 }]
      });
      assert.equal(a2.order_number, 2, 'Biz A must stay sequential (2) regardless of Biz B orders');
      assert.equal(a2.token_display, 'TK-01', 'Biz A takeaway token must be independent of Biz B');

      // Biz A Add-on Round 2 on Table 1 -> order_number 3, while active-table/track preserve primary_order_number 1
      const a3 = await placeOrder(bizA, {
        slug: bizA.slug,
        table_number: '1',
        space_type: 'table',
        table_token: bizA.t1Qr,
        presence_token: bizA.t1Pres,
        order_type: 'dine_in',
        items: [{ dish_id: bizA.dishId, quantity: 3 }]
      });
      assert.equal(a3.order_number, 3);
      assert.equal(a3.primary_order_id, a1.order_id);

      const trackRes = await fetch(`${baseUrl}/api/orders/track/${a3.order_id}?slug=${bizA.slug}`, {
        headers: { 'X-Order-Tracking-Token': a3.tracking_token }
      });
      assert.equal(trackRes.status, 200);
      const trackData = await trackRes.json();
      assert.equal(trackData.order_number, 3);
      assert.equal(trackData.session_summary.primary_order_number, 1);

      const activeRes = await fetch(`${baseUrl}/api/orders/active-table?slug=${bizA.slug}&table_number=1&space_type=table&tkn=${encodeURIComponent(bizA.t1Qr)}`);
      assert.equal(activeRes.status, 200);
      const activeData = await activeRes.json();
      assert.equal(activeData.order_number, 1);
      assert.equal(activeData.latest_order_number, 3);
      assert.equal(activeData.rounds.length, 2);
      assert.deepEqual(activeData.rounds.map(r => r.order_number), [1, 3]);
    });

    await testAsync('3. Concurrent POS/Counter orders produce strictly unique sequential order_number and token_number', async () => {
      const results = await Promise.all([1, 2, 3].map(() =>
        fetch(`${baseUrl}/api/admin/pos-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bizB.adminToken}`
          },
          body: JSON.stringify({
            order_type: 'takeaway',
            payment_method: 'cash',
            items: [{ id: bizB.dishId, name: 'Samosa', price: 30, quantity: 1 }]
          })
        }).then(async (r) => {
          assert.equal(r.status, 200);
          return r.json();
        })
      ));
      const orderNums = results.map(r => r.order_number).sort((a, b) => a - b);
      const tokenNums = results.map(r => r.token_number).sort((a, b) => a - b);
      assert.deepEqual(orderNums, [3, 4, 5]);
      assert.deepEqual(tokenNums, [2, 3, 4]);
    });

    await testAsync('4. orderNumberHelper resolves clear per-business bill/order labels without # symbol or table name', async () => {
      const sample = { id: 984, order_number: 7, table_number: '5' };
      assert.equal(resolveBusinessOrderNumber(sample), '7');
      assert.equal(formatOrderLabel(sample), 'Order No: 7');
      assert.equal(formatOrderLabel(sample, 'hi'), 'ऑर्डर नं. 7');
      assert.equal(formatOrderBillNumber(sample, false), '7');
      assert.equal(formatOrderBillNumber(sample, true), 'INV-7');
      assert.equal(formatOrderBillNumber({ id: 984, order_number: 7, bill_summary: { primary_order_number: 2 } }, true), 'INV-2');
      assert.equal(formatOrderLabel({ id: 42 }), 'Order No: 42');
    });
    await testAsync('5. Legacy NULL order_number rows backfill cleanly per restaurant without colliding on next order', async () => {
      await query(
        `INSERT INTO orders (restaurant_id, table_number, items, total_amount, status, created_at) VALUES ($1, '9', '[]', 50, 'completed', $2)`,
        [bizA.id, new Date().toISOString()]
      );
      await query(`UPDATE orders SET order_number = NULL WHERE restaurant_id = $1`, [bizA.id]);
      await query(`UPDATE restaurants SET order_seq_counter = 0 WHERE id = $1`, [bizA.id]);

      // Simulate startup migration backfill logic on legacy NULL rows
      const missing = await query(
        'SELECT id FROM orders WHERE restaurant_id = $1 AND order_number IS NULL ORDER BY id ASC',
        [bizA.id]
      );
      assert.equal(missing.length, 4, 'Biz A should have 4 historical orders to backfill');
      let seq = 0;
      for (const row of missing) {
        seq += 1;
        await query('UPDATE orders SET order_number = $1 WHERE id = $2', [seq, row.id]);
      }
      await query('UPDATE restaurants SET order_seq_counter = $1 WHERE id = $2', [seq, bizA.id]);

      const nextAllocated = await withTransaction((txQuery) =>
        allocateRestaurantOrderNumbers(txQuery, bizA.id, { isTakeaway: false, dbType: getDbType() })
      );
      assert.equal(nextAllocated.orderNumber, 5, 'Next order after 4 backfilled rows must be 5');
    });
  } finally {
    server.closeAllConnections?.();
    server.close();
  }

  console.log(`\nSUMMARY: ${passed} PASSED | ${failed} FAILED`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
