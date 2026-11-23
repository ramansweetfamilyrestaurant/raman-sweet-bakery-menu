import express from 'express';
import path from 'path';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { validateTestDatabaseUrl } from './testDbGuard.js';

const TEST_DB_PATH = path.resolve('menu_test_runner.db');
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = `sqlite:${TEST_DB_PATH}`;
}
validateTestDatabaseUrl(process.env.TEST_DATABASE_URL);

import { initDb, query } from '../db.js';
import adminRoutes from '../routes/admin.js';

const JWT_SECRET = process.env.JWT_SECRET || 'touchqr_ultra_secure_jwt_secret_dev_2026';

(async () => {
  console.log('======================================================================');
  console.log('🌟 Reviews & AI Auto-Reply Verification & Persistence Suite');
  console.log('======================================================================\n');

  await initDb();

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`⚡ Test server active on ${baseUrl}\n`);

  try {
    const timestamp = Date.now();
    const testSlug = `review-test-${timestamp}`;

    // Create a test tenant with Pro Plan active
    const restoIns = await query(`
      INSERT INTO restaurants (
        name, slug, business_type, plan_tier, plan_price, active, trial_ends_at, plan_expires_at
      ) VALUES (
        $1, $2, 'hotel', 'pro', 999, 1, '2030-01-01T00:00:00Z', '2030-01-01T00:00:00Z'
      ) RETURNING id
    `, ['Grand Hotel & Resort', testSlug]);

    const restoId = restoIns[0].id;
    const token = jwt.sign(
      { id: 9999, restaurant_id: restoId, role: 'restaurant_admin', username: `admin_${timestamp}` },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // -------------------------------------------------------------------------
    // TEST 1: Persist AI review settings via PUT /api/admin/settings
    // -------------------------------------------------------------------------
    console.log('[TEST 1: Persist AI Review Settings via PUT /api/admin/settings]');
    const payload = {
      ai_review_tone: 'professional',
      ai_review_language: 'Hinglish',
      ai_brand_instructions: 'Always highlight our prompt room service and hygienic cleanliness.',
      ai_auto_replies: 1,
      ai_require_approval: 0
    };

    const putRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(putRes.status, 200, 'PUT /api/admin/settings must return 200');
    const putData = await putRes.json();
    assert.strictEqual(putData.success, true, 'Settings update must succeed');

    // Verify retrieval via GET /api/admin/settings
    const getRes = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.ai_review_tone, 'professional', 'ai_review_tone must persist');
    assert.strictEqual(getData.ai_review_language, 'Hinglish', 'ai_review_language must persist');
    assert.strictEqual(getData.ai_brand_instructions, 'Always highlight our prompt room service and hygienic cleanliness.', 'ai_brand_instructions must persist');
    assert.strictEqual(Number(getData.ai_auto_replies), 1, 'ai_auto_replies must persist');
    assert.strictEqual(Number(getData.ai_require_approval), 0, 'ai_require_approval must persist');
    console.log('✓ TEST 1 PASSED: AI review settings persisted and fetched successfully\n');

    // -------------------------------------------------------------------------
    // TEST 2: Hotel English reply generation (No exclamation marks)
    // -------------------------------------------------------------------------
    console.log('[TEST 2: Hotel English Reply Generation (No !)]');
    const hotelGenRes = await fetch(`${baseUrl}/api/admin/generate-ai-review-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reviewText: 'Great stay, peaceful room, and swift check-in.',
        starRating: 5,
        selectedTone: 'professional',
        selectedLanguage: 'English',
        restaurantName: 'Grand Hotel & Resort',
        businessType: 'hotel',
        industry: 'hotel'
      })
    });

    assert.strictEqual(hotelGenRes.status, 200);
    const hotelGenData = await hotelGenRes.json();
    assert.ok(hotelGenData.reply, 'Should return reply string');
    assert.ok(!hotelGenData.reply.includes('!'), `Reply must not contain '!': ${hotelGenData.reply}`);
    assert.ok(hotelGenData.reply.includes('Grand Hotel & Resort'), 'Reply must include business name');
    console.log('Hotel Reply:', hotelGenData.reply);
    console.log('✓ TEST 2 PASSED: Hotel English reply generated without exclamation marks\n');

    // -------------------------------------------------------------------------
    // TEST 3: Critical Review (1 star) humble response (No exclamation marks)
    // -------------------------------------------------------------------------
    console.log('[TEST 3: Critical Review (1 star) Apologetic Reply (No !)]');
    const critGenRes = await fetch(`${baseUrl}/api/admin/generate-ai-review-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reviewText: 'Food took 50 minutes and arrived cold.',
        starRating: 1,
        selectedTone: 'apologetic',
        selectedLanguage: 'English',
        restaurantName: 'Raman Express',
        businessType: 'restaurant'
      })
    });

    assert.strictEqual(critGenRes.status, 200);
    const critGenData = await critGenRes.json();
    assert.ok(!critGenData.reply.includes('!'), `Critical reply must not contain '!': ${critGenData.reply}`);
    const critLower = critGenData.reply.toLowerCase();
    assert.ok(critLower.includes('apologize') || critLower.includes('regret') || critLower.includes('inconvenience'), 'Must be humble/apologetic');
    console.log('Critical Reply:', critGenData.reply);
    console.log('✓ TEST 3 PASSED: Critical review handled with sincere apology without exclamation marks\n');

    // -------------------------------------------------------------------------
    // TEST 4: Hindi Language Generation (No exclamation marks)
    // -------------------------------------------------------------------------
    console.log('[TEST 4: Hindi Language Reply Generation]');
    const hindiGenRes = await fetch(`${baseUrl}/api/admin/generate-ai-review-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reviewText: 'बहुत ही स्वादिष्ट मिठाई और अच्छा व्यवहार।',
        starRating: 5,
        selectedTone: 'warm',
        selectedLanguage: 'Hindi',
        restaurantName: 'रमन मिष्ठान भंडार',
        businessType: 'bakery'
      })
    });

    assert.strictEqual(hindiGenRes.status, 200);
    const hindiGenData = await hindiGenRes.json();
    assert.ok(!hindiGenData.reply.includes('!'), `Hindi reply must not contain '!': ${hindiGenData.reply}`);
    assert.ok(hindiGenData.reply.includes('धन्यवाद'), 'Hindi reply should contain polite gratitude');
    console.log('Hindi Reply:', hindiGenData.reply);
    console.log('✓ TEST 4 PASSED: Hindi reply generated politely without exclamation marks\n');

    // -------------------------------------------------------------------------
    // TEST 5: Cinema Hinglish Reply Generation (No exclamation marks)
    // -------------------------------------------------------------------------
    console.log('[TEST 5: Cinema Hinglish Reply Generation]');
    const cinemaGenRes = await fetch(`${baseUrl}/api/admin/generate-ai-review-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reviewText: 'Loved the Dolby Atmos and seat recliner.',
        starRating: 5,
        selectedTone: 'warm',
        selectedLanguage: 'Hinglish',
        restaurantName: 'Star Cineplex',
        businessType: 'cinema'
      })
    });

    assert.strictEqual(cinemaGenRes.status, 200);
    const cinemaGenData = await cinemaGenRes.json();
    assert.ok(!cinemaGenData.reply.includes('!'), `Cinema Hinglish reply must not contain '!': ${cinemaGenData.reply}`);
    assert.ok(cinemaGenData.reply.includes('Star Cineplex'), 'Cinema reply must include theatre name');
    console.log('Cinema Hinglish Reply:', cinemaGenData.reply);
    console.log('✓ TEST 5 PASSED: Cinema Hinglish reply generated without exclamation marks\n');

    // -------------------------------------------------------------------------
    // TEST 6: AI Review Settings Update Resilience
    // -------------------------------------------------------------------------
    console.log('[TEST 6: Update AI Review Settings to New Values]');
    const updateRes = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ai_review_tone: 'warm',
        ai_review_language: 'Hindi',
        ai_brand_instructions: 'Thank customers warmly and invite them back.',
        ai_auto_replies: 1,
        ai_require_approval: 1
      })
    });

    assert.strictEqual(updateRes.status, 200);
    const getRes2 = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const getData2 = await getRes2.json();
    assert.strictEqual(getData2.ai_review_tone, 'warm');
    assert.strictEqual(getData2.ai_review_language, 'Hindi');
    assert.strictEqual(getData2.ai_brand_instructions, 'Thank customers warmly and invite them back.');
    console.log('✓ TEST 6 PASSED: Re-updating AI settings works reliably\n');

    console.log('======================================================================');
    console.log('🎉 ALL 6 REVIEWS & AI AUTO-REPLY TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================================');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failure:', err);
    server.close();
    process.exit(1);
  }
})();
