import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { JWT_SECRET } from '../config/jwt.js';

/**
 * Creates a cryptographically random, single-use, 90-second authorization code
 * bound to a specific restaurant tenant and admin user.
 */
export async function createOneTimeAuthCode({ restaurant_id, username, slug }) {
  if (!restaurant_id || !username || !slug) {
    throw new Error('restaurant_id, username, and slug are required to create an auth code');
  }

  const rawRandom = crypto.randomBytes(24).toString('hex');
  const code = `code_${rawRandom}`;
  const expiresAt = new Date(Date.now() + 90 * 1000).toISOString(); // 90 seconds expiry

  await query(
    `INSERT INTO auth_codes (code, restaurant_id, username, slug, expires_at, used)
     VALUES ($1, $2, $3, $4, $5, FALSE)`,
    [code, restaurant_id, username, slug, expiresAt]
  );

  return code;
}

/**
 * Atomically exchanges a single-use authorization code for a standard JWT token.
 * Strictly enforces single-use, expiration window, and tenant context.
 */
export async function exchangeAuthCode(code) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { success: false, status: 400, error: 'Authorization code is required' };
  }

  const cleanCode = code.trim();

  // 1. Fetch code record from database
  const rows = await query(
    `SELECT code, restaurant_id, username, slug, expires_at, used FROM auth_codes WHERE code = $1`,
    [cleanCode]
  );

  if (!rows || rows.length === 0) {
    return { success: false, status: 400, error: 'Invalid or expired authorization code' };
  }

  const record = rows[0];
  const isUsed = record.used === true || record.used === 1 || record.used === '1' || record.used === 'true';

  if (isUsed) {
    return { success: false, status: 400, error: 'Authorization code has already been used' };
  }

  const expiresAtDate = new Date(record.expires_at);
  if (isNaN(expiresAtDate.getTime()) || expiresAtDate < new Date()) {
    return { success: false, status: 400, error: 'Authorization code has expired' };
  }

  // 2. Atomic Single-Use Invalidation (Prevents Replay Attacks / Race Conditions)
  const updateResult = await query(
    `UPDATE auth_codes SET used = TRUE WHERE code = $1 AND (used IS FALSE OR used IS NULL) RETURNING code`,
    [cleanCode]
  );

  if (!updateResult || updateResult.length === 0) {
    return { success: false, status: 400, error: 'Authorization code has already been used' };
  }

  // 3. Fetch Admin Record for ID binding
  const adminRows = await query(
    `SELECT id, username, restaurant_id FROM admins WHERE restaurant_id = $1 AND LOWER(username) = LOWER($2) LIMIT 1`,
    [record.restaurant_id, record.username]
  );

  const adminId = adminRows[0]?.id;
  if (!adminId) {
    return { success: false, status: 401, error: 'Admin user account not found for this restaurant' };
  }

  // 4. Issue standard JWT token
  const token = jwt.sign(
    {
      id: adminId,
      username: record.username,
      restaurant_id: record.restaurant_id,
      role: 'admin'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    success: true,
    token,
    username: record.username,
    slug: record.slug,
    restaurant_id: record.restaurant_id
  };
}
