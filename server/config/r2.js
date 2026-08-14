import dotenv from 'dotenv';
dotenv.config();

/**
 * Centralized Cloudflare R2 Configuration Module
 * Single Source of Truth for R2 Bucket Name and API Credentials.
 */
function sanitizeConfigValue(val) {
  if (!val || typeof val !== 'string') return '';
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}

/**
 * Centralized Cloudflare R2 Configuration Module
 * Single Source of Truth for R2 Bucket Name and API Credentials.
 */
export function getR2Config() {
  let rawBucket = sanitizeConfigValue(process.env.R2_BUCKET_NAME);
  if (rawBucket) {
    rawBucket = rawBucket.replace(/_/g, '-');
  }
  // Default to active production bucket if environment variable is not explicitly set
  const bucketName = rawBucket || 'khana-master-media';
  const accountId = sanitizeConfigValue(process.env.R2_ACCOUNT_ID);
  const accessKeyId = sanitizeConfigValue(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = sanitizeConfigValue(process.env.R2_SECRET_ACCESS_KEY);
  const publicDomain = sanitizeConfigValue(process.env.R2_PUBLIC_DOMAIN);
  const endpoint = sanitizeConfigValue(process.env.R2_ENDPOINT);

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
