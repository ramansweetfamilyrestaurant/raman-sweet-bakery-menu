import { initDb, query } from '../server/db.js';

async function fixTables() {
  try {
    await initDb();
    const res = await query("UPDATE restaurants SET total_tables = 0 WHERE id > 1 AND total_tables = 12");
    console.log('✅ Updated tenant restaurants with default 12 tables to 0 tables!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixTables();
