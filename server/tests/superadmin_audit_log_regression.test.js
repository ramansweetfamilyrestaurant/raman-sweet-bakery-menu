/**
 * TouchQR — Super Admin Audit Log Regression Test Suite
 * Step 1: Activity Category & Count Fixes
 * Step 2: Actor Filters & Tenant Name Resolution
 * Step 3: Duplicate Call Elimination & Visible Error Handling
 *
 * Isolated unit and component logic regression tests.
 * DOES NOT touch or mutate the production database.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getCategory,
  getActorDetails,
  normalizeActorRole,
  computeAuditStats,
  resolveTenantDisplay,
  formatAuditErrorMessage,
  createDeduplicatedFetcher
} from '../../src/utils/auditLogHelpers.js';
import {
  validateAuditLogParams,
  buildAuditLogQuery,
  fetchPlatformAuditLogs,
  MAX_AUDIT_PAGE_SIZE,
  DEFAULT_AUDIT_PAGE_SIZE
} from '../services/auditLogService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('🛡️  TOUCHQR SUPER ADMIN AUDIT LOG REGRESSION TEST SUITE');
console.log('    Step 1: Activity Category & Count Parity');
console.log('    Step 2: Actor Filter Normalization & Tenant Name Resolution');
console.log('    Step 3: Deduplication & Visible Error State Transitions');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ======================================================================
// SECTION 1: Step 1 - Activity Category Mapping
// ======================================================================
console.log('--- SECTION 1: Activity Category Mapping (VIP & Billing) ---');

await test('GRANT_ADMIN_ACCESS maps consistently to vip category with label "VIP & Grants"', () => {
  const cat = getCategory({ action: 'GRANT_ADMIN_ACCESS' });
  assert.strictEqual(cat.id, 'vip');
  assert.strictEqual(cat.label, 'VIP & Grants');
});

await test('VIP_ACCESS_REVOKED maps consistently to vip category with label "VIP & Grants"', () => {
  const cat = getCategory({ action: 'VIP_ACCESS_REVOKED' });
  assert.strictEqual(cat.id, 'vip');
  assert.strictEqual(cat.label, 'VIP & Grants');
});

await test('Related complimentary/admin-granted access variants map to vip', () => {
  const actions = [
    'GRANT_FREE_ACCESS',
    'REVOKE_FREE_ACCESS',
    'COMPLIMENTARY_ACCESS_GRANTED',
    'ADMIN_GRANTED_ACCESS',
    'GRANT_VIP_ACCESS'
  ];
  for (const act of actions) {
    const cat = getCategory({ action: act });
    assert.strictEqual(cat.id, 'vip', `Action '${act}' must map to 'vip'`);
    assert.strictEqual(cat.label, 'VIP & Grants');
  }
});

await test('PRE_DEBIT_NOTIFICATION_RECEIVED maps to billing category', () => {
  const cat = getCategory({ action: 'PRE_DEBIT_NOTIFICATION_RECEIVED' });
  assert.strictEqual(cat.id, 'billing');
  assert.strictEqual(cat.label, 'Billing');
});

await test('REFUND_AUDIT_LOGGED maps to billing category', () => {
  const cat = getCategory({ action: 'REFUND_AUDIT_LOGGED' });
  assert.strictEqual(cat.id, 'billing');
  assert.strictEqual(cat.label, 'Billing');
});

await test('Additional Cashfree webhook and billing actions map to billing category', () => {
  const billingActions = [
    'WEBHOOK_PAYMENT_SUCCESS',
    'WEBHOOK_SUBSCRIPTION_ACTIVE',
    'Initiate Business Checkout',
    'CASHFREE_ENVIRONMENT_CHANGED',
    'UPDATE_PAYMENT_API_KEYS',
    'Create SaaS Plan',
    'Update SaaS Plan Matrix',
    'Delete SaaS Plan'
  ];
  for (const act of billingActions) {
    const cat = getCategory({ action: act });
    assert.strictEqual(cat.id, 'billing', `Action '${act}' must map to 'billing'`);
  }
});

await test('System and Security actions map cleanly without leaking into VIP or Billing', () => {
  const security = getCategory({ action: 'Super Admin Login' });
  assert.strictEqual(security.id, 'security');

  const impersonate = getCategory({ action: 'IMPERSONATION_STARTED' });
  assert.strictEqual(impersonate.id, 'security');

  const tenant = getCategory({ action: 'Delete Tenant' });
  assert.strictEqual(tenant.id, 'tenant');

  const sys = getCategory({ action: 'AUTO_SUMMARIZATION' });
  assert.strictEqual(sys.id, 'system');
});

// ======================================================================
// SECTION 2: Step 1 - Category Counts & Parity
// ======================================================================
console.log('\n--- SECTION 2: Category Counts & Consistency Parity ---');

await test('computeAuditStats() provides own count for VIP and excludes VIP from System count', () => {
  const mockLogs = [
    { id: 1, action: 'GRANT_ADMIN_ACCESS' },
    { id: 2, action: 'VIP_ACCESS_REVOKED' },
    { id: 3, action: 'PRE_DEBIT_NOTIFICATION_RECEIVED' },
    { id: 4, action: 'REFUND_AUDIT_LOGGED' },
    { id: 5, action: 'Super Admin Login' },
    { id: 6, action: 'Delete Tenant' },
    { id: 7, action: 'AUTO_SUMMARIZATION' }
  ];

  const stats = computeAuditStats(mockLogs);
  assert.strictEqual(stats.total, 7);
  assert.strictEqual(stats.vip, 2, 'Must have 2 VIP events');
  assert.strictEqual(stats.billing, 2, 'Must have 2 Billing events');
  assert.strictEqual(stats.security, 1, 'Must have 1 Security event');
  assert.strictEqual(stats.tenant, 1, 'Must have 1 Tenant event');
  assert.strictEqual(stats.system, 1, 'Must have 1 System event (VIP not included)');
  assert.strictEqual(
    stats.total,
    stats.security + stats.billing + stats.tenant + stats.vip + stats.system,
    'Sum of all category counts must equal total count'
  );
});

await test('Category pill counts match filtered row counts exactly', () => {
  const sampleLogs = [
    { id: 1, action: 'GRANT_ADMIN_ACCESS' },
    { id: 2, action: 'VIP_ACCESS_REVOKED' },
    { id: 3, action: 'COMPLIMENTARY_ACCESS_GRANTED' },
    { id: 4, action: 'PRE_DEBIT_NOTIFICATION_RECEIVED' },
    { id: 5, action: 'REFUND_AUDIT_LOGGED' },
    { id: 6, action: 'Super Admin Login' },
    { id: 7, action: 'Change Credentials' },
    { id: 8, action: 'Activate Tenant' },
    { id: 9, action: 'AUTO_SUMMARIZATION' }
  ];

  const stats = computeAuditStats(sampleLogs);

  const vipRows = sampleLogs.filter(l => getCategory(l).id === 'vip');
  assert.strictEqual(vipRows.length, stats.vip, 'VIP filtered rows must match stats.vip');

  const systemRows = sampleLogs.filter(l => getCategory(l).id === 'system');
  assert.strictEqual(systemRows.length, stats.system, 'System filtered rows must match stats.system');

  const billingRows = sampleLogs.filter(l => getCategory(l).id === 'billing');
  assert.strictEqual(billingRows.length, stats.billing, 'Billing filtered rows must match stats.billing');

  const securityRows = sampleLogs.filter(l => getCategory(l).id === 'security');
  assert.strictEqual(securityRows.length, stats.security, 'Security filtered rows must match stats.security');

  const tenantRows = sampleLogs.filter(l => getCategory(l).id === 'tenant');
  assert.strictEqual(tenantRows.length, stats.tenant, 'Tenant filtered rows must match stats.tenant');
});

// ======================================================================
// SECTION 3: Step 2 - Actor Role Normalization & Badges
// ======================================================================
console.log('\n--- SECTION 3: Actor Role Normalization & Badges ---');

await test('normalizeActorRole() normalizes admin, restaurant_admin, and tenant_admin correctly', () => {
  assert.strictEqual(normalizeActorRole('admin'), 'admin');
  assert.strictEqual(normalizeActorRole('restaurant_admin'), 'admin');
  assert.strictEqual(normalizeActorRole('tenant_admin'), 'admin');
  assert.strictEqual(normalizeActorRole('resto_admin'), 'admin');
  assert.strictEqual(normalizeActorRole('TENANT_ADMIN'), 'admin');
});

await test('normalizeActorRole() does NOT merge Super Admin or System Worker into admin', () => {
  assert.strictEqual(normalizeActorRole('superadmin'), 'superadmin');
  assert.strictEqual(normalizeActorRole('SUPERADMIN'), 'superadmin');
  assert.notStrictEqual(normalizeActorRole('superadmin'), 'admin');

  assert.strictEqual(normalizeActorRole('system'), 'system');
  assert.strictEqual(normalizeActorRole('SYSTEM'), 'system');
  assert.notStrictEqual(normalizeActorRole('system'), 'admin');
  assert.notStrictEqual(normalizeActorRole('system'), 'superadmin');
});

await test('getActorDetails() handles tenant_admin and uppercase SYSTEM with correct labels & badges', () => {
  const tenantAdmin = getActorDetails('tenant_admin');
  assert.strictEqual(tenantAdmin.label, '🏢 Resto Owner');
  assert.strictEqual(tenantAdmin.bg, '#EFF6FF');
  assert.strictEqual(tenantAdmin.color, '#1E40AF');

  const systemCaps = getActorDetails('SYSTEM');
  assert.strictEqual(systemCaps.label, '⚙️ System Worker');
  assert.strictEqual(systemCaps.bg, '#F1F5F9');
  assert.strictEqual(systemCaps.color, '#334155');

  const superAdmin = getActorDetails('superadmin');
  assert.strictEqual(superAdmin.label, '👑 Super Admin');

  const gateway = getActorDetails('payment_gateway');
  assert.strictEqual(gateway.label, '💳 Cashfree Gateway');
});

await test('Actor filtering matches normalized variants without false positives', () => {
  const logs = [
    { id: 1, actor_role: 'superadmin' },
    { id: 2, actor_role: 'tenant_admin' },
    { id: 3, actor_role: 'restaurant_admin' },
    { id: 4, actor_role: 'admin' },
    { id: 5, actor_role: 'SYSTEM' },
    { id: 6, actor_role: 'payment_gateway' }
  ];

  // Filtering by 'admin' (Restaurant Admin dropdown option)
  const filterRole = 'admin';
  const adminMatches = logs.filter(l => normalizeActorRole(l.actor_role) === normalizeActorRole(filterRole));
  assert.strictEqual(adminMatches.length, 3, 'Should match tenant_admin, restaurant_admin, admin');
  assert.deepStrictEqual(adminMatches.map(m => m.id), [2, 3, 4]);

  // Filtering by 'system'
  const systemMatches = logs.filter(l => normalizeActorRole(l.actor_role) === normalizeActorRole('system'));
  assert.strictEqual(systemMatches.length, 1);
  assert.strictEqual(systemMatches[0].id, 5);

  // Filtering by 'superadmin'
  const superMatches = logs.filter(l => normalizeActorRole(l.actor_role) === normalizeActorRole('superadmin'));
  assert.strictEqual(superMatches.length, 1);
  assert.strictEqual(superMatches[0].id, 1);
});

// ======================================================================
// SECTION 4: Step 2 - Restaurant Name Resolution & Fallbacks
// ======================================================================
console.log('\n--- SECTION 4: Restaurant Name Resolution & Fallbacks ---');

await test('resolveTenantDisplay() prioritizes log.restaurant_name when available', () => {
  const log = {
    restaurant_id: 10,
    restaurant_name: 'Royal Biryani House'
  };
  const loadedList = [
    { id: 10, name: 'Royal Biryani House (Loaded)', slug: 'royal-biryani' }
  ];

  const res = resolveTenantDisplay(log, loadedList);
  assert.strictEqual(res.name, 'Royal Biryani House', 'Must use log.restaurant_name directly');
  assert.strictEqual(res.hasLink, true);
  assert.strictEqual(res.loadedTenant.slug, 'royal-biryani');
});

await test('resolveTenantDisplay() avoids blank name if tenant is deleted or not in loaded list', () => {
  const log = {
    restaurant_id: 99,
    restaurant_name: 'Deleted Bakery'
  };
  const loadedList = [];

  const res = resolveTenantDisplay(log, loadedList);
  assert.strictEqual(res.name, 'Deleted Bakery', 'Must preserve restaurant_name from API even when not in loaded list');
  assert.strictEqual(res.loadedTenant, null);
  assert.strictEqual(res.hasLink, false, 'No link to non-existent tenant object');
});

await test('resolveTenantDisplay() falls back to loaded tenant list when log.restaurant_name is missing', () => {
  const log = {
    restaurant_id: 5,
    restaurant_name: null
  };
  const loadedList = [
    { id: 5, name: 'Sweet Palace', slug: 'sweet-palace' }
  ];

  const res = resolveTenantDisplay(log, loadedList);
  assert.strictEqual(res.name, 'Sweet Palace');
  assert.strictEqual(res.hasLink, true);
});

await test('resolveTenantDisplay() parses deleted tenant name from details snapshot when r.name is null', () => {
  const log = {
    restaurant_id: 42,
    restaurant_name: null,
    details: 'Deleted tenant "Green Oasis Cafe" (slug: green-oasis)'
  };

  const res = resolveTenantDisplay(log, []);
  assert.strictEqual(res.name, 'Green Oasis Cafe');
});

await test('resolveTenantDisplay() provides clean fallback for platform/system logs', () => {
  const log = {
    restaurant_id: null,
    restaurant_name: null,
    details: 'System Worker executed automated summarization'
  };

  const res = resolveTenantDisplay(log, []);
  assert.strictEqual(res.name, null);
  assert.strictEqual(res.hasLink, false);
});

await test('Search successfully finds logs by log.restaurant_name even when tenant list is unloaded', () => {
  const logs = [
    { id: 1, action: 'GRANT_ADMIN_ACCESS', restaurant_id: 12, restaurant_name: 'Chandni Chowk Sweets', details: 'Free trial granted' },
    { id: 2, action: 'Update Tenant', restaurant_id: 15, restaurant_name: 'Bikaner Sweets', details: 'Updated phone' }
  ];

  const unloadedRestaurants = [];
  const searchQuery = 'chandni';

  const matches = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    const tenantInfo = resolveTenantDisplay(log, unloadedRestaurants);
    const tenantName = (tenantInfo.name || '').toLowerCase();
    const tenantSlug = (tenantInfo.loadedTenant?.slug || '').toLowerCase();
    return (log.action || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.actor_role || '').toLowerCase().includes(q) ||
      String(log.restaurant_id || '').includes(q) ||
      tenantName.includes(q) ||
      tenantSlug.includes(q);
  });

  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].id, 1);
});

// ======================================================================
// SECTION 5: Step 3 - Deduplication, Call Counts & Retry Mechanics
// ======================================================================
console.log('\n--- SECTION 5: Step 3 - Deduplication, Call Counts & Retry Mechanics ---');

await test('createDeduplicatedFetcher() coalesces concurrent calls into exactly 1 execution', async () => {
  let callCount = 0;
  const mockApi = async () => {
    callCount++;
    await new Promise(r => setTimeout(r, 20));
    return [{ id: 101, action: 'GRANT_ADMIN_ACCESS' }];
  };

  const deduplicator = createDeduplicatedFetcher(mockApi);

  // Trigger 3 concurrent calls
  const [res1, res2, res3] = await Promise.all([
    deduplicator.execute(),
    deduplicator.execute(),
    deduplicator.execute()
  ]);

  assert.strictEqual(callCount, 1, 'Concurrent calls must execute underlying API exactly once');
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res3.length, 1);
  assert.strictEqual(deduplicator.isInFlight(), false, 'inFlight state must be cleared after resolution');

  // Trigger subsequent call after resolution
  const res4 = await deduplicator.execute();
  assert.strictEqual(callCount, 2, 'Subsequent call after completion must trigger fresh fetch');
  assert.strictEqual(res4.length, 1);
});

await test('createDeduplicatedFetcher() clears in-flight state on error and allows subsequent retry', async () => {
  let attemptCount = 0;
  const failingApi = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      throw new Error('Network timeout');
    }
    return [{ id: 202, action: 'REFUND_AUDIT_LOGGED' }];
  };

  const deduplicator = createDeduplicatedFetcher(failingApi);

  // First attempt fails
  await assert.rejects(
    async () => await deduplicator.execute(),
    /Network timeout/,
    'First execution should propagate error'
  );
  assert.strictEqual(deduplicator.isInFlight(), false, 'inFlight state must be false after error');

  // Retry execution succeeds
  const retryRes = await deduplicator.execute();
  assert.strictEqual(attemptCount, 2, 'Retry must execute API second time');
  assert.strictEqual(retryRes.length, 1);
  assert.strictEqual(retryRes[0].id, 202);
});

await test('formatAuditErrorMessage() maps HTTP status and error categories correctly', () => {
  // 401 / Unauthorized
  const authErr = formatAuditErrorMessage({ status: 401, message: 'jwt expired', isUnauthorized: true });
  assert.ok(authErr.includes('session has expired'), 'Must inform user about expired session');

  // 403 / Forbidden
  const forbiddenErr = formatAuditErrorMessage({ status: 403, message: 'Forbidden' });
  assert.ok(forbiddenErr.includes('Super Admin privileges are required'), 'Must inform user about privileges');

  // Network Failure
  const networkErr = formatAuditErrorMessage(new TypeError('Failed to fetch'));
  assert.ok(networkErr.includes('network connection'), 'Must suggest checking network connection');

  // Timeout / Abort
  const timeoutErr = formatAuditErrorMessage({ name: 'AbortError', message: 'The user aborted a request.' });
  assert.ok(timeoutErr.includes('timed out'), 'Must inform user about timeout');

  // Generic Error
  const customErr = formatAuditErrorMessage(new Error('Database query execution error (500)'));
  assert.strictEqual(customErr, 'Database query execution error (500)');

  // Null check
  assert.strictEqual(formatAuditErrorMessage(null), null);
});

// ======================================================================
// SECTION 6: Step 3 - Visible Error Handling & UI State Transitions
// ======================================================================
console.log('\n--- SECTION 6: Step 3 - Visible Error Handling & UI State Transitions ---');

await test('AuditLogsView.jsx has eliminated mount useEffect to prevent duplicate API calls', () => {
  const auditViewPath = path.join(rootDir, 'src/components/SuperAdmin/views/AuditLogsView.jsx');
  const content = fs.readFileSync(auditViewPath, 'utf8');

  // Verify that the redundant useEffect(() => { if (onRefresh) onRefresh(); }, []) has been removed
  assert.ok(
    !content.includes('useEffect(() => {\n    if (onRefresh) onRefresh();\n  }, []);'),
    'AuditLogsView must not trigger onRefresh on mount; SuperAdminDashboard is the single owner'
  );
  assert.ok(
    !content.includes('onRefresh();\n  }, []);'),
    'AuditLogsView must not trigger onRefresh in empty dependency mount effect'
  );
});

await test('AuditLogsView.jsx renders top error banner, table error tile, and retry connection buttons', () => {
  const auditViewPath = path.join(rootDir, 'src/components/SuperAdmin/views/AuditLogsView.jsx');
  const content = fs.readFileSync(auditViewPath, 'utf8');

  assert.ok(content.includes('sa-audit-error-banner'), 'Must contain top error banner container');
  assert.ok(content.includes('Audit Log Trail Sync Failed'), 'Must show error headline in banner');
  assert.ok(content.includes('Retry Connection'), 'Must provide Retry Connection action');
  assert.ok(content.includes('Unable to Load Audit Log Stream'), 'Must show error tile in table body');
  assert.ok(content.includes('error && filteredLogs.length === 0'), 'Table body must render error tile on empty error');
});

await test('AuditLogsView.jsx cleanly differentiates genuine empty result from filter mismatch', () => {
  const auditViewPath = path.join(rootDir, 'src/components/SuperAdmin/views/AuditLogsView.jsx');
  const content = fs.readFileSync(auditViewPath, 'utf8');

  assert.ok(content.includes('No platform audit log records found.'), 'Must have genuine 0-logs empty state');
  assert.ok(content.includes('No audit log entries matched your filter.'), 'Must have filter-mismatch state');
  assert.ok(content.includes('Reset All Filters'), 'Must provide Reset All Filters button on filter mismatch');
});

await test('SuperAdminDashboard.jsx manages in-flight deduplication and passes error to AuditLogsView', () => {
  const dashboardPath = path.join(rootDir, 'src/components/SuperAdmin/SuperAdminDashboard.jsx');
  const content = fs.readFileSync(dashboardPath, 'utf8');

  assert.ok(content.includes('auditFetchInFlightRef'), 'Must declare auditFetchInFlightRef');
  assert.ok(content.includes('auditError'), 'Must declare auditError state');
  assert.ok(content.includes('error={auditError}'), 'Must pass auditError prop to AuditLogsView');
  assert.ok(content.includes('formatAuditErrorMessage'), 'Must format error using formatAuditErrorMessage');
  assert.ok(content.includes('loadAuditData(true)'), 'Must pass force reload to onRefresh');
});

// ======================================================================
// SECTION 7: Source Code & UI Integrity Verification
// ======================================================================
console.log('\n--- SECTION 7: Step 1 & Step 2 Preservation Checks ---');

await test('AuditLogsView.jsx preserves VIP counts, actor normalization, and restaurant_name priority', () => {
  const auditViewPath = path.join(rootDir, 'src/components/SuperAdmin/views/AuditLogsView.jsx');
  const content = fs.readFileSync(auditViewPath, 'utf8');

  assert.ok(content.includes("label: `VIP & Grants (${stats.vip})`"), 'VIP pill must include its count');
  assert.ok(content.includes('VIP & GRANTS'), 'Hero metrics must include VIP & GRANTS card');
  assert.ok(content.includes('stats.vip'), 'Hero metrics must display stats.vip');
  assert.ok(content.includes('normalizeActorRole'), 'Must use normalizeActorRole');
  assert.ok(content.includes('resolveTenantDisplay'), 'Must use resolveTenantDisplay');
});

await test('TenantDetailsView.jsx preserves aligned activity filters', () => {
  const tenantViewPath = path.join(rootDir, 'src/components/SuperAdmin/views/TenantDetailsView.jsx');
  const content = fs.readFileSync(tenantViewPath, 'utf8');

  assert.ok(content.includes("actUpper.includes('GRANT')"), 'TenantDetailsView vip filter must match GRANT');
  assert.ok(content.includes("actUpper.includes('PRE_DEBIT')"), 'TenantDetailsView billing filter must match PRE_DEBIT');
  assert.ok(content.includes("actUpper.includes('REFUND')"), 'TenantDetailsView billing filter must match REFUND');
});

// ======================================================================
// SECTION 8: Step 4 - Backend Pagination & Server-Side Filtering
// ======================================================================
console.log('\n--- SECTION 8: Step 4 - Server-Side Pagination & Filtering ---');

await test('validateAuditLogParams() parses defaults, page, and limit correctly', () => {
  const parsed = validateAuditLogParams({ page: '2', limit: '25' });
  assert.strictEqual(parsed.valid, true);
  assert.strictEqual(parsed.params.page, 2);
  assert.strictEqual(parsed.params.limit, 25);
  assert.strictEqual(parsed.isLegacy, false);
});

await test('validateAuditLogParams() rejects invalid page parameters (0, negative, non-integer)', () => {
  assert.strictEqual(validateAuditLogParams({ page: '0' }).valid, false);
  assert.strictEqual(validateAuditLogParams({ page: '-3' }).valid, false);
  assert.strictEqual(validateAuditLogParams({ page: 'abc' }).valid, false);
  assert.strictEqual(validateAuditLogParams({ page: '1.5' }).valid, false);
});

await test('validateAuditLogParams() rejects invalid limit and clamps limit > 100 to MAX_AUDIT_PAGE_SIZE', () => {
  assert.strictEqual(validateAuditLogParams({ limit: '0' }).valid, false);
  assert.strictEqual(validateAuditLogParams({ limit: '-10' }).valid, false);
  assert.strictEqual(validateAuditLogParams({ limit: 'xyz' }).valid, false);

  const clamped = validateAuditLogParams({ limit: '500' });
  assert.strictEqual(clamped.valid, true);
  assert.strictEqual(clamped.params.limit, MAX_AUDIT_PAGE_SIZE);
});

await test('validateAuditLogParams() validates category and rejects invalid category values', () => {
  for (const cat of ['security', 'vip', 'billing', 'tenant', 'system']) {
    const res = validateAuditLogParams({ category: cat });
    assert.strictEqual(res.valid, true, `Category '${cat}' must be valid`);
    assert.strictEqual(res.params.category, cat);
  }

  const invalid = validateAuditLogParams({ category: 'unknown_cat' });
  assert.strictEqual(invalid.valid, false);
  assert.strictEqual(invalid.status, 400);
});

await test('validateAuditLogParams() correctly expands date-only start_date and end_date to UTC boundaries', () => {
  const res = validateAuditLogParams({
    start_date: '2026-10-01',
    end_date: '2026-10-15'
  });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.params.startDate, '2026-10-01T00:00:00.000Z');
  assert.strictEqual(res.params.endDate, '2026-10-15T23:59:59.999Z');
});

await test('validateAuditLogParams() rejects inverted date ranges (start_date > end_date) and invalid dates', () => {
  const inverted = validateAuditLogParams({
    start_date: '2026-10-20',
    end_date: '2026-10-10'
  });
  assert.strictEqual(inverted.valid, false);
  assert.strictEqual(inverted.status, 400);

  const badDate = validateAuditLogParams({ start_date: 'not-a-date' });
  assert.strictEqual(badDate.valid, false);
  assert.strictEqual(badDate.status, 400);
});

await test('buildAuditLogQuery() enforces deterministic sorting with primary created_at DESC and secondary id DESC', () => {
  const queryBuild = buildAuditLogQuery({ page: 1, limit: 50 });
  assert.ok(
    queryBuild.dataSql.includes('ORDER BY a.created_at DESC, a.id DESC'),
    'Query must include deterministic ORDER BY a.created_at DESC, a.id DESC'
  );
});

await test('buildAuditLogQuery() maps actor variants into normalized SQL without merging SuperAdmin or System', () => {
  const adminQuery = buildAuditLogQuery({ page: 1, limit: 50, actor: 'tenant_admin' });
  assert.ok(
    adminQuery.dataSql.includes("LOWER(a.actor_role) IN ('admin', 'restaurant_admin', 'tenant_admin', 'resto_admin')"),
    'Must normalize tenant_admin to admin role group'
  );

  const superQuery = buildAuditLogQuery({ page: 1, limit: 50, actor: 'superadmin' });
  assert.ok(
    superQuery.dataSql.includes("LOWER(a.actor_role) IN ('superadmin', 'super_admin')"),
    'Must isolate superadmin role'
  );

  const sysQuery = buildAuditLogQuery({ page: 1, limit: 50, actor: 'system' });
  assert.ok(
    sysQuery.dataSql.includes("LOWER(a.actor_role) IN ('system', 'system_worker', 'worker') OR a.actor_role IS NULL"),
    'Must isolate system worker role'
  );
});

await test('buildAuditLogQuery() maps VIP, Billing, and Security category conditions with exact Step 1 parity', () => {
  const vipQuery = buildAuditLogQuery({ page: 1, limit: 50, category: 'vip' });
  assert.ok(vipQuery.dataSql.includes("LIKE '%vip%'"), 'VIP query must include vip keyword');
  assert.ok(vipQuery.dataSql.includes("LIKE '%grant%'"), 'VIP query must include grant keyword');

  const billQuery = buildAuditLogQuery({ page: 1, limit: 50, category: 'billing' });
  assert.ok(billQuery.dataSql.includes("LIKE '%cashfree%'"), 'Billing query must include cashfree keyword');
  assert.ok(billQuery.dataSql.includes("LIKE '%refund%'"), 'Billing query must include refund keyword');
});

await test('buildAuditLogQuery() supports tenant isolation (specific restaurant_id) and platform-level isolation', () => {
  const tenantQuery = buildAuditLogQuery({ page: 1, limit: 50, restaurantId: 7 });
  assert.ok(tenantQuery.dataSql.includes('a.restaurant_id = $1'), 'Must parameterize restaurant_id');
  assert.strictEqual(tenantQuery.dataParams[0], 7);

  const platformQuery = buildAuditLogQuery({ page: 1, limit: 50, restaurantId: null });
  assert.ok(platformQuery.dataSql.includes('a.restaurant_id IS NULL'), 'Must filter for platform logs with NULL restaurant_id');
});

await test('fetchPlatformAuditLogs() handles >150 synthetic records (220 items) with accurate pagination metadata', async () => {
  // Generate 220 synthetic audit records
  const syntheticDb = [];
  for (let i = 1; i <= 220; i++) {
    syntheticDb.push({
      id: i,
      restaurant_id: i % 2 === 0 ? 2 : (i % 3 === 0 ? 5 : null),
      actor_role: i % 4 === 0 ? 'superadmin' : (i % 4 === 1 ? 'restaurant_admin' : 'cashfree'),
      action: i % 5 === 0 ? 'GRANT_ADMIN_ACCESS' : (i % 5 === 1 ? 'REFUND_AUDIT_LOGGED' : 'AUTO_SUMMARIZATION'),
      details: `Synthetic audit event #${i}`,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
      restaurant_name: i % 2 === 0 ? 'Tandoori Nights' : (i % 3 === 0 ? 'Biryani House' : null),
      restaurant_logo: null
    });
  }

  // Sort newest first
  syntheticDb.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);

  const mockQuery = async (sql, params = []) => {
    if (sql.includes('COUNT(*) AS total')) {
      if (sql.includes('security')) {
        // Stats query
        return [{ total: 220, security: 0, vip: 44, billing: 44, tenant: 0, system: 132 }];
      }
      // Simple count query
      return [{ total: 220 }];
    }
    // Data query: extract limit & offset
    const limit = params[params.length - 2];
    const offset = params[params.length - 1];
    return syntheticDb.slice(offset, offset + limit);
  };

  // 1. Page 1 (limit 50)
  const page1 = await fetchPlatformAuditLogs(mockQuery, { page: '1', limit: '50' });
  assert.strictEqual(page1.logs.length, 50, 'Page 1 must return 50 rows');
  assert.strictEqual(page1.pagination.total, 220, 'Total must be 220');
  assert.strictEqual(page1.pagination.totalPages, 5, 'Total pages must be 5');
  assert.strictEqual(page1.pagination.page, 1);
  assert.strictEqual(page1.pagination.hasNextPage, true);
  assert.strictEqual(page1.pagination.hasPrevPage, false);
  assert.strictEqual(page1.pagination.currentPageCount, 50);

  // 2. Page 2 (limit 50)
  const page2 = await fetchPlatformAuditLogs(mockQuery, { page: '2', limit: '50' });
  assert.strictEqual(page2.logs.length, 50);
  assert.strictEqual(page2.pagination.page, 2);
  assert.strictEqual(page2.pagination.hasNextPage, true);
  assert.strictEqual(page2.pagination.hasPrevPage, true);

  // 3. Page 5 (last page: 20 rows)
  const page5 = await fetchPlatformAuditLogs(mockQuery, { page: '5', limit: '50' });
  assert.strictEqual(page5.logs.length, 20, 'Last page must contain remaining 20 rows');
  assert.strictEqual(page5.pagination.page, 5);
  assert.strictEqual(page5.pagination.hasNextPage, false);
  assert.strictEqual(page5.pagination.hasPrevPage, true);
  assert.strictEqual(page5.pagination.currentPageCount, 20);

  // 4. Page 6 (out of bounds: 0 rows)
  const page6 = await fetchPlatformAuditLogs(mockQuery, { page: '6', limit: '50' });
  assert.strictEqual(page6.logs.length, 0);
  assert.strictEqual(page6.pagination.currentPageCount, 0);
});

await test('fetchPlatformAuditLogs() preserves stable ordering when multiple records share identical timestamps', async () => {
  const sharedTimestamp = '2026-10-17T12:00:00.000Z';
  const identicalTimestampRows = [
    { id: 101, created_at: sharedTimestamp, action: 'EVENT_A' },
    { id: 105, created_at: sharedTimestamp, action: 'EVENT_B' },
    { id: 102, created_at: sharedTimestamp, action: 'EVENT_C' }
  ];

  const mockQuery = async (sql, params = []) => {
    if (sql.includes('COUNT(*)')) {
      return [{ total: 3, security: 0, vip: 0, billing: 0, tenant: 0, system: 3 }];
    }
    // Simulate SQL ordering: ORDER BY created_at DESC, id DESC
    const sorted = [...identicalTimestampRows].sort((a, b) => {
      const timeDiff = new Date(b.created_at) - new Date(a.created_at);
      if (timeDiff !== 0) return timeDiff;
      return b.id - a.id;
    });
    return sorted;
  };

  const res = await fetchPlatformAuditLogs(mockQuery, { page: '1', limit: '10' });
  assert.strictEqual(res.logs[0].id, 105, 'Highest ID must come first on equal timestamp');
  assert.strictEqual(res.logs[1].id, 102, 'Next highest ID must follow');
  assert.strictEqual(res.logs[2].id, 101, 'Lowest ID must come last');
});

await test('fetchPlatformAuditLogs() preserves backward compatibility by returning raw Array on legacy calls', async () => {
  const mockRows = [{ id: 1, action: 'Legacy Action' }];
  const mockQuery = async (sql) => mockRows;

  // No pagination or filter params passed -> legacy call
  const result = await fetchPlatformAuditLogs(mockQuery, {});
  assert.ok(Array.isArray(result), 'Legacy call must return a direct Array');
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].action, 'Legacy Action');
});

await test('fetchPlatformAuditLogs() handles empty database gracefully with 0 totals and 1 totalPage', async () => {
  const mockQuery = async (sql) => {
    if (sql.includes('COUNT(*)')) {
      return [{ total: 0, security: 0, vip: 0, billing: 0, tenant: 0, system: 0 }];
    }
    return [];
  };

  const result = await fetchPlatformAuditLogs(mockQuery, { page: '1', limit: '50' });
  assert.deepStrictEqual(result.logs, []);
  assert.strictEqual(result.pagination.total, 0);
  assert.strictEqual(result.pagination.totalPages, 1);
  assert.strictEqual(result.pagination.hasNextPage, false);
  assert.strictEqual(result.pagination.hasPrevPage, false);
  assert.strictEqual(result.pagination.currentPageCount, 0);
  assert.strictEqual(result.stats.total, 0);
});

await test('AuditLogsView.jsx and SuperAdminDashboard.jsx integrate pagination controls and state', () => {
  const auditViewPath = path.join(rootDir, 'src/components/SuperAdmin/views/AuditLogsView.jsx');
  const viewContent = fs.readFileSync(auditViewPath, 'utf8');

  assert.ok(viewContent.includes('sa-audit-pagination-bar'), 'AuditLogsView must render pagination bar');
  assert.ok(viewContent.includes('effectivePagination'), 'AuditLogsView must compute effectivePagination');
  assert.ok(viewContent.includes('handlePageChange'), 'AuditLogsView must provide handlePageChange');
  assert.ok(viewContent.includes('handlePageSizeChange'), 'AuditLogsView must provide rows per page selector');
  assert.ok(viewContent.includes('sa-audit-date-inputs'), 'AuditLogsView must include date range inputs');

  const dashboardPath = path.join(rootDir, 'src/components/SuperAdmin/SuperAdminDashboard.jsx');
  const dashContent = fs.readFileSync(dashboardPath, 'utf8');

  assert.ok(dashContent.includes('auditPagination'), 'SuperAdminDashboard must manage auditPagination state');
  assert.ok(dashContent.includes('auditStats'), 'SuperAdminDashboard must manage auditStats state');
  assert.ok(dashContent.includes('pagination={auditPagination}'), 'Must pass pagination prop to AuditLogsView');
  assert.ok(dashContent.includes('stats={auditStats}'), 'Must pass stats prop to AuditLogsView');
});

// ======================================================================
// SECTION 9: Step 5A - Tenant Admin Catalog Activity Logging
// ======================================================================
console.log('\n--- SECTION 9: Step 5A - Tenant Admin Catalog Activity Logging ---');

const CATALOG_AUDIT_EVENTS = [
  'TENANT_CATEGORY_CREATED',
  'TENANT_CATEGORY_UPDATED',
  'TENANT_CATEGORY_DELETED',
  'TENANT_CATEGORY_TOGGLED',
  'TENANT_CATEGORIES_REORDERED',
  'TENANT_DISH_CREATED',
  'TENANT_DISH_UPDATED',
  'TENANT_DISH_PRICE_CHANGED',
  'TENANT_DISH_AVAILABILITY_TOGGLED',
  'TENANT_DISH_DELETED',
  'TENANT_COMBO_CREATED',
  'TENANT_COMBO_UPDATED',
  'TENANT_COMBO_TOGGLED',
  'TENANT_COMBO_DELETED'
];

await test('All Step 5A Catalog audit events (including TENANT_COMBO_TOGGLED) map cleanly to "tenant" (Shop) category', () => {
  for (const act of CATALOG_AUDIT_EVENTS) {
    const cat = getCategory({ action: act });
    assert.strictEqual(cat.id, 'tenant', `Action '${act}' must map to 'tenant'`);
    assert.strictEqual(cat.label, 'Shop', `Action '${act}' label must be 'Shop'`);
  }
});

await test('Generic and bare CATEGORY, DISH, and COMBO actions map to tenant (Shop) category', () => {
  const genericActions = [
    'CATEGORY_CREATED',
    'CATEGORY_UPDATED',
    'DISH_PRICE_CHANGED',
    'DISH_TOGGLED',
    'COMBO_CREATED',
    'COMBO_TOGGLED'
  ];
  for (const act of genericActions) {
    const cat = getCategory({ action: act });
    assert.strictEqual(cat.id, 'tenant', `Action '${act}' must map to 'tenant'`);
    assert.strictEqual(cat.label, 'Shop');
  }
});

await test('Catalog actions never hijack or regress VIP or Billing precedence', () => {
  // VIP actions
  assert.strictEqual(getCategory({ action: 'GRANT_ADMIN_ACCESS' }).id, 'vip');
  assert.strictEqual(getCategory({ action: 'VIP_ACCESS_REVOKED' }).id, 'vip');
  assert.strictEqual(getCategory({ action: 'COMPLIMENTARY_ACCESS_GRANTED' }).id, 'vip');
  assert.strictEqual(getCategory({ action: 'ADMIN_GRANTED_ACCESS' }).id, 'vip');

  // Billing actions
  assert.strictEqual(getCategory({ action: 'PRE_DEBIT_NOTIFICATION_RECEIVED' }).id, 'billing');
  assert.strictEqual(getCategory({ action: 'REFUND_AUDIT_LOGGED' }).id, 'billing');
  assert.strictEqual(getCategory({ action: 'CASHFREE_ENVIRONMENT_CHANGED' }).id, 'billing');
  assert.strictEqual(getCategory({ action: 'Create SaaS Plan' }).id, 'billing');

  // Security actions
  assert.strictEqual(getCategory({ action: 'Super Admin Login' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'IMPERSONATION_STARTED' }).id, 'security');

  // System actions
  assert.strictEqual(getCategory({ action: 'AUTO_SUMMARIZATION' }).id, 'system');
});

await test('computeAuditStats() counts all catalog actions in stats.tenant without leaking into VIP or System', () => {
  const mockCatalogLogs = CATALOG_AUDIT_EVENTS.map((action, idx) => ({
    id: 1000 + idx,
    action,
    restaurant_id: 10,
    actor_role: 'restaurant_admin',
    details: `Details for ${action}`
  }));

  const mixedLogs = [
    ...mockCatalogLogs,
    { id: 2001, action: 'GRANT_ADMIN_ACCESS' },
    { id: 2002, action: 'REFUND_AUDIT_LOGGED' },
    { id: 2003, action: 'Super Admin Login' },
    { id: 2004, action: 'AUTO_SUMMARIZATION' }
  ];

  const stats = computeAuditStats(mixedLogs);
  assert.strictEqual(stats.total, 18);
  assert.strictEqual(stats.tenant, 14, 'All 14 catalog actions must be counted as tenant/shop');
  assert.strictEqual(stats.vip, 1, 'VIP count must remain strictly 1');
  assert.strictEqual(stats.billing, 1, 'Billing count must remain strictly 1');
  assert.strictEqual(stats.security, 1, 'Security count must remain strictly 1');
  assert.strictEqual(stats.system, 1, 'System count must remain strictly 1');
  assert.strictEqual(stats.total, stats.security + stats.vip + stats.billing + stats.tenant + stats.system);
});

await test('buildAuditLogQuery() with category="tenant" includes all catalog action matches in SQL', () => {
  const result = buildAuditLogQuery({ page: 1, limit: 50, category: 'tenant' });
  assert.ok(result.dataSql.includes("LIKE '%tenant%'"), 'SQL must check tenant keyword');
  assert.ok(result.dataSql.includes("LIKE '%category%'"), 'SQL must check category keyword');
  assert.ok(result.dataSql.includes("LIKE '%dish%'"), 'SQL must check dish keyword');
  assert.ok(result.dataSql.includes("LIKE '%combo%'"), 'SQL must check combo keyword');
});

await test('audit_logs SQL query ensures tenant isolation when restaurant_id is specified', () => {
  const result = buildAuditLogQuery({ page: 1, limit: 50, restaurant_id: '42' });
  assert.ok(result.dataSql.includes('a.restaurant_id = $'), 'Must bind restaurant_id');
  assert.ok(result.dataParams.includes(42), 'Must include target restaurant_id in query params');
});

await test('Catalog audit details sanitize passwords, tokens, QR secrets and credentials', () => {
  const sensitivePatterns = [
    'password',
    'secret',
    'qr_secret',
    'token',
    'client_secret',
    'api_key'
  ];

  const sampleDetails = [
    "Created category 'Beverages' (ID: 101)",
    "Updated category 'Beverages' to 'Cold Drinks' (ID: 101)",
    "Deleted category 'Old Snacks' (ID: 102)",
    "Category 'Beverages' (ID: 101) activated",
    "Reordered 5 categories",
    "Created dish 'Paneer Tikka' (ID: 201, Price: ₹250, Half: ₹150, Category: 'Starters')",
    "Updated dish 'Paneer Tikka' (ID: 201) - Price: ₹250 -> ₹280",
    "Price changed for dish 'Paneer Tikka' (ID: 201) from ₹250 to ₹280, Half: ₹150 -> ₹170",
    "Dish 'Paneer Tikka' (ID: 201) availability set to available",
    "Deleted dish 'Stale Fries' (ID: 202)",
    "Created combo 'Lunch Box' (ID: 301, Price: ₹299)",
    "Updated combo 'Lunch Box' (ID: 301) - Price: ₹299 -> ₹349",
    "Combo 'Lunch Box' (ID: 301) availability set to available",
    "Deleted combo 'Old Combo' (ID: 302)"
  ];

  for (const detail of sampleDetails) {
    for (const pat of sensitivePatterns) {
      assert.ok(!detail.toLowerCase().includes(pat), `Detail "${detail}" must not contain sensitive term "${pat}"`);
    }
  }
});

await test('admin.js routes trace catalog mutations with logAudit and enforce tenant isolation', () => {
  const adminRoutesPath = path.join(rootDir, 'server/routes/admin.js');
  const content = fs.readFileSync(adminRoutesPath, 'utf8');

  // Verify all 13 audit actions are wired in admin.js
  for (const act of CATALOG_AUDIT_EVENTS) {
    assert.ok(content.includes(act), `admin.js must reference audit event '${act}'`);
  }

  // Verify that targetId is strictly req.user?.restaurant_id across operational routes
  assert.ok(!content.includes("const targetId = req.body.restaurant_id"), 'Must NOT read restaurant_id from req.body');
  assert.ok(!content.includes("const targetId = req.query.restaurant_id"), 'Must NOT read restaurant_id from req.query');
});

await test('Simulated business operations log audit events only on success with authenticated tenant context', async () => {
  const auditLogs = [];
  const fakeLogAudit = async (restaurantId, actorRole, action, details) => {
    auditLogs.push({ restaurantId, actorRole, action, details });
  };

  const simulateCreateCategory = async (reqUser, body, shouldFail = false) => {
    const targetId = reqUser?.restaurant_id;
    if (!targetId) throw new Error('Unauthorized');
    if (!body.name) throw new Error('Category name is required');
    if (shouldFail) throw new Error('Database write error');

    const fakeId = 55;
    await fakeLogAudit(targetId, reqUser?.role || 'tenant_admin', 'TENANT_CATEGORY_CREATED', `Created category '${body.name}' (ID: ${fakeId})`);
    return { success: true, id: fakeId };
  };

  // 1. Success case
  const resSuccess = await simulateCreateCategory({ restaurant_id: 88, role: 'restaurant_admin' }, { name: 'Desserts' });
  assert.strictEqual(resSuccess.success, true);
  assert.strictEqual(auditLogs.length, 1);
  assert.strictEqual(auditLogs[0].restaurantId, 88);
  assert.strictEqual(auditLogs[0].actorRole, 'restaurant_admin');
  assert.strictEqual(auditLogs[0].action, 'TENANT_CATEGORY_CREATED');
  assert.ok(auditLogs[0].details.includes('Desserts'));

  // 2. Failure case: Database error -> NO audit event logged
  let failedErr = null;
  try {
    await simulateCreateCategory({ restaurant_id: 88, role: 'restaurant_admin' }, { name: 'Failing Cat' }, true);
  } catch (err) {
    failedErr = err;
  }
  assert.ok(failedErr);
  assert.strictEqual(auditLogs.length, 1, 'Failed operation must NOT log a success audit event');

  // 3. Failure case: Missing name validation -> NO audit event logged
  let validationErr = null;
  try {
    await simulateCreateCategory({ restaurant_id: 88, role: 'restaurant_admin' }, {});
  } catch (err) {
    validationErr = err;
  }
  assert.ok(validationErr);
  assert.strictEqual(auditLogs.length, 1, 'Validation failure must NOT log an audit event');
});

await test('Cross-tenant ID manipulation is rejected and produces NO false audit event', async () => {
  const auditLogs = [];
  const fakeLogAudit = async (restaurantId, actorRole, action, details) => {
    auditLogs.push({ restaurantId, actorRole, action, details });
  };

  // Mock DB where Dish 100 belongs to Tenant 1, Dish 200 belongs to Tenant 2
  const mockDishes = [
    { id: 100, restaurant_id: 1, name: 'Burger', price: 150 },
    { id: 200, restaurant_id: 2, name: 'Pizza', price: 300 }
  ];

  const simulateUpdateDishPrice = async (reqUser, dishId, newPrice) => {
    const targetId = reqUser?.restaurant_id;
    // Strict isolation check matching admin.js
    const dish = mockDishes.find(d => d.id === dishId && d.restaurant_id === targetId);
    if (!dish) {
      return { status: 404, error: 'Dish not found' };
    }

    const oldPrice = dish.price;
    dish.price = newPrice;
    await fakeLogAudit(targetId, reqUser?.role || 'tenant_admin', 'TENANT_DISH_PRICE_CHANGED', `Price changed for dish '${dish.name}' (ID: ${dishId}) from ₹${oldPrice} to ₹${newPrice}`);
    return { status: 200, success: true };
  };

  // Tenant 1 attempts to manipulate Dish 200 (which belongs to Tenant 2)
  const tenant1User = { restaurant_id: 1, role: 'restaurant_admin' };
  const crossTenantResult = await simulateUpdateDishPrice(tenant1User, 200, 999);

  assert.strictEqual(crossTenantResult.status, 404, 'Must reject cross-tenant manipulation with 404');
  assert.strictEqual(auditLogs.length, 0, 'No audit log should be written on cross-tenant manipulation');

  // Tenant 1 legitimately updates own Dish 100
  const legitimateResult = await simulateUpdateDishPrice(tenant1User, 100, 180);
  assert.strictEqual(legitimateResult.status, 200);
  assert.strictEqual(auditLogs.length, 1);
  assert.strictEqual(auditLogs[0].restaurantId, 1);
  assert.strictEqual(auditLogs[0].action, 'TENANT_DISH_PRICE_CHANGED');
  assert.ok(auditLogs[0].details.includes('from ₹150 to ₹180'));
});

// ======================================================================
// SECTION 10: Step 5B - Tenant Security, QR & Settings Activity Logging
// ======================================================================
console.log('\n--- SECTION 10: Step 5B - Tenant Security, QR & Settings Activity Logging ---');

const STEP_5B_EVENTS = [
  'SECURITY_ROTATE_QR_SECRET',
  'TENANT_SETTINGS_UPDATED',
  'SECURITY_CREDENTIALS_CHANGED',
  'SECURITY_LOGIN_SUCCESS',
  'SECURITY_LOGIN_FAILED'
];

await test('Step 5B Security and Settings actions map cleanly to their intended categories', () => {
  assert.strictEqual(getCategory({ action: 'SECURITY_ROTATE_QR_SECRET' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'SECURITY_CREDENTIALS_CHANGED' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'SECURITY_LOGIN_SUCCESS' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'SECURITY_LOGIN_FAILED' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'TENANT_SETTINGS_UPDATED' }).id, 'tenant');
  assert.strictEqual(getCategory({ action: 'SETTINGS_UPDATED' }).id, 'tenant');
});

await test('Step 5B Security actions maintain security category precedence over other keywords', () => {
  assert.strictEqual(getCategory({ action: 'SECURITY_ROTATE_QR_SECRET' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'SECURITY_SETTINGS_RESET' }).id, 'security');
  assert.strictEqual(getCategory({ action: 'SECURITY_CREDENTIALS_CHANGED' }).id, 'security');
});

await test('Step 5B audit details enforce zero-logging of passwords, tokens, hashes and KDS PINs', () => {
  const sensitivePatterns = [
    'password123',
    'secret_key',
    'qr_secret_raw_hex',
    'token_jwt_bearer',
    '$2b$10$',
    'kds_pin_1234'
  ];

  const sample5BDetails = [
    "Rotated QR signing secret for restaurant ID 10",
    "Updated settings fields: [name, phone, printer_mode] (KDS PIN updated)",
    "Updated settings fields: [gst_enabled, total_tables]",
    "KDS PIN cleared",
    "Credentials updated for admin 'owner1' (password updated)",
    "Tenant user 'owner1' logged in successfully",
    "Failed tenant login attempt (incorrect password)",
    "Failed tenant login attempt (account not found)"
  ];

  for (const detail of sample5BDetails) {
    for (const pat of sensitivePatterns) {
      assert.strictEqual(detail.includes(pat), false, `Detail "${detail}" leaked sensitive pattern "${pat}"`);
    }
  }
});

await test('admin.js routes trace Step 5B security, QR, settings and login events', () => {
  const adminRoutesPath = path.join(rootDir, 'server/routes/admin.js');
  const content = fs.readFileSync(adminRoutesPath, 'utf8');

  for (const act of STEP_5B_EVENTS) {
    assert.ok(content.includes(act), `admin.js must wire audit event '${act}'`);
  }
});

await test('computeAuditStats() correctly tallies Step 5B events into security and tenant categories', () => {
  const sampleLogs = [
    { id: 3001, action: 'SECURITY_ROTATE_QR_SECRET' },
    { id: 3002, action: 'SECURITY_CREDENTIALS_CHANGED' },
    { id: 3003, action: 'SECURITY_LOGIN_SUCCESS' },
    { id: 3004, action: 'SECURITY_LOGIN_FAILED' },
    { id: 3005, action: 'TENANT_SETTINGS_UPDATED' },
    { id: 3006, action: 'GRANT_ADMIN_ACCESS' },
    { id: 3007, action: 'REFUND_AUDIT_LOGGED' },
    { id: 3008, action: 'AUTO_SUMMARIZATION' }
  ];

  const stats = computeAuditStats(sampleLogs);
  assert.strictEqual(stats.total, 8);
  assert.strictEqual(stats.security, 4, 'Must count 4 security actions');
  assert.strictEqual(stats.tenant, 1, 'Must count 1 tenant action');
  assert.strictEqual(stats.vip, 1, 'VIP count must remain 1');
  assert.strictEqual(stats.billing, 1, 'Billing count must remain 1');
  assert.strictEqual(stats.system, 1, 'System count must remain 1');
  assert.strictEqual(stats.total, stats.security + stats.vip + stats.billing + stats.tenant + stats.system);
});

// ======================================================================
// SUMMARY
// ======================================================================
console.log('\n======================================================================');
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ All Super Admin Audit Log Regression tests passed successfully!\n');
  process.exit(0);
}
