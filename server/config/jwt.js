import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized JWT Secret Single Source of Truth.
 * Production mode (NODE_ENV=production or VERCEL) strictly throws if JWT_SECRET is not configured.
 */
function resolveJwtSecret() {
  const secret = (process.env.JWT_SECRET || '').trim();
  const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);

  if (isProduction && !secret) {
    throw new Error('JWT_SECRET is required in production');
  }

  return secret || 'touchqr_secret_jwt_key_change_me';
}

export const JWT_SECRET = resolveJwtSecret();
export default JWT_SECRET;
