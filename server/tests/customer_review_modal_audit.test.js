import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateSmartReview, getCustomerReviewProfile } from '../../src/utils/aiReviewGenerator.js';

test('🛡️ Customer Review Modal & Smart Reputation Audit Suite', async (t) => {
  const modalFilePath = path.join(process.cwd(), 'src/components/CustomerReviewModal.jsx');
  const appFilePath = path.join(process.cwd(), 'src/App.jsx');

  const modalSource = fs.readFileSync(modalFilePath, 'utf8');
  const appSource = fs.readFileSync(appFilePath, 'utf8');

  await t.test('1. CustomerReviewModal contains modern mobile bottom-sheet and responsive styling', () => {
    assert.ok(modalSource.includes('customer-review-sheet'), 'Must define customer-review-sheet class');
    assert.ok(modalSource.includes('@media (max-width: 480px)'), 'Must include mobile bottom-sheet query');
    assert.ok(modalSource.includes('reviewSheetEnter'), 'Must include sleek sheet entrance animation');
  });

  await t.test('2. CustomerReviewModal includes Google SVG branding and reliable copy fallback', () => {
    assert.ok(modalSource.includes('viewBox="0 0 24 24"'), 'Must include SVG Google icon');
    assert.ok(modalSource.includes('document.execCommand'), 'Must include fallback copy for non-secure / webview contexts');
    assert.ok(modalSource.includes('navigator.clipboard'), 'Must support navigator.clipboard');
  });

  await t.test('3. CustomerReviewModal locks background body scrolling when open', () => {
    assert.ok(modalSource.includes('document.body.style.overflow = \'hidden\''), 'Must lock body scroll on mount');
    assert.ok(modalSource.includes('document.body.style.overflow = originalOverflow'), 'Must restore body scroll on unmount');
  });

  await t.test('4. CustomerReviewModal includes 1-2 star negative review safeguard to protect Google rating', () => {
    assert.ok(modalSource.includes('isNegativeRating'), 'Must detect negative rating (<= 2 stars)');
    assert.ok(modalSource.includes('handleWhatsAppManager'), 'Must route 1-2 star feedback privately to WhatsApp/Manager');
  });

  await t.test('5. App.jsx passes lang prop to CustomerReviewModal', () => {
    assert.ok(appSource.includes('<CustomerReviewModal'), 'App.jsx must render CustomerReviewModal');
    assert.ok(appSource.includes('lang={lang}'), 'App.jsx must pass lang={lang} to CustomerReviewModal');
  });

  await t.test('6. NLP AI review engine produces high-converting ratings across all verticals', () => {
    const bakeryRev = generateSmartReview({
      restoName: 'Raman Sweets',
      restoType: 'sweet_bakery',
      rating: 5,
      selectedChips: ['🍬 Fresh Sweets'],
      customNote: 'Gulab jamun was melting in mouth'
    });
    assert.ok(bakeryRev.includes('Raman Sweets'));
    assert.ok(bakeryRev.includes('Gulab jamun was melting in mouth'));

    const hotelRev = generateSmartReview({
      restoName: 'Hotel Royal Palace',
      businessType: 'hotel_resort',
      rating: 5,
      selectedChips: ['🛏️ Comfortable Room']
    });
    assert.ok(hotelRev.includes('Hotel Royal Palace'));
  });
});
