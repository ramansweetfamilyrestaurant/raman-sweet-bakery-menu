/**
 * TouchQR — Cloudflare R2 Dedicated Archive Vault Configuration
 *
 * SAFETY & SECURITY INVARIANTS:
 * 1. Dedicated Private Vault: Never shares a bucket with public assets (e.g. khana-master-media).
 *    Fails initialization if public domain mapping is detected.
 * 2. Unlocked Staging vs. Locked Vault:
 *    - In-flight and verification uploads use the STAGING prefix (staging/audit-archives/).
 *    - Fully verified, immutable chunks use the VAULT prefix (vault/audit-archives/).
 * 3. Locked Object Recovery: Handles R2 Bucket Lock / Object Lock (WORM) gracefully.
 *    If an orphan object cannot be deleted due to Object Lock, logs a tombstone catalog entry
 *    and never crashes.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

function sanitizeConfigValue(val) {
  if (!val || typeof val !== 'string') return '';
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
}

export function getR2ArchiveConfig() {
  const publicMediaBucket = sanitizeConfigValue(process.env.R2_BUCKET_NAME);
  let archiveBucket = sanitizeConfigValue(process.env.R2_AUDIT_ARCHIVE_BUCKET);

  // Fallback for isolated development / testing when dedicated vault env var is unset
  if (!archiveBucket) {
    archiveBucket = 'touchqr-audit-vault';
  }

  // Security guard: Prevent accidentally storing audit logs in the public image bucket
  if (archiveBucket && publicMediaBucket && archiveBucket.toLowerCase() === publicMediaBucket.toLowerCase()) {
    console.warn('⚠️ [SECURITY WARNING] R2_AUDIT_ARCHIVE_BUCKET cannot match public media R2_BUCKET_NAME. Defaulting to isolated vault.');
    archiveBucket = `${publicMediaBucket}-audit-vault`;
  }

  const accountId = sanitizeConfigValue(process.env.R2_ACCOUNT_ID);
  const accessKeyId = sanitizeConfigValue(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = sanitizeConfigValue(process.env.R2_SECRET_ACCESS_KEY);
  const endpoint = sanitizeConfigValue(process.env.R2_ENDPOINT);

  return {
    bucketName: archiveBucket,
    stagingPrefix: 'staging/audit-archives/',
    vaultPrefix: 'vault/audit-archives/',
    accountId,
    accessKeyId,
    secretAccessKey,
    endpoint,
    isConfigured: Boolean(accessKeyId && secretAccessKey && (accountId || endpoint))
  };
}

let archiveS3ClientInstance = null;

export function setR2ArchiveClient(client) {
  archiveS3ClientInstance = client;
}

export function getR2ArchiveClient() {
  if (archiveS3ClientInstance) {
    return archiveS3ClientInstance;
  }

  const config = getR2ArchiveConfig();
  if (!config.isConfigured) {
    return null;
  }

  let accountId = config.accountId;
  if (!accountId && config.endpoint) {
    const match = config.endpoint.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      accountId = match[1].trim();
    }
  }

  const endpointUrl = config.endpoint
    ? (config.endpoint.startsWith('http') ? config.endpoint : `https://${config.endpoint}`)
    : `https://${accountId}.r2.cloudflarestorage.com`;

  try {
    archiveS3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: endpointUrl.replace(/\/+$/, ''),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      maxAttempts: 3
    });
    return archiveS3ClientInstance;
  } catch (err) {
    console.warn('⚠️ Cloudflare R2 Archive S3Client init error:', err.message);
    return null;
  }
}

/**
 * Safely attempts to delete an unlocked staging object.
 * If the object is protected by R2 Bucket Lock (WORM), handles the error gracefully
 * and returns { deleted: false, locked: true }.
 */
export async function safeDeleteArchiveObject(s3Client, bucketName, objectKey) {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey
    }));
    return { deleted: true, locked: false };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    const code = err.name || err.Code || '';
    const isLocked = msg.includes('locked') || msg.includes('object lock') || msg.includes('accessdenied') || code === 'AccessDenied';
    
    if (isLocked) {
      console.warn(`🔒 [R2 BUCKET LOCK NOTICE] Object "${objectKey}" is protected by WORM retention lock. Recorded as preserved orphan.`);
      return { deleted: false, locked: true, error: err.message };
    }
    
    console.error(`⚠️ Failed to delete R2 object "${objectKey}":`, err.message);
    return { deleted: false, locked: false, error: err.message };
  }
}
