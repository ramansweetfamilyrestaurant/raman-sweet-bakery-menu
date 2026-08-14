import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized Cloudflare R2 Configuration Module
 * Single Source of Truth for R2 Bucket Name and API Credentials.
 */
export function getR2Config() {
  const bucketName = (process.env.R2_BUCKET_NAME || '').trim();
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
  const endpoint = (process.env.R2_ENDPOINT || '').trim();

  return {
    bucketName,
    accountId,
    accessKeyId,
    secretAccessKey,
    publicDomain,
    endpoint
  };
}

/**
 * Validates R2 configuration state without printing sensitive credentials.
 */
export function validateR2Config() {
  const config = getR2Config();
  const isProduction = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

  const missing = [];
  if (!config.bucketName) missing.push('R2_BUCKET_NAME');
  if (!config.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!config.accountId && !config.endpoint) missing.push('R2_ACCOUNT_ID / R2_ENDPOINT');

  const isValid = missing.length === 0;

  if (isProduction && !isValid) {
    console.warn(`⚠️ [R2 CONFIG WARNING] Incomplete Cloudflare R2 production configuration. Missing variables: ${missing.join(', ')}`);
  }

  return {
    isValid,
    bucketName: config.bucketName,
    missing
  };
}
