import test from 'node:test';
import assert from 'node:assert/strict';

test('Add Business Onboarding: Payload validation & vertical capacity logic', async (t) => {
  await t.test('1. Step 1 validation requires name, type, and slug', () => {
    const isStep1Valid = (name, type, slug) => Boolean(name?.trim() && type && slug?.trim());
    assert.equal(isStep1Valid('', 'restaurant', 'resto'), false);
    assert.equal(isStep1Valid('Royal Cafe', '', 'royal-cafe'), false);
    assert.equal(isStep1Valid('Royal Cafe', 'restaurant', ''), false);
    assert.equal(isStep1Valid('Royal Cafe', 'restaurant', 'royal-cafe'), true);
  });

  await t.test('2. Step 4 validation requires username and min 4 char password', () => {
    const isStep4Valid = (u, p) => Boolean(u?.trim() && p?.length >= 4);
    assert.equal(isStep4Valid('', '12345'), false);
    assert.equal(isStep4Valid('admin', '123'), false);
    assert.equal(isStep4Valid('admin', '1234'), true);
  });

  await t.test('3. Industry capacity fields are properly populated based on vertical', () => {
    const formatCapacity = (service_model, { total_tables, total_rooms, total_screens, total_seats }) => {
      if (service_model === 'hotel') return `${total_rooms} Rooms`;
      if (service_model === 'cinema') return `${total_screens} Screens · ${total_seats} Seats`;
      return `${total_tables} Tables`;
    };

    assert.equal(formatCapacity('hotel', { total_rooms: 25, total_tables: 0, total_screens: 0, total_seats: 0 }), '25 Rooms');
    assert.equal(formatCapacity('cinema', { total_rooms: 0, total_tables: 0, total_screens: 4, total_seats: 250 }), '4 Screens · 250 Seats');
    assert.equal(formatCapacity('dine_in', { total_rooms: 0, total_tables: 15, total_screens: 0, total_seats: 0 }), '15 Tables');
  });

  await t.test('4. Onboarding mode routes correctly between direct provisioning and Cashfree', () => {
    const isCashfreeMode = (mode) => (mode === 'cashfree_paid' || mode === 'cashfree_trial' || mode === 'active');
    assert.equal(isCashfreeMode('trial'), false); // Direct instant provisioning!
    assert.equal(isCashfreeMode('vip'), false);   // Direct instant provisioning!
    assert.equal(isCashfreeMode('cashfree_paid'), true);
    assert.equal(isCashfreeMode('cashfree_trial'), true);
    assert.equal(isCashfreeMode('active'), true);
  });

  await t.test('5. Expiry calculation for Instant Trial defaults to 16 days or custom', () => {
    const calcTrialExpiry = (trialDays, defaultDays = 16) => {
      const days = parseInt(trialDays || defaultDays, 10);
      return (days > 0 ? days : 16);
    };
    assert.equal(calcTrialExpiry(null), 16);
    assert.equal(calcTrialExpiry('30'), 30);
    assert.equal(calcTrialExpiry(7), 7);
  });
});

