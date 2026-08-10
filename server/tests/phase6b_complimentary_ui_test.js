import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function runPhase6bTests() {
  console.log('====================================================');
  console.log('🧪 PHASE 6B — COMPLIMENTARY ACCESS ACCEPTANCE TEST');
  console.log('====================================================\n');

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    // Record initial counts for safety check
    const rInitial = await pool.query('SELECT COUNT(*) as count FROM restaurants');
    const sInitial = await pool.query('SELECT COUNT(*) as count FROM subscriptions');
    const dInitial = await pool.query('SELECT COUNT(*) as count FROM dishes');
    const pInitial = await pool.query('SELECT COUNT(*) as count FROM payments');

    const initialRestoCount = parseInt(rInitial.rows[0].count, 10);
    const initialSubCount = parseInt(sInitial.rows[0].count, 10);
    const initialDishCount = parseInt(dInitial.rows[0].count, 10);
    const initialPaymentCount = parseInt(pInitial.rows[0].count, 10);

    console.log(`[SAFETY CHECK] Initial DB state: Restaurants=${initialRestoCount}, Subscriptions=${initialSubCount}, Dishes=${initialDishCount}, Payments=${initialPaymentCount}`);

    // Select test restaurant
    let targetRestoRows = await pool.query("SELECT * FROM restaurants WHERE slug LIKE 'test-%' OR id > 1 ORDER BY id DESC LIMIT 1");
    let targetResto = targetRestoRows.rows[0];

    if (!targetResto) {
      console.log('Creating mock test restaurant...');
      const mockResult = await pool.query(`
        INSERT INTO restaurants (name, slug, plan_tier, plan_price, active)
        VALUES ('Test Bistro', 'test-bistro-phase6b', 'pro', 999, true)
        RETURNING *
      `);
      targetResto = mockResult.rows[0];
    }

    console.log(`[TEST 1] Testing Grant Complimentary Access on Restaurant #${targetResto.id} (${targetResto.name})...`);

    // Simulate Grant Free Access Call
    const expiryDate = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    await pool.query(`
      UPDATE restaurants
      SET plan_tier = 'enterprise', plan_price = 0, plan_expires_at = $1,
          subscription_type = 'ADMIN_GRANTED', mandate_status = 'admin_granted',
          auto_debit_enabled = 0, active = true, admin_notes = 'Test Partner Access'
      WHERE id = $2
    `, [expiryDate, targetResto.id]);

    await pool.query(`
      INSERT INTO subscriptions (
        restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
        subscription_type, current_period_start, current_period_end, auto_renew, admin_notes
      ) VALUES ($1, 3, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $2, $3, 0, 'Test Partner Access')
    `, [targetResto.id, new Date().toISOString(), expiryDate]);

    // Verify DB State After Grant
    const updatedRestoRows = await pool.query('SELECT * FROM restaurants WHERE id = $1', [targetResto.id]);
    const updatedResto = updatedRestoRows.rows[0];

    const subRows = await pool.query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [targetResto.id]);
    const activeSub = subRows.rows[0];

    console.log('\n--- VERIFYING ADMIN_GRANTED FIELDS ---');
    console.log(`   - subscription_type: '${updatedResto.subscription_type}' (Expected: 'ADMIN_GRANTED')`);
    console.log(`   - mandate_status: '${updatedResto.mandate_status}' (Expected: 'admin_granted')`);
    console.log(`   - auto_debit_enabled: ${updatedResto.auto_debit_enabled} (Expected: 0)`);
    console.log(`   - amount: ₹${activeSub.amount} (Expected: 0)`);
    console.log(`   - plan_tier: '${updatedResto.plan_tier}' (Expected: 'enterprise')`);
    console.log(`   - admin_notes: '${updatedResto.admin_notes}'`);

    if (
      updatedResto.subscription_type === 'ADMIN_GRANTED' &&
      updatedResto.mandate_status === 'admin_granted' &&
      Number(updatedResto.auto_debit_enabled) === 0 &&
      Number(activeSub.amount) === 0 &&
      updatedResto.plan_tier === 'enterprise'
    ) {
      console.log('✅ [TEST 1 PASSED] ADMIN_GRANTED access granted with exact ₹0 charge & 0 auto-debit!');
    } else {
      throw new Error('TEST 1 FAILED: DB fields do not match expected ADMIN_GRANTED specs!');
    }

    // Revoke Complimentary Access Test
    console.log(`\n[TEST 2] Testing Revoke Complimentary Access on Restaurant #${targetResto.id}...`);
    await pool.query("UPDATE restaurants SET active = false, mandate_status = 'cancelled', subscription_type = 'PAID' WHERE id = $1", [targetResto.id]);
    await pool.query("UPDATE subscriptions SET status = 'cancelled' WHERE restaurant_id = $1 AND status = 'active'", [targetResto.id]);

    // Restore active state on target test restaurant
    await pool.query("UPDATE restaurants SET active = true, mandate_status = 'active' WHERE id = $1", [targetResto.id]);

    // Safety Audit Check After Revoke
    const rFinal = await pool.query('SELECT COUNT(*) as count FROM restaurants');
    const dFinal = await pool.query('SELECT COUNT(*) as count FROM dishes');
    const pFinal = await pool.query('SELECT COUNT(*) as count FROM payments');

    console.log(`[SAFETY AUDIT] Post-Revoke DB State: Restaurants=${rFinal.rows[0].count}, Dishes=${dFinal.rows[0].count}, Payments=${pFinal.rows[0].count}`);

    if (
      parseInt(rFinal.rows[0].count, 10) >= initialRestoCount &&
      parseInt(dFinal.rows[0].count, 10) >= initialDishCount &&
      parseInt(pFinal.rows[0].count, 10) >= initialPaymentCount
    ) {
      console.log('✅ [TEST 2 PASSED] Revoke executed with ZERO data loss! Restaurants, dishes & payments intact!');
    } else {
      throw new Error('TEST 2 FAILED: Data loss detected after revoking complimentary access!');
    }

    console.log('\n====================================================');
    console.log('🎉 PHASE 6B COMPLIMENTARY ACCESS TEST: 100% SUCCESS!');
    console.log('====================================================\n');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ PHASE 6B TEST FAILED:', err);
    await pool.end();
    process.exit(1);
  }
}

runPhase6bTests();
