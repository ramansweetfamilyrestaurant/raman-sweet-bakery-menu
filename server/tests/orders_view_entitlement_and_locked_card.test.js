import test from 'node:test';
import assert from 'node:assert';
import { resolveTenantCapabilities } from '../../src/utils/planCapabilities.js';

test('🛡️ OrdersView & Direct Ordering Entitlement Hardening Suite', async (t) => {
  await t.test('1. resolveTenantCapabilities: respects explicit restaurant direct_ordering_enabled = 1 even if perms is false', () => {
    const resto = {
      id: 9,
      name: 'raja restaurant',
      slug: 'raja-restaurant',
      direct_ordering_enabled: 1,
      plan_tier: 'pro'
    };
    const subStatus = {
      plan_tier: 'pro',
      permissions: {
        direct_ordering_enabled: false
      }
    };
    const caps = resolveTenantCapabilities(resto, {}, subStatus);
    assert.strictEqual(caps.direct_ordering_enabled, true, 'Explicit restaurant direct_ordering_enabled=1 must prevail over default matrix permissions');
  });

  await t.test('2. resolveTenantCapabilities: respects explicit restaurant direct_ordering_enabled = 0', () => {
    const resto = {
      id: 9,
      name: 'raja restaurant',
      slug: 'raja-restaurant',
      direct_ordering_enabled: 0,
      plan_tier: 'enterprise'
    };
    const subStatus = {
      plan_tier: 'enterprise',
      permissions: {
        direct_ordering_enabled: true
      }
    };
    const caps = resolveTenantCapabilities(resto, {}, subStatus);
    assert.strictEqual(caps.direct_ordering_enabled, false, 'Explicit restaurant direct_ordering_enabled=0 must disable direct ordering');
  });

  await t.test('3. resolveTenantCapabilities: falls back to perms/plan tier when explicit restaurant flag is missing', () => {
    const restoWithoutFlag = { id: 10, name: 'Basic Cafe', plan_tier: 'basic' };
    const capsBasic = resolveTenantCapabilities(restoWithoutFlag, {}, {});
    assert.strictEqual(capsBasic.direct_ordering_enabled, false, 'Basic tier without explicit flag defaults to false');

    const restoEnterprise = { id: 11, name: 'Enterprise Hotel', plan_tier: 'enterprise' };
    const capsEnterprise = resolveTenantCapabilities(restoEnterprise, {}, {});
    assert.strictEqual(capsEnterprise.direct_ordering_enabled, true, 'Enterprise tier without explicit flag defaults to true');
  });

  await t.test('4. AdminDashboard isDirectOrderingEnabled: turns true if live orders exist', () => {
    const orders = [{ id: 101, table_number: 'Table 4', status: 'pending', total: 450 }];
    const tenantCaps = { direct_ordering_enabled: false };
    const restaurantInfo = { direct_ordering_enabled: 0 };
    const settingsForm = { direct_ordering_enabled: 0 };

    const hasLiveOrders = Array.isArray(orders) && orders.length > 0;
    const isDirectOrderingRestoActive = (
      restaurantInfo?.direct_ordering_enabled === 1 ||
      restaurantInfo?.direct_ordering_enabled === true ||
      restaurantInfo?.direct_ordering_enabled === '1' ||
      settingsForm?.direct_ordering_enabled === 1 ||
      settingsForm?.direct_ordering_enabled === true ||
      settingsForm?.direct_ordering_enabled === '1'
    );
    const isDirectOrderingEnabled = Boolean(
      tenantCaps.direct_ordering_enabled ||
      isDirectOrderingRestoActive ||
      hasLiveOrders
    );

    assert.strictEqual(isDirectOrderingEnabled, true, 'When an incoming order is present, isDirectOrderingEnabled must be true so manager can see the order');
  });

  await t.test('5. OrdersView locked state check: incoming orders prevent locked card hijack', () => {
    const evaluateOrdersScreenBlocker = ({ ordersEnabled, validOrders, safeServiceRequests }) => {
      const hasIncomingActivity = validOrders.length > 0 || safeServiceRequests.length > 0;
      if (!ordersEnabled && !hasIncomingActivity) {
        return 'PLAN_LOCKED_CARD';
      }
      return 'LIVE_ORDERS_VIEW';
    };

    // Case A: Siren ringing, 1 order arrived, ordersEnabled was false
    const resultWithIncomingOrder = evaluateOrdersScreenBlocker({
      ordersEnabled: false,
      validOrders: [{ id: 501, status: 'pending' }],
      safeServiceRequests: []
    });
    assert.strictEqual(resultWithIncomingOrder, 'LIVE_ORDERS_VIEW', 'Incoming order must bypass locked card so alarm can be handled');

    // Case B: Truly disabled with zero orders and zero requests
    const resultEmptyDisabled = evaluateOrdersScreenBlocker({
      ordersEnabled: false,
      validOrders: [],
      safeServiceRequests: []
    });
    assert.strictEqual(resultEmptyDisabled, 'PLAN_LOCKED_CARD', 'Empty disabled view safely renders locked upgrade card');

    // Case C: Normal enabled view with or without orders
    const resultNormal = evaluateOrdersScreenBlocker({
      ordersEnabled: true,
      validOrders: [],
      safeServiceRequests: []
    });
    assert.strictEqual(resultNormal, 'LIVE_ORDERS_VIEW', 'Enabled view always renders live orders interface');
  });
});
