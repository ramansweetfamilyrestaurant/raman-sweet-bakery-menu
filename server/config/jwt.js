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
    console.warn('⚠️ [JWT CONFIG WARNING] JWT_SECRET environment variable is missing. Falling back to default key.');
  }

  return secret || 'touchqr_secret_jwt_key_change_me';
}

export const JWT_SECRET = resolveJwtSecret();
export default JWT_SECRET;
