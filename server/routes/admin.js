import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve('public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'dish-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admins = await query('SELECT * FROM admins WHERE username = $1', [username]);
    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = admins[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, restaurant_id: admin.restaurant_id || 1, role: admin.role || 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, username: admin.username, restaurant_id: admin.restaurant_id || 1, role: admin.role || 'restaurant_admin' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Admin Dashboard Summary Statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const catRes = await query('SELECT COUNT(*) as count FROM categories WHERE restaurant_id = $1', [restoId]);
    const dishRes = await query('SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1', [restoId]);
    const activeRes = await query('SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1 AND available = 1', [restoId]);

    res.json({
      totalCategories: parseInt(catRes[0]?.count || 0, 10),
      totalDishes: parseInt(dishRes[0]?.count || 0, 10),
      activeDishes: parseInt(activeRes[0]?.count || 0, 10)
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// File Upload Endpoint
router.post('/upload', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// Category Management (Tenant Scoped)
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { name, image, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const order = sort_order || 0;
    const result = await query(
      'INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [restoId, name, image || '/uploads/logo.jpg', order]
    );
    res.json({ success: true, id: result[0]?.id || result.lastInsertRowid });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    const { name, image, sort_order } = req.body;
    await query(
      'UPDATE categories SET name = $1, image = $2, sort_order = $3 WHERE id = $4 AND restaurant_id = $5',
      [name, image, sort_order || 0, id, restoId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    await query('DELETE FROM categories WHERE id = $1 AND restaurant_id = $2', [id, restoId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

router.patch('/categories/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    const { active } = req.body;
    const activeBool = active === true || active === 1 || active === 'true';
    await query('UPDATE categories SET active = $1 WHERE id = $2 AND restaurant_id = $3', [activeBool, id, restoId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle category error:', err);
    res.status(500).json({ error: err.message || 'Failed to toggle category' });
  }
});

// Dish Management (Tenant Scoped)
router.post('/dishes', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { 
      category_id, name, description, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available 
    } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ error: 'Category, name, and price are required' });
    }

    const availVal = available === false ? 0 : 1;
    const result = await query(
      `INSERT INTO dishes (
        restaurant_id, category_id, name, description, image, price, price_half, 
        portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [
        restoId, category_id, name, description || '', image || '/uploads/logo.jpg', price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '', ingredients || '', taste_profile || '', type || 'veg', availVal
      ]
    );
    res.json({ success: true, id: result[0]?.id || result.lastInsertRowid });
  } catch (err) {
    console.error('Create dish error:', err);
    res.status(500).json({ error: 'Failed to create dish' });
  }
});

router.put('/dishes/:id', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    const { 
      category_id, name, description, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available 
    } = req.body;

    const availVal = available ? 1 : 0;
    await query(
      `UPDATE dishes 
       SET category_id = $1, name = $2, description = $3, image = $4, price = $5, price_half = $6,
           portion = $7, portion_half_label = $8, portion_full_label = $9, badge = $10,
           ingredients = $11, taste_profile = $12, type = $13, available = $14, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $15 AND restaurant_id = $16`,
      [
        category_id, name, description || '', image, price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '',
        ingredients || '', taste_profile || '', type || 'veg', availVal, id, restoId
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update dish error:', err);
    res.status(500).json({ error: 'Failed to update dish' });
  }
});

router.patch('/dishes/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    const { available } = req.body;
    const availVal = available ? 1 : 0;
    await query('UPDATE dishes SET available = $1 WHERE id = $2 AND restaurant_id = $3', [availVal, id, restoId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle dish error:', err);
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
});

router.patch('/dishes/:id/price', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    const { price } = req.body;
    await query('UPDATE dishes SET price = $1 WHERE id = $2 AND restaurant_id = $3', [price, id, restoId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update price error:', err);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

router.delete('/dishes/:id', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    await query('DELETE FROM dishes WHERE id = $1 AND restaurant_id = $2', [id, restoId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete dish error:', err);
    res.status(500).json({ error: 'Failed to delete dish' });
  }
});

// Update Tenant Restaurant Settings (Supports /settings and /info with PUT or POST)
const handleUpdateSettings = async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { name, tagline, phone, address, openingHours, google_review_url, filters_visibility, currency_symbol, fssai_lic_no, resto_type, whatsapp_number, whatsapp_enabled, theme_color } = req.body;

    const visJson = typeof filters_visibility === 'object' ? JSON.stringify(filters_visibility) : filters_visibility;

    await query(`
      UPDATE restaurants 
      SET name = $1, tagline = $2, phone = $3, address = $4, opening_hours = $5, google_review_url = $6, filters_visibility = $7, currency_symbol = $8, fssai_lic_no = $9, resto_type = $10, whatsapp_number = $11, whatsapp_enabled = $12, theme_color = $13
      WHERE id = $14
    `, [
      name, tagline, phone, address, openingHours, google_review_url, visJson,
      currency_symbol !== undefined ? currency_symbol : '₹',
      fssai_lic_no || '',
      resto_type || 'pure_veg',
      whatsapp_number || phone || '',
      whatsapp_enabled !== false && whatsapp_enabled !== 0 ? 1 : 0,
      theme_color || 'gold',
      restoId
    ]);

    // Also update settings.json as fallback for primary restaurant
    if (restoId === 1) {
      const settingsPath = path.resolve('server/settings.json');
      const updated = {
        name, tagline, phone, address, openingHours, google_review_url, currency_symbol,
        filters_visibility: typeof filters_visibility === 'object' ? filters_visibility : { must_try: true, combo: true, special: true, under100: true }
      };
      fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8');
    }

    res.json({ success: true, message: 'Restaurant settings updated successfully!' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

router.put('/settings', authenticateToken, handleUpdateSettings);
router.post('/settings', authenticateToken, handleUpdateSettings);
router.post('/info', authenticateToken, handleUpdateSettings);

// Change Admin Password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    const adminId = req.user.id;

    const admins = await query('SELECT * FROM admins WHERE id = $1', [adminId]);
    if (!admins || admins.length === 0) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const admin = admins[0];
    const match = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    let updatedUsername = admin.username;
    if (newUsername && newUsername.trim() !== '') {
      const userCheck = await query('SELECT * FROM admins WHERE username = $1 AND id != $2', [newUsername.trim(), adminId]);
      if (userCheck.length > 0) {
        return res.status(400).json({ error: 'Username already in use' });
      }
      updatedUsername = newUsername.trim();
    }

    let updatedHash = admin.password_hash;
    if (newPassword && newPassword.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updatedHash = await bcrypt.hash(newPassword.trim(), salt);
    }

    await query('UPDATE admins SET username = $1, password_hash = $2 WHERE id = $3', [updatedUsername, updatedHash, adminId]);
    res.json({ success: true, username: updatedUsername });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
