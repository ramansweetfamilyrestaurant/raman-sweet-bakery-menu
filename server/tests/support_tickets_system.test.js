/**
 * TouchQR — Support Ticket System End-to-End Regression Test Suite
 *
 * Covers:
 * 1. Missing / invalid authentication (tenant & super admin).
 * 2. Cross-tenant isolation (Tenant A cannot list, view, reply to or modify Tenant B's tickets).
 * 3. Client-supplied tenant forgery rejection (server-side authenticated identity enforced).
 * 4. Super Admin authorization (ordinary tenant tokens rejected for global endpoints).
 * 5. Operator assignment safety (ordinary restaurant admins rejected; only superadmins accepted).
 * 6. Atomic ticket creation in transaction (ticket + initial message created together).
 * 7. Comprehensive input validation (categories, priorities, statuses, message lengths).
 * 8. 2-way conversation thread persistence & chronological message ordering.
 * 9. Status transitions, auto-reopen logic, resolution and closure timestamps.
 * 10. Closed ticket reply rejection (replies blocked until explicitly reopened).
 * 11. Subscription bypass verification (expired/suspended tenants can still contact support).
 * 12. Pagination, search, category filtering, and KPI aggregate metrics.
 * 13. Data persistence across database re-initialization.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';
import { query, initDb } from '../db.js';
import adminRoutes from '../routes/admin.js';
import superadminRoutes from '../routes/superadmin.js';
import { JWT_SECRET } from '../config/jwt.js';

const TEST_DB_PATH = path.resolve('menu_test_support_tickets.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}

// Strictly validate that this is an isolated test database
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

console.log('======================================================================');
console.log('🛡️  TOUCHQR SUPPORT TICKET SYSTEM END-TO-END TEST SUITE');
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
  // Clean fresh SQLite DB for this test suite
  if (process.env.TEST_DATABASE_URL.startsWith('sqlite:')) {
    const rawPath = process.env.TEST_DATABASE_URL.replace(/^sqlite:/i, '').replace(/^file:/i, '').trim();
    if (rawPath && rawPath !== ':memory:' && fs.existsSync(rawPath)) {
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  // Initialize schema & tables
  await initDb();

  // Clean support ticket tables & test accounts if any
  await query('DELETE FROM support_ticket_messages').catch(() => {});
  await query('DELETE FROM support_tickets').catch(() => {});
  await query("DELETE FROM admins WHERE username LIKE 'test_ticket_%'").catch(() => {});
  await query("DELETE FROM restaurants WHERE slug LIKE 'test-ticket-%'").catch(() => {});

  // Seed Tenant A
  const restoARes = await query(
    `INSERT INTO restaurants (name, slug, active, business_type)
     VALUES ('Alpha Diner', 'test-ticket-alpha', true, 'restaurant') RETURNING id`
  );
  const restoAId = (restoARes.rows || restoARes)[0]?.id || restoARes.lastInsertRowid;

  const adminARes = await query(
    `INSERT INTO admins (username, password_hash, restaurant_id, role)
     VALUES ('test_ticket_alpha_admin', 'hash123', $1, 'restaurant_admin') RETURNING id`,
    [restoAId]
  );
  const adminAId = (adminARes.rows || adminARes)[0]?.id || adminARes.lastInsertRowid;

  // Seed Tenant B
  const restoBRes = await query(
    `INSERT INTO restaurants (name, slug, active, business_type)
     VALUES ('Beta Bakery', 'test-ticket-beta', true, 'bakery') RETURNING id`
  );
  const restoBId = (restoBRes.rows || restoBRes)[0]?.id || restoBRes.lastInsertRowid;

  const adminBRes = await query(
    `INSERT INTO admins (username, password_hash, restaurant_id, role)
     VALUES ('test_ticket_beta_admin', 'hash123', $1, 'restaurant_admin') RETURNING id`,
    [restoBId]
  );
  const adminBId = (adminBRes.rows || adminBRes)[0]?.id || adminBRes.lastInsertRowid;

  // Seed Tenant C (Expired / Inactive tenant to test subscription bypass)
  const restoCRes = await query(
    `INSERT INTO restaurants (name, slug, active, business_type)
     VALUES ('Gamma Cafe Expired', 'test-ticket-gamma-expired', false, 'cafe') RETURNING id`
  );
  const restoCId = (restoCRes.rows || restoCRes)[0]?.id || restoCRes.lastInsertRowid;

  const adminCRes = await query(
    `INSERT INTO admins (username, password_hash, restaurant_id, role)
     VALUES ('test_ticket_gamma_admin', 'hash123', $1, 'restaurant_admin') RETURNING id`,
    [restoCId]
  );
  const adminCId = (adminCRes.rows || adminCRes)[0]?.id || adminCRes.lastInsertRowid;

  // Seed Super Admin Operator 1
  const superOp1Res = await query(
    `INSERT INTO admins (username, password_hash, restaurant_id, role)
     VALUES ('test_ticket_super_op1', 'hash123', NULL, 'superadmin') RETURNING id`
  );
  const superOp1Id = (superOp1Res.rows || superOp1Res)[0]?.id || superOp1Res.lastInsertRowid;

  // Generate verified JWT tokens
  const tokenTenantA = jwt.sign({ id: adminAId, username: 'test_ticket_alpha_admin', restaurant_id: restoAId, role: 'restaurant_admin' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenTenantB = jwt.sign({ id: adminBId, username: 'test_ticket_beta_admin', restaurant_id: restoBId, role: 'restaurant_admin' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenTenantC = jwt.sign({ id: adminCId, username: 'test_ticket_gamma_admin', restaurant_id: restoCId, role: 'restaurant_admin' }, JWT_SECRET, { expiresIn: '1h' });
  const tokenSuperAdmin = jwt.sign({ id: superOp1Id, username: 'test_ticket_super_op1', role: 'superadmin' }, JWT_SECRET, { expiresIn: '1h' });

  // Setup express test server
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/superadmin', superadminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let createdTicketIdA = null;
  let createdTicketRefA = null;

  try {
    // ----------------------------------------------------------------------
    // 1. Missing or Invalid Authentication
    // ----------------------------------------------------------------------
    await test('Unauthenticated requests rejected with 401/403', async () => {
      // Tenant endpoint without token
      const res1 = await fetch(`${baseUrl}/admin/support/tickets`);
      assert.strictEqual(res1.status, 401, 'Should return 401 when missing token');

      // Tenant endpoint with invalid token
      const res2 = await fetch(`${baseUrl}/admin/support/tickets`, {
        headers: { Authorization: 'Bearer bad_token_123' }
      });
      assert.strictEqual(res2.status, 403, 'Should return 403 for bad token');

      // Super admin endpoint without token
      const res3 = await fetch(`${baseUrl}/superadmin/support/tickets`);
      assert.strictEqual(res3.status, 401, 'Should return 401 for unauthenticated superadmin');

      // Super admin endpoint with ordinary tenant token
      const res4 = await fetch(`${baseUrl}/superadmin/support/tickets`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` }
      });
      assert.strictEqual(res4.status, 403, 'Should reject ordinary tenant token with 403');
    });

    // ----------------------------------------------------------------------
    // 2. Ticket Creation, Atomic Transaction & Forged Tenant ID Rejection
    // ----------------------------------------------------------------------
    await test('Tenant A creates ticket: ignores forged restaurant_id and creates initial message atomically', async () => {
      const res = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantA}`
        },
        body: JSON.stringify({
          subject: 'Thermal printer disconnecting on KOT',
          category: 'printer',
          message: 'The Bluetooth 80mm printer loses connection when kitchen sirens trigger.',
          priority: 'high',
          restaurant_id: 99999, // Forged ID attempt
          tenant_id: 88888      // Forged ID attempt
        })
      });

      assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}`);
      const data = await res.json();
      assert.ok(data.ticket, 'Should return created ticket');
      assert.strictEqual(data.ticket.restaurant_id, restoAId, 'Must derive restaurant_id strictly from token, ignoring client body');
      assert.strictEqual(data.ticket.subject, 'Thermal printer disconnecting on KOT');
      assert.strictEqual(data.ticket.category, 'printer');
      assert.strictEqual(data.ticket.priority, 'high');
      assert.strictEqual(data.ticket.status, 'open');
      assert.match(data.ticket.ticket_ref, /^TKT-\d{8}-[A-F0-9]{6}$/, 'Ticket ref must match collision-resistant format TKT-YYYYMMDD-XXXXXX');

      createdTicketIdA = data.ticket.id;
      createdTicketRefA = data.ticket.ticket_ref;

      // Verify atomic message insertion in database
      const msgRes = await query(
        'SELECT * FROM support_ticket_messages WHERE ticket_id = $1',
        [createdTicketIdA]
      );
      const msgRows = msgRes.rows || msgRes;
      assert.strictEqual(msgRows.length, 1, 'Initial message must be persisted in support_ticket_messages in same transaction');
      assert.strictEqual(msgRows[0].sender_type, 'tenant');
      assert.strictEqual(msgRows[0].sender_id, adminAId);
      assert.strictEqual(msgRows[0].message, 'The Bluetooth 80mm printer loses connection when kitchen sirens trigger.');
    });

    // ----------------------------------------------------------------------
    // 3. Cross-Tenant Isolation
    // ----------------------------------------------------------------------
    await test('Cross-Tenant Isolation: Tenant B cannot list, view or reply to Tenant A ticket', async () => {
      // 1. Tenant B lists tickets -> Tenant A's ticket must not be present
      const listRes = await fetch(`${baseUrl}/admin/support/tickets`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` }
      });
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json();
      assert.strictEqual(listData.tickets.length, 0, 'Tenant B must see 0 tickets initially');

      // 2. Tenant B attempts to view Tenant A's ticket
      const viewRes = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}`, {
        headers: { Authorization: `Bearer ${tokenTenantB}` }
      });
      assert.strictEqual(viewRes.status, 404, 'Must return 404 Not Found for cross-tenant ticket');

      // 3. Tenant B attempts to reply to Tenant A's ticket
      const replyRes = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantB}`
        },
        body: JSON.stringify({ message: 'Unauthorized reply from Tenant B' })
      });
      assert.strictEqual(replyRes.status, 404, 'Must return 404 Not Found when replying to another tenant ticket');
    });

    // ----------------------------------------------------------------------
    // 4. Input Validation Safeguards
    // ----------------------------------------------------------------------
    await test('Validation safeguards: Invalid category, priority, status and empty fields rejected with 400', async () => {
      // Invalid category
      const res1 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: 'Valid subject', category: 'invalid_category_xyz', message: 'Valid message' })
      });
      assert.strictEqual(res1.status, 400);
      const data1 = await res1.json();
      assert.strictEqual(data1.code, 'INVALID_CATEGORY');

      // Invalid priority
      const res2 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: 'Valid subject', category: 'orders', message: 'Valid message', priority: 'mega_urgent' })
      });
      assert.strictEqual(res2.status, 400);
      const data2 = await res2.json();
      assert.strictEqual(data2.code, 'INVALID_PRIORITY');

      // Empty subject
      const res3 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: '   ', category: 'orders', message: 'Valid message' })
      });
      assert.strictEqual(res3.status, 400);
      const data3 = await res3.json();
      assert.strictEqual(data3.code, 'INVALID_SUBJECT');

      // Empty message
      const res4 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: 'Valid subject', category: 'orders', message: '' })
      });
      assert.strictEqual(res4.status, 400);
      const data4 = await res4.json();
      assert.strictEqual(data4.code, 'INVALID_MESSAGE');

      // Empty reply
      const res5 = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ message: '   ' })
      });
      assert.strictEqual(res5.status, 400);

      // Category alias normalization: 'hardware' -> 'printer'
      const resAlias1 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: 'Thermal hardware issue', category: 'hardware', message: 'Hardware printer check' })
      });
      assert.strictEqual(resAlias1.status, 201);
      const dataAlias1 = await resAlias1.json();
      assert.strictEqual(dataAlias1.ticket.category, 'printer', 'Category alias hardware must normalize to printer');

      // Category alias normalization: 'table_qr' -> 'qr'
      const resAlias2 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: 'Table standee damaged', category: 'table_qr', message: 'Table QR standee check' })
      });
      assert.strictEqual(resAlias2.status, 201);
      const dataAlias2 = await resAlias2.json();
      assert.strictEqual(dataAlias2.ticket.category, 'qr', 'Category alias table_qr must normalize to qr');

      // Category alias normalization: 'account' -> 'other'
      const resAlias3 = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ subject: 'Account owner change', category: 'account', message: 'Account update inquiry' })
      });
      assert.strictEqual(resAlias3.status, 201);
      const dataAlias3 = await resAlias3.json();
      assert.strictEqual(dataAlias3.ticket.category, 'other', 'Category alias account must normalize to other');
    });

    // ----------------------------------------------------------------------
    // 5. Eligible Support Operator Assignment
    // ----------------------------------------------------------------------
    await test('Operator assignment safety: Ordinary restaurant admin rejected; eligible superadmin accepted', async () => {
      // 1. Fetch operators list
      const opListRes = await fetch(`${baseUrl}/superadmin/support/operators`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.strictEqual(opListRes.status, 200);
      const opData = await opListRes.json();
      assert.ok(opData.operators.some(o => o.id === superOp1Id), 'Operators list must include superOp1');
      assert.ok(!opData.operators.some(o => o.id === adminAId), 'Operators list must NEVER include tenant admin');

      // 2. Attempt assignment to ordinary tenant admin (adminAId)
      const assignBadRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ assigned_to: adminAId })
      });
      assert.strictEqual(assignBadRes.status, 400);
      const badData = await assignBadRes.json();
      assert.strictEqual(badData.code, 'INVALID_OPERATOR', 'Assigning to ordinary restaurant admin must be rejected');

      // 3. Assign to eligible super admin operator (superOp1Id)
      const assignGoodRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ assigned_to: superOp1Id })
      });
      assert.strictEqual(assignGoodRes.status, 200);
      const goodData = await assignGoodRes.json();
      assert.strictEqual(goodData.ticket.assigned_to, superOp1Id);
      assert.strictEqual(goodData.ticket.assigned_operator_username, 'test_ticket_super_op1');
    });

    // ----------------------------------------------------------------------
    // 6. Two-Way Message Threads & Chronological Ordering
    // ----------------------------------------------------------------------
    await test('Conversation thread: Super Admin and Tenant replies persist in chronological order', async () => {
      // Super Admin posts reply
      const saReplyRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ message: 'Please ensure baud rate is set to 9600 in ESC/POS printer settings.' })
      });
      assert.strictEqual(saReplyRes.status, 201);
      const saData = await saReplyRes.json();
      assert.strictEqual(saData.ticket_status, 'waiting_on_tenant', 'Super admin reply should move status to waiting_on_tenant');

      // Tenant replies back
      const tenantReplyRes = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ message: 'Updated baud rate to 9600, printer is now responsive! Thank you.' })
      });
      assert.strictEqual(tenantReplyRes.status, 201);
      const tenantData = await tenantReplyRes.json();
      assert.strictEqual(tenantData.ticket_status, 'in_progress', 'Tenant reply should move waiting ticket back to in_progress');

      // Fetch full thread as Tenant
      const threadRes = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` }
      });
      assert.strictEqual(threadRes.status, 200);
      const threadData = await threadRes.json();
      assert.strictEqual(threadData.messages.length, 3, 'Must have 3 messages (initial + SA reply + tenant reply)');

      // Verify chronological sequence
      assert.strictEqual(threadData.messages[0].sender_type, 'tenant');
      assert.strictEqual(threadData.messages[1].sender_type, 'superadmin');
      assert.strictEqual(threadData.messages[2].sender_type, 'tenant');
    });

    // ----------------------------------------------------------------------
    // 7. Status Transitions & Timestamps
    // ----------------------------------------------------------------------
    await test('Status transitions: Resolution and closure timestamps set and preserved properly', async () => {
      // Mark resolved
      const resolveRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ status: 'resolved' })
      });
      assert.strictEqual(resolveRes.status, 200);
      const resolveData = await resolveRes.json();
      assert.strictEqual(resolveData.ticket.status, 'resolved');
      assert.ok(resolveData.ticket.resolved_at, 'resolved_at timestamp must be set');

      // Mark closed
      const closeRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ status: 'closed' })
      });
      assert.strictEqual(closeRes.status, 200);
      const closeData = await closeRes.json();
      assert.strictEqual(closeData.ticket.status, 'closed');
      assert.ok(closeData.ticket.closed_at, 'closed_at timestamp must be set');
      assert.ok(closeData.ticket.resolved_at, 'resolved_at timestamp must be preserved');
    });

    // ----------------------------------------------------------------------
    // 8. Closed Ticket Reply Rejection
    // ----------------------------------------------------------------------
    await test('Closed ticket replies rejected for both Tenant and Super Admin', async () => {
      // Tenant attempt
      const tReplyRes = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ message: 'Trying to reply to closed ticket' })
      });
      assert.strictEqual(tReplyRes.status, 400);
      const tData = await tReplyRes.json();
      assert.strictEqual(tData.code, 'TICKET_CLOSED');

      // Super Admin attempt
      const saReplyRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ message: 'Super admin trying to reply to closed ticket' })
      });
      assert.strictEqual(saReplyRes.status, 400);
      const saData = await saReplyRes.json();
      assert.strictEqual(saData.code, 'TICKET_CLOSED');
    });

    // ----------------------------------------------------------------------
    // 9. Reopening Ticket
    // ----------------------------------------------------------------------
    await test('Reopening ticket: Authorized transition allows replies again', async () => {
      const reopenRes = await fetch(`${baseUrl}/superadmin/support/tickets/${createdTicketIdA}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenSuperAdmin}` },
        body: JSON.stringify({ status: 'open' })
      });
      assert.strictEqual(reopenRes.status, 200);
      const reopenData = await reopenRes.json();
      assert.strictEqual(reopenData.ticket.status, 'open');

      // Tenant can reply now
      const replyRes = await fetch(`${baseUrl}/admin/support/tickets/${createdTicketIdA}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenTenantA}` },
        body: JSON.stringify({ message: 'Ticket reopened, issue recurred on 2nd tablet.' })
      });
      assert.strictEqual(replyRes.status, 201);
    });

    // ----------------------------------------------------------------------
    // 10. Subscription Bypass (Expired/Suspended Tenants Can Access Support)
    // ----------------------------------------------------------------------
    await test('Expired/Suspended tenant can still list and create support tickets without subscription block', async () => {
      // Tenant C has active = 0 and subscription_status = 'expired'
      const listRes = await fetch(`${baseUrl}/admin/support/tickets`, {
        headers: { Authorization: `Bearer ${tokenTenantC}` }
      });
      assert.strictEqual(listRes.status, 200, 'Expired tenant must be permitted to list support tickets');

      const createRes = await fetch(`${baseUrl}/admin/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantC}`
        },
        body: JSON.stringify({
          subject: 'Payment mandate failed, need to renew',
          category: 'billing',
          message: 'My card was replaced, how can I reactivate my account?'
        })
      });
      assert.strictEqual(createRes.status, 201, 'Expired tenant must be able to submit support tickets');
    });

    // ----------------------------------------------------------------------
    // 11. Pagination, Filtering, and KPI Metrics
    // ----------------------------------------------------------------------
    await test('Pagination, search and KPI aggregate metrics are consistent in Super Admin view', async () => {
      const saListRes = await fetch(`${baseUrl}/superadmin/support/tickets?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.strictEqual(saListRes.status, 200);
      const data = await saListRes.json();

      assert.ok(data.metrics, 'Must return metrics object');
      assert.ok(data.metrics.total >= 2, 'Total tickets must count all created tickets');
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.limit, 10);
      assert.ok(data.pagination.total >= 2);

      // Search by ticket reference
      const searchRes = await fetch(`${baseUrl}/superadmin/support/tickets?search=${createdTicketRefA}`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.strictEqual(searchRes.status, 200);
      const searchData = await searchRes.json();
      assert.strictEqual(searchData.tickets.length, 1);
      assert.strictEqual(searchData.tickets[0].id, createdTicketIdA);

      // Filter by category: billing
      const filterRes = await fetch(`${baseUrl}/superadmin/support/tickets?category=billing`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.strictEqual(filterRes.status, 200);
      const filterData = await filterRes.json();
      assert.ok(filterData.tickets.every(t => t.category === 'billing'));

      // Filter by category alias: hardware (should return printer tickets)
      const filterAliasRes = await fetch(`${baseUrl}/superadmin/support/tickets?category=hardware`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.strictEqual(filterAliasRes.status, 200);
      const filterAliasData = await filterAliasRes.json();
      assert.ok(filterAliasData.tickets.every(t => t.category === 'printer'), 'Querying by category=hardware must filter for printer tickets');
    });

    // ----------------------------------------------------------------------
    // 12. Tenant 360 Integration
    // ----------------------------------------------------------------------
    await test('Tenant 360 returns real support ticket counts and recent tickets', async () => {
      const res = await fetch(`${baseUrl}/superadmin/restaurants/${restoAId}/360`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.support, 'Must have support object in 360 response');
      assert.ok(data.support.total_tickets >= 1, 'Total tickets in 360 must be >= 1');
      assert.ok(Array.isArray(data.support.recent_tickets), 'recent_tickets must be an array');
      assert.ok(data.support.recent_tickets.some(t => t.id === createdTicketIdA));
    });

    // ----------------------------------------------------------------------
    // 13. Persistence after Database Reinitialization
    // ----------------------------------------------------------------------
    await test('Data persists across database connection reinitialization', async () => {
      // Re-init DB schema (simulates cold start / connection drop)
      await initDb();

      const check = await query('SELECT * FROM support_tickets WHERE id = $1', [createdTicketIdA]);
      const checkRows = check.rows || check;
      assert.strictEqual(checkRows.length, 1, 'Ticket must persist after initDb()');
      assert.strictEqual(checkRows[0].ticket_ref, createdTicketRefA);

      const msgCheck = await query('SELECT * FROM support_ticket_messages WHERE ticket_id = $1', [createdTicketIdA]);
      const msgCheckRows = msgCheck.rows || msgCheck;
      assert.ok(msgCheckRows.length >= 3, 'Messages must persist after initDb()');
    });

  } finally {
    server.close();
  }

  console.log('\n======================================================================');
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
