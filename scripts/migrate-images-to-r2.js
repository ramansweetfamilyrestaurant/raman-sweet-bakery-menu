import pg from 'pg';
import dotenv from 'dotenv';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { uploadImageToR2, isR2Active } from '../server/services/r2ImageService.js';

dotenv.config();

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

let batchSize = 25;
const batchArg = args.find(a => a.startsWith('--batch='));
if (batchArg) {
  const val = parseInt(batchArg.split('=')[1], 10);
  if (!isNaN(val) && val > 0) batchSize = val;
}

let limitSize = null;
const limitArg = args.find(a => a.startsWith('--limit='));
if (limitArg) {
  const val = parseInt(limitArg.split('=')[1], 10);
  if (!isNaN(val) && val > 0) limitSize = val;
}

async function runMigration() {
  console.log('====================================================');
  console.log('⚡ CLOUDFLARE R2 SAFE IMAGE MIGRATION ENGINE');
  console.log(`MODE: ${isDryRun ? '🔍 DRY RUN (NO DB OR R2 MUTATIONS)' : '🚀 LIVE MIGRATION'}`);
  console.log(`BATCH SIZE: ${batchSize} | LIMIT: ${limitSize || 'UNLIMITED'}`);
  console.log('====================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing in environment!');
    process.exit(1);
  }

  if (!isDryRun && !isR2Active()) {
    console.error('❌ R2 configuration is inactive or missing credentials!');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const stats = {
    totalRecords: 0,
    alreadyR2: 0,
    migrationCandidates: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    invalidBase64: 0,
    invalidImage: 0,
    missingRestaurantId: 0,
    failedRecords: []
  };

  try {
    const allQuery = `
      SELECT filename, mime_type, storage_provider, image_key, image_url, restaurant_id, data
      FROM stored_images
      ORDER BY filename ASC;
    `;
    const res = await pool.query(allQuery);
    const rows = res.rows || [];
    stats.totalRecords = rows.length;

    console.log(`📦 Found ${stats.totalRecords} total image records in database.\n`);

    // Filter candidates vs already R2
    const candidates = [];
    rows.forEach(r => {
      if (r.storage_provider === 'r2' && r.image_key) {
        stats.alreadyR2++;
        stats.skipped++;
      } else {
        candidates.push(r);
      }
    });

    stats.migrationCandidates = candidates.length;
    console.log(`- Already R2 (Skipped): ${stats.alreadyR2}`);
    console.log(`- Migration Candidates: ${stats.migrationCandidates}\n`);

    let itemsToProcess = candidates;
    if (limitSize && limitSize > 0) {
      itemsToProcess = candidates.slice(0, limitSize);
      console.log(`⚙️ Limiting migration run to first ${itemsToProcess.length} candidate(s).\n`);
    }

    // Process in controlled batches
    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const currentBatch = itemsToProcess.slice(i, i + batchSize);
      console.log(`--- Processing Batch ${Math.floor(i / batchSize) + 1} (${currentBatch.length} items) ---`);

      for (const row of currentBatch) {
        const restoId = row.restaurant_id || 1;
        if (!row.restaurant_id) {
          stats.missingRestaurantId++;
        }

        // Validate Base64 data presence
        if (!row.data || typeof row.data !== 'string' || row.data.trim().length === 0) {
          console.warn(`⚠️ [INVALID BASE64] ${row.filename}: empty or missing data column`);
          stats.invalidBase64++;
          stats.failed++;
          stats.failedRecords.push({
            filename: row.filename,
            restaurant_id: restoId,
            reason: 'Empty or missing Base64 data column'
          });
          continue;
        }

        // Extract clean base64 string
        let base64Clean = row.data.trim();
        if (base64Clean.includes('base64,')) {
          base64Clean = base64Clean.split('base64,')[1];
        }

        let rawBuffer;
        try {
          rawBuffer = Buffer.from(base64Clean, 'base64');
          if (!rawBuffer || rawBuffer.length === 0) {
            throw new Error('Zero length buffer after decoding base64');
          }
        } catch (b64Err) {
          console.warn(`⚠️ [INVALID BASE64] ${row.filename}: ${b64Err.message}`);
          stats.invalidBase64++;
          stats.failed++;
          stats.failedRecords.push({
            filename: row.filename,
            restaurant_id: restoId,
            reason: `Base64 decoding failed: ${b64Err.message}`
          });
          continue;
        }

        // Process through Sharp to validate image & optimize WebP
        let webpBuffer;
        let imageMetadata;
        try {
          const imagePipeline = sharp(rawBuffer);
          imageMetadata = await imagePipeline.metadata();

          if (!imageMetadata || !imageMetadata.format) {
            throw new Error('Invalid image bytes - Sharp could not determine image format');
          }

          let transformer = sharp(rawBuffer);
          if (imageMetadata.width && imageMetadata.width > 1200) {
            transformer = transformer.resize(1200, null, { withoutEnlargement: true });
          }

          webpBuffer = await transformer
            .webp({ quality: 85 })
            .toBuffer();

        } catch (imgErr) {
          console.warn(`⚠️ [INVALID IMAGE] ${row.filename}: ${imgErr.message}`);
          stats.invalidImage++;
          stats.failed++;
          stats.failedRecords.push({
            filename: row.filename,
            restaurant_id: restoId,
            reason: `Sharp image validation failed: ${imgErr.message}`
          });
          continue;
        }

        // Determine Entity Type
        let entityType = 'dishes';
        if (row.filename.includes('category') || row.filename.includes('cat')) {
          entityType = 'categories';
        } else if (row.filename.includes('logo') || row.filename.includes('resto')) {
          entityType = 'logos';
        }

        if (isDryRun) {
          console.log(`🔍 [DRY RUN] Would migrate: ${row.filename} -> restaurants/${restoId}/${entityType}/ (${webpBuffer.length} bytes WebP)`);
          stats.successful++;
          continue;
        }

        // Live Upload to Cloudflare R2
        try {
          console.log(`📤 Uploading WebP to R2 for ${row.filename}...`);
          const r2Result = await uploadImageToR2({
            buffer: webpBuffer,
            mimeType: 'image/webp',
            restaurantId: restoId,
            entityType
          });

          if (!r2Result || !r2Result.objectKey) {
            throw new Error('R2 upload returned empty object key');
          }

          const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
          const finalUrl = r2Result.publicUrl || proxyUrl;

          // SAFE DATABASE UPDATE: Update storage_provider, image_key, image_url ONLY. DO NOT TOUCH DATA COLUMN!
          await pool.query(
            `UPDATE stored_images
             SET storage_provider = 'r2',
                 image_key = $1,
                 image_url = $2
             WHERE filename = $3;`,
            [r2Result.objectKey, finalUrl, row.filename]
          );

          console.log(`✅ [MIGRATED SUCCESS] ${row.filename} -> R2 Key: ${r2Result.objectKey}`);
          stats.successful++;

        } catch (uploadErr) {
          console.error(`❌ [UPLOAD FAILED] ${row.filename}: ${uploadErr.message}`);
          stats.failed++;
          stats.failedRecords.push({
            filename: row.filename,
            restaurant_id: restoId,
            reason: `R2 Upload / DB Update Error: ${uploadErr.message}`
          });
        }
      }
    }

  } catch (dbErr) {
    console.error('Fatal Database Error during migration:', dbErr);
  } finally {
    await pool.end();
  }

  console.log('\n====================================================');
  console.log('📊 MIGRATION SUMMARY REPORT');
  console.log('====================================================');
  console.log(`TOTAL RECORDS:          ${stats.totalRecords}`);
  console.log(`ALREADY R2 (SKIPPED):   ${stats.alreadyR2}`);
  console.log(`MIGRATION CANDIDATES:   ${stats.migrationCandidates}`);
  console.log(`SUCCESSFUL MIGRATIONS:  ${stats.successful}`);
  console.log(`FAILED MIGRATIONS:      ${stats.failed}`);
  console.log(`INVALID BASE64 DATA:    ${stats.invalidBase64}`);
  console.log(`INVALID IMAGE DATA:     ${stats.invalidImage}`);
  console.log(`MISSING RESTAURANT ID:  ${stats.missingRestaurantId}`);
  console.log('====================================================\n');

  if (stats.failedRecords.length > 0) {
    console.log('❌ FAILED RECORDS DETAILS:');
    stats.failedRecords.forEach(f => {
      console.log(`- Filename: ${f.filename} | RestoID: ${f.restaurant_id} | Reason: ${f.reason}`);
    });
    console.log('\n');
  }

  return stats;
}

runMigration();
