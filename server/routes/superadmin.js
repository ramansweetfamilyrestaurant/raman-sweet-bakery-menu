import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, runAutoDataSummarization, logAudit, saveR2ImageToDb, saveImageToDb, purgeLocalR2DiskCache } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { isR2Active, uploadImageToR2, deleteImageFromR2 } from '../services/r2ImageService.js';

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

// GET All Tenant Restaurants with stats & subscription lifecycle details
router.get('/restaurants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const [restaurants, dishesCount, adminsList, subsList] = await Promise.all([
      query('SELECT * FROM restaurants ORDER BY id DESC'),
      query('SELECT restaurant_id, COUNT(*) as count FROM dishes GROUP BY restaurant_id'),
      query("SELECT id, restaurant_id, username FROM admins WHERE role = 'restaurant_admin'"),
      query('SELECT * FROM subscriptions ORDER BY id DESC').catch(() => [])
    ]);

    const countMap = {};
    dishesCount.forEach(row => {
      countMap[row.restaurant_id] = parseInt(row.count || 0, 10);
    });

    const adminMap = {};
    adminsList.forEach(a => {
      adminMap[a.restaurant_id] = a.username;
    });

    const subMap = {};
    (subsList || []).forEach(s => {
      if (!subMap[s.restaurant_id]) {
        subMap[s.restaurant_id] = s;
      }
    });

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

// POST Create New Tenant Restaurant
router.post('/restaurants', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, owner_username, owner_password, phone, address, tagline, plan_tier, plan_price, plan_expires_at, whatsapp_number, theme_color } = req.body;

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
    const expiryDate = plan_expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const restoRes = await query(`
      INSERT INTO restaurants (
        name, slug, tagline, logo, phone, address, opening_hours, plan_tier, plan_price, plan_expires_at, whatsapp_number, theme_color, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id
    `, [
      name,
      cleanSlug,
      tagline || '100% Quality Food & Service',
      '/uploads/logo.jpg',
      phone || '',
      address || '',
      '8:00 AM - 10:30 PM',
      plan_tier || 'pro',
      plan_price ? parseFloat(plan_price) : 999,
      expiryDate,
      whatsapp_number || phone || '',
      theme_color || 'gold',
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

    await logAudit(newRestoId, 'superadmin', 'Create Tenant', `Created restaurant '${name}' (Slug: ${cleanSlug}, Owner: ${owner_username})`);

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

    // Generate JWT token scoping to this tenant restaurant
    const token = jwt.sign(
      { id: ownerAdmin.id, username: ownerAdmin.username, role: 'restaurant_admin', restaurant_id: resto.id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    await logAudit(resto.id, 'superadmin', 'Impersonation Login', `Super Admin impersonated tenant '${resto.name}'`);

    res.json({
      success: true,
      token,
      username: ownerAdmin.username,
      restaurant: resto
    });
  } catch (err) {
    console.error('Impersonate tenant error:', err);
    res.status(500).json({ error: 'Failed to impersonate tenant' });
  }
});

// PUT Update Tenant Restaurant Details & Reset Owner Credentials
router.put('/restaurants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tagline, logo, phone, address, fssai_lic_no, owner_username, owner_password, plan_tier, plan_price, plan_expires_at, whatsapp_number, whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled, theme_color, order_retention_days, custom_domain } = req.body;

    let cleanDomain = null;
    if (custom_domain !== undefined) {
      cleanDomain = (custom_domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    }

    // Update restaurant info & Feature Control Matrix & Logo
    await query(`
      UPDATE restaurants
      SET name = $1, tagline = $2, logo = $3, phone = $4, address = $5, fssai_lic_no = $6,
          plan_tier = $7, plan_price = $8, plan_expires_at = $9, whatsapp_number = $10,
          whatsapp_enabled = $11, direct_ordering_enabled = $12, google_reviews_enabled = $13, theme_color = $14,
          order_retention_days = $15, custom_domain = $16
      WHERE id = $17
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

    await logAudit(id, 'superadmin', 'Update Tenant', `Updated details for tenant ID ${id} (${name})`);

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
    const currentSubRows = await query('SELECT * FROM subscriptions WHERE restaurant_id = $1 ORDER BY id DESC LIMIT 1', [id]);
    const currentSub = currentSubRows[0];
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

    await logAudit(id, 'superadmin', 'GRANT_ADMIN_ACCESS', `Granted free ${targetPlan.name} access until ${new Date(expiryDate).toLocaleDateString('en-IN')} (${noteText})`);

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

    await query("UPDATE restaurants SET active = false, mandate_status = 'cancelled', subscription_type = 'PAID' WHERE id = $1", [id]);
    await query("UPDATE subscriptions SET status = 'cancelled', updated_at = $1 WHERE restaurant_id = $2 AND status = 'active'", [nowISO, id]);

    await logAudit(id, 'superadmin', 'Revoke Free Access', `Revoked free access for restaurant #${id}`);
    res.json({ success: true, message: `Revoked free access for restaurant #${id}` });
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
    const plans = await query('SELECT * FROM saas_plans ORDER BY price ASC');
    const counts = await query('SELECT plan_tier, COUNT(*) as count FROM restaurants GROUP BY plan_tier');
    const countMap = {};
    (counts || []).forEach(c => { countMap[c.plan_tier] = parseInt(c.count, 10); });

    const result = (plans || []).map(p => ({
      ...p,
      whatsapp_enabled: p.whatsapp_enabled !== 0 && p.whatsapp_enabled !== false,
      direct_ordering_enabled: p.direct_ordering_enabled !== 0 && p.direct_ordering_enabled !== false,
      google_reviews_enabled: p.google_reviews_enabled !== 0 && p.google_reviews_enabled !== false,
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
    const { key, name, price, original_price, badge, description, whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Plan name is required' });

    const cleanKey = (key || name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();

    await query(`
      INSERT INTO saas_plans (key, name, price, original_price, badge, description, whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      cleanKey,
      name.trim(),
      price ? parseFloat(price) : 999,
      original_price ? parseFloat(original_price) : (price ? parseFloat(price) * 2 - 1 : 1999),
      badge || '👑 CUSTOM',
      description || '',
      whatsapp_enabled ? 1 : 0,
      direct_ordering_enabled ? 1 : 0,
      google_reviews_enabled ? 1 : 0
    ]);

    await logAudit(null, 'superadmin', 'Create SaaS Plan', `Created plan '${name}' (${cleanKey})`);
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
      analytics_export_enabled, multi_language_enabled, watermark_removal_enabled, custom_domain_enabled, dual_printer_enabled
    } = req.body;

    await query(`
      UPDATE saas_plans
      SET name = $1, price = $2, badge = $3, description = $4,
          max_dishes = $5, max_categories = $6, max_combos = $7, max_tables = $8, max_staff_accounts = $9, order_retention_days = $10,
          modifiers_enabled = $11, staff_roles_enabled = $12, whatsapp_ordering_enabled = $13, direct_ordering_enabled = $14,
          audio_alarm_enabled = $15, order_status_whatsapp_enabled = $16, kds_enabled = $17, bluetooth_kot_enabled = $18,
          google_reviews_enabled = $19, ai_review_enabled = $20, stories_enabled = $21, gst_invoice_enabled = $22,
          analytics_export_enabled = $23, multi_language_enabled = $24, watermark_removal_enabled = $25, custom_domain_enabled = $26,
          dual_printer_enabled = $27
      WHERE key = $28
    `, [
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
      modifiers_enabled ? 1 : 0,
      staff_roles_enabled ? 1 : 0,
      whatsapp_ordering_enabled ? 1 : 0,
      direct_ordering_enabled ? 1 : 0,
      audio_alarm_enabled ? 1 : 0,
      order_status_whatsapp_enabled ? 1 : 0,
      kds_enabled ? 1 : 0,
      bluetooth_kot_enabled ? 1 : 0,
      google_reviews_enabled ? 1 : 0,
      ai_review_enabled ? 1 : 0,
      stories_enabled ? 1 : 0,
      gst_invoice_enabled ? 1 : 0,
      analytics_export_enabled ? 1 : 0,
      multi_language_enabled ? 1 : 0,
      watermark_removal_enabled ? 1 : 0,
      custom_domain_enabled ? 1 : 0,
      dual_printer_enabled ? 1 : 0,
      key
    ]);

    await logAudit(null, 'superadmin', 'Update SaaS Plan Matrix', `Updated 24-point plan matrix for '${key}'`);
    res.json({ success: true, message: `SaaS Plan '${name || key}' matrix updated successfully!` });
  } catch (err) {
    console.error('Update SaaS plan matrix error:', err);
    res.status(500).json({ error: 'Failed to update SaaS plan matrix' });
  }
});

// DELETE Custom SaaS Plan
router.delete('/plans/:key', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    if (['basic', 'pro', 'enterprise'].includes(key)) {
      return res.status(400).json({ error: 'Standard system plans (Basic, Pro, Enterprise) cannot be deleted.' });
    }

    await query('DELETE FROM saas_plans WHERE key = $1', [key]);
    await logAudit(null, 'superadmin', 'Delete SaaS Plan', `Deleted SaaS Plan '${key}'`);
    res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (err) {
    console.error('Delete SaaS plan error:', err);
    res.status(500).json({ error: 'Failed to delete SaaS plan' });
  }
});



// GET Platform Audit Logs
router.get('/audit-logs', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50');
    res.json(logs);
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
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

// GET System Settings for Super Admin
router.get('/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM system_settings');
    const settings = {};
    (rows || []).forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    console.error('Fetch system settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST Update System Settings for Super Admin
router.post('/settings', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    
    for (let [k, v] of Object.entries(payload)) {
      if (v !== undefined && v !== null) {
        let strVal = String(v).trim().replace(/^['"]+|['"]+$/g, '');
        
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

    await logAudit(null, 'superadmin', 'Update System Settings', 'Updated System Settings');
    res.json({ success: true, message: 'System Settings & API Keys updated successfully!' });
  } catch (err) {
    console.error('Update system settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
