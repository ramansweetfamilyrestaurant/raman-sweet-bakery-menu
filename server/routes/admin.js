import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, runAutoDataSummarization, saveImageToDb, saveR2ImageToDb, getImageRecordFromDb, deleteImageRecordFromDb } from '../db.js';
import { isR2Active, uploadImageToR2, deleteImageFromR2, getR2Diagnostics } from '../services/r2ImageService.js';
import { authenticateToken, requireActiveSubscription, checkSubscriptionStatus } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'raman_bakery_secret_jwt_key_2026_super_secure';

async function cleanupImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return;
  try {
    const r2Match = imageUrl.match(/restaurants\/[^\s'"]+/);
    if (r2Match && r2Match[0]) {
      const r2Key = r2Match[0];
      console.log('🗑️ Deleting R2 object key directly:', r2Key);
      await deleteImageFromR2(r2Key);
    }

    const filename = path.basename(imageUrl);
    if (filename) {
      const imgRecord = await getImageRecordFromDb(filename);
      if (imgRecord) {
        if (imgRecord.image_key && (!r2Match || imgRecord.image_key !== r2Match[0])) {
          await deleteImageFromR2(imgRecord.image_key);
        }
        await deleteImageRecordFromDb(filename);
      }
    }
  } catch (err) {
    console.warn('⚠️ Cleanup image notice:', err.message);
  }
}

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

// Admin Login (Supports login by Username, Restaurant Slug, or Phone number)
router.post('/login', async (req, res) => {
  try {
    const { username, password, slug: targetSlug } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedIdentifier = username.trim();
    let admins = [];

    // 0. If explicit restaurant slug is provided (e.g. from /rama/admin), prioritize matching that restaurant!
    if (targetSlug && typeof targetSlug === 'string' && targetSlug.trim() !== '') {
      const cleanSlug = targetSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const restos = await query('SELECT id, slug, active, name FROM restaurants WHERE slug = $1 OR slug = $2', [targetSlug.trim(), cleanSlug]);
      if (restos && restos.length > 0) {
        const targetRestoId = restos[0].id;
        admins = await query('SELECT * FROM admins WHERE restaurant_id = $1 AND username = $2', [targetRestoId, trimmedIdentifier]);
        if (!admins || admins.length === 0) {
          admins = await query('SELECT * FROM admins WHERE restaurant_id = $1 ORDER BY id ASC LIMIT 1', [targetRestoId]);
        }
      }
    }

    // 1. Try finding admin by exact username if not matched via slug
    if (!admins || admins.length === 0) {
      admins = await query('SELECT * FROM admins WHERE username = $1', [trimmedIdentifier]);
    }

    // 2. Fallback: Try finding restaurant by slug or phone, then fetch its primary admin
    if (!admins || admins.length === 0) {
      const cleanSlug = trimmedIdentifier.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const restos = await query('SELECT id, slug, active, name FROM restaurants WHERE slug = $1 OR slug = $2 OR phone = $3', [trimmedIdentifier, cleanSlug, trimmedIdentifier]);
      if (restos && restos.length > 0) {
        const targetRestoId = restos[0].id;
        admins = await query('SELECT * FROM admins WHERE restaurant_id = $1 ORDER BY id ASC LIMIT 1', [targetRestoId]);
      }
    }

    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. Username or restaurant not found.' });
    }

    const admin = admins[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    const restoRes = await query('SELECT slug, active, name FROM restaurants WHERE id = $1', [admin.restaurant_id]);
    const resto = restoRes[0];
    const slug = resto?.slug || 'raman-sweet-bakery';

    const token = jwt.sign(
      { id: admin.id, username: admin.username, restaurant_id: admin.restaurant_id, role: admin.role || 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, username: admin.username, restaurant_id: admin.restaurant_id, slug, role: admin.role || 'restaurant_admin' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/admin/me - Verify session and fetch current tenant details (BILLING ALLOWED)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;

    const admins = await query('SELECT id, username, role, restaurant_id FROM admins WHERE id = $1', [req.user.id]);
    const restos = await query('SELECT * FROM restaurants WHERE id = $1', [targetId]);

    const subInfo = await checkSubscriptionStatus(targetId);

    res.json({
      user: admins[0] || req.user,
      restaurant: restos[0] || null,
      subscription_status: subInfo.status,
      active: subInfo.active
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
});

// GET /api/admin/subscription-status - Fetch current tenant subscription details (BILLING ALLOWED)
router.get('/subscription-status', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId) {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId;

    const subInfo = await checkSubscriptionStatus(targetId);
    const restos = await query('SELECT active, plan_tier, plan_price, plan_expires_at, trial_started_at, trial_ends_at, grace_period_expires_at, mandate_id, mandate_status, auto_debit_enabled FROM restaurants WHERE id = $1', [targetId]);
    const r = restos[0] || {};
    const subRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [targetId]);
    const sub = subRows[0] || null;

    const tierKey = (r.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [tierKey]);
    const saasPlan = planRows[0] || {};

    const planPrice = Number(r.plan_price || saasPlan.price || (tierKey === 'enterprise' ? 1999 : tierKey === 'basic' ? 499 : 999));
    const whatsappEnabled = saasPlan.whatsapp_enabled !== undefined ? (saasPlan.whatsapp_enabled === 1 || saasPlan.whatsapp_enabled === true || saasPlan.whatsapp_enabled === '1') : (tierKey !== 'basic');
    const directOrderingEnabled = saasPlan.direct_ordering_enabled !== undefined ? (saasPlan.direct_ordering_enabled === 1 || saasPlan.direct_ordering_enabled === true || saasPlan.direct_ordering_enabled === '1') : (tierKey === 'enterprise');
    const googleReviewsEnabled = saasPlan.google_reviews_enabled !== undefined ? (saasPlan.google_reviews_enabled === 1 || saasPlan.google_reviews_enabled === true || saasPlan.google_reviews_enabled === '1') : (tierKey !== 'basic');
    const maxCombos = saasPlan.max_combos !== undefined ? Number(saasPlan.max_combos) : (tierKey === 'basic' ? 3 : tierKey === 'pro' ? 10 : 9999);

    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      const str = String(val);
      return new Date(str.includes('T') ? str : `${str}T23:59:59Z`);
    };

    const now = new Date();
    let isTrialActive = false;
    const expDate = parseDate(r.trial_ends_at || r.plan_expires_at || sub?.trial_end || sub?.current_period_end);
    if (expDate && !isNaN(expDate.getTime()) && expDate >= now) {
      isTrialActive = true;
    }

    let isGracePeriodActive = false;
    const graceDate = parseDate(r.grace_period_expires_at || sub?.grace_period_expires_at);
    if (graceDate && !isNaN(graceDate.getTime()) && graceDate >= now) {
      isGracePeriodActive = true;
    }

    const subStatus = sub?.status || subInfo.status || (isTrialActive ? 'trialing' : (r.active ? 'trialing' : 'expired'));
    const mandateStatus = (r.mandate_status || (r.mandate_id ? 'active' : 'pending')).toLowerCase();

    // 1. REQUIRED ADMIN ACCESS RULES:
    // A) subscription.status === "trialing" AND mandate_status === "active"
    // B) subscription.status === "active"
    // C) subscription.status === "payment_failed" AND grace period active
    // D) subscription.status === "grace_period"
    // E) Existing active restaurant (active === 1 and not expired)
    const isRuleA = (subStatus === 'trialing' || isTrialActive) && mandateStatus === 'active';
    const isRuleB = subStatus === 'active';
    const isRuleC = subStatus === 'payment_failed' && isGracePeriodActive;
    const isRuleD = subStatus === 'grace_period';
    const isRuleE = (r.active === 1 || r.active === true) && (mandateStatus === 'active' || !r.trial_started_at || isTrialActive);

    const isAllowed = Boolean(isRuleA || isRuleB || isRuleC || isRuleD || isRuleE);

    // 2. BILLING REDIRECT CONDITIONS:
    // Redirect ONLY when access is not allowed or trial/subscription has expired:
    // - subscription.status === "expired" (trial and grace period ended)
    // - subscription.status === "cancelled" and trial ended
    const isExpired = subStatus === 'expired' && !isTrialActive && !isGracePeriodActive;
    // cancel_requested but period still active → NOT billing required
    const hasCancelRequestedButActive = sub?.cancel_requested_at && (isTrialActive || (sub?.current_period_end && new Date(sub.current_period_end) >= now));
    const isCancelled = subStatus === 'cancelled' && !isTrialActive && !hasCancelRequestedButActive;

    const billingRequired = !isAllowed || isExpired || isCancelled;

    const sysRows = await query("SELECT value FROM system_settings WHERE key = 'default_trial_days'");
    const defaultTrialDays = parseInt(sysRows[0]?.value || '14', 10);

    res.json({
      status: subStatus,
      active: subInfo.active,
      is_allowed: isAllowed,
      billing_required: billingRequired,
      billing_setup: mandateStatus === 'active' ? 'complete' : 'incomplete',
      grace_period_active: isGracePeriodActive,
      plan_tier: r.plan_tier || 'pro',
      plan_price: planPrice,
      whatsapp_enabled: whatsappEnabled,
      direct_ordering_enabled: directOrderingEnabled,
      google_reviews_enabled: googleReviewsEnabled,
      max_combos: maxCombos,
      default_trial_days: defaultTrialDays,
      trial_started_at: r.trial_started_at,
      trial_ends_at: r.trial_ends_at || r.plan_expires_at,
      plan_expires_at: r.plan_expires_at,
      grace_period_expires_at: r.grace_period_expires_at || null,
      mandate_id: r.mandate_id || null,
      mandate_status: mandateStatus,
      auto_debit_enabled: Boolean(r.auto_debit_enabled),
      subscription: sub,
      // Phase 4: Lifecycle fields
      cancel_requested_at: sub?.cancel_requested_at || null,
      auto_renew: sub?.auto_renew !== undefined ? Number(sub.auto_renew) : 1,
      scheduled_plan_key: sub?.scheduled_plan_key || null,
      plan_change_effective_at: sub?.plan_change_effective_at || null,
      access_until: sub?.current_period_end || r.trial_ends_at || r.plan_expires_at || null,
      current_period_end: sub?.current_period_end || null
    });
  } catch (err) {
    console.error('Fetch subscription status error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// POST /api/admin/forgot-password - Reset password using registered phone or username
router.post('/forgot-password', async (req, res) => {
  try {
    const { phone_or_username, new_password } = req.body;

    if (!phone_or_username || !new_password) {
      return res.status(400).json({ error: 'Phone/Username and New Password are required' });
    }

    if (new_password.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' });
    }

    const trimmedInput = phone_or_username.trim();

    let admins = await query('SELECT * FROM admins WHERE username = $1', [trimmedInput]);

    if (!admins || admins.length === 0) {
      const restos = await query('SELECT id FROM restaurants WHERE phone = $1 OR whatsapp_number = $1', [trimmedInput]);
      if (restos && restos.length > 0) {
        const targetRestoId = restos[0].id;
        admins = await query('SELECT * FROM admins WHERE restaurant_id = $1 ORDER BY id ASC LIMIT 1', [targetRestoId]);
      }
    }

    if (!admins || admins.length === 0) {
      return res.status(404).json({ error: 'No account found matching this Username or Phone number.' });
    }

    const targetAdmin = admins[0];

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, targetAdmin.id]);

    res.json({
      success: true,
      message: `🔑 Password for '${targetAdmin.username}' updated successfully! You can now log in.`
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again or contact Super Admin.' });
  }
});

// Admin Dashboard Summary Statistics (OPERATIONAL ROUTE)
router.get('/stats', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;

    const catRes = await query('SELECT COUNT(*) as count FROM categories WHERE restaurant_id = $1', [targetId]);
    const dishRes = await query('SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1', [targetId]);
    const activeRes = await query('SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1 AND available = 1', [targetId]);

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

// Safe Diagnostics Endpoint for Storage Status
router.get('/storage-status', authenticateToken, (req, res) => {
  res.json(getR2Diagnostics());
});

// File Upload Endpoint (OPERATIONAL ROUTE)
router.post('/upload', authenticateToken, requireActiveSubscription, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file uploaded' });
  }

  // Validate File Size (max 10MB)
  if (req.file.size > 10 * 1024 * 1024) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, error: 'Image file size exceeds maximum limit of 10MB' });
  }

  // Validate MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowedMimeTypes.includes(req.file.mimetype.toLowerCase())) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, error: 'Invalid file type. Only JPEG, PNG, WebP, GIF, and AVIF images are allowed' });
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const restaurantId = req.user?.restaurant_id || 1;
  const entityType = req.body?.entityType || 'dishes';
  const localUrl = `/uploads/${req.file.filename}`;

  // Mirror upload to local r2-cache folder so it can be served instantly
  try {
    const r2CacheDir = path.resolve('public/uploads/r2-cache');
    if (!fs.existsSync(r2CacheDir)) fs.mkdirSync(r2CacheDir, { recursive: true });
    fs.copyFileSync(req.file.path, path.join(r2CacheDir, req.file.filename));
  } catch (e) {}

  if (isR2Active()) {
    try {
      const r2Result = await uploadImageToR2({
        buffer: fileBuffer,
        mimeType: req.file.mimetype,
        restaurantId,
        entityType
      });

      await saveR2ImageToDb(
        req.file.filename,
        r2Result.mimeType,
        r2Result.objectKey,
        r2Result.publicUrl,
        restaurantId
      );

      console.log('⚡ Uploaded image to Cloudflare R2:', r2Result.publicUrl);
      return res.json({
        success: true,
        url: localUrl,
        r2ProxyUrl: `/api/r2-proxy/${r2Result.objectKey}`,
        key: r2Result.objectKey,
        r2Url: r2Result.publicUrl
      });
    } catch (r2Err) {
      console.warn('⚠️ Cloudflare R2 upload notice (using local file fallback):', r2Err.message);
      return res.json({ success: true, url: localUrl });
    }
  }

  // Fallback when R2 is not active
  return res.json({ success: true, url: localUrl });
});

// Delete Image Endpoint (For cleaning up temporary/deleted images)
router.post('/upload/delete', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (imageUrl) {
      await cleanupImage(imageUrl);
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Category Management (Tenant Scoped - OPERATIONAL ROUTES)
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const categories = await query('SELECT * FROM categories WHERE restaurant_id = $1 ORDER BY sort_order ASC, id ASC', [targetId]);
    res.json(categories);
  } catch (err) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { name, image, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const order = sort_order || 0;
    const result = await query(
      'INSERT INTO categories (restaurant_id, name, image, sort_order) VALUES ($1, $2, $3, $4) RETURNING id',
      [targetId, name, image || '/uploads/logo.jpg', order]
    );
    res.json({ success: true, id: result[0]?.id || result.lastInsertRowid });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    const { name, image, sort_order } = req.body;

    // Fetch old category image to clean up if replaced
    if (image) {
      try {
        const oldCatRows = await query('SELECT image FROM categories WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
        const oldImage = oldCatRows && oldCatRows.length > 0 ? oldCatRows[0].image : null;
        if (oldImage && oldImage !== image) {
          await cleanupImage(oldImage);
        }
      } catch (cleanErr) {
        console.warn('Notice cleaning up replaced category image:', cleanErr.message);
      }
    }

    await query(
      'UPDATE categories SET name = $1, image = $2, sort_order = $3 WHERE id = $4 AND restaurant_id = $5',
      [name, image, sort_order || 0, id, targetId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;

    // Fetch category image before deleting
    const catRows = await query('SELECT image FROM categories WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
    if (catRows && catRows.length > 0 && catRows[0].image) {
      await cleanupImage(catRows[0].image);
    }

    await query('DELETE FROM categories WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

router.patch('/categories/:id/toggle', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    const { active } = req.body;
    const activeBool = active === true || active === 1 || active === 'true';
    await query('UPDATE categories SET active = $1 WHERE id = $2 AND restaurant_id = $3', [activeBool, id, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle category error:', err);
    res.status(500).json({ error: err.message || 'Failed to toggle category' });
  }
});

// Dish Management (Tenant Scoped - OPERATIONAL ROUTES)
router.get('/dishes', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const dishes = await query('SELECT * FROM dishes WHERE restaurant_id = $1 ORDER BY id DESC', [targetId]);
    res.json(dishes);
  } catch (err) {
    console.error('Fetch dishes error:', err);
    res.status(500).json({ error: 'Failed to fetch dishes' });
  }
});

router.post('/dishes', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
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
        targetId, category_id, name, description || '', image || '', price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '', ingredients || '', taste_profile || '', type || 'veg', availVal
      ]
    );
    res.json({ success: true, id: result[0]?.id || result.lastInsertRowid });
  } catch (err) {
    console.error('Create dish error:', err);
    res.status(500).json({ error: 'Failed to create dish' });
  }
});

router.put('/dishes/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    const { 
      category_id, name, description, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available 
    } = req.body;

    // Fetch old dish image to clean up if replaced
    if (image) {
      try {
        const oldDishRows = await query('SELECT image FROM dishes WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
        const oldImage = oldDishRows && oldDishRows.length > 0 ? oldDishRows[0].image : null;
        if (oldImage && oldImage !== image) {
          await cleanupImage(oldImage);
        }
      } catch (cleanErr) {
        console.warn('Notice cleaning up replaced dish image:', cleanErr.message);
      }
    }

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
        ingredients || '', taste_profile || '', type || 'veg', availVal, id, targetId
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update dish error:', err);
    res.status(500).json({ error: 'Failed to update dish' });
  }
});

router.patch('/dishes/:id/toggle', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    const { available } = req.body;
    const availVal = available ? 1 : 0;
    await query('UPDATE dishes SET available = $1 WHERE id = $2 AND restaurant_id = $3', [availVal, id, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle dish error:', err);
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
});

router.patch('/dishes/:id/price', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    const { price } = req.body;
    await query('UPDATE dishes SET price = $1 WHERE id = $2 AND restaurant_id = $3', [price, id, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update price error:', err);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

router.delete('/dishes/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;

    // Fetch dish image before deleting
    const dishRows = await query('SELECT image FROM dishes WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
    if (dishRows && dishRows.length > 0 && dishRows[0].image) {
      await cleanupImage(dishRows[0].image);
    }

    await query('DELETE FROM dishes WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete dish error:', err);
    res.status(500).json({ error: 'Failed to delete dish' });
  }
});

// Update Tenant Restaurant Settings
const handleUpdateSettings = async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;

    const { name, tagline, logo, phone, address, openingHours, google_review_url, google_reviews_enabled, filters_visibility, currency_symbol, fssai_lic_no, resto_type, whatsapp_number, whatsapp_enabled, theme_color, latitude, longitude, max_distance_meters, gst_enabled, gstin_number, total_tables, order_retention_days } = req.body;

    const visJson = typeof filters_visibility === 'object' ? JSON.stringify(filters_visibility) : filters_visibility;

    await query(`
      UPDATE restaurants 
      SET name = $1, tagline = $2, logo = $3, phone = $4, address = $5, opening_hours = $6, google_review_url = $7, filters_visibility = $8, currency_symbol = $9, fssai_lic_no = $10, resto_type = $11, whatsapp_number = $12, whatsapp_enabled = $13, theme_color = $14, latitude = $15, longitude = $16, max_distance_meters = $17, gst_enabled = $18, gstin_number = $19, total_tables = $20, order_retention_days = $21, google_reviews_enabled = $22
      WHERE id = $23
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
      total_tables !== undefined && total_tables !== null ? Number(total_tables) : 0,
      order_retention_days || 90,
      google_reviews_enabled !== false && google_reviews_enabled !== 0 ? 1 : 0,
      targetId
    ]);

    res.json({ success: true, message: 'Restaurant settings updated successfully!' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

router.put('/settings', authenticateToken, requireActiveSubscription, handleUpdateSettings);
router.post('/settings', authenticateToken, requireActiveSubscription, handleUpdateSettings);
router.post('/info', authenticateToken, requireActiveSubscription, handleUpdateSettings);

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

// GET Live Orders for Tenant Restaurant (OPERATIONAL ROUTE)
router.get('/orders', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;

    const orders = await query(
      'SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 100',
      [targetId]
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

// PATCH Update Order Status (OPERATIONAL ROUTE)
router.patch('/orders/:id/status', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    const { status } = req.body;

    await query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND restaurant_id = $3',
      [status, id, targetId]
    );

    res.json({ success: true, id, status });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// GET Live Table Service Requests / Waiter Calls (OPERATIONAL ROUTE)
router.get('/service-requests', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;

    const requests = await query(
      "SELECT * FROM service_requests WHERE restaurant_id = $1 AND status = 'pending' ORDER BY id DESC LIMIT 50",
      [targetId]
    );
    res.json(requests);
  } catch (err) {
    console.error('Fetch service requests error:', err);
    res.status(500).json({ error: 'Failed to fetch service requests' });
  }
});

// PATCH Resolve Service Request (OPERATIONAL ROUTE)
router.patch('/service-requests/:id/resolve', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { id } = req.params;
    await query(
      "DELETE FROM service_requests WHERE id = $1 AND restaurant_id = $2",
      [id, targetId]
    );
    res.json({ success: true, id, status: 'resolved', deleted: true });
  } catch (err) {
    console.error('Resolve service request error:', err);
    res.status(500).json({ error: 'Failed to resolve service request' });
  }
});

// GET Sales & Product Analytics (OPERATIONAL ROUTE)
router.get('/analytics', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;

    const orders = await query(
      "SELECT id, total_amount, status, items, created_at FROM orders WHERE restaurant_id = $1 AND status != 'cancelled' ORDER BY id DESC",
      [targetId]
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

    const summaries = await query(
      'SELECT summary_date, total_sales, total_orders, top_dishes_summary FROM daily_sales_summaries WHERE restaurant_id = $1',
      [targetId]
    );

    summaries.forEach(s => {
      const amt = Number(s.total_sales) || 0;
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

// POST 1-Click Database Optimization & 90-Day Archival (OPERATIONAL ROUTE)
router.post('/optimize-db', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const daysOld = req.body.daysOld || 90;
    const result = await runAutoDataSummarization(daysOld, targetId);
    res.json(result);
  } catch (err) {
    console.error('Database optimization error:', err);
    res.status(500).json({ error: 'Failed to run database optimization' });
  }
});

// ========== COMBO / THALI DEALS CRUD (OPERATIONAL ROUTES) ==========

// GET all combos for admin
router.get('/combos', authenticateToken, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const combos = await query('SELECT * FROM combos WHERE restaurant_id = $1 ORDER BY sort_order ASC, id DESC', [targetId]);
    res.json(combos);
  } catch (err) {
    console.error('Fetch combos error:', err);
    res.status(500).json({ error: 'Failed to fetch combos' });
  }
});

// POST create new combo
router.post('/combos', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { name, description, price, image, items, badge, sort_order } = req.body;
    if (!name || !price || !items) {
      return res.status(400).json({ error: 'Name, price, and items are required' });
    }

    const restoRows = await query('SELECT plan_tier FROM restaurants WHERE id = $1', [targetId]);
    const planTier = (restoRows[0]?.plan_tier || 'pro').toLowerCase();

    const planRows = await query('SELECT max_combos FROM saas_plans WHERE LOWER(key) = $1', [planTier]);
    let maxCombos = planRows[0]?.max_combos;
    if (!maxCombos) {
      if (planTier === 'basic') maxCombos = 3;
      else if (planTier === 'enterprise') maxCombos = 9999;
      else maxCombos = 10;
    }

    const countRows = await query('SELECT COUNT(*) as count FROM combos WHERE restaurant_id = $1', [targetId]);
    const currentCount = parseInt(countRows[0]?.count || 0, 10);

    if (currentCount >= maxCombos) {
      return res.status(403).json({
        error: `Combo limit reached! Your ${planTier.toUpperCase()} plan allows a maximum of ${maxCombos} combos. Please upgrade your SaaS plan to add more.`,
        limit_reached: true,
        max_combos: maxCombos
      });
    }

    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);
    const result = await query(
      'INSERT INTO combos (restaurant_id, name, description, price, image, items, badge, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [targetId, name, description || '', price, image || '', itemsStr, badge || '', sort_order || 0]
    );
    res.json({ id: result[0]?.id || result.lastInsertRowid, message: 'Combo created successfully' });
  } catch (err) {
    console.error('Create combo error:', err);
    res.status(500).json({ error: 'Failed to create combo' });
  }
});

// PUT update combo
router.put('/combos/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { name, description, price, image, items, badge, sort_order, available } = req.body;
    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);
    await query(
      'UPDATE combos SET name = $1, description = $2, price = $3, image = $4, items = $5, badge = $6, sort_order = $7, available = $8 WHERE id = $9 AND restaurant_id = $10',
      [name, description || '', price, image || '', itemsStr, badge || '', sort_order || 0, available !== undefined ? available : 1, req.params.id, targetId]
    );
    res.json({ message: 'Combo updated successfully' });
  } catch (err) {
    console.error('Update combo error:', err);
    res.status(500).json({ error: 'Failed to update combo' });
  }
});

// PATCH toggle combo availability
router.patch('/combos/:id/toggle', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    const { available } = req.body;
    await query('UPDATE combos SET available = $1 WHERE id = $2 AND restaurant_id = $3', [available ? 1 : 0, req.params.id, targetId]);
    res.json({ message: 'Combo availability updated' });
  } catch (err) {
    console.error('Toggle combo error:', err);
    res.status(500).json({ error: 'Failed to toggle combo' });
  }
});

// DELETE combo
router.delete('/combos/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const restoId = req.user?.restaurant_id;
    if (!restoId && req.user?.role !== 'superadmin') {
      return res.status(401).json({ error: 'Unauthorized: Restaurant session required' });
    }
    const targetId = restoId || 1;
    await query('DELETE FROM combos WHERE id = $1 AND restaurant_id = $2', [req.params.id, targetId]);
    res.json({ message: 'Combo deleted successfully' });
  } catch (err) {
    console.error('Delete combo error:', err);
    res.status(500).json({ error: 'Failed to delete combo' });
  }
});

export default router;
