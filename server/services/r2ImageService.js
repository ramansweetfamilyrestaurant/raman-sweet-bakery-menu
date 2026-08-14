import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

let sharpModule = null;
async function getSharp() {
  if (!sharpModule) {
    try {
      const m = await import('sharp');
      sharpModule = m.default || m;
    } catch (e) {
      console.warn('Sharp module import notice:', e.message);
    }
  }
  return sharpModule;
}

const r2CacheDir = process.env.VERCEL ? '/tmp/r2-cache' : path.resolve('public/uploads/r2-cache');
try {
  if (!fs.existsSync(r2CacheDir)) {
    fs.mkdirSync(r2CacheDir, { recursive: true });
  }
} catch (e) {}

function getCacheFilePath(objectKey) {
  if (!objectKey) return null;
  const safeFilename = path.basename(objectKey);
  return path.join(r2CacheDir, safeFilename);
}

function getR2Config() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  let bucketName = (process.env.R2_BUCKET_NAME || 'touchqr-media').trim();
  if (bucketName === 'khana-master_media' || bucketName === 'khana-master-media') {
    bucketName = 'touchqr-media';
  }
  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
  const endpoint = (process.env.R2_ENDPOINT || '').trim();

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain,
    endpoint
  };
}

function getR2Client() {
  const config = getR2Config();
  let accountId = config.accountId;

  if (!accountId && config.endpoint) {
    const match = config.endpoint.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      accountId = match[1].trim();
    }
  }

  const isInvalid = !config.accessKeyId || !config.secretAccessKey ||
                    config.accessKeyId.toLowerCase().includes('your_r2_access_key_id') ||
                    (!accountId && !config.endpoint);

  if (isInvalid) {
    return null;
  }

  let endpointUrl = config.endpoint
    ? (config.endpoint.startsWith('http') ? config.endpoint : `https://${config.endpoint}`)
    : `https://${accountId}.r2.cloudflarestorage.com`;

  // Strip trailing slashes and bucket names if present in R2_ENDPOINT
  endpointUrl = endpointUrl.replace(/\/+$/, '');
  if (config.bucketName && endpointUrl.toLowerCase().endsWith(`/${config.bucketName.toLowerCase()}`)) {
    endpointUrl = endpointUrl.slice(0, -(config.bucketName.length + 1));
  }

  try {
    return new S3Client({
      region: 'auto',
      endpoint: endpointUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    });
  } catch (err) {
    console.warn('⚠️ Cloudflare R2 Client init notice:', err.message);
    return null;
  }
}

export function isR2Active() {
  return getR2Client() !== null;
}

export function getR2Diagnostics() {
  const config = getR2Config();
  const active = isR2Active();

  return {
    provider: 'r2',
    configured: active,
    bucket: config.bucketName,
    endpointConfigured: Boolean(config.endpoint || config.accountId),
    diagnostics: {
      hasAccountId: Boolean(config.accountId && !config.accountId.includes('your_')),
      hasAccessKeyId: Boolean(config.accessKeyId && !config.accessKeyId.includes('your_')),
      hasSecretAccessKey: Boolean(config.secretAccessKey && !config.secretAccessKey.includes('your_')),
      hasBucketName: Boolean(config.bucketName),
      hasEndpoint: Boolean(config.endpoint),
      hasPublicDomain: Boolean(config.publicDomain && !config.publicDomain.includes('pub-xxxx'))
    }
  };
}

/**
 * Optimizes an image buffer using Sharp.
 * Resizes max 1200px, converts to WebP with ~82% quality, strips metadata.
 */
export async function optimizeImage(buffer, originalMime = 'image/jpeg') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image buffer provided');
  }

  const sharp = await getSharp();
  if (!sharp) {
    return {
      buffer,
      mimeType: originalMime,
      extension: '.jpg',
      originalFormat: 'jpeg',
      originalSize: buffer.length,
      optimizedSize: buffer.length
    };
  }

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata || !metadata.format) {
      throw new Error('Unsupported or corrupted image file format');
    }

    const optimizedBuffer = await sharp(buffer)
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80, effort: 1 })
      .toBuffer();

    return {
      buffer: optimizedBuffer,
      mimeType: 'image/webp',
      extension: '.webp',
      originalFormat: metadata.format,
      width: metadata.width,
      height: metadata.height
    };
  } catch (err) {
    console.warn('Sharp image optimization fallback to raw buffer:', err.message);
    return {
      buffer: buffer,
      mimeType: originalMime || 'image/jpeg',
      extension: path.extname(originalMime) || '.jpg'
    };
  }
}

/**
 * Generates a structured, tenant-isolated object key for Cloudflare R2.
 * Format: restaurants/{restaurantId}/{entityType}/{unique-id}.webp
 */
export function generateObjectKey(restaurantId, entityType = 'dishes', filename = '') {
  if (entityType === 'superadmin' || entityType === 'branding') {
    // Fixed key ensures Cloudflare R2 automatically overwrites the logo without creating duplicate files
    return `superadmin/branding/logo.webp`;
  }

  const safeRestoId = parseInt(restaurantId, 10) || 1;
  const validTypes = ['dishes', 'categories', 'banners', 'avatars', 'logos', 'migrated', 'misc', 'superadmin', 'branding'];
  const safeType = validTypes.includes(entityType) ? entityType : 'dishes';
  
  const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `restaurants/${safeRestoId}/${safeType}/${uuid}.webp`;
}

/**
 * Uploads an image buffer to Cloudflare R2 storage bucket.
 */
export async function uploadImageToR2({ buffer, mimeType, restaurantId = 1, entityType = 'dishes' }) {
  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured in environment variables');
  }

  const config = getR2Config();

  // 1. Optimize image using Sharp
  const optimized = await optimizeImage(buffer, mimeType);

  // 2. Generate structured key
  const objectKey = generateObjectKey(restaurantId, entityType);

  let targetBucket = config.bucketName;

  // 3. Upload to R2 Bucket (with automatic fallback bucket attempt if primary fails)
  try {
    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: objectKey,
      Body: optimized.buffer,
      ContentType: optimized.mimeType,
    });
    await client.send(command);
  } catch (primaryErr) {
    console.warn(`⚠️ R2 upload to bucket "${targetBucket}" failed (${primaryErr.name}: ${primaryErr.message}). Trying fallback bucket...`);

    const fallbackBucket = targetBucket === 'touchqr-media' ? 'touchqr-menu-images' : 'touchqr-media';
    try {
      const fallbackCommand = new PutObjectCommand({
        Bucket: fallbackBucket,
        Key: objectKey,
        Body: optimized.buffer,
        ContentType: optimized.mimeType,
      });
      await client.send(fallbackCommand);
      targetBucket = fallbackBucket;
      console.log(`⚡ Successfully uploaded to fallback R2 bucket "${fallbackBucket}"!`);
    } catch (fallbackErr) {
      const isAccessDenied = primaryErr.name === 'AccessDenied' || primaryErr.message?.includes('Access Denied');
      if (isAccessDenied) {
        throw new Error(`Access Denied to R2 bucket "${config.bucketName}". Please check Cloudflare R2 API Token permissions (must be set to "Admin Read & Write" or "Object Read & Write", not "Read-Only").`);
      }
      throw primaryErr;
    }
  }

  // Cache optimized WebP locally for instant zero-latency serving
  try {
    const cachePath = getCacheFilePath(objectKey);
    if (cachePath) fs.writeFileSync(cachePath, optimized.buffer);
  } catch (cErr) {
    console.warn('Local R2 cache write notice:', cErr.message);
  }

  // 4. Construct Public R2 URL
  let publicUrl = '';
  if (config.publicDomain && !config.publicDomain.toLowerCase().includes('pub-xxxx')) {
    const cleanDomain = config.publicDomain.replace(/\/+$/, '');
    const prefix = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;
    publicUrl = `${prefix}/${objectKey}`;
  } else {
    let accountId = config.accountId;
    if (!accountId && config.endpoint) {
      const match = config.endpoint.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
      if (match) accountId = match[1].trim();
    }
    publicUrl = `https://${targetBucket}.${accountId || 'pub'}.r2.dev/${objectKey}`;
  }

  return {
    objectKey,
    publicUrl,
    mimeType: optimized.mimeType,
    buffer: optimized.buffer,
    size: optimized.buffer.length
  };
}

/**
 * Deletes an image object from Cloudflare R2 storage.
 */
export async function deleteImageFromR2(objectKey) {
  if (!objectKey) return false;
  
  // Remove from local disk cache if present
  try {
    const cachePath = getCacheFilePath(objectKey);
    if (cachePath && fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  } catch (cErr) {
    console.warn('Local cache delete notice:', cErr.message);
  }

  const client = getR2Client();
  if (!client) return false;

  const config = getR2Config();

  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey
    });
    await client.send(command);
    console.log(`🗑️ Successfully deleted R2 object: ${objectKey}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Failed to delete R2 object (${objectKey}):`, err.message);
    return false;
  }
}

/**
 * Fetches an image buffer directly from Cloudflare R2 bucket (with local disk caching).
 */
export async function getR2ObjectBuffer(objectKey) {
  if (!objectKey) return null;

  const ext = path.extname(objectKey).toLowerCase();
  let contentType = 'image/webp';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.gif') contentType = 'image/gif';
  else if (ext === '.svg') contentType = 'image/svg+xml';

  // 1. Check local disk cache first (Instant response ~0.5ms)
  const cachePath = getCacheFilePath(objectKey);
  if (cachePath && fs.existsSync(cachePath)) {
    try {
      const cachedBuffer = fs.readFileSync(cachePath);
      if (cachedBuffer && cachedBuffer.length > 0) {
        return {
          buffer: cachedBuffer,
          contentType
        };
      }
    } catch (cErr) {
      console.warn('Read local R2 cache notice:', cErr.message);
    }
  }

  // 2. Fetch from Cloudflare R2
  const client = getR2Client();
  if (!client) return null;

  const config = getR2Config();

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey
    });
    const response = await client.send(command);
    const byteArray = await response.Body.transformToByteArray();
    const buffer = Buffer.from(byteArray);

    // Save to local cache so subsequent requests are instant
    if (cachePath && buffer && buffer.length > 0) {
      try {
        fs.writeFileSync(cachePath, buffer);
      } catch (wErr) {
        console.warn('Cache write notice:', wErr.message);
      }
    }

    return {
      buffer,
      contentType: response.ContentType || 'image/webp'
    };
  } catch (err) {
    const fallbackBucket = config.bucketName === 'touchqr-media' ? 'touchqr-menu-images' : 'touchqr-media';
    try {
      const fallbackCommand = new GetObjectCommand({
        Bucket: fallbackBucket,
        Key: objectKey
      });
      const response = await client.send(fallbackCommand);
      const byteArray = await response.Body.transformToByteArray();
      const buffer = Buffer.from(byteArray);

      if (cachePath && buffer && buffer.length > 0) {
        try {
          fs.writeFileSync(cachePath, buffer);
        } catch (wErr) {
          console.warn('Cache write notice:', wErr.message);
        }
      }

      return {
        buffer,
        contentType: response.ContentType || 'image/webp'
      };
    } catch (fbErr) {
      console.warn(`⚠️ Failed to fetch R2 object (${objectKey}):`, err.message);
      return null;
    }
  }
}

/**
 * Scans Cloudflare R2 bucket and deletes all objects that are not in the activeR2Keys list.
 */
export async function purgeOrphanedR2Objects(activeR2Keys = []) {
  const client = getR2Client();
  if (!client) {
    return { success: false, error: 'Cloudflare R2 client is not configured' };
  }

  const config = getR2Config();
  const activeSet = new Set(activeR2Keys.filter(Boolean));
  let totalObjects = 0;
  let deletedCount = 0;

  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucketName,
    });
    const response = await client.send(command);
    const contents = response.Contents || [];
    totalObjects = contents.length;

    for (const item of contents) {
      if (item.Key && !activeSet.has(item.Key)) {
        console.log(`🧹 Purging orphaned R2 object: ${item.Key}`);
        await deleteImageFromR2(item.Key);
        deletedCount++;
      }
    }

    return {
      success: true,
      bucket: config.bucketName,
      totalObjects,
      activeObjects: activeSet.size,
      deletedOrphans: deletedCount
    };
  } catch (err) {
    console.error('Error purging orphaned R2 objects:', err);
    return { success: false, error: err.message };
  }
}
