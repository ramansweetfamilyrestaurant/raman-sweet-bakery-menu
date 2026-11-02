/**
 * TOUCHQR — LIVE THREE MODELS COMPREHENSIVE E2E PROOF SUITE
 * 
 * Demonstrates live ordering, KDS dispatch, staff assistance, and billing settlement across:
 * 1. DINE-IN (Royal Spice Dine-In - Table 5)
 * 2. HOTEL (Grand Heritage Resort - Room 204)
 * 3. CINEMA (PVR Deluxe Cinemas - Screen 1, Row C, Seat 8)
 * 4. COUNTER ATTEMPT REJECTION (Strict elimination verified)
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DISPOSABLE_DB = 'menu_live_3models_proof.db';
const DB_PATH = path.resolve(DISPOSABLE_DB);

try {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
} catch (_) {}

process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = `sqlite:${DISPOSABLE_DB}`;
process.env.ENABLE_DEMO_TENANT_SEED = 'false';

const { validateTestDatabaseUrl } = await import('./testDbGuard.js');
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

const { initDb, query } = await import('../db.js');
await initDb();

const { JWT_SECRET } = await import('../config/jwt.js');
const { default: app } = await import('../index.js');
const { generateHmacQrToken } = await import('../utils/qrSecurity.js');
const { generatePresenceToken, generateQrContextHash } = await import('../utils/presenceVerification.js');

const server = http.createServer(app);
await new Promise(resolve => server.listen(0, resolve));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

console.log('======================================================================');
console.log('🚀 TOUCHQR — LIVE THREE-MODEL END-TO-END DEMO & PROOF');
console.log(`⚡ Server active on: ${BASE}`);
console.log('======================================================================\n');

async function api(endpoint, opts = {}) {
  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

const proofLog = [];
function logStep(model, step, status, details = {}) {
  const line = { model, step, status, details, time: new Date().toISOString() };
  proofLog.push(line);
  console.log(`  [${model}] ${step} ➔ ${status} ${Object.keys(details).length ? JSON.stringify(details) : ''}`);
}

try {
  // -------------------------------------------------------------------------
  // 1. SETUP TENANTS
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 1: PROVISIONING 3 INDUSTRY TENANTS ---');
  
  const hashPass = await bcrypt.hash('password123', 10);
  const secretDine = 'secret_dine_998877';
  const secretHotel = 'secret_hotel_665544';
  const secretCinema = 'secret_cinema_332211';

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 30 * 86400 * 1000).toISOString();
  const graceEnd = new Date(now.getTime() + 37 * 86400 * 1000).toISOString();

  // 1.1 Dine-In
  const dineResto = await query(`
    INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, qr_secret, total_tables, total_cabins, total_vip, counter_ordering_enabled, active, trial_started_at, trial_ends_at, grace_period_expires_at)
    VALUES ('Royal Spice Dine-In', 'royal-spice', 'restaurant', 'dine_in', 'enterprise', $1, 15, 3, 2, 0, 1, $2, $3, $4)
    RETURNING id, name, slug, qr_secret
  `, [secretDine, now.toISOString(), trialEnd, graceEnd]);
  const dineId = dineResto[0].id;

  await query(`INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, 'admin_dine', $2, 'restaurant_admin')`, [dineId, hashPass]);
  const dineCat = await query(`INSERT INTO categories (restaurant_id, name, sort_order) VALUES ($1, 'Main Course', 1) RETURNING id`, [dineId]);
  const dineDish = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, 'Paneer Tikka Masala', 320, 1) RETURNING id, name, price`, [dineId, dineCat[0].id]);
  const dineToken = jwt.sign({ id: 101, userId: 101, username: 'admin_dine', role: 'restaurant_admin', restaurant_id: dineId, restaurantId: dineId, slug: 'royal-spice' }, JWT_SECRET);
  logStep('DINE-IN', 'Tenant Provisioned', 'SUCCESS', { id: dineId, slug: 'royal-spice', dish: dineDish[0].name });

  // 1.2 Hotel
  const hotelResto = await query(`
    INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, qr_secret, total_rooms, counter_ordering_enabled, active, trial_started_at, trial_ends_at, grace_period_expires_at)
    VALUES ('Grand Heritage Resort', 'grand-heritage', 'hotel_resort', 'hotel', 'hotel_pro', $1, 300, 0, 1, $2, $3, $4)
    RETURNING id, name, slug, qr_secret
  `, [secretHotel, now.toISOString(), trialEnd, graceEnd]);
  const hotelId = hotelResto[0].id;

  await query(`INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, 'admin_hotel', $2, 'restaurant_admin')`, [hotelId, hashPass]);
  const hotelCat = await query(`INSERT INTO categories (restaurant_id, name, sort_order) VALUES ($1, 'In-Room Dining', 1) RETURNING id`, [hotelId]);
  const hotelDish = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, 'Club Sandwich & Fries', 280, 1) RETURNING id, name, price`, [hotelId, hotelCat[0].id]);
  const hotelToken = jwt.sign({ id: 102, userId: 102, username: 'admin_hotel', role: 'restaurant_admin', restaurant_id: hotelId, restaurantId: hotelId, slug: 'grand-heritage' }, JWT_SECRET);
  logStep('HOTEL', 'Tenant Provisioned', 'SUCCESS', { id: hotelId, slug: 'grand-heritage', dish: hotelDish[0].name });

  // 1.3 Cinema
  const cinemaResto = await query(`
    INSERT INTO restaurants (name, slug, business_type, service_model, plan_tier, qr_secret, total_screens, total_seats, counter_ordering_enabled, active, trial_started_at, trial_ends_at, grace_period_expires_at)
    VALUES ('PVR Deluxe Cinema', 'pvr-deluxe', 'cinema_theatre', 'cinema', 'cinema_pro', $1, 3, 300, 0, 1, $2, $3, $4)
    RETURNING id, name, slug, qr_secret
  `, [secretCinema, now.toISOString(), trialEnd, graceEnd]);
  const cinemaId = cinemaResto[0].id;

  // Insert Cinema Screen 1 and Seat S1-C-8 into DB
  const scrRes = await query(`
    INSERT INTO restaurant_cinema_screens (restaurant_id, screen_number, name, active)
    VALUES ($1, 1, 'Audi 1 - Dolby Atmos', 1)
    RETURNING id
  `, [cinemaId]);
  const cinemaScreenId = scrRes[0].id;

  await query(`
    INSERT INTO restaurant_cinema_seats (restaurant_id, screen_id, row_label, seat_number, seat_code, active)
    VALUES ($1, $2, 'C', 8, 'S1-C-8', 1)
  `, [cinemaId, cinemaScreenId]);

  await query(`INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, 'admin_cinema', $2, 'restaurant_admin')`, [cinemaId, hashPass]);
  const cinemaCat = await query(`INSERT INTO categories (restaurant_id, name, sort_order) VALUES ($1, 'Concessions', 1) RETURNING id`, [cinemaId]);
  const cinemaDish = await query(`INSERT INTO dishes (restaurant_id, category_id, name, price, available) VALUES ($1, $2, 'Cheese Caramel Popcorn', 250, 1) RETURNING id, name, price`, [cinemaId, cinemaCat[0].id]);
  const cinemaToken = jwt.sign({ id: 103, userId: 103, username: 'admin_cinema', role: 'restaurant_admin', restaurant_id: cinemaId, restaurantId: cinemaId, slug: 'pvr-deluxe' }, JWT_SECRET);
  logStep('CINEMA', 'Tenant Provisioned', 'SUCCESS', { id: cinemaId, slug: 'pvr-deluxe', screen: 'Audi 1', seat: 'S1-C-8', dish: cinemaDish[0].name });

  // -------------------------------------------------------------------------
  // 2. LIVE DINE-IN E2E TEST (TABLE 5)
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 2: DINE-IN LIVE ORDER & BILLING (TABLE 5) ---');
  
  const dineQrToken = generateHmacQrToken('royal-spice', 'table', '5', secretDine);
  const dineQrHash = generateQrContextHash('royal-spice', 'table', '5', dineQrToken);
  const dinePresenceToken = generatePresenceToken({
    verificationToken: 'vtok_dine_01',
    restaurantId: dineId,
    slug: 'royal-spice',
    spaceType: 'table',
    spaceNumber: '5',
    verificationMethod: 'GPS',
    qrContextHash: dineQrHash,
    expiryMinutes: 60
  });

  // 2.1 Customer places order
  const dineOrderRes = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'royal-spice',
      table_number: '5',
      space_type: 'table',
      table_token: dineQrToken,
      presence_token: dinePresenceToken,
      customer_name: 'Rahul Sharma',
      items: [{ dish_id: dineDish[0].id, quantity: 2 }]
    })
  });
  assert.equal(dineOrderRes.status, 200);
  assert.ok(dineOrderRes.data.order_id);
  const dineOrderId = dineOrderRes.data.order_id;
  logStep('DINE-IN', 'Order Placed by Customer', 'SUCCESS', { orderId: dineOrderId, table: '5', items: 2, total: 640 });

  // 2.2 Customer calls waiter
  const dineServiceCall = await api('/api/service-requests', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'royal-spice',
      table_number: '5',
      space_type: 'table',
      table_token: dineQrToken,
      request_type: 'Water Bottle & Extra Cutlery 🍽️'
    })
  });
  assert.equal(dineServiceCall.status, 200);
  assert.ok(dineServiceCall.data.success);
  logStep('DINE-IN', 'Waiter Call Notified', 'SUCCESS', { table: '5', msg: dineServiceCall.data.message });

  // 2.3 Admin checks live orders
  const dineOrdersList = await api(`/api/admin/orders?slug=royal-spice`, {
    headers: { Authorization: `Bearer ${dineToken}` }
  });
  assert.equal(dineOrdersList.status, 200);
  assert.ok(Array.isArray(dineOrdersList.data));
  const dineFound = dineOrdersList.data.find(o => o.id === dineOrderId);
  assert.ok(dineFound, 'Order must appear in admin list');
  assert.equal(dineFound.table_number, '5');
  logStep('DINE-IN', 'Admin Live Order Feed Received', 'SUCCESS', { orderId: dineOrderId, status: dineFound.status });

  // 2.4 Send order to KDS / Kitchen
  const dineKds = await api(`/api/admin/orders/${dineOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${dineToken}` },
    body: JSON.stringify({ status: 'kitchen', sent_to_kds: 1 })
  });
  assert.equal(dineKds.status, 200);
  assert.equal(dineKds.data.status, 'kitchen');
  assert.equal(dineKds.data.sent_to_kds, 1);
  logStep('DINE-IN', 'Order Routed to Kitchen Display (KDS)', 'SUCCESS', { status: 'kitchen', sent_to_kds: 1 });

  // 2.5 Kitchen marks food as prepared
  const dineReady = await api(`/api/admin/orders/${dineOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${dineToken}` },
    body: JSON.stringify({ status: 'ready', kitchen_prepared: 1 })
  });
  assert.equal(dineReady.status, 200);
  assert.equal(dineReady.data.status, 'ready');
  assert.equal(dineReady.data.kitchen_prepared, 1);
  logStep('DINE-IN', 'Chef Marked Food Ready', 'SUCCESS', { status: 'ready', kitchen_prepared: 1 });

  // 2.6 Cash Settlement by Staff
  const dineSettle = await api(`/api/admin/orders/${dineOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${dineToken}` },
    body: JSON.stringify({
      status: 'completed',
      settle: { method: 'cash', amount_received: 640 }
    })
  });
  assert.equal(dineSettle.status, 200);
  assert.equal(dineSettle.data.is_settled, 1);
  assert.equal(dineSettle.data.payment_method, 'cash');
  assert.equal(dineSettle.data.status, 'completed');
  logStep('DINE-IN', 'Bill Paid & Settled (Cash)', 'SUCCESS', { settled: 1, paymentMethod: 'cash', status: 'completed' });

  // -------------------------------------------------------------------------
  // 3. LIVE HOTEL E2E TEST (ROOM 204)
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 3: HOTEL LIVE ORDER, AMENITIES & SETTLEMENT (ROOM 204) ---');

  const hotelQrToken = generateHmacQrToken('grand-heritage', 'room', '204', secretHotel);
  const hotelQrHash = generateQrContextHash('grand-heritage', 'room', '204', hotelQrToken);
  const hotelPresenceToken = generatePresenceToken({
    verificationToken: 'vtok_hotel_02',
    restaurantId: hotelId,
    slug: 'grand-heritage',
    spaceType: 'room',
    spaceNumber: '204',
    verificationMethod: 'GPS',
    qrContextHash: hotelQrHash,
    expiryMinutes: 60
  });

  // 3.1 Guest places in-room dining order
  const hotelOrderRes = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'grand-heritage',
      table_number: '204',
      space_type: 'room',
      table_token: hotelQrToken,
      presence_token: hotelPresenceToken,
      customer_name: 'Ananya Verma',
      items: [{ dish_id: hotelDish[0].id, quantity: 1 }]
    })
  });
  assert.equal(hotelOrderRes.status, 200);
  assert.ok(hotelOrderRes.data.order_id);
  const hotelOrderId = hotelOrderRes.data.order_id;
  logStep('HOTEL', 'In-Room Dining Order Placed', 'SUCCESS', { orderId: hotelOrderId, room: '204', total: 280 });

  // 3.2 Guest requests Amenities (Housekeeping / Toiletries)
  const hotelServiceCall = await api('/api/service-requests', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'grand-heritage',
      table_number: '204',
      space_type: 'room',
      table_token: hotelQrToken,
      request_type: 'Hotel Amenities & Toiletries 🪥'
    })
  });
  assert.equal(hotelServiceCall.status, 200);
  assert.ok(hotelServiceCall.data.success);
  logStep('HOTEL', 'Room Service Amenities Requested', 'SUCCESS', { room: '204', msg: hotelServiceCall.data.message });

  // 3.3 Admin sends order to kitchen
  const hotelKds = await api(`/api/admin/orders/${hotelOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hotelToken}` },
    body: JSON.stringify({ status: 'kitchen', sent_to_kds: 1 })
  });
  assert.equal(hotelKds.status, 200);
  logStep('HOTEL', 'Room Order Cooking in Kitchen', 'SUCCESS', { status: 'kitchen' });

  // 3.4 Prepared and dispatched to room
  const hotelReady = await api(`/api/admin/orders/${hotelOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hotelToken}` },
    body: JSON.stringify({ status: 'ready', kitchen_prepared: 1 })
  });
  assert.equal(hotelReady.status, 200);
  logStep('HOTEL', 'Order Delivered to Room 204', 'SUCCESS', { status: 'ready' });

  // 3.5 Settle bill (Card / Room Folio)
  const hotelSettle = await api(`/api/admin/orders/${hotelOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${hotelToken}` },
    body: JSON.stringify({
      status: 'completed',
      settle: { method: 'card', amount_received: 280 }
    })
  });
  assert.equal(hotelSettle.status, 200);
  assert.equal(hotelSettle.data.is_settled, 1);
  assert.equal(hotelSettle.data.payment_method, 'card');
  assert.equal(hotelSettle.data.status, 'completed');
  logStep('HOTEL', 'Room Bill Settled (Card / Room Folio)', 'SUCCESS', { settled: 1, paymentMethod: 'card' });

  // -------------------------------------------------------------------------
  // 4. LIVE CINEMA E2E TEST (SCREEN 1 • ROW C • SEAT 8)
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 4: CINEMA LIVE CONCESSION & DISPATCH (SCREEN 1, SEAT C8) ---');

  const seatIdentifier = 'Screen 1 • Row C • Seat 8';
  const cinemaQrToken = generateHmacQrToken('pvr-deluxe', 'cinema_seat', 'S1-C-8', secretCinema);
  const cinemaQrHash = generateQrContextHash('pvr-deluxe', 'cinema_seat', 'S1-C-8', cinemaQrToken);
  const cinemaPresenceToken = generatePresenceToken({
    verificationToken: 'vtok_cinema_03',
    restaurantId: cinemaId,
    slug: 'pvr-deluxe',
    spaceType: 'cinema_seat',
    spaceNumber: 'S1-C-8',
    verificationMethod: 'GPS',
    qrContextHash: cinemaQrHash,
    expiryMinutes: 60
  });

  // 4.1 In-Seat concession order
  const cinemaOrderRes = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'pvr-deluxe',
      table_number: seatIdentifier,
      space_type: 'cinema_seat',
      table_token: cinemaQrToken,
      presence_token: cinemaPresenceToken,
      customer_name: 'Vikram Mehta',
      items: [{ dish_id: cinemaDish[0].id, quantity: 2 }]
    })
  });
  assert.equal(cinemaOrderRes.status, 200);
  assert.ok(cinemaOrderRes.data.order_id);
  const cinemaOrderId = cinemaOrderRes.data.order_id;
  logStep('CINEMA', 'In-Seat Concession Order Placed', 'SUCCESS', { orderId: cinemaOrderId, seat: 'S1-C-8', total: 500 });

  // 4.2 Patron requests Usher Assistance
  const usherCall = await api('/api/service-requests', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'pvr-deluxe',
      table_number: seatIdentifier,
      space_type: 'cinema_seat',
      table_token: cinemaQrToken,
      request_type: 'Usher / Seat Assistance 🎬'
    })
  });
  assert.equal(usherCall.status, 200);
  assert.ok(usherCall.data.success);
  logStep('CINEMA', 'Usher Assistance Requested', 'SUCCESS', { seat: 'S1-C-8', msg: usherCall.data.message });

  // 4.3 Concession kitchen prepares order
  const cinemaPrep = await api(`/api/admin/orders/${cinemaOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${cinemaToken}` },
    body: JSON.stringify({ status: 'ready', kitchen_prepared: 1 })
  });
  assert.equal(cinemaPrep.status, 200);
  logStep('CINEMA', 'Concessions Packed & Dispatched to Seat', 'SUCCESS', { status: 'ready' });

  // 4.4 Settle concession bill (UPI)
  const cinemaSettle = await api(`/api/admin/orders/${cinemaOrderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${cinemaToken}` },
    body: JSON.stringify({
      status: 'completed',
      settle: { method: 'upi', amount_received: 500 }
    })
  });
  assert.equal(cinemaSettle.status, 200);
  assert.equal(cinemaSettle.data.is_settled, 1);
  assert.equal(cinemaSettle.data.payment_method, 'upi');
  assert.equal(cinemaSettle.data.status, 'completed');
  logStep('CINEMA', 'Concession Paid via UPI & Completed', 'SUCCESS', { settled: 1, paymentMethod: 'upi', status: 'completed' });

  // -------------------------------------------------------------------------
  // 5. COUNTER ORDERING REJECTION TEST
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 5: COUNTER ELIMINATION & REJECTION VERIFICATION ---');

  const counterAttempt = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'royal-spice',
      table_number: 'COUNTER',
      space_type: 'counter',
      items: [{ dish_id: dineDish[0].id, quantity: 1 }]
    })
  });
  assert.ok(counterAttempt.status >= 400, 'Counter ordering must fail closed with HTTP 4xx');
  logStep('COUNTER', 'Direct Counter Order Blocked', 'VERIFIED_REJECTED', { httpStatus: counterAttempt.status, error: counterAttempt.data?.error || counterAttempt.data?.reason });

  console.log('\n======================================================================');
  console.log('🎉 ALL THREE LIVE INDUSTRY FLOWS & COUNTER ELIMINATION VERIFIED 100%');
  console.log('======================================================================\n');

  server.close();
  process.exit(0);

} catch (err) {
  console.error('\n❌ LIVE DEMO RUNNER FAILED:');
  console.error(err);
  server.close();
  process.exit(1);
}
