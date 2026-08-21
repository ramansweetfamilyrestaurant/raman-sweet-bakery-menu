import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, withTransaction, getDbType } from '../db.js';
import { isR2Active } from '../services/r2ImageService.js';
import { 
  registrationRateLimiter, 
  authExchangeRateLimiter,
  locationVerifyRateLimiter,
  orderCreationRateLimiter,
  serviceRequestRateLimiter
} from '../middleware/rateLimiters.js';
import { exchangeAuthCode } from '../services/authCodeService.js';
import { checkExpiredSubscriptions } from '../subscriptionCron.js';
import { verifyQrToken, normalizeSpaceType, normalizeSpaceNumber } from '../utils/qrSecurity.js';
import { 
  resolveEffectiveVerificationPolicy, 
  generatePresenceToken, 
  verifyPresenceToken, 
  generateQrContextHash, 
  normalizeVerificationMode, 
  isValidVerificationMode,
  VERIFICATION_MODES,
  GPS_TOLERANCE,
  calculateEffectiveGpsTolerance
} from '../utils/presenceVerification.js';

const router = express.Router();

// 🛡️ In-Memory Order Concurrency Mutex & Idempotency Store (Prevents race conditions & double submissions)
const orderInFlightMutex = new Map(); // key -> Promise<response>
const orderIdempotencyCache = new Map(); // key -> { timestamp, response }

// Periodic cleanup of idempotency cache (keeps entries from last 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of orderIdempotencyCache.entries()) {
    if (now - v.timestamp > 60000) {
      orderIdempotencyCache.delete(k);
    }
  }
}, 30000);

// Haversine formula: Calculates distance in meters between two GPS points
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// GET Automated Health & Capacity Monitoring Endpoint (Safe: Zero Secret Leakage)
router.get('/health', async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await query('SELECT 1');
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = 'degraded';
    console.error('[HEALTH CHECK] Database ping failed:', err.message);
  }

  const overallDuration = Date.now() - startTime;
  const isHealthy = dbStatus === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    duration_ms: overallDuration,
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
      type: getDbType()
    },
    storage: {
      provider: isR2Active() ? 'cloudflare_r2' : 'local_fallback',
      active: isR2Active()
    },
    version: '1.0.0-1000-tenant-ready'
  });
});

// GET Database Debug & Diagnostics Endpoint (Disabled in production for security)
router.get('/debug-db', async (req, res) => {
  const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);
  if (isProduction) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  try {
    const isPg = Boolean(process.env.DATABASE_URL);
    const activeDbType = getDbType();
    res.json({
      status: 'OK',
      hasDATABASE_URLEnv: isPg,
      activeDbType: activeDbType
    });
  } catch (err) {
    res.status(500).json({ error: 'Diagnostic lookup failed' });
  }
});

// GET public system settings (e.g. Master Super Admin WhatsApp Support Number)
router.get('/settings', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM system_settings');
    const settings = { support_whatsapp: '919876543210' };
    (rows || []).forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    console.error('Fetch public settings error:', err);
    res.json({ support_whatsapp: '919876543210' });
  }
});

// GET public SaaS plans for Landing Page & Registration (no auth required)
router.get('/plans', async (req, res) => {
  try {
    const plans = await query('SELECT * FROM saas_plans ORDER BY price ASC');
    const result = (plans || []).map(p => ({
      key: p.key,
      name: p.name,
      price: Number(p.price) || 0,
      original_price: Number(p.original_price) || (Number(p.price) ? Math.round(Number(p.price) * 2 - 1) : 999),
      badge: p.badge || '👑 PLAN',
      description: p.description || '',
      whatsapp_enabled: Boolean(p.whatsapp_enabled),
      direct_ordering_enabled: Boolean(p.direct_ordering_enabled),
      google_reviews_enabled: Boolean(p.google_reviews_enabled),
      max_combos: Number(p.max_combos) || 10
    }));
    res.json(result);
  } catch (err) {
    console.error('Fetch public plans error:', err);
    res.json([]);
  }
});



// Helper to resolve target restaurant by explicit public URL slug, custom domain, or JWT token
const restoResolveCache = new Map();
const RESOLVE_CACHE_TTL_MS = 20000;

export function clearRestoResolveCache() {
  restoResolveCache.clear();
}

async function resolveRestaurant(req, slug) {
  // 1. Authenticated Admin Requests: If Authorization header with valid JWT is present, JWT restaurant_id is 100% authoritative!
  if (req && req.headers && req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader.split(' ')[1];
      if (token && token !== 'undefined' && token !== 'null') {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.restaurant_id) {
          const restos = await query('SELECT * FROM restaurants WHERE id = $1', [decoded.restaurant_id]);
          if (restos && restos.length > 0) return restos[0];
        }
      }
    } catch (e) {}
  }

  // 2. Explicit URL slug parameter passed in public route (e.g. /api/menu-bundle?slug=rama or /api/info?slug=rama)
  if (slug && typeof slug === 'string' && slug.trim() !== '') {
    const cleanSlug = slug.trim().toLowerCase();
    if (!['menu', 'default', 'null', 'undefined', 'home', 'index', 'api', 'kitchen'].includes(cleanSlug)) {
      const cached = restoResolveCache.get(cleanSlug);
      if (cached && (Date.now() - cached.timestamp < RESOLVE_CACHE_TTL_MS)) {
        return cached.data;
      }
      const restos = await query('SELECT * FROM restaurants WHERE LOWER(slug) = $1', [cleanSlug]);
      if (restos && restos.length > 0) {
        restoResolveCache.set(cleanSlug, { data: restos[0], timestamp: Date.now() });
        return restos[0];
      }
      if (cleanSlug.endsWith('-menu')) {
        const altSlug = cleanSlug.replace(/-menu$/, '');
        const altRestos = await query('SELECT * FROM restaurants WHERE LOWER(slug) = $1', [altSlug]);
        if (altRestos && altRestos.length > 0) {
          restoResolveCache.set(cleanSlug, { data: altRestos[0], timestamp: Date.now() });
          return altRestos[0];
        }
      }
      return null;
    }
  }

  // 3. Check incoming Host header for custom domain mapping (e.g. menu.restaurant.com)
  if (req && req.headers) {
    try {
      const rawHeader = req.headers['x-forwarded-host'] || req.headers.host || '';
      const hostStr = Array.isArray(rawHeader) ? rawHeader[0] : String(rawHeader);
      const rawHost = hostStr.split(':')[0].toLowerCase().replace(/^www\./, '');
      if (rawHost && !rawHost.includes('touchqr') && !rawHost.includes('localhost') && !rawHost.includes('vercel.app') && !rawHost.includes('127.0.0.1')) {
        const domainRestos = await query('SELECT * FROM restaurants WHERE LOWER(custom_domain) = $1 OR LOWER(custom_domain) = $2', [rawHost, `www.${rawHost}`]);
        if (domainRestos && domainRestos.length > 0) {
          return domainRestos[0];
        }
      }
    } catch (e) {
      console.error('[RESOLVE RESTAURANT HOST ERROR]', e);
    }
  }

  // 4. Generic public /menu fallback ONLY for unauthenticated public browsing:
  const cleanSlug = (slug && typeof slug === 'string') ? slug.trim().toLowerCase() : '';
  if (!cleanSlug || ['menu', 'default', 'null', 'undefined', 'home', 'index'].includes(cleanSlug)) {
    const demoRestos = await query("SELECT * FROM restaurants WHERE LOWER(slug) = 'touchqr-demo'");
    if (demoRestos && demoRestos.length > 0) {
      return demoRestos[0];
    }
  }

  return null;
}// In-Memory Fast Cache for Public Menu Bundle (20s TTL)
const menuBundleCache = new Map();
const CACHE_TTL_MS = 20000;

export function clearMenuBundleCache(targetSlug) {
  if (targetSlug) {
    menuBundleCache.delete(String(targetSlug).toLowerCase().trim());
  } else {
    menuBundleCache.clear();
  }
}

// GET Combined Menu Bundle (Blazing-Fast Edge-Cached Payload)
router.get('/menu-bundle', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
  try {
    const { slug } = req.query;
    const cleanSlug = String(slug || '').trim().toLowerCase();

    if (cleanSlug) {
      const cached = menuBundleCache.get(cleanSlug);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return res.json(cached.payload);
      }
    }

    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'Restaurant Not Found', notFound: true });
    }

    const isActive = resto.active === 1 || resto.active === true || resto.active === '1' || resto.active === undefined || resto.active === null;
    if (!isActive || resto.active === false || resto.active === 0 || resto.active === 'false') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(403).json({
        error: 'Restaurant Suspended',
        suspended: true,
        name: resto.name,
        slug: resto.slug
      });
    }

    const targetId = resto.id;
    const planTierKey = (resto.plan_tier || 'pro').toLowerCase();

    // Execute queries in parallel
    const [categories, dishes, combos, planRows] = await Promise.all([
      query("SELECT * FROM categories WHERE restaurant_id = $1 AND (active IS NULL OR active::text NOT IN ('0', 'false', 'f')) ORDER BY sort_order ASC, id ASC", [targetId]),
      query(`
        SELECT d.*, c.name as category_name 
        FROM dishes d 
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE d.restaurant_id = $1 AND (d.available IS NOT FALSE) AND (c.active IS NOT FALSE OR c.id IS NULL)
        ORDER BY d.id ASC
      `, [targetId]),
      query("SELECT * FROM combos WHERE restaurant_id = $1 AND (available IS NOT FALSE) ORDER BY sort_order ASC, id ASC", [targetId]),
      query('SELECT * FROM saas_plans WHERE key = $1 OR LOWER(key) = $1', [planTierKey]).catch(() => [])
    ]);

    // Increment scan count asynchronously after main data fetch
    query('UPDATE restaurants SET scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1', [targetId]).catch(() => {});

    let filtersVis = resto.filters_visibility;
    if (typeof filtersVis === 'string') {
      try { filtersVis = JSON.parse(filtersVis); } catch (e) {}
    }
    if (!filtersVis) {
      filtersVis = { must_try: true, combo: true, special: true, under100: true };
    }

    const saasP = (planRows && planRows.length > 0) ? planRows[0] : {};
    
    const isFieldTrue = (fieldVal, defaultVal = true) => {
      if (fieldVal === undefined || fieldVal === null) return defaultVal;
      return fieldVal === 1 || fieldVal === true || fieldVal === '1' || fieldVal === 'true';
    };

    const resolvePermission = (saasVal, restoVal, defaultVal = true) => {
      const sEnabled = isFieldTrue(saasVal, defaultVal);
      if (restoVal !== undefined && restoVal !== null) {
        return sEnabled && isFieldTrue(restoVal, defaultVal);
      }
      return sEnabled;
    };

    const whatsappEnabled = resolvePermission(saasP.whatsapp_ordering_enabled ?? saasP.whatsapp_enabled, resto.whatsapp_enabled, planTierKey !== 'basic');
    const directOrderingEnabled = resolvePermission(saasP.direct_ordering_enabled, resto.direct_ordering_enabled, planTierKey === 'enterprise' || planTierKey === 'vip_ultra_plan');
    const googleReviewsEnabled = resolvePermission(saasP.google_reviews_enabled, resto.google_reviews_enabled, planTierKey !== 'basic');
    const multiLanguageEnabled = resolvePermission(saasP.multi_language_enabled, resto.multi_language_enabled, true);

    const watermarkRemoval = isFieldTrue(saasP.watermark_removal_enabled, true);
    const customDomainEnabled = isFieldTrue(saasP.custom_domain_enabled, true);
    const analyticsExportEnabled = isFieldTrue(saasP.analytics_export_enabled, true);
    const gstInvoiceEnabled = isFieldTrue(saasP.gst_invoice_enabled, true);
    const aiReviewEnabled = isFieldTrue(saasP.ai_review_enabled, true);
    const bluetoothKotEnabled = isFieldTrue(saasP.bluetooth_kot_enabled, true);
    const dualPrinterEnabled = isFieldTrue(saasP.dual_printer_enabled, planTierKey === 'enterprise' || planTierKey === 'vip_ultra_plan');

    const infoObj = {
      id: resto.id,
      name: resto.name,
      slug: resto.slug,
      tagline: resto.tagline || '',
      badge: resto.resto_type === 'pure_veg' ? '100% Pure Veg' : 'Veg & Non-Veg',
      resto_type: resto.resto_type || 'pure_veg',
      logo: resto.logo || '',
      openingHours: resto.opening_hours || '',
      phone: resto.phone || '',
      address: resto.address || '',
      google_review_url: resto.google_review_url || '',
      google_maps_url: resto.google_maps_url || '',
      fssai_lic_no: resto.fssai_lic_no || '',
      filters_visibility: filtersVis,
      currency_symbol: (resto.currency_symbol !== null && resto.currency_symbol !== undefined) ? resto.currency_symbol : '₹',
      plan_tier: resto.plan_tier || 'pro',
      whatsapp_number: resto.whatsapp_number || resto.phone || '',
      whatsapp_enabled: whatsappEnabled,
      direct_ordering_enabled: directOrderingEnabled,
      modifiers_enabled: isFieldTrue(saasP.modifiers_enabled, true),
      watermark_removal_enabled: watermarkRemoval,
      custom_domain_enabled: customDomainEnabled,
      multi_language_enabled: multiLanguageEnabled,
      analytics_export_enabled: analyticsExportEnabled,
      gst_invoice_enabled: gstInvoiceEnabled,
      ai_review_enabled: aiReviewEnabled,
      google_reviews_enabled: googleReviewsEnabled,
      bluetooth_kot_enabled: bluetoothKotEnabled,
      dual_printer_enabled: dualPrinterEnabled,
      custom_domain: resto.custom_domain || '',
      active: true
    };

    const payload = {
      info: infoObj,
      categories: categories || [],
      dishes: dishes || [],
      combos: combos || []
    };

    if (cleanSlug) {
      menuBundleCache.set(cleanSlug, { payload, timestamp: Date.now() });
    }

    res.json(payload);
  } catch (err) {
    console.error('Error fetching menu bundle:', err);
    res.status(500).json({ error: 'Failed to fetch menu bundle' });
  }
});

// Restaurant General Info (/api/info or /api/info?slug=royal-pizza)
router.get('/info', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const { slug } = req.query;
    console.error('[INFO DEBUG] slug:', slug);
    const resto = await resolveRestaurant(req, slug);
    console.error('[INFO DEBUG] resolvedRestaurant:', resto ? { id: resto.id, slug: resto.slug, name: resto.name } : null);
    console.error('[INFO DEBUG] restaurantId:', resto?.id);

    if (!resto) {
      return res.status(404).json({
        error: 'Restaurant Not Found',
        notFound: true,
        requestedSlug: slug || ''
      });
    }

    const isActive = resto.active === 1 || resto.active === true || resto.active === '1' || resto.active === undefined || resto.active === null;
    if (!isActive && resto.active === false) {
      return res.status(403).json({
        error: 'Restaurant Suspended',
        suspended: true,
        name: resto.name,
        slug: resto.slug
      });
    }

    // Parse filters_visibility if stored as JSON string or object
    let filtersVis = resto.filters_visibility;
    if (typeof filtersVis === 'string') {
      try { filtersVis = JSON.parse(filtersVis); } catch (e) {}
    }
    if (!filtersVis || typeof filtersVis !== 'object') {
      filtersVis = { must_try: true, combo: true, special: true, under100: true };
    }

    // Increment QR scan count silently if public customer request (no JWT token)
    if (!req.headers || !req.headers.authorization) {
      query('UPDATE restaurants SET scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1', [resto.id]).catch(() => {});
    }

    const planTierKey = String(resto.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [planTierKey]).catch(() => []);
    const saasPlan = (planRows && planRows.length > 0) ? planRows[0] : {};

    const planPrice = Number(resto.plan_price || saasPlan.price || (planTierKey === 'enterprise' ? 1999 : planTierKey === 'basic' ? 499 : 999));
    const whatsappEnabled = saasPlan.whatsapp_enabled !== undefined ? (saasPlan.whatsapp_enabled === 1 || saasPlan.whatsapp_enabled === true || saasPlan.whatsapp_enabled === '1') : (planTierKey !== 'basic');
    const directOrderingEnabled = saasPlan.direct_ordering_enabled !== undefined ? (saasPlan.direct_ordering_enabled === 1 || saasPlan.direct_ordering_enabled === true || saasPlan.direct_ordering_enabled === '1') : (planTierKey === 'enterprise');
    const googleReviewsEnabled = saasPlan.google_reviews_enabled !== undefined ? (saasPlan.google_reviews_enabled === 1 || saasPlan.google_reviews_enabled === true || saasPlan.google_reviews_enabled === '1') : (planTierKey !== 'basic');
    const maxCombos = saasPlan.max_combos !== undefined ? Number(saasPlan.max_combos) : (planTierKey === 'basic' ? 3 : planTierKey === 'pro' ? 10 : 9999);
    const watermarkRemovalEnabled = saasPlan.watermark_removal_enabled !== undefined ? (saasPlan.watermark_removal_enabled === 1 || saasPlan.watermark_removal_enabled === true || saasPlan.watermark_removal_enabled === '1') : true;
    const customDomainEnabled = saasPlan.custom_domain_enabled !== undefined ? (saasPlan.custom_domain_enabled === 1 || saasPlan.custom_domain_enabled === true || saasPlan.custom_domain_enabled === '1') : true;
    const multiLanguageEnabled = saasPlan.multi_language_enabled !== undefined ? (saasPlan.multi_language_enabled === 1 || saasPlan.multi_language_enabled === true || saasPlan.multi_language_enabled === '1') : true;
    const analyticsExportEnabled = saasPlan.analytics_export_enabled !== undefined ? (saasPlan.analytics_export_enabled === 1 || saasPlan.analytics_export_enabled === true || saasPlan.analytics_export_enabled === '1') : true;
    const gstInvoiceEnabled = saasPlan.gst_invoice_enabled !== undefined ? (saasPlan.gst_invoice_enabled === 1 || saasPlan.gst_invoice_enabled === true || saasPlan.gst_invoice_enabled === '1') : true;
    const aiReviewEnabled = saasPlan.ai_review_enabled !== undefined ? (saasPlan.ai_review_enabled === 1 || saasPlan.ai_review_enabled === true || saasPlan.ai_review_enabled === '1') : true;
    const kdsEnabled = saasPlan.kds_enabled !== undefined ? (saasPlan.kds_enabled === 1 || saasPlan.kds_enabled === true || saasPlan.kds_enabled === '1') : (planTierKey === 'enterprise' || planTierKey === 'vip_ultra_plan');
    const bluetoothKotEnabled = saasPlan.bluetooth_kot_enabled !== undefined ? (saasPlan.bluetooth_kot_enabled === 1 || saasPlan.bluetooth_kot_enabled === true || saasPlan.bluetooth_kot_enabled === '1') : true;
    const dualPrinterEnabled = saasPlan.dual_printer_enabled !== undefined ? (saasPlan.dual_printer_enabled === 1 || saasPlan.dual_printer_enabled === true || saasPlan.dual_printer_enabled === '1') : (planTierKey === 'enterprise' || planTierKey === 'vip_ultra_plan');
    const modifiersEnabled = saasPlan.modifiers_enabled !== undefined ? (saasPlan.modifiers_enabled === 1 || saasPlan.modifiers_enabled === true || saasPlan.modifiers_enabled === '1') : true;

    return res.json({
      id: resto.id,
      name: resto.name || 'Restaurant',
      slug: resto.slug || '',
      tagline: resto.tagline || '',
      badge: resto.resto_type === 'pure_veg' ? '100% Pure Veg' : 'Veg & Non-Veg',
      resto_type: resto.resto_type || 'pure_veg',
      logo: resto.logo || '',
      openingHours: resto.opening_hours || '',
      phone: resto.phone || '',
      address: resto.address || '',
      owner_name: resto.owner_name || '',
      city: resto.city || '',
      state: resto.state || '',
      pincode: resto.pincode || '',
      google_review_url: resto.google_review_url || '',
      google_maps_url: resto.google_maps_url || '',
      fssai_lic_no: resto.fssai_lic_no || '',
      filters_visibility: filtersVis,
      currency_symbol: (resto.currency_symbol !== null && resto.currency_symbol !== undefined) ? resto.currency_symbol : '₹',
      plan_tier: resto.plan_tier || 'pro',
      plan_price: planPrice,
      plan_expires_at: resto.plan_expires_at || null,
      modifiers_enabled: modifiersEnabled,
      whatsapp_number: resto.whatsapp_number || resto.phone || '',
      whatsapp_enabled: whatsappEnabled,
      direct_ordering_enabled: directOrderingEnabled,
      google_reviews_enabled: googleReviewsEnabled,
      watermark_removal_enabled: watermarkRemovalEnabled,
      custom_domain_enabled: customDomainEnabled,
      multi_language_enabled: multiLanguageEnabled,
      analytics_export_enabled: analyticsExportEnabled,
      gst_invoice_enabled: gstInvoiceEnabled,
      ai_review_enabled: aiReviewEnabled,
      kds_enabled: kdsEnabled,
      bluetooth_kot_enabled: bluetoothKotEnabled,
      dual_printer_enabled: dualPrinterEnabled,
      max_combos: maxCombos,
      theme_color: resto.theme_color || 'gold',
      scan_count: resto.scan_count || 0,
      latitude: resto.latitude !== undefined && resto.latitude !== null ? Number(resto.latitude) : null,
      longitude: resto.longitude !== undefined && resto.longitude !== null ? Number(resto.longitude) : null,
      max_distance_meters: resto.max_distance_meters || 100,
      gst_enabled: resto.gst_enabled === 1 || resto.gst_enabled === true,
      gstin_number: resto.gstin_number || '',
      total_tables: resto.total_tables !== undefined && resto.total_tables !== null ? Number(resto.total_tables) : 0,
      total_cabins: resto.total_cabins !== undefined && resto.total_cabins !== null ? Number(resto.total_cabins) : 0,
      total_rooms: resto.total_rooms !== undefined && resto.total_rooms !== null ? Number(resto.total_rooms) : 0,
      total_vip: resto.total_vip !== undefined && resto.total_vip !== null ? Number(resto.total_vip) : 0,
      table_prefix: resto.table_prefix || 'table',
      order_retention_days: resto.order_retention_days || 7,
      custom_domain: resto.custom_domain || '',
      kds_screen_enabled: resto.kds_screen_enabled !== undefined && resto.kds_screen_enabled !== null ? Number(resto.kds_screen_enabled) : 1,
      onboarding_completed: resto.onboarding_completed !== undefined && resto.onboarding_completed !== null ? (resto.onboarding_completed === true || resto.onboarding_completed === 1 || resto.onboarding_completed === 'true') : true,
      location_initialized: resto.location_initialized !== undefined && resto.location_initialized !== null ? (resto.location_initialized === true || resto.location_initialized === 1 || resto.location_initialized === 'true') : false,
      active: true
    });
  } catch (err) {
    console.error('[INFO ERROR]', err);
    console.error('[INFO ERROR STACK]', err?.stack);
    res.status(500).json({ error: 'Failed to fetch restaurant info', details: String(err && err.message ? err.message : err) });
  }
});

// Get Active Global System Announcements
router.get('/announcements', async (req, res) => {
  try {
    const list = await query("SELECT * FROM announcements WHERE (active IS NULL OR active::text NOT IN ('0', 'false', 'f')) ORDER BY id DESC LIMIT 5").catch(() => []);
    res.json(Array.isArray(list) ? list : []);
  } catch (err) {
    res.json([]);
  }
});

// Get Categories for a specific restaurant
router.get('/categories', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const { admin_view, slug, restaurant_id } = req.query;
    let targetId = restaurant_id;

    if (!targetId) {
      const resto = await resolveRestaurant(req, slug);
      if (!resto) return res.json([]);
      targetId = resto.id;
    }

    let sql = 'SELECT * FROM categories WHERE restaurant_id = $1';
    const params = [targetId];

    if (!admin_view) {
      sql += " AND (active IS NULL OR active::text NOT IN ('0', 'false', 'f'))";
    }

    sql += ' ORDER BY sort_order ASC, id ASC';

    const categories = await query(sql, params);
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get Dishes with search & category filter for a specific restaurant
router.get('/dishes', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const { q, category_id, admin_view, slug, restaurant_id } = req.query;
    let targetId = restaurant_id;

    if (!targetId) {
      const resto = await resolveRestaurant(req, slug);
      if (!resto) return res.json([]);
      targetId = resto.id;
    }

    let sql = `
      SELECT d.*, c.name as category_name 
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.restaurant_id = $1
    `;
    const params = [targetId];

    // By default, customer view only sees available dishes in active categories
    if (!admin_view) {
      sql += ` AND (d.available IS NOT FALSE) AND (c.active IS NOT FALSE OR c.id IS NULL)`;
    }

    if (category_id && category_id !== 'all') {
      params.push(Number(category_id));
      sql += ` AND d.category_id = $${params.length}`;
    }

    if (q && q.trim() !== '') {
      const trimmedQ = q.trim().toLowerCase();
      if (trimmedQ === 'under100' || trimmedQ === '100' || trimmedQ === 'under 100') {
        sql += ` AND d.price <= 100`;
      } else if (trimmedQ.includes('bestseller')) {
        sql += ` AND LOWER(d.badge) LIKE '%bestseller%'`;
      } else if (trimmedQ.includes('must') || trimmedQ.includes('try')) {
        sql += ` AND LOWER(d.badge) LIKE '%must%'`;
      } else if (trimmedQ.includes('combo')) {
        sql += ` AND LOWER(d.badge) LIKE '%combo%'`;
      } else if (trimmedQ.includes('special')) {
        sql += ` AND LOWER(d.badge) LIKE '%special%'`;
      } else if (trimmedQ === 'veg') {
        sql += ` AND (d.type = 'veg' OR d.type IS NULL OR d.type = '')`;
      } else if (trimmedQ === 'nonveg' || trimmedQ === 'non-veg') {
        sql += ` AND d.type = 'nonveg'`;
      } else if (trimmedQ === 'egg') {
        sql += ` AND d.type = 'egg'`;
      } else {
        params.push(`%${trimmedQ}%`);
        params.push(`%${trimmedQ}%`);
        params.push(`%${trimmedQ}%`);
        const p3 = params.length;
        const p2 = p3 - 1;
        const p1 = p3 - 2;
        sql += ` AND (LOWER(d.name) LIKE $${p1} OR LOWER(d.description) LIKE $${p2} OR LOWER(d.badge) LIKE $${p3})`;
      }
    }

    sql += ` ORDER BY d.id DESC`;

    const dishes = await query(sql, params);
    res.json(dishes);
  } catch (err) {
    console.error('Error fetching dishes:', err);
    res.status(500).json({ error: 'Failed to fetch dishes' });
  }
});

// GET public combos for customer menu (no auth needed)
router.get('/combos', async (req, res) => {
  try {
    const slug = req.query.slug;
    const resto = await resolveRestaurant(req, slug);
    if (!resto) return res.json([]);
    const combos = await query('SELECT * FROM combos WHERE restaurant_id = $1 AND (available = true OR available IS NOT FALSE) ORDER BY sort_order ASC, id DESC', [resto.id]);
    res.json(combos);
  } catch (err) {
    console.error('Fetch public combos error:', err);
    res.status(500).json({ error: 'Failed to fetch combos' });
  }
});

// GET Effective Table Presence Verification Policy for Customer Ordering
router.get('/orders/presence-policy', async (req, res) => {
  try {
    const slug = String(req.query.slug || '').trim();
    if (!slug) {
      return res.status(400).json({ error: 'missing_slug', message: 'Restaurant slug is required' });
    }

    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'restaurant_not_found', message: 'Restaurant not found' });
    }

    if (resto.active === 0 || resto.active === false || resto.active === 'false') {
      return res.status(403).json({ error: 'restaurant_inactive', message: 'Restaurant is currently inactive' });
    }

    // 1. Fetch SaaS plan permissions
    let planPermissions = {};
    try {
      const planRows = await query('SELECT * FROM saas_plans WHERE key = $1', [resto.plan_tier || 'pro']);
      if (planRows && planRows.length > 0) {
        planPermissions = planRows[0];
      }
    } catch (planErr) {
      console.warn('Notice resolving SaaS plan for presence policy:', planErr.message);
    }

    // 2. Fetch global system settings (if any)
    let systemPolicy = {};
    try {
      const sysRows = await query("SELECT key, value FROM system_settings WHERE key LIKE '%verification%'");
      if (sysRows && sysRows.length > 0) {
        sysRows.forEach(r => { systemPolicy[r.key] = r.value; });
      }
    } catch (sysErr) {
      // Table or key might not exist yet
    }

    // 3. Resolve effective structured policy
    const policy = resolveEffectiveVerificationPolicy({
      systemPolicy,
      planPermissions,
      restaurantMode: resto.table_verification_mode,
      staffTimeoutSeconds: resto.staff_verification_timeout_seconds
    });

    return res.json({
      success: true,
      verification_enabled: policy.enabled,
      mode: policy.mode,
      allowed_modes: policy.allowedModes,
      staff_fallback_allowed: policy.staffFallbackAllowed,
      staff_timeout_seconds: policy.staffTimeoutSeconds
    });
  } catch (err) {
    console.error('Error resolving presence policy:', err);
    return res.status(500).json({ error: 'Failed to resolve presence verification policy' });
  }
});

// GET Presence Verification Status for Customer Polling / Waiting Flow
router.get('/orders/presence-status/:verificationToken', async (req, res) => {
  try {
    const rawToken = String(req.params.verificationToken || '').trim();
    if (!rawToken) {
      return res.status(400).json({ error: 'missing_token', message: 'Verification token is required' });
    }

    const rows = await query(
      'SELECT v.*, r.slug, r.qr_secret FROM table_location_verifications v JOIN restaurants r ON v.restaurant_id = r.id WHERE v.verification_token = $1',
      [rawToken]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'verification_not_found', message: 'Verification record not found' });
    }

    const record = rows[0];
    let currentStatus = record.status || 'pending';

    // Check expiration if still pending
    if (currentStatus === 'pending' && record.expires_at) {
      const expiryMs = new Date(record.expires_at).getTime();
      if (expiryMs <= Date.now()) {
        currentStatus = 'expired';
        try {
          await query('UPDATE table_location_verifications SET status = $1 WHERE id = $2', ['expired', record.id]);
        } catch (e) { /* ignore */ }
      }
    }

    let presenceToken = null;
    if (currentStatus === 'verified') {
      const spaceType = record.space_type || 'table';
      const spaceNum = record.space_number || record.table_number;
      presenceToken = generatePresenceToken({
        verificationToken: record.verification_token,
        restaurantId: record.restaurant_id,
        slug: record.slug,
        spaceType,
        spaceNumber: spaceNum,
        verificationMethod: record.verification_method || 'GPS',
        qrContextHash: record.qr_context_hash || '',
        sessionId: record.session_id || null
      });
    }

    return res.json({
      success: true,
      status: currentStatus,
      method: record.verification_method || 'GPS',
      space_type: record.space_type || 'table',
      space_number: record.space_number || record.table_number,
      expires_at: record.expires_at,
      presence_token: presenceToken,
      rejection_reason: currentStatus === 'rejected' ? (record.rejection_reason || 'Rejected by staff') : null
    });
  } catch (err) {
    console.error('Error fetching presence status:', err);
    return res.status(500).json({ error: 'Failed to fetch presence status' });
  }
});

// POST Verify Customer Location against Restaurant Boundary with Authoritative Server QR Validation
router.post('/orders/verify-location', locationVerifyRateLimiter, async (req, res) => {
  try {
    const {
      slug,
      table_number,
      space_type,
      table_token,
      tkn,
      token,
      latitude,
      longitude,
      accuracy
    } = req.body;

    // Step 1: Validate Request Structure & Input Lengths
    if (!slug || typeof slug !== 'string' || slug.trim() === '' || slug.length > 100) {
      return res.status(400).json({ error: 'missing_slug', message: 'Valid restaurant slug is required' });
    }

    if (latitude !== undefined && latitude !== null) {
      const lat = Number(latitude);
      if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'invalid_coordinates', message: 'Latitude must be between -90 and 90' });
      }
    }

    if (longitude !== undefined && longitude !== null) {
      const lng = Number(longitude);
      if (isNaN(lng) || !isFinite(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'invalid_coordinates', message: 'Longitude must be between -180 and 180' });
      }
    }

    if (accuracy !== undefined && accuracy !== null) {
      const acc = Number(accuracy);
      if (isNaN(acc) || !isFinite(acc) || acc < 0 || acc > 50000) {
        return res.status(400).json({ error: 'invalid_accuracy', message: 'Accuracy value is invalid' });
      }
    }

    // Step 2: Resolve Restaurant Context
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'restaurant_not_found', message: 'Restaurant not found' });
    }

    // Step 3: Validate Restaurant is Active
    if (resto.active === 0 || resto.active === false || resto.active === 'false') {
      return res.status(403).json({ error: 'restaurant_inactive', message: 'Restaurant is currently inactive' });
    }

    // Step 4: Validate Direct Table Ordering is Enabled
    if (resto.direct_ordering_enabled === 0 || resto.direct_ordering_enabled === false || resto.direct_ordering_enabled === 'false') {
      return res.status(403).json({ error: 'ordering_disabled', message: 'Direct table ordering is currently paused by the restaurant.' });
    }

    // Step 5: Resolve Exact Space Type and Number
    const rawTable = String(table_number || '').trim();
    if (!rawTable) {
      return res.status(400).json({ error: 'invalid_table_number', message: 'Table or space number is required' });
    }
    const resolvedSpaceType = normalizeSpaceType(space_type || rawTable || resto.table_prefix || 'table');
    const resolvedSpaceNum = normalizeSpaceNumber(rawTable);
    const cleanTable = rawTable;

    // Step 6: Validate Space Capacity
    let maxAllowed = 0;
    if (resolvedSpaceType === 'cabin') {
      maxAllowed = Number(resto.total_cabins) || Number(resto.total_tables) || 0;
    } else if (resolvedSpaceType === 'room') {
      maxAllowed = Number(resto.total_rooms) || Number(resto.total_tables) || 0;
    } else if (resolvedSpaceType === 'vip') {
      maxAllowed = Number(resto.total_vip) || Number(resto.total_tables) || 0;
    } else {
      maxAllowed = Number(resto.total_tables) || 0;
    }

    const parsedSpaceNum = parseInt(resolvedSpaceNum, 10);
    if (maxAllowed > 0 && parsedSpaceNum > maxAllowed) {
      return res.status(400).json({
        error: 'invalid_table_number',
        message: `${resolvedSpaceType} #${resolvedSpaceNum} is not registered for this restaurant.`
      });
    }

    // Step 7: REQUIRE & Verify QR Token Server-Side
    const receivedQrToken = String(table_token || tkn || token || '').trim();
    if (!receivedQrToken) {
      return res.status(403).json({
        error: 'invalid_qr',
        reason: 'missing_token',
        message: 'A valid Table QR scan token is required to verify location.'
      });
    }

    const secret = resto.qr_secret || (`${resto.id}_${resto.slug}_tq`);
    const qrResult = verifyQrToken(
      resto.slug,
      resolvedSpaceType,
      resolvedSpaceNum,
      secret,
      receivedQrToken
    );

    if (!qrResult || !qrResult.valid) {
      return res.status(403).json({
        error: 'invalid_qr',
        reason: qrResult?.reason || 'invalid_token',
        message: 'QR token verification failed. Please scan the official QR code at your seat.'
      });
    }

    const qrContextHash = generateQrContextHash(resto.slug, resolvedSpaceType, resolvedSpaceNum, receivedQrToken);

    // Step 8: Authoritative Server-Side Geofence Validation (AFTER QR Verification)
    const restoLat = Number(resto.latitude);
    const restoLng = Number(resto.longitude);
    const hasRestaurantLocation = Boolean(
      resto.latitude != null && resto.longitude != null &&
      !isNaN(restoLat) && !isNaN(restoLng) &&
      restoLat !== 0 && restoLng !== 0
    );

    // If restaurant has not configured GPS coordinates, verification is not required
    if (!hasRestaurantLocation) {
      const verificationToken = 'tq_loc_' + crypto.randomBytes(24).toString('hex');
      const expiryMinutes = 20;
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
      const presenceToken = generatePresenceToken({
        verificationToken,
        restaurantId: resto.id,
        slug: resto.slug,
        spaceType: resolvedSpaceType,
        spaceNumber: resolvedSpaceNum,
        verificationMethod: 'QR',
        qrContextHash,
        expiryMinutes
      });

      return res.json({
        success: true,
        verified: true,
        required: false,
        verification_token: verificationToken,
        presence_token: presenceToken,
        location_token: presenceToken,
        method: 'QR',
        message: 'Location verification not required for this restaurant'
      });
    }

    const custLat = Number(latitude);
    const custLng = Number(longitude);
    const custAcc = Math.round(Number(accuracy) || 999);

    if (isNaN(custLat) || isNaN(custLng) || custLat === 0 || custLng === 0) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'invalid_coordinates',
        message: 'Valid GPS coordinates are required to verify location.'
      });
    }

    // Accuracy Policy: Reject excessively poor accuracy readings (> MAX_REJECT_ACCURACY_METERS)
    if (custAcc > GPS_TOLERANCE.MAX_REJECT_ACCURACY_METERS) {
      return res.status(400).json({
        success: false,
        verified: false,
        error: 'low_accuracy',
        accuracy: custAcc,
        message: `GPS accuracy is too low (±${custAcc}m). Please ensure high-precision Location is enabled or move near a window.`
      });
    }

    // Authoritative Server-side geospatial calculation
    const calculatedDistance = calculateHaversineDistance(custLat, custLng, restoLat, restoLng);
    // Configurable bounded accuracy tolerance
    const accBuffer = calculateEffectiveGpsTolerance(custAcc);
    const effectiveDist = Math.max(0, calculatedDistance - accBuffer);
    const allowedRadius = Number(resto.max_distance_meters) || 100;

    if (effectiveDist > allowedRadius) {
      const displayDist = calculatedDistance > 1000 ? `${(calculatedDistance / 1000).toFixed(1)} km` : `${calculatedDistance} meters`;
      return res.status(403).json({
        success: false,
        verified: false,
        error: 'outside_boundary',
        distance_meters: calculatedDistance,
        allowed_radius: allowedRadius,
        message: `You appear to be ${displayDist} away from ${resto.name || 'the restaurant'} (Allowed radius: ${allowedRadius}m). Table orders must be placed within the dining area.`
      });
    }

    // Step 9: BOTH QR AND GPS PASSED -> Generate Opaque Verification Token & JWT
    const verificationToken = 'tq_loc_' + crypto.randomBytes(24).toString('hex');
    const expiryMinutes = 20;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const nowIso = new Date().toISOString();
    const expiresIso = expiresAt.toISOString();

    // Save verification record in DB
    try {
      await query(
        `INSERT INTO table_location_verifications (
           restaurant_id, table_number, space_type, space_number, verification_token,
           distance_meters, accuracy_meters, verification_method, status, qr_context_hash,
           requested_at, verified_at, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'GPS', 'verified', $8, $9, $9, $10)`,
        [
          resto.id,
          cleanTable,
          resolvedSpaceType,
          resolvedSpaceNum,
          verificationToken,
          calculatedDistance,
          custAcc,
          qrContextHash,
          nowIso,
          expiresIso
        ]
      );
    } catch (dbErr) {
      console.warn('Notice saving location verification record:', dbErr.message);
    }

    // Sign a secure short-lived opaque session token containing ONLY references (zero lat/lng)
    const presenceToken = generatePresenceToken({
      verificationToken,
      restaurantId: resto.id,
      slug: resto.slug,
      spaceType: resolvedSpaceType,
      spaceNumber: resolvedSpaceNum,
      verificationMethod: 'GPS',
      qrContextHash,
      expiryMinutes
    });

    return res.json({
      success: true,
      verified: true,
      required: true,
      verification_token: verificationToken,
      presence_token: presenceToken,
      location_token: presenceToken,
      method: 'GPS',
      distance_meters: calculatedDistance,
      allowed_radius: allowedRadius,
      accuracy: custAcc,
      expires_at: expiresAt.toISOString(),
      message: `✓ Location verified (${calculatedDistance}m from entrance)`
    });
  } catch (err) {
    console.error('[LOCATION VERIFY ERROR]', err);
    return res.status(500).json({ error: 'Failed to verify location' });
  }
});

// POST Customer Request for Staff Presence Verification (Fallback / Staff-Only)
router.post('/orders/presence/request-staff', locationVerifyRateLimiter, async (req, res) => {
  try {
    const {
      slug,
      table_number,
      space_number,
      space_type,
      table_token,
      tkn,
      token
    } = req.body;

    if (!slug || typeof slug !== 'string' || slug.trim() === '' || slug.length > 100) {
      return res.status(400).json({ error: 'missing_slug', message: 'Valid restaurant slug is required' });
    }

    // 1. Resolve Restaurant Context
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'restaurant_not_found', message: 'Restaurant not found' });
    }

    // 2. Validate Restaurant is Active
    if (resto.active === 0 || resto.active === false || resto.active === 'false') {
      return res.status(403).json({ error: 'restaurant_inactive', message: 'Restaurant is currently inactive' });
    }

    // 3. Validate Direct Table Ordering is Enabled
    if (resto.direct_ordering_enabled === 0 || resto.direct_ordering_enabled === false || resto.direct_ordering_enabled === 'false') {
      return res.status(403).json({ error: 'ordering_disabled', message: 'Direct table ordering is currently paused by the restaurant.' });
    }

    // 4. Resolve Canonical Space Type & Number
    const rawTable = String(space_number || table_number || '').trim();
    if (!rawTable) {
      return res.status(400).json({ error: 'invalid_table_number', message: 'Table or space number is required' });
    }
    const resolvedSpaceType = normalizeSpaceType(space_type || rawTable || resto.table_prefix || 'table');
    const resolvedSpaceNum = normalizeSpaceNumber(rawTable);
    const cleanTable = rawTable;

    // 5. Validate Space Capacity
    let maxAllowed = 0;
    if (resolvedSpaceType === 'cabin') {
      maxAllowed = Number(resto.total_cabins) || Number(resto.total_tables) || 0;
    } else if (resolvedSpaceType === 'room') {
      maxAllowed = Number(resto.total_rooms) || Number(resto.total_tables) || 0;
    } else if (resolvedSpaceType === 'vip') {
      maxAllowed = Number(resto.total_vip) || Number(resto.total_tables) || 0;
    } else {
      maxAllowed = Number(resto.total_tables) || 0;
    }

    const parsedSpaceNum = parseInt(resolvedSpaceNum, 10);
    if (maxAllowed > 0 && parsedSpaceNum > maxAllowed) {
      return res.status(400).json({
        error: 'invalid_table_number',
        message: `${resolvedSpaceType} #${resolvedSpaceNum} is not registered for this restaurant.`
      });
    }

    // 6. Cryptographic QR Verification
    const receivedQrToken = String(table_token || tkn || token || '').trim();
    if (!receivedQrToken) {
      return res.status(403).json({
        error: 'invalid_qr',
        reason: 'missing_token',
        message: 'A valid Table QR scan token is required to request staff verification.'
      });
    }

    const secret = resto.qr_secret || (`${resto.id}_${resto.slug}_tq`);
    const qrResult = verifyQrToken(
      resto.slug,
      resolvedSpaceType,
      resolvedSpaceNum,
      secret,
      receivedQrToken
    );

    if (!qrResult || !qrResult.valid) {
      return res.status(403).json({
        error: 'invalid_qr',
        reason: qrResult?.reason || 'invalid_token',
        message: 'QR token verification failed. Please scan the official QR code at your seat.'
      });
    }

    const qrContextHash = generateQrContextHash(resto.slug, resolvedSpaceType, resolvedSpaceNum, receivedQrToken);

    // 7. Resolve Effective Verification Policy
    let planPermissions = {};
    try {
      const planRows = await query('SELECT * FROM saas_plans WHERE key = $1', [resto.plan_tier || 'pro']);
      if (planRows && planRows.length > 0) planPermissions = planRows[0];
    } catch (planErr) {}

    let systemPolicy = {};
    try {
      const sysRows = await query("SELECT key, value FROM system_settings WHERE key LIKE '%verification%'");
      if (sysRows && sysRows.length > 0) {
        sysRows.forEach(r => { systemPolicy[r.key] = r.value; });
      }
    } catch (sysErr) {}

    const effectivePolicy = resolveEffectiveVerificationPolicy({
      systemPolicy,
      planPermissions,
      restaurantMode: resto.table_verification_mode,
      staffTimeoutSeconds: resto.staff_verification_timeout_seconds
    });

    // 8. Policy Check: Is Staff Verification Allowed?
    if (!effectivePolicy.enabled || effectivePolicy.mode === VERIFICATION_MODES.QR_ONLY) {
      return res.status(400).json({
        success: false,
        error: 'staff_verification_not_allowed',
        mode: 'QR_ONLY',
        message: 'Table presence verification is not required for this restaurant. Orders can be placed directly.'
      });
    }

    if (effectivePolicy.mode === VERIFICATION_MODES.GPS_ONLY) {
      return res.status(403).json({
        success: false,
        error: 'staff_verification_not_allowed',
        mode: 'GPS_ONLY',
        message: 'Staff verification fallback is not enabled for this restaurant. Please use GPS location verification.'
      });
    }

    // 9. Prevent Duplicate Pending Requests for Same Table & QR Context
    const existingPending = await query(
      `SELECT * FROM table_location_verifications 
       WHERE restaurant_id = $1 AND space_type = $2 AND space_number = $3 
         AND qr_context_hash = $4 AND verification_method = 'STAFF' 
         AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
       ORDER BY id DESC LIMIT 1`,
      [resto.id, resolvedSpaceType, resolvedSpaceNum, qrContextHash]
    );

    if (existingPending && existingPending.length > 0) {
      const pendingRecord = existingPending[0];
      return res.json({
        success: true,
        status: 'pending',
        is_duplicate: true,
        verification_token: pendingRecord.verification_token,
        expires_at: pendingRecord.expires_at,
        poll_after_ms: 2000,
        message: 'Staff verification request is already pending approval from restaurant staff.'
      });
    }

    // 10. Generate Opaque Verification Token & Request Record
    const verificationToken = 'tq_staff_' + crypto.randomBytes(24).toString('hex');
    const timeoutSeconds = effectivePolicy.staffTimeoutSeconds || 120;
    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + timeoutSeconds * 1000);
    const requestedIso = requestedAt.toISOString();
    const expiresIso = expiresAt.toISOString();

    // Insert into table_location_verifications
    await query(
      `INSERT INTO table_location_verifications (
         restaurant_id, table_number, space_type, space_number, verification_token,
         verification_method, status, qr_context_hash, requested_at, expires_at
       ) VALUES ($1, $2, $3, $4, $5, 'STAFF', 'pending', $6, $7, $8)`,
      [
        resto.id,
        cleanTable,
        resolvedSpaceType,
        resolvedSpaceNum,
        verificationToken,
        qrContextHash,
        requestedIso,
        expiresIso
      ]
    );

    // Insert into service_requests for restaurant admin real-time notification
    try {
      await query(
        `INSERT INTO service_requests (
           restaurant_id, table_number, request_type, note, status, created_at
         ) VALUES ($1, $2, 'presence_verification', $3, 'pending', $4)`,
        [
          resto.id,
          cleanTable,
          `Verification Token: ${verificationToken}`,
          requestedIso
        ]
      );
    } catch (sErr) {
      console.warn('Notice creating service_request notification:', sErr.message);
    }

    return res.json({
      success: true,
      status: 'pending',
      verification_token: verificationToken,
      expires_at: expiresIso,
      timeout_seconds: timeoutSeconds,
      poll_after_ms: 2000,
      message: `Staff verification request sent to restaurant staff. A waiter will confirm your presence at ${resolvedSpaceType} #${resolvedSpaceNum}.`
    });
  } catch (err) {
    console.error('Error creating staff verification request:', err);
    return res.status(500).json({ error: 'Failed to request staff verification' });
  }
});

// POST Create Direct Table Order (KOT Order) with Authoritative Dual QR + Location Authorization
router.post('/orders', orderCreationRateLimiter, async (req, res) => {
  try {
    const {
      slug,
      table_number,
      space_type,
      table_token,
      tkn,
      token,
      presence_token,
      location_token,
      verification_token,
      customer_name,
      customer_phone,
      items,
      total_amount,
      customer_latitude,
      customer_longitude,
      customer_accuracy,
      distance_meters,
      idempotency_key
    } = req.body;

    // Step 1: Validate Request Structure & Input Limits
    if (!slug || typeof slug !== 'string' || slug.trim() === '' || slug.length > 100) {
      return res.status(400).json({ error: 'missing_slug', message: 'Valid restaurant slug is required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'invalid_items', message: 'Order items are required' });
    }

    if (items.length > 100) {
      return res.status(400).json({ error: 'invalid_items', message: 'Order item count cannot exceed 100 items per round' });
    }

    // Step 2: Validate Each Item's Quantities & Numeric Values
    for (const it of items) {
      if (!it || typeof it !== 'object') {
        return res.status(400).json({ error: 'invalid_items', message: 'Invalid item format in payload' });
      }
      const rawQty = it.quantity;
      const parsedQty = parseInt(rawQty, 10);
      if (isNaN(parsedQty) || !isFinite(parsedQty) || parsedQty < 1 || parsedQty > 99) {
        return res.status(400).json({ error: 'invalid_quantity', message: 'Item quantity must be a positive integer between 1 and 99' });
      }
      if (it.price !== undefined && it.price !== null) {
        const p = Number(it.price);
        if (isNaN(p) || !isFinite(p) || p < 0 || p > 1000000) {
          return res.status(400).json({ error: 'invalid_price', message: 'Item price is invalid' });
        }
      }
      if (it.dish_id && String(it.dish_id).length > 60) {
        return res.status(400).json({ error: 'invalid_items', message: 'Item identifier is invalid' });
      }
    }

    // Step 3: Resolve Restaurant Context
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'restaurant_not_found', message: 'Restaurant not found' });
    }
    const targetId = resto.id;

    // Step 4: Verify Restaurant is OPEN & accepting orders
    if (resto.active === 0 || resto.active === false || resto.active === 'false') {
      return res.status(403).json({
        error: 'restaurant_inactive',
        message: 'This restaurant is currently closed / offline.'
      });
    }
    if (resto.direct_ordering_enabled === 0 || resto.direct_ordering_enabled === false || resto.direct_ordering_enabled === 'false') {
      return res.status(403).json({
        error: 'ordering_disabled',
        message: 'Direct table ordering is temporarily paused by the restaurant.'
      });
    }

    // Step 5: Resolve Canonical Exact Space Identity (Table, Cabin, Room, VIP)
    const rawTable = String(table_number || '').trim();
    if (!rawTable || rawTable.length > 20) {
      return res.status(400).json({ error: 'invalid_table_number', message: 'Table or space number is required and must be valid' });
    }
    const resolvedSpaceType = normalizeSpaceType(space_type || rawTable || resto.table_prefix || 'table');
    const resolvedSpaceNum = normalizeSpaceNumber(rawTable);
    const cleanTable = rawTable;

    // Step 6: Validate Space Capacity against Restaurant Configuration
    let maxAllowed = 0;
    if (resolvedSpaceType === 'cabin') {
      maxAllowed = Number(resto.total_cabins) || Number(resto.total_tables) || 0;
    } else if (resolvedSpaceType === 'room') {
      maxAllowed = Number(resto.total_rooms) || Number(resto.total_tables) || 0;
    } else if (resolvedSpaceType === 'vip') {
      maxAllowed = Number(resto.total_vip) || Number(resto.total_tables) || 0;
    } else {
      maxAllowed = Number(resto.total_tables) || 0;
    }

    const spaceNum = parseInt(resolvedSpaceNum, 10);
    if (maxAllowed > 0 && spaceNum > maxAllowed) {
      return res.status(400).json({
        error: 'invalid_table_number',
        message: `${resolvedSpaceType} #${resolvedSpaceNum} is not registered. Please scan the official QR code at your seat.`
      });
    }

    // Step 7: REQUIRE & Authoritatively Verify QR Token Server-Side
    const receivedQrToken = String(table_token || tkn || token || '').trim();
    if (!receivedQrToken) {
      return res.status(403).json({
        error: 'invalid_qr',
        reason: 'missing_token',
        message: 'A valid Table QR scan token is required to place an order.'
      });
    }

    const secret = resto.qr_secret || (`${resto.id}_${resto.slug}_tq`);
    const qrResult = verifyQrToken(
      resto.slug,
      resolvedSpaceType,
      resolvedSpaceNum,
      secret,
      receivedQrToken
    );

    if (!qrResult || !qrResult.valid) {
      return res.status(403).json({
        error: 'invalid_qr',
        reason: qrResult?.reason || 'invalid_token',
        message: 'QR token verification failed. Please scan the official QR code at your seat.'
      });
    }

    // Step 8: Authoritative Table Presence Verification Enforcement
    let planPermissions = {};
    try {
      const planRows = await query('SELECT * FROM saas_plans WHERE key = $1', [resto.plan_tier || 'pro']);
      if (planRows && planRows.length > 0) planPermissions = planRows[0];
    } catch (planErr) {}

    let systemPolicy = {};
    try {
      const sysRows = await query("SELECT key, value FROM system_settings WHERE key LIKE '%verification%'");
      if (sysRows && sysRows.length > 0) {
        sysRows.forEach(r => { systemPolicy[r.key] = r.value; });
      }
    } catch (sysErr) {}

    const effectivePolicy = resolveEffectiveVerificationPolicy({
      systemPolicy,
      planPermissions,
      restaurantMode: resto.table_verification_mode,
      staffTimeoutSeconds: resto.staff_verification_timeout_seconds
    });

    if (effectivePolicy.enabled && effectivePolicy.mode !== VERIFICATION_MODES.QR_ONLY) {
      const suppliedPresenceToken = String(presence_token || location_token || '').trim();

      let allowedMethods = ['GPS'];
      if (effectivePolicy.mode === VERIFICATION_MODES.GPS_WITH_STAFF_FALLBACK) {
        allowedMethods = ['GPS', 'STAFF'];
      } else if (effectivePolicy.mode === VERIFICATION_MODES.STAFF_ONLY) {
        allowedMethods = ['STAFF'];
      }

      if (!suppliedPresenceToken) {
        return res.status(403).json({
          success: false,
          error: 'presence_required',
          mode: effectivePolicy.mode,
          allowed_methods: allowedMethods,
          staff_fallback_allowed: effectivePolicy.staffFallbackAllowed,
          staff_timeout_seconds: effectivePolicy.staffTimeoutSeconds,
          message: 'Table presence verification is required to place table orders.'
        });
      }

      const verifCheck = verifyPresenceToken({
        presenceToken: suppliedPresenceToken,
        restaurantId: targetId,
        slug: resto.slug,
        spaceType: resolvedSpaceType,
        spaceNumber: resolvedSpaceNum,
        qrToken: receivedQrToken,
        allowedMethods
      });

      if (!verifCheck.valid) {
        if (verifCheck.reason === 'presence_token_expired') {
          return res.status(403).json({
            success: false,
            error: 'presence_expired',
            mode: effectivePolicy.mode,
            allowed_methods: allowedMethods,
            message: 'Your table presence authorization has expired. Please re-verify to place an order.'
          });
        }
        if (verifCheck.reason === 'method_not_allowed') {
          return res.status(403).json({
            success: false,
            error: 'presence_required',
            mode: effectivePolicy.mode,
            allowed_methods: allowedMethods,
            message: `Verification method '${verifCheck.method}' is not permitted under mode ${effectivePolicy.mode}.`
          });
        }
        return res.status(403).json({
          success: false,
          error: 'invalid_presence',
          reason: verifCheck.reason,
          mode: effectivePolicy.mode,
          message: 'Invalid table presence authorization. Please scan the official QR code at your seat and verify your presence.'
        });
      }
    }

    // Step 9: Optional distance/location metadata (Non-blocking)
    let distanceMetersValue = distance_meters !== undefined && distance_meters !== null && !isNaN(Number(distance_meters)) ? Number(distance_meters) : null;

    // Step 10: Check cart + price + availability on SERVER (Only after authorization passes)
    const dbDishes = await query('SELECT id, name, price, price_half, available FROM dishes WHERE restaurant_id = $1', [targetId]);
    const dbCombos = await query('SELECT id, name, price, available FROM combos WHERE restaurant_id = $1', [targetId]);
    const dishMap = new Map((dbDishes || []).map(d => [String(d.id), d]));
    const comboMap = new Map((dbCombos || []).map(c => [String(c.id), c]));

    let serverVerifiedTotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const isCombo = item.type === 'combo' || String(item.dish_id || '').startsWith('combo_');
      const cleanId = String(item.dish_id || '').replace(/^combo_/, '');
      const dbItem = isCombo ? comboMap.get(cleanId) : dishMap.get(cleanId);

      if (dbItem) {
        if (dbItem.available === false || dbItem.available === 0) {
          return res.status(400).json({
            error: 'dish_unavailable',
            message: `"${dbItem.name}" is currently sold out / unavailable.`
          });
        }
        const itemPrice = Number(item.price) > 0 ? Number(item.price) : Number(dbItem.price || 0);
        const qty = Math.max(1, parseInt(item.quantity) || 1);
        serverVerifiedTotal += itemPrice * qty;

        verifiedItems.push({
          dish_id: item.dish_id,
          name: dbItem.name || item.name,
          portion: item.portion || '',
          modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
          price: itemPrice,
          quantity: qty,
          ...(isCombo ? { type: 'combo', includes: item.includes || '' } : {})
        });
      } else {
        const itemPrice = Number(item.price) || 0;
        const qty = Math.max(1, parseInt(item.quantity) || 1);
        serverVerifiedTotal += itemPrice * qty;
        verifiedItems.push({
          dish_id: item.dish_id,
          name: item.name || 'Menu Item',
          portion: item.portion || '',
          modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
          price: itemPrice,
          quantity: qty
        });
      }
    }

    // Step 10: Idempotency & In-Flight Concurrency Mutex
    const customIdempKey = req.headers['x-idempotency-key'] || idempotency_key;
    const itemsSig = crypto.createHash('sha256').update(JSON.stringify(verifiedItems.map(i => ({ id: i.dish_id, q: i.quantity, p: i.price })))).digest('hex').substring(0, 16);
    const idempKey = customIdempKey 
      ? `${targetId}:${String(customIdempKey).trim().substring(0, 64)}` 
      : `${targetId}:${cleanTable}:${itemsSig}`;
    const idempTtl = customIdempKey ? 60000 : 3000;

    // Check idempotency cache (3s for debounce signature, 60s for explicit client idempotency key)
    const cachedIdemp = orderIdempotencyCache.get(idempKey);
    if (cachedIdemp && (Date.now() - cachedIdemp.timestamp < idempTtl)) {
      return res.json({ ...cachedIdemp.response });
    }

    // Check if an identical request is currently in-flight
    if (orderInFlightMutex.has(idempKey)) {
      try {
        const inFlightResult = await orderInFlightMutex.get(idempKey);
        return res.json({ ...inFlightResult });
      } catch (e) {
        // If prior in-flight failed, proceed to fresh attempt
      }
    }

    // Step 11: Multi-Round Table Session Detection
    // 🛡️ Rapid Multi-Tap / Duplicate Submission Guard (3-Second Window)
    try {
      const recentOrder = await query(`
        SELECT id, total_amount, created_at, session_id, round_number
        FROM orders
        WHERE restaurant_id = $1 AND table_number = $2 AND created_at >= $3
        ORDER BY id DESC LIMIT 1
      `, [targetId, cleanTable, new Date(Date.now() - 3000).toISOString()]);

      if (recentOrder && recentOrder.length > 0) {
        const prev = recentOrder[0];
        if (Number(prev.total_amount) === serverVerifiedTotal) {
          const debounceResp = {
            success: true,
            order_id: prev.id,
            total_amount: prev.total_amount,
            session_id: prev.session_id,
            round_number: prev.round_number,
            status: 'pending'
          };
          orderIdempotencyCache.set(idempKey, { timestamp: Date.now(), response: debounceResp });
          return res.json(debounceResp);
        }
      }
    } catch (e) {}

    // Create deferred execution promise for in-flight mutex lock
    let executionResolve, executionReject;
    const executionPromise = new Promise((resolve, reject) => {
      executionResolve = resolve;
      executionReject = reject;
    });
    orderInFlightMutex.set(idempKey, executionPromise);

    try {
      const responsePayload = await withTransaction(async (txQuery) => {
        // 🛡️ Step A: Distributed Advisory Lock in PostgreSQL (Scoped to exact restaurant + table)
        if (getDbType() === 'postgres') {
          await txQuery('SELECT pg_advisory_xact_lock(hashtext($1))', [`order_lock_${targetId}_${cleanTable}`]);
        }

        // 🛡️ Step B: Durable Idempotency Check by customIdempKey (if supplied by client)
        if (customIdempKey) {
          const storedKey = String(customIdempKey).trim().substring(0, 100);
          const existingByKey = await txQuery(`
            SELECT id, session_id, round_number, parent_order_id, status, total_amount, distance_meters 
            FROM orders 
            WHERE restaurant_id = $1 AND idempotency_key = $2 
            ORDER BY id DESC LIMIT 1
          `, [targetId, storedKey]);

          if (existingByKey && existingByKey.length > 0) {
            const ex = existingByKey[0];
            const isAddon = (Number(ex.round_number) || 1) > 1;
            return {
              success: true,
              order_id: ex.id,
              primary_order_id: ex.parent_order_id || ex.id,
              session_id: ex.session_id,
              round_number: Number(ex.round_number) || 1,
              is_addon: isAddon,
              status: ex.status,
              table_number: cleanTable,
              total_amount: Number(ex.total_amount),
              distance_meters: ex.distance_meters,
              message: isAddon
                ? `🎉 Round ${ex.round_number} (Add-on Order #${ex.id}) placed for Table #${cleanTable}!`
                : `🎉 Order #${ex.id} placed successfully for Table #${cleanTable}!`
            };
          }
        }

        // 🛡️ Step C: Distributed Rapid Multi-Tap / Duplicate Submission Guard (3-Second Window inside Lock)
        const threeSecAgo = new Date(Date.now() - 3000).toISOString();
        const recentOrder = await txQuery(`
          SELECT id, total_amount, created_at, session_id, round_number, parent_order_id, status, distance_meters
          FROM orders
          WHERE restaurant_id = $1 AND table_number = $2 AND created_at >= $3
          ORDER BY id DESC LIMIT 1
        `, [targetId, cleanTable, threeSecAgo]);

        if (recentOrder && recentOrder.length > 0) {
          const prev = recentOrder[0];
          if (Number(prev.total_amount) === serverVerifiedTotal) {
            const isAddon = (Number(prev.round_number) || 1) > 1;
            return {
              success: true,
              order_id: prev.id,
              primary_order_id: prev.parent_order_id || prev.id,
              session_id: prev.session_id,
              round_number: Number(prev.round_number) || 1,
              is_addon: isAddon,
              status: prev.status || 'pending',
              table_number: cleanTable,
              total_amount: Number(prev.total_amount),
              distance_meters: prev.distance_meters,
              message: isAddon
                ? `🎉 Round ${prev.round_number} (Add-on Order #${prev.id}) placed for Table #${cleanTable}!`
                : `🎉 Order #${prev.id} placed successfully for Table #${cleanTable}!`
            };
          }
        }

        // Step D: Open Orders Detection (Atomically under Lock)
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        let openOrders = [];
        try {
          openOrders = await txQuery(`
            SELECT id, session_id, round_number, customer_name, customer_phone, items, total_amount, status
            FROM orders
            WHERE restaurant_id = $1 AND table_number = $2 
              AND status IN ('pending', 'preparing', 'kitchen', 'accepted', 'served') 
              AND (is_settled = 0 OR is_settled IS NULL)
              AND created_at >= $3
            ORDER BY id ASC
          `, [targetId, cleanTable, twelveHoursAgo]);
        } catch (openErr) {
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS round_number INT DEFAULT 1'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id INT'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_settled INT DEFAULT 0'); } catch (e) {}
          openOrders = await txQuery(`
            SELECT id, session_id, round_number, customer_name, customer_phone, items, total_amount, status
            FROM orders
            WHERE restaurant_id = $1 AND table_number = $2 
              AND status IN ('pending', 'preparing', 'kitchen', 'accepted', 'served') 
              AND (is_settled = 0 OR is_settled IS NULL)
              AND created_at >= $3
            ORDER BY id ASC
          `, [targetId, cleanTable, twelveHoursAgo]);
        }

        let sessionId = null;
        let roundNumber = 1;
        let parentOrderId = null;
        let customerName = String(customer_name || 'Dine-In Customer').trim().substring(0, 100);
        let customerPhone = String(customer_phone || '').trim().substring(0, 30);
        const isAddonOrder = openOrders.length > 0;

        if (isAddonOrder) {
          const primaryOrder = openOrders[0];
          sessionId = primaryOrder.session_id || `sess_${targetId}_${cleanTable}_${primaryOrder.id}`;
          parentOrderId = primaryOrder.id;
          customerName = primaryOrder.customer_name || customerName;
          customerPhone = primaryOrder.customer_phone || customerPhone;

          const maxRound = openOrders.reduce((max, o) => Math.max(max, Number(o.round_number) || 1), 1);
          roundNumber = maxRound + 1;

          if (!primaryOrder.session_id) {
            try {
              await txQuery('UPDATE orders SET session_id = $1 WHERE id = $2', [sessionId, primaryOrder.id]);
            } catch (e) {}
          }
        } else {
          sessionId = `sess_${targetId}_${cleanTable}_${Date.now()}`;
          roundNumber = 1;
          parentOrderId = null;
        }

        // Tag each verified item with this specific cooking round
        const taggedItems = verifiedItems.map(item => ({
          ...item,
          round: roundNumber,
          ordered_at: new Date().toISOString()
        }));

        const itemsJson = JSON.stringify(taggedItems);
        const createdAt = new Date().toISOString();
        const finalTotal = serverVerifiedTotal > 0 ? serverVerifiedTotal : (Number(total_amount) || 0);
        const storedIdempKey = customIdempKey ? String(customIdempKey).trim().substring(0, 100) : null;

        let result = null;
        try {
          result = await txQuery(`
            INSERT INTO orders (
              restaurant_id, table_number, customer_name, customer_phone, items, total_amount, status, sent_to_kds, created_at,
              customer_latitude, customer_longitude, customer_accuracy, distance_meters,
              session_id, round_number, parent_order_id, is_settled, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id
          `, [
            targetId,
            cleanTable,
            customerName,
            customerPhone,
            itemsJson,
            finalTotal,
            'pending',
            0,
            createdAt,
            customer_latitude !== undefined && customer_latitude !== null ? Number(customer_latitude) : null,
            customer_longitude !== undefined && customer_longitude !== null ? Number(customer_longitude) : null,
            customer_accuracy !== undefined && customer_accuracy !== null ? Number(customer_accuracy) : null,
            distanceMetersValue !== null && !isNaN(Number(distanceMetersValue)) ? Number(distanceMetersValue) : null,
            sessionId,
            roundNumber,
            parentOrderId,
            0,
            storedIdempKey
          ]);
        } catch (insertErr) {
          console.warn('Auto-healing columns on order insertion:', insertErr.message);
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS round_number INT DEFAULT 1'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id INT'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_settled INT DEFAULT 0'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_kds INT DEFAULT 0'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_prepared INT DEFAULT 0'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_latitude DECIMAL(10, 8)'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_longitude DECIMAL(11, 8)'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_accuracy INT'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance_meters INT'); } catch (e) {}
          try { await txQuery('ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128)'); } catch (e) {}

          result = await txQuery(`
            INSERT INTO orders (
              restaurant_id, table_number, customer_name, customer_phone, items, total_amount, status, sent_to_kds, created_at,
              session_id, round_number, parent_order_id, is_settled, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
          `, [
            targetId,
            cleanTable,
            customerName,
            customerPhone,
            itemsJson,
            finalTotal,
            'pending',
            0,
            createdAt,
            sessionId,
            roundNumber,
            parentOrderId,
            0,
            storedIdempKey
          ]);
        }

        const orderId = result[0]?.id || result.lastInsertRowid;

        return {
          success: true,
          order_id: orderId,
          primary_order_id: parentOrderId || orderId,
          session_id: sessionId,
          round_number: roundNumber,
          is_addon: isAddonOrder,
          status: 'pending',
          table_number: cleanTable,
          total_amount: finalTotal,
          distance_meters: distanceMetersValue,
          message: isAddonOrder
            ? `🎉 Round ${roundNumber} (Add-on Order #${orderId}) placed for Table #${cleanTable}!`
            : `🎉 Order #${orderId} placed successfully for Table #${cleanTable}!`
        };
      });

      orderIdempotencyCache.set(idempKey, { timestamp: Date.now(), response: responsePayload });
      executionResolve(responsePayload);
      orderInFlightMutex.delete(idempKey);

      res.json(responsePayload);
    } catch (innerErr) {
      orderInFlightMutex.delete(idempKey);
      executionReject(innerErr);
      throw innerErr;
    }
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET Track Order Status (Public Customer Route)
router.get('/orders/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await query('SELECT id, session_id, round_number, parent_order_id, table_number, customer_name, status, kitchen_prepared, sent_to_kds, total_amount, items, created_at FROM orders WHERE id = $1', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orders[0];
    let parsedItems = [];
    if (typeof order.items === 'string') {
      try { parsedItems = JSON.parse(order.items); } catch (e) { parsedItems = []; }
    } else if (Array.isArray(order.items)) {
      parsedItems = order.items;
    }
    res.json({
      ...order,
      items: parsedItems
    });
  } catch (err) {
    console.error('Track order error:', err);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// GET Active Table Order Sync (Consolidates active session items & round history)
router.get('/orders/active-table', async (req, res) => {
  try {
    const { slug, table_number } = req.query;
    if (!table_number) return res.json(null);
    const resto = await resolveRestaurant(req, slug);
    if (!resto) return res.status(404).json({ error: 'Restaurant not found' });
    const targetId = resto.id;

    let orders = [];
    try {
      orders = await query(`
        SELECT id, session_id, round_number, parent_order_id, table_number, customer_name, status, kitchen_prepared, sent_to_kds, total_amount, items, created_at
        FROM orders
        WHERE restaurant_id = $1 AND table_number = $2 AND status IN ('pending', 'preparing', 'kitchen', 'accepted', 'served') AND (is_settled = 0 OR is_settled IS NULL)
        ORDER BY id ASC
      `, [targetId, String(table_number).trim()]);
    } catch (e) {
      orders = await query(`
        SELECT id, table_number, customer_name, status, kitchen_prepared, sent_to_kds, total_amount, items, created_at
        FROM orders
        WHERE restaurant_id = $1 AND table_number = $2 AND status IN ('pending', 'preparing', 'kitchen', 'accepted', 'served')
        ORDER BY id ASC
      `, [targetId, String(table_number).trim()]);
    }

    if (orders.length === 0) return res.json(null);

    const primaryOrder = orders[0];
    const latestOrder = orders[orders.length - 1];

    let allItemsAcrossRounds = [];
    let runningGrandTotal = 0;

    const rounds = orders.map(o => {
      let rItems = [];
      if (typeof o.items === 'string') {
        try { rItems = JSON.parse(o.items); } catch (e) { rItems = []; }
      } else if (Array.isArray(o.items)) {
        rItems = o.items;
      }
      runningGrandTotal += Number(o.total_amount) || 0;
      allItemsAcrossRounds.push(...rItems);

      return {
        id: o.id,
        round_number: Number(o.round_number) || 1,
        status: o.status,
        kitchen_prepared: o.kitchen_prepared,
        sent_to_kds: o.sent_to_kds,
        total_amount: o.total_amount,
        items: rItems,
        created_at: o.created_at
      };
    });

    res.json({
      id: primaryOrder.id,
      latest_order_id: latestOrder.id,
      session_id: primaryOrder.session_id || `sess_${targetId}_${primaryOrder.table_number}_${primaryOrder.id}`,
      table_number: primaryOrder.table_number,
      customer_name: primaryOrder.customer_name,
      status: latestOrder.status,
      current_round: Number(latestOrder.round_number) || 1,
      total_amount: runningGrandTotal,
      items: allItemsAcrossRounds,
      rounds
    });
  } catch (err) {
    console.error('Active table order fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch active table order' });
  }
});

// POST Create Waiter Call / Service Request
router.post('/service-requests', serviceRequestRateLimiter, async (req, res) => {
  try {
    const { slug, table_number, request_type, note } = req.body;
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const cleanTable = String(table_number || '').trim();
    const cleanType = String(request_type || '').trim();
    const cleanNote = String(note || '').trim().substring(0, 255);

    if (!cleanTable || !cleanType || cleanTable.length > 20 || cleanType.length > 50) {
      return res.status(400).json({ error: 'Table number and request type are required and must be valid' });
    }

    const result = await query(`
      INSERT INTO service_requests (restaurant_id, table_number, request_type, note, status)
      VALUES ($1, $2, $3, $4, 'pending') RETURNING id
    `, [resto.id, cleanTable, cleanType, cleanNote]);

    const requestId = result[0]?.id || result.lastInsertRowid;

    res.json({
      success: true,
      request_id: requestId,
      message: `🛎️ Staff notified for Table ${cleanTable}! A waiter will attend shortly.`
    });
  } catch (err) {
    console.error('Create service request error:', err);
    res.status(500).json({ error: 'Failed to notify staff' });
  }
});

// GET /api/kitchen/orders - Dedicated KDS route per restaurant slug (Strict Multi-Tenant Isolation)
router.get('/kitchen/orders', async (req, res) => {
  try {
    const { slug } = req.query;
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check SaaS Plan permissions for kds_enabled
    const planTierKey = (resto.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT kds_enabled FROM saas_plans WHERE LOWER(key) = $1', [planTierKey]);
    const saasPlan = planRows[0] || {};
    const kdsPlanEnabled = saasPlan.kds_enabled !== undefined && saasPlan.kds_enabled !== null
      ? (saasPlan.kds_enabled === 1 || saasPlan.kds_enabled === true || saasPlan.kds_enabled === '1')
      : true;

    if (!kdsPlanEnabled) {
      return res.status(403).json({ error: 'KDS_DISABLED', message: 'Kitchen Display System (KDS) is disabled on your SaaS plan tier.' });
    }

    const targetId = resto.id;

    const orders = await query(`
      SELECT * FROM orders
      WHERE restaurant_id = $1
        AND status IN ('kitchen', 'preparing')
        AND (kitchen_prepared IS NULL OR kitchen_prepared = 0)
      ORDER BY id ASC LIMIT 50
    `, [targetId]);

    const formatted = orders.map(o => {
      let parsedItems = [];
      if (typeof o.items === 'string') {
        try { parsedItems = JSON.parse(o.items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(o.items)) {
        parsedItems = o.items;
      }
      return {
        ...o,
        items: parsedItems
      };
    });

    res.json({
      success: true,
      restaurant: { id: targetId, name: resto.name, slug: resto.slug },
      orders: formatted
    });
  } catch (err) {
    console.error('Fetch kitchen orders error:', err);
    res.status(500).json({ error: 'Failed to fetch kitchen orders' });
  }
});

// PATCH /api/kitchen/orders/:id/complete - Mark order food prepared from /kitchen page (Tenant Scoped)
router.patch('/kitchen/orders/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { slug } = req.query;
    const numericId = parseInt(id, 10);
    const orderId = isNaN(numericId) ? id : numericId;

    let targetId = null;
    if (slug && typeof slug === 'string' && slug.trim() !== '') {
      const restos = await query('SELECT id FROM restaurants WHERE LOWER(slug) = $1', [slug.trim().toLowerCase()]);
      if (restos && restos.length > 0) targetId = restos[0].id;
    }

    // Set kitchen_prepared=1 so it disappears from KDS and admin gets notified
    if (targetId) {
      await query(
        'UPDATE orders SET kitchen_prepared = 1 WHERE id = $1 AND restaurant_id = $2',
        [orderId, targetId]
      );
    } else {
      // No slug provided - update by id only (fallback)
      await query(
        'UPDATE orders SET kitchen_prepared = 1 WHERE id = $1',
        [orderId]
      );
    }

    res.json({ success: true, id: orderId, kitchen_prepared: 1 });
  } catch (err) {
    console.error('Mark kitchen prepared error:', err);
    res.status(500).json({ error: 'Failed to mark kitchen prepared' });
  }
});

// POST /api/register/pre-validate - Validate form inputs & username/phone availability BEFORE payment
router.post('/register/pre-validate', async (req, res) => {
  try {
    const { name, phone, owner_username, owner_password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Restaurant Name is required!' });
    }

    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Mobile Number (e.g. 9876543210)!' });
    }

    if (!owner_username || !owner_username.trim()) {
      return res.status(400).json({ error: 'Owner Username is required!' });
    }

    if (!owner_password || owner_password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long!' });
    }

    // Check if phone or owner username is already taken
    const phoneCheck = await query('SELECT id FROM restaurants WHERE phone = $1', [cleanPhone]);
    if (phoneCheck.length > 0) {
      return res.status(400).json({ error: `Mobile number '${phone}' is already registered with another restaurant!` });
    }

    const adminCheck = await query('SELECT id FROM admins WHERE username = $1', [owner_username.trim()]);
    if (adminCheck.length > 0) {
      return res.status(400).json({ error: `Username '${owner_username}' is already taken! Please choose a different username.` });
    }

    res.json({ valid: true, cleanPhone, owner_username: owner_username.trim() });
  } catch (err) {
    console.error('Registration pre-validation error:', err);
    res.status(500).json({ error: 'Registration validation failed' });
  }
});



// POST /api/register - Public Self-Service 14-Day Free Trial Signup for Restaurants
// Hardened with Atomic Database Transaction & Backend Authoritative Plan Resolution
router.post('/register', registrationRateLimiter, async (req, res) => {
  try {
    const { name, phone, owner_username, owner_password, plan_tier, owner_name } = req.body;

    if (!name || !phone || !owner_username || !owner_password) {
      return res.status(400).json({ error: 'Restaurant Name, Mobile Number, Username, and Password are required!' });
    }

    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'A valid 10-digit Mobile Number is compulsory for registration!' });
    }

    if (owner_password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long!' });
    }

    // Generate clean slug from restaurant name
    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-');

    if (!baseSlug || baseSlug.length < 2) {
      baseSlug = 'resto-' + Math.floor(1000 + Math.random() * 9000);
    }

    // Ensure slug uniqueness
    let cleanSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await query('SELECT id FROM restaurants WHERE slug = $1', [cleanSlug]);
      if (existing.length === 0) break;
      cleanSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Check if phone or owner username is already taken
    const phoneCheck = await query('SELECT id FROM restaurants WHERE phone = $1', [cleanPhone]);
    if (phoneCheck.length > 0) {
      return res.status(400).json({ error: `Mobile number '${phone}' is already registered with another restaurant!` });
    }

    const adminCheck = await query('SELECT id FROM admins WHERE username = $1', [owner_username.trim()]);
    if (adminCheck.length > 0) {
      return res.status(400).json({ error: `Username '${owner_username}' is already taken! Please choose a different username.` });
    }

    const selectedPlanKey = (plan_tier || 'pro').toLowerCase();

    // Run atomic multi-table registration inside database transaction
    const result = await withTransaction(async (txQuery) => {
      // Resolve authoritative plan details from backend saas_plans DB
      const planRows = await txQuery('SELECT * FROM saas_plans WHERE key = $1', [selectedPlanKey]);
      const dbPlan = planRows[0] || {
        id: 2,
        key: 'pro',
        name: 'Pro Luxury Plan',
        price: 999
      };

      const now = new Date();
      const trialDaysRow = await txQuery("SELECT value FROM system_settings WHERE key = 'default_trial_days'");
      const trialDays = Math.max(1, parseInt(trialDaysRow[0]?.value || '16', 10));
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const nowISO = now.toISOString();
      const expiryDateISO = trialEnd.toISOString();

      // Check if Super Admin approval is required for new signups
      const approvalSetting = await txQuery("SELECT value FROM system_settings WHERE key = 'require_registration_approval'");
      const requireApproval = (approvalSetting && approvalSetting.length > 0)
        ? (approvalSetting[0].value === '1' || approvalSetting[0].value === 'true')
        : false;

      const isActive = !requireApproval;

      // 1. Create Restaurant Record (mandate_status='pending', auto_debit_enabled=0, onboarding_completed=false)
      const restoRes = await txQuery(`
        INSERT INTO restaurants (
          name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, trial_started_at, trial_ends_at, whatsapp_number, theme_color, active, total_tables, mandate_status, auto_debit_enabled, onboarding_completed, location_initialized, owner_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING id
      `, [
        name.trim(),
        cleanSlug,
        '100% Fresh & Authentic Food',
        '/images/default-logo.webp',
        cleanPhone,
        '',
        '8:00 AM - 10:30 PM',
        dbPlan.key,
        dbPlan.price,
        expiryDateISO,
        nowISO,
        expiryDateISO,
        cleanPhone,
        'gold',
        isActive ? 1 : 0,
        0,
        'pending',
        0,
        false,
        false,
        (owner_name || '').trim()
      ]);

      const newRestoId = restoRes[0]?.id || restoRes.lastInsertRowid;

      // 2. Create Subscriptions Record (Resolving saas_plans.id, gateway='none', status='trialing')
      await txQuery(`
        INSERT INTO subscriptions (
          restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle, trial_start, trial_end, current_period_start, current_period_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        newRestoId,
        dbPlan.id,
        'none',
        'trialing',
        dbPlan.price,
        'INR',
        'monthly',
        nowISO,
        expiryDateISO,
        nowISO,
        expiryDateISO
      ]);

      // 3. Create Owner Admin Account
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(owner_password, salt);

      const adminRes = await txQuery(`
        INSERT INTO admins (restaurant_id, username, password_hash, role)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [newRestoId, owner_username.trim(), hash, 'restaurant_admin']);

      const adminId = adminRes[0]?.id || adminRes.lastInsertRowid;

      return {
        newRestoId,
        adminId,
        cleanSlug,
        isActive
      };
    });

    // 4. Clean Fresh Start (No demo categories or dishes seeded)

    // 5. Generate JWT Auth Token for automatic login
    const token = jwt.sign(
      {
        id: result.adminId,
        username: owner_username.trim(),
        role: 'restaurant_admin',
        restaurant_id: result.newRestoId,
        slug: result.cleanSlug
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      pending_approval: !result.isActive,
      token,
      slug: result.cleanSlug,
      restaurant: {
        id: result.newRestoId,
        name: name.trim(),
        slug: result.cleanSlug,
        plan_tier: selectedPlanKey,
        active: result.isActive,
        onboarding_completed: false,
        location_initialized: false
      },
      message: !result.isActive
        ? `⏳ Registration Submitted! Your restaurant '${name.trim()}' is pending Super Admin verification and approval.`
        : '🎉 Congratulations! Your 14-Day Free Trial has been activated successfully.'
    });
  } catch (err) {
    console.error('Self-service registration error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete registration' });
  }
});

// POST /api/auth/exchange - Single-Use Authorization Code Exchange for JWT

router.post(['/auth/exchange', '/api/auth/exchange'], authExchangeRateLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    const result = await exchangeAuthCode(code);
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    console.error('Auth code exchange error:', err);
    res.status(500).json({ error: 'Failed to exchange authorization code' });
  }
});

// GET /api/cron/subscription-check - Secure Vercel Cron Endpoint for Subscription Maintenance

router.get(['/cron/subscription-check', '/api/cron/subscription-check'], async (req, res) => {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);

  if (cronSecret) {
    const authHeader = req.headers['authorization'] || '';
    const cronHeader = req.headers['x-cron-secret'] || '';

    const isBearerValid = authHeader === `Bearer ${cronSecret}`;
    const isHeaderValid = cronHeader === cronSecret;

    if (!isBearerValid && !isHeaderValid) {
      console.warn(`⚠️ [CRON DENIED] Unauthorized cron attempt from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid cron authorization credentials' });
    }
  } else if (isProduction) {
    console.error('⚠️ [CRON ERROR] CRON_SECRET is missing in production environment variables.');
    return res.status(500).json({ error: 'CRON_SECRET environment variable is not configured' });
  }

  try {
    const startTime = Date.now();
    await checkExpiredSubscriptions();
    const durationMs = Date.now() - startTime;
    console.log(`✅ [VERCEL CRON SUCCESS] Subscription maintenance completed in ${durationMs}ms`);

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
      message: 'Subscription maintenance completed successfully'
    });
  } catch (err) {
    console.error('❌ [VERCEL CRON ERROR] Maintenance execution failed:', err.message);
    res.status(500).json({ error: 'Failed to execute subscription maintenance' });
  }
});

export default router;
