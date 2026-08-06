import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;

const dbFilePath = path.resolve('menu.db');

async function initDb() {
  if (process.env.DATABASE_URL) {
    try {
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
      });
      await pool.query('SELECT 1');
      pgPool = pool;
      dbType = 'postgres';
      console.log('⚡ Connected to PostgreSQL Database');
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed. Falling back to SQLite database:', err.message);
      dbType = 'sqlite';
    }
  }

  if (dbType === 'sqlite') {
    sqliteDb = new Database(dbFilePath);
    sqliteDb.pragma('foreign_keys = ON');
    console.log('⚡ Connected to SQLite Database at:', dbFilePath);
  }

  await createTables();
  await seedData();
}

async function createTables() {
  if (dbType === 'postgres') {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        image VARCHAR(1000),
        sort_order INT DEFAULT 0,
        active BOOLEAN DEFAULT TRUE
      );

      ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS dishes (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES categories(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        description TEXT,
        description_hi TEXT,
        image VARCHAR(1000),
        price DECIMAL(10, 2) NOT NULL,
        price_half DECIMAL(10, 2),
        portion VARCHAR(100),
        portion_half_label VARCHAR(100),
        portion_full_label VARCHAR(100),
        badge VARCHAR(100),
        ingredients VARCHAR(500),
        taste_profile VARCHAR(100),
        available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_hi TEXT,
        image TEXT,
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        name TEXT NOT NULL,
        name_hi TEXT,
        description TEXT,
        description_hi TEXT,
        image TEXT,
        price REAL NOT NULL,
        price_half REAL,
        portion TEXT,
        portion_half_label TEXT,
        portion_full_label TEXT,
        badge TEXT,
        ingredients TEXT,
        taste_profile TEXT,
        available INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      const catCols = sqliteDb.pragma('table_info(categories)');
      const hasActive = catCols.some(c => c.name === 'active');
      if (!hasActive) {
        sqliteDb.exec('ALTER TABLE categories ADD COLUMN active INTEGER DEFAULT 1');
      }
    } catch (err) {
      console.warn('SQLite migration info:', err.message);
    }
  }
}

async function seedData() {
  const catCheck = await query('SELECT COUNT(*) as count FROM categories');
  const count = parseInt(catCheck[0]?.count || 0, 10);

  const imgCheck = await query("SELECT COUNT(*) as count FROM dishes WHERE image LIKE 'http%'");
  const hasRealImages = parseInt(imgCheck[0]?.count || 0, 10) > 0;

  if (count === 0 || !hasRealImages) {
    console.log('🌱 Seeding authentic menu data with all custom Image URLs...');
    await query('DELETE FROM dishes');
    await query('DELETE FROM categories');

    const jsonPath = path.resolve('server/exported_menu_data.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const catIdMap = {};

      for (const cat of data.categories) {
        const res = await query(
          'INSERT INTO categories (name, name_hi, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
          [cat.name, cat.name_hi || '', cat.image || '/uploads/logo.jpg', cat.sort_order || 0]
        );
        const newId = res[0]?.id || res.lastInsertRowid;
        catIdMap[cat.id] = newId;
      }

      for (const d of data.dishes) {
        const newCatId = catIdMap[d.category_id];
        await query(
          `INSERT INTO dishes (
            category_id, name, name_hi, description, description_hi, image, price, price_half,
            portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, available
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            newCatId, d.name, d.name_hi || '', d.description || '', d.description_hi || '', d.image || '/uploads/logo.jpg', d.price, d.price_half || null,
            d.portion || '', d.portion_half_label || '', d.portion_full_label || '', d.badge || '', d.ingredients || '', d.taste_profile || '', d.available !== false ? 1 : 0
          ]
        );
      }
      console.log(`✅ Seeded ${data.categories.length} categories and ${data.dishes.length} dishes with all custom Image URLs!`);
    }
  }

  // Ensure Admin user exists
  const adminCheck = await query('SELECT COUNT(*) as count FROM admins');
  const adminCount = parseInt(adminCheck[0]?.count || 0, 10);
  if (adminCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    await query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('🔐 Created default admin account: admin / admin123');
  }
}

async function query(text, params = []) {
  if (dbType === 'postgres') {
    const res = await pgPool.query(text, params);
    return res.rows;
  } else {
    let sql = text;
    // Convert $1, $2 parameter placeholders to SQLite ?
    sql = sql.replace(/\$(\d+)/g, () => '?');

    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(params);
    } else if (sql.trim().toUpperCase().startsWith('INSERT') && sql.toUpperCase().includes('RETURNING')) {
      const sqlNoReturning = sql.replace(/RETURNING\s+\w+/i, '');
      const stmtNoRet = sqliteDb.prepare(sqlNoReturning);
      const info = stmtNoRet.run(params);
      return [{ id: info.lastInsertRowid }];
    } else {
      return stmt.run(params);
    }
  }
}

export { initDb, query };
