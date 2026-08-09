import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

function getR2Client() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();

  // Validate presence of credentials (ignore pure placeholder strings)
  const isInvalid = !accountId || !accessKeyId || !secretAccessKey ||
                    accountId.includes('your_cloudflare_account_id') ||
                    accessKeyId.includes('your_r2_access_key_id');

  if (isInvalid) {
    return null;
  }

  try {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
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

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: filename,
    Body: buffer,
    ContentType: mimeType || 'image/jpeg',
  });

  await client.send(command);

  if (publicDomain && !publicDomain.includes('pub-xxxx.r2.dev')) {
    const cleanDomain = publicDomain.replace(/\/+$/, '');
    return `${cleanDomain}/${filename}`;
  }

  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  return `https://${bucketName}.${accountId}.r2.dev/${filename}`;
}
