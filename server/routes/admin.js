import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, runAutoDataSummarization, saveImageToDb, saveR2ImageToDb, getImageRecordFromDb, deleteImageRecordFromDb } from '../db.js';
import { isR2Active, uploadImageToR2, deleteImageFromR2, getR2Diagnostics, purgeOrphanedR2Objects } from '../services/r2ImageService.js';
import { authenticateToken, requireActiveSubscription, checkSubscriptionStatus } from '../middleware/auth.js';
import { JWT_SECRET } from '../config/jwt.js';
import { adminLoginRateLimiter } from '../middleware/rateLimiters.js';
import { clearRestoResolveCache, clearMenuBundleCache } from './api.js';
import { normalizeVerificationMode } from '../utils/presenceVerification.js';
import {
  BUSINESS_TYPES,
  FOOD_TYPES,
  SERVICE_MODELS,
  BUSINESS_TYPE_ALIASES,
  FOOD_TYPE_ALIASES,
  SERVICE_MODEL_ALIASES,
  BUSINESS_TYPE_DEFAULT_SERVICE_MODEL,
  BUSINESS_TYPE_ALLOWED_SERVICE_MODELS,
  isValidBusinessType,
  isValidFoodType,
  isValidServiceModel,
  isServiceModelValidForBusinessType,
  resolveBusinessCategoryFromType,
  resolveServiceModelForBusinessType,
  resolveBusinessProfile,
  resolveBannerBadge
} from '../config/businessTaxonomy.js';

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

    const tierKey = (restos[0]?.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT allowed_themes, theme_color FROM saas_plans WHERE LOWER(key) = $1', [tierKey]);
    const saasPlan = planRows[0] || {};
    const allowedThemes = saasPlan.allowed_themes || (tierKey === 'basic' ? 'gold' : tierKey === 'pro' ? 'gold,emerald,crimson,navy' : 'ALL');

    const { kds_pin_hash, ...safeRestoObj } = (restos[0] || {});
    const resto = restos[0] ? {
      ...safeRestoObj,
      kds_pin_configured: Boolean(kds_pin_hash),
      allowed_themes: allowedThemes,
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
      kds_enabled: isValTrue(saasPlan.kds_enabled, tierKey === 'enterprise' || tierKey === 'vip_ultra_plan'),
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
      allowed_themes: saasPlan.allowed_themes || (tierKey === 'basic' ? 'gold' : tierKey === 'pro' ? 'gold,emerald,crimson,navy' : 'ALL')
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
      query("SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1 AND (available IS TRUE OR available::text IN ('1', 'true', 't'))", [targetId])
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
        fileBuffer
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
      console.warn('[R2 UPLOAD NOTICE] R2 upload error, falling back to database storage:', r2Err.message);
    }
  }

  // RESILIENT FALLBACK: Store image buffer in Neon PostgreSQL database stored_images table
  try {
    const objectKey = (isSuperAdminUpload)
      ? 'superadmin/branding/logo.webp'
      : (restaurantId ? `restaurants/${restaurantId}/${entityType}/${safeFilename}.webp` : `uploads/${safeFilename}`);

    const proxyUrl = `/api/r2-proxy/${objectKey}`;

    await saveR2ImageToDb(
      safeFilename,
      req.file.mimetype,
      objectKey,
      proxyUrl,
      restaurantId,
      fileBuffer
    );
    await saveImageToDb(safeFilename, req.file.mimetype, fileBuffer);

    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    return res.json({
      success: true,
      url: proxyUrl,
      r2ProxyUrl: proxyUrl,
      key: objectKey,
      storage: 'database'
    });
  } catch (localErr) {
    if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[IMAGE UPLOAD ERROR] Storage fallback error:', localErr.message);
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

    // Authoritative SaaS Plan Quota Check (Categories)
    const restoRows = await query('SELECT plan_tier FROM restaurants WHERE id = $1', [targetId]);
    const planTier = (restoRows[0]?.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT max_categories FROM saas_plans WHERE LOWER(key) = $1', [planTier]);
    const rawMaxCategories = planRows[0]?.max_categories;
    const maxCategories = (rawMaxCategories !== undefined && rawMaxCategories !== null && Number(rawMaxCategories) > 0) ? Number(rawMaxCategories) : 9999;

    const countRows = await query('SELECT COUNT(*)::int as count FROM categories WHERE restaurant_id = $1', [targetId]);
    const currentCount = parseInt(countRows[0]?.count || 0, 10);

    if (currentCount >= maxCategories) {
      return res.status(403).json({
        success: false,
        error: 'plan_limit_reached',
        resource: 'categories',
        limit: maxCategories,
        current_count: currentCount,
        message: `Category limit reached! Your ${planTier.toUpperCase()} plan allows a maximum of ${maxCategories} categories. Please upgrade your SaaS plan to add more.`
      });
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

    // Authoritative SaaS Plan Quota Check (Dishes)
    const restoRows = await query('SELECT plan_tier FROM restaurants WHERE id = $1', [targetId]);
    const planTier = (restoRows[0]?.plan_tier || 'pro').toLowerCase();
    const planRows = await query('SELECT max_dishes FROM saas_plans WHERE LOWER(key) = $1', [planTier]);
    const rawMaxDishes = planRows[0]?.max_dishes;
    const maxDishes = (rawMaxDishes !== undefined && rawMaxDishes !== null && Number(rawMaxDishes) > 0) ? Number(rawMaxDishes) : 9999;

    const countRows = await query('SELECT COUNT(*)::int as count FROM dishes WHERE restaurant_id = $1', [targetId]);
    const currentCount = parseInt(countRows[0]?.count || 0, 10);

    if (currentCount >= maxDishes) {
      return res.status(403).json({
        success: false,
        error: 'plan_limit_reached',
        resource: 'dishes',
        limit: maxDishes,
        current_count: currentCount,
        message: `Dish limit reached! Your ${planTier.toUpperCase()} plan allows a maximum of ${maxDishes} dishes. Please upgrade your SaaS plan to add more.`
      });
    }

    // Verify category belongs strictly to this tenant restaurant
    const catCheck = await query('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2', [category_id, targetId]);
    if (!catCheck || catCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid category. The specified category does not belong to your restaurant.' });
    }

    const processedImage = await processExternalImageUrl(image, targetId, 'dishes');
    const modifiersVal = Array.isArray(req.body.modifiers) ? JSON.stringify(req.body.modifiers) : (typeof req.body.modifiers === 'string' ? req.body.modifiers : '[]');

    const availVal = available === false ? 0 : 1;
    const result = await query(
      `INSERT INTO dishes (
        restaurant_id, category_id, name, name_hi, description, description_hi, image, price, price_half, 
        portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available, modifiers
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
      [
        targetId, category_id, name, name_hi || '', description || '', description_hi || '', processedImage || '', price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '', ingredients || '', taste_profile || '', type || 'veg', availVal, modifiersVal
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
      portion, portion_half_label, portion_full_label, badge, ingredients, taste_profile, type, available, modifiers 
    } = req.body;

    // Verify category belongs strictly to this tenant restaurant
    if (category_id) {
      const catCheck = await query('SELECT id FROM categories WHERE id = $1 AND restaurant_id = $2', [category_id, targetId]);
      if (!catCheck || catCheck.length === 0) {
        return res.status(400).json({ error: 'Invalid category. The specified category does not belong to your restaurant.' });
      }
    }

    const processedImage = await processExternalImageUrl(image, targetId, 'dishes');
    const modifiersVal = Array.isArray(modifiers) ? JSON.stringify(modifiers) : (typeof modifiers === 'string' ? modifiers : '[]');

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
           ingredients = $13, taste_profile = $14, type = $15, available = $16, modifiers = $17, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $18 AND restaurant_id = $19`,
      [
        category_id, name, name_hi || '', description || '', description_hi || '', processedImage, price, price_half || null,
        portion || '', portion_half_label || '', portion_full_label || '', badge || '',
        ingredients || '', taste_profile || '', type || 'veg', availVal, modifiersVal, id, targetId
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

    const { name, tagline, logo, phone, address, openingHours, google_review_url, google_reviews_enabled, filters_visibility, currency_symbol, fssai_lic_no, resto_type, business_type, food_type, service_model, business_category, whatsapp_number, whatsapp_enabled, theme_color, latitude, longitude, max_distance_meters, gst_enabled, gstin_number, total_tables, total_cabins, total_rooms, total_vip, table_prefix, order_retention_days, custom_domain, location_initialized, owner_name, owner_email, city, state, pincode, table_verification_mode, staff_verification_timeout_seconds } = req.body;

    let cleanOwnerEmail = undefined;
    if (owner_email !== undefined) {
      if (owner_email === null || owner_email === '') {
        cleanOwnerEmail = null;
      } else if (typeof owner_email === 'string') {
        const trimmed = owner_email.trim().toLowerCase();
        if (trimmed.length > 255) {
          return res.status(400).json({ error: 'Email address cannot exceed 255 characters!' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          return res.status(400).json({ error: 'Please enter a valid email address (e.g. owner@example.com)!' });
        }
        cleanOwnerEmail = trimmed;
      }
    }

    let cleanDomain = null;
    let isCustomDomainAllowed = true;
    if (custom_domain !== undefined) {
      cleanDomain = (custom_domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');

      // 🌐 AUTHORITATIVE SAAS PLAN CUSTOM DOMAIN ENFORCEMENT
      const restoRows = await query('SELECT plan_tier, custom_domain FROM restaurants WHERE id = $1', [targetId]);
      if (!restoRows || restoRows.length === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const currentPlanTier = (restoRows[0]?.plan_tier || 'basic').toLowerCase();
      const planRows = await query('SELECT custom_domain_enabled FROM saas_plans WHERE LOWER(key) = $1', [currentPlanTier]);
      isCustomDomainAllowed = planRows && planRows.length > 0
        ? (planRows[0].custom_domain_enabled === 1 || planRows[0].custom_domain_enabled === true || planRows[0].custom_domain_enabled === '1')
        : false;

      if (cleanDomain && !isCustomDomainAllowed) {
        return res.status(403).json({
          success: false,
          error: 'feature_locked',
          feature: 'custom_domain_enabled',
          message: 'Custom domain mapping is not included in your current SaaS plan. Please upgrade your plan to connect a custom domain.'
        });
      }

      if (!isCustomDomainAllowed && !cleanDomain) {
        // Plan is OFF: ignore empty domain mutations to preserve existing configured domain
        cleanDomain = null;
      } else if (cleanDomain) {
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
        if (oldLogo && oldLogo !== processedLogo && oldLogo !== '/uploads/logo.jpg' && oldLogo !== '/images/default-logo.webp') {
          await cleanupImage(oldLogo);
        }
      } catch (cleanErr) {
        console.warn('Notice cleaning up replaced restaurant logo:', cleanErr.message);
      }
    }

    const locBool = location_initialized !== undefined 
      ? (location_initialized === true || location_initialized === 1 || location_initialized === 'true' ? true : false) 
      : (latitude && longitude && Number(latitude) !== 0 && Number(longitude) !== 0 ? true : null);

    const cleanVerifMode = table_verification_mode !== undefined ? normalizeVerificationMode(table_verification_mode) : null;
    const cleanStaffTimeout = staff_verification_timeout_seconds !== undefined
      ? Math.min(600, Math.max(30, parseInt(staff_verification_timeout_seconds, 10) || 120))
      : null;

    let cleanBusinessType = null;
    if (business_type !== undefined && business_type !== null && String(business_type).trim() !== '') {
      const norm = String(business_type).trim().toLowerCase();
      if (isValidBusinessType(norm)) {
        cleanBusinessType = norm;
      } else if (BUSINESS_TYPE_ALIASES[norm]) {
        cleanBusinessType = BUSINESS_TYPE_ALIASES[norm];
      } else {
        return res.status(400).json({ error: `Invalid business_type '${business_type}'. Allowed values: ${BUSINESS_TYPES.join(', ')}` });
      }
    }

    let cleanFoodType = null;
    if (food_type !== undefined && food_type !== null && String(food_type).trim() !== '') {
      const norm = String(food_type).trim().toLowerCase();
      if (isValidFoodType(norm)) {
        cleanFoodType = norm;
      } else if (FOOD_TYPE_ALIASES[norm]) {
        cleanFoodType = FOOD_TYPE_ALIASES[norm];
      } else {
        return res.status(400).json({ error: `Invalid food_type '${food_type}'. Allowed values: ${FOOD_TYPES.join(', ')}` });
      }
    }

    // 🛡️ AUTHORITATIVE BUSINESS TYPE -> SERVICE MODEL (CATEGORY) DERIVATION
    let effectiveBizType = cleanBusinessType;
    if (!effectiveBizType) {
      const currentRestoForBiz = await query('SELECT business_type FROM restaurants WHERE id = $1', [targetId]);
      effectiveBizType = currentRestoForBiz && currentRestoForBiz.length > 0 ? (currentRestoForBiz[0].business_type || 'restaurant') : 'restaurant';
    }

    // service_model is now the authoritative category field ('dine_in', 'hotel', 'cinema')
    const cleanServiceModel = resolveBusinessCategoryFromType(effectiveBizType);
    const cleanBusinessCategory = cleanServiceModel;

    // 🛡️ AUTHORITATIVE SAAS PLAN MAX_TABLES / SPACES ENFORCEMENT
    const isSpaceUpdate = total_tables !== undefined || total_cabins !== undefined || total_rooms !== undefined || total_vip !== undefined;
    if (isSpaceUpdate) {
      const restoRows = await query('SELECT plan_tier, total_tables, total_cabins, total_rooms, total_vip FROM restaurants WHERE id = $1', [targetId]);
      if (!restoRows || restoRows.length === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }
      const currentResto = restoRows[0];
      const planTier = (currentResto.plan_tier || 'basic').toLowerCase();

      const planRows = await query('SELECT max_tables FROM saas_plans WHERE LOWER(key) = $1', [planTier]);
      const rawMaxTables = planRows && planRows.length > 0 ? planRows[0].max_tables : 9999;
      const maxTablesAllowed = rawMaxTables !== null && rawMaxTables !== undefined ? Number(rawMaxTables) : 9999;

      const parseSpaceInput = (val, existingVal, fieldName) => {
        if (val === undefined || val === null) return Number(existingVal) || 0;
        const num = Number(val);
        if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
          throw new Error(`${fieldName} count must be a non-negative integer`);
        }
        return num;
      };

      let reqTables, reqCabins, reqRooms, reqVip;
      try {
        reqTables = parseSpaceInput(total_tables, currentResto.total_tables, 'total_tables');
        reqCabins = parseSpaceInput(total_cabins, currentResto.total_cabins, 'total_cabins');
        reqRooms = parseSpaceInput(total_rooms, currentResto.total_rooms, 'total_rooms');
        reqVip = parseSpaceInput(total_vip, currentResto.total_vip, 'total_vip');
      } catch (valErr) {
        return res.status(400).json({ error: 'invalid_space_count', message: valErr.message });
      }

      const existingTotalSpaces = (Number(currentResto.total_tables) || 0) + (Number(currentResto.total_cabins) || 0) + (Number(currentResto.total_rooms) || 0) + (Number(currentResto.total_vip) || 0);
      const requestedTotalSpaces = reqTables + reqCabins + reqRooms + reqVip;

      // Block if requested total exceeds quota AND is an increase beyond existing grandfathered count
      if (requestedTotalSpaces > maxTablesAllowed && requestedTotalSpaces > existingTotalSpaces) {
        return res.status(403).json({
          success: false,
          error: 'plan_limit_reached',
          resource: 'tables',
          limit: maxTablesAllowed,
          current_count: requestedTotalSpaces,
          message: `Your current SaaS plan allows a maximum of ${maxTablesAllowed} total customer-orderable spaces (tables, cabins, rooms, VIP lounges). Requested total: ${requestedTotalSpaces}. Please upgrade your plan to configure more spaces.`
        });
      }
    }

    // 🖨️ AUTHORITATIVE SAAS PLAN DUAL PRINTER ENFORCEMENT
    const { printer_mode, auto_print_kot, auto_print_bill, printer_paper_width } = req.body;
    if (printer_mode === 'dual') {
      const restoRows = await query('SELECT plan_tier FROM restaurants WHERE id = $1', [targetId]);
      const currentPlanTier = (restoRows[0]?.plan_tier || 'basic').toLowerCase();
      const planRows = await query('SELECT dual_printer_enabled FROM saas_plans WHERE LOWER(key) = $1', [currentPlanTier]);
      const isDualAllowed = planRows && planRows.length > 0
        ? (planRows[0].dual_printer_enabled === 1 || planRows[0].dual_printer_enabled === true || planRows[0].dual_printer_enabled === '1')
        : false;
      if (!isDualAllowed) {
        return res.status(403).json({
          error: 'feature_locked',
          feature: 'dual_printer_enabled',
          message: 'Dual separate printer routing is not included in your current SaaS plan. Please upgrade to VIP Ultra Plan to enable separate Kitchen and Billing printers.'
        });
      }
    }

    // 🏷️ AUTHORITATIVE SAAS PLAN GST INVOICING ENFORCEMENT
    if (gst_enabled === true || gst_enabled === 1 || gst_enabled === 'true' || gst_enabled === '1') {
      const restoRows = await query('SELECT plan_tier FROM restaurants WHERE id = $1', [targetId]);
      const currentPlanTier = (restoRows[0]?.plan_tier || 'basic').toLowerCase();
      const planRows = await query('SELECT gst_invoice_enabled FROM saas_plans WHERE LOWER(key) = $1', [currentPlanTier]);
      const isGstAllowed = planRows && planRows.length > 0
        ? (planRows[0].gst_invoice_enabled === 1 || planRows[0].gst_invoice_enabled === true || planRows[0].gst_invoice_enabled === '1')
        : false;
      if (!isGstAllowed) {
        return res.status(403).json({
          error: 'feature_locked',
          feature: 'gst_invoice_enabled',
          message: '5% GST Tax Invoicing is not included in your current SaaS plan. Please upgrade your plan to enable GST billing.'
        });
      }
    }

    // 🛡️ KDS PIN Configuration & Invalidation Handler
    const { kds_pin } = req.body;
    if (kds_pin !== undefined) {
      if (kds_pin === '' || kds_pin === null) {
        // Reset KDS PIN and increment token version to invalidate existing KDS tokens
        await query(`
          UPDATE restaurants 
          SET kds_pin_hash = NULL,
              kds_auth_version = COALESCE(kds_auth_version, 1) + 1 
          WHERE id = $1
        `, [targetId]);
      } else {
        const cleanPin = String(kds_pin).trim();
        if (!/^\d{4}$/.test(cleanPin)) {
          return res.status(400).json({
            error: 'invalid_kds_pin',
            message: 'Kitchen Display (KDS) PIN must be exactly 4 numeric digits (e.g. 1234)'
          });
        }
        const pinHash = await bcrypt.hash(cleanPin, 10);
        await query(`
          UPDATE restaurants 
          SET kds_pin_hash = $1,
              kds_auth_version = COALESCE(kds_auth_version, 1) + 1 
          WHERE id = $2
        `, [pinHash, targetId]);
      }
    }

    try {
      await query(`
        UPDATE restaurants 
        SET name = COALESCE($1, name), tagline = COALESCE($2, tagline), logo = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE logo END, phone = COALESCE($4, phone), address = COALESCE($5, address), opening_hours = COALESCE($6, opening_hours), google_review_url = COALESCE($7, google_review_url), filters_visibility = COALESCE($8, filters_visibility), currency_symbol = COALESCE($9, currency_symbol), fssai_lic_no = COALESCE($10, fssai_lic_no), resto_type = COALESCE($11, resto_type), whatsapp_number = COALESCE($12, whatsapp_number), whatsapp_enabled = COALESCE($13, whatsapp_enabled), theme_color = COALESCE($14, theme_color), latitude = COALESCE($15, latitude), longitude = COALESCE($16, longitude), max_distance_meters = COALESCE($17, max_distance_meters), gst_enabled = COALESCE($18, gst_enabled), gstin_number = COALESCE($19, gstin_number), total_tables = COALESCE($20, total_tables), total_cabins = COALESCE($21, total_cabins), total_rooms = COALESCE($22, total_rooms), total_vip = COALESCE($23, total_vip), table_prefix = COALESCE($24, table_prefix), order_retention_days = COALESCE($25, order_retention_days), google_reviews_enabled = COALESCE($26, google_reviews_enabled), custom_domain = CASE WHEN $27::text IS NOT NULL THEN $27 ELSE custom_domain END, location_initialized = COALESCE($28, location_initialized), owner_name = COALESCE($29, owner_name), city = COALESCE($30, city), state = COALESCE($31, state), pincode = COALESCE($32, pincode), table_verification_mode = COALESCE($33, table_verification_mode), staff_verification_timeout_seconds = COALESCE($34, staff_verification_timeout_seconds),
            printer_mode = COALESCE($35, printer_mode), auto_print_kot = COALESCE($36, auto_print_kot), auto_print_bill = COALESCE($37, auto_print_bill), printer_paper_width = COALESCE($38, printer_paper_width),
            business_type = COALESCE($39, business_type), food_type = COALESCE($40, food_type), service_model = COALESCE($41, service_model),
            owner_email = CASE WHEN $42::boolean THEN $43 ELSE owner_email END,
            business_category = COALESCE($44, business_category)
        WHERE id = $45
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
        total_cabins !== undefined && total_cabins !== null ? Number(total_cabins) : null,
        total_rooms !== undefined && total_rooms !== null ? Number(total_rooms) : null,
        total_vip !== undefined && total_vip !== null ? Number(total_vip) : null,
        table_prefix !== undefined ? table_prefix : null,
        order_retention_days !== undefined ? Number(order_retention_days) : null,
        google_reviews_enabled !== undefined ? (google_reviews_enabled !== false && google_reviews_enabled !== 0 ? 1 : 0) : null,
        cleanDomain !== null ? cleanDomain : (custom_domain !== undefined && isCustomDomainAllowed ? '' : null),
        locBool,
        owner_name !== undefined ? owner_name : null,
        city !== undefined ? city : null,
        state !== undefined ? state : null,
        pincode !== undefined ? pincode : null,
        cleanVerifMode,
        cleanStaffTimeout,
        printer_mode !== undefined ? (printer_mode === 'dual' ? 'dual' : 'single') : null,
        auto_print_kot !== undefined ? (auto_print_kot ? 1 : 0) : null,
        auto_print_bill !== undefined ? (auto_print_bill ? 1 : 0) : null,
        printer_paper_width !== undefined ? (printer_paper_width === '58mm' ? '58mm' : '80mm') : null,
        cleanBusinessType,
        cleanFoodType,
        cleanServiceModel,
        cleanOwnerEmail !== undefined,
        cleanOwnerEmail !== undefined ? cleanOwnerEmail : null,
        cleanBusinessCategory,
        targetId
      ]);
    } catch (sqlErr) {
      if (sqlErr.message && (sqlErr.message.includes('total_') || sqlErr.message.includes('table_prefix') || sqlErr.message.includes('column') || sqlErr.message.includes('verification') || sqlErr.message.includes('print') || sqlErr.message.includes('business_type') || sqlErr.message.includes('food_type') || sqlErr.message.includes('service_model') || sqlErr.message.includes('owner_email') || sqlErr.message.includes('business_category'))) {
        try {
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_cabins INT DEFAULT 0");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_rooms INT DEFAULT 0");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS total_vip INT DEFAULT 0");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS table_prefix VARCHAR(50) DEFAULT 'table'");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS table_verification_mode VARCHAR(50) DEFAULT 'GPS_WITH_STAFF_FALLBACK'");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS staff_verification_timeout_seconds INT DEFAULT 120");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_mode VARCHAR(20) DEFAULT 'single'");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS auto_print_kot INT DEFAULT 0");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS auto_print_bill INT DEFAULT 0");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS printer_paper_width VARCHAR(10) DEFAULT '80mm'");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS business_type VARCHAR(50)");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS food_type VARCHAR(50)");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_model VARCHAR(50)");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255) DEFAULT NULL");
          await query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS business_category VARCHAR(50) DEFAULT 'dine_in'");
          await query(`
            UPDATE restaurants 
            SET name = COALESCE($1, name), tagline = COALESCE($2, tagline), logo = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE logo END, phone = COALESCE($4, phone), address = COALESCE($5, address), opening_hours = COALESCE($6, opening_hours), google_review_url = COALESCE($7, google_review_url), filters_visibility = COALESCE($8, filters_visibility), currency_symbol = COALESCE($9, currency_symbol), fssai_lic_no = COALESCE($10, fssai_lic_no), resto_type = COALESCE($11, resto_type), whatsapp_number = COALESCE($12, whatsapp_number), whatsapp_enabled = COALESCE($13, whatsapp_enabled), theme_color = COALESCE($14, theme_color), latitude = COALESCE($15, latitude), longitude = COALESCE($16, longitude), max_distance_meters = COALESCE($17, max_distance_meters), gst_enabled = COALESCE($18, gst_enabled), gstin_number = COALESCE($19, gstin_number), total_tables = COALESCE($20, total_tables), total_cabins = COALESCE($21, total_cabins), total_rooms = COALESCE($22, total_rooms), total_vip = COALESCE($23, total_vip), table_prefix = COALESCE($24, table_prefix), order_retention_days = COALESCE($25, order_retention_days), google_reviews_enabled = COALESCE($26, google_reviews_enabled), custom_domain = CASE WHEN $27::text IS NOT NULL THEN $27 ELSE custom_domain END, location_initialized = COALESCE($28, location_initialized), owner_name = COALESCE($29, owner_name), city = COALESCE($30, city), state = COALESCE($31, state), pincode = COALESCE($32, pincode), table_verification_mode = COALESCE($33, table_verification_mode), staff_verification_timeout_seconds = COALESCE($34, staff_verification_timeout_seconds),
                printer_mode = COALESCE($35, printer_mode), auto_print_kot = COALESCE($36, auto_print_kot), auto_print_bill = COALESCE($37, auto_print_bill), printer_paper_width = COALESCE($38, printer_paper_width),
                business_type = COALESCE($39, business_type), food_type = COALESCE($40, food_type), service_model = COALESCE($41, service_model),
                owner_email = CASE WHEN $42::boolean THEN $43 ELSE owner_email END,
                business_category = COALESCE($44, business_category)
            WHERE id = $45
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
            total_cabins !== undefined && total_cabins !== null ? Number(total_cabins) : null,
            total_rooms !== undefined && total_rooms !== null ? Number(total_rooms) : null,
            total_vip !== undefined && total_vip !== null ? Number(total_vip) : null,
            table_prefix !== undefined ? table_prefix : null,
            order_retention_days !== undefined ? Number(order_retention_days) : null,
            google_reviews_enabled !== undefined ? (google_reviews_enabled !== false && google_reviews_enabled !== 0 ? 1 : 0) : null,
            cleanDomain !== null ? cleanDomain : (custom_domain !== undefined && isCustomDomainAllowed ? '' : null),
            locBool,
            owner_name !== undefined ? owner_name : null,
            city !== undefined ? city : null,
            state !== undefined ? state : null,
            pincode !== undefined ? pincode : null,
            cleanVerifMode,
            cleanStaffTimeout,
            printer_mode !== undefined ? (printer_mode === 'dual' ? 'dual' : 'single') : null,
            auto_print_kot !== undefined ? (auto_print_kot ? 1 : 0) : null,
            auto_print_bill !== undefined ? (auto_print_bill ? 1 : 0) : null,
            printer_paper_width !== undefined ? (printer_paper_width === '58mm' ? '58mm' : '80mm') : null,
            cleanBusinessType,
            cleanFoodType,
            cleanServiceModel,
            cleanOwnerEmail !== undefined,
            cleanOwnerEmail !== undefined ? cleanOwnerEmail : null,
            cleanBusinessCategory,
            targetId
          ]);
        } catch (innerErr) {
          console.error('Failed auto-adding presence/printer columns:', innerErr);
        }
      } else {
        throw sqlErr;
      }
    }

    clearRestoResolveCache();
    try {
      const slugRows = await query('SELECT slug FROM restaurants WHERE id = $1', [targetId]);
      if (slugRows && slugRows.length > 0 && slugRows[0].slug) {
        clearMenuBundleCache(slugRows[0].slug);
      }
    } catch (cErr) {}

    res.json({ success: true, message: 'Restaurant settings updated successfully!' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

router.put('/settings', authenticateToken, requireActiveSubscription, handleUpdateSettings);
router.post('/settings', authenticateToken, requireActiveSubscription, handleUpdateSettings);
router.post('/info', authenticateToken, requireActiveSubscription, handleUpdateSettings);

// ======================================================================
// 🎬 STEP 3.32: CINEMA & THEATRE SEAT QR SUPPORT API ENDPOINTS
// ======================================================================

// GET /api/admin/cinema/screens - List all screens for tenant
router.get('/cinema/screens', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) return res.status(401).json({ error: 'Restaurant identity is missing' });

    const screens = await query(`
      SELECT s.id, s.restaurant_id, s.screen_number, s.name, s.active, s.created_at,
             COALESCE(COUNT(st.id), 0) as seat_count
      FROM restaurant_cinema_screens s
      LEFT JOIN restaurant_cinema_seats st ON st.screen_id = s.id AND st.restaurant_id = s.restaurant_id
      WHERE s.restaurant_id = $1
      GROUP BY s.id, s.restaurant_id, s.screen_number, s.name, s.active, s.created_at
      ORDER BY s.screen_number ASC
    `, [targetId]);

    res.json({ success: true, screens: screens || [] });
  } catch (err) {
    console.error('Fetch cinema screens error:', err);
    res.status(500).json({ error: 'Failed to fetch cinema screens' });
  }
});

// POST /api/admin/cinema/screens - Create a new screen
router.post('/cinema/screens', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) return res.status(401).json({ error: 'Restaurant identity is missing' });

    const { screen_number, name } = req.body;
    const num = parseInt(screen_number, 10);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ error: 'invalid_screen_number', message: 'Screen number must be a positive integer' });
    }
    const cleanName = String(name || `Screen ${num}`).trim().substring(0, 100);

    const existing = await query(
      'SELECT id FROM restaurant_cinema_screens WHERE restaurant_id = $1 AND screen_number = $2',
      [targetId, num]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'duplicate_screen', message: `Screen ${num} already exists for this cinema.` });
    }

    const result = await query(`
      INSERT INTO restaurant_cinema_screens (restaurant_id, screen_number, name, active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [targetId, num, cleanName]);

    res.json({ success: true, screen: result[0] });
  } catch (err) {
    console.error('Create cinema screen error:', err);
    res.status(500).json({ error: 'Failed to create cinema screen' });
  }
});

// PUT /api/admin/cinema/screens/:id - Update screen
router.put('/cinema/screens/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const screenId = parseInt(req.params.id, 10);
    const { name, active } = req.body;

    const result = await query(`
      UPDATE restaurant_cinema_screens
      SET name = COALESCE($1, name),
          active = CASE WHEN $2::boolean IS NOT NULL THEN $2 ELSE active END,
          updated_at = NOW()
      WHERE id = $3 AND restaurant_id = $4
      RETURNING *
    `, [name ? String(name).trim() : null, typeof active === 'boolean' ? active : null, screenId, targetId]);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    res.json({ success: true, screen: result[0] });
  } catch (err) {
    console.error('Update cinema screen error:', err);
    res.status(500).json({ error: 'Failed to update cinema screen' });
  }
});

// DELETE /api/admin/cinema/screens/:id - Delete screen and cascading seats
router.delete('/cinema/screens/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const screenId = parseInt(req.params.id, 10);

    const result = await query(
      'DELETE FROM restaurant_cinema_screens WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [screenId, targetId]
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Screen not found' });
    }

    res.json({ success: true, message: 'Screen and seats deleted successfully' });
  } catch (err) {
    console.error('Delete cinema screen error:', err);
    res.status(500).json({ error: 'Failed to delete cinema screen' });
  }
});

// GET /api/admin/cinema/seats - List seats for a screen
router.get('/cinema/seats', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const screenId = req.query.screen_id ? parseInt(req.query.screen_id, 10) : null;
    if (!targetId) return res.status(401).json({ error: 'Restaurant identity is missing' });

    let sql = `
      SELECT st.id, st.restaurant_id, st.screen_id, st.row_label, st.seat_number, st.seat_code, st.active,
             sc.screen_number, sc.name as screen_name
      FROM restaurant_cinema_seats st
      JOIN restaurant_cinema_screens sc ON st.screen_id = sc.id
      WHERE st.restaurant_id = $1
    `;
    const params = [targetId];

    if (screenId) {
      sql += ' AND st.screen_id = $2';
      params.push(screenId);
    }
    sql += ' ORDER BY sc.screen_number ASC, st.row_label ASC, st.seat_number ASC';

    const seats = await query(sql, params);
    res.json({ success: true, seats: seats || [] });
  } catch (err) {
    console.error('Fetch cinema seats error:', err);
    res.status(500).json({ error: 'Failed to fetch cinema seats' });
  }
});

// POST /api/admin/cinema/seats/batch - Batch add seats for a screen
router.post('/cinema/seats/batch', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const { screen_id, row_label, seat_start = 1, seat_end = 10 } = req.body;
    const sid = parseInt(screen_id, 10);
    const row = String(row_label || '').trim().toUpperCase();
    const start = parseInt(seat_start, 10);
    const end = parseInt(seat_end, 10);

    if (!sid || !row || isNaN(start) || isNaN(end) || start > end || start < 1 || end > 100) {
      return res.status(400).json({ error: 'invalid_input', message: 'Valid screen, row label (e.g. A), and seat range (1 to 100) required.' });
    }

    const screenCheck = await query(
      'SELECT id, screen_number FROM restaurant_cinema_screens WHERE id = $1 AND restaurant_id = $2',
      [sid, targetId]
    );
    if (!screenCheck || screenCheck.length === 0) {
      return res.status(404).json({ error: 'Screen not found' });
    }
    const screenNum = screenCheck[0].screen_number;

    let addedCount = 0;
    for (let s = start; s <= end; s++) {
      const seatCode = `S${screenNum}-${row}-${s}`;
      const ins = await query(`
        INSERT INTO restaurant_cinema_seats (restaurant_id, screen_id, row_label, seat_number, seat_code, active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (restaurant_id, screen_id, row_label, seat_number) DO UPDATE SET active = true
        RETURNING id
      `, [targetId, sid, row, s, seatCode]);
      if (ins && ins.length > 0) addedCount++;
    }

    res.json({ success: true, message: `Successfully configured ${addedCount} seats in Row ${row}.` });
  } catch (err) {
    console.error('Batch add cinema seats error:', err);
    res.status(500).json({ error: 'Failed to configure cinema seats' });
  }
});

// DELETE /api/admin/cinema/seats/:id - Delete individual seat
router.delete('/cinema/seats/:id', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const seatId = parseInt(req.params.id, 10);

    const result = await query(
      'DELETE FROM restaurant_cinema_seats WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [seatId, targetId]
    );

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    res.json({ success: true, message: 'Seat deleted successfully' });
  } catch (err) {
    console.error('Delete cinema seat error:', err);
    res.status(500).json({ error: 'Failed to delete cinema seat' });
  }
});

// ======================================================================
// 🖨️ STEP 3.21: THERMAL PRINTER SYSTEM & ROUTING API ENDPOINTS
// ======================================================================

// GET /api/admin/printers - Retrieve printer configuration and plan permissions
router.get('/printers', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const [restoRows, printerRows] = await Promise.all([
      query('SELECT id, name, plan_tier, printer_mode, auto_print_kot, auto_print_bill, printer_paper_width FROM restaurants WHERE id = $1', [targetId]),
      query('SELECT id, role, name, connection_type, target_address, paper_width, auto_print_kot, auto_print_bill, active FROM restaurant_printers WHERE restaurant_id = $1 ORDER BY id ASC', [targetId])
    ]);

    if (!restoRows || restoRows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const resto = restoRows[0];
    const planTier = (resto.plan_tier || 'basic').toLowerCase();
    const planRows = await query('SELECT dual_printer_enabled FROM saas_plans WHERE LOWER(key) = $1', [planTier]);
    const isDualAllowed = planRows && planRows.length > 0
      ? (planRows[0].dual_printer_enabled === 1 || planRows[0].dual_printer_enabled === true || planRows[0].dual_printer_enabled === '1')
      : false;

    let printers = printerRows || [];
    if (printers.length === 0) {
      printers = [
        {
          id: null,
          role: 'single',
          name: `${resto.name || 'Main'} Receipt Printer`,
          connection_type: 'browser_dialog',
          target_address: '',
          paper_width: resto.printer_paper_width || '80mm',
          auto_print_kot: Number(resto.auto_print_kot) || 0,
          auto_print_bill: Number(resto.auto_print_bill) || 0,
          active: 1
        }
      ];
    }

    res.json({
      success: true,
      restaurant_id: targetId,
      plan_tier: planTier,
      dual_printer_allowed: Boolean(isDualAllowed),
      printer_mode: isDualAllowed ? (resto.printer_mode || 'single') : 'single',
      auto_print_kot: Number(resto.auto_print_kot) || 0,
      auto_print_bill: Number(resto.auto_print_bill) || 0,
      printer_paper_width: resto.printer_paper_width || '80mm',
      printers
    });
  } catch (err) {
    console.error('Fetch printers error:', err);
    res.status(500).json({ error: 'Failed to fetch printer settings' });
  }
});

// POST /api/admin/printers - Save or update printer configuration
const handleSavePrinters = async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const { printer_mode, auto_print_kot, auto_print_bill, printer_paper_width, printers } = req.body;

    const restoRows = await query('SELECT id, plan_tier FROM restaurants WHERE id = $1', [targetId]);
    if (!restoRows || restoRows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const planTier = (restoRows[0].plan_tier || 'basic').toLowerCase();
    const planRows = await query('SELECT dual_printer_enabled FROM saas_plans WHERE LOWER(key) = $1', [planTier]);
    const isDualAllowed = planRows && planRows.length > 0
      ? (planRows[0].dual_printer_enabled === 1 || planRows[0].dual_printer_enabled === true || planRows[0].dual_printer_enabled === '1')
      : false;

    // Strict SaaS plan enforcement: Block dual mode if not allowed
    if (printer_mode === 'dual' && !isDualAllowed) {
      return res.status(403).json({
        error: 'feature_locked',
        feature: 'dual_printer_enabled',
        message: 'Dual separate printer routing is not included in your current SaaS plan. Please upgrade to VIP Ultra Plan to enable separate Kitchen and Billing printers.'
      });
    }

    const effectiveMode = (printer_mode === 'dual' && isDualAllowed) ? 'dual' : 'single';
    const cleanAutoKot = auto_print_kot !== undefined ? (auto_print_kot ? 1 : 0) : 0;
    const cleanAutoBill = auto_print_bill !== undefined ? (auto_print_bill ? 1 : 0) : 0;
    const cleanPaperWidth = printer_paper_width === '58mm' ? '58mm' : '80mm';

    await query(`
      UPDATE restaurants 
      SET printer_mode = $1, auto_print_kot = $2, auto_print_bill = $3, printer_paper_width = $4
      WHERE id = $5
    `, [effectiveMode, cleanAutoKot, cleanAutoBill, cleanPaperWidth, targetId]);

    // Upsert individual printer roles if provided
    if (Array.isArray(printers)) {
      for (const p of printers) {
        if (!p.role) continue;
        const pRole = String(p.role).toLowerCase();
        const pName = p.name ? String(p.name).trim() : (pRole === 'kitchen' ? 'Kitchen KOT Printer' : pRole === 'billing' ? 'Counter Billing Printer' : 'Main Receipt Printer');
        const pConn = p.connection_type || 'browser_dialog';
        const pTarget = p.target_address || '';
        const pWidth = p.paper_width === '58mm' ? '58mm' : '80mm';
        const pAutoKot = p.auto_print_kot !== undefined ? (p.auto_print_kot ? 1 : 0) : 0;
        const pAutoBill = p.auto_print_bill !== undefined ? (p.auto_print_bill ? 1 : 0) : 0;
        const pActive = p.active !== undefined ? (p.active ? 1 : 0) : 1;

        try {
          await query(`
            INSERT INTO restaurant_printers (restaurant_id, role, name, connection_type, target_address, paper_width, auto_print_kot, auto_print_bill, active, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            ON CONFLICT (restaurant_id, role) DO UPDATE SET
              name = EXCLUDED.name,
              connection_type = EXCLUDED.connection_type,
              target_address = EXCLUDED.target_address,
              paper_width = EXCLUDED.paper_width,
              auto_print_kot = EXCLUDED.auto_print_kot,
              auto_print_bill = EXCLUDED.auto_print_bill,
              active = EXCLUDED.active,
              updated_at = CURRENT_TIMESTAMP
          `, [targetId, pRole, pName, pConn, pTarget, pWidth, pAutoKot, pAutoBill, pActive]);
        } catch (upsertErr) {
          // SQLite fallback if ON CONFLICT syntax differs
          await query('DELETE FROM restaurant_printers WHERE restaurant_id = $1 AND role = $2', [targetId, pRole]).catch(() => {});
          await query(`
            INSERT INTO restaurant_printers (restaurant_id, role, name, connection_type, target_address, paper_width, auto_print_kot, auto_print_bill, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [targetId, pRole, pName, pConn, pTarget, pWidth, pAutoKot, pAutoBill, pActive]);
        }
      }
    }

    clearRestoResolveCache();

    res.json({
      success: true,
      message: 'Printer configuration saved successfully!',
      printer_mode: effectiveMode
    });
  } catch (err) {
    console.error('Save printers error:', err);
    res.status(500).json({ error: 'Failed to save printer settings' });
  }
};

router.post('/printers', authenticateToken, requireActiveSubscription, handleSavePrinters);
router.put('/printers', authenticateToken, requireActiveSubscription, handleSavePrinters);

// POST /api/admin/print/log - Record a print job attempt and resolve reprint status
router.post('/print/log', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const { order_id, session_id, round_number, print_type, printer_role, status, error_message } = req.body;
    if (!order_id || !print_type) {
      return res.status(400).json({ error: 'order_id and print_type are required' });
    }

    const cleanType = String(print_type).toLowerCase(); // 'kot', 'bill', 'test'
    const cleanRole = printer_role ? String(printer_role).toLowerCase() : 'single';
    const cleanStatus = status ? String(status).toLowerCase() : 'printed';
    const cleanRound = Number(round_number) || 1;

    // Check if this order + type was previously printed successfully
    const prevPrints = await query(`
      SELECT COUNT(*) as count 
      FROM print_jobs 
      WHERE restaurant_id = $1 AND order_id = $2 AND print_type = $3 AND status = 'printed'
    `, [targetId, order_id, cleanType]);

    const printCount = parseInt(prevPrints[0]?.count || 0, 10);
    const isReprint = printCount > 0 ? 1 : 0;

    const insertRes = await query(`
      INSERT INTO print_jobs (restaurant_id, printer_role, order_id, session_id, round_number, print_type, is_reprint, status, error_message, printed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $8 = 'printed' THEN CURRENT_TIMESTAMP ELSE NULL END)
      RETURNING id, is_reprint
    `, [targetId, cleanRole, order_id, session_id || null, cleanRound, cleanType, isReprint, cleanStatus, error_message || null]);

    res.json({
      success: true,
      job_id: insertRes[0]?.id || null,
      is_reprint: isReprint,
      print_count: printCount + (cleanStatus === 'printed' ? 1 : 0)
    });
  } catch (err) {
    console.error('Print job log error:', err);
    // Print failure must never crash or block order flows
    res.json({ success: false, error: err.message, is_reprint: 0 });
  }
});

// GET /api/admin/print/status/:orderId - Check print status of an order
router.get('/print/status/:orderId', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const { orderId } = req.params;

    const jobs = await query(`
      SELECT print_type, is_reprint, status, COUNT(*) as count
      FROM print_jobs
      WHERE restaurant_id = $1 AND order_id = $2 AND status = 'printed'
      GROUP BY print_type, is_reprint, status
    `, [targetId, orderId]);

    let kotPrintedCount = 0;
    let billPrintedCount = 0;

    (jobs || []).forEach(j => {
      if (j.print_type === 'kot') kotPrintedCount += parseInt(j.count, 10);
      if (j.print_type === 'bill') billPrintedCount += parseInt(j.count, 10);
    });

    res.json({
      success: true,
      order_id: Number(orderId),
      kot_printed: kotPrintedCount > 0,
      kot_print_count: kotPrintedCount,
      bill_printed: billPrintedCount > 0,
      bill_print_count: billPrintedCount
    });
  } catch (err) {
    console.error('Fetch print status error:', err);
    res.status(500).json({ error: 'Failed to fetch print status' });
  }
});

// POST /api/admin/printers/test - Test printer route
router.post('/printers/test', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    const { role, paper_width } = req.body;
    const cleanRole = (role || 'single').toLowerCase();
    const cleanWidth = paper_width === '58mm' ? '58mm' : '80mm';

    const restoRows = await query('SELECT name, address, phone, gstin_number, fssai_lic_no, currency_symbol FROM restaurants WHERE id = $1', [targetId]);
    const resto = restoRows[0] || {};

    const testPayload = {
      test: true,
      role: cleanRole,
      paper_width: cleanWidth,
      restaurant_name: resto.name || 'Sample Restaurant',
      ticket_type: cleanRole === 'kitchen' ? 'KOT' : 'BILL',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      message: `Test print generated for ${cleanRole.toUpperCase()} printer (${cleanWidth})`,
      payload: testPayload
    });
  } catch (err) {
    console.error('Test print error:', err);
    res.status(500).json({ error: 'Failed to generate test print' });
  }
});

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

    const { scope } = req.query;
    let sql = "SELECT * FROM orders WHERE restaurant_id = $1 AND status NOT IN ('cancelled', 'rejected')";
    const params = [targetId];

    if (scope !== 'all') {
      // Default live operations: all active orders + completed orders from today (since 12:00 AM Midnight)
      const now = new Date();
      const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
      const midnightISO = new Date(`${istDateStr}T00:00:00+05:30`).toISOString();
      sql += " AND (status != 'completed' OR created_at >= $2)";
      params.push(midnightISO);
    }

    sql += " ORDER BY id DESC LIMIT 500";

    const orders = await query(sql, params);

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

    // Fetch order to check session_id
    const existing = await query('SELECT id, session_id, parent_order_id, table_number FROM orders WHERE id = $1 AND restaurant_id = $2', [orderId, targetId]);
    const targetOrder = existing[0] || null;

    if (status === 'rejected' || status === 'cancelled') {
      // Instantly HARD DELETE rejected/cancelled order so ZERO record remains in DB or UI
      await query('DELETE FROM orders WHERE id = $1 AND restaurant_id = $2', [orderId, targetId]);
      return res.json({ success: true, id: orderId, status: 'cancelled', deleted: true });
    }

    let updateRes = null;
    if (status === 'completed') {
      if (targetOrder?.session_id) {
        // Settle entire Table Session in one single transaction
        updateRes = await query(
          'UPDATE orders SET status = $1, is_settled = 1 WHERE restaurant_id = $2 AND session_id = $3 RETURNING id',
          ['completed', targetId, targetOrder.session_id]
        );
      } else {
        updateRes = await query(
          'UPDATE orders SET status = $1, is_settled = 1 WHERE id = $2 AND restaurant_id = $3 RETURNING id',
          ['completed', orderId, targetId]
        );
      }
    } else {
      updateRes = await query(
        'UPDATE orders SET status = $1, sent_to_kds = $2, kitchen_prepared = $3 WHERE id = $4 AND restaurant_id = $5 RETURNING id',
        [status, kdsVal, prepVal, orderId, targetId]
      );
    }

    if (!updateRes || updateRes.length === 0) {
      return res.status(404).json({ error: 'Order not found or does not belong to this restaurant' });
    }

    res.json({ success: true, id: orderId, status, sent_to_kds: kdsVal, kitchen_prepared: prepVal, is_settled: status === 'completed' ? 1 : 0 });
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

    // Enrich presence verification requests with expiration, space type, and sanitized note
    const enriched = await Promise.all((requests || []).map(async (r) => {
      if (r.request_type === 'presence_verification') {
        let tokenMatch = r.note ? r.note.match(/tq_staff_[a-z0-9_]+/i) : null;
        let vToken = tokenMatch ? tokenMatch[0] : null;
        let verifRows = [];
        try {
          if (vToken) {
            verifRows = await query(
              'SELECT expires_at, space_type, space_number, status as verif_status FROM table_location_verifications WHERE verification_token = $1 AND restaurant_id = $2',
              [vToken, targetId]
            );
          } else {
            verifRows = await query(
              "SELECT expires_at, space_type, space_number, status as verif_status FROM table_location_verifications WHERE restaurant_id = $1 AND table_number = $2 AND verification_method = 'STAFF' AND status = 'pending' ORDER BY id DESC LIMIT 1",
              [targetId, r.table_number]
            );
          }
        } catch (e) {}

        const vRecord = verifRows && verifRows.length > 0 ? verifRows[0] : null;
        const isExpired = vRecord ? (new Date(vRecord.expires_at).getTime() <= Date.now()) : false;

        return {
          ...r,
          note: 'Customer is requesting table presence verification to place order.',
          expires_at: vRecord ? vRecord.expires_at : null,
          space_type: vRecord ? (vRecord.space_type || 'table') : 'table',
          space_number: vRecord ? (vRecord.space_number || r.table_number) : r.table_number,
          is_expired: isExpired
        };
      }
      return r;
    }));

    res.json(enriched);
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

// PATCH Approve Table Presence Verification Request (TENANT-ISOLATED)
router.patch('/service-requests/:id/approve-presence', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { id } = req.params;

    // 1. Fetch Service Request scoped to tenant
    const srRows = await query(
      "SELECT * FROM service_requests WHERE id = $1 AND restaurant_id = $2 AND request_type = 'presence_verification'",
      [id, targetId]
    );
    if (!srRows || srRows.length === 0) {
      return res.status(404).json({ error: 'service_request_not_found', message: 'Presence verification service request not found' });
    }
    const sr = srRows[0];

    // 2. Extract verification token from note (or fallback to space/table search)
    let tokenMatch = sr.note ? sr.note.match(/tq_staff_[a-z0-9_]+/i) : null;
    let vToken = tokenMatch ? tokenMatch[0] : null;

    let verifQuery = vToken
      ? 'SELECT * FROM table_location_verifications WHERE verification_token = $1 AND restaurant_id = $2'
      : 'SELECT * FROM table_location_verifications WHERE restaurant_id = $1 AND table_number = $2 AND verification_method = \'STAFF\' AND status = \'pending\' ORDER BY id DESC LIMIT 1';
    let verifParams = vToken ? [vToken, targetId] : [targetId, sr.table_number];

    const verifRows = await query(verifQuery, verifParams);
    if (!verifRows || verifRows.length === 0) {
      return res.status(404).json({ error: 'verification_record_not_found', message: 'Linked presence verification record not found' });
    }
    const verifRecord = verifRows[0];

    // 3. Check expiration
    if (new Date(verifRecord.expires_at).getTime() <= Date.now()) {
      await query("UPDATE table_location_verifications SET status = 'expired' WHERE id = $1", [verifRecord.id]);
      await query("UPDATE service_requests SET status = 'resolved' WHERE id = $1 AND restaurant_id = $2", [id, targetId]);
      return res.status(400).json({ error: 'request_expired', message: 'This presence verification request has already expired.' });
    }

    // 4. Atomically approve
    const nowIso = new Date().toISOString();
    await query(
      `UPDATE table_location_verifications 
       SET status = 'verified', verification_method = 'STAFF', approved_by_admin_id = $1, verified_at = $2
       WHERE id = $3 AND restaurant_id = $4`,
      [req.user.id || null, nowIso, verifRecord.id, targetId]
    );

    // 5. Resolve service request
    await query("UPDATE service_requests SET status = 'resolved' WHERE id = $1 AND restaurant_id = $2", [id, targetId]);

    return res.json({
      success: true,
      id,
      status: 'verified',
      table_number: verifRecord.table_number,
      space_type: verifRecord.space_type || 'table',
      message: `✓ Table ${verifRecord.table_number} presence approved successfully.`
    });
  } catch (err) {
    console.error('Approve presence verification error:', err);
    res.status(500).json({ error: 'Failed to approve presence verification' });
  }
});

// PATCH Reject Table Presence Verification Request (TENANT-ISOLATED)
router.patch('/service-requests/:id/reject-presence', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }
    const { id } = req.params;
    const { rejection_reason } = req.body || {};

    const srRows = await query(
      "SELECT * FROM service_requests WHERE id = $1 AND restaurant_id = $2 AND request_type = 'presence_verification'",
      [id, targetId]
    );
    if (!srRows || srRows.length === 0) {
      return res.status(404).json({ error: 'service_request_not_found', message: 'Presence verification service request not found' });
    }
    const sr = srRows[0];

    let tokenMatch = sr.note ? sr.note.match(/tq_staff_[a-z0-9_]+/i) : null;
    let vToken = tokenMatch ? tokenMatch[0] : null;

    let verifQuery = vToken
      ? 'SELECT * FROM table_location_verifications WHERE verification_token = $1 AND restaurant_id = $2'
      : 'SELECT * FROM table_location_verifications WHERE restaurant_id = $1 AND table_number = $2 AND verification_method = \'STAFF\' AND status = \'pending\' ORDER BY id DESC LIMIT 1';
    let verifParams = vToken ? [vToken, targetId] : [targetId, sr.table_number];

    const verifRows = await query(verifQuery, verifParams);
    if (verifRows && verifRows.length > 0) {
      const verifRecord = verifRows[0];
      await query(
        `UPDATE table_location_verifications 
         SET status = 'rejected', rejection_reason = $1, approved_by_admin_id = $2
         WHERE id = $3 AND restaurant_id = $4`,
        [rejection_reason || 'Rejected by staff', req.user.id || null, verifRecord.id, targetId]
      );
    }

    await query("UPDATE service_requests SET status = 'resolved' WHERE id = $1 AND restaurant_id = $2", [id, targetId]);

    return res.json({
      success: true,
      id,
      status: 'rejected',
      message: `Presence verification rejected for Table ${sr.table_number}.`
    });
  } catch (err) {
    console.error('Reject presence verification error:', err);
    res.status(500).json({ error: 'Failed to reject presence verification' });
  }
});

// PATCH Direct Token Approve (TENANT-ISOLATED)
router.patch('/presence-verifications/:token/approve', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) return res.status(401).json({ error: 'Unauthorized' });
    const { token } = req.params;

    const rows = await query('SELECT * FROM table_location_verifications WHERE verification_token = $1 AND restaurant_id = $2', [token, targetId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'verification_not_found' });
    const record = rows[0];

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await query("UPDATE table_location_verifications SET status = 'expired' WHERE id = $1", [record.id]);
      return res.status(400).json({ error: 'request_expired', message: 'Verification request has expired.' });
    }

    const nowIso = new Date().toISOString();
    await query(
      "UPDATE table_location_verifications SET status = 'verified', verification_method = 'STAFF', approved_by_admin_id = $1, verified_at = $2 WHERE id = $3 AND restaurant_id = $4",
      [req.user.id || null, nowIso, record.id, targetId]
    );
    await query("UPDATE service_requests SET status = 'resolved' WHERE note LIKE $1 AND restaurant_id = $2", [`%${token}%`, targetId]);

    res.json({ success: true, status: 'verified', message: 'Approved successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve verification' });
  }
});

// PATCH Direct Token Reject (TENANT-ISOLATED)
router.patch('/presence-verifications/:token/reject', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) return res.status(401).json({ error: 'Unauthorized' });
    const { token } = req.params;
    const { rejection_reason, reason } = req.body || {};
    const finalReason = String(rejection_reason || reason || 'Rejected by staff').trim();

    const rows = await query('SELECT * FROM table_location_verifications WHERE verification_token = $1 AND restaurant_id = $2', [token, targetId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'verification_not_found' });
    const record = rows[0];

    await query(
      "UPDATE table_location_verifications SET status = 'rejected', rejection_reason = $1, approved_by_admin_id = $2 WHERE id = $3 AND restaurant_id = $4",
      [finalReason, req.user.id || null, record.id, targetId]
    );
    await query("UPDATE service_requests SET status = 'resolved' WHERE note LIKE $1 AND restaurant_id = $2", [`%${token}%`, targetId]);

    res.json({ success: true, status: 'rejected', message: 'Rejected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject verification' });
  }
});

// GET Sales & Product Analytics (OPERATIONAL ROUTE)
router.get('/analytics', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing from authentication context' });
    }

    const { period: qPeriod, year: qYear, month: qMonth } = req.query;
    const selectedPeriod = qPeriod || (qYear && qMonth ? `month:${qYear}-${String(qMonth).padStart(2, '0')}` : 'all');
    const selectedYear = qYear ? parseInt(qYear, 10) : null;
    const selectedMonth = qMonth ? parseInt(qMonth, 10) : null;

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
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      } catch (e) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    };

    const now = new Date();
    const todayStr = getFormattedLocalDate(now);

    // Calculate IST Date boundaries
    const getISTDateOffset = (daysBack) => {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      return getFormattedLocalDate(d);
    };

    const sevenDaysAgoStr = getISTDateOffset(6); // Today + 6 previous days = 7 days
    const thirtyDaysAgoStr = getISTDateOffset(29); // Today + 29 previous days = 30 days
    const sixtyDaysAgoStr = getISTDateOffset(59);
    const sixMonthsAgoStr = getISTDateOffset(180);

    // Initialize daily chart keys based on selected filter
    const dailySalesMap = {};
    let periodStartDate = null;
    let periodEndDate = null;

    if (selectedYear && selectedMonth) {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      periodStartDate = `${monthPrefix}-01`;
      periodEndDate = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
        dailySalesMap[dayStr] = 0;
      }
    } else if (selectedPeriod === 'today') {
      periodStartDate = todayStr;
      periodEndDate = todayStr;
      dailySalesMap[todayStr] = 0;
    } else if (selectedPeriod === '7d') {
      periodStartDate = sevenDaysAgoStr;
      periodEndDate = todayStr;
      for (let i = 6; i >= 0; i--) {
        dailySalesMap[getISTDateOffset(i)] = 0;
      }
    } else if (selectedPeriod === '30d') {
      periodStartDate = thirtyDaysAgoStr;
      periodEndDate = todayStr;
      for (let i = 29; i >= 0; i--) {
        dailySalesMap[getISTDateOffset(i)] = 0;
      }
    } else if (selectedPeriod === '6m') {
      periodStartDate = sixMonthsAgoStr;
      periodEndDate = todayStr;
      for (let i = 180; i >= 0; i -= 5) {
        dailySalesMap[getISTDateOffset(i)] = 0;
      }
      dailySalesMap[todayStr] = 0;
    } else {
      // 'all' -> default last 7 days in chart trend
      for (let i = 6; i >= 0; i--) {
        dailySalesMap[getISTDateOffset(i)] = 0;
      }
    }

    // Query active non-cancelled orders for tenant
    const orders = await query(
      "SELECT id, total_amount, status, payment_method, items, created_at FROM orders WHERE restaurant_id = $1 AND status NOT IN ('rejected', 'cancelled') ORDER BY id DESC",
      [targetId]
    );

    // Query historical summaries for tenant
    const summaries = await query(
      'SELECT summary_date, total_sales, total_orders, top_dishes_summary, items_summary, payment_methods_summary FROM daily_sales_summaries WHERE restaurant_id = $1 ORDER BY summary_date ASC',
      [targetId]
    );

    let todaySales = 0;
    let todayOrders = 0;
    let weeklySales = 0;
    let monthlySales = 0;
    let prevMonthSales = 0;
    let totalSales = 0;
    let totalOrdersCount = 0;

    let periodSales = 0;
    let periodOrdersCount = 0;

    const allTimeDishSalesMap = {};
    const periodDishSalesMap = {};
    const availableMonthsMap = {};

    const allTimePaymentMethods = { upi: { count: 0, amount: 0 }, cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 }, other: { count: 0, amount: 0 } };
    const periodPaymentMethods = { upi: { count: 0, amount: 0 }, cash: { count: 0, amount: 0 }, card: { count: 0, amount: 0 }, other: { count: 0, amount: 0 } };

    const isDateInPeriod = (dStr) => {
      if (!dStr) return false;
      if (selectedPeriod === 'all') return true;
      if (periodStartDate && periodEndDate) {
        return dStr >= periodStartDate && dStr <= periodEndDate;
      }
      return true;
    };

    // 1. Process Live Orders
    orders.forEach(o => {
      const amt = Number(o.total_amount) || 0;
      totalSales += amt;
      totalOrdersCount += 1;

      const createdAtDate = parseSafeDate(o.created_at) || new Date();
      const dateStr = getFormattedLocalDate(createdAtDate);

      // Available months discovery
      if (dateStr && dateStr.length >= 7) {
        const mKey = dateStr.substring(0, 7);
        const mYear = parseInt(dateStr.substring(0, 4), 10);
        const mMonth = parseInt(dateStr.substring(5, 7), 10);
        if (mYear >= 2020 && !availableMonthsMap[mKey]) {
          const monthLabel = createdAtDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          availableMonthsMap[mKey] = { key: mKey, label: monthLabel, year: mYear, month: mMonth };
        }
      }

      // Payment method breakdown
      const pMethod = String(o.payment_method || 'cash').toLowerCase();
      let pCategory = 'cash';
      if (pMethod.includes('upi') || pMethod.includes('online') || pMethod.includes('paytm') || pMethod.includes('gpay') || pMethod.includes('phonepe')) {
        pCategory = 'upi';
      } else if (pMethod.includes('card')) {
        pCategory = 'card';
      } else if (pMethod.includes('cash')) {
        pCategory = 'cash';
      } else {
        pCategory = 'other';
      }

      allTimePaymentMethods[pCategory].count += 1;
      allTimePaymentMethods[pCategory].amount += amt;

      if (dateStr === todayStr) {
        todaySales += amt;
        todayOrders += 1;
      }
      if (dateStr >= sevenDaysAgoStr) {
        weeklySales += amt;
      }
      if (dateStr >= thirtyDaysAgoStr) {
        monthlySales += amt;
      } else if (dateStr >= sixtyDaysAgoStr) {
        prevMonthSales += amt;
      }

      const inPeriod = isDateInPeriod(dateStr);
      if (inPeriod) {
        periodSales += amt;
        periodOrdersCount += 1;
        periodPaymentMethods[pCategory].count += 1;
        periodPaymentMethods[pCategory].amount += amt;
      }

      if (dateStr && dailySalesMap[dateStr] !== undefined) {
        dailySalesMap[dateStr] += amt;
      }

      let itemsList = [];
      try {
        itemsList = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      } catch (e) {}

      itemsList.forEach(item => {
        const dishName = item.name || item.title || item.dish_name || 'Unknown Dish';
        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price) || 0;
        const lineTotal = price * qty;
        const dishId = item.id || item.dish_id || null;

        if (!allTimeDishSalesMap[dishName]) {
          allTimeDishSalesMap[dishName] = { dish_id: dishId, name: dishName, quantity: 0, revenue: 0 };
        }
        allTimeDishSalesMap[dishName].quantity += qty;
        allTimeDishSalesMap[dishName].revenue += lineTotal;

        if (inPeriod) {
          if (!periodDishSalesMap[dishName]) {
            periodDishSalesMap[dishName] = { dish_id: dishId, name: dishName, quantity: 0, revenue: 0 };
          }
          periodDishSalesMap[dishName].quantity += qty;
          periodDishSalesMap[dishName].revenue += lineTotal;
        }
      });
    });

    // 2. Process Historical Summaries (Zero Double Counting)
    summaries.forEach(s => {
      const amt = Number(s.total_sales) || 0;
      const orderCnt = Number(s.total_orders) || 0;
      totalSales += amt;
      totalOrdersCount += orderCnt;

      const dDate = parseSafeDate(s.summary_date) || new Date(s.summary_date);
      const summaryDateStr = getFormattedLocalDate(dDate) || s.summary_date;

      if (summaryDateStr && summaryDateStr.length >= 7) {
        const mKey = summaryDateStr.substring(0, 7);
        const mYear = parseInt(summaryDateStr.substring(0, 4), 10);
        const mMonth = parseInt(summaryDateStr.substring(5, 7), 10);
        if (mYear >= 2020 && !availableMonthsMap[mKey]) {
          const monthLabel = dDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          availableMonthsMap[mKey] = { key: mKey, label: monthLabel, year: mYear, month: mMonth };
        }
      }

      if (summaryDateStr >= sevenDaysAgoStr) weeklySales += amt;
      if (summaryDateStr >= thirtyDaysAgoStr) {
        monthlySales += amt;
      } else if (summaryDateStr >= sixtyDaysAgoStr) {
        prevMonthSales += amt;
      }

      const inPeriod = isDateInPeriod(summaryDateStr);
      if (inPeriod) {
        periodSales += amt;
        periodOrdersCount += orderCnt;
      }

      if (summaryDateStr && dailySalesMap[summaryDateStr] !== undefined) {
        dailySalesMap[summaryDateStr] += amt;
      }

      // Process payment methods summary
      let pMethodsSummary = null;
      try {
        if (s.payment_methods_summary) {
          pMethodsSummary = typeof s.payment_methods_summary === 'string' ? JSON.parse(s.payment_methods_summary) : s.payment_methods_summary;
        }
      } catch (e) {}

      if (pMethodsSummary) {
        ['upi', 'cash', 'card', 'other'].forEach(pm => {
          const val = Number(pMethodsSummary[pm] || pMethodsSummary[pm]?.amount || 0);
          const cnt = Number(pMethodsSummary[pm]?.count || (val > 0 ? 1 : 0));
          allTimePaymentMethods[pm].amount += val;
          allTimePaymentMethods[pm].count += cnt;
          if (inPeriod) {
            periodPaymentMethods[pm].amount += val;
            periodPaymentMethods[pm].count += cnt;
          }
        });
      } else {
        // Legacy summary default fallback to cash
        allTimePaymentMethods.cash.amount += amt;
        allTimePaymentMethods.cash.count += orderCnt;
        if (inPeriod) {
          periodPaymentMethods.cash.amount += amt;
          periodPaymentMethods.cash.count += orderCnt;
        }
      }

      // Process items summary
      let itemsList = [];
      try {
        if (s.items_summary) {
          itemsList = typeof s.items_summary === 'string' ? JSON.parse(s.items_summary) : s.items_summary;
        } else if (s.top_dishes_summary) {
          itemsList = typeof s.top_dishes_summary === 'string' ? JSON.parse(s.top_dishes_summary) : s.top_dishes_summary;
        }
      } catch (e) {}

      if (Array.isArray(itemsList)) {
        itemsList.forEach(td => {
          const dName = td.name || 'Dish';
          const dQty = Number(td.quantity ?? td.qty ?? 1);
          const dRev = Number(td.revenue || 0);
          const dishId = td.dish_id || td.id || null;

          if (!allTimeDishSalesMap[dName]) {
            allTimeDishSalesMap[dName] = { dish_id: dishId, name: dName, quantity: 0, revenue: 0 };
          }
          allTimeDishSalesMap[dName].quantity += dQty;
          allTimeDishSalesMap[dName].revenue += dRev;

          if (inPeriod) {
            if (!periodDishSalesMap[dName]) {
              periodDishSalesMap[dName] = { dish_id: dishId, name: dName, quantity: 0, revenue: 0 };
            }
            periodDishSalesMap[dName].quantity += dQty;
            periodDishSalesMap[dName].revenue += dRev;
          }
        });
      }
    });

    const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalSales / totalOrdersCount) : 0;
    const periodAov = periodOrdersCount > 0 ? Math.round(periodSales / periodOrdersCount) : 0;
    const growthPercentage = prevMonthSales > 0 ? parseFloat((((monthlySales - prevMonthSales) / prevMonthSales) * 100).toFixed(1)) : 0;

    const activeDishMap = selectedPeriod === 'all' ? allTimeDishSalesMap : periodDishSalesMap;
    const topDishes = Object.values(activeDishMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const dailyChartData = Object.keys(dailySalesMap).sort().map(dateKey => ({
      date: dateKey,
      displayDate: new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }),
      sales: dailySalesMap[dateKey]
    }));

    const availableMonths = Object.values(availableMonthsMap).sort((a, b) => b.key.localeCompare(a.key));

    res.json({
      period_sales: periodSales,
      period_orders: periodOrdersCount,
      period_aov: periodAov,
      period_payment_methods: selectedPeriod === 'all' ? allTimePaymentMethods : periodPaymentMethods,
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
      average_order_value: averageOrderValue,
      growth_percentage: growthPercentage,
      payment_methods: selectedPeriod === 'all' ? allTimePaymentMethods : periodPaymentMethods,
      available_months: availableMonths,
      selected_period: selectedPeriod,
      top_dishes: topDishes,
      daily_chart: dailyChartData,
      summarized_days_count: summaries.length,
      last_updated: new Date().toISOString(),
      status: 'success'
    });
  } catch (err) {
    console.error('Fetch analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/admin/analytics/export/csv — Server-side RFC 4180 CSV export with Plan Entitlement Check
router.get('/analytics/export/csv', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing' });
    }

    // Check SaaS plan entitlement for analytics_export_enabled
    const restoRows = await query('SELECT plan_tier, name FROM restaurants WHERE id = $1', [targetId]);
    const planTier = restoRows[0]?.plan_tier || 'pro';
    const restoName = restoRows[0]?.name || 'Restaurant';

    const planRows = await query('SELECT analytics_export_enabled FROM saas_plans WHERE key = $1', [planTier]);
    const exportEnabled = planRows.length > 0
      ? (planRows[0].analytics_export_enabled === 1 || planRows[0].analytics_export_enabled === true || planRows[0].analytics_export_enabled === '1')
      : true;

    if (!exportEnabled) {
      return res.status(403).json({
        error: 'CSV Sales Export is not enabled on your current subscription plan tier.',
        feature: 'analytics_export_enabled'
      });
    }

    const { period: qPeriod, year: qYear, month: qMonth } = req.query;
    const selectedPeriod = qPeriod || (qYear && qMonth ? `month:${qYear}-${String(qMonth).padStart(2, '0')}` : 'all');

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
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      } catch (e) {
        return d.toISOString().split('T')[0];
      }
    };

    const now = new Date();
    const todayStr = getFormattedLocalDate(now);
    const getISTDateOffset = (daysBack) => {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      return getFormattedLocalDate(d);
    };

    let periodStartDate = null;
    let periodEndDate = null;

    if (qYear && qMonth) {
      const daysInMonth = new Date(parseInt(qYear, 10), parseInt(qMonth, 10), 0).getDate();
      const monthPrefix = `${qYear}-${String(qMonth).padStart(2, '0')}`;
      periodStartDate = `${monthPrefix}-01`;
      periodEndDate = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;
    } else if (selectedPeriod === 'today') {
      periodStartDate = todayStr;
      periodEndDate = todayStr;
    } else if (selectedPeriod === '7d') {
      periodStartDate = getISTDateOffset(6);
      periodEndDate = todayStr;
    } else if (selectedPeriod === '30d') {
      periodStartDate = getISTDateOffset(29);
      periodEndDate = todayStr;
    } else if (selectedPeriod === '6m') {
      periodStartDate = getISTDateOffset(180);
      periodEndDate = todayStr;
    }

    const isDateInPeriod = (dStr) => {
      if (!dStr) return false;
      if (selectedPeriod === 'all') return true;
      if (periodStartDate && periodEndDate) {
        return dStr >= periodStartDate && dStr <= periodEndDate;
      }
      return true;
    };

    const orders = await query(
      "SELECT id, total_amount, status, payment_method, table_number, customer_name, customer_phone, items, created_at FROM orders WHERE restaurant_id = $1 AND status NOT IN ('rejected', 'cancelled') ORDER BY id ASC",
      [targetId]
    );

    const summaries = await query(
      'SELECT summary_date, total_sales, total_orders, top_dishes_summary, items_summary, payment_methods_summary FROM daily_sales_summaries WHERE restaurant_id = $1 ORDER BY summary_date ASC',
      [targetId]
    );

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Record Type',
      'Order / Summary ID',
      'Date (IST)',
      'Time (IST)',
      'Order Count',
      'Table / Space',
      'Customer Name',
      'Customer Phone',
      'Items Count',
      'Items Detail',
      'Payment Method',
      'Cash Amount (INR)',
      'UPI Amount (INR)',
      'Card Amount (INR)',
      'Other Amount (INR)',
      'Amount (INR)',
      'Status'
    ];

    const csvRows = [];
    let grandTotalRepresentedOrders = 0;
    let liveOrderRowCount = 0;
    let rollupRowCount = 0;
    let grandTotalItemsCount = 0;
    let grandTotalCash = 0;
    let grandTotalUPI = 0;
    let grandTotalCard = 0;
    let grandTotalOther = 0;
    let grandTotalRevenue = 0;

    // 1. Process Live Orders
    orders.forEach(o => {
      const d = parseSafeDate(o.created_at) || new Date();
      const dStr = getFormattedLocalDate(d);
      if (!isDateInPeriod(dStr)) return;

      let timeStr = 'N/A';
      try {
        timeStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
      } catch (e) {}

      let itemsList = [];
      try {
        itemsList = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      } catch (e) {}

      const totalItemCount = itemsList.reduce((acc, i) => acc + (Number(i.quantity || i.qty) || 1), 0);
      const itemsDetailStr = itemsList.map(i => `${i.name || i.title || 'Item'} (x${i.quantity || i.qty || 1})`).join(', ');

      const amt = Number(o.total_amount) || 0;
      const pMethod = String(o.payment_method || 'cash').toLowerCase();

      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;
      let otherAmt = 0;
      let pMethodDisplay = 'CASH';

      if (pMethod.includes('upi') || pMethod.includes('online') || pMethod.includes('paytm') || pMethod.includes('gpay') || pMethod.includes('phonepe')) {
        upiAmt = amt;
        pMethodDisplay = 'UPI';
      } else if (pMethod.includes('card')) {
        cardAmt = amt;
        pMethodDisplay = 'CARD';
      } else if (pMethod.includes('cash')) {
        cashAmt = amt;
        pMethodDisplay = 'CASH';
      } else {
        otherAmt = amt;
        pMethodDisplay = 'OTHER';
      }

      grandTotalRepresentedOrders += 1;
      liveOrderRowCount += 1;
      grandTotalItemsCount += totalItemCount;
      grandTotalCash += cashAmt;
      grandTotalUPI += upiAmt;
      grandTotalCard += cardAmt;
      grandTotalOther += otherAmt;
      grandTotalRevenue += amt;

      csvRows.push([
        'LIVE_ORDER',
        `#${o.id}`,
        dStr,
        timeStr,
        1,
        String(o.table_number || '1'),
        o.customer_name || 'Dine-In Guest',
        o.customer_phone || 'N/A',
        totalItemCount,
        itemsDetailStr,
        pMethodDisplay,
        cashAmt,
        upiAmt,
        cardAmt,
        otherAmt,
        amt,
        String(o.status || 'COMPLETED').toUpperCase()
      ]);
    });

    // 2. Process Historical Summaries (DAILY_ROLLUP)
    summaries.forEach(s => {
      const dDate = parseSafeDate(s.summary_date) || new Date(s.summary_date);
      const sDateStr = getFormattedLocalDate(dDate) || s.summary_date;
      if (!isDateInPeriod(sDateStr)) return;

      const orderCount = Number(s.total_orders) || 1;
      const amt = Number(s.total_sales) || 0;

      let itemsList = [];
      try {
        if (s.items_summary) {
          itemsList = typeof s.items_summary === 'string' ? JSON.parse(s.items_summary) : s.items_summary;
        } else if (s.top_dishes_summary) {
          itemsList = typeof s.top_dishes_summary === 'string' ? JSON.parse(s.top_dishes_summary) : s.top_dishes_summary;
        }
      } catch (e) {}

      const totalItemCount = Array.isArray(itemsList) ? itemsList.reduce((acc, i) => acc + (Number(i.quantity ?? i.qty) || 1), 0) : 0;
      const itemsDetailStr = Array.isArray(itemsList) && itemsList.length > 0
        ? itemsList.map(i => `${i.name} (x${i.quantity ?? i.qty ?? 1})`).join(', ')
        : 'Daily Summary';

      let pMethodsSummary = null;
      try {
        if (s.payment_methods_summary) {
          pMethodsSummary = typeof s.payment_methods_summary === 'string' ? JSON.parse(s.payment_methods_summary) : s.payment_methods_summary;
        }
      } catch (e) {}

      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;
      let otherAmt = 0;

      if (pMethodsSummary) {
        cashAmt = Number(pMethodsSummary.cash || pMethodsSummary.cash?.amount || 0);
        upiAmt = Number(pMethodsSummary.upi || pMethodsSummary.upi?.amount || 0);
        cardAmt = Number(pMethodsSummary.card || pMethodsSummary.card?.amount || 0);
        otherAmt = Number(pMethodsSummary.other || pMethodsSummary.other?.amount || 0);
      } else {
        cashAmt = amt;
      }

      let pMethodDisplay = 'MIXED';
      if (cashAmt > 0 && upiAmt === 0 && cardAmt === 0 && otherAmt === 0) pMethodDisplay = 'CASH';
      else if (upiAmt > 0 && cashAmt === 0 && cardAmt === 0 && otherAmt === 0) pMethodDisplay = 'UPI';
      else if (cardAmt > 0 && cashAmt === 0 && upiAmt === 0 && otherAmt === 0) pMethodDisplay = 'CARD';

      grandTotalRepresentedOrders += orderCount;
      rollupRowCount += 1;
      grandTotalItemsCount += totalItemCount;
      grandTotalCash += cashAmt;
      grandTotalUPI += upiAmt;
      grandTotalCard += cardAmt;
      grandTotalOther += otherAmt;
      grandTotalRevenue += amt;

      csvRows.push([
        'DAILY_ROLLUP',
        `SUMMARY-${sDateStr}`,
        sDateStr,
        'Full Day Aggregate',
        orderCount,
        'Multiple Tables',
        'Daily Compaction',
        'N/A',
        totalItemCount,
        itemsDetailStr,
        pMethodDisplay,
        cashAmt,
        upiAmt,
        cardAmt,
        otherAmt,
        amt,
        'COMPLETED (ARCHIVE)'
      ]);
    });

    // 3. Add Summary Footer Section (Tabular alignment for Excel & Google Sheets)
    if (csvRows.length > 0) {
      csvRows.push([
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
      ]);
      csvRows.push([
        'REPORT_SUMMARY',
        'ALL_RECORDS',
        `Period: ${selectedPeriod}`,
        `Live Rows: ${liveOrderRowCount} | Rollup Rows: ${rollupRowCount}`,
        grandTotalRepresentedOrders,
        'Multiple Tables',
        'Summary Totals',
        'N/A',
        grandTotalItemsCount,
        `Total Represented Orders: ${grandTotalRepresentedOrders} across ${liveOrderRowCount + rollupRowCount} physical records`,
        'ALL_METHODS',
        grandTotalCash,
        grandTotalUPI,
        grandTotalCard,
        grandTotalOther,
        grandTotalRevenue,
        'VERIFIED_SUMMARY'
      ]);
    }

    const csvContent = '\uFEFF' + [
      headers.map(escapeCSV).join(','),
      ...csvRows.map(row => row.map(escapeCSV).join(','))
    ].join('\r\n');

    const filename = `Sales_Report_${selectedPeriod}_${todayStr}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export analytics CSV error:', err);
    res.status(500).json({ error: 'Failed to export sales CSV' });
  }
});

// GET /api/admin/analytics/export/xlsx — Unified Server-side 3-Sheet Professional XLSX export with ExcelJS & Plan Entitlement
router.get('/analytics/export/xlsx', authenticateToken, requireActiveSubscription, async (req, res) => {
  try {
    const targetId = req.user?.restaurant_id;
    if (!targetId) {
      return res.status(401).json({ error: 'Restaurant identity is missing' });
    }

    // 1. Check SaaS plan entitlement for analytics_export_enabled
    const restoRows = await query('SELECT plan_tier, name, currency_symbol FROM restaurants WHERE id = $1', [targetId]);
    const planTier = restoRows[0]?.plan_tier || 'pro';
    const restoName = restoRows[0]?.name || 'Restaurant';
    const currencySym = (restoRows[0]?.currency_symbol !== null && restoRows[0]?.currency_symbol !== undefined) ? restoRows[0].currency_symbol : '₹';
    const safeCurrency = String(currencySym).replace(/"/g, '""');
    const excelCurrencyFmt = `"${safeCurrency}"#,##0.00`;

    const planRows = await query('SELECT analytics_export_enabled FROM saas_plans WHERE key = $1', [planTier]);
    const exportEnabled = planRows.length > 0
      ? (planRows[0].analytics_export_enabled === 1 || planRows[0].analytics_export_enabled === true || planRows[0].analytics_export_enabled === '1')
      : true;

    if (!exportEnabled) {
      return res.status(403).json({
        error: 'Sales Report Export is not enabled on your current subscription plan tier.',
        feature: 'analytics_export_enabled'
      });
    }

    const { period: qPeriod, year: qYear, month: qMonth } = req.query;
    const selectedPeriod = qPeriod || (qYear && qMonth ? `month:${qYear}-${String(qMonth).padStart(2, '0')}` : 'all');

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
      try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      } catch (e) {
        return d.toISOString().split('T')[0];
      }
    };

    const now = new Date();
    const todayStr = getFormattedLocalDate(now);
    const getISTDateOffset = (daysBack) => {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      return getFormattedLocalDate(d);
    };

    let periodStartDate = null;
    let periodEndDate = null;
    let periodLabel = 'All-Time';
    let filePeriodSlug = 'All_Time';

    if (qYear && qMonth) {
      const daysInMonth = new Date(parseInt(qYear, 10), parseInt(qMonth, 10), 0).getDate();
      const monthPrefix = `${qYear}-${String(qMonth).padStart(2, '0')}`;
      periodStartDate = `${monthPrefix}-01`;
      periodEndDate = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;
      periodLabel = `Month ${monthPrefix}`;
      filePeriodSlug = `Month_${monthPrefix}`;
    } else if (selectedPeriod === 'today') {
      periodStartDate = todayStr;
      periodEndDate = todayStr;
      periodLabel = `Today (${todayStr})`;
      filePeriodSlug = 'Today';
    } else if (selectedPeriod === '7d') {
      periodStartDate = getISTDateOffset(6);
      periodEndDate = todayStr;
      periodLabel = `Last 7 Days (${periodStartDate} to ${periodEndDate})`;
      filePeriodSlug = 'Last_7_Days';
    } else if (selectedPeriod === '30d') {
      periodStartDate = getISTDateOffset(29);
      periodEndDate = todayStr;
      periodLabel = `Last 30 Days (${periodStartDate} to ${periodEndDate})`;
      filePeriodSlug = 'Last_30_Days';
    } else if (selectedPeriod === '6m') {
      periodStartDate = getISTDateOffset(180);
      periodEndDate = todayStr;
      periodLabel = `Last 6 Months (${periodStartDate} to ${periodEndDate})`;
      filePeriodSlug = 'Last_6_Months';
    } else if (selectedPeriod.startsWith('month:')) {
      const monthPrefix = selectedPeriod.replace('month:', '');
      const parts = monthPrefix.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const daysInMonth = new Date(y, m, 0).getDate();
      periodStartDate = `${monthPrefix}-01`;
      periodEndDate = `${monthPrefix}-${String(daysInMonth).padStart(2, '0')}`;
      periodLabel = `Month ${monthPrefix}`;
      filePeriodSlug = `Month_${monthPrefix}`;
    }

    const isDateInPeriod = (dStr) => {
      if (!dStr) return false;
      if (selectedPeriod === 'all') return true;
      if (periodStartDate && periodEndDate) {
        return dStr >= periodStartDate && dStr <= periodEndDate;
      }
      return true;
    };

    let generatedAtIST = 'N/A';
    try {
      generatedAtIST = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium'
      }).format(now);
    } catch (e) {
      generatedAtIST = now.toISOString();
    }

    // Fetch live orders & historical summaries
    const orders = await query(
      "SELECT id, total_amount, status, payment_method, table_number, customer_name, customer_phone, items, created_at FROM orders WHERE restaurant_id = $1 AND status NOT IN ('rejected', 'cancelled') ORDER BY id ASC",
      [targetId]
    );

    const summaries = await query(
      'SELECT summary_date, total_sales, total_orders, top_dishes_summary, items_summary, payment_methods_summary FROM daily_sales_summaries WHERE restaurant_id = $1 ORDER BY summary_date ASC',
      [targetId]
    );

    // Initialize Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TouchQR Suite';
    workbook.lastModifiedBy = restoName;
    workbook.created = now;
    workbook.modified = now;

    // Data structures for aggregation
    let grandTotalRepresentedOrders = 0;
    let liveOrderRowCount = 0;
    let rollupRowCount = 0;
    let grandTotalItemsCount = 0;
    let grandTotalCash = 0;
    let grandTotalUPI = 0;
    let grandTotalCard = 0;
    let grandTotalOther = 0;
    let grandTotalRevenue = 0;

    const dishSalesMap = new Map(); // dish_id -> { dish_id, name, quantity, revenue }
    const dailyTrendMap = new Map(); // date -> { date, orders, revenue }

    const reportRows = [];

    // 1. Process Live Orders
    orders.forEach(o => {
      const d = parseSafeDate(o.created_at) || new Date();
      const dStr = getFormattedLocalDate(d);
      if (!isDateInPeriod(dStr)) return;

      let timeStr = 'N/A';
      try {
        timeStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(d);
      } catch (e) {}

      let itemsList = [];
      try {
        itemsList = typeof o.items === 'string' ? JSON.parse(o.items) : (Array.isArray(o.items) ? o.items : []);
      } catch (e) {}

      const totalItemCount = itemsList.reduce((acc, i) => acc + (Number(i.quantity || i.qty) || 1), 0);
      const itemsDetailStr = itemsList.map(i => `${i.name || i.title || 'Item'} (x${i.quantity || i.qty || 1})`).join(', ');

      const amt = Number(o.total_amount) || 0;
      const pMethod = String(o.payment_method || 'cash').toLowerCase();

      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;
      let otherAmt = 0;
      let pMethodDisplay = 'CASH';

      if (pMethod.includes('upi') || pMethod.includes('online') || pMethod.includes('paytm') || pMethod.includes('gpay') || pMethod.includes('phonepe')) {
        upiAmt = amt;
        pMethodDisplay = 'UPI';
      } else if (pMethod.includes('card')) {
        cardAmt = amt;
        pMethodDisplay = 'CARD';
      } else if (pMethod.includes('cash')) {
        cashAmt = amt;
        pMethodDisplay = 'CASH';
      } else {
        otherAmt = amt;
        pMethodDisplay = 'OTHER';
      }

      grandTotalRepresentedOrders += 1;
      liveOrderRowCount += 1;
      grandTotalItemsCount += totalItemCount;
      grandTotalCash += cashAmt;
      grandTotalUPI += upiAmt;
      grandTotalCard += cardAmt;
      grandTotalOther += otherAmt;
      grandTotalRevenue += amt;

      // Track Trend
      const trend = dailyTrendMap.get(dStr) || { date: dStr, orders: 0, revenue: 0 };
      trend.orders += 1;
      trend.revenue += amt;
      dailyTrendMap.set(dStr, trend);

      // Track Dish Sales
      itemsList.forEach(item => {
        const dId = String(item.dish_id || item.id || item.name || 'dish_unknown');
        const dName = item.name || item.title || 'Unknown Dish';
        const dQty = Number(item.quantity || item.qty || 1);
        const dRev = (Number(item.price) || 0) * dQty || (totalItemCount > 0 ? (amt / totalItemCount) * dQty : amt);

        const exist = dishSalesMap.get(dId) || { dish_id: dId, name: dName, quantity: 0, revenue: 0 };
        exist.quantity += dQty;
        exist.revenue += dRev;
        dishSalesMap.set(dId, exist);
      });

      reportRows.push({
        record_type: 'LIVE_ORDER',
        id: `#${o.id}`,
        date: dStr,
        time: timeStr,
        order_count: 1,
        table: String(o.table_number || '1'),
        customer_name: o.customer_name || 'Dine-In Guest',
        customer_phone: String(o.customer_phone || 'N/A'),
        items_count: totalItemCount,
        items_detail: itemsDetailStr,
        payment_method: pMethodDisplay,
        cash_amt: cashAmt,
        upi_amt: upiAmt,
        card_amt: cardAmt,
        other_amt: otherAmt,
        amount: amt,
        status: String(o.status || 'COMPLETED').toUpperCase()
      });
    });

    // 2. Process Historical Summaries (DAILY_ROLLUP)
    summaries.forEach(s => {
      const dDate = parseSafeDate(s.summary_date) || new Date(s.summary_date);
      const sDateStr = getFormattedLocalDate(dDate) || s.summary_date;
      if (!isDateInPeriod(sDateStr)) return;

      const orderCount = Number(s.total_orders) || 1;
      const amt = Number(s.total_sales) || 0;

      let itemsList = [];
      try {
        if (s.items_summary) {
          itemsList = typeof s.items_summary === 'string' ? JSON.parse(s.items_summary) : s.items_summary;
        } else if (s.top_dishes_summary) {
          itemsList = typeof s.top_dishes_summary === 'string' ? JSON.parse(s.top_dishes_summary) : s.top_dishes_summary;
        }
      } catch (e) {}

      const totalItemCount = Array.isArray(itemsList) ? itemsList.reduce((acc, i) => acc + (Number(i.quantity ?? i.qty) || 1), 0) : 0;
      const itemsDetailStr = Array.isArray(itemsList) && itemsList.length > 0
        ? itemsList.map(i => `${i.name} (x${i.quantity ?? i.qty ?? 1})`).join(', ')
        : 'Daily Summary';

      let pMethodsSummary = null;
      try {
        if (s.payment_methods_summary) {
          pMethodsSummary = typeof s.payment_methods_summary === 'string' ? JSON.parse(s.payment_methods_summary) : s.payment_methods_summary;
        }
      } catch (e) {}

      let cashAmt = 0;
      let upiAmt = 0;
      let cardAmt = 0;
      let otherAmt = 0;

      if (pMethodsSummary) {
        cashAmt = Number(pMethodsSummary.cash || pMethodsSummary.cash?.amount || 0);
        upiAmt = Number(pMethodsSummary.upi || pMethodsSummary.upi?.amount || 0);
        cardAmt = Number(pMethodsSummary.card || pMethodsSummary.card?.amount || 0);
        otherAmt = Number(pMethodsSummary.other || pMethodsSummary.other?.amount || 0);
      } else {
        cashAmt = amt;
      }

      let pMethodDisplay = 'MIXED';
      if (cashAmt > 0 && upiAmt === 0 && cardAmt === 0 && otherAmt === 0) pMethodDisplay = 'CASH';
      else if (upiAmt > 0 && cashAmt === 0 && cardAmt === 0 && otherAmt === 0) pMethodDisplay = 'UPI';
      else if (cardAmt > 0 && cashAmt === 0 && upiAmt === 0 && otherAmt === 0) pMethodDisplay = 'CARD';

      grandTotalRepresentedOrders += orderCount;
      rollupRowCount += 1;
      grandTotalItemsCount += totalItemCount;
      grandTotalCash += cashAmt;
      grandTotalUPI += upiAmt;
      grandTotalCard += cardAmt;
      grandTotalOther += otherAmt;
      grandTotalRevenue += amt;

      // Track Trend
      const trend = dailyTrendMap.get(sDateStr) || { date: sDateStr, orders: 0, revenue: 0 };
      trend.orders += orderCount;
      trend.revenue += amt;
      dailyTrendMap.set(sDateStr, trend);

      // Track Dish Sales
      if (Array.isArray(itemsList)) {
        itemsList.forEach(item => {
          const dId = String(item.dish_id || item.id || item.name || 'dish_unknown');
          const dName = item.name || 'Unknown Dish';
          const dQty = Number(item.quantity ?? item.qty ?? item.count ?? 1);
          const dRev = Number(item.revenue || 0) || (Number(item.price) || 0) * dQty;

          const exist = dishSalesMap.get(dId) || { dish_id: dId, name: dName, quantity: 0, revenue: 0 };
          exist.quantity += dQty;
          exist.revenue += dRev;
          dishSalesMap.set(dId, exist);
        });
      }

      reportRows.push({
        record_type: 'DAILY_ROLLUP',
        id: `SUMMARY-${sDateStr}`,
        date: sDateStr,
        time: 'Full Day Aggregate',
        order_count: orderCount,
        table: 'Multiple Tables',
        customer_name: 'Daily Compaction',
        customer_phone: 'N/A',
        items_count: totalItemCount,
        items_detail: itemsDetailStr,
        payment_method: pMethodDisplay,
        cash_amt: cashAmt,
        upi_amt: upiAmt,
        card_amt: cardAmt,
        other_amt: otherAmt,
        amount: amt,
        status: 'COMPLETED (ARCHIVE)'
      });
    });

    const averageOrderValue = grandTotalRepresentedOrders > 0
      ? Math.round(grandTotalRevenue / grandTotalRepresentedOrders)
      : 0;

    // ==========================================
    // SHEET 1: Sales Report
    // ==========================================
    const sheet1 = workbook.addWorksheet('Sales Report');

    // Setup sheet properties & freeze
    sheet1.views = [{ state: 'frozen', ySplit: 6 }];

    // Column widths
    sheet1.columns = [
      { key: 'record_type', width: 16 },
      { key: 'id', width: 20 },
      { key: 'date', width: 14 },
      { key: 'time', width: 16 },
      { key: 'order_count', width: 13 },
      { key: 'table', width: 15 },
      { key: 'customer_name', width: 24 },
      { key: 'customer_phone', width: 18 },
      { key: 'items_count', width: 13 },
      { key: 'items_detail', width: 55 },
      { key: 'payment_method', width: 18 },
      { key: 'cash_amt', width: 18 },
      { key: 'upi_amt', width: 18 },
      { key: 'card_amt', width: 18 },
      { key: 'other_amt', width: 18 },
      { key: 'amount', width: 18 },
      { key: 'status', width: 16 }
    ];

    // Meta Header Rows
    sheet1.addRow(['TOUCHQR — SALES REPORT']);
    sheet1.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };

    sheet1.addRow([`Restaurant Name: ${restoName}`]);
    sheet1.getRow(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet1.addRow([`Report Period: ${periodLabel}`]);
    sheet1.getRow(3).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet1.addRow([`Generated At (IST): ${generatedAtIST}`]);
    sheet1.getRow(4).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet1.addRow([]); // Blank Row 5

    // Table Header Row 6
    const headerRow = sheet1.addRow([
      'Record Type',
      'Order / Summary ID',
      'Date (IST)',
      'Time (IST)',
      'Order Count',
      'Table / Space',
      'Customer Name',
      'Customer Phone',
      'Items Count',
      'Items Detail',
      'Payment Method',
      `Cash Amount (${currencySym})`,
      `UPI Amount (${currencySym})`,
      `Card Amount (${currencySym})`,
      `Other Amount (${currencySym})`,
      `Amount (${currencySym})`,
      'Status'
    ]);

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 26;

    sheet1.autoFilter = { from: 'A6', to: 'Q6' };

    // Add Data Rows
    reportRows.forEach(r => {
      const row = sheet1.addRow([
        r.record_type,
        r.id,
        r.date,
        r.time,
        r.order_count,
        r.table,
        r.customer_name,
        r.customer_phone,
        r.items_count,
        r.items_detail,
        r.payment_method,
        r.cash_amt,
        r.upi_amt,
        r.card_amt,
        r.other_amt,
        r.amount,
        r.status
      ]);

      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).numFmt = '#,##0';
      row.getCell(7).alignment = { wrapText: true };
      row.getCell(8).numFmt = '@'; // Force text format for phone numbers
      row.getCell(9).numFmt = '#,##0';
      row.getCell(10).alignment = { wrapText: true };
      row.getCell(12).numFmt = excelCurrencyFmt;
      row.getCell(13).numFmt = excelCurrencyFmt;
      row.getCell(14).numFmt = excelCurrencyFmt;
      row.getCell(15).numFmt = excelCurrencyFmt;
      row.getCell(16).numFmt = excelCurrencyFmt;
      row.getCell(17).alignment = { horizontal: 'center' };
    });

    // Summary Footer Row
    if (reportRows.length > 0) {
      sheet1.addRow([]); // Blank spacer row

      const footerRow = sheet1.addRow([
        'REPORT_SUMMARY',
        'ALL_RECORDS',
        `Period: ${selectedPeriod}`,
        `Live: ${liveOrderRowCount} | Rollup: ${rollupRowCount}`,
        grandTotalRepresentedOrders,
        'Multiple Tables',
        'Summary Totals',
        'N/A',
        grandTotalItemsCount,
        `Total Represented Orders: ${grandTotalRepresentedOrders} across ${liveOrderRowCount + rollupRowCount} physical records`,
        'ALL_METHODS',
        grandTotalCash,
        grandTotalUPI,
        grandTotalCard,
        grandTotalOther,
        grandTotalRevenue,
        'VERIFIED_SUMMARY'
      ]);

      footerRow.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      });
      footerRow.getCell(5).numFmt = '#,##0';
      footerRow.getCell(9).numFmt = '#,##0';
      footerRow.getCell(12).numFmt = excelCurrencyFmt;
      footerRow.getCell(13).numFmt = excelCurrencyFmt;
      footerRow.getCell(14).numFmt = excelCurrencyFmt;
      footerRow.getCell(15).numFmt = excelCurrencyFmt;
      footerRow.getCell(16).numFmt = excelCurrencyFmt;
      footerRow.height = 24;
    }

    // ==========================================
    // SHEET 2: Summary
    // ==========================================
    const sheet2 = workbook.addWorksheet('Summary');
    sheet2.columns = [
      { width: 28 },
      { width: 24 },
      { width: 20 },
      { width: 22 }
    ];

    sheet2.addRow(['TOUCHQR — SALES SUMMARY']);
    sheet2.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };

    sheet2.addRow([`Restaurant Name: ${restoName}`]);
    sheet2.getRow(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet2.addRow([`Report Period: ${periodLabel}`]);
    sheet2.getRow(3).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet2.addRow([`Generated At (IST): ${generatedAtIST}`]);
    sheet2.getRow(4).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet2.addRow([]); // Blank Row 5

    // Section 1: Executive KPI Metrics
    const kpiHeader = sheet2.addRow(['METRIC', 'VALUE', 'DESCRIPTION', '']);
    kpiHeader.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    });

    const kpi1 = sheet2.addRow([`Total Revenue (${currencySym})`, grandTotalRevenue, 'Gross sales for selected period', '']);
    kpi1.getCell(2).numFmt = excelCurrencyFmt;
    kpi1.getCell(2).font = { bold: true };

    const kpi2 = sheet2.addRow(['Total Represented Orders', grandTotalRepresentedOrders, `Across ${liveOrderRowCount + rollupRowCount} physical records`, '']);
    kpi2.getCell(2).numFmt = '#,##0';
    kpi2.getCell(2).font = { bold: true };

    const kpi3 = sheet2.addRow([`Average Order Value (AOV)`, averageOrderValue, 'Average ticket size per order', '']);
    kpi3.getCell(2).numFmt = excelCurrencyFmt;
    kpi3.getCell(2).font = { bold: true };

    const kpi4 = sheet2.addRow(['Total Items Sold', grandTotalItemsCount, 'Cumulative dish count sold', '']);
    kpi4.getCell(2).numFmt = '#,##0';
    kpi4.getCell(2).font = { bold: true };

    sheet2.addRow([]); // Spacer

    // Section 2: Payment Collection Breakdown
    const payHeader = sheet2.addRow(['PAYMENT METHOD', `AMOUNT (${currencySym})`, 'SHARE (%)', '']);
    payHeader.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    });

    const pRows = [
      { name: 'Cash Collection', amount: grandTotalCash },
      { name: 'UPI / Online Collection', amount: grandTotalUPI },
      { name: 'Card Collection', amount: grandTotalCard },
      { name: 'Other Payment Collection', amount: grandTotalOther }
    ];

    pRows.forEach(p => {
      const share = grandTotalRevenue > 0 ? (p.amount / grandTotalRevenue) : 0;
      const row = sheet2.addRow([p.name, p.amount, share, '']);
      row.getCell(2).numFmt = excelCurrencyFmt;
      row.getCell(3).numFmt = '0.0%';
    });

    sheet2.addRow([]); // Spacer

    // Section 3: Daily Sales Trend
    const trendHeader = sheet2.addRow(['DATE (IST)', 'ORDERS COUNT', `REVENUE (${currencySym})`, '']);
    trendHeader.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
    });

    const sortedTrend = Array.from(dailyTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    sortedTrend.forEach(t => {
      const row = sheet2.addRow([t.date, t.orders, t.revenue, '']);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).numFmt = '#,##0';
      row.getCell(3).numFmt = excelCurrencyFmt;
    });

    sheet2.addRow([]); // Spacer

    // Section 4: Top Selling Dishes Preview
    const topDishesHeader = sheet2.addRow(['RANK', 'DISH NAME', 'QUANTITY SOLD', `REVENUE (${currencySym})`]);
    topDishesHeader.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
    });

    const sortedDishes = Array.from(dishSalesMap.values()).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
    sortedDishes.slice(0, 10).forEach((d, idx) => {
      const row = sheet2.addRow([idx + 1, d.name, d.quantity, d.revenue]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = '#,##0';
      row.getCell(4).numFmt = excelCurrencyFmt;
    });

    // ==========================================
    // SHEET 3: Item Sales
    // ==========================================
    const sheet3 = workbook.addWorksheet('Item Sales');
    sheet3.views = [{ state: 'frozen', ySplit: 5 }];

    sheet3.columns = [
      { key: 'rank', width: 10 },
      { key: 'dish_id', width: 16 },
      { key: 'dish_name', width: 36 },
      { key: 'quantity_sold', width: 18 },
      { key: 'revenue', width: 22 }
    ];

    sheet3.addRow(['TOUCHQR — DISH LEVEL SALES REPORT']);
    sheet3.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };

    sheet3.addRow([`Restaurant: ${restoName} | Period: ${periodLabel}`]);
    sheet3.getRow(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet3.addRow([`Generated At: ${generatedAtIST}`]);
    sheet3.getRow(3).font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };

    sheet3.addRow([]); // Blank Row 4

    const itemHeader = sheet3.addRow(['Rank', 'Dish ID', 'Dish Name', 'Quantity Sold', `Revenue (${currencySym})`]);
    itemHeader.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    itemHeader.height = 24;

    sheet3.autoFilter = { from: 'A5', to: 'E5' };

    sortedDishes.forEach((d, idx) => {
      const row = sheet3.addRow([
        idx + 1,
        d.dish_id,
        d.name,
        d.quantity,
        d.revenue
      ]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).numFmt = '@';
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).numFmt = excelCurrencyFmt;
    });

    const filename = `Sales_Report_${filePeriodSlug}_${todayStr}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('Export analytics XLSX error:', err);
    res.status(500).json({ error: 'Failed to export sales report XLSX' });
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
        success: false,
        error: 'plan_limit_reached',
        resource: 'combos',
        limit: maxCombos,
        current_count: currentCount,
        message: `Combo limit reached! Your ${planTier.toUpperCase()} plan allows a maximum of ${maxCombos} combos. Please upgrade your SaaS plan to add more.`,
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
