import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

async function testSubStatus() {
  const { rows: restos } = await pool.query('SELECT * FROM restaurants');
  console.log('Testing subscription status check for all restaurants:');

  for (const r of restos) {
    const { rows: admins } = await pool.query('SELECT * FROM admins WHERE restaurant_id = $1 LIMIT 1', [r.id]);
    const admin = admins[0];
    if (!admin) continue;

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: 'restaurant_admin', restaurant_id: r.id, slug: r.slug },
      JWT_SECRET
    );

    // Call /api/admin/subscription-status logic
    const now = new Date();
    let isTrialing = false;
    const expStr = r.trial_ends_at || r.plan_expires_at;
    if (expStr) {
      const trialExp = new Date(expStr.includes('T') ? expStr : `${expStr}T23:59:59Z`);
      if (!isNaN(trialExp.getTime()) && trialExp >= now) {
        isTrialing = true;
      }
    }

    const { rows: subRows } = await pool.query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [r.id]);
    const sub = subRows[0];

    let status = 'expired';
    let active = false;

    if (sub && sub.status === 'active') {
      status = 'active'; active = true;
    } else if (isTrialing || (sub && sub.status === 'trialing')) {
      status = 'trialing'; active = true;
    } else if (r.active === 1 || r.active === true) {
      status = 'trialing'; active = true;
    }

    const isAuthorizedInApp = active === true || status === 'active' || status === 'trialing';

    console.log({
      id: r.id,
      name: r.name,
      slug: r.slug,
      trial_started_at: r.trial_started_at,
      trial_ends_at: r.trial_ends_at,
      plan_expires_at: r.plan_expires_at,
      active_flag: r.active,
      sub_status: sub?.status,
      computed_status: status,
      computed_active: active,
      isAuthorizedInApp
    });
  }

  await pool.end();
}

testSubStatus().catch(console.error);
