import pg from 'pg';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { uploadImageToR2, isR2Active } from '../server/services/r2ImageService.js';
import { saveR2ImageToDb } from '../server/db.js';

dotenv.config();

async function mirrorExternalImages() {
  console.log('====================================================');
  console.log('🚀 EXTERNAL IMAGES → CLOUDFLARE R2 AUTO-MIRROR ENGINE');
  console.log('====================================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL missing!');
    process.exit(1);
  }

  if (!isR2Active()) {
    console.error('❌ R2 configuration inactive or missing credentials!');
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  let totalDishes = 0;
  let successCount = 0;
  let failCount = 0;

  try {
    const dishesRes = await pool.query(
      "SELECT id, name, restaurant_id, image FROM dishes WHERE image LIKE 'http%' AND image NOT LIKE '%r2.dev%' AND image NOT LIKE '%/api/r2-proxy/%' ORDER BY id ASC;"
    );

    const dishes = dishesRes.rows || [];
    totalDishes = dishes.length;
    console.log(`📦 Found ${totalDishes} dishes with external image URLs.\n`);

    for (let i = 0; i < dishes.length; i++) {
      const dish = dishes[i];
      const restoId = dish.restaurant_id || 1;
      console.log(`[${i + 1}/${totalDishes}] Mirroring Dish #${dish.id} ("${dish.name}")...`);
      console.log(`  Source URL: ${dish.image}`);

      try {
        const fetchRes = await fetch(dish.image, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(15000)
        });

        if (!fetchRes.ok) {
          throw new Error(`HTTP fetch status ${fetchRes.status}`);
        }

        const arrayBuf = await fetchRes.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuf);

        if (!inputBuffer || inputBuffer.length === 0) {
          throw new Error('Fetched zero byte image buffer');
        }

        // Optimize through Sharp to WebP
        let webpBuffer;
        const imagePipeline = sharp(inputBuffer);
        const meta = await imagePipeline.metadata();

        let transformer = sharp(inputBuffer);
        if (meta.width && meta.width > 1200) {
          transformer = transformer.resize(1200, null, { withoutEnlargement: true });
        }

        webpBuffer = await transformer.webp({ quality: 85 }).toBuffer();

        // Upload to R2
        const r2Result = await uploadImageToR2({
          buffer: webpBuffer,
          mimeType: 'image/webp',
          restaurantId: restoId,
          entityType: 'dishes'
        });

        if (!r2Result || !r2Result.objectKey) {
          throw new Error('R2 returned empty object key');
        }

        const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
        const finalUrl = r2Result.publicUrl || proxyUrl;

        // Update Dish record in DB
        await pool.query(
          "UPDATE dishes SET image = $1 WHERE id = $2;",
          [proxyUrl, dish.id]
        );

        // Record in stored_images table
        const filename = `dish-mirrored-${dish.id}-${Date.now()}.webp`;
        await saveR2ImageToDb(filename, 'image/webp', r2Result.objectKey, finalUrl, restoId);

        console.log(`  ✅ Mirrored to R2: ${proxyUrl} (${webpBuffer.length} bytes WebP)\n`);
        successCount++;

      } catch (err) {
        console.warn(`  ⚠️ Skip Dish #${dish.id}: ${err.message}\n`);
        failCount++;
      }
    }

  } catch (err) {
    console.error('Fatal mirror error:', err);
  } finally {
    await pool.end();
  }

  console.log('====================================================');
  console.log('📊 EXTERNAL MIRROR SUMMARY');
  console.log('====================================================');
  console.log(`TOTAL EXTERNAL DISHES: ${totalDishes}`);
  console.log(`SUCCESSFULLY MIRRORED: ${successCount}`);
  console.log(`FAILED / SKIPPED:      ${failCount}`);
  console.log('====================================================\n');
}

mirrorExternalImages();
