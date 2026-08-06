import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

async function runSaaSMigration() {
  console.log('🚀 Running Multi-Tenant SaaS Database Migration...');

  const neonUrl = 'postgresql://neondb_owner:npg_b8kmMozyl1hZ@ep-morning-flower-azvujg61.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  try {
    const pool = new pg.Pool({ connectionString: neonUrl });

    // 1. Create restaurants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        tagline VARCHAR(255),
        logo VARCHAR(1000),
        phone VARCHAR(100),
        address VARCHAR(500),
        opening_hours VARCHAR(255),
        google_review_url VARCHAR(1000),
        google_maps_url VARCHAR(1000),
        filters_visibility JSONB,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Add restaurant_id and role columns
    await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;');
    await pool.query('ALTER TABLE dishes ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;');
    await pool.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;');
    await pool.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'restaurant_admin';");

    // 3. Seed primary restaurant
    const restoCheck = await pool.query("SELECT * FROM restaurants WHERE slug = 'raman-sweet-bakery'");
    let primaryRestoId = restoCheck.rows[0]?.id;

    if (!primaryRestoId) {
      const res = await pool.query(`
        INSERT INTO restaurants (
          name, slug, tagline, logo, phone, address, opening_hours, google_review_url, google_maps_url, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
      `, [
        'Raman Sweet Bakery & Family Restaurant',
        'raman-sweet-bakery',
        '100% Pure Vegetarian • Pure Desi Ghee Sweets • Live Bakery',
        '/uploads/logo.jpg',
        '+91 9708366583',
        'HawaiAdda Chowk, Near katchari Gumti, Motihari, Bihar',
        '8:00 AM - 10:30 PM (Mon - Sun)',
        'https://r.revmeai.com/r/ee7e4c91-f85e-4a01-8767-eeaee0a89341',
        'https://share.google/2M5mFMPlmS6pAXRf7',
        true
      ]);
      primaryRestoId = res.rows[0]?.id;
    }

    // 4. Update orphan records to primaryRestoId
    await pool.query('UPDATE categories SET restaurant_id = $1 WHERE restaurant_id IS NULL;', [primaryRestoId]);
    await pool.query('UPDATE dishes SET restaurant_id = $1 WHERE restaurant_id IS NULL;', [primaryRestoId]);
    await pool.query('UPDATE admins SET restaurant_id = $1 WHERE restaurant_id IS NULL;', [primaryRestoId]);

    // 5. Ensure Super Admin account exists
    const superCheck = await pool.query("SELECT * FROM admins WHERE username = 'superadmin' OR role = 'superadmin'");
    if (superCheck.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('superadmin123', salt);
      await pool.query('INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)', [primaryRestoId, 'superadmin', hash, 'superadmin']);
      console.log('👑 Created Super Admin account on Neon PostgreSQL: superadmin / superadmin123');
    }

    console.log('✅ Neon PostgreSQL Multi-Tenant SaaS Migration Complete!');
    await pool.end();
  } catch (err) {
    console.error('PostgreSQL migration error:', err);
  }

  // SQLite local migration
  try {
    const dbFilePath = path.resolve('menu.db');
    const sqliteDb = new Database(dbFilePath);
    
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        tagline TEXT,
        logo TEXT,
        phone TEXT,
        address TEXT,
        opening_hours TEXT,
        google_review_url TEXT,
        google_maps_url TEXT,
        filters_visibility TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const catCols = sqliteDb.pragma('table_info(categories)');
    if (!catCols.some(c => c.name === 'restaurant_id')) sqliteDb.exec('ALTER TABLE categories ADD COLUMN restaurant_id INTEGER DEFAULT 1');

    const dishCols = sqliteDb.pragma('table_info(dishes)');
    if (!dishCols.some(c => c.name === 'restaurant_id')) sqliteDb.exec('ALTER TABLE dishes ADD COLUMN restaurant_id INTEGER DEFAULT 1');

    const adminCols = sqliteDb.pragma('table_info(admins)');
    if (!adminCols.some(c => c.name === 'restaurant_id')) sqliteDb.exec('ALTER TABLE admins ADD COLUMN restaurant_id INTEGER DEFAULT 1');
    if (!adminCols.some(c => c.name === 'role')) sqliteDb.exec("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'restaurant_admin'");

    console.log('✅ SQLite menu.db Multi-Tenant SaaS Migration Complete!');
  } catch (err) {
    console.error('SQLite migration error:', err);
  }

  process.exit(0);
}

runSaaSMigration();
