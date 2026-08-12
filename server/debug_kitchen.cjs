const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    // FIXED query - no IS FALSE
    const kitchenOrders = await pool.query(
      "SELECT id, table_number, status, sent_to_kds, kitchen_prepared, total_amount FROM orders WHERE restaurant_id = 1 AND status IN ('kitchen', 'preparing') AND (kitchen_prepared IS NULL OR kitchen_prepared = 0)"
    );
    console.log('=== FIXED QUERY: Orders appearing in Kitchen KDS ===');
    console.log(JSON.stringify(kitchenOrders.rows, null, 2));
    console.log(`\nTotal: ${kitchenOrders.rows.length} order(s) will appear in kitchen`);
  } catch(e) {
    console.error('ERR:', e.message);
  }
  pool.end();
}
main();
