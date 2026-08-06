import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, runAutoDataSummarization } from '../db.js';
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

    const restoRes = await query('SELECT slug, active, name FROM restaurants WHERE id = $1', [admin.restaurant_id || 1]);
    const resto = restoRes[0];
    const slug = resto?.slug || 'raman-sweet-bakery';
    const isActive = (resto?.active === 1 || resto?.active === true || resto?.active === '1');

    if (!isActive && admin.role !== 'superadmin') {
      return res.status(403).json({
        error: `🚫 Account Suspended: '${resto?.name || 'Restaurant'}' subscription is currently suspended. Please contact SaaS Master to renew subscription.`
      });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, restaurant_id: admin.restaurant_id || 1, role: admin.role || 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, username: admin.username, restaurant_id: admin.restaurant_id || 1, slug, role: admin.role || 'restaurant_admin' });
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
        restoId, category_id, name, description || '', image || '', price, price_half || null,
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
    const { name, tagline, logo, phone, address, openingHours, google_review_url, filters_visibility, currency_symbol, fssai_lic_no, resto_type, whatsapp_number, whatsapp_enabled, theme_color, latitude, longitude, max_distance_meters, gst_enabled, gstin_number, total_tables } = req.body;

    const visJson = typeof filters_visibility === 'object' ? JSON.stringify(filters_visibility) : filters_visibility;

    await query(`
      UPDATE restaurants 
      SET name = $1, tagline = $2, logo = $3, phone = $4, address = $5, opening_hours = $6, google_review_url = $7, filters_visibility = $8, currency_symbol = $9, fssai_lic_no = $10, resto_type = $11, whatsapp_number = $12, whatsapp_enabled = $13, theme_color = $14, latitude = $15, longitude = $16, max_distance_meters = $17, gst_enabled = $18, gstin_number = $19, total_tables = $20
      WHERE id = $21
    `, [
      name, tagline,
      logo !== undefined ? logo : '',
      phone, address, openingHours, google_review_url, visJson,
      currency_symbol !== undefined ? currency_symbol : '₹',
      fssai_lic_no || '',
      resto_type || 'pure_veg',
      whatsapp_number || phone || '',
      whatsapp_enabled !== false && whatsapp_enabled !== 0 ? 1 : 0,
      theme_color || 'gold',
      latitude !== undefined && latitude !== null ? Number(latitude) : 26.6500,
      longitude !== undefined && longitude !== null ? Number(longitude) : 84.9167,
      max_distance_meters || 100,
      gst_enabled ? 1 : 0,
      gstin_number || '',
      total_tables || 12,
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

// GET Live Orders for Tenant Restaurant
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const orders = await query(
      'SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 100',
      [restoId]
    );

    const formatted = orders.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : o.items
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PATCH Update Order Status
router.patch('/orders/:id/status', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    const { status } = req.body;

    await query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND restaurant_id = $3',
      [status, id, restoId]
    );

    res.json({ success: true, id, status });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET Live Table Service Requests / Waiter Calls
router.get('/service-requests', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const requests = await query(
      "SELECT * FROM service_requests WHERE restaurant_id = $1 AND status = 'pending' ORDER BY id DESC LIMIT 50",
      [restoId]
    );
    res.json(requests);
  } catch (err) {
    console.error('Fetch service requests error:', err);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

// PATCH Resolve Service Request
router.patch('/service-requests/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const { id } = req.params;
    await query(
      "UPDATE service_requests SET status = 'resolved' WHERE id = $1 AND restaurant_id = $2",
      [id, restoId]
    );
    res.json({ success: true, id, status: 'resolved' });
  } catch (err) {
    console.error('Resolve service request error:', err);
    res.status(500).json({ error: 'Failed to resolve service request' });
  }
});

// GET Sales & Product Analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;

    // Fetch all non-cancelled orders
    const orders = await query(
      "SELECT id, total_amount, status, items, created_at FROM orders WHERE restaurant_id = $1 AND status != 'cancelled' ORDER BY id DESC",
      [restoId]
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let todaySales = 0;
    let todayOrders = 0;
    let weeklySales = 0;
    let monthlySales = 0;
    let totalSales = 0;

    const dishSalesMap = {};
    const dailySalesMap = {};

    // Pre-fill last 7 days in dailySalesMap
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      dailySalesMap[ds] = 0;
    }

    orders.forEach(o => {
      const amt = Number(o.total_amount) || 0;
      totalSales += amt;

      const createdAtDate = new Date(o.created_at);
      const dateStr = o.created_at ? o.created_at.substring(0, 10) : '';

      if (dateStr === todayStr) {
        todaySales += amt;
        todayOrders += 1;
      }

      if (createdAtDate >= sevenDaysAgo) {
        weeklySales += amt;
      }

      if (createdAtDate >= thirtyDaysAgo) {
        monthlySales += amt;
      }

      if (dateStr && dailySalesMap[dateStr] !== undefined) {
        dailySalesMap[dateStr] += amt;
      }

      // Aggregate item counts
      let itemsList = [];
      try {
        itemsList = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      } catch (e) {}

      itemsList.forEach(item => {
        const dishName = item.name || item.title || 'Unknown Dish';
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const lineTotal = price * qty;

        if (!dishSalesMap[dishName]) {
          dishSalesMap[dishName] = { name: dishName, quantity: 0, revenue: 0 };
        }
        dishSalesMap[dishName].quantity += qty;
        dishSalesMap[dishName].revenue += lineTotal;
      });
    });

    // Query aggregated historical summaries
    const summaries = await query(
      'SELECT summary_date, total_sales, total_orders, top_dishes_summary FROM daily_sales_summaries WHERE restaurant_id = $1',
      [restoId]
    );

    summaries.forEach(s => {
      const amt = Number(s.total_sales) || 0;
      const count = Number(s.total_orders) || 0;
      totalSales += amt;

      const dDate = new Date(s.summary_date);
      if (dDate >= sevenDaysAgo) weeklySales += amt;
      if (dDate >= thirtyDaysAgo) monthlySales += amt;
      if (s.summary_date && dailySalesMap[s.summary_date] !== undefined) {
        dailySalesMap[s.summary_date] += amt;
      }
    });

    const totalOrdersCount = orders.length + summaries.reduce((acc, s) => acc + (Number(s.total_orders) || 0), 0);

    const topDishes = Object.values(dishSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const dailyChartData = Object.keys(dailySalesMap).map(dateKey => ({
      date: dateKey,
      displayDate: new Date(dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: dailySalesMap[dateKey]
    }));

    res.json({
      today_sales: todaySales,
      today_orders: todayOrders,
      weekly_sales: weeklySales,
      monthly_sales: monthlySales,
      total_sales: totalSales,
      total_orders: totalOrdersCount,
      top_dishes: topDishes,
      daily_chart: dailyChartData,
      summarized_days_count: summaries.length
    });
  } catch (err) {
    console.error('Fetch analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// POST 1-Click Database Optimization & 90-Day Archival
router.post('/optimize-db', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user.restaurant_id || 1;
    const daysOld = req.body.daysOld || 90;
    const result = await runAutoDataSummarization(daysOld, restoId);
    res.json(result);
  } catch (err) {
    console.error('Database optimization error:', err);
    res.status(500).json({ error: 'Failed to run database optimization' });
  }
});

// ========== COMBO / THALI DEALS CRUD ==========

// GET all combos for admin
router.get('/combos', authenticateToken, async (req, res) => {
  try {
    const combos = await query('SELECT * FROM combos WHERE restaurant_id = $1 ORDER BY sort_order ASC, id DESC', [req.user.restaurant_id]);
    res.json(combos);
  } catch (err) {
    console.error('Fetch combos error:', err);
    res.status(500).json({ error: 'Failed to fetch combos' });
  }
});

// POST create new combo
router.post('/combos', authenticateToken, async (req, res) => {
  try {
    const { name, description, price, image, items, badge, sort_order } = req.body;
    if (!name || !price || !items) {
      return res.status(400).json({ error: 'Name, price, and items are required' });
    }
    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);
    const result = await query(
      'INSERT INTO combos (restaurant_id, name, description, price, image, items, badge, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [req.user.restaurant_id, name, description || '', price, image || '', itemsStr, badge || '', sort_order || 0]
    );
    res.json({ id: result[0]?.id, message: 'Combo created successfully' });
  } catch (err) {
    console.error('Create combo error:', err);
    res.status(500).json({ error: 'Failed to create combo' });
  }
});

// PUT update combo
router.put('/combos/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, price, image, items, badge, sort_order, available } = req.body;
    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);
    await query(
      'UPDATE combos SET name = $1, description = $2, price = $3, image = $4, items = $5, badge = $6, sort_order = $7, available = $8 WHERE id = $9 AND restaurant_id = $10',
      [name, description || '', price, image || '', itemsStr, badge || '', sort_order || 0, available !== undefined ? available : 1, req.params.id, req.user.restaurant_id]
    );
    res.json({ message: 'Combo updated successfully' });
  } catch (err) {
    console.error('Update combo error:', err);
    res.status(500).json({ error: 'Failed to update combo' });
  }
});

// PATCH toggle combo availability
router.patch('/combos/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const { available } = req.body;
    await query('UPDATE combos SET available = $1 WHERE id = $2 AND restaurant_id = $3', [available ? 1 : 0, req.params.id, req.user.restaurant_id]);
    res.json({ message: 'Combo availability updated' });
  } catch (err) {
    console.error('Toggle combo error:', err);
    res.status(500).json({ error: 'Failed to toggle combo' });
  }
});

// DELETE combo
router.delete('/combos/:id', authenticateToken, async (req, res) => {
  try {
    await query('DELETE FROM combos WHERE id = $1 AND restaurant_id = $2', [req.params.id, req.user.restaurant_id]);
    res.json({ message: 'Combo deleted successfully' });
  } catch (err) {
    console.error('Delete combo error:', err);
    res.status(500).json({ error: 'Failed to delete combo' });
  }
});

export default router;
