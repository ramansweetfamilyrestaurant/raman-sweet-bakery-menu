import { saveImageToDb, getImageFromDb, initDb } from '../server/db.js';
import fs from 'fs';
import path from 'path';

async function testPersistentImageUpload() {
  console.log('🧪 Starting Persistent Image Upload Verification Test...');
  
  await initDb();

  const testFilename = `test-dish-${Date.now()}.png`;
  const dummyBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const mimeType = 'image/png';

  console.log(`1. Saving dummy test image (${testFilename}) to DB...`);
  await saveImageToDb(testFilename, mimeType, dummyBuffer);

  console.log(`2. Retrieving test image (${testFilename}) from DB...`);
  const fetchedImg = await getImageFromDb(testFilename);

  if (!fetchedImg) {
    console.error('❌ FAIL: Image was not found in DB!');
    process.exit(1);
  }

  if (fetchedImg.mimeType !== mimeType) {
    console.error(`❌ FAIL: MimeType mismatch. Expected ${mimeType}, got ${fetchedImg.mimeType}`);
    process.exit(1);
  }

  if (!fetchedImg.buffer.equals(dummyBuffer)) {
    console.error('❌ FAIL: Buffer content mismatch!');
    process.exit(1);
  }

  console.log('✅ PASS: Image stored in DB, retrieved with matching MimeType & Buffer integrity!');
  process.exit(0);
}

testPersistentImageUpload().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
