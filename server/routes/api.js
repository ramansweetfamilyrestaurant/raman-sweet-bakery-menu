import express from 'express';
import fs from 'fs';
import path from 'path';
import { query, withTransaction } from '../db.js';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();
const settingsPath = path.resolve('server/settings.json');
const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

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

// POST validate coupon code
router.post('/coupons/validate', async (req, res) => {
  try {
    const { code, plan_tier, restaurant_id } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ valid: false, error: 'Coupon code is required' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const requestedTier = (plan_tier || 'pro').toLowerCase().trim();

    // 1. Authoritative Plan Resolution from Database saas_plans Table
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [requestedTier]);
    const dbPlan = planRows[0] || { price: 999, key: 'pro' };
    const originalAmount = Number(dbPlan.price) || 999;

    // 2. Fetch Coupon from Database
    const rows = await query(`
      SELECT * FROM coupons WHERE UPPER(code) = $1
    `, [normalizedCode]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid promo coupon code' });
    }

    const coupon = rows[0];
    const isActive = Boolean(coupon.is_active !== undefined ? coupon.is_active : (coupon.active !== undefined ? coupon.active : 1));

    if (!isActive) {
      return res.status(400).json({ valid: false, error: 'This coupon code is currently disabled' });
    }

    // 3. Expiry Checks (valid_from & valid_until)
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.status(400).json({ valid: false, error: 'This coupon is not active yet' });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.status(400).json({ valid: false, error: 'This coupon code has expired' });
    }

    // 4. Usage Limit Checks
    const maxTotal = Number(coupon.max_total_uses || coupon.max_uses || 100);
    const usedCount = Number(coupon.used_count || 0);
    if (maxTotal > 0 && usedCount >= maxTotal) {
      return res.status(400).json({ valid: false, error: 'Coupon total usage limit reached' });
    }

    // 5. Per-Restaurant Usage Check
    if (restaurant_id) {
      const redemptions = await query(`
        SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = $1 AND restaurant_id = $2
      `, [coupon.id, restaurant_id]);
      const restoRedeemedCount = Number(redemptions[0]?.count || 0);
      const maxPerResto = Number(coupon.max_uses_per_restaurant || 1);
      if (restoRedeemedCount >= maxPerResto) {
        return res.status(400).json({ valid: false, error: 'This coupon has already been used for this restaurant' });
      }
    }

    // 6. Plan Applicability Check
    const applicable = (coupon.applicable_plans || 'all').toLowerCase();
    if (applicable !== 'all' && !applicable.includes(requestedTier)) {
      return res.status(400).json({ valid: false, error: `This coupon is not applicable for the ${requestedTier.toUpperCase()} plan` });
    }

    // 7. Minimum Plan Amount Check
    const minAmount = Number(coupon.minimum_plan_amount || 0);
    if (minAmount > 0 && originalAmount < minAmount) {
      return res.status(400).json({ valid: false, error: `Minimum plan price of ₹${minAmount} required for this coupon` });
    }

    // 8. Server-side Discount Calculation
    const discountType = (coupon.discount_type || (coupon.discount_percent > 0 ? 'PERCENTAGE' : 'FIXED_AMOUNT')).toUpperCase();
    const discountValue = Number(coupon.discount_value || coupon.discount_percent || coupon.discount_amount || 0);

    let discountAmount = 0;
    if (discountType === 'PERCENTAGE') {
      const cappedPercent = Math.min(100, Math.max(0, discountValue));
      discountAmount = (originalAmount * cappedPercent) / 100;
    } else {
      discountAmount = Math.min(originalAmount, Math.max(0, discountValue));
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);

    res.json({
      valid: true,
      id: coupon.id,
      code: coupon.code,
      discount_type: discountType,
      discount_value: discountValue,
      original_amount: originalAmount,
      discount_amount: discountAmount,
      final_first_payment_amount: finalAmount,
      currency: 'INR',
      first_payment_only: Boolean(coupon.first_payment_only !== undefined ? coupon.first_payment_only : true),
      message: `Coupon '${coupon.code}' applied! Saved ₹${discountAmount} on your first paid month.`
    });
  } catch (err) {
    console.error('Validate coupon error:', err);
    res.status(500).json({ valid: false, error: 'Failed to validate coupon' });
  }
});

// Helper to resolve target restaurant by JWT token or slug (or fallback to primary raman-sweet-bakery)
// Helper to resolve target restaurant by slug or JWT token
async function resolveRestaurant(req, slug) {
  // 1. If an explicit slug parameter is passed in URL/query, prioritize searching by slug!
  if (slug && typeof slug === 'string' && slug.trim() !== '') {
    const restos = await query('SELECT * FROM restaurants WHERE slug = $1', [slug.trim()]);
    if (restos && restos.length > 0) {
      return restos[0];
    }
    // Explicit slug requested but restaurant DOES NOT exist in DB (deleted or invalid link) -> return null! DO NOT FALLBACK!
    return null;
  }

  // 2. If NO slug was specified in URL, check if JWT token is in Authorization header
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

  // 3. Fallback ONLY if NO slug parameter was provided at all (e.g. visiting bare domain root /)
  const firstResto = await query("SELECT * FROM restaurants WHERE slug = 'raman-sweet-bakery' OR id = 1 ORDER BY id ASC LIMIT 1");
  return firstResto[0] || null;
}

// Restaurant General Info (/api/info or /api/info?slug=royal-pizza)
router.get('/info', async (req, res) => {
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
      plan_price: resto.plan_price || 999,
      plan_expires_at: resto.plan_expires_at || null,
      whatsapp_number: resto.whatsapp_number || resto.phone || '',
      whatsapp_enabled: resto.whatsapp_enabled !== 0 && resto.whatsapp_enabled !== false,
      direct_ordering_enabled: resto.direct_ordering_enabled !== 0 && resto.direct_ordering_enabled !== false,
      google_reviews_enabled: resto.google_reviews_enabled !== 0 && resto.google_reviews_enabled !== false,
      theme_color: resto.theme_color || 'gold',
      scan_count: resto.scan_count || 0,
      latitude: resto.latitude !== undefined && resto.latitude !== null ? Number(resto.latitude) : 26.6500,
      longitude: resto.longitude !== undefined && resto.longitude !== null ? Number(resto.longitude) : 84.9167,
      max_distance_meters: resto.max_distance_meters || 100,
      gst_enabled: resto.gst_enabled === 1 || resto.gst_enabled === true,
      gstin_number: resto.gstin_number || '',
      total_tables: resto.total_tables !== undefined && resto.total_tables !== null ? Number(resto.total_tables) : 0,
      order_retention_days: resto.order_retention_days || 7,
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
    const list = await query('SELECT * FROM announcements WHERE active IS NOT FALSE ORDER BY id DESC LIMIT 5');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Categories for a specific restaurant
router.get('/categories', async (req, res) => {
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
      sql += ' AND active IS NOT FALSE';
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
      sql += ` AND d.available IS TRUE AND (c.active IS NOT FALSE OR c.id IS NULL)`;
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
    const combos = await query('SELECT * FROM combos WHERE restaurant_id = $1 AND (available = $2 OR available IS NULL) ORDER BY sort_order ASC, id DESC', [resto.id, 1]);
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
        restaurant_id, table_number, customer_name, customer_phone, items, total_amount, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [
      targetId,
      table_number || '1',
      customer_name || 'Dine-In Customer',
      customer_phone || '',
      itemsJson,
      total_amount || 0,
      'pending',
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
    const orders = await query('SELECT id, table_number, status, total_amount, items, created_at FROM orders WHERE id = $1', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orders[0];
    res.json({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
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
      SELECT id, table_number, status, total_amount, items, created_at
      FROM orders
      WHERE restaurant_id = $1 AND table_number = $2 AND status IN ('pending', 'preparing', 'served')
      ORDER BY id DESC LIMIT 1
    `, [targetId, String(table_number)]);

    if (orders.length === 0) return res.json(null);

    const order = orders[0];
    res.json({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
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
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const nowISO = now.toISOString();
      const expiryDateISO = trialEnd.toISOString();

      // Check if Super Admin approval is required for new signups
      const approvalSetting = await txQuery("SELECT value FROM system_settings WHERE key = 'require_registration_approval'");
      const requireApproval = (approvalSetting && approvalSetting.length > 0)
        ? (approvalSetting[0].value === '1' || approvalSetting[0].value === 'true')
        : false;

      const isActive = !requireApproval;

      // 1. Create Restaurant Record
      const restoRes = await txQuery(`
        INSERT INTO restaurants (
          name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, trial_started_at, trial_ends_at, whatsapp_number, theme_color, active, total_tables
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id
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

      // 4. Seed Starter Categories & Starter Dishes
      try {
        const cat1 = await txQuery('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
          newRestoId, '⭐ Special Starters', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', 1
        ]);
        const cat2 = await txQuery('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
          newRestoId, '🍛 Main Course & Thalis', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80', 2
        ]);
        const cat3 = await txQuery('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
          newRestoId, '🥤 Beverages & Shakes', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80', 3
        ]);

        const cat1Id = cat1[0]?.id || cat1.lastInsertRowid;
        const cat2Id = cat2[0]?.id || cat2.lastInsertRowid;
        const cat3Id = cat3[0]?.id || cat3.lastInsertRowid;

        if (cat1Id) {
          await txQuery('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, available) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
            newRestoId, cat1Id, 'Crispy Paneer Tikka', 240, 'Juicy cottage cheese cubes marinated in spices and grilled in tandoor', 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=80', 1
          ]);
        }
        if (cat2Id) {
          await txQuery('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, available) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
            newRestoId, cat2Id, 'Royal Butter Paneer & Naan Thali', 290, 'Rich butter paneer gravy served with 2 butter naans, dal makhani, and rice', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80', 1
          ]);
        }
        if (cat3Id) {
          await txQuery('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, available) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
            newRestoId, cat3Id, 'Cold Coffee with Ice Cream', 120, 'Creamy chilled coffee topped with dark chocolate and vanilla ice cream', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=80', 1
          ]);
        }
      } catch (seedErr) {
        console.warn('Starter menu seed notice:', seedErr.message);
      }

      return {
        newRestoId,
        adminId,
        cleanSlug,
        isActive
      };
    });

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
