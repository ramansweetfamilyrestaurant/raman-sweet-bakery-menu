import express from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_runner.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { initDb, query } from '../db.js';
import superadminRoutes from '../routes/superadmin.js';
import adminRoutes from '../routes/admin.js';
import apiRoutes from '../routes/api.js';
import paymentRoutes from '../routes/payment.js';
import { JWT_SECRET } from '../config/jwt.js';
import { generateQrToken } from '../utils/qrSecurity.js';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function assert(condition, message) {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    results.failed++;
    results.failures.push(message);
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

(async () => {
  console.log('======================================================================');
  console.log('🚀 TouchQR A-to-Z Deep Vertical Audit Test (Restaurant, Hotel, Cinema)');
  console.log('======================================================================\n');

  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.use('/api/superadmin', superadminRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/payment', paymentRoutes);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`⚡ Test server active on ${baseUrl}\n`);

  const superAdminToken = jwt.sign(
    { id: 1, username: 'superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const timestamp = Date.now();

  // Test Specifications for all 3 verticals
  const verticals = [
    {
      industry: 'restaurant',
      name: 'Audit Tandoori Restaurant',
      slug: `audit-dhaba-${timestamp}`,
      username: `dhaba_owner_${timestamp}`,
      password: 'Password123!',
      planTier: 'enterprise',
      businessType: 'restaurant',
      serviceModel: 'dine_in',
      setupCapacity: { total_tables: 25, total_rooms: 0, total_screens: 0, total_seats: 0 },
      categoryName: 'Chef Special Curries',
      dishName: 'Paneer Butter Masala',
      dishPrice: 280,
      space: { number: '7', type: 'table' },
      serviceRequest: 'Drinking Water 💧',
      expectedPermissions: { kds: 1, direct_ordering: 1 },
      crossIndustryPlan: 'hotel_pro',
      crossIndustryBiz: 'hotel_resort'
    },
    {
      industry: 'hotel',
      name: 'Audit Grand Palace Resort',
      slug: `audit-resort-${timestamp}`,
      username: `resort_owner_${timestamp}`,
      password: 'Password123!',
      planTier: 'hotel_pro',
      businessType: 'hotel_resort',
      serviceModel: 'hotel',
      setupCapacity: { total_tables: 0, total_rooms: 45, total_screens: 0, total_seats: 0 },
      categoryName: 'In-Room Gourmet Dining',
      dishName: 'Royal Club Sandwich & Fries',
      dishPrice: 380,
      space: { number: '24', type: 'room' },
      serviceRequest: 'Hotel Amenities & Toiletries 🪥',
      expectedPermissions: { amenities: 1, direct_ordering: 1 },
      crossIndustryPlan: 'cinema_pro',
      crossIndustryBiz: 'cinema_theatre'
    },
    {
      industry: 'cinema',
      name: 'Audit Cineplex Multiplex',
      slug: `audit-cineplex-${timestamp}`,
      username: `cinema_owner_${timestamp}`,
      password: 'Password123!',
      planTier: 'cinema_pro',
      businessType: 'cinema_theatre',
      serviceModel: 'cinema',
      setupCapacity: { total_tables: 0, total_rooms: 0, total_screens: 3, total_seats: 600 },
      categoryName: 'Cinema Concessions & Popcorn',
      dishName: 'Large Caramel Tub & Drink',
      dishPrice: 320,
      space: { number: 'S1-A-4', type: 'cinema_seat' },
      serviceRequest: 'Usher / Seat Assistance',
      expectedPermissions: { interval_rush: 1, seat_runner: 1, direct_ordering: 1 },
      crossIndustryPlan: 'basic',
      crossIndustryBiz: 'restaurant'
    }
  ];

  try {
    for (const v of verticals) {
      console.log(`\n----------------------------------------------------------------------`);
      console.log(`🏢 TESTING VERTICAL [${v.industry.toUpperCase()}]: ${v.name}`);
      console.log(`----------------------------------------------------------------------`);

      // 1. Account Creation from Scratch via SuperAdmin
      console.log(`\n[STEP 1: SuperAdmin Business Onboarding]`);
      const createRes = await fetch(`${baseUrl}/api/superadmin/restaurants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          name: v.name,
          slug: v.slug,
          owner_username: v.username,
          owner_password: v.password,
          business_type: v.businessType,
          service_model: v.serviceModel,
          plan_tier: v.planTier,
          plan_price: 999,
          onboarding_mode: 'active',
          ...v.setupCapacity
        })
      });
      const createData = await createRes.json();
      assert(createRes.status === 200 && createData.success && createData.id, `SuperAdmin provisions ${v.industry} tenant successfully`);

      const tenantId = createData.id;

      // 2. Authentication & JWT Token
      console.log(`\n[STEP 2: Tenant Owner Login & Authentication]`);
      const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: v.username, password: v.password })
      });
      const loginData = await loginRes.json();
      assert(loginRes.status === 200 && loginData.token, `Tenant owner '${v.username}' logs in and obtains valid JWT token`);
      const tenantToken = loginData.token;

      // 3. Plan Capabilities & Quotas Inspection
      console.log(`\n[STEP 3: Plan Capabilities & Vertical Quotas Inspection]`);
      const subRes = await fetch(`${baseUrl}/api/admin/subscription-status`, {
        headers: { Authorization: `Bearer ${tenantToken}` }
      });
      const subData = await subRes.json();
      assert(subRes.status === 200, `Fetched subscription state for ${v.industry}`);
      assert(subData.plan_tier === v.planTier, `Plan tier matches '${v.planTier}'`);
      assert(subData.industry === v.industry, `Industry correctly resolved to '${v.industry}'`);

      if (v.industry === 'hotel') {
        assert(Boolean(subData.permissions.amenities_booking_enabled), `Hotel tenant has amenities_booking_enabled = true`);
        assert(Number(subData.permissions.max_rooms) >= 60, `Hotel tenant max_rooms quota is at least 60`);
      } else if (v.industry === 'cinema') {
        assert(Boolean(subData.permissions.interval_rush_mode_enabled), `Cinema tenant has interval_rush_mode_enabled = true`);
        assert(Boolean(subData.permissions.seat_runner_dispatch_enabled), `Cinema tenant has seat_runner_dispatch_enabled = true`);
        assert(subData.permissions.max_screens === 3, `Cinema tenant max_screens quota is 3`);
        assert(subData.permissions.max_seats === 800, `Cinema tenant max_seats quota is 800`);
      } else {
        assert(Boolean(subData.permissions.kds_enabled), `Restaurant tenant has kds_enabled = true`);
        assert(subData.permissions.max_tables >= 20, `Restaurant tenant max_tables quota configured`);
      }

      // 4. Space / Audi Setup (For Cinema)
      if (v.industry === 'cinema') {
        console.log(`\n[STEP 4A: Cinema Screen & Seat Layout Configuration]`);
        const screenRes = await fetch(`${baseUrl}/api/admin/cinema/screens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenantToken}`
          },
          body: JSON.stringify({ screen_number: 1, name: 'Audi 1 - Dolby Atmos' })
        });
        const screenData = await screenRes.json();
        assert((screenRes.status === 200 || screenRes.status === 201) && screenData.screen, `Created Screen 1 for cinema`);
        const screenId = screenData.screen.id;

        const seatsRes = await fetch(`${baseUrl}/api/admin/cinema/seats/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tenantToken}`
          },
          body: JSON.stringify({ screen_id: screenId, row_label: 'A', seat_start: 1, seat_end: 10 })
        });
        const seatsData = await seatsRes.json();
        assert((seatsRes.status === 200 || seatsRes.status === 201) && seatsData.success, `Batch created 10 seats (Row A, 1 to 10)`);
      }

      // 5. Menu Catalog Creation (Category & Dishes)
      console.log(`\n[STEP 4/5: Menu Catalog Creation]`);
      const catRes = await fetch(`${baseUrl}/api/admin/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({ name: v.categoryName, is_active: 1 })
      });
      const catData = await catRes.json();
      assert((catRes.status === 200 || catRes.status === 201) && (catData.id || catData.category?.id), `Category '${v.categoryName}' created successfully`);
      const catId = catData.id || catData.category?.id;

      const dishRes = await fetch(`${baseUrl}/api/admin/dishes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({
          category_id: catId,
          name: v.dishName,
          price: v.dishPrice,
          is_available: 1
        })
      });
      const dishData = await dishRes.json();
      assert((dishRes.status === 200 || dishRes.status === 201) && (dishData.id || dishData.dish?.id), `Dish '${v.dishName}' (₹${v.dishPrice}) created successfully`);
      const dishId = dishData.id || dishData.dish?.id;

      // 6. Customer Mobile Experience: Fetch Menu & Restaurant Info
      console.log(`\n[STEP 6: Customer Public Menu Discovery]`);
      const pubRes = await fetch(`${baseUrl}/api/menu-bundle?slug=${v.slug}`);
      const pubData = await pubRes.json();
      assert(pubRes.status === 200, `Customer retrieves public restaurant menu for slug '${v.slug}'`);
      assert(pubData.categories.length > 0, `Menu contains at least 1 category`);
      assert(pubData.dishes.some(d => d.name === v.dishName), `Menu displays '${v.dishName}' to customer`);

      // 7. QR Code Generation & Direct Order Submission
      console.log(`\n[STEP 7: Customer Direct Order Submission via QR Scan]`);
      const dbRows = await query('SELECT id, slug, qr_secret, total_tables, total_rooms FROM restaurants WHERE id = $1', [tenantId]);
      const fullResto = dbRows[0];
      const validQrToken = generateQrToken(v.slug, v.space.type, v.space.number, fullResto.qr_secret);

      // Verify Table Presence
      const verifyRes = await fetch(`${baseUrl}/api/orders/verify-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: v.slug,
          table_number: v.space.number,
          space_type: v.space.type,
          table_token: validQrToken
        })
      });
      const verifyData = await verifyRes.json();
      assert((verifyRes.status === 200 || verifyRes.status === 201) && (verifyData.presence_token || verifyData.location_token), `Presence verification token obtained for space ${v.space.number}`);
      const presenceToken = verifyData.presence_token || verifyData.location_token;

      const orderPayload = {
        slug: v.slug,
        table_number: v.space.number,
        space_type: v.space.type,
        table_token: validQrToken,
        presence_token: presenceToken,
        location_token: presenceToken,
        customer_name: `${v.industry.toUpperCase()} Guest`,
        customer_phone: '9876543210',
        items: [
          {
            dish_id: dishId,
            name: v.dishName,
            price: v.dishPrice,
            quantity: 2
          }
        ],
        total_amount: v.dishPrice * 2,
        notes: `Test order for ${v.industry} vertical`
      };

      const orderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const orderData = await orderRes.json();
      if (!orderData.order_id) {
        console.error('Order submission failed payload/resp:', orderRes.status, orderData);
      }
      assert((orderRes.status === 200 || orderRes.status === 201) && orderData.order_id, `Direct order submitted successfully (Order #${orderData.order_id})`);
      const orderId = orderData.order_id;
      assert(Boolean(orderData.tracking_token), `Order includes tracking token for live customer status`);

      // 8. Service / Staff Assistance Request
      console.log(`\n[STEP 8: Customer Service / Amenities Request]`);
      const serviceRes = await fetch(`${baseUrl}/api/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: v.slug,
          table_number: v.space.number,
          space_type: v.space.type,
          table_token: validQrToken,
          request_type: v.serviceRequest,
          note: `Guest assistance needed at ${v.space.type} ${v.space.number}`
        })
      });
      const serviceData = await serviceRes.json();
      assert((serviceRes.status === 200 || serviceRes.status === 201) && serviceData.success, `Service request '${v.serviceRequest}' submitted successfully`);

      // 9. Admin Order Lifecycle & Service Request Resolution
      console.log(`\n[STEP 9: Admin Order Queue Processing & Resolution]`);
      const adminOrdersRes = await fetch(`${baseUrl}/api/admin/orders?scope=live`, {
        headers: { Authorization: `Bearer ${tenantToken}` }
      });
      const adminOrders = await adminOrdersRes.json();
      assert(adminOrders.some(o => o.id === orderId), `Order #${orderId} visible in live admin queue`);

      const acceptRes = await fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({ status: 'accepted' })
      });
      const acceptData = await acceptRes.json();
      assert(acceptRes.status === 200 && acceptData.success, `Order #${orderId} transitioned to 'accepted'`);

      const readyRes = await fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({ status: 'ready' })
      });
      const readyData = await readyRes.json();
      assert(readyRes.status === 200 && readyData.success, `Order #${orderId} transitioned to 'ready'`);

      // 10. Anti-Hopping & Boundary Enforcement Tests
      console.log(`\n[STEP 10: Security Boundary & Cross-Industry Plan Protection]`);
      const hopRes = await fetch(`${baseUrl}/api/payment/change-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({ plan: v.crossIndustryPlan })
      });
      const hopData = await hopRes.json();
      assert(hopRes.status === 403, `Cross-industry plan hop to '${v.crossIndustryPlan}' strictly rejected with 403`);
      assert(hopData.error === 'industry_mismatch', `Rejection error code is exactly 'industry_mismatch'`);

      const tamperRes = await fetch(`${baseUrl}/api/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`
        },
        body: JSON.stringify({
          business_type: v.crossIndustryBiz,
          service_model: 'hotel',
          name: 'Tampered Venue'
        })
      });
      assert(tamperRes.status === 403, `Tampering business_type to '${v.crossIndustryBiz}' strictly rejected with 403`);
    }

    // 11. SuperAdmin Master Oversight
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`👑 STEP 11: SuperAdmin Multi-Tenant Oversight & Catalog Parity`);
    console.log(`----------------------------------------------------------------------`);

    const allTenantsRes = await fetch(`${baseUrl}/api/superadmin/restaurants`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const allTenants = await allTenantsRes.json();
    assert(Array.isArray(allTenants) && allTenants.length >= 3, `SuperAdmin can query all onboarded tenants`);

    for (const v of verticals) {
      const found = allTenants.find(t => t.slug === v.slug);
      assert(Boolean(found), `SuperAdmin directory contains tenant '${v.name}'`);
      assert(found.business_type === v.businessType, `Tenant has correct business_type '${v.businessType}' in SuperAdmin`);
      assert(found.plan_tier === v.planTier, `Tenant has correct plan_tier '${v.planTier}' in SuperAdmin`);
    }

    console.log('\n======================================================================');
    console.log(`🎉 ALL A-TO-Z FLOW AUDIT CHECKS PASSED: ${results.passed} / ${results.total} passed!`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n❌ AUDIT ENCOUNTERED AN ERROR:', err.message);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
})();
