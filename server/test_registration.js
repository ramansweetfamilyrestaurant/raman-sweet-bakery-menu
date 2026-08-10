import pg from 'pg';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import { finalizePendingRegistration } from './routes/payment.js';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 STRICT PAYMENT-FIRST ARCHITECTURE VERIFICATION');
  console.log('====================================================\n');

  // Initialize DB & apply all non-destructive migrations
  await initDb();

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    // Test 1: Check existing DB restaurant & subscription count
    const rRes = await pool.query('SELECT COUNT(*) FROM restaurants');
    const sRes = await pool.query('SELECT COUNT(*) FROM subscriptions');
    const pRes = await pool.query('SELECT COUNT(*) FROM pending_registrations');

    const initialRestos = parseInt(rRes.rows[0].count, 10);
    const initialSubs = parseInt(sRes.rows[0].count, 10);
    const initialPending = parseInt(pRes.rows[0].count, 10);

    console.log(`[TEST 1] Initial Restaurants Count: ${initialRestos}`);
    console.log(`[TEST 1] Initial Subscriptions Count: ${initialSubs}`);
    console.log(`[TEST 1] Initial Pending Registrations Count: ${initialPending}`);

    // Test 2: Insert Pending Registration — MUST NOT create restaurant row
    const testRegId = `test_reg_${Date.now()}`;
    const testUname = `test_owner_${Date.now()}`;
    const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    const testPayload = JSON.stringify({
      name: 'Automation Test Bistro',
      phone: testPhone,
      owner_username: testUname,
      owner_password: 'SecurePassword123!',
      plan_tier: 'pro',
      plan_price: 999,
      trial_days: 17,
      subscription_id: `sub_test_${Date.now()}`
    });

    await pool.query(
      `INSERT INTO pending_registrations (id, payload, name, phone, owner_username, plan_key, plan_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testRegId, testPayload, 'Automation Test Bistro', testPhone, testUname, 'pro', 999, 'checkout_started']
    );

    const rResAfterInsert = await pool.query('SELECT COUNT(*) FROM restaurants');
    const newRestosCount = parseInt(rResAfterInsert.rows[0].count, 10);

    if (newRestosCount !== initialRestos) {
      throw new Error(`❌ FAIL: Pending registration created a restaurant prematurely! Expected ${initialRestos}, got ${newRestosCount}`);
    }
    console.log('✅ [TEST 2 PASSED] Pending registration created ZERO restaurant rows!');

    // Test 3: Unverified/Failed subscription status MUST throw error and create ZERO restaurant rows
    let failedAssertionPassed = false;
    try {
      await finalizePendingRegistration(testRegId, 'sub_unauthorized_fake');
    } catch (err) {
      failedAssertionPassed = true;
      console.log(`✅ [TEST 3 PASSED] Unverified subscription blocked restaurant creation! Error caught: "${err.message}"`);
    }

    if (!failedAssertionPassed) {
      throw new Error('❌ FAIL: Unverified subscription allowed restaurant creation!');
    }

    const rResAfterFailed = await pool.query('SELECT COUNT(*) FROM restaurants');
    if (parseInt(rResAfterFailed.rows[0].count, 10) !== initialRestos) {
      throw new Error('❌ FAIL: Failed verification created a restaurant row!');
    }
    console.log('✅ [TEST 4 PASSED] Failed verification created ZERO restaurant rows!');

    // Cleanup test record
    await pool.query('DELETE FROM pending_registrations WHERE id = $1', [testRegId]);
    console.log('✅ [TEST 5 PASSED] Test pending registration cleaned up successfully!');

    console.log('\n====================================================');
    console.log('🎉 ALL TEST ASSERTIONS PASSED WITH 100% SUCCESS!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
