import dotenv from 'dotenv';
import path from 'path';
import { query, initDb } from '../server/db.js';
import { isR2Active, uploadImageToR2 } from '../server/services/r2ImageService.js';
dotenv.config();

async function runMigration() {
  console.log('🚀 Starting Safe Image Migration to Cloudflare R2...');

  try {
    await initDb();
  } catch (err) {
    console.warn('DB Init notice:', err.message);
  }

  if (!isR2Active()) {
    console.error('❌ ERROR: Cloudflare R2 credentials are not active in environment. Migration aborted.');
    process.exit(1);
  }

  // Fetch all rows where Base64 data exists and storage_provider is NOT 'r2'
  const rows = await query(`
    SELECT filename, mime_type, data, restaurant_id
    FROM stored_images
    WHERE data IS NOT NULL
      AND (storage_provider IS NULL OR storage_provider != 'r2')
  `);

  if (!rows || rows.length === 0) {
    console.log('✅ No unmigrated Base64 images found. All images are up-to-date!');
    process.exit(0);
  }

  console.log(`📦 Found ${rows.length} Base64 image(s) to migrate to Cloudflare R2.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const index = i + 1;
    console.log(`[${index}/${rows.length}] Migrating image: ${row.filename}...`);

    try {
      if (!row.data || typeof row.data !== 'string') {
        console.warn(`  ⚠️ Skip ${row.filename}: Empty data string.`);
        continue;
      }

      // Decode Base64 string to Buffer
      const imageBuffer = Buffer.from(row.data, 'base64');
      const restoId = row.restaurant_id || 1;

      // Upload to R2 via Sharp optimization service
      const r2Result = await uploadImageToR2({
        buffer: imageBuffer,
        mimeType: row.mime_type || 'image/jpeg',
        restaurantId: restoId,
        entityType: 'migrated'
      });

      // Update Database Row to mark as migrated (set storage_provider='r2', image_key, image_url)
      // DO NOT delete data column or Base64 data to maintain maximum safety!
      await query(`
        UPDATE stored_images
        SET storage_provider = 'r2',
            image_key = $1,
            image_url = $2
        WHERE filename = $3
      `, [r2Result.objectKey, r2Result.publicUrl, row.filename]);

      console.log(`  ✅ Successfully migrated to R2: ${r2Result.publicUrl}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to migrate ${row.filename}:`, err.message);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Migration Completed!`);
  console.log(`- Total Found: ${rows.length}`);
  console.log(`- Successfully Migrated: ${successCount}`);
  console.log(`- Failed: ${failCount}`);
  console.log('========================================\n');

  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
