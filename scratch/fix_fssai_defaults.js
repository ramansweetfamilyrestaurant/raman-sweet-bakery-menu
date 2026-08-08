import { initDb, query } from '../server/db.js';

async function fixFSSAI() {
  try {
    await initDb();
    const res = await query("UPDATE restaurants SET fssai_lic_no = '' WHERE id > 1 AND fssai_lic_no = '20824001000123'");
    console.log('✅ Cleared hardcoded FSSAI license numbers for tenant restaurants!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixFSSAI();
