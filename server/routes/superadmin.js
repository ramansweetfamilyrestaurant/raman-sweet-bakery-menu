import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

// Helper middleware to restrict endpoints to superadmin role only
function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Master Super Admin privileges required.' });
  }
}

// Super Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admins = await query("SELECT * FROM admins WHERE (username = $1 OR role = 'superadmin') AND role = 'superadmin'", [username]);
    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: 'Invalid Super Admin credentials' });
    }

    const admin = admins[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid Super Admin credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: 'superadmin', restaurant_id: admin.restaurant_id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, username: admin.username, role: 'superadmin' });
  } catch (err) {
    console.error('Super Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET All Tenant Restaurants with stats
router.get('/restaurants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const restaurants = await query('SELECT * FROM restaurants ORDER BY id DESC');
    const dishesCount = await query('SELECT restaurant_id, COUNT(*) as count FROM dishes GROUP BY restaurant_id');
    const adminsList = await query("SELECT id, restaurant_id, username FROM admins WHERE role = 'restaurant_admin'");

    const countMap = {};
    dishesCount.forEach(row => {
      countMap[row.restaurant_id] = parseInt(row.count || 0, 10);
    });

    const adminMap = {};
    adminsList.forEach(a => {
      adminMap[a.restaurant_id] = a.username;
    });

    const result = restaurants.map(r => ({
      ...r,
      dish_count: countMap[r.id] || 0,
      owner_username: adminMap[r.id] || 'N/A'
    }));

    res.json(result);
  } catch (err) {
    console.error('Fetch restaurants error:', err);
    res.status(500).json({ error: 'Failed to fetch tenant restaurants' });
  }
});

// POST Create New Tenant Restaurant
router.post('/restaurants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, owner_username, owner_password, phone, address, tagline } = req.body;

    if (!name || !slug || !owner_username || !owner_password) {
      return res.status(400).json({ error: 'Restaurant Name, URL Slug, Owner Username and Password are required' });
    }

    // Clean & sanitize slug (lowercase, hyphenated)
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Check if slug or username already exists
    const slugCheck = await query('SELECT * FROM restaurants WHERE slug = $1', [cleanSlug]);
    if (slugCheck.length > 0) {
      return res.status(400).json({ error: `URL Slug '${cleanSlug}' is already taken by another restaurant!` });
    }

    const adminCheck = await query('SELECT * FROM admins WHERE username = $1', [owner_username]);
    if (adminCheck.length > 0) {
      return res.status(400).json({ error: `Owner Username '${owner_username}' is already taken!` });
    }

    // 1. Create Restaurant Entry
    const restoRes = await query(`
      INSERT INTO restaurants (
        name, slug, tagline, logo, phone, address, opening_hours, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [
      name,
      cleanSlug,
      tagline || '100% Quality Food & Service',
      '/uploads/logo.jpg',
      phone || '',
      address || '',
      '8:00 AM - 10:30 PM',
      true
    ]);

    const newRestoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    // 2. Create Owner Admin User
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(owner_password, salt);

    await query(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES ($1, $2, $3, $4)
    `, [newRestoId, owner_username, hash, 'restaurant_admin']);

    res.json({
      success: true,
      id: newRestoId,
      slug: cleanSlug,
      message: `Tenant Restaurant '${name}' created successfully with slug '/r/${cleanSlug}'!`
    });
  } catch (err) {
    console.error('Create restaurant error:', err);
    res.status(500).json({ error: err.message || 'Failed to create tenant restaurant' });
  }
});

// PATCH Toggle Restaurant Active Status (Suspend/Activate Subscription)
router.patch('/restaurants/:id/toggle', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const activeBool = active === true || active === 1 || active === 'true';

    await query('UPDATE restaurants SET active = $1 WHERE id = $2', [activeBool, id]);
    res.json({ success: true, active: activeBool });
  } catch (err) {
    console.error('Toggle restaurant active error:', err);
    res.status(500).json({ error: 'Failed to toggle restaurant status' });
  }
});

// DELETE Restaurant Tenant
router.delete('/restaurants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM restaurants WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete restaurant error:', err);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

export default router;
