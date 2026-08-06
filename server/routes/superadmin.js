import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, logAudit } from '../db.js';
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

    await logAudit(null, 'superadmin', 'Super Admin Login', `Master user '${username}' logged in successfully`);

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
    const { name, tagline, logo, phone, address, fssai_lic_no, owner_username, owner_password, plan_tier, plan_price, plan_expires_at, whatsapp_number, whatsapp_enabled, direct_ordering_enabled, google_reviews_enabled, theme_color } = req.body;

    // Update restaurant info & Feature Control Matrix & Logo
    await query(`
      UPDATE restaurants
      SET name = $1, tagline = $2, logo = $3, phone = $4, address = $5, fssai_lic_no = $6,
          plan_tier = $7, plan_price = $8, plan_expires_at = $9, whatsapp_number = $10,
          whatsapp_enabled = $11, direct_ordering_enabled = $12, google_reviews_enabled = $13, theme_color = $14
      WHERE id = $15
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

// DELETE Restaurant Tenant
router.delete('/restaurants/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM restaurants WHERE id = $1', [id]);
    await logAudit(id, 'superadmin', 'Delete Tenant', `Deleted tenant ID ${id}`);
    res.json({ success: true });
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

export default router;
