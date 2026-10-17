/**
 * TouchQR — Super Admin Audit Archives HTTP Integration Test Suite
 *
 * SAFETY INVARIANT:
 * Strictly tests HTTP request/response behavior against local test server with mock/private storage.
 * NEVER accesses the real production Cloudflare R2 bucket.
 *
 * TEST REQUIREMENTS:
 * 1. Missing authentication: 401.
 * 2. Invalid authentication: 401.
 * 3. Tenant-admin or non-Super-Admin access: 403.
 * 4. Invalid archive identifiers: 400.
 * 5. Missing archive catalog entries: 404.
 * 6. Rate-limit exhaustion: 429.
 * 7. Rejection of client-supplied R2 keys: 400.
 * 8. Rejection of path traversal attempts: 400.
 * 9. Successful authorized catalog listing: 200.
 * 10. Successful authorized archive metadata fetch: 200.
 * 11. Successful streaming search inside mock archive: 200.
 */

import assert from 'assert';
import express from 'express';
import jwt from 'jsonwebtoken';
import zlib from 'zlib';
import { Readable } from 'stream';
import dotenv from 'dotenv';

dotenv.config();

// Ensure test database is pointed to local disposable database
const LOCAL_TEST_URL = 'postgres://postgres:postgres@127.0.0.1:5432/touchqr_disposable_test';
process.env.TEST_DATABASE_URL = LOCAL_TEST_URL;

import { query, initDb } from '../db.js';
import superadminRoutes from '../routes/superadmin.js';
import { JWT_SECRET } from '../config/jwt.js';
import { setR2ArchiveClient } from '../config/r2Archive.js';
import {
  initializeArchivalSchema,
  serializeCanonicalJsonl
} from '../services/auditLogArchivalService.js';

console.log('======================================================================');
console.log('🌐 TOUCHQR AUDIT ARCHIVES HTTP INTEGRATION TEST SUITE');
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

async function run() {
  await initDb();
  await initializeArchivalSchema(query);

  // Clean and seed test catalog entry
  await query('DELETE FROM audit_log_archive_batches WHERE archive_id = 888');
  await query('DELETE FROM audit_log_archives WHERE id = 888');

  await query(`
    INSERT INTO audit_log_archives (
      id, archive_uid, idempotency_key, archive_key, bucket_name, track,
      start_date, end_date, min_id, max_id, total_records, file_size_bytes,
      file_sha256, content_sha256, status, total_batches
    ) VALUES (
      888, 'http-arch-test-888', 'idem-http-888', 'vault/http_archive_888.jsonl.gz', 'touchqr-audit-vault', 'operational',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 801, 802, 2, 512,
      'fhash_http', 'chash_http', 'COMMITTED', 1
    )
  `);

  await query(`
    INSERT INTO audit_log_archive_batches (
      archive_id, batch_index, batch_size, target_ids, status, committed_at
    ) VALUES (
      888, 1, 2, ARRAY[801, 802], 'COMMITTED', CURRENT_TIMESTAMP
    )
  `);

  // Prepare mock gzipped JSONL payload for streaming search
  const mockRecords = [
    { id: 801, restaurant_id: 1, actor_role: 'tenant_admin', action: 'TENANT_DISH_CREATED', details: 'Special Paneer Burger', created_at: '2026-02-01T10:00:00.000Z' },
    { id: 802, restaurant_id: 1, actor_role: 'tenant_admin', action: 'TENANT_DISH_UPDATED', details: 'Spicy Veg Pizza', created_at: '2026-02-01T11:00:00.000Z' }
  ];
  const canonicalJsonl = serializeCanonicalJsonl(mockRecords);
  const compressedGzip = zlib.gzipSync(Buffer.from(canonicalJsonl, 'utf-8'));

  // Configure mock R2 storage client (ZERO production R2 access)
  const mockR2Client = {
    send: async (command) => {
      // Mock GetObjectCommand
      return {
        Body: Readable.from(compressedGzip)
      };
    }
  };
  setR2ArchiveClient(mockR2Client);

  // Setup Express App
  const app = express();
  app.use(express.json());
  app.use('/api/superadmin', superadminRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/superadmin/audit-logs/archives`;

  const superAdminToken = jwt.sign(
    { id: 1, username: 'superadmin', role: 'superadmin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tenantAdminToken = jwt.sign(
    { id: 10, username: 'tenantadmin', role: 'restaurant_admin', restaurant_id: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // -----------------------------------------------------------------
    // TEST 1: Missing Authentication -> 401
    // -----------------------------------------------------------------
    await test('1. Missing Authorization header returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}`);
      assert.strictEqual(res.status, 401, 'Should return 401 when no auth header is provided');
      const body = await res.json();
      assert(body.error || body.message);
    });

    // -----------------------------------------------------------------
    // TEST 2: Invalid Authentication -> 401
    // -----------------------------------------------------------------
    await test('2. Invalid Bearer token returns HTTP 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}`, {
        headers: { Authorization: 'Bearer this.is.an.invalid.token' }
      });
      assert.strictEqual(res.status, 401, 'Should return 401 for corrupted/invalid token');
    });

    // -----------------------------------------------------------------
    // TEST 3: Tenant-Admin Access -> 403 Forbidden
    // -----------------------------------------------------------------
    await test('3. Tenant-admin (non-Super-Admin) returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${tenantAdminToken}` }
      });
      assert.strictEqual(res.status, 403, 'Should return 403 when role is not superadmin');
      const body = await res.json();
      assert(body.error.includes('Access denied') || body.error.includes('Superadmin role required'));
    });

    // -----------------------------------------------------------------
    // TEST 4: Invalid Archive Identifiers -> 400 Bad Request
    // -----------------------------------------------------------------
    await test('4. Invalid archive identifiers return HTTP 400 Bad Request', async () => {
      const invalidIds = ['abc', '-1', '0', '12.34', 'null', 'NaN'];
      for (const id of invalidIds) {
        const res = await fetch(`${baseUrl}/${id}`, {
          headers: { Authorization: `Bearer ${superAdminToken}` }
        });
        assert.strictEqual(res.status, 400, `Expected 400 for invalid ID '${id}', got ${res.status}`);
        const body = await res.json();
        assert.strictEqual(body.error, 'INVALID_ARCHIVE_ID');
      }

      // Also on search route
      const searchRes = await fetch(`${baseUrl}/not-an-id/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'test' })
      });
      assert.strictEqual(searchRes.status, 400, 'Search route must return 400 on invalid archive ID');
    });

    // -----------------------------------------------------------------
    // TEST 5: Missing Archive Catalog Entry -> 404 Not Found
    // -----------------------------------------------------------------
    await test('5. Non-existent archive ID returns HTTP 404 Not Found', async () => {
      const res = await fetch(`${baseUrl}/999999`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 404, 'Should return 404 when archive does not exist in DB');
      const body = await res.json();
      assert.strictEqual(body.error, 'NOT_FOUND');
    });

    // -----------------------------------------------------------------
    // TEST 6: Rejection of Client-Supplied R2 Keys
    // -----------------------------------------------------------------
    await test('6. Rejection of client-supplied R2 keys and bucket overrides returns HTTP 400', async () => {
      const maliciousBodies = [
        { archive_key: 'custom/vault/attack.jsonl.gz' },
        { key: 'staging/leak.jsonl.gz' },
        { bucket: 'public-media-bucket' },
        { bucket_name: 'private-credentials-bucket' },
        { path: 's3://unauthorized-bucket/' }
      ];

      for (const body of maliciousBodies) {
        const res = await fetch(`${baseUrl}/888/search`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        assert.strictEqual(res.status, 400, `Expected 400 for client-supplied storage key, got ${res.status}`);
        const resJson = await res.json();
        assert.strictEqual(resJson.error, 'CLIENT_STORAGE_KEYS_FORBIDDEN');
      }
    });

    // -----------------------------------------------------------------
    // TEST 7: Rejection of Path Traversal Attempts
    // -----------------------------------------------------------------
    await test('7. Rejection of path traversal sequences in parameters returns HTTP 400', async () => {
      // Path traversal in search query
      const traversalQueries = ['../../etc/passwd', '..\\windows\\system32', '%2e%2e/secret'];
      for (const q of traversalQueries) {
        const res = await fetch(`${baseUrl}/888/search`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: q })
        });
        assert.strictEqual(res.status, 400, `Expected 400 for path traversal query '${q}'`);
        const body = await res.json();
        assert.strictEqual(body.error, 'PATH_TRAVERSAL_DETECTED');
      }

      // Path traversal in query string track
      const listRes = await fetch(`${baseUrl}?track=..%2Ftraversal`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(listRes.status, 400, 'Expected 400 for path traversal in query string');
    });

    // -----------------------------------------------------------------
    // TEST 8: Successful Authorized Catalog List -> 200
    // -----------------------------------------------------------------
    await test('8. Authorized GET / returns archive catalog list with pagination', async () => {
      const res = await fetch(`${baseUrl}`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(Array.isArray(data.archives), 'Response must contain archives array');
      assert(data.pagination, 'Response must contain pagination metadata');
      const found = data.archives.find(a => a.id === 888);
      assert(found, 'Seeded archive 888 must appear in catalog listing');
      assert.strictEqual(found.archive_uid, 'http-arch-test-888');
    });

    // -----------------------------------------------------------------
    // TEST 9: Successful Authorized Single Archive Detail -> 200
    // -----------------------------------------------------------------
    await test('9. Authorized GET /:id returns archive metadata and batch status', async () => {
      const res = await fetch(`${baseUrl}/888`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.archive.id, 888);
      assert.strictEqual(data.archive.archive_uid, 'http-arch-test-888');
      assert(Array.isArray(data.batches));
      assert.strictEqual(data.batches.length, 1);
      assert.strictEqual(data.batches[0].status, 'COMMITTED');
    });

    // -----------------------------------------------------------------
    // TEST 10: Successful Streaming Search with Mock Storage -> 200
    // -----------------------------------------------------------------
    await test('10. Authorized POST /:id/search streams and filters records from mock storage', async () => {
      const res = await fetch(`${baseUrl}/888/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'Burger' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.archive_id, 888);
      assert.strictEqual(data.match_count, 1);
      assert.strictEqual(data.matches[0].id, 801);
      assert(data.matches[0].details.includes('Burger'));
    });

    // -----------------------------------------------------------------
    // TEST 11: Rate-Limit Exhaustion -> 429
    // -----------------------------------------------------------------
    await test('11. Rapid requests exhaust archive rate limiter and return HTTP 429', async () => {
      // The limiter allows 10 requests per minute.
      // We already made 1 successful search request in Test 10.
      // Make 9 more to reach the 10 limit, then the 11th must return 429.
      let rateLimited = false;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(`${baseUrl}/888/search`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: 'Pizza' })
        });
        if (res.status === 429) {
          rateLimited = true;
          const body = await res.json();
          assert.strictEqual(body.error, 'RATE_LIMIT_EXCEEDED');
          break;
        }
      }
      assert.strictEqual(rateLimited, true, 'Archive search endpoint must enforce HTTP 429 upon rate limit exhaustion');
    });

  } finally {
    setR2ArchiveClient(null);
    server.close();
    // Cleanup seeded records
    await query('DELETE FROM audit_log_archive_batches WHERE archive_id = 888');
    await query('DELETE FROM audit_log_archives WHERE id = 888');
  }

  console.log('\n======================================================================');
  console.log(`📊 HTTP INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal HTTP test error:', err);
  process.exit(1);
});
