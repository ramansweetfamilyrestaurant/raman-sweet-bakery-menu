import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDb, runAutoDataSummarization } from './db.js';
import { startSubscriptionCron } from './subscriptionCron.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import superadminRoutes from './routes/superadmin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
const uploadsDir = path.resolve('public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/superadmin', superadminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

// API 404 Handler (Guarantees JSON error instead of index.html fallback)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.originalUrl} not found` });
});

// Serve static built React frontend in production or if dist exists
const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  // Fallback for SPA routing when dist directory is building or missing
  app.get('*', (req, res) => {
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
    
    // ⚡ 100% Hands-Free Automated Background Compaction Engine
    // Runs automatically on server startup and every 24 hours in background
    runAutoDataSummarization().then(res => {
      if (res && res.purged_orders > 0) {
        console.log(`⚡ [AUTO COMPACTION] Automatically summarized ${res.summarized_days} days and purged ${res.purged_orders} old order records.`);
      }
    }).catch(err => console.warn('Auto summarization notice:', err.message));

    setInterval(() => {
      runAutoDataSummarization().then(res => {
        if (res && res.purged_orders > 0) {
          console.log(`⚡ [AUTO COMPACTION NIGHTLY] Automatically summarized ${res.summarized_days} days and purged ${res.purged_orders} old order records.`);
        }
      }).catch(err => console.warn('Nightly auto summarization notice:', err.message));
    }, 24 * 60 * 60 * 1000);

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
