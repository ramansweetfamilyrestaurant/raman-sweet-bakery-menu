import express from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

import jwt from 'jsonwebtoken';

const router = express.Router();
const settingsPath = path.resolve('server/settings.json');
const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

// Helper to resolve target restaurant by JWT token or slug (or fallback to primary raman-sweet-bakery)
async function resolveRestaurant(req, slug) {
  // 1. Check if token in Authorization header
  if (req && req.headers && req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.restaurant_id) {
          const restos = await query('SELECT * FROM restaurants WHERE id = $1', [decoded.restaurant_id]);
          if (restos && restos.length > 0) return restos[0];
        }
      }
    } catch (e) {}
  }

  // 2. Check slug parameter
  const targetSlug = slug || 'raman-sweet-bakery';
  const restos = await query('SELECT * FROM restaurants WHERE slug = $1', [targetSlug]);
  if (restos && restos.length > 0) {
    return restos[0];
  }

  // 3. Fallback to first restaurant
  const firstResto = await query('SELECT * FROM restaurants ORDER BY id ASC LIMIT 1');
  return firstResto[0] || null;
}

// Restaurant General Info (/api/info or /api/info?slug=royal-pizza)
router.get('/info', async (req, res) => {
  try {
    const { slug } = req.query;
    const resto = await resolveRestaurant(req, slug);

    if (resto) {
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
        logo: resto.logo || '/uploads/logo.jpg',
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
        theme_color: resto.theme_color || 'gold',
        scan_count: resto.scan_count || 0,
        active: resto.active !== false
      });
    }
  } catch (err) {
    console.error('Error fetching restaurant info:', err);
  }

  // Fallback settings
  res.json({
    id: 1,
    name: 'Raman Sweet Bakery & Family Restaurant',
    slug: 'raman-sweet-bakery',
    tagline: '100% Pure Vegetarian • Pure Desi Ghee Sweets • Live Bakery',
    badge: '100% Pure Veg',
    logo: '/uploads/logo.jpg',
    openingHours: '8:00 AM - 10:30 PM (Mon - Sun)',
    phone: '+91 9708366583',
    address: 'HawaiAdda Chowk, Near katchari Gumti, Motihari, Bihar',
    google_review_url: 'https://share.google/2M5mFMPlmS6pAXRf7',
    filters_visibility: { must_try: true, combo: true, special: true, under100: true },
    plan_tier: 'pro',
    plan_price: 999,
    theme_color: 'gold',
    active: true
  });
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
      targetId = resto?.id || 1;
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
      targetId = resto?.id || 1;
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
      } else if (trimmedQ === 'must_try' || trimmedQ === 'must try') {
        sql += ` AND d.badge LIKE '%Must Try%'`;
      } else if (trimmedQ === 'combo') {
        sql += ` AND d.badge LIKE '%Combo%'`;
      } else if (trimmedQ === 'special') {
        sql += ` AND d.badge LIKE '%Special%'`;
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

// POST Create Direct Table Order (KOT Order)
router.post('/orders', async (req, res) => {
  try {
    const { slug, table_number, customer_name, customer_phone, items, total_amount } = req.body;
    const resto = await resolveRestaurant(req, slug);
    const targetId = resto?.id || 1;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const itemsJson = typeof items === 'object' ? JSON.stringify(items) : items;

    const result = await query(`
      INSERT INTO orders (
        restaurant_id, table_number, customer_name, customer_phone, items, total_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [
      targetId,
      table_number || '1',
      customer_name || 'Dine-In Customer',
      customer_phone || '',
      itemsJson,
      total_amount || 0,
      'pending'
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

export default router;
