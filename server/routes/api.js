import express from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

import jwt from 'jsonwebtoken';

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
        total_tables: resto.total_tables || 12,
        order_retention_days: resto.order_retention_days || 7,
        active: (resto.active === 1 || resto.active === true || resto.active === '1')
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
    let restaurantId = 1;
    if (slug) {
      const rows = await query('SELECT id FROM restaurants WHERE slug = $1', [slug]);
      if (rows.length > 0) restaurantId = rows[0].id;
    }
    const combos = await query('SELECT * FROM combos WHERE restaurant_id = $1 AND available = $2 ORDER BY sort_order ASC, id DESC', [restaurantId, 1]);
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

// GET Active Table Order Sync (Multi-Device Sync for same table)
router.get('/orders/active-table', async (req, res) => {
  try {
    const { slug, table_number } = req.query;
    if (!table_number) {
      return res.json(null);
    }
    const resto = await resolveRestaurant(req, slug);
    const targetId = resto?.id || 1;

    const orders = await query(`
      SELECT id, table_number, status, total_amount, items, created_at
      FROM orders
      WHERE restaurant_id = $1 AND table_number = $2 AND status IN ('pending', 'preparing', 'served')
      ORDER BY id DESC LIMIT 1
    `, [targetId, String(table_number)]);

    if (orders.length === 0) {
      return res.json(null);
    }

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

    // 1. Generate clean slug from restaurant name
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

    // Check if owner username is taken
    const adminCheck = await query('SELECT id FROM admins WHERE username = $1', [owner_username.trim()]);
    if (adminCheck.length > 0) {
      return res.status(400).json({ error: `Username '${owner_username}' is already taken! Please choose a different username.` });
    }

    // 2. Set 14-Day Free Trial expiry date
    const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const selectedPlan = plan_tier || 'pro';
    const planPrice = selectedPlan === 'basic' ? 499 : selectedPlan === 'enterprise' ? 1999 : 999;

    // Check if Super Admin approval is required for new signups
    const approvalSetting = await query("SELECT value FROM system_settings WHERE key = 'require_registration_approval'");
    const requireApproval = (approvalSetting && approvalSetting.length > 0)
      ? (approvalSetting[0].value === '1' || approvalSetting[0].value === 'true')
      : true; // Default: Super Admin Approval Required!

    const isActive = !requireApproval;

    // 3. Create Restaurant Record
    const restoRes = await query(`
      INSERT INTO restaurants (
        name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, whatsapp_number, theme_color, active, total_tables
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id
    `, [
      name.trim(),
      cleanSlug,
      '100% Fresh & Authentic Food',
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80',
      phone || '',
      'Main Market Street, City Center',
      '8:00 AM - 10:30 PM',
      selectedPlan,
      planPrice,
      expiryDate,
      phone || '',
      'gold',
      isActive ? 1 : 0,
      12
    ]);

    const newRestoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    // 4. Create Owner Admin Account
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(owner_password, salt);

    const adminRes = await query(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [newRestoId, owner_username.trim(), hash, 'restaurant_admin']);

    const adminId = adminRes[0]?.id || adminRes.lastInsertRowid;

    // 5. Seed Starter Categories & Starter Dishes for instant ready-to-use menu
    try {
      const cat1 = await query('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
        newRestoId, '⭐ Special Starters', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80', 1
      ]);
      const cat2 = await query('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
        newRestoId, '🍛 Main Course & Thalis', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80', 2
      ]);
      const cat3 = await query('INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id', [
        newRestoId, '🥤 Beverages & Shakes', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=500&auto=format&fit=crop&q=80', 3
      ]);

      const cat1Id = cat1[0]?.id || cat1.lastInsertRowid;
      const cat2Id = cat2[0]?.id || cat2.lastInsertRowid;
      const cat3Id = cat3[0]?.id || cat3.lastInsertRowid;

      if (cat1Id) {
        await query('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, is_veg, must_try) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
          newRestoId, cat1Id, 'Crispy Paneer Tikka', 240, 'Juicy cottage cheese cubes marinated in spices and grilled in tandoor', 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=80', true, true
        ]);
      }
      if (cat2Id) {
        await query('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, is_veg, must_try) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [
          newRestoId, cat2Id, 'Royal Butter Paneer & Naan Thali', 290, 'Rich butter paneer gravy served with 2 butter naans, dal makhani, and rice', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80', true, true
        ]);
      }
      if (cat3Id) {
        await query('INSERT INTO dishes (restaurant_id, category_id, name, price, description, image, is_veg) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
          newRestoId, cat3Id, 'Cold Coffee with Ice Cream', 120, 'Creamy chilled coffee topped with dark chocolate and vanilla ice cream', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=80', true
        ]);
      }
    } catch (seedErr) {
      console.error('Starter menu seed error:', seedErr);
    }

    // 6. Generate JWT Auth Token for automatic login
    const token = jwt.sign(
      {
        id: adminId,
        username: owner_username.trim(),
        role: 'restaurant_admin',
        restaurant_id: newRestoId,
        slug: cleanSlug
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      pending_approval: !isActive,
      token,
      slug: cleanSlug,
      restaurant: {
        id: newRestoId,
        name: name.trim(),
        slug: cleanSlug,
        plan_tier: selectedPlan,
        plan_expires_at: expiryDate,
        active: isActive
      },
      message: !isActive
        ? `⏳ Registration Submitted! Your restaurant '${name.trim()}' is pending Super Admin verification and approval.`
        : '🎉 Congratulations! Your 14-Day Free Trial has been activated successfully.'
    });
  } catch (err) {
    console.error('Self-service registration error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete registration' });
  }
});

export default router;
