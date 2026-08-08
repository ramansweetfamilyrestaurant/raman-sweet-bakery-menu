import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const { rows: restos } = await pool.query('SELECT id, name, slug, plan_tier, plan_expires_at, trial_started_at, trial_ends_at, active FROM restaurants');
  console.log('--- RESTAURANTS ---');
  console.log(restos);

  const { rows: subs } = await pool.query('SELECT * FROM subscriptions');
  console.log('--- SUBSCRIPTIONS ---');
  console.log(subs);

  await pool.end();
}

run().catch(console.error);
