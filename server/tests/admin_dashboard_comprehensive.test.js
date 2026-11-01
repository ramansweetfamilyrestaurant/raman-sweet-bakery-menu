import express from 'express';
import path from 'path';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_runner.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { initDb, query } from '../db.js';
import adminRoutes from '../routes/admin.js';
import apiRoutes from '../routes/api.js';
import { generateQrToken } from '../utils/qrSecurity.js';

const JWT_SECRET = process.env.JWT_SECRET || 'touchqr_ultra_secure_jwt_secret_dev_2026';

(async () => {
  console.log('======================================================================');
  console.log('🛡️ TouchQR Admin Dashboard Comprehensive Verification Suite');
  console.log('======================================================================\n');

  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api', apiRoutes);

  let server;
  let baseUrl;
  let passed = 0;
  let failed = 0;

  function record(name, condition, detail = '') {
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
    }
  }

  try {
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`⚡ Test server active on ${baseUrl}\n`);

    const timestamp = Date.now();

    // -------------------------------------------------------------------------
    // SEEDING: Setup 2 Independent Tenants for Dashboard Testing & Isolation
    // -------------------------------------------------------------------------
    console.log('--- SEEDING: Setting up Test Tenants ---');
    const salt = await bcrypt.genSalt(10);
    const pwdHash = await bcrypt.hash('adminSecret123!', salt);

    // Tenant A: Enterprise Restaurant
    const tASlug = `dash-alpha-${timestamp}`;
    const tAIns = await query(`
      INSERT INTO restaurants (
        name, slug, business_type, plan_tier, plan_price, active, trial_ends_at,
        plan_expires_at, total_tables, qr_secret, direct_ordering_enabled, table_verification_mode
      )
      VALUES ($1, $2, 'restaurant', 'enterprise', 1999, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z', 50, 'alpha_super_secret_12345', 1, 'QR_ONLY')
      RETURNING id
    `, ['Alpha Grand Diner', tASlug]);
    const tenantAId = tAIns[0]?.id || tAIns.lastInsertRowid;

    await query(`
      INSERT INTO admins (username, password_hash, role, restaurant_id)
      VALUES ($1, $2, 'restaurant_admin', $3)
    `, [`alpha_admin_${timestamp}`, pwdHash, tenantAId]);

    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, amount, status, billing_cycle, current_period_end)
      VALUES ($1, 3, 1999, 'active', 'monthly', '2030-01-01T00:00:00Z')
    `, [tenantAId]);

    // Tenant B: Basic Restaurant
    const tBSlug = `dash-beta-${timestamp}`;
    const tBIns = await query(`
      INSERT INTO restaurants (
        name, slug, business_type, plan_tier, plan_price, active, trial_ends_at,
        plan_expires_at, total_tables, qr_secret, direct_ordering_enabled, table_verification_mode
      )
      VALUES ($1, $2, 'restaurant', 'basic', 499, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z', 20, 'beta_super_secret_67890', 1, 'QR_ONLY')
      RETURNING id
    `, ['Beta Quick Cafe', tBSlug]);
    const tenantBId = tBIns[0]?.id || tBIns.lastInsertRowid;

    await query(`
      INSERT INTO admins (username, password_hash, role, restaurant_id)
      VALUES ($1, $2, 'restaurant_admin', $3)
    `, [`beta_admin_${timestamp}`, pwdHash, tenantBId]);

    await query(`
      INSERT INTO subscriptions (restaurant_id, plan_id, amount, status, billing_cycle, current_period_end)
      VALUES ($1, 1, 499, 'active', 'monthly', '2030-01-01T00:00:00Z')
    `, [tenantBId]);

    console.log(`  Seeded Tenant A (ID: ${tenantAId}, Enterprise) & Tenant B (ID: ${tenantBId}, Basic)\n`);

    // =========================================================================
    // SECTION 1: Authentication & Identity Context (/api/admin/login & /me)
    // =========================================================================
    console.log('[SECTION 1: Admin Authentication & Identity Context]');

    // 1.1 Invalid Password Rejection
    const loginFailRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `alpha_admin_${timestamp}`, password: 'WrongPassword99!' })
    });
    record('LOGIN_INVALID_PASSWORD_REJECTED', loginFailRes.status === 401, `Status: ${loginFailRes.status}`);

    // 1.2 Valid Login Success
    const loginOkRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `alpha_admin_${timestamp}`, password: 'adminSecret123!' })
    });
    const loginOkData = await loginOkRes.json();
    record('LOGIN_SUCCESS_TOKEN_ISSUED', loginOkRes.status === 200 && Boolean(loginOkData.token), `Token issued`);
    const tokenA = loginOkData.token;

    // Login for Tenant B
    const loginBRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: `beta_admin_${timestamp}`, password: 'adminSecret123!' })
    });
    const loginBData = await loginBRes.json();
    const tokenB = loginBData.token;

    // 1.3 Fetch Profile Context via GET /api/admin/me
    const meRes = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const meData = await meRes.json();
    record('ADMIN_ME_PROFILE_RESOLVED', meRes.status === 200 && meData.restaurant?.id === tenantAId, `Name: ${meData.restaurant?.name}`);
    record('ADMIN_ME_PLAN_TIER_ENTERPRISE', meData.restaurant?.plan_tier === 'enterprise', `Plan: ${meData.restaurant?.plan_tier}`);

    // =========================================================================
    // SECTION 2: Menu Catalog Management (Categories, Dishes, Combos)
    // =========================================================================
    console.log('\n[SECTION 2: Menu Catalog Management (Categories, Dishes, Combos)]');

    // 2.1 Create Category
    const catRes = await fetch(`${baseUrl}/api/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Sizzlers & Starters', display_order: 1 })
    });
    const catData = await catRes.json();
    record('CREATE_CATEGORY_SUCCESS', catRes.status === 200 && Boolean(catData.category?.id || catData.id), `Category: Sizzlers & Starters`);
    const categoryId = catData.category?.id || catData.id;

    // 2.2 Create Dish
    const dishRes = await fetch(`${baseUrl}/api/admin/dishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Tandoori Paneer Sizzler',
        price: 340,
        category_id: categoryId,
        is_veg: 1,
        description: 'Fresh cottage cheese marinated in hung curd and aromatic spices',
        available: 1
      })
    });
    const dishData = await dishRes.json();
    record('CREATE_DISH_SUCCESS', dishRes.status === 200 && Boolean(dishData.dish?.id || dishData.id), `Dish: Tandoori Paneer Sizzler (₹340)`);
    const dishId = dishData.dish?.id || dishData.id;

    // 2.3 Update Dish Price & Availability
    const dishUpdateRes = await fetch(`${baseUrl}/api/admin/dishes/${dishId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Tandoori Paneer Sizzler (Deluxe)',
        price: 360,
        available: 1,
        category_id: categoryId
      })
    });
    record('UPDATE_DISH_SUCCESS', dishUpdateRes.status === 200, `Updated price to ₹360`);

    // 2.4 Toggle Dish Availability (Toggle off, then toggle back on)
    const dishToggleOffRes = await fetch(`${baseUrl}/api/admin/dishes/${dishId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ available: false })
    });
    const dishToggleOnRes = await fetch(`${baseUrl}/api/admin/dishes/${dishId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ available: true })
    });
    record('TOGGLE_DISH_AVAILABILITY_SUCCESS', dishToggleOffRes.status === 200 && dishToggleOnRes.status === 200, `Availability toggled off and on`);

    // 2.5 Create Combo Deal
    const comboRes = await fetch(`${baseUrl}/api/admin/combos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: 'Weekend Feast Combo',
        price: 699,
        original_price: 999,
        description: 'Includes 1 Sizzler, 2 Beverages, and 1 Dessert',
        items: [{ dish_id: dishId, name: 'Tandoori Paneer Sizzler (Deluxe)', quantity: 1 }]
      })
    });
    const comboData = await comboRes.json();
    record('CREATE_COMBO_SUCCESS', comboRes.status === 200 && Boolean(comboData.combo?.id || comboData.id), `Combo: Weekend Feast`);
    const comboId = comboData.combo?.id || comboData.id;

    // =========================================================================
    // SECTION 3: Live Order Processing & Status Lifecycle (OrdersView)
    // =========================================================================
    console.log('\n[SECTION 3: Live Orders Processing & Status Pipeline]');

    // 3.1 Place a direct customer order with authentic QR token & location verification
    const table7Token = generateQrToken(tASlug, 'table', '7', 'alpha_super_secret_12345');
    const verifyRes = await fetch(`${baseUrl}/api/orders/verify-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: tASlug,
        table_number: '7',
        space_type: 'table',
        table_token: table7Token
      })
    });
    const verifyData = await verifyRes.json();

    const placeOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: tASlug,
        table_number: '7',
        space_type: 'table',
        table_token: table7Token,
        presence_token: verifyData.presence_token,
        items: [{ dish_id: dishId, id: dishId, name: 'Tandoori Paneer Sizzler (Deluxe)', price: 360, quantity: 2 }],
        total_amount: 720,
        customer_name: 'Rahul Sharma',
        customer_phone: '9876543210'
      })
    });
    const placeOrderData = await placeOrderRes.json();
    const activeOrderId = placeOrderData.order_id || placeOrderData.orderId || placeOrderData.id;
    record('CUSTOMER_ORDER_PLACED_SUCCESS', (placeOrderRes.status === 200 || placeOrderRes.status === 201) && Boolean(activeOrderId), `Order ID: ${activeOrderId}`);

    // 3.2 Tenant Admin Fetches Orders List
    const ordersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const ordersData = await ordersRes.json();
    const foundOrder = Array.isArray(ordersData) ? ordersData.find(o => o.id === activeOrderId) : null;
    record('ADMIN_ORDERS_QUEUE_FETCHED', ordersRes.status === 200 && Boolean(foundOrder), `Found Order #${activeOrderId} in live queue`);

    // 3.3 Status Transition: Pending -> Accepted
    const acceptRes = await fetch(`${baseUrl}/api/admin/orders/${activeOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: 'accepted', estimated_prep_time_minutes: 20 })
    });
    record('ORDER_TRANSITION_TO_ACCEPTED', acceptRes.status === 200, `Order accepted with 20min prep time`);

    // 3.4 Status Transition: Accepted -> Preparing
    const prepRes = await fetch(`${baseUrl}/api/admin/orders/${activeOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: 'preparing' })
    });
    record('ORDER_TRANSITION_TO_PREPARING', prepRes.status === 200, `Kitchen preparing order`);

    // 3.5 Status Transition: Preparing -> Ready
    const readyRes = await fetch(`${baseUrl}/api/admin/orders/${activeOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: 'ready' })
    });
    record('ORDER_TRANSITION_TO_READY', readyRes.status === 200, `Food is ready for serving`);

    // 3.6 Log Thermal Printer Dispatch (KOT & Bill)
    const printLogRes = await fetch(`${baseUrl}/api/admin/print/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        order_id: activeOrderId,
        print_type: 'kot',
        status: 'printed',
        printer_role: 'single'
      })
    });
    record('THERMAL_PRINTER_LOGGED', printLogRes.status === 200, `Audit log recorded for KOT print`);

    // 3.7 Status Transition: Ready -> Completed (Settled)
    const completeRes = await fetch(`${baseUrl}/api/admin/orders/${activeOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: 'completed' })
    });
    record('ORDER_TRANSITION_TO_COMPLETED', completeRes.status === 200, `Order successfully completed`);

    // =========================================================================
    // SECTION 4: Venue Settings & Capacity Constraints (SetupView)
    // =========================================================================
    console.log('\n[SECTION 4: Venue Settings & Capacity Constraints]');

    // 4.1 Update General Settings
    const setUpdateRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        tagline: 'Finest Handcrafted Delicacies & Luxury Ambience',
        phone: '9876500000',
        address: 'Plot 42, Civil Lines, Jaipur'
      })
    });
    record('SETTINGS_GENERAL_UPDATED', setUpdateRes.status === 200, `Updated tagline, phone, address`);

    // 4.2 Enforce Locked Business Type (cannot change without SuperAdmin)
    const tamperBizRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ business_type: 'cinema_theatre' })
    });
    const tamperBizData = await tamperBizRes.json();
    record('LOCKED_BUSINESS_TYPE_ENFORCED', tamperBizRes.status === 403 && tamperBizData.error === 'business_type_locked', `Tamper to cinema strictly blocked 403`);

    // 4.3 Enforce Plan Capacity Limits (Tenant B Basic limit is 20 tables)
    const exceedTablesRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ total_tables: 80 })
    });
    const exceedTablesData = await exceedTablesRes.json();
    record('PLAN_CAPACITY_LIMIT_ENFORCED', exceedTablesRes.status === 403 && exceedTablesData.error === 'plan_limit_reached', `80 tables on Basic rejected with 403`);

    // 4.4 Enforce Dual Printer Entitlement (Locked on Basic, Unlocked on Enterprise)
    const dualOnBasicRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ printer_mode: 'dual' })
    });
    record('DUAL_PRINTER_LOCKED_ON_BASIC', dualOnBasicRes.status === 403, `Basic tenant blocked from dual printers`);

    const dualOnEnterpriseRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ printer_mode: 'dual' })
    });
    record('DUAL_PRINTER_ALLOWED_ON_ENTERPRISE', dualOnEnterpriseRes.status === 200, `Enterprise tenant unlocked dual printers`);

    // =========================================================================
    // SECTION 5: Sales Analytics & Exports (AnalyticsView)
    // =========================================================================
    console.log('\n[SECTION 5: Sales Analytics & Data Exports]');

    const analyticsRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const analyticsData = await analyticsRes.json();
    record('ANALYTICS_SUMMARY_RESOLVED', analyticsRes.status === 200 && (analyticsData.today_sales !== undefined || analyticsData.total_sales !== undefined || analyticsData.total_revenue !== undefined), `Analytics retrieved`);

    const csvRes = await fetch(`${baseUrl}/api/admin/analytics/export/csv`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const csvText = await csvRes.text();
    record('ANALYTICS_CSV_EXPORT_SUCCESS', csvRes.status === 200 && (csvText.includes('Order / Summary ID') || csvText.includes('Record Type')), `CSV exported with valid header`);

    const xlsxRes = await fetch(`${baseUrl}/api/admin/analytics/export/xlsx`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    record('ANALYTICS_XLSX_EXPORT_SUCCESS', xlsxRes.status === 200, `Excel spreadsheet exported`);

    // =========================================================================
    // SECTION 6: Support Desk & Tickets (SupportView)
    // =========================================================================
    console.log('\n[SECTION 6: Support Desk & Inquiries]');

    // 6.1 Create Support Ticket
    const ticketRes = await fetch(`${baseUrl}/api/admin/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        subject: 'Query regarding thermal printer setup',
        category: 'printer',
        message: 'We need help configuring our 80mm USB kitchen printer.',
        priority: 'high'
      })
    });
    const ticketData = await ticketRes.json();
    const ticketId = ticketData.ticket?.id || ticketData.id;
    record('CREATE_SUPPORT_TICKET_SUCCESS', ticketRes.status === 201 && Boolean(ticketId), `Ticket ID: ${ticketId}`);

    // 6.2 Fetch Support Tickets List
    const ticketsListRes = await fetch(`${baseUrl}/api/admin/support/tickets`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const ticketsData = await ticketsListRes.json();
    const ticketsList = ticketsData.tickets || (Array.isArray(ticketsData) ? ticketsData : []);
    record('FETCH_SUPPORT_TICKETS_SUCCESS', ticketsListRes.status === 200 && Array.isArray(ticketsList) && ticketsList.length > 0, `Total tickets: ${ticketsList.length}`);

    // =========================================================================
    // SECTION 7: Multi-Tenant Data Isolation & Security Boundary
    // =========================================================================
    console.log('\n[SECTION 7: Multi-Tenant Data Isolation & Security Boundary]');

    // 7.1 Tenant B cannot see Tenant A's orders
    const tenantBOrdersRes = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const tenantBOrders = await tenantBOrdersRes.json();
    const leakedOrder = Array.isArray(tenantBOrders) ? tenantBOrders.find(o => o.id === activeOrderId) : null;
    record('ISOLATION_ORDERS_NO_LEAK', leakedOrder === null || leakedOrder === undefined, `Tenant B cannot see Tenant A orders`);

    // 7.2 Tenant B cannot delete Tenant A's dish
    const tenantBDeleteDish = await fetch(`${baseUrl}/api/admin/dishes/${dishId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    record('ISOLATION_DISH_DELETE_BLOCKED', tenantBDeleteDish.status === 404 || tenantBDeleteDish.status === 403, `Cross-tenant dish deletion blocked`);

    // 7.3 Tenant B cannot access Tenant A's support ticket
    const tenantBAccessTicket = await fetch(`${baseUrl}/api/admin/support/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    record('ISOLATION_TICKET_ACCESS_BLOCKED', tenantBAccessTicket.status === 404 || tenantBAccessTicket.status === 403, `Cross-tenant ticket lookup blocked`);

    // =========================================================================
    // CLEANUP & SUMMARY
    // =========================================================================
    console.log('\n======================================================================');
    console.log(`📊 ADMIN DASHBOARD TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================================\n');

    server.close();

    if (failed > 0) {
      console.error(`❌ Suite failed with ${failed} failure(s)`);
      process.exit(1);
    } else {
      console.log('🎉 ALL ADMIN DASHBOARD TESTS PASSED WITH 100% SUCCESS!');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Test suite runtime error:', err);
    if (server) server.close();
    process.exit(1);
  }
})();
