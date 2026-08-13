const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // Ensure Enterprise plan in saas_plans has kds_enabled = 1
    await pool.query("UPDATE saas_plans SET kds_enabled = 1 WHERE key = 'enterprise' OR key = 'pro' OR key = 'vip_ultra_plan'");
    console.log('✅ Updated saas_plans: Enterprise, Pro, and VIP Ultra plans kds_enabled set to 1.');

    const plans = await pool.query('SELECT id, key, name, kds_enabled FROM saas_plans ORDER BY id');
    console.log('=== UPDATED SAAS PLANS ===');
    console.log(JSON.stringify(plans.rows, null, 2));
  } catch(e) {
    console.error(e);
  }
  pool.end();
}
main();
