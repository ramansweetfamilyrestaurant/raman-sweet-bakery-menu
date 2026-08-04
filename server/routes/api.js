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
    tagline: '100% Pure Vegetarian',
    badge: '100% Pure Veg',
    logo: '/uploads/logo.jpg',
    openingHours: '8:00 AM - 10:30 PM (Mon - Sun)',
    phone: '+91 98765 43210',
    address: 'Main Market Road, Near City Clock Tower, GT Road',
    google_review_url: 'https://g.page/r/ramansweetbakery/review',
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
      sql += ` AND d.available = 1`;
    }

    if (category_id && category_id !== 'all') {
      params.push(Number(category_id));
      sql += ` AND d.category_id = $${params.length}`;
    }

    if (q && q.trim() !== '') {
      const searchPattern = `%${q.trim().toLowerCase()}%`;
      params.push(searchPattern);
      const pNum1 = params.length;
      params.push(searchPattern);
      const pNum2 = params.length;

      sql += ` AND (LOWER(d.name) LIKE $${pNum1} OR LOWER(d.description) LIKE $${pNum2})`;
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
