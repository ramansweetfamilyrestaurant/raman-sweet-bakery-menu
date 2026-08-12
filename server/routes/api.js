import express from 'express';
import fs from 'fs';
import path from 'path';
import { query, withTransaction, getDbType } from '../db.js';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();
const settingsPath = path.resolve('server/settings.json');
const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

// GET Database Debug & Diagnostics Endpoint
router.get('/debug-db', async (req, res) => {
  try {
    const isPg = Boolean(process.env.DATABASE_URL);
    const activeDbType = getDbType();
    const dishesCount = await query('SELECT count(*) as count FROM dishes');
    const restos = await query('SELECT id, name, slug, active FROM restaurants LIMIT 10');
    res.json({
      status: 'OK',
      hasDATABASE_URLEnv: isPg,
      activeDbType: activeDbType,
      totalDishesCount: parseInt(dishesCount[0]?.count || 0, 10),
      restaurants: restos
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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



// Helper to resolve target restaurant by JWT token or slug (or fallback to primary raman-sweet-bakery)
// Helper to resolve target restaurant by slug or JWT token
async function resolveRestaurant(req, slug) {
  // 0. Check incoming Host header for custom domain mapping (e.g. menu.ramansweets.com)
  if (req && req.headers) {
    const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase().replace(/^www\./, '');
    if (rawHost && !rawHost.includes('touchqr') && !rawHost.includes('localhost') && !rawHost.includes('vercel.app') && !rawHost.includes('127.0.0.1')) {
      const domainRestos = await query('SELECT * FROM restaurants WHERE LOWER(custom_domain) = $1 OR LOWER(custom_domain) = $2', [rawHost, `www.${rawHost}`]);
      if (domainRestos && domainRestos.length > 0) {
        return domainRestos[0];
      }
    }
  }

  // 1. Check if JWT token is in Authorization header - ALWAYS PRIORITIZE LOGGED IN TOKEN FOR AUTHENTICATED REQUESTS!
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

  // 2. If no valid JWT token, check if an explicit valid slug parameter is passed in URL/query for public menu
  if (slug && typeof slug === 'string' && slug.trim() !== '') {
    const cleanSlug = slug.trim().toLowerCase();
    if (!['menu', 'default', 'null', 'undefined', 'home', 'index', 'api', 'kitchen'].includes(cleanSlug)) {
      const restos = await query('SELECT * FROM restaurants WHERE LOWER(slug) = $1', [cleanSlug]);
      if (restos && restos.length > 0) {
        return restos[0];
      }
    }
  }

  // 3. Fallback to primary default active restaurant (Raman Sweet Bakery / first active tenant in DB)
  const firstResto = await query("SELECT * FROM restaurants WHERE (active = true OR active IS NOT FALSE) ORDER BY id ASC LIMIT 1");
  return firstResto[0] || null;
}

// Restaurant General Info (/api/info or /api/info?slug=royal-pizz// GET Ultra-Fast Combined Menu Bundle (Single 0-latency HTTP call for complete Digital Menu)
router.get('/menu-bundle', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const { slug } = req.query;
    const resto = await resolveRestaurant(req, slug);

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

    // Asynchronously increment scan_count in background
    query('UPDATE restaurants SET scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1', [targetId]).catch(() => {});

    // Execute queries in parallel
    const [categories, dishes, combos] = await Promise.all([
      query('SELECT * FROM categories WHERE restaurant_id = $1 AND (active = true OR active IS NOT FALSE) ORDER BY sort_order ASC, id ASC', [targetId]),
      query(`
        SELECT d.*, c.name as category_name 
        FROM dishes d 
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE d.restaurant_id = $1 AND (d.available = true OR d.available IS NOT FALSE) AND (c.active = true OR c.active IS NOT FALSE OR c.id IS NULL)
        ORDER BY d.id ASC
      `, [targetId]),
      query('SELECT * FROM combos WHERE restaurant_id = $1 AND (active = true OR active IS NOT FALSE) ORDER BY id ASC', [targetId]).catch(() => [])
    ]);

    let filtersVis = resto.filters_visibility;
    if (typeof filtersVis === 'string') {
      try { filtersVis = JSON.parse(filtersVis); } catch (e) {}
    }
    if (!filtersVis) {
      filtersVis = { must_try: true, combo: true, special: true, under100: true };
    }

    const planRows = await query('SELECT watermark_removal_enabled, custom_domain_enabled, multi_language_enabled, analytics_export_enabled, gst_invoice_enabled, ai_review_enabled, google_reviews_enabled, bluetooth_kot_enabled, dual_printer_enabled FROM saas_plans WHERE key = $1', [resto.plan_tier || 'pro']).catch(() => []);
    const saasP = (planRows && planRows.length > 0) ? planRows[0] : {};
    const watermarkRemoval = saasP.watermark_removal_enabled !== undefined ? (saasP.watermark_removal_enabled === 1 || saasP.watermark_removal_enabled === true || saasP.watermark_removal_enabled === '1') : true;
    const customDomainEnabled = saasP.custom_domain_enabled !== undefined ? (saasP.custom_domain_enabled === 1 || saasP.custom_domain_enabled === true || saasP.custom_domain_enabled === '1') : true;
    const multiLanguageEnabled = saasP.multi_language_enabled !== undefined ? (saasP.multi_language_enabled === 1 || saasP.multi_language_enabled === true || saasP.multi_language_enabled === '1') : true;
    const analyticsExportEnabled = saasP.analytics_export_enabled !== undefined ? (saasP.analytics_export_enabled === 1 || saasP.analytics_export_enabled === true || saasP.analytics_export_enabled === '1') : true;
    const gstInvoiceEnabled = saasP.gst_invoice_enabled !== undefined ? (saasP.gst_invoice_enabled === 1 || saasP.gst_invoice_enabled === true || saasP.gst_invoice_enabled === '1') : true;
    const aiReviewEnabled = saasP.ai_review_enabled !== undefined ? (saasP.ai_review_enabled === 1 || saasP.ai_review_enabled === true || saasP.ai_review_enabled === '1') : true;
    const googleReviewsEnabled = saasP.google_reviews_enabled !== undefined ? (saasP.google_reviews_enabled === 1 || saasP.google_reviews_enabled === true || saasP.google_reviews_enabled === '1') : (resto.plan_tier !== 'basic');
    const bluetoothKotEnabled = saasP.bluetooth_kot_enabled !== undefined ? (saasP.bluetooth_kot_enabled === 1 || saasP.bluetooth_kot_enabled === true || saasP.bluetooth_kot_enabled === '1') : true;
    const dualPrinterEnabled = saasP.dual_printer_enabled !== undefined ? (saasP.dual_printer_enabled === 1 || saasP.dual_printer_enabled === true || saasP.dual_printer_enabled === '1') : (resto.plan_tier === 'enterprise' || resto.plan_tier === 'vip_ultra_plan');

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
      whatsapp_number: resto.whatsapp_number || resto.phone || '',
      active: true
    };

    res.json({
      info: infoObj,
      categories: categories || [],
      dishes: dishes || [],
      combos: combos || []
    });
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
    const resto = await resolveRestaurant(req, slug);

    if (!resto) {
      return res.status(404).json({
        error: 'Restaurant Not Found',
        notFound: true,
        requestedSlug: slug || ''
      });
    }

    const isActive = resto.active === 1 || resto.active === true || resto.active === '1' || resto.active === undefined;
    if (!isActive) {
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
    if (!filtersVis) {
      filtersVis = { must_try: true, combo: true, special: true, under100: true };
    }

    // Increment QR scan count silently if public customer request (no JWT token)
    if (!req.headers || !req.headers.authorization) {
      query('UPDATE restaurants SET scan_count = COALESCE(scan_count, 0) + 1 WHERE id = $1', [resto.id]).catch(() => {});
    }

    const planTierKey = (resto.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [planTierKey]);
    const saasPlan = planRows[0] || {};

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
    const kdsEnabled = saasPlan.kds_enabled !== undefined ? (saasPlan.kds_enabled === 1 || saasPlan.kds_enabled === true || saasPlan.kds_enabled === '1') : true;
    const bluetoothKotEnabled = saasPlan.bluetooth_kot_enabled !== undefined ? (saasPlan.bluetooth_kot_enabled === 1 || saasPlan.bluetooth_kot_enabled === true || saasPlan.bluetooth_kot_enabled === '1') : true;
    const dualPrinterEnabled = saasPlan.dual_printer_enabled !== undefined ? (saasPlan.dual_printer_enabled === 1 || saasPlan.dual_printer_enabled === true || saasPlan.dual_printer_enabled === '1') : (planTierKey === 'enterprise' || planTierKey === 'vip_ultra_plan');

    return res.json({
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
      plan_price: planPrice,
      plan_expires_at: resto.plan_expires_at || null,
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
      latitude: resto.latitude !== undefined && resto.latitude !== null ? Number(resto.latitude) : 26.6500,
      longitude: resto.longitude !== undefined && resto.longitude !== null ? Number(resto.longitude) : 84.9167,
      max_distance_meters: resto.max_distance_meters || 100,
      gst_enabled: resto.gst_enabled === 1 || resto.gst_enabled === true,
      gstin_number: resto.gstin_number || '',
      total_tables: resto.total_tables !== undefined && resto.total_tables !== null ? Number(resto.total_tables) : 0,
      order_retention_days: resto.order_retention_days || 7,
      custom_domain: resto.custom_domain || '',
      kds_screen_enabled: resto.kds_screen_enabled !== undefined && resto.kds_screen_enabled !== null ? Number(resto.kds_screen_enabled) : 1,
      active: true
    });
  } catch (err) {
    console.error('Error fetching restaurant info:', err);
    res.status(500).json({ error: 'Failed to fetch restaurant info' });
  }
});

// Get Active Global System Announcements
router.get('/announcements', async (req, res) => {
  try {
    const list = await query('SELECT * FROM announcements WHERE (active = true OR active IS NOT FALSE) ORDER BY id DESC LIMIT 5');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      sql += ' AND (active = true OR active IS NOT FALSE)';
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
      sql += ` AND (d.available = true OR d.available IS NOT FALSE) AND (c.active = true OR c.active IS NOT FALSE OR c.id IS NULL)`;
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

// POST Create Direct Table Order (KOT Order)
router.post('/orders', async (req, res) => {
  try {
    const { slug, table_number, customer_name, customer_phone, items, total_amount } = req.body;
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    const targetId = resto.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const itemsJson = typeof items === 'object' ? JSON.stringify(items) : items;
    const createdAt = new Date().toISOString();

    const result = await query(`
      INSERT INTO orders (
        restaurant_id, table_number, customer_name, customer_phone, items, total_amount, status, sent_to_kds, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [
      targetId,
      table_number || '1',
      customer_name || 'Dine-In Customer',
      customer_phone || '',
      itemsJson,
      total_amount || 0,
      'pending',
      0,
      createdAt
    ]);

    const orderId = result[0]?.id || result.lastInsertRowid;

    res.json({
      success: true,
      order_id: orderId,
      status: 'pending',
      table_number: table_number || '1',
      message: `🎉 Order #${orderId} placed successfully for Table #${table_number || '1'}!`
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET Track Order Status (Public Customer Route)
router.get('/orders/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await query('SELECT id, table_number, status, kitchen_prepared, sent_to_kds, total_amount, items, created_at FROM orders WHERE id = $1', [id]);
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

// GET Active Table Order Sync
router.get('/orders/active-table', async (req, res) => {
  try {
    const { slug, table_number } = req.query;
    if (!table_number) return res.json(null);
    const resto = await resolveRestaurant(req, slug);
    const targetId = resto?.id || 1;

    const orders = await query(`
      SELECT id, table_number, status, kitchen_prepared, sent_to_kds, total_amount, items, created_at
      FROM orders
      WHERE restaurant_id = $1 AND table_number = $2 AND status IN ('pending', 'preparing', 'kitchen', 'accepted', 'served')
      ORDER BY id DESC LIMIT 1
    `, [targetId, String(table_number)]);

    if (orders.length === 0) return res.json(null);

    const order = orders[0];
    let tableItems = [];
    if (typeof order.items === 'string') {
      try { tableItems = JSON.parse(order.items); } catch (e) { tableItems = []; }
    } else if (Array.isArray(order.items)) {
      tableItems = order.items;
    }
    res.json({
      ...order,
      items: tableItems
    });
  } catch (err) {
    console.error('Active table order fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch active table order' });
  }
});

// POST Create Waiter Call / Service Request
router.post('/service-requests', async (req, res) => {
  try {
    const { slug, table_number, request_type, note } = req.body;
    const resto = await resolveRestaurant(req, slug);
    if (!resto) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    if (!table_number || !request_type) {
      return res.status(400).json({ error: 'Table number and request type are required' });
    }

    const result = await query(`
      INSERT INTO service_requests (restaurant_id, table_number, request_type, note, status)
      VALUES ($1, $2, $3, $4, 'pending') RETURNING id
    `, [resto.id, String(table_number), request_type, note || '']);

    const requestId = result[0]?.id || result.lastInsertRowid;

    res.json({
      success: true,
      request_id: requestId,
      message: `🛎️ Staff notified for Table ${table_number}! A waiter will attend shortly.`
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
router.post('/register', async (req, res) => {
  try {
    const { name, phone, owner_username, owner_password, plan_tier } = req.body;

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
      const trialDays = Math.max(1, parseInt(trialDaysRow[0]?.value || '14', 10));
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const nowISO = now.toISOString();
      const expiryDateISO = trialEnd.toISOString();

      // Check if Super Admin approval is required for new signups
      const approvalSetting = await txQuery("SELECT value FROM system_settings WHERE key = 'require_registration_approval'");
      const requireApproval = (approvalSetting && approvalSetting.length > 0)
        ? (approvalSetting[0].value === '1' || approvalSetting[0].value === 'true')
        : false;

      const isActive = !requireApproval;

      // 1. Create Restaurant Record (mandate_status='pending', auto_debit_enabled=0)
      const restoRes = await txQuery(`
        INSERT INTO restaurants (
          name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, trial_started_at, trial_ends_at, whatsapp_number, theme_color, active, total_tables, mandate_status, auto_debit_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id
      `, [
        name.trim(),
        cleanSlug,
        '100% Fresh & Authentic Food',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80',
        cleanPhone,
        'Main Market Street, City Center',
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
        0
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

    // 4. Seed Starter Categories & Starter Dishes (outside transaction so errors don't cause transaction abort)
    try {
      const cat1 = await query('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
        result.newRestoId, '⭐ Special Starters', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', 1
      ]);
      const cat2 = await query('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
        result.newRestoId, '🍛 Main Course & Thalis', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80', 2
      ]);
      const cat3 = await query('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
        result.newRestoId, '🥤 Beverages & Shakes', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80', 3
      ]);

      const cat1Id = cat1[0]?.id || cat1.lastInsertRowid;
      const cat2Id = cat2[0]?.id || cat2.lastInsertRowid;
      const cat3Id = cat3[0]?.id || cat3.lastInsertRowid;

      if (cat1Id) {
        await query('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, available) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
          result.newRestoId, cat1Id, 'Crispy Paneer Tikka', 240, 'Juicy cottage cheese cubes marinated in spices and grilled in tandoor', 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=80', 1
        ]);
      }
      if (cat2Id) {
        await query('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, available) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
          result.newRestoId, cat2Id, 'Royal Butter Paneer & Naan Thali', 290, 'Rich butter paneer gravy served with 2 butter naans, dal makhani, and rice', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80', 1
        ]);
      }
      if (cat3Id) {
        await query('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, available) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
          result.newRestoId, cat3Id, 'Cold Coffee with Ice Cream', 120, 'Creamy chilled coffee topped with dark chocolate and vanilla ice cream', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=80', 1
        ]);
      }
    } catch (seedErr) {
      console.warn('Starter menu seed notice:', seedErr.message);
    }

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
        active: result.isActive
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

export default router;
