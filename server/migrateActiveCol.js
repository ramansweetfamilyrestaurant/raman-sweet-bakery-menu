import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';

async function runMigration() {
  console.log('🚀 Running categories table migration...');

  const neonUrl = 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
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
