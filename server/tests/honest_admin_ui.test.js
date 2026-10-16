import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import './testDbGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('======================================================================');
console.log('🛡️  HONEST ADMIN DASHBOARD UI & INCOMPLETE FEATURES TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

const reviewViewPath = path.join(rootDir, 'src/components/Admin/views/ReviewView.jsx');
const supportViewPath = path.join(rootDir, 'src/components/Admin/views/SupportView.jsx');
const setupViewPath = path.join(rootDir, 'src/components/Admin/views/SetupView.jsx');

const reviewViewContent = fs.readFileSync(reviewViewPath, 'utf8');
const supportViewContent = fs.readFileSync(supportViewPath, 'utf8');
const setupViewContent = fs.readFileSync(setupViewPath, 'utf8');

// ======================================================================
// SECTION 1: Customer Reviews Honest State & Demo Transparency
// ======================================================================
console.log('--- SECTION 1: Customer Reviews Honest State & Demo Transparency ---');

test('Customer Reviews: no fabricated aggregate rating (4.7) or review count (248) presented as real metrics', () => {
  assert.ok(!reviewViewContent.includes("metrics.rating || '4.7'"), 'Must not default to fake 4.7 rating');
  assert.ok(!reviewViewContent.includes("metrics.totalReviews || '248'"), 'Must not default to fake 248 reviews');
  assert.ok(!reviewViewContent.includes("metrics.responseRate || '92%'"), 'Must not claim fake 92% response rate');
});

test('Customer Reviews: displays transparency notice that live review sync is not connected', () => {
  assert.ok(reviewViewContent.includes('Direct live synchronization of incoming Google reviews is not currently integrated'), 'Must explain live reviews are not synced');
  assert.ok(reviewViewContent.includes('Demonstration Review Templates'), 'Must label sample reviews as demonstration templates');
});

test('Customer Reviews: sample reviews are explicitly marked with SAMPLE badge', () => {
  assert.ok(reviewViewContent.includes('>SAMPLE</span>'), 'Each review template must have SAMPLE indicator');
  assert.ok(reviewViewContent.includes('Sample Templates for Testing AI Replies (Not Real Customer Feedback)'), 'Subtitle must clarify templates are not real feedback');
});

test('Customer Reviews: Google Review URL points to real tenant business setting', () => {
  assert.ok(reviewViewContent.includes('settingsForm?.google_review_url'), 'Must link to real google_review_url setting');
});

// ======================================================================
// SECTION 2: Support Inquiries & Real WhatsApp Channel
// ======================================================================
console.log('\n--- SECTION 2: Support Inquiries & Real WhatsApp Channel ---');

test('Support Inquiries: no fake pre-seeded tickets (e.g. TICK-1082)', () => {
  assert.ok(!supportViewContent.includes('TICK-1082'), 'Must not seed fake TICK-1082 ticket');
  assert.ok(supportViewContent.includes('const [tickets, setTickets] = useState([]);'), 'Initial tickets must use real tickets state and default to empty array');
});

test('Support Inquiries: provides direct WhatsApp support option', () => {
  assert.ok(supportViewContent.includes('https://wa.me/'), 'Must construct wa.me URL for WhatsApp');
  assert.ok(supportViewContent.includes('cleanWhatsappNumber'), 'Must clean WhatsApp phone number');
  assert.ok(supportViewContent.includes('window.open('), 'Must open WhatsApp support conversation');
});

test('Support Inquiries: connects to real backend ticket creation with verified state', () => {
  assert.ok(supportViewContent.includes('createTenantSupportTicket'), 'Must use createTenantSupportTicket API');
  assert.ok(supportViewContent.includes('fetchTenantSupportTickets'), 'Must fetch real tickets from backend');
  assert.ok(!supportViewContent.includes('Our team will contact you within 2 hours'), 'Must not make fake callback promises without backend ticket system');
});

test('Support Inquiries: recent inquiries list provides honest empty state', () => {
  assert.ok(supportViewContent.includes('No support tickets created yet. Use the form above to submit an inquiry.'), 'Must have honest empty state');
});

// ======================================================================
// SECTION 3: Maintenance Actions & Honesty
// ======================================================================
console.log('\n--- SECTION 3: Maintenance Actions & Honesty ---');

test('Maintenance Actions: Clear Temporary Logs is marked UNAVAILABLE and disabled', () => {
  assert.ok(setupViewContent.includes('Clear Temporary Logs'), 'Must include Clear Temporary Logs card');
  assert.ok(setupViewContent.includes('Backend log clearance endpoint is not implemented'), 'Must explain server log endpoint is missing');
});

test('Maintenance Actions: Clean Abandoned Drafts is marked UNAVAILABLE and disabled', () => {
  assert.ok(setupViewContent.includes('Clean Abandoned Drafts'), 'Must include Clean Abandoned Drafts card');
  assert.ok(setupViewContent.includes('Server does not store separate temporary drafts'), 'Must explain draft persistence reality');
});

test('Maintenance Actions: handlers do not use fake setTimeout simulation', () => {
  // Check that handleExecuteClearLogs does not set fake success
  assert.ok(!setupViewContent.includes('Expired temporary logs and runtime metrics cleared'), 'Must not show fake clear logs success');
  assert.ok(!setupViewContent.includes('Incomplete drafts and orphaned temporary records cleaned'), 'Must not show fake clean drafts success');
});

test('Maintenance Actions: dbLogs initial state is empty and lastMaintTime defaults to Never', () => {
  assert.ok(setupViewContent.includes("const [dbLogs, setDbLogs] = useState([]);"), 'dbLogs initial state must be empty array');
  assert.ok(setupViewContent.includes("|| 'Never';"), 'lastMaintTime fallback must be Never');
  assert.ok(setupViewContent.includes('No maintenance actions recorded in this session.'), 'Must render empty state for maintenance log');
});

// ======================================================================
// SECTION 4: Active Device Sessions & Stateless JWT Architecture
// ======================================================================
console.log('\n--- SECTION 4: Active Device Sessions & Stateless JWT Architecture ---');

test('Active Device Sessions: no fabricated remote devices in initial state', () => {
  assert.ok(!setupViewContent.includes("device: 'Chrome • Android'"), 'Must not fabricate Android mobile session');
  assert.ok(setupViewContent.includes("device: 'Current Browser Session'"), 'Must track only the current browser session');
});

test('Active Device Sessions: explains stateless JWT and unavailability of remote revocation', () => {
  assert.ok(setupViewContent.includes('Stateless JWT'), 'Must label sessions section with Stateless JWT badge');
  assert.ok(setupViewContent.includes('TouchQR uses client-side stateless tokens'), 'Must clarify stateless token architecture');
  assert.ok(setupViewContent.includes('Remote Device Management'), 'Must include advisory on remote device management');
  assert.ok(setupViewContent.includes('change your Admin Password above'), 'Must advise changing password to invalidate sessions');
});

test('Active Device Sessions: Sign out all other devices is disabled with honest unavailable label', () => {
  assert.ok(setupViewContent.includes('Remote Sign Out Unavailable'), 'Button must be labeled Remote Sign Out Unavailable');
  assert.ok(setupViewContent.includes('Remote session revocation requires a server-side session registry'), 'Handler must not claim other devices were signed out');
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
  console.log('✅ All honest UI & incomplete feature safety tests passed successfully.\n');
  process.exit(0);
}
