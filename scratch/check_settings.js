import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSettings() {
  const { rows } = await pool.query("SELECT * FROM system_settings WHERE key = 'default_trial_days'");
  console.log('PostgreSQL default_trial_days setting:', rows);
  await pool.end();
}

checkSettings().catch(console.error);
