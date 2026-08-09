import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || '').trim();
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID || '').trim();
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
const R2_BUCKET_NAME = (process.env.R2_BUCKET_NAME || 'khana-master-media').trim();
const R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || '').trim();
const R2_ENDPOINT = (process.env.R2_ENDPOINT || '').trim();

function getR2Client() {
  let accountId = R2_ACCOUNT_ID;
  if (!accountId && R2_ENDPOINT) {
    const match = R2_ENDPOINT.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      accountId = match[1].trim();
    }
  }

  const isInvalid = !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY ||
                    R2_ACCESS_KEY_ID.includes('your_r2_access_key_id') ||
                    (!accountId && !R2_ENDPOINT);

  if (isInvalid) {
    return null;
  }

  const endpointUrl = R2_ENDPOINT
    ? (R2_ENDPOINT.startsWith('http') ? R2_ENDPOINT : `https://${R2_ENDPOINT}`)
    : `https://${accountId}.r2.cloudflarestorage.com`;

  try {
    return new S3Client({
      region: 'auto',
      endpoint: endpointUrl,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
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

/**
 * Optimizes an image buffer using Sharp.
 * Resizes max 1200px, converts to WebP with ~82% quality, strips metadata.
 */
export async function optimizeImage(buffer, originalMime = 'image/jpeg') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image buffer provided');
  }

  try {
    // Validate image format via Sharp
    const metadata = await sharp(buffer).metadata();
    if (!metadata || !metadata.format) {
      throw new Error('Unsupported or corrupted image file format');
    }

    // Convert to WebP, resize if max dimension > 1200px
    const optimizedBuffer = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 82, effort: 4 })
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
  const safeRestoId = parseInt(restaurantId, 10) || 1;
  
  // Whitelist entity types to prevent path traversal
  const validTypes = ['dishes', 'categories', 'banners', 'avatars', 'logos', 'migrated', 'misc'];
  const safeType = validTypes.includes(entityType) ? entityType : 'dishes';
  
  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const uniqueId = `${safeType}-${timestamp}-${randomSuffix}`;
  
  return `restaurants/${safeRestoId}/${safeType}/${uniqueId}.webp`;
}

/**
 * Uploads an image buffer to Cloudflare R2 storage bucket.
 */
export async function uploadImageToR2({ buffer, mimeType, restaurantId = 1, entityType = 'dishes' }) {
  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 is not configured in environment variables');
  }

  // 1. Optimize image using Sharp
  const optimized = await optimizeImage(buffer, mimeType);

  // 2. Generate structured key
  const objectKey = generateObjectKey(restaurantId, entityType);

  // 3. Upload to R2 Bucket
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    Body: optimized.buffer,
    ContentType: optimized.mimeType,
  });

  await client.send(command);

  // 4. Construct Public R2 URL
  let publicUrl = '';
  if (R2_PUBLIC_DOMAIN && !R2_PUBLIC_DOMAIN.toLowerCase().includes('pub-xxxx')) {
    const cleanDomain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '');
    const prefix = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;
    publicUrl = `${prefix}/${objectKey}`;
  } else {
    let accountId = R2_ACCOUNT_ID;
    if (!accountId && R2_ENDPOINT) {
      const match = R2_ENDPOINT.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
      if (match) accountId = match[1].trim();
    }
    publicUrl = `https://${R2_BUCKET_NAME}.${accountId || 'pub'}.r2.dev/${objectKey}`;
  }

  return {
    objectKey,
    publicUrl,
    mimeType: optimized.mimeType,
    size: optimized.buffer.length
  };
}

/**
 * Deletes an image object from Cloudflare R2 storage.
 */
export async function deleteImageFromR2(objectKey) {
  if (!objectKey) return false;
  const client = getR2Client();
  if (!client) return false;

  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
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
