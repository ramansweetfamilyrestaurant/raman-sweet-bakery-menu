import { initDb, query } from '../server/db.js';

async function checkRestos() {
  try {
    await initDb();
    const rows = await query('SELECT id, name, slug, active, created_at FROM restaurants');
    console.log('=== CURRENT RESTAURANTS IN DB ===');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkRestos();
