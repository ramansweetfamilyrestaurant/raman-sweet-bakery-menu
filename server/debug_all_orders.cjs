const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    const res = await pool.query('SELECT id, table_number, customer_name, items, total_amount, created_at FROM orders WHERE restaurant_id = 1 ORDER BY id DESC LIMIT 15');
    res.rows.forEach(o => {
      console.log(`Order #${o.id} (Table ${o.table_number}) Total: ₹${o.total_amount}`);
      console.log('  Items:', JSON.stringify(o.items));
    });
  } catch(e) {
    console.error(e);
  }
  pool.end();
}
main();
