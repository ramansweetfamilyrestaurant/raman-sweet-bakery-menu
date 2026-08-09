import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

function getR2Client() {
  let accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const endpointEnv = (process.env.R2_ENDPOINT || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();

  // If R2_ENDPOINT is provided (e.g. https://<accountId>.r2.cloudflarestorage.com), extract accountId if missing
  if (!accountId && endpointEnv) {
    const match = endpointEnv.match(/https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      accountId = match[1];
    }
  }

  // Validate presence of credentials (ignore pure placeholder strings)
  const isInvalid = !accessKeyId || !secretAccessKey ||
                    accessKeyId.includes('your_r2_access_key_id') ||
                    (!accountId && !endpointEnv);

  if (isInvalid) {
    return null;
  }

  const endpointUrl = endpointEnv || `https://${accountId}.r2.cloudflarestorage.com`;

  try {
    return new S3Client({
      region: 'auto',
      endpoint: endpointUrl,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  } catch (err) {
    console.warn('⚠️ Cloudflare R2 S3Client init error:', err.message);
    return null;
  }
}

export function isR2Configured() {
  return getR2Client() !== null;
}

export async function uploadToR2(filename, buffer, mimeType) {
  const client = getR2Client();
  if (!client) {
    throw new Error('Cloudflare R2 credentials are missing or invalid in environment variables');
  }

  const bucketName = (process.env.R2_BUCKET_NAME || 'khanamaster-menu-images').trim();
  const publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').trim();
  const endpointEnv = (process.env.R2_ENDPOINT || '').trim();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: filename,
    Body: buffer,
    ContentType: mimeType || 'image/jpeg',
  });

  await client.send(command);

  // If explicit R2_PUBLIC_DOMAIN is configured (e.g. https://pub-xxxx.r2.dev or custom domain)
  if (publicDomain && !publicDomain.includes('pub-xxxx.r2.dev')) {
    const cleanDomain = publicDomain.replace(/\/+$/, '');
    return `${cleanDomain}/${filename}`;
  }

  // Fallback public URL formats
  let accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  if (!accountId && endpointEnv) {
    const match = endpointEnv.match(/https:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com/i);
    if (match) accountId = match[1];
  }

  return `https://${bucketName}.${accountId}.r2.dev/${filename}`;
}
