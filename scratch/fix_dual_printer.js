import { initDb, query } from '../server/db.js';

async function fix() {
  try {
    await initDb();
    // Set dual_printer_enabled = 0 for basic and pro plans (only enterprise/vip should have it)
    await query("UPDATE saas_plans SET dual_printer_enabled = 0 WHERE key IN ('basic', 'pro')");
    console.log('Updated basic and pro to dual_printer_enabled=0');
    
    const r = await query('SELECT key, dual_printer_enabled FROM saas_plans ORDER BY key');
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fix();
