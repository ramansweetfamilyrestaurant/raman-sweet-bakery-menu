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
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
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
        currency_symbol VARCHAR(10) DEFAULT '₹',
        fssai_lic_no VARCHAR(100) DEFAULT '',
        resto_type VARCHAR(50) DEFAULT 'pure_veg',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        image VARCHAR(1000),
        sort_order INT DEFAULT 0,
        active BOOLEAN DEFAULT TRUE
      );

      ALTER TABLE categories ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

      CREATE TABLE IF NOT EXISTS dishes (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
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
        type VARCHAR(20) DEFAULT 'veg',
        available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;

      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'restaurant_admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        table_number VARCHAR(50) DEFAULT '1',
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        items JSONB,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE admins ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'restaurant_admin';
      DO $$ BEGIN ALTER TABLE restaurants ALTER COLUMN code DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END $$;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tagline TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_review_url TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS active INT DEFAULT 1;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS filters_visibility TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS direct_ordering_enabled INT DEFAULT 1;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_reviews_enabled INT DEFAULT 1;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '₹';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS fssai_lic_no VARCHAR(100) DEFAULT '';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS resto_type VARCHAR(50) DEFAULT 'pure_veg';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'pro';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_price NUMERIC DEFAULT 999;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_expires_at VARCHAR(100);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp_enabled INT DEFAULT 1;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50) DEFAULT 'gold';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS scan_count INT DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude NUMERIC DEFAULT 26.6500;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude NUMERIC DEFAULT 84.9167;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS max_distance_meters INT DEFAULT 100;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS gst_enabled INT DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS gstin_number VARCHAR(50);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_tables INT DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS order_retention_days INT DEFAULT 90;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mandate_id VARCHAR(255);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mandate_status VARCHAR(50) DEFAULT 'pending';
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS trial_ends_at VARCHAR(100);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS auto_debit_enabled INT DEFAULT 1;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'veg';
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS name_hi TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS description_hi TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS image TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS portion TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS portion_half_label TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS portion_full_label TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS price_half NUMERIC DEFAULT 0;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS available INT DEFAULT 1;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_spicy INT DEFAULT 0;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS is_bestseller INT DEFAULT 0;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS badge TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS ingredients TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS preparation_time TEXT;
      ALTER TABLE dishes ADD COLUMN IF NOT EXISTS taste_profile TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS name_hi TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS service_requests (
        id SERIAL PRIMARY KEY,
        restaurant_id INT DEFAULT 1,
        table_number VARCHAR(50) DEFAULT '1',
        request_type VARCHAR(50) NOT NULL,
        note TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saas_plans (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        price NUMERIC DEFAULT 999,
        badge VARCHAR(50) DEFAULT '👑 PRO',
        description TEXT,
        whatsapp_enabled INT DEFAULT 1,
        direct_ordering_enabled INT DEFAULT 0,
        google_reviews_enabled INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        restaurant_id INT,
        actor_role VARCHAR(50),
        action VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO system_settings (key, value) VALUES ('support_whatsapp', '919876543210') ON CONFLICT (key) DO NOTHING;

      CREATE TABLE IF NOT EXISTS combos (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image VARCHAR(1000),
        items JSONB NOT NULL,
        available BOOLEAN DEFAULT TRUE,
        badge VARCHAR(100),
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_sales_summaries (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        summary_date VARCHAR(50) NOT NULL,
        total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_orders INT NOT NULL DEFAULT 0,
        top_dishes_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (restaurant_id, summary_date)
      );
    `);
  } else {
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
        currency_symbol TEXT DEFAULT '₹',
        fssai_lic_no TEXT DEFAULT '',
        resto_type TEXT DEFAULT 'pure_veg',
        plan_tier TEXT DEFAULT 'pro',
        plan_price REAL DEFAULT 999,
        plan_expires_at TEXT,
        whatsapp_number TEXT,
        whatsapp_enabled INTEGER DEFAULT 1,
        theme_color TEXT DEFAULT 'gold',
        scan_count INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS saas_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        price REAL DEFAULT 999,
        badge TEXT DEFAULT '👑 PRO',
        description TEXT,
        whatsapp_enabled INTEGER DEFAULT 1,
        direct_ordering_enabled INTEGER DEFAULT 0,
        google_reviews_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        actor_role TEXT,
        action TEXT,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        name_hi TEXT,
        image TEXT,
        sort_order INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS dishes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
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
        type TEXT DEFAULT 'veg',
        available INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'restaurant_admin',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
        table_number TEXT DEFAULT '1',
        customer_name TEXT,
        customer_phone TEXT,
        items TEXT,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS service_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
        table_number TEXT DEFAULT '1',
        request_type TEXT NOT NULL,
        note TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS combos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image TEXT,
        items TEXT NOT NULL,
        available INTEGER DEFAULT 1,
        badge TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO system_settings (key, value) VALUES ('support_whatsapp', '919876543210');

      CREATE TABLE IF NOT EXISTS daily_sales_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER DEFAULT 1,
        summary_date TEXT NOT NULL,
        total_sales REAL DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        top_dishes_summary TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (restaurant_id, summary_date),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );
    `);

    // Auto Migrations for SQLite
    try {
      const catCols = sqliteDb.pragma('table_info(categories)');
      if (!catCols.some(c => c.name === 'active')) sqliteDb.exec('ALTER TABLE categories ADD COLUMN active INTEGER DEFAULT 1');
      if (!catCols.some(c => c.name === 'restaurant_id')) sqliteDb.exec('ALTER TABLE categories ADD COLUMN restaurant_id INTEGER DEFAULT 1');

      const dishCols = sqliteDb.pragma('table_info(dishes)');
      if (!dishCols.some(c => c.name === 'restaurant_id')) sqliteDb.exec('ALTER TABLE dishes ADD COLUMN restaurant_id INTEGER DEFAULT 1');
      if (!dishCols.some(c => c.name === 'type')) sqliteDb.exec("ALTER TABLE dishes ADD COLUMN type TEXT DEFAULT 'veg'");

      const adminCols = sqliteDb.pragma('table_info(admins)');
      if (!adminCols.some(c => c.name === 'restaurant_id')) sqliteDb.exec('ALTER TABLE admins ADD COLUMN restaurant_id INTEGER DEFAULT 1');
      if (!adminCols.some(c => c.name === 'role')) sqliteDb.exec("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'restaurant_admin'");

      const restoCols = sqliteDb.pragma('table_info(restaurants)');
      if (!restoCols.some(c => c.name === 'currency_symbol')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN currency_symbol TEXT DEFAULT '₹'");
      if (!restoCols.some(c => c.name === 'fssai_lic_no')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN fssai_lic_no TEXT DEFAULT ''");
      if (!restoCols.some(c => c.name === 'resto_type')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN resto_type TEXT DEFAULT 'pure_veg'");
      if (!restoCols.some(c => c.name === 'plan_tier')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN plan_tier TEXT DEFAULT 'pro'");
      if (!restoCols.some(c => c.name === 'plan_price')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN plan_price REAL DEFAULT 999");
      if (!restoCols.some(c => c.name === 'plan_expires_at')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN plan_expires_at TEXT");
      if (!restoCols.some(c => c.name === 'whatsapp_number')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN whatsapp_number TEXT");
      if (!restoCols.some(c => c.name === 'whatsapp_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN whatsapp_enabled INTEGER DEFAULT 1");
      if (!restoCols.some(c => c.name === 'direct_ordering_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN direct_ordering_enabled INTEGER DEFAULT 1");
      if (!restoCols.some(c => c.name === 'google_reviews_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN google_reviews_enabled INTEGER DEFAULT 1");
      if (!restoCols.some(c => c.name === 'theme_color')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN theme_color TEXT DEFAULT 'gold'");
      if (!restoCols.some(c => c.name === 'scan_count')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN scan_count INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'latitude')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN latitude REAL DEFAULT 26.6500");
      if (!restoCols.some(c => c.name === 'longitude')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN longitude REAL DEFAULT 84.9167");
      if (!restoCols.some(c => c.name === 'max_distance_meters')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN max_distance_meters INTEGER DEFAULT 100");
      if (!restoCols.some(c => c.name === 'gst_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN gst_enabled INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'gstin_number')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN gstin_number TEXT");
      if (!restoCols.some(c => c.name === 'total_tables')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN total_tables INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'order_retention_days')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN order_retention_days INTEGER DEFAULT 90");
      if (!restoCols.some(c => c.name === 'mandate_id')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN mandate_id TEXT");
      if (!restoCols.some(c => c.name === 'mandate_status')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN mandate_status TEXT DEFAULT 'pending'");
      if (!restoCols.some(c => c.name === 'trial_ends_at')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN trial_ends_at TEXT");
      if (!restoCols.some(c => c.name === 'auto_debit_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN auto_debit_enabled INTEGER DEFAULT 1");
    } catch (err) {
      console.warn('SQLite migration info:', err.message);
    }
  }
}

async function seedData() {
  // Ensure default primary restaurant (Raman Sweet Bakery) exists
  const restoCheck = await query('SELECT * FROM restaurants WHERE slug = $1', ['raman-sweet-bakery']);
  let primaryRestoId = restoCheck[0]?.id;

  if (!primaryRestoId) {
    const res = await query(`
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
      1
    ]);
    primaryRestoId = res[0]?.id || res.lastInsertRowid || 1;
    console.log(`🏨 Created primary tenant restaurant Raman Sweet Bakery (ID: ${primaryRestoId})`);
  }

  // Ensure Raja Restaurant exists by default
  try {
    const rajaCheck = await query('SELECT * FROM restaurants WHERE slug = $1', ['raja-restaurant']);
    if (!rajaCheck || rajaCheck.length === 0) {
      const rajaRes = await query(`
        INSERT INTO restaurants (
          name, slug, tagline, logo, phone, address, opening_hours, active, plan_tier, plan_price, order_retention_days
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
      `, [
        'raja restaurant',
        'raja-restaurant',
        'Authentic Indian Sweets & Fast Food',
        '/uploads/logo.jpg',
        '+919999999999',
        'Motihari, Bihar',
        '8:00 AM - 10:30 PM',
        1,
        'enterprise',
        1990,
        90
      ]);
      const rajaId = rajaRes[0]?.id || rajaRes.lastInsertRowid;
      
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      await query(`
        INSERT INTO admins (restaurant_id, username, password_hash, role)
        VALUES ($1, $2, $3, $4)
      `, [rajaId, 'admin', hash, 'restaurant_admin']);
      console.log(`🏨 Seeded tenant restaurant Raja Restaurant (ID: ${rajaId})`);
    }
  } catch (err) {
    console.warn('Raja restaurant seeding notice:', err.message);
  }

  // Seed default SaaS Plans if empty
  try {
    // Migration: Add max_combos and original_price columns if not existing
    try {
      await query('ALTER TABLE saas_plans ADD COLUMN max_combos INT DEFAULT 10');
      await query("UPDATE saas_plans SET max_combos = 3 WHERE key = 'basic'");
      await query("UPDATE saas_plans SET max_combos = 10 WHERE key = 'pro'");
      await query("UPDATE saas_plans SET max_combos = 9999 WHERE key = 'enterprise'");
    } catch {
      // Column already exists
    }

    try {
      await query('ALTER TABLE saas_plans ADD COLUMN original_price NUMERIC DEFAULT 999');
      await query("UPDATE saas_plans SET original_price = 999 WHERE key = 'basic'");
      await query("UPDATE saas_plans SET original_price = 1999 WHERE key = 'pro'");
      await query("UPDATE saas_plans SET original_price = 3999 WHERE key = 'enterprise'");
    } catch {
      // Column already exists
    }

    // Coupons Table (PostgreSQL & SQLite)
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_percent INT DEFAULT 0,
          discount_amount NUMERIC DEFAULT 0,
          max_uses INT DEFAULT 100,
          used_count INT DEFAULT 0,
          active INT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const couponCheck = await query('SELECT COUNT(*) as count FROM coupons');
      if (parseInt(couponCheck[0]?.count || 0, 10) === 0) {
        await query(`
          INSERT INTO coupons (code, discount_percent, discount_amount, max_uses, active)
          VALUES 
          ('LAUNCH50', 50, 0, 1000, 1),
          ('FIRST100', 30, 0, 100, 1),
          ('FLAT200', 0, 200, 500, 1)
        `);
        console.log('🎟️ Seeded default promo coupons into coupons table');
      }
    } catch (e) {
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            discount_percent INTEGER DEFAULT 0,
            discount_amount REAL DEFAULT 0,
            max_uses INTEGER DEFAULT 100,
            used_count INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch {}
    }

    const planCheck = await query('SELECT COUNT(*) as count FROM saas_plans');
    const pCount = parseInt(planCheck[0]?.count || 0, 10);
    if (pCount === 0) {
      await query(`
        INSERT INTO saas_plans (key, name, price, original_price, badge, description, whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled, max_combos)
        VALUES 
        ('basic', 'Basic Starter Plan', 499, 999, '⚡ BASIC', 'Digital Menu Viewing & Custom Themes', 0, 0, 0, 3),
        ('pro', 'Pro Luxury Plan', 999, 1999, '👑 PRO', 'Menu + WhatsApp Ordering + Google Reviews', 1, 0, 1, 10),
        ('enterprise', 'Enterprise VIP Plan', 1999, 3999, '🚀 ENTERPRISE', 'All Features + Direct Table QR KOT Ordering & Kitchen System', 1, 1, 1, 9999)
      `);
      console.log('💳 Seeded default SaaS Plans into saas_plans table');
    }
  } catch (err) {
    console.warn('SaaS plan seeding notice:', err.message);
  }

  // Update existing data to link to primaryRestoId
  await query('UPDATE categories SET restaurant_id = $1 WHERE restaurant_id IS NULL OR restaurant_id = 0', [primaryRestoId]);
  await query('UPDATE dishes SET restaurant_id = $1 WHERE restaurant_id IS NULL OR restaurant_id = 0', [primaryRestoId]);
  await query('UPDATE admins SET restaurant_id = $1 WHERE restaurant_id IS NULL OR restaurant_id = 0', [primaryRestoId]);

  const catCheck = await query('SELECT COUNT(*) as count FROM categories WHERE restaurant_id = $1', [primaryRestoId]);
  const count = parseInt(catCheck[0]?.count || 0, 10);

  const imgCheck = await query("SELECT COUNT(*) as count FROM dishes WHERE image LIKE 'http%'");
  const hasRealImages = parseInt(imgCheck[0]?.count || 0, 10) > 0;

  if (count === 0 || !hasRealImages) {
    console.log('🌱 Seeding authentic menu data for Raman Sweet Bakery...');
    try {
      await query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = $1)', [primaryRestoId]);
      await query('DELETE FROM orders WHERE restaurant_id = $1', [primaryRestoId]);
      await query('DELETE FROM dishes WHERE restaurant_id = $1', [primaryRestoId]);
      await query('DELETE FROM categories WHERE restaurant_id = $1', [primaryRestoId]);
    } catch (e) {
      console.warn('Seeding cleanup notice:', e.message);
    }

    const jsonPath = path.resolve('server/exported_menu_data.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const catIdMap = {};

      for (const cat of data.categories) {
        const res = await query(
          'INSERT INTO categories (restaurant_id, name, name_hi, image, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [primaryRestoId, cat.name, cat.name_hi || '', cat.image || '/uploads/logo.jpg', cat.sort_order || 0]
        );
        const newId = res[0]?.id || res.lastInsertRowid;
        catIdMap[cat.id] = newId;
      }

      for (const d of data.dishes) {
        const newCatId = catIdMap[d.category_id];
        try {
          await query(
            `INSERT INTO dishes (
              restaurant_id, category_id, name, name_hi, description, description_hi, image, price, price_half,
              portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, available
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              primaryRestoId, newCatId, d.name, d.name_hi || '', d.description || '', d.description_hi || '', d.image || '/uploads/logo.jpg', d.price, d.price_half || null,
              d.portion || '', d.portion_half_label || '', d.portion_full_label || '', d.badge || '', d.ingredients || '', d.taste_profile || '', d.available !== false ? 1 : 0
            ]
          );
        } catch (e) {
          console.warn('Skipping existing dish:', d.name);
        }
      }
      console.log(`✅ Seeded ${data.categories.length} categories and ${data.dishes.length} dishes for Raman Sweet Bakery!`);
    }
  }

  // Ensure Admin user exists for Raman Sweet Bakery
  const adminCheck = await query('SELECT COUNT(*) as count FROM admins WHERE username = $1', ['admin']);
  const adminCount = parseInt(adminCheck[0]?.count || 0, 10);
  if (adminCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    await query('INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)', [primaryRestoId, 'admin', hash, 'restaurant_admin']);
    console.log('🔐 Created default restaurant admin account: admin / admin123');
  }

  // Ensure Super Admin user exists
  const superCheck = await query('SELECT COUNT(*) as count FROM admins WHERE username = $1 OR role = $2', ['superadmin', 'superadmin']);
  const superCount = parseInt(superCheck[0]?.count || 0, 10);
  if (superCount === 0) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('superadmin123', salt);
    await query('INSERT INTO admins (restaurant_id, username, password_hash, role) VALUES ($1, $2, $3, $4)', [primaryRestoId, 'superadmin', hash, 'superadmin']);
    console.log('👑 Created Master Super Admin account: superadmin / superadmin123');
  }

  // Seed default sample Combos if empty
  try {
    const comboCheck = await query('SELECT COUNT(*) as count FROM combos WHERE restaurant_id = $1', [primaryRestoId]);
    const comboCount = parseInt(comboCheck[0]?.count || 0, 10);
    if (comboCount === 0) {
      const sampleItems1 = JSON.stringify([
        { dish_id: 24, dish_name: "Aloo Tikki Chaat", qty: 1, portion: "full", original_price: 60 },
        { dish_id: 31, dish_name: "Paneer Pakoda", qty: 1, portion: "full", original_price: 90 },
        { dish_id: 28, dish_name: "Kachori", qty: 2, portion: "full", original_price: 30 }
      ]);
      const sampleItems2 = JSON.stringify([
        { dish_id: 32, dish_name: "Steam Momo", qty: 1, portion: "full", original_price: 70 },
        { dish_id: 29, dish_name: "Bread Pakoda", qty: 2, portion: "full", original_price: 50 }
      ]);
      await query(`
        INSERT INTO combos (restaurant_id, name, description, price, image, items, badge, available, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        primaryRestoId,
        '🌟 Raman Special Chaat & Pakoda Thali',
        'Complete evening snacks platter with Aloo Tikki, Paneer Pakoda & 2x Kachoris',
        149,
        'https://images.unsplash.com/photo-1617692855027-33b14f061079?w=600&auto=format&fit=crop&q=80',
        sampleItems1,
        '⭐ Bestseller',
        1,
        1
      ]);
      await query(`
        INSERT INTO combos (restaurant_id, name, description, price, image, items, badge, available, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        primaryRestoId,
        '☕ Evening Snack Combo',
        'Tasty Momo & Bread Pakoda combo deal',
        99,
        'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
        sampleItems2,
        '💰 Value Deal',
        1,
        2
      ]);
      console.log('🛒 Seeded default sample Combo Deals into combos table');
    }

    // Auto-fix any combo without valid cloud image
    await query(`
      UPDATE combos SET image = 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80'
      WHERE image IS NULL OR image = '' OR image = '/uploads/logo.jpg' OR image LIKE '/uploads/%'
    `);
  } catch (err) {
    console.warn('Combo seeding notice:', err.message);
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

    // Convert booleans to 1 or 0 for SQLite (better-sqlite3 only accepts numbers/strings)
    const sanitizedParams = params.map(p => (typeof p === 'boolean' ? (p ? 1 : 0) : p));

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const stmt = sqliteDb.prepare(sql);
      return stmt.all(sanitizedParams);
    } else if (sql.trim().toUpperCase().startsWith('INSERT') && sql.toUpperCase().includes('RETURNING')) {
      const sqlNoReturning = sql.replace(/RETURNING\s+\w+/gi, '');
      const stmtNoRet = sqliteDb.prepare(sqlNoReturning);
      const res = stmtNoRet.run(sanitizedParams);
      return [{ id: res.lastInsertRowid }];
    } else {
      const stmt = sqliteDb.prepare(sql);
      return stmt.run(sanitizedParams);
    }
  }
}

async function logAudit(restaurantId, actorRole, action, details) {
  try {
    await query(
      'INSERT INTO audit_logs (restaurant_id, actor_role, action, details) VALUES ($1, $2, $3, $4)',
      [restaurantId || null, actorRole, action, details]
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

async function runAutoDataSummarization(daysOld = 90, targetRestaurantId = null) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffISO = cutoffDate.toISOString().split('T')[0] + ' 23:59:59';

    let sql = 'SELECT * FROM orders WHERE created_at <= $1';
    const params = [cutoffISO];
    if (targetRestaurantId) {
      sql += ' AND restaurant_id = $2';
      params.push(targetRestaurantId);
    }
    sql += ' ORDER BY created_at ASC';

    const oldOrders = await query(sql, params);
    if (!oldOrders || oldOrders.length === 0) {
      return { summarized_days: 0, purged_orders: 0, message: 'No orders older than ' + daysOld + ' days found to summarize' };
    }

    const grouped = {};
    for (const o of oldOrders) {
      const restoId = o.restaurant_id || 1;
      let dStr = '';
      if (o.created_at) {
        dStr = String(o.created_at).substring(0, 10);
      }
      if (!dStr || dStr.length < 10) continue;

      const key = `${restoId}_${dStr}`;
      if (!grouped[key]) {
        grouped[key] = {
          restaurant_id: restoId,
          summary_date: dStr,
          total_sales: 0,
          total_orders: 0,
          itemsMap: {},
          orderIds: []
        };
      }

      grouped[key].total_sales += Number(o.total_amount) || 0;
      grouped[key].total_orders += 1;
      grouped[key].orderIds.push(o.id);

      let itemsList = [];
      try {
        itemsList = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
      } catch (e) { itemsList = []; }

      if (Array.isArray(itemsList)) {
        for (const item of itemsList) {
          const name = item.name || item.dish_name || 'Item';
          const qty = Number(item.quantity || item.qty || 1);
          grouped[key].itemsMap[name] = (grouped[key].itemsMap[name] || 0) + qty;
        }
      }
    }

    let summarizedDaysCount = 0;
    let purgedOrdersCount = 0;

    for (const key in grouped) {
      const summary = grouped[key];
      const topDishes = Object.entries(summary.itemsMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      const topDishesJson = JSON.stringify(topDishes);

      if (dbType === 'postgres') {
        await query(`
          INSERT INTO daily_sales_summaries (restaurant_id, summary_date, total_sales, total_orders, top_dishes_summary)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (restaurant_id, summary_date)
          DO UPDATE SET total_sales = daily_sales_summaries.total_sales + EXCLUDED.total_sales,
                        total_orders = daily_sales_summaries.total_orders + EXCLUDED.total_orders,
                        top_dishes_summary = EXCLUDED.top_dishes_summary
        `, [summary.restaurant_id, summary.summary_date, summary.total_sales, summary.total_orders, topDishesJson]);
      } else {
        const existing = await query('SELECT * FROM daily_sales_summaries WHERE restaurant_id = $1 AND summary_date = $2', [summary.restaurant_id, summary.summary_date]);
        if (existing && existing.length > 0) {
          await query(`
            UPDATE daily_sales_summaries
            SET total_sales = total_sales + $1, total_orders = total_orders + $2, top_dishes_summary = $3
            WHERE restaurant_id = $4 AND summary_date = $5
          `, [summary.total_sales, summary.total_orders, topDishesJson, summary.restaurant_id, summary.summary_date]);
        } else {
          await query(`
            INSERT INTO daily_sales_summaries (restaurant_id, summary_date, total_sales, total_orders, top_dishes_summary)
            VALUES ($1, $2, $3, $4, $5)
          `, [summary.restaurant_id, summary.summary_date, summary.total_sales, summary.total_orders, topDishesJson]);
        }
      }

      for (const orderId of summary.orderIds) {
        await query('DELETE FROM orders WHERE id = $1', [orderId]);
        purgedOrdersCount++;
      }

      summarizedDaysCount++;
    }

    await logAudit(targetRestaurantId || 1, 'SYSTEM', 'AUTO_SUMMARIZATION', `Summarized ${summarizedDaysCount} days, purged ${purgedOrdersCount} old individual orders older than ${daysOld} days`);

    return {
      summarized_days: summarizedDaysCount,
      purged_orders: purgedOrdersCount,
      message: `Successfully summarized ${summarizedDaysCount} days and compressed ${purgedOrdersCount} individual order records into daily rollups!`
    };
  } catch (err) {
    console.error('Data Summarization Engine Error:', err);
    throw err;
  }
}

export { initDb, query, logAudit, runAutoDataSummarization };
