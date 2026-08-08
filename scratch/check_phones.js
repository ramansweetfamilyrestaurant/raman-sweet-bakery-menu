import { initDb, query } from '../server/db.js';

async function checkPhoneDuplicates() {
  await initDb();
  const rows = await query('SELECT phone, COUNT(*) as count FROM restaurants WHERE phone IS NOT NULL AND phone != \'\' GROUP BY phone HAVING COUNT(*) > 1');
  console.log('DUPLICATE PHONES IN RESTAURANTS:', JSON.stringify(rows));
  
  const allRestos = await query('SELECT id, name, slug, phone, created_at FROM restaurants');
  console.log('ALL RESTAURANTS:', JSON.stringify(allRestos, null, 2));
  process.exit(0);
}

checkPhoneDuplicates();
