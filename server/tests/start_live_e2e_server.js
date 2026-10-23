/**
 * TOUCHQR — LIVE E2E BACKGROUND SERVER
 * Runs on http://localhost:5055 with disposable test database.
 */

import path from 'path';
import fs from 'fs';
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DISPOSABLE_DB_FILE = 'menu_live_e2e_disposable.db';
const DISPOSABLE_DB_PATH = path.resolve(DISPOSABLE_DB_FILE);

try {
  if (fs.existsSync(DISPOSABLE_DB_PATH)) {
    fs.unlinkSync(DISPOSABLE_DB_PATH);
  }
} catch (_) {}

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = `sqlite:${DISPOSABLE_DB_FILE}`;
process.env.PORT = '5055';
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

const { validateTestDatabaseUrl } = await import('./testDbGuard.js');
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const { initDb, query, getDbType } = await import('../db.js');
await initDb();

const { generateHmacQrToken } = await import('../utils/qrSecurity.js');
const { default: app } = await import('../index.js');

// Known constant secrets for live browser session
const tenantASecret = 'c0ffee1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const tenantBSecret = 'beef001234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const adminPasswordHash = await bcrypt.hash('admin123', 10);
const kdsPinAHash = await bcrypt.hash('1234', 10);
const kdsPinBHash = await bcrypt.hash('5678', 10);

const now = new Date();
const trialEnd = new Date(now.getTime() + 30 * 86400 * 1000);
const graceEnd = new Date(now.getTime() + 37 * 86400 * 1000);

// Tenant A (Demo Restaurant with Counter Enabled)
const restoARes = await query(`
  INSERT INTO restaurants (
    name, slug, tagline, phone, address, active, plan_tier, plan_price,
    counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
    direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
`, [
  'TouchQR Demo Restaurant', 'touchqr-demo', 'Finest Flavors', '+919876543210',
  '101 Gourmet Ave', 1, 'enterprise', 1999,
  1, 10, tenantASecret, kdsPinAHash, 1,
  1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
]);
const restoAId = restoARes.lastInsertRowid || 1;

await query(`
  INSERT INTO subscriptions (
    restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
    trial_start, trial_end, current_period_start, current_period_end, grace_period_expires_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
`, [
  restoAId, 3, 'none', 'active', 1999, 'INR', 'monthly',
  now.toISOString(), trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
]);

await query(`
  INSERT INTO admins (restaurant_id, username, password_hash, role)
  VALUES ($1, $2, $3, $4)
`, [restoAId, 'demo_admin', adminPasswordHash, 'restaurant_admin']);

const cat1Res = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoAId, 'Starters', 1]);
const cat1Id = cat1Res.lastInsertRowid || 1;
const cat2Res = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoAId, 'Main Course', 1]);
const cat2Id = cat2Res.lastInsertRowid || 2;
const cat3Res = await query('INSERT INTO categories (restaurant_id, name, active) VALUES ($1, $2, $3)', [restoAId, 'Desserts', 1]);
const cat3Id = cat3Res.lastInsertRowid || 3;

await query(`
  INSERT INTO dishes (restaurant_id, category_id, name, price, type, available, description)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [restoAId, cat1Id, 'Crispy Paneer Tikka', 250, 'veg', 1, 'Cottage cheese grilled with spices']);

await query(`
  INSERT INTO dishes (restaurant_id, category_id, name, price, type, available, description)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [restoAId, cat2Id, 'Butter Chicken Special', 350, 'nonveg', 1, 'Rich creamy tomato gravy with chicken']);

await query(`
  INSERT INTO dishes (restaurant_id, category_id, name, price, type, available, description)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [restoAId, cat3Id, 'Gulab Jamun with Ice Cream', 120, 'veg', 1, 'Warm dumplings with vanilla ice cream']);

// Seed synthetic ready order for billing investigation
await query(`
  INSERT INTO orders (
    restaurant_id, customer_name, table_number, status, total_amount, is_settled,
    kitchen_prepared, sent_to_kds, items, payment_method, created_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
`, [
  restoAId, 'Test Diner', '1', 'served', 250, 0,
  1, 1, JSON.stringify([{ id: 1, name: 'Crispy Paneer Tikka', price: 250, quantity: 1 }]), 'cash',
  new Date().toISOString()
]);

// Tenant B
const restoBRes = await query(`
  INSERT INTO restaurants (
    name, slug, tagline, phone, address, active, plan_tier, plan_price,
    counter_ordering_enabled, total_tables, qr_secret, kds_pin_hash, kds_auth_version,
    direct_ordering_enabled, order_retention_days, trial_started_at, trial_ends_at, grace_period_expires_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
`, [
  'Tenant B Bistro', 'tenant-b-bistro', 'Artisanal Cafe', '+919876543211',
  '202 High St', 1, 'enterprise', 1999,
  0, 5, tenantBSecret, kdsPinBHash, 1,
  1, 90, now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
]);
const restoBId = restoBRes.lastInsertRowid || 2;

await query(`
  INSERT INTO subscriptions (
    restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
    trial_start, trial_end, current_period_start, current_period_end, grace_period_expires_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
`, [
  restoBId, 3, 'none', 'active', 1999, 'INR', 'monthly',
  now.toISOString(), trialEnd.toISOString(), now.toISOString(), trialEnd.toISOString(), graceEnd.toISOString()
]);

await query(`
  INSERT INTO admins (restaurant_id, username, password_hash, role)
  VALUES ($1, $2, $3, $4)
`, [restoBId, 'tenant_b_admin', adminPasswordHash, 'restaurant_admin']);

// Master superadmin is auto-provisioned by initDb() with credentials: superadmin / superadmin123

// Generate URLs
const table1Token = generateHmacQrToken('touchqr-demo', 'table', '1', tenantASecret);
const counterToken = generateHmacQrToken('touchqr-demo', 'counter', 'COUNTER', tenantASecret);

const table1Url = `http://localhost:5055/touchqr-demo?table=1&tkn=${table1Token}`;
const counterUrl = `http://localhost:5055/touchqr-demo?counter=1&tkn=${counterToken}`;

console.log('======================================================================');
console.log('⚡ TOUCHQR LIVE E2E TEST SERVER STARTED');
console.log('======================================================================');
console.log(`🌐 Base URL: http://localhost:5055`);
console.log(`🍽️ Table 1 QR URL: ${table1Url}`);
console.log(`⚡ Counter QR URL: ${counterUrl}`);
console.log(`🔑 Tenant A Admin: demo_admin / admin123 (http://localhost:5055/admin)`);
console.log(`🔑 Superadmin    : superadmin / superadmin123 (http://localhost:5055/superadmin)`);
console.log(`🍳 Kitchen KDS   : PIN 1234 (http://localhost:5055/touchqr-demo/kitchen)`);
console.log('======================================================================\n');

app.listen(5055, () => {
  console.log('🚀 Server is ready and listening on port 5055.');
});
