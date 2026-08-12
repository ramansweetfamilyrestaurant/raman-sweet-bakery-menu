const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  try {
    const res = await pool.query('SELECT * FROM orders WHERE id = 28');
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch(e) {
    console.error(e);
  }
  pool.end();
}
main();
