import test from 'node:test';
import assert from 'node:assert/strict';

test('Half portion pricing and label resolution logic', async (t) => {
  await t.test('detects half portion across various customer and dish label formats', () => {
    const dbItem = {
      id: 101,
      name: 'Paneer Butter Masala',
      price: 280,
      price_half: 160,
      portion_half_label: 'Half Portion',
      portion_full_label: 'Full Portion'
    };

    const hasHalfPrice = dbItem.price_half !== null && dbItem.price_half !== undefined && Number(dbItem.price_half) > 0;

    const checkPricing = (item) => {
      const rawPortion = String(item.portion || item.portion_type || '').toLowerCase().trim();
      const rawPortionType = String(item.portion_type || '').toLowerCase().trim();
      const dbHalfLabel = String(dbItem.portion_half_label || '').toLowerCase().trim();

      const isHalfPortion = hasHalfPrice && (
        rawPortionType === 'half' ||
        rawPortion === 'half' ||
        rawPortion === 'half portion' ||
        rawPortion.includes('half') ||
        rawPortion.includes('हाफ') ||
        (dbHalfLabel && rawPortion === dbHalfLabel)
      );

      let baseRegularPrice = 0;
      let portionLabel = item.portion || '';
      if (isHalfPortion) {
        baseRegularPrice = Number(dbItem.price_half);
        portionLabel = item.portion || dbItem.portion_half_label || 'Half';
      } else {
        baseRegularPrice = Number(dbItem.price) || 0;
      }

      return { baseRegularPrice, portionLabel, isHalfPortion };
    };

    // Case 1: portion is exactly "Half"
    const r1 = checkPricing({ portion: 'Half' });
    assert.strictEqual(r1.isHalfPortion, true);
    assert.strictEqual(r1.baseRegularPrice, 160);

    // Case 2: portion is "Half Portion" (default frontend label)
    const r2 = checkPricing({ portion: 'Half Portion' });
    assert.strictEqual(r2.isHalfPortion, true);
    assert.strictEqual(r2.baseRegularPrice, 160);
    assert.strictEqual(r2.portionLabel, 'Half Portion');

    // Case 3: portion is "हाफ प्लेट"
    const r3 = checkPricing({ portion: 'हाफ प्लेट' });
    assert.strictEqual(r3.isHalfPortion, true);
    assert.strictEqual(r3.baseRegularPrice, 160);

    // Case 4: portion_type is explicitly "half"
    const r4 = checkPricing({ portion: 'Special Cut', portion_type: 'half' });
    assert.strictEqual(r4.isHalfPortion, true);
    assert.strictEqual(r4.baseRegularPrice, 160);

    // Case 5: Full portion
    const r5 = checkPricing({ portion: 'Full Portion' });
    assert.strictEqual(r5.isHalfPortion, false);
    assert.strictEqual(r5.baseRegularPrice, 280);

    // Case 6: No portion specified (defaults to full)
    const r6 = checkPricing({});
    assert.strictEqual(r6.isHalfPortion, false);
    assert.strictEqual(r6.baseRegularPrice, 280);
  });
});
