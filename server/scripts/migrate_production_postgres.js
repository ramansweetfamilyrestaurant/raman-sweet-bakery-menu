/**
 * Standalone Production PostgreSQL Migration Script for TouchQR
 * 
 * Safely creates or updates support ticket tables and indexes
 * on existing PostgreSQL databases (such as Neon) in an idempotent manner.
 * 
 * Usage:
 *   node server/scripts/migrate_production_postgres.js
 *   or: npm run db:migrate
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function runPostgresMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Configuration Error: DATABASE_URL environment variable is required.');
    console.error('   Please ensure DATABASE_URL is set in your environment or .env file.');
    process.exit(1);
  }

  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    console.error('❌ Configuration Error: DATABASE_URL must be a PostgreSQL connection string.');
    process.exit(1);
  }

  console.log('======================================================================');
  console.log('⚡ TOUCHQR PRODUCTION POSTGRESQL MIGRATION RUNNER');
  console.log('======================================================================\n');

  const isLocalOrNoSsl =
    dbUrl.includes('sslmode=disable') ||
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalOrNoSsl ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('📡 Connecting to PostgreSQL database...');
    const ping = await pool.query('SELECT current_database(), current_user, version()');
    const dbInfo = ping.rows[0];
    console.log(`✓ Connected to database: ${dbInfo.current_database} as ${dbInfo.current_user}`);

    console.log('\n📦 Step 1: Ensuring support_tickets table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        restaurant_id INT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        ticket_ref VARCHAR(64) UNIQUE NOT NULL,
        subject VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        assigned_to_admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
        assigned_to_name VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
        closed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
      );
    `);
    console.log('✓ Table support_tickets verified.');

    console.log('\n📦 Step 2: Ensuring support_ticket_messages table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_type VARCHAR(20) NOT NULL,
        sender_id INT DEFAULT NULL,
        sender_name VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Table support_ticket_messages verified.');

    console.log('\n⚡ Step 3: Creating performance and lookup indexes...');
    const indexes = [
      { name: 'idx_support_tickets_resto_created', sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_resto_created ON support_tickets(restaurant_id, created_at DESC);' },
      { name: 'idx_support_tickets_resto_updated', sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_resto_updated ON support_tickets(restaurant_id, updated_at DESC);' },
      { name: 'idx_support_tickets_status', sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);' },
      { name: 'idx_support_tickets_priority', sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);' },
      { name: 'idx_support_tickets_ref', sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_ref ON support_tickets(ticket_ref);' },
      { name: 'idx_support_tickets_assigned', sql: 'CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_to_admin_id);' },
      { name: 'idx_support_ticket_msgs_ticket', sql: 'CREATE INDEX IF NOT EXISTS idx_support_ticket_msgs_ticket ON support_ticket_messages(ticket_id, created_at ASC);' },
    ];

    for (const idx of indexes) {
      await pool.query(idx.sql);
      console.log(`✓ Index ${idx.name} verified.`);
    }

    console.log('\n======================================================================');
    console.log('✅ ALL PRODUCTION POSTGRESQL MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPostgresMigration();
