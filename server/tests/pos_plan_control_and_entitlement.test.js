import test from 'node:test';
import assert from 'node:assert';
import { resolveTenantCapabilities, FEATURE_METADATA } from '../../src/utils/planCapabilities.js';

test('🛡️ Super Admin POS Plan Control & Entitlement Resolver Suite', async (t) => {
  await t.test('1. FEATURE_METADATA defines counter_ordering_enabled with complete luxury copy', () => {
    const meta = FEATURE_METADATA.counter_ordering_enabled;
    assert.ok(meta, 'counter_ordering_enabled must be defined in FEATURE_METADATA');
    assert.strictEqual(meta.name, 'Counter Quick POS & Token Billing');
    assert.strictEqual(meta.minTier, 'Pro');
    assert.strictEqual(meta.icon, '⚡');
    assert.ok(meta.benefit.includes('thermal bill printing'));
  });

  await t.test('2. Basic plan without complimentary access has counter_ordering_enabled = false', () => {
    const resto = { plan_tier: 'basic', subscription_type: 'PAID' };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, false, 'Basic tier should not have POS enabled by default');
  });

  await t.test('3. Pro plan without restrictions has counter_ordering_enabled = true', () => {
    const resto = { plan_tier: 'pro', subscription_type: 'PAID' };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, true, 'Pro tier should have POS enabled');
  });

  await t.test('4. Enterprise plan has counter_ordering_enabled = true', () => {
    const resto = { plan_tier: 'enterprise', subscription_type: 'PAID' };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, true, 'Enterprise tier should have POS enabled');
  });

  await t.test('5. Super Admin plan permissions: perms.counter_ordering_enabled = 1 enables POS on Basic', () => {
    const resto = { plan_tier: 'basic', subscription_type: 'PAID', permissions: { counter_ordering_enabled: 1 } };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, true, 'Super Admin toggled perms must enable POS even on Basic');
  });

  await t.test('6. Super Admin plan permissions: perms.counter_ordering_enabled = 0 disables POS on Pro', () => {
    const resto = { plan_tier: 'pro', subscription_type: 'PAID', permissions: { counter_ordering_enabled: 0 } };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, false, 'Super Admin toggled perms = 0 must disable POS on Pro');
  });

  await t.test('7. VIP / Complimentary access unlocks counter_ordering_enabled on Basic plan', () => {
    const resto = { plan_tier: 'basic', subscription_type: 'ADMIN_GRANTED', mandate_status: 'admin_granted' };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, true, 'VIP access should grant POS');
  });

  await t.test('8. Explicit restaurant flag counter_ordering_enabled = 0 strictly blocks POS', () => {
    const resto = { plan_tier: 'pro', counter_ordering_enabled: 0 };
    const caps = resolveTenantCapabilities(resto, {}, {});
    assert.strictEqual(caps.counter_ordering_enabled, false, 'Explicit 0 on restaurant must disable POS');
  });
});
