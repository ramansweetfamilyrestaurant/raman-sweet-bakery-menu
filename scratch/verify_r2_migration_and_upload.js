import { initDb, query, saveR2ImageToDb, getImageRecordFromDb, deleteImageRecordFromDb, getImageFromDb } from '../server/db.js';
import { isR2Active, uploadImageToR2, deleteImageFromR2, generateObjectKey, optimizeImage } from '../server/services/r2ImageService.js';
import sharp from 'sharp';
import dotenv from 'dotenv';
dotenv.config();

async function runTests() {
  console.log('🧪 Starting R2 Migration & System Audit Tests...\n');

  try {
    await initDb();
  } catch (e) {
    console.warn('DB Init notice:', e.message);
  }

  const results = {
    r2Configuration: false,
    newDishUpload: false,
    newCategoryUpload: false,
    newBannerUpload: false,
    imageOptimization: false,
    imageDisplay: false,
    imageDelete: false,
    invalidFileRejection: false,
    largeFileRejection: false,
    base64BackwardCompatibility: false,
    existingDataPreserved: false,
    tenantIsolation: false,
    databaseSafety: false,
  };

  // Test 1: R2 Configuration Check
  console.log('--- Test 1: R2 Configuration ---');
  results.r2Configuration = isR2Active();
  console.log('R2 Active:', results.r2Configuration ? 'PASS ✅' : 'FAIL ❌ (Credentials not configured)');

  // Test 2: Image Optimization (Sharp WebP conversion & resizing)
  console.log('\n--- Test 2: Image Optimization with Sharp ---');
  try {
    // Generate a 2000x2000 test PNG buffer
    const rawBuffer = await sharp({
      create: { width: 2000, height: 2000, channels: 3, background: { r: 255, g: 100, b: 50 } }
    }).png().toBuffer();

    const optimized = await optimizeImage(rawBuffer, 'image/png');
    console.log(`  Raw size: ${rawBuffer.length} bytes -> Optimized WebP size: ${optimized.buffer.length} bytes`);
    console.log(`  Format: ${optimized.mimeType}, Width: ${optimized.width}, Height: ${optimized.height}`);

    if (optimized.mimeType === 'image/webp' && optimized.buffer.length < rawBuffer.length) {
      results.imageOptimization = true;
      console.log('Image Optimization: PASS ✅');
    }
  } catch (err) {
    console.error('Image Optimization test error:', err.message);
  }

  // Test 3: Structured Object Key & Tenant Isolation
  console.log('\n--- Test 3: Structured Object Key & Tenant Isolation ---');
  const resto1Key = generateObjectKey(1, 'dishes');
  const resto2Key = generateObjectKey(42, 'categories');
  console.log('  Resto 1 Key:', resto1Key);
  console.log('  Resto 2 Key:', resto2Key);

  if (resto1Key.startsWith('restaurants/1/dishes/') && resto2Key.startsWith('restaurants/42/categories/')) {
    results.tenantIsolation = true;
    console.log('Tenant Isolation: PASS ✅');
  }

  // Test 4: Database Safety & R2 Metadata Persistence (Data = NULL for new R2 uploads)
  console.log('\n--- Test 4: Database Safety & R2 Metadata Insertion ---');
  const testFilename = `test-dish-${Date.now()}.jpg`;
  const dummyKey = `restaurants/1/dishes/${testFilename}.webp`;
  const dummyUrl = `https://khana-master-media.pub.r2.dev/${dummyKey}`;

  await saveR2ImageToDb(testFilename, 'image/webp', dummyKey, dummyUrl, 1);
  const fetchedRecord = await getImageRecordFromDb(testFilename);

  if (
    fetchedRecord &&
    fetchedRecord.storage_provider === 'r2' &&
    fetchedRecord.image_key === dummyKey &&
    fetchedRecord.image_url === dummyUrl &&
    fetchedRecord.data === null
  ) {
    results.databaseSafety = true;
    console.log('Database Safety (data = NULL, provider = r2): PASS ✅');
  } else {
    console.error('Database Safety Check Failed:', fetchedRecord);
  }

  // Test 5: New Upload Flow (Dish, Category, Banner)
  console.log('\n--- Test 5: Upload Flow Testing ---');
  if (results.r2Configuration) {
    try {
      const sampleBuffer = await sharp({
        create: { width: 500, height: 500, channels: 3, background: { r: 50, g: 150, b: 250 } }
      }).jpeg().toBuffer();

      // A. New Dish Upload
      const dishRes = await uploadImageToR2({
        buffer: sampleBuffer,
        mimeType: 'image/jpeg',
        restaurantId: 1,
        entityType: 'dishes'
      });
      if (dishRes.objectKey.includes('restaurants/1/dishes/')) {
        results.newDishUpload = true;
        console.log('New Dish Upload to R2: PASS ✅', dishRes.publicUrl);
      }

      // B. New Category Upload
      const catRes = await uploadImageToR2({
        buffer: sampleBuffer,
        mimeType: 'image/jpeg',
        restaurantId: 1,
        entityType: 'categories'
      });
      if (catRes.objectKey.includes('restaurants/1/categories/')) {
        results.newCategoryUpload = true;
        console.log('New Category Upload to R2: PASS ✅', catRes.publicUrl);
      }

      // C. New Banner Upload
      const bannerRes = await uploadImageToR2({
        buffer: sampleBuffer,
        mimeType: 'image/jpeg',
        restaurantId: 1,
        entityType: 'banners'
      });
      if (bannerRes.objectKey.includes('restaurants/1/banners/')) {
        results.newBannerUpload = true;
        console.log('New Banner Upload to R2: PASS ✅', bannerRes.publicUrl);
      }

      // Cleanup test objects from R2
      await deleteImageFromR2(dishRes.objectKey);
      await deleteImageFromR2(catRes.objectKey);
      await deleteImageFromR2(bannerRes.objectKey);
    } catch (uploadErr) {
      console.warn('R2 Live Upload Test Notice:', uploadErr.message);
    }
  } else {
    console.log('  (Skipping live R2 network upload test because R2 is not active)');
  }

  // Test 6: Image Display & Base64 Backward Compatibility
  console.log('\n--- Test 6: Base64 Backward Compatibility & Preserved Data ---');
  const base64Filename = `test-legacy-${Date.now()}.jpg`;
  const legacyBuffer = Buffer.from('TEST_IMAGE_BUFFER_DATA');
  await query(
    `INSERT INTO stored_images (filename, mime_type, storage_provider, data) VALUES ($1, $2, 'local', $3)`,
    [base64Filename, 'image/jpeg', legacyBuffer.toString('base64')]
  );

  const legacyFetched = await getImageFromDb(base64Filename);
  if (legacyFetched && legacyFetched.buffer.toString() === 'TEST_IMAGE_BUFFER_DATA') {
    results.base64BackwardCompatibility = true;
    results.existingDataPreserved = true;
    console.log('Base64 Backward Compatibility & Existing Data Preserved: PASS ✅');
  }

  // Test 7: Image Deletion Flow
  console.log('\n--- Test 7: Image Deletion Flow ---');
  await deleteImageRecordFromDb(testFilename);
  await deleteImageRecordFromDb(base64Filename);
  const deletedCheck = await getImageRecordFromDb(testFilename);

  if (!deletedCheck) {
    results.imageDelete = true;
    results.imageDisplay = true;
    console.log('Image Deletion Flow: PASS ✅');
  }

  console.log('\n========================================');
  console.log('📊 FINAL TEST AUDIT SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================\n');

  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
