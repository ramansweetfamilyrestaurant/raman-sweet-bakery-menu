import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = 'sqlite:test_superadmin_batch.db';
}

import { query } from '../db.js';
import superadminRouter from '../routes/superadmin.js';
import { JWT_SECRET } from '../config/jwt.js';

function makeRequest(server, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (bodyData && !reqOptions.headers['Content-Type']) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(reqOptions, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          text: rawData
        });
      });
    });

    req.on('error', reject);
    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

test('⚡ Super Admin Batch SaaS Plans Save Suite', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin', superadminRouter);

  const server = http.createServer(app);
  await new Promise(res => server.listen(0, '127.0.0.1', res));

  // Prepare plans in DB
  await query("DELETE FROM saas_plans WHERE key IN ('test_batch_1', 'test_batch_2')");
  await query(`
    INSERT INTO saas_plans (key, name, price, original_price, badge, counter_ordering_enabled, industry)
    VALUES 
      ('test_batch_1', 'Batch Plan 1', 199, 399, '⚡ BATCH1', 0, 'restaurant'),
      ('test_batch_2', 'Batch Plan 2', 499, 999, '⚡ BATCH2', 1, 'restaurant')
  `);

  const superToken = jwt.sign({ role: 'superadmin', username: 'superadmin' }, JWT_SECRET, { expiresIn: '1h' });

  await t.test('1. PUT /api/superadmin/plans/batch updates multiple plans instantly', async () => {
    const startTime = Date.now();
    const batchRes = await makeRequest(server, {
      path: '/api/superadmin/plans/batch',
      method: 'PUT',
      headers: { Authorization: `Bearer ${superToken}` }
    }, {
      plans: [
        {
          key: 'test_batch_1',
          name: 'Batch Plan 1 Updated',
          price: 249,
          counter_ordering_enabled: 1,
          tables_enabled: 1
        },
        {
          key: 'test_batch_2',
          name: 'Batch Plan 2 Updated',
          price: 549,
          counter_ordering_enabled: 0,
          tables_enabled: 1
        }
      ]
    });
    const elapsed = Date.now() - startTime;

    assert.strictEqual(batchRes.status, 200, `Batch update should return 200 (got ${batchRes.status})`);
    assert.strictEqual(batchRes.body.success, true);
    assert.ok(elapsed < 1000, `Batch update should complete well under 1 second (took ${elapsed}ms)`);

    // Verify database state
    const p1Rows = await query("SELECT * FROM saas_plans WHERE key = 'test_batch_1'");
    const p2Rows = await query("SELECT * FROM saas_plans WHERE key = 'test_batch_2'");

    assert.strictEqual(p1Rows[0].counter_ordering_enabled, 1, 'test_batch_1 should now have counter_ordering_enabled = 1');
    assert.strictEqual(p1Rows[0].price, 249, 'test_batch_1 price should be 249');
    assert.strictEqual(p2Rows[0].counter_ordering_enabled, 0, 'test_batch_2 should now have counter_ordering_enabled = 0');
    assert.strictEqual(p2Rows[0].price, 549, 'test_batch_2 price should be 549');
  });

  // Clean up
  await query("DELETE FROM saas_plans WHERE key IN ('test_batch_1', 'test_batch_2')");
  await new Promise(res => server.close(res));
  process.exit(0);
});
