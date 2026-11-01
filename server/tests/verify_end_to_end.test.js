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

(async () => {
  try {
    console.log('--- 1. Testing Database Connection & SaaS Plans Seeds ---');
    await initDb();
    
    const plans = await query('SELECT key, name, price, industry, max_tables, max_rooms, max_screens, max_seats FROM saas_plans ORDER BY industry, price');
    console.log(`Found ${plans.length} total plans in database:`);
    plans.forEach(p => {
      console.log(`  [${(p.industry || 'restaurant').toUpperCase()}] ${p.key}: ${p.name} - ₹${p.price} (Tables: ${p.max_tables}, Rooms: ${p.max_rooms}, Screens: ${p.max_screens}, Seats: ${p.max_seats})`);
    });

    console.log('\n--- 2. Starting In-Memory Test Express App ---');
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
    app.use('/api/superadmin', superadminRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/payment', paymentRoutes);

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    console.log(`Server listening on ${baseUrl}`);

    // Test Public Plans API with industry filtering
    console.log('\n--- 3. Testing Public /api/plans Filtering ---');
    
    const restoRes = await fetch(`${baseUrl}/api/plans?industry=restaurant`);
    const restoPlans = await restoRes.json();
    console.log(`  Restaurant plans returned: ${restoPlans.length}`);
    if (restoPlans.every(p => (p.industry || 'restaurant') === 'restaurant')) {
      console.log('  ✅ PASS: Restaurant filter returns ONLY restaurant plans');
    } else {
      throw new Error('Leaked non-restaurant plans into restaurant filter!');
    }

    const hotelRes = await fetch(`${baseUrl}/api/plans?industry=hotel`);
    const hotelPlans = await hotelRes.json();
    console.log(`  Hotel plans returned: ${hotelPlans.length}`);
    if (hotelPlans.every(p => p.industry === 'hotel')) {
      console.log('  ✅ PASS: Hotel filter returns ONLY hotel plans');
    } else {
      throw new Error('Leaked non-hotel plans into hotel filter!');
    }

    const cinemaRes = await fetch(`${baseUrl}/api/plans?industry=cinema`);
    const cinemaPlans = await cinemaRes.json();
    console.log(`  Cinema plans returned: ${cinemaPlans.length}`);
    if (cinemaPlans.every(p => p.industry === 'cinema')) {
      console.log('  ✅ PASS: Cinema filter returns ONLY cinema plans');
    } else {
      throw new Error('Leaked non-cinema plans into cinema filter!');
    }

    // Test SuperAdmin Plans API
    console.log('\n--- 4. Testing SuperAdmin API Authenticated Access ---');
    const token = jwt.sign({ id: 1, username: 'superadmin', role: 'superadmin' }, JWT_SECRET, { expiresIn: '1h' });
    const saRes = await fetch(`${baseUrl}/api/superadmin/plans`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!saRes.ok || saRes.status !== 200) {
      throw new Error(`Superadmin plans API failed with status ${saRes.status}`);
    }
    const saPlans = await saRes.json();
    if (!Array.isArray(saPlans) || saPlans.length === 0) {
      throw new Error('Superadmin plans API returned invalid or empty catalog');
    }
    console.log(`  Superadmin plans list returned: ${saPlans.length} plans`);
    console.log('  ✅ PASS: SuperAdmin plans API authenticated and returned catalog successfully');

    // Test Plan Update
    console.log('\n--- 5. Testing Plan Update with Dedicated Controls ---');
    const updateRes = await fetch(`${baseUrl}/api/superadmin/plans/hotel_pro`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Hotel Pro (In-Room QR Dining)',
        price: 1999,
        industry: 'hotel',
        max_rooms: 60,
        amenities_booking_enabled: 1,
        direct_ordering_enabled: 1
      })
    });
    if (!updateRes.ok || updateRes.status !== 200) {
      throw new Error(`Plan update failed with status ${updateRes.status}`);
    }
    const updateJson = await updateRes.json();
    console.log(`  Update response: ${JSON.stringify(updateJson)}`);
    console.log('  ✅ PASS: Plan updated successfully with industry controls');

    server.close();
    console.log('\n🎉 ALL LIVE VERIFICATION CHECKS PASSED PERFECTLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
})();
