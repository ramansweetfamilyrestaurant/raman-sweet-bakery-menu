import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

function getR2Client() {
  let accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const endpointEnv = (process.env.R2_ENDPOINT || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();

  // Extract accountId from R2_ENDPOINT if accountId is not explicitly set
  if (!accountId && endpointEnv) {
    const match = endpointEnv.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
    if (match && match[1]) {
      accountId = match[1].trim();
    }
  }

  // Validate credentials exist and are not placeholder strings
  const isInvalid = !accessKeyId || !secretAccessKey ||
                    accessKeyId.toLowerCase().includes('your_r2_access_key_id') ||
                    (!accountId && !endpointEnv);

  if (isInvalid) {
    return null;
  }

  const endpointUrl = endpointEnv
    ? (endpointEnv.startsWith('http') ? endpointEnv : `https://${endpointEnv}`)
    : `https://${accountId}.r2.cloudflarestorage.com`;

  try {
    return new S3Client({
      region: 'auto',
      endpoint: endpointUrl,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
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

  const bucketName = (process.env.R2_BUCKET_NAME || 'touchqr-menu-images').trim();
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
  if (publicDomain && !publicDomain.toLowerCase().includes('pub-xxxx')) {
    const cleanDomain = publicDomain.replace(/\/+$/, '');
    const prefix = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;
    return `${prefix}/${filename}`;
  }

  // Fallback R2 public domain format
  let accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  if (!accountId && endpointEnv) {
    const match = endpointEnv.match(/https:\/\/([^.\/]+)\.r2\.cloudflarestorage\.com/i);
    if (match) accountId = match[1].trim();
  }

  return `https://${bucketName}.${accountId || 'pub'}.r2.dev/${filename}`;
}
