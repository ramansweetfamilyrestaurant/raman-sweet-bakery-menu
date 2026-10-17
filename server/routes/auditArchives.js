/**
 * TouchQR — Super Admin Audit Archives API Endpoints
 *
 * Provides authenticated, rate-limited access to the cold storage archive vault.
 *
 * ENDPOINTS:
 * 1. GET    /api/superadmin/audit-logs/archives         - List all archive catalog chunks
 * 2. GET    /api/superadmin/audit-logs/archives/:id     - Get specific archive metadata & batch status
 * 3. POST   /api/superadmin/audit-logs/archives/:id/search  - Memory-safe streaming search inside archive
 * 4. POST   /api/superadmin/audit-logs/archives/:id/restore - Rehydrate archive into isolated staging table
 *
 * SECURITY:
 * - Strictly requires Super Admin token (authenticateToken + requireSuperAdmin).
 * - Enforces rate limiting (10 req/min).
 * - Never accepts raw user-supplied R2 keys or paths (prevents path traversal).
 */

import express from 'express';
import readline from 'readline';
import zlib from 'zlib';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { JWT_SECRET } from '../config/jwt.js';
import { getR2ArchiveClient, getR2ArchiveConfig } from '../config/r2Archive.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const router = express.Router();

/**
 * Super Admin Archive Access Authentication Middleware
 * Strictly returns HTTP 401 for missing or invalid tokens.
 * Strictly returns HTTP 403 for valid non-superadmin tokens.
 */
export function authenticateArchiveAccess(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token.' });
    }
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied. Superadmin role required.' });
    }
    req.user = user;
    next();
  });
}

// Enforce authentication & superadmin authorization across all archive vault routes
router.use(authenticateArchiveAccess);

/**
 * Archive API Rate Limiter
 * 10 requests per minute per IP to prevent CPU exhaustion during decompression.
 */
export const archiveRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many archive search/restore requests. Limit is 10 requests per minute.'
  }
});

// Helper to strictly validate archive ID route parameter
function parsePositiveIntId(param) {
  const raw = String(param || '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const num = parseInt(raw, 10);
  return num > 0 ? num : null;
}

// GET /api/superadmin/audit-logs/archives - List archive catalog entries
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const track = req.query.track;

    if (track && (String(track).includes('..') || String(track).includes('%2e%2e'))) {
      return res.status(400).json({ error: 'PATH_TRAVERSAL_DETECTED', message: 'Path traversal sequences are strictly prohibited' });
    }

    let whereClause = '';
    const params = [];
    if (track) {
      params.push(track);
      whereClause = `WHERE track = $${params.length}`;
    }

    const countRes = await query(`SELECT COUNT(*)::int as total FROM audit_log_archives ${whereClause}`, params);
    const total = countRes[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const archives = await query(`
      SELECT 
        id, archive_uid, archive_key, bucket_name, track,
        start_date, end_date, min_id, max_id,
        total_records, pruned_records, file_size_bytes,
        file_sha256, content_sha256, status,
        total_batches, last_committed_batch,
        verified_at, completed_at, created_at
      FROM audit_log_archives
      ${whereClause}
      ORDER BY id DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    res.json({
      archives: archives || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    console.error('Fetch archives error:', err.message);
    res.status(500).json({ error: 'FAILED_TO_FETCH_ARCHIVES', message: err.message });
  }
});

// GET /api/superadmin/audit-logs/archives/:id - Get single archive metadata & batch progress
router.get('/:id', async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'INVALID_ARCHIVE_ID', message: 'Archive ID must be a positive integer' });
    }

    const archiveRows = await query('SELECT * FROM audit_log_archives WHERE id = $1', [id]);
    if (!archiveRows || archiveRows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Archive catalog entry not found' });
    }

    const batchRows = await query(
      'SELECT id, batch_index, batch_size, status, committed_at FROM audit_log_archive_batches WHERE archive_id = $1 ORDER BY batch_index ASC',
      [id]
    );

    res.json({
      archive: archiveRows[0],
      batches: batchRows || []
    });
  } catch (err) {
    console.error('Fetch archive detail error:', err.message);
    res.status(500).json({ error: 'FAILED_TO_FETCH_ARCHIVE', message: err.message });
  }
});

// POST /api/superadmin/audit-logs/archives/:id/search - Stream and search archive without memory blowup
router.post('/:id/search', archiveRateLimiter, async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'INVALID_ARCHIVE_ID', message: 'Archive ID must be a positive integer' });
    }

    // Security Guard: Reject client-supplied storage keys or paths
    if (req.body?.archive_key || req.body?.key || req.body?.bucket || req.body?.bucket_name || req.body?.path) {
      return res.status(400).json({
        error: 'CLIENT_STORAGE_KEYS_FORBIDDEN',
        message: 'Client-supplied storage keys, buckets, or paths are strictly prohibited.'
      });
    }

    // Security Guard: Path traversal sequence check
    const rawQuery = req.body?.query !== undefined && req.body?.query !== null ? String(req.body.query) : '';
    if (rawQuery.includes('..') || rawQuery.includes('%2e%2e')) {
      return res.status(400).json({
        error: 'PATH_TRAVERSAL_DETECTED',
        message: 'Path traversal sequences are strictly prohibited.'
      });
    }

    const archiveRows = await query('SELECT * FROM audit_log_archives WHERE id = $1', [id]);
    if (!archiveRows || archiveRows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Archive not found' });
    }
    const archive = archiveRows[0];

    const s3Client = getR2ArchiveClient();
    if (!s3Client) {
      return res.status(503).json({ error: 'R2_STORAGE_UNAVAILABLE', message: 'Archive storage client not configured' });
    }

    const { query: searchQuery, restaurant_id, action, limit = 50 } = req.body || {};
    const maxLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

    // Stream from R2
    const s3Res = await s3Client.send(new GetObjectCommand({
      Bucket: archive.bucket_name,
      Key: archive.archive_key
    }));

    const gunzip = zlib.createGunzip();
    const rl = readline.createInterface({
      input: s3Res.Body.pipe(gunzip),
      crlfDelay: Infinity
    });

    const matches = [];
    const qLower = searchQuery ? String(searchQuery).toLowerCase().trim() : '';

    for await (const line of rl) {
      if (!line || !line.trim()) continue;
      try {
        const record = JSON.parse(line);

        // Apply filters
        if (restaurant_id && String(record.restaurant_id) !== String(restaurant_id)) {
          continue;
        }
        if (action && String(record.action) !== String(action)) {
          continue;
        }
        if (qLower) {
          const matched = 
            (record.action && record.action.toLowerCase().includes(qLower)) ||
            (record.details && record.details.toLowerCase().includes(qLower)) ||
            (record.actor_role && record.actor_role.toLowerCase().includes(qLower)) ||
            (String(record.id).includes(qLower));
          if (!matched) continue;
        }

        matches.push(record);
        if (matches.length >= maxLimit) {
          rl.close();
          break;
        }
      } catch (parseErr) {
        // Skip malformed line
      }
    }

    res.json({
      archive_id: id,
      archive_key: archive.archive_key,
      matches,
      match_count: matches.length,
      limit: maxLimit
    });
  } catch (err) {
    console.error('Archive search error:', err.message);
    res.status(500).json({ error: 'ARCHIVE_SEARCH_FAILED', message: err.message });
  }
});

// POST /api/superadmin/audit-logs/archives/:id/restore - Rehydrate archive into isolated staging table
router.post('/:id/restore', archiveRateLimiter, async (req, res) => {
  try {
    const id = parsePositiveIntId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'INVALID_ARCHIVE_ID', message: 'Archive ID must be a positive integer' });
    }

    // Security Guard: Reject client-supplied storage keys or paths
    if (req.body?.archive_key || req.body?.key || req.body?.bucket || req.body?.bucket_name || req.body?.path) {
      return res.status(400).json({
        error: 'CLIENT_STORAGE_KEYS_FORBIDDEN',
        message: 'Client-supplied storage keys, buckets, or paths are strictly prohibited.'
      });
    }

    const archiveRows = await query('SELECT * FROM audit_log_archives WHERE id = $1', [id]);
    if (!archiveRows || archiveRows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Archive not found' });
    }
    const archive = archiveRows[0];

    const s3Client = getR2ArchiveClient();
    if (!s3Client) {
      return res.status(503).json({ error: 'R2_STORAGE_UNAVAILABLE' });
    }

    // Ensure staging table exists
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs_archive_staging (
        id INT PRIMARY KEY,
        restaurant_id INT,
        actor_role VARCHAR(50),
        action VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP,
        restored_from_archive_id INT,
        restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Stream and rehydrate
    const s3Res = await s3Client.send(new GetObjectCommand({
      Bucket: archive.bucket_name,
      Key: archive.archive_key
    }));

    const gunzip = zlib.createGunzip();
    const rl = readline.createInterface({
      input: s3Res.Body.pipe(gunzip),
      crlfDelay: Infinity
    });

    let restoredCount = 0;
    for await (const line of rl) {
      if (!line || !line.trim()) continue;
      try {
        const r = JSON.parse(line);
        await query(`
          INSERT INTO audit_logs_archive_staging (id, restaurant_id, actor_role, action, details, created_at, restored_from_archive_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            restaurant_id = EXCLUDED.restaurant_id,
            actor_role = EXCLUDED.actor_role,
            action = EXCLUDED.action,
            details = EXCLUDED.details,
            created_at = EXCLUDED.created_at,
            restored_from_archive_id = EXCLUDED.restored_from_archive_id,
            restored_at = CURRENT_TIMESTAMP
        `, [r.id, r.restaurant_id, r.actor_role, r.action, r.details, r.created_at, id]);
        restoredCount++;
      } catch (insertErr) {
        // Skip conflict or log
      }
    }

    res.json({
      success: true,
      archive_id: id,
      restored_count: restoredCount,
      staging_table: 'audit_logs_archive_staging',
      message: `Successfully rehydrated ${restoredCount} records into staging table.`
    });
  } catch (err) {
    console.error('Archive restore error:', err.message);
    res.status(500).json({ error: 'ARCHIVE_RESTORE_FAILED', message: err.message });
  }
});

export default router;
