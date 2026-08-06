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

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Admin Dashboard Summary Statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const catRes = await query('SELECT COUNT(*) as count FROM categories');
    const dishRes = await query('SELECT COUNT(*) as count FROM dishes');
    const activeRes = await query('SELECT COUNT(*) as count FROM dishes WHERE available = 1');

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

// Category Management
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { name, image, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const order = sort_order || 0;
    const result = await query(
      'INSERT INTO categories (name, image, sort_order) VALUES ($1, $2, $3) RETURNING id',
      [name, image || '/uploads/logo.jpg', order]
    );
    res.json({ success: true, id: result[0]?.id || result.lastInsertRowid });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image, sort_order } = req.body;
    await query(
      'UPDATE categories SET name = $1, image = $2, sort_order = $3 WHERE id = $4',
      [name, image, sort_order || 0, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

router.patch('/categories/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const activeBool = active === true || active === 1 || active === 'true';
    await query('UPDATE categories SET active = $1 WHERE id = $2', [activeBool, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle category error:', err);
    res.status(500).json({ error: err.message || 'Failed to toggle category' });
  }
});

// Dish Management (Protected)
router.post('/dishes', authenticateToken, async (req, res) => {
  try {
    const { 
      category_id, name, description, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, available 
    } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ error: 'Category, name, and price are required' });
    }

    const availVal = available === false ? 0 : 1;
    const result = await query(
      `INSERT INTO dishes (
        category_id, name, description, image, price, price_half, 
        portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        category_id, name, description || '', image || '/uploads/logo.jpg', price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '', ingredients || '', taste_profile || '', availVal
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
    const { id } = req.params;
    const { 
      category_id, name, description, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, available 
    } = req.body;

    const availVal = available ? 1 : 0;
    await query(
      `UPDATE dishes 
       SET category_id = $1, name = $2, description = $3, image = $4, price = $5, price_half = $6,
           portion = $7, portion_half_label = $8, portion_full_label = $9, badge = $10,
           ingredients = $11, taste_profile = $12, available = $13, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $14`,
      [
        category_id, name, description || '', image, price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '',
        ingredients || '', taste_profile || '', availVal, id
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
    const { id } = req.params;
    const { available } = req.body;
    const availVal = available ? 1 : 0;
    await query('UPDATE dishes SET available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [availVal, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle dish error:', err);
    res.status(500).json({ error: 'Failed to toggle dish availability' });
  }
});

router.patch('/dishes/:id/price', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { price, price_half } = req.body;
    await query('UPDATE dishes SET price = $1, price_half = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [price, price_half || null, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update dish price error:', err);
    res.status(500).json({ error: 'Failed to update dish price' });
  }
});

router.delete('/dishes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dishes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete dish error:', err);
    res.status(500).json({ error: 'Failed to delete dish' });
  }
});

// Settings Route (Update Google Review URL, Phone, Hours)
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const settingsPath = path.resolve('server/settings.json');
    let currentSettings = {};
    if (fs.existsSync(settingsPath)) {
      currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    }

    const newSettings = {
      ...currentSettings,
      ...req.body
    };

    fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
    res.json({ success: true, settings: newSettings });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Change Admin Credentials (Username/Password)
router.put('/change-credentials', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    if (!newUsername && !newPassword) {
      return res.status(400).json({ error: 'Provide a new username or new password' });
    }

    // Verify current password
    const admins = await query('SELECT * FROM admins WHERE id = $1', [req.user.id]);
    if (!admins || admins.length === 0) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    const admin = admins[0];
    const match = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update username if provided
    if (newUsername && newUsername.trim()) {
      await query('UPDATE admins SET username = $1 WHERE id = $2', [newUsername.trim(), admin.id]);
    }

    // Update password if provided
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword.trim(), salt);
      await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, admin.id]);
    }

    // Generate new token with updated username
    const updatedUsername = (newUsername && newUsername.trim()) ? newUsername.trim() : admin.username;
    const token = jwt.sign({ id: admin.id, username: updatedUsername }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      success: true, 
      message: 'Credentials updated successfully',
      token,
      username: updatedUsername
    });
  } catch (err) {
    console.error('Change credentials error:', err);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

export default router;
