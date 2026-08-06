import express from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

const router = express.Router();
const settingsPath = path.resolve('server/settings.json');

// Helper to resolve target restaurant by slug (or fallback to primary raman-sweet-bakery)
async function resolveRestaurant(slug) {
  const targetSlug = slug || 'raman-sweet-bakery';
  const restos = await query('SELECT * FROM restaurants WHERE slug = $1', [targetSlug]);
  if (restos && restos.length > 0) {
    return restos[0];
  }
  // Fallback to first restaurant
  const firstResto = await query('SELECT * FROM restaurants ORDER BY id ASC LIMIT 1');
  return firstResto[0] || null;
}

// Restaurant General Info (/api/info or /api/info?slug=royal-pizza)
router.get('/info', async (req, res) => {
  try {
    const { slug } = req.query;
    const resto = await resolveRestaurant(slug);

    if (resto) {
      // Parse filters_visibility if stored as JSON string or object
      let filtersVis = resto.filters_visibility;
      if (typeof filtersVis === 'string') {
        try { filtersVis = JSON.parse(filtersVis); } catch (e) {}
      }
      if (!filtersVis) {
        filtersVis = { must_try: true, combo: true, special: true, under100: true };
      }

      return res.json({
        id: resto.id,
        name: resto.name,
        slug: resto.slug,
        tagline: resto.tagline || '100% Pure Vegetarian',
        badge: '100% Pure Veg',
        logo: resto.logo || '/uploads/logo.jpg',
        openingHours: resto.opening_hours || '8:00 AM - 10:30 PM (Mon - Sun)',
        phone: resto.phone || '+91 9708366583',
        address: resto.address || 'HawaiAdda Chowk, Near katchari Gumti, Motihari, Bihar',
        google_review_url: resto.google_review_url || '',
        google_maps_url: resto.google_maps_url || '',
        filters_visibility: filtersVis,
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
    active: true
  });
});

// Get Categories for a specific restaurant
router.get('/categories', async (req, res) => {
  try {
    const { admin_view, slug, restaurant_id } = req.query;
    let targetId = restaurant_id;

    if (!targetId) {
      const resto = await resolveRestaurant(slug);
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
      const resto = await resolveRestaurant(slug);
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
      } else {
        params.push(`%${trimmedQ}%`);
        const pIdx = params.length;
        sql += ` AND (LOWER(d.name) LIKE $${pIdx} OR LOWER(d.description) LIKE $${pIdx} OR LOWER(d.badge) LIKE $${pIdx})`;
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

export default router;
