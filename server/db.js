import pg from 'pg';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;
let isDbInitialized = false;

const dbFilePath = path.resolve('menu.db');

async function initDb() {
  if (isDbInitialized) return;

  if (process.env.DATABASE_URL) {
    try {
      if (!pgPool) {
        pgPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 10000,
          max: 10,
          idleTimeoutMillis: 30000,
        });
      }
      dbType = 'postgres';
      console.log('⚡ Connected to PostgreSQL Database pool');
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed. Falling back to SQLite database:', err.message);
      dbType = 'sqlite';
    }
  }

  if (dbType === 'sqlite' && !process.env.VERCEL) {
    try {
      const sqliteModule = await import('better-sqlite3');
      const Database = sqliteModule.default || sqliteModule;
      sqliteDb = new Database(dbFilePath);
      sqliteDb.pragma('foreign_keys = ON');
      console.log('⚡ Connected to SQLite Database at:', dbFilePath);
    } catch (sqliteErr) {
      console.warn('SQLite dynamic import notice:', sqliteErr.message);
    }
  }

  if (!process.env.VERCEL) {
    await createTables().catch(() => {});
    isDbInitialized = true;
    await seedData().catch(() => {});
  } else {
    isDbInitialized = true;
  }
}

async function createTables() {
  if (dbType === 'postgres') {
    const pgTables = [
      `CREATE TABLE IF NOT EXISTS restaurants (
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
        custom_domain VARCHAR(255),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        name_hi VARCHAR(255),
        image VARCHAR(1000),
        sort_order INT DEFAULT 0,
        active BOOLEAN DEFAULT TRUE
      );`,

      `CREATE TABLE IF NOT EXISTS dishes (
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
      );`,

      `CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'restaurant_admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        table_number VARCHAR(50) DEFAULT '1',
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        items JSONB,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        sent_to_kds INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        active INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS service_requests (
        id SERIAL PRIMARY KEY,
        restaurant_id INT DEFAULT 1,
        table_number VARCHAR(50) DEFAULT '1',
        request_type VARCHAR(50) NOT NULL,
        note TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS saas_plans (
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
      );`,

      `CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        restaurant_id INT,
        actor_role VARCHAR(50),
        action VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS combos (
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
      );`,

      `CREATE TABLE IF NOT EXISTS daily_sales_summaries (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        summary_date VARCHAR(50) NOT NULL,
        total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
        total_orders INT NOT NULL DEFAULT 0,
        top_dishes_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (restaurant_id, summary_date)
      );`,

      `CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        plan_id INT REFERENCES saas_plans(id),
        gateway VARCHAR(50) DEFAULT 'none',
        gateway_subscription_id VARCHAR(255),
        gateway_customer_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'trialing',
        amount DECIMAL(10, 2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        billing_cycle VARCHAR(50) DEFAULT 'monthly',
        trial_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        trial_end TIMESTAMP,
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        next_billing_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        subscription_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
        gateway VARCHAR(50),
        gateway_payment_id VARCHAR(255),
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50),
        payment_type VARCHAR(50),
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        gateway VARCHAR(50) NOT NULL,
        event_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100),
        payload JSONB,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (gateway, event_id)
      );`,

      `CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        discount_type VARCHAR(50) NOT NULL DEFAULT 'PERCENTAGE',
        discount_value DECIMAL(10, 2) NOT NULL,
        applicable_plans VARCHAR(255) DEFAULT 'all',
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP,
        max_total_uses INT DEFAULT 100,
        max_uses_per_restaurant INT DEFAULT 1,
        first_payment_only BOOLEAN DEFAULT TRUE,
        minimum_plan_amount DECIMAL(10, 2) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        used_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      `CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id SERIAL PRIMARY KEY,
        coupon_id INT REFERENCES coupons(id) ON DELETE CASCADE,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        subscription_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
        original_amount DECIMAL(10, 2) NOT NULL,
        discount_amount DECIMAL(10, 2) NOT NULL,
        final_amount DECIMAL(10, 2) NOT NULL,
        billing_cycle INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'applied',
        redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (coupon_id, restaurant_id, subscription_id)
      );`,

      `CREATE TABLE IF NOT EXISTS stored_images (
        filename VARCHAR(255) PRIMARY KEY,
        mime_type VARCHAR(100) NOT NULL,
        data TEXT,
        storage_provider VARCHAR(50) DEFAULT 'local',
        image_key VARCHAR(500),
        image_url VARCHAR(1000),
        restaurant_id INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS pending_registrations (
        id VARCHAR(100) PRIMARY KEY,
        payload TEXT NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        owner_username VARCHAR(100),
        password_hash TEXT,
        plan_key VARCHAR(50),
        plan_price NUMERIC(10,2),
        trial_days INT,
        cashfree_subscription_id VARCHAR(255),
        cashfree_subscription_session_id VARCHAR(255),
        mandate_status VARCHAR(50) DEFAULT 'pending',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        completed_at TIMESTAMP,
        restaurant_id INT,
        created_slug VARCHAR(255),
        created_jwt TEXT,
        created_user VARCHAR(255)
      );`,
      `CREATE TABLE IF NOT EXISTS auth_codes (
        code VARCHAR(128) PRIMARY KEY,
        restaurant_id INT NOT NULL,
        username VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS table_location_verifications (
        id SERIAL PRIMARY KEY,
        restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
        table_number VARCHAR(50) NOT NULL,
        verification_token VARCHAR(255) UNIQUE NOT NULL,
        distance_meters NUMERIC,
        accuracy_meters NUMERIC,
        status VARCHAR(50) DEFAULT 'verified',
        verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );`
    ];

    for (const q of pgTables) {
      try { await pgPool.query(q); } catch (e) { console.warn('Postgres table query notice:', e.message); }
    }

    const pgAlters = [
      `ALTER TABLE table_location_verifications ALTER COLUMN expires_at TYPE TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE table_location_verifications ALTER COLUMN verified_at TYPE TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS name VARCHAR(255);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS owner_username VARCHAR(100);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS password_hash TEXT;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS plan_key VARCHAR(50);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS plan_price NUMERIC(10,2);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS trial_days INT;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS cashfree_subscription_id VARCHAR(255);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS cashfree_subscription_session_id VARCHAR(255);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS mandate_status VARCHAR(50) DEFAULT 'pending';`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS restaurant_id INT;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS created_slug VARCHAR(255);`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS created_jwt TEXT;`,
      `ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS created_user VARCHAR(255);`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(50) DEFAULT 'monthly';`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS features TEXT;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scheduled_plan_id INT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scheduled_plan_key VARCHAR(50);`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_change_effective_at TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'PAID';`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS admin_notes TEXT;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_period_expires_at TIMESTAMP;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(50) DEFAULT 'PAID';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS admin_notes TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS grace_period_expires_at TIMESTAMP;`,
      `ALTER TABLE stored_images ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'local';`,
      `ALTER TABLE stored_images ADD COLUMN IF NOT EXISTS image_key VARCHAR(500);`,
      `ALTER TABLE stored_images ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);`,
      `ALTER TABLE stored_images ADD COLUMN IF NOT EXISTS restaurant_id INT DEFAULT 1;`,
      `ALTER TABLE stored_images ALTER COLUMN data DROP NOT NULL;`,
      `ALTER TABLE categories ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;`,
      `ALTER TABLE categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`,
      `ALTER TABLE dishes ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;`,
      `ALTER TABLE admins ADD COLUMN IF NOT EXISTS restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE;`,
      `ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'restaurant_admin';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tagline TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_review_url TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_maps_url TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS active INT DEFAULT 1;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS filters_visibility TEXT;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS direct_ordering_enabled INT DEFAULT 1;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_reviews_enabled INT DEFAULT 1;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '₹';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS fssai_lic_no VARCHAR(100) DEFAULT '';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS resto_type VARCHAR(50) DEFAULT 'pure_veg';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(50) DEFAULT 'pro';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_price NUMERIC DEFAULT 999;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_expires_at VARCHAR(100);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS whatsapp_enabled INT DEFAULT 1;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50) DEFAULT 'gold';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS scan_count INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude NUMERIC DEFAULT 26.6500;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude NUMERIC DEFAULT 84.9167;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS max_distance_meters INT DEFAULT 100;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS gst_enabled INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS gstin_number VARCHAR(50);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_tables INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_cabins INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_rooms INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_vip INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS table_prefix VARCHAR(50) DEFAULT 'table';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_secret VARCHAR(255);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS order_retention_days INT DEFAULT 90;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mandate_id VARCHAR(255);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS mandate_status VARCHAR(50) DEFAULT 'pending';`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS trial_ends_at VARCHAR(100);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS auto_debit_enabled INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS trial_started_at VARCHAR(100);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT TRUE;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS location_initialized BOOLEAN NOT NULL DEFAULT FALSE;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS restaurant_id INT;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS subscription_id INT;`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway VARCHAR(50) DEFAULT 'cashfree';`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50);`,
      `ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;`,
      `ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'PERCENTAGE';`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_plans VARCHAR(255) DEFAULT 'all';`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_total_uses INT DEFAULT 100;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses_per_restaurant INT DEFAULT 1;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS first_payment_only BOOLEAN DEFAULT TRUE;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minimum_plan_amount DECIMAL(10, 2) DEFAULT 0;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;`,
      `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0;`,
      `CREATE INDEX IF NOT EXISTS idx_restaurants_active_expires ON restaurants(active, plan_expires_at);`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON subscriptions(restaurant_id);`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_at);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_payid ON payments(gateway, gateway_payment_id);`,
      // Phase 4: Subscription Lifecycle Management columns
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew INT DEFAULT 1;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS scheduled_plan_key VARCHAR(50);`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_change_effective_at TIMESTAMP;`,
      `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_cancel ON subscriptions(cancel_requested_at);`,
      `CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_change ON subscriptions(scheduled_plan_key);`,
      // 1,000-Restaurant Composite Indexes for Fast Tenant Querying
      `CREATE INDEX IF NOT EXISTS idx_categories_resto_sort ON categories(restaurant_id, sort_order ASC, id ASC);`,
      `CREATE INDEX IF NOT EXISTS idx_dishes_resto_available ON dishes(restaurant_id, available);`,
      `CREATE INDEX IF NOT EXISTS idx_combos_resto_sort ON combos(restaurant_id, sort_order ASC, id ASC);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_resto_created ON orders(restaurant_id, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_resto_status ON orders(restaurant_id, status);`,
      `CREATE INDEX IF NOT EXISTS idx_service_req_resto ON service_requests(restaurant_id, status, created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_stored_images_resto_filename ON stored_images(restaurant_id, filename);`,
      // Master 24-Point SaaS Plan Permission Matrix Columns
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS max_dishes INT DEFAULT 9999;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS max_categories INT DEFAULT 9999;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS max_combos INT DEFAULT 9999;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS max_tables INT DEFAULT 9999;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS max_staff_accounts INT DEFAULT 9999;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS order_retention_days INT DEFAULT 365;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS modifiers_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS staff_roles_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS whatsapp_ordering_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS direct_ordering_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS audio_alarm_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS order_status_whatsapp_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS kds_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS bluetooth_kot_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS google_reviews_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS ai_review_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS stories_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS gst_invoice_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS analytics_export_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS multi_language_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS watermark_removal_enabled INT DEFAULT 1;`,
      `ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS custom_domain_enabled INT DEFAULT 1;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_kds INT DEFAULT 0;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_prepared INT DEFAULT 0;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_latitude NUMERIC;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_longitude NUMERIC;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_accuracy NUMERIC;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance_meters NUMERIC;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS round_number INT DEFAULT 1;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id INT;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_settled INT DEFAULT 0;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS kds_screen_enabled INT DEFAULT 1;`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city VARCHAR(100);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS state VARCHAR(100);`,
      `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);`
    ];

    for (const alt of pgAlters) {
      try { await pgPool.query(alt); } catch (e) { console.warn('Postgres alter query notice:', e.message); }
    }

    try {
      await pgPool.query(`
        UPDATE restaurants SET auto_debit_enabled = 0 WHERE mandate_status IS NULL OR mandate_status != 'active';
      `);
    } catch (e) { console.warn('Postgres init notice:', e.message); }

    // One-time fix: reset sent_to_kds=0 for orders that are still pending/accepted (not yet sent to kitchen)
    try {
      await pgPool.query(`
        UPDATE orders SET sent_to_kds = 0 WHERE status IN ('pending', 'accepted') AND sent_to_kds = 1 AND (kitchen_prepared IS NULL OR kitchen_prepared = 0);
      `);
    } catch (e) { console.warn('Postgres sent_to_kds reset notice:', e.message); }
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
        sent_to_kds INTEGER DEFAULT 0,
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
      INSERT OR IGNORE INTO system_settings (key, value) VALUES ('default_trial_days', '16');

      CREATE TABLE IF NOT EXISTS stored_images (
        filename TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        data TEXT,
        storage_provider TEXT DEFAULT 'local',
        image_key TEXT,
        image_url TEXT,
        restaurant_id INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      try { sqliteDb.exec("ALTER TABLE stored_images ADD COLUMN storage_provider TEXT DEFAULT 'local'"); } catch (e) {}
      try { sqliteDb.exec("ALTER TABLE stored_images ADD COLUMN image_key TEXT"); } catch (e) {}
      try { sqliteDb.exec("ALTER TABLE stored_images ADD COLUMN image_url TEXT"); } catch (e) {}
      try { sqliteDb.exec("ALTER TABLE stored_images ADD COLUMN restaurant_id INTEGER DEFAULT 1"); } catch (e) {}

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

      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER NOT NULL,
        plan_id INTEGER,
        gateway TEXT DEFAULT 'none',
        gateway_subscription_id TEXT,
        gateway_customer_id TEXT,
        status TEXT DEFAULT 'trialing',
        amount REAL DEFAULT 0,
        currency TEXT DEFAULT 'INR',
        billing_cycle TEXT DEFAULT 'monthly',
        trial_start TEXT DEFAULT CURRENT_TIMESTAMP,
        trial_end TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        next_billing_at TEXT,
        cancelled_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES saas_plans (id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER NOT NULL,
        subscription_id INTEGER,
        gateway TEXT,
        gateway_payment_id TEXT,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        status TEXT,
        payment_type TEXT,
        paid_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gateway TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT,
        payload TEXT,
        processed INTEGER DEFAULT 0,
        processed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (gateway, event_id)
      );

      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
        discount_value REAL NOT NULL,
        applicable_plans TEXT DEFAULT 'all',
        valid_from TEXT DEFAULT CURRENT_TIMESTAMP,
        valid_until TEXT,
        max_total_uses INTEGER DEFAULT 100,
        max_uses_per_restaurant INTEGER DEFAULT 1,
        first_payment_only INTEGER DEFAULT 1,
        minimum_plan_amount REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        used_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coupon_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        subscription_id INTEGER,
        original_amount REAL NOT NULL,
        discount_amount REAL NOT NULL,
        final_amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS pending_registrations (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        owner_username TEXT,
        password_hash TEXT,
        plan_key TEXT,
        plan_price REAL,
        trial_days INTEGER,
        cashfree_subscription_id TEXT,
        cashfree_subscription_session_id TEXT,
        mandate_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        completed_at TEXT,
        restaurant_id INTEGER,
        created_slug TEXT,
        created_jwt TEXT,
        created_user TEXT
      );
      CREATE TABLE IF NOT EXISTS table_location_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER NOT NULL,
        table_number TEXT NOT NULL,
        verification_token TEXT UNIQUE NOT NULL,
        distance_meters REAL,
        accuracy_meters REAL,
        status TEXT DEFAULT 'verified',
        verified_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
      );
    `);

    // Phase 4: Subscription Lifecycle columns for SQLite
    const sqliteAlters = [
      'ALTER TABLE subscriptions ADD COLUMN cancel_requested_at TEXT',
      'ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER DEFAULT 1',
      'ALTER TABLE subscriptions ADD COLUMN scheduled_plan_key TEXT',
      'ALTER TABLE subscriptions ADD COLUMN plan_change_effective_at TEXT',
      'ALTER TABLE subscriptions ADD COLUMN cancellation_reason TEXT'
    ];
    for (const alt of sqliteAlters) {
      try { sqliteDb.exec(alt); } catch (e) { /* column may already exist */ }
    }

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
      if (!restoCols.some(c => c.name === 'total_cabins')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN total_cabins INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'total_rooms')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN total_rooms INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'total_vip')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN total_vip INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'table_prefix')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN table_prefix TEXT DEFAULT 'table'");
      if (!restoCols.some(c => c.name === 'qr_secret')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN qr_secret TEXT");
      if (!restoCols.some(c => c.name === 'order_retention_days')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN order_retention_days INTEGER DEFAULT 90");
      if (!restoCols.some(c => c.name === 'mandate_id')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN mandate_id TEXT");
      if (!restoCols.some(c => c.name === 'mandate_status')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN mandate_status TEXT DEFAULT 'pending'");
      if (!restoCols.some(c => c.name === 'trial_ends_at')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN trial_ends_at TEXT");
      if (!restoCols.some(c => c.name === 'auto_debit_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN auto_debit_enabled INTEGER DEFAULT 0");
      if (!restoCols.some(c => c.name === 'trial_started_at')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN trial_started_at TEXT");
      if (!restoCols.some(c => c.name === 'owner_name')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN owner_name TEXT");
      if (!restoCols.some(c => c.name === 'city')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN city TEXT");
      if (!restoCols.some(c => c.name === 'state')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN state TEXT");
      if (!restoCols.some(c => c.name === 'pincode')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN pincode TEXT");

      const planCols = sqliteDb.pragma('table_info(saas_plans)');
      if (!planCols.some(c => c.name === 'max_dishes')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN max_dishes INTEGER DEFAULT 9999");
      if (!planCols.some(c => c.name === 'max_categories')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN max_categories INTEGER DEFAULT 9999");
      if (!planCols.some(c => c.name === 'max_combos')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN max_combos INTEGER DEFAULT 9999");
      if (!planCols.some(c => c.name === 'max_tables')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN max_tables INTEGER DEFAULT 9999");
      if (!planCols.some(c => c.name === 'max_staff_accounts')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN max_staff_accounts INTEGER DEFAULT 9999");
      if (!planCols.some(c => c.name === 'order_retention_days')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN order_retention_days INTEGER DEFAULT 365");
      if (!planCols.some(c => c.name === 'modifiers_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN modifiers_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'staff_roles_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN staff_roles_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'whatsapp_ordering_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN whatsapp_ordering_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'direct_ordering_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN direct_ordering_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'audio_alarm_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN audio_alarm_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'order_status_whatsapp_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN order_status_whatsapp_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'kds_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN kds_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'bluetooth_kot_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN bluetooth_kot_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'google_reviews_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN google_reviews_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'ai_review_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN ai_review_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'stories_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN stories_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'gst_invoice_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN gst_invoice_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'analytics_export_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN analytics_export_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'multi_language_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN multi_language_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'watermark_removal_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN watermark_removal_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'custom_domain_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN custom_domain_enabled INTEGER DEFAULT 1");
      if (!planCols.some(c => c.name === 'dual_printer_enabled')) sqliteDb.exec("ALTER TABLE saas_plans ADD COLUMN dual_printer_enabled INTEGER DEFAULT 0");

      const orderCols = sqliteDb.pragma("table_info(orders)");
      if (!orderCols.some(c => c.name === 'sent_to_kds')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN sent_to_kds INTEGER DEFAULT 0");
      if (!orderCols.some(c => c.name === 'kitchen_prepared')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN kitchen_prepared INTEGER DEFAULT 0");
      if (!orderCols.some(c => c.name === 'customer_latitude')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN customer_latitude REAL");
      if (!orderCols.some(c => c.name === 'customer_longitude')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN customer_longitude REAL");
      if (!orderCols.some(c => c.name === 'customer_accuracy')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN customer_accuracy REAL");
      if (!orderCols.some(c => c.name === 'distance_meters')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN distance_meters REAL");
      if (!orderCols.some(c => c.name === 'session_id')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN session_id TEXT");
      if (!orderCols.some(c => c.name === 'round_number')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN round_number INTEGER DEFAULT 1");
      if (!orderCols.some(c => c.name === 'parent_order_id')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN parent_order_id INTEGER");
      if (!orderCols.some(c => c.name === 'is_settled')) sqliteDb.exec("ALTER TABLE orders ADD COLUMN is_settled INTEGER DEFAULT 0");

      if (!restoCols.some(c => c.name === 'kds_screen_enabled')) sqliteDb.exec("ALTER TABLE restaurants ADD COLUMN kds_screen_enabled INTEGER DEFAULT 1");

      sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_restaurants_active_expires ON restaurants(active, plan_expires_at)");
      sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON subscriptions(restaurant_id)");
      sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)");
      sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_at)");
      sqliteDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_phone_unique ON restaurants(phone) WHERE phone IS NOT NULL AND phone != ''");
      sqliteDb.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_payid ON payments(gateway, gateway_payment_id)");
    } catch (err) {
      console.warn('SQLite migration info:', err.message);
    }
  }
}

async function seedData() {
  // Ensure a generic TouchQR demo restaurant exists for local/dev previews.
  try {
    const demoCheck = await query('SELECT * FROM restaurants WHERE slug = $1', ['touchqr-demo']);
    if (!demoCheck || demoCheck.length === 0) {
      const demoRes = await query(`
        INSERT INTO restaurants (
          name, slug, tagline, logo, phone, address, opening_hours, active, plan_tier, plan_price, order_retention_days
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
      `, [
        'TouchQR Demo Restaurant',
        'touchqr-demo',
        'Experience the TouchQR Digital Menu',
        null,
        '+919876543210',
        'Demo Business Center, Suite 100',
        '8:00 AM - 10:30 PM (Mon - Sun)',
        1,
        'enterprise',
        1990,
        90
      ]);
      const demoId = demoRes[0]?.id || demoRes.lastInsertRowid;
      
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('admin123', salt);
      await query(`
        INSERT INTO admins (restaurant_id, username, password_hash, role)
        VALUES ($1, $2, $3, $4)
      `, [demoId, 'demo_admin', hash, 'restaurant_admin']);
    }
  } catch (e) {
    console.error('Demo tenant seed notice:', e);
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
    } catch {}

    try {
      await query('ALTER TABLE restaurants ADD COLUMN grace_period_expires_at TIMESTAMP');
      await query('ALTER TABLE subscriptions ADD COLUMN grace_period_expires_at TIMESTAMP');
    } catch {}

    try {
      await query('DROP TABLE IF EXISTS coupon_redemptions CASCADE');
      await query('DROP TABLE IF EXISTS coupons CASCADE');
      await query("DELETE FROM service_requests WHERE status = 'resolved'");
      await query("DELETE FROM system_settings WHERE key LIKE '%razorpay%' OR key LIKE '%rzp%'");
      if (dbType === 'postgres') {
        await query("INSERT INTO system_settings (key, value) VALUES ('default_trial_days', '16') ON CONFLICT (key) DO NOTHING");
        await query("INSERT INTO system_settings (key, value) VALUES ('support_whatsapp', '919876543210') ON CONFLICT (key) DO NOTHING");
        await query("INSERT INTO system_settings (key, value) VALUES ('global_order_retention_days', '90') ON CONFLICT (key) DO NOTHING");
      }
    } catch {}

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

    // Auto-sync missing subscription records for existing restaurants.
    try {
      const restosWithoutSub = await query(`
        SELECT r.id, r.name, r.plan_tier, r.trial_started_at, r.trial_ends_at 
        FROM restaurants r 
        LEFT JOIN subscriptions s ON r.id = s.restaurant_id 
        WHERE s.id IS NULL
      `);

      if (restosWithoutSub && restosWithoutSub.length > 0) {
        const plans = await query("SELECT id, key, price FROM saas_plans");
        const planMap = {};
        (plans || []).forEach(p => { planMap[p.key] = p; });

        const now = new Date();
        const defaultTrialEnd = new Date(now.getTime() + 16 * 86400 * 1000);

        for (const r of restosWithoutSub) {
          const tier = r.plan_tier || 'pro';
          const p = planMap[tier] || planMap['pro'] || { id: 2, price: 999 };
          
          const tStart = r.trial_started_at ? new Date(r.trial_started_at) : now;
          const tEnd = r.trial_ends_at ? new Date(r.trial_ends_at) : defaultTrialEnd;

          await query(`
            INSERT INTO subscriptions (
              restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
              trial_start, trial_end, current_period_start, current_period_end
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            r.id,
            p.id,
            'none',
            'trialing',
            p.price,
            'INR',
            'monthly',
            tStart.toISOString(),
            tEnd.toISOString(),
            tStart.toISOString(),
            tEnd.toISOString()
          ]);
          console.log(`✅ Synced missing subscriptions record for restaurant ID ${r.id} (${r.name || 'Resto'})`);
        }
      }
    } catch (e) {
      console.warn('Subscription auto-sync notice:', e.message);
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

  if (count === 0) {
    console.log('Seeding demo menu data for TouchQR demo tenant...');
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
          [primaryRestoId, cat.name, cat.name_hi || '', null, cat.sort_order || 0]
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
              primaryRestoId, newCatId, d.name, d.name_hi || '', d.description || '', d.description_hi || '', null, d.price, d.price_half || null,
              d.portion || '', d.portion_half_label || '', d.portion_full_label || '', d.badge || '', d.ingredients || '', d.taste_profile || '', d.available !== false ? 1 : 0
            ]
          );
        } catch (e) {
          console.warn('Skipping existing dish:', d.name);
        }
      }
      console.log(`Seeded ${data.categories.length} categories and ${data.dishes.length} dishes for TouchQR demo tenant.`);
    }
  }

  // Ensure a demo admin user exists.
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
        'TouchQR Demo Snacks Combo',
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

    // Clean up default logo image references so dishes & categories without custom photos stay clean (NULL)
    await query("UPDATE categories SET image = NULL WHERE image = '/uploads/logo.jpg'");
    await query("UPDATE dishes SET image = NULL WHERE image = '/uploads/logo.jpg'");
    await query("UPDATE combos SET image = NULL WHERE image = '/uploads/logo.jpg'");
  } catch (err) {
    console.warn('Combo seeding notice:', err.message);
  }
}

let initDbPromise = null;

async function query(text, params = []) {
  if (!isDbInitialized || (!pgPool && !sqliteDb)) {
    if (!initDbPromise) {
      initDbPromise = initDb().catch(err => {
        initDbPromise = null;
        throw err;
      });
    }
    await initDbPromise;
  }

  if (dbType === 'postgres' && pgPool) {
    const res = await pgPool.query(text, params);
    return res.rows;
  } else if (sqliteDb) {
    let sql = text;
    // Convert $1, $2 parameter placeholders to SQLite ?
    sql = sql.replace(/\$(\d+)/g, () => '?');
    sql = sql.replace(/::text/g, '');

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
  } else {
    throw new Error('Database connection not initialized');
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

async function runAutoDataSummarization(daysOld = 30, targetRestaurantId = null) {
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
      if (!o.restaurant_id) continue;
      const restoId = o.restaurant_id;
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

    if (targetRestaurantId) {
      await logAudit(targetRestaurantId, 'SYSTEM', 'AUTO_SUMMARIZATION', `Summarized ${summarizedDaysCount} days, purged ${purgedOrdersCount} old individual orders older than ${daysOld} days`);
    }

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

async function withTransaction(callback) {
  if (dbType === 'postgres') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const txQuery = async (text, params = []) => {
        const res = await client.query(text, params);
        return res.rows;
      };
      const result = await callback(txQuery);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    try {
      sqliteDb.exec('BEGIN TRANSACTION');
      const result = await callback(query);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      sqliteDb.exec('ROLLBACK');
      throw err;
    }
  }
}

export async function saveImageToDb(filename, mimeType, bufferData) {
  try {
    const base64Str = bufferData.toString('base64');
    if (dbType === 'postgres' || pgPool) {
      await query(
        `INSERT INTO stored_images (filename, mime_type, storage_provider, data)
         VALUES ($1, $2, 'local', $3)
         ON CONFLICT (filename) DO UPDATE SET data = EXCLUDED.data, mime_type = EXCLUDED.mime_type, storage_provider = 'local'`,
        [filename, mimeType, base64Str]
      );
    } else {
      await query(
        `INSERT INTO stored_images (filename, mime_type, storage_provider, data)
         VALUES ($1, $2, 'local', $3)
         ON CONFLICT(filename) DO UPDATE SET data = excluded.data, mime_type = excluded.mime_type, storage_provider = 'local'`,
        [filename, mimeType, base64Str]
      );
    }
  } catch (err) {
    console.error('Failed to save image to DB:', err.message);
  }
}

export function purgeLocalR2DiskCache(identifier) {
  if (!identifier) return;
  try {
    const baseName = path.basename(identifier);
    const localCachePath = path.resolve('public/uploads/r2-cache', baseName);
    if (fs.existsSync(localCachePath)) {
      fs.unlinkSync(localCachePath);
      console.log('[CACHE PURGE SUCCESS] Deleted local R2 disk cache file:', localCachePath);
    }
  } catch (err) {
    console.warn('Notice purging local R2 disk cache:', err.message);
  }
}

export async function saveR2ImageToDb(filename, mimeType, imageKey, imageUrl, restaurantId, buffer = null) {
  try {
    if (!restaurantId && restaurantId !== null && (!imageKey || !imageKey.startsWith('superadmin/'))) {
      throw new Error('restaurantId is required for saving R2 image metadata');
    }

    const base64Data = buffer ? (Buffer.isBuffer(buffer) ? buffer.toString('base64') : buffer) : null;

    if (filename) purgeLocalR2DiskCache(filename);
    if (imageKey) purgeLocalR2DiskCache(imageKey);

    const hasR2 = Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && !process.env.R2_ACCESS_KEY_ID.includes('your_'));
    const provider = hasR2 ? 'r2' : 'database';

    if (dbType === 'postgres' || pgPool) {
      await query(
        `INSERT INTO stored_images (filename, mime_type, storage_provider, image_key, image_url, restaurant_id, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (filename) DO UPDATE SET
           mime_type = EXCLUDED.mime_type,
           storage_provider = EXCLUDED.storage_provider,
           image_key = EXCLUDED.image_key,
           image_url = EXCLUDED.image_url,
           restaurant_id = EXCLUDED.restaurant_id,
           data = COALESCE(EXCLUDED.data, stored_images.data)`,
        [filename, mimeType, provider, imageKey, imageUrl, restaurantId, base64Data]
      );
    } else {
      await query(
        `INSERT INTO stored_images (filename, mime_type, storage_provider, image_key, image_url, restaurant_id, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(filename) DO UPDATE SET
           mime_type = excluded.mime_type,
           storage_provider = excluded.storage_provider,
           image_key = excluded.image_key,
           image_url = excluded.image_url,
           restaurant_id = excluded.restaurant_id,
           data = COALESCE(excluded.data, stored_images.data)`,
        [filename, mimeType, provider, imageKey, imageUrl, restaurantId, base64Data]
      );
    }
  } catch (err) {
    console.error('Failed to save R2 image metadata to DB:', err.message);
  }
}

export async function getImageRecordFromDb(identifier) {
  if (!identifier) return null;
  try {
    const rows = await query(
      `SELECT filename, mime_type, data, storage_provider, image_key, image_url, restaurant_id 
       FROM stored_images 
       WHERE filename = $1 OR image_key = $1 OR image_url = $1 OR image_key LIKE '%' || $1 OR image_url LIKE '%' || $1`,
      [identifier]
    );
    if (rows && rows.length > 0) {
      return rows[0];
    }
  } catch (err) {
    console.error('Failed to get image record from DB:', err.message);
  }
  return null;
}

export async function deleteImageRecordFromDb(identifier) {
  if (!identifier) return;
  try {
    purgeLocalR2DiskCache(identifier);
    await query(
      `DELETE FROM stored_images 
       WHERE filename = $1 OR image_key = $1 OR image_url = $1 OR image_key LIKE '%' || $1 OR image_url LIKE '%' || $1`,
      [identifier]
    );
  } catch (err) {
    console.error('Failed to delete image record from DB:', err.message);
  }
}

export async function getImageFromDb(filename) {
  if (!filename) return null;
  try {
    const rows = await query(
      `SELECT mime_type, data, storage_provider, image_url, image_key, filename 
       FROM stored_images 
       WHERE filename = $1 OR image_key = $1 OR image_url = $1 OR image_key LIKE '%' || $1 OR image_url LIKE '%' || $1`,
      [filename]
    );
    if (rows && rows.length > 0) {
      const row = rows[0];
      if (row.data) {
        const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data, 'base64');
        return {
          mimeType: row.mime_type || 'image/jpeg',
          buffer: buf
        };
      }
    }
  } catch (err) {
    console.error('Failed to get image from DB:', err.message);
  }
  return null;
}

export async function purgeCancelledOrdersOlderThan3Mins() {
  try {
    const result = await query(
      `DELETE FROM orders WHERE status IN ('cancelled', 'rejected')`
    );
    return result;
  } catch (err) {
    console.warn('Notice purging cancelled orders:', err.message);
    return null;
  }
}

function getDbType() {
  return dbType;
}

export async function pingDb() {
  if (dbType === 'postgres' && pgPool) {
    try {
      const start = Date.now();
      await pgPool.query('SELECT 1');
      return { connected: true, latency_ms: Date.now() - start };
    } catch (e) {
      return { connected: false, latency_ms: 0, error: e.message };
    }
  } else if (sqliteDb) {
    return { connected: true, latency_ms: 0 };
  }
  return { connected: false, latency_ms: 0, error: 'Database pool not initialized' };
}

export { initDb, query, logAudit, runAutoDataSummarization, withTransaction, getDbType };
