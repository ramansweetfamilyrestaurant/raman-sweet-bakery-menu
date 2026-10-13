import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';

async function runMigration() {
  console.log('🚀 Running categories table migration...');

  const neonUrl = process.env.DATABASE_URL;
  if (!neonUrl) {
    console.error('❌ Configuration Error: DATABASE_URL environment variable is required.');
    process.exit(1);
  }
  
  try {
    const pool = new pg.Pool({ connectionString: neonUrl });
    await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;');
    await pool.query('UPDATE categories SET active = TRUE WHERE active IS NULL;');
    console.log('✅ Neon PostgreSQL categories table successfully updated with active column!');
    await pool.end();
  } catch (err) {
    console.error('PostgreSQL migration error:', err);
  }

  try {
    const dbFilePath = path.resolve('menu.db');
    const sqliteDb = new Database(dbFilePath);
    const catCols = sqliteDb.pragma('table_info(categories)');
    const hasActive = catCols.some(c => c.name === 'active');
    if (!hasActive) {
      sqliteDb.exec('ALTER TABLE categories ADD COLUMN active INTEGER DEFAULT 1');
      console.log('✅ SQLite menu.db categories table updated with active column!');
    } else {
      console.log('✅ SQLite active column already present');
    }
  } catch (err) {
    console.error('SQLite migration error:', err);
  }

  process.exit(0);
}

runMigration();
