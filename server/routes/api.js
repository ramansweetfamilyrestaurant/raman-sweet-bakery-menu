import express from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db.js';

const router = express.Router();
const settingsPath = path.resolve('server/settings.json');

// Restaurant General Info
router.get('/info', (req, res) => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return res.json(JSON.parse(data));
    }
  } catch (err) {
    console.error('Error reading settings.json:', err);
  }

  res.json({
    name: 'Raman Sweet Bakery & Family Restaurant',
    tagline: '100% Pure Vegetarian • Pure Desi Ghee Sweets • Live Bakery',
    badge: '100% Pure Veg',
    logo: '/uploads/logo.jpg',
    openingHours: '8:00 AM - 10:30 PM (Mon - Sun)',
    phone: '+91 9708366583',
    address: 'HawaiAdda Chowk, Near katchari Gumti, Motihari, Bihar',
    google_review_url: 'https://share.google/2M5mFMPlmS6pAXRf7',
    highlights: [
      'Pure Desi Ghee Sweets',
      'Fresh Live Bakery & Custom Cakes',
      'Authentic Tandoori North Indian',
      'Traditional South Indian Dosa & Idli'
    ]
  });
});

// Get Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get Dishes with search & category filter
router.get('/dishes', async (req, res) => {
  try {
    const { q, category_id, admin_view } = req.query;

    let sql = `
      SELECT d.*, c.name as category_name 
      FROM dishes d 
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // By default, customer view only sees available dishes
    if (!admin_view) {
      sql += ` AND d.available IS TRUE`;
    }

    if (category_id && category_id !== 'all') {
      params.push(Number(category_id));
      sql += ` AND d.category_id = $${params.length}`;
    }

    if (q && q.trim() !== '') {
      const trimmedQ = q.trim().toLowerCase();
      if (trimmedQ === 'under100' || trimmedQ === '100' || trimmedQ === 'under 100') {
        sql += ` AND d.price <= 100`;
      } else if (trimmedQ === 'must try' || trimmedQ === 'musttry' || trimmedQ === 'must_try') {
        sql += ` AND LOWER(COALESCE(d.badge, '')) LIKE '%must try%'`;
      } else if (trimmedQ === 'combo') {
        sql += ` AND LOWER(COALESCE(d.badge, '')) LIKE '%combo%'`;
      } else if (trimmedQ === 'special') {
        sql += ` AND LOWER(COALESCE(d.badge, '')) LIKE '%special%'`;
      } else {
        const searchPattern = `%${trimmedQ}%`;
        params.push(searchPattern);
        const p1 = params.length;
        params.push(searchPattern);
        const p2 = params.length;
        params.push(searchPattern);
        const p3 = params.length;
        params.push(searchPattern);
        const p4 = params.length;
        params.push(searchPattern);
        const p5 = params.length;

        sql += ` AND (
          LOWER(d.name) LIKE $${p1} 
          OR LOWER(COALESCE(d.description, '')) LIKE $${p2} 
          OR LOWER(COALESCE(d.badge, '')) LIKE $${p3} 
          OR LOWER(COALESCE(d.ingredients, '')) LIKE $${p4} 
          OR LOWER(COALESCE(c.name, '')) LIKE $${p5}
        )`;
      }
    }

    sql += ` ORDER BY d.id DESC`;

    const dishes = await query(sql, params);

    // Normalize boolean / numeric availability
    const normalized = dishes.map(d => ({
      ...d,
      available: d.available === true || d.available === 1 || d.available === '1'
    }));

    res.json(normalized);
  } catch (err) {
    console.error('Error fetching dishes:', err);
    res.status(500).json({ error: 'Failed to fetch dishes' });
  }
});

export default router;
