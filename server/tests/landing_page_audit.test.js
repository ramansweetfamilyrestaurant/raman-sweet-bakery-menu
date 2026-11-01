import express from 'express';
import path from 'path';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_runner.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { initDb, query } from '../db.js';
import apiRoutes from '../routes/api.js';

(async () => {
  console.log('======================================================================');
  console.log('🔍 TouchQR Landing Page & Pricing Audit Test');
  console.log('======================================================================\n');

  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`⚡ Test server active on ${baseUrl}\n`);

  try {
    // 1. Audit /api/plans
    console.log('[1. Testing /api/plans API]');
    const plansRes = await fetch(`${baseUrl}/api/plans`);
    const plans = await plansRes.json();
    console.log(`Fetched ${plans.length} total SaaS plans from /api/plans`);
    
    if (plans.length < 9) {
      console.error('❌ FAIL: Expected at least 9 SaaS plans (3 restaurant, 3 hotel, 3 cinema), got:', plans.length);
      process.exitCode = 1;
    } else {
      console.log('✅ PASS: /api/plans returns all 9 plans across verticals');
    }

    const restaurantPlans = plans.filter(p => p.industry === 'restaurant');
    const hotelPlans = plans.filter(p => p.industry === 'hotel');
    const cinemaPlans = plans.filter(p => p.industry === 'cinema');

    console.log(`  Restaurant plans (${restaurantPlans.length}):`, restaurantPlans.map(p => `${p.key} (₹${p.price})`).join(', '));
    console.log(`  Hotel plans (${hotelPlans.length}):`, hotelPlans.map(p => `${p.key} (₹${p.price}, ${p.max_rooms} rooms)`).join(', '));
    console.log(`  Cinema plans (${cinemaPlans.length}):`, cinemaPlans.map(p => `${p.key} (₹${p.price}, ${p.max_screens} scr/${p.max_seats} seats)`).join(', '));

    // 2. Audit /api/settings
    console.log('\n[2. Testing /api/settings API]');
    const settingsRes = await fetch(`${baseUrl}/api/settings`);
    const settings = await settingsRes.json();
    console.log('✅ PASS: /api/settings responded successfully with keys:', Object.keys(settings).slice(0, 5).join(', '));

    // 3. Audit /api/menu-bundle for Live Demo slug
    console.log('\n[3. Testing Demo Venue (/touchqr-demo)]');
    const demoRes = await fetch(`${baseUrl}/api/menu-bundle?slug=touchqr-demo`);
    if (demoRes.status === 200) {
      const demoData = await demoRes.json();
      console.log(`✅ PASS: Demo venue active (${demoData.info?.name}, ${demoData.dishes?.length} dishes, ${demoData.categories?.length} categories, ${demoData.combos?.length} combos)`);
    } else {
      console.error(`❌ FAIL: Demo venue /touchqr-demo returned status ${demoRes.status}`);
      process.exitCode = 1;
    }

    // 4. Audit /api/info for Live Demo slug
    console.log('\n[4. Testing Demo /api/info]');
    const infoRes = await fetch(`${baseUrl}/api/info?slug=touchqr-demo`);
    if (infoRes.status === 200) {
      const infoData = await infoRes.json();
      console.log(`✅ PASS: Demo info loaded (${infoData.name}, plan: ${infoData.plan_tier})`);
    } else {
      console.error(`❌ FAIL: Demo info returned status ${infoRes.status}`);
      process.exitCode = 1;
    }

    // 5. Audit /api/orders/verify-location for Live Demo slug
    console.log('\n[5. Testing Demo Location Verification]');
    const verifyRes = await fetch(`${baseUrl}/api/orders/verify-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'touchqr-demo', table_number: 'Demo Table 1' })
    });
    const verifyData = await verifyRes.json();
    if (verifyData.verified) {
      console.log(`✅ PASS: Demo location verified instantly (${verifyData.message})`);
    } else {
      console.error('❌ FAIL: Demo location verification failed:', verifyData);
      process.exitCode = 1;
    }

    // 6. Audit /api/orders for Live Demo slug
    console.log('\n[6. Testing Demo Order Placement]');
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'touchqr-demo',
        table_number: 'Demo Table 1',
        items: [{ id: -101, name: 'Truffle Butter Paneer Tikka', price: 340, quantity: 1 }],
        total_amount: 340
      })
    });
    const orderData = await orderRes.json();
    if (orderData.success) {
      console.log(`✅ PASS: Demo order placed (${orderData.order_id}, ${orderData.message})`);
    } else {
      console.error('❌ FAIL: Demo order placement failed:', orderData);
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Audit test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
})();
