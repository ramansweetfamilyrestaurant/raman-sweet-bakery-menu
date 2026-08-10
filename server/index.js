import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDb, runAutoDataSummarization, getImageFromDb, saveImageToDb, purgeCancelledOrdersOlderThan3Mins } from './db.js';
import { getR2Diagnostics } from './services/r2ImageService.js';
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
const uploadsDir = path.resolve('public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Universal R2 Proxy Stream Endpoint for any R2 object key
app.get(['/api/r2-proxy/*', '/r2-proxy/*'], async (req, res) => {
  const rawPath = req.params[0] || '';
  const key = decodeURIComponent(rawPath).replace(/^\/+/, '');
  if (!key) return res.status(404).send('Image key missing');

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

  // 1. Check local r2-cache disk
  if (fs.existsSync(localCachePath)) {
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(localCachePath);
  }

  // 2. Check local uploads directory
  if (fs.existsSync(localUploadPath)) {
    res.setHeader('Content-Type', getContentType(filename));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(localUploadPath);
  }

  // 3. Fetch from Cloudflare R2 bucket
  try {
    const r2Obj = await getR2ObjectBuffer(key);
    if (r2Obj && r2Obj.buffer) {
      res.setHeader('Content-Type', r2Obj.contentType || 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(r2Obj.buffer);
    }
  } catch (err) {
    console.warn('R2 proxy buffer notice:', err.message);
  }

  return res.status(404).send('Image not found');
});

app.get('/uploads/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  // 1. Fetch directly from Cloudflare R2 if object key exists in DB record
  try {
    const record = await getImageRecordFromDb(filename);
    if (record && record.storage_provider === 'r2' && record.image_key) {
      const r2Obj = await getR2ObjectBuffer(record.image_key);
      if (r2Obj && r2Obj.buffer) {
        res.setHeader('Content-Type', r2Obj.contentType || 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(dbImg.buffer);
    }
  } catch (err) {
    console.error('Error serving image from DB fallback:', err.message);
  }

  // 4. Fallback to default placeholder logo if image is missing everywhere
  const defaultLogo = path.join(uploadsDir, 'logo.jpg');
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
    timestamp: new Date().toISOString(),
    service: 'QR Menu & SaaS Billing API',
    environment: (process.env.NODE_ENV || 'development').toLowerCase()
  });
});

// API Routes
app.use('/api/superadmin', superadminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/webhooks', paymentRoutes);
app.use('/api', apiRoutes);

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
      res.send(`<!DOCTYPE html><html><head><title>Khana Master SaaS</title></head><body><div id="root"></div></body></html>`);
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
      console.log(`✨ Raman Sweet Bakery Server running on http://localhost:${portToTry}`);
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

startServer();
