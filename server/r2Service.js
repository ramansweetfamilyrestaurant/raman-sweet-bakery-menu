import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'khanamaster-images';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || '';

let r2Client = null;

const isRealValue = (val) => Boolean(val && val.trim() && !val.toLowerCase().includes('your_') && !val.toLowerCase().includes('xxxx'));

if (isRealValue(R2_ACCOUNT_ID) && isRealValue(R2_ACCESS_KEY_ID) && isRealValue(R2_SECRET_ACCESS_KEY)) {
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID.trim(),
        secretAccessKey: R2_SECRET_ACCESS_KEY.trim(),
      },
    });
    console.log('⚡ Cloudflare R2 Storage Client Initialized Successfully!');
  } catch (err) {
    console.warn('⚠️ Cloudflare R2 Client init notice:', err.message);
  }
}

export function isR2Configured() {
  return r2Client !== null && isRealValue(R2_BUCKET_NAME);
}

export async function uploadToR2(filename, buffer, mimeType) {
  if (!r2Client) {
    throw new Error('Cloudflare R2 credentials not configured in .env');
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: mimeType || 'image/jpeg',
  });

  await r2Client.send(command);

  if (R2_PUBLIC_DOMAIN) {
    const cleanDomain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '');
    return `${cleanDomain}/${filename}`;
  }

  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${filename}`;
}
