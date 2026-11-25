import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';

import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEMP_DB_FILE = `test_theme_gating_disposable.db`;
process.env.TEST_DATABASE_URL = `sqlite:${TEMP_DB_FILE}`;
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { query, initDb } from '../db.js';
import adminRouter from '../routes/admin.js';
import { JWT_SECRET } from '../config/jwt.js';
import {
  isValidThemeKey,
  resolveThemeKey,
  resolvePlanAllowedThemes,
  isThemeAllowedForPlan
} from '../config/themes.js';
import {
  isValidTheme as isClientValidTheme,
  resolveTheme as resolveClientTheme,
  isThemeAllowedForPlan as isClientThemeAllowedForPlan
} from '../../src/constants/themes.js';

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
    if (body) req.write(JSON.stringify(body));
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

  await check('theme helper validation and alias resolution', () => {
    assert.strictEqual(isValidThemeKey('gold'), true);
    assert.strictEqual(isValidThemeKey('dark'), true);
    assert.strictEqual(isValidThemeKey('cyber'), true);
    assert.strictEqual(isValidThemeKey('neon_fake'), false);

    assert.strictEqual(resolveThemeKey('cyber'), 'dark');
    assert.strictEqual(resolveThemeKey('default'), 'gold');
    assert.strictEqual(resolveThemeKey('emerald'), 'emerald');
    assert.strictEqual(resolveThemeKey('unknown'), 'gold');

    assert.strictEqual(resolvePlanAllowedThemes(null, 'basic'), 'gold');
    assert.strictEqual(resolvePlanAllowedThemes(null, 'hotel_basic'), 'gold');
    assert.strictEqual(resolvePlanAllowedThemes(null, 'cinema_basic'), 'gold');
    assert.strictEqual(resolvePlanAllowedThemes(null, 'pro'), 'gold,emerald,crimson,navy');
    assert.strictEqual(resolvePlanAllowedThemes(null, 'hotel_pro'), 'gold,emerald,crimson,navy');
    assert.strictEqual(resolvePlanAllowedThemes(null, 'enterprise'), 'ALL');
    assert.strictEqual(resolvePlanAllowedThemes(null, 'hotel_enterprise'), 'ALL');
    assert.strictEqual(resolvePlanAllowedThemes({ allowed_themes: 'gold,emerald' }, 'hotel_basic'), 'gold,emerald');

    assert.strictEqual(isThemeAllowedForPlan('gold', 'gold'), true);
    assert.strictEqual(isThemeAllowedForPlan('dark', 'gold'), false);
    assert.strictEqual(isThemeAllowedForPlan('gold', ',emerald, '), false);
    assert.strictEqual(isThemeAllowedForPlan('gold', 'emerald,'), false);
    assert.strictEqual(isThemeAllowedForPlan('gold', 'invalid_theme,emerald'), false);
    assert.strictEqual(isThemeAllowedForPlan('emerald', 'gold,emerald,crimson,navy'), true);
    assert.strictEqual(isThemeAllowedForPlan('purple', 'gold,emerald,crimson,navy'), false);
    assert.strictEqual(isThemeAllowedForPlan('cyber', 'ALL'), true);

    assert.strictEqual(isClientValidTheme('constructor'), false);
    assert.strictEqual(isClientValidTheme('toString'), false);
    assert.strictEqual(isClientValidTheme('cyber'), true);
    assert.strictEqual(resolveClientTheme('constructor').key, 'gold');
    assert.strictEqual(isClientThemeAllowedForPlan('gold', 'constructor,emerald'), false);
    assert.strictEqual(isClientThemeAllowedForPlan('emerald', 'constructor,emerald'), true);
  });

  await initDb();

  await query("DELETE FROM saas_plans WHERE key IN ('basic', 'pro', 'enterprise')");
  await query(
    "INSERT INTO saas_plans (key, name, price, allowed_themes) VALUES ('basic', 'Basic', 299, 'gold'), ('pro', 'Pro', 999, 'gold,emerald,crimson,navy'), ('enterprise', 'Enterprise', 1999, 'ALL')"
  );

  const futureIso = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  const pastIso = new Date(Date.now() - 5 * 86400 * 1000).toISOString();
  await query("DELETE FROM subscriptions WHERE restaurant_id IN (901, 902, 903, 904, 905)");
  await query("DELETE FROM restaurants WHERE id IN (901, 902, 903, 904, 905)");
  await query("DELETE FROM admins WHERE id IN (901, 902, 903, 904, 905)");
  await query("INSERT INTO restaurants (id, name, slug, plan_tier, theme_color, active, mandate_status, plan_expires_at, subscription_type) VALUES (901, 'Basic Cafe', 'basic-cafe', 'basic', 'gold', 1, 'active', $1, 'RAZORPAY')", [futureIso]);
  await query("INSERT INTO restaurants (id, name, slug, plan_tier, theme_color, active, mandate_status, plan_expires_at, subscription_type) VALUES (902, 'Pro Bistro', 'pro-bistro', 'pro', 'gold', 1, 'active', $1, 'RAZORPAY')", [futureIso]);
  await query("INSERT INTO restaurants (id, name, slug, plan_tier, theme_color, active, subscription_type, mandate_status) VALUES (903, 'VIP Lounge', 'vip-lounge', 'basic', 'gold', 1, 'ADMIN_GRANTED', 'admin_granted')");
  await query("INSERT INTO restaurants (id, name, slug, plan_tier, theme_color, active, mandate_status, plan_expires_at, subscription_type) VALUES (904, 'Downgraded Bistro', 'downgraded-bistro', 'basic', 'emerald', 1, 'active', $1, 'RAZORPAY')", [futureIso]);
  await query("INSERT INTO restaurants (id, name, slug, plan_tier, plan_price, theme_color, active, mandate_status, plan_expires_at, subscription_type) VALUES (905, 'Expired VIP Diner', 'expired-vip-diner', 'basic', 499, 'gold', 1, 'active', $1, 'ADMIN_GRANTED')", [pastIso]);
  await query("INSERT INTO subscriptions (restaurant_id, gateway, status, amount, currency, current_period_end, subscription_type) VALUES (905, 'razorpay', 'active', 499, 'INR', $1, 'PAID')", [futureIso]);

  await query("INSERT INTO admins (id, restaurant_id, username, password_hash, role) VALUES (901, 901, 'adm901', 'hash', 'restaurant_admin')");
  await query("INSERT INTO admins (id, restaurant_id, username, password_hash, role) VALUES (902, 902, 'adm902', 'hash', 'restaurant_admin')");
  await query("INSERT INTO admins (id, restaurant_id, username, password_hash, role) VALUES (903, 903, 'adm903', 'hash', 'restaurant_admin')");
  await query("INSERT INTO admins (id, restaurant_id, username, password_hash, role) VALUES (904, 904, 'adm904', 'hash', 'restaurant_admin')");
  await query("INSERT INTO admins (id, restaurant_id, username, password_hash, role) VALUES (905, 905, 'adm905', 'hash', 'restaurant_admin')");

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const tok901 = jwt.sign({ id: 901, restaurant_id: 901, role: 'restaurant_admin', username: 'adm901' }, JWT_SECRET);
  const tok902 = jwt.sign({ id: 902, restaurant_id: 902, role: 'restaurant_admin', username: 'adm902' }, JWT_SECRET);
  const tok903 = jwt.sign({ id: 903, restaurant_id: 903, role: 'restaurant_admin', username: 'adm903' }, JWT_SECRET);
  const tok904 = jwt.sign({ id: 904, restaurant_id: 904, role: 'restaurant_admin', username: 'adm904' }, JWT_SECRET);
  const tok905 = jwt.sign({ id: 905, restaurant_id: 905, role: 'restaurant_admin', username: 'adm905' }, JWT_SECRET);

  try {
    await check('rejects unknown theme_color with 400', async () => {
      const res = await requestJson(server, 'PUT', '/api/admin/settings', tok901, { theme_color: 'ultraviolet_fake' });
      assert.strictEqual(res.status, 400);
    });

    await check('blocks Basic tenant from selecting locked dark theme (403 feature_locked)', async () => {
      const res = await requestJson(server, 'PUT', '/api/admin/settings', tok901, { theme_color: 'dark' });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body?.error, 'feature_locked');
      assert.strictEqual(res.body?.feature, 'allowed_themes');
      assert.strictEqual(res.body?.allowed_themes, 'gold');
    });

    await check('allows Pro tenant to select emerald but blocks dark', async () => {
      const okRes = await requestJson(server, 'PUT', '/api/admin/settings', tok902, { theme_color: 'emerald' });
      assert.strictEqual(okRes.status, 200);
      const rows = await query('SELECT theme_color FROM restaurants WHERE id = 902');
      assert.strictEqual(rows[0].theme_color, 'emerald');

      const lockRes = await requestJson(server, 'PUT', '/api/admin/settings', tok902, { theme_color: 'dark' });
      assert.strictEqual(lockRes.status, 403);
    });

    await check('allows complimentary VIP tenant on basic plan_tier to unlock all themes and normalizes cyber -> dark', async () => {
      const meRes = await requestJson(server, 'GET', '/api/admin/me', tok903);
      assert.strictEqual(meRes.status, 200);
      assert.strictEqual(meRes.body?.restaurant?.allowed_themes, 'ALL');

      const okRes = await requestJson(server, 'PUT', '/api/admin/settings', tok903, { theme_color: 'cyber' });
      assert.strictEqual(okRes.status, 200);
      const rows = await query('SELECT theme_color FROM restaurants WHERE id = 903');
      assert.strictEqual(rows[0].theme_color, 'dark');
    });

    await check('allows downgraded tenant to update unrelated settings when unchanged theme_color stays emerald', async () => {
      const okRes = await requestJson(server, 'PUT', '/api/admin/settings', tok904, {
        name: 'Downgraded Bistro Updated',
        theme_color: 'emerald'
      });
      assert.strictEqual(okRes.status, 200);
      const rows = await query('SELECT name, theme_color FROM restaurants WHERE id = 904');
      assert.strictEqual(rows[0].name, 'Downgraded Bistro Updated');
      assert.strictEqual(rows[0].theme_color, 'emerald');
    });

    await check('blocks expired complimentary grant from bypassing plan theme gating', async () => {
      const res = await requestJson(server, 'PUT', '/api/admin/settings', tok905, { theme_color: 'dark' });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body?.error, 'feature_locked');
      assert.strictEqual(res.body?.allowed_themes, 'gold');
    });

    console.log(`\nTheme gating suite: ${passed} passed, 0 failed`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      const fullPath = path.resolve(process.cwd(), TEMP_DB_FILE);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (_) {}
  }
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
