import { isR2Active, generateObjectKey, optimizeImage } from '../server/services/r2ImageService.js';
import sharp from 'sharp';

async function testR2Service() {
  console.log('--- 1. Testing Sharp WebP Image Optimization ---');
  const pngBuffer = await sharp({
    create: { width: 1500, height: 1500, channels: 3, background: { r: 200, g: 50, b: 50 } }
  }).png().toBuffer();

  const opt = await optimizeImage(pngBuffer, 'image/png');
  console.log(`  Raw PNG size: ${pngBuffer.length} bytes`);
  console.log(`  Optimized WebP size: ${opt.buffer.length} bytes`);
  console.log(`  MIME Type: ${opt.mimeType}`);
  console.log(`  Dimensions: ${opt.width}x${opt.height}`);

  if (opt.mimeType === 'image/webp' && opt.buffer.length < pngBuffer.length) {
    console.log('✅ Sharp Optimization: PASS');
  } else {
    console.error('❌ Sharp Optimization: FAIL');
    process.exit(1);
  }

  console.log('\n--- 2. Testing Tenant-Isolated Object Key Generation ---');
  const dishKey = generateObjectKey(1, 'dishes');
  const catKey = generateObjectKey(5, 'categories');
  const bannerKey = generateObjectKey(10, 'banners');

  console.log('  Dish Key:', dishKey);
  console.log('  Category Key:', catKey);
  console.log('  Banner Key:', bannerKey);

  if (
    dishKey.startsWith('restaurants/1/dishes/') &&
    catKey.startsWith('restaurants/5/categories/') &&
    bannerKey.startsWith('restaurants/10/banners/') &&
    dishKey.endsWith('.webp')
  ) {
    console.log('✅ Object Key Format & Tenant Isolation: PASS');
  } else {
    console.error('❌ Object Key Format & Tenant Isolation: FAIL');
    process.exit(1);
  }

  console.log('\n--- 3. Testing R2 Active Status ---');
  console.log('  R2 Active:', isR2Active());

  console.log('\n🎉 All In-Memory Unit Tests PASSED Successfully!');
  process.exit(0);
}

testR2Service().catch((err) => {
  console.error('Fatal unit test error:', err);
  process.exit(1);
});
