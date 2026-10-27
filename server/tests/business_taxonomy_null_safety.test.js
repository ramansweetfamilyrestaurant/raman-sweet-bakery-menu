import test from 'node:test';
import assert from 'node:assert/strict';

import * as frontendTaxonomy from '../../src/utils/businessTaxonomy.js';
import * as backendTaxonomy from '../config/businessTaxonomy.js';

test('businessTaxonomy null-safety test suite', async (t) => {
  await t.test('frontend businessTaxonomy handles null and undefined gracefully', () => {
    // 1. resolveBusinessProfile
    assert.doesNotThrow(() => frontendTaxonomy.resolveBusinessProfile(null));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBusinessProfile(undefined));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBusinessProfile({}));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBusinessProfile(false));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBusinessProfile(0));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBusinessProfile(''));

    const nullProfile = frontendTaxonomy.resolveBusinessProfile(null);
    assert.equal(nullProfile.business_type, 'restaurant');
    assert.equal(nullProfile.service_model, 'dine_in');
    assert.equal(nullProfile.is_pure_veg, false);

    // 2. resolveBannerBadge
    assert.doesNotThrow(() => frontendTaxonomy.resolveBannerBadge(null));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBannerBadge(undefined));
    assert.doesNotThrow(() => frontendTaxonomy.resolveBannerBadge({}));
    const badge = frontendTaxonomy.resolveBannerBadge(null);
    assert.equal(typeof badge, 'string');

    // 3. getBusinessTerminology
    assert.doesNotThrow(() => frontendTaxonomy.getBusinessTerminology(null));
    assert.doesNotThrow(() => frontendTaxonomy.getBusinessTerminology(undefined));
    assert.doesNotThrow(() => frontendTaxonomy.getBusinessTerminology({}));
    const terms = frontendTaxonomy.getBusinessTerminology(null);
    assert.ok(terms);
    assert.equal(terms.businessType, 'restaurant');
    assert.equal(terms.spaceSingular, 'Table');

    // 4. getAvailableSpaceTypesForBusiness
    assert.doesNotThrow(() => frontendTaxonomy.getAvailableSpaceTypesForBusiness(null, null, null));
    assert.doesNotThrow(() => frontendTaxonomy.getAvailableSpaceTypesForBusiness(undefined, undefined, undefined));
    const spaces = frontendTaxonomy.getAvailableSpaceTypesForBusiness(null, null, null);
    assert.ok(Array.isArray(spaces));
    assert.ok(spaces.length >= 3);
  });

  await t.test('backend config/businessTaxonomy handles null and undefined gracefully', () => {
    // 1. resolveBusinessProfile
    assert.doesNotThrow(() => backendTaxonomy.resolveBusinessProfile(null));
    assert.doesNotThrow(() => backendTaxonomy.resolveBusinessProfile(undefined));
    assert.doesNotThrow(() => backendTaxonomy.resolveBusinessProfile({}));
    assert.doesNotThrow(() => backendTaxonomy.resolveBusinessProfile(false));
    assert.doesNotThrow(() => backendTaxonomy.resolveBusinessProfile(0));
    assert.doesNotThrow(() => backendTaxonomy.resolveBusinessProfile(''));

    const nullProfile = backendTaxonomy.resolveBusinessProfile(null);
    assert.equal(nullProfile.business_type, 'restaurant');
    assert.equal(nullProfile.service_model, 'dine_in');
    assert.equal(nullProfile.is_pure_veg, false);

    // 2. resolveBannerBadge
    assert.doesNotThrow(() => backendTaxonomy.resolveBannerBadge(null));
    assert.doesNotThrow(() => backendTaxonomy.resolveBannerBadge(undefined));
    assert.doesNotThrow(() => backendTaxonomy.resolveBannerBadge({}));
    const badge = backendTaxonomy.resolveBannerBadge(null);
    assert.equal(typeof badge, 'string');

    // 3. getAvailableSpaceTypesForBusiness
    assert.doesNotThrow(() => backendTaxonomy.getAvailableSpaceTypesForBusiness(null, null, null));
    assert.doesNotThrow(() => backendTaxonomy.getAvailableSpaceTypesForBusiness(undefined, undefined, undefined));
    const spaces = backendTaxonomy.getAvailableSpaceTypesForBusiness(null, null, null);
    assert.ok(Array.isArray(spaces));
    assert.ok(spaces.length >= 3);
  });
});
