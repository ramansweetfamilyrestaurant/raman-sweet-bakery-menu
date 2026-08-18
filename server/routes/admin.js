import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, runAutoDataSummarization, saveImageToDb, saveR2ImageToDb, getImageRecordFromDb, deleteImageRecordFromDb } from '../db.js';
import { isR2Active, uploadImageToR2, deleteImageFromR2, getR2Diagnostics, purgeOrphanedR2Objects } from '../services/r2ImageService.js';
import { authenticateToken, requireActiveSubscription, checkSubscriptionStatus } from '../middleware/auth.js';
import { JWT_SECRET } from '../config/jwt.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiters.js';

let sharpModule = null;
async function getSharp() {
  if (!sharpModule) {
    try {
      const m = await import('sharp');
      sharpModule = m.default || m;
    } catch (e) {
      console.warn('Sharp module import notice in admin route:', e.message);
    }
  }
  return sharpModule;
}

const router = express.Router();

async function isImageKeyInUse(imageUrl, r2Key) {
  try {
    const searchPattern = r2Key || path.basename(imageUrl || '');
    if (!searchPattern || searchPattern.length < 5) return false;
    const refChecks = await Promise.all([
      query("SELECT COUNT(*)::int as count FROM dishes WHERE image LIKE '%' || $1 || '%'", [searchPattern]).catch(() => [{ count: 0 }]),
      query("SELECT COUNT(*)::int as count FROM categories WHERE image LIKE '%' || $1 || '%'", [searchPattern]).catch(() => [{ count: 0 }]),
      query("SELECT COUNT(*)::int as count FROM restaurants WHERE logo LIKE '%' || $1 || '%'", [searchPattern]).catch(() => [{ count: 0 }]),
      query("SELECT COUNT(*)::int as count FROM combos WHERE image LIKE '%' || $1 || '%'", [searchPattern]).catch(() => [{ count: 0 }]),
      query("SELECT COUNT(*)::int as count FROM announcements WHERE image_url LIKE '%' || $1 || '%'", [searchPattern]).catch(() => [{ count: 0 }])
    ]);
    const totalRefs = refChecks.reduce((sum, res) => sum + (Number(res?.[0]?.count) || 0), 0);
    return totalRefs > 0;
  } catch (e) {
    return false;
  }
}

async function cleanupImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return;
  try {
    const r2Match = imageUrl.match(/restaurants\/[^\s'"]+/);
    const r2Key = r2Match ? r2Match[0] : null;

    // Safety check: do not delete R2 object if it is still referenced elsewhere in DB
    const inUse = await isImageKeyInUse(imageUrl, r2Key);
    if (inUse) {
      console.log('ℹ️ [CLEANUP NOTICE] Image key is still referenced by another active DB record. Skipping R2 object deletion:', r2Key || imageUrl);
      return;
    }

    if (r2Key) {
      console.log('🗑️ Deleting R2 object key directly:', r2Key);
      await deleteImageFromR2(r2Key);
      await deleteImageRecordFromDb(r2Key);
    }

    const filename = path.basename(imageUrl);
    if (filename) {
      const imgRecord = await getImageRecordFromDb(filename);
      if (imgRecord) {
        if (imgRecord.image_key && (!r2Match || imgRecord.image_key !== r2Match[0])) {
          const keyInUse = await isImageKeyInUse(imgRecord.image_key, imgRecord.image_key);
          if (!keyInUse) {
            await deleteImageFromR2(imgRecord.image_key);
          }
        }
        await deleteImageRecordFromDb(imgRecord.image_key || filename);
      }
      await deleteImageRecordFromDb(filename);
    }
    await deleteImageRecordFromDb(imageUrl);
  } catch (err) {
    console.warn('⚠️ Cleanup image notice:', err.message);
  }
}

async function processExternalImageUrl(imageUrl, restaurantId, entityType = 'dishes') {
  if (!imageUrl || typeof imageUrl !== 'string' || (!restaurantId && entityType !== 'superadmin' && entityType !== 'branding')) return imageUrl;
  
  if (imageUrl.startsWith('/api/r2-proxy/') || imageUrl === '/uploads/logo.jpg') {
    return imageUrl;
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    if (imageUrl.includes('.r2.dev/restaurants/')) {
      const idx = imageUrl.indexOf('restaurants/');
      return `/api/r2-proxy/${imageUrl.substring(idx)}`;
    }

    try {
      console.log(`🌐 [AUTO R2 PIPELINE] Intercepted external URL: ${imageUrl}`);
      const fetchRes = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!fetchRes.ok) return imageUrl;

      const arrayBuf = await fetchRes.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);
      if (!inputBuffer || inputBuffer.length === 0) return imageUrl;

      const imagePipeline = sharp(inputBuffer);
      const meta = await imagePipeline.metadata();
      if (!meta || !meta.format) return imageUrl;

      let transformer = sharp(inputBuffer);
      if (meta.width && meta.width > 1200) {
        transformer = transformer.resize(1200, null, { withoutEnlargement: true });
      }

      const webpBuffer = await transformer.webp({ quality: 85 }).toBuffer();
      const r2Result = await uploadImageToR2({
        buffer: webpBuffer,
        mimeType: 'image/webp',
        restaurantId,
        entityType
      });

      if (!r2Result || !r2Result.objectKey) return imageUrl;

      const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
      const finalUrl = r2Result.publicUrl || proxyUrl;

      const filename = `external-${entityType}-${Date.now()}.webp`;
      await saveR2ImageToDb(filename, 'image/webp', r2Result.objectKey, finalUrl, restaurantId);

      console.log(`✅ [AUTO R2 PIPELINE COMPLETE] Returning R2 Proxy URL: ${proxyUrl}`);
      return proxyUrl;
    } catch (err) {
      console.warn(`⚠️ External image auto-R2 pipeline notice:`, err.message);
      return imageUrl;
    }
  }

  return imageUrl;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});



// Admin Login (Supports login by Username, Restaurant Slug, or Phone number for Restaurant Owners ONLY)
router.post('/login', adminLoginRateLimiter, async (req, res) => {
  try {
    const { username, password, slug: targetSlug } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedIdentifier = username.trim();

    // STRICT ROLE SECURITY: Reject Super Admin attempts on Restaurant Owner login
    const superCheck = await query("SELECT id FROM admins WHERE username = $1 AND role = 'superadmin'", [trimmedIdentifier]);
    if (superCheck && superCheck.length > 0) {
      return res.status(403).json({
        error: 'ACCESS_DENIED_ROLE_MISMATCH',
        message: 'Super Admin credentials cannot be used for Restaurant Owner login. Please use the Master Super Admin portal at /super-admin.'
      });
    }

    let admins = [];

    // 0. If explicit restaurant slug is provided (e.g. from /rama/admin), check if username matches that restaurant first!
    if (targetSlug && typeof targetSlug === 'string' && targetSlug.trim() !== '') {
      const cleanSlug = targetSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (!['touchqr-demo', 'menu', 'admin', 'default'].includes(cleanSlug)) {
        const restos = await query('SELECT id, slug, active, name FROM restaurants WHERE LOWER(slug) = LOWER($1) OR LOWER(slug) = LOWER($2)', [targetSlug.trim(), cleanSlug]);
        if (restos && restos.length > 0) {
          const targetRestoId = restos[0].id;
          admins = await query("SELECT * FROM admins WHERE restaurant_id = $1 AND LOWER(username) = LOWER($2) AND role != 'superadmin'", [targetRestoId, trimmedIdentifier]);
        }
      }
    }

    // 1. Try finding admin by case-insensitive username excluding superadmin role
    if (!admins || admins.length === 0) {
      admins = await query("SELECT * FROM admins WHERE LOWER(username) = LOWER($1) AND role != 'superadmin'", [trimmedIdentifier]);
    }

    // 2. Fallback: Try finding restaurant by slug or phone, then fetch its primary restaurant_admin
    if (!admins || admins.length === 0) {
      const cleanSlug = trimmedIdentifier.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const restos = await query('SELECT id, slug, active, name FROM restaurants WHERE (LOWER(slug) = LOWER($1) OR LOWER(slug) = LOWER($2) OR phone = $3) AND LOWER(slug) != \'touchqr-demo\'', [trimmedIdentifier, cleanSlug, trimmedIdentifier]);
      if (restos && restos.length > 0) {
        const targetRestoId = restos[0].id;
        admins = await query("SELECT * FROM admins WHERE restaurant_id = $1 AND role != 'superadmin' ORDER BY id ASC LIMIT 1", [targetRestoId]);
      }
    }

    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials. Username or restaurant not found.' });
    }

    let matchedAdmin = null;
    for (const candidate of admins) {
      const match = await bcrypt.compare(password, candidate.password_hash);
      if (match) {
        matchedAdmin = candidate;
        break;
      }
    }

    if (!matchedAdmin) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    const admin = matchedAdmin;
    const restoRes = await query('SELECT * FROM restaurants WHERE id = $1', [admin.restaurant_id]);
    const resto = restoRes[0];

    const isActive = resto?.active === 1 || resto?.active === true || resto?.active === '1' || resto?.active === undefined || resto?.active === null;
    if (!isActive || resto?.active === false || resto?.active === 0 || resto?.active === 'false') {
      return res.status(403).json({ error: `Restaurant '${resto?.name || 'Account'}' has been suspended by Super Admin. Access disabled.` });
    }

    const slug = resto?.slug || '';

    const token = jwt.sign(
      { id: admin.id, username: admin.username, restaurant_id: admin.restaurant_id, role: admin.role || 'restaurant_admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      token,
      username: admin.username,
      restaurant_id: admin.restaurant_id,
      slug,
      role: admin.role || 'restaurant_admin',
      restaurant: resto
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/admin/me - Verify session and fetch current tenant details (BILLING ALLOWED)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const [admins, restos, subInfo] = await Promise.all([
      query('SELECT id, username, role, restaurant_id FROM admins WHERE id = $1', [req.user.id]),
      query('SELECT * FROM restaurants WHERE id = $1', [targetId]),
      checkSubscriptionStatus(targetId)
    ]);

    const resto = restos[0] ? {
      ...restos[0],
      onboarding_completed: restos[0].onboarding_completed !== undefined && restos[0].onboarding_completed !== null ? (restos[0].onboarding_completed === true || restos[0].onboarding_completed === 1 || restos[0].onboarding_completed === 'true') : true,
      location_initialized: restos[0].location_initialized !== undefined && restos[0].location_initialized !== null ? (restos[0].location_initialized === true || restos[0].location_initialized === 1 || restos[0].location_initialized === 'true') : false
    } : null;

    res.json({
      user: admins[0] || req.user,
      restaurant: resto,
      subscription_status: subInfo.status,
      active: subInfo.active
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
});

// POST /api/admin/onboarding/complete - Dedicated, authorized onboarding completion endpoint
router.post('/onboarding/complete', authenticateToken, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Unauthorized: Valid restaurant session required' });
    }

    const restoRows = await query('SELECT id, name, phone, address FROM restaurants WHERE id = $1', [targetId]);
    const resto = restoRows[0];
    if (!resto || !resto.name || !resto.phone) {
      return res.status(400).json({ error: 'Incomplete restaurant profile. Name and Phone are required before completing onboarding.' });
    }

    await query('UPDATE restaurants SET onboarding_completed = true, location_initialized = true WHERE id = $1', [targetId]);

    res.json({ success: true, message: 'Onboarding completed successfully!', onboarding_completed: true });
  } catch (err) {
    console.error('Onboarding complete error:', err);
    res.status(500).json({ error: 'Failed to complete onboarding' });
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
    const r = subInfo.resto || {};
    const sub = subInfo.sub || null;

    const tierKey = (r.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [tierKey]);
    const saasPlan = planRows[0] || {};

    const planPrice = Number(r.plan_price || saasPlan.price || (tierKey === 'enterprise' ? 1999 : tierKey === 'basic' ? 499 : 999));
    const isValTrue = (val, def = true) => val !== undefined && val !== null ? (val === 1 || val === true || val === '1') : def;

    const matrixPermissions = {
      max_dishes: saasPlan.max_dishes !== undefined && saasPlan.max_dishes !== null ? Number(saasPlan.max_dishes) : 9999,
      max_categories: saasPlan.max_categories !== undefined && saasPlan.max_categories !== null ? Number(saasPlan.max_categories) : 9999,
      max_combos: saasPlan.max_combos !== undefined && saasPlan.max_combos !== null ? Number(saasPlan.max_combos) : (tierKey === 'basic' ? 3 : tierKey === 'pro' ? 10 : 9999),
      max_tables: saasPlan.max_tables !== undefined && saasPlan.max_tables !== null ? Number(saasPlan.max_tables) : 9999,
      max_staff_accounts: saasPlan.max_staff_accounts !== undefined && saasPlan.max_staff_accounts !== null ? Number(saasPlan.max_staff_accounts) : 9999,
      order_retention_days: saasPlan.order_retention_days !== undefined && saasPlan.order_retention_days !== null ? Number(saasPlan.order_retention_days) : 365,
      modifiers_enabled: isValTrue(saasPlan.modifiers_enabled, true),
      staff_roles_enabled: isValTrue(saasPlan.staff_roles_enabled, true),
      whatsapp_enabled: isValTrue(saasPlan.whatsapp_ordering_enabled ?? saasPlan.whatsapp_enabled, tierKey !== 'basic'),
      direct_ordering_enabled: isValTrue(saasPlan.direct_ordering_enabled, tierKey === 'enterprise'),
      audio_alarm_enabled: isValTrue(saasPlan.audio_alarm_enabled, true),
      order_status_whatsapp_enabled: isValTrue(saasPlan.order_status_whatsapp_enabled, true),
      kds_enabled: isValTrue(saasPlan.kds_enabled, true),
      bluetooth_kot_enabled: isValTrue(saasPlan.bluetooth_kot_enabled, true),
      google_reviews_enabled: isValTrue(saasPlan.google_reviews_enabled, tierKey !== 'basic'),
      ai_review_enabled: isValTrue(saasPlan.ai_review_enabled, true),
      stories_enabled: isValTrue(saasPlan.stories_enabled, true),
      gst_invoice_enabled: isValTrue(saasPlan.gst_invoice_enabled, true),
      analytics_export_enabled: isValTrue(saasPlan.analytics_export_enabled, true),
      multi_language_enabled: isValTrue(saasPlan.multi_language_enabled, true),
      watermark_removal_enabled: isValTrue(saasPlan.watermark_removal_enabled, true),
      custom_domain_enabled: isValTrue(saasPlan.custom_domain_enabled, true),
      dual_printer_enabled: isValTrue(saasPlan.dual_printer_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan'),
    };

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
    const isComplimentary = mandateStatus === 'admin_granted' || r.subscription_type === 'ADMIN_GRANTED';

    // 1. REQUIRED ADMIN ACCESS RULES:
    // A) subscription.status === "trialing" AND mandate_status === "active"
    // B) subscription.status === "active"
    // C) subscription.status === "payment_failed" AND grace period active
    // D) subscription.status === "grace_period"
    // E) Existing active restaurant (active === 1 and not expired)
    // F) Super Admin Granted Complimentary VIP Access
    const isRuleA = (subStatus === 'trialing' || isTrialActive) && mandateStatus === 'active';
    const isRuleB = subStatus === 'active';
    const isRuleC = subStatus === 'payment_failed' && isGracePeriodActive;
    const isRuleD = subStatus === 'grace_period';
    const isRuleE = (r.active === 1 || r.active === true) && (mandateStatus === 'active' || !r.trial_started_at || isTrialActive);
    const isRuleF = isComplimentary;

    const isAllowed = Boolean(isRuleA || isRuleB || isRuleC || isRuleD || isRuleE || isRuleF);

    // 2. BILLING REDIRECT CONDITIONS:
    // Redirect ONLY when access is not allowed or trial/subscription has expired:
    // - subscription.status === "expired" (trial and grace period ended)
    // - subscription.status === "cancelled" and trial ended
    const isExpired = subStatus === 'expired' && !isTrialActive && !isGracePeriodActive;
    // cancel_requested but period still active → NOT billing required
    const hasCancelRequestedButActive = sub?.cancel_requested_at && (isTrialActive || (sub?.current_period_end && new Date(sub.current_period_end) >= now));
    const isCancelled = subStatus === 'cancelled' && !isTrialActive && !hasCancelRequestedButActive;

    const billingRequired = !isComplimentary && (!isAllowed || isExpired || isCancelled);

    const sysRows = await query("SELECT value FROM system_settings WHERE key = 'default_trial_days'");
    const defaultTrialDays = parseInt(sysRows[0]?.value || '14', 10);

    res.json({
      status: isComplimentary ? 'active' : subStatus,
      active: !billingRequired,
      is_allowed: !billingRequired,
      billing_required: billingRequired,
      billing_setup: isComplimentary || mandateStatus === 'active' ? 'complete' : 'incomplete',
      grace_period_active: isGracePeriodActive,
      plan_tier: r.plan_tier || 'pro',
      plan_price: planPrice,
      whatsapp_enabled: matrixPermissions.whatsapp_enabled,
      direct_ordering_enabled: matrixPermissions.direct_ordering_enabled,
      google_reviews_enabled: matrixPermissions.google_reviews_enabled,
      max_combos: matrixPermissions.max_combos,
      permissions: matrixPermissions,
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

// POST /api/admin/forgot-password - Unauthenticated password reset disabled for production security
router.post('/forgot-password', async (req, res) => {
  return res.status(410).json({
    error: 'PASSWORD_RESET_DISABLED',
    message: 'Direct password reset via this endpoint is disabled for account security. Please contact Super Admin support via WhatsApp or email to request account recovery.'
  });
});


// Admin Dashboard Summary Statistics (OPERATIONAL ROUTE)
router.get('/stats', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const [catRes, dishRes, activeRes] = await Promise.all([
      query('SELECT COUNT(*) as count FROM categories WHERE restaurant_id = $1', [targetId]),
      query('SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1', [targetId]),
      query("SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1 AND (available = 1 OR available IS TRUE OR available::text = '1')", [targetId])
    ]);

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

router.post('/upload', authenticateToken, requireActiveSubscription, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.warn('[UPLOAD NOTICE] Multer file upload error:', err.message);
      return res.status(400).json({ success: false, error: err.message || 'Image upload failed' });
    }
    next();
  });
}, async (req, res) => {
  console.log('[R2 UPLOAD TRACE] request received');
  console.log('[R2 UPLOAD TRACE] route reached');

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file uploaded' });
  }

  // Get buffer safely from memoryStorage (or fallback file path if present)
  const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);
  if (!fileBuffer) {
    return res.status(400).json({ success: false, error: 'No image buffer received' });
  }

  const safeFilename = req.file.filename || req.file.originalname || `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  console.log('[R2 UPLOAD TRACE] filename:', safeFilename);

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

  const entityType = req.query?.entityType || req.body?.entityType || 'dishes';
  const isSuperAdminUpload = req.user?.role === 'superadmin' || entityType === 'superadmin' || entityType === 'branding';
  const restaurantId = isSuperAdminUpload ? null : (req.user ? req.user.restaurant_id : null);
  if (!isSuperAdminUpload && !restaurantId) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid tenant restaurant_id is required for image upload' });
  }

  const r2Configured = isR2Active();

  if (r2Configured) {
    try {
      console.log('[R2 UPLOAD TRACE] Uploading to Cloudflare R2 bucket');
      const r2Result = await uploadImageToR2({
        buffer: fileBuffer,
        mimeType: req.file.mimetype,
        restaurantId,
        entityType
      });

      await saveR2ImageToDb(
        safeFilename,
        r2Result.mimeType,
        r2Result.objectKey,
        r2Result.publicUrl,
        restaurantId,
        null
      );

      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

      const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
      return res.json({
        success: true,
        url: proxyUrl,
        r2ProxyUrl: proxyUrl,
        key: r2Result.objectKey,
        r2Url: r2Result.publicUrl
      });
    } catch (r2Err) {
      console.error('[R2 UPLOAD ERROR] R2 upload failed:', r2Err.message);
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ success: false, error: `R2 Storage upload failed: ${r2Err.message}` });
    }
  }

  const isProduction = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
  if (isProduction) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ success: false, error: 'Cloudflare R2 is not configured in production environment variables' });
  }

  // LOCAL DEV ONLY FALLBACK: Save locally and store in database
  try {
    const localUrl = `/uploads/${safeFilename}`;
    await saveImageToDb(safeFilename, req.file.mimetype, fileBuffer);
    return res.json({
      success: true,
      url: localUrl,
      r2ProxyUrl: localUrl,
      key: safeFilename,
      storage: 'local'
    });
  } catch (localErr) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[IMAGE UPLOAD ERROR] Local upload fallback error:', localErr.message);
    return res.status(500).json({ success: false, error: localErr.message });
  }
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

// Purge Orphaned R2 Bucket Objects Endpoint
router.post('/r2/purge-orphans', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const dishes = await query("SELECT image FROM dishes WHERE image IS NOT NULL AND image != ''");
    const cats = await query("SELECT image FROM categories WHERE image IS NOT NULL AND image != ''");
    const restos = await query("SELECT logo FROM restaurants WHERE logo IS NOT NULL AND logo != ''");
    const stored = await query("SELECT image_key FROM stored_images WHERE image_key IS NOT NULL AND image_key != ''");

    const allUrls = [...dishes, ...cats, ...restos].map(r => r.image || r.logo).filter(Boolean);
    const activeR2Keys = [];

    allUrls.forEach(url => {
      const match = url.match(/restaurants\/[^\s'"]+/);
      if (match && match[0]) activeR2Keys.push(match[0]);
    });

    stored.forEach(s => {
      if (s.image_key) activeR2Keys.push(s.image_key);
    });

    const result = await purgeOrphanedR2Objects(activeR2Keys);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Safe Legacy Base64 -> Cloudflare R2 Migration Endpoint
router.post('/r2/migrate-images', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const isDryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : (req.body?.limit ? parseInt(req.body.limit, 10) : null);
    const batchSize = req.query.batch ? parseInt(req.query.batch, 10) : 25;

    const allRows = await query("SELECT filename, mime_type, storage_provider, image_key, image_url, restaurant_id, data FROM stored_images ORDER BY filename ASC");
    
    const stats = {
      totalRecords: allRows.length,
      alreadyR2: 0,
      migrationCandidates: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      invalidBase64: 0,
      invalidImage: 0,
      missingRestaurantId: 0,
      failedRecords: []
    };

    const candidates = [];
    allRows.forEach(r => {
      if (r.storage_provider === 'r2' && r.image_key) {
        stats.alreadyR2++;
        stats.skipped++;
      } else {
        candidates.push(r);
      }
    });

    stats.migrationCandidates = candidates.length;
    let itemsToProcess = candidates;
    if (limit && limit > 0) {
      itemsToProcess = candidates.slice(0, limit);
    }

    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
      const currentBatch = itemsToProcess.slice(i, i + batchSize);
      for (const row of currentBatch) {
        const restoId = row.restaurant_id;
        if (!restoId) {
          stats.missingRestaurantId++;
          stats.failed++;
          continue;
        }

        if (!row.data || typeof row.data !== 'string' || row.data.trim().length === 0) {
          stats.invalidBase64++;
          stats.failed++;
          stats.failedRecords.push({ filename: row.filename, restaurant_id: restoId, reason: 'Empty Base64 data' });
          continue;
        }

        let base64Clean = row.data.trim();
        if (base64Clean.includes('base64,')) base64Clean = base64Clean.split('base64,')[1];

        let rawBuffer;
        try {
          rawBuffer = Buffer.from(base64Clean, 'base64');
          if (!rawBuffer || rawBuffer.length === 0) throw new Error('Empty decoded buffer');
        } catch (b64Err) {
          stats.invalidBase64++;
          stats.failed++;
          stats.failedRecords.push({ filename: row.filename, restaurant_id: restoId, reason: b64Err.message });
          continue;
        }

        let webpBuffer;
        try {
          const imagePipeline = sharp(rawBuffer);
          const meta = await imagePipeline.metadata();
          if (!meta || !meta.format) throw new Error('Invalid image bytes');

          let transformer = sharp(rawBuffer);
          if (meta.width && meta.width > 1200) {
            transformer = transformer.resize(1200, null, { withoutEnlargement: true });
          }

          webpBuffer = await transformer.webp({ quality: 85 }).toBuffer();
        } catch (imgErr) {
          stats.invalidImage++;
          stats.failed++;
          stats.failedRecords.push({ filename: row.filename, restaurant_id: restoId, reason: imgErr.message });
          continue;
        }

        let entityType = 'dishes';
        if (row.filename.includes('category') || row.filename.includes('cat')) entityType = 'categories';
        else if (row.filename.includes('logo') || row.filename.includes('resto')) entityType = 'logos';

        if (isDryRun) {
          stats.successful++;
          continue;
        }

        try {
          const r2Result = await uploadImageToR2({
            buffer: webpBuffer,
            mimeType: 'image/webp',
            restaurantId: restoId,
            entityType
          });

          if (!r2Result || !r2Result.objectKey) throw new Error('Empty R2 key returned');

          const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
          const finalUrl = r2Result.publicUrl || proxyUrl;

          // SAFE DB UPDATE: UPDATE storage_provider, image_key, image_url ONLY. LEAVE DATA COLUMN INTACT!
          await query(
            "UPDATE stored_images SET storage_provider = 'r2', image_key = $1, image_url = $2 WHERE filename = $3",
            [r2Result.objectKey, finalUrl, row.filename]
          );

          stats.successful++;
        } catch (uploadErr) {
          stats.failed++;
          stats.failedRecords.push({ filename: row.filename, restaurant_id: restoId, reason: uploadErr.message });
        }
      }
    }

    res.json({ success: true, isDryRun, limit, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-Mirror External & Local Images -> Cloudflare R2 for All Restaurants
router.post('/r2/mirror-external', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    let mirroredCount = 0;
    let failCount = 0;

    // 1. Mirror Restaurant Logos
    const restos = await query("SELECT id, name, logo FROM restaurants WHERE logo NOT LIKE '%/api/r2-proxy/%' AND logo IS NOT NULL AND logo != '' AND logo != '/uploads/logo.jpg'");
    for (const r of restos) {
      try {
        let inputBuffer = null;
        if (r.logo.startsWith('/uploads/')) {
          const localPath = path.resolve('public', r.logo.replace(/^\//, ''));
          if (fs.existsSync(localPath)) inputBuffer = fs.readFileSync(localPath);
        } else if (r.logo.startsWith('http')) {
          const fetchRes = await fetch(r.logo, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(15000) });
          if (fetchRes.ok) inputBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (inputBuffer && inputBuffer.length > 0) {
          const webpBuffer = await sharp(inputBuffer).resize(800, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
          const r2Result = await uploadImageToR2({ buffer: webpBuffer, mimeType: 'image/webp', restaurantId: r.id, entityType: 'logos' });
          if (r2Result && r2Result.objectKey) {
            const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
            await query("UPDATE restaurants SET logo = $1 WHERE id = $2", [proxyUrl, r.id]);
            await saveR2ImageToDb(`logo-mirrored-${r.id}-${Date.now()}.webp`, 'image/webp', r2Result.objectKey, r2Result.publicUrl || proxyUrl, r.id);
            mirroredCount++;
          }
        }
      } catch (err) {
        failCount++;
      }
    }

    // 2. Mirror Categories
    const categories = await query("SELECT id, name, restaurant_id, image FROM categories WHERE image NOT LIKE '%/api/r2-proxy/%' AND image IS NOT NULL AND image != '' AND image != '/uploads/logo.jpg'");
    for (const cat of categories) {
      try {
        let inputBuffer = null;
        if (cat.image.startsWith('/uploads/')) {
          const localPath = path.resolve('public', cat.image.replace(/^\//, ''));
          if (fs.existsSync(localPath)) inputBuffer = fs.readFileSync(localPath);
        } else if (cat.image.startsWith('http')) {
          const fetchRes = await fetch(cat.image, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(15000) });
          if (fetchRes.ok) inputBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (inputBuffer && inputBuffer.length > 0 && cat.restaurant_id) {
          const webpBuffer = await sharp(inputBuffer).resize(1000, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
          const r2Result = await uploadImageToR2({ buffer: webpBuffer, mimeType: 'image/webp', restaurantId: cat.restaurant_id, entityType: 'categories' });
          if (r2Result && r2Result.objectKey) {
            const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
            await query("UPDATE categories SET image = $1 WHERE id = $2", [proxyUrl, cat.id]);
            await saveR2ImageToDb(`cat-mirrored-${cat.id}-${Date.now()}.webp`, 'image/webp', r2Result.objectKey, r2Result.publicUrl || proxyUrl, cat.restaurant_id);
            mirroredCount++;
          }
        }
      } catch (err) {
        failCount++;
      }
    }

    // 3. Mirror Dishes
    const dishes = await query("SELECT id, name, restaurant_id, image FROM dishes WHERE image NOT LIKE '%/api/r2-proxy/%' AND image IS NOT NULL AND image != '' AND image != '/uploads/logo.jpg'");
    for (const dish of dishes) {
      try {
        let inputBuffer = null;
        if (dish.image.startsWith('/uploads/')) {
          const localPath = path.resolve('public', dish.image.replace(/^\//, ''));
          if (fs.existsSync(localPath)) inputBuffer = fs.readFileSync(localPath);
        } else if (dish.image.startsWith('http')) {
          const fetchRes = await fetch(dish.image, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, signal: AbortSignal.timeout(15000) });
          if (fetchRes.ok) inputBuffer = Buffer.from(await fetchRes.arrayBuffer());
        }

        if (inputBuffer && inputBuffer.length > 0 && dish.restaurant_id) {
          const webpBuffer = await sharp(inputBuffer).resize(1200, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
          const r2Result = await uploadImageToR2({ buffer: webpBuffer, mimeType: 'image/webp', restaurantId: dish.restaurant_id, entityType: 'dishes' });
          if (r2Result && r2Result.objectKey) {
            const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
            await query("UPDATE dishes SET image = $1 WHERE id = $2", [proxyUrl, dish.id]);
            await saveR2ImageToDb(`dish-mirrored-${dish.id}-${Date.now()}.webp`, 'image/webp', r2Result.objectKey, r2Result.publicUrl || proxyUrl, dish.restaurant_id);
            mirroredCount++;
          }
        }
      } catch (err) {
        failCount++;
      }
    }

    res.json({ success: true, mirroredCount, failCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Category Management (Tenant Scoped - OPERATIONAL ROUTES)
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const categories = await query('SELECT * FROM categories WHERE restaurant_id = $1 ORDER BY sort_order ASC, id ASC', [targetId]);
    res.json(categories);
  } catch (err) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { name, name_hi, image, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const processedImage = await processExternalImageUrl(image, targetId, 'categories');
    const order = sort_order || 0;
    const result = await query(
      'INSERT INTO categories (restaurant_id, name, name_hi, image, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [targetId, name, name_hi || '', processedImage || null, order]
    );
    res.json({ success: true, id: result[0]?.id || result.lastInsertRowid });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { id } = req.params;
    const { name, name_hi, image, sort_order } = req.body;

    const processedImage = await processExternalImageUrl(image, targetId, 'categories');

    // Fetch old category image to clean up if replaced or removed
    try {
      const oldCatRows = await query('SELECT image FROM categories WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
      const oldImage = oldCatRows && oldCatRows.length > 0 ? oldCatRows[0].image : null;
      if (oldImage && oldImage !== processedImage) {
        await cleanupImage(oldImage);
      }
    } catch (cleanErr) {
      console.warn('Notice cleaning up replaced category image:', cleanErr.message);
    }

    await query(
      'UPDATE categories SET name = $1, name_hi = $2, image = $3, sort_order = $4 WHERE id = $5 AND restaurant_id = $6',
      [name, name_hi || '', processedImage, sort_order || 0, id, targetId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const dishes = await query('SELECT * FROM dishes WHERE restaurant_id = $1 ORDER BY id DESC', [targetId]);
    res.json(dishes);
  } catch (err) {
    console.error('Fetch dishes error:', err);
    res.status(500).json({ error: 'Failed to fetch dishes' });
  }
});

router.post('/dishes', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { 
      category_id, name, name_hi, description, description_hi, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available 
    } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({ error: 'Category, name, and price are required' });
    }

    // Verify category belongs strictly to this tenant restaurant
    const catCheck = await query('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2', [category_id, targetId]);
    if (!catCheck || catCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid category. The specified category does not belong to your restaurant.' });
    }

    const processedImage = await processExternalImageUrl(image, targetId, 'dishes');

    const availVal = available === false ? 0 : 1;
    const result = await query(
      `INSERT INTO dishes (
        restaurant_id, category_id, name, name_hi, description, description_hi, image, price, price_half, 
        portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
      [
        targetId, category_id, name, name_hi || '', description || '', description_hi || '', processedImage || '', price, price_half || null,
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { id } = req.params;
    const { 
      category_id, name, name_hi, description, description_hi, image, price, price_half, 
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available 
    } = req.body;

    // Verify category belongs strictly to this tenant restaurant
    if (category_id) {
      const catCheck = await query('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2', [category_id, targetId]);
      if (!catCheck || catCheck.length === 0) {
        return res.status(400).json({ error: 'Invalid category. The specified category does not belong to your restaurant.' });
      }
    }

    const processedImage = await processExternalImageUrl(image, targetId, 'dishes');

    // Fetch old dish image to clean up if replaced or removed
    try {
      const oldDishRows = await query('SELECT image FROM dishes WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
      const oldImage = oldDishRows && oldDishRows.length > 0 ? oldDishRows[0].image : null;
      if (oldImage && oldImage !== processedImage) {
        await cleanupImage(oldImage);
      }
    } catch (cleanErr) {
      console.warn('Notice cleaning up replaced dish image:', cleanErr.message);
    }

    const availVal = available ? 1 : 0;
    await query(
      `UPDATE dishes 
       SET category_id = $1, name = $2, name_hi = $3, description = $4, description_hi = $5, image = $6, price = $7, price_half = $8,
           portion = $9, portion_half_label = $10, portion_full_label = $11, badge = $12,
           ingredients = $13, taste_profile = $14, type = $15, available = $16, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $17 AND restaurant_id = $18`,
      [
        category_id, name, name_hi || '', description || '', description_hi || '', processedImage, price, price_half || null,
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const { name, tagline, logo, phone, address, openingHours, google_review_url, google_reviews_enabled, filters_visibility, currency_symbol, fssai_lic_no, resto_type, whatsapp_number, whatsapp_enabled, theme_color, latitude, longitude, max_distance_meters, gst_enabled, gstin_number, total_tables, order_retention_days, custom_domain, onboarding_completed, location_initialized } = req.body;

    let cleanDomain = null;
    if (custom_domain !== undefined) {
      cleanDomain = (custom_domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      if (cleanDomain) {
        const domainCheck = await query('SELECT id FROM restaurants WHERE (LOWER(custom_domain) = $1 OR LOWER(custom_domain) = $2) AND id != $3', [cleanDomain, `www.${cleanDomain}`, targetId]);
        if (domainCheck && domainCheck.length > 0) {
          return res.status(400).json({ error: `Domain '${cleanDomain}' is already mapped to another restaurant!` });
        }
      }
    }

    const visJson = typeof filters_visibility === 'object' ? JSON.stringify(filters_visibility) : filters_visibility;

    const processedLogo = logo !== undefined ? await processExternalImageUrl(logo, targetId, 'logos') : null;

    // Fetch old restaurant logo to clean up if replaced or removed
    if (logo !== undefined) {
      try {
        const oldRestoRows = await query('SELECT logo FROM restaurants WHERE id = $1', [targetId]);
        const oldLogo = oldRestoRows && oldRestoRows.length > 0 ? oldRestoRows[0].logo : null;
        if (oldLogo && oldLogo !== processedLogo && oldLogo !== '/uploads/logo.jpg') {
          await cleanupImage(oldLogo);
        }
      } catch (cleanErr) {
        console.warn('Notice cleaning up replaced restaurant logo:', cleanErr.message);
      }
    }

    const onbBool = onboarding_completed !== undefined ? (onboarding_completed === true || onboarding_completed === 1 || onboarding_completed === 'true' ? true : false) : null;
    const locBool = location_initialized !== undefined ? (location_initialized === true || location_initialized === 1 || location_initialized === 'true' ? true : false) : null;

    await query(`
      UPDATE restaurants 
      SET name = COALESCE($1, name), tagline = COALESCE($2, tagline), logo = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE logo END, phone = COALESCE($4, phone), address = COALESCE($5, address), opening_hours = COALESCE($6, opening_hours), google_review_url = COALESCE($7, google_review_url), filters_visibility = COALESCE($8, filters_visibility), currency_symbol = COALESCE($9, currency_symbol), fssai_lic_no = COALESCE($10, fssai_lic_no), resto_type = COALESCE($11, resto_type), whatsapp_number = COALESCE($12, whatsapp_number), whatsapp_enabled = COALESCE($13, whatsapp_enabled), theme_color = COALESCE($14, theme_color), latitude = COALESCE($15, latitude), longitude = COALESCE($16, longitude), max_distance_meters = COALESCE($17, max_distance_meters), gst_enabled = COALESCE($18, gst_enabled), gstin_number = COALESCE($19, gstin_number), total_tables = COALESCE($20, total_tables), order_retention_days = COALESCE($21, order_retention_days), google_reviews_enabled = COALESCE($22, google_reviews_enabled), custom_domain = CASE WHEN $23::text IS NOT NULL THEN $23 ELSE custom_domain END, onboarding_completed = COALESCE($24, onboarding_completed), location_initialized = COALESCE($25, location_initialized)
      WHERE id = $26
    `, [
      name !== undefined ? name : null,
      tagline !== undefined ? tagline : null,
      processedLogo !== null ? processedLogo : (logo !== undefined ? '' : null),
      phone !== undefined ? phone : null,
      address !== undefined ? address : null,
      openingHours !== undefined ? openingHours : null,
      google_review_url !== undefined ? google_review_url : null,
      visJson !== undefined ? visJson : null,
      currency_symbol !== undefined ? currency_symbol : null,
      fssai_lic_no !== undefined ? fssai_lic_no : null,
      resto_type !== undefined ? resto_type : null,
      whatsapp_number !== undefined ? whatsapp_number : null,
      whatsapp_enabled !== undefined ? (whatsapp_enabled !== false && whatsapp_enabled !== 0 ? 1 : 0) : null,
      theme_color !== undefined ? theme_color : null,
      latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude !== undefined && longitude !== null ? Number(longitude) : null,
      max_distance_meters !== undefined ? Number(max_distance_meters) : null,
      gst_enabled !== undefined ? (gst_enabled ? 1 : 0) : null,
      gstin_number !== undefined ? gstin_number : null,
      total_tables !== undefined && total_tables !== null ? Number(total_tables) : null,
      order_retention_days !== undefined ? Number(order_retention_days) : null,
      google_reviews_enabled !== undefined ? (google_reviews_enabled !== false && google_reviews_enabled !== 0 ? 1 : 0) : null,
      cleanDomain !== null ? cleanDomain : (custom_domain !== undefined ? '' : null),
      onbBool,
      locBool,
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const orders = await query(
      'SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 100',
      [targetId]
    );

    const formatted = orders.map(o => {
      let parsedItems = [];
      if (typeof o.items === 'string') {
        try { parsedItems = JSON.parse(o.items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(o.items)) {
        parsedItems = o.items;
      }
      return {
        ...o,
        items: parsedItems
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PATCH Update Order Status (OPERATIONAL ROUTE)
router.patch('/orders/:id/status', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { id } = req.params;
    const { status, sent_to_kds, kitchen_prepared } = req.body;

    const numericId = parseInt(id, 10);
    const orderId = isNaN(numericId) ? id : numericId;

    let kdsVal = (sent_to_kds === 1 || sent_to_kds === true || sent_to_kds === '1' || status === 'kitchen') ? 1 : 0;
    if (status === 'accepted' && (sent_to_kds === 0 || sent_to_kds === '0')) {
      kdsVal = 0;
    }

    let prepVal = (kitchen_prepared === 1 || kitchen_prepared === true || kitchen_prepared === '1') ? 1 : 0;

    let updateRes = null;
    try {
      updateRes = await query(
        'UPDATE orders SET status = $1, sent_to_kds = $2, kitchen_prepared = $3 WHERE id = $4 AND restaurant_id = $5 RETURNING id',
        [status, kdsVal, prepVal, orderId, targetId]
      );
    } catch (colErr) {
      console.warn('Auto-healing columns in orders table:', colErr.message);
      try { await query('ALTER TABLE orders ADD COLUMN sent_to_kds INT DEFAULT 0'); } catch (e1) {}
      try { await query('ALTER TABLE orders ADD COLUMN kitchen_prepared INT DEFAULT 0'); } catch (e2) {}
      updateRes = await query(
        'UPDATE orders SET status = $1, sent_to_kds = $2, kitchen_prepared = $3 WHERE id = $4 AND restaurant_id = $5 RETURNING id',
        [status, kdsVal, prepVal, orderId, targetId]
      );
    }

    if (!updateRes || updateRes.length === 0) {
      return res.status(404).json({ error: 'Order not found or does not belong to this restaurant' });
    }

    res.json({ success: true, id: orderId, status, sent_to_kds: kdsVal, kitchen_prepared: prepVal });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// DELETE Purge Order (Manual Hard Delete)
router.delete('/orders/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { id } = req.params;

    await query('DELETE FROM orders WHERE id = $1 AND restaurant_id = $2', [id, targetId]);
    res.json({ success: true, id, message: 'Order purged successfully' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// GET Live Table Service Requests / Waiter Calls (OPERATIONAL ROUTE)
router.get('/service-requests', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const orders = await query(
      "SELECT id, total_amount, status, items, created_at FROM orders WHERE restaurant_id = $1 AND status NOT IN ('rejected', 'cancelled') ORDER BY id DESC",
      [targetId]
    );

    const parseSafeDate = (dateVal) => {
      if (!dateVal) return null;
      if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
      let str = String(dateVal).trim();
      if (str.includes(' ') && !str.includes('T')) {
        str = str.replace(' ', 'T');
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    };

    const getFormattedLocalDate = (dateObj) => {
      const d = parseSafeDate(dateObj);
      if (!d) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const now = new Date();
    const todayStr = getFormattedLocalDate(now);

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
      const ds = getFormattedLocalDate(d);
      dailySalesMap[ds] = 0;
    }

    orders.forEach(o => {
      const amt = Number(o.total_amount) || 0;
      totalSales += amt;

      const createdAtDate = parseSafeDate(o.created_at) || new Date();
      const dateStr = getFormattedLocalDate(createdAtDate);

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
      today_revenue: todaySales,
      today_orders: todayOrders,
      weekly_sales: weeklySales,
      days_7_revenue: weeklySales,
      monthly_sales: monthlySales,
      days_30_revenue: monthlySales,
      total_sales: totalSales,
      total_revenue: totalSales,
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const processedImage = await processExternalImageUrl(image, targetId, 'combos');
    const result = await query(
      'INSERT INTO combos (restaurant_id, name, description, price, image, items, badge, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [targetId, name, description || '', price, processedImage || null, itemsStr, badge || '', sort_order || 0]
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { name, description, price, image, items, badge, sort_order, available } = req.body;
    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);

    const processedImage = await processExternalImageUrl(image, targetId, 'combos');

    // Fetch old combo image to clean up if replaced or removed
    try {
      const oldComboRows = await query('SELECT image FROM combos WHERE id = $1 AND restaurant_id = $2', [req.params.id, targetId]);
      const oldImage = oldComboRows && oldComboRows.length > 0 ? oldComboRows[0].image : null;
      if (oldImage && oldImage !== processedImage) {
        await cleanupImage(oldImage);
      }
    } catch (cleanErr) {
      console.warn('Notice cleaning up replaced combo image:', cleanErr.message);
    }

    await query(
      'UPDATE combos SET name = $1, description = $2, price = $3, image = $4, items = $5, badge = $6, sort_order = $7, available = $8 WHERE id = $9 AND restaurant_id = $10',
      [name, description || '', price, processedImage, itemsStr, badge || '', sort_order || 0, available !== undefined ? available : 1, req.params.id, targetId]
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
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
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    // Fetch combo image before deleting
    const comboRows = await query('SELECT image FROM combos WHERE id = $1 AND restaurant_id = $2', [req.params.id, targetId]);
    if (comboRows && comboRows.length > 0 && comboRows[0].image) {
      await cleanupImage(comboRows[0].image);
    }

    await query('DELETE FROM combos WHERE id = $1 AND restaurant_id = $2', [req.params.id, targetId]);
    res.json({ message: 'Combo deleted successfully' });
  } catch (err) {
    console.error('Delete combo error:', err);
    res.status(500).json({ error: 'Failed to delete combo' });
  }
});

// POST generate Google Review AI Auto-Reply using Google Gemini 1.5 Flash (with fallback smart engine)
router.post('/generate-ai-review-reply', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const { reviewText, starRating = 5, selectedTone = 'warm', restaurantName } = req.body;
    const targetRestoName = restaurantName || 'our restaurant';

    // 1. Check if GEMINI_API_KEY is available in process.env
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.VITE_GEMINI_API_KEY;

    if (apiKey) {
      try {
        const prompt = `You are a polite, professional restaurant customer relationship assistant for '${targetRestoName}'. 
Generate a personalized, gracious, customer-friendly reply to the following ${starRating}-star customer review.
Tone: ${selectedTone} (e.g. warm, professional, apologetic, short).
Customer Review: "${reviewText || 'Great food and service!'}"
Instructions:
- Keep the reply concise (under 60 words).
- If dishes or specific experiences are mentioned in the review, acknowledge them nicely.
- If it's a 1-3 star review, be humble, express sincere regret, and invite them to contact management.
- Do not use hashtags or excessive emojis.
- Output ONLY the reply text, no extra commentary or quotes.`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (replyText) {
            return res.json({ success: true, reply: replyText, provider: 'gemini_ai' });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API fetch error, falling back to smart engine:', geminiErr.message);
      }
    }

    // 2. Smart Natural Language Engine Fallback (Dual Resilience)
    const textLower = (reviewText || '').toLowerCase();
    const mentionsPaneer = textLower.includes('paneer');
    const mentionsNaan = textLower.includes('naan');
    const mentionsSweet = textLower.includes('sweet') || textLower.includes('mithai');
    const dishMention = mentionsPaneer ? 'Paneer dishes' : mentionsSweet ? 'sweet delicacies' : mentionsNaan ? 'freshly baked Naans' : 'dishes';

    let reply = '';
    const rating = Number(starRating);
    if (rating >= 4) {
      if (selectedTone === 'warm') {
        reply = `Thank you so much for the glowing ${rating}-star review! 🌟 We are absolutely thrilled to hear that you enjoyed ${reviewText ? `our ${dishMention}` : 'your dining experience'} at ${targetRestoName}. Serving you fresh, flavorful meals is our top priority. We look forward to welcoming you back again soon for another delicious feast! 🙏😊`;
      } else if (selectedTone === 'professional') {
        reply = `Dear Guest, thank you for sharing your positive feedback and ${rating}-star rating for ${targetRestoName}. We take immense pride in maintaining high standards of quality and service. Your appreciation motivates our entire team. We look forward to serving you again soon. Best regards, Management Team.`;
      } else if (selectedTone === 'short') {
        reply = `Thank you for the fantastic ${rating}-star review! 🙏 We are delighted you loved your meal at ${targetRestoName}. Hope to see you again soon!`;
      } else {
        reply = `Thank you for choosing ${targetRestoName}! We truly appreciate your feedback and hope your next visit is even more memorable. ✨`;
      }
    } else {
      if (selectedTone === 'apologetic') {
        reply = `Dear Guest, thank you for bringing your concern to our attention. We sincerely apologize for not meeting your expectations during your recent visit to ${targetRestoName}. Providing prompt and high-quality food is our commitment, and we regret the issue you experienced. Please reach out directly to us so we can make this right for you. We hope to serve you better next time.`;
      } else if (selectedTone === 'professional') {
        reply = `Dear Valued Customer, thank you for providing your constructive feedback regarding ${targetRestoName}. We apologize for the inconvenience caused. We have shared your comments with our kitchen & service staff for immediate corrective action. Please give us another opportunity to serve you a better experience.`;
      } else {
        reply = `We sincerely apologize for your experience at ${targetRestoName}. We take all customer feedback seriously and are taking immediate steps to resolve this. Kindly contact our team so we can assist you personally.`;
      }
    }

    return res.json({ success: true, reply, provider: 'smart_engine' });
  } catch (err) {
    console.error('Generate AI Review Reply error:', err);
    res.status(500).json({ error: 'Failed to generate AI reply' });
  }
});

export default router;
