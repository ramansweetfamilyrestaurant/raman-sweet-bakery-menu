import { initDb, query } from '../server/db.js';

async function runMigration() {
  try {
    await initDb();
    console.log('Adding dual_printer_enabled column if not exists...');
    await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS dual_printer_enabled INT DEFAULT 1;');
    console.log('✓ Migration executed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

runMigration();
