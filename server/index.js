import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDb, runAutoDataSummarization, getImageFromDb, saveImageToDb, purgeCancelledOrdersOlderThan3Mins, getImageRecordFromDb } from './db.js';
import { getR2Diagnostics, isR2Active, getR2ObjectBuffer } from './services/r2ImageService.js';
import { startSubscriptionCron } from './subscriptionCron.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import superadminRoutes from './routes/superadmin.js';
import paymentRoutes from './routes/payment.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOriginsStr = (process.env.ALLOWED_ORIGINS || '').trim();
const allowedOrigins = allowedOriginsStr ? allowedOriginsStr.split(',').map(s => s.trim()) : null;

app.use(cors({
  origin: (origin, callback) => {
    // Server-to-server (e.g. webhooks) & same-origin requests send no origin header
    if (!origin || !allowedOrigins || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS request blocked by production origin policy'));
  }
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf ? buf.toString('utf8') : '';
  }
}));
app.use(express.urlencoded({ extended: true }));

// Smart Persistent Uploads Handler (DB-backed fallback so Render restarts never corrupt images)
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.resolve('public/uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {}

// Serverless DB Auto-Init Middleware for Vercel / Cloud Functions
let isDbReady = false;
let dbInitPromise = null;

app.use(async (req, res, next) => {
  if (isDbReady) return next();
  if (!dbInitPromise) {
    dbInitPromise = initDb().then(() => {
      isDbReady = true;
      if (!process.env.VERCEL) {
        startSubscriptionCron();
      }
    }).catch(err => {
      dbInitPromise = null;
      console.error('Serverless DB init error:', err);
    });
  }
  await dbInitPromise;
  next();
});

// Universal R2 Proxy Stream Endpoint for any R2 object key
app.get(['/api/r2-proxy/*', '/r2-proxy/*'], async (req, res) => {
  const rawPath = req.params[0] || '';
  const rawKey = decodeURIComponent(rawPath).replace(/^\/+/, '');
  const key = rawKey.split('?')[0];
  if (!key) return res.status(404).send('Image key missing');

  // Path traversal & security protection: block '..', null bytes, backslashes, and URL-encoded traversal
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('..') || lowerKey.includes('\\') || lowerKey.includes('\0') || lowerKey.includes('%2e%2e')) {
    return res.status(400).send('Invalid or dangerous image key path');
  }

  // Ensure key format belongs strictly to public asset namespaces (restaurants/, superadmin/branding/, uploads/)
  const isAllowedNamespace = key.startsWith('restaurants/') || key.startsWith('superadmin/branding/') || key.startsWith('uploads/');
  if (!isAllowedNamespace) {
    return res.status(403).send('Forbidden: Access denied to object namespace');
  }

  const filename = path.basename(key);
  const localCachePath = path.resolve('public/uploads/r2-cache', filename);
  const localUploadPath = path.resolve('public/uploads', filename);

  const getContentType = (fName) => {
    const ext = path.extname(fName).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.avif') return 'image/avif';
    return 'image/webp';
  };

  const detectMimeFromBuffer = (buf) => {
    if (!buf || buf.length < 4) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
    if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
    return null;
  };

  const sendBufferWithETag = (buf, mime) => {
    const etag = `W/"${buf.length.toString(16)}-${key.replace(/[^a-zA-Z0-9]/g, '')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Content-Type', mime);

    if (req.query && (req.query.v || req.query.t)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }

    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    try {
      fs.mkdirSync(path.dirname(localCachePath), { recursive: true });
      fs.writeFileSync(localCachePath, buf);
    } catch {}

    return res.send(buf);
  };

  // 1. Primary Source of Truth: Fetch directly from Cloudflare R2 bucket if active
  try {
    if (isR2Active()) {
      const r2Obj = await getR2ObjectBuffer(key);
      if (r2Obj && r2Obj.buffer && r2Obj.buffer.length > 0) {
        const detected = detectMimeFromBuffer(r2Obj.buffer);
        const mime = detected || r2Obj.contentType || getContentType(filename);
        return sendBufferWithETag(r2Obj.buffer, mime);
      }
    }
  } catch (err) {
    console.warn('R2 proxy buffer notice:', err.message);
  }

  // 2. Secondary Source of Truth: Fetch from stored_images table in Neon Database
  try {
    const dbRecord = await getImageRecordFromDb(key) || await getImageRecordFromDb(filename);
    const dbImg = dbRecord || await getImageFromDb(filename) || await getImageFromDb(key);
    if (dbImg) {
      const buf = dbImg.buffer || (dbImg.data ? (Buffer.isBuffer(dbImg.data) ? dbImg.data : Buffer.from(dbImg.data, 'base64')) : null);
      if (buf && buf.length > 0) {
        const detected = detectMimeFromBuffer(buf);
        const mime = detected || dbImg.mimeType || dbImg.mime_type || getContentType(filename);
        return sendBufferWithETag(buf, mime);
      }
    }
  } catch (dbErr) {
    console.warn('R2 proxy DB notice:', dbErr.message);
  }

  // 3. Fallback: Check local r2-cache disk
  if (fs.existsSync(localCachePath)) {
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.sendFile(localCachePath);
  }

  // 4. Fallback: Check local uploads directory
  if (fs.existsSync(localUploadPath)) {
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.sendFile(localUploadPath);
  }

  // 5. Fallback to default logo SVG on disk if present
  const defaultLogoSvg = path.resolve('public/images/default-logo.svg');
  if (fs.existsSync(defaultLogoSvg)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(defaultLogoSvg);
  }

  const defaultLogoPath = path.resolve('public/uploads/logo.jpg');
  if (fs.existsSync(defaultLogoPath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    return res.sendFile(defaultLogoPath);
  }

  return res.status(404).send('Image not found');
});

app.get('/uploads/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 1. Fetch directly from Cloudflare R2 if object key exists in DB record
  try {
    const record = await getImageRecordFromDb(filename);
    if (record && record.storage_provider === 'r2' && record.image_key) {
      const r2Obj = await getR2ObjectBuffer(record.image_key);
      if (r2Obj && r2Obj.buffer) {
        res.setHeader('Content-Type', r2Obj.contentType || 'image/webp');
        return res.send(r2Obj.buffer);
      }
    }
  } catch (dbErr) {
    console.warn('Image R2 stream lookup notice:', dbErr.message);
  }

  // 2. If physical file exists on local disk, serve directly
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // 3. If missing on disk (e.g. after Render restart/redeploy), fetch from DB persistent backup!
  try {
    const dbImg = await getImageFromDb(filename);
    if (dbImg && dbImg.buffer) {
      // Re-cache file to local disk so subsequent reads are instant
      try {
        fs.writeFileSync(filePath, dbImg.buffer);
      } catch (cacheErr) {
        console.warn('Failed to re-cache image to local disk:', cacheErr.message);
      }
      res.setHeader('Content-Type', dbImg.mimeType || 'image/jpeg');
      return res.send(dbImg.buffer);
    }
  } catch (err) {
    console.error('Error serving image from DB fallback:', err.message);
  }

  // 4. Fallback to default placeholder logo if image is missing everywhere
  const defaultLogoSvg = path.resolve('public/images/default-logo.svg');
  if (fs.existsSync(defaultLogoSvg)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(defaultLogoSvg);
  }
  const defaultLogo = path.resolve('public/uploads/logo.jpg');
  if (fs.existsSync(defaultLogo)) {
    return res.sendFile(defaultLogo);
  }

  // 5. Return clear 404 text instead of index.html fallback
  res.status(404).send('Image not found');
});

// Secondary static folder middleware
app.use('/uploads', express.static(uploadsDir));

// Production Health Check Endpoint (Safe: No secret exposure)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    build_id: 'BUILD_2026_08_14_VERSION_77',
    timestamp: new Date().toISOString(),
    service: 'QR Menu & SaaS Billing API',
    environment: (process.env.NODE_ENV || 'development').toLowerCase()
  });
});

// API Routes (Dual-mounted for standard Express & Vercel Serverless Function rewrites)
app.use(['/api/superadmin', '/superadmin'], superadminRoutes);
app.use(['/api/admin', '/admin'], adminRoutes);
app.use(['/api/payment', '/payment'], paymentRoutes);
app.use(['/api/webhooks', '/webhooks'], paymentRoutes);
app.use(['/api', '/'], apiRoutes);

// API 404 Handler (Guarantees JSON error instead of index.html fallback)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// Serve static built React frontend in production or if dist exists (Supports GET & POST return_urls from payment gateways like Cashfree)
const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.all('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  // Fallback for SPA routing when dist directory is building or missing
  app.all('*', (req, res) => {
    const devHtml = path.resolve('index.html');
    if (fs.existsSync(devHtml)) {
      res.sendFile(devHtml);
    } else {
      res.send(`<!DOCTYPE html><html><head><title>TouchQR SaaS</title></head><body><div id="root"></div></body></html>`);
    }
  });
}

// Start Server
async function startServer(portToTry = PORT) {
  try {
    await initDb();
    startSubscriptionCron();

    // 🧹 Purge all old cancelled/rejected orders immediately on startup
    purgeCancelledOrdersOlderThan3Mins().then(res => {
      console.log('⚡ [ORDER CLEANUP] Purged old cancelled/rejected orders from database.');
    }).catch(err => console.warn('Startup order purge notice:', err.message));
    
    // ⚡ 100% Hands-Free Automated Background Compaction Engine
    // Runs automatically on server startup and every 24 hours in background (Purges raw order records > 24 hours into daily summaries)
    runAutoDataSummarization(1).then(res => {
      if (res && res.purged_orders > 0) {
        console.log(`⚡ [AUTO COMPACTION] Automatically summarized ${res.summarized_days} days and purged ${res.purged_orders} old order records.`);
      }
    }).catch(err => console.warn('Auto summarization notice:', err.message));

    setInterval(() => {
      runAutoDataSummarization(1).then(res => {
        if (res && res.purged_orders > 0) {
          console.log(`⚡ [AUTO COMPACTION NIGHTLY] Automatically summarized ${res.summarized_days} days and purged ${res.purged_orders} old order records.`);
        }
      }).catch(err => console.warn('Nightly auto summarization notice:', err.message));
    }, 24 * 60 * 60 * 1000);

    // 🧹 Auto-Purge Cancelled/Rejected Orders Older Than 3 Minutes (180s)
    setInterval(() => {
      purgeCancelledOrdersOlderThan3Mins().catch(err => console.warn('Purge cancelled orders notice:', err.message));
    }, 30 * 1000);

    const diag = getR2Diagnostics();
    console.log('⚡ [R2 STORAGE DIAGNOSTICS] Status:', JSON.stringify(diag));

    const server = app.listen(portToTry, () => {
      console.log(`✨ TouchQR Server running on http://localhost:${portToTry}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${portToTry} in use, trying port ${Number(portToTry) + 1}...`);
        startServer(Number(portToTry) + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (err) {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  }
}

if (process.env.VERCEL || process.env.NODE_ENV === 'test') {
  // Serverless execution environment
} else {
  startServer();
}

export default app;
