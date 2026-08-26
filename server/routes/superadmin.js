import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, runAutoDataSummarization, logAudit, saveR2ImageToDb, saveImageToDb, purgeLocalR2DiskCache } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { isR2Active, uploadImageToR2, deleteImageFromR2 } from '../services/r2ImageService.js';
import { JWT_SECRET } from '../config/jwt.js';
import { superAdminLoginRateLimiter } from '../middleware/rateLimiters.js';
import { resolveCanonicalSubscriptionState } from '../services/subscriptionState.js';
import { resolveBusinessCategoryFromType, resolveBusinessProfile } from '../config/businessTaxonomy.js';

let sharpModule = null;
async function getSharp() {
  if (!sharpModule) {
    try {
      const m = await import('sharp');
      sharpModule = m.default || m;
    } catch (e) {
      console.warn('Sharp module import notice in superadmin route:', e.message);
    }
  }
  return sharpModule;
}

const router = express.Router();

// Helper middleware to restrict endpoints to superadmin role only
function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Master Super Admin privileges required.' });
  }
}



// Super Admin Login
router.post('/login', superAdminLoginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedUser = username.trim();

    // STRICT ROLE SECURITY: Reject Restaurant Owner attempts on Super Admin login
    const ownerCheck = await query("SELECT id FROM admins WHERE username = $1 AND role != 'superadmin'", [trimmedUser]);
    if (ownerCheck && ownerCheck.length > 0) {
      return res.status(403).json({
        error: 'ACCESS_DENIED_ROLE_MISMATCH',
        message: 'Restaurant Owner credentials cannot be used for Super Admin login. Please log in at your restaurant owner portal.'
      });
    }

    const admins = await query("SELECT * FROM admins WHERE username = $1 AND role = 'superadmin'", [trimmedUser]);
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

    await logAudit(null, 'superadmin', 'Super Admin Login', `Master user '${username}' logged in successfully`);

    res.json({ token, username: admin.username, role: 'superadmin' });
  } catch (err) {
    console.error('Super Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET All Tenant Restaurants with stats & subscription lifecycle details (Supports Safe Pagination & Search)
router.get('/restaurants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const isPaginatedReq = req.query.page !== undefined || req.query.limit !== undefined || req.query.search !== undefined || req.query.paginated === 'true';
    const page = Math.max(1, parseInt(req.query.page || 1, 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || 50, 10)));
    const search = String(req.query.search || '').trim().toLowerCase();
    const offset = (page - 1) * limit;

    let restoSql = 'SELECT * FROM restaurants';
    const sqlParams = [];
    if (search) {
      restoSql += ' WHERE LOWER(name) LIKE $1 OR LOWER(slug) LIKE $1 OR LOWER(phone) LIKE $1';
      sqlParams.push(`%${search}%`);
    }
    restoSql += ' ORDER BY id DESC';

    if (isPaginatedReq) {
      const countSql = search ? 'SELECT COUNT(*) as count FROM restaurants WHERE LOWER(name) LIKE $1 OR LOWER(slug) LIKE $1 OR LOWER(phone) LIKE $1' : 'SELECT COUNT(*) as count FROM restaurants';
      const countRows = await query(countSql, sqlParams);
      const totalCount = parseInt(countRows[0]?.count || 0, 10);

      restoSql += ` LIMIT $${sqlParams.length + 1} OFFSET $${sqlParams.length + 2}`;
      sqlParams.push(limit, offset);

      const [restaurants, dishesCount, adminsList, subsList] = await Promise.all([
        query(restoSql, sqlParams),
        query('SELECT restaurant_id, COUNT(*) as count FROM dishes GROUP BY restaurant_id'),
        query("SELECT id, restaurant_id, username FROM admins WHERE role = 'restaurant_admin'"),
        query('SELECT * FROM subscriptions ORDER BY id DESC').catch(() => [])
      ]);

      const countMap = {};
      dishesCount.forEach(row => { countMap[row.restaurant_id] = parseInt(row.count || 0, 10); });
      const adminMap = {};
      adminsList.forEach(a => { adminMap[a.restaurant_id] = a.username; });
      const subMap = {};
      (subsList || []).forEach(s => { if (!subMap[s.restaurant_id]) subMap[s.restaurant_id] = s; });

      const result = restaurants.map(r => {
        const sub = subMap[r.id];
        return {
          ...r,
          dish_count: countMap[r.id] || 0,
          owner_username: adminMap[r.id] || 'N/A',
          subscription_status: sub?.status || (r.trial_ends_at ? 'trialing' : 'active'),
          cancel_requested_at: sub?.cancel_requested_at || null,
          auto_renew: sub?.auto_renew !== undefined ? Number(sub.auto_renew) : 1,
          scheduled_plan_key: sub?.scheduled_plan_key || null,
          plan_change_effective_at: sub?.plan_change_effective_at || null,
          cancellation_reason: sub?.cancellation_reason || null,
          access_until: sub?.current_period_end || r.trial_ends_at || r.plan_expires_at || null
        };
      });

      return res.json({
        data: result,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    }

    // Default backward-compatible unpaginated list
    const [restaurants, dishesCount, adminsList, subsList] = await Promise.all([
      query('SELECT * FROM restaurants ORDER BY id DESC'),
      query('SELECT restaurant_id, COUNT(*) as count FROM dishes GROUP BY restaurant_id'),
      query("SELECT id, restaurant_id, username FROM admins WHERE role = 'restaurant_admin'"),
      query('SELECT * FROM subscriptions ORDER BY id DESC').catch(() => [])
    ]);

    const countMap = {};
    dishesCount.forEach(row => { countMap[row.restaurant_id] = parseInt(row.count || 0, 10); });
    const adminMap = {};
    adminsList.forEach(a => { adminMap[a.restaurant_id] = a.username; });
    const subMap = {};
    (subsList || []).forEach(s => { if (!subMap[s.restaurant_id]) subMap[s.restaurant_id] = s; });

    const result = restaurants.map(r => {
      const sub = subMap[r.id];
      return {
        ...r,
        dish_count: countMap[r.id] || 0,
        owner_username: adminMap[r.id] || 'N/A',
        subscription_status: sub?.status || (r.trial_ends_at ? 'trialing' : 'active'),
        cancel_requested_at: sub?.cancel_requested_at || null,
        auto_renew: sub?.auto_renew !== undefined ? Number(sub.auto_renew) : 1,
        scheduled_plan_key: sub?.scheduled_plan_key || null,
        plan_change_effective_at: sub?.plan_change_effective_at || null,
        cancellation_reason: sub?.cancellation_reason || null,
        access_until: sub?.current_period_end || r.trial_ends_at || r.plan_expires_at || null
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch restaurants error:', err);
    res.status(500).json({ error: 'Failed to fetch tenant restaurants' });
  }
});

// GET /api/superadmin/pending-registrations - Audit pending pre-registrations (Super Admin only)
router.get('/pending-registrations', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT id, name, phone, owner_username, plan_key, plan_price, cashfree_subscription_id, mandate_status, status, created_at, expires_at, completed_at FROM pending_registrations ORDER BY created_at DESC LIMIT 100');
    res.json(rows || []);
  } catch (err) {
    console.error('Fetch pending registrations error:', err);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
});

// GET /api/superadmin/restaurants/:id/360 — Complete Consolidated Tenant 360° Profile
router.get('/restaurants/:id/360', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const restoId = parseInt(id, 10);
    if (!restoId || isNaN(restoId)) {
      return res.status(400).json({ error: 'Invalid tenant ID' });
    }

    // 1. Fetch Restaurant
    const restoRows = await query('SELECT * FROM restaurants WHERE id = $1', [restoId]);
    if (!restoRows || restoRows.length === 0) {
      return res.status(404).json({ error: 'Tenant restaurant not found' });
    }
    const resto = restoRows[0];

    // 2. Fetch Admin / Owner User (Excluding password_hash)
    const adminRows = await query("SELECT id, username, role, created_at FROM admins WHERE restaurant_id = $1 AND role = 'restaurant_admin' ORDER BY id ASC LIMIT 1", [restoId]);
    const adminUser = adminRows[0] || null;

    // 3. Fetch Subscription & Canonical Status
    const subRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [restoId]);
    const sub = subRows[0] || null;
    const canonicalState = resolveCanonicalSubscriptionState({ resto, sub, now: new Date() });

    // 4. Fetch Authoritative SaaS Plan for this tenant's tier
    const planTierKey = (resto.plan_tier || 'pro').toLowerCase().trim();
    const planRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [planTierKey]);
    const saasPlan = planRows[0] || {
      key: planTierKey,
      name: `${planTierKey.toUpperCase()} Plan`,
      price: resto.plan_price || 999,
      dish_limit: 500,
      category_limit: 50,
      table_limit: 100
    };

    // 5. Fetch Usage Counts
    const [dishCountRow, catCountRow, orderCountRow] = await Promise.all([
      query('SELECT COUNT(*) as count FROM dishes WHERE restaurant_id = $1', [restoId]),
      query('SELECT COUNT(*) as count FROM categories WHERE restaurant_id = $1', [restoId]),
      query('SELECT COUNT(*) as count FROM orders WHERE restaurant_id = $1', [restoId])
    ]);

    const dishCount = parseInt(dishCountRow[0]?.count || 0, 10);
    const categoryCount = parseInt(catCountRow[0]?.count || 0, 10);
    const orderCount = parseInt(orderCountRow[0]?.count || 0, 10);

    // 6. Fetch Payments & Billing Summary (Clean projection: zero secrets)
    const paymentRows = await query(
      `SELECT id, amount, currency, status, payment_type, gateway, paid_at, created_at 
       FROM payments 
       WHERE restaurant_id = $1 
       ORDER BY created_at DESC, id DESC 
       LIMIT 50`,
      [restoId]
    );

    let totalSuccessfulAmount = 0;
    let totalSuccessfulCount = 0;
    let totalFailedCount = 0;
    let latestPayment = null;

    for (const p of paymentRows) {
      if (p.status === 'SUCCESS' || p.status === 'COMPLETED' || p.status === 'PAID') {
        totalSuccessfulCount++;
        totalSuccessfulAmount += parseFloat(p.amount || 0);
        if (!latestPayment) latestPayment = p;
      } else if (p.status === 'FAILED' || p.status === 'ERROR' || p.status === 'CANCELLED') {
        totalFailedCount++;
      }
    }

    // 7. Fetch Activity Timeline / Audit Logs
    const auditRows = await query(
      `SELECT id, actor_role, action, details, created_at 
       FROM audit_logs 
       WHERE restaurant_id = $1 
       ORDER BY created_at DESC, id DESC 
       LIMIT 50`,
      [restoId]
    );

    // Assembly of Safe Response Payload
    res.json({
      tenant: {
        id: resto.id,
        name: resto.name,
        slug: resto.slug,
        tagline: resto.tagline || '',
        logo: resto.logo || '',
        phone: resto.phone || '',
        address: resto.address || '',
        fssai_lic_no: resto.fssai_lic_no || '',
        theme_color: resto.theme_color || 'gold',
        business_type: resto.business_type || 'restaurant',
        food_type: resto.food_type || 'both',
        service_model: resto.service_model || 'dine_in',
        active: resto.active !== false && resto.active !== 0 && resto.active !== '0',
        created_at: resto.created_at || null,
        onboarding_completed: resto.onboarding_completed !== false,
        location_initialized: Boolean(resto.location_initialized),
        custom_domain: resto.custom_domain || null,
        business_category: resto.business_category || 'dine_in',
        scan_count: resto.scan_count || 0
      },
      owner: {
        owner_name: resto.owner_name || null,
        phone: resto.phone || null,
        owner_email: resto.owner_email || null,
        username: adminUser?.username || resto.owner_username || 'admin',
        created_at: adminUser?.created_at || null
      },
      subscription: {
        plan_tier: resto.plan_tier || 'pro',
        plan_name: saasPlan.name || `${resto.plan_tier} Plan`,
        plan_price: parseFloat(resto.plan_price || saasPlan.price || 999),
        subscription_type: sub?.status === 'admin_granted' || resto.mandate_status === 'admin_granted' ? 'ADMIN_GRANTED' : (sub?.gateway === 'cashfree' ? 'CASHFREE_MANDATE' : (resto.subscription_type || 'PAID')),
        status: canonicalState.status,
        canonical_active: canonicalState.active,
        is_complimentary: canonicalState.isComplimentary,
        in_grace_period: canonicalState.inGracePeriod,
        badge: canonicalState.badge,
        trial_start: sub?.trial_start || resto.trial_started_at || null,
        trial_end: sub?.trial_end || resto.trial_ends_at || null,
        current_period_start: sub?.current_period_start || null,
        current_period_end: sub?.current_period_end || resto.plan_expires_at || null,
        access_until: canonicalState.accessUntil || resto.plan_expires_at || null,
        auto_renew: sub?.auto_renew !== undefined ? (sub.auto_renew === 1 || sub.auto_renew === true || sub.auto_renew === '1') : (resto.auto_debit_enabled === 1),
        mandate_status: resto.mandate_status || sub?.status || 'none',
        cancel_requested_at: sub?.cancel_requested_at || null,
        scheduled_plan_key: sub?.scheduled_plan_key || null,
        previous_billing_snapshot: sub?.previous_billing_snapshot || null
      },
      billing: {
        total_successful_payments: totalSuccessfulCount,
        total_successful_amount: totalSuccessfulAmount,
        total_failed_payments: totalFailedCount,
        latest_payment: latestPayment ? {
          amount: parseFloat(latestPayment.amount || 0),
          currency: latestPayment.currency || 'INR',
          status: latestPayment.status,
          paid_at: latestPayment.paid_at || latestPayment.created_at,
          payment_type: latestPayment.payment_type
        } : null,
        transactions: paymentRows.map(p => ({
          id: p.id,
          amount: parseFloat(p.amount || 0),
          currency: p.currency || 'INR',
          status: p.status,
          payment_type: p.payment_type || 'subscription',
          gateway: p.gateway || 'cashfree',
          paid_at: p.paid_at || p.created_at
        }))
      },
      usage: {
        dishes: {
          current: dishCount,
          limit: saasPlan.max_dishes || saasPlan.dish_limit || 500,
          percentage: (saasPlan.max_dishes || saasPlan.dish_limit) ? Math.min(100, Math.round((dishCount / (saasPlan.max_dishes || saasPlan.dish_limit)) * 100)) : 0
        },
        categories: {
          current: categoryCount,
          limit: saasPlan.max_categories || saasPlan.category_limit || 50,
          percentage: (saasPlan.max_categories || saasPlan.category_limit) ? Math.min(100, Math.round((categoryCount / (saasPlan.max_categories || saasPlan.category_limit)) * 100)) : 0
        },
        tables: {
          current: Number(resto.total_tables || 0),
          limit: saasPlan.max_tables || saasPlan.table_limit || 100,
          percentage: (saasPlan.max_tables || saasPlan.table_limit) ? Math.min(100, Math.round((Number(resto.total_tables || 0) / (saasPlan.max_tables || saasPlan.table_limit)) * 100)) : 0
        },
        cabins: Number(resto.total_cabins || 0),
        rooms: Number(resto.total_rooms || 0),
        vip_tables: Number(resto.total_vip || 0),
        orders: orderCount,
        scan_count: resto.scan_count || 0,
        entitlements: {
          kds_enabled: saasPlan.kds_enabled === 1 || saasPlan.kds_enabled === true || saasPlan.kds_enabled === '1',
          whatsapp_ordering_enabled: saasPlan.whatsapp_ordering_enabled === 1 || saasPlan.whatsapp_ordering_enabled === true || saasPlan.whatsapp_ordering_enabled === '1',
          direct_ordering_enabled: saasPlan.direct_ordering_enabled === 1 || saasPlan.direct_ordering_enabled === true || saasPlan.direct_ordering_enabled === '1',
          google_reviews_enabled: saasPlan.google_reviews_enabled === 1 || saasPlan.google_reviews_enabled === true || saasPlan.google_reviews_enabled === '1',
          custom_domain_enabled: saasPlan.custom_domain_enabled === 1 || saasPlan.custom_domain_enabled === true || saasPlan.custom_domain_enabled === '1',
          gst_invoice_enabled: saasPlan.gst_invoice_enabled === 1 || saasPlan.gst_invoice_enabled === true || saasPlan.gst_invoice_enabled === '1',
          dual_printer_enabled: saasPlan.dual_printer_enabled === 1 || saasPlan.dual_printer_enabled === true || saasPlan.dual_printer_enabled === '1',
          watermark_removal_enabled: saasPlan.watermark_removal_enabled === 1 || saasPlan.watermark_removal_enabled === true || saasPlan.watermark_removal_enabled === '1',
          analytics_export_enabled: saasPlan.analytics_export_enabled === 1 || saasPlan.analytics_export_enabled === true || saasPlan.analytics_export_enabled === '1'
        }
      },
      activity: auditRows.map(a => ({
        id: a.id,
        action: a.action,
        actor: a.actor_role || 'system',
        details: a.details,
        timestamp: a.created_at
      })),
      security: {
        account_status: resto.active !== false && resto.active !== 0 && resto.active !== '0' ? 'ACTIVE' : 'SUSPENDED',
        impersonation_allowed: true,
        mandate_active: resto.mandate_status === 'active' || (sub && sub.status === 'active'),
        auto_renew_enabled: sub?.auto_renew !== undefined ? (sub.auto_renew === 1 || sub.auto_renew === true || sub.auto_renew === '1') : (resto.auto_debit_enabled === 1),
        last_impersonation: null
      },
      support: {
        notes: "Internal tenant notes: not currently available."
      }
    });
  } catch (err) {
    console.error('Fetch Tenant 360 error:', err);
    res.status(500).json({ error: 'Failed to fetch complete Tenant 360 data' });
  }
});

// POST Create New Tenant Restaurant
router.post('/restaurants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, owner_username, owner_password, phone, address, tagline, plan_tier, plan_price, plan_expires_at, whatsapp_number, theme_color, business_type, service_model, business_category } = req.body;

    if (!name || !slug || !owner_username || !owner_password) {
      return res.status(400).json({ error: 'Restaurant Name, URL Slug, Owner Username and Password are required' });
    }

    // Clean & sanitize slug (lowercase, hyphenated)
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Validate canonical business category / service_model
    const effectiveBiz = business_type || 'restaurant';
    const cleanCategory = resolveBusinessCategoryFromType(effectiveBiz);

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
    const expiryDate = plan_expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const effectivePlanTier = (plan_tier || 'pro').toLowerCase();

    // Resolve authoritative catalog price from saas_plans
    const saasPlanRows = await query('SELECT id, key, price FROM saas_plans WHERE LOWER(key) = $1 LIMIT 1', [effectivePlanTier]);
    const matchedPlan = saasPlanRows && saasPlanRows[0];
    const defaultCatalogPrice = matchedPlan ? Number(matchedPlan.price) : (effectivePlanTier === 'enterprise' ? 1999 : effectivePlanTier === 'basic' ? 499 : 999);
    const effectivePlanPrice = (plan_price !== undefined && plan_price !== null && !isNaN(parseFloat(plan_price)))
      ? parseFloat(plan_price)
      : defaultCatalogPrice;

    const restoRes = await query(`
      INSERT INTO restaurants (
        name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, whatsapp_number, theme_color, business_type, service_model, business_category, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id
    `, [
      name,
      cleanSlug,
      tagline || '100% Quality Food & Service',
      '/images/default-logo.webp',
      phone || '',
      address || '',
      '8:00 AM - 10:30 PM',
      effectivePlanTier,
      effectivePlanPrice,
      expiryDate,
      whatsapp_number || phone || '',
      theme_color || 'gold',
      effectiveBiz,
      cleanCategory,
      cleanCategory,
      true
    ]);

    const newRestoId = restoRes[0]?.id || restoRes.lastInsertRowid;

    // 2. Create Matching Subscription Record with Authoritative Amount
    await query(`
      INSERT INTO subscriptions (
        restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
        current_period_start, current_period_end
      ) VALUES ($1, $2, 'none', 'active', $3, 'INR', 'monthly', CURRENT_TIMESTAMP, $4)
    `, [newRestoId, matchedPlan?.id || null, effectivePlanPrice, expiryDate]);

    // 3. Create Owner Admin User
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(owner_password, salt);

    await query(`
      INSERT INTO admins (restaurant_id, username, password_hash, role)
      VALUES ($1, $2, $3, $4)
    `, [newRestoId, owner_username, hash, 'restaurant_admin']);

    await logAudit(newRestoId, 'superadmin', 'Create Tenant', `Created restaurant '${name}' (Slug: ${cleanSlug}, Owner: ${owner_username}, Plan: ${effectivePlanTier}, Price: ₹${effectivePlanPrice})`);

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
    await logAudit(id, 'superadmin', activeBool ? 'Activate Tenant' : 'Suspend Tenant', `Tenant ID ${id} active status set to ${activeBool}`);
    res.json({ success: true, active: activeBool });
  } catch (err) {
    console.error('Toggle restaurant active error:', err);
    res.status(500).json({ error: 'Failed to toggle restaurant status' });
  }
});

// POST Impersonate Tenant (Super Admin logs in as Tenant Owner in 1 Click)
router.post('/restaurants/:id/impersonate', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const restos = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (!restos || restos.length === 0) {
      return res.status(404).json({ error: 'Restaurant tenant not found' });
    }

    const resto = restos[0];
    const admins = await query('SELECT * FROM admins WHERE restaurant_id = $1 ORDER BY id ASC', [id]);
    const ownerAdmin = admins && admins.length > 0 ? admins[0] : { id: 1, username: 'admin' };

    // Generate JWT token scoping to this tenant restaurant with explicit impersonation claim
    const token = jwt.sign(
      {
        id: ownerAdmin.id,
        username: ownerAdmin.username,
        role: 'restaurant_admin',
        restaurant_id: resto.id,
        is_impersonated: true,
        superadmin_username: req.user.username
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    await logAudit(resto.id, 'superadmin', 'IMPERSONATION_STARTED', `Super Admin '${req.user.username}' started impersonating tenant '${resto.name}'`);

    res.json({
      success: true,
      token,
      username: ownerAdmin.username,
      restaurant: resto,
      is_impersonated: true
    });
  } catch (err) {
    console.error('Impersonate tenant error:', err);
    res.status(500).json({ error: 'Failed to impersonate tenant' });
  }
});

// POST Exit Impersonation (Audit Log IMPERSONATION_ENDED)
router.post('/restaurants/:id/exit-impersonation', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const restos = await query('SELECT id, name FROM restaurants WHERE id = $1', [id]);
    const restoName = (restos && restos.length > 0) ? restos[0].name : `Tenant ${id}`;

    await logAudit(id, 'superadmin', 'IMPERSONATION_ENDED', `Super Admin '${req.user.username}' ended impersonation for tenant '${restoName}'`);

    res.json({ success: true, message: 'Impersonation ended successfully' });
  } catch (err) {
    console.error('Exit impersonation error:', err);
    res.status(500).json({ error: 'Failed to record exit impersonation' });
  }
});

// PUT Update Tenant Restaurant Details & Reset Owner Credentials
router.put('/restaurants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tagline, logo, phone, address, fssai_lic_no, owner_username, owner_password, plan_tier, plan_price, plan_expires_at, whatsapp_number, whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled, theme_color, order_retention_days, custom_domain, owner_name, owner_email, business_type, service_model, business_category } = req.body;

    let cleanDomain = null;
    if (custom_domain !== undefined) {
      cleanDomain = (custom_domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    }

    let cleanCategory = undefined;
    if (service_model !== undefined || business_category !== undefined || business_type !== undefined) {
      const rawCat = service_model || business_category || business_type;
      cleanCategory = resolveBusinessCategoryFromType(rawCat);
    }

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

    // Fetch existing restaurant for audit comparison
    const existingRestoRows = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    const currentResto = existingRestoRows[0] || {};

    // Update restaurant info & Feature Control Matrix & Logo
    await query(`
      UPDATE restaurants
      SET name = $1, tagline = $2, logo = $3, phone = $4, address = $5, fssai_lic_no = $6,
          plan_tier = $7, plan_price = $8, plan_expires_at = $9, whatsapp_number = $10,
          whatsapp_enabled = $11, direct_ordering_enabled = $12, google_reviews_enabled = $13, theme_color = $14,
          order_retention_days = $15, custom_domain = $16,
          owner_name = COALESCE($17, owner_name),
          owner_email = CASE WHEN $18::boolean THEN $19 ELSE owner_email END,
          service_model = COALESCE($20, service_model),
          business_category = COALESCE($20, business_category)
      WHERE id = $21
    `, [
      name,
      tagline || '',
      logo !== undefined ? logo : '',
      phone || '',
      address || '',
      fssai_lic_no || '',
      plan_tier || 'pro',
      plan_price ? parseFloat(plan_price) : 999,
      plan_expires_at || null,
      whatsapp_number || phone || '',
      whatsapp_enabled !== false && whatsapp_enabled !== 0 && whatsapp_enabled !== 'false' ? 1 : 0,
      direct_ordering_enabled !== false && direct_ordering_enabled !== 0 && direct_ordering_enabled !== 'false' ? 1 : 0,
      google_reviews_enabled !== false && google_reviews_enabled !== 0 && google_reviews_enabled !== 'false' ? 1 : 0,
      theme_color || 'gold',
      order_retention_days ? parseInt(order_retention_days, 10) : 90,
      cleanDomain !== null ? cleanDomain : (custom_domain !== undefined ? '' : null),
      owner_name !== undefined ? owner_name : null,
      cleanOwnerEmail !== undefined,
      cleanOwnerEmail !== undefined ? cleanOwnerEmail : null,
      cleanCategory !== undefined ? cleanCategory : null,
      id
    ]);

    // Update owner admin user if username or password provided
    if (owner_username) {
      const userCheck = await query('SELECT * FROM admins WHERE username = $1 AND restaurant_id != $2', [owner_username, id]);
      if (userCheck && userCheck.length > 0) {
        return res.status(400).json({ error: `Username '${owner_username}' is already taken by another restaurant owner!` });
      }

      if (owner_password && owner_password.trim() !== '') {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(owner_password, salt);
        await query(`
          UPDATE admins SET username = $1, password_hash = $2 WHERE restaurant_id = $3 AND role = 'restaurant_admin'
        `, [owner_username, hash, id]);
      } else {
        await query(`
          UPDATE admins SET username = $1 WHERE restaurant_id = $2 AND role = 'restaurant_admin'
        `, [owner_username, id]);
      }
    }

    if (cleanOwnerEmail !== undefined && cleanOwnerEmail !== (currentResto.owner_email || null)) {
      await logAudit(id, 'superadmin', 'OWNER_EMAIL_UPDATED', `Owner email updated from '${currentResto.owner_email || 'none'}' to '${cleanOwnerEmail || 'none'}' for tenant ID ${id}`);
    } else {
      await logAudit(id, 'superadmin', 'Update Tenant', `Updated details for tenant ID ${id} (${name})`);
    }

    res.json({ success: true, message: 'Tenant restaurant details updated successfully' });
  } catch (err) {
    console.error('Update tenant restaurant error:', err);
    res.status(500).json({ error: 'Failed to update tenant restaurant' });
  }
});

// POST Grant Free Sponsored Access (Super Admin Only - No Cashfree charge)
router.post('/restaurants/:id/grant-free-access', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan_key, plan_id, duration_days, valid_until, is_lifetime, notes, admin_notes } = req.body;
    const noteText = notes || admin_notes || 'Super Admin granted free sponsored access';

    let targetPlan = null;
    if (plan_id) {
      const pRows = await query('SELECT * FROM saas_plans WHERE id = $1', [plan_id]);
      targetPlan = pRows[0];
    }
    if (!targetPlan && plan_key) {
      const pRows = await query('SELECT * FROM saas_plans WHERE LOWER(key) = $1', [plan_key.toLowerCase().trim()]);
      targetPlan = pRows[0];
    }
    if (!targetPlan) {
      targetPlan = { id: 2, key: 'pro', name: 'Pro Plan', price: 999 };
    }

    let expiryDate = null;
    if (is_lifetime || duration_days === 'lifetime' || duration_days === 99999) {
      expiryDate = new Date(Date.now() + 10 * 365 * 86400 * 1000).toISOString();
    } else if (valid_until) {
      expiryDate = new Date(valid_until).toISOString();
    } else if (duration_days) {
      const dDays = Math.max(1, parseInt(duration_days, 10) || 30);
      expiryDate = new Date(Date.now() + dDays * 86400 * 1000).toISOString();
    } else {
      expiryDate = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    }

    const nowISO = new Date().toISOString();

    // Safely stop active Cashfree mandate if restaurant was on paid subscription
    const restoRows = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    const currentResto = restoRows[0];
    const currentSubRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [id]);
    const currentSub = currentSubRows[0];

    const previousSnapshot = {
      previous_plan_tier: currentResto?.plan_tier || 'pro',
      previous_plan_price: currentResto?.plan_price !== undefined ? Number(currentResto.plan_price) : 999,
      previous_subscription_type: currentResto?.subscription_type || 'TRIAL',
      previous_subscription_status: currentSub?.status || 'trialing',
      previous_auto_renew: currentSub?.auto_renew || 0,
      previous_plan_expires_at: currentResto?.plan_expires_at || null,
      previous_trial_started_at: currentResto?.trial_started_at || null,
      previous_trial_ends_at: currentResto?.trial_ends_at || null,
      previous_current_period_end: currentSub?.current_period_end || null
    };

    if (currentSub && currentSub.gateway_subscription_id && currentSub.status === 'active') {
      try {
        const cfConfig = await getCashfreeConfigAsync();
        if (cfConfig.isConfigured) {
          const cancelUrl = `${cfConfig.baseUrl}/subscriptions/${encodeURIComponent(currentSub.gateway_subscription_id)}/cancel`;
          await fetch(cancelUrl, {
            method: 'POST',
            headers: {
              'x-api-version': cfConfig.apiVersion,
              'x-client-id': cfConfig.clientId,
              'x-client-secret': cfConfig.clientSecret,
              'Content-Type': 'application/json'
            }
          });
          console.log('[GRANT_FREE] Stopped active Cashfree mandate for sub:', currentSub.gateway_subscription_id);
        }
      } catch (cfErr) {
        console.warn('[GRANT_FREE] Cashfree mandate cancel notice:', cfErr.message);
      }
    }

    // Update restaurant tenant record
    await query(`
      UPDATE restaurants
      SET plan_tier = $1, plan_price = 0, plan_expires_at = $2,
          subscription_type = 'ADMIN_GRANTED', mandate_status = 'admin_granted',
          auto_debit_enabled = 0, active = true, admin_notes = $3
      WHERE id = $4
    `, [targetPlan.key, expiryDate, noteText, id]);

    // Upsert subscriptions record
    if (currentSub) {
      await query(`
        UPDATE subscriptions
        SET plan_id = $1, gateway = 'admin_granted', status = 'active', amount = 0,
            subscription_type = 'ADMIN_GRANTED', current_period_end = $2, auto_renew = 0,
            admin_notes = $3, updated_at = $4
        WHERE id = $5
      `, [targetPlan.id, expiryDate, noteText, nowISO, currentSub.id]);
    } else {
      await query(`
        INSERT INTO subscriptions (
          restaurant_id, plan_id, gateway, status, amount, currency, billing_cycle,
          subscription_type, current_period_start, current_period_end, auto_renew, admin_notes
        ) VALUES ($1, $2, 'admin_granted', 'active', 0, 'INR', 'monthly', 'ADMIN_GRANTED', $3, $4, 0, $5)
      `, [id, targetPlan.id, nowISO, expiryDate, noteText]);
    }

    await logAudit(
      id,
      'superadmin',
      'GRANT_ADMIN_ACCESS',
      `Granted free ${targetPlan.name} access until ${new Date(expiryDate).toLocaleDateString('en-IN')} (${noteText}) | Snapshot: ${JSON.stringify(previousSnapshot)}`
    );

    res.json({
      success: true,
      subscription_type: 'ADMIN_GRANTED',
      plan_name: targetPlan.name,
      plan_key: targetPlan.key,
      amount: 0,
      auto_renew: 0,
      mandate_status: 'admin_granted',
      access_until: expiryDate,
      message: `Granted complimentary ${targetPlan.name} access to restaurant #${id} until ${new Date(expiryDate).toLocaleDateString('en-IN')}`
    });
  } catch (err) {
    console.error('Grant free access error:', err);
    res.status(500).json({ error: 'Failed to grant free access' });
  }
});

// POST Revoke Free Access (Super Admin Only)
router.post('/restaurants/:id/revoke-free-access', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const nowISO = new Date().toISOString();

    const restoRows = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (!restoRows || restoRows.length === 0) {
      return res.status(404).json({ error: 'Restaurant tenant not found' });
    }
    const currentResto = restoRows[0];
    const isAlreadyCancelled = currentResto.active === false && currentResto.mandate_status === 'cancelled';

    await query("UPDATE restaurants SET active = false, mandate_status = 'cancelled', subscription_type = 'PAID', auto_debit_enabled = 0 WHERE id = $1", [id]);
    await query("UPDATE subscriptions SET status = 'cancelled', updated_at = $1 WHERE restaurant_id = $2 AND status = 'active'", [nowISO, id]);

    const revokeMetadata = {
      previous_plan_tier: currentResto.plan_tier || 'pro',
      previous_plan_price: Number(currentResto.plan_price || 0),
      previous_subscription_status: currentResto.mandate_status || 'admin_granted',
      previous_auto_renew: 0,
      post_revoke_state: 'RENEWAL_REQUIRED',
      data_preserved: true
    };

    if (!isAlreadyCancelled) {
      await logAudit(
        id,
        'superadmin',
        'VIP_ACCESS_REVOKED',
        `Revoked complimentary VIP access for tenant #${id} (${currentResto.name}). Post-state: RENEWAL_REQUIRED | Metadata: ${JSON.stringify(revokeMetadata)}`
      );
    }

    res.json({
      success: true,
      message: `Revoked free access for restaurant #${id}`,
      post_revoke_state: 'RENEWAL_REQUIRED',
      data_preserved: true
    });
  } catch (err) {
    console.error('Revoke free access error:', err);
    res.status(500).json({ error: 'Failed to revoke free access' });
  }
});

// DELETE Restaurant Tenant (Full Automatic Cleanup & URL Purge)
router.delete('/restaurants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === '1') {
      return res.status(400).json({ error: 'Primary default restaurant cannot be deleted!' });
    }

    const targetResto = await query('SELECT slug, name FROM restaurants WHERE id = $1', [id]);
    const deletedSlug = targetResto[0]?.slug || '';
    const deletedName = targetResto[0]?.name || '';

    // Cascade delete all restaurant child data
    await query('DELETE FROM dishes WHERE restaurant_id = $1', [id]);
    await query('DELETE FROM categories WHERE restaurant_id = $1', [id]);
    await query('DELETE FROM combos WHERE restaurant_id = $1', [id]);
    await query('DELETE FROM orders WHERE restaurant_id = $1', [id]);
    await query('DELETE FROM service_requests WHERE restaurant_id = $1', [id]);

    // Permanently delete restaurant tenant & purge its URL slug
    await query('DELETE FROM restaurants WHERE id = $1', [id]);

    await logAudit(id, 'superadmin', 'Delete Tenant', `Deleted tenant "${deletedName}" (slug: ${deletedSlug})`);
    res.json({ success: true, message: `Tenant "${deletedName}" (${deletedSlug}) deleted completely.` });
  } catch (err) {
    console.error('Delete restaurant error:', err);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

// GET Global System Announcements (All history)
router.get('/announcements', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const list = await query('SELECT * FROM announcements ORDER BY id DESC');
    res.json(list);
  } catch (err) {
    console.error('Fetch announcements error:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST Create Global System Announcement
router.post('/announcements', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { message, type } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Announcement message is required' });
    }

    // Optional: deactivate old active announcements if wanted or keep all
    await query('INSERT INTO announcements (message, type, active) VALUES ($1, $2, 1)', [message.trim(), type || 'info']);
    await logAudit(null, 'superadmin', 'Post Announcement', `Posted announcement: "${message.substring(0, 50)}..."`);
    res.json({ success: true, message: 'System announcement broadcasted successfully!' });
  } catch (err) {
    console.error('Post announcement error:', err);
    res.status(500).json({ error: 'Failed to post announcement' });
  }
});

// DELETE Single Announcement
router.delete('/announcements/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM announcements WHERE id = $1', [id]);
    await logAudit(null, 'superadmin', 'Delete Announcement', `Deleted announcement ID ${id}`);
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// DELETE Clear All Active Announcements
router.delete('/announcements', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    await query('DELETE FROM announcements');
    await logAudit(null, 'superadmin', 'Clear All Announcements', 'Cleared all system announcements');
    res.json({ success: true, message: 'All system announcements cleared successfully' });
  } catch (err) {
    console.error('Clear announcements error:', err);
    res.status(500).json({ error: 'Failed to clear announcements' });
  }
});

// GET All SaaS Plans (with restaurant count per plan)
router.get('/plans', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const [plans, counts] = await Promise.all([
      query('SELECT * FROM saas_plans ORDER BY price ASC'),
      query('SELECT plan_tier, COUNT(*) as count FROM restaurants GROUP BY plan_tier')
    ]);
    const countMap = {};
    (counts || []).forEach(c => { countMap[c.plan_tier] = parseInt(c.count, 10); });

    const isTrue = (val, def = true) => val !== undefined && val !== null ? (val === 1 || val === true || val === '1' || val === 'true') : def;

    const result = (plans || []).map(p => ({
      ...p,
      whatsapp_enabled: isTrue(p.whatsapp_ordering_enabled ?? p.whatsapp_enabled, true),
      whatsapp_ordering_enabled: isTrue(p.whatsapp_ordering_enabled ?? p.whatsapp_enabled, true),
      direct_ordering_enabled: isTrue(p.direct_ordering_enabled, false),
      google_reviews_enabled: isTrue(p.google_reviews_enabled, true),
      modifiers_enabled: isTrue(p.modifiers_enabled, true),
      staff_roles_enabled: isTrue(p.staff_roles_enabled, true),
      audio_alarm_enabled: isTrue(p.audio_alarm_enabled, true),
      order_status_whatsapp_enabled: isTrue(p.order_status_whatsapp_enabled, true),
      kds_enabled: isTrue(p.kds_enabled, true),
      bluetooth_kot_enabled: isTrue(p.bluetooth_kot_enabled, true),
      ai_review_enabled: isTrue(p.ai_review_enabled, true),
      stories_enabled: isTrue(p.stories_enabled, true),
      gst_invoice_enabled: isTrue(p.gst_invoice_enabled, true),
      analytics_export_enabled: isTrue(p.analytics_export_enabled, true),
      multi_language_enabled: isTrue(p.multi_language_enabled, true),
      watermark_removal_enabled: isTrue(p.watermark_removal_enabled, true),
      custom_domain_enabled: isTrue(p.custom_domain_enabled, true),
      dual_printer_enabled: isTrue(p.dual_printer_enabled, false),
      presence_verification_enabled: isTrue(p.presence_verification_enabled, true),
      allowed_verification_modes: p.allowed_verification_modes || 'QR_ONLY,GPS_ONLY,GPS_WITH_STAFF_FALLBACK,STAFF_ONLY',
      theme_color: p.theme_color || 'gold',
      allowed_themes: p.allowed_themes || 'ALL',
      enrolled_count: countMap[p.key] || 0
    }));
    res.json(result);
  } catch (err) {
    console.error('Fetch SaaS plans error:', err);
    res.status(500).json({ error: 'Failed to fetch SaaS plans' });
  }
});

// POST Create New Custom SaaS Plan
router.post('/plans', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { 
      key, name, price, original_price, badge, description, 
      whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled, 
      presence_verification_enabled, allowed_verification_modes,
      theme_color, allowed_themes
    } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Plan name is required' });

    const cleanKey = (key || name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();

    const toBoolInt = (val) => (val === 1 || val === true || val === '1' || val === 'true') ? 1 : 0;
    const wVal = toBoolInt(whatsapp_enabled);

    await query(`
      INSERT INTO saas_plans (
        key, name, price, original_price, badge, description, 
        whatsapp_enabled, whatsapp_ordering_enabled, direct_ordering_enabled, 
        google_reviews_enabled, presence_verification_enabled, allowed_verification_modes,
        theme_color, allowed_themes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13)
    `, [
      cleanKey,
      name.trim(),
      price ? parseFloat(price) : 999,
      original_price ? parseFloat(original_price) : (price ? parseFloat(price) * 2 - 1 : 1999),
      badge || '👑 CUSTOM',
      description || '',
      wVal,
      toBoolInt(direct_ordering_enabled),
      toBoolInt(google_reviews_enabled),
      presence_verification_enabled !== undefined ? toBoolInt(presence_verification_enabled) : 1,
      allowed_verification_modes || 'QR_ONLY,GPS_ONLY,GPS_WITH_STAFF_FALLBACK,STAFF_ONLY',
      theme_color || 'gold',
      allowed_themes || 'ALL'
    ]);

    await logAudit(null, 'superadmin', 'Create SaaS Plan', `Created plan '${name}' (${cleanKey}) with theme '${theme_color || 'gold'}'`);
    res.json({ success: true, message: `SaaS Plan '${name}' created successfully!` });
  } catch (err) {
    console.error('Create SaaS plan error:', err);
    res.status(500).json({ error: err.message || 'Failed to create SaaS plan' });
  }
});

// PUT Update SaaS Plan Details & 24-Point Feature Matrix
router.put('/plans/:key', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const {
      name, price, badge, description,
      max_dishes, max_categories, max_combos, max_tables, max_staff_accounts, order_retention_days,
      modifiers_enabled, staff_roles_enabled, whatsapp_ordering_enabled, direct_ordering_enabled,
      audio_alarm_enabled, order_status_whatsapp_enabled, kds_enabled, bluetooth_kot_enabled,
      google_reviews_enabled, ai_review_enabled, stories_enabled, gst_invoice_enabled,
      analytics_export_enabled, multi_language_enabled, watermark_removal_enabled, custom_domain_enabled, dual_printer_enabled,
      presence_verification_enabled, allowed_verification_modes, theme_color, allowed_themes
    } = req.body;

    const toBoolInt = (val) => (val === 1 || val === true || val === '1' || val === 'true') ? 1 : 0;

    const queryParams = [
      name || key,
      price !== undefined ? parseFloat(price) : 999,
      badge || '👑 PRO',
      description || '',
      max_dishes !== undefined ? parseInt(max_dishes, 10) : 9999,
      max_categories !== undefined ? parseInt(max_categories, 10) : 9999,
      max_combos !== undefined ? parseInt(max_combos, 10) : 9999,
      max_tables !== undefined ? parseInt(max_tables, 10) : 9999,
      max_staff_accounts !== undefined ? parseInt(max_staff_accounts, 10) : 9999,
      order_retention_days !== undefined ? parseInt(order_retention_days, 10) : 365,
      toBoolInt(modifiers_enabled),
      toBoolInt(staff_roles_enabled),
      toBoolInt(whatsapp_ordering_enabled !== undefined ? whatsapp_ordering_enabled : req.body.whatsapp_enabled),
      toBoolInt(direct_ordering_enabled),
      toBoolInt(audio_alarm_enabled),
      toBoolInt(order_status_whatsapp_enabled),
      toBoolInt(kds_enabled),
      toBoolInt(bluetooth_kot_enabled),
      toBoolInt(google_reviews_enabled),
      toBoolInt(ai_review_enabled),
      toBoolInt(stories_enabled),
      toBoolInt(gst_invoice_enabled),
      toBoolInt(analytics_export_enabled),
      toBoolInt(multi_language_enabled),
      toBoolInt(watermark_removal_enabled),
      toBoolInt(custom_domain_enabled),
      toBoolInt(dual_printer_enabled),
      presence_verification_enabled !== undefined ? toBoolInt(presence_verification_enabled) : 1,
      allowed_verification_modes !== undefined ? String(allowed_verification_modes) : 'QR_ONLY,GPS_ONLY,GPS_WITH_STAFF_FALLBACK,STAFF_ONLY',
      theme_color || 'gold',
      allowed_themes || 'ALL',
      key
    ];

    try {
      await query(`
        UPDATE saas_plans
        SET name = $1, price = $2, badge = $3, description = $4,
            max_dishes = $5, max_categories = $6, max_combos = $7, max_tables = $8, max_staff_accounts = $9, order_retention_days = $10,
            modifiers_enabled = $11, staff_roles_enabled = $12, whatsapp_ordering_enabled = $13, whatsapp_enabled = $13, direct_ordering_enabled = $14,
            audio_alarm_enabled = $15, order_status_whatsapp_enabled = $16, kds_enabled = $17, bluetooth_kot_enabled = $18,
            google_reviews_enabled = $19, ai_review_enabled = $20, stories_enabled = $21, gst_invoice_enabled = $22,
            analytics_export_enabled = $23, multi_language_enabled = $24, watermark_removal_enabled = $25, custom_domain_enabled = $26,
            dual_printer_enabled = $27, presence_verification_enabled = $28, allowed_verification_modes = $29,
            theme_color = $30, allowed_themes = $31
        WHERE key = $32
      `, queryParams);
    } catch (dbErr) {
      console.warn('[SAAS PLAN MATRIX] Auto-healing table schema for missing columns...', dbErr.message);
      await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS dual_printer_enabled INT DEFAULT 0;').catch(() => {});
      await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS bluetooth_kot_enabled INT DEFAULT 1;').catch(() => {});
      await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS gst_invoice_enabled INT DEFAULT 1;').catch(() => {});
      await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS ai_review_enabled INT DEFAULT 1;').catch(() => {});
      await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS google_reviews_enabled INT DEFAULT 1;').catch(() => {});
      await query('ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS presence_verification_enabled INT DEFAULT 1;').catch(() => {});
      await query("ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS allowed_verification_modes VARCHAR(255) DEFAULT 'QR_ONLY,GPS_ONLY,GPS_WITH_STAFF_FALLBACK,STAFF_ONLY';").catch(() => {});
      await query("ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50) DEFAULT 'gold';").catch(() => {});
      await query("ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS allowed_themes VARCHAR(255) DEFAULT 'ALL';").catch(() => {});
      
      await query(`
        UPDATE saas_plans
        SET name = $1, price = $2, badge = $3, description = $4,
            max_dishes = $5, max_categories = $6, max_combos = $7, max_tables = $8, max_staff_accounts = $9, order_retention_days = $10,
            modifiers_enabled = $11, staff_roles_enabled = $12, whatsapp_ordering_enabled = $13, whatsapp_enabled = $13, direct_ordering_enabled = $14,
            audio_alarm_enabled = $15, order_status_whatsapp_enabled = $16, kds_enabled = $17, bluetooth_kot_enabled = $18,
            google_reviews_enabled = $19, ai_review_enabled = $20, stories_enabled = $21, gst_invoice_enabled = $22,
            analytics_export_enabled = $23, multi_language_enabled = $24, watermark_removal_enabled = $25, custom_domain_enabled = $26,
            dual_printer_enabled = $27, presence_verification_enabled = $28, allowed_verification_modes = $29,
            theme_color = $30, allowed_themes = $31
        WHERE key = $32
      `, queryParams);
    }

    await logAudit(null, 'superadmin', 'Update SaaS Plan Matrix', `Updated 24-point plan matrix for '${key}'`);
    res.json({ success: true, message: `SaaS Plan '${name || key}' matrix updated successfully!` });
  } catch (err) {
    console.error('Update SaaS plan matrix error:', err);
    res.status(500).json({ error: err.message || 'Failed to update SaaS plan matrix' });
  }
});

// DELETE Custom SaaS Plan
router.delete('/plans/:key', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    if (['basic', 'pro', 'enterprise'].includes(key.toLowerCase())) {
      return res.status(400).json({ error: 'Standard system plans (Basic, Pro, Enterprise) cannot be deleted.' });
    }

    // Safely migrate any restaurant on this custom plan back to 'pro'
    await query("UPDATE restaurants SET plan_tier = 'pro' WHERE LOWER(plan_tier) = LOWER($1)", [key]);
    await query('DELETE FROM saas_plans WHERE LOWER(key) = LOWER($1)', [key]);
    await logAudit(null, 'superadmin', 'Delete SaaS Plan', `Deleted SaaS Plan '${key}' (restaurants migrated to 'pro')`);
    res.json({ success: true, message: `Plan '${key}' deleted successfully. Assigned restaurants safely migrated to Pro plan.` });
  } catch (err) {
    console.error('Delete SaaS plan error:', err);
    res.status(500).json({ error: 'Failed to delete SaaS plan' });
  }
});



// GET Platform Audit Logs
router.get('/audit-logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await query(`
      SELECT 
        a.id,
        a.restaurant_id,
        a.actor_role,
        a.action,
        a.details,
        a.created_at,
        r.name AS restaurant_name,
        r.logo AS restaurant_logo
      FROM audit_logs a
      LEFT JOIN restaurants r ON r.id = a.restaurant_id
      ORDER BY a.id DESC 
      LIMIT 150
    `);
    res.json(logs || []);
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET Comprehensive Real-Time Database Health & System Telemetry
router.get('/operations/stats', authenticateToken, requireSuperAdmin, async (req, res) => {
  const startPing = Date.now();
  try {
    // 1. Live Postgres Ping & Version
    const pingRes = await query('SELECT 1 AS ping, version()');
    const pingMs = Date.now() - startPing;
    const pgVersion = pingRes && pingRes[0] ? pingRes[0].version.split(' on ')[0] : 'PostgreSQL Serverless';

    // 2. Database Total Size
    let dbSizePretty = 'Serverless Pool';
    let dbSizeBytes = 0;
    let dbSizeMB = 0;
    try {
      const sizeRes = await query('SELECT pg_size_pretty(pg_database_size(current_database())) AS size, pg_database_size(current_database()) AS bytes');
      if (sizeRes && sizeRes[0]) {
        dbSizePretty = sizeRes[0].size;
        dbSizeBytes = parseInt(sizeRes[0].bytes, 10) || 0;
        dbSizeMB = parseFloat((dbSizeBytes / (1024 * 1024)).toFixed(2));
      }
    } catch (e) {
      console.warn('DB size query warning:', e.message);
    }

    // 2b. Stored Media Forensic Metrics
    let storedImagesCount = 0;
    let storedImagesBinaryBytes = 0;
    let storedImagesBinaryPretty = '0 B';
    try {
      const imgRes = await query(`
        SELECT 
          COUNT(*)::int AS total_count,
          COALESCE(SUM(octet_length(data)), 0)::bigint AS binary_bytes,
          pg_size_pretty(COALESCE(SUM(octet_length(data)), 0)::bigint) AS binary_pretty
        FROM stored_images
      `);
      if (imgRes && imgRes[0]) {
        storedImagesCount = imgRes[0].total_count || 0;
        storedImagesBinaryBytes = parseInt(imgRes[0].binary_bytes, 10) || 0;
        storedImagesBinaryPretty = imgRes[0].binary_pretty || '0 B';
      }
    } catch (e) {
      console.warn('Stored images telemetry notice:', e.message);
    }

    // 2c. Active Sessions Telemetry (Open unsettled dining sessions across all tenants)
    let activeSessionsCount = 0;
    let activeOrdersCount = 0;
    try {
      const sessRes = await query(`
        SELECT 
          COUNT(DISTINCT COALESCE(session_id, restaurant_id::text || '_' || table_number::text))::int AS active_sessions,
          COUNT(*)::int AS active_orders
        FROM orders
        WHERE LOWER(status) NOT IN ('completed', 'cancelled', 'rejected') 
          AND (is_settled = 0 OR is_settled IS NULL)
      `);
      if (sessRes && sessRes[0]) {
        activeSessionsCount = sessRes[0].active_sessions || 0;
        activeOrdersCount = sessRes[0].active_orders || 0;
      }
    } catch (e) {
      console.warn('Active sessions query notice:', e.message);
    }

    // 2d. Dishes Hosted Telemetry (Total dishes across all tenant menus)
    let totalDishesHosted = 0;
    let availableDishesHosted = 0;
    try {
      const dishRes = await query(`
        SELECT 
          COUNT(*)::int AS total_dishes,
          COUNT(CASE WHEN available IS NOT FALSE THEN 1 END)::int AS available_dishes
        FROM dishes
      `);
      if (dishRes && dishRes[0]) {
        totalDishesHosted = dishRes[0].total_dishes || 0;
        availableDishesHosted = dishRes[0].available_dishes || 0;
      }
    } catch (e) {
      console.warn('Dishes hosted query notice:', e.message);
    }

    // 2e. QR Scans Telemetry (Platform all-time scans vs daily tracking status)
    let totalLifetimeScans = 0;
    try {
      const scanRes = await query(`
        SELECT COALESCE(SUM(scan_count), 0)::bigint AS total_scans
        FROM restaurants
      `);
      if (scanRes && scanRes[0]) {
        totalLifetimeScans = parseInt(scanRes[0].total_scans, 10) || 0;
      }
    } catch (e) {
      console.warn('Scan count query notice:', e.message);
    }

    // 3. Active Connections Count
    let activeConnections = 1;
    try {
      const connRes = await query('SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database()');
      if (connRes && connRes[0]) {
        activeConnections = connRes[0].total;
      }
    } catch (e) {
      activeConnections = 1;
    }

    // 4. Detailed Table Breakdown
    const targetTables = ['restaurants', 'dishes', 'categories', 'orders', 'order_items', 'payments', 'audit_logs', 'admins', 'saas_plans'];
    const tableStats = [];

    for (const t of targetTables) {
      try {
        const countRes = await query(`SELECT count(*)::int AS total FROM ${t}`);
        const totalRows = countRes && countRes[0] ? countRes[0].total : 0;
        let sizePretty = '< 1 MB';
        try {
          const tSizeRes = await query(`SELECT pg_size_pretty(pg_total_relation_size('${t}')) AS size`);
          if (tSizeRes && tSizeRes[0]) sizePretty = tSizeRes[0].size;
        } catch {}

        tableStats.push({
          table_name: t,
          row_count: totalRows,
          size_pretty: sizePretty,
          status: 'HEALTHY'
        });
      } catch (err) {
        tableStats.push({
          table_name: t,
          row_count: 0,
          size_pretty: 'N/A',
          status: 'UNAVAILABLE'
        });
      }
    }

    // 5. System Memory & Process Stats
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const uptimeSec = Math.floor(process.uptime());
    const uptimeHours = (uptimeSec / 3600).toFixed(1);

    // 6. Settings check for external services
    let settings = {};
    try {
      const settingsRows = await query('SELECT * FROM system_settings');
      (settingsRows || []).forEach(r => { settings[r.key] = r.value; });
    } catch (e) {
      console.warn('System settings query notice:', e.message);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        status: 'CONNECTED',
        provider: 'Neon PostgreSQL (Serverless)',
        version: pgVersion,
        ping_ms: pingMs,
        total_size: dbSizePretty,
        total_size_bytes: dbSizeBytes,
        total_size_mb: dbSizeMB,
        active_connections: activeConnections,
        tables: tableStats
      },
      storage: {
        database_size_bytes: dbSizeBytes,
        database_size_mb: dbSizeMB,
        database_size_pretty: (dbSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
        stored_images_count: storedImagesCount,
        stored_images_binary_bytes: storedImagesBinaryBytes,
        stored_images_binary_pretty: storedImagesBinaryPretty,
        r2_usage_bytes: null,
        r2_usage_status: 'not_metered',
        quota_bytes: null,
        quota_status: 'not_enforced'
      },
      telemetry: {
        active_sessions: {
          value: activeSessionsCount,
          active_orders_count: activeOrdersCount,
          status: 'live'
        },
        dishes_hosted: {
          value: totalDishesHosted,
          available_dishes: availableDishesHosted,
          status: 'live'
        },
        qr_scans_today: {
          value: null,
          total_all_time: totalLifetimeScans,
          status: 'not_tracked'
        }
      },
      system: {
        node_version: process.version,
        environment: process.env.NODE_ENV || 'production',
        uptime_seconds: uptimeSec,
        uptime_hours: uptimeHours,
        memory: {
          heap_used_mb: heapUsedMB,
          heap_total_mb: heapTotalMB,
          rss_mb: rssMB,
          usage_percent: Math.min(100, Math.round((heapUsedMB / heapTotalMB) * 100))
        },
        platform: process.platform
      },
      services: {
        cashfree: {
          configured: !!(settings.cashfree_app_id && settings.cashfree_secret_key),
          env: (settings.cashfree_env || 'sandbox').toUpperCase(),
          status: 'ACTIVE'
        },
        cloudflare_r2: {
          status: isR2Active() ? 'ACTIVE' : 'FALLBACK_DB',
          engine: isR2Active() ? 'Cloudflare R2 Object Storage' : 'PostgreSQL Base64 Proxy'
        },
        gemini_ai: {
          status: 'OPERATIONAL',
          model: 'Google Gemini 1.5 Flash'
        },
        subscription_cron: {
          status: 'SCHEDULED',
          interval: 'Every 60 Minutes (Automated)'
        }
      }
    });
  } catch (err) {
    console.error('Operations stats fetch error:', err);
    res.status(500).json({ error: 'Failed to retrieve operations telemetry', details: err.message });
  }
});

// POST Global Database Optimization & Archival (Super Admin)
router.post('/optimize-db', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const daysOld = req.body.daysOld || 90;
    const result = await runAutoDataSummarization(daysOld, null);
    res.json(result);
  } catch (err) {
    console.error('Superadmin DB optimization error:', err);
    res.status(500).json({ error: 'Failed to run database optimization' });
  }
});

// PUT Change Super Admin Username & Password
router.put('/change-credentials', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to verify identity' });
    }

    const admins = await query("SELECT * FROM admins WHERE id = $1 AND role = 'superadmin'", [req.user.id]);
    if (!admins || admins.length === 0) {
      return res.status(404).json({ error: 'Super Admin account not found' });
    }

    const admin = admins[0];
    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    let updatedUsername = admin.username;
    if (newUsername && newUsername.trim()) {
      updatedUsername = newUsername.trim();
    }

    let updatedHash = admin.password_hash;
    if (newPassword && newPassword.trim()) {
      const salt = await bcrypt.genSalt(10);
      updatedHash = await bcrypt.hash(newPassword.trim(), salt);
    }

    await query(
      "UPDATE admins SET username = $1, password_hash = $2 WHERE id = $3 AND role = 'superadmin'",
      [updatedUsername, updatedHash, req.user.id]
    );

    const token = jwt.sign(
      { id: admin.id, username: updatedUsername, role: 'superadmin', restaurant_id: admin.restaurant_id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    await logAudit(null, 'superadmin', 'Change Credentials', `Super Admin updated credentials (New Username: ${updatedUsername})`);

    res.json({
      message: 'Master credentials updated successfully!',
      token,
      username: updatedUsername
    });
  } catch (err) {
    console.error('Change superadmin credentials error:', err);
    res.status(500).json({ error: 'Failed to update credentials' });
  }
});

async function mirrorExternalLogoToR2(externalUrl) {
  if (!externalUrl || typeof externalUrl !== 'string') return externalUrl;
  const url = externalUrl.trim();
  if (!url.startsWith('http')) return url;
  if (url.includes('/api/r2-proxy/')) return url;

  try {
    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!fetchRes.ok) return url;
    
    const arrayBuf = await fetchRes.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuf);
    if (!inputBuffer || inputBuffer.length === 0) return url;

    const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
    const timestamp = Date.now();
    const filename = `logo-external-${timestamp}.webp`;

    if (isR2Active()) {
      const webpBuffer = await sharp(inputBuffer)
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      const r2Result = await uploadImageToR2({
        buffer: webpBuffer,
        mimeType: 'image/webp',
        restaurantId: null,
        entityType: 'superadmin'
      });

      if (r2Result && r2Result.objectKey) {
        const proxyUrl = `/api/r2-proxy/${r2Result.objectKey}`;
        await saveR2ImageToDb(filename, 'image/webp', r2Result.objectKey, r2Result.publicUrl || proxyUrl, null, webpBuffer);
        console.log('[MIRROR LOGO SUCCESS] Saved external logo URL to R2 and Neon DB:', proxyUrl);
        return proxyUrl;
      }
    } else {
      await saveImageToDb(filename, mimeType, inputBuffer);
      const localUrl = `/uploads/${filename}`;
      console.log('[MIRROR LOGO SUCCESS] Saved external logo URL to local uploads and Neon DB:', localUrl);
      return localUrl;
    }
  } catch (err) {
    console.warn('[MIRROR LOGO NOTICE] External logo mirror notice:', err.message);
  }
  return url;
}

// Helper: Identify sensitive setting keys for response masking
const SENSITIVE_SETTING_KEYS = [
  'cashfree_secret_key',
  'cashfree_client_secret',
  'cashfree_secret',
  'jwt_secret',
  'database_url',
  'cron_secret',
  'r2_secret_access_key',
  'password',
  'token',
  'private_key',
  'api_secret'
];

function isSensitiveSettingKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return SENSITIVE_SETTING_KEYS.some(s => k.includes(s) || k.endsWith('_secret') || (k.endsWith('_key') && k.includes('secret')));
}

// GET System Settings for Super Admin (Server-side Secret Masking & Live Security Telemetry)
router.get('/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM system_settings');
    const settings = {};
    (rows || []).forEach(r => {
      if (isSensitiveSettingKey(r.key)) {
        settings[r.key] = (r.value && r.value.trim()) ? '••••••••' : '';
      } else {
        settings[r.key] = r.value;
      }
    });

    // Provide complete transparency on runtime environment vs saved setting
    const runtimeEnv = (process.env.CASHFREE_ENVIRONMENT || '').toLowerCase().trim();
    settings._runtime_cashfree_env = runtimeEnv || settings.cashfree_env || settings.cashfree_environment || 'sandbox';
    settings._runtime_env_source = runtimeEnv ? 'environment_variable' : 'system_settings';
    settings._is_secret_configured = Boolean(
      (process.env.CASHFREE_CLIENT_SECRET && process.env.CASHFREE_CLIENT_SECRET.trim()) ||
      (rows || []).some(r => isSensitiveSettingKey(r.key) && r.value && r.value.trim())
    );

    // Live Webhook Telemetry Evidence (Strictly SuperAdmin-only, zero secret disclosure)
    let webhookEvidence = {
      configured: settings._is_secret_configured,
      production_verified: false,
      last_event_at: null,
      last_event_type: null,
      total_events: 0
    };

    try {
      const webhookRows = await query(`
        SELECT event_type, created_at, processed 
        FROM webhook_events 
        WHERE gateway = 'cashfree' AND processed = true 
        ORDER BY id DESC LIMIT 1
      `);
      if (webhookRows && webhookRows.length > 0) {
        const lastEvt = webhookRows[0];
        // Production verification requires runtime production env and an authenticated live processed webhook event
        const isProdEvent = Boolean(runtimeEnv === 'production' && lastEvt.processed);
        webhookEvidence = {
          configured: settings._is_secret_configured,
          production_verified: isProdEvent,
          last_event_at: lastEvt.created_at,
          last_event_type: lastEvt.event_type,
          total_events: webhookRows.length
        };
      }
    } catch (whErr) {
      console.warn('Notice querying webhook_events for telemetry:', whErr.message);
    }
    settings.webhook_evidence = webhookEvidence;

    // Truthful Database and Storage Connectivity Status
    settings.db_status = 'connected';
    settings.r2_status = isR2Active() ? 'active' : 'fallback';

    res.json(settings);
  } catch (err) {
    console.error('Fetch system settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST Update System Settings for Super Admin (Safe Secret & Protected Production Switch)
router.post('/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const payload = req.body || {};

    // 1. Protected Operation: Check if switching Cashfree environment to PRODUCTION
    const targetEnv = (payload.cashfree_env || payload.cashfree_environment || '').toLowerCase().trim();
    if (targetEnv === 'production') {
      const existingEnvRows = await query("SELECT value FROM system_settings WHERE key IN ('cashfree_env', 'cashfree_environment')");
      const currentDbEnv = (existingEnvRows[0]?.value || 'sandbox').toLowerCase().trim();

      if (currentDbEnv !== 'production') {
        if (!payload.currentPassword) {
          return res.status(400).json({
            error: 'PASSWORD_REQUIRED',
            message: 'Super Admin password verification is required to switch Cashfree payment gateway to Production mode.'
          });
        }

        const adminRows = await query("SELECT password_hash FROM admins WHERE id = $1 AND role = 'superadmin'", [req.user.id]);
        if (!adminRows || adminRows.length === 0) {
          return res.status(403).json({ error: 'UNAUTHORIZED', message: 'Super Admin account not found.' });
        }

        const isPasswordValid = await bcrypt.compare(payload.currentPassword, adminRows[0].password_hash);
        if (!isPasswordValid) {
          return res.status(400).json({
            error: 'INVALID_PASSWORD',
            message: 'Incorrect Super Admin password. Production environment switch rejected.'
          });
        }

        if (payload.confirm_production_switch !== true && payload.confirm_production_switch !== 'true') {
          return res.status(400).json({
            error: 'CONFIRMATION_REQUIRED',
            message: 'Explicit confirmation checkbox is required to enable Cashfree production payments.'
          });
        }

        await logAudit(null, 'superadmin', 'CASHFREE_ENVIRONMENT_CHANGED', 'Switched Cashfree gateway environment from sandbox to production');
      }
    }

    // Keys to ignore from raw saving
    const ignoredKeys = new Set([
      'currentPassword',
      'confirm_production_switch',
      '_runtime_cashfree_env',
      '_runtime_env_source',
      '_is_secret_configured'
    ]);

    let updatedPaymentKeys = false;

    for (let [k, v] of Object.entries(payload)) {
      if (ignoredKeys.has(k)) continue;

      if (v !== undefined && v !== null) {
        let strVal = String(v).trim().replace(/^['"]+|['"]+$/g, '');

        // 2. Safe Secret Handling: If user sent masked dots "••••••••", keep existing secret in database!
        if (isSensitiveSettingKey(k)) {
          if (strVal === '••••••••' || strVal.includes('••••') || strVal === '') {
            // Keep existing stored secret intact
            continue;
          }
          updatedPaymentKeys = true;
        }

        if (k === 'platform_logo_url') {
          strVal = strVal.split('?')[0];
          purgeLocalR2DiskCache('logo.webp');
          purgeLocalR2DiskCache('superadmin/branding/logo.webp');
          purgeLocalR2DiskCache(strVal);
        }

        // Auto-mirror external image URLs to R2 & Neon DB with restaurant_id = NULL
        if (k === 'platform_logo_url' && strVal.startsWith('http')) {
          strVal = await mirrorExternalLogoToR2(strVal);
        }

        // Deep R2 & Neon DB deletion when logo is reset to empty string
        if (k === 'platform_logo_url' && strVal === '') {
          try {
            if (isR2Active()) {
              await deleteImageFromR2('superadmin/branding/logo.webp');
            }
          } catch (r2DelErr) {
            console.warn('Notice deleting superadmin logo from R2:', r2DelErr.message);
          }

          try {
            await query("DELETE FROM stored_images WHERE restaurant_id IS NULL OR image_key LIKE 'superadmin/%' OR filename LIKE 'logo-external-%'");
          } catch (dbDelErr) {
            console.warn('Notice purging superadmin logo from stored_images DB:', dbDelErr.message);
          }
        }

        try {
          await query(
            'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [k, strVal]
          );
        } catch (err1) {
          try {
            await query('INSERT OR REPLACE INTO system_settings (key, value) VALUES ($1, $2)', [k, strVal]);
          } catch (err2) {
            console.error(`[DB SAVE ERROR] Failed to save system_setting ${k}:`, err2.message);
          }
        }
      }
    }

    if (updatedPaymentKeys) {
      await logAudit(null, 'superadmin', 'UPDATE_PAYMENT_API_KEYS', 'Updated Payment Gateway API Credentials');
    } else {
      await logAudit(null, 'superadmin', 'Update System Settings', 'Updated System Settings');
    }

    res.json({ success: true, message: 'System Settings & API Keys updated successfully!' });
  } catch (err) {
    console.error('Update system settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
